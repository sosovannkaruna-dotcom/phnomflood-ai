import { useState } from 'react'
import { ArrowRight, Bike, Car, CarTaxiFront, Check, ChevronDown } from 'lucide-react'
import { VEHICLES, VEHICLE_ORDER } from '../../lib/severity'

const VEHICLE_ICON = { moto: Bike, tuktuk: CarTaxiFront, car: Car }

/** Compact floating trip pill at the top of the map. Tap to switch preset trips. */
export default function RoutePlanner({ presets, presetId, onPresetChange }) {
  const [open, setOpen] = useState(false)
  const preset = presets.find((p) => p.id === presetId) ?? presets[0]

  return (
    <div className="pointer-events-auto relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Change trip"
        className="flex w-full items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-left shadow-sm"
      >
        <span className="h-2 w-2 shrink-0 rounded-full border-2 border-ink" />
        <span className="truncate text-compact font-semibold text-ink">{preset.origin.short}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
        <span className="h-2 w-2 shrink-0 rounded-sm bg-ink" />
        <span className="min-w-0 flex-1 truncate text-compact font-semibold text-ink">{preset.destination.short}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 animate-fade-in overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
          {presets.map((p) => (
            <li key={p.id} className="border-b border-hairline last:border-0">
              <button
                onClick={() => {
                  onPresetChange(p.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-canvas"
              >
                <span className="min-w-0">
                  <span className="block truncate text-compact font-medium text-ink">{p.label}</span>
                  <span className="block truncate text-2xs text-muted">
                    {p.origin.name} to {p.destination.name}
                  </span>
                </span>
                {p.id === presetId && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Vehicle selector. The active option shows its name; the indicator slides between options. */
export function VehicleSwitch({ vehicleId, onChange }) {
  const index = VEHICLE_ORDER.indexOf(vehicleId)
  return (
    <div
      role="radiogroup"
      aria-label="Vehicle"
      className="pointer-events-auto relative grid grid-cols-3 rounded-lg border border-hairline bg-white p-0.5 shadow-sm"
    >
      <span
        aria-hidden
        className="absolute bottom-0.5 left-0.5 top-0.5 w-[calc((100%-4px)/3)] rounded-md bg-accent transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {VEHICLE_ORDER.map((id) => {
        const Icon = VEHICLE_ICON[id]
        const active = id === vehicleId
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            aria-label={VEHICLES[id].label}
            title={VEHICLES[id].label}
            onClick={() => onChange(id)}
            className={`relative flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-2xs font-semibold transition-colors duration-200 ${
              active ? 'text-white' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{VEHICLES[id].short}</span>
          </button>
        )
      })}
    </div>
  )
}
