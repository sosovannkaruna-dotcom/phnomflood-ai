import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, ArrowBendUpLeft as CornerUpLeft, ArrowBendUpRight as CornerUpRight, Flag, CircleNotch as Loader2 } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import type { Place } from '../types'
import type { Trip } from '../hooks/useTrip'
import { VEHICLE_NOUN } from '../hooks/useTrip'
import { nextManeuver, passability } from '../lib/trip'

const TURN_ICON = { left: CornerUpLeft, right: CornerUpRight, straight: ArrowUp, arrive: Flag }
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)

interface Props {
  trip: Trip
  place: Place
  onHome: () => void
}

/** Status strip plus the turn-by-turn and hazard banner. */
export default function TopHud({ trip, place, onHome }: Props) {
  const { active, recalculating, notice, fraction, vehicle } = trip
  const { step, metres: distance } = nextManeuver(active.candidate, fraction)
  const Turn = TURN_ICON[step.turn]
  const status = passability(active)
  const deepest = Math.max(0, ...active.cautions.map((r) => r.ai?.depthCm ?? DEPTHS[r.depth].cm))
  const badge =
    status === 'dry'
      ? { text: 'Dry route', color: '#10B981' }
      : status === 'caution'
        ? { text: `${deepest} cm ahead`, color: '#F59E0B' }
        : { text: 'Deep water ahead', color: '#EF4444' }
  const barColor = recalculating ? '#F59E0B' : badge.color

  return (
    <div className="pt-safe pointer-events-none absolute inset-x-3 top-3 z-10 space-y-2">
      {/* Status strip: one hairline-divided slab */}
      <div className="cc-panel pointer-events-auto flex h-11 items-stretch divide-x divide-white/[0.12]">
        <button onClick={onHome} aria-label="Back to the landing page" title="Back to the landing page" className="cc-btn flex items-center gap-2 px-3">
          <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M10 1 19 10 10 19 1 10Z" fill="none" stroke="#E8301C" strokeWidth="1.75" />
            <path d="M5 11c1.7-1.4 3.3-1.4 5 0s3.3 1.4 5 0" fill="none" stroke="#F4F4F5" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <span className="tl-title text-sm text-zinc-50">Rider</span>
        </button>
        <span className="flex min-w-0 flex-1 items-center px-3" title={`${place.area}, Sangkat ${place.sangkat}, Khan ${place.khan}`}>
          <span className="tl-label truncate text-zinc-200">{place.area}</span>
        </span>
        <span className="hidden items-center px-3 min-[400px]:flex">
          <span className="tl-label text-emerald-400">GPS lock</span>
        </span>
      </div>

      {/* Turn-by-turn + hazard banner: status colour runs down the left edge */}
      <div className="pointer-events-auto flex border border-white/[0.12] bg-void/95" aria-live="polite">
        <span className="w-1.5 shrink-0 transition-colors duration-300" style={{ background: barColor }} />
        <div className="min-w-0 flex-1 px-3 py-3">
          {recalculating ? (
            <div className="flex min-h-[52px] items-center gap-3">
              <Loader2 className="h-7 w-7 shrink-0 animate-spin text-caution" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold leading-tight text-amber-400">New flood detected ahead. Recalculating a dry {VEHICLE_NOUN[vehicle]} route...</p>
                <div className="cc-shimmer h-2 w-2/3" />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[52px] items-center gap-3">
              <Turn className="h-9 w-9 shrink-0 text-zinc-50" />
              <div className="min-w-0 flex-1">
                <p className="tl-title text-3xl leading-none text-zinc-50 tabular-nums">{metres(distance)}</p>
                <p className="mt-1.5 truncate text-sm text-zinc-300">
                  <span className="font-medium text-zinc-100">{step.street}</span>
                  {step.toward && <span> toward {step.toward}</span>}
                </p>
              </div>
              <span className="tl-label shrink-0 border px-2 py-1" style={{ color: badge.color, borderColor: `${badge.color}88` }}>
                {badge.text}
              </span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="pointer-events-auto border border-emerald-500/40 bg-void/95 px-3 py-2 text-xs font-medium text-emerald-400"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
