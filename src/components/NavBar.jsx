import { Droplet, LayoutDashboard, RotateCcw, Smartphone } from 'lucide-react'
import { useFlood } from '../store/FloodStore'

const MODES = [
  { id: 'citizen', label: 'Citizen & Rider App', short: 'Rider App', Icon: Smartphone },
  { id: 'dashboard', label: 'Municipal Command Center', short: 'City Portal', Icon: LayoutDashboard },
]

export default function NavBar({ mode, onModeChange }) {
  const { resetDemo } = useFlood()
  const index = MODES.findIndex((m) => m.id === mode)

  return (
    <header className="relative z-[1100] grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-hairline bg-white px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink">
          <Droplet className="h-4 w-4 text-white" />
        </span>
        <span className="hidden truncate text-sm font-semibold text-ink md:block">PhnomFlood AI</span>
      </div>

      {/* Mode switcher: the indicator slides between the two views */}
      <div role="tablist" aria-label="Platform view" className="relative grid grid-cols-2 rounded-lg bg-slate-100 p-0.5">
        <span
          aria-hidden
          className="absolute bottom-0.5 left-0.5 top-0.5 w-[calc(50%-2px)] rounded-md border border-hairline bg-white shadow-sm transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {MODES.map(({ id, label, short, Icon }) => {
          const active = mode === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onModeChange(id)}
              className={`relative flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-compact transition-colors duration-200 ${
                active ? 'font-semibold text-ink' : 'font-medium text-muted hover:text-ink'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : ''}`} />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={resetDemo}
        aria-label="Reset demo data"
        title="Clear submitted reports and restore the starting demo data"
        className="flex items-center gap-2 justify-self-end rounded-md px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-slate-100 hover:text-ink"
      >
        <RotateCcw className="h-4 w-4" />
        <span className="hidden md:inline">Reset demo</span>
      </button>
    </header>
  )
}
