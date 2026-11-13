import { useState } from 'react'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'

/** Compact floating trip pill at the top of the map. Tap to switch preset trips. */
export default function RoutePlanner({ presets, presetId, onPresetChange }) {
  const [open, setOpen] = useState(false)
  const preset = presets.find((p) => p.id === presetId) ?? presets[0]

  return (
    <div className="pointer-events-auto relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 text-left shadow-float"
      >
        <span className="h-2 w-2 shrink-0 rounded-full border-2 border-ink" />
        <span className="truncate text-[13px] font-semibold text-ink">{preset.origin.short}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="h-2 w-2 shrink-0 rounded-[2px] bg-ink" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{preset.destination.short}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 animate-fade-in overflow-hidden rounded-xl border border-hairline bg-white shadow-float">
          {presets.map((p) => (
            <li key={p.id} className="border-b border-hairline last:border-0">
              <button
                onClick={() => {
                  onPresetChange(p.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-canvas"
              >
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-ink">{p.label}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {p.origin.name} to {p.destination.name}
                  </span>
                </span>
                {p.id === presetId && <Check className="h-4 w-4 shrink-0 text-ink" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
