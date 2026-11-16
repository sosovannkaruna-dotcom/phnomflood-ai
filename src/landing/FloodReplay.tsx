import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Pause, Play } from '@phosphor-icons/react'
import { RIDER_MAP_STYLE } from '../shared/mapStyle'
import { DEPTHS } from '../lib/severity'

// Flood replay (Open data page): the last days of reports played back on a map. A report shows
// from the moment it was made until riders cleared it, or for 24 hours at most.

export interface HistoryReport {
  id: string
  status: 'active' | 'cleared' | 'expired'
  depth: 'ankle' | 'knee' | 'waist'
  depth_cm: number | null
  depth_source: 'photo_ai' | 'rider'
  drain_blocked: boolean | null
  place: string
  khan: string | null
  sangkat: string | null
  lat: number
  lng: number
  confirmations: number
  reported_at: string
  cleared_at: string | null
}

interface History {
  from: string
  to: string
  window_days: number
  history_available: boolean
  reports: HistoryReport[]
}

type State = { status: 'loading' } | { status: 'ready'; history: History } | { status: 'error' }

const DAY = 24 * 3600 * 1000
const PLAY_MS = 24000 // the whole window plays in about 24 seconds
const COLOUR = ['match', ['get', 'depth'], 'waist', DEPTHS.waist.color, 'knee', DEPTHS.knee.color, DEPTHS.ankle.color] as unknown as string

const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' })

export default function FloodReplay() {
  const [days, setDays] = useState(7)
  const [state, setState] = useState<State>({ status: 'loading' })
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    setState({ status: 'loading' })
    setPlaying(false)
    const controller = new AbortController()
    fetch(`/api/history?days=${days}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((history: History) => {
        setState({ status: 'ready', history })
        setT(Date.parse(history.to))
      })
      .catch((e: Error) => e.name !== 'AbortError' && setState({ status: 'error' }))
    return () => controller.abort()
  }, [days])

  const history = state.status === 'ready' ? state.history : null
  const from = history ? Date.parse(history.from) : Date.now() - days * DAY
  const to = history ? Date.parse(history.to) : Date.now()

  // Each report as a point with the span it was on the map.
  const points = useMemo(
    () =>
      (history?.reports ?? []).map((r) => {
        const t0 = Date.parse(r.reported_at)
        const t1 = Math.min(r.cleared_at ? Date.parse(r.cleared_at) : Infinity, t0 + DAY)
        return { r, t0, t1 }
      }),
    [history],
  )

  // Reports per hour, for the bars under the timeline.
  const buckets = useMemo(() => {
    // Hourly for a day; coarser over longer windows so each bar stays visible on a phone.
    const n = Math.min(96, Math.max(24, Math.round((to - from) / 3600000)))
    const counts = new Array(n).fill(0)
    for (const p of points) {
      const i = Math.floor(((p.t0 - from) / (to - from)) * n)
      if (i >= 0 && i < n) counts[i] += 1
    }
    return counts
  }, [points, from, to])
  const peak = Math.max(1, ...buckets)

  // The map's own callbacks read these, so they always see the latest reports and time.
  const latest = useRef({ points, t })
  latest.current = { points, t }

  const visible = points.filter((p) => p.t0 <= t && p.t1 > t)
  const sofar = points.filter((p) => p.t0 <= t).length

  // The map, created once.
  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!,
      style: RIDER_MAP_STYLE,
      center: [104.915, 11.565],
      zoom: 11.4,
      minZoom: 9,
      maxZoom: 16,
      attributionControl: false,
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.current = m
    m.on('load', () => {
      m.addSource('replay', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'replay-halo',
        type: 'circle',
        source: 'replay',
        paint: { 'circle-radius': ['+', 12, ['*', 2, ['get', 'confirmations']]] as unknown as number, 'circle-color': COLOUR, 'circle-opacity': 0.18, 'circle-blur': 0.4 },
      })
      m.addLayer({
        id: 'replay-dot',
        type: 'circle',
        source: 'replay',
        paint: { 'circle-radius': 5, 'circle-color': COLOUR, 'circle-stroke-color': '#0A0A0B', 'circle-stroke-width': 1.5 },
      })
      ready.current = true
      draw()
      applyTime()
    })
    return () => {
      ready.current = false
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = () => {
    const m = map.current
    if (!m || !ready.current) return
    ;(m.getSource('replay') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: latest.current.points.map(({ r, t0, t1 }) => ({
        type: 'Feature',
        properties: { depth: r.depth, confirmations: Math.min(r.confirmations, 6), t0, t1 },
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      })),
    })
  }
  useEffect(draw, [points]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show only what was on the map at time t (a filter, so scrubbing never rebuilds the data).
  const applyTime = () => {
    const m = map.current
    if (!m || !ready.current) return
    const now = latest.current.t
    const filter = ['all', ['<=', ['get', 't0'], now], ['>', ['get', 't1'], now]] as maplibregl.FilterSpecification
    m.setFilter('replay-dot', filter)
    m.setFilter('replay-halo', filter)
  }
  useEffect(applyTime, [t, points]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play: sweep from the start (or from where the slider is) to now.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const advance = ((now - last) / PLAY_MS) * (to - from)
      last = now
      setT((prev) => Math.min(to, prev + advance))
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, from, to])

  // Reached now: stop.
  useEffect(() => {
    if (playing && t >= to) setPlaying(false)
  }, [playing, t, to])

  const toggle = () => {
    if (!playing && t >= to - 60000) setT(from)
    setPlaying((p) => !p)
  }

  const chip = 'h-9 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal'

  return (
    <div className="border border-white/15">
      <div className="relative h-[420px] bg-void sm:h-[480px]">
        {/* Full size, not absolute: MapLibre's stylesheet makes its container position:relative */}
        <div ref={box} className="h-full w-full" aria-label="Map of Phnom Penh showing flood reports at the chosen time" role="img" />
        {/* On the map now */}
        <div className="pointer-events-none absolute left-3 top-3 border border-white/15 bg-void/90 px-3 py-2">
          <p className="tl-label">On the map at this time</p>
          <p className="mt-0.5 font-mono text-2xl text-zinc-50">{visible.length}</p>
        </div>
        {history && points.length === 0 && (
          <div className="absolute inset-x-3 bottom-3 border border-white/15 bg-void/90 p-4 text-sm leading-relaxed text-zinc-300">
            No reports in the last {history.window_days === 1 ? '24 hours' : `${history.window_days} days`} to replay yet. The replay fills in as riders report floods in the live app.
          </div>
        )}
        {state.status === 'error' && <div className="absolute inset-x-3 bottom-3 border border-white/15 bg-void/90 p-4 text-sm text-flare">The history could not be loaded. Try again in a moment.</div>}
      </div>

      {/* Timeline */}
      <div className="border-t border-white/15 bg-slab p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggle}
            disabled={!history}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid h-11 w-11 shrink-0 place-items-center bg-signal text-zinc-50 transition-transform duration-150 active:scale-[0.95] disabled:bg-white/10 disabled:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-50"
          >
            {playing ? <Pause weight="fill" className="h-5 w-5" /> : <Play weight="fill" className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm text-zinc-50">{history ? fmt.format(t) : '–'}</p>
            <p className="text-xs text-zinc-400">
              {sofar} of {points.length} reports made by this time
            </p>
          </div>
          <div className="flex basis-full border border-white/15 sm:basis-auto [&>button]:flex-1 sm:[&>button]:flex-none" role="group" aria-label="How far back">
            {[1, 7, 30].map((d) => (
              <button key={d} aria-pressed={days === d} onClick={() => setDays(d)} className={`${chip} ${days === d ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-300 hover:bg-dusk-deep'}`}>
                {d === 1 ? '24 h' : `${d} days`}
              </button>
            ))}
          </div>
        </div>

        {/* Reports per hour, then the slider over them */}
        <div className="mt-4 flex h-10 items-end gap-px" aria-hidden>
          {buckets.map((c, i) => (
            <span key={i} className="flex-1" style={{ height: `${c ? Math.max(12, (c / peak) * 100) : 4}%`, background: c ? '#E8301C' : 'rgba(255,255,255,0.1)', opacity: from + ((i + 1) / buckets.length) * (to - from) <= t ? 1 : 0.35 }} />
          ))}
        </div>
        <input
          type="range"
          className="replay-range mt-1 w-full"
          min={from}
          max={to}
          step={60000}
          value={Math.min(to, Math.max(from, t))}
          onChange={(e) => {
            setPlaying(false)
            setT(Number(e.target.value))
          }}
          aria-label="Time"
          aria-valuetext={history ? fmt.format(t) : undefined}
          disabled={!history}
        />
        <div className="mt-1 flex justify-between font-mono text-xs text-zinc-500">
          <span>{history ? fmt.format(from) : ''}</span>
          <span>Now</span>
        </div>
        {history && !history.history_available && <p className="mt-3 text-xs text-zinc-500">Showing the last 24 hours: longer history is not set up on the server yet.</p>}
      </div>
    </div>
  )
}
