// Shared store (src/store/FloodStore.jsx) as seen from TypeScript.
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

export type SyncState = 'local' | 'connecting' | 'live' | 'offline'

export interface FloodApi {
  mode: 'demo' | 'live'
  /** local: this device only · connecting · live: shared · offline: shared but unreachable */
  sync: SyncState
  /** Live: reports, confirmations and clears made offline, waiting to be sent */
  pending: number
  /** Live: when the reports on screen were saved, while the server has not answered yet */
  savedAt: number | null
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
