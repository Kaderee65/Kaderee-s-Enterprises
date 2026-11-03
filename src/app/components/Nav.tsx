import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Menu, ShoppingBag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { CATEGORIES, DELIVERY_RATE_PER_KM, money } from '../../data/types'
import { useCart } from '../lib/cart'
import { cx } from '../lib/cx'

const kitenge = CATEGORIES.filter((c) => c.key.startsWith('kitenge'))
const allLinks = [{ to: '/shop', label: 'All bags' }, ...CATEGORIES.map((c) => ({ to: `/shop?category=${c.key}`, label: c.label })), { to: '/about', label: 'Our story' }, { to: '/contact', label: 'Contact' }]

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 9h15l-1.2 10.2a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8Z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('inline-flex items-center gap-2', className)}>
      <BagIcon />
      <span className="font-display whitespace-nowrap text-[20px] leading-none sm:text-[23px]">Kaderee&rsquo;s Enterprises</span>
    </Link>
  )
}

export function Nav() {
  const cart = useCart()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
    setMenu(false)
  }, [location])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const inKitenge = location.search.includes('kitenge')

  return (
    <>
      <div className="flex h-9 items-center justify-center bg-fg px-4 text-center text-[12.5px] text-bg">
        Delivery {money(DELIVERY_RATE_PER_KM)} per km · Free pick-up in store · Pay with M-Pesa or bank
      </div>
      <header className={cx('sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300', scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-xl' : 'bg-bg')}>
        <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-8">
          <nav className="hidden items-center gap-1 lg:flex">
            <NavLink to="/shop" end className={({ isActive }) => cx('inline-flex h-9 items-center rounded-[11px] px-2.5 text-[14px] transition-colors hover:bg-surface-2', isActive ? 'text-fg' : 'text-muted hover:text-fg')}>
              All bags
            </NavLink>
            <NavLink
              to="/shop?category=tot-bags"
              className={cx('inline-flex h-9 items-center rounded-[11px] px-2.5 text-[14px] transition-colors hover:bg-surface-2', location.search === '?category=tot-bags' ? 'text-fg' : 'text-muted hover:text-fg')}
            >
              Tot Bags
            </NavLink>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                className={cx('inline-flex h-9 items-center gap-1 rounded-[11px] px-2.5 text-[14px] transition-colors hover:bg-surface-2', inKitenge || menu ? 'text-fg' : 'text-muted hover:text-fg')}
              >
                Kitenge
                <ChevronDown className={cx('size-3.5 transition-transform', menu && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="absolute left-0 top-11 w-[260px] rounded-[16px] border border-line bg-surface p-1.5 shadow-soft"
                  >
                    {kitenge.map((c) => (
                      <Link
                        key={c.key}
                        to={`/shop?category=${c.key}`}
                        className={cx(
                          'flex items-center justify-between rounded-[11px] px-3 py-2 text-[14px] transition-colors hover:bg-surface-2',
                          location.search === `?category=${c.key}` ? 'text-fg' : 'text-muted',
                        )}
                      >
                        {c.label}
                        <span className="text-[12px] text-faint">{c.blurb}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <NavLink to="/about" className={({ isActive }) => cx('inline-flex h-9 items-center rounded-[11px] px-2.5 text-[14px] transition-colors hover:bg-surface-2', isActive ? 'text-fg' : 'text-muted hover:text-fg')}>
              Our story
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => cx('inline-flex h-9 items-center rounded-[11px] px-2.5 text-[14px] transition-colors hover:bg-surface-2', isActive ? 'text-fg' : 'text-muted hover:text-fg')}>
              Contact
            </NavLink>
          </nav>
          <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-control lg:hidden">
            <Menu className="size-5" />
          </button>

          <Logo />

          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              aria-label={`Bag, ${cart.count} items`}
              onClick={() => cart.setOpen(true)}
              className="relative inline-flex h-10 items-center gap-2 rounded-control px-2.5 text-[14px] transition-colors hover:bg-surface-2 sm:px-3"
            >
              <ShoppingBag className="size-5" />
              <span className="hidden sm:inline">Bag</span>
              <AnimatePresence>
                {cart.count > 0 && (
                  <motion.span
                    key={cart.count}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    className="round grid min-w-5 place-items-center rounded-full bg-fg px-1.5 text-[11px] font-semibold tabular-nums text-bg"
                  >
                    {cart.count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-fg/30 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.nav
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-2 left-2 flex w-[calc(100%-16px)] max-w-[320px] flex-col overflow-y-auto rounded-dialog bg-bg p-5 shadow-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <Logo />
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-control hover:bg-surface-2">
                  <X className="size-5" />
                </button>
              </div>
              <ul className="mt-8 flex flex-col gap-1">
                {allLinks.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="flex min-h-12 items-center rounded-control px-3 font-display text-[24px] leading-tight hover:bg-surface-2">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
