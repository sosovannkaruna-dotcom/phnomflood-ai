// Typed access to the shared routing helpers (plain JS in src/lib and src/data),
// plus the rider-only geometry: puck position, heading, flood segments on roads.

import { ROUTE_PRESETS as RAW_PRESETS } from '../../data/routes'
import { drainMinutes } from '../../lib/confidence'
import { GAZETTEER as RAW_GAZETTEER } from '../../data/gazetteer'
import { analyseCandidate, etaMinutes } from '../../lib/routing'
import { distanceToPath, haversine, nearestPlace, pathLength, pointAlong } from '../../lib/geo'
import { DEPTHS } from '../../lib/severity'
import type { FloodReport } from '../../shared/types'
import type { Candidate, FloodSegment, LatLng, Maneuver, Passability, Place, Preset, RouteEntry, VehicleId } from '../types'
import { MANEUVERS } from '../data/maneuvers'

export const PRESETS = RAW_PRESETS as unknown as Preset[]
const GAZETTEER = RAW_GAZETTEER as Place[]

export function analyse(preset: Preset, reports: FloodReport[], vehicle: VehicleId): RouteEntry[] {
  return preset.candidates.map((candidate) => {
    const { blockers, cautions } = analyseCandidate(candidate, reports, vehicle) as { blockers: FloodReport[]; cautions: FloodReport[] }
    return { candidate, minutes: etaMinutes(candidate, vehicle) as number, blockers, cautions, worst: worstDepth(candidate, reports) }
  })
}

/** Deepest water anywhere on a route (depth rank 0–3), whatever the vehicle. */
function worstDepth(candidate: Candidate, reports: FloodReport[]): number {
  let worst = 0
  for (const report of reports) {
    const depth = DEPTHS[report.depth]
    if (!depth || depth.rank <= worst) continue
    if ((distanceToPath([report.lat, report.lng], candidate.path) as number) <= depth.zoneRadius + 25) worst = depth.rank
  }
  return worst
}

/**
 * Where (0–1 along `from`) the route `to` leaves it. A rider past this point can only switch
 * to `to` by turning around. 1 means `to` never leaves `from`.
 */
const divergeCache = new Map<string, number>()
export function divergence(from: Candidate, to: Candidate): number {
  if (from.id === to.id) return 1
  const key = `${from.id}|${to.id}`
  const cached = divergeCache.get(key)
  if (cached !== undefined) return cached
  let result = 1
  const step = Math.min(0.02, 20 / Math.max(1, from.distanceM))
  for (let f = 0; f <= 1; f += step) {
    if ((distanceToPath(pointAlong(from.path, f) as LatLng, to.path) as number) > 35) {
      result = Math.max(0, f - step)
      break
    }
  }
  divergeCache.set(key, result)
  return result
}

export const passability = (entry: RouteEntry): Passability => (entry.blockers.length ? 'blocked' : entry.cautions.length ? 'caution' : 'dry')

/**
 * The route with the shallowest water: never one with deeper water than another option
 * (ankle never becomes knee). Among equally shallow routes, the quickest.
 * If every route is blocked, the one with the shallowest worst flood.
 */
export function safest(entries: RouteEntry[]): RouteEntry {
  const byDepth = (a: RouteEntry, b: RouteEntry) => a.worst - b.worst || a.minutes - b.minutes || a.cautions.length - b.cautions.length
  const dry = entries.filter((e) => e.blockers.length === 0).sort(byDepth)
  return dry[0] ?? [...entries].sort((a, b) => a.worst - b.worst || a.blockers.length - b.blockers.length || a.minutes - b.minutes)[0]
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

/** The turn after next, for a "Then" hint under the main instruction. */
const stepsOf = (candidate: Candidate): Maneuver[] => candidate.maneuvers ?? MANEUVERS[candidate.id] ?? []

export function thenManeuver(candidate: Candidate, fraction: number): Maneuver | null {
  const steps = stepsOf(candidate)
  const upcoming = steps.filter((s) => s.at > fraction + 0.01)
  return upcoming[1] ?? null
}

/** Distance left to ride, in metres. */
export const remainingMetres = (candidate: Candidate, fraction: number) => Math.max(0, Math.round((1 - fraction) * candidate.distanceM))

/** The whole turn list of a route with distances from the start, for the brief before Start. */
export function routeSteps(candidate: Candidate): { turn: Maneuver['turn']; street: string; km: string }[] {
  return stepsOf(candidate).map((s) => {
    const m = s.at * candidate.distanceM
    return { turn: s.turn, street: s.street, km: m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m` }
  })
}

/** The next turn after the rider's position, with the distance to it. */
export function nextManeuver(candidate: Candidate, fraction: number): { step: Maneuver; metres: number } {
  const steps = stepsOf(candidate)
  const step = steps.find((s) => s.at > fraction + 0.01) ?? { at: 1, turn: 'arrive' as const, street: 'Destination' }
  return { step, metres: Math.max(10, Math.round(((step.at - fraction) * candidate.distanceM) / 10) * 10) }
}

// ── Flood segments drawn on road geometry ──
const ALL_PATHS: LatLng[][] = PRESETS.flatMap((p) => p.candidates.map((c) => c.path))
const segmentCache = new Map<string, FloodSegment | null>()

/** Live mode: roads of routes fetched at runtime, so reports on them are drawn as segments too. */
export function addRoadPaths(paths: LatLng[][]) {
  let added = false
  for (const path of paths) {
    if (path.length > 1 && !ALL_PATHS.includes(path)) {
      ALL_PATHS.push(path)
      added = true
    }
  }
  if (added) segmentCache.clear()
}

/**
 * The deepest flood whose stretch of road covers this point (the same reach as the drawn segment),
 * or null on dry road. Used to flash the rider arrow while riding through water.
 */
export function floodAt(point: LatLng, reports: FloodReport[]): FloodReport | null {
  let worst: FloodReport | null = null
  for (const report of reports) {
    const depth = DEPTHS[report.depth]
    if (!depth || depth.rank === 0) continue
    if (metresBetween(point, [report.lat, report.lng]) > depth.zoneRadius * 0.85) continue
    if (!worst || depth.rank > DEPTHS[worst.depth].rank) worst = report
  }
  return worst
}

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

/**
 * Rough minutes until a flood drains enough to ride through, from its depth, the rain falling now and
 * how long ago it was reported. An estimate, not a measurement: Phnom Penh street floods typically drain
 * over one to a few hours, slower while it keeps raining. Replace with per-street history once collected.
 */
export function clearsIn(report: FloodReport, rainNow: number, now = Date.now()): number {
  const cm = report.ai?.depthCm ?? DEPTHS[report.depth]?.cm ?? 0
  if (!cm) return 0
  const total = drainMinutes(cm, rainNow)
  const age = Math.max(0, (now - report.createdAt) / 60000)
  return Math.max(0, Math.round((total - age) / 5) * 5)
}

/** Floods on a route, each with where (0–1 along the route) its flooded stretch begins. */
export function floodsOnRoute(candidate: Candidate, reports: FloodReport[]): { report: FloodReport; entry: number }[] {
  if (candidate.distanceM <= 0) return []
  const out: { report: FloodReport; entry: number }[] = []
  for (const report of reports) {
    const depth = DEPTHS[report.depth]
    if (!depth || depth.rank === 0) continue
    const centre: LatLng = [report.lat, report.lng]
    const reach = depth.zoneRadius * 0.85
    if ((distanceToPath(centre, candidate.path) as number) > reach) continue
    const at = fractionNear(candidate, centre)
    out.push({ report, entry: Math.max(0, at - reach / candidate.distanceM) })
  }
  return out.sort((a, b) => a.entry - b.entry)
}

/** The next flooded stretch ahead of the rider within `within` metres, with the distance to it. */
export function floodAhead(floods: { report: FloodReport; entry: number }[], candidate: Candidate, fraction: number, within: number) {
  for (const f of floods) {
    const metres = (f.entry - fraction) * candidate.distanceM
    if (metres > 0 && metres <= within) return { report: f.report, metres: Math.max(10, Math.round(metres / 10) * 10) }
  }
  return null
}

// ── Ride simulation helpers ──

/** Fraction (0–1) along a route of the point nearest to `point`, so a ride continues where the rider is. */
export function fractionNear(candidate: Candidate, point: LatLng): number {
  const path = candidate.path
  let total = 0
  const cumulative = [0]
  for (let i = 1; i < path.length; i++) {
    total += metresBetween(path[i - 1], path[i])
    cumulative.push(total)
  }
  let best = 0
  let bestDistance = Infinity
  // Check points every ~25 m along the route for a smooth answer.
  for (let f = 0; f <= 1.0001; f += Math.min(0.01, 25 / Math.max(total, 1))) {
    const p = pointAlong(path, f) as LatLng
    const d = metresBetween(p, point)
    if (d < bestDistance) {
      bestDistance = d
      best = f
    }
  }
  return Math.min(1, best)
}

/**
 * A spot ahead of the rider that only the active route uses (furthest from every alternative),
 * so a flood placed there forces a real reroute instead of blocking every option.
 */
export function hazardAhead(preset: Preset, routeId: string, from: number): { point: LatLng; fraction: number } {
  const route = preset.candidates.find((c) => c.id === routeId) ?? preset.candidates[0]
  const others = preset.candidates.filter((c) => c.id !== route.id)
  // Far enough ahead that the rider is warned well before reaching it.
  const start = Math.min(0.75, from + 0.3)
  let best = Math.min(0.85, from + 0.4)
  let bestScore = -1
  for (let f = start; f <= 0.88; f += 0.02) {
    const p = pointAlong(route.path, f) as LatLng
    const score = others.length ? Math.min(...others.map((o) => distanceToPath(p, o.path) as number)) : 1
    if (score > bestScore) {
      bestScore = score
      best = f
    }
  }
  return { point: pointAlong(route.path, best) as LatLng, fraction: best }
}
