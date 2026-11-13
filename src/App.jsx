import { useEffect, useState } from 'react'
import NavBar from './components/NavBar'
import CitizenView from './components/citizen/CitizenView'
import DashboardView from './components/dashboard/DashboardView'

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
      if (e.key === '1') setMode('citizen')
      if (e.key === '2') setMode('dashboard')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col bg-[#F1F5F9] text-ink">
      <NavBar mode={mode} onModeChange={setMode} />
      <main className="min-h-0 flex-1">
        {mode === 'citizen' ? <CitizenView /> : <DashboardView />}
      </main>
    </div>
  )
}
