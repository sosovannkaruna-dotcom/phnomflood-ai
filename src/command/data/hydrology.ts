// Hydrological model for the command center.
//
// EVERYTHING HERE IS SIMULATED. It is a small deterministic model (one squall
// crossing the city, soils wetting up, drains loading) so that every number on
// screen is consistent with every other number and with the timeline scrubber.
// `hour` is hours from now: -6 (history) … 0 (now) … +24 (forecast).
//
// To go live, keep the function signatures and feed them from:
//   rainfall      → Open-Meteo / GFS grid
//   river stage   → Mekong River Commission gauge at Chaktomuk
//   sensor values → the street-level telemetry network

import type { Feature, FeatureCollection, Point } from 'geojson'
import type { CityMetrics, KhanMeta, KhanState, RiskLevel, Sensor, SensorState } from '../types'

export const HOUR_MIN = -6
export const HOUR_MAX = 24

// Reference stages for the Bassac at Chaktomuk (approximate; confirm against MRC before quoting).
export const RIVER = { station: 'Bassac at Chaktomuk', alarm: 10.5, flood: 12.0, zero: 6 }

export const KHANS: KhanMeta[] = [
  { id: 'daun-penh', name: 'Daun Penh', lat: 11.5773, lng: 104.9194, drainage: 0.7, lowLying: 0.45 },
  { id: 'chamkar-mon', name: 'Chamkar Mon', lat: 11.5373, lng: 104.9209, drainage: 0.6, lowLying: 0.5 },
  { id: 'prampir-makara', name: '7 Makara', lat: 11.5638, lng: 104.9107, drainage: 0.6, lowLying: 0.5 },
  { id: 'tuol-kork', name: 'Tuol Kork', lat: 11.5739, lng: 104.8997, drainage: 0.33, lowLying: 0.7 },
  { id: 'boeung-keng-kang', name: 'Boeung Keng Kang', lat: 11.5489, lng: 104.9113, drainage: 0.5, lowLying: 0.65 },
  { id: 'sen-sok', name: 'Sen Sok', lat: 11.5786, lng: 104.8692, drainage: 0.35, lowLying: 0.6 },
  { id: 'russey-keo', name: 'Russey Keo', lat: 11.6288, lng: 104.9038, drainage: 0.45, lowLying: 0.5 },
  { id: 'chroy-changvar', name: 'Chroy Changvar', lat: 11.6586, lng: 104.9093, drainage: 0.55, lowLying: 0.35 },
  { id: 'mean-chey', name: 'Mean Chey', lat: 11.5315, lng: 104.8985, drainage: 0.3, lowLying: 0.75 },
  { id: 'chbar-ampov', name: 'Chbar Ampov', lat: 11.5229, lng: 104.9669, drainage: 0.4, lowLying: 0.5 },
  { id: 'por-senchey', name: 'Por Senchey', lat: 11.5539, lng: 104.8267, drainage: 0.3, lowLying: 0.55 },
  { id: 'dangkao', name: 'Dangkao', lat: 11.5058, lng: 104.8914, drainage: 0.25, lowLying: 0.7 },
  { id: 'prek-pnov', name: 'Prek Pnov', lat: 11.6592, lng: 104.8609, drainage: 0.4, lowLying: 0.4 },
  { id: 'kamboul', name: 'Kamboul', lat: 11.5364, lng: 104.7706, drainage: 0.35, lowLying: 0.3 },
]

export const khanById = (id: string | null | undefined) => KHANS.find((k) => k.id === id)

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const bell = (x: number, centre: number, width: number) => Math.exp(-(((x - centre) / width) ** 2))
// Stable per-Khan variation in 0–1 from its id.
const jitter = (id: string) => (([...id].reduce((s, c) => s + c.charCodeAt(0) * 7, 0) % 100) / 100)

/** City-wide rainfall intensity (mm/h): a squall peaking just after now, a weaker cell overnight. */
export function cityRain(hour: number): number {
  return 4 + 36 * bell(hour, 1.2, 2.4) + 10 * bell(hour, 14, 3)
}

// The squall arrives from the south-west, so western Khans lead by up to ~1.5 h.
const lagOf = (k: KhanMeta) => (k.lng - 104.92) * 9 + (k.lat - 11.56) * 4

export function levelOf(risk: number): RiskLevel {
  return risk >= 62 ? 'critical' : risk >= 46 ? 'watch' : 'nominal'
}

export function khanState(k: KhanMeta, hour: number): KhanState {
  const t = hour - lagOf(k)
  const rain = cityRain(t) * (0.86 + 0.28 * jitter(k.id))
  const saturation = clamp(46 + 36 * smooth(-3.5, 3.5, t) - 1.2 * Math.max(0, t - 6) + 8 * k.lowLying, 28, 97)
  const capacity = 28 + 40 * k.drainage // mm/h the drains can carry
  const drainLoad = clamp((rain / capacity) * 78 + saturation * 0.22, 6, 140)
  const risk = clamp(0.45 * Math.min(drainLoad, 130) + 0.3 * saturation + 26 * k.lowLying - 14, 4, 99)
  return {
    ...k,
    rain,
    saturation,
    drainLoad,
    drainStatus: drainLoad >= 95 ? 'Overloaded' : drainLoad >= 65 ? 'Near capacity' : 'Flowing',
    risk,
    level: levelOf(risk),
  }
}

/** Every Khan at a given hour, highest runoff risk first. */
export function khanStates(hour: number): KhanState[] {
  return KHANS.map((k) => khanState(k, hour)).sort((a, b) => b.risk - a.risk)
}

/** River stage (m) at Chaktomuk: rises slowly as upstream runoff arrives. */
export function riverLevel(hour: number): number {
  return 8.42 + 0.011 * hour + 0.07 * smooth(1, 14, hour)
}

// The dense inner Khans dominate the city-wide averages.
const CORE = ['daun-penh', 'chamkar-mon', 'prampir-makara', 'tuol-kork', 'boeung-keng-kang', 'sen-sok', 'mean-chey', 'russey-keo']

export function cityMetrics(hour: number): CityMetrics {
  const core = KHANS.filter((k) => CORE.includes(k.id)).map((k) => khanState(k, hour))
  const mean = (f: (s: KhanState) => number) => core.reduce((s, x) => s + f(x), 0) / core.length
  return {
    rain: mean((s) => s.rain),
    saturation: mean((s) => s.saturation),
    drainFree: clamp(100 - mean((s) => s.drainLoad), 0, 100),
    river: riverLevel(hour),
  }
}

/** The previous `points` hourly values of a metric, ending at `hour` (for sparklines). */
export function trend(metric: (hour: number) => number, hour: number, points = 13): number[] {
  return Array.from({ length: points }, (_, i) => metric(hour - (points - 1 - i)))
}

/** Hour (0…24) at which city rainfall peaks. */
export function peakHour(): number {
  let best = 0
  for (let h = 0; h <= HOUR_MAX; h += 0.25) if (cityRain(h) > cityRain(best)) best = h
  return best
}

// ── Telemetry nodes ──
export const SENSORS: Sensor[] = [
  { id: 'PNH-TK-01', name: 'Street 289', khanId: 'tuol-kork', lat: 11.5707, lng: 104.8994, kind: 'street', gain: 1.5, warn: 20, crit: 40 },
  { id: 'PNH-TK-02', name: 'Russian Blvd / Wat Neakvoan', khanId: 'tuol-kork', lat: 11.5703, lng: 104.9045, kind: 'street', gain: 0.55, warn: 20, crit: 40 },
  { id: 'PNH-DP-01', name: 'Monivong Blvd / Central Market', khanId: 'daun-penh', lat: 11.5686, lng: 104.9186, kind: 'street', gain: 1.75, warn: 20, crit: 40 },
  { id: 'PNH-DP-02', name: 'Norodom Blvd', khanId: 'daun-penh', lat: 11.5625, lng: 104.9285, kind: 'street', gain: 0.12, warn: 20, crit: 40 },
  { id: 'PNH-DP-03', name: 'Wat Phnom roundabout', khanId: 'daun-penh', lat: 11.5761, lng: 104.9232, kind: 'street', gain: 0.4, warn: 20, crit: 40 },
  { id: 'PNH-BK-01', name: 'Street 63, BKK1', khanId: 'boeung-keng-kang', lat: 11.552, lng: 104.924, kind: 'street', gain: 0.5, warn: 20, crit: 40 },
  { id: 'PNH-7M-01', name: 'Street 163 / Olympic Market', khanId: 'prampir-makara', lat: 11.5548, lng: 104.9142, kind: 'street', gain: 0.8, warn: 20, crit: 40 },
  { id: 'PNH-SS-01', name: 'Street 1986', khanId: 'sen-sok', lat: 11.5795, lng: 104.8765, kind: 'street', gain: 1.35, warn: 20, crit: 40 },
  { id: 'PNH-RK-01', name: 'National Road 5', khanId: 'russey-keo', lat: 11.61, lng: 104.908, kind: 'street', gain: 0.7, warn: 20, crit: 40 },
  { id: 'PNH-CC-01', name: 'Chroy Changvar peninsula', khanId: 'chroy-changvar', lat: 11.59, lng: 104.933, kind: 'street', gain: 0.3, warn: 20, crit: 40 },
  { id: 'PNH-CA-01', name: 'National Road 1', khanId: 'chbar-ampov', lat: 11.53, lng: 104.948, kind: 'street', gain: 0.6, warn: 20, crit: 40 },
  { id: 'PNH-PS-01', name: 'Veng Sreng Blvd', khanId: 'por-senchey', lat: 11.529, lng: 104.86, kind: 'street', gain: 1.1, warn: 20, crit: 40 },
  { id: 'PNH-MC-C1', name: 'Stung Meanchey canal', khanId: 'mean-chey', lat: 11.536, lng: 104.893, kind: 'canal', gain: 2.6, warn: 60, crit: 90 },
  { id: 'PNH-CM-P1', name: 'Boeung Trabek pumping station', khanId: 'chamkar-mon', lat: 11.538, lng: 104.923, kind: 'pump', gain: 1, warn: 80, crit: 100 },
  { id: 'PNH-MC-P1', name: 'Boeung Tompun pumping station', khanId: 'mean-chey', lat: 11.53, lng: 104.906, kind: 'pump', gain: 1, warn: 80, crit: 100 },
]

export function sensorState(sensor: Sensor, hour: number): SensorState {
  const khan = khanState(khanById(sensor.khanId)!, hour)
  const value =
    sensor.kind === 'pump'
      ? Math.round(clamp(khan.drainLoad * 0.92, 0, 130)) // pump load, % of rated capacity
      : Math.round(Math.max(0, sensor.gain * (0.75 * khan.rain + 0.35 * Math.max(0, khan.saturation - 55)))) // standing water, cm
  return {
    ...sensor,
    value,
    unit: sensor.kind === 'pump' ? '%' : 'cm',
    level: value >= sensor.crit ? 'critical' : value >= sensor.warn ? 'watch' : 'nominal',
  }
}

export const sensorStates = (hour: number) => SENSORS.map((s) => sensorState(s, hour))

// ── Rainfall radar: storm cells drifting north-east across the city ──
const CELLS = [
  { lat: 11.545, lng: 104.875, size: 1, phase: 0 },
  { lat: 11.585, lng: 104.9, size: 0.8, phase: 0.6 },
  { lat: 11.52, lng: 104.915, size: 0.7, phase: 1.1 },
  { lat: 11.61, lng: 104.865, size: 0.6, phase: -0.5 },
  { lat: 11.56, lng: 104.94, size: 0.75, phase: 1.6 },
]

export function stormCells(hour: number): FeatureCollection<Point> {
  const features: Feature<Point>[] = CELLS.map((cell, i) => {
    const t = hour - cell.phase
    const intensity = clamp(cityRain(t) / 40, 0, 1) * cell.size
    return {
      type: 'Feature',
      id: i,
      properties: { intensity },
      // Drift ≈ 2.2 km/h north-east, relative to the cell's position at its peak.
      geometry: { type: 'Point', coordinates: [cell.lng + 0.018 * (t - 1.2), cell.lat + 0.008 * (t - 1.2)] },
    }
  })
  return { type: 'FeatureCollection', features }
}

export const LEVEL_COLOR: Record<RiskLevel, string> = {
  nominal: '#10B981',
  watch: '#F59E0B',
  critical: '#EF4444',
}
export const LEVEL_LABEL: Record<RiskLevel, string> = { nominal: 'Nominal', watch: 'Watch', critical: 'Critical' }
