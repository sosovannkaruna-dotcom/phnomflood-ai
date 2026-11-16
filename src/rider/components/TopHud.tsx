import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, ArrowBendUpLeft as CornerUpLeft, ArrowBendUpRight as CornerUpRight, CloudRain, Flag, CircleNotch as Loader2, X } from '@phosphor-icons/react'
import { DEPTHS } from '../../lib/severity'
import { useT } from '../../i18n'
import type { AppMode } from '../../shared/mode'
import type { SyncState } from '../../shared/types'
import type { Place } from '../types'
import type { Trip } from '../hooks/useTrip'
import type { WeatherState } from '../hooks/useWeather'
import { nextManeuver, passability } from '../lib/trip'
import NavBanner from './NavBanner'

const TURN_ICON = { left: CornerUpLeft, right: CornerUpRight, straight: ArrowUp, arrive: Flag }
const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)

interface Props {
  trip: Trip
  place: Place
  mode: AppMode
  sync: SyncState
  weather: WeatherState
  riding: boolean
  /** Turn-by-turn navigation: the status strip gives way to a big turn banner */
  navigating?: boolean
  /** An overlay (arrival card) owns the screen: hold back notices and alerts */
  quiet?: boolean
  speedFactor: number
  onHome: () => void
  /** Live mode with no destination yet: no turn banner */
  planning?: boolean
  /** Urgent riding alert (in water, heading into water), shown above other notices */
  alert?: { id: string; text: string; color: string } | null
}

/** Status strip, the turn-by-turn and hazard banner, and the rain alert. */
export default function TopHud({ trip, place, mode, sync, weather, riding, navigating = false, quiet = false, speedFactor, onHome, planning = false, alert = null }: Props) {
  const { t, lang, setLang } = useT()
  const { active, recalculating, notice, fraction, vehicle } = trip
  const { step, metres: distance } = nextManeuver(active.candidate, fraction)
  const Turn = TURN_ICON[step.turn]
  const status = passability(active)
  const deepest = Math.max(0, ...active.cautions.map((r) => r.ai?.depthCm ?? DEPTHS[r.depth].cm))
  const badge =
    status === 'dry'
      ? { text: t('badge.dry'), color: '#10B981' }
      : status === 'caution'
        ? { text: t('badge.caution', { cm: deepest }), color: '#F59E0B' }
        : { text: t('badge.blocked'), color: '#EF4444' }
  const barColor = recalculating ? '#F59E0B' : badge.color

  const w = weather.status === 'ready' ? weather.weather : null
  const [rainDismissed, setRainDismissed] = useState(false)
  const rainAlert = w?.heavy && !rainDismissed ? (w.rainNow >= 7.6 ? t('weather.heavyNow', { mm: w.rainNow }) : t('weather.heavySoon', { mm: w.next3h })) : null

  const noticeText =
    notice?.kind === 'nodry'
      ? t('notice.nodry')
      : notice?.kind === 'scripted'
        ? t('notice.scripted')
        : notice?.kind === 'updated'
          ? notice.extra > 0
            ? t('notice.updatedExtra', { min: notice.extra, via: notice.via })
            : t('notice.updated', { via: notice.via })
          : null

  const shared = mode === 'live' && sync === 'live'

  return (
    <div className="pt-safe pointer-events-none absolute inset-x-3 top-3 z-10 space-y-2">
      {navigating ? (
        <NavBanner trip={trip} />
      ) : (
        <>
      {/* Status strip: one hairline-divided slab */}
      <div className="cc-panel pointer-events-auto flex h-10 items-stretch divide-x divide-white/[0.12]">
        <button onClick={onHome} aria-label={t('hud.home')} title={t('hud.home')} className="cc-btn flex shrink-0 items-center gap-2 px-3">
          <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden>
            <path d="M10 1 19 10 10 19 1 10Z" fill="none" stroke="#E8301C" strokeWidth="1.75" />
            <path d="M5 11c1.7-1.4 3.3-1.4 5 0s3.3 1.4 5 0" fill="none" stroke="#F4F4F5" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          <span className="tl-title text-sm text-zinc-50">{mode === 'demo' ? t('mode.demo') : t('mode.live')}</span>
          {mode === 'live' && <span className={`h-1.5 w-1.5 rounded-full ${shared ? 'bg-emerald-400' : 'bg-zinc-500'}`} aria-hidden />}
        </button>
        <span className="flex min-w-0 flex-1 items-center px-3" title={`${place.area}, Sangkat ${place.sangkat}, Khan ${place.khan}`}>
          <span className="tl-label truncate text-zinc-200">{place.area}</span>
        </span>
        <span
          className={`flex shrink-0 items-center gap-1.5 px-2.5 ${w?.heavy ? 'text-caution' : 'text-zinc-300'}`}
          title={w ? t('weather.title', { now: w.rainNow, next: w.next3h, chance: w.chance, source: w.source }) : t('weather.unknown')}
        >
          <CloudRain className="h-4 w-4" />
          <span className="tl-label text-current">{w ? (w.rainNow > 0 ? `${w.rainNow}` : t('weather.dry')) : weather.status === 'loading' ? '…' : '–'}</span>
        </span>
        {riding && (
          <span className="flex shrink-0 items-center px-2.5">
            <span className="tl-label text-flare">{t('hud.sim', { x: speedFactor })}</span>
          </span>
        )}
        <button onClick={() => setLang(lang === 'en' ? 'km' : 'en')} aria-label={t('lang.switch')} title={t('lang.switch')} className="cc-btn grid w-11 shrink-0 place-items-center">
          <span className="text-xs font-semibold text-zinc-200">{t('lang.label')}</span>
        </button>
      </div>

      {/* Turn-by-turn + hazard banner: status colour runs down the left edge */}
      {!planning && <div className="pointer-events-auto flex border border-white/[0.12] bg-void/95" aria-live="polite">
        <span className="w-1.5 shrink-0 transition-colors duration-300" style={{ background: barColor }} />
        <div className="min-w-0 flex-1 px-3 py-2">
          {recalculating ? (
            <div className="flex min-h-[44px] items-center gap-3">
              <Loader2 className="h-7 w-7 shrink-0 animate-spin text-caution" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold leading-tight text-amber-400">{t('hud.recalc', { vehicle: t(`noun.${vehicle}`) })}</p>
                <div className="cc-shimmer h-2 w-2/3" />
              </div>
            </div>
          ) : (
            <div className="flex min-h-[44px] items-center gap-3">
              <Turn className="h-7 w-7 shrink-0 text-zinc-50" />
              <div className="min-w-0 flex-1">
                <p className="tl-title text-2xl leading-none text-zinc-50 tabular-nums">{metres(distance)}</p>
                <p className="mt-1.5 truncate text-sm text-zinc-300">
                  <span className="font-medium text-zinc-100">{step.street}</span>
                  {step.toward && (
                    <span>
                      {' '}
                      {t('hud.toward')} {step.toward}
                    </span>
                  )}
                </p>
              </div>
              <span className="tl-label shrink-0" style={{ color: badge.color }}>
                {badge.text}
              </span>
            </div>
          )}
        </div>
      </div>}

        </>
      )}

      <AnimatePresence>
        {alert && !quiet && (
          <motion.p
            key={`alert-${alert.id}`}
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="pointer-events-auto border-l-4 bg-void/95 px-3 py-2.5 text-sm font-semibold"
            style={{ borderColor: alert.color, color: alert.color }}
          >
            {alert.text}
          </motion.p>
        )}
        {noticeText && !quiet && (
          <motion.p
            key="notice"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className={`pointer-events-auto border bg-void/95 px-3 py-2 text-xs font-medium ${notice?.kind === 'scripted' ? 'border-red-500/50 text-red-400' : 'border-emerald-500/40 text-emerald-400'}`}
          >
            {noticeText}
          </motion.p>
        )}
        {rainAlert && !noticeText && !recalculating && !quiet && (
          <motion.div
            key="rain"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="pointer-events-auto flex items-start gap-2 border border-amber-500/50 bg-void/95 py-2 pl-3 pr-1 text-xs font-medium text-amber-400"
          >
            <CloudRain className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1 leading-snug">
              {rainAlert}
              {w?.simulated ? '' : ` (${w?.source})`}
            </span>
            <button onClick={() => setRainDismissed(true)} aria-label={t('weather.dismiss')} className="rd-press grid h-7 w-7 shrink-0 place-items-center text-amber-400/80">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
