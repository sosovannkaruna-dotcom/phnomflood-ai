import { motion, useReducedMotion } from 'framer-motion'
import { Hourglass, X } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT, type Key } from '../../i18n'
import type { FloodReport } from '../../shared/types'
import { clearsIn } from '../lib/trip'
import { drainText } from '../lib/format'
import ReportStatus from './ReportStatus'
import ConfidenceBadge from './ConfidenceBadge'

interface Props {
  report: FloodReport
  rainNow: number
  /** Height of the bottom panel to sit above */
  bottom: number
  onClose: () => void
  onConfirm: (id: string) => void
  onClear: (id: string) => void
}

/** A tapped flood line: how deep, how old, and roughly when it should drain. */
export default function FloodCard({ report, rainNow, bottom, onClose, onConfirm, onClear }: Props) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const depth = DEPTHS[report.depth]
  const cm = report.ai?.depthCm ?? depth.cm
  const deep = depth.rank >= 2
  const colour = deep ? '#F05252' : '#F5B342'

  return (
    <motion.div
      role="dialog"
      aria-label={report.name}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(12px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      style={{ bottom: bottom + 8 }}
      className="absolute inset-x-3 z-20 border border-white/[0.15] bg-void/95 backdrop-blur-md"
    >
      <div className="flex">
        <span className="w-1 shrink-0" style={{ background: colour }} />
        <div className="min-w-0 flex-1 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-50">{report.name}</p>
              <p className="mt-0.5 font-mono text-xs" style={{ color: colour }}>
                ~{cm} cm · {t(`depth.${report.depth}` as Key)}
              </p>
            </div>
            <button onClick={onClose} aria-label={t('sheet.closeSearch')} className="rd-press -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2">
            <ConfidenceBadge report={report} rainNow={rainNow} detail />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-100">
            <Hourglass className="h-4 w-4 shrink-0 text-zinc-400" />
            {drainText(t, clearsIn(report, rainNow))}
          </p>
          <div className="mt-1.5">
            <ReportStatus report={report} rainNow={rainNow} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {report.confirmations ? `${t('sheet.confirmed', { n: report.confirmations })} · ` : ''}
            {t('drain.note')}
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-px border border-white/[0.12] bg-white/[0.12]">
            <button onClick={() => onConfirm(report.id)} className="rd-press h-10 bg-void text-sm font-medium text-zinc-100">
              {t('sheet.still')}
            </button>
            <button onClick={() => onClear(report.id)} className="rd-press h-10 bg-void text-sm font-medium text-emerald-400">
              {t('sheet.cleared')}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
