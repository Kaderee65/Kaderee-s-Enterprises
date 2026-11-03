import { motion } from 'motion/react'
import { ArrowRight, Landmark, Smartphone, Truck } from 'lucide-react'
import { Link } from 'react-router'

import { CATEGORIES, DELIVERY_RATE_PER_KM, money } from '../../data/types'
import { ProductCard } from '../components/ProductCard'
import { ButtonLink, Container, Reveal, SectionTitle } from '../components/ui'
import { useCatalog } from '../lib/catalog'

const ease = [0.22, 1, 0.36, 1] as const

export function Home() {
  const { products, loading } = useCatalog()
  const newArrivals = [...products].sort((a, b) => b.id - a.id).slice(0, 4)
  const bestsellers = products.filter((p) => p.featured).slice(0, 6)
  const hero = products.find((p) => p.featured) ?? products[0]

  return (
    <>
      <section className="pt-10 sm:pt-16">
        <Container>
          <div className="grid items-end gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div className="pb-4">
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="text-[14px] text-muted">
                Kitenge bags, made in Uhuru Market Along Jogoo Road In Nairobi
              </motion.p>
              <h1 className="font-display mt-4 text-[52px] leading-[0.98] sm:text-[76px] lg:text-[90px]">
                {['Bags that carry', 'the whole day'].map((line, i) => (
                  <span key={line} className="block overflow-hidden pb-[0.18em] -mb-[0.18em]">
                    <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease }}>
                      {i === 1 ? (
                        <>
                          the whole <em className="italic text-accent">day</em>
                        </>
                      ) : (
                        line
                      )}
                    </motion.span>
                  </span>
                ))}
              </h1>
              <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45, ease }} className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
                Map totes, kichwa bags and small crossbodies in bright kitenge, cut and stitched by hand in small batches. Pay with M-Pesa or bank transfer, delivered anywhere in Kenya.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55, ease }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink to="/shop" size="lg" className="w-full sm:w-auto">
                  Shop the collection
                  <ArrowRight />
                </ButtonLink>
                <ButtonLink to="/about" size="lg" variant="secondary" className="w-full sm:w-auto">
                  Our story
                </ButtonLink>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.2, ease }}
              className="image-frame relative aspect-[4/3] rounded-[32px] lg:aspect-[5/4]"
            >
              <img src="/images/hero.svg" alt="A leather tote resting on a stone plinth in morning light" className="size-full object-cover" fetchPriority="high" />
              {hero && (
                <Link
                  to={`/product/${hero.slug}`}
                  className="absolute bottom-4 left-4 flex items-center gap-3 rounded-[16px] bg-surface/90 py-2 pl-2 pr-4 text-[13px] shadow-soft backdrop-blur transition-colors hover:bg-surface"
                >
                  <span className="image-frame size-10 rounded-[12px]">
                    <img src={hero.image} alt="" className="size-full object-cover" />
                  </span>
                  <span>
                    <span className="block font-medium">{hero.name}</span>
                    <span className="text-muted">{money(hero.price)}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </Link>
              )}
            </motion.div>
          </div>
        </Container>
      </section>

      <section className="pt-20 sm:pt-28">
        <Container>
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="font-display text-balance text-[34px] leading-[1.06] sm:text-[44px]">
              Welcome to Kaderee&rsquo;s Enterprises &ndash;
              <br className="hidden sm:block" /> <em className="italic text-accent">Carry a Touch of Africa!</em>
            </h2>
            <div className="mt-6 space-y-5 text-pretty text-[16.5px] leading-relaxed text-muted sm:text-[17px]">
              <p>
                Discover the beauty of African creativity through our unique collection of beautifully designed African-inspired bags. We bring together vibrant African prints, colourful patterns, and elegant designs to create bags that celebrate culture, style, and individuality.
              </p>
              <p>
                Whether you&rsquo;re heading out for shopping, school, work, travelling, or a casual day out, our bags are designed to add a special touch to your everyday look. Why blend in when you can stand out?
              </p>
              <p>
                Every bag tells a story, reflects creativity, and celebrates the beauty of Africa. Enjoy stylish, unique, and eye-catching designs that allow you to express your personality wherever you go. Explore our collection today and find a bag that speaks your style!
              </p>
            </div>
            <p className="font-display mt-8 text-[22px] leading-snug text-fg sm:text-[26px]">
              Wear the culture. Carry the beauty. <em className="italic text-accent">Celebrate Africa.</em>
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <Reveal>
            <SectionTitle
              eyebrow="Just in"
              title="New arrivals"
              action={
                <Link to="/shop" className="hidden items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-fg sm:inline-flex">
                  View all
                  <ArrowRight className="size-4" />
                </Link>
              }
            />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {loading && products.length === 0
              ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="image-frame aspect-[3/4] animate-pulse rounded-image" />)
              : newArrivals.map((p, i) => <ProductCard key={p.slug} product={p} index={i} priority={i < 2} />)}
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:gap-6">
            {CATEGORIES.map((c, i) => (
              <Reveal key={c.key} delay={i * 0.08}>
                <Link to={`/shop?category=${c.key}`} className="group image-frame relative block aspect-[4/5] rounded-image">
                  <img src={c.image} alt={c.label} className="size-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" loading="lazy" />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between rounded-[18px] bg-surface/90 p-4 backdrop-blur">
                    <div>
                      <p className="font-display text-[22px] leading-none">{c.label}</p>
                      <p className="mt-1.5 text-[13px] text-muted">{c.blurb}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-[12px] bg-fg text-bg transition-transform group-hover:translate-x-0.5">
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <div className="grid items-center gap-10 rounded-[32px] bg-surface-2/60 p-5 sm:p-8 lg:grid-cols-2 lg:gap-16 lg:p-12">
            <Reveal className="image-frame aspect-[4/3] rounded-image">
              <img src="/images/lookbook.svg" alt="Three handbags arranged on a studio shelf" className="size-full object-cover" loading="lazy" />
            </Reveal>
            <Reveal delay={0.1} className="lg:pr-8">
              <p className="text-[14px] text-muted">The workshop</p>
              <h2 className="font-display mt-3 text-balance text-[40px] leading-[1.02] sm:text-[52px]">Cut and stitched by people we know by name</h2>
              <p className="mt-5 text-pretty text-[16px] leading-relaxed text-muted">
                Every bag starts as a length of kitenge on a cutting table in our Nairobi workshop. We make small runs, we finish the seams by hand, and we only list a bag we would carry ourselves.
              </p>
              <ButtonLink to="/about" variant="secondary" className="mt-8">
                Read our story
              </ButtonLink>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <Reveal>
            <SectionTitle eyebrow="Loved for a reason" title="Bestsellers" />
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3 lg:gap-x-6">
            {bestsellers.map((p, i) => (
              <ProductCard key={p.slug} product={p} index={i} />
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            <ButtonLink to="/shop" variant="secondary" size="lg">
              Shop everything
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="pt-24 sm:pt-32">
        <Container>
          <ul className="grid gap-4 border-y border-line py-10 sm:grid-cols-3">
            {[
              { icon: Smartphone, title: 'Pay with M-Pesa', body: 'An STK prompt straight to your phone, or a paybill number.' },
              { icon: Landmark, title: 'Or bank transfer', body: 'Send the total to our account and we dispatch the same day.' },
              { icon: Truck, title: `Delivery ${money(DELIVERY_RATE_PER_KM)} per km`, body: 'Nairobi same day, countrywide in 2–4 days. Or pick up free at our shop.' },
            ].map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <li className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-fg">
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-medium">{title}</p>
                    <p className="mt-0.5 text-[14px] text-muted">{body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>
    </>
  )
}
