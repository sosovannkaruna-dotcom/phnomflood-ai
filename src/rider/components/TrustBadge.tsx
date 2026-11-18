import { useEffect, useState } from 'react'
import { SealCheck, UserCircle } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import { useMode } from '../../shared/mode'
import { fetchMyTrust, syncConfigured } from '../../services/sync'

type Trust = { level: 'new' | 'regular' | 'trusted'; reports: number; confirmed: number; disputed: number }

// The demo's rider: a simulated record, labelled as such.
const DEMO: Trust = { level: 'trusted', reports: 14, confirmed: 11, disputed: 0 }

/**
 * This phone's standing as a reporter, in the report form: how many of its reports other riders
 * confirmed. Trusted riders' water is believed a little longer (src/lib/confidence.js). Live: from
 * the database (supabase/schema.sql, my_trust); hidden until that is set up.
 */
export default function TrustBadge() {
  const { t } = useT()
  const live = useMode() === 'live'
  const [trust, setTrust] = useState<Trust | null>(live ? null : DEMO)

  useEffect(() => {
    if (!live || !syncConfigured) return
    const controller = new AbortController()
    fetchMyTrust(controller.signal)
      .then((row: Trust | null) => setTrust(row))
      .catch(() => undefined)
    return () => controller.abort()
  }, [live])

  if (!trust) return null
  const trusted = trust.level === 'trusted'
  return (
    <p className="mt-2 inline-flex max-w-full items-center gap-1.5 border border-white/[0.15] px-2 py-1 text-xs text-zinc-300">
      {trusted ? <SealCheck weight="fill" className="h-4 w-4 shrink-0 text-zinc-50" aria-hidden /> : <UserCircle className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />}
      <span className={`font-mono text-[11px] uppercase tracking-wider ${trusted ? 'text-zinc-50' : 'text-zinc-300'}`}>{t(`trust.${trust.level}`)}</span>
      <span className="truncate text-zinc-400">
        {trust.reports ? t('trust.record', { n: trust.reports, c: trust.confirmed }) : t('trust.first')}
        {live ? '' : ` · ${t('trust.demo')}`}
      </span>
    </p>
  )
}
