import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, Layers, LayoutDashboard, Loader2 } from 'lucide-react'
import { DEPTHS } from '../../lib/severity'
import type { MapMode, Place } from '../types'
import type { Trip } from '../hooks/useTrip'
import { VEHICLE_NOUN } from '../hooks/useTrip'
import { nextManeuver, passability } from '../lib/trip'

const TURN_ICON = { left: CornerUpLeft, right: CornerUpRight, straight: ArrowUp, arrive: Flag }
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)

interface Props {
  trip: Trip
  place: Place
  mode: MapMode
  onToggleMode: () => void
  onOpenCity: () => void
}

/** Status header plus the turn-by-turn and hazard banner. */
export default function TopHud({ trip, place, mode, onToggleMode, onOpenCity }: Props) {
  const { active, recalculating, notice, fraction, vehicle } = trip
  const { step, metres: distance } = nextManeuver(active.candidate, fraction)
  const Turn = TURN_ICON[step.turn]
  const status = passability(active)
  const deepest = Math.max(0, ...active.cautions.map((r) => r.ai?.depthCm ?? DEPTHS[r.depth].cm))
  const badge =
    status === 'dry'
      ? { text: 'DRY ROUTE', color: '#10B981' }
      : status === 'caution'
        ? { text: `${deepest}cm PONDING AHEAD`, color: '#F59E0B' }
        : { text: 'DEEP WATER AHEAD', color: '#EF4444' }

  return (
    <div className="pt-safe pointer-events-none absolute inset-x-3 top-3 z-10 space-y-2">
      {/* Status header */}
      <div className="flex items-center justify-between gap-2">
        <div className="cc-panel pointer-events-auto flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-mono text-xs text-zinc-100">
            PhnomFlood <span className="text-zinc-500">//</span> RIDER
          </span>
          <span className="hidden font-mono text-[11px] text-emerald-500 min-[400px]:inline">GPS LOCKED</span>
        </div>
        <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="cc-panel flex h-11 min-w-0 items-center rounded-lg px-3 font-mono text-xs uppercase text-zinc-100" title={`Khan ${place.khan}`}>
            <span className="truncate">{place.sangkat}</span>
          </span>
          <button
            onClick={onToggleMode}
            aria-label={`Map layer: ${mode === 'depth' ? 'flood depth' : 'passability'}. Tap to switch.`}
            title={mode === 'depth' ? 'Showing flood depth' : 'Showing passability'}
            className={`cc-panel rd-press grid h-11 w-11 shrink-0 place-items-center rounded-lg ${mode === 'depth' ? 'text-sky-400' : 'text-emerald-400'}`}
          >
            <Layers className="h-5 w-5" />
          </button>
          <button onClick={onOpenCity} aria-label="Open the city command center" title="City command center" className="cc-panel rd-press grid h-11 w-11 shrink-0 place-items-center rounded-lg text-zinc-300 sm:hidden">
            <LayoutDashboard className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Turn-by-turn + hazard banner */}
      <div className="pointer-events-auto rounded-lg border border-white/10 bg-[#0F1117]/95 px-3 py-3" aria-live="polite">
        {recalculating ? (
          <div className="flex min-h-[52px] items-center gap-3">
            <Loader2 className="h-7 w-7 shrink-0 animate-spin text-amber-500" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold leading-tight text-amber-400">New flood detected ahead! Recalculating dry {VEHICLE_NOUN[vehicle]} route...</p>
              <div className="cc-shimmer h-2 w-2/3 rounded-sm" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-[52px] items-center gap-3">
            <Turn className="h-9 w-9 shrink-0 text-zinc-100" strokeWidth={2.25} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-2xl leading-none text-zinc-100">{metres(distance)}</p>
              <p className="mt-1 truncate text-sm text-zinc-300">
                <span className="font-medium text-zinc-100">{step.street}</span>
                {step.toward && <span> toward {step.toward}</span>}
              </p>
            </div>
            <span className="shrink-0 rounded-sm border px-2 py-1 font-mono text-[11px] font-medium" style={{ color: badge.color, borderColor: `${badge.color}66` }}>
              {badge.text}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="rounded-lg border border-emerald-500/30 bg-[#0F1117]/95 px-3 py-2 text-xs font-medium text-emerald-400"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
