import { useState } from 'react'
import { ChevronUp, Loader2 } from 'lucide-react'
import { DEPTHS, VEHICLES } from '../../lib/severity'

/** Text for the two route rows. Also reused for the map tooltips. */
export function describePlan(plan, safeEntry, vehicleId) {
  const vehicle = VEHICLES[vehicleId]
  const { standard } = plan
  const blocker = standard.blockers[0]

  const standardText = blocker
    ? `Blocked by ${DEPTHS[blocker.depth].label} Flood on ${blocker.area}`
    : standard.cautions.length
      ? `Passable for ${vehicle.label} · ${standard.cautions.length} caution zone${standard.cautions.length > 1 ? 's' : ''}`
      : 'Clear for your vehicle'

  const extra = safeEntry.minutes - standard.minutes
  const surface = safeEntry.blockers.length
    ? 'Least-flooded option'
    : safeEntry.cautions.length
      ? `${safeEntry.cautions.length} caution zone${safeEntry.cautions.length > 1 ? 's' : ''}`
      : 'Dry Streets'
  const safeText = `${extra > 0 ? `+${extra} mins` : 'Same ETA'} • ${surface}`

  return { standardText, safeText, blocked: Boolean(blocker) }
}

/**
 * Bottom sheet. Collapsed it is a two-line route summary so the map keeps the
 * screen; tap the handle to compare the routes in detail.
 */
export default function RouteSummary({ plan, safeEntry, vehicleId, recalculating }) {
  const [expanded, setExpanded] = useState(false)
  const { standardText, safeText, blocked } = describePlan(plan, safeEntry, vehicleId)
  const sameRoute = safeEntry.candidate.id === plan.standard.candidate.id
  const noDryRoute = safeEntry.blockers.length > 0
  const statusColor = noDryRoute ? '#B45309' : '#047857'

  return (
    <div className="pointer-events-auto rounded-t-2xl border-t border-hairline bg-white px-4 pb-3 shadow-sheet">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse route details' : 'Expand route details'}
        className="flex w-full justify-center pb-2 pt-2"
      >
        <span className="h-1 w-9 rounded-full bg-slate-300" />
      </button>

      {/* Recommended route */}
      <div className="flex items-center gap-3">
        <span className="h-9 w-1 shrink-0 rounded-full transition-colors duration-500" style={{ background: noDryRoute ? '#F59E0B' : '#10B981' }} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            {sameRoute ? 'Standard Route is Safe' : 'PhnomFlood Safe Route'}
            {recalculating && <Loader2 className="h-4 w-4 animate-spin text-accent" />}
          </p>
          <p className="truncate text-xs font-medium" style={{ color: statusColor }}>
            {recalculating ? 'Recalculating around new flood…' : sameRoute ? standardText : safeText}
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold text-ink">{safeEntry.minutes} min</p>
        <ChevronUp className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {!sameRoute && (
        <p className={`mt-2 truncate text-xs ${blocked ? 'font-medium text-[#B91C1C]' : 'text-muted'}`}>
          Standard Route: {standardText}
        </p>
      )}

      {expanded && (
        <dl className="mt-3 animate-fade-in space-y-2 border-t border-hairline pt-3 text-xs">
          <Detail term="Safe route via" value={safeEntry.candidate.via} />
          <Detail term="Distance" value={`${(safeEntry.candidate.distanceM / 1000).toFixed(1)} km`} />
          {!sameRoute && <Detail term="Standard route" value={`${plan.standard.minutes} min · via ${plan.standard.candidate.via}`} />}
          <div className="flex items-center gap-3 pt-1 text-2xs text-muted">
            {['clear', 'ankle', 'knee'].map((id) => (
              <span key={id} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: DEPTHS[id].color }} />
                {DEPTHS[id].short}
              </span>
            ))}
          </div>
        </dl>
      )}
    </div>
  )
}

function Detail({ term, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{term}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  )
}
