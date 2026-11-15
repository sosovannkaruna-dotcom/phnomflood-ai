import { motion, useReducedMotion } from 'framer-motion'
import { ArrowCounterClockwise, Check, Flag } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT } from '../../i18n'
import type { Trip } from '../hooks/useTrip'

interface Props {
  trip: Trip
  speedFactor: number
  onAgain: () => void
  onDone: () => void
}

/** The end of a ride: what the rider avoided, stated plainly. */
export default function ArrivalCard({ trip, speedFactor, onAgain, onDone }: Props) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const { active, standard, preset } = trip
  const onActive = new Set([...active.blockers, ...active.cautions].map((r) => r.id))
  const avoided = [...standard.blockers, ...standard.cautions].filter((r) => !onActive.has(r.id)).length
  const deepest = Math.max(0, ...[...active.blockers, ...active.cautions].map((r) => r.ai?.depthCm ?? DEPTHS[r.depth].cm))

  return (
    <motion.div
      role="dialog"
      aria-label={t('arrive.title', { dest: preset.destination.short })}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0.15 }}
      className="absolute inset-x-3 bottom-[calc(232px+env(safe-area-inset-bottom,0px))] z-20 border border-white/[0.15] bg-void"
    >
      <div className="tl-stripe" aria-hidden />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center bg-zinc-100 text-zinc-950">
            <Flag className="h-5 w-5" />
          </span>
          <h2 className="tl-title text-xl leading-tight text-zinc-50">{t('arrive.title', { dest: preset.destination.short })}</h2>
        </div>
        <dl className="tl-grid mt-4 grid-cols-3 border border-white/[0.12]">
          <div className="p-2.5">
            <dt className="tl-label">{t('arrive.time')}</dt>
            <dd className="tl-title mt-1 text-lg text-zinc-50">{t('sheet.min', { n: active.minutes })}</dd>
          </div>
          <div className="p-2.5">
            <dt className="tl-label">{t('arrive.avoided')}</dt>
            <dd className="tl-title mt-1 text-lg text-emerald-400">{avoided}</dd>
          </div>
          <div className="p-2.5">
            <dt className="tl-label">{t('arrive.deepest')}</dt>
            <dd className={`tl-title mt-1 text-lg ${deepest ? 'text-amber-400' : 'text-zinc-50'}`}>{deepest ? `${deepest} cm` : t('arrive.none')}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-zinc-500">{t('arrive.simNote', { x: speedFactor })}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onAgain} className="rd-press flex h-12 items-center justify-center gap-2 border border-white/25 text-sm font-semibold text-zinc-50">
            <ArrowCounterClockwise className="h-4 w-4" /> {t('arrive.again')}
          </button>
          <button onClick={onDone} className="rd-press flex h-12 items-center justify-center gap-2 bg-zinc-100 text-sm font-semibold text-zinc-950">
            <Check className="h-4 w-4" /> {t('arrive.done')}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
