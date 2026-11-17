import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { ArrowUpRight, Pause, Play } from '@phosphor-icons/react'
import { RIDER_MAP_STYLE } from '../shared/mapStyle'
import { HEAVY_MM_H, STORM_2026_02_26 as STORM } from '../data/storms'
import DATA from '../data/storm-2026-02-26.generated.json'

// Storm replay (Open data page): a real day, step by step from the news report that covered it,
// next to what four weather models had for the same hours. The point it makes: the models saw a
// shower; the streets had 20 cm of water. Street reports are how anyone would have known.

const AMBER = '#F5B342'
const STEP_MS = 3200
const HOURS = Array.from({ length: 12 }, (_, i) => 10 + i) // 10:00 to 21:00
const CHART_MAX = 9 // mm per hour: room above the heavy-rain line

const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`

export default function StormReplay() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const current = STORM.steps[step]

  // The map: the four districts and the riverside, faded in step by step.
  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!,
      style: RIDER_MAP_STYLE,
      bounds: [
        [104.83, 11.535],
        [104.945, 11.625],
      ],
      fitBoundsOptions: { padding: 16 },
      interactive: false,
      attributionControl: false,
    })
    map.current = m
    m.on('load', () => {
      const areas: FeatureCollection = { type: 'FeatureCollection', features: DATA.areas.map((a) => ({ type: 'Feature', id: a.id, properties: { id: a.id }, geometry: a.geometry as Geometry })) }
      const riverside: Feature = { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: DATA.riverside } }
      const labels: FeatureCollection = {
        type: 'FeatureCollection',
        features: DATA.areas.map((a) => ({ type: 'Feature', properties: { id: a.id, name: STORM.areaNames[a.id]?.name ?? a.id }, geometry: { type: 'Point', coordinates: [a.centre[1], a.centre[0]] } })),
      }
      m.addSource('areas', { type: 'geojson', data: areas, promoteId: 'id' })
      m.addSource('riverside', { type: 'geojson', data: { type: 'FeatureCollection', features: [riverside] } })
      m.addSource('labels', { type: 'geojson', data: labels })
      const on = ['boolean', ['feature-state', 'on'], false] as unknown as boolean
      m.addLayer({ id: 'area-fill', type: 'fill', source: 'areas', paint: { 'fill-color': AMBER, 'fill-opacity': ['case', on, 0.2, 0] as unknown as number } })
      m.addLayer({ id: 'area-edge', type: 'line', source: 'areas', paint: { 'line-color': ['case', on, AMBER, 'rgba(244,244,245,0.28)'] as unknown as string, 'line-width': ['case', on, 1.5, 1] as unknown as number, 'line-dasharray': [3, 2] } })
      m.addLayer({ id: 'riverside', type: 'line', source: 'riverside', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': AMBER, 'line-width': 5, 'line-opacity': 0 } })
      m.addLayer({
        id: 'labels',
        type: 'symbol',
        source: 'labels',
        layout: { 'text-field': ['get', 'name'] as unknown as string, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08 },
        paint: { 'text-color': '#E4E4E7', 'text-halo-color': '#0A0A0B', 'text-halo-width': 1.5 },
      })
      for (const id of ['area-fill']) m.setPaintProperty(id, 'fill-opacity-transition', { duration: 600, delay: 0 })
      m.setPaintProperty('riverside', 'line-opacity-transition', { duration: 600, delay: 0 })
      ready.current = true
      paint(m, 0)
    })
    return () => {
      ready.current = false
      m.remove()
    }
  }, [])

  const paint = (m: maplibregl.Map, at: number) => {
    const s = STORM.steps[at]
    for (const a of DATA.areas) m.setFeatureState({ source: 'areas', id: a.id }, { on: s.areas.includes(a.id) })
    m.setPaintProperty('riverside', 'line-opacity', s.riverside ? 0.95 : 0)
  }
  useEffect(() => {
    if (map.current && ready.current) paint(map.current, step)
  }, [step])

  // Play: one step every few seconds, stopping on the last.
  useEffect(() => {
    if (!playing) return
    if (step >= STORM.steps.length - 1) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => window.clearTimeout(t)
  }, [playing, step])

  const play = () => {
    if (step >= STORM.steps.length - 1) setStep(0)
    setPlaying((p) => !p)
  }

  return (
    <div className="border border-white/15">
      {/* Header: the day and the source */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-white/15 px-4 py-3 sm:px-5">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-400">{STORM.date}</p>
        <a href={STORM.source.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal">
          Source: {STORM.source.publisher}, “{STORM.source.title}” <ArrowUpRight weight="bold" className="h-3 w-3 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Map */}
        <div className="relative aspect-[4/3] border-b border-white/15 lg:col-span-7 lg:aspect-auto lg:min-h-[460px] lg:border-b-0 lg:border-r">
          <div ref={box} className="h-full w-full" aria-hidden />
          {current.areas.includes('tuol-kouk') && (
            <span className="pointer-events-none absolute left-3 top-3 border border-white/15 bg-void/90 px-2.5 py-1.5 font-mono text-xs text-zinc-100">
              Tuol Kouk: up to <span style={{ color: AMBER }}>20 cm</span> on major roads
            </span>
          )}
          <p className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-zinc-500">District outlines © OpenStreetMap contributors</p>
        </div>

        {/* Timeline */}
        <div className="flex flex-col lg:col-span-5">
          <ol className="flex-1">
            {STORM.steps.map((s, i) => (
              <li key={s.hour} className="border-b border-white/10 last:border-b-0">
                <button
                  onClick={() => {
                    setPlaying(false)
                    setStep(i)
                  }}
                  aria-current={i === step ? 'step' : undefined}
                  className={`flex w-full gap-4 px-4 py-3 text-left transition-colors duration-200 sm:px-5 ${i === step ? 'bg-white/[0.04]' : 'hover:bg-dusk-deep'} focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 ${i <= step ? '' : 'border border-white/30'}`} style={i <= step ? { background: s.areas.length || s.riverside ? AMBER : '#A1A1AA' } : undefined} aria-hidden />
                  <span className="min-w-0">
                    <span className={`block font-mono text-[11px] uppercase tracking-wider ${i === step ? 'text-zinc-100' : 'text-zinc-500'}`}>
                      {s.when} <span className="text-zinc-600">· ~{hourLabel(s.hour)}</span>
                    </span>
                    <span className={`mt-0.5 block text-sm leading-snug ${i === step ? 'text-zinc-100' : 'text-zinc-400'}`}>{s.text}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between gap-3 border-t border-white/15 px-4 py-3 sm:px-5">
            <button
              onClick={play}
              className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border border-white/25 px-4 text-sm font-semibold text-zinc-100 transition-[transform,background-color,border-color] duration-150 ease-punch hover:border-dusk hover:bg-dusk-deep active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              {playing ? <Pause weight="fill" className="h-4 w-4" /> : <Play weight="fill" className="h-4 w-4" />}
              {playing ? 'Pause' : step >= STORM.steps.length - 1 ? 'Replay the day' : 'Play the day'}
            </button>
            <p className="text-right text-xs text-zinc-500">Times are approximate: the report gives “mid-afternoon”, not clock times.</p>
          </div>
        </div>
      </div>

      <ModelChart hour={current.hour} />
    </div>
  )
}

/**
 * What the weather models had for the same hours: small multiples (one row per model) on one
 * shared scale, with the heavy-rain line. One series per row, so no legend: each row is named.
 */
function ModelChart({ hour }: { hour: number }) {
  const [hover, setHover] = useState<{ model: string; h: number; mm: number } | null>(null)
  const peak = useMemo(() => Math.max(...DATA.models.flatMap((m) => m.hourly.slice(HOURS[0], HOURS[0] + HOURS.length))), [])
  const H = 44 // px per row plot
  const y = (mm: number) => Math.min(H, (mm / CHART_MAX) * H)
  const heavyY = H - y(HEAVY_MM_H)

  return (
    <div className="border-t border-white/15 px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="font-display text-lg">What the weather models saw</h3>
        <p className="text-xs text-zinc-400">
          Rain per hour over central Phnom Penh, mm. Highest in any model: <span className="font-mono text-zinc-100">{peak.toFixed(1)}</span>
        </p>
      </div>
      <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-zinc-400">
        Heavy rain starts at {HEAVY_MM_H} mm in an hour. None of the four models came close, yet the streets flooded: the storm was too small and too fast for forecast grids roughly 10 to 25 km across. Only people on those streets could have said where the water was.
      </p>

      <div className="mt-5 space-y-3" onMouseLeave={() => setHover(null)}>
        {DATA.models.map((m) => (
          <div key={m.id} className="grid grid-cols-[112px_1fr] items-end gap-3 sm:grid-cols-[150px_1fr]">
            <p className="pb-0.5 text-xs leading-tight text-zinc-300">{m.label}</p>
            <div className="relative" style={{ height: H }}>
              {/* Heavy-rain reference line */}
              <span className="absolute inset-x-0 border-t border-dashed border-white/25" style={{ top: heavyY }} aria-hidden />
              <span className="absolute inset-x-0 bottom-0 border-t border-white/15" aria-hidden />
              <div className="absolute inset-0 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0, 1fr))` }}>
                {HOURS.map((h) => {
                  const mm = m.hourly[h] ?? 0
                  const now = h === hour
                  return (
                    <div
                      key={h}
                      className={`relative flex items-end ${now ? 'bg-white/[0.06]' : ''}`}
                      onMouseEnter={() => setHover({ model: m.label, h, mm })}
                    >
                      <span className={`w-full ${now ? 'bg-zinc-100' : 'bg-zinc-400'}`} style={{ height: mm > 0 ? Math.max(2, y(mm)) : 0 }} />
                      {hover && hover.model === m.label && hover.h === h && (
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap border border-white/15 bg-void px-2 py-1 font-mono text-[11px] text-zinc-100">
                          {hourLabel(h)}: {mm.toFixed(1)} mm
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
        {/* Hour axis */}
        <div className="grid grid-cols-[112px_1fr] gap-3 sm:grid-cols-[150px_1fr]">
          <span className="text-[10px] text-zinc-500">
            <span className="mr-1 inline-block w-4 border-t border-dashed border-white/40 align-middle" /> heavy rain
          </span>
          <div className="grid gap-[2px] font-mono text-[10px] text-zinc-500" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0, 1fr))` }}>
            {HOURS.map((h) => (
              <span key={h} className={`text-center ${h % 2 ? 'invisible sm:visible' : ''} ${h === hour ? 'text-zinc-100' : ''}`}>
                {hourLabel(h).replace(' ', '')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* The same numbers as a table, for screen readers */}
      <table className="sr-only">
        <caption>Modelled rain per hour on 26 February 2026, mm</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            {HOURS.map((h) => (
              <th key={h} scope="col">{hourLabel(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DATA.models.map((m) => (
            <tr key={m.id}>
              <th scope="row">{m.label}</th>
              {HOURS.map((h) => (
                <td key={h}>{(m.hourly[h] ?? 0).toFixed(1)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[11px] text-zinc-500">
        Model rain: Open-Meteo historical forecast archive (CC BY 4.0). No rain-gauge record for the day is openly published.
      </p>
    </div>
  )
}
