import { Suspense, lazy, useEffect, useState } from 'react'
import NavBar from './components/NavBar'
import CitizenView from './components/citizen/CitizenView'

// The map engine is large, so it loads only when the city view is opened.
const CommandCenter = lazy(() => import('./command/CommandCenter'))

const MODE_KEY = 'phnomflood.mode'

export default function App() {
  const [mode, setMode] = useState(() => window.localStorage.getItem(MODE_KEY) || 'citizen')

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode)
  }, [mode])

  // Demo shortcut: press 1 or 2 to switch views while recording.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '1') setMode('citizen')
      if (e.key === '2') setMode('dashboard')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The city operations view is a full-bleed map with its own floating top bar.
  if (mode === 'dashboard') {
    return (
      <div className="h-dvh w-screen bg-[#090A0F]">
        <Suspense fallback={null}>
          <CommandCenter onOpenRiderApp={() => setMode('citizen')} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-ink">
      <NavBar mode={mode} onModeChange={setMode} />
      <main className="min-h-0 flex-1">
        <CitizenView />
      </main>
    </div>
  )
}
