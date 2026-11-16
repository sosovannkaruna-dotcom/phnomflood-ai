import { useEffect, useState } from 'react'
import { Warning, X } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import type { Trip } from '../hooks/useTrip'
import { remainingMetres } from '../lib/trip'

interface Props {
  trip: Trip
  onReport: () => void
  onExit: () => void
}

/** Bottom bar while navigating: time and distance left, arrival time, report and exit. */
export default function NavBar({ trip, onReport, onExit }: Props) {
  const { t, lang } = useT()
  const { active, fraction } = trip
  const minutesLeft = Math.max(1, Math.round(active.minutes * (1 - fraction)))
  const left = remainingMetres(active.candidate, fraction)
  const km = left >= 1000 ? `${(left / 1000).toFixed(1)} km` : `${Math.round(left / 10) * 10} m`

  // Arrival clock in real time.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])
  const arrival = new Date(now + minutesLeft * 60_000).toLocaleTimeString(lang === 'km' ? 'km-KH' : 'en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div data-bottom-panel className="pb-safe absolute inset-x-0 bottom-0 z-20 border-t border-white/[0.15] bg-void/95 backdrop-blur-md">
      <div className="flex items-stretch gap-2 p-2.5">
        <button onClick={onExit} aria-label={t('nav.exit')} title={t('nav.exit')} className="rd-press grid h-12 w-12 shrink-0 place-items-center border border-white/25 text-zinc-50">
          <X className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="tl-title text-2xl leading-none text-emerald-400 tabular-nums">{t('sheet.min', { n: minutesLeft })}</p>
          <p className="mt-1 font-mono text-sm text-zinc-300">
            {km} · {t('nav.arrival', { time: arrival })}
          </p>
        </div>
        <button onClick={onReport} aria-label={t('sheet.report')} title={t('sheet.report')} className="rd-press grid h-12 w-12 shrink-0 place-items-center bg-signal text-zinc-50">
          <Warning className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
