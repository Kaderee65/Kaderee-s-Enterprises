import { CreditCard, Landmark, Lock, MapPin, Smartphone, Store, Truck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { DELIVERY_RATE_PER_KM, money, type Fulfilment, type PaymentInstructions, type PaymentMethod } from '../../data/types'
import { PaymentPrompt } from '../components/PaymentPrompt'
import { Button, Container, inputClass } from '../components/ui'
import { api, saveOrderToken, type StoreConfig } from '../lib/api'
import { useCart } from '../lib/cart'
import { cx } from '../lib/cx'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
    </label>
  )
}

interface CreateResponse {
  reference: string
  token: string
  total: number
  shipping: number
  fulfilment: Fulfilment
  distanceKm: number
  payment: PaymentInstructions
}

export function Checkout() {
  const cart = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: 'Nairobi', notes: '' })
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery')
  const [distance, setDistance] = useState('')
  const [store, setStore] = useState<StoreConfig | null>(null)
  const [state, setState] = useState<'idle' | 'sending'>('idle')
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState<CreateResponse | null>(null)

  useEffect(() => {
    api<StoreConfig>('/api/store')
      .then(setStore)
      .catch(() => setStore(null))
  }, [])

  if (!placed && cart.ready && cart.lines.length === 0) return <Navigate to="/shop" replace />

  const rate = store?.deliveryRate ?? DELIVERY_RATE_PER_KM
  const km = Math.min(300, Math.max(0, Number(distance) || 0))
  const shipping = fulfilment === 'pickup' ? 0 : Math.round(km * rate)
  const total = cart.subtotal + shipping
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setState('sending')
    try {
      const body = await api<CreateResponse>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          paymentMethod: method,
          fulfilment,
          distanceKm: fulfilment === 'delivery' ? km : 0,
          items: cart.lines.map((l) => ({ slug: l.slug, option: l.option, quantity: l.quantity })),
        }),
      })
      saveOrderToken(body.reference, body.token)
      cart.clear()
      // Show the payment details straight away, rather than leaving the shopper
      // to hunt for them on the next screen.
      setPlaced(body)
      setState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setState('idle')
    }
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <h1 className="font-display text-[44px] sm:text-[56px]">Checkout</h1>            <p className="mt-2 text-[14px] text-muted">Delivery or store pick-up. Pay by M-Pesa or bank transfer, no account needed.</p>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_420px] lg:gap-20">
        <form onSubmit={submit} className="flex flex-col gap-10">
          <section>
            <h2 className="text-[16px] font-medium">Your details</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Full name" className="col-span-2">
                <input required className={inputClass} value={form.name} onChange={set('name')} autoComplete="name" />
              </Field>
              <Field label="Email">
                <input type="email" required className={inputClass} value={form.email} onChange={set('email')} autoComplete="email" />
              </Field>
              <Field label="Phone (M-Pesa)">
                <input required inputMode="tel" placeholder="0712 345 678" className={inputClass} value={form.phone} onChange={set('phone')} autoComplete="tel" />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="text-[16px] font-medium">How you get it</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FulfilmentOption
                active={fulfilment === 'delivery'}
                onClick={() => setFulfilment('delivery')}
                icon={<Truck className="size-4.5" />}
                title="Deliver to me"
                body={`${money(rate)} per km from our shop`}
              />
              <FulfilmentOption
                active={fulfilment === 'pickup'}
                onClick={() => setFulfilment('pickup')}
                icon={<Store className="size-4.5" />}
                title="Pick up in store"
                body="Free — collect it yourself"
              />
            </div>

            {fulfilment === 'delivery' ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Address or building" className="col-span-2">
                  <input required className={inputClass} value={form.address} onChange={set('address')} autoComplete="street-address" />
                </Field>
                <Field label="Town or city">
                  <input required className={inputClass} value={form.city} onChange={set('city')} autoComplete="address-level2" />
                </Field>
                <Field label="Distance from our shop (km)">
                  <input
                    required
                    type="number"
                    min={1}
                    max={300}
                    step={0.5}
                    inputMode="decimal"
                    className={inputClass}
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    placeholder="8"
                  />
                </Field>
                <p className="col-span-2 flex items-start gap-2 text-[13px] text-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {km >= 1
                    ? `Delivery ${money(shipping)} — ${km} km at ${money(rate)} per km.`
                    : `We charge ${money(rate)} per kilometre. Enter the distance and the fee appears in your summary.`}
                </p>
                <Field label="Landmark or notes" className="col-span-2">
                  <input className={inputClass} placeholder="Optional" value={form.notes} onChange={set('notes')} />
                </Field>
              </div>
            ) : (
              <div className="mt-4 rounded-card border border-line bg-surface p-4">
                <p className="text-[14px] font-medium">Collect from</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{store?.pickupAddress ?? 'Our shop in Nairobi — we text you the exact spot when your order is ready.'}</p>
                <p className="mt-2 text-[13px] text-faint">No delivery fee. Bring your order number with you.</p>
                <Field label="Anything we should know?" className="mt-4">
                  <input className={inputClass} placeholder="Optional" value={form.notes} onChange={set('notes')} />
                </Field>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[16px] font-medium">Payment</h2>
            <div className="mt-4 grid gap-3">
              <PaymentOption
                active={method === 'mpesa'}
                onClick={() => setMethod('mpesa')}
                icon={<Smartphone className="size-4.5" />}
                title="M-Pesa"
                body="Pay to our paybill — the number and account appear the moment you place the order."
              />
              <PaymentOption
                active={method === 'bank'}
                onClick={() => setMethod('bank')}
                icon={<Landmark className="size-4.5" />}
                title="Bank transfer"
                body="Transfer the total to our account using your order number as the reference."
              />
            </div>
            <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
              <Lock className="mt-0.5 size-4 shrink-0" />
              Your order is reserved the moment you place it, and payment details appear straight away.
            </p>
          </section>

          {error && <p className="rounded-control border border-line bg-surface px-4 py-3 text-[14px] text-accent">{error}</p>}
          <Button type="submit" size="lg" loading={state === 'sending'} className="w-full sm:w-auto">
            <CreditCard className="size-4" />
            Place order · {money(total)}
          </Button>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[16px] font-medium">Order summary</h2>
            <ul className="mt-4 divide-y divide-line">
              {cart.lines.map((item) => (
                <li key={`${item.slug}-${item.option ?? ''}`} className="flex items-center gap-4 py-3">
                  <span className="image-frame relative size-16 shrink-0 rounded-[14px]">
                    <img src={item.image} alt="" className="size-full object-cover" />
                    <span className="round absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg">{item.quantity}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{item.name}</span>
                    {item.option && <span className="block text-[13px] text-muted">{item.option}</span>}
                  </span>
                  <span className="tabular-nums">{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="tabular-nums">{money(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{fulfilment === 'pickup' ? 'Pick up in store' : km >= 1 ? `Delivery · ${km} km` : 'Delivery'}</dt>
                <dd className="tabular-nums">{fulfilment === 'pickup' ? 'Free' : km >= 1 ? money(shipping) : '—'}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {placed && (
        <PaymentPrompt
          open
          reference={placed.reference}
          total={placed.total}
          phone={form.phone}
          payment={placed.payment}
          onClose={() => navigate(`/order/${placed.reference}`)}
        />
      )}
    </Container>
  )
}

function FulfilmentOption({ active, onClick, icon, title, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors', active ? 'border-fg bg-surface' : 'border-line bg-transparent hover:border-line-strong')}
    >
      <span className={cx('grid size-9 shrink-0 place-items-center rounded-[11px]', active ? 'bg-fg text-bg' : 'bg-surface-2 text-fg')}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[14.5px] font-medium">
          {title}
          <span className={cx('round size-3.5 rounded-full border', active ? 'border-fg bg-fg ring-2 ring-bg ring-inset' : 'border-line-strong')} />
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{body}</span>
      </span>
    </button>
  )
}

function PaymentOption({ active, onClick, icon, title, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('flex w-full items-start gap-4 rounded-card border p-4 text-left transition-colors', active ? 'border-fg bg-surface' : 'border-line bg-transparent hover:border-line-strong')}
    >
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-[12px]', active ? 'bg-fg text-bg' : 'bg-surface-2 text-fg')}>{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[15px] font-medium">
          {title}
          <span className={cx('round size-3.5 rounded-full border', active ? 'border-fg bg-fg ring-2 ring-bg ring-inset' : 'border-line-strong')} />
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-muted">{body}</span>
      </span>
    </button>
  )
}
