import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, ArrowLeft, Check, Copy, Loader2, Landmark, RefreshCw, Smartphone } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { ORDER_STATUS_LABELS, money, type Order as OrderType } from '../../data/types'
import { Button, Container, inputClass } from '../components/ui'
import { api, getOrderToken, type StoreConfig } from '../lib/api'
import { cx } from '../lib/cx'

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        }}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium tabular-nums hover:text-accent"
      >
        {value}
        {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5 text-faint" />}
      </button>
    </div>
  )
}

export function Order() {
  const { reference = '' } = useParams()
  const token = getOrderToken(reference)
  const [order, setOrder] = useState<OrderType | null>(null)
  const [store, setStore] = useState<StoreConfig | null>(null)
  const [error, setError] = useState('')
  const [payError, setPayError] = useState('')
  const [phone, setPhone] = useState('')
  const [pushing, setPushing] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setError('We could not find this order in this browser. Check your email for the order number.')
      return
    }
    try {
      const body = await api<{ order: OrderType }>(`/api/orders/${reference}?token=${encodeURIComponent(token)}`)
      setOrder(body.order)
      setPhone((current) => current || body.order.customer.phone.replace(/^254/, '0'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this order.')
    }
  }, [reference, token])

  useEffect(() => {
    void load()
    api<StoreConfig>('/api/store')
      .then(setStore)
      .catch(() => setStore(null))
  }, [load, refresh])

  // While we are waiting for the PIN, ask the server for the real status.
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setRefresh((n) => n + 1), 5000)
    return () => window.clearInterval(id)
  }, [waiting])

  useEffect(() => {
    if (order && order.status !== 'awaiting_payment') setWaiting(false)
  }, [order])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  async function pay() {
    setPayError('')
    setPushing(true)
    try {
      const result = await api<{ mode?: string; message?: string }>(`/api/orders/${reference}/pay`, {
        method: 'POST',
        body: JSON.stringify({ token, phone }),
      })
      if (result.mode === 'stk') {
        setWaiting(true)
        timer.current = window.setTimeout(() => setWaiting(false), 90_000)
      }
      setRefresh((n) => n + 1)
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start the M-Pesa payment.')
    } finally {
      setPushing(false)
    }
  }

  const canStk = Boolean(store?.payments.stk)
  const status = order?.status ?? 'awaiting_payment'
  const settled = order && status !== 'awaiting_payment' && status !== 'cancelled'

  const paymentBlock = useMemo(() => {
    if (!order || !store) return null
    if (order.paymentMethod === 'bank') {
      return (
        <div>
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Landmark className="size-4" /> Bank transfer
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Transfer {money(order.total)} to the account below, using <span className="font-medium text-fg">{order.reference}</span> as the reference. We will confirm and dispatch once it lands.
          </p>
          <div className="mt-4">
            {store.bank.accountNumber ? (
              <>
                <CopyRow label="Bank" value={store.bank.bankName} />
                <CopyRow label="Account name" value={store.bank.accountName} />
                <CopyRow label="Account number" value={store.bank.accountNumber} />
                <CopyRow label="Branch" value={store.bank.branch} />
              </>
            ) : (
              <p className="rounded-control bg-surface-2 px-3 py-2.5 text-[13.5px] text-muted">
                We will email the account details to {order.customer.email} shortly. You can also switch to M-Pesa above.
              </p>
            )}
            <CopyRow label="Amount" value={money(order.total)} />
            <CopyRow label="Reference" value={order.reference} />
          </div>
        </div>
      )
    }

    if (canStk) {
      return (
        <div>
          <div className="flex items-center gap-2 text-[15px] font-medium">
            <Smartphone className="size-4" /> Pay with M-Pesa
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            We will send a payment request for {money(order.total)} to your phone. Enter your M-Pesa PIN when it appears.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="0712 345 678"
              className={cx(inputClass, 'sm:flex-1')}
              aria-label="M-Pesa phone number"
            />
            <Button onClick={pay} loading={pushing} className="sm:w-auto">
              Send request
            </Button>
          </div>
          {waiting && (
            <p className="mt-3 flex items-center gap-2 text-[13.5px] text-muted">
              <Loader2 className="size-4 animate-spin" /> Waiting for you to enter your PIN…
            </p>
          )}
          {payError && <p className="mt-3 text-[13.5px] text-accent">{payError}</p>}
        </div>
      )
    }

    return (
      <div>
        <div className="flex items-center gap-2 text-[15px] font-medium">
          <Smartphone className="size-4" /> Pay with M-Pesa
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Open M-Pesa on your phone, choose <span className="font-medium text-fg">Lipa na M-Pesa</span> → {store.mpesa.till ? 'Buy Goods and Services' : 'Pay Bill'}, and use the details below. Keep your order number {order.reference} — we confirm your order as soon as the money arrives.
        </p>
        <div className="mt-4">
          {store.mpesa.till ? (
            <CopyRow label="Till number" value={store.mpesa.till} />
          ) : store.mpesa.paybill ? (
            <CopyRow label="Paybill" value={store.mpesa.paybill} />
          ) : (
            <p className="rounded-control bg-surface-2 px-3 py-2.5 text-[13.5px] text-muted">
              Our M-Pesa number will arrive by email with your order confirmation. Reply with the code once you have paid.
            </p>
          )}
          <CopyRow label={store.mpesa.account ? 'Account number' : 'Account / reference'} value={store.mpesa.account ?? order.reference} />
          <CopyRow label="Amount" value={money(order.total)} />
          {store.mpesa.account && <CopyRow label="Your order number" value={order.reference} />}
          <CopyRow label="Name" value={store.mpesa.accountName} />
        </div>
        <p className="mt-4 text-[13px] text-faint">Already paid? Tap refresh below — or reply to your confirmation email with the M-Pesa code.</p>
      </div>
    )
  }, [order, store, canStk, phone, pushing, waiting, payError])

  if (error) {
    return (
      <Container className="pt-16 sm:pt-24">
        <div className="mx-auto max-w-md text-center">
          <span className="round mx-auto grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
            <AlertCircle className="size-6" />
          </span>
          <h1 className="font-display mt-6 text-[36px]">We could not open this order</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{error}</p>
          <Link to="/shop" className="mt-8 inline-flex items-center gap-1.5 text-[14px] underline underline-offset-4">
            <ArrowLeft className="size-4" /> Back to the shop
          </Link>
        </div>
      </Container>
    )
  }

  if (!order) {
    return (
      <Container className="pt-20">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 text-[15px] text-muted">
          <Loader2 className="size-4 animate-spin" /> Loading your order…
        </div>
      </Container>
    )
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[14px] text-muted">Order</p>
          <h1 className="font-display mt-2 text-[40px] leading-none sm:text-[52px]">{order.reference}</h1>
          <p className="mt-2 text-[14px] text-muted">
            Placed {new Date(order.createdAt.replace(' ', 'T') + 'Z').toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cx(
              'inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium',
              settled ? 'bg-fg text-bg' : status === 'cancelled' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-fg',
            )}
          >
            {ORDER_STATUS_LABELS[status]}
          </span>
          {!settled && (
            <button type="button" onClick={() => setRefresh((n) => n + 1)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] hover:border-fg">
              <RefreshCw className="size-3.5" /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div className="flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {settled ? (
              <motion.section key="paid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-card border border-line bg-surface p-6">
                <div className="flex items-start gap-4">
                  <span className="round grid size-11 shrink-0 place-items-center rounded-full bg-fg text-bg">
                    <Check className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-[16px] font-medium">Payment received — thank you</h2>
                    <p className="mt-1 text-[14px] leading-relaxed text-muted">
                      We have your order and are packing it. A confirmation is on its way to {order.customer.email}.
                      {order.mpesaReceipt && <span className="mt-1 block font-medium text-fg">M-Pesa receipt {order.mpesaReceipt}</span>}
                    </p>
                  </div>
                </div>
              </motion.section>
            ) : status === 'cancelled' ? (
              <section className="rounded-card border border-line bg-surface p-6">
                <h2 className="text-[16px] font-medium">This order was cancelled</h2>
                <p className="mt-1 text-[14px] text-muted">Get in touch if that was not what you expected and we will sort it out.</p>
              </section>
            ) : (
              <motion.section key="pay" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-card border border-line bg-surface p-6">
                {order.paymentStatus === 'failed' && (
                  <p className="mb-4 flex items-start gap-2 rounded-control bg-accent-soft px-3 py-2 text-[13.5px] text-accent">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" /> That payment did not go through. You can try again below.
                  </p>
                )}
                {paymentBlock ?? <p className="text-[14px] text-muted">Loading payment details…</p>}
              </motion.section>
            )}
          </AnimatePresence>

          <section className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">{order.fulfilment === 'pickup' ? 'Collect from our shop' : 'Delivering to'}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {order.fulfilment === 'pickup' ? (
                <>
                  {store?.pickupAddress ?? 'Our shop in Nairobi — we will text you the exact spot.'}
                  <br />
                  {order.customer.name}
                  <br />
                  {order.customer.phone}
                </>
              ) : (
                <>
                  {order.customer.name}
                  <br />
                  {order.customer.address}
                  <br />
                  {order.customer.city}
                  <br />
                  {order.customer.phone}
                  {order.distanceKm ? <span className="mt-1 block text-[13px] text-faint">{order.distanceKm} km from the shop</span> : null}
                </>
              )}
            </p>
            {order.fulfilment === 'pickup' && (
              <p className="mt-3 rounded-control bg-surface-2 px-3 py-2 text-[13px] text-muted">Bring your order number {order.reference}. We text you when it is ready.</p>
            )}
          </section>
        </div>

        <aside>
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">What you ordered</h2>
            <ul className="mt-4 divide-y divide-line">
              {order.items.map((item) => (
                <li key={`${item.slug}-${item.option ?? ''}`} className="flex items-center gap-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {item.quantity} × {item.name}
                    </span>
                    {item.option && <span className="block text-[13px] text-muted">{item.option}</span>}
                  </span>
                  <span className="tabular-nums">{money(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{order.fulfilment === 'pickup' ? 'Pick up in store' : `Delivery${order.distanceKm ? ` · ${order.distanceKm} km` : ''}`}</dt>
                <dd className="tabular-nums">{order.shipping === 0 ? 'Free' : money(order.shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(order.total)}</dd>
              </div>
            </dl>
          </div>
          <p className="mt-4 text-center text-[13px] text-faint">
            Need help? <a href={`mailto:${store?.email ?? 'hello@kaderee.co.ke'}`} className="underline underline-offset-4">Email us</a> with your order number.
          </p>
        </aside>
      </div>
    </Container>
  )
}
