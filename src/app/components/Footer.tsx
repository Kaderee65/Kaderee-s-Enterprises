import { ArrowRight, Mail, MessageCircle, Phone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { CATEGORIES, DELIVERY_RATE_PER_KM, money } from '../../data/types'
import { useStore, whatsappLink } from '../lib/store'
import { Logo } from './Nav'
import { Container, inputClass } from './ui'

const columns = [
  { title: 'Shop', links: [['All bags', '/shop'], ...CATEGORIES.map((c) => [c.label, `/shop?category=${c.key}`] as [string, string])] },
  { title: 'Help', links: [['Delivery', '/about'], ['Returns', '/about'], ['Care and repair', '/about'], ['Contact', '/contact']] },
  { title: 'Workshop', links: [['Our story', '/about'], ['Materials', '/about'], ['Stockists', '/about'], ['Admin', '/admin']] },
] as { title: string; links: [string, string][] }[]

export function Footer() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const store = useStore()
  const phone = store?.phone?.trim() ?? ''
  const mail = store?.email?.trim() ?? ''
  const greeting = `Hello ${store?.name ?? "Kaderee's Enterprises"}, I would like to ask about a bag.`

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    const response = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    setState(response.ok ? 'done' : 'error')
  }

  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="max-w-md">
            <h2 className="font-display text-[36px] leading-[1.05]">New bags, once a month</h2>
            <p className="mt-3 text-[15px] text-muted">Restocks, new leathers and the occasional sample sale.</p>
            {state === 'done' ? (
              <p className="mt-6 inline-flex h-12 items-center rounded-control bg-surface-2 px-5 text-[15px]">Thank you. Watch your inbox.</p>
            ) : (
              <form onSubmit={submit} className="mt-6 flex gap-2">
                <label className="sr-only" htmlFor="newsletter">
                  Email
                </label>
                <input id="newsletter" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
                <button type="submit" aria-label="Subscribe" disabled={state === 'sending'} className="grid size-12 shrink-0 place-items-center rounded-control bg-fg text-bg transition-colors hover:bg-[#33302b]">
                  <ArrowRight className="size-4" />
                </button>
              </form>
            )}
            {state === 'error' && <p className="mt-2 text-[13px] text-accent">Enter a valid email address.</p>}
          </div>
          <div className="grid grid-cols-3 gap-6">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="text-[13px] font-medium">{col.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map(([label, to]) => (
                    <li key={label}>
                      <Link to={to} className="text-[14px] text-muted transition-colors hover:text-fg">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        {(phone || mail) && (
          <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px]">
            <span className="text-[13px] text-faint">Talk to us</span>
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-2 text-muted transition-colors hover:text-fg">
                <Phone className="size-4" />
                {phone}
              </a>
            )}
            {phone && (
              <a href={whatsappLink(phone, greeting)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted transition-colors hover:text-fg">
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            )}
            {mail && (
              <a href={`mailto:${mail}`} className="inline-flex items-center gap-2 break-all text-muted transition-colors hover:text-fg">
                <Mail className="size-4" />
                {mail}
              </a>
            )}
            <Link to="/contact" className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-fg">
              Contact page
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
        <div className="mt-8 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-faint">
            © {new Date().getFullYear()} Kaderee&rsquo;s Enterprises · Nairobi · Delivery {money(DELIVERY_RATE_PER_KM)} per km · Free pick-up
          </p>
          <div className="flex items-center gap-5">
            <Link to="/admin" className="text-[13px] text-faint transition-colors hover:text-fg">
              Admin
            </Link>
            <Logo className="text-muted" />
          </div>
        </div>
      </Container>
    </footer>
  )
}
