import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, ArrowUpRight, ArrowsClockwise, Camera, Drop, Path, ShieldCheck, Siren, ThumbsUp } from '@phosphor-icons/react'
import { DEPTHS, VEHICLES } from '../lib/severity'

gsap.registerPlugin(ScrollTrigger, useGSAP)

interface Props {
  onOpenRider: () => void
}

// Real streets from the app's routing data
const STREETS = ['Russian Blvd', 'Mao Tse Toung Blvd', 'Kampuchea Krom Blvd', 'Nehru Blvd', 'Sihanouk Blvd', 'Monivong Blvd', 'Norodom Blvd', 'Charles de Gaulle Blvd', 'Sisowath Quay', 'Street 63', 'Street 289', 'Street 598']

const STATEMENT = 'Water rises faster than information moves. PhnomFlood closes that gap with street-level reports from the people already riding through it.'

const SLICES = [
  { src: '/scenarios/ankle-deep-puddle.jpg', alt: 'Two people riding a bicycle through street water that reaches the wheel hubs', cm: DEPTHS.ankle.cm, name: DEPTHS.ankle.short, note: 'Motorbikes slow down and take care.' },
  { src: '/scenarios/knee-deep-flood.jpg', alt: 'A group wading through knee-deep brown floodwater in front of a row of shophouses', cm: DEPTHS.knee.cm, name: DEPTHS.knee.short, note: 'Motorbikes and tuk-tuks reroute.' },
  { src: '/scenarios/waist-deep-flood.jpg', alt: 'A rider pushing a stalled motorbike through floodwater up to the seat', cm: DEPTHS.waist.cm, name: DEPTHS.waist.short, note: 'Nothing passes. Cars reroute too.' },
]

const STAGES = [
  {
    title: 'Before you ride',
    points: [
      { Icon: Path, text: 'Three routes ranked by time and by how much water each one crosses.' },
      { Icon: ShieldCheck, text: 'A dry-only switch that hides any route with a blocking flood.' },
      { Icon: Drop, text: 'Limits set per vehicle: motorbike, tuk-tuk or car.' },
    ],
  },
  {
    title: 'While you ride',
    points: [
      { Icon: Drop, text: 'Flood segments drawn on the road itself, with the depth in centimetres.' },
      { Icon: Siren, text: 'A sound and a banner the moment new water appears ahead.' },
      { Icon: ArrowsClockwise, text: 'A fresh dry route calculated without leaving the map.' },
    ],
  },
  {
    title: 'When you see water',
    points: [
      { Icon: Camera, text: 'Report ankle, knee or waist depth in two taps.' },
      { Icon: Camera, text: 'Add a photo and the depth is checked against what the picture shows.' },
      { Icon: ThumbsUp, text: 'Confirm or clear reports from other riders within 2 km.' },
    ],
  },
]

const REAL = ['Basemap and street network from OpenStreetMap', 'Route geometry computed with OSRM', 'The depth thresholds and vehicle limits', 'The demo flood photographs']
const SIMULATED = ['Flood reports already on the map', 'Your position moving along the route', 'The photo verdicts, which are pre-written', 'Counts of riders rerouted']

function PrimaryButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex h-12 items-stretch whitespace-nowrap bg-signal text-sm font-semibold text-zinc-50 transition-transform duration-150 ease-punch active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
    >
      <span className="flex items-center px-5">{children}</span>
      <span className="grid w-12 place-items-center border-l border-black/25 transition-colors duration-200 group-hover:bg-black/15">
        <ArrowRight weight="bold" className="h-4 w-4 transition-transform duration-200 ease-punch group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-12 items-center gap-2 whitespace-nowrap border border-white/25 px-5 text-sm font-semibold text-zinc-100 transition-[transform,background-color,border-color] duration-150 ease-punch hover:border-white/60 hover:bg-white/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
    >
      {children}
      <ArrowUpRight weight="bold" className="h-4 w-4" />
    </button>
  )
}

/** Landing page: the front door to the rider app. */
export default function Landing({ onOpenRider }: Props) {
  const root = useRef<HTMLDivElement>(null)

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const navLink = 'transition-colors duration-150 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal'

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero: lines rise into place in sequence, so the eye reads headline, then promise, then action.
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('.hero-line', { yPercent: 105, duration: 0.9, stagger: 0.12 })
          .from('.hero-fade', { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 }, '-=0.55')
          .from('.hero-photo', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'power4.inOut' }, 0.15)

        // Statement: words brighten in sequence as you read down the page.
        gsap.fromTo(
          '.stmt-word',
          { opacity: 0.14 },
          { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: '.stmt', start: 'top 78%', end: 'bottom 52%', scrub: true } },
        )

        // Depth slices: the three photographs slide up as a set when the section arrives.
        gsap.from('.slice', { y: 48, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.slices', start: 'top 80%', once: true } })

        // Stage blocks fade up as they enter.
        gsap.utils.toArray<HTMLElement>('.prod-block').forEach((el) => {
          gsap.from(el, { opacity: 0, y: 36, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 82%', once: true } })
        })
      })

      // Product section: the title stays pinned while the three stages scroll past it.
      mm.add('(min-width: 1024px)', () => {
        ScrollTrigger.create({ trigger: '.prod', start: 'top top', end: 'bottom bottom', pin: '.prod-pin', pinSpacing: false })
      })

      return () => mm.revert()
    },
    { scope: root },
  )

  const words = STATEMENT.split(' ')

  return (
    <div ref={root} className="min-h-dvh w-full overflow-x-hidden bg-void text-zinc-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:bg-signal focus:px-3 focus:py-2 focus:text-sm focus:text-zinc-50">
        Skip to content
      </a>

      {/* Navigation: one line, 64px, hairline underneath */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
          <a href="#/" aria-label="PhnomFlood AI home" className="flex items-center gap-3">
            <svg viewBox="0 0 20 20" className="h-6 w-6 shrink-0" aria-hidden>
              <path d="M10 1 19 10 10 19 1 10Z" fill="none" stroke="#E8301C" strokeWidth="1.75" />
              <path d="M5 11c1.7-1.4 3.3-1.4 5 0s3.3 1.4 5 0" fill="none" stroke="#F4F4F5" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <span className="font-display text-base">PhnomFlood</span>
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <button onClick={() => jump('depth')} className={navLink}>How it reads water</button>
            <button onClick={() => jump('product')} className={navLink}>On the road</button>
            <button onClick={() => jump('data')} className={navLink}>What is real</button>
          </nav>
          <button
            onClick={onOpenRider}
            className="h-10 whitespace-nowrap border border-white/25 px-4 text-sm font-semibold transition-[transform,background-color] duration-150 ease-punch hover:bg-white/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
          >
            Open rider app
          </button>
        </div>
      </header>

      <main id="main">
        {/* Attention: hero */}
        <section className="ln-scan relative mx-auto grid min-h-dvh max-w-[1400px] grid-cols-1 items-center gap-10 px-4 pb-16 pt-24 sm:px-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <h1 className="font-display text-[clamp(3rem,7.4vw,7rem)]">
              <span className="block overflow-hidden pb-[0.06em]"><span className="hero-line block">Ride the</span></span>
              <span className="block overflow-hidden pb-[0.06em]"><span className="hero-line block text-signal">dry street.</span></span>
            </h1>
            <p className="hero-fade mt-8 max-w-[36ch] text-lg leading-relaxed text-zinc-300">Flood-aware routes for riders in Phnom Penh. Report water in two taps and everyone nearby sees it.</p>
            <div className="hero-fade mt-10 flex flex-wrap items-center gap-3">
              <PrimaryButton onClick={onOpenRider}>Open rider app</PrimaryButton>
              <GhostButton onClick={() => jump('depth')}>See how it reads water</GhostButton>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="hero-photo ln-halftone-wrap aspect-[4/5] w-full border border-white/15">
              <img src="/scenarios/waist-deep-flood.jpg" alt="A rider pushing a stalled motorbike through floodwater up to the seat" className="ln-halftone h-full w-full object-cover" {...{ fetchpriority: 'high' }} />
            </div>
          </div>
        </section>

        {/* Street marquee: the only marquee on the page, and it is real street data */}
        <section aria-label="Streets in the routing data" className="overflow-hidden border-y border-white/10 py-6">
          <div className="ln-marquee flex w-max items-center gap-10 whitespace-nowrap">
            {[...STREETS, ...STREETS].map((k, i) => (
              <span key={`${k}-${i}`} className={`font-display text-4xl sm:text-5xl ${i % 2 ? 'ln-outline' : 'text-zinc-100'}`} aria-hidden={i >= STREETS.length}>
                {k}
              </span>
            ))}
          </div>
        </section>

        {/* Interest: depth bento, gapless, built from real photographs and real thresholds */}
        <section id="depth" className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44">
          <h2 className="font-display max-w-[16ch] text-[clamp(2.25rem,5vw,4.5rem)]">Three depths decide the route.</h2>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-zinc-400">Riders report ankle, knee or waist depth. The router weighs each one differently for a motorbike, a tuk-tuk and a car.</p>

          <div className="mt-14 grid grid-flow-dense grid-cols-1 gap-px border border-white/15 bg-white/15 lg:grid-cols-12">
            <div className="slices bg-void lg:col-span-8 lg:row-span-2">
              <div className="grid h-full min-h-[420px] grid-cols-1 gap-px bg-white/15 sm:grid-cols-3">
                {SLICES.map((s) => (
                  <figure key={s.name} className="slice group relative min-h-[260px] overflow-hidden bg-void">
                    <img src={s.src} alt={s.alt} loading="lazy" className="ln-halftone absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-punch group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-void via-void/30 to-transparent" />
                    <figcaption className="absolute inset-x-0 bottom-0 p-5">
                      <p className="font-mono text-3xl text-zinc-50">
                        {s.cm}
                        <span className="ml-1 text-sm text-zinc-400">cm</span>
                      </p>
                      <p className="mt-1 font-display text-xl">{s.name}</p>
                      <p className="mt-2 max-w-[22ch] text-sm leading-snug text-zinc-300 opacity-0 transition-[opacity,transform] duration-300 ease-punch translate-y-1 group-hover:translate-y-0 group-hover:opacity-100 max-sm:translate-y-0 max-sm:opacity-100">{s.note}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div className="bg-slab p-7 lg:col-span-4">
              <h3 className="font-display text-2xl">Who stops where</h3>
              <dl className="mt-6 divide-y divide-white/10 font-mono text-sm">
                {(['moto', 'tuktuk', 'car'] as const).map((id) => {
                  const v = VEHICLES[id]
                  const block = Object.values(DEPTHS).find((d) => d.rank === v.blockRank)
                  return (
                    <div key={id} className="flex items-baseline justify-between gap-4 py-3">
                      <dt className="text-zinc-300">{v.short}</dt>
                      <dd className="text-zinc-400">
                        stops at <span className="text-zinc-50">{block?.cm} cm</span>
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>

            <div className="bg-signal p-7 text-zinc-50 lg:col-span-4">
              <h3 className="font-display text-2xl">Report in two taps</h3>
              <p className="mt-4 max-w-[30ch] text-base leading-relaxed text-zinc-50/90">Pick the depth, confirm the place. Everyone routing nearby sees it straight away.</p>
            </div>
          </div>
        </section>

        {/* Statement: words brighten with scroll */}
        <section className="stmt mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44" aria-label="Why it exists">
          <p className="font-display max-w-[22ch] text-[clamp(2rem,4.6vw,4.25rem)] !leading-[1.02] sm:max-w-[26ch]">
            {words.map((w, i) => (
              <span key={i} className="stmt-word inline-block pr-[0.22em]">
                {w}
              </span>
            ))}
          </p>
        </section>

        {/* Desire: pinned split. The title stays while the three stages of a ride scroll past. */}
        <section id="product" className="prod mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="prod-pin pb-12 pt-0 lg:flex lg:min-h-dvh lg:flex-col lg:justify-center lg:pt-24">
              <h2 className="font-display text-[clamp(2.5rem,5.4vw,5rem)]">Built for the saddle.</h2>
              <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-zinc-400">Big targets, one thumb, and a map that tells you about water before you reach it.</p>
            </div>
          </div>

          <div className="space-y-28 pb-28 lg:col-span-7 lg:space-y-40 lg:pb-44 lg:pt-44">
            {STAGES.map((stage, n) => (
              <article key={stage.title} className="prod-block">
                <h3 className="font-display text-3xl">{stage.title}</h3>
                <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
                  {stage.points.map(({ Icon, text }) => (
                    <li key={text} className="flex items-start gap-4 py-5">
                      <Icon weight="bold" className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
                      <span className="max-w-[44ch] text-base leading-relaxed text-zinc-200">{text}</span>
                    </li>
                  ))}
                </ul>
                {n === STAGES.length - 1 && (
                  <div className="mt-8">
                    <PrimaryButton onClick={onOpenRider}>Open rider app</PrimaryButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Honesty: what is real and what is simulated, grouped in two columns */}
        <section id="data" className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44">
          <h2 className="font-display max-w-[18ch] text-[clamp(2.25rem,5vw,4.5rem)]">This is a prototype. Here is what is real.</h2>
          <div className="mt-14 grid grid-cols-1 gap-px border border-white/15 bg-white/15 md:grid-cols-2">
            <div className="bg-void p-8">
              <h3 className="font-display text-2xl">Real</h3>
              <ul className="mt-6 space-y-4">
                {REAL.map((t) => (
                  <li key={t} className="max-w-[40ch] text-base leading-relaxed text-zinc-200">{t}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slab p-8">
              <h3 className="font-display text-2xl text-signal">Simulated</h3>
              <ul className="mt-6 space-y-4">
                {SIMULATED.map((t) => (
                  <li key={t} className="max-w-[40ch] text-base leading-relaxed text-zinc-300">{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Action */}
        <section className="border-t border-white/10 bg-signal text-zinc-50">
          <div className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44">
            <h2 className="font-display max-w-[14ch] text-[clamp(3rem,8vw,8rem)]">Open the map.</h2>
            <div className="mt-12">
              <button
                onClick={onOpenRider}
                className="group inline-flex h-12 items-stretch whitespace-nowrap bg-zinc-950 text-sm font-semibold text-zinc-50 transition-transform duration-150 ease-punch active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
              >
                <span className="flex items-center px-5">Open rider app</span>
                <span className="grid w-12 place-items-center border-l border-white/20">
                  <ArrowRight weight="bold" className="h-4 w-4 transition-transform duration-200 ease-punch group-hover:translate-x-0.5" />
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 text-sm text-zinc-400 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[46ch] space-y-2">
            <p className="font-display text-lg text-zinc-100">PhnomFlood AI</p>
            <p className="leading-relaxed">Built by So Sovannkaruna for the Open Data X AI Venture Hackathon 1.0.</p>
          </div>
          <div className="max-w-[46ch] space-y-2 leading-relaxed">
            <p>Map data from OpenStreetMap contributors. Routes computed with OSRM.</p>
            <p>Flood reports are stored in your own browser. Nothing is sent anywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
