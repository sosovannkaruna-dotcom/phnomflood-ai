import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MlMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { RIDER_MAP_STYLE } from '../../shared/mapStyle'
import { DEPTHS } from '../../lib/severity'
import type { FloodReport } from '../../shared/types'
import type { LatLng, MapMode, Passability, Preset, RouteEntry } from '../types'
import { floodSegment, passability } from '../lib/trip'

const STATUS_COLOR: Record<Passability, string> = { dry: '#10B981', caution: '#F59E0B', blocked: '#EF4444' }
const lineOf = (path: LatLng[]): LineString => ({ type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) })
const collection = <G extends LineString | Point>(features: Feature<G>[]): FeatureCollection<G> => ({ type: 'FeatureCollection', features })
const EMPTY = collection<LineString>([])

/** Room for the top HUD, the right-edge controls and the collapsed bottom sheet. */
const PADDING = { top: 168, bottom: 284, left: 28, right: 64 }

export interface RiderMapHandle {
  recenter: () => void
  zoomBy: (delta: number) => void
}

interface Props {
  preset: Preset
  entries: RouteEntry[]
  active: RouteEntry
  recalculating: boolean
  reports: FloodReport[]
  mode: MapMode
  position: LatLng
  bearing: number
}

const RiderMap = forwardRef<RiderMapHandle, Props>(function RiderMap({ preset, entries, active, recalculating, reports, mode, position, bearing }, ref) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const ready = useRef(false)
  const puck = useRef<{ marker: Marker; el: HTMLElement; at: LatLng } | null>(null)
  const ends = useRef<Marker[]>([])
  const hazards = useRef<Marker[]>([])
  const latest = useRef({ preset, entries, active, recalculating, reports, mode, position, bearing })
  latest.current = { preset, entries, active, recalculating, reports, mode, position, bearing }

  useImperativeHandle(ref, () => ({
    recenter: () => mapRef.current?.flyTo({ center: [latest.current.position[1], latest.current.position[0]], zoom: 15, duration: 900 }),
    zoomBy: (delta) => mapRef.current?.easeTo({ zoom: (mapRef.current?.getZoom() ?? 13) + delta, duration: 250 }),
  }))

  // ── Draw helpers (read the latest props) ──
  function drawRoutes(map: MlMap) {
    const { entries, active, recalculating, mode } = latest.current
    const standard = entries[0]
    const others = entries.filter((e) => e.candidate.id !== active.candidate.id)
    // Passability layer: every alternative, coloured by whether this vehicle can ride it.
    ;(map.getSource('alternatives') as GeoJSONSource).setData(
      mode === 'passability' ? collection(others.map((e) => ({ type: 'Feature', properties: { color: STATUS_COLOR[passability(e)] }, geometry: lineOf(e.candidate.path) }))) : EMPTY,
    )
    // Flood-depth layer: only the standard route, dashed, for comparison.
    ;(map.getSource('standard') as GeoJSONSource).setData(
      mode === 'depth' && standard.candidate.id !== active.candidate.id
        ? collection([{ type: 'Feature', properties: { color: standard.blockers.length ? '#EF4444' : '#71717A' }, geometry: lineOf(standard.candidate.path) }])
        : EMPTY,
    )
    ;(map.getSource('active') as GeoJSONSource).setData(
      collection([{ type: 'Feature', properties: { color: recalculating ? '#F59E0B' : STATUS_COLOR[passability(active)] }, geometry: lineOf(active.candidate.path) }]),
    )
    // Dashed while recalculating; clearing the property restores a solid line.
    map.setPaintProperty('active-line', 'line-dasharray', recalculating ? [1.5, 1.5] : undefined)
    map.setPaintProperty('active-line', 'line-opacity', recalculating ? 0.6 : 1)
  }

  function drawFloods(map: MlMap) {
    const { reports, mode } = latest.current
    const segments: Feature<LineString>[] = []
    const zones: Feature<Point>[] = []
    hazards.current.forEach((m) => m.remove())
    hazards.current = []

    for (const report of reports) {
      const depth = DEPTHS[report.depth]
      const segment = floodSegment(report)
      if (segment) segments.push({ type: 'Feature', properties: { kind: segment.kind }, geometry: { type: 'LineString', coordinates: segment.coordinates } })
      if (report.depth === 'clear') continue
      zones.push({ type: 'Feature', properties: { color: depth.color, r: depth.zoneRadius / 190 }, geometry: { type: 'Point', coordinates: [report.lng, report.lat] } })

      // Hazard marker: a triangle for stalling-risk water, a small tag for shallow ponding.
      const el = document.createElement('div')
      el.className = `rd-hazard${report.isNew ? ' is-new' : ''}`
      el.dataset.kind = report.depth === 'ankle' ? 'caution' : 'impassable'
      el.style.setProperty('--c', depth.color)
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', `${report.name}: about ${report.ai?.depthCm ?? depth.cm} centimetres of water`)
      el.innerHTML = `<i></i>${mode === 'depth' ? `<span>${report.depth === 'waist' ? '&gt;' : ''}${report.ai?.depthCm ?? depth.cm}<small>cm</small></span>` : ''}`
      hazards.current.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([report.lng, report.lat]).addTo(map))
    }
    ;(map.getSource('segments') as GeoJSONSource).setData(collection(segments))
    ;(map.getSource('zones') as GeoJSONSource).setData(collection(zones))
  }

  function drawEnds(map: MlMap) {
    const { preset } = latest.current
    ends.current.forEach((m) => m.remove())
    ends.current = [preset.origin, preset.destination].map((end, i) => {
      const el = document.createElement('div')
      el.className = i === 0 ? 'rd-end' : 'rd-end is-destination'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', end.name)
      return new maplibregl.Marker({ element: el }).setLngLat([end.lng, end.lat]).addTo(map)
    })
  }

  function fit(map: MlMap, animate = true) {
    const { entries, active } = latest.current
    const bounds = new maplibregl.LngLatBounds()
    for (const path of [active.candidate.path, entries[0].candidate.path]) for (const [lat, lng] of path) bounds.extend([lng, lat])
    map.fitBounds(bounds, { padding: PADDING, duration: animate ? 900 : 0, maxZoom: 15 })
  }

  // ── Create the map once ──
  useEffect(() => {
    const start = latest.current.position
    const map = new maplibregl.Map({
      container: container.current!,
      style: RIDER_MAP_STYLE,
      center: [start[1], start[0]],
      zoom: 12.5,
      minZoom: 10,
      maxZoom: 17.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    mapRef.current = map
    map.on('error', (e) => console.error('[rider map]', e.error?.message ?? e))

    map.on('load', () => {
      for (const id of ['zones', 'alternatives', 'standard', 'active', 'segments']) map.addSource(id, { type: 'geojson', data: EMPTY })
      const round = { 'line-cap': 'round', 'line-join': 'round' } as const
      const color = ['get', 'color'] as unknown as string

      map.addLayer({
        id: 'zone-halo',
        type: 'circle',
        source: 'zones',
        paint: {
          'circle-color': color,
          'circle-opacity': 0.14,
          'circle-stroke-color': color,
          'circle-stroke-opacity': 0.5,
          'circle-stroke-width': 1,
          // Constant ground size (≈190 m at r = 1) across zoom levels
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, ['*', 2.5, ['get', 'r']], 17, ['*', 320, ['get', 'r']]] as unknown as number,
        },
      })
      map.addLayer({ id: 'alt-lines', type: 'line', source: 'alternatives', layout: round, paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.7 } })
      map.addLayer({ id: 'standard-line', type: 'line', source: 'standard', layout: round, paint: { 'line-color': color, 'line-width': 3.5, 'line-dasharray': [0.6, 2.2], 'line-opacity': 0.9 } })
      map.addLayer({ id: 'active-casing', type: 'line', source: 'active', layout: round, paint: { 'line-color': '#0A0A0B', 'line-width': 10 } })
      map.addLayer({ id: 'active-line', type: 'line', source: 'active', layout: round, paint: { 'line-color': color, 'line-width': 5.5 } })
      // Flood segments sit on top of the roads they cover
      map.addLayer({ id: 'seg-wet', type: 'line', source: 'segments', filter: ['==', ['get', 'kind'], 'wet'], layout: round, paint: { 'line-color': '#0EA5E9', 'line-width': 4, 'line-dasharray': [1, 1.8] } })
      map.addLayer({ id: 'seg-caution', type: 'line', source: 'segments', filter: ['==', ['get', 'kind'], 'caution'], layout: round, paint: { 'line-color': '#F59E0B', 'line-width': 8 } })
      map.addLayer({ id: 'seg-impassable', type: 'line', source: 'segments', filter: ['==', ['get', 'kind'], 'impassable'], layout: round, paint: { 'line-color': '#EF4444', 'line-width': 9 } })

      // Rider puck with heading cone
      const el = document.createElement('div')
      el.className = 'rd-puck'
      el.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 32 12 2a36 36 0 0 1 40 0Z" fill="#F4F4F5" fill-opacity="0.22"/><circle cx="32" cy="32" r="10" fill="#0A0A0B"/><circle cx="32" cy="32" r="7.5" fill="#F4F4F5" stroke="#0A0A0B" stroke-width="2"/><path d="M32 26.500 35.500 34 32 32.500 28.500 34Z" fill="#0A0A0B"/></svg>'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', 'Your position')
      const at = latest.current.position
      puck.current = { el, at, marker: new maplibregl.Marker({ element: el }).setLngLat([at[1], at[0]]).addTo(map) }
      ;(el.firstElementChild as SVGElement).style.transform = `rotate(${latest.current.bearing}deg)`

      ready.current = true
      drawRoutes(map)
      drawFloods(map)
      drawEnds(map)
      fit(map, false)
    })

    return () => {
      ready.current = false
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapRef.current && ready.current) drawRoutes(mapRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, active, recalculating, mode])

  useEffect(() => {
    if (mapRef.current && ready.current) drawFloods(mapRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, mode])

  // New trip or new active route: redraw the endpoints and reframe.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    drawEnds(map)
    fit(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, active.candidate.id])

  // Glide the puck to its new fix instead of jumping.
  useEffect(() => {
    const p = puck.current
    if (!p) return
    ;(p.el.firstElementChild as SVGElement).style.transform = `rotate(${bearing}deg)`
    const from = p.at
    const started = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 900)
      const k = 1 - Math.pow(1 - t, 3)
      p.at = [from[0] + (position[0] - from[0]) * k, from[1] + (position[1] - from[1]) * k]
      p.marker.setLngLat([p.at[1], p.at[0]])
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [position, bearing])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
})

export default RiderMap
