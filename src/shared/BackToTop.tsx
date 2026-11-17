import { useEffect, useState } from 'react'
import { ArrowUp } from '@phosphor-icons/react'

/**
 * Back to the top: a square arrow in the bottom-right corner that appears once the reader has
 * scrolled past the first screen, wherever they are on the page. Quiet styling (hairline, dark
 * panel, dusk on hover): hazard red stays reserved for the one primary action.
 */
export default function BackToTop() {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const check = () => setShown(window.scrollY > window.innerHeight * 0.8)
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  const top = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    // Keyboard users land back at the start of the page, not on a button that just disappeared.
    document.querySelector<HTMLElement>('header a, header button')?.focus({ preventScroll: true })
  }

  return (
    <button
      onClick={top}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`pf-top fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] right-4 z-30 grid h-11 w-11 place-items-center border border-white/20 bg-void/90 text-zinc-100 backdrop-blur-md transition-[opacity,translate,background-color,border-color] duration-200 ease-punch hover:border-dusk hover:bg-dusk-deep active:scale-[0.95] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal sm:right-6 ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp weight="bold" className="h-4 w-4" />
    </button>
  )
}
