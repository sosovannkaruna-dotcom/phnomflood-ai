import { PaperPlaneTilt, SealCheck } from '@phosphor-icons/react'
import { lastSeenOf, routingDepth } from '../../lib/confidence'
import { useT, type Key } from '../../i18n'
import { useMode } from '../../shared/mode'
import type { FloodReport } from '../../shared/types'
import { agoText } from '../lib/format'

/**
 * Where a report stands now: when a rider last saw the water, whether routing still avoids it at
 * full depth (reports lose weight when nobody confirms them), and where it came from (a trusted
 * rider, the Telegram bot).
 */
export default function ReportStatus({ report, rainNow }: { report: FloodReport; rainNow: number }) {
  const { t } = useT()
  const live = useMode() === 'live'
  const seen = lastSeenOf(report)
  // The demo's clock stands still at the storm, so its reports never fade (see RiderApp).
  const counts = live ? routingDepth(report, rainNow) : report.depth
  const fading = report.depth !== 'clear' && counts !== report.depth

  return (
    <span className="block space-y-1">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
        <span className="font-mono text-zinc-300">{t('flood.verified', { ago: agoText(t, seen) })}</span>
        {seen > report.createdAt + 60000 && <span>{t('flood.reported', { ago: agoText(t, report.createdAt) })}</span>}
        {report.source === 'telegram' && (
          <span className="inline-flex items-center gap-1 border border-white/[0.15] px-1.5 py-px font-mono text-[11px] uppercase tracking-wider text-zinc-200">
            <PaperPlaneTilt weight="fill" className="h-3 w-3 text-water" aria-hidden />
            {t('source.telegram')}
          </span>
        )}
        {report.trust === 'trusted' && (
          <span className="inline-flex items-center gap-1 border border-white/[0.15] px-1.5 py-px font-mono text-[11px] uppercase tracking-wider text-zinc-200">
            <SealCheck weight="fill" className="h-3 w-3 text-zinc-50" aria-hidden />
            {t('trust.trusted')}
          </span>
        )}
      </span>
      {fading && (
        <span className="block text-xs leading-snug text-amber-300/90">
          {counts ? t('flood.fading', { depth: t(`depth.${counts}` as Key).toLowerCase() }) : t('flood.faded')}
        </span>
      )}
    </span>
  )
}
