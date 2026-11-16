import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { ArrowUpRight } from '@phosphor-icons/react'
import { RIDER_MAP_STYLE } from '../shared/mapStyle'
import { SEED_REPORTS } from '../data/seed'
import { PRESETS, analyse, floodSegment, safest } from '../rider/lib/trip'
import type { FloodReport } from '../shared/types'
import type { LatLng } from '../rider/types'

// The demo's own flood reports, so the hero shows exactly what the app shows.
const REPORTS = (SEED_REPORTS as Omit<FloodReport, 'createdAt'>[]).map((r) => ({ ...r, createdAt: Date.now() })) as FloodReport[]
const lineOf = (path: LatLng[]): LineString => ({ type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) })

/** One trip to feature: the usual map route crosses water and a dry one exists. */
function featuredTrip() {
  for (const preset of PRESETS) {
    const entries = analyse(preset, REPORTS, 'moto')
    const safe = safest(entries)
    if (entries[0].worst > 0 && safe.candidate.id !== entries[0].candidate.id && safe.blockers.length === 0) return { preset, usual: entries[0], safe }
  }
  const entries = analyse(PRESETS[0], REPORTS, 'moto')
  return { preset: PRESETS[0], usual: entries[0], safe: safest(entries) }
}

interface Props {
  onOpen: () => void
}

/**
 * Hero visual: a small live map of central Phnom Penh with the demo's flood reports on real streets,
 * and one trip drawn twice: the usual route (dashed red) and the dry one (green). The floods breathe
 * slowly so it reads as live data, and the camera drifts a few degrees. Tapping it opens the demo.
 */
export default function HeroMap({ onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const { preset, usual, safe } = featuredTrip()
    const map = new maplibregl.Map({
      container: box.current!,
      style: RIDER_MAP_STYLE,
      bounds: [
        [Math.min(preset.origin.lng, preset.destination.lng) - 0.012, Math.min(preset.origin.lat, preset.destination.lat) - 0.012],
        [Math.max(preset.origin.lng, preset.destination.lng) + 0.012, Math.max(preset.origin.lat, preset.destination.lat) + 0.012],
      ],
      fitBoundsOptions: { padding: 24 },
      pitch: 45,
      bearing: -12,
      interactive: false,
      // Credit is shown as text under the map (see Landing), not as a button over it.
      attributionControl: false,
    })
    let pulse = 0
    let on = true

    map.on('load', () => {
      const floods: Feature<LineString>[] = []
      for (const report of REPORTS) {
        const seg = report.depth === 'clear' ? null : floodSegment(report)
        if (seg) floods.push({ type: 'Feature', properties: { deep: seg.kind === 'impassable' }, geometry: { type: 'LineString', coordinates: seg.coordinates } })
      }
      const ends: Feature<Point>[] = [
        { type: 'Feature', properties: { label: preset.origin.short }, geometry: { type: 'Point', coordinates: [preset.origin.lng, preset.origin.lat] } },
        { type: 'Feature', properties: { label: preset.destination.short }, geometry: { type: 'Point', coordinates: [preset.destination.lng, preset.destination.lat] } },
      ]
      const fc = <G extends LineString | Point>(features: Feature<G>[]): FeatureCollection<G> => ({ type: 'FeatureCollection', features })
      map.addSource('floods', { type: 'geojson', data: fc(floods) })
      map.addSource('usual', { type: 'geojson', data: fc([{ type: 'Feature', properties: {}, geometry: lineOf(usual.candidate.path) }]) })
      map.addSource('safe', { type: 'geojson', data: fc([{ type: 'Feature', properties: {}, geometry: lineOf(safe.candidate.path) }]) })
      map.addSource('ends', { type: 'geojson', data: fc(ends) })
      const round = { 'line-cap': 'round', 'line-join': 'round' } as const
      map.addLayer({ id: 'usual', type: 'line', source: 'usual', layout: round, paint: { 'line-color': '#F05252', 'line-width': 3, 'line-dasharray': [0.8, 2], 'line-opacity': 0.85 } })
      map.addLayer({ id: 'safe-casing', type: 'line', source: 'safe', layout: round, paint: { 'line-color': '#0A0A0B', 'line-width': 9 } })
      map.addLayer({ id: 'safe', type: 'line', source: 'safe', layout: round, paint: { 'line-color': '#10B981', 'line-width': 5 } })
      map.addLayer({
        id: 'floods',
        type: 'line',
        source: 'floods',
        layout: round,
        paint: { 'line-color': ['case', ['get', 'deep'], '#F05252', '#F5B342'] as unknown as string, 'line-width': 5, 'line-opacity': 0.8 },
      })
      map.setPaintProperty('floods', 'line-opacity-transition', { duration: 1400, delay: 0 })
      map.addLayer({ id: 'ends', type: 'circle', source: 'ends', paint: { 'circle-radius': 5, 'circle-color': '#0A0A0B', 'circle-stroke-color': '#F4F4F5', 'circle-stroke-width': 2.5 } })
      map.addLayer({
        id: 'ends-label',
        type: 'symbol',
        source: 'ends',
        layout: { 'text-field': ['get', 'label'] as unknown as string, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top' },
        paint: { 'text-color': '#F4F4F5', 'text-halo-color': '#0A0A0B', 'text-halo-width': 1.5 },
      })
      setReady(true)

      if (reduce) return
      // Floods breathe between two opacities: enough to read as live, slow enough not to distract.
      pulse = window.setInterval(() => {
        on = !on
        map.setPaintProperty('floods', 'line-opacity', on ? 0.85 : 0.35)
      }, 1400)
      // The camera drifts a few degrees back and forth.
      const drift = (to: number) => map.rotateTo(to, { duration: 24000, easing: (t) => t })
      map.on('moveend', () => drift(map.getBearing() < -5 ? 8 : -20))
      drift(8)
    })

    return () => {
      window.clearInterval(pulse)
      map.remove()
    }
  }, [])

  return (
    <div className="relative h-full w-full">
      <div ref={box} className={`h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} />
      <button
        onClick={onOpen}
        aria-label="Open the demo on this map"
        className="group absolute inset-0 flex items-end justify-start p-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal"
      >
        <span className="flex items-center gap-1.5 bg-void/90 px-3 py-2 text-xs font-semibold text-zinc-100 transition-transform duration-150 ease-punch group-active:scale-[0.97]">
          Ride this map <ArrowUpRight weight="bold" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </button>
    </div>
  )
}
