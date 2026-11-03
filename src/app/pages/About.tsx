import { ButtonLink, Container, Reveal } from '../components/ui'

export function About() {
  return (
    <Container className="pt-10 sm:pt-16">
      <div className="max-w-3xl">
        <p className="text-[14px] text-muted">Our story</p>
        <h1 className="font-display mt-3 text-balance text-[48px] leading-[1] sm:text-[72px]">A small workshop in Nairobi, making bags meant to be kept</h1>
      </div>
      <Reveal className="image-frame mt-12 aspect-[16/9] rounded-[32px]">
        <img src="/images/lookbook.svg" alt="Handbags on a shelf in the workshop" className="size-full object-cover" />
      </Reveal>
      <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <p className="font-display text-[32px] leading-[1.1]">We started with one bench, a roll of kitenge and a very patient tailor.</p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-5 text-[17px] leading-relaxed text-muted">
          <p>
            Kaderee&rsquo;s Enterprises began in 2021 in a small workshop off Ngong Road, sewing map totes from kitenge we bought at the market because we could not find a bag that held a laptop and still looked like something you would take to a wedding.
          </p>
          <p>
            Today we work with two tailors and a leatherworker who cuts every handle and base. Kitenge comes from traders we have bought from for years, canvas for the linings from a mill in Thika, and every seam is finished by hand. We sew in small runs, so a bag that sells out comes back only when the cloth does.
          </p>
          <p>
            We deliver countrywide by courier, and within Nairobi the same day. Pay with M-Pesa or a bank transfer — whichever is easier for you.
          </p>
          <ButtonLink to="/shop" className="mt-2 self-start">
            Shop the collection
          </ButtonLink>
        </Reveal>
      </div>
      <dl className="mt-20 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {[
          ['Bags made last year', '640'],
          ['Turnaround for a repair', '5 days'],
          ['Returns, 2025', '1.2%'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[14px] text-muted">{label}</dt>
            <dd className="font-display mt-2 text-[48px] leading-none">{value}</dd>
          </div>
        ))}
      </dl>
    </Container>
  )
}
