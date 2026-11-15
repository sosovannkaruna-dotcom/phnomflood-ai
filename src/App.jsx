import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { ArrowCounterClockwise, House } from '@phosphor-icons/react'
import { useFlood } from './store/FloodStore'

// Each view loads on demand; the landing page is the front door.
const Landing = lazy(() => import('./landing/Landing'))
const RiderApp = lazy(() => import('./rider/RiderApp'))

const ROUTES = { '': 'landing', '#/': 'landing', '#/rider': 'rider' }
const HASH = { landing: '#/', rider: '#/rider' }

const readRoute = () => ROUTES[window.location.hash] ?? 'landing'

export default function App() {
  const { resetDemo } = useFlood()
  const [route, setRoute] = useState(readRoute)

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((next) => {
    window.location.hash = HASH[next]
    window.scrollTo(0, 0)
  }, [])

  // Demo shortcut: press 0 for the landing page, 1 for the rider app.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '0') go('landing')
      if (e.key === '1') go('rider')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (route === 'landing') {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-void" />}>
        <Landing onOpenRider={() => go('rider')} />
      </Suspense>
    )
  }

  // Phone: the rider app is the whole screen. Larger screens: shown as a device, for demos.
  return (
    <div className="relative grid h-dvh w-screen place-items-center bg-void">
      <div className="h-full w-full overflow-hidden sm:h-[min(844px,calc(100dvh-32px))] sm:w-[392px] sm:border sm:border-white/15">
        <Suspense fallback={null}>
          <RiderApp onHome={() => go('landing')} />
        </Suspense>
      </div>

      <div className="absolute right-4 top-4 hidden items-center gap-2 lg:flex">
        <button onClick={() => go('landing')} aria-label="Back to the landing page" title="Back to the landing page" className="cc-panel cc-btn grid h-10 w-10 place-items-center text-zinc-400">
          <House weight="bold" className="h-4 w-4" />
        </button>
        <button onClick={resetDemo} aria-label="Reset demo data" title="Reset demo data" className="cc-panel cc-btn grid h-10 w-10 place-items-center text-zinc-400">
          <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
