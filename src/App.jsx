import { Suspense, lazy, useEffect, useState } from 'react'
import { LayoutDashboard, RotateCcw } from 'lucide-react'
import { useFlood } from './store/FloodStore'

// Both views share one design system and one map engine; each loads on demand.
const RiderApp = lazy(() => import('./rider/RiderApp'))
const CommandCenter = lazy(() => import('./command/CommandCenter'))

const MODE_KEY = 'phnomflood.mode'

export default function App() {
  const { resetDemo } = useFlood()
  const [mode, setMode] = useState(() => (window.localStorage.getItem(MODE_KEY) === 'dashboard' ? 'dashboard' : 'rider'))

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  // Demo shortcut: press 1 or 2 to switch views while recording.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '1') setMode('rider')
      if (e.key === '2') setMode('dashboard')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (mode === 'dashboard') {
    return (
      <div className="h-dvh w-screen bg-[#090A0F]">
        <Suspense fallback={null}>
          <CommandCenter onOpenRiderApp={() => setMode('rider')} />
        </Suspense>
      </div>
    )
  }

  // Phone: the rider app is the whole screen. Larger screens: shown as a device, for demos.
  return (
    <div className="relative grid h-dvh w-screen place-items-center bg-[#050608]">
      <div className="h-full w-full overflow-hidden sm:h-[min(844px,calc(100dvh-32px))] sm:w-[392px] sm:rounded-[36px] sm:border sm:border-white/10">
        <Suspense fallback={null}>
          <RiderApp onOpenCity={() => setMode('dashboard')} />
        </Suspense>
      </div>

      <div className="absolute right-4 top-4 hidden items-center gap-2 lg:flex">
        <button onClick={resetDemo} aria-label="Reset demo data" title="Reset demo data" className="cc-panel cc-btn grid h-10 w-10 place-items-center rounded-lg text-zinc-400">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button onClick={() => setMode('dashboard')} className="cc-panel cc-btn flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-zinc-100">
          <LayoutDashboard className="h-4 w-4" />
          City command center
        </button>
      </div>
    </div>
  )
}
