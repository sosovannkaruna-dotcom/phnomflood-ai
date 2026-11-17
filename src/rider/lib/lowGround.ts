import type { LatLng } from '../types'

// Low ground from a terrain model (see scripts/build-low-ground.mjs): where storm water collects
// first. Loaded on demand (the grid is a few hundred kB), decoded once, then shared.

export interface LowGround {
  width: number
  height: number
  /** West, south, east, north (tile-aligned, Web Mercator) */
  bounds: [number, number, number, number]
  /** 0 not low, 1 low, 2 lowest, row by row from the north-west corner */
  cells: Uint8Array
  thresholds: { low: number; lowest: number }
}

let loading: Promise<LowGround> | null = null

export function loadLowGround(): Promise<LowGround> {
  loading ??= import('../../data/lowGround.generated.json').then(({ default: data }) => {
    const cells = new Uint8Array(data.width * data.height)
    let i = 0
    for (const run of data.runs as number[]) {
      const cls = run % 3
      const len = (run - cls) / 3
      if (cls) cells.fill(cls, i, i + len)
      i += len
    }
    return { width: data.width, height: data.height, bounds: data.bounds as LowGround['bounds'], cells, thresholds: data.thresholds }
  })
  return loading
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

/** Height class at a point: 0 not low (or outside the grid), 1 low, 2 lowest. */
export function classAt(ground: LowGround, [lat, lng]: LatLng): number {
  const [w, s, e, n] = ground.bounds
  if (lng < w || lng >= e || lat <= s || lat > n) return 0
  const x = Math.floor(((lng - w) / (e - w)) * ground.width)
  const y = Math.floor(((mercY(n) - mercY(lat)) / (mercY(n) - mercY(s))) * ground.height)
  return ground.cells[y * ground.width + x] ?? 0
}

/** Metres of a route on low ground (class 1 or 2), sampled every ~20 m. */
export function lowMetres(ground: LowGround, path: LatLng[]): number {
  let metres = 0
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]]
    const dy = (b[0] - a[0]) * 111320
    const dx = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180)
    const len = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.round(len / 20))
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps
      if (classAt(ground, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) metres += len / steps
    }
  }
  return metres
}

/** The grid drawn as an image for the map: low ground a soft water tint, lowest a stronger one. */
export function lowGroundCanvas(ground: LowGround): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ground.width
  canvas.height = ground.height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(ground.width, ground.height)
  const { data } = image
  for (let i = 0; i < ground.cells.length; i++) {
    const cls = ground.cells[i]
    if (!cls) continue
    // Indigo-blue, apart from the sky-blue of reported water and flood-prone spots.
    data[i * 4] = 79
    data[i * 4 + 1] = 70
    data[i * 4 + 2] = 229
    data[i * 4 + 3] = cls === 2 ? 115 : 55
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}
