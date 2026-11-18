import { Suspense, lazy, useEffect, useState } from 'react'
import { ArrowLeft, ArrowsClockwise, Copy, DownloadSimple, Check, Sparkle } from '@phosphor-icons/react'
import { minutesSince, useBriefing } from '../services/briefing'
import type { HistoryReport } from './FloodReplay'
import BackToTop from '../shared/BackToTop'

// The replay map loads after the page (MapLibre is large).
const FloodReplay = lazy(() => import('./FloodReplay'))
const StormReplay = lazy(() => import('./StormReplay'))

/** Blocked-drain watch: where the photo check saw debris blocking a drain, for drainage crews. */
function DrainWatch() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; reports: HistoryReport[]; days: number } | { status: 'error' }>({ status: 'loading' })
  useEffect(() => {
    fetch('/api/history?days=30&drain=blocked')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { reports: HistoryReport[]; window_days: number }) => setState({ status: 'ready', reports: [...json.reports].reverse(), days: json.window_days }))
      .catch(() => setState({ status: 'error' }))
  }, [])
  const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' })
  // Several photos of one drain count once: group by place and Khan.
  const spots = state.status === 'ready'
    ? Object.values(
        state.reports.reduce<Record<string, { r: HistoryReport; n: number }>>((acc, r) => {
          const key = `${r.place}|${r.khan ?? ''}`
          acc[key] = acc[key] ? { r: acc[key].r, n: acc[key].n + 1 } : { r, n: 1 }
          return acc
        }, {}),
      )
    : []
  return (
    <section aria-label="Blocked-drain watch" className="mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl">Blocked-drain watch</h2>
        <a href="/api/history?days=30&drain=blocked&format=csv" className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
          <DownloadSimple weight="bold" className="h-4 w-4" /> CSV for drainage crews
        </a>
      </div>
      <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-zinc-400">
        When a rider adds a photo, the AI check also looks for debris blocking a drain grate. Every spot where it saw one in the last 30 days is listed here, so crews know where to clear first.
      </p>
      <div className="mt-6 border border-white/15">
        {state.status === 'loading' && <div className="cc-shimmer h-20" />}
        {state.status === 'error' && <p className="p-5 text-sm text-flare">The drain list could not be loaded. Try again in a moment.</p>}
        {state.status === 'ready' && spots.length === 0 && (
          <p className="p-5 text-sm leading-relaxed text-zinc-400">
            No blocked drains spotted in the last {state.days === 1 ? '24 hours' : `${state.days} days`}. When a photo check sees debris blocking a drain, the spot appears here.
          </p>
        )}
        {spots.length > 0 && (
          <ul className="divide-y divide-white/10">
            {spots.map(({ r, n }) => (
              <li key={r.id} className="grid grid-cols-1 gap-1 px-5 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-baseline sm:gap-6">
                <span className="min-w-0 truncate text-zinc-100">
                  {r.place}
                  {r.khan ? <span className="text-zinc-500"> · {r.sangkat ? `${r.sangkat}, ` : ''}{r.khan}</span> : null}
                </span>
                <span className="font-mono text-xs text-zinc-400">
                  {n > 1 ? `${n} photos · ` : ''}~{r.depth_cm} cm water
                </span>
                <span className="font-mono text-xs text-zinc-500">{when.format(Date.parse(r.reported_at))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
import { DEPTHS } from '../lib/severity'

// The Open data page (#/data): PhnomFlood's live flood reports as a public feed anyone can use.

interface OpenReport {
  id: string
  status: 'active' | 'cleared'
  depth: 'ankle' | 'knee' | 'waist'
  depth_cm: number | null
  depth_source: 'photo_ai' | 'rider'
  place: string
  khan: string | null
  sangkat: string | null
  confirmations: number
  reported_at: string
}

type Feed = { status: 'loading' } | { status: 'ready'; reports: OpenReport[]; at: string } | { status: 'error' }

const ENDPOINT = '/api/reports'

const FIELDS: [string, string][] = [
  ['id', 'Stable report id.'],
  ['status', '"active", or "cleared" once riders mark the water gone (only with include=cleared).'],
  ['depth', 'Reported class: ankle, knee or waist.'],
  ['depth_cm', 'Estimated depth in cm: from the AI photo check when there is one, otherwise the typical depth for the class (10, 25 or 40).'],
  ['depth_source', '"photo_ai" when a photo was checked by Vision AI, "rider" when the depth is the rider’s own pick.'],
  ['drain_blocked', 'Whether the photo check saw debris blocking a drain. Empty without a photo.'],
  ['place, area', 'Street or place name where the rider was, from OpenStreetMap.'],
  ['sangkat, khan', 'Commune and district, when known.'],
  ['lat, lng', 'Where the report was made (WGS 84).'],
  ['confirmations', 'How many other riders said it is still flooded.'],
  ['confidence', '"high", "medium" or "low": how much to trust the report right now. Weighs the photo check, confirmations, time since anyone last saw it against the usual drain time for that depth, and rain falling now (live feed only).'],
  ['confidence_reasons', 'What counted, space-separated: photo_agrees, photo_close, photo_disagrees, photo_dry, confirmed, recent, may_have_drained, likely_drained, raining, trusted_reporter. confidence_score is the same judgement from 0 to 1.'],
  ['source', '"rider" from the app, "telegram" from the PhnomFlood Telegram bot, "citizen" from older versions.'],
  ['reporter_trust', '"trusted", "regular" or "new": how often other riders confirmed the reporting phone’s earlier reports (no account or identity behind it). Empty for reports made before it was introduced.'],
  ['reported_at, updated_at, cleared_at', 'ISO 8601 times, UTC.'],
]

const PARAMS: [string, string][] = [
  ['format', 'geojson (default), csv or json'],
  ['hours', '1 to 24: how far back to look (default 24)'],
  ['include', 'cleared: also list reports marked as drained'],
  ['drain', 'blocked: only reports whose photo showed a blocked drain'],
]

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex items-stretch border border-white/15 bg-slab">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-4 py-3 font-mono text-sm text-zinc-100">{text}</code>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setDone(true)
            window.setTimeout(() => setDone(false), 1500)
          })
        }}
        aria-label="Copy"
        className="grid w-12 shrink-0 place-items-center border-l border-white/15 text-zinc-400 transition-colors duration-150 hover:bg-dusk-deep hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
      >
        {done ? <Check weight="bold" className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}

export default function OpenData({ onHome }: { onHome: () => void }) {
  const [feed, setFeed] = useState<Feed>({ status: 'loading' })
  const briefing = useBriefing('en', true, feed.status === 'ready' ? feed.reports.length : -1)
  const origin = window.location.origin

  const load = () => {
    setFeed((f) => (f.status === 'ready' ? f : { status: 'loading' }))
    fetch(`${ENDPOINT}?format=json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { reports: OpenReport[]; generated_at: string }) => setFeed({ status: 'ready', reports: json.reports, at: json.generated_at }))
      .catch(() => setFeed({ status: 'error' }))
  }
  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const reports = feed.status === 'ready' ? feed.reports : []
  const deepest = reports.reduce<OpenReport | null>((d, r) => (!d || (r.depth_cm ?? 0) > (d.depth_cm ?? 0) ? r : d), null)
  const khans = new Set(reports.map((r) => r.khan).filter(Boolean)).size
  const verified = reports.filter((r) => r.depth_source === 'photo_ai').length

  const stats = [
    { label: 'Active reports', value: feed.status === 'ready' ? String(reports.length) : '–' },
    { label: 'Deepest', value: deepest?.depth_cm ? `${deepest.depth_cm} cm` : '–' },
    { label: 'Districts affected', value: feed.status === 'ready' ? String(khans) : '–' },
    { label: 'Photo-verified', value: feed.status === 'ready' ? String(verified) : '–' },
  ]

  const download = 'inline-flex h-12 items-center gap-2 whitespace-nowrap border px-5 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 ease-punch active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal'

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-void text-zinc-100">
      <header className="pf-header sticky top-0 z-40 border-b border-white/10 bg-void/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-8">
          <button onClick={onHome} className="flex items-center gap-2 text-sm text-zinc-400 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
            <ArrowLeft weight="bold" className="h-4 w-4" /> PhnomFlood
          </button>
          <a href="#/live" className="h-10 whitespace-nowrap border border-white/25 px-4 text-sm font-semibold leading-10 transition-[background-color,border-color] duration-150 hover:border-dusk hover:bg-dusk-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
            Open live app
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 pb-28 pt-16 sm:px-8 lg:pt-24">
        <h1 className="font-display max-w-[14ch] text-[clamp(2.75rem,6.4vw,5.5rem)]">Open flood data.</h1>
        <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-zinc-300">
          Every live flood report from PhnomFlood riders, free to download and build on: for city drainage teams, researchers, newsrooms and other apps. It updates within seconds of a rider reporting.
        </p>

        {/* Live numbers */}
        <section aria-label="Live now" className="mt-14">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl">Live now</h2>
            <button onClick={load} className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
              <ArrowsClockwise weight="bold" className="h-4 w-4" />
              {feed.status === 'ready' ? `Updated ${ago(feed.at)}` : 'Refresh'}
            </button>
          </div>
          <div className="tl-grid mt-4 grid-cols-2 border border-white/15 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="p-5">
                <p className="tl-label">{s.label}</p>
                <p className="mt-2 font-mono text-3xl text-zinc-50">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-px border-x border-b border-white/15">
            {feed.status === 'error' && <p className="p-5 text-sm text-flare">The feed could not be reached. Try again in a moment.</p>}
            {feed.status === 'loading' && <div className="cc-shimmer h-24" />}
            {feed.status === 'ready' && reports.length === 0 && (
              <p className="p-5 text-sm leading-relaxed text-zinc-400">No floods reported in the last 24 hours. When a rider reports water in the live app, it appears here and in every download.</p>
            )}
            {reports.length > 0 && (
              <ul className="cc-scroll max-h-[340px] divide-y divide-white/10 overflow-y-auto">
                {reports.slice(0, 50).map((r) => (
                  <li key={r.id} className="flex items-baseline gap-4 px-5 py-3 text-sm">
                    <span className="w-16 shrink-0 font-mono" style={{ color: DEPTHS[r.depth].color }}>{r.depth_cm ?? '–'} cm</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-100">
                      {r.place}
                      {r.khan ? <span className="text-zinc-500"> · {r.khan}</span> : null}
                    </span>
                    <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">{r.depth_source === 'photo_ai' ? 'Photo-verified' : 'Rider report'}</span>
                    <span className="shrink-0 font-mono text-xs text-zinc-400">{ago(r.reported_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* AI briefing, written from the same data */}
        {briefing.status === 'ready' && (
          <section aria-label="City flood briefing" className="mt-px grid grid-cols-1 gap-6 border-x border-b border-white/15 bg-dusk-deep p-6 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="tl-label flex items-center gap-1.5 text-dusk">
                {briefing.briefing.ai && <Sparkle weight="fill" className="h-3.5 w-3.5" />} City flood briefing
              </p>
              <p className="mt-2 font-display text-xl leading-tight">{briefing.briefing.headline}</p>
            </div>
            <div className="md:col-span-8">
              <p className="max-w-[62ch] text-sm leading-relaxed text-zinc-300">{briefing.briefing.summary}</p>
              {briefing.briefing.areas.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {briefing.briefing.areas.map((a) => (
                    <li key={a.name}>
                      <span className="text-zinc-100">{a.name}</span> <span className="text-zinc-400">{a.note}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-zinc-500">
                {briefing.briefing.ai ? `Written by AI (${briefing.briefing.model}) from ${briefing.briefing.basedOn.reports} live reports and the Open-Meteo forecast.` : 'No reports to summarise, so no AI was used.'} Updated {minutesSince(briefing.briefing.generatedAt) < 1 ? 'just now' : `${minutesSince(briefing.briefing.generatedAt)} min ago`}.
              </p>
            </div>
          </section>
        )}

        {/* A real storm, replayed from the news report next to what the weather models had */}
        <section id="storm" aria-label="Storm replay" className="mt-20 scroll-mt-24">
          <h2 className="font-display text-2xl">Storm replay: 26 February 2026</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-zinc-400">
            A real afternoon in Phnom Penh, step by step from the Khmer Times report that covered it. The first heavy rain in six months flooded four districts in under an hour, while every weather model showed a light shower.
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="cc-shimmer h-[640px] border border-white/15" />}>
              <StormReplay />
            </Suspense>
          </div>
        </section>

        {/* Flood replay */}
        <section aria-label="Flood replay" className="mt-20">
          <h2 className="font-display text-2xl">Flood replay</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-zinc-400">
            Play back the last days of reports: each flood appears when a rider reported it and leaves when riders cleared it, or after 24 hours. The red bars show when the reports came in.
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="cc-shimmer h-[560px] border border-white/15" />}>
              <FloodReplay />
            </Suspense>
          </div>
        </section>

        <DrainWatch />

        {/* Downloads */}
        <section aria-label="Download" className="mt-20">
          <h2 className="font-display text-2xl">Download</h2>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-zinc-400">The last 24 hours of active reports. GeoJSON opens in QGIS, ArcGIS and most web maps; CSV opens in any spreadsheet.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={`${ENDPOINT}?format=geojson`} download="phnomflood-reports.geojson" className={`${download} border-signal bg-signal text-zinc-50 hover:bg-[#F03A26]`}>
              <DownloadSimple weight="bold" className="h-4 w-4" /> GeoJSON
            </a>
            <a href={`${ENDPOINT}?format=csv`} className={`${download} border-white/25 hover:border-dusk hover:bg-dusk-deep`}>
              <DownloadSimple weight="bold" className="h-4 w-4" /> CSV
            </a>
            <a href={`${ENDPOINT}?format=json`} download="phnomflood-reports.json" className={`${download} border-white/25 hover:border-dusk hover:bg-dusk-deep`}>
              <DownloadSimple weight="bold" className="h-4 w-4" /> JSON
            </a>
          </div>
        </section>

        {/* API */}
        <section aria-label="API" className="mt-20 grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl">Use the API</h2>
            <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-zinc-400">One public endpoint, no key and no sign-up. It can be called from any website or script, and answers are cached for 20 seconds.</p>
            <div className="mt-6">
              <CopyLine text={`${origin}${ENDPOINT}`} />
            </div>
            <dl className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">
              {PARAMS.map(([k, v]) => (
                <div key={k} className="flex gap-4 py-3">
                  <dt className="w-20 shrink-0 font-mono text-zinc-100">{k}</dt>
                  <dd className="text-zinc-400">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="tl-label mt-6">Example</p>
            <div className="mt-2">
              <CopyLine text={`curl "${origin}${ENDPOINT}?format=csv&hours=6"`} />
            </div>
            <p className="tl-label mt-8">History</p>
            <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-zinc-400">
              Up to 90 days of past reports, each with status active, cleared or expired. Takes <span className="font-mono text-zinc-200">days</span> (1 to 90), <span className="font-mono text-zinc-200">format</span> (json or csv) and <span className="font-mono text-zinc-200">drain</span>.
            </p>
            <div className="mt-3">
              <CopyLine text={`${origin}/api/history?days=30`} />
            </div>
          </div>
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl">Fields</h2>
            <dl className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">
              {FIELDS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                  <dt className="font-mono text-zinc-100">{k}</dt>
                  <dd className="leading-relaxed text-zinc-400">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Licence and honesty notes */}
        <section aria-label="Licence" className="mt-20 grid grid-cols-1 gap-px border border-white/15 bg-white/15 md:grid-cols-2">
          <div className="bg-void p-7">
            <h2 className="font-display text-2xl">Licence</h2>
            <p className="mt-3 max-w-[48ch] text-sm leading-relaxed text-zinc-300">
              Open Database License (ODbL) 1.0. Use it, share it and build on it; credit “PhnomFlood AI riders” and OpenStreetMap contributors for place names, and share any database you build from it under the same terms.
            </p>
            <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-dusk underline-offset-4 hover:underline">
              Read the licence
            </a>
          </div>
          <div className="bg-slab p-7">
            <h2 className="font-display text-2xl">Read it with care</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-300">
              <li>Reports come from riders and can be wrong. Confirmations and photo checks make one more reliable.</li>
              <li>Depths are estimates, never measurements.</li>
              <li>Reports stay public for 24 hours. No names, accounts or photos are stored or published.</li>
            </ul>
          </div>
        </section>
      </main>

      <BackToTop />
    </div>
  )
}
