import { Hono } from 'hono'

import { CATEGORIES, DELIVERY_RATE_PER_KM, type Category, type Fulfilment, type OrderStatus, type PaymentInstructions, type PaymentMethod, type Product } from '../data/types'
import {
  COOKIE,
  adminExists,
  clearCookie,
  createSession,
  destroySession,
  isSignedIn,
  readCookie,
  recordAttempt,
  sessionCookie,
  setAdminPassword,
  throttle,
  verifyPassword,
} from './auth'
import { ensureDb, getOrderByReference, getProductBySlug, listProducts, loadSettings, mapProduct, setting, type Env, type ProductRow } from './db'
import { mailReady, orderPlacedEmail, paymentReceivedEmail, sendMail, testEmail, type MailEnv } from './email'
import { mpesaConfig, normalizePhone, parseCallback, stkPush } from './mpesa'

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', async (c, next) => {
  await ensureDb(c.env.DB)
  await next()
})

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/products', async (c) => {
  return c.json({ products: await listProducts(c.env.DB) })
})

app.get('/api/products/:slug', async (c) => {
  const product = await getProductBySlug(c.env.DB, c.req.param('slug'))
  if (!product || !product.active) return c.json({ error: 'Not found' }, 404)
  return c.json({ product })
})

const STORE_NAME = (env: Env, s: Record<string, string>) => setting(s, 'store_name', env.STORE_NAME ?? "Kaderee's Enterprises")

function bankDetails(env: Env, s: Record<string, string>) {
  return {
    bankName: setting(s, 'bank_name', env.BANK_NAME ?? 'Equity Bank'),
    accountName: setting(s, 'bank_account_name', env.BANK_ACCOUNT_NAME ?? STORE_NAME(env, s)),
    accountNumber: setting(s, 'bank_account_number', env.BANK_ACCOUNT_NUMBER ?? ''),
    branch: setting(s, 'bank_branch', env.BANK_BRANCH ?? 'Westlands, Nairobi'),
  }
}

function mpesaDetails(env: Env, s: Record<string, string>) {
  return {
    paybill: setting(s, 'mpesa_paybill', env.MPESA_PAYBILL ?? ''),
    till: setting(s, 'mpesa_till', env.MPESA_TILL ?? ''),
    accountName: setting(s, 'mpesa_account_name', env.MPESA_ACCOUNT_NAME ?? STORE_NAME(env, s)),
    account: setting(s, 'mpesa_account_number', env.MPESA_ACCOUNT_NUMBER ?? ''),
  }
}

function deliveryRate(env: Env, s: Record<string, string>): number {
  const fromSettings = Number(setting(s, 'delivery_rate', env.DELIVERY_RATE ?? ''))
  const rate = Number.isFinite(fromSettings) && fromSettings > 0 ? Math.round(fromSettings) : DELIVERY_RATE_PER_KM
  return rate
}

function storePayload(env: Env, s: Record<string, string>) {
  const config = mpesaConfig(env)
  const mpesa = mpesaDetails(env, s)
  const bank = bankDetails(env, s)
  return {
    name: STORE_NAME(env, s),
    email: setting(s, 'store_email', env.STORE_EMAIL ?? 'hello@kaderee.co.ke'),
    phone: setting(s, 'store_phone', env.STORE_PHONE ?? '+254 700 000 000'),
    deliveryRate: deliveryRate(env, s),
    pickupAddress: setting(s, 'pickup_address', env.PICKUP_ADDRESS ?? 'Kaderee\u2019s Enterprises, Nairobi \u2014 we text you the exact spot'),
    payments: {
      mpesa: Boolean(config || mpesa.paybill || mpesa.till),
      stk: Boolean(config),
      bank: Boolean(bank.accountNumber),
    },
    bank,
    mpesa: { paybill: mpesa.paybill || null, till: mpesa.till || null, accountName: mpesa.accountName, account: mpesa.account || null },
  }
}

app.get('/api/store', async (c) => {
  return c.json(storePayload(c.env, await loadSettings(c.env.DB)))
})

/** Where order emails go: the alert address if set, otherwise the contact email. */
function alertAddress(env: Env, s: Record<string, string>): string {
  return (setting(s, 'alert_email', '') || setting(s, 'store_email', env.STORE_EMAIL ?? '')).trim()
}

/** Mail settings coming from the server secret or, failing that, the admin screen. */
function mailEnv(env: Env, s: Record<string, string>): MailEnv {
  return {
    RESEND_API_KEY: (env.RESEND_API_KEY || setting(s, 'resend_api_key', '')).trim(),
    RESEND_FROM: (env.RESEND_FROM || setting(s, 'resend_from', '')).trim() || undefined,
    RESEND_API_URL: env.RESEND_API_URL,
  }
}

/** Runs work after the response so shoppers never wait on the mail provider. */
function background(c: { executionCtx?: { waitUntil: (promise: Promise<unknown>) => void } }, work: Promise<unknown>) {
  const guarded = work.catch((error) => console.error('order email failed:', error))
  try {
    c.executionCtx?.waitUntil(guarded)
  } catch {
    // No execution context (tests, some runtimes): the promise still runs.
  }
}

async function emailOrder(env: Env, settings: Record<string, string>, reference: string, kind: 'placed' | 'paid') {
  const mail = mailEnv(env, settings)
  if (!mailReady(mail)) return
  const to = alertAddress(env, settings)
  if (!to) return
  const order = await getOrderByReference(env.DB, reference)
  if (!order) return
  const store = STORE_NAME(env, settings)
  const message = kind === 'paid' ? paymentReceivedEmail(store, order) : orderPlacedEmail(store, order)
  await sendMail(mail, { to, ...message, replyTo: order.customer.email })
}

function manualMpesa(env: Env, s: Record<string, string>): PaymentInstructions {
  const mpesa = mpesaDetails(env, s)
  return {
    method: 'mpesa',
    mode: 'manual',
    payToName: mpesa.accountName,
    payToLabel: mpesa.paybill ? 'Paybill' : mpesa.till ? 'Till (Buy Goods)' : undefined,
    payToNumber: mpesa.paybill || mpesa.till || undefined,
    payToAccount: mpesa.account || undefined,
    note: mpesa.account ? 'Use our account number, then keep your order number handy.' : 'Use your order number as the account / reference.',
  }
}

function bankPayment(env: Env, s: Record<string, string>): PaymentInstructions {
  const bank = bankDetails(env, s)
  return {
    method: 'bank',
    mode: 'manual',
    bankName: bank.bankName,
    bankAccountName: bank.accountName,
    bankAccountNumber: bank.accountNumber || 'Contact us for bank details',
    bankBranch: bank.branch,
    note: 'Use your order number as the transfer reference.',
  }
}

// --- orders ----------------------------------------------------------------

interface CheckoutLine {
  slug?: string
  option?: string
  quantity?: number
}

interface CheckoutBody {
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  notes?: string
  paymentMethod?: PaymentMethod
  fulfilment?: Fulfilment
  distanceKm?: number
  items?: CheckoutLine[]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function reference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let out = ''
  for (const byte of bytes) out += alphabet[byte % alphabet.length]
  return `KD-${out}`
}

app.post('/api/orders', async (c) => {
  const body = await c.req.json<CheckoutBody>().catch(() => null)
  if (!body) return c.json({ error: 'Could not read that order.' }, 400)

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const phoneRaw = (body.phone ?? '').trim()
  const address = (body.address ?? '').trim()
  const city = (body.city ?? '').trim()
  const method: PaymentMethod = body.paymentMethod === 'bank' ? 'bank' : 'mpesa'
  const fulfilment: Fulfilment = body.fulfilment === 'pickup' ? 'pickup' : 'delivery'
  const settings = await loadSettings(c.env.DB)

  if (name.length < 2) return c.json({ error: 'Enter your full name.' }, 400)
  if (!EMAIL.test(email)) return c.json({ error: 'Enter a valid email address.' }, 400)
  const phone = normalizePhone(phoneRaw)
  if (!phone) return c.json({ error: 'Enter a valid Kenyan phone number, for example 0712 345 678.' }, 400)
  if (fulfilment === 'delivery') {
    if (address.length < 4) return c.json({ error: 'Enter a delivery address, or choose pick-up.' }, 400)
    if (city.length < 2) return c.json({ error: 'Enter your town or city.' }, 400)
  }
  const distanceKm = fulfilment === 'delivery' ? Math.round((Number(body.distanceKm) || 0) * 10) / 10 : 0
  if (fulfilment === 'delivery' && (distanceKm < 1 || distanceKm > 300)) {
    return c.json({ error: 'Enter how far you are from our shop, in kilometres (between 1 and 300).' }, 400)
  }
  if (!body.items?.length) return c.json({ error: 'Your bag is empty.' }, 400)

  const lines: { product: Product; option?: string; quantity: number }[] = []
  for (const line of body.items.slice(0, 20)) {
    if (!line.slug) continue
    const product = await getProductBySlug(c.env.DB, line.slug)
    if (!product || !product.active) return c.json({ error: 'One of the bags in your bag is no longer available.' }, 400)
    const quantity = Math.min(20, Math.max(1, Math.floor(Number(line.quantity) || 1)))
    if (product.stock < quantity) return c.json({ error: `${product.name} only has ${product.stock} left.` }, 400)
    const option = line.option && product.options?.values.includes(line.option) ? line.option : product.options?.values[0]
    lines.push({ product, option, quantity })
  }
  if (!lines.length) return c.json({ error: 'Your bag is empty.' }, 400)

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0)
  // Pick-up is free; delivery is charged per kilometre from the shop.
  const shipping = fulfilment === 'pickup' ? 0 : Math.round(distanceKm * deliveryRate(c.env, settings))
  const total = subtotal + shipping
  const ref = reference()
  const token = crypto.randomUUID().replace(/-/g, '')

  const insert = await c.env.DB.prepare(
    `INSERT INTO orders (reference, token, status, payment_method, payment_status, customer_name, email, phone, address, city, notes, fulfilment, distance_km, subtotal, shipping, total)
     VALUES (?, ?, 'awaiting_payment', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(ref, token, method, name, email, phone, address, city, (body.notes ?? '').slice(0, 500) || null, fulfilment, fulfilment === 'delivery' ? distanceKm : null, subtotal, shipping, total)
    .run()

  const orderId = insert.meta.last_row_id
  const itemStatement = c.env.DB.prepare('INSERT INTO order_items (order_id, slug, name, option, unit_price, quantity) VALUES (?, ?, ?, ?, ?, ?)')
  const stockStatement = c.env.DB.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?')
  await c.env.DB.batch([
    ...lines.map((l) => itemStatement.bind(orderId, l.product.slug, l.product.name, l.option ?? null, l.product.price, l.quantity)),
    ...lines.map((l) => stockStatement.bind(l.quantity, l.product.id)),
  ])

  background(c, emailOrder(c.env, settings, ref, 'placed'))

  const payment = method === 'bank' ? bankPayment(c.env, settings) : manualMpesa(c.env, settings)
  return c.json({ reference: ref, token, total, shipping, fulfilment, distanceKm, payment })
})

app.get('/api/orders/:reference', async (c) => {
  const token = c.req.query('token')
  const order = await getOrderByReference(c.env.DB, c.req.param('reference'))
  if (!order) return c.json({ error: 'Order not found' }, 404)
  const row = await c.env.DB.prepare('SELECT token FROM orders WHERE reference = ?').bind(order.reference).first<{ token: string }>()
  if (!token || token !== row?.token) return c.json({ error: 'Order not found' }, 404)
  return c.json({ order })
})

/** Kicks off the M-Pesa prompt, or explains how to pay by hand. */
app.post('/api/orders/:reference/pay', async (c) => {
  const ref = c.req.param('reference')
  const body = await c.req.json<{ token?: string; phone?: string }>().catch(() => null)
  if (!body?.token) return c.json({ error: 'Missing order token.' }, 400)

  const row = await c.env.DB.prepare('SELECT id, token, payment_method, status, total, reference FROM orders WHERE reference = ?')
    .bind(ref)
    .first<{ id: number; token: string; payment_method: string; status: string; total: number; reference: string }>()
  if (!row || row.token !== body.token) return c.json({ error: 'Order not found' }, 404)
  if (row.status !== 'awaiting_payment') return c.json({ error: 'This order is already settled.' }, 400)

  const settings = await loadSettings(c.env.DB)
  if (row.payment_method === 'bank') return c.json({ payment: bankPayment(c.env, settings) })

  const config = mpesaConfig(c.env)
  if (!config) return c.json({ payment: manualMpesa(c.env, settings) })

  const phone = normalizePhone(body.phone ?? '')
  if (!phone) return c.json({ error: 'Enter a valid M-Pesa phone number.' }, 400)

  const callbackUrl = `${new URL(c.req.url).origin}/api/payments/mpesa/callback${config.callbackSecret ? `?k=${encodeURIComponent(config.callbackSecret)}` : ''}`
  try {
    const result = await stkPush(config, {
      phone,
      amount: row.total,
      reference: row.reference,
      description: `Payment for ${row.reference}`,
      callbackUrl,
    })
    await c.env.DB.prepare('UPDATE orders SET mpesa_checkout_request_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(result.checkoutRequestId, row.id)
      .run()
    return c.json({ mode: 'stk', message: result.customerMessage, checkoutRequestId: result.checkoutRequestId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'M-Pesa could not be reached.'
    return c.json({ error: message }, 502)
  }
})

/** Safaricom posts here once the shopper enters their PIN. */
app.post('/api/payments/mpesa/callback', async (c) => {
  const secret = c.env.MPESA_CALLBACK_SECRET
  if (secret && c.req.query('k') !== secret) return c.json({ ResultCode: 1, ResultDesc: 'Rejected' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const result = parseCallback(body)
  if (!result.checkoutRequestId) return c.json({ ResultCode: 0, ResultDesc: 'Ignored' })

  const row = await c.env.DB.prepare('SELECT id, total, reference FROM orders WHERE mpesa_checkout_request_id = ?')
    .bind(result.checkoutRequestId)
    .first<{ id: number; total: number; reference: string }>()
  if (!row) return c.json({ ResultCode: 0, ResultDesc: 'Unknown order' })

  if (result.ok && (!result.amount || result.amount >= row.total)) {
    await c.env.DB.prepare(
      `UPDATE orders SET payment_status = 'paid', status = 'paid', mpesa_receipt = ?, updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(result.receipt ?? null, row.id)
      .run()
    background(c, loadSettings(c.env.DB).then((settings) => emailOrder(c.env, settings, row.reference, 'paid')))
  } else if (!result.ok) {
    await c.env.DB.prepare(`UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?`).bind(row.id).run()
  }
  return c.json({ ResultCode: 0, ResultDesc: 'Accepted' })
})

app.post('/api/newsletter', async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string })
  if (!body.email || !EMAIL.test(body.email)) return c.json({ error: 'Enter a valid email address.' }, 400)
  await c.env.DB.prepare('INSERT OR IGNORE INTO newsletter (email) VALUES (?)').bind(body.email.toLowerCase()).run()
  return c.json({ ok: true })
})

// --- admin -----------------------------------------------------------------

const secure = (c: { req: { url: string } }) => new URL(c.req.url).protocol === 'https:'

async function signedIn(c: { env: Env; req: { header: (name: string) => string | undefined } }): Promise<boolean> {
  const token = readCookie(c.req.header('cookie'), COOKIE)
  return isSignedIn(c.env, token)
}

function sameOrigin(c: { req: { header: (name: string) => string | undefined; url: string } }): boolean {
  const origin = c.req.header('origin')
  if (!origin) return true
  return origin === new URL(c.req.url).origin
}

app.get('/api/admin/session', async (c) => {
  const exists = await adminExists(c.env)
  const authed = exists && (await signedIn(c))
  return c.json({ setupRequired: !exists, signedIn: authed })
})

app.post('/api/admin/setup', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (await adminExists(c.env)) return c.json({ error: 'An admin already exists. Sign in instead.' }, 400)
  const body = await c.req.json<{ password?: string }>().catch(() => null)
  const password = body?.password ?? ''
  if (password.length < 8) return c.json({ error: 'Use at least 8 characters.' }, 400)
  await setAdminPassword(c.env, password)
  const session = await createSession(c.env)
  c.header('set-cookie', sessionCookie(session.token, session.maxAge, secure(c)))
  return c.json({ ok: true })
})

app.post('/api/admin/login', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  const ip = c.req.header('cf-connecting-ip') ?? 'local'
  if (!(await throttle(c.env, ip))) return c.json({ error: 'Too many attempts. Wait a few minutes and try again.' }, 429)
  const body = await c.req.json<{ password?: string }>().catch(() => null)
  if (!body?.password) return c.json({ error: 'Enter your password.' }, 400)
  if (!(await verifyPassword(c.env, body.password))) {
    await recordAttempt(c.env, ip)
    return c.json({ error: 'That password did not match.' }, 401)
  }
  const session = await createSession(c.env)
  c.header('set-cookie', sessionCookie(session.token, session.maxAge, secure(c)))
  return c.json({ ok: true })
})

app.post('/api/admin/logout', async (c) => {
  await destroySession(c.env, readCookie(c.req.header('cookie'), COOKIE))
  c.header('set-cookie', clearCookie(secure(c)))
  return c.json({ ok: true })
})

app.post('/api/admin/password', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Sign in first.' }, 401)
  const body = await c.req.json<{ current?: string; next?: string }>().catch(() => null)
  if (!body?.current || !body.next) return c.json({ error: 'Fill in both passwords.' }, 400)
  if (body.next.length < 8) return c.json({ error: 'Use at least 8 characters.' }, 400)
  if (!(await verifyPassword(c.env, body.current))) return c.json({ error: 'Current password is wrong.' }, 401)
  await setAdminPassword(c.env, body.next)
  await c.env.DB.prepare('DELETE FROM sessions').run()
  const session = await createSession(c.env)
  c.header('set-cookie', sessionCookie(session.token, session.maxAge, secure(c)))
  return c.json({ ok: true })
})

app.get('/api/admin/orders', async (c) => {
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const status = c.req.query('status')
  const sql = status && status !== 'all' ? 'SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 300' : 'SELECT * FROM orders ORDER BY id DESC LIMIT 300'
  const statement = c.env.DB.prepare(sql)
  const { results } = await (status && status !== 'all' ? statement.bind(status) : statement).all<Record<string, unknown>>()
  const rows = (results ?? []) as unknown as {
    id: number
    reference: string
    status: string
    payment_method: string
    payment_status: string
    customer_name: string
    email: string
    phone: string
    address: string
    city: string
    notes: string | null
    subtotal: number
    shipping: number
    total: number
    mpesa_receipt: string | null
    created_at: string
  }[]

  const orders = []
  for (const row of rows) {
    const { results: items } = await c.env.DB.prepare('SELECT slug, name, option, unit_price, quantity FROM order_items WHERE order_id = ?')
      .bind(row.id)
      .all<{ slug: string; name: string; option: string | null; unit_price: number; quantity: number }>()
    orders.push({
      reference: row.reference,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      customer: { name: row.customer_name, email: row.email, phone: row.phone, address: row.address, city: row.city, notes: row.notes ?? undefined },
      items: (items ?? []).map((i) => ({ slug: i.slug, name: i.name, option: i.option ?? undefined, unitPrice: i.unit_price, quantity: i.quantity })),
      subtotal: row.subtotal,
      shipping: row.shipping,
      total: row.total,
      createdAt: row.created_at,
      mpesaReceipt: row.mpesa_receipt ?? undefined,
    })
  }

  const stats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'awaiting_payment' THEN 1 ELSE 0 END) AS awaiting,
       SUM(CASE WHEN status IN ('paid','shipped','delivered') THEN 1 ELSE 0 END) AS paid,
       SUM(CASE WHEN status IN ('paid','shipped','delivered') THEN total ELSE 0 END) AS revenue
     FROM orders`,
  ).first<{ total: number; awaiting: number; paid: number; revenue: number }>()

  return c.json({ orders, stats: { total: stats?.total ?? 0, awaiting: stats?.awaiting ?? 0, paid: stats?.paid ?? 0, revenue: stats?.revenue ?? 0 } })
})

app.patch('/api/admin/orders/:reference', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json<{ status?: OrderStatus; paymentStatus?: string }>().catch(() => null)
  const allowed: OrderStatus[] = ['awaiting_payment', 'paid', 'shipped', 'delivered', 'cancelled']
  if (!body?.status || !allowed.includes(body.status)) return c.json({ error: 'Unknown status.' }, 400)

  const order = await c.env.DB.prepare('SELECT id, status FROM orders WHERE reference = ?').bind(c.req.param('reference')).first<{ id: number; status: string }>()
  if (!order) return c.json({ error: 'Order not found' }, 404)

  const paymentStatus = body.status === 'cancelled' ? 'failed' : body.status === 'awaiting_payment' ? 'pending' : 'paid'

  // Cancelling returns the reserved stock to the shelf.
  if (body.status === 'cancelled' && order.status !== 'cancelled') {
    const { results } = await c.env.DB.prepare('SELECT slug, quantity FROM order_items WHERE order_id = ?').bind(order.id).all<{ slug: string; quantity: number }>()
    if (results?.length) {
      await c.env.DB.batch(
        results.map((item) => c.env.DB.prepare('UPDATE products SET stock = stock + ? WHERE slug = ?').bind(item.quantity, item.slug)),
      )
    }
  }

  await c.env.DB.prepare(`UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(body.status, paymentStatus, order.id)
    .run()

  // Money just landed: tell the owner once, not on every later status change.
  if (paymentStatus === 'paid' && order.status === 'awaiting_payment') {
    const reference = c.req.param('reference')
    background(c, loadSettings(c.env.DB).then((settings) => emailOrder(c.env, settings, reference, 'paid')))
  }
  return c.json({ ok: true })
})

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 1024 * 1024

/** Photos uploaded from the admin panel are kept in the shop database. */
app.post('/api/admin/images', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return c.json({ error: 'Choose a photo to upload.' }, 400)
  if (!IMAGE_TYPES.has(file.type)) return c.json({ error: 'Use a JPG, PNG or WebP photo.' }, 400)
  if (file.size > MAX_IMAGE_BYTES) return c.json({ error: 'That photo is too big — try another one.' }, 413)
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20)
  await c.env.DB.prepare('INSERT INTO images (id, mime, bytes) VALUES (?, ?, ?)')
    .bind(id, file.type, await file.arrayBuffer())
    .run()
  return c.json({ url: `/api/images/${id}` }, 201)
})

app.get('/api/images/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT mime, bytes FROM images WHERE id = ?')
    .bind(c.req.param('id'))
    .first<{ mime: string; bytes: ArrayBuffer | Uint8Array | number[] }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  const bytes = row.bytes instanceof ArrayBuffer
    ? new Uint8Array(row.bytes)
    : Array.isArray(row.bytes)
      ? Uint8Array.from(row.bytes)
      : new Uint8Array(row.bytes)
  return new Response(bytes, {
    headers: {
      'content-type': row.mime,
      'content-length': String(bytes.byteLength),
      'cache-control': 'public, max-age=31536000, immutable',
      etag: `"${c.req.param('id')}"`,
    },
  })
})

app.get('/api/admin/products', async (c) => {
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  return c.json({ products: await listProducts(c.env.DB, true) })
})

interface ProductInput {
  name?: string
  price?: number | string
  compareAt?: number | string | null
  category?: string
  image?: string
  badge?: string
  short?: string
  description?: string
  details?: string[] | string
  materials?: string
  options?: { name?: string; values?: string[] | string } | null
  stock?: number | string
  featured?: boolean
  active?: boolean
  slug?: string
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function normalizeDetails(input: ProductInput['details']): string[] {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean)
  return String(input ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeOptions(input: ProductInput['options']): { name: string; values: string[] } | null {
  if (!input) return null
  const values = (Array.isArray(input.values) ? input.values : String(input.values ?? '').split(','))
    .map((v) => String(v).trim())
    .filter(Boolean)
  if (!values.length) return null
  return { name: String(input.name ?? 'Option').trim() || 'Option', values }
}

const CATEGORY_KEYS: Category[] = CATEGORIES.map((c) => c.key)

app.post('/api/admin/products', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json<ProductInput>().catch(() => null)
  if (!body) return c.json({ error: 'Could not read that product.' }, 400)
  const name = String(body.name ?? '').trim()
  const price = Math.round(Number(body.price))
  if (!name) return c.json({ error: 'Give the bag a name.' }, 400)
  if (!Number.isFinite(price) || price <= 0) return c.json({ error: 'Enter a price in shillings.' }, 400)
  const category = CATEGORY_KEYS.includes(body.category as Category) ? (body.category as Category) : CATEGORY_KEYS[0]
  let slug = slugify(body.slug || name)
  if (!slug) return c.json({ error: 'Give the bag a name with letters or numbers.' }, 400)

  const taken = await c.env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: number }>()
  if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const options = normalizeOptions(body.options)
  const maxOrder = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM products').first<{ n: number }>()

  await c.env.DB.prepare(
    `INSERT INTO products (slug, name, price, compare_at, category, image, badge, short, description, details, materials, options, stock, featured, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      slug,
      name,
      price,
      body.compareAt ? Math.round(Number(body.compareAt)) : null,
      category,
      String(body.image ?? '').trim() || '/images/kitenge-map-big.svg',
      String(body.badge ?? '').trim() || null,
      String(body.short ?? '').trim() || name,
      String(body.description ?? '').trim() || name,
      JSON.stringify(normalizeDetails(body.details)),
      String(body.materials ?? '').trim(),
      options ? JSON.stringify(options) : null,
      Math.max(0, Math.round(Number(body.stock ?? 0)) || 0),
      body.featured ? 1 : 0,
      body.active === false ? 0 : 1,
      (maxOrder?.n ?? 0) + 1,
    )
    .run()

  const product = await getProductBySlug(c.env.DB, slug)
  return c.json({ product })
})

app.patch('/api/admin/products/:id', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const id = Number(c.req.param('id'))
  const body = await c.req.json<ProductInput>().catch(() => null)
  if (!body) return c.json({ error: 'Could not read that product.' }, 400)
  const row = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  if (!row) return c.json({ error: 'Product not found' }, 404)
  const current = mapProduct(row)

  const price = body.price === undefined ? current.price : Math.round(Number(body.price))
  if (!Number.isFinite(price) || price <= 0) return c.json({ error: 'Enter a price in shillings.' }, 400)

  const options = body.options === undefined ? current.options ?? null : normalizeOptions(body.options)
  const details = body.details === undefined ? current.details : normalizeDetails(body.details)

  await c.env.DB.prepare(
    `UPDATE products SET name = ?, price = ?, compare_at = ?, category = ?, image = ?, badge = ?, short = ?, description = ?, details = ?, materials = ?, options = ?, stock = ?, featured = ?, active = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(
      body.name === undefined ? current.name : String(body.name).trim() || current.name,
      price,
      body.compareAt === undefined ? current.compareAt ?? null : body.compareAt ? Math.round(Number(body.compareAt)) : null,
      CATEGORY_KEYS.includes(body.category as Category) ? (body.category as Category) : current.category,
      body.image === undefined ? current.image : String(body.image).trim() || current.image,
      body.badge === undefined ? current.badge ?? null : String(body.badge).trim() || null,
      body.short === undefined ? current.short : String(body.short).trim(),
      body.description === undefined ? current.description : String(body.description).trim(),
      JSON.stringify(details),
      body.materials === undefined ? current.materials : String(body.materials).trim(),
      options ? JSON.stringify(options) : null,
      body.stock === undefined ? current.stock : Math.max(0, Math.round(Number(body.stock)) || 0),
      body.featured === undefined ? (current.featured ? 1 : 0) : body.featured ? 1 : 0,
      body.active === undefined ? (current.active ? 1 : 0) : body.active ? 1 : 0,
      id,
    )
    .run()

  const updated = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<ProductRow>()
  return c.json({ product: updated ? mapProduct(updated) : null })
})

const SETTING_KEYS = [
  'store_name',
  'store_email',
  'store_phone',
  'mpesa_paybill',
  'mpesa_till',
  'mpesa_account_name',
  'mpesa_account_number',
  'delivery_rate',
  'pickup_address',
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'bank_branch',
  'alert_email',
  'resend_api_key',
  'resend_from',
]

app.get('/api/admin/settings', async (c) => {
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const settings = await loadSettings(c.env.DB)
  const mail = mailEnv(c.env, settings)
  const { resend_api_key: key, ...safeSettings } = settings
  return c.json({
    // The key is never sent back to the browser; the screen only learns whether one is set.
    settings: safeSettings,
    store: storePayload(c.env, settings),
    stkAvailable: Boolean(mpesaConfig(c.env)),
    email: { ready: mailReady(mail), to: alertAddress(c.env, settings), keySet: Boolean(key || c.env.RESEND_API_KEY) },
  })
})

/** Lets the owner prove their alert inbox works before relying on it. */
app.post('/api/admin/test-email', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const settings = await loadSettings(c.env.DB)
  const to = alertAddress(c.env, settings)
  if (!to) return c.json({ error: 'Add the email address that should receive order alerts first.' }, 400)
  const mail = mailEnv(c.env, settings)
  if (!mailReady(mail)) return c.json({ error: 'Email is not switched on yet: paste a Resend API key below, or add a RESEND_API_KEY secret.' }, 400)
  try {
    await sendMail(mail, { to, ...testEmail(STORE_NAME(c.env, settings), to) })
    return c.json({ ok: true, to })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Could not send that email.' }, 502)
  }
})

app.put('/api/admin/settings', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const body = await c.req.json<Record<string, string>>().catch(() => null)
  if (!body) return c.json({ error: 'Could not read those settings.' }, 400)
  const statements = SETTING_KEYS.filter((key) => key in body).map((key) =>
    c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').bind(key, String(body[key] ?? '').slice(0, 200)),
  )
  if (statements.length) await c.env.DB.batch(statements)
  const settings = await loadSettings(c.env.DB)
  return c.json({ ok: true, store: storePayload(c.env, settings) })
})

app.delete('/api/admin/products/:id', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'Bad origin' }, 403)
  if (!(await signedIn(c))) return c.json({ error: 'Unauthorized' }, 401)
  const id = Number(c.req.param('id'))
  // Orders keep their own copy of each line, so removing a bag is safe.
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))

export default app
