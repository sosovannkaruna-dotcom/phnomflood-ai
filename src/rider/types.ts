import type { DepthId, FloodReport } from '../shared/types'

export type VehicleId = 'moto' | 'tuktuk' | 'car'
export type MapMode = 'depth' | 'passability'
export type LatLng = [number, number]

export interface Candidate {
  id: string
  via: string
  typicalMinutes: number
  distanceM: number
  path: LatLng[]
}

export interface Endpoint {
  name: string
  short: string
  lat: number
  lng: number
}

export interface Preset {
  id: string
  label: string
  origin: Endpoint
  destination: Endpoint
  candidates: Candidate[]
}

/** One route option checked against the live flood reports for a vehicle. */
export interface RouteEntry {
  candidate: Candidate
  minutes: number
  blockers: FloodReport[]
  cautions: FloodReport[]
}

export type Passability = 'dry' | 'caution' | 'blocked'

export interface Place {
  name: string
  area: string
  khan: string
  sangkat: string
  lat: number
  lng: number
}

export interface Maneuver {
  /** Position along the route, 0–1 */
  at: number
  turn: 'left' | 'right' | 'straight' | 'arrive'
  street: string
  toward?: string
}

export interface FloodSegment {
  reportId: string
  /** wet < 10 cm, caution 10–25 cm, impassable > 25 cm */
  kind: 'wet' | 'caution' | 'impassable'
  depth: DepthId
  coordinates: [number, number][] // [lng, lat]
}

export interface VisionResult {
  status: 'verified' | 'rejected' | 'unavailable'
  /** unavailable: why */
  code?: 'not_configured' | 'demo_upload' | 'failed'
  /** rejected: what the AI saw instead */
  reason?: string
  depth?: Exclude<DepthId, 'clear'>
  depthCm?: number
  /** the visual cue the depth came from, e.g. "water reaching the seat of a stalled motorbike" */
  cue?: string
  reference?: { object: string; submersionPct: number; debris: boolean }
  drainage?: { status: string; blocked: boolean; confidence: number }
  correction?: { from: Exclude<DepthId, 'clear'>; to: Exclude<DepthId, 'clear'>; direction: 'up' | 'down' } | null
  agreement?: string
  source?: 'demo' | 'live'
}
