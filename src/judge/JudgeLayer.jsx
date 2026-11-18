import { lazy, Suspense, useEffect, useState } from 'react'

// Judge mode opens over any page with Shift+D (not while typing in a field) and closes with Esc or
// Shift+D, back to exactly where the presenter was. It is loaded only when first opened.
const JudgeMode = lazy(() => import('./JudgeMode'))

export default function JudgeLayer() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The page behind does not scroll while judge mode is up.
  useEffect(() => {
    if (!open) return
    const before = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = before
    }
  }, [open])

  if (!open) return null
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[200] bg-void" />}>
      <JudgeMode onClose={() => setOpen(false)} />
    </Suspense>
  )
}
