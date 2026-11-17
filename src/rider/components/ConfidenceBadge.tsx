import { useT, type Key } from '../../i18n'
import { confidence } from '../../lib/confidence'
import type { FloodReport } from '../../shared/types'

/** Confidence in a report right now, from the shared rules (src/lib/confidence.js). */
export function reportConfidence(report: FloodReport, rainNow: number, now = Date.now()) {
  const aiCm = report.ai?.depthCm
  return confidence({
    depth: report.depth as 'ankle' | 'knee' | 'waist',
    aiCm: typeof aiCm === 'number' ? aiCm : null,
    confirmations: report.confirmations ?? 0,
    reportedAt: report.createdAt,
    lastSeenAt: report.confirmations && report.updatedAt ? Date.parse(report.updatedAt) : null,
    rainNow,
    now,
  })
}

const BARS = { low: 1, medium: 2, high: 3 } as const

/**
 * A three-step meter (like signal bars) and the level in words, then what counted, so a rider can
 * judge for themselves. Neutral tones: depth keeps the colour, confidence only fills or empties.
 */
export default function ConfidenceBadge({ report, rainNow, detail = false }: { report: FloodReport; rainNow: number; detail?: boolean }) {
  const { t } = useT()
  const c = reportConfidence(report, rainNow)
  const filled = BARS[c.level]
  return (
    <span className="inline-flex min-w-0 items-start gap-2">
      <span className="mt-[3px] flex shrink-0 items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`w-[3px] ${i < filled ? (c.level === 'low' ? 'bg-zinc-400' : 'bg-zinc-100') : 'bg-white/15'}`} style={{ height: 5 + i * 3 }} />
        ))}
      </span>
      <span className="min-w-0">
        <span className={`font-mono text-[11px] uppercase tracking-wider ${c.level === 'low' ? 'text-zinc-400' : 'text-zinc-200'}`}>{t(`conf.${c.level}` as Key)}</span>
        {detail && c.reasons.length > 0 && (
          <span className="block text-xs leading-snug text-zinc-400">{c.reasons.map((r) => t(`conf.r.${r}` as Key)).join(' · ')}</span>
        )}
      </span>
    </span>
  )
}
