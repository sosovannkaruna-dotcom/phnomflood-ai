import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from '@phosphor-icons/react'
import { useT } from '../../i18n'
import type { ForecastState } from '../hooks/useForecast'

const LEGEND = [
  { cm: 10, color: 'rgba(56,189,248,0.55)' },
  { cm: 25, color: 'rgba(59,130,246,0.7)' },
  { cm: 40, color: 'rgba(37,99,235,0.85)' },
]

/**
 * The flood forecast's time control over the map: now to two hours ahead in 15-minute steps, a play
 * button that runs through them, the depth key, and what the blue is (a model, not reports).
 */
export default function ForecastBar({ state, frame, onFrame, bottom, onHeight }: { state: ForecastState; frame: number; onFrame: (f: number) => void; bottom: number; onHeight?: (px: number) => void }) {
  const { t, lang } = useT()
  const [playing, setPlaying] = useState(false)
  // Its height, so the radar caption and the re-centre pill can sit above it.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el || !onHeight) return
    const observer = new ResizeObserver(() => onHeight(Math.round(el.getBoundingClientRect().height)))
    observer.observe(el)
    return () => {
      observer.disconnect()
      onHeight(0)
    }
  }, [onHeight])
  const result = state.status === 'ready' ? state.result : null
  const last = result ? result.times.length - 1 : 0

  useEffect(() => {
    if (!playing || !result) return
    const timer = window.setTimeout(() => {
      if (frame >= last) setPlaying(false)
      else onFrame(frame + 1)
    }, frame === 0 ? 500 : 700)
    return () => window.clearTimeout(timer)
  }, [playing, frame, last, result, onFrame])

  const time = new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' })
  const at = result ? result.times[Math.min(frame, last)] : null
  const minutes = frame * 15
  const ahead = minutes === 0 ? t('fc.now') : minutes < 60 ? `+${minutes} min` : `+${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ''}`

  return (
    <div ref={box} className="absolute left-3 right-16 z-10 border border-white/[0.12] bg-void/90 backdrop-blur-sm" style={{ bottom: bottom + 8 }} role="group" aria-label={t('fc.title')}>
      <div className="flex items-center gap-2 pr-2.5">
        <button
          onClick={() => {
            if (!result) return
            if (!playing && frame >= last) onFrame(0)
            setPlaying((p) => !p)
          }}
          disabled={!result}
          aria-label={playing ? t('fc.pause') : t('fc.play')}
          className="rd-press grid h-10 w-10 shrink-0 place-items-center border-r border-white/[0.12] text-zinc-100 disabled:text-zinc-600"
        >
          {playing ? <Pause weight="fill" className="h-4 w-4" /> : <Play weight="fill" className="h-4 w-4" />}
        </button>
        <span className="min-w-0 flex-1">
          <span className="tl-label block truncate">{t('fc.title')}</span>
          <span className="block truncate font-mono text-[13px] text-zinc-50" aria-live="polite">
            {state.status === 'loading' ? t('fc.loading') : state.status === 'error' ? t('fc.error') : at ? `${time.format(at)} · ${ahead}` : '–'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
          {LEGEND.map((l) => (
            <span key={l.cm} className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
              <span className="h-2.5 w-2.5" style={{ background: l.color }} />
              {l.cm}
            </span>
          ))}
          <span className="font-mono text-[11px] text-zinc-500">cm</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={Math.min(frame, last)}
        disabled={!result}
        onChange={(e) => {
          setPlaying(false)
          onFrame(Number(e.target.value))
        }}
        aria-label={t('fc.scrub')}
        aria-valuetext={at ? `${time.format(at)}, ${ahead}` : undefined}
        className="fc-range block w-full"
      />
      {result && (
        <p className="border-t border-white/[0.12] px-2.5 py-1 text-[11px] leading-snug text-zinc-400">
          {result.fitted > 0 && result.rainFactor !== 1 ? t('fc.fitted', { x: result.rainFactor, n: result.fitted }) + ' ' : ''}
          {t('fc.note')}
        </p>
      )}
    </div>
  )
}
