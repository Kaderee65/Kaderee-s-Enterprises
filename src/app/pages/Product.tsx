import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import { CATEGORY_LABELS, DELIVERY_RATE_PER_KM, money } from '../../data/types'
import { ProductCard } from '../components/ProductCard'
import { Button, Container, Stepper } from '../components/ui'
import { useCart } from '../lib/cart'
import { useCatalog } from '../lib/catalog'
import { cx } from '../lib/cx'

export function Product() {
  const { slug } = useParams()
  const { bySlug, products, loading } = useCatalog()
  const product = slug ? bySlug(slug) : undefined
  const cart = useCart()
  const [option, setOption] = useState<string | undefined>()
  const [quantity, setQuantity] = useState(1)
  const [view, setView] = useState(0)
  const [added, setAdded] = useState(false)
  const [open, setOpen] = useState<number | null>(0)

  useEffect(() => {
    setOption(products.find((p) => p.slug === slug)?.options?.values[0])
    setQuantity(1)
    setView(0)
    window.scrollTo({ top: 0 })
  }, [slug, products])

  if (!product) {
    if (loading) {
      return (
        <Container className="pt-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="image-frame aspect-[3/4] animate-pulse rounded-image" />
            <div className="h-64 animate-pulse rounded-card bg-surface-2" />
          </div>
        </Container>
      )
    }
    return <Navigate to="/shop" replace />
  }

  const soldOut = product.stock <= 0
  const views = [
    { label: 'Front', style: {} },
    { label: 'Detail', style: { transform: 'scale(1.8)', transformOrigin: '50% 35%' } },
    { label: 'Texture', style: { transform: 'scale(2.4)', transformOrigin: '50% 70%' } },
  ]
  const related = products.filter((p) => p.slug !== product.slug && (p.category === product.category || p.featured)).slice(0, 4)
  const sections = [
    { title: 'Details', body: product.details },
    { title: 'Materials and care', body: [product.materials] },
    { title: 'Delivery and returns', body: ['Nairobi same day, countrywide in 2–4 days.', `Delivery ${money(DELIVERY_RATE_PER_KM)} per km, or free pick-up at our shop.`, 'Returns accepted within 7 days, unworn.'] },
  ]

  function add() {
    cart.add(product!, option, quantity)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <Container className="pt-6 sm:pt-10">
      <Link to="/shop" className="inline-flex h-9 items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg">
        <ArrowLeft className="size-4" />
        Shop
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="grid grid-cols-[64px_1fr] gap-3 sm:gap-4">
          <div className="flex flex-col gap-3">
            {views.map((v, i) => (
              <button
                key={v.label}
                type="button"
                aria-label={v.label}
                onClick={() => setView(i)}
                className={cx('image-frame aspect-[3/4] rounded-[14px] border-2 transition-colors', view === i ? 'border-fg' : 'border-transparent')}
              >
                <img src={product.image} alt="" className="size-full object-cover" style={v.style} />
              </button>
            ))}
          </div>
          <div className="image-frame relative aspect-[3/4] rounded-image">
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={view}
                src={product.image}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 size-full object-cover"
                style={views[view].style}
              />
            </AnimatePresence>
            {product.badge && <span className="absolute left-4 top-4 rounded-[10px] bg-surface/90 px-2.5 py-1 text-[12px] font-medium backdrop-blur">{product.badge}</span>}
          </div>
        </div>

        <div className="lg:pt-4">
          <p className="text-[14px] text-muted">{CATEGORY_LABELS[product.category]}</p>
          <h1 className="font-display mt-2 text-[44px] leading-[1] sm:text-[56px]">{product.name}</h1>
          <p className="mt-4 flex items-baseline gap-3 text-[22px] tabular-nums">
            {money(product.price)}
            {product.compareAt && <span className="text-[16px] text-faint line-through">{money(product.compareAt)}</span>}
          </p>
          <p className="mt-6 text-pretty text-[16px] leading-relaxed text-muted">{product.description}</p>

          {product.options && (
            <div className="mt-8">
              <p className="text-[14px] font-medium">
                {product.options.name} <span className="ml-1 font-normal text-muted">{option}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.options.values.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setOption(v)}
                    aria-pressed={option === v}
                    className={cx('h-10 rounded-[12px] border px-4 text-[14px] transition-colors', option === v ? 'border-fg bg-fg text-bg' : 'border-line-strong text-fg hover:border-fg')}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-[144px_1fr] gap-3">
            <Stepper value={quantity} onChange={(v) => setQuantity(Math.min(v, Math.max(1, product.stock)))} />
            <Button size="md" onClick={add} disabled={soldOut} className={cx('h-12 w-full', added && 'bg-accent hover:bg-accent')}>
              {soldOut ? 'Sold out' : added ? (
                <>
                  <Check />
                  Added to bag
                </>
              ) : (
                `Add to bag for ${money(product.price * quantity)}`
              )}
            </Button>
          </div>
          <p className="mt-3 text-[13px] text-faint">
            {soldOut ? 'This one has sold out. Message us and we will make another.' : `${product.stock} in stock. Delivery ${money(DELIVERY_RATE_PER_KM)} per km, or pick up free.`}
          </p>

          <ul className="mt-10 divide-y divide-line border-y border-line">
            {sections.map((s, i) => {
              const isOpen = open === i
              return (
                <li key={s.title}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)} className="flex h-14 w-full items-center justify-between text-left text-[15px] font-medium">
                    {s.title}
                    {isOpen ? <Minus className="size-4 text-muted" /> : <Plus className="size-4 text-muted" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <ul className="flex flex-col gap-1.5 pb-5 text-[14.5px] leading-relaxed text-muted">
                          {s.body.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-24 sm:pt-32">
          <h2 className="font-display text-[36px] sm:text-[44px]">You may also like</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {related.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
        </section>
      )}
    </Container>
  )
}
