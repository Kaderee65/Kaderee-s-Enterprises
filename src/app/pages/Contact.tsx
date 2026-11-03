import { ArrowRight, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'

import { useStore, whatsappLink } from '../lib/store'
import { Container, Reveal } from '../components/ui'

function Channel({ href, icon: Icon, label, value, note, external }: { href: string; icon: typeof Phone; label: string; value: string; note: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="group flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-surface-2/60"
    >
      <span className="grid size-11 place-items-center rounded-[14px] bg-surface-2 text-fg">
        <Icon className="size-5" />
      </span>
      <span className="mt-1 text-[13px] text-muted">{label}</span>
      <span className="font-display break-words text-[22px] leading-tight">{value}</span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-[13px] text-muted">
        {note}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  )
}

export function Contact() {
  const store = useStore()
  const phone = store?.phone?.trim() ?? ''
  const email = store?.email?.trim() ?? ''
  const address = store?.pickupAddress?.trim() ?? ''
  const greeting = `Hello ${store?.name ?? "Kaderee's Enterprises"}, I would like to ask about a bag.`

  return (
    <Container className="pt-10 sm:pt-16">
      <div className="max-w-3xl">
        <p className="text-[14px] text-muted">Contact</p>
        <h1 className="font-display mt-3 text-balance text-[48px] leading-[1] sm:text-[68px]">
          Talk to us about a <em className="italic text-accent">bag</em>
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-muted">
          Ask about a design, check delivery to your town, or order several bags for a wedding, a team or a shop. Call, message WhatsApp or send an email — we answer ourselves.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {phone && (
          <Reveal>
            <Channel icon={MessageCircle} label="WhatsApp" value={phone} note="Chat with us now" href={whatsappLink(phone, greeting)} external />
          </Reveal>
        )}
        {phone && (
          <Reveal delay={0.08}>
            <Channel icon={Phone} label="Call" value={phone} note="Talk to the owner" href={`tel:${phone.replace(/[^\d+]/g, '')}`} />
          </Reveal>
        )}
        {email && (
          <Reveal delay={0.16}>
            <Channel icon={Mail} label="Email" value={email} note="Write to us" href={`mailto:${email}?subject=${encodeURIComponent('Enquiry about a bag')}`} />
          </Reveal>
        )}
      </div>

      {!phone && !email && (
        <p className="mt-8 rounded-[18px] border border-line bg-surface p-5 text-[15px] text-muted">
          Our contact details are being updated. Please check back shortly.
        </p>
      )}

      {address && (
        <Reveal className="mt-14">
          <div className="grid gap-8 rounded-[32px] bg-surface-2/60 p-6 sm:p-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-[14px] text-muted">Come and see the bags</p>
              <h2 className="font-display mt-3 text-[32px] leading-[1.05] sm:text-[38px]">Visit the shop in Nairobi</h2>
              <p className="mt-4 flex items-start gap-3 text-[16px] leading-relaxed text-muted">
                <MapPin className="mt-0.5 size-5 shrink-0" />
                <span>{address}</span>
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 text-[16px] leading-relaxed text-muted">
              <p>
                Pick-up orders are collected here, free of charge. If you are coming for a particular bag, send a message first and we will have it ready for you.
              </p>
              {phone && (
                <p>
                  <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                    Call ahead on {phone}
                  </a>
                </p>
              )}
            </div>
          </div>
        </Reveal>
      )}
    </Container>
  )
}
