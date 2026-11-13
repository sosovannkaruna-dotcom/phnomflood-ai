// Vehicle-aware route selection.
//
// Each preset trip ships with a few pre-computed road geometries ("candidates",
// see src/data/routes.json). The planner checks every candidate against the live
// flood reports and picks:
//   • standard — candidates[0], the route a generic map app would suggest
//   • safe     — the quickest candidate that no flood blocks for this vehicle
//
// To go live, replace `candidates` with responses from a routing engine
// (OSRM / Valhalla / GraphHopper) and keep `analyseCandidate` as the flood filter,
// or push the flood zones into the engine as avoid-polygons.

import { DEPTHS, VEHICLES } from './severity'
import { distanceToPath, pointAlong } from './geo'

const BUFFER_M = 25 // GPS / geometry tolerance added to each flood zone

/** Which reports block or slow a candidate route for a vehicle. */
export function analyseCandidate(candidate, reports, vehicleId) {
  const vehicle = VEHICLES[vehicleId]
  const blockers = []
  const cautions = []
  for (const report of reports) {
    const depth = DEPTHS[report.depth]
    if (!depth || depth.rank === 0) continue
    const d = distanceToPath([report.lat, report.lng], candidate.path)
    if (d > depth.zoneRadius + BUFFER_M) continue
    if (depth.rank >= vehicle.blockRank) blockers.push(report)
    else if (depth.rank >= vehicle.cautionRank) cautions.push(report)
  }
  return { blockers, cautions }
}

export function etaMinutes(candidate, vehicleId) {
  return Math.round(candidate.typicalMinutes * VEHICLES[vehicleId].etaFactor)
}

/** Plan a preset trip for a vehicle against the current flood reports. */
export function planTrip(preset, reports, vehicleId) {
  const analysed = preset.candidates.map((candidate) => ({
    candidate,
    minutes: etaMinutes(candidate, vehicleId),
    ...analyseCandidate(candidate, reports, vehicleId),
  }))

  const standard = analysed[0]
  const dry = analysed
    .filter((a) => a.blockers.length === 0)
    .sort((a, b) => a.minutes - b.minutes || a.cautions.length - b.cautions.length)

  // No fully passable option: fall back to the least-flooded candidate.
  const safe =
    dry[0] ??
    [...analysed].sort((a, b) => a.blockers.length - b.blockers.length || a.minutes - b.minutes)[0]

  return {
    standard,
    safe,
    hasDryRoute: dry.length > 0,
    standardIsSafe: safe.candidate.id === standard.candidate.id,
    extraMinutes: safe.minutes - standard.minutes,
  }
}

/**
 * Simulated rider GPS position: the point on the current safe route that is
 * furthest from every other candidate, so a report filed "here" affects this
 * route without also blocking the alternatives.
 */
export function riderPosition(preset, safeCandidateId) {
  const safe = preset.candidates.find((c) => c.id === safeCandidateId) ?? preset.candidates[0]
  const others = preset.candidates.filter((c) => c.id !== safe.id)
  let best = pointAlong(safe.path, 0.4)
  let bestScore = -1
  for (let f = 0.2; f <= 0.8; f += 0.04) {
    const p = pointAlong(safe.path, f)
    const score = others.length
      ? Math.min(...others.map((o) => distanceToPath(p, o.path)))
      : 1
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return best
}
