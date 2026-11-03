export interface StoreConfig {
  name: string
  email: string
  phone: string
  deliveryRate: number
  pickupAddress: string
  payments: { mpesa: boolean; stk: boolean; bank: boolean }
  bank: { bankName: string; accountName: string; accountNumber: string; branch: string }
  mpesa: { paybill: string | null; till: string | null; accountName: string; account: string | null }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(body?.error ?? 'Something went wrong. Try again.')
  return body
}

export async function uploadImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/api/admin/images', { method: 'POST', body })
  const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || !result.url) throw new Error(result.error ?? 'Could not upload that photo.')
  return result.url
}

// The order token is what lets a shopper (and only that shopper) follow their
// own order without an account. It is kept in this browser.
const KEY = 'kaderee-orders'

type TokenMap = Record<string, string>

function read(): TokenMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as TokenMap
  } catch {
    return {}
  }
}

export function saveOrderToken(reference: string, token: string) {
  const map = read()
  map[reference] = token
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function getOrderToken(reference: string): string | undefined {
  return read()[reference]
}
