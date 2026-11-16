import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ArrowCounterClockwise, House } from '@phosphor-icons/react'
import { FloodProvider, useFlood } from './store/FloodStore'
import { ModeProvider } from './shared/mode'

// Each view loads on demand; the landing page is the front door. Views are loaded *before* a page
// transition starts, so the browser can photograph the finished new page (no blank frame).
const LOADERS = {
  landing: () => import('./landing/Landing'),
  rider: () => import('./rider/RiderApp'),
  data: () => import('./landing/OpenData'),
}
const loaded = {}
const load = (key) => (loaded[key] ? Promise.resolve(loaded[key]) : LOADERS[key]().then((m) => (loaded[key] = m.default)))

// Two versions of the rider app share one codebase: a scripted demo and the live app.
// #/tour is the demo with the guided one-minute walkthrough playing on top.
const ROUTES = { '': 'landing', '#/': 'landing', '#/demo': 'demo', '#/live': 'live', '#/rider': 'demo', '#/tour': 'tour', '#/data': 'data' }
const HASH = { landing: '#/', demo: '#/demo', live: '#/live', tour: '#/tour', data: '#/data' }
const viewOf = (route) => (route === 'landing' ? 'landing' : route === 'data' ? 'data' : 'rider')

const readRoute = () => ROUTES[window.location.hash] ?? 'landing'

/**
 * How a move between two pages should feel. Landing is the front; the app and the data page sit
 * one level in. "forward" goes in (the hero map grows into the phone), "back" comes out, "lateral"
 * crosses between two pages at the same level.
 */
function directionOf(from, to) {
  const depth = (r) => (r === 'landing' ? 0 : 1)
  return depth(to) > depth(from) ? 'forward' : depth(to) < depth(from) ? 'back' : 'lateral'
}

const canAnimate = () => typeof document !== 'undefined' && 'startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The shared "stage" (hero map <-> phone) morphs only on moves into or out of the app, and only
 * when it is on screen: one scrolled away would fly in from nowhere, and on the data page there is
 * nothing for it to become.
 */
function nameStage(morph) {
  const stage = document.querySelector('[data-stage]')
  if (!stage) return
  const r = stage.getBoundingClientRect()
  stage.style.viewTransitionName = morph && r.bottom > 0 && r.top < window.innerHeight ? 'pf-stage' : 'none'
}

function DeviceControls({ onHome }) {
  const { resetDemo, mode } = useFlood()
  return (
    <div className="pf-controls absolute right-4 top-4 hidden items-center gap-2 lg:flex">
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
  const [, setReady] = useState(0)
  const current = useRef(route)
  current.current = route
  const busy = useRef(false)

  /** Show `next`, with a page transition unless `instant`. */
  const show = useCallback(async (next, { instant = false } = {}) => {
    const from = current.current
    if (next === from) return
    const commit = () => {
      flushSync(() => setRoute(next))
      window.scrollTo(0, 0)
    }
    await load(viewOf(next))
    if (instant || busy.current || !canAnimate()) {
      commit()
      return
    }
    busy.current = true
    const root = document.documentElement
    root.dataset.nav = directionOf(from, next)
    const morph = viewOf(from) === 'rider' || viewOf(next) === 'rider'
    nameStage(morph)
    const transition = document.startViewTransition(() => {
      commit()
      nameStage(morph)
    })
    transition.finished.finally(() => {
      delete root.dataset.nav
      busy.current = false
    })
  }, [])

  // Every hash change goes through `show`: buttons, plain links (#/data) and the browser's back button.
  const instantNext = useRef(false)
  useEffect(() => {
    const onHash = () => {
      const instant = instantNext.current
      instantNext.current = false
      void show(readRoute(), { instant })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [show])

  // First paint: load the view for the page we opened on.
  useEffect(() => {
    void load(viewOf(route)).then(() => setReady((n) => n + 1))
    // Warm the other views in the background, so the first transition starts at once.
    const idle = window.requestIdleCallback ?? ((fn) => window.setTimeout(fn, 1500))
    idle(() => Object.keys(LOADERS).forEach((key) => void load(key)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = useCallback((next) => {
    if (window.location.hash === HASH[next]) return
    window.location.hash = HASH[next]
  }, [])

  // Shortcuts while presenting: 0 landing, 1 demo, 2 live. Keyboard jumps switch instantly:
  // an animation on a repeated shortcut only feels slow.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const next = { 0: 'landing', 1: 'demo', 2: 'live' }[e.key]
      if (!next || HASH[next] === window.location.hash) return
      instantNext.current = true
      window.location.hash = HASH[next]
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const View = loaded[viewOf(route)]
  if (!View) return <div className="min-h-dvh bg-void" />

  if (route === 'landing') return <View onOpen={go} />
  if (route === 'data') return <View onHome={() => go('landing')} />

  // Phone: the rider app is the whole screen. Larger screens: shown as a device, for demos.
  const mode = route === 'tour' ? 'demo' : route
  return (
    <ModeProvider mode={mode}>
      <FloodProvider key={route} mode={mode}>
        <div className="relative grid h-dvh w-screen place-items-center bg-void">
          <div data-stage className="h-full w-full overflow-hidden sm:h-[min(844px,calc(100dvh-32px))] sm:w-[392px] sm:border sm:border-white/15">
            <View key={route} tour={route === 'tour'} onHome={() => go('landing')} />
          </div>
          <DeviceControls onHome={() => go('landing')} />
        </div>
      </FloodProvider>
    </ModeProvider>
  )
}
