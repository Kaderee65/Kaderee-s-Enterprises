import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy, Landmark, Smartphone, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { money, type PaymentInstructions } from '../../data/types'
import { Button } from './ui'
import { cx } from '../lib/cx'

function CopyValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      className={cx('inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-medium hover:border-fg', className)}
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5 text-faint" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[14px] leading-relaxed">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-fg text-[11px] font-semibold text-bg tabular-nums">{n}</span>
      <span className="text-muted">{children}</span>
    </li>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-right text-[14px] font-medium tabular-nums">{value}</span>
    </div>
  )
}

interface Props {
  open: boolean
  reference: string
  total: number
  phone: string
  payment: PaymentInstructions | null
  onClose: () => void
}

/**
 * Shown the instant an order is placed, so the shopper leaves knowing exactly
 * where to send the money. The same details live on the order page after this.
 */
export function PaymentPrompt({ open, reference, total, phone, payment, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  const isBank = payment?.method === 'bank'
  const number = payment?.payToNumber
  const account = payment?.payToAccount
  const label = payment?.payToLabel ?? (isBank ? 'Account number' : 'Paybill')

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-prompt-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="w-full max-w-[520px] rounded-t-[24px] bg-bg p-6 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)] sm:rounded-card sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="round mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-fg text-bg">
                  <Check className="size-5" />
                </span>
                <div>
                  <h2 id="pay-prompt-title" className="font-display text-[26px] leading-tight">
                    Order placed
                  </h2>
                  <p className="mt-1 text-[13.5px] text-muted">
                    {reference} · {money(total)}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-fg hover:text-fg">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-5 rounded-card border border-line bg-surface p-5">
              <p className="flex items-center gap-2 text-[15px] font-medium">
                {isBank ? <Landmark className="size-4" /> : <Smartphone className="size-4" />}
                {isBank ? 'Pay by bank transfer' : 'Pay by M-Pesa to finish your order'}
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                {payment?.mode === 'stk'
                  ? `We will send an M-Pesa request for ${money(total)} to ${phone} — or use the paybill below.`
                  : 'Your bag is held for 24 hours. Send the payment using the details below and we will pack it straight away.'}
              </p>

              {number ? (
                <div className="mt-4 rounded-[16px] border border-line bg-bg px-4 py-3.5">
                  <p className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[26px] leading-none font-semibold tabular-nums">{number}</span>
                    <CopyValue value={number} />
                  </div>
                  {payment?.payToName && <p className="mt-1.5 text-[13px] text-muted">{payment.payToName}</p>}
                </div>
              ) : (
                <p className="mt-4 rounded-control bg-surface-2 px-3 py-2.5 text-[13.5px] text-muted">
                  Our {isBank ? 'bank account' : 'paybill'} details will arrive by email with your confirmation — reply with the code once you have paid.
                </p>
              )}

              <div className="mt-3">
                {isBank ? (
                  <>
                    {payment?.bankName && <Row label="Bank" value={payment.bankName} />}
                    {payment?.bankAccountName && <Row label="Account name" value={payment.bankAccountName} />}
                    <Row label="Reference" value={reference} />
                    <Row label="Amount" value={money(total)} />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5">
                      <span className="text-[13px] text-muted">{account ? 'Account number' : 'Account / reference'}</span>
                      <span className="flex items-center gap-2.5">
                        <span className="text-[14px] font-medium tabular-nums">{account ?? reference}</span>
                        <CopyValue value={account ?? reference} />
                      </span>
                    </div>
                    <Row label="Amount" value={money(total)} />
                    {account && (
                      <div className="flex items-center justify-between gap-3 py-2.5">
                        <span className="text-[13px] text-muted">Your order number</span>
                        <span className="flex items-center gap-2.5">
                          <span className="text-[14px] font-medium tabular-nums">{reference}</span>
                          <CopyValue value={reference} />
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!isBank && (
                <ol className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
                  <Step n={1}>Open M-Pesa on your phone, choose Lipa na M-Pesa.</Step>
                  <Step n={2}>
                    Choose {payment?.payToLabel === 'Till (Buy Goods)' ? 'Buy Goods and Services' : 'Pay Bill'} and enter {number ?? 'the number above'}.
                  </Step>
                  <Step n={3}>Enter account number {account ?? reference}, then the amount {money(total)}.</Step>
                  <Step n={4}>
                    Enter your M-Pesa PIN and send.{' '}
                    {account ? `Keep order number ${reference} — send it to us if you want to be matched faster.` : 'You will get an SMS receipt.'}
                  </Step>
                </ol>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <Button onClick={onClose} size="lg" className="w-full sm:flex-1">
                I have paid · view my order
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="text-[13.5px] text-muted underline underline-offset-4 hover:text-fg sm:px-4"
              >
                I will pay later
              </button>
            </div>
            <p className="mt-3 text-center text-[12.5px] text-faint">
              Keep this order number. Every payment is confirmed by hand before we dispatch.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
