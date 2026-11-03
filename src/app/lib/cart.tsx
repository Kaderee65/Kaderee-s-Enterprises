import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Product } from '../../data/types'

export interface CartLine {
  slug: string
  name: string
  price: number
  image: string
  option?: string
  quantity: number
}

interface CartState {
  lines: CartLine[]
  open: boolean
  add: (product: Product, option?: string, quantity?: number) => void
  setQuantity: (slug: string, option: string | undefined, quantity: number) => void
  remove: (slug: string, option?: string) => void
  clear: () => void
  setOpen: (open: boolean) => void
  count: number
  subtotal: number
  ready: boolean
}

const CartContext = createContext<CartState | null>(null)
const KEY = 'kaderee-cart-v1'

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setLines((JSON.parse(raw) as CartLine[]).filter((l) => l?.slug && l?.price >= 0))
    } catch {
      /* ignore a corrupt bag */
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    localStorage.setItem(KEY, JSON.stringify(lines))
  }, [lines, ready])

  const same = (a: CartLine, slug: string, option?: string) => a.slug === slug && (a.option ?? '') === (option ?? '')

  const add = useCallback((product: Product, option?: string, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => same(l, product.slug, option))
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
      return [...prev, { slug: product.slug, name: product.name, price: product.price, image: product.image, option, quantity }]
    })
    setOpen(true)
  }, [])

  const setQuantity = useCallback((slug: string, option: string | undefined, quantity: number) => {
    setLines((prev) => (quantity <= 0 ? prev.filter((l) => !same(l, slug, option)) : prev.map((l) => (same(l, slug, option) ? { ...l, quantity } : l))))
  }, [])

  const remove = useCallback((slug: string, option?: string) => setLines((prev) => prev.filter((l) => !same(l, slug, option))), [])
  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<CartState>(
    () => ({
      lines,
      open,
      add,
      setQuantity,
      remove,
      clear,
      setOpen,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.quantity * l.price, 0),
    }),
    [lines, open, add, setQuantity, remove, clear, ready],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart outside CartProvider')
  return ctx
}
