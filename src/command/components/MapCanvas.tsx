import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MlMap, type Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import khanGeo from '../data/khans.geo.json'
import { MAP_STYLE } from '../mapStyle'
import { LEVEL_COLOR, LEVEL_LABEL, khanById, khanStates, sensorStates, stormCells } from '../data/hydrology'
import type { FloodReport, LayerState, RiskLevel, Ticket, ViewId } from '../types'
import { DEPTHS } from '../../lib/severity'
import { ELEVATION_ZONES } from '../../data/seed'

const CITY_VIEW = { center: [104.905, 11.565] as [number, number], zoom: 11.6 }
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Room for the floating panels so the subject is never hidden behind them. */
function hudPadding() {
  return window.innerWidth >= 1024
    ? { top: 84, bottom: 48, left: 372, right: 412 }
    : { top: 76, bottom: 96, left: 16, right: 16 }
}

function khanCollection(hour: number): FeatureCollection {
  const byId = new Map(khanStates(hour).map((k) => [k.id, k]))
  return {
    type: 'FeatureCollection',
    features: (khanGeo as FeatureCollection).features.map((f) => {
      const state = byId.get(f.properties!.id)!
      return { ...f, properties: { ...f.properties, level: state.level, risk: Math.round(state.risk) } }
    }),
  }
}

const basins: FeatureCollection<Polygon> = {
  type: 'FeatureCollection',
  features: ELEVATION_ZONES.map(
    (zone: { id: string; name: string; outline: number[][] }): Feature<Polygon> => ({
      type: 'Feature',
      properties: { name: zone.name },
      geometry: { type: 'Polygon', coordinates: [[...zone.outline, zone.outline[0]].map(([lat, lng]) => [lng, lat])] },
    }),
  ),
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

interface Props {
  hour: number
  view: ViewId
  layers: LayerState
  selectedKhan: string | null
  onSelectKhan: (id: string | null) => void
  reports: FloodReport[]
  tickets: Ticket[]
  focus: { lat: number; lng: number; key: string } | null
}

export default function MapCanvas({ hour, view, layers, selectedKhan, onSelectKhan, reports, tickets, focus }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const ready = useRef(false)
  const sensorMarkers = useRef(new Map<string, { marker: Marker; el: HTMLElement }>())
  const reportMarkers = useRef<Marker[]>([])
  const ticketMarkers = useRef<Marker[]>([])
  const popup = useRef<maplibregl.Popup | null>(null)
  const selectRef = useRef(onSelectKhan)
  selectRef.current = onSelectKhan
  // Latest props for the one-time load handler
  const latest = useRef({ hour, view, layers, selectedKhan })
  latest.current = { hour, view, layers, selectedKhan }

  // ── Create the map once ──
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: MAP_STYLE,
      center: CITY_VIEW.center,
      zoom: CITY_VIEW.zoom,
      minZoom: 9.5,
      maxZoom: 17,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    mapRef.current = map
    popup.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: 'cc-popup' })

    map.on('error', (e) => console.error('[map]', e.error?.message ?? e))

    map.on('load', () => {
      map.setPadding(hudPadding())
      map.addSource('khans', { type: 'geojson', data: khanCollection(latest.current.hour) })
      map.addSource('basins', { type: 'geojson', data: basins })
      map.addSource('radar', { type: 'geojson', data: stormCells(latest.current.hour) })

      const levelColor = ['match', ['get', 'level'], 'critical', LEVEL_COLOR.critical, 'watch', LEVEL_COLOR.watch, LEVEL_COLOR.nominal] as unknown as string
      const state = (name: string) => ['boolean', ['feature-state', name], false]

      map.addLayer({
        id: 'khan-fill',
        type: 'fill',
        source: 'khans',
        paint: {
          'fill-color': levelColor,
          'fill-opacity': ['case', state('selected'), 0.2, state('hover'), 0.16, ['match', ['get', 'level'], 'critical', 0.11, 'watch', 0.07, 0.03]] as unknown as number,
        },
      })
      map.addLayer({
        id: 'khan-line',
        type: 'line',
        source: 'khans',
        paint: {
          'line-color': ['case', state('selected'), '#E4E4E7', state('hover'), '#A1A1AA', levelColor] as unknown as string,
          'line-width': ['case', state('selected'), 1.8, state('hover'), 1.4, 0.7] as unknown as number,
          'line-opacity': ['case', state('selected'), 1, state('hover'), 0.9, 0.45] as unknown as number,
        },
      })
      map.addLayer({
        id: 'basin-fill',
        type: 'fill',
        source: 'basins',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#0EA5E9', 'fill-opacity': 0.1 },
      })
      map.addLayer({
        id: 'basin-line',
        type: 'line',
        source: 'basins',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#0EA5E9', 'line-width': 1, 'line-dasharray': [3, 3], 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'radar',
        type: 'circle',
        source: 'radar',
        paint: {
          'circle-color': '#0EA5E9',
          'circle-blur': 1,
          'circle-opacity': ['*', 0.5, ['get', 'intensity']] as unknown as number,
          // Constant ground size (~3 km) across zoom levels
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, ['*', 34, ['+', 0.4, ['get', 'intensity']]], 16, ['*', 2176, ['+', 0.4, ['get', 'intensity']]]] as unknown as number,
        },
      })
      map.addLayer({
        id: 'khan-names',
        type: 'symbol',
        source: 'khans',
        maxzoom: 13.5,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.06, 'text-transform': 'uppercase', 'text-max-width': 8 },
        paint: { 'text-color': '#A1A1AA', 'text-halo-color': '#090A0F', 'text-halo-width': 1.2 },
      })

      // Hover + click on a Khan
      let hovered: number | null = null
      const setHover = (id: number | null) => {
        if (hovered !== null) map.setFeatureState({ source: 'khans', id: hovered }, { hover: false })
        hovered = id
        if (id !== null) map.setFeatureState({ source: 'khans', id }, { hover: true })
        map.getCanvas().style.cursor = id !== null ? 'pointer' : ''
      }
      map.on('mousemove', 'khan-fill', (e) => setHover((e.features?.[0]?.id as number) ?? null))
      map.on('mouseleave', 'khan-fill', () => setHover(null))
      map.on('click', 'khan-fill', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (id) selectRef.current(id)
      })

      ready.current = true
      applyLayers(map, latest.current.layers, latest.current.view)
      applySelection(map, latest.current.selectedKhan, null)
      syncSensors(map, latest.current.hour, latest.current.layers.sensors)
    })

    const onResize = () => map.setPadding(hudPadding())
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      ready.current = false
      sensorMarkers.current.clear()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Telemetry nodes: one DOM marker per sensor, restyled as values change ──
  function syncSensors(map: MlMap, atHour: number, visible: boolean) {
    for (const s of sensorStates(atHour)) {
      let entry = sensorMarkers.current.get(s.id)
      if (!entry) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'cc-node'
        el.innerHTML = '<i><b></b></i>'
        const marker = new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map)
        entry = { marker, el }
        sensorMarkers.current.set(s.id, entry)
        el.addEventListener('mouseenter', () => {
          popup.current?.setLngLat([s.lng, s.lat]).setHTML(el.dataset.tip ?? '').addTo(map)
        })
        el.addEventListener('mouseleave', () => popup.current?.remove())
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          selectRef.current(s.khanId)
        })
      }
      const { el } = entry
      el.dataset.level = s.level
      el.dataset.kind = s.kind
      el.style.display = visible ? '' : 'none'
      el.setAttribute('aria-label', `${s.name}: ${s.value} ${s.unit}, ${LEVEL_LABEL[s.level]}`)
      el.dataset.tip = `<p class="cc-popup-id">${s.id}</p><p class="cc-popup-name">${escapeHtml(s.name)}</p><p class="cc-popup-value" style="color:${LEVEL_COLOR[s.level]}">${s.value} ${s.unit} · ${LEVEL_LABEL[s.level]}</p><p class="cc-popup-note">${s.kind === 'pump' ? 'Pump load' : 'Standing water'} · warn at ${s.warn} ${s.unit}</p>`
    }
  }

  // Hour changed: recolour Khans, move the storm cells, update nodes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    ;(map.getSource('khans') as GeoJSONSource).setData(khanCollection(hour))
    ;(map.getSource('radar') as GeoJSONSource).setData(stormCells(hour))
    syncSensors(map, hour, layers.sensors)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, layers.sensors])

  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) applyLayers(map, layers, view)
  }, [layers, view])

  // Selected Khan: outline it and fly there
  const previousKhan = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    applySelection(map, selectedKhan, previousKhan.current)
    previousKhan.current = selectedKhan
  }, [selectedKhan])

  // Citizen flood reports (shared with the rider app)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    reportMarkers.current.forEach((m) => m.remove())
    reportMarkers.current = []
    if (!layers.zones) return
    for (const r of reports) {
      const depth = DEPTHS[r.depth]
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `cc-report${r.isNew ? ' is-new' : ''}`
      el.style.setProperty('--c', depth.color)
      el.setAttribute('aria-label', `${r.name}: ${depth.label}`)
      const tip = `<p class="cc-popup-id">CITIZEN REPORT${r.ai ? ' · AI VERIFIED' : ''}</p><p class="cc-popup-name">${escapeHtml(r.name)}</p><p class="cc-popup-value" style="color:${depth.color}">${depth.label}${r.ai ? ` · ~${r.ai.depthCm} cm` : ''}</p><p class="cc-popup-note">Khan ${escapeHtml(r.khan)} · Sangkat ${escapeHtml(r.sangkat)}</p>`
      el.addEventListener('mouseenter', () => popup.current?.setLngLat([r.lng, r.lat]).setHTML(tip).addTo(map))
      el.addEventListener('mouseleave', () => popup.current?.remove())
      reportMarkers.current.push(new maplibregl.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map))
    }
  }, [reports, layers.zones])

  // Drain tickets, shown in the Drainage & Basins view
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    ticketMarkers.current.forEach((m) => m.remove())
    ticketMarkers.current = []
    if (view !== 'drainage') return
    for (const t of tickets) {
      const level: RiskLevel = t.status === 'dispatched' ? 'nominal' : t.urgency >= 85 ? 'critical' : 'watch'
      const el = document.createElement('div')
      el.className = 'cc-ticket'
      el.style.setProperty('--c', LEVEL_COLOR[level])
      el.textContent = String(t.urgency)
      ticketMarkers.current.push(new maplibregl.Marker({ element: el, offset: [0, -18] }).setLngLat([t.lng, t.lat]).addTo(map))
    }
  }, [tickets, view])

  // Fly to a point picked in a panel (ticket row, sensor)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.flyTo({ center: [focus.lng, focus.lat], zoom: 14.6, duration: 1400, easing: easeOutCubic })
  }, [focus])

  // MapLibre sets its own `position` on the container, so size it from a wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
}

function applyLayers(map: MlMap, layers: LayerState, view: ViewId) {
  const show = (id: string, visible: boolean) => map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  show('radar', layers.radar)
  show('basin-fill', view === 'drainage')
  show('basin-line', view === 'drainage')
}

function applySelection(map: MlMap, selected: string | null, previous: string | null) {
  const featureId = (khanId: string | null) =>
    (khanGeo as FeatureCollection).features.find((f) => f.properties!.id === khanId)?.id as number | undefined
  const prev = featureId(previous)
  const next = featureId(selected)
  if (prev !== undefined) map.setFeatureState({ source: 'khans', id: prev }, { selected: false })
  if (next !== undefined) map.setFeatureState({ source: 'khans', id: next }, { selected: true })
  const khan = khanById(selected)
  if (khan) map.flyTo({ center: [khan.lng, khan.lat], zoom: 13.2, duration: 1600, easing: easeOutCubic })
  else if (previous) map.flyTo({ ...CITY_VIEW, duration: 1400, easing: easeOutCubic })
}
