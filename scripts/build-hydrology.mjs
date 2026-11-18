// Builds src/data/hydrology.generated.json: how storm water runs over central Phnom Penh.
//
// The flood forecast (src/rider/lib/forecast.worker.ts) pours the rain forecast onto this grid and
// lets it run downhill, fill hollows and drain away. This script does the slow, fixed part once:
//
//   1. Terrain: SRTM via AWS Terrain Tiles (Terrarium, zoom 12, ~38 m cells), a 3 × 3 median to take
//      out single-cell noise. A surface model: buildings read a little high, streets a little low.
//   2. Where water leaves the city: the grid's edge, the rivers (low ground joined to the edge at
//      river level), and open water and canals mapped in OpenStreetMap (Overpass).
//   3. Priority-Flood (Barnes, Lehman & Mulla 2014, with ε for flats), from those outlets inward.
//      Every cell gets the neighbour it drains to, and the depth of the hollow it sits in (how much
//      water it holds before spilling over).
//   4. Upstream area: how many cells drain through each one (bigger drains are built there).
//
// Run:  node scripts/build-hydrology.mjs [--stats]
// Data: SRTM, public domain; tiles by Mapzen / AWS Open Data. Water and canals © OpenStreetMap
// contributors (ODbL).

import { createHash } from 'node:crypto'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateRawSync, inflateSync } from 'node:zlib'

// Central Phnom Penh: Sen Sok and Por Senchey's east to Chbar Ampov, Russey Keo to Meanchey.
const [WEST, SOUTH, EAST, NORTH] = [104.79, 11.47, 104.98, 11.66]
const Z = 12
/** Rivers in the model sit at about this height (metres); lower ground joined to the edge is river. */
const RIVER_LEVEL = 6
/** Hollows deeper than this are lakes and borrow pits, not streets: they hold no more than this. */
const MAX_HOLD_CM = 120
const STATS = process.argv.includes('--stats')

const UA = { 'User-Agent': 'phnomflood-ai hydrology build script' }
const SIZE = 256 * 2 ** Z
const pxOf = (lng) => ((lng + 180) / 360) * SIZE
const pyOf = (lat) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * SIZE
}
const lngOf = (px) => (px / SIZE) * 360 - 180
const latOf = (py) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / SIZE))) * 180) / Math.PI

/** Minimal PNG decoder for 8-bit RGB/RGBA, non-interlaced (what the terrain tiles use). */
function decodePng(buf) {
  let p = 8
  let w = 0
  let h = 0
  let bpp = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bpp = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0
      if (!bpp || data[8] !== 8 || data[12]) throw new Error('unsupported PNG')
    }
    if (type === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const row = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0
      const b = prev ? prev[i] : 0
      const c = prev && i >= bpp ? prev[i - bpp] : 0
      let v = src[i]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[i] = v & 255
    }
  }
  return { w, bpp, px: out }
}

// ── 1. Terrain ────────────────────────────────────────────────────────────────────────────────
const X0 = Math.floor(pxOf(WEST))
const X1 = Math.ceil(pxOf(EAST))
const Y0 = Math.floor(pyOf(NORTH))
const Y1 = Math.ceil(pyOf(SOUTH))
const W = X1 - X0
const H = Y1 - Y0
const N = W * H
const raw = new Float32Array(N)
for (let ty = Math.floor(Y0 / 256); ty <= Math.floor((Y1 - 1) / 256); ty++) {
  for (let tx = Math.floor(X0 / 256); tx <= Math.floor((X1 - 1) / 256); tx++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`
    const cached = join(tmpdir(), `phnomflood-terrarium-${Z}-${tx}-${ty}.png`)
    let png
    try {
      png = await readFile(cached)
    } catch {
      const res = await fetch(url, { headers: UA })
      if (!res.ok) throw new Error(`${url}: ${res.status}`)
      png = Buffer.from(await res.arrayBuffer())
      await writeFile(cached, png)
    }
    const { w, bpp, px } = decodePng(png)
    for (let y = 0; y < 256; y++) {
      const gy = ty * 256 + y - Y0
      if (gy < 0 || gy >= H) continue
      for (let x = 0; x < 256; x++) {
        const gx = tx * 256 + x - X0
        if (gx < 0 || gx >= W) continue
        const i = (y * w + x) * bpp
        raw[gy * W + gx] = px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768
      }
    }
    console.log(`tile ${tx},${ty}`)
  }
}
const elev = new Float32Array(N)
{
  const win = new Float32Array(9)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let k = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win[k++] = raw[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]
      elev[y * W + x] = win.sort()[4]
    }
  }
  // The source is in whole metres, so every hollow would be 1 m or 2 m deep. Two 5 × 5 box blurs
  // (close to a Gaussian, σ ≈ 2 cells) turn the steps into slopes; real hollows stay hollows.
  const tmp = new Float32Array(N)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let d = -2; d <= 2; d++) s += elev[y * W + Math.min(W - 1, Math.max(0, x + d))]
        tmp[y * W + x] = s / 5
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let s = 0
        for (let d = -2; d <= 2; d++) s += tmp[Math.min(H - 1, Math.max(0, y + d)) * W + x]
        elev[y * W + x] = s / 5
      }
    }
  }
}

// Neighbours, clockwise from north. Direction code d means "drains to the d-th neighbour".
const DX = [0, 1, 1, 1, 0, -1, -1, -1]
const DY = [-1, -1, 0, 1, 1, 1, 0, -1]
const OUTLET = 8

// ── 2. Outlets ────────────────────────────────────────────────────────────────────────────────
const outlet = new Uint8Array(N)
for (let x = 0; x < W; x++) outlet[x] = outlet[(H - 1) * W + x] = 1
for (let y = 0; y < H; y++) outlet[y * W] = outlet[y * W + W - 1] = 1
// Rivers: ground at river level or lower, joined to the edge through ground just as low.
{
  const stack = []
  for (let i = 0; i < N; i++) if (outlet[i] && elev[i] <= RIVER_LEVEL) stack.push(i)
  const seen = new Uint8Array(N)
  for (const i of stack) seen[i] = 1
  while (stack.length) {
    const i = stack.pop()
    outlet[i] = 1
    const x = i % W
    const y = (i - x) / W
    for (let d = 0; d < 8; d += 2) {
      const nx = x + DX[d]
      const ny = y + DY[d]
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const n = ny * W + nx
      if (!seen[n] && elev[n] <= RIVER_LEVEL) {
        seen[n] = 1
        stack.push(n)
      }
    }
  }
}
const riverCells = outlet.reduce((s, v) => s + v, 0) - 2 * (W + H) + 4

// Mapped water: lakes and ponds (filled) and canals, rivers and drains (drawn as lines).
const cellOf = (lat, lng) => [pxOf(lng) - X0, pyOf(lat) - Y0]
// Overpass is busy at times: a few rounds over two servers, and the answer is kept for a day so
// re-running the script while tuning does not ask again.
async function overpass(query) {
  const cache = join(tmpdir(), `phnomflood-overpass-${createHash('sha1').update(query).digest('hex').slice(0, 12)}.json`)
  try {
    if (Date.now() - (await stat(cache)).mtimeMs < 86400000) return JSON.parse(await readFile(cache, 'utf8'))
  } catch {
    // Not cached yet.
  }
  for (let round = 0; round < 4; round++) {
    for (const server of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
      try {
        const res = await fetch(server, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}`, signal: AbortSignal.timeout(90000) })
        if (res.ok) {
          const json = await res.json()
          await writeFile(cache, JSON.stringify(json))
          return json
        }
        console.warn(`${server}: ${res.status}`)
      } catch (error) {
        console.warn(`${server}: ${error.message}`)
      }
    }
    await new Promise((r) => setTimeout(r, 10000 * (round + 1)))
  }
  throw new Error('Overpass unavailable')
}
const bbox = `${SOUTH},${WEST},${NORTH},${EAST}`
const osm = await overpass(`[out:json][timeout:80];(way["natural"="water"](${bbox});way["waterway"~"^(river|canal|drain|ditch|stream)$"](${bbox}););out geom;`)
let lakes = 0
let canals = 0
function line(ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2) + 1
  for (let k = 0; k <= steps; k++) {
    const x = Math.floor(ax + ((bx - ax) * k) / steps)
    const y = Math.floor(ay + ((by - ay) * k) / steps)
    if (x >= 0 && y >= 0 && x < W && y < H) outlet[y * W + x] = 1
  }
}
for (const el of osm.elements ?? []) {
  const pts = (el.geometry ?? []).map((g) => cellOf(g.lat, g.lon))
  if (pts.length < 2) continue
  const closed = el.tags?.natural === 'water' && pts.length > 3
  if (closed) {
    // Even-odd scanline fill of the ring.
    lakes++
    const ys = pts.map((p) => p[1])
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(H - 1, Math.ceil(Math.max(...ys))); y++) {
      const cy = y + 0.5
      const xs = []
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k]
        const [bx, by] = pts[k + 1]
        if ((ay <= cy) !== (by <= cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(W, Math.round(xs[k + 1])); x++) outlet[y * W + x] = 1
    }
  } else {
    canals++
  }
  for (let k = 1; k < pts.length; k++) line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1])
}

// ── 3. Priority-Flood + ε ─────────────────────────────────────────────────────────────────────
// A binary min-heap on filled height, plus a FIFO for cells raised to their spill level (pits and
// flats), which are taken first so a flat drains toward where it was entered.
const filled = new Float64Array(N)
const dir = new Uint8Array(N).fill(255)
const order = new Int32Array(N) // downstream first
let ordered = 0
const heap = []
const push = (i) => {
  heap.push(i)
  let c = heap.length - 1
  while (c > 0) {
    const p = (c - 1) >> 1
    if (filled[heap[p]] <= filled[heap[c]]) break
    ;[heap[p], heap[c]] = [heap[c], heap[p]]
    c = p
  }
}
const pop = () => {
  const top = heap[0]
  const last = heap.pop()
  if (heap.length) {
    heap[0] = last
    let c = 0
    for (;;) {
      const l = 2 * c + 1
      const r = l + 1
      let m = c
      if (l < heap.length && filled[heap[l]] < filled[heap[m]]) m = l
      if (r < heap.length && filled[heap[r]] < filled[heap[m]]) m = r
      if (m === c) break
      ;[heap[m], heap[c]] = [heap[c], heap[m]]
      c = m
    }
  }
  return top
}
for (let i = 0; i < N; i++) {
  if (!outlet[i]) continue
  filled[i] = elev[i]
  dir[i] = OUTLET
  push(i)
}
const pit = []
let pitHead = 0
const EPS = 1e-4
while (heap.length || pitHead < pit.length) {
  const c = pitHead < pit.length ? pit[pitHead++] : pop()
  if (pitHead === pit.length) {
    pit.length = 0
    pitHead = 0
  }
  order[ordered++] = c
  const x = c % W
  const y = (c - x) / W
  for (let d = 0; d < 8; d++) {
    const nx = x + DX[d]
    const ny = y + DY[d]
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
    const n = ny * W + nx
    if (dir[n] !== 255) continue
    dir[n] = (d + 4) % 8 // n drains back toward c
    if (elev[n] <= filled[c] + EPS) {
      filled[n] = filled[c] + EPS
      pit.push(n)
    } else {
      filled[n] = elev[n]
      push(n)
    }
  }
}
if (ordered !== N) throw new Error(`ordered ${ordered} of ${N}`)

// Depth of the hollow each cell sits in, in cm (the ε steps on flats are not a hollow).
const hold = new Uint8Array(N)
for (let i = 0; i < N; i++) hold[i] = Math.min(MAX_HOLD_CM, Math.max(0, Math.round((filled[i] - elev[i]) * 100 - 0.5)))

// ── 4. Upstream area ──────────────────────────────────────────────────────────────────────────
const area = new Float64Array(N).fill(1)
const down = (i) => {
  const d = dir[i]
  if (d === OUTLET) return -1
  const x = (i % W) + DX[d]
  const y = Math.floor(i / W) + DY[d]
  return y * W + x
}
for (let k = N - 1; k >= 0; k--) {
  const i = order[k]
  const j = down(i)
  if (j >= 0) area[j] += area[i]
}
// Stored as log2 of the cell count, in eighths (0 = one cell, 255 = 2^32 cells).
const upstream = new Uint8Array(N)
for (let i = 0; i < N; i++) upstream[i] = Math.min(255, Math.round(Math.log2(area[i]) * 8))

if (STATS) {
  const hist = new Map()
  for (let i = 0; i < N; i++) hist.set(Math.round(elev[i]), (hist.get(Math.round(elev[i])) ?? 0) + 1)
  console.log('elevation histogram (m: cells)', [...hist].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '))
  const held = hold.reduce((s, v) => s + (v > 0 ? 1 : 0), 0)
  console.log(`hollows: ${held} cells (${((held / N) * 100).toFixed(1)} %), mean ${(hold.reduce((s, v) => s + v, 0) / Math.max(1, held)).toFixed(0)} cm`)
  console.log(`largest upstream area: ${area.reduce((m, v) => Math.max(m, v), 0)} cells`); const hh = new Map(); for (const v of hold) if (v) hh.set(Math.min(10, Math.ceil(v / 10)), (hh.get(Math.min(10, Math.ceil(v / 10))) ?? 0) + 1); console.log("hold by 10 cm band", [...hh].sort((a, b) => a[0] - b[0]).join(" "))
}

const pack = (bytes) => deflateRawSync(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), { level: 9 }).toString('base64')
const outletCount = dir.reduce((s, v) => s + (v === OUTLET ? 1 : 0), 0)
await writeFile(
  new URL('../src/data/hydrology.generated.json', import.meta.url),
  JSON.stringify({
    note: 'Built by scripts/build-hydrology.mjs. Each field: raw-deflated bytes, base64, row by row from the north-west corner. dir: neighbour each cell drains to (0 N, 1 NE ... 7 NW; 8 outlet). hold: depth of the hollow, cm. upstream: log2(cells draining through) * 8.',
    source: 'SRTM via AWS Terrain Tiles (Mapzen), zoom 12, 3 × 3 median; water and canals © OpenStreetMap contributors (ODbL)',
    zoom: Z,
    width: W,
    height: H,
    cellMetres: Math.round(((40075016.686 * Math.cos((((NORTH + SOUTH) / 2) * Math.PI) / 180)) / SIZE) * 10) / 10,
    // West, south, east, north of the grid (Web Mercator)
    bounds: [lngOf(X0), latOf(Y1), lngOf(X1), latOf(Y0)],
    riverLevel: RIVER_LEVEL,
    dir: pack(dir),
    hold: pack(hold),
    upstream: pack(upstream),
  }),
)
console.log(`${W} × ${H} cells; outlets ${outletCount} (river ${riverCells}, OSM ${lakes} water areas, ${canals} waterways)`)
