import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { HOUR_MAX, HOUR_MIN, cityRain } from '../data/hydrology'

const TICKS = [-6, 0, 6, 12, 18, 24]
const SPAN = HOUR_MAX - HOUR_MIN
const pct = (hour: number) => ((hour - HOUR_MIN) / SPAN) * 100
const ICT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', hour12: false })

// Rainfall curve drawn behind the scrubber, so the squall is visible at a glance.
const CURVE = (() => {
  const pts = Array.from({ length: 61 }, (_, i) => {
    const hour = HOUR_MIN + (i / 60) * SPAN
    return `${((i / 60) * 100).toFixed(1)} ${(24 - (cityRain(hour) / 42) * 22).toFixed(1)}`
  })
  return `M0 24 L${pts.join(' L')} L100 24 Z`
})()

interface Props {
  hour: number
  onChange: (hour: number) => void
}

/** Scrub from -6 h (history) through NOW to +24 h (forecast). */
export default function Timeline({ hour, onChange }: Props) {
  const [playing, setPlaying] = useState(false)
  const hourRef = useRef(hour)
  hourRef.current = hour

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const next = hourRef.current + 0.25
      if (next > HOUR_MAX) {
        setPlaying(false)
        return
      }
      onChange(next)
    }, 90)
    return () => window.clearInterval(timer)
  }, [playing, onChange])

  const at = new Date(Date.now() + hour * 3600_000)
  const readout = Math.abs(hour) < 0.01 ? 'NOW' : `T${hour > 0 ? '+' : '−'}${Math.abs(hour).toFixed(2).replace(/\.?0+$/, '')} h`

  return (
    <div className="cc-panel flex items-center gap-3 rounded-lg px-3 py-2">
      <button
        onClick={() => {
          if (!playing && hour >= HOUR_MAX) onChange(0)
          setPlaying((p) => !p)
        }}
        aria-label={playing ? 'Pause forecast' : 'Play forecast'}
        className="cc-btn grid h-8 w-8 shrink-0 place-items-center rounded border border-white/[0.08] text-zinc-100"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="relative h-7">
          <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <path d={CURVE} fill="#0EA5E9" fillOpacity="0.18" />
          </svg>
          <span className="absolute inset-y-0 w-px bg-zinc-500" style={{ left: `${pct(0)}%` }} />
          <span className="absolute inset-y-0 w-0.5 bg-sky-400" style={{ left: `${pct(hour)}%` }} />
          <input
            type="range"
            min={HOUR_MIN}
            max={HOUR_MAX}
            step={0.25}
            value={hour}
            onChange={(e) => {
              setPlaying(false)
              onChange(Number(e.target.value))
            }}
            aria-label="Forecast hour"
            aria-valuetext={readout}
            className="cc-range absolute inset-0 h-full w-full"
          />
        </div>
        <div className="relative mt-1 h-3 font-mono text-[10px] text-zinc-400">
          {TICKS.map((t) => (
            <span key={t} className={`absolute -translate-x-1/2 ${t === 0 ? 'text-zinc-100' : ''}`} style={{ left: `${pct(t)}%` }}>
              {t === 0 ? 'NOW' : `${t > 0 ? '+' : ''}${t}h`}
            </span>
          ))}
        </div>
      </div>

      <div className="w-36 shrink-0 whitespace-nowrap text-right font-mono">
        <p className="text-sm text-zinc-100">{readout}</p>
        <p className="text-[10px] text-zinc-400">
          {ICT.format(at)} ICT · {cityRain(hour).toFixed(0)} mm/h
        </p>
      </div>
    </div>
  )
}
