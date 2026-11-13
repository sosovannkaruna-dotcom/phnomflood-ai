import { Bike, Car, CarTaxiFront, Loader2 } from 'lucide-react'
import { DEPTHS, VEHICLES, VEHICLE_ORDER } from '../../lib/severity'

const VEHICLE_ICON = { moto: Bike, tuktuk: CarTaxiFront, car: Car }

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

/** White bottom sheet: vehicle selector + standard vs safe route comparison. */
export default function RouteSummary({ plan, safeEntry, vehicleId, onVehicleChange, recalculating }) {
  const { standardText, safeText, blocked } = describePlan(plan, safeEntry, vehicleId)
  const sameRoute = safeEntry.candidate.id === plan.standard.candidate.id
  const noDryRoute = safeEntry.blockers.length > 0
  const accent = noDryRoute ? '#F59E0B' : '#10B981'

  return (
    <div className="pointer-events-auto rounded-t-2xl bg-white px-4 pb-2 pt-2 shadow-sheet">
      <span className="mx-auto mb-2.5 block h-1 w-9 rounded-full bg-slate-300" />

      {/* Vehicle selector */}
      <div role="radiogroup" aria-label="Vehicle" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-0.5">
        {VEHICLE_ORDER.map((id) => {
          const Icon = VEHICLE_ICON[id]
          const active = id === vehicleId
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => onVehicleChange(id)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-1 py-1.5 text-[11px] font-medium leading-tight transition ${
                active ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,42,0.12)]' : 'text-muted'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {VEHICLES[id].label}
            </button>
          )
        })}
      </div>

      {/* Recommended route */}
      <div className="flex items-center gap-3 border-b border-hairline py-3">
        <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: accent }} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
            {recalculating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
            {sameRoute ? 'Standard Route is Safe' : 'PhnomFlood Safe Route'}
          </p>
          <p className="mt-0.5 text-[12px] font-medium" style={{ color: noDryRoute ? '#92400E' : '#047857' }}>
            {recalculating ? 'Recalculating around new flood…' : sameRoute ? standardText : safeText}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted">via {safeEntry.candidate.via}</p>
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="text-[18px] font-semibold tabular-nums text-ink">{safeEntry.minutes} min</p>
          <p className="text-[11px] tabular-nums text-muted">{(safeEntry.candidate.distanceM / 1000).toFixed(1)} km</p>
        </div>
      </div>

      {/* Standard route */}
      {!sameRoute && (
        <div className="flex items-center gap-3 py-2.5">
          <span className="h-7 w-1 shrink-0 rounded-full border-l-[3px] border-dashed" style={{ borderColor: blocked ? '#EF4444' : '#94A3B8' }} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[13px] font-medium text-ink">Standard Route</p>
            <p className={`mt-0.5 text-[12px] ${blocked ? 'font-medium text-[#B91C1C]' : 'text-muted'}`}>{standardText}</p>
          </div>
          <p className={`shrink-0 text-[13px] tabular-nums ${blocked ? 'text-slate-400 line-through' : 'text-ink'}`}>
            {plan.standard.minutes} min
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-hairline pt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-2.5">
          {['clear', 'ankle', 'knee'].map((id) => (
            <span key={id} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: DEPTHS[id].color }} />
              {DEPTHS[id].short}
            </span>
          ))}
        </span>
        <span>© OpenStreetMap contributors</span>
      </div>
    </div>
  )
}
