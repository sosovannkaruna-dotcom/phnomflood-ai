// Judge mode's story, worked out from the demo trips: one trip where the usual (standard GPS) route
// crosses a spot that a dry alternative avoids, the alternative leaves early enough to reroute in
// time, and costs only a few minutes more. Deterministic, so every rehearsal is the same show.

import { DEPTHS } from '../lib/severity'
import { distanceToPath } from '../lib/geo'
import { PRESETS, analyse, divergence, placeAt, pointAt, safest } from '../rider/lib/trip'
import type { FloodReport } from '../shared/types'
import type { LatLng, Preset, RouteEntry } from '../rider/types'
import { MANEUVERS } from '../rider/data/maneuvers'

export interface Scenario {
  preset: Preset
  /** The usual route before anyone reports the water (how it looks at the start, and to standard GPS) */
  usualClear: RouteEntry
  /** The usual route once the water is reported */
  usual: RouteEntry
  /** PhnomFlood's route once the water is reported */
  dry: RouteEntry
  /** Where (0–1 along the usual route) the dry route leaves it */
  split: number
  /** The flood on the usual route: where along it, and the point */
  flood: { fraction: number; point: LatLng; street: string }
  /** The Telegram rider's report of it (simulated) */
  report: FloodReport
}

const FLOOD_CM = 42

export function pickScenario(): Scenario {
  let best: { score: number; scenario: Scenario } | null = null
  for (const preset of PRESETS) {
    const entries = analyse(preset, [], 'moto')
    const usual = entries[0]
    if (usual.minutes < 9 || usual.minutes > 22) continue
    for (const alt of entries.slice(1)) {
      const split = divergence(usual.candidate, alt.candidate)
      if (split < 0.12 || split > 0.55) continue
      // The spot on the usual route furthest from the alternative, past the split.
      let at = -1
      let far = 0
      for (let f = split + 0.08; f <= 0.85; f += 0.01) {
        const d = distanceToPath(pointAt(usual.candidate, f), alt.candidate.path) as number
        if (d > far) {
          far = d
          at = f
        }
      }
      if (at < 0 || far < DEPTHS.waist.zoneRadius + 60) continue
      const point = pointAt(usual.candidate, at)
      const place = placeAt(point)
      // The street the rider is on there, from the route's own turn list (the gazetteer's nearest
      // place can be a generic "local street").
      const turns = (usual.candidate.maneuvers ?? MANEUVERS[usual.candidate.id] ?? []).filter((m) => m.at <= at && m.street)
      const street = turns.length ? turns[turns.length - 1].street : place.name
      const report: FloodReport = {
        id: 'judge-telegram',
        name: street,
        area: place.area,
        khan: place.khan,
        sangkat: place.sangkat,
        lat: point[0],
        lng: point[1],
        depth: 'waist',
        source: 'telegram',
        createdAt: Date.now(),
        ai: { depthCm: FLOOD_CM, drainage: { status: 'Road fully submerged', blocked: false, confidence: 0.8 } },
      }
      const withReport = analyse(preset, [report], 'moto')
      const dry = safest(withReport)
      if (dry.candidate.id !== alt.candidate.id || dry.blockers.length) continue
      const extra = dry.minutes - usual.minutes
      if (extra < 1 || extra > 9) continue
      // Prefer a split a third of the way in, a flood well past it, and a small detour.
      const score = -Math.abs(split - 0.3) * 4 - Math.abs(at - split - 0.3) * 2 - extra * 0.15 + Math.min(far, 600) / 600
      if (!best || score > best.score) {
        best = {
          score,
          scenario: {
            preset,
            usualClear: usual,
            usual: withReport[0],
            dry,
            split,
            flood: { fraction: at, point, street },
            report,
          },
        }
      }
    }
  }
  if (!best) throw new Error('No demo trip fits the judge-mode story')
  return best.scenario
}

/** The cloudburst as 15-minute rain slots (mm/h): two hours building to 65 mm/h now, easing after. */
export function cloudburstSeries(now: number) {
  const slot = 15 * 60 * 1000
  const start = Math.floor(now / slot) * slot
  const past = [0, 0, 0, 0, 0, 8, 30, 65]
  const ahead = [65, 60, 45, 30, 18, 8, 3, 0]
  return [...past, ...ahead].map((mmh, i) => ({ at: start + (i - past.length + 1) * slot, mmh }))
}

export const CLOUDBURST_MMH = 65
export { FLOOD_CM }
