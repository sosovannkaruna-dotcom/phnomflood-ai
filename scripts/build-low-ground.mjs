// Builds src/data/lowGround.generated.json: where greater Phnom Penh sits low, from a terrain model.
//
// The live map starts empty until riders report water. Low ground is where storm water collects
// first, so the app can shade it (and say how much of a route crosses it) before any report exists.
//
// Source: AWS Terrain Tiles (Terrarium encoding, from Mapzen), which over Cambodia come from SRTM
// (about 30 m cells, whole metres). It is a surface model: buildings and trees read a little high,
// so open ground and old lake beds stand out as lowest. An approximation, labelled as one in the app.
//
// Run:  node scripts/build-low-ground.mjs
// Data: SRTM, public domain; tiles by Mapzen / AWS Open Data (https://registry.opendata.aws/terrain-tiles/).

import { writeFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'

// Greater Phnom Penh: the same box as live search and the street-name list.
const [WEST, SOUTH, EAST, NORTH] = [104.72, 11.42, 105.08, 11.72]
const Z = 12 // ~38 m cells, close to the 30 m source; finer only adds size
// Height classes, metres above sea level. City-wide, about 1 cell in 10 is at 7 m or lower and
// about 1 in 4 at 9 m or lower; the river runs at roughly 5-6 m in the model.
const LOWEST = 7
const LOW = 9

const tileOf = (lat, lng, z) => {
  const n = 2 ** z
  const rad = (lat * Math.PI) / 180
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)]
}
const lngOf = (x, z) => (x / 2 ** z) * 360 - 180
const latOf = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI

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
  return { w, h, bpp, px: out }
}

const [x0, y0] = tileOf(NORTH, WEST, Z)
const [x1, y1] = tileOf(SOUTH, EAST, Z)
const W = (x1 - x0 + 1) * 256
const H = (y1 - y0 + 1) * 256
const height = new Float32Array(W * H)
for (let ty = y0; ty <= y1; ty++) {
  for (let tx = x0; tx <= x1; tx++) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`
    const res = await fetch(url, { headers: { 'User-Agent': 'phnomflood-ai low-ground build script' } })
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    const { w, bpp, px } = decodePng(Buffer.from(await res.arrayBuffer()))
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * w + x) * bpp
        height[(ty - y0) * 256 * W + y * W + (tx - x0) * 256 + x] = px[i] * 256 + px[i + 1] + px[i + 2] / 256 - 32768
      }
    }
    console.log(`tile ${tx},${ty}`)
  }
}

// A 3 × 3 median takes out single-cell noise (a lone tree, a pit in the model).
const classes = new Uint8Array(W * H)
const win = new Float32Array(9)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let k = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win[k++] = height[Math.min(H - 1, Math.max(0, y + dy)) * W + Math.min(W - 1, Math.max(0, x + dx))]
    const m = win.sort()[4]
    classes[y * W + x] = m <= LOWEST ? 2 : m <= LOW ? 1 : 0
  }
}

// Run-length encoded, row by row: each run is stored as length * 3 + class.
const runs = []
let cls = classes[0]
let len = 0
for (let i = 0; i < classes.length; i++) {
  if (classes[i] === cls) len++
  else {
    runs.push(len * 3 + cls)
    cls = classes[i]
    len = 1
  }
}
runs.push(len * 3 + cls)

const share = (c) => Math.round((classes.filter((v) => v === c).length / classes.length) * 1000) / 10
await writeFile(
  new URL('../src/data/lowGround.generated.json', import.meta.url),
  JSON.stringify({
    note: 'Built by scripts/build-low-ground.mjs. Classes: 0 not low, 1 low (<= 9 m), 2 lowest (<= 7 m). Runs: length * 3 + class.',
    source: 'SRTM via AWS Terrain Tiles (Mapzen), zoom 12',
    zoom: Z,
    width: W,
    height: H,
    // West, south, east, north of the grid (tile-aligned, Web Mercator)
    bounds: [lngOf(x0, Z), latOf(y1 + 1, Z), lngOf(x1 + 1, Z), latOf(y0, Z)],
    thresholds: { low: LOW, lowest: LOWEST },
    runs,
  }),
)
console.log(`${W} × ${H} cells, ${runs.length} runs; low ${share(1)} %, lowest ${share(2)} %`)
