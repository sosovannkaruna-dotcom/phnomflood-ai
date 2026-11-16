import { useEffect, useRef, useState } from 'react'
import { Crosshair, MagnifyingGlass as Search, MapPin, CircleNotch, X } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import { searchPlaces, type FoundPlace } from '../../services/liveRouting'
import { metresBetween } from '../lib/trip'
import { placeFrom, type LivePlace } from '../hooks/useLive'
import type { LatLng } from '../types'

interface Props {
  near: LatLng | null
  origin: LivePlace | null
  initialTarget?: 'to' | 'from'
  onPickOrigin: (place: LivePlace | null) => void
  onPickDestination: (place: LivePlace) => void
  onClose: () => void
}

const distance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`)

/** Live mode: search any place in Phnom Penh, for the destination or a different starting point. */
export default function PlaceSearch({ near, origin, initialTarget = 'to', onPickOrigin, onPickDestination, onClose }: Props) {
  const { t, lang } = useT()
  const [target, setTarget] = useState<'to' | 'from'>(initialTarget)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundPlace[]>([])
  const [state, setState] = useState<'idle' | 'searching' | 'done' | 'error'>('idle')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setState('idle')
      return
    }
    const ctrl = new AbortController()
    setState('searching')
    // Wait for a pause in typing, so the open geocoders get one request per search, not per key.
    const timer = window.setTimeout(() => {
      searchPlaces(q, near, lang, ctrl.signal)
        .then((found) => {
          setResults(found)
          setState('done')
        })
        .catch(() => {
          if (!ctrl.signal.aborted) setState('error')
        })
    }, 450)
    return () => {
      window.clearTimeout(timer)
      ctrl.abort()
    }
    // `near` is only a bias: don't search again on every GPS fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, lang])

  const pick = (place: FoundPlace) => {
    const chosen = placeFrom(place)
    if (target === 'to') onPickDestination(chosen)
    else onPickOrigin(chosen)
    onClose()
  }

  const tab = (id: 'to' | 'from', label: string) => (
    <button
      onClick={() => {
        setTarget(id)
        input.current?.focus()
      }}
      aria-pressed={target === id}
      className={`rd-press h-9 flex-1 text-sm font-medium ${target === id ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-2">
      <div className="flex divide-x divide-white/[0.12] border border-white/[0.15]" role="group">
        {tab('to', `${t('live.to')}: ${t('live.whereTo')}`)}
        {tab('from', `${t('live.from')}: ${origin?.short ?? t('live.yourLocation')}`)}
      </div>
      <div className="flex h-12 items-center gap-2 border border-signal bg-slab px-3">
        <Search className="h-5 w-5 shrink-0 text-zinc-400" />
        <input
          ref={input}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={target === 'to' ? t('live.searchTo') : t('live.searchFrom')}
          aria-label={target === 'to' ? t('live.searchTo') : t('live.searchFrom')}
          className="h-full min-w-0 flex-1 select-text bg-transparent text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        {state === 'searching' && <CircleNotch className="h-5 w-5 shrink-0 animate-spin text-zinc-400" />}
        <button onClick={onClose} aria-label={t('sheet.closeSearch')} className="rd-press grid h-9 w-9 place-items-center text-zinc-400">
          <X className="h-5 w-5" />
        </button>
      </div>
      <ul className="cc-scroll max-h-[34dvh] overflow-y-auto">
        {target === 'from' && (
          <li>
            <button
              onClick={() => {
                onPickOrigin(null)
                onClose()
              }}
              className="rd-press flex min-h-[52px] w-full items-center gap-3 border-t border-white/[0.12] px-1 text-left"
            >
              <Crosshair className="h-5 w-5 shrink-0 text-sky-400" />
              <span className="text-sm font-medium text-zinc-100">{t('live.useGps')}</span>
            </button>
          </li>
        )}
        {results.map((place) => (
          <li key={place.id}>
            <button onClick={() => pick(place)} className="rd-press flex min-h-[52px] w-full items-center gap-3 border-t border-white/[0.12] px-1 text-left">
              <MapPin className="h-5 w-5 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-100">{place.name}</span>
                {place.detail && <span className="block truncate text-xs text-zinc-400">{place.detail}</span>}
              </span>
              {near && <span className="shrink-0 font-mono text-xs text-zinc-400">{distance(metresBetween(near, [place.lat, place.lng]))}</span>}
            </button>
          </li>
        ))}
        {state === 'done' && !results.length && <li className="border-t border-white/[0.12] px-1 py-3 text-sm text-zinc-400">{t('live.noResults')}</li>}
        {state === 'error' && <li className="border-t border-white/[0.12] px-1 py-3 text-sm text-zinc-400">{t('live.routeError')}</li>}
      </ul>
    </div>
  )
}
