import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CloudRain, Radio, RotateCcw, Smartphone, Waves } from 'lucide-react'
import type { LayerId, LayerState, ViewId } from '../types'

const VIEWS: { id: ViewId; label: string; short: string }[] = [
  { id: 'live', label: 'Live Telemetry', short: 'Live' },
  { id: 'forecast', label: '24h Forecast', short: 'Forecast' },
  { id: 'drainage', label: 'Drainage & Basins', short: 'Drainage' },
]

const LAYERS: { id: LayerId; label: string; Icon: typeof Radio }[] = [
  { id: 'radar', label: 'Rainfall radar', Icon: CloudRain },
  { id: 'sensors', label: 'Sensor nodes', Icon: Radio },
  { id: 'zones', label: 'Flood zones', Icon: Waves },
]

const ICT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <time className="hidden font-mono text-xs text-zinc-100 xl:block" dateTime={now.toISOString()}>
      {ICT.format(now)} <span className="text-zinc-400">ICT</span>
    </time>
  )
}

interface Props {
  view: ViewId
  onViewChange: (view: ViewId) => void
  layers: LayerState
  onToggleLayer: (id: LayerId) => void
  onOpenRiderApp: () => void
  onReset: () => void
}

export default function TopBar({ view, onViewChange, layers, onToggleLayer, onOpenRiderApp, onReset }: Props) {
  return (
    <header className="cc-panel absolute inset-x-3 top-3 z-20 flex h-12 items-center justify-between gap-3 rounded-lg px-3 sm:inset-x-4 sm:top-4">
      {/* Identity */}
      <div className="flex min-w-0 items-center gap-3">
        <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden>
          <path d="M10 1 19 10 10 19 1 10Z" fill="none" stroke="#0EA5E9" strokeWidth="1.5" />
          <path d="M5 11c1.700-1.400 3.300-1.400 5 0s3.300 1.400 5 0" fill="none" stroke="#F4F4F5" strokeWidth="1.500" strokeLinecap="round" />
        </svg>
        <span className="hidden text-sm font-semibold text-zinc-100 sm:block">PhnomFlood</span>
        <span className="hidden items-center gap-2 rounded border border-white/[0.08] px-2 py-0.5 font-mono text-[11px] text-zinc-400 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          KH-PNH // LIVE
        </span>
      </div>

      {/* View switcher */}
      <nav aria-label="View" className="flex items-center rounded-md border border-white/[0.08] p-0.5">
        {VIEWS.map(({ id, label, short }) => {
          const active = view === id
          return (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              aria-current={active ? 'page' : undefined}
              className={`relative rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-500 ${
                active ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {active && (
                <motion.span layoutId="cc-view" className="absolute inset-0 rounded bg-white/[0.08]" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
              )}
              <span className="relative hidden lg:inline">{label}</span>
              <span className="relative lg:hidden">{short}</span>
            </button>
          )
        })}
      </nav>

      {/* Clock, layers, app switch */}
      <div className="flex items-center gap-1">
        <Clock />
        <div className="ml-2 hidden items-center gap-1 border-l border-white/[0.08] pl-2 md:flex">
          {LAYERS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onToggleLayer(id)}
              aria-pressed={layers[id]}
              aria-label={label}
              title={label}
              className={`cc-btn grid h-8 w-8 place-items-center rounded ${layers[id] ? 'text-sky-400' : 'text-zinc-500'}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border-l border-white/[0.08] pl-2">
          <button onClick={onReset} aria-label="Reset demo data" title="Reset demo data" className="cc-btn hidden h-8 w-8 place-items-center rounded text-zinc-400 sm:grid">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={onOpenRiderApp} title="Open the Citizen & Rider app" className="cc-btn flex h-8 items-center gap-2 rounded px-2 text-xs font-medium text-zinc-100">
            <Smartphone className="h-4 w-4" />
            <span className="hidden xl:inline">Rider app</span>
          </button>
        </div>
      </div>
    </header>
  )
}
