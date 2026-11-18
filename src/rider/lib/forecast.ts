// Flood forecast: where water will stand on Phnom Penh's streets in the next two hours.
//
// A fill-and-spill screening model (the family of the Danish "Bluespot" method and FastFlood),
// run on the terrain grid from scripts/build-hydrology.mjs, every 15 minutes:
//
//   1. Rain the drains cannot take runs off: rain × RUNOFF − the drains' capacity, per cell.
//   2. Water runs downhill along the grid, cell to cell, filling every hollow on the way before it
//      spills on to the next. Water passing through a street stands on it at a depth set by how
//      much is flowing (a street ~38 m wide, water moving at walking pace).
//   3. Standing water drains away at the same rate the rest of the app assumes (drainMinutes in
//      src/lib/confidence.js: about 3.5 min per cm, slower in rain), slower at flood-prone spots.
//
// It starts two hours back, so rain that has already fallen is on the ground at "now", then runs
// the forecast forward. Riders' reports correct it in two ways:
//   - Rain: forecast grids miss small storms (on 26 Feb 2026 they had 3.2 mm/h at most while Tuol
//     Kouk flooded). Fresh reports are compared with what the model has at their spots for a range
//     of rain factors, and the best fit scales the rain, fading back to the forecast over an hour.
//   - Place: water a rider saw is put on the map where they saw it and drains forward from there; a
//     "cleared" report empties its spot.
//
// Every number is an estimate and the app says so. This file has no DOM: it runs in a worker
// (forecast.worker.ts) and in Node for testing.

export interface HydrologyFile {
  width: number
  height: number
  cellMetres: number
  bounds: [number, number, number, number]
  dir: string
  hold: string
  upstream: string
}

export interface Hydrology {
  width: number
  height: number
  cellMetres: number
  /** West, south, east, north (Web Mercator) */
  bounds: [number, number, number, number]
  /** Cell each one drains to, or -1 at an outlet (river, canal, lake, grid edge) */
  recv: Int32Array
  /** Cells upstream first: every cell comes before the one it drains to */
  order: Int32Array
  /** Depth of the hollow each cell sits in, mm */
  holdMm: Float32Array
  outlet: Uint8Array
}

export interface RainSlot {
  at: number
  mmh: number
}

export interface Observation {
  lat: number
  lng: number
  /** Water depth seen, cm; 0 for "cleared" */
  cm: number
  at: number
  radiusM: number
}

export interface ForecastInput {
  rain: RainSlot[]
  now: number
  observations?: Observation[]
  /** Places that flooded on several days: their drains are assumed to be worse */
  hotspots?: { lat: number; lng: number }[]
}

export interface ForecastResult {
  /** Frame times: now, +15 min … +2 h */
  times: number[]
  /** Water depth, cm (0–255), frame after frame, row by row from the north-west */
  depth: Uint8Array
  width: number
  height: number
  bounds: [number, number, number, number]
  /** Rain factor fitted to the reports (1 = the forecast as it is) */
  rainFactor: number
  /** Reports the fit used */
  fitted: number
  /** Cells with ankle-deep water (10 cm) or more, per frame */
  wetCells: number[]
  computedAt: number
  ms: number
}

// ── Assumptions (estimates, labelled as such in the app) ─────────────────────────────────────
/** Share of rain that runs off a built-up city */
const RUNOFF = 0.85
/** Rain the street drains take before water stands, mm/h. Phnom Penh floods from "heavy" rain (7.6 mm/h). */
export const DRAIN_CAPACITY = 6
/** At flood-prone spots (reported on 2+ days) the drains take this share of it */
const HOTSPOT_DRAIN = 0.35
const HOTSPOT_RADIUS_M = 120
/** Standing water drains about 1 cm every 3.5 min (drainMinutes), slower while it rains */
const POND_DRAIN_MMH = 600 / 3.5
/** Flowing water: speed along the street, m/s */
const FLOW_SPEED = 0.5
/** Deeper than this, flowing water spreads sideways out of a one-cell street (the model routes it down one line), mm */
const MAX_FLOW_MM = 500
const STEP_MIN = 15
const BACK_STEPS = 8
const AHEAD_STEPS = 8
const FACTORS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12]
/** How long the fitted rain factor holds before the forecast takes over again, minutes */
const FACTOR_FADE_MIN = 60
/** The fitted factor reaches about this far from the reports (a storm cell's size), metres */
const STORM_RADIUS_M = 3000

const SLOT_MS = STEP_MIN * 60000
const DX = [0, 1, 1, 1, 0, -1, -1, -1]
const DY = [-1, -1, 0, 1, 1, 1, 0, -1]

async function unpack(base64: string): Promise<Uint8Array> {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function decodeHydrology(file: HydrologyFile): Promise<Hydrology> {
  const { width: W, height: H } = file
  const N = W * H
  const [dir, hold] = await Promise.all([unpack(file.dir), unpack(file.hold)])
  const recv = new Int32Array(N)
  const outlet = new Uint8Array(N)
  const holdMm = new Float32Array(N)
  const indeg = new Int32Array(N)
  for (let i = 0; i < N; i++) {
    holdMm[i] = hold[i] * 10
    const d = dir[i]
    if (d > 7) {
      recv[i] = -1
      outlet[i] = 1
      continue
    }
    const x = (i % W) + DX[d]
    const y = Math.floor(i / W) + DY[d]
    recv[i] = x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x
    if (recv[i] >= 0) indeg[recv[i]]++
  }
  // Kahn's algorithm: cells nothing drains into first, then each cell once all its inflows are done.
  const order = new Int32Array(N)
  let head = 0
  let tail = 0
  for (let i = 0; i < N; i++) if (!indeg[i]) order[tail++] = i
  while (head < tail) {
    const j = recv[order[head++]]
    if (j >= 0 && --indeg[j] === 0) order[tail++] = j
  }
  if (tail !== N) throw new Error('hydrology grid has a loop')
  return { width: W, height: H, cellMetres: file.cellMetres, bounds: file.bounds, recv, order, holdMm, outlet }
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

/** Grid cell at a point, or -1 outside the grid. */
export function cellAt(grid: { width: number; height: number; bounds: [number, number, number, number] }, lat: number, lng: number): number {
  const [w, s, e, n] = grid.bounds
  if (lng < w || lng >= e || lat <= s || lat > n) return -1
  const x = Math.floor(((lng - w) / (e - w)) * grid.width)
  const y = Math.floor(((mercY(n) - mercY(lat)) / (mercY(n) - mercY(s))) * grid.height)
  return y * grid.width + x
}

/** Cells within `metres` of a point. */
function cellsNear(h: Hydrology, lat: number, lng: number, metres: number): number[] {
  const c = cellAt(h, lat, lng)
  if (c < 0) return []
  const r = Math.max(0, Math.round(metres / h.cellMetres))
  const cx = c % h.width
  const cy = (c - cx) / h.width
  const out: number[] = []
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue
      const x = cx + dx
      const y = cy + dy
      if (x >= 0 && y >= 0 && x < h.width && y < h.height) out.push(y * h.width + x)
    }
  }
  return out
}

/** Rain at a time from the 15-minute slots (mm/h), 0 outside them. */
function rainAt(rain: RainSlot[], t: number): number {
  for (const s of rain) if (t >= s.at && t < s.at + SLOT_MS) return s.mmh
  return 0
}

interface State {
  pond: Float32Array
  /** Water seen by riders that the terrain does not explain (a blocked drain): drains, never spills */
  seen: Float32Array
  flow: Float32Array
}

/**
 * One 15-minute step. `rain` in mm/h; returns nothing, updates the state.
 * drainCap: per-cell drain capacity (mm/h of rain).
 */
function step(h: Hydrology, s: State, rain: number, drainCap: Float32Array, pondDrain: Float32Array, near: Float32Array | null, factor: number) {
  const dtH = STEP_MIN / 60
  const { order, recv, holdMm } = h
  const { pond, flow, seen } = s
  const inflow = flow // reused: inflow this step, then turned into the flowing depth
  inflow.fill(0)
  const rainSlow = rain >= 7.6 ? 1.6 : rain > 0 ? 1.2 : 1
  // Fill and spill, upstream first.
  for (let k = 0; k < order.length; k++) {
    const i = order[k]
    // The fitted rain factor applies in full at the reports and fades with distance from them.
    const excess = rain * (near ? 1 + (factor - 1) * near[i] : 1) * RUNOFF - drainCap[i]
    let water = pond[i] + inflow[i] + (excess > 0 ? excess * dtH : 0)
    const spill = water > holdMm[i] ? water - holdMm[i] : 0
    water -= spill
    // Standing water drains away.
    const drained = (pondDrain[i] / rainSlow) * dtH
    pond[i] = water > drained ? water - drained : 0
    const j = recv[i]
    if (j >= 0 && spill > 0) inflow[j] += spill
    // What passes through, as a depth on the street: volume per second over a cell-wide street at FLOW_SPEED.
    inflow[i] = spill
    if (seen[i] > 0) seen[i] = Math.max(0, seen[i] - drained)
  }
  const toDepthMm = h.cellMetres / (STEP_MIN * 60 * FLOW_SPEED)
  for (let i = 0; i < flow.length; i++) flow[i] = Math.min(MAX_FLOW_MM, flow[i] * toDepthMm)
}

function depthCm(s: State, i: number): number {
  return Math.min(255, Math.round(Math.max(s.pond[i] + s.flow[i], s.seen[i]) / 10))
}

function newState(n: number): State {
  return { pond: new Float32Array(n), seen: new Float32Array(n), flow: new Float32Array(n) }
}

export function runForecast(h: Hydrology, input: ForecastInput): ForecastResult {
  const t0 = performance.now()
  const N = h.width * h.height
  // Steps line up with the rain slots: the current slot is the last "past" step.
  const nowSlot = Math.floor(input.now / SLOT_MS) * SLOT_MS
  const start = nowSlot - BACK_STEPS * SLOT_MS

  const drainCap = new Float32Array(N).fill(DRAIN_CAPACITY)
  const pondDrain = new Float32Array(N).fill(POND_DRAIN_MMH)
  for (const spot of input.hotspots ?? []) {
    for (const i of cellsNear(h, spot.lat, spot.lng, HOTSPOT_RADIUS_M)) {
      drainCap[i] = DRAIN_CAPACITY * HOTSPOT_DRAIN
      pondDrain[i] = POND_DRAIN_MMH * HOTSPOT_DRAIN
    }
  }

  // Reports from the last two hours, as observations of the water at their spots.
  const obs = (input.observations ?? [])
    .filter((o) => o.at >= start && o.at <= input.now + 60000)
    // cells: where the water goes on the map; zone: the stretch of street the report speaks for,
    // where the fit looks for the model's water.
    .map((o) => ({ ...o, cells: cellsNear(h, o.lat, o.lng, Math.min(o.radiusM, 60)), zone: cellsNear(h, o.lat, o.lng, Math.min(o.radiusM, 200)) }))
    .filter((o) => o.cells.length)
  const pastRain = input.rain.filter((r) => r.at >= start && r.at <= nowSlot).reduce((sum, r) => sum + r.mmh, 0)

  // How close each cell is to a report, 1 at a report fading to 0 (a storm cell is a few km across),
  // so reports in one district do not flood the whole city. Built on a coarse grid, then looked up.
  let near: Float32Array | null = null
  if (obs.length && pastRain > 0) {
    near = new Float32Array(N)
    const sigma = STORM_RADIUS_M / h.cellMetres
    const centres = obs.slice(-60).map((o) => {
      const c = o.cells[Math.floor(o.cells.length / 2)]
      return [c % h.width, Math.floor(c / h.width)]
    })
    const COARSE = 8
    for (let y0 = 0; y0 < h.height; y0 += COARSE) {
      for (let x0 = 0; x0 < h.width; x0 += COARSE) {
        let best = Infinity
        for (const [cx, cy] of centres) best = Math.min(best, (x0 + COARSE / 2 - cx) ** 2 + (y0 + COARSE / 2 - cy) ** 2)
        const w = Math.exp(-best / (2 * sigma * sigma))
        for (let y = y0; y < Math.min(h.height, y0 + COARSE); y++) near.fill(w, y * h.width + x0, y * h.width + Math.min(h.width, x0 + COARSE))
      }
    }
  }

  const runPast = (factor: number): State => {
    const s = newState(N)
    for (let k = 0; k < BACK_STEPS; k++) step(h, s, rainAt(input.rain, start + k * SLOT_MS), drainCap, pondDrain, near, factor)
    return s
  }

  // Fit the rain factor: which scaling of the past rain best explains what riders saw?
  let factor = 1
  let state: State | null = null
  if (obs.length && pastRain > 0) {
    let best = Infinity
    for (const f of FACTORS) {
      const s = runPast(f)
      let err = 0
      for (const o of obs) {
        let model = 0
        for (const i of o.zone) model = Math.max(model, depthCm(s, i))
        err += Math.log((model + 5) / (o.cm + 5)) ** 2
      }
      // A slight pull toward the forecast as it is, so a single report does not swing it far.
      err += 0.15 * Math.log(f) ** 2
      if (err < best) {
        best = err
        factor = f
        state = s
      }
    }
  }
  state ??= runPast(1)

  // What riders saw goes on the map where they saw it, drained by the time since.
  for (const o of obs) {
    const sinceH = (input.now - o.at) / 3600000
    const left = Math.max(0, o.cm * 10 - POND_DRAIN_MMH * sinceH)
    for (const i of o.cells) {
      if (o.cm <= 0) {
        state.pond[i] = 0
        state.flow[i] = 0
        state.seen[i] = 0
      } else {
        state.seen[i] = Math.max(state.seen[i], left)
      }
    }
  }

  const frames = AHEAD_STEPS + 1
  const depth = new Uint8Array(frames * N)
  const wetCells: number[] = []
  const times: number[] = []
  const capture = (f: number) => {
    let wet = 0
    const base = f * N
    for (let i = 0; i < N; i++) {
      const d = depthCm(state!, i)
      depth[base + i] = d
      if (d >= 10) wet++
    }
    wetCells.push(wet)
    times.push(input.now + f * SLOT_MS)
  }
  capture(0)
  for (let f = 1; f < frames; f++) {
    const t = nowSlot + f * SLOT_MS
    const fade = Math.exp(-((f * STEP_MIN) / FACTOR_FADE_MIN))
    step(h, state, rainAt(input.rain, t), drainCap, pondDrain, near, 1 + (factor - 1) * fade)
    capture(f)
  }

  return {
    times,
    depth,
    width: h.width,
    height: h.height,
    bounds: h.bounds,
    rainFactor: factor,
    fitted: obs.length,
    wetCells,
    computedAt: input.now,
    ms: Math.round(performance.now() - t0),
  }
}

// ── Reading a forecast (main thread) ─────────────────────────────────────────────────────────

/** Forecast depth (cm) at a point and time: the frame at or just before `t`. */
export function depthAt(f: ForecastResult, lat: number, lng: number, t: number): number {
  const c = cellAt(f, lat, lng)
  if (c < 0) return 0
  const frame = Math.max(0, Math.min(f.times.length - 1, Math.floor((t - f.times[0]) / SLOT_MS)))
  return f.depth[frame * f.width * f.height + c]
}

export interface RouteForecast {
  /** Deepest water the rider would meet, cm, at the time they reach each point */
  worstCm: number
  /** Metres of the route under 10 cm or more when the rider gets there */
  wetM: number
  /** First point with 10 cm or more: where (0–1 along the route) and when */
  first: { fraction: number; at: number; cm: number; lat: number; lng: number } | null
}

/**
 * Water on a route as the rider rides it: each point is checked at the time the rider gets there,
 * from `startAt` at the route's own pace. Sampled every ~25 m.
 */
export function routeForecast(f: ForecastResult, path: [number, number][], minutes: number, startAt: number, fromFraction = 0): RouteForecast {
  const seg: number[] = [0]
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]]
    const dy = (b[0] - a[0]) * 111320
    const dx = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)
    seg.push(seg[i - 1] + Math.hypot(dx, dy))
  }
  const total = seg[seg.length - 1] || 1
  const msPerM = (minutes * 60000) / total
  let worstCm = 0
  let wetM = 0
  let first: RouteForecast['first'] = null
  const stepM = 25
  for (let i = 1; i < path.length; i++) {
    const len = seg[i] - seg[i - 1]
    const n = Math.max(1, Math.round(len / stepM))
    for (let k = 0; k < n; k++) {
      const along = seg[i - 1] + ((k + 0.5) / n) * len
      const fraction = along / total
      if (fraction < fromFraction) continue
      const t = startAt + (along - fromFraction * total) * msPerM
      const tt = (k + 0.5) / n
      const lat = path[i - 1][0] + (path[i][0] - path[i - 1][0]) * tt
      const lng = path[i - 1][1] + (path[i][1] - path[i - 1][1]) * tt
      const cm = depthAt(f, lat, lng, t)
      if (cm > worstCm) worstCm = cm
      if (cm >= 10) {
        wetM += len / n
        first ??= { fraction, at: t, cm, lat, lng }
      }
    }
  }
  return { worstCm, wetM: Math.round(wetM), first }
}

/**
 * One frame painted into a canvas for the map: blue, deeper and more opaque with depth, so model
 * water never reads like the amber and red of riders' reports. Under 3 cm is left clear.
 */
export function paintFrame(f: ForecastResult, frame: number, canvas: HTMLCanvasElement) {
  if (canvas.width !== f.width) canvas.width = f.width
  if (canvas.height !== f.height) canvas.height = f.height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(f.width, f.height)
  const { data } = image
  const n = f.width * f.height
  const base = Math.max(0, Math.min(f.times.length - 1, frame)) * n
  for (let i = 0; i < n; i++) {
    const cm = f.depth[base + i]
    if (cm < 3) continue
    const o = i * 4
    if (cm < 10) {
      data[o] = 56; data[o + 1] = 189; data[o + 2] = 248; data[o + 3] = 70
    } else if (cm < 25) {
      data[o] = 56; data[o + 1] = 189; data[o + 2] = 248; data[o + 3] = 140
    } else if (cm < 40) {
      data[o] = 59; data[o + 1] = 130; data[o + 2] = 246; data[o + 3] = 175
    } else {
      data[o] = 37; data[o + 1] = 99; data[o + 2] = 235; data[o + 3] = 205
    }
  }
  ctx.putImageData(image, 0, 0)
}

/** Depth rank as the rest of the app uses it: 0 dry, 1 ankle (10 cm), 2 knee (25), 3 waist (40). */
export const rankOfCm = (cm: number) => (cm >= 40 ? 3 : cm >= 25 ? 2 : cm >= 10 ? 1 : 0)
