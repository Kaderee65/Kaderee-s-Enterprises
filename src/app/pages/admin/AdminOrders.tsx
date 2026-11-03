import { ChevronDown, Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { ORDER_STATUS_LABELS, money, type Order, type OrderStatus } from '../../../data/types'
import { Button } from '../../components/ui'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'

interface Stats {
  total: number
  awaiting: number
  paid: number
  revenue: number
}

const filters: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_payment', label: 'Awaiting payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
]

const nextActions: Record<OrderStatus, { status: OrderStatus; label: string }[]> = {
  awaiting_payment: [
    { status: 'paid', label: 'Mark as paid' },
    { status: 'cancelled', label: 'Cancel' },
  ],
  paid: [
    { status: 'shipped', label: 'Mark as shipped' },
    { status: 'cancelled', label: 'Cancel' },
  ],
  shipped: [{ status: 'delivered', label: 'Mark as delivered' }],
  delivered: [{ status: 'cancelled', label: 'Cancel' }],
  cancelled: [{ status: 'awaiting_payment', label: 'Reopen' }],
}

export function AdminOrders({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const body = await api<{ orders: Order[]; stats: Stats }>(`/api/admin/orders?status=${filter}`)
      setOrders(body.orders)
      setStats(body.stats)
      setError('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load orders.'
      if (message.toLowerCase().includes('unauthorized')) onUnauthorized()
      else setError(message)
    } finally {
      setLoading(false)
    }
  }, [filter, onUnauthorized])

  useEffect(() => {
    void load()
  }, [load])

  async function update(reference: string, status: OrderStatus) {
    setBusy(reference)
    try {
      await api(`/api/admin/orders/${reference}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Orders', value: stats ? String(stats.total) : '—' },
          { label: 'Awaiting payment', value: stats ? String(stats.awaiting) : '—' },
          { label: 'Paid', value: stats ? String(stats.paid) : '—' },
          { label: 'Collected', value: stats ? money(stats.revenue) : '—' },
        ].map((card) => (
          <div key={card.label} className="rounded-card border border-line bg-surface p-5">
            <p className="text-[13px] text-muted">{card.label}</p>
            <p className="font-display mt-1.5 text-[30px] leading-none tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cx('h-9 rounded-full px-3.5 text-[13px] transition-colors', filter === f.key ? 'bg-fg text-bg' : 'bg-surface-2 text-muted hover:text-fg')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>
          <RefreshCw /> Refresh
        </Button>
      </div>

      {error && <p className="mt-4 rounded-control bg-accent-soft px-4 py-3 text-[14px] text-accent">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-[26px]">No orders here yet</p>
            <p className="mt-1 text-[14px] text-muted">New orders appear the moment a shopper checks out.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((order) => {
              const expanded = open === order.reference
              return (
                <li key={order.reference}>
                  <button type="button" onClick={() => setOpen(expanded ? null : order.reference)} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-surface-2/50 sm:px-5">
                    <ChevronDown className={cx('size-4 shrink-0 text-faint transition-transform', expanded && 'rotate-180')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[14.5px] font-medium">{order.reference}</span>
                        <span className="text-[13px] text-muted">{order.customer.name}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-faint">
                        {order.items.reduce((n, i) => n + i.quantity, 0)} item(s) · {order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Bank'} · {order.fulfilment === 'pickup' ? 'Pick-up' : `Delivery${order.distanceKm ? ` ${order.distanceKm} km` : ''}`} · {new Date(order.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                      </span>
                    </span>
                    <span className="hidden text-[14px] tabular-nums sm:block">{money(order.total)}</span>
                    <StatusPill status={order.status} />
                  </button>

                  {expanded && (
                    <div className="grid gap-6 border-t border-line bg-bg/40 px-4 py-5 sm:grid-cols-2 sm:px-5">
                      <div>
                        <p className="text-[13px] font-medium">Customer</p>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                          {order.customer.name}
                          <br />
                          {order.fulfilment === 'pickup' ? (
                            <span className="font-medium text-fg">Collects from the shop</span>
                          ) : (
                            <>
                              {order.customer.address}
                              <br />
                              {order.customer.city}
                              {order.distanceKm ? ` · ${order.distanceKm} km` : ''}
                            </>
                          )}
                          <br />
                          <a href={`tel:${order.customer.phone}`} className="text-fg hover:underline">{order.customer.phone}</a>
                          <br />
                          <a href={`mailto:${order.customer.email}`} className="text-fg hover:underline">{order.customer.email}</a>
                        </p>
                        {order.customer.notes && <p className="mt-2 text-[13px] text-faint">Landmark: {order.customer.notes}</p>}
                        {order.mpesaReceipt && <p className="mt-2 text-[13px] font-medium text-accent">M-Pesa receipt {order.mpesaReceipt}</p>}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">Items</p>
                        <ul className="mt-1.5 flex flex-col gap-1 text-[14px] text-muted">
                          {order.items.map((item) => (
                            <li key={`${item.slug}-${item.option ?? ''}`} className="flex justify-between gap-3">
                              <span>
                                {item.quantity} × {item.name}
                                {item.option ? ` (${item.option})` : ''}
                              </span>
                              <span className="tabular-nums">{money(item.unitPrice * item.quantity)}</span>
                            </li>
                          ))}
                          <li className="mt-1 flex justify-between gap-3 border-t border-line pt-1.5 text-[14px] font-medium text-fg">
                            <span>Total</span>
                            <span className="tabular-nums">{money(order.total)}</span>
                          </li>
                        </ul>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {nextActions[order.status].map((action) => (
                            <Button
                              key={action.status}
                              size="sm"
                              variant={action.status === 'cancelled' ? 'secondary' : 'primary'}
                              loading={busy === order.reference}
                              onClick={() => update(order.reference, action.status)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: OrderStatus }) {
  const tone =
    status === 'paid' || status === 'delivered' ? 'bg-fg text-bg' : status === 'shipped' ? 'bg-accent-soft text-accent' : status === 'cancelled' ? 'bg-surface-2 text-faint' : 'border border-line-strong text-fg'
  return <span className={cx('inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-[12px] font-medium', tone)}>{ORDER_STATUS_LABELS[status]}</span>
}
