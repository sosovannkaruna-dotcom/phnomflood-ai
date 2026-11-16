import { ArrowUp, ArrowBendUpLeft, ArrowBendUpRight, Flag, CircleNotch } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT } from '../../i18n'
import type { Trip } from '../hooks/useTrip'
import type { Maneuver } from '../types'
import { nextManeuver, passability, thenManeuver } from '../lib/trip'

const TURN_ICON = { left: ArrowBendUpLeft, right: ArrowBendUpRight, straight: ArrowUp, arrive: Flag }
// Deep shades of the route-status colours, so white text stays readable on them.
const BANNER_BG = { dry: '#065F46', caution: '#92400E', blocked: '#991B1B', recalc: '#78350F' }
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`)

/** Turn-by-turn instruction while navigating: the next turn, big, and the one after it. */
export default function NavBanner({ trip }: { trip: Trip }) {
  const { t } = useT()
  const { active, recalculating, fraction, vehicle } = trip
  const { step, metres: distance } = nextManeuver(active.candidate, fraction)
  const then: Maneuver | null = thenManeuver(active.candidate, fraction)
  const status = passability(active)
  const Turn = TURN_ICON[step.turn]
  const Then = then ? TURN_ICON[then.turn] : null
  const deepest = Math.max(0, ...active.cautions.map((r) => r.ai?.depthCm ?? DEPTHS[r.depth].cm))
  const statusText = status === 'dry' ? t('badge.dry') : status === 'caution' ? t('badge.caution', { cm: deepest }) : t('badge.blocked')

  return (
    <div className="pointer-events-auto overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-colors duration-300" style={{ background: recalculating ? BANNER_BG.recalc : BANNER_BG[status] }} aria-live="polite">
      {recalculating ? (
        <div className="flex min-h-[72px] items-center gap-3 px-3.5 py-3">
          <CircleNotch className="h-8 w-8 shrink-0 animate-spin text-amber-200" />
          <p className="text-base font-semibold leading-snug text-zinc-50">{t('hud.recalc', { vehicle: t(`noun.${vehicle}`) })}</p>
        </div>
      ) : (
        <div className="flex min-h-[72px] items-center gap-3 px-3.5 py-3">
          <Turn className="h-9 w-9 shrink-0 text-zinc-50" />
          <div className="min-w-0 flex-1">
            <p className="tl-title text-3xl leading-none text-zinc-50 tabular-nums">{metres(distance)}</p>
            <p className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-zinc-50">{step.street}</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 bg-black/25 px-3.5 py-1.5">
        {then && Then && !recalculating ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-100">
            <span className="font-semibold">{t('nav.then')}</span>
            <Then className="h-4 w-4 shrink-0" />
            <span className="truncate">{then.street}</span>
          </span>
        ) : (
          <span />
        )}
        <span className="tl-label shrink-0 text-zinc-100">{statusText}</span>
      </div>
    </div>
  )
}
