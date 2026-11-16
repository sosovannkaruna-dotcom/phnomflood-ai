import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import QRCode from 'qrcode'
import { ArrowRight, ArrowUpRight, ArrowsClockwise, Camera, CloudRain, DeviceMobile, Drop, NavigationArrow, Path, ShieldCheck, Siren, ThumbsUp, Translate } from '@phosphor-icons/react'
import { DEPTHS, VEHICLES } from '../lib/severity'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// The live map hero loads after first paint (MapLibre and the route data are large); the photo shows until then.
const HeroMap = lazy(() => import('./HeroMap'))

interface Props {
  onOpen: (route: 'demo' | 'live' | 'tour') => void
}

// Real streets from the app's routing data
const STREETS = ['Russian Blvd', 'Mao Tse Toung Blvd', 'Kampuchea Krom Blvd', 'Nehru Blvd', 'Sihanouk Blvd', 'Monivong Blvd', 'Norodom Blvd', 'Charles de Gaulle Blvd', 'Sisowath Quay', 'Street 63', 'Street 289', 'Street 598']

const STATEMENT = 'Water rises faster than information moves. PhnomFlood closes that gap with street-level reports from the people already riding through it.'

// Sourced figures (the same sources as the pitch deck)
const FIGURES = [
  { value: '86%', text: 'of new vehicles registered in Cambodia in 2024 were motorcycles: 353,603 of 413,067.', source: 'MPWT via AKP, Jan 2025', span: 'lg:col-span-5' },
  { value: '80%', text: 'of Phnom Penh’s 1,412 mm of yearly rain falls between May and October.', source: 'DWD climate normals', span: 'lg:col-span-4' },
  { value: '16 / 26', text: 'of the city’s lakes have been filled in, so storm water has fewer places to go.', source: 'STT, “The Last Lakes”, 2019', span: 'lg:col-span-3' },
]

const SLICES = [
  { src: '/scenarios/ankle-deep-puddle.jpg', alt: 'Two people riding a bicycle through street water that reaches the wheel hubs', cm: DEPTHS.ankle.cm, name: DEPTHS.ankle.short, note: 'Motorbikes slow down and take care.' },
  { src: '/scenarios/knee-deep-flood.jpg', alt: 'A group wading through knee-deep brown floodwater in front of a row of shophouses', cm: DEPTHS.knee.cm, name: DEPTHS.knee.short, note: 'Motorbikes and tuk-tuks reroute.' },
  { src: '/scenarios/waist-deep-flood.jpg', alt: 'A rider pushing a stalled motorbike through floodwater up to the seat', cm: DEPTHS.waist.cm, name: DEPTHS.waist.short, note: 'Nothing passes. Cars reroute too.' },
]

const STAGES = [
  {
    title: 'Before you ride',
    points: [
      { Icon: Path, text: 'Routes ranked by time and by how much water each one crosses, to eleven destinations.' },
      { Icon: ShieldCheck, text: 'A dry-only switch that hides any route with a blocking flood.' },
      { Icon: CloudRain, text: 'Rain now and over the next three hours, with an alert when it turns heavy.' },
    ],
  },
  {
    title: 'While you ride',
    points: [
      { Icon: NavigationArrow, text: 'The map follows you with turn-by-turn street names in English or Khmer.' },
      { Icon: Siren, text: 'A sound and a banner the moment a rider reports water ahead.' },
      { Icon: ArrowsClockwise, text: 'A new dry route from where you are, without leaving the map.' },
    ],
  },
  {
    title: 'When you see water',
    points: [
      { Icon: Drop, text: 'Report ankle, knee or waist depth in two taps.' },
      { Icon: Camera, text: 'Add a photo and the AI checks the depth against what the picture shows.' },
      { Icon: ThumbsUp, text: 'Confirm or clear reports from other riders within 2 km.' },
    ],
  },
]

const DEMO_LIST = ['A scripted storm: 32 mm/h of rain', 'A ride that meets a flood and reroutes on cue', 'Pre-written verdicts for four sample photos', 'Mock reports, kept on this device']
const LIVE_LIST = ['Real rainfall from Open-Meteo, refreshed every 10 minutes', 'A real Vision AI check of any photo you take', 'Reports shared between every phone that opens it', 'Starts empty: every pin is a real report']

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

/** QR code to the live app, so anyone in the room can report from their own phone. */
function LiveQr() {
  const [svg, setSvg] = useState<string | null>(null)
  const url = `${window.location.origin}/#/live`
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0A0A0BFF', light: '#F4F4F5FF' } })
      .then(setSvg)
      .catch(() => setSvg(null))
  }, [url])
  return (
    <figure className="flex items-center gap-5">
      <div className="h-36 w-36 shrink-0 bg-zinc-100 p-1.5" role="img" aria-label={`QR code that opens ${url}`}>
        {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="cc-shimmer h-full w-full" />}
      </div>
      <figcaption className="max-w-[24ch] text-sm leading-relaxed text-zinc-300">
        Scan to open the live app on your phone. A flood you report there appears on every other screen within seconds.
      </figcaption>
    </figure>
  )
}

/** Landing page: the front door to the demo and the live app. */
export default function Landing({ onOpen }: Props) {
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

        // Figures count in as they arrive, so the numbers read as evidence, not decoration.
        gsap.from('.figure', { y: 40, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.figures', start: 'top 80%', once: true } })

        // Statement: words brighten in sequence as you read down the page.
        gsap.fromTo(
          '.stmt-word',
          { opacity: 0.14 },
          { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: '.stmt', start: 'top 78%', end: 'bottom 52%', scrub: true } },
        )

        // Depth slices: the three photographs slide up as a set when the section arrives.
        gsap.from('.slice', { y: 48, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.slices', start: 'top 80%', once: true } })

        // Stage blocks and the two versions fade up as they enter.
        gsap.utils.toArray<HTMLElement>('.prod-block, .version').forEach((el) => {
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
            <button onClick={() => jump('why')} className={navLink}>Why</button>
            <button onClick={() => jump('depth')} className={navLink}>How it reads water</button>
            <button onClick={() => jump('product')} className={navLink}>On the road</button>
            <button onClick={() => jump('versions')} className={navLink}>Demo or live</button>
          </nav>
          <button
            onClick={() => onOpen('demo')}
            className="h-10 whitespace-nowrap border border-white/25 px-4 text-sm font-semibold transition-[transform,background-color] duration-150 ease-punch hover:bg-white/5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
          >
            Try the demo
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
              <PrimaryButton onClick={() => onOpen('tour')}>Watch it work</PrimaryButton>
              <GhostButton onClick={() => onOpen('demo')}>Try the demo</GhostButton>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="hero-photo aspect-[4/5] w-full border border-white/15 bg-void">
              <Suspense
                fallback={
                  <div className="ln-halftone-wrap h-full w-full">
                    <img src="/scenarios/waist-deep-flood.jpg" alt="" className="ln-halftone h-full w-full object-cover" {...{ fetchpriority: 'high' }} />
                  </div>
                }
              >
                <HeroMap onOpen={() => onOpen('demo')} />
              </Suspense>
            </div>
            <p className="hero-fade mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-emerald-500" aria-hidden /> Dry route</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-red-400" aria-hidden /> Usual map route</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-amber-400" aria-hidden /> Reported flooding</span>
              <span className="text-zinc-500">Map © OpenStreetMap contributors, OpenFreeMap</span>
            </p>
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

        {/* Why: three sourced figures, unequal widths so the biggest fact leads */}
        <section id="why" className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44">
          <h2 className="font-display max-w-[18ch] text-[clamp(2.25rem,5vw,4.5rem)]">A motorbike city with nowhere for the rain to go.</h2>
          <div className="figures mt-14 grid grid-cols-1 gap-px border border-white/15 bg-white/15 lg:grid-cols-12">
            {FIGURES.map((f, i) => (
              <div key={f.value} className={`figure flex flex-col justify-between gap-10 p-7 ${f.span} ${i === 0 ? 'bg-slab' : 'bg-void'}`}>
                <p className={`font-display text-[clamp(3.5rem,7vw,6.5rem)] ${i === 0 ? 'text-signal' : 'text-zinc-50'}`}>{f.value}</p>
                <div>
                  <p className="max-w-[34ch] text-base leading-relaxed text-zinc-300">{f.text}</p>
                  <p className="mt-4 font-mono text-xs text-zinc-500">{f.source}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Interest: depth bento, gapless, built from real photographs and real thresholds */}
        <section id="depth" className="mx-auto max-w-[1400px] px-4 pb-28 sm:px-8 lg:pb-44">
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
                      <p className="mt-2 max-w-[22ch] translate-y-1 text-sm leading-snug text-zinc-300 opacity-0 transition-[opacity,transform] duration-300 ease-punch group-hover:translate-y-0 group-hover:opacity-100 max-sm:translate-y-0 max-sm:opacity-100">{s.note}</p>
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
        <section className="stmt mx-auto max-w-[1400px] px-4 pb-28 sm:px-8 lg:pb-44" aria-label="Why it exists">
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
              <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-zinc-400">Big targets, one thumb, Khmer or English, and a map that tells you about water before you reach it.</p>
            </div>
          </div>

          <div className="space-y-28 pb-28 lg:col-span-7 lg:space-y-40 lg:pb-44 lg:pt-44">
            {STAGES.map((stage) => (
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
              </article>
            ))}
          </div>
        </section>

        {/* Two versions: the scripted demo and the live app, side by side, with the QR to join */}
        <section id="versions" className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44">
          <h2 className="font-display max-w-[18ch] text-[clamp(2.25rem,5vw,4.5rem)]">Two ways to try it.</h2>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-zinc-400">The demo plays the whole story on cue. The live app runs on real weather, a real AI check and reports shared between phones.</p>
          <div className="mt-14 grid grid-cols-1 gap-px border border-white/15 bg-white/15 lg:grid-cols-12">
            <article className="version flex flex-col gap-8 bg-void p-8 lg:col-span-5">
              <div>
                <h3 className="font-display text-3xl">Demo</h3>
                <p className="mt-2 text-sm text-zinc-400">Scripted and offline. Best for a pitch.</p>
              </div>
              <ul className="space-y-3">
                {DEMO_LIST.map((t) => (
                  <li key={t} className="flex gap-3 text-base leading-relaxed text-zinc-200">
                    <span className="mt-2.5 h-px w-3 shrink-0 bg-zinc-500" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <PrimaryButton onClick={() => onOpen('demo')}>Try the demo</PrimaryButton>
              </div>
            </article>
            <article className="version flex flex-col gap-8 bg-slab p-8 lg:col-span-7">
              <div>
                <h3 className="font-display text-3xl text-signal">Live</h3>
                <p className="mt-2 text-sm text-zinc-400">Real services. Install it from your browser menu like an app.</p>
              </div>
              <ul className="space-y-3">
                {LIVE_LIST.map((t) => (
                  <li key={t} className="flex gap-3 text-base leading-relaxed text-zinc-200">
                    <span className="mt-2.5 h-px w-3 shrink-0 bg-signal" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                <LiveQr />
                <GhostButton onClick={() => onOpen('live')}>Open live app</GhostButton>
              </div>
            </article>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500">
            <span className="flex items-center gap-2"><Translate className="h-4 w-4" /> English and Khmer</span>
            <span className="flex items-center gap-2"><DeviceMobile className="h-4 w-4" /> Installs to your home screen</span>
            <span>The ride is simulated in both versions; routes and street names are real.</span>
          </div>
        </section>

        {/* Action */}
        <section className="border-t border-white/10 bg-signal text-zinc-50">
          <div className="mx-auto max-w-[1400px] px-4 py-28 sm:px-8 lg:py-44">
            <h2 className="font-display max-w-[14ch] text-[clamp(3rem,8vw,8rem)]">Open the map.</h2>
            <div className="mt-12 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onOpen('demo')}
                className="group inline-flex h-12 items-stretch whitespace-nowrap bg-zinc-950 text-sm font-semibold text-zinc-50 transition-transform duration-150 ease-punch active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
              >
                <span className="flex items-center px-5">Try the demo</span>
                <span className="grid w-12 place-items-center border-l border-white/20">
                  <ArrowRight weight="bold" className="h-4 w-4 transition-transform duration-200 ease-punch group-hover:translate-x-0.5" />
                </span>
              </button>
              <button
                onClick={() => onOpen('live')}
                className="inline-flex h-12 items-center gap-2 whitespace-nowrap border border-zinc-950/60 px-5 text-sm font-semibold transition-[transform,background-color] duration-150 ease-punch hover:bg-zinc-950/10 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              >
                Open live app
                <ArrowUpRight weight="bold" className="h-4 w-4" />
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
          <div className="max-w-[52ch] space-y-2 leading-relaxed">
            <p>Map data from OpenStreetMap contributors, via OpenFreeMap. Routes computed with OSRM. Rainfall from Open-Meteo.</p>
            <p>Demo photos: Biplab Sau, Lâm Trần and Dibakar Roy on Pexels. Live photo checks are sent to Google Gemini; PhnomFlood does not store your photos.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
