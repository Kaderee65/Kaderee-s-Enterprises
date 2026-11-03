import type { Category, Order, OrderStatus, PaymentMethod, PaymentStatus, Product } from '../data/types'
import { seedProducts } from './seed'

export interface Env {
  ASSETS: Fetcher
  DB: D1Database

  // Safaricom Daraja (M-Pesa). All optional: without them the store falls back
  // to manual M-Pesa payment instructions that the admin confirms by hand.
  MPESA_ENV?: string
  MPESA_CONSUMER_KEY?: string
  MPESA_CONSUMER_SECRET?: string
  MPESA_SHORTCODE?: string
  MPESA_PASSKEY?: string
  MPESA_TRANSACTION_TYPE?: string
  MPESA_CALLBACK_SECRET?: string

  // Where a manual M-Pesa payment should go (paybill / till).
  MPESA_PAYBILL?: string
  MPESA_TILL?: string
  MPESA_ACCOUNT_NAME?: string
  // The account shoppers type after the paybill number.
  MPESA_ACCOUNT_NUMBER?: string

  // Manual bank transfer details.
  BANK_NAME?: string
  BANK_ACCOUNT_NAME?: string
  BANK_ACCOUNT_NUMBER?: string
  BANK_BRANCH?: string

  // Delivery.
  DELIVERY_RATE?: string
  PICKUP_ADDRESS?: string

  // Storefront settings.
  STORE_NAME?: string
  STORE_EMAIL?: string
  STORE_PHONE?: string

  // Order notification emails through Resend. All optional: without a key the
  // shop simply runs without email alerts.
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  RESEND_API_URL?: string
}

export interface ProductRow {
  id: number
  slug: string
  name: string
  price: number
  compare_at: number | null
  category: string
  image: string
  badge: string | null
  short: string
  description: string
  details: string
  materials: string
  options: string | null
  stock: number
  featured: number
  active: number
  sort_order: number
}

export interface OrderRow {
  id: number
  reference: string
  token: string
  status: string
  payment_method: string
  payment_status: string
  customer_name: string
  email: string
  phone: string
  address: string
  city: string
  notes: string | null
  fulfilment: string
  distance_km: number | null
  subtotal: number
  shipping: number
  total: number
  mpesa_receipt: string | null
  created_at: string
  updated_at: string
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  compare_at INTEGER,
  category TEXT NOT NULL,
  image TEXT NOT NULL,
  badge TEXT,
  short TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '[]',
  materials TEXT NOT NULL DEFAULT '',
  options TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  notes TEXT,
  fulfilment TEXT NOT NULL DEFAULT 'delivery',
  distance_km REAL,
  subtotal INTEGER NOT NULL,
  shipping INTEGER NOT NULL,
  total INTEGER NOT NULL,
  mpesa_checkout_request_id TEXT,
  mpesa_receipt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS orders_created_at ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  option TEXT,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS order_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts (ip, at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS newsletter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    compareAt: row.compare_at ?? undefined,
    category: row.category as Category,
    image: row.image,
    badge: row.badge ?? undefined,
    short: row.short,
    description: row.description,
    details: safeJson<string[]>(row.details, []),
    materials: row.materials,
    options: row.options ? safeJson<Product['options']>(row.options, undefined) : undefined,
    stock: row.stock,
    featured: row.featured === 1,
    active: row.active === 1,
  }
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

let ready: Promise<void> | null = null

/** Create the schema and seed the catalogue once per Worker isolate. */
export function ensureDb(db: D1Database): Promise<void> {
  if (!ready) {
    ready = init(db).catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}

async function init(db: D1Database) {
  const statements = SCHEMA.split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const sql of statements) await db.prepare(sql).run()
  await migrate(db)

  const count = await db.prepare('SELECT COUNT(*) AS n FROM products').first<{ n: number }>()
  if ((count?.n ?? 0) > 0) return

  const insert = db.prepare(
    `INSERT INTO products (slug, name, price, compare_at, category, image, badge, short, description, details, materials, options, stock, featured, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  )
  const batch = seedProducts.map((p, index) =>
    insert.bind(p.slug, p.name, p.price, p.compareAt ?? null, p.category, p.image, p.badge ?? null, p.short, p.description, JSON.stringify(p.details), p.materials, p.options ? JSON.stringify(p.options) : null, p.stock, p.featured ? 1 : 0, index),
  )
  await db.batch(batch)
}

/** Add columns that older databases (created before delivery options) are missing. */
async function migrate(db: D1Database) {
  const { results } = await db.prepare('PRAGMA table_info(orders)').all<{ name: string }>()
  const columns = new Set((results ?? []).map((row) => row.name))
  if (!columns.has('fulfilment')) await db.prepare("ALTER TABLE orders ADD COLUMN fulfilment TEXT NOT NULL DEFAULT 'delivery'").run()
  if (!columns.has('distance_km')) await db.prepare('ALTER TABLE orders ADD COLUMN distance_km REAL').run()
}

export async function listProducts(db: D1Database, includeInactive = false): Promise<Product[]> {
  const sql = includeInactive
    ? 'SELECT * FROM products ORDER BY sort_order ASC, id ASC'
    : 'SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, id ASC'
  const { results } = await db.prepare(sql).all<ProductRow>()
  return (results ?? []).map(mapProduct)
}

export async function getProductBySlug(db: D1Database, slug: string): Promise<Product | null> {
  const row = await db.prepare('SELECT * FROM products WHERE slug = ?').bind(slug).first<ProductRow>()
  return row ? mapProduct(row) : null
}

/** Owner-editable settings (payment numbers, bank details). */
export async function loadSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>()
  return Object.fromEntries((results ?? []).map((row) => [row.key, row.value]))
}

export function setting(settings: Record<string, string>, key: string, fallback?: string): string {
  const value = settings[key]?.trim()
  return value ? value : fallback ?? ''
}

export async function getOrderByReference(db: D1Database, reference: string): Promise<Order | null> {
  const row = await db.prepare('SELECT * FROM orders WHERE reference = ?').bind(reference).first<OrderRow>()
  if (!row) return null
  const { results } = await db
    .prepare('SELECT slug, name, option, unit_price, quantity FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .bind(row.id)
    .all<{ slug: string; name: string; option: string | null; unit_price: number; quantity: number }>()
  return {
    reference: row.reference,
    status: row.status as OrderStatus,
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    fulfilment: row.fulfilment === 'pickup' ? 'pickup' : 'delivery',
    distanceKm: row.distance_km ?? undefined,
    customer: {
      name: row.customer_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      city: row.city,
      notes: row.notes ?? undefined,
    },
    items: (results ?? []).map((item) => ({
      slug: item.slug,
      name: item.name,
      option: item.option ?? undefined,
      unitPrice: item.unit_price,
      quantity: item.quantity,
    })),
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    createdAt: row.created_at,
    mpesaReceipt: row.mpesa_receipt ?? undefined,
  }
}
