import { useEffect, useRef, useState } from 'react'
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { ArrowUpRight, X } from '@phosphor-icons/react'
import { RIDER_MAP_STYLE } from '../shared/mapStyle'
import { SEED_REPORTS } from '../data/seed'
import { DEPTHS } from '../lib/severity'
import { PRESETS, analyse, floodSegment, floodsOnRoute, safest } from '../rider/lib/trip'
import type { FloodReport } from '../shared/types'
import type { LatLng, RouteEntry } from '../rider/types'

// The demo's own flood reports, so the hero shows exactly what the app shows.
type Seed = Omit<FloodReport, 'createdAt'> & { minutesAgo?: number }
const REPORTS = (SEED_REPORTS as Seed[]).map((r) => ({ ...r, createdAt: Date.now() - (r.minutesAgo ?? 0) * 60000 })) as FloodReport[]
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

/** What the readout shows: one flood report, or one of the two routes. */
type Inspect =
  | { kind: 'flood'; report: FloodReport }
  | { kind: 'usual' | 'safe'; entry: RouteEntry; other: RouteEntry }

const HIT_LAYERS = ['floods-hit', 'usual-hit', 'safe-hit']

interface Props {
  onOpen: () => void
}

/**
 * Hero visual: a small live map of central Phnom Penh with the demo's flood reports on real streets,
 * and one trip drawn twice: the usual route (dashed red) and the dry one (green). The floods breathe
 * slowly and the camera drifts a few degrees.
 *
 * Interactive as an instrument, not a toy: hover (or tap) a line and a telemetry readout says what it
 * is: a report's depth and age, or a route's time and the water it crosses. Everything else dims.
 * A click on the open map asks before leaving for the demo; "Ride this map" goes straight there.
 */
export default function HeroMap({ onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [inspect, setInspect] = useState<Inspect | null>(null)
  const [confirming, setConfirming] = useState(false)
  const pinned = useRef(false)
  const openBtn = useRef<HTMLButtonElement>(null)
  const unpin = useRef<() => void>(() => {})

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
      // Pointer events only: the camera never moves under the reader, and the page always scrolls.
      interactive: true,
      dragPan: false,
      dragRotate: false,
      scrollZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      touchZoomRotate: false,
      touchPitch: false,
      // Credit is shown as text under the map (see Landing), not as a button over it.
      attributionControl: false,
    })
    map.getCanvas().style.cursor = 'default'
    let pulse = 0
    let on = true

    const byId = new Map(REPORTS.map((r) => [r.id, r]))
    /** Light the inspected line; dim the rest so it stands alone. */
    const highlight = (target: Inspect | null, floodId?: string) => {
      const dim = (layer: string, lit: boolean, full: number) => map.getLayer(layer) && map.setPaintProperty(layer, 'line-opacity', target && !lit ? 0.18 : full)
      dim('usual', target?.kind === 'usual', 0.85)
      dim('safe', target?.kind === 'safe', 1)
      dim('safe-casing', target?.kind === 'safe', 1)
      if (map.getLayer('floods')) {
        map.setPaintProperty('floods', 'line-width', floodId ? ['case', ['==', ['get', 'id'], floodId], 9, 5] : 5)
        map.setPaintProperty('floods', 'line-opacity', target && target.kind !== 'flood' ? 0.25 : 0.85)
      }
    }
    const pick = (e: MapLayerMouseEvent | maplibregl.MapMouseEvent): { inspect: Inspect; floodId?: string } | null => {
      const hit = map.queryRenderedFeatures(e.point, { layers: HIT_LAYERS })[0]
      if (!hit) return null
      if (hit.layer.id === 'floods-hit') {
        const report = byId.get(String(hit.properties?.id))
        return report ? { inspect: { kind: 'flood', report }, floodId: report.id } : null
      }
      return hit.layer.id === 'usual-hit' ? { inspect: { kind: 'usual', entry: usual, other: safe } } : { inspect: { kind: 'safe', entry: safe, other: usual } }
    }

    map.on('load', () => {
      const floods: Feature<LineString>[] = []
      for (const report of REPORTS) {
        const seg = report.depth === 'clear' ? null : floodSegment(report)
        if (seg) floods.push({ type: 'Feature', properties: { id: report.id, deep: seg.kind === 'impassable' }, geometry: { type: 'LineString', coordinates: seg.coordinates } })
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
      const fade = { duration: 220, delay: 0 }
      map.addLayer({ id: 'usual', type: 'line', source: 'usual', layout: round, paint: { 'line-color': '#F05252', 'line-width': 3, 'line-dasharray': [0.8, 2], 'line-opacity': 0.85} })
      map.addLayer({ id: 'safe-casing', type: 'line', source: 'safe', layout: round, paint: { 'line-color': '#0A0A0B', 'line-width': 9} })
      map.addLayer({ id: 'safe', type: 'line', source: 'safe', layout: round, paint: { 'line-color': '#10B981', 'line-width': 5} })
      map.addLayer({
        id: 'floods',
        type: 'line',
        source: 'floods',
        layout: round,
        paint: { 'line-color': ['case', ['get', 'deep'], '#F05252', '#F5B342'] as unknown as string, 'line-width': 5, 'line-opacity': 0.8},
      })
      map.setPaintProperty('floods', 'line-opacity-transition', { duration: 1400, delay: 0 })
      map.setPaintProperty('floods', 'line-width-transition', fade)
      for (const layer of ['usual', 'safe', 'safe-casing']) map.setPaintProperty(layer, 'line-opacity-transition', fade)
      // Wide invisible lines on top, so a thin line is easy to hover or tap.
      for (const [id, source] of [['usual-hit', 'usual'], ['safe-hit', 'safe'], ['floods-hit', 'floods']] as const) {
        map.addLayer({ id, type: 'line', source, layout: round, paint: { 'line-color': '#000', 'line-width': 18, 'line-opacity': 0 } })
      }
      map.addLayer({ id: 'ends', type: 'circle', source: 'ends', paint: { 'circle-radius': 5, 'circle-color': '#0A0A0B', 'circle-stroke-color': '#F4F4F5', 'circle-stroke-width': 2.5 } })
      map.addLayer({
        id: 'ends-label',
        type: 'symbol',
        source: 'ends',
        layout: { 'text-field': ['get', 'label'] as unknown as string, 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top' },
        paint: { 'text-color': '#F4F4F5', 'text-halo-color': '#0A0A0B', 'text-halo-width': 1.5 },
      })
      setReady(true)

      // Hover inspects (fine pointers); a tap pins the readout, which is how touch screens inspect.
      map.on('mousemove', (e) => {
        if (pinned.current) return
        const found = pick(e)
        map.getCanvas().style.cursor = found ? 'pointer' : 'default'
        setInspect(found?.inspect ?? null)
        highlight(found?.inspect ?? null, found?.floodId)
      })
      map.getCanvas().addEventListener('mouseleave', () => {
        if (pinned.current) return
        setInspect(null)
        highlight(null)
      })
      map.on('click', (e) => {
        const found = pick(e)
        if (found) {
          pinned.current = true
          setConfirming(false)
          setInspect(found.inspect)
          highlight(found.inspect, found.floodId)
          return
        }
        // Open map: first a tap clears a pinned readout, then it asks before leaving the page.
        if (pinned.current) {
          pinned.current = false
          setInspect(null)
          highlight(null)
          return
        }
        setConfirming(true)
      })
      unpin.current = () => {
        pinned.current = false
        setInspect(null)
        highlight(null)
      }

      if (reduce) return
      // Floods breathe between two opacities: enough to read as live, slow enough not to distract.
      // They hold still while something is being inspected.
      pulse = window.setInterval(() => {
        if (pinned.current || map.getCanvas().style.cursor === 'pointer') return
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

  // The confirmation takes focus, and Escape (or Stay) dismisses it.
  useEffect(() => {
    if (!confirming) return
    openBtn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirming(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  return (
    <div className="relative h-full w-full">
      <div ref={box} className={`h-full w-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} aria-hidden />

      {/* Telemetry readout for the inspected line */}
      {ready && (
        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-start">
          {inspect ? (
            <Readout inspect={inspect} onClose={() => unpin.current()} pinned={pinned.current} />
          ) : (
            <span className="hero-hint border border-white/10 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              <span className="hidden [@media(hover:hover)]:inline">Hover</span>
              <span className="[@media(hover:hover)]:hidden">Tap</span> a line to inspect it
            </span>
          )}
        </div>
      )}

      {/* The one direct way in: no confirmation needed */}
      <button
        onClick={onOpen}
        aria-label="Open the demo on this map"
        className="group absolute bottom-3 left-3 flex items-center gap-1.5 bg-void/90 px-3 py-2 text-xs font-semibold text-zinc-100 transition-transform duration-150 ease-punch active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        Ride this map <ArrowUpRight weight="bold" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>

      {/* A click on the open map: ask before leaving the page */}
      {confirming && (
        <div className="hero-confirm absolute inset-0 flex items-end justify-center bg-void/55 p-3" onClick={() => setConfirming(false)}>
          <div
            role="alertdialog"
            aria-labelledby="hero-confirm-title"
            aria-describedby="hero-confirm-text"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[320px] border border-white/15 bg-void p-4"
          >
            <p id="hero-confirm-title" className="font-display text-base text-zinc-50">Open the demo?</p>
            <p id="hero-confirm-text" className="mt-1 text-sm leading-snug text-zinc-400">This leaves the page for the full app, with a scripted storm on this same map.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="h-10 border border-white/25 text-sm font-semibold text-zinc-100 transition-[transform,background-color,border-color] duration-150 ease-punch hover:border-dusk hover:bg-dusk-deep active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
              >
                Stay here
              </button>
              <button
                ref={openBtn}
                onClick={onOpen}
                className="h-10 bg-signal text-sm font-semibold text-zinc-50 transition-transform duration-150 ease-punch active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
              >
                Open demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ago = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000))
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

/** The readout: a mono label line, a title, and two or three figures. */
function Readout({ inspect, onClose, pinned }: { inspect: Inspect; onClose: () => void; pinned: boolean }) {
  let label: string
  let tone: string
  let title: string
  let figures: [string, string][]
  if (inspect.kind === 'flood') {
    const r = inspect.report
    const depth = DEPTHS[r.depth as keyof typeof DEPTHS]
    label = 'Rider report'
    tone = depth.rank >= 2 ? 'text-red-400' : 'text-amber-400'
    title = r.area || r.name
    figures = [
      ['Depth', `${depth.short} · ~${depth.cm} cm`],
      ['Reported', ago(r.createdAt)],
      ['Means', depth.advice.replace(' — ', ': ')],
    ]
  } else {
    const { entry, other } = inspect
    const floods = floodsOnRoute(entry.candidate, REPORTS)
    const deepest = floods.reduce((d, f) => Math.max(d, DEPTHS[f.report.depth as keyof typeof DEPTHS].rank), 0)
    const delta = entry.minutes - other.minutes
    label = inspect.kind === 'usual' ? 'Usual map route' : 'PhnomFlood dry route'
    tone = inspect.kind === 'usual' ? 'text-red-400' : 'text-emerald-400'
    title = `via ${entry.candidate.via}`
    figures = [
      ['Time', `${entry.minutes} min${delta ? ` (${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs ${inspect.kind === 'usual' ? 'dry' : 'usual'})` : ''}`],
      ['Water', floods.length ? `${floods.length} flood${floods.length > 1 ? 's' : ''}, deepest ${['', 'ankle', 'knee', 'waist'][deepest]}` : 'None crossed'],
    ]
  }
  return (
    <div className="hero-readout pointer-events-auto w-full max-w-[290px] border border-white/15 bg-void/92 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${tone}`}>{label}</span>
        {pinned && (
          <button onClick={onClose} aria-label="Close readout" className="-mr-1.5 grid h-6 w-6 place-items-center text-zinc-400 hover:text-zinc-100">
            <X weight="bold" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-zinc-50">{title}</p>
        <dl className="mt-1.5 space-y-0.5">
          {figures.map(([k, v]) => (
            <div key={k} className="flex gap-3 text-xs">
              <dt className="w-16 shrink-0 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{k}</dt>
              <dd className="min-w-0 text-zinc-200">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
