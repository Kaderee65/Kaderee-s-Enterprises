import type { Env } from './db'

export interface MpesaConfig {
  key: string
  secret: string
  shortcode: string
  passkey: string
  base: string
  transactionType: string
  callbackSecret?: string
}

export function mpesaConfig(env: Env): MpesaConfig | null {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY } = env
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_SHORTCODE || !MPESA_PASSKEY) return null
  const production = (env.MPESA_ENV ?? 'sandbox').toLowerCase() === 'production'
  return {
    key: MPESA_CONSUMER_KEY,
    secret: MPESA_CONSUMER_SECRET,
    shortcode: MPESA_SHORTCODE,
    passkey: MPESA_PASSKEY,
    base: production ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke',
    transactionType: env.MPESA_TRANSACTION_TYPE ?? (env.MPESA_TILL && !env.MPESA_PAYBILL ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline'),
    callbackSecret: env.MPESA_CALLBACK_SECRET,
  }
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (/^254(7|1)\d{8}$/.test(digits)) return digits
  if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`
  return null
}

async function accessToken(config: MpesaConfig): Promise<string> {
  const auth = btoa(`${config.key}:${config.secret}`)
  const response = await fetch(`${config.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  })
  if (!response.ok) throw new Error(`M-Pesa auth failed (${response.status})`)
  const body = (await response.json()) as { access_token?: string }
  if (!body.access_token) throw new Error('M-Pesa did not return an access token')
  return body.access_token
}

function timestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export interface StkResult {
  checkoutRequestId: string
  customerMessage: string
}

/** Sends the "enter your PIN" prompt to the shopper's phone. */
export async function stkPush(
  config: MpesaConfig,
  input: { phone: string; amount: number; reference: string; description: string; callbackUrl: string },
): Promise<StkResult> {
  const token = await accessToken(config)
  const ts = timestamp()
  const password = btoa(`${config.shortcode}${config.passkey}${ts}`)
  const amount = Math.max(1, Math.round(input.amount))

  const response = await fetch(`${config.base}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: config.transactionType,
      Amount: amount,
      PartyA: input.phone,
      PartyB: config.shortcode,
      PhoneNumber: input.phone,
      CallBackURL: input.callbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 100),
    }),
  })

  const body = (await response.json().catch(() => ({}))) as {
    CheckoutRequestID?: string
    ResponseCode?: string
    errorMessage?: string
    CustomerMessage?: string
    ResponseDescription?: string
  }

  if (!response.ok || body.ResponseCode !== '0' || !body.CheckoutRequestID) {
    throw new Error(body.errorMessage ?? body.ResponseDescription ?? `M-Pesa rejected the request (${response.status})`)
  }
  return { checkoutRequestId: body.CheckoutRequestID, customerMessage: body.CustomerMessage ?? 'Check your phone to complete payment.' }
}

interface CallbackBody {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string
      ResultCode?: number
      ResultDesc?: string
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] }
    }
  }
}

export interface CallbackResult {
  checkoutRequestId?: string
  ok: boolean
  receipt?: string
  amount?: number
  description: string
}

export function parseCallback(body: CallbackBody): CallbackResult {
  const callback = body.Body?.stkCallback
  if (!callback) return { ok: false, description: 'Malformed callback' }
  const items = callback.CallbackMetadata?.Item ?? []
  const value = (name: string) => items.find((i) => i.Name === name)?.Value
  const receipt = value('MpesaReceiptNumber')
  const amount = value('Amount')
  return {
    checkoutRequestId: callback.CheckoutRequestID,
    ok: callback.ResultCode === 0,
    receipt: typeof receipt === 'string' ? receipt : undefined,
    amount: typeof amount === 'number' ? amount : undefined,
    description: callback.ResultDesc ?? 'No description',
  }
}
