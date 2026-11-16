import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowCounterClockwise, ArrowRight } from '@phosphor-icons/react'
import { useT } from '../../i18n'

interface Props {
  /** 1-based step, or `total + 1` for the closing card */
  step: number
  total: number
  text: string
  /** Distance from the bottom of the screen, so the caption sits just above whatever panel is open; null = top */
  bottom: number | null
  onSkip: () => void
  onExplore: () => void
  onReplay: () => void
}

const EASE = [0.23, 1, 0.32, 1] as const

/**
 * Guided demo captions. One short sentence per step, a thin progress bar, and Skip.
 * Captions cross-fade in place (no sliding around), so the eye stays on the map behind them.
 */
export default function TourOverlay({ step, total, text, bottom, onSkip, onExplore, onReplay }: Props) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const done = step > total

  if (done) {
    return (
      <motion.div
        key="tour-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="absolute inset-0 z-40 grid place-items-center bg-black/70 p-5"
      >
        <motion.div
          role="dialog"
          aria-label={text}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.96)' }}
          animate={{ opacity: 1, transform: 'scale(1)' }}
          transition={{ duration: 0.3, ease: EASE }}
          className="w-full border border-white/[0.15] bg-void"
        >
          <div className="tl-stripe" aria-hidden />
          <div className="p-5">
            <p className="tl-title text-2xl leading-tight text-zinc-50">{text}</p>
            <div className="mt-5 grid gap-2">
              <button onClick={onExplore} className="tl-cta h-12 text-sm">
                <span>{t('tour.explore')}</span>
                <span>
                  <ArrowRight className="h-5 w-5" />
                </span>
              </button>
              <button onClick={onReplay} className="rd-press flex h-12 items-center justify-center gap-2 border border-white/25 text-sm font-semibold text-zinc-50">
                <ArrowCounterClockwise className="h-4 w-4" /> {t('tour.replay')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-3 z-40 transition-[bottom,top] duration-300"
      style={bottom === null ? { top: 12 } : { bottom: bottom + 10 }}
      aria-live="polite"
    >
      <div className="pointer-events-auto border border-white/[0.15] bg-void/95 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
        {/* Progress: one segment per step */}
        <div className="flex gap-0.5 p-0.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-0.5 flex-1 transition-colors duration-300 ${i < step ? 'bg-signal' : 'bg-white/15'}`} />
          ))}
        </div>
        <div className="flex items-start gap-3 px-3 pb-3 pt-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              initial={{ opacity: 0, filter: reduce ? 'none' : 'blur(2px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: EASE }}
              className="min-w-0 flex-1 text-sm font-medium leading-snug text-zinc-50"
            >
              <span className="mr-1.5 font-mono text-xs text-flare">
                {step}/{total}
              </span>
              {text}
            </motion.p>
          </AnimatePresence>
          <button onClick={onSkip} className="rd-press -mr-1 shrink-0 px-1 text-xs font-semibold text-zinc-400 underline-offset-2 hover:underline">
            {t('tour.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
