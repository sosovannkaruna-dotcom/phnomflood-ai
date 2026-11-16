import { useEffect, useRef } from 'react'
import { ArrowRight, ArrowUpRight, X } from '@phosphor-icons/react'

interface Item {
  label: string
  onSelect: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  /** Page sections and pages, in reading order */
  items: Item[]
  onDemo: () => void
  onLive: () => void
}

/**
 * Phone navigation: a panel that slides in from the right edge. Closes on its X, the scrim,
 * Escape, or after a choice. It is always in the page so it can animate both ways; while closed
 * it is hidden from screen readers and the keyboard.
 */
export default function MobileMenu({ open, onClose, items, onDemo, onLive }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    const el = panel.current
    if (!el) return
    if (open) {
      opener.current = document.activeElement
      el.removeAttribute('inert')
      // Focus the first link once the panel is on its way in.
      window.setTimeout(() => el.querySelector<HTMLElement>('button, a')?.focus(), 60)
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
      const scroll = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      window.addEventListener('keydown', onKey)
      return () => {
        window.removeEventListener('keydown', onKey)
        document.documentElement.style.overflow = scroll
      }
    }
    el.setAttribute('inert', '')
    if (opener.current instanceof HTMLElement) opener.current.focus()
  }, [open, onClose])

  const choose = (fn: () => void) => () => {
    onClose()
    // Let the panel start closing before the page scrolls or changes.
    window.setTimeout(fn, 140)
  }

  return (
    <div className={`ln-menu md:hidden ${open ? 'is-open' : ''}`}>
      <div className="ln-menu-scrim" onClick={onClose} aria-hidden />
      <div ref={panel} className="ln-menu-panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <span className="tl-label">Menu</span>
          <button onClick={onClose} aria-label="Close menu" className="rd-press grid h-11 w-11 place-items-center text-zinc-300">
            <X weight="bold" className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Sections" className="flex flex-col">
          {items.map((item, i) => (
            <button key={item.label} onClick={choose(item.onSelect)} className="ln-menu-item" style={{ ['--i' as string]: i }}>
              <span>{item.label}</span>
              <ArrowRight weight="bold" className="h-4 w-4 text-zinc-500" />
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-white/10 p-4">
          <button onClick={choose(onDemo)} className="tl-cta h-12 text-sm">
            <span>Try the demo</span>
            <span>
              <ArrowRight weight="bold" className="h-4 w-4" />
            </span>
          </button>
          <button onClick={choose(onLive)} className="rd-press flex h-12 items-center justify-center gap-2 border border-white/25 text-sm font-semibold text-zinc-100">
            Open live app <ArrowUpRight weight="bold" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
