import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Motorcycle as Bike, Car, Taxi as CarTaxiFront, Check, Clock, Drop, MagnifyingGlass as Search, NavigationArrow, ShieldCheck, Stop, Warning as TriangleAlert, X } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT, type Key } from '../../i18n'
import type { AppMode } from '../../shared/mode'
import type { FloodReport, SyncState } from '../../shared/types'
import type { LatLng, RouteEntry, VehicleId } from '../types'
import type { Trip } from '../hooks/useTrip'
import type { RideStatus } from '../hooks/useRide'
import { clearsIn, floodsOnRoute, metresBetween, passability, routeLengthKm, routeSteps } from '../lib/trip'
import type { RouteStatus } from '../hooks/useLive'
import { drainText } from '../lib/format'
import { departureAdvice } from '../lib/departure'
import type { RainSlot } from '../hooks/useWeather'
import BriefingCard from './BriefingCard'
import type { BriefingState } from '../../services/briefing'
import type { HotspotState } from '../hooks/useHotspots'

const VEHICLES: { id: VehicleId; Icon: typeof Bike }[] = [
  { id: 'moto', Icon: Bike },
  { id: 'tuktuk', Icon: CarTaxiFront },
  { id: 'car', Icon: Car },
]
const STATUS_COLOR = { dry: '#10B981', caution: '#F59E0B', blocked: '#EF4444' }

interface Props {
  trip: Trip
  reports: FloodReport[]
  position: LatLng
  mode: AppMode
  sync: SyncState
  ride: RideStatus
  onStartRide: () => void
  onStopRide: () => void
  onReport: () => void
  onConfirm: (id: string) => void
  onClear: (id: string) => void
  /** Rain falling now, mm/h (for the drain estimate) */
  rainNow?: number
  /** Live: rain in 15-minute steps, for "leave now or wait" */
  forecast?: RainSlot[]
  /** Live: the AI city flood briefing */
  briefing?: BriefingState
  /** Live: flood-prone spots (predicted from report history) */
  spots?: { state: HotspotState; shown: number; auto: boolean; manual: boolean; toggle: () => void }
  /** Live mode: search any place instead of the demo's trip list */
  live?: {
    origin: string
    destination: string | null
    status: RouteStatus
    note: string | null
    renderSearch: (close: () => void) => ReactNode
  }
}

/** Two-detent sheet: riding view when collapsed, route comparison and nearby alerts when expanded. */
export default function BottomSheet({ trip, reports, position, mode, sync, ride, onStartRide, onStopRide, onReport, onConfirm, onClear, live, rainNow = 0, forecast, briefing, spots }: Props) {
  const { t, lang } = useT()
  const [expanded, setExpanded] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const { preset, entries, active, vehicle, dryOnly, recalculating } = trip

  const ago = (timestamp: number) => {
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
    return minutes < 1 ? t('ago.now') : minutes < 60 ? t('ago.min', { n: minutes }) : t('ago.hour', { n: Math.round(minutes / 60) })
  }
  const exposure = (entry: RouteEntry) =>
    entry.blockers.length ? t('exposure.blocked', { n: entry.blockers.length }) : entry.cautions.length ? t('exposure.caution', { n: entry.cautions.length }) : t('exposure.dry')
  const syncKey: Key = mode === 'demo' ? 'sync.demo' : (`sync.${sync}` as Key)

  const hasRoute = !live || (live.status === 'ready' && !!live.destination)

  // Live, before Start: leave now or wait, from the rain forecast and the drain estimates.
  const advice = (() => {
    if (!live || !forecast?.length || !hasRoute || ride !== 'idle') return null
    const drainOf = (entry: RouteEntry) => Math.max(0, ...floodsOnRoute(entry.candidate, reports).map((f) => clearsIn(f.report, rainNow)))
    const usualWetter = trip.standard.candidate.id !== active.candidate.id && trip.standard.worst > active.worst
    const time = new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' })
    return departureAdvice({
      series: forecast,
      tripMin: active.minutes,
      usualDrainMin: usualWetter ? drainOf(trip.standard) : null,
      extraMin: Math.max(0, active.minutes - trip.standard.minutes),
      ownDrainMin: active.blockers.length + active.cautions.length ? drainOf(active) : null,
      format: (ms) => time.format(ms),
    })
  })()
  const ADVICE_COLOR = { go: 'text-emerald-400', wait: 'text-amber-400', warn: 'text-flare' }
  const matches = trip.presets.filter((p) => `${p.label} ${p.destination.name} ${p.origin.name}`.toLowerCase().includes(query.toLowerCase()))
  const nearby = reports
    .filter((r) => r.depth !== 'clear')
    .map((r) => ({ report: r, metres: metresBetween(position, [r.lat, r.lng]) }))
    .filter((x) => x.metres <= 2000)
    .sort((a, b) => a.metres - b.metres)

  return (
    <div data-bottom-panel className="pb-safe absolute inset-x-0 bottom-0 z-20 border-t border-white/[0.15] bg-void/95 backdrop-blur-md">
      {/* Drag handle: drag or tap to change detent */}
      <motion.button
        onClick={() => setExpanded((e) => !e)}
        onPanEnd={(_, info) => {
          if (info.offset.y < -24) setExpanded(true)
          if (info.offset.y > 24) setExpanded(false)
        }}
        aria-expanded={expanded}
        aria-label={expanded ? t('sheet.collapse') : t('sheet.expand')}
        className="flex h-7 w-full touch-none items-center justify-center"
      >
        <span className="h-1 w-10 bg-white/25" />
      </motion.button>

      <div className="space-y-2 px-3 pb-3">
        {searching && live ? (
          live.renderSearch(() => setSearching(false))
        ) : searching ? (
          /* Destination picker */
          <div className="space-y-2">
            <div className="flex h-12 items-center gap-2 border border-signal bg-slab px-3">
              <Search className="h-5 w-5 shrink-0 text-zinc-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('sheet.search')}
                aria-label={t('sheet.searchLabel')}
                className="h-full min-w-0 flex-1 select-text bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <button onClick={() => setSearching(false)} aria-label={t('sheet.closeSearch')} className="rd-press grid h-9 w-9 place-items-center text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="cc-scroll max-h-[34dvh] overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      trip.setPreset(p.id)
                      setSearching(false)
                      setQuery('')
                    }}
                    className="rd-press flex min-h-[52px] w-full items-center justify-between gap-3 border-t border-white/[0.12] px-1 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-100">{p.destination.name}</span>
                      <span className="block truncate text-xs text-zinc-400">{t('sheet.fromShort', { origin: p.origin.short })}</span>
                    </span>
                    {p.id === preset.id ? <Check className="h-5 w-5 shrink-0 text-flare" /> : <span className="shrink-0 font-mono text-xs text-zinc-400">{routeLengthKm(p.candidates[0])} km</span>}
                  </button>
                </li>
              ))}
              {!matches.length && <li className="border-t border-white/[0.12] px-1 py-3 text-sm text-zinc-400">{t('sheet.noMatch')}</li>}
            </ul>
          </div>
        ) : (
          <>
            {/* Destination: a labelled readout, tap to change */}
            <button onClick={() => setSearching(true)} className="rd-press flex h-12 w-full items-stretch border border-white/[0.15] bg-slab text-left">
              <span className="grid w-12 shrink-0 place-items-center border-r border-white/[0.12] text-zinc-400">
                <Search className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center px-3">
                <span className="tl-label truncate">{t('sheet.from', { origin: live ? live.origin : preset.origin.short })}</span>
                <span className={`tl-title truncate text-base ${live && !live.destination ? 'text-zinc-400' : 'text-zinc-50'}`}>{live ? (live.destination ?? t('live.whereTo')) : preset.destination.short}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end justify-center border-l border-white/[0.12] px-3">
                <span className="tl-label">{t('sheet.eta')}</span>
                <span className="font-mono text-base text-zinc-50">{live?.status === 'routing' ? '…' : hasRoute ? t('sheet.min', { n: active.minutes }) : '–'}</span>
              </span>
            </button>

            {/* Before Start: the usual map route next to ours, so the difference is plain in five seconds */}
            {hasRoute && ride === 'idle' && trip.standard.candidate.id !== active.candidate.id && trip.standard.worst > active.worst && (
              <button onClick={() => setExpanded(true)} className="rd-press grid w-full grid-cols-2 gap-px border border-white/[0.12] bg-white/[0.12] text-left">
                {[
                  { label: t('compare.usual'), entry: trip.standard, ours: false },
                  { label: t('compare.ours'), entry: active, ours: true },
                ].map(({ label, entry, ours }) => {
                  const floods = floodsOnRoute(entry.candidate, reports)
                  const deepest = Math.max(0, ...floods.map((f) => f.report.ai?.depthCm ?? DEPTHS[f.report.depth].cm))
                  const deep = floods.some((f) => DEPTHS[f.report.depth].rank >= 2)
                  return (
                    <span key={label} className={`flex min-w-0 flex-col px-2.5 py-1.5 ${ours ? 'bg-emerald-500/[0.08]' : 'bg-void'}`}>
                      <span className="tl-label truncate">{label}</span>
                      <span className="mt-0.5 flex items-baseline gap-1.5 text-xs">
                        <span className="shrink-0 whitespace-nowrap font-mono text-zinc-50">{t('sheet.min', { n: entry.minutes })}</span>
                        <span className={`truncate ${floods.length ? (deep ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}`}>
                          {floods.length ? t('compare.floods', { n: floods.length, cm: deepest }) : t('compare.dry')}
                        </span>
                      </span>
                    </span>
                  )
                })}
              </button>
            )}

            {/* Route brief before Start: the roads this route takes */}
            {hasRoute && ride === 'idle' && (
              <button onClick={() => setExpanded(true)} className="rd-press flex w-full items-baseline gap-2 text-left text-xs text-zinc-400">
                <span className="shrink-0 font-mono text-zinc-300">{routeLengthKm(active.candidate)} km</span>
                <span className="truncate">
                  {t('sheet.via')} {active.candidate.via}
                </span>
              </button>
            )}

            {/* Live, no destination yet: the city briefing's headline, tap for the whole briefing */}
            {live && briefing && !hasRoute && ride === 'idle' && !expanded && <BriefingCard state={briefing} compact onOpen={() => setExpanded(true)} />}

            {/* Flood-prone spots on the map: say what the blue discs are, every time they show */}
            {spots && spots.shown > 0 && (
              <p className="flex items-start gap-2 text-xs leading-snug text-zinc-100">
                <Drop weight="fill" className="mt-px h-4 w-4 shrink-0 text-water" />
                <span>
                  {t(spots.auto ? 'spots.auto' : 'spots.manual', { n: spots.shown })} <span className="text-zinc-500">{t('spots.predicted')}</span>
                </span>
              </p>
            )}

            {advice && (
              <p className="flex items-start gap-2 text-xs leading-snug text-zinc-100" aria-live="polite">
                <Clock weight="bold" className={`mt-px h-4 w-4 shrink-0 ${ADVICE_COLOR[advice.tone]}`} />
                <span>
                  {t(advice.key, advice.vars)} <span className="text-zinc-500">{t('leave.note')}</span>
                </span>
              </p>
            )}

            {live?.note && <p className={`text-xs ${live.status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>{live.note}</p>}

            {/* Route filters: one hairline-divided row */}
            <div className="rd-noscroll flex divide-x divide-white/[0.12] overflow-x-auto border border-white/[0.15]" role="group" aria-label="Route filters">
              <button
                onClick={trip.toggleDryOnly}
                aria-pressed={dryOnly}
                className={`rd-press flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium ${dryOnly ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-300'}`}
              >
                <ShieldCheck className="h-4 w-4" /> {t('sheet.dryOnly')}
              </button>
              {VEHICLES.map(({ id, Icon }) => (
                <button
                  key={id}
                  onClick={() => trip.setVehicle(id)}
                  aria-pressed={vehicle === id}
                  className={`rd-press flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13px] font-medium ${vehicle === id ? 'bg-signal text-zinc-50' : 'text-zinc-300'}`}
                >
                  <Icon className="h-4 w-4" /> {t(`vehicle.${id}` as Key)}
                </button>
              ))}
            </div>

            {/* Ride and report: two big targets, report is the hazard-red primary */}
            <div className="grid grid-cols-[1fr_1.35fr] gap-2">
              {ride === 'riding' ? (
                <button onClick={onStopRide} className="rd-press flex h-12 items-center justify-center gap-2 border border-white/25 bg-slab text-sm font-semibold text-zinc-50">
                  <Stop className="h-5 w-5" /> {t('sheet.stop')}
                </button>
              ) : (
                <button
                  onClick={hasRoute ? onStartRide : () => setSearching(true)}
                  title={hasRoute ? undefined : t('live.pickFirst')}
                  className={`rd-press flex h-12 items-center justify-center gap-2 text-sm font-semibold ${hasRoute ? 'bg-zinc-100 text-zinc-950' : 'border border-white/25 bg-slab text-zinc-400'}`}
                >
                  <NavigationArrow className="h-5 w-5" /> {t('sheet.start')}
                </button>
              )}
              <button onClick={onReport} className="tl-cta h-12 text-sm">
                <span>
                  <TriangleAlert className="h-5 w-5" /> {t('sheet.report')}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Expanded detent */}
      <AnimatePresence initial={false}>
        {expanded && !searching && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="cc-scroll max-h-[38dvh] space-y-5 overflow-y-auto overflow-x-hidden border-t border-white/[0.12] px-3 py-4">
              {live && briefing && <BriefingCard state={briefing} />}
              {hasRoute && (
                <section>
                  <h3 className="tl-label pb-2">{t('sheet.directions')}</h3>
                  <ol className="tl-grid border border-white/[0.12]">
                    {routeSteps(active.candidate).map((step, i) => (
                      <li key={i} className="flex items-baseline gap-3 px-3 py-2 text-sm">
                        <span className="w-14 shrink-0 font-mono text-xs text-zinc-400">{step.km}</span>
                        <span className="min-w-0 flex-1 truncate text-zinc-100">
                          {t(`turn.${step.turn}` as Key)} {step.street}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {hasRoute && <section>
                <h3 className="tl-label pb-2">{t('sheet.routes')}</h3>
                <ul className="tl-grid border border-white/[0.12]">
                  {entries.map((entry, i) => {
                    const status = passability(entry)
                    const selected = entry.candidate.id === active.candidate.id
                    return (
                      <li key={entry.candidate.id}>
                        {recalculating ? (
                          <div className="cc-shimmer h-[64px]" />
                        ) : (
                          <button
                            onClick={() => trip.chooseRoute(entry.candidate.id)}
                            aria-pressed={selected}
                            className={`rd-press flex min-h-[64px] w-full items-stretch text-left ${selected ? 'bg-white/[0.07]' : ''}`}
                          >
                            <span className="w-1.5 shrink-0" style={{ background: STATUS_COLOR[status] }} />
                            <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                              <span className="flex items-baseline gap-2 text-sm font-medium text-zinc-100">
                                <span className="tl-title text-base">{t('sheet.route', { letter: String.fromCharCode(65 + i) })}</span>
                                <span className="font-mono">{t('sheet.min', { n: entry.minutes })}</span>
                                <span className="tl-label" style={{ color: STATUS_COLOR[status] }}>
                                  {exposure(entry)}
                                </span>
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-zinc-400">
                                {t('sheet.via')} {entry.candidate.via} · <span className="font-mono">{routeLengthKm(entry.candidate)} km</span>
                              </span>
                            </span>
                            {selected && (
                              <span className="grid w-12 shrink-0 place-items-center border-l border-white/[0.12]">
                                <Check className="h-5 w-5 text-zinc-50" />
                              </span>
                            )}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>}

              <section>
                <div className="flex items-baseline justify-between gap-2 pb-2">
                  <h3 className="tl-label">{t('sheet.nearby')}</h3>
                </div>
                <p className={`mb-2 text-xs ${mode === 'live' && sync === 'live' ? 'text-emerald-400' : 'text-zinc-400'}`}>{t(syncKey)}</p>
                {nearby.length === 0 && <p className="text-sm text-zinc-400">{t('sheet.none')}</p>}
                <ul className="tl-grid border border-white/[0.12] empty:hidden">
                  {nearby.map(({ report, metres }) => {
                    const depth = DEPTHS[report.depth]
                    return (
                      <li key={report.id} className="p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-zinc-100">{report.name}</p>
                          <p className="shrink-0 font-mono text-xs text-zinc-400">{ago(report.createdAt)}</p>
                        </div>
                        <p className="mt-1 font-mono text-xs" style={{ color: depth.color }}>
                          ~{report.ai?.depthCm ?? depth.cm} cm · {t(`depth.${report.depth}` as Key)}
                          <span className="text-zinc-400">
                            {' '}
                            · {t('sheet.away', { m: Math.round(metres / 10) * 10 })}
                            {report.ai ? ` · ${t('sheet.verified')}` : ''}
                            {report.confirmations ? ` · ${t('sheet.confirmed', { n: report.confirmations })}` : ''}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">{drainText(t, clearsIn(report, rainNow))}</p>
                        <div className="tl-grid mt-3 grid-cols-2 border border-white/[0.12]">
                          <button onClick={() => onConfirm(report.id)} className="rd-press h-12 text-sm font-medium text-zinc-100">
                            {t('sheet.still')}
                          </button>
                          <button onClick={() => onClear(report.id)} className="rd-press h-12 text-sm font-medium text-emerald-400">
                            {t('sheet.cleared')}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {spots && (
                <section>
                  <h3 className="tl-label pb-2">{t('spots.title')}</h3>
                  <div className="flex items-center gap-3 border border-white/[0.12] p-3">
                    <Drop weight="fill" className="h-5 w-5 shrink-0 text-water" />
                    <p className="min-w-0 flex-1 text-xs leading-snug text-zinc-300">
                      {spots.state.status === 'ready'
                        ? spots.state.spots.length
                          ? t('spots.known', { n: spots.state.spots.length })
                          : t('spots.none')
                        : spots.state.status === 'not-set-up'
                          ? t('spots.notSetUp')
                          : spots.state.status === 'loading'
                            ? t('spots.loading')
                            : t('spots.error')}
                    </p>
                    {spots.state.status === 'ready' && spots.state.spots.length > 0 && !spots.auto && (
                      <button onClick={spots.toggle} aria-pressed={spots.manual} className={`rd-press h-10 shrink-0 px-3 text-sm font-medium ${spots.manual ? 'bg-zinc-100 text-zinc-950' : 'border border-white/25 text-zinc-100'}`}>
                        {spots.manual ? t('spots.hide') : t('spots.show')}
                      </button>
                    )}
                  </div>
                </section>
              )}

              {mode === 'live' && (
                <a href="#/data" className="rd-press flex h-10 items-center justify-between border border-white/[0.15] px-3 text-sm text-zinc-200">
                  {t('sheet.openData')} <span className="font-mono text-xs text-zinc-500">GeoJSON · CSV</span>
                </a>
              )}
              <p className="text-[11px] text-zinc-500">Map data © OpenStreetMap contributors · Map tiles: OpenFreeMap</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
