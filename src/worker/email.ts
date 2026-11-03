import { money, type Order } from '../data/types'

/** Only these few variables are needed to turn order emails on. */
export interface MailEnv {
  RESEND_API_KEY?: string
  /** e.g. "Kaderee's Enterprises <orders@kaderee.co.ke>". Defaults to Resend's test sender. */
  RESEND_FROM?: string
  /** Base URL of the mail API; only changed for local testing. */
  RESEND_API_URL?: string
}

export const DEFAULT_FROM = "Kaderee's Enterprises <onboarding@resend.dev>"

export function mailReady(env: MailEnv): boolean {
  return Boolean(env.RESEND_API_KEY)
}

/**
 * Sends one email through Resend's HTTP API (works on Workers, no SDK needed).
 * Throws with a readable message when the provider refuses the message.
 */
export async function sendMail(
  env: MailEnv,
  message: { to: string; subject: string; html: string; text: string; replyTo?: string },
): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error('Email is not set up yet.')
  const base = (env.RESEND_API_URL ?? 'https://api.resend.com').replace(/\/+$/, '')
  const response = await fetch(`${base}/emails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM?.trim() || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Email provider refused the message (${response.status}). ${detail.slice(0, 300)}`)
  }
}

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function itemsLines(order: Order): string[] {
  return order.items.map((item) => {
    const label = item.option ? `${item.name} (${item.option})` : item.name
    return `${item.quantity} × ${label} — ${money(item.unitPrice * item.quantity)}`
  })
}

function shell(heading: string, intro: string, rows: string[], footer: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f1ea;font-family:Inter,Helvetica,Arial,sans-serif;color:#231f1c">
  <div style="max-width:560px;margin:0 auto;background:#fffdfa;border:1px solid #e4dbcf;border-radius:18px;padding:28px">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8b7f72">Kaderee's Enterprises</p>
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2">${esc(heading)}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#5d534a">${intro}</p>
    <div style="font-size:15px;line-height:1.75">${rows.join('\n')}</div>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8b7f72">${footer}</p>
  </div>
</body></html>`
}

const row = (label: string, value: string) =>
  `<p style="margin:0 0 6px"><span style="display:inline-block;min-width:130px;color:#8b7f72">${esc(label)}</span> <strong>${esc(value)}</strong></p>`

function orderRows(order: Order): string[] {
  const rows = [row('Order', order.reference), row('Customer', order.customer.name), row('Phone', order.customer.phone), ...itemsLines(order).map((line) => `<p style="margin:0 0 6px">${esc(line)}</p>`)]
  rows.push(row('Subtotal', money(order.subtotal)))
  if (order.shipping > 0) rows.push(row(`Delivery${order.distanceKm ? ` (${order.distanceKm} km)` : ''}`, money(order.shipping)))
  rows.push(row('Total', money(order.total)))
  rows.push(
    row(
      'Handover',
      order.fulfilment === 'pickup'
        ? 'Pick-up at the shop'
        : `Deliver to ${[order.customer.address, order.customer.city].filter(Boolean).join(', ')}`,
    ),
  )
  rows.push(row('Customer email', order.customer.email))
  return rows
}

/** Sent the moment an order is placed, while the money is still pending. */
export function orderPlacedEmail(store: string, order: Order): { subject: string; html: string; text: string } {
  const paid = order.paymentStatus === 'paid'
  const heading = paid ? `Order ${order.reference} is paid` : `New order ${order.reference}`
  const intro = paid
    ? `${esc(order.customer.name)} has been confirmed as paid — ${esc(money(order.total))}.`
    : `${esc(order.customer.name)} has just ordered ${esc(money(order.total))} and is paying by ${order.paymentMethod === 'bank' ? 'bank transfer' : 'M-Pesa'}. Nothing is confirmed until you see the money land.`
  const footer = 'Open Admin → Orders to confirm payment and move the order along.'
  return {
    subject: `${paid ? 'Paid order' : 'New order'} ${order.reference} — ${money(order.total)}`,
    html: shell(heading, intro, orderRows(order), footer),
    text: [`${heading} at ${store}`, '', ...orderRows(order).map((r) => r.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim()), '', footer].join('\n'),
  }
}

/** Sent when the payment is confirmed, by M-Pesa or by hand in the admin panel. */
export function paymentReceivedEmail(store: string, order: Order): { subject: string; html: string; text: string } {
  const receipt = order.mpesaReceipt ? ` M-Pesa receipt ${order.mpesaReceipt}.` : ''
  const heading = `Payment received — ${money(order.total)}`
  const intro = `${esc(order.customer.name)} paid for order ${esc(order.reference)}.${esc(receipt)} Pack and ${order.fulfilment === 'pickup' ? 'keep it ready for pick-up' : 'deliver it when you can'}.`
  const footer = 'Open Admin → Orders to mark it shipped or delivered.'
  return {
    subject: `Payment received ${order.reference} — ${money(order.total)}`,
    html: shell(heading, intro, orderRows(order), footer),
    text: [
      `${heading} at ${store}`,
      '',
      ...orderRows(order).map((r) => r.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim()),
      '',
      footer,
    ].join('\n'),
  }
}

/** The "is it working?" message the admin panel can send. */
export function testEmail(store: string, to: string): { subject: string; html: string; text: string } {
  const heading = 'Order emails are working'
  const intro = `This is a test from ${esc(store)}. From now on, every new order and every confirmed payment is emailed to <strong>${esc(to)}</strong>.`
  const footer = 'You can change this address in Admin → Payments.'
  return {
    subject: `${store}: order emails are working`,
    html: shell(heading, intro, [], footer),
    text: `${heading}\n\nThis is a test from ${store}. Every new order and confirmed payment will be emailed to ${to}.\n\nChange it in Admin → Payments.`,
  }
}
