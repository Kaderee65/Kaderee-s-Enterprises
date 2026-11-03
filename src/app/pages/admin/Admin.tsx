import { CreditCard, Loader2, LogOut, LockKeyhole, Package, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Button, Container, inputClass } from '../../components/ui'
import { api } from '../../lib/api'
import { cx } from '../../lib/cx'
import { AdminOrders } from './AdminOrders'
import { AdminPayments } from './AdminPayments'
import { AdminProducts } from './AdminProducts'

interface Session {
  setupRequired: boolean
  signedIn: boolean
}

export function Admin() {
  const [session, setSession] = useState<Session | null>(null)
  const [tab, setTab] = useState<'orders' | 'products' | 'payments'>('orders')
  const [error, setError] = useState('')

  async function loadSession() {
    try {
      setSession(await api<Session>('/api/admin/session'))
    } catch {
      setError('Could not reach the store. Refresh and try again.')
    }
  }

  useEffect(() => {
    void loadSession()
  }, [])

  if (!session) {
    return (
      <Container className="pt-24">
        <div className="flex items-center justify-center gap-2 text-[15px] text-muted">
          {error ? error : <><Loader2 className="size-4 animate-spin" /> Loading the shop…</>}
        </div>
      </Container>
    )
  }

  if (!session.signedIn) {
    return <AdminLogin setupRequired={session.setupRequired} onDone={loadSession} />
  }

  async function signOut() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => null)
    await loadSession()
  }

  return (
    <Container className="pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-muted">Admin</p>
          <h1 className="font-display mt-2 text-[42px] leading-none sm:text-[52px]">Shop manager</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="inline-flex h-10 items-center rounded-[12px] px-3 text-[14px] text-muted hover:bg-surface-2 hover:text-fg">
            View store
          </Link>
          <Button variant="secondary" size="sm" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </div>

      <div className="mt-8 flex gap-1 border-b border-line">
        {[
          { key: 'orders' as const, label: 'Orders', icon: ShoppingCart },
          { key: 'products' as const, label: 'Products', icon: Package },
          { key: 'payments' as const, label: 'Payments', icon: CreditCard },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cx(
              '-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-4 text-[14px] transition-colors',
              tab === key ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      <div className="pt-8">
        {tab === 'orders' && <AdminOrders onUnauthorized={loadSession} />}
        {tab === 'products' && <AdminProducts onUnauthorized={loadSession} />}
        {tab === 'payments' && <AdminPayments onUnauthorized={loadSession} />}
      </div>
    </Container>
  )
}

function AdminLogin({ setupRequired, onDone }: { setupRequired: boolean; onDone: () => Promise<void> | void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (setupRequired && password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await api(setupRequired ? '/api/admin/setup' : '/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) })
      await onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-[420px]">
        <span className="round grid size-12 place-items-center rounded-full bg-fg text-bg">
          <LockKeyhole className="size-5" />
        </span>
        <h1 className="font-display mt-6 text-[40px] leading-none">{setupRequired ? 'Set up your admin' : 'Admin sign in'}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {setupRequired
            ? 'Choose a password for the shop owner account. You will use it to see orders and add new bags — keep it somewhere safe, it cannot be recovered.'
            : 'Enter the admin password to see orders and manage the catalogue.'}
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <label>
            <span className="mb-1.5 block text-[13px] font-medium">{setupRequired ? 'New password' : 'Password'}</span>
            <input type="password" required autoComplete={setupRequired ? 'new-password' : 'current-password'} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {setupRequired && (
            <label>
              <span className="mb-1.5 block text-[13px] font-medium">Repeat password</span>
              <input type="password" required autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
          )}
          {error && <p className="text-[14px] text-accent">{error}</p>}
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {setupRequired ? 'Create admin password' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-[13px] text-faint">
          {setupRequired ? 'Use at least 8 characters. This account is created the first time you sign in.' : 'Forgot it? The password is stored as a hash — it can be reset from the server, not here.'}
        </p>
      </div>
    </Container>
  )
}
