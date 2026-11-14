import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import {
  KHANS,
  LEVEL_COLOR,
  LEVEL_LABEL,
  RIVER,
  cityMetrics,
  khanById,
  khanState,
  khanStates,
  riverLevel,
  sensorStates,
  trend,
} from '../data/hydrology'
import type { RiskLevel, Ticket, ViewId } from '../types'

const label = 'text-[11px] font-medium uppercase tracking-wider text-zinc-400'

/** Sharp single-path sparkline: the last 12 hours of a metric. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values)
  const span = Math.max(...values) - min || 1
  const points = values.map((v, i) => [(i / (values.length - 1)) * 100, 22 - ((v - min) / span) * 18] as const)
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const [lx, ly] = points[points.length - 1]
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Badge({ level }: { level: RiskLevel }) {
  return (
    <span className="rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-wide" style={{ color: LEVEL_COLOR[level], borderColor: `${LEVEL_COLOR[level]}55` }}>
      {LEVEL_LABEL[level]}
    </span>
  )
}

function Kpi({ name, value, unit, values, color }: { name: string; value: string; unit: string; values: number[]; color: string }) {
  return (
    <div className="space-y-1 p-3">
      <p className={label}>{name}</p>
      <p className="font-mono text-lg leading-none text-zinc-100">
        {value}
        <span className="ml-1 text-xs text-zinc-400">{unit}</span>
      </p>
      <Sparkline values={values} color={color} />
    </div>
  )
}

/** Skeleton with the same geometry as the loaded panel, so nothing shifts. */
function Skeleton() {
  return (
    <div aria-hidden>
      <div className="space-y-3 border-b border-white/[0.08] p-4">
        <div className="cc-shimmer h-3 w-32 rounded-sm" />
        <div className="cc-shimmer h-8 w-28 rounded-sm" />
        <div className="cc-shimmer h-1.5 w-full rounded-sm" />
        <div className="cc-shimmer h-3 w-full rounded-sm" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/[0.08] border-b border-white/[0.08]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`space-y-2 p-3 ${i < 2 ? 'border-b border-white/[0.08]' : ''}`}>
            <div className="cc-shimmer h-3 w-20 rounded-sm" />
            <div className="cc-shimmer h-5 w-16 rounded-sm" />
            <div className="cc-shimmer h-6 w-full rounded-sm" />
          </div>
        ))}
      </div>
      <div className="space-y-3 p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="cc-shimmer h-4 w-full rounded-sm" />
        ))}
      </div>
    </div>
  )
}

interface Props {
  hour: number
  view: ViewId
  loaded: boolean
  selectedKhan: string | null
  onSelectKhan: (id: string | null) => void
  tickets: Ticket[]
  onDispatch: (id: string) => void
  onFocus: (point: { lat: number; lng: number; key: string }) => void
  reportCount: number
  ridersRerouted: number
}

export default function Inspector({ hour, view, loaded, selectedKhan, onSelectKhan, tickets, onDispatch, onFocus, reportCount, ridersRerouted }: Props) {
  const [sending, setSending] = useState<string[]>([])
  if (!loaded) return <Skeleton />

  const khan = khanById(selectedKhan)
  const scope = khan ? khanState(khan, hour) : null
  const city = cityMetrics(hour)
  const river = riverLevel(hour)
  const riverLevelState: RiskLevel = river >= RIVER.flood ? 'critical' : river >= RIVER.alarm ? 'watch' : 'nominal'
  const riverPct = (v: number) => `${Math.min(100, ((v - RIVER.zero) / (RIVER.flood + 0.5 - RIVER.zero)) * 100)}%`

  const rain = scope ? scope.rain : city.rain
  const saturation = scope ? scope.saturation : city.saturation
  const drainFree = scope ? Math.max(0, 100 - scope.drainLoad) : city.drainFree
  const sensorsHot = (h: number) => sensorStates(h).filter((s) => s.level !== 'nominal' && (!khan || s.khanId === khan.id)).length
  const alerts = sensorsHot(hour) + (khan ? 0 : khanStates(hour).filter((k) => k.level === 'critical').length + reportCount)

  const metric = <T,>(forKhan: (h: number) => T, forCity: (h: number) => T) => (khan ? forKhan : forCity)
  const rainTrend = trend(metric((h) => khanState(khan!, h).rain, (h) => cityMetrics(h).rain), hour)
  const satTrend = trend(metric((h) => khanState(khan!, h).saturation, (h) => cityMetrics(h).saturation), hour)
  const drainTrend = trend(metric((h) => Math.max(0, 100 - khanState(khan!, h).drainLoad), (h) => cityMetrics(h).drainFree), hour)
  const alertTrend = trend(sensorsHot, hour)

  const ranked = khanStates(hour)
  const sortedTickets = [...tickets].sort((a, b) => b.urgency - a.urgency)
  const primaryTicket = sortedTickets.find((t) => t.status === 'open')?.id

  function dispatch(id: string) {
    setSending((list) => [...list, id])
    window.setTimeout(() => {
      onDispatch(id)
      setSending((list) => list.filter((x) => x !== id))
    }, 1100)
  }

  return (
    <div className="animate-fade-in">
      {/* Scope */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
        <p className="truncate text-sm font-semibold text-zinc-100">
          {khan ? `Khan ${khan.name}` : 'Phnom Penh Capital'}
          <span className="ml-2 font-mono text-[11px] font-normal text-zinc-400">{khan ? `${khan.lat.toFixed(3)}, ${khan.lng.toFixed(3)}` : `${KHANS.length} Khans`}</span>
        </p>
        {khan && (
          <button onClick={() => onSelectKhan(null)} aria-label="Back to the whole city" title="Back to the whole city" className="cc-btn grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hero: river stage */}
      <div className="space-y-2 border-b border-white/[0.08] p-4">
        <div className="flex items-baseline justify-between">
          <p className={label}>River level · Chaktomuk gauge</p>
          <Badge level={riverLevelState} />
        </div>
        <p className="font-mono text-3xl leading-none text-zinc-100">
          {river.toFixed(2)}
          <span className="ml-1 text-sm text-zinc-400">m</span>
        </p>
        <div className="relative h-1.5 rounded-sm bg-white/[0.08]">
          <div className="absolute inset-y-0 left-0 rounded-sm bg-sky-500 transition-[width] duration-300" style={{ width: riverPct(river) }} />
          <span className="absolute -inset-y-1 w-px bg-amber-500" style={{ left: riverPct(RIVER.alarm) }} />
          <span className="absolute -inset-y-1 w-px bg-red-500" style={{ left: riverPct(RIVER.flood) }} />
        </div>
        <p className="flex justify-between font-mono text-[11px] text-zinc-400">
          <span>{(RIVER.alarm - river).toFixed(2)} m below alarm</span>
          <span>
            <span className="text-amber-500">{RIVER.alarm.toFixed(2)}</span> alarm · <span className="text-red-500">{RIVER.flood.toFixed(2)}</span> flood
          </span>
        </p>
      </div>

      {/* 2 × 2 KPI grid */}
      <div className="grid grid-cols-2 border-b border-white/[0.08] [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-white/[0.08] [&>*:nth-child(odd)]:border-r [&>*:nth-child(odd)]:border-white/[0.08]">
        <Kpi name="Rainfall intensity" value={rain.toFixed(1)} unit="mm/h" values={rainTrend} color="#0EA5E9" />
        <Kpi name="Soil saturation" value={saturation.toFixed(0)} unit="%" values={satTrend} color="#0EA5E9" />
        <Kpi name="Drainage capacity" value={drainFree.toFixed(0)} unit="% free" values={drainTrend} color={drainFree < 15 ? '#EF4444' : drainFree < 35 ? '#F59E0B' : '#10B981'} />
        <Kpi name="Active alerts" value={String(alerts)} unit={alerts === 1 ? 'alert' : 'alerts'} values={alertTrend} color={alerts ? '#F59E0B' : '#10B981'} />
      </div>

      {view === 'drainage' ? (
        /* Drain maintenance tickets (shared with the rider app's reports) */
        <div>
          <p className={`${label} px-4 pb-2 pt-3`}>Storm-drain tickets · by AI urgency</p>
          <ul>
            {sortedTickets.map((t) => {
              const busy = sending.includes(t.id)
              const done = t.status === 'dispatched'
              const level: RiskLevel = done ? 'nominal' : t.urgency >= 85 ? 'critical' : 'watch'
              return (
                <li key={t.id} className="border-t border-white/[0.08]">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onFocus({ lat: t.lat, lng: t.lng, key: t.id })}
                    onKeyDown={(e) => e.key === 'Enter' && onFocus({ lat: t.lat, lng: t.lng, key: t.id })}
                    className="cc-btn block w-full cursor-pointer space-y-1 px-4 py-3 text-left"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-medium text-zinc-100">{t.name}</p>
                      <span className="font-mono text-sm" style={{ color: LEVEL_COLOR[level] }}>
                        {t.urgency}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Khan {t.khan} · Sangkat {t.sangkat} · <span className="font-mono">{t.frequency}x</span> this month
                    </p>
                    <p className="text-[11px] leading-snug text-zinc-300">{t.diagnosis}</p>
                    <div className="pt-1">
                      {done ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                          <Check className="h-4 w-4" /> Crew dispatched · {t.crew}
                        </span>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            dispatch(t.id)
                          }}
                          className={`flex items-center gap-2 rounded px-2 py-1 text-[11px] font-medium transition active:scale-[0.98] disabled:cursor-wait ${
                            t.id === primaryTicket ? 'bg-sky-500 text-zinc-950 hover:bg-sky-400' : 'border border-white/[0.12] text-zinc-100 hover:bg-white/[0.06]'
                          }`}
                        >
                          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                          {busy ? 'Contacting crew...' : 'Dispatch Pump / Cleanup Crew'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        /* Khans ranked by runoff risk */
        <div>
          <p className={`${label} px-4 pb-2 pt-3`}>Khans by runoff risk</p>
          <ul>
            {ranked.map((k) => (
              <li key={k.id}>
                <button
                  onClick={() => onSelectKhan(k.id === selectedKhan ? null : k.id)}
                  aria-pressed={k.id === selectedKhan}
                  className={`cc-btn grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-white/[0.08] px-4 py-2 text-left ${
                    k.id === selectedKhan ? 'bg-white/[0.06]' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-zinc-100">{k.name}</span>
                    <span className="block text-[11px] text-zinc-400">{k.drainStatus}</span>
                  </span>
                  <span className="font-mono text-xs text-zinc-100">{k.risk.toFixed(0)}</span>
                  <Badge level={k.level} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-white/[0.08] px-4 py-3 text-[11px] leading-relaxed text-zinc-400">
        <span className="font-mono text-zinc-100">{ridersRerouted.toLocaleString('en-US')}</span> riders rerouted today · Simulated telemetry. Base data: OpenStreetMap, NASA SRTM, Open-Meteo.
      </p>
    </div>
  )
}
