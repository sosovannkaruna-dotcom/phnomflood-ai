import { Droplet, LayoutDashboard, RotateCcw, Smartphone } from 'lucide-react'
import { useFlood } from '../store/FloodStore'

const MODES = [
  { id: 'citizen', label: 'Citizen & Rider App', Icon: Smartphone },
  { id: 'dashboard', label: 'Municipal Command Center', Icon: LayoutDashboard },
]

export default function NavBar({ mode, onModeChange }) {
  const { resetDemo } = useFlood()

  return (
    <header className="relative z-[1100] grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-hairline bg-white px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink">
          <Droplet className="h-4 w-4 text-white" />
        </span>
        <span className="hidden truncate text-[14px] font-semibold tracking-tight text-ink md:block">PhnomFlood AI</span>
      </div>

      {/* Mode switcher */}
      <div role="tablist" aria-label="Platform view" className="flex items-center rounded-lg bg-slate-100 p-0.5">
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition sm:px-4 ${
                active
                  ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,42,0.12)]'
                  : 'font-medium text-muted hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          )
        })}
      </div>

      <button
        onClick={resetDemo}
        title="Clear submitted reports and restore the starting demo data"
        className="flex items-center gap-1.5 justify-self-end rounded-md border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-muted transition hover:border-slate-300 hover:text-ink"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Reset demo</span>
      </button>
    </header>
  )
}
