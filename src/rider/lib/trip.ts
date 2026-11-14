// Typed access to the shared routing helpers (plain JS in src/lib and src/data),
// plus the rider-only geometry: puck position, heading, flood segments on roads.

import { ROUTE_PRESETS as RAW_PRESETS } from '../../data/routes'
import { GAZETTEER as RAW_GAZETTEER } from '../../data/gazetteer'
import { analyseCandidate, etaMinutes } from '../../lib/routing'
import { distanceToPath, haversine, nearestPlace, pathLength, pointAlong } from '../../lib/geo'
import { DEPTHS } from '../../lib/severity'
import type { FloodReport } from '../../command/types'
import type { Candidate, FloodSegment, LatLng, Maneuver, Passability, Place, Preset, RouteEntry, VehicleId } from '../types'
import { MANEUVERS } from '../data/maneuvers'

export const PRESETS = RAW_PRESETS as unknown as Preset[]
const GAZETTEER = RAW_GAZETTEER as Place[]

export function analyse(preset: Preset, reports: FloodReport[], vehicle: VehicleId): RouteEntry[] {
  return preset.candidates.map((candidate) => {
    const { blockers, cautions } = analyseCandidate(candidate, reports, vehicle) as { blockers: FloodReport[]; cautions: FloodReport[] }
    return { candidate, minutes: etaMinutes(candidate, vehicle) as number, blockers, cautions }
  })
}

export const passability = (entry: RouteEntry): Passability => (entry.blockers.length ? 'blocked' : entry.cautions.length ? 'caution' : 'dry')

/** Quickest route with no blocking flood; if none exists, the least-flooded one. */
export function safest(entries: RouteEntry[]): RouteEntry {
  const dry = entries.filter((e) => e.blockers.length === 0).sort((a, b) => a.minutes - b.minutes || a.cautions.length - b.cautions.length)
  return dry[0] ?? [...entries].sort((a, b) => a.blockers.length - b.blockers.length || a.minutes - b.minutes)[0]
}

export function exposure(entry: RouteEntry): string {
  if (entry.blockers.length) return `${entry.blockers.length} impassable segment${entry.blockers.length > 1 ? 's' : ''}`
  if (entry.cautions.length) return `${entry.cautions.length} caution zone${entry.cautions.length > 1 ? 's' : ''}`
  return '0 flooded segments'
}

/**
 * Simulated GPS fix: the point on the active route furthest from every other
 * option, so a report filed "here" affects this route and not the alternatives.
 */
export function riderFraction(preset: Preset, routeId: string): number {
  const route = preset.candidates.find((c) => c.id === routeId) ?? preset.candidates[0]
  const others = preset.candidates.filter((c) => c.id !== route.id)
  let best = 0.4
  let bestScore = -1
  for (let f = 0.2; f <= 0.8; f += 0.04) {
    const p = pointAlong(route.path, f) as LatLng
    const score = others.length ? Math.min(...others.map((o) => distanceToPath(p, o.path) as number)) : 1
    if (score > bestScore) {
      bestScore = score
      best = f
    }
  }
  return best
}

export const pointAt = (candidate: Candidate, fraction: number) => pointAlong(candidate.path, fraction) as LatLng

/** Compass bearing (degrees) of the route at a fraction, for the heading cone. */
export function bearingAt(candidate: Candidate, fraction: number): number {
  const a = pointAt(candidate, Math.max(0, fraction - 0.004))
  const b = pointAt(candidate, Math.min(1, fraction + 0.004))
  const toRad = (d: number) => (d * Math.PI) / 180
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]))
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]))
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function placeAt(point: LatLng): Place {
  return (nearestPlace(point, GAZETTEER) as { place: Place }).place
}

export const metresBetween = (a: LatLng, b: LatLng) => haversine(a, b) as number

/** The next turn after the rider's position, with the distance to it. */
export function nextManeuver(candidate: Candidate, fraction: number): { step: Maneuver; metres: number } {
  const steps = MANEUVERS[candidate.id] ?? []
  const step = steps.find((s) => s.at > fraction + 0.01) ?? { at: 1, turn: 'arrive' as const, street: 'Destination' }
  return { step, metres: Math.max(10, Math.round(((step.at - fraction) * candidate.distanceM) / 10) * 10) }
}

// ── Flood segments drawn on road geometry ──
const ALL_PATHS: LatLng[][] = PRESETS.flatMap((p) => p.candidates.map((c) => c.path))
const segmentCache = new Map<string, FloodSegment | null>()

/**
 * The stretch of road a report covers. Road geometry comes from the pre-computed
 * routes, so a report away from every known route has no segment (marker only).
 */
export function floodSegment(report: FloodReport): FloodSegment | null {
  const key = `${report.id}:${report.depth}`
  const cached = segmentCache.get(key)
  if (cached !== undefined) return cached

  const centre: LatLng = [report.lat, report.lng]
  let path: LatLng[] | null = null
  let bestDistance = 70 // metres: the report must sit on the road
  for (const candidate of ALL_PATHS) {
    const d = distanceToPath(centre, candidate) as number
    if (d < bestDistance) {
      bestDistance = d
      path = candidate
    }
  }

  let segment: FloodSegment | null = null
  if (path) {
    const reach = DEPTHS[report.depth].zoneRadius * 0.85
    let nearest = 0
    path.forEach((p, i) => {
      if (metresBetween(p, centre) < metresBetween(path![nearest], centre)) nearest = i
    })
    let from = nearest
    let to = nearest
    while (from > 0 && metresBetween(path[from - 1], centre) <= reach) from--
    while (to < path.length - 1 && metresBetween(path[to + 1], centre) <= reach) to++
    const slice = path.slice(Math.max(0, from - 1), Math.min(path.length, to + 2))
    if (slice.length >= 2) {
      segment = {
        reportId: report.id,
        depth: report.depth,
        kind: report.depth === 'clear' ? 'wet' : report.depth === 'ankle' ? 'caution' : 'impassable',
        coordinates: slice.map(([lat, lng]) => [lng, lat]),
      }
    }
  }
  segmentCache.set(key, segment)
  return segment
}

export const routeLengthKm = (candidate: Candidate) => ((pathLength(candidate.path) as number) / 1000).toFixed(1)
