import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PHNOM_PENH_CENTER } from '../../data/routes'
import { hasKhmerNames, learnEnglishNames, routeBetween, withEnglishNames, type FoundPlace } from '../../services/liveRouting'
import { addRoadPaths, metresBetween } from '../lib/trip'
import type { LatLng, Preset } from '../types'

export type GpsStatus = 'off' | 'locating' | 'ok' | 'denied' | 'unavailable'
export interface Gps {
  status: GpsStatus
  point: LatLng | null
  accuracy: number | null
  /** Direction of travel while moving, degrees (from the device, or worked out from the last fixes) */
  heading: number | null
  /** Speed in m/s when the device reports it */
  speed: number | null
}

const bearingBetween = (a: LatLng, b: LatLng) => {
  const r = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(r(b[1] - a[1])) * Math.cos(r(b[0]))
  const x = Math.cos(r(a[0])) * Math.sin(r(b[0])) - Math.sin(r(a[0])) * Math.cos(r(b[0])) * Math.cos(r(b[1] - a[1]))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** The device's real position, watched continuously (live mode only). */
export function useGps(enabled: boolean): Gps {
  const [gps, setGps] = useState<Gps>({ status: enabled ? 'locating' : 'off', point: null, accuracy: null, heading: null, speed: null })
  const last = useRef<{ at: LatLng; heading: number | null } | null>(null)
  // The point on screen: held still while the rider stands still, so GPS wobble does not wander it.
  const shown = useRef<LatLng | null>(null)
  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setGps((g) => ({ ...g, status: 'unavailable' }))
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: LatLng = [pos.coords.latitude, pos.coords.longitude]
        const speed = pos.coords.speed
        // Standing still (or crawling): small moves within the fix's own error are noise. Moving (or
        // once the drift adds up past a few metres), the fix is taken as it is.
        const wobble = Math.min(8, Math.max(3, (pos.coords.accuracy ?? 10) * 0.4))
        const still = (speed === null || speed < 1) && shown.current !== null && metresBetween(shown.current, fix) < wobble
        const at: LatLng = still ? shown.current! : fix
        shown.current = at
        const prev = last.current
        const device = pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && (pos.coords.speed ?? 0) > 0.8 ? pos.coords.heading : null
        // Without a device heading, the direction between fixes far enough apart; otherwise keep the last one.
        const heading = device ?? (prev && metresBetween(prev.at, at) > 8 ? bearingBetween(prev.at, at) : (prev?.heading ?? null))
        if (!prev || metresBetween(prev.at, at) > 8 || device !== null) last.current = { at, heading }
        setGps((g) => (still && g.point === at && g.status === 'ok' ? g : { status: 'ok', point: at, accuracy: pos.coords.accuracy, heading, speed: speed ?? null }))
      },
      (err) => setGps((g) => ({ ...g, status: err.code === err.PERMISSION_DENIED ? 'denied' : g.point ? 'ok' : 'unavailable' })),
      // maximumAge 0: every fix is new, never a cached repeat (a repeat makes the arrow stall, then jump).
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    // No fix after 8 s (e.g. a desktop browser, or indoors): say so, and keep listening.
    const slow = window.setTimeout(() => setGps((g) => (g.point ? g : { ...g, status: 'unavailable' })), 8000)
    return () => {
      navigator.geolocation.clearWatch(id)
      window.clearTimeout(slow)
    }
  }, [enabled])
  return gps
}

export interface LivePlace {
  name: string
  short: string
  lat: number
  lng: number
}
export const placeFrom = (p: FoundPlace): LivePlace => ({ name: p.detail ? `${p.name}, ${p.detail}` : p.name, short: p.name, lat: p.lat, lng: p.lng })

/** A stand-in "trip" while no destination is chosen: a single point where the rider is. */
export function idlePreset(at: LatLng): Preset {
  const point = { name: '', short: '', lat: at[0], lng: at[1] }
  return { id: 'live-idle', label: '', origin: point, destination: point, candidates: [{ id: 'live-idle-a', via: '', typicalMinutes: 0, distanceM: 0, path: [at, at] }] }
}

export type RouteStatus = 'idle' | 'routing' | 'ready' | 'error'

/**
 * Live trip planning, like a normal map app: start from the real GPS fix (or a searched place),
 * pick any destination, fetch real routes, and fetch a fresh route when the rider leaves it.
 */
export function useLiveRoute(gps: Gps, unnamed: string, english: boolean) {
  const [origin, setOrigin] = useState<LivePlace | null>(null) // null = "Your location"
  const [destination, setDestination] = useState<LivePlace | null>(null)
  const [preset, setPreset] = useState<Preset | null>(null)
  const [status, setStatus] = useState<RouteStatus>('idle')
  const [rerouting, setRerouting] = useState(false)
  const tripId = useRef(0)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  /** Where the current route was fetched from: the fix can sit off the road there (inside a building) */
  const routedFrom = useRef<LatLng | null>(null)

  const here: LatLng | null = gps.point
  const fallback = PHNOM_PENH_CENTER as LatLng
  // Route from where the rider is. Without a fix (location off, or none after 8 s) start from the city
  // centre so a route, its brief and Start are still there; the real fix replaces it as soon as it arrives.
  const noFix = !here && (gps.status === 'denied' || gps.status === 'unavailable')
  const start: LatLng | null = origin ? [origin.lat, origin.lng] : (here ?? (noFix ? fallback : null))
  const startKey = origin ? `${origin.lat},${origin.lng}` : here ? 'gps' : noFix ? 'centre' : 'none'

  const fetchRoute = useCallback(
    async (from: LatLng, fromName: string, to: LivePlace, id: string) => {
      controller.current?.abort()
      const ctrl = new AbortController()
      controller.current = ctrl
      generation.current += 1
      try {
        const next = await routeBetween(id, generation.current, { name: fromName, short: fromName, lat: from[0], lng: from[1] }, { name: to.name, short: to.short, lat: to.lat, lng: to.lng }, unnamed, english, ctrl.signal)
        if (ctrl.signal.aborted) return
        addRoadPaths(next.candidates.map((c) => c.path))
        routedFrom.current = from
        setPreset(next)
        setStatus('ready')
        // English, on a route leaving the built-in list's area: the route shows now, and its remaining
        // Khmer street names switch to English when the Overpass lookup returns.
        if (english && hasKhmerNames(next)) {
          void learnEnglishNames(next, ctrl.signal).then((learned) => {
            if (learned && !ctrl.signal.aborted) setPreset((p) => (p === next ? withEnglishNames(next) : p))
          })
        }
      } catch {
        if (!ctrl.signal.aborted) setStatus('error')
      } finally {
        if (controller.current === ctrl) setRerouting(false)
      }
    },
    [unnamed, english],
  )

  // A new start or destination: a new trip.
  useEffect(() => {
    if (!destination || !start) {
      setPreset(null)
      setStatus('idle')
      return
    }
    tripId.current += 1
    setStatus('routing')
    void fetchRoute(start, origin?.short ?? '', destination, `live-${tripId.current}`)
    // Only when the chosen places change (not on every GPS fix).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, startKey])

  /** The rider left the route: the same trip, a fresh route from where they are now. */
  const lastReroute = useRef(0)
  const rerouteFrom = useCallback(
    (from: LatLng, force = false) => {
      if (!destination || !preset || Date.now() - lastReroute.current < 15000) return
      // Still where the route was fetched from: the fix is off the road, not off the route.
      if (!force && routedFrom.current && metresBetween(routedFrom.current, from) < 120) return
      lastReroute.current = Date.now()
      setRerouting(true)
      void fetchRoute(from, preset.origin.short, destination, preset.id)
    },
    [destination, preset, fetchRoute],
  )

  const retry = useCallback(() => {
    if (!destination || !start) return
    setStatus('routing')
    void fetchRoute(start, origin?.short ?? '', destination, `live-${tripId.current}`)
  }, [destination, start, origin, fetchRoute])

  const idleAt = start ?? fallback
  const idle = useMemo(() => idlePreset(idleAt), [idleAt[0], idleAt[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  const trip = preset ?? idle
  return { origin, setOrigin, destination, setDestination, preset, trip, status, rerouting, rerouteFrom, retry, hasStart: !!start, fromCentre: !origin && !here && noFix }
}
