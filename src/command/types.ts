export type ViewId = 'live' | 'forecast' | 'drainage'
export type RiskLevel = 'nominal' | 'watch' | 'critical'
export type LayerId = 'radar' | 'sensors' | 'zones'
export type LayerState = Record<LayerId, boolean>

export interface KhanMeta {
  id: string
  name: string
  lat: number
  lng: number
  /** 0–1: share of design drainage capacity that is in working order */
  drainage: number
  /** 0–1: how much of the Khan sits in low-elevation basins */
  lowLying: number
}

export interface KhanState extends KhanMeta {
  rain: number // mm/h
  saturation: number // %
  drainLoad: number // % of drainage capacity in use
  drainStatus: 'Flowing' | 'Near capacity' | 'Overloaded'
  risk: number // 0–100 runoff risk score
  level: RiskLevel
}

export type SensorKind = 'street' | 'canal' | 'pump'

export interface Sensor {
  id: string
  name: string
  khanId: string
  lat: number
  lng: number
  kind: SensorKind
  gain: number
  warn: number
  crit: number
}

export interface SensorState extends Sensor {
  value: number
  unit: 'cm' | '%'
  level: RiskLevel
}

export interface CityMetrics {
  rain: number
  saturation: number
  drainFree: number
  river: number
}

// ── Shared store (src/store/FloodStore.jsx) as seen from TypeScript ──
export type DepthId = 'clear' | 'ankle' | 'knee' | 'waist'

export interface FloodReport {
  id: string
  name: string
  area: string
  khan: string
  sangkat: string
  lat: number
  lng: number
  depth: DepthId
  source: string
  createdAt: number
  isNew?: boolean
  confirmations?: number
  photo?: string | null
  ai?: { depthCm: number; drainage: { status: string; blocked: boolean; confidence: number } } | null | undefined
}

export interface Ticket {
  id: string
  name: string
  khan: string
  sangkat: string
  lat: number
  lng: number
  diagnosis: string
  frequency: number
  urgency: number
  crew: string
  status: 'open' | 'dispatched'
  isNew?: boolean
}

export interface FloodApi {
  reports: FloodReport[]
  queue: Ticket[]
  ridersRerouted: number
  addReport: (report: FloodReport) => void
  addRerouted: (count: number) => void
  confirmReport: (id: string) => void
  clearReport: (id: string) => void
  dispatchCrew: (id: string) => void
  resetDemo: () => void
}

// ── Analyst briefings ──
export type Part = string | { khan: string }
export type Block =
  | { type: 'p'; parts: Part[] }
  | { type: 'list'; items: Part[][] }
  | { type: 'table'; head: string[]; rows: Part[][] }

export interface AnalystContext {
  hour: number
  selectedKhan: string | null
  reports: FloodReport[]
  queue: Ticket[]
  ridersRerouted: number
}
