import { Check, CreditCard, Loader2, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button, inputClass } from '../../components/ui'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'

interface SettingsResponse {
  settings: Record<string, string>
  stkAvailable: boolean
  email: { ready: boolean; to: string; keySet?: boolean }
}

const fields: { key: string; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'store_name', label: 'Shop name', placeholder: "Kaderee's Enterprises" },
  { key: 'store_email', label: 'Contact email', placeholder: 'hello@kaderee.co.ke' },
  { key: 'store_phone', label: 'Contact phone', placeholder: '+254 700 000 000' },
]

const mpesaFields: { key: string; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'mpesa_paybill', label: 'Paybill number', placeholder: '247247' },
  { key: 'mpesa_till', label: 'Till (Buy Goods) number', hint: 'Use this instead of a paybill if you have a till.', placeholder: '5123456' },
  { key: 'mpesa_account_number', label: 'Paybill account number', hint: 'What shoppers type as the account after the paybill number.', placeholder: '0723266957' },
  { key: 'mpesa_account_name', label: 'Name shown to the shopper', placeholder: "Kaderee's Enterprises" },
]

const emailFields: { key: string; label: string; hint?: string; placeholder?: string }[] = [
  {
    key: 'alert_email',
    label: 'Order alerts go to',
    hint: 'Every new order and every confirmed payment is emailed here. Leave blank to use your contact email.',
    placeholder: 'eric7ndereva@gmail.com',
  },
  {
    key: 'resend_from',
    label: 'Send emails from (optional)',
    hint: 'Leave blank to use Resend\u2019s test sender, which can only reach the address that owns the Resend account.',
    placeholder: "Kaderee's Enterprises <orders@yourdomain.co.ke>",
  },
]

const deliveryFields: { key: string; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'delivery_rate', label: 'Delivery charge (KSh per km)', hint: 'Shoppers pay this for every kilometre from the shop.', placeholder: '100' },
  { key: 'pickup_address', label: 'Pick-up address', hint: 'Where shoppers collect a pick-up order.', placeholder: 'Kimathi Street, Nairobi CBD' },
]

const bankFields: { key: string; label: string; hint?: string; placeholder?: string }[] = [
  { key: 'bank_name', label: 'Bank', placeholder: 'Equity Bank' },
  { key: 'bank_account_name', label: 'Account name', placeholder: "Kaderee's Enterprises Ltd" },
  { key: 'bank_account_number', label: 'Account number', placeholder: '0170000000000' },
  { key: 'bank_branch', label: 'Branch', placeholder: 'Westlands, Nairobi' },
]

export function AdminPayments({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [stkAvailable, setStkAvailable] = useState(false)
  const [mail, setMail] = useState<{ ready: boolean; to: string; keySet: boolean }>({ ready: false, to: '', keySet: false })
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    api<SettingsResponse>('/api/admin/settings')
      .then((body) => {
        setValues(body.settings)
        setStkAvailable(body.stkAvailable)
        setMail({ ready: body.email?.ready ?? false, to: body.email?.to ?? '', keySet: Boolean(body.email?.keySet) })
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Could not load settings.'
        if (message.toLowerCase().includes('unauthorized')) onUnauthorized()
        else setError(message)
      })
      .finally(() => setLoading(false))
  }, [onUnauthorized])

  async function save() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const body = await api<{ store: { payments: { stk: boolean } } }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(values) })
      const keySet = mail.keySet || Boolean((values.resend_api_key ?? '').trim())
      setMail({ ready: keySet, to: (values.alert_email ?? '').trim() || (values.store_email ?? '').trim(), keySet })
      // The key is never sent back, so forget the typed copy to avoid saving it twice.
      setValues((current) => ({ ...current, resend_api_key: '' }))
      setStkAvailable(body.store.payments.stk)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save those details.')
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTestState('sending')
    setTestError('')
    try {
      await api<{ to: string }>('/api/admin/test-email', { method: 'POST' })
      setTestState('sent')
      window.setTimeout(() => setTestState('idle'), 4000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send that email.'
      if (message.toLowerCase().includes('unauthorized')) onUnauthorized()
      else setTestError(message)
      setTestState('idle')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[14px] text-muted">
        <Loader2 className="size-4 animate-spin" /> Loading settings…
      </div>
    )
  }

  return (
    <div className="max-w-[720px]">
      <div className={cx('flex items-start gap-3 rounded-card border p-4', stkAvailable ? 'border-line bg-surface' : 'border-line bg-surface-2/60')}>
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-[12px]', stkAvailable ? 'bg-fg text-bg' : 'bg-surface text-muted')}>
          <CreditCard className="size-4.5" />
        </span>
        <div>
          <p className="text-[14.5px] font-medium">{stkAvailable ? 'Automatic M-Pesa is on' : 'Manual M-Pesa'}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
            {stkAvailable
              ? 'Shoppers get a payment prompt on their phone when they check out.'
              : 'Shoppers are shown the paybill or till below and pay from their phone. Confirm each payment here in Orders.'}
            {!stkAvailable && ' Automatic prompts need Safaricom Daraja keys, set as Worker secrets.'}
          </p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Group title="Shop details" fields={fields} values={values} onChange={setValues} />

        <section className="rounded-card border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-[12px]', mail.ready ? 'bg-fg text-bg' : 'bg-surface-2 text-muted')}>
              <Mail className="size-4.5" />
            </span>
            <div>
              <h2 className="text-[15px] font-medium">Order emails {mail.ready ? 'are on' : 'are off'}</h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                {mail.ready
                  ? `New orders and confirmed payments are emailed to ${mail.to || 'your contact email'}.`
                  : 'Paste the Resend API key below, save, then send a test.'}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {emailFields.map((field) => (
              <label key={field.key}>
                <span className="mb-1.5 block text-[13px] font-medium">{field.label}</span>
                <input
                  className={inputClass}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
                {field.hint && <span className="mt-1 block text-[12.5px] text-faint">{field.hint}</span>}
              </label>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-medium">Resend API key</span>
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              placeholder={mail.keySet ? 'Saved — type a new key to replace it' : 're_…'}
              value={values.resend_api_key ?? ''}
              onChange={(e) => setValues({ ...values, resend_api_key: e.target.value })}
            />
            <span className="mt-1 block text-[12.5px] text-faint">
              Create a free Resend account with the alert address above, make an API key, and paste it here. Save, then send a test.
            </span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" loading={testState === 'sending'} onClick={() => void sendTest()}>
              Send a test email
            </Button>
            {testState === 'sent' && (
              <span className="inline-flex items-center gap-1.5 text-[13.5px] text-muted">
                <Check className="size-4 text-accent" /> Test sent — check that inbox
              </span>
            )}
            {testError && <span className="text-[13.5px] text-accent">{testError}</span>}
          </div>
        </section>
        <Group title="Delivery and pick-up" fields={deliveryFields} values={values} onChange={setValues} />
        <Group title="M-Pesa" fields={mpesaFields} values={values} onChange={setValues} />
        <Group title="Bank transfer" fields={bankFields} values={values} onChange={setValues} />

        {error && <p className="text-[14px] text-accent">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            Save details
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-[13.5px] text-muted">
              <Check className="size-4 text-accent" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

function Group({
  title,
  fields,
  values,
  onChange,
}: {
  title: string
  fields: { key: string; label: string; hint?: string; placeholder?: string }[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <h2 className="text-[15px] font-medium">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className={field.key === 'bank_account_number' ? 'sm:col-span-2' : undefined}>
            <span className="mb-1.5 block text-[13px] font-medium">{field.label}</span>
            <input
              className={inputClass}
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            />
            {field.hint && <span className="mt-1 block text-[12.5px] text-faint">{field.hint}</span>}
          </label>
        ))}
      </div>
    </section>
  )
}
