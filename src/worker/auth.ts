import type { Env } from './db'

const ITERATIONS = 150_000
const SESSION_TTL = 60 * 60 * 12 * 1000 // 12 hours
const MAX_ATTEMPTS = 8
const ATTEMPT_WINDOW = 10 * 60 * 1000 // 10 minutes

export const COOKIE = 'bags_admin'

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer)
}

export async function hashCode(password: string, saltHex: string, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)))
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return toHex(bits)
}

/** Constant-time-ish comparison so a wrong password does not leak timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

export async function adminExists(env: Env): Promise<boolean> {
  const row = await env.DB.prepare('SELECT id FROM admin WHERE id = 1').first<{ id: number }>()
  return Boolean(row)
}

export async function setAdminPassword(env: Env, password: string): Promise<void> {
  const salt = randomToken(16)
  const hash = await hashCode(password, salt)
  await env.DB.prepare(
    `INSERT INTO admin (id, password_hash, salt, iterations) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET password_hash = excluded.password_hash, salt = excluded.salt, iterations = excluded.iterations, updated_at = datetime('now')`,
  )
    .bind(hash, salt, ITERATIONS)
    .run()
}

export async function verifyPassword(env: Env, password: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT password_hash, salt, iterations FROM admin WHERE id = 1').first<{
    password_hash: string
    salt: string
    iterations: number
  }>()
  if (!row) return false
  const hash = await hashCode(password, row.salt, row.iterations)
  return safeEqual(hash, row.password_hash)
}

export async function createSession(env: Env): Promise<{ token: string; maxAge: number }> {
  const token = randomToken(32)
  const now = Date.now()
  await env.DB.prepare('INSERT INTO sessions (token_hash, admin_id, created_at, expires_at) VALUES (?, 1, ?, ?)')
    .bind(await sha256(token), now, now + SESSION_TTL)
    .run()
  return { token, maxAge: Math.floor(SESSION_TTL / 1000) }
}

export async function destroySession(env: Env, token: string | undefined): Promise<void> {
  if (!token) return
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
}

export async function isSignedIn(env: Env, token: string | undefined): Promise<boolean> {
  if (!token) return false
  const row = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(await sha256(token)).first<{ expires_at: number }>()
  if (!row) return false
  if (row.expires_at < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run()
    return false
  }
  return true
}

/** Allow a handful of failed attempts before slowing an attacker down. */
export async function throttle(env: Env, ip: string): Promise<boolean> {
  const since = Date.now() - ATTEMPT_WINDOW
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?').bind(ip, since).first<{ n: number }>()
  return (row?.n ?? 0) < MAX_ATTEMPTS
}

export async function recordAttempt(env: Env, ip: string): Promise<void> {
  await env.DB.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(ip, Date.now()).run()
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(Date.now() - 24 * 60 * 60 * 1000).run()
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return undefined
}

export function sessionCookie(token: string, maxAge: number, secure: boolean): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
}

export function clearCookie(secure: boolean): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}
