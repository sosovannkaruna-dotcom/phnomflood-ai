import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowCounterClockwise, ArrowRight, CheckCircle, CloudRain, PaperPlaneTilt, Pause, Play, Warning, X } from '@phosphor-icons/react'
import RiderMap from '../rider/components/RiderMap'
import { useForecast } from '../rider/hooks/useForecast'
import { bearingAt, pointAt } from '../rider/lib/trip'
import { routeForecast } from '../rider/lib/forecast'
import { LangProvider, useT, type Key } from '../i18n'
import type { RouteEntry } from '../rider/types'
import { CLOUDBURST_MMH, FLOOD_CM, cloudburstSeries, pickScenario } from './scenario'

// Judge mode: the pitch's whole argument on one screen. Two riders, the same start, the same storm:
// standard GPS on the left keeps the usual road and stalls in the water; PhnomFlood on the right
// sees the forecast and a Telegram rider's photo, reroutes before the turn-off and arrives dry.
// One button plays it (about 45 s); Space pauses, R replays, Esc closes. Everything here is simulated
// and labelled so; it never touches the live map or the demo's saved reports.

// The show's clock, in seconds after Cloudburst.
const RAIN_UP = 4 // the gauge climbs to 65 mm/h
const GO = 6 // both riders set off
const RIDE_S = 26 // seconds to ride the whole usual route
const RECALC_S = 1.9
const TICK_MS = 100

const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3

function Judge({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT()
  const scenario = useMemo(pickScenario, [])
  const { preset, usual, usualClear, dry, split, flood, report } = scenario

  // Show clock: null before Cloudburst.
  const [time, setTime] = useState<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [rain, setRain] = useState<ReturnType<typeof cloudburstSeries> | undefined>(undefined)
  const startedAt = useRef(0)
  const pausedAt = useRef<number | null>(null)
  const cloudburst = useRef<HTMLButtonElement>(null)

  const start = useCallback(() => {
    startedAt.current = performance.now()
    pausedAt.current = null
    setPaused(false)
    setTime(0)
    setRain(cloudburstSeries(Date.now()))
  }, [])
  const reset = useCallback(() => {
    setTime(null)
    setPaused(false)
    setRain(undefined)
  }, [])

  // Timing, worked out from the trip: the report lands with the rider a little before the turn-off,
  // the standard rider stalls at the water's edge, PhnomFlood arrives after its longer route.
  const pace = 1 / RIDE_S // of the usual route per second
  const tReport = GO + Math.max(1.5, (split - 0.12) / pace)
  const stallAt = Math.max(split + 0.05, flood.fraction - 140 / Math.max(1, usual.candidate.distanceM))
  const tStall = GO + stallAt / pace
  const ratio = dry.candidate.distanceM / Math.max(1, usual.candidate.distanceM)
  const tArrive = GO + ratio / pace
  const tEnd = Math.max(tArrive, tStall) + 1.5

  useEffect(() => {
    if (time === null || paused) return
    const timer = window.setInterval(() => {
      const now = (performance.now() - startedAt.current) / 1000
      setTime(Math.min(now, tEnd))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [time === null, paused, tEnd]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = useCallback(() => {
    if (time === null || time >= tEnd) return
    if (paused) {
      startedAt.current += performance.now() - (pausedAt.current ?? performance.now())
      pausedAt.current = null
      setPaused(false)
    } else {
      pausedAt.current = performance.now()
      setPaused(true)
    }
  }, [time, paused, tEnd])

  // Keys: Esc closes, Space pauses, R replays, Enter starts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ' && time !== null) {
        e.preventDefault()
        togglePause()
      } else if (e.key.toLowerCase() === 'r' && !e.shiftKey) start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, togglePause, start, time])
  useEffect(() => cloudburst.current?.focus(), [])

  const s = time ?? 0
  const running = time !== null
  const rainNow = running ? CLOUDBURST_MMH * ease(s / RAIN_UP) : 0
  const reported = running && s >= tReport
  const rerouted = running && s >= tReport + RECALC_S
  const recalculating = reported && !rerouted
  const stalled = running && s >= tStall
  const arrived = running && s >= tArrive

  // The standard rider: along the usual road until the water.
  const leftF = running ? Math.min(stallAt, Math.max(0, (s - GO) * pace)) : 0
  // PhnomFlood's rider: the same road until the reroute, then the dry route (they share the start).
  const ridden = running ? Math.max(0, (s - GO) * pace) * usual.candidate.distanceM : 0
  const rightRoute = rerouted ? dry : reported ? usual : usualClear
  const rightF = Math.min(1, ridden / Math.max(1, rightRoute.candidate.distanceM))

  // Forecast: the cloudburst on the terrain model, on the PhnomFlood map only; frames rise with the show.
  const forecast = useForecast(running, rain, [], [])
  const result = forecast.status === 'ready' ? forecast.result : null
  // Water rises frame by frame to the forecast's peak and holds there (it never recedes mid-show).
  const peak = result ? result.wetCells.indexOf(Math.max(...result.wetCells)) : 0
  const frame = result ? Math.min(peak, Math.max(0, Math.floor((s - 1.5) / 1.1))) : 0
  const mapForecast = useMemo(() => (result ? { result, frame } : null), [result, frame])
  const ahead = useMemo(() => (result ? routeForecast(result, usual.candidate.path, usual.minutes, result.times[0]) : null), [result, usual])

  // Simulated time of day: rides start at 17:40; the clock runs at the route's own pace.
  const clock = new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' })
  const base = useMemo(() => {
    const d = new Date()
    d.setUTCHours(10, 40, 0, 0) // 17:40 in Phnom Penh
    return d.getTime()
  }, [])
  const simMin = Math.max(0, s - GO) * (usual.minutes / RIDE_S)
  const at = (sec: number) => clock.format(base + Math.max(0, sec - GO) * (usual.minutes / RIDE_S) * 60000)

  // The event feed, newest first.
  const events: { at: number; key: Key; vars?: Record<string, string | number>; kind: 'rain' | 'forecast' | 'telegram' | 'route' | 'stall' | 'arrive' }[] = []
  if (running) {
    events.push({ at: 0.3, key: 'judge.ev.rain', vars: { mm: CLOUDBURST_MMH }, kind: 'rain' })
    if (result && s >= 3) events.push({ at: 3, key: ahead?.first ? 'judge.ev.forecast' : 'judge.ev.forecastCity', vars: { cm: ahead?.first?.cm ?? 0, time: ahead?.first ? clock.format(base + ((ahead.first.at - result.times[0]) / 60000) * 60000) : '' }, kind: 'forecast' })
    if (reported) events.push({ at: tReport, key: 'judge.ev.telegram', vars: { cm: FLOOD_CM, street: flood.street }, kind: 'telegram' })
    if (rerouted) events.push({ at: tReport + RECALC_S, key: 'judge.ev.reroute', vars: { via: dry.candidate.via, extra: dry.minutes - usual.minutes }, kind: 'route' })
    if (stalled) events.push({ at: tStall, key: 'judge.ev.stall', vars: { street: flood.street, cm: FLOOD_CM }, kind: 'stall' })
    if (arrived) events.push({ at: tArrive, key: 'judge.ev.arrive', vars: { min: dry.minutes }, kind: 'arrive' })
  }
  events.sort((a, b) => b.at - a.at)

  // Standard GPS never knows about the water: its route stays plain until the rider is in it.
  const leftEntry: RouteEntry = stalled ? usual : usualClear
  // The reported water as DESIGN.md's hazard tag: on PhnomFlood's map from the report, on the standard map from the stall.
  const tag = { id: 'judge-flood', lat: flood.point[0], lng: flood.point[1], cm: FLOOD_CM, kind: 'danger' as const }
  const rightTags = useMemo(() => (reported ? [{ ...tag, source: t('source.telegram') }] : []), [reported]) // eslint-disable-line react-hooks/exhaustive-deps
  const leftTags = useMemo(() => (stalled ? [tag] : []), [stalled]) // eslint-disable-line react-hooks/exhaustive-deps
  const leftPos = pointAt(usual.candidate, leftF)
  const rightPos = pointAt(rightRoute.candidate, rightF)

  return (
    <div role="dialog" aria-modal="true" aria-label={t('judge.title')} className="jd-root fixed inset-0 z-[200] flex flex-col bg-void text-zinc-100">
      {/* Top strip: what this is, the simulated clock, and the way out */}
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-white/[0.12] px-4">
        <span className="tl-title text-base text-zinc-50">PhnomFlood AI</span>
        <span className="tl-label hidden sm:inline xl:text-[13px]">{t('judge.title')}</span>
        <span className="ml-auto font-mono text-sm tabular-nums text-zinc-300 xl:text-lg" aria-label={t('judge.clock')}>
          {running ? clock.format(base + simMin * 60000) : clock.format(base)}
        </span>
        <span className="tl-label xl:text-[13px]">
          <span className="md:hidden">{t('judge.simulatedShort')}</span>
          <span className="hidden md:inline">{t('judge.simulated')}</span>
        </span>
        <button onClick={onClose} aria-label={t('judge.close')} className="rd-press grid h-9 w-9 place-items-center border border-white/[0.15] text-zinc-300">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Two riders, side by side */}
      <div className="jd-split relative grid min-h-0 flex-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
        {/* The hazard stripe down the seam between the two riders */}
        <span className="jd-seam pointer-events-none absolute z-10 hidden md:block" aria-hidden />
        <Pane
          title={t('judge.standard')}
          caption={t('judge.standardCaption')}
          minutes={usual.minutes}
          status={stalled ? { tone: 'stall', text: t('judge.stalled', { cm: FLOOD_CM }) } : running && s >= GO ? { tone: 'go', text: t('judge.riding') } : { tone: 'wait', text: t('judge.waiting') }}
          eta={stalled ? t('judge.stallDelay') : null}
        >
          <RiderMap
            preset={preset}
            entries={[leftEntry]}
            active={leftEntry}
            recalculating={false}
            reports={stalled ? [report] : []}
            mode="depth"
            position={leftPos}
            bearing={bearingAt(usual.candidate, leftF)}
            progress={leftF}
            navigating={false}
            panned={false}
            onUserPan={() => undefined}
            glideMs={TICK_MS * 2.2}
            floodAt={stalled ? 'danger' : null}
            routeColor={stalled ? undefined : '#D4D4D8'}
            tags={leftTags}
          />
          {stalled && <div className="rd-flood-edge" style={{ ['--flood' as string]: '#EF4444' }} aria-hidden />}
        </Pane>

        <Pane
          title="PhnomFlood"
          caption={t('judge.oursCaption')}
          minutes={rerouted ? dry.minutes : usual.minutes}
          status={
            arrived
              ? { tone: 'dry', text: t('judge.arrived') }
              : recalculating
                ? { tone: 'water', text: t('judge.rerouting') }
                : rerouted
                  ? { tone: 'dry', text: t('judge.ridingDry') }
                  : running && s >= GO
                    ? { tone: 'go', text: t('judge.riding') }
                    : { tone: 'wait', text: t('judge.waiting') }
          }
          eta={rerouted && !arrived ? t('judge.extra', { n: dry.minutes - usual.minutes }) : null}
        >
          <RiderMap
            preset={preset}
            entries={rerouted ? [usual, dry] : [rightRoute]}
            active={rightRoute}
            recalculating={recalculating}
            reports={reported ? [report] : []}
            mode="depth"
            position={rightPos}
            bearing={bearingAt(rightRoute.candidate, rightF)}
            progress={rightF}
            navigating={false}
            panned={false}
            onUserPan={() => undefined}
            glideMs={TICK_MS * 2.2}
            forecast={mapForecast}
            tags={rightTags}
            routeColor={rerouted ? undefined : '#D4D4D8'}
          />
        </Pane>
      </div>

      {/* Storm console: the gauge, the one button, and what is happening */}
      <div className="grid shrink-0 grid-cols-1 border-t border-white/[0.12] md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-stretch gap-4 border-b border-white/[0.12] p-3 md:border-b-0 md:border-r">
          <RainGauge mmh={rainNow} />
          <div className="flex min-w-[15rem] flex-col justify-between gap-2">
            <div>
              <p className="tl-label">{t('judge.rain')}</p>
              <p className="font-mono text-3xl tabular-nums leading-none text-zinc-50 xl:text-5xl">
                {Math.round(rainNow)}
                <span className="ml-1 text-sm text-zinc-400">mm/h</span>
              </p>
            </div>
            {!running ? (
              <button ref={cloudburst} onClick={start} className="tl-cta h-12 text-sm">
                <span className="flex items-center gap-2">
                  <CloudRain weight="fill" className="h-5 w-5" /> {t('judge.cloudburst', { mm: CLOUDBURST_MMH })}
                </span>
                <span>
                  <ArrowRight className="h-5 w-5" />
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-px border border-white/[0.15] bg-white/[0.15]">
                <button onClick={togglePause} disabled={s >= tEnd} className="rd-press flex h-12 items-center justify-center gap-2 bg-slab text-sm font-semibold text-zinc-100 disabled:text-zinc-500">
                  {paused ? <Play weight="fill" className="h-4 w-4" /> : <Pause weight="fill" className="h-4 w-4" />}
                  {paused ? t('judge.resume') : t('judge.pause')}
                </button>
                <button onClick={start} className="rd-press flex h-12 items-center justify-center gap-2 bg-slab text-sm font-semibold text-zinc-100">
                  <ArrowCounterClockwise className="h-4 w-4" /> {t('judge.replay')}
                </button>
              </div>
            )}
            {running && (
              <button onClick={reset} className="text-left font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500 hover:text-zinc-300">
                {t('judge.resetLine')}
              </button>
            )}
          </div>
        </div>

        <ol className="jd-feed min-h-[9.5rem] divide-y divide-white/[0.12] overflow-hidden" aria-live="polite" aria-label={t('judge.feed')}>
          {!events.length && <li className="px-4 py-3 text-sm text-zinc-400 xl:text-lg">{t('judge.idle', { mm: CLOUDBURST_MMH })}</li>}
          {events.slice(0, 4).map((e) => (
            <li key={e.key} className="jd-event flex items-start gap-3 px-4 py-2.5">
              <span className="w-16 shrink-0 whitespace-nowrap pt-px font-mono text-sm tabular-nums text-zinc-400 xl:w-20">{at(e.at)}</span>
              <EventIcon kind={e.kind} />
              <span className="min-w-0 flex-1 text-sm leading-snug text-zinc-100 xl:text-lg">
                {e.kind === 'telegram' && <span className="tl-label mr-2 text-water">{t('source.telegram')}</span>}
                {t(e.key, e.vars)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

const TONE = {
  wait: 'border-white/[0.15] text-zinc-400',
  go: 'border-white/25 text-zinc-100',
  water: 'border-water/50 text-water',
  dry: 'border-emerald-400/50 text-emerald-400',
  stall: 'border-flare/60 bg-signal/15 text-flare',
} as const

function Pane({ title, caption, minutes, status, eta, children }: { title: string; caption: string; minutes: number; status: { tone: keyof typeof TONE; text: string }; eta: string | null; children: React.ReactNode }) {
  const { t } = useT()
  return (
    <section className="relative flex min-h-0 flex-col border-white/[0.12] first:border-b md:first:border-b-0 md:first:border-r" aria-label={title}>
      <header className="flex h-[84px] shrink-0 items-center gap-3 border-b border-white/[0.12] bg-slab px-4 xl:h-24">
        <div className="min-w-0">
          <h2 className="tl-title truncate text-xl text-zinc-50 xl:text-3xl">{title}</h2>
          <p className="truncate text-sm text-zinc-400">{caption}</p>
        </div>
        <span className={`ml-auto flex shrink-0 items-center gap-1.5 border px-2 py-1 font-mono text-[13px] uppercase tracking-[0.08em] xl:text-sm ${TONE[status.tone]}`}>
          {status.tone === 'stall' && <Warning weight="fill" className="h-3.5 w-3.5" aria-hidden />}
          {status.tone === 'dry' && <CheckCircle weight="fill" className="h-3.5 w-3.5" aria-hidden />}
          {status.text}
        </span>
        <span className="shrink-0 text-right">
          <span className="tl-label block">{t('sheet.eta')}</span>
          <span className="block font-mono text-2xl tabular-nums leading-tight text-zinc-50 md:text-3xl xl:text-4xl">{t('sheet.min', { n: minutes })}</span>
          {eta && <span className={`block font-mono text-sm xl:text-base ${status.tone === 'stall' ? 'text-flare' : 'text-zinc-300'}`}>{eta}</span>}
        </span>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  )
}

/** A ruled column filling with rain, like the landing page's water gauge. */
function RainGauge({ mmh }: { mmh: number }) {
  const share = Math.min(1, mmh / 80)
  return (
    <div className="relative w-12 shrink-0 border border-white/[0.15] bg-dusk-deep" aria-hidden>
      <div className="absolute inset-x-0 bottom-0 bg-water/70 transition-[height] duration-100 ease-linear" style={{ height: `${share * 100}%` }} />
      {[20, 40, 60].map((v) => (
        <span key={v} className="absolute inset-x-0 flex items-start justify-end border-t border-white/30 pr-1" style={{ bottom: `${(v / 80) * 100}%` }}>
          <span className="font-mono text-[11px] leading-none text-zinc-300 mix-blend-difference">{v}</span>
        </span>
      ))}
    </div>
  )
}

function EventIcon({ kind }: { kind: 'rain' | 'forecast' | 'telegram' | 'route' | 'stall' | 'arrive' }) {
  const cls = 'mt-0.5 h-4 w-4 shrink-0'
  if (kind === 'telegram') return <PaperPlaneTilt weight="fill" className={`${cls} text-water`} aria-hidden />
  if (kind === 'stall') return <Warning weight="fill" className={`${cls} text-flare`} aria-hidden />
  if (kind === 'arrive' || kind === 'route') return <CheckCircle weight="fill" className={`${cls} text-emerald-400`} aria-hidden />
  return <CloudRain weight="fill" className={`${cls} text-water`} aria-hidden />
}

export default function JudgeMode({ onClose }: { onClose: () => void }) {
  return (
    <LangProvider>
      <Judge onClose={onClose} />
    </LangProvider>
  )
}
