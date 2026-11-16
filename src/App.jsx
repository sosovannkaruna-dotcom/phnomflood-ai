import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { ArrowCounterClockwise, House } from '@phosphor-icons/react'
import { FloodProvider, useFlood } from './store/FloodStore'
import { ModeProvider } from './shared/mode'

// Each view loads on demand; the landing page is the front door.
const Landing = lazy(() => import('./landing/Landing'))
const RiderApp = lazy(() => import('./rider/RiderApp'))

// Two versions of the rider app share one codebase: a scripted demo and the live app.
// #/tour is the demo with the guided one-minute walkthrough playing on top.
const ROUTES = { '': 'landing', '#/': 'landing', '#/demo': 'demo', '#/live': 'live', '#/rider': 'demo', '#/tour': 'tour' }
const HASH = { landing: '#/', demo: '#/demo', live: '#/live', tour: '#/tour' }

const readRoute = () => ROUTES[window.location.hash] ?? 'landing'

function DeviceControls({ onHome }) {
  const { resetDemo, mode } = useFlood()
  return (
    <div className="absolute right-4 top-4 hidden items-center gap-2 lg:flex">
      <button onClick={onHome} aria-label="Back to the landing page" title="Back to the landing page" className="cc-panel cc-btn grid h-10 w-10 place-items-center text-zinc-400">
        <House weight="bold" className="h-4 w-4" />
      </button>
      <button onClick={resetDemo} aria-label={mode === 'demo' ? 'Reset demo data' : 'Clear reports on this device'} title={mode === 'demo' ? 'Reset demo data' : 'Clear reports on this device'} className="cc-panel cc-btn grid h-10 w-10 place-items-center text-zinc-400">
        <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function App() {
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

  // Shortcuts while presenting: 0 landing, 1 demo, 2 live.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '0') go('landing')
      if (e.key === '1') go('demo')
      if (e.key === '2') go('live')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (route === 'landing') {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-void" />}>
        <Landing onOpen={go} />
      </Suspense>
    )
  }

  // Phone: the rider app is the whole screen. Larger screens: shown as a device, for demos.
  const mode = route === 'tour' ? 'demo' : route
  return (
    <ModeProvider mode={mode}>
      <FloodProvider key={route} mode={mode}>
        <div className="relative grid h-dvh w-screen place-items-center bg-void">
          <div className="h-full w-full overflow-hidden sm:h-[min(844px,calc(100dvh-32px))] sm:w-[392px] sm:border sm:border-white/15">
            <Suspense fallback={null}>
              <RiderApp key={route} tour={route === 'tour'} onHome={() => go('landing')} />
            </Suspense>
          </div>
          <DeviceControls onHome={() => go('landing')} />
        </div>
      </FloodProvider>
    </ModeProvider>
  )
}
