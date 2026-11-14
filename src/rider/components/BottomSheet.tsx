import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bike, Car, CarTaxiFront, Check, Search, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import { DEPTHS } from '../../lib/severity'
import type { FloodReport } from '../../command/types'
import type { LatLng, VehicleId } from '../types'
import type { Trip } from '../hooks/useTrip'
import { PRESETS, exposure, metresBetween, passability, routeLengthKm } from '../lib/trip'

const VEHICLES: { id: VehicleId; label: string; Icon: typeof Bike }[] = [
  { id: 'moto', label: 'Motorbike', Icon: Bike },
  { id: 'tuktuk', label: 'Tuk-Tuk', Icon: CarTaxiFront },
  { id: 'car', label: 'Car', Icon: Car },
]
const STATUS_COLOR = { dry: '#10B981', caution: '#F59E0B', blocked: '#EF4444' }
const label = 'text-[11px] font-medium uppercase tracking-wider text-zinc-400'

function ago(timestamp: number) {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
  return minutes < 1 ? 'now' : minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`
}

interface Props {
  trip: Trip
  reports: FloodReport[]
  position: LatLng
  onReport: () => void
  onConfirm: (id: string) => void
  onClear: (id: string) => void
}

/** Two-detent sheet: riding view when collapsed, route comparison and nearby alerts when expanded. */
export default function BottomSheet({ trip, reports, position, onReport, onConfirm, onClear }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const { preset, entries, active, vehicle, dryOnly, recalculating } = trip

  const matches = PRESETS.filter((p) => `${p.label} ${p.destination.name} ${p.origin.name}`.toLowerCase().includes(query.toLowerCase()))
  const nearby = reports
    .filter((r) => r.depth !== 'clear')
    .map((r) => ({ report: r, metres: metresBetween(position, [r.lat, r.lng]) }))
    .filter((x) => x.metres <= 2000)
    .sort((a, b) => a.metres - b.metres)

  return (
    <div className="pb-safe absolute inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-white/[0.08] bg-[#0F1117]/[0.88] backdrop-blur-xl" style={{ boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.06)' }}>
      {/* Drag handle: drag or tap to change detent */}
      <motion.button
        onClick={() => setExpanded((e) => !e)}
        onPanEnd={(_, info) => {
          if (info.offset.y < -24) setExpanded(true)
          if (info.offset.y > 24) setExpanded(false)
        }}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse sheet' : 'Expand sheet for routes and nearby alerts'}
        className="flex h-7 w-full touch-none items-center justify-center"
      >
        <span className="h-1 w-9 rounded-full bg-white/20" />
      </motion.button>

      <div className="space-y-3 px-3 pb-3">
        {searching ? (
          /* Destination picker */
          <div className="space-y-2">
            <div className="flex h-12 items-center gap-2 rounded-lg border border-sky-500/60 bg-black/30 px-3">
              <Search className="h-5 w-5 shrink-0 text-zinc-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where to? Avoid flooded streets..."
                aria-label="Destination"
                className="h-full min-w-0 flex-1 select-text bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <button onClick={() => setSearching(false)} aria-label="Close search" className="rd-press grid h-9 w-9 place-items-center rounded text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul>
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      trip.setPreset(p.id)
                      setSearching(false)
                      setQuery('')
                    }}
                    className="rd-press flex min-h-[52px] w-full items-center justify-between gap-3 border-t border-white/[0.08] px-1 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-100">{p.destination.name}</span>
                      <span className="block truncate text-xs text-zinc-400">from {p.origin.name}</span>
                    </span>
                    {p.id === preset.id && <Check className="h-5 w-5 shrink-0 text-sky-400" />}
                  </button>
                </li>
              ))}
              {!matches.length && <li className="border-t border-white/[0.08] px-1 py-3 text-sm text-zinc-400">No saved trip matches. Try “market” or “RUPP”.</li>}
            </ul>
          </div>
        ) : (
          <>
            <button onClick={() => setSearching(true)} className="rd-press flex h-12 w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-left">
              <Search className="h-5 w-5 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium text-zinc-100">{preset.destination.short}</span>
                <span className="text-zinc-500"> · Where to? Avoid flooded streets...</span>
              </span>
              <span className="shrink-0 font-mono text-sm text-zinc-100">{active.minutes} min</span>
            </button>

            {/* Quick filters */}
            <div className="rd-noscroll flex gap-2 overflow-x-auto" role="group" aria-label="Route filters">
              <button
                onClick={trip.toggleDryOnly}
                aria-pressed={dryOnly}
                className={`rd-press flex h-12 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                  dryOnly ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.08] text-zinc-300'
                }`}
              >
                <ShieldCheck className="h-5 w-5" /> Dry Routes Only
              </button>
              {VEHICLES.map(({ id, label: name, Icon }) => (
                <button
                  key={id}
                  onClick={() => trip.setVehicle(id)}
                  aria-pressed={vehicle === id}
                  className={`rd-press flex h-12 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
                    vehicle === id ? 'border-sky-500/60 bg-sky-500/10 text-sky-400' : 'border-white/[0.08] text-zinc-300'
                  }`}
                >
                  <Icon className="h-5 w-5" /> {name}
                </button>
              ))}
            </div>

            {/* Primary action */}
            <button
              onClick={onReport}
              className="rd-press flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 text-base font-semibold tracking-wide text-amber-400 hover:bg-amber-500/25"
            >
              <TriangleAlert className="h-5 w-5" /> REPORT FLOOD
            </button>
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
            <div className="cc-scroll max-h-[38dvh] space-y-4 overflow-y-auto border-t border-white/[0.08] px-3 py-3">
              <section>
                <p className={`${label} pb-2`}>Routes · time vs flood exposure</p>
                <ul className="space-y-2">
                  {entries.map((entry, i) => {
                    const status = passability(entry)
                    const selected = entry.candidate.id === active.candidate.id
                    return (
                      <li key={entry.candidate.id}>
                        {recalculating ? (
                          <div className="cc-shimmer h-[60px] rounded-lg" />
                        ) : (
                          <button
                            onClick={() => trip.chooseRoute(entry.candidate.id)}
                            aria-pressed={selected}
                            className={`rd-press flex min-h-[60px] w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${
                              selected ? 'border-white/25 bg-white/[0.06]' : 'border-white/[0.08]'
                            }`}
                          >
                            <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: STATUS_COLOR[status] }} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-zinc-100">
                                Route {String.fromCharCode(65 + i)}: <span className="font-mono">{entry.minutes} min</span> •{' '}
                                <span style={{ color: STATUS_COLOR[status] }}>{exposure(entry)}</span>
                              </span>
                              <span className="block truncate text-xs text-zinc-400">
                                via {entry.candidate.via} · <span className="font-mono">{routeLengthKm(entry.candidate)} km</span>
                              </span>
                            </span>
                            {selected && <Check className="h-5 w-5 shrink-0 text-zinc-100" />}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section>
                <p className={`${label} pb-2`}>Rider reports within 2 km</p>
                {nearby.length === 0 && <p className="text-sm text-zinc-400">No flood reports near you.</p>}
                <ul className="space-y-2">
                  {nearby.map(({ report, metres }) => {
                    const depth = DEPTHS[report.depth]
                    return (
                      <li key={report.id} className="rounded-lg border border-white/[0.08] p-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-zinc-100">{report.name}</p>
                          <p className="shrink-0 font-mono text-xs text-zinc-400">{ago(report.createdAt)}</p>
                        </div>
                        <p className="mt-1 font-mono text-xs" style={{ color: depth.color }}>
                          ~{report.ai?.depthCm ?? depth.cm} cm · {depth.label}
                          <span className="text-zinc-400">
                            {' '}
                            · {Math.round(metres / 10) * 10} m away{report.ai ? ' · verified' : ''}
                            {report.confirmations ? ` · ${report.confirmations} confirmed` : ''}
                          </span>
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button onClick={() => onConfirm(report.id)} className="rd-press h-12 rounded-lg border border-white/[0.12] text-sm font-medium text-zinc-100">
                            Still Flooded
                          </button>
                          <button onClick={() => onClear(report.id)} className="rd-press h-12 rounded-lg border border-emerald-500/40 text-sm font-medium text-emerald-400">
                            Cleared
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
