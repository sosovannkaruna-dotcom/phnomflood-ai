import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Drop, Question } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT, type Key } from '../../i18n'
import type { FloodReport } from '../../shared/types'
import { agoText } from '../lib/format'

export type StillAnswer = 'still' | 'cleared' | 'unsure'

interface Props {
  report: FloodReport
  /** Height of the bottom panel to sit above */
  bottom: number
  onAnswer: (answer: StillAnswer | null) => void
}

/** Shown in passing: the rider is at a reported flood. Three big answers, then it goes away by itself. */
export default function StillThere({ report, bottom, onAnswer }: Props) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const [thanks, setThanks] = useState(false)
  const depth = DEPTHS[report.depth]
  const colour = depth.rank >= 2 ? '#F05252' : '#F5B342'

  // No answer in 25 s: let it go (it will not ask about this report again for six hours).
  useEffect(() => {
    if (thanks) return
    const timer = window.setTimeout(() => onAnswer(null), 25000)
    return () => window.clearTimeout(timer)
  }, [thanks, onAnswer])

  const answer = (a: StillAnswer) => {
    setThanks(true)
    window.setTimeout(() => onAnswer(a), a === 'unsure' ? 0 : 1100)
  }

  const big = 'rd-press flex h-14 flex-col items-center justify-center gap-1 bg-void text-sm font-semibold'

  return (
    <motion.div
      role="dialog"
      aria-label={t('still.title')}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(16px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      style={{ bottom: bottom + 8 }}
      className="absolute inset-x-3 z-30 border border-white/[0.15] bg-void/95 backdrop-blur-md"
    >
      {thanks ? (
        <p className="flex h-[118px] items-center justify-center gap-2 px-4 text-center text-sm font-medium text-emerald-400" aria-live="polite">
          <Check weight="bold" className="h-5 w-5" /> {t('still.thanks')}
        </p>
      ) : (
        <div className="p-3">
          <p className="flex items-baseline gap-2 text-sm font-semibold text-zinc-50">
            <Drop weight="fill" className="h-4 w-4 shrink-0 translate-y-0.5" style={{ color: colour }} />
            {t('still.title')}
          </p>
          <p className="mt-0.5 truncate pl-6 text-xs text-zinc-400">
            <span className="font-mono" style={{ color: colour }}>
              ~{report.ai?.depthCm ?? depth.cm} cm · {t(`depth.${report.depth}` as Key)}
            </span>{' '}
            · {report.name} · {agoText(t, report.createdAt)}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-px border border-white/[0.12] bg-white/[0.12]">
            <button onClick={() => answer('still')} className={`${big} text-zinc-50`}>
              <Drop weight="bold" className="h-5 w-5" style={{ color: colour }} />
              {t('still.yes')}
            </button>
            <button onClick={() => answer('cleared')} className={`${big} text-emerald-400`}>
              <Check weight="bold" className="h-5 w-5" />
              {t('still.no')}
            </button>
            <button onClick={() => answer('unsure')} className={`${big} text-zinc-400`}>
              <Question weight="bold" className="h-5 w-5" />
              {t('still.unsure')}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
