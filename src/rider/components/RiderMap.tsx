import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MlMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import { RIDER_MAP_STYLE } from '../../shared/mapStyle'
import type { FloodReport } from '../../shared/types'
import type { LatLng, MapMode, Passability, Preset, RouteEntry } from '../types'
import { floodSegment, metresBetween, passability } from '../lib/trip'

const STATUS_COLOR: Record<Passability, string> = { dry: '#10B981', caution: '#F59E0B', blocked: '#EF4444' }
const TRAVELED = '#52525B'
const lineOf = (path: LatLng[]): LineString => ({ type: 'LineString', coordinates: path.map(([lat, lng]) => [lng, lat]) })
const collection = <G extends LineString | Point>(features: Feature<G>[]): FeatureCollection<G> => ({ type: 'FeatureCollection', features })
const EMPTY = collection<LineString>([])

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** Signed smallest turn from one compass bearing to another, in degrees (−180…180). */
const turnBetween = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

/** The part of a path between two fractions of its length (0–1). */
function subPath(path: LatLng[], from: number, to: number): LatLng[] {
  if (path.length < 2 || to <= from) return []
  const lengths = [0]
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + metresBetween(path[i - 1], path[i]))
  const total = lengths[lengths.length - 1] || 1
  const at = (m: number): LatLng => {
    for (let i = 1; i < path.length; i++) {
      if (lengths[i] >= m) {
        const seg = lengths[i] - lengths[i - 1]
        const t = seg === 0 ? 0 : (m - lengths[i - 1]) / seg
        return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t]
      }
    }
    return path[path.length - 1]
  }
  const a = Math.max(0, from) * total
  const b = Math.min(1, to) * total
  const out: LatLng[] = [at(a)]
  for (let i = 1; i < path.length - 1; i++) if (lengths[i] > a && lengths[i] < b) out.push(path[i])
  out.push(at(b))
  return out
}

/** Overview: room for the top HUD (status bar, banner, one alert), the right-edge controls and the sheet. */
const PADDING = { top: 210, bottom: 250, left: 44, right: 72 }
const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 }
/** Navigation camera: tilted, close, heading up, with the rider in the lower part of the screen. */
const NAV = { zoom: 16.4, pitch: 58 }
const navPadding = (map: MlMap) => {
  const h = map.getContainer().clientHeight
  return { top: Math.round(h * 0.46), bottom: 88, left: 24, right: 24 }
}

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
  /** Progress along the active route, 0–1 (used while navigating to grey out the ridden part) */
  progress: number
  /** Turn-by-turn navigation: tilted, heading-up camera that follows the rider */
  navigating: boolean
  /** The rider dragged the map away; the camera stops following until re-centred */
  panned: boolean
  onUserPan: () => void
  glideMs: number
  /** Live mode before a destination is chosen: no route or pins, just the rider */
  planning?: boolean
  /** Water at the rider's position: the arrow flashes amber (shallow) or red (deep) */
  floodAt?: 'caution' | 'danger' | null
  /** A flood line was tapped (overview only) */
  onFloodTap?: (reportId: string) => void
  /** Live, heavy rain: places that flooded on two or more days (predicted, drawn apart from reports) */
  hotspots?: { lat: number; lng: number; days: number; deep: number }[]
}

const RiderMap = forwardRef<RiderMapHandle, Props>(function RiderMap(props, ref) {
  const { preset, active, reports, mode, position, bearing, progress, navigating, panned, glideMs, planning = false, floodAt = null } = props
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const ready = useRef(false)
  const puck = useRef<{ marker: Marker; el: HTMLElement; at: LatLng } | null>(null)
  const ends = useRef<Marker[]>([])
  const latest = useRef(props)
  latest.current = props
  // Trip-change choreography state: which trip is on screen, how much of the route is drawn, whether lines are visible.
  const flow = useRef({ progress: 1, visible: 1, frame: 0, timers: [] as number[], drawnPreset: preset.id, lastRoute: active.candidate.id })
  // Navigation loop: where the puck is gliding, the smoothed camera and puck headings, the ridden fraction.
  const nav = useRef({ frame: 0, hold: 0, from: position, to: position, fromF: progress, toF: progress, t0: 0, dur: 1, camBearing: bearing, puckBearing: bearing, fraction: progress })

  const flyToRider = (map: MlMap, duration: number) => {
    const at = nav.current.to
    nav.current.hold = performance.now() + duration
    nav.current.camBearing = latest.current.bearing
    map.flyTo({ center: [at[1], at[0]], zoom: NAV.zoom, pitch: NAV.pitch, bearing: latest.current.bearing, padding: navPadding(map), duration, easing: easeInOutCubic, essential: true })
  }

  useImperativeHandle(ref, () => ({
    recenter: () => {
      const map = mapRef.current
      if (!map) return
      if (latest.current.navigating) flyToRider(map, prefersReducedMotion() ? 0 : 800)
      else map.flyTo({ center: [latest.current.position[1], latest.current.position[0]], zoom: 15, duration: 900 })
    },
    zoomBy: (delta) => mapRef.current?.easeTo({ zoom: (mapRef.current?.getZoom() ?? 13) + delta, duration: 250 }),
  }))

  // ── Draw helpers (read the latest props) ──
  function drawRoutes(map: MlMap) {
    const { entries, active, recalculating, mode, navigating, planning } = latest.current
    if (planning) {
      for (const id of ['alternatives', 'standard', 'traveled', 'active']) (map.getSource(id) as GeoJSONSource).setData(EMPTY)
      return
    }
    const standard = entries[0]
    const others = entries.filter((e) => e.candidate.id !== active.candidate.id)
    const { progress: drawn, visible } = flow.current
    const color = recalculating ? '#F59E0B' : STATUS_COLOR[passability(active)]
    // Overview only: alternatives (passability mode) and the standard route for comparison.
    ;(map.getSource('alternatives') as GeoJSONSource).setData(
      !navigating && mode === 'passability' ? collection(others.map((e) => ({ type: 'Feature', properties: { color: STATUS_COLOR[passability(e)] }, geometry: lineOf(e.candidate.path) }))) : EMPTY,
    )
    ;(map.getSource('standard') as GeoJSONSource).setData(
      !navigating && mode === 'depth' && standard.candidate.id !== active.candidate.id
        ? collection([{ type: 'Feature', properties: { color: standard.blockers.length ? '#EF4444' : '#71717A' }, geometry: lineOf(standard.candidate.path) }])
        : EMPTY,
    )
    if (navigating) {
      // Navigating: the ridden part turns grey; the rest is drawn forward from the rider.
      const f = nav.current.fraction
      const ahead = subPath(active.candidate.path, f, f + (1 - f) * drawn)
      ;(map.getSource('traveled') as GeoJSONSource).setData(collection([{ type: 'Feature', properties: { color: TRAVELED }, geometry: lineOf(subPath(active.candidate.path, 0, f)) }]))
      ;(map.getSource('active') as GeoJSONSource).setData(ahead.length > 1 ? collection([{ type: 'Feature', properties: { color }, geometry: lineOf(ahead) }]) : EMPTY)
    } else {
      ;(map.getSource('traveled') as GeoJSONSource).setData(EMPTY)
      ;(map.getSource('active') as GeoJSONSource).setData(collection([{ type: 'Feature', properties: { color }, geometry: lineOf(subPath(active.candidate.path, 0, drawn) ) }]))
    }
    // Dashed while recalculating; clearing the property restores a solid line.
    map.setPaintProperty('active-line', 'line-dasharray', recalculating ? [1.5, 1.5] : undefined)
    // `visible` fades every route line out and back in around a trip change.
    map.setPaintProperty('active-line', 'line-opacity', (recalculating ? 0.6 : 1) * visible)
    map.setPaintProperty('active-casing', 'line-opacity', visible)
    map.setPaintProperty('alt-lines', 'line-opacity', 0.7 * visible)
    map.setPaintProperty('standard-line', 'line-opacity', 0.9 * visible)
  }

  /** Floods are drawn only as thin, translucent lines on the roads they cover: no markers, tags or circles. */
  function drawFloods(map: MlMap) {
    const { reports } = latest.current
    const segments: Feature<LineString>[] = []
    for (const report of reports) {
      if (report.depth === 'clear') continue
      const segment = floodSegment(report)
      if (segment) segments.push({ type: 'Feature', properties: { kind: segment.kind, reportId: report.id }, geometry: { type: 'LineString', coordinates: segment.coordinates } })
    }
    ;(map.getSource('segments') as GeoJSONSource).setData(collection(segments))
  }

  /** Start (A) and destination (B) as labelled pins: a letter badge plus the place name. */
  function drawEnds(map: MlMap) {
    const { preset } = latest.current
    const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
    ends.current.forEach((m) => m.remove())
    ends.current = []
    if (latest.current.planning) return
    ends.current = [
      { point: preset.origin, kind: 'start', letter: 'A', caption: 'Start' },
      { point: preset.destination, kind: 'destination', letter: 'B', caption: 'Destination' },
    ].map(({ point, kind, letter, caption }) => {
      const el = document.createElement('div')
      el.className = `rd-pin is-${kind}`
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', `${caption}: ${point.name}`)
      el.innerHTML = `<i>${letter}</i><span><small>${caption}</small><b>${esc(point.short)}</b></span>`
      // The badge sits exactly on the point; the label opens to whichever side has room.
      return new maplibregl.Marker({ element: el }).setLngLat([point.lng, point.lat]).addTo(map)
    })
    flipLabels(map)
  }

  /** Put each label on the side of its badge with more screen room, so it is never clipped or under a control. */
  function flipLabels(map: MlMap) {
    const width = map.getContainer().clientWidth
    const need = 190
    for (const marker of ends.current) {
      const x = map.project(marker.getLngLat()).x
      const roomRight = width - 70 - x // the zoom / locate buttons sit in the right edge
      const roomLeft = x
      marker.getElement().classList.toggle('is-flip', roomRight < need && roomLeft > roomRight)
    }
  }

  /** Draw the active route on: from its start in the overview, forward from the rider while navigating. */
  function drawOn(map: MlMap, ms: number) {
    const f = flow.current
    cancelAnimationFrame(f.frame)
    if (ms <= 0) {
      f.progress = 1
      drawRoutes(map)
      return
    }
    const started = performance.now()
    f.progress = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / ms)
      f.progress = 1 - Math.pow(1 - t, 3)
      drawRoutes(map)
      if (t < 1) f.frame = requestAnimationFrame(step)
    }
    f.frame = requestAnimationFrame(step)
  }

  /** Endpoints and the rider puck fade with the routes, so nothing pops. */
  function markersOpacity(value: number) {
    ends.current.forEach((m) => (m.getElement().style.opacity = String(value)))
    if (puck.current) puck.current.el.style.opacity = String(value)
  }

  function fit(map: MlMap, animate = true) {
    const { entries, active, planning, position } = latest.current
    // The navigation camera leaves a large screen padding on the map (rider low on screen). MapLibre adds
    // it to any fit, so it must be cleared first, or the fit is taller than the map and silently does nothing.
    map.setPadding(NO_PADDING)
    if (planning) {
      map.easeTo({ center: [position[1], position[0]], zoom: 15, bearing: 0, pitch: 0, padding: NO_PADDING, duration: animate && !prefersReducedMotion() ? 1200 : 0, easing: easeInOutCubic })
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    for (const path of [active.candidate.path, entries[0].candidate.path]) for (const [lat, lng] of path) bounds.extend([lng, lat])
    // Keep the padding within the map's size on short screens.
    const h = map.getContainer().clientHeight
    const room = Math.min(1, (h - 160) / (PADDING.top + PADDING.bottom))
    const padding = { ...PADDING, top: Math.round(PADDING.top * room), bottom: Math.round(PADDING.bottom * room) }
    map.fitBounds(bounds, { padding, duration: animate && !prefersReducedMotion() ? 1500 : 0, maxZoom: 15, bearing: 0, pitch: 0, easing: easeInOutCubic })
  }

  function drawHotspots(map: maplibregl.Map) {
    const spots = latest.current.hotspots ?? []
    ;(map.getSource('hotspots') as GeoJSONSource | undefined)?.setData(
      collection(spots.map((s) => ({ type: 'Feature', properties: { days: s.days, deep: s.deep }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } }))),
    )
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
      maxZoom: 18.5,
      maxPitch: 65,
      // Credit is shown as text in the expanded sheet, not as a button over the map.
      attributionControl: false,
      // Two-finger tilt and rotate, like any map app (rotation pauses the follow camera while navigating).
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
    })
    mapRef.current = map
    map.on('error', (e) => console.error('[rider map]', e.error?.message ?? e))
    map.on('moveend', () => flipLabels(map))
    // A drag by the rider (not by the camera) pauses following, like any navigation app.
    const userMoved = (e: { originalEvent?: Event }) => {
      if (latest.current.navigating && e.originalEvent) latest.current.onUserPan()
    }
    map.on('dragstart', userMoved)
    map.on('rotatestart', userMoved)

    map.on('load', () => {
      for (const id of ['alternatives', 'standard', 'traveled', 'active', 'segments', 'hotspots']) map.addSource(id, { type: 'geojson', data: EMPTY })
      const round = { 'line-cap': 'round', 'line-join': 'round' } as const
      const color = ['get', 'color'] as unknown as string

      // Flood-prone spots: a soft water-blue disc under everything else, so predicted water never
      // reads like a report. Larger where it has flooded on more days.
      const spotRadius = ['interpolate', ['exponential', 2], ['zoom'], 11, ['+', 4, ['*', 0.6, ['get', 'days']]], 15, ['+', 22, ['*', 3, ['get', 'days']]], 18, ['+', 120, ['*', 12, ['get', 'days']]]] as unknown as number
      map.addLayer({
        id: 'hotspot-disc',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': spotRadius,
          'circle-color': '#38BDF8',
          'circle-opacity': ['case', ['>', ['get', 'deep'], 0], 0.2, 0.13] as unknown as number,
          'circle-stroke-color': '#38BDF8',
          'circle-stroke-width': 1.25,
          'circle-stroke-opacity': 0.75,
          'circle-blur': 0.15,
        },
      })

      map.addLayer({ id: 'alt-lines', type: 'line', source: 'alternatives', layout: round, paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.7 } })
      map.addLayer({ id: 'standard-line', type: 'line', source: 'standard', layout: round, paint: { 'line-color': color, 'line-width': 3.5, 'line-dasharray': [0.6, 2.2], 'line-opacity': 0.9 } })
      map.addLayer({ id: 'traveled-line', type: 'line', source: 'traveled', layout: round, paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 5, 17, 12] as unknown as number } })
      map.addLayer({ id: 'active-casing', type: 'line', source: 'active', layout: round, paint: { 'line-color': '#0A0A0B', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 10, 17, 20] as unknown as number } })
      map.addLayer({ id: 'active-line', type: 'line', source: 'active', layout: round, paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 5.5, 17, 13] as unknown as number } })
      // Flood segments sit on top of the roads they cover
      // Flood segments: thin and translucent on top of the roads they cover, so they read without shouting.
      const segWidth = ['interpolate', ['linear'], ['zoom'], 12, 2, 15, 3.5, 18, 6] as unknown as number
      map.addLayer({ id: 'seg-caution', type: 'line', source: 'segments', filter: ['==', ['get', 'kind'], 'caution'], layout: round, paint: { 'line-color': '#F5B342', 'line-width': segWidth, 'line-opacity': 0.5 } })
      // A wide invisible line over each flood, so the thin visible one is easy to tap with a thumb.
      map.addLayer({ id: 'seg-hit', type: 'line', source: 'segments', layout: round, paint: { 'line-color': '#000000', 'line-width': 22, 'line-opacity': 0 } })
      map.on('click', 'seg-hit', (e) => {
        const id = e.features?.[0]?.properties?.reportId as string | undefined
        if (id && !latest.current.navigating) latest.current.onFloodTap?.(id)
      })
      map.on('mouseenter', 'seg-hit', () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', 'seg-hit', () => (map.getCanvas().style.cursor = ''))
      map.addLayer({ id: 'seg-impassable', type: 'line', source: 'segments', filter: ['==', ['get', 'kind'], 'impassable'], layout: round, paint: { 'line-color': '#F05252', 'line-width': segWidth, 'line-opacity': 0.55 } })

      // Rider puck: a dot with a heading cone in the overview, a flat arrow on the road while navigating.
      // It is aligned to the map, so it turns and tilts with the street.
      const el = document.createElement('div')
      el.className = 'rd-puck'
      el.innerHTML =
        '<svg viewBox="0 0 64 64" aria-hidden="true">' +
        '<g class="puck-dot"><path d="M32 32 12 2a36 36 0 0 1 40 0Z" fill="#F4F4F5" fill-opacity="0.22"/><circle cx="32" cy="32" r="10" fill="#0A0A0B"/><circle cx="32" cy="32" r="7.5" fill="#F4F4F5" stroke="#0A0A0B" stroke-width="2"/><path d="M32 26.500 35.500 34 32 32.500 28.500 34Z" fill="#0A0A0B"/></g>' +
        '<g class="puck-arrow"><path d="M32 8 52 54 32 44 12 54Z" fill="#F4F4F5" stroke="#0A0A0B" stroke-width="4" stroke-linejoin="round"/></g>' +
        '</svg>'
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', 'Your position')
      const at = latest.current.position
      puck.current = {
        el,
        at,
        marker: new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([at[1], at[0]]).setRotation(latest.current.bearing).addTo(map),
      }

      for (const id of ['alt-lines', 'standard-line', 'active-casing', 'active-line']) map.setPaintProperty(id, 'line-opacity-transition', { duration: 320, delay: 0 })

      ready.current = true
      drawHotspots(map)
      drawFloods(map)
      drawEnds(map)
      fit(map, false)
      drawOn(map, prefersReducedMotion() ? 0 : 1100)
    })

    return () => {
      ready.current = false
      cancelAnimationFrame(flow.current.frame)
      cancelAnimationFrame(nav.current.frame)
      flow.current.timers.forEach((t) => window.clearTimeout(t))
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // While a trip change is being choreographed, that effect owns the drawing.
    if (mapRef.current && ready.current && flow.current.drawnPreset === latest.current.preset.id) drawRoutes(mapRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.entries, active, props.recalculating, mode])

  useEffect(() => {
    if (mapRef.current && ready.current) drawHotspots(mapRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.hotspots])

  useEffect(() => {
    if (mapRef.current && ready.current) drawFloods(mapRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, mode])

  // New route in the same trip: lay it down. New trip: fade out, fly the camera, then draw the new route on.
  useEffect(() => {
    const map = mapRef.current
    const f = flow.current
    if (!map || !ready.current) return
    const tripChanged = f.drawnPreset !== preset.id
    const routeChanged = f.lastRoute !== active.candidate.id
    f.lastRoute = active.candidate.id
    if (!tripChanged && !routeChanged) return

    const calm = prefersReducedMotion()
    f.timers.forEach((t) => window.clearTimeout(t))
    f.timers = []
    cancelAnimationFrame(f.frame)

    if (!tripChanged) {
      if (!latest.current.navigating) fit(map)
      drawOn(map, calm ? 0 : 800)
      return
    }

    // 1. Fade the old trip out.
    f.visible = 0
    drawRoutes(map)
    markersOpacity(0)

    // 2. Swap in the new trip while it is invisible, and start the camera.
    f.timers.push(
      window.setTimeout(
        () => {
          f.drawnPreset = preset.id
          f.progress = 0
          drawRoutes(map)
          drawEnds(map)
          markersOpacity(0)
          const p = puck.current
          if (p) {
            const at = latest.current.position
            p.at = at
            p.marker.setLngLat([at[1], at[0]]).setRotation(latest.current.bearing)
          }
          fit(map)

          // 3. When the camera lands, fade the markers in and draw the route on.
          f.timers.push(
            window.setTimeout(
              () => {
                f.visible = 1
                markersOpacity(1)
                drawOn(map, calm ? 0 : 1000)
              },
              calm ? 0 : 1350,
            ),
          )
        },
        calm ? 0 : 340,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, active.candidate.id])

  // Overview: glide the puck to its new fix instead of jumping.
  useEffect(() => {
    const p = puck.current
    if (!p || navigating || flow.current.drawnPreset !== latest.current.preset.id) return
    p.marker.setRotation(bearing)
    const from = p.at
    const started = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / glideMs)
      const k = 1 - Math.pow(1 - t, 3)
      p.at = [from[0] + (position[0] - from[0]) * k, from[1] + (position[1] - from[1]) * k]
      p.marker.setLngLat([p.at[1], p.at[0]])
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, bearing])

  // Navigating: each new fix starts a linear glide that the frame loop below plays out.
  useEffect(() => {
    if (!navigating || !puck.current) return
    const n = nav.current
    n.from = puck.current.at
    n.to = position
    n.fromF = n.fraction
    n.toF = progress
    n.t0 = performance.now()
    n.dur = glideMs
  }, [position, progress, navigating, glideMs])

  // Start navigation: tilt and turn the camera behind the rider, then run a per-frame loop that moves
  // the puck, turns smoothly through corners and keeps the camera on the rider. Stop: back to the overview.
  useEffect(() => {
    const map = mapRef.current
    const p = puck.current
    if (!map || !ready.current || !p) return
    const calm = prefersReducedMotion()
    const n = nav.current
    p.el.toggleAttribute('data-nav', navigating)
    // Navigating from the start point: the rider arrow replaces the "A" pin there.
    const startPin = ends.current[0]?.getElement()
    if (startPin) startPin.style.visibility = navigating ? 'hidden' : ''

    if (!navigating) {
      cancelAnimationFrame(n.frame)
      flow.current.progress = 1
      drawRoutes(map)
      map.easeTo({ pitch: 0, bearing: 0, padding: NO_PADDING, duration: calm ? 0 : 700, easing: easeInOutCubic })
      const t = window.setTimeout(() => fit(map), calm ? 0 : 720)
      return () => window.clearTimeout(t)
    }

    n.from = n.to = position
    n.fromF = n.toF = n.fraction = progress
    n.t0 = performance.now()
    n.dur = 1
    n.camBearing = n.puckBearing = bearing
    flyToRider(map, calm ? 0 : 1300)

    const loop = (now: number) => {
      const k = Math.min(1, (now - n.t0) / Math.max(1, n.dur))
      const at: LatLng = [n.from[0] + (n.to[0] - n.from[0]) * k, n.from[1] + (n.to[1] - n.from[1]) * k]
      n.fraction = n.fromF + (n.toF - n.fromF) * k
      p.at = at
      p.marker.setLngLat([at[1], at[0]])
      // Ease the headings toward the route's direction so corners turn smoothly, not in one jump.
      const target = latest.current.bearing
      n.puckBearing += turnBetween(n.puckBearing, target) * (calm ? 1 : 0.18)
      n.camBearing += turnBetween(n.camBearing, target) * (calm ? 1 : 0.06)
      p.marker.setRotation(n.puckBearing)
      if (!latest.current.panned && now > n.hold) {
        map.jumpTo({ center: [at[1], at[0]], bearing: n.camBearing, padding: navPadding(map) })
      }
      drawRoutes(map)
      n.frame = requestAnimationFrame(loop)
    }
    n.frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(n.frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating])

  // Riding through water: the arrow flashes amber or red until the rider is out of it.
  useEffect(() => {
    const p = puck.current
    if (!p) return
    if (floodAt) p.el.dataset.flood = floodAt
    else delete p.el.dataset.flood
  }, [floodAt])

  // Live: the GPS fix arrives after the map loads; centre on it while there is no route yet
  // (again only if the fix jumps far, e.g. from the city-centre stand-in to the real position).
  const centredOn = useRef<LatLng | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current || !planning) {
      if (!planning) centredOn.current = null
      return
    }
    if (centredOn.current && metresBetween(centredOn.current, position) < 500) return
    centredOn.current = position
    fit(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planning, position])

  // Re-centred after a drag: fly back behind the rider.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current || !navigating || panned) return
    flyToRider(map, prefersReducedMotion() ? 0 : 700)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panned])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
})

export default RiderMap
