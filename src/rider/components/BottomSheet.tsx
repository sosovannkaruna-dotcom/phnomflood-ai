import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Motorcycle as Bike, Car, Taxi as CarTaxiFront, Check, MagnifyingGlass as Search, NavigationArrow, ShieldCheck, Stop, Warning as TriangleAlert, X } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT, type Key } from '../../i18n'
import type { AppMode } from '../../shared/mode'
import type { FloodReport, SyncState } from '../../shared/types'
import type { LatLng, RouteEntry, VehicleId } from '../types'
import type { Trip } from '../hooks/useTrip'
import type { RideStatus } from '../hooks/useRide'
import { PRESETS, metresBetween, passability, routeLengthKm } from '../lib/trip'

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
}

/** Two-detent sheet: riding view when collapsed, route comparison and nearby alerts when expanded. */
export default function BottomSheet({ trip, reports, position, mode, sync, ride, onStartRide, onStopRide, onReport, onConfirm, onClear }: Props) {
  const { t } = useT()
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

  const matches = PRESETS.filter((p) => `${p.label} ${p.destination.name} ${p.origin.name}`.toLowerCase().includes(query.toLowerCase()))
  const nearby = reports
    .filter((r) => r.depth !== 'clear')
    .map((r) => ({ report: r, metres: metresBetween(position, [r.lat, r.lng]) }))
    .filter((x) => x.metres <= 2000)
    .sort((a, b) => a.metres - b.metres)

  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 border-t border-white/[0.15] bg-void/95 backdrop-blur-md">
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
        {searching ? (
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
            <button onClick={() => setSearching(true)} className="rd-press flex h-14 w-full items-stretch border border-white/[0.15] bg-slab text-left">
              <span className="grid w-12 shrink-0 place-items-center border-r border-white/[0.12] text-zinc-400">
                <Search className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center px-3">
                <span className="tl-label truncate">{t('sheet.from', { origin: preset.origin.short })}</span>
                <span className="tl-title truncate text-base text-zinc-50">{preset.destination.short}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end justify-center border-l border-white/[0.12] px-3">
                <span className="tl-label">{t('sheet.eta')}</span>
                <span className="font-mono text-base text-zinc-50">{t('sheet.min', { n: active.minutes })}</span>
              </span>
            </button>

            {/* Route filters: one hairline-divided row */}
            <div className="rd-noscroll flex divide-x divide-white/[0.12] overflow-x-auto border border-white/[0.15]" role="group" aria-label="Route filters">
              <button
                onClick={trip.toggleDryOnly}
                aria-pressed={dryOnly}
                className={`rd-press flex h-12 shrink-0 items-center gap-2 px-3 text-sm font-medium ${dryOnly ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-300'}`}
              >
                <ShieldCheck className="h-5 w-5" /> {t('sheet.dryOnly')}
              </button>
              {VEHICLES.map(({ id, Icon }) => (
                <button
                  key={id}
                  onClick={() => trip.setVehicle(id)}
                  aria-pressed={vehicle === id}
                  className={`rd-press flex h-12 shrink-0 items-center gap-2 px-3 text-sm font-medium ${vehicle === id ? 'bg-signal text-zinc-50' : 'text-zinc-300'}`}
                >
                  <Icon className="h-5 w-5" /> {t(`vehicle.${id}` as Key)}
                </button>
              ))}
            </div>

            {/* Ride and report: two big targets, report is the hazard-red primary */}
            <div className="grid grid-cols-[1fr_1.35fr] gap-2">
              {ride === 'riding' ? (
                <button onClick={onStopRide} className="rd-press flex h-14 items-center justify-center gap-2 border border-white/25 bg-slab text-base font-semibold text-zinc-50">
                  <Stop className="h-5 w-5" /> {t('sheet.stop')}
                </button>
              ) : (
                <button onClick={onStartRide} className="rd-press flex h-14 items-center justify-center gap-2 bg-zinc-100 text-base font-semibold text-zinc-950">
                  <NavigationArrow className="h-5 w-5" /> {t('sheet.start')}
                </button>
              )}
              <button onClick={onReport} className="tl-cta h-14 text-base">
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
              <section>
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
              </section>

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
