// Builds src/data/streetNames.generated.json: Khmer street name → English street name, for every
// road in greater Phnom Penh that has a `name:en` tag in OpenStreetMap.
//
// Live mode uses it to show English street names instantly (OSRM only passes on the main, often
// Khmer, name). Streets missing from the list are still looked up from Overpass at run time.
//
// Run:  node scripts/build-street-names.mjs
// Data © OpenStreetMap contributors, ODbL.

import { writeFile } from 'node:fs/promises'

// Greater Phnom Penh, the same box as live search, fetched as a 3 × 3 grid of tiles so each
// request stays small enough for the busy public servers.
const [WEST, SOUTH, EAST, NORTH] = [104.72, 11.42, 105.08, 11.72]
const GRID = 3
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const KHMER = /[ក-៿]/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchTile(box) {
  const query = `[out:json][timeout:90];way["highway"]["name"]["name:en"](${box});out tags;`
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const server of SERVERS) {
      try {
        const res = await fetch(server, {
          method: 'POST',
          headers: { 'User-Agent': 'phnomflood-ai street-name build script' },
          body: new URLSearchParams({ data: query }),
        })
        if (res.ok) return (await res.json()).elements ?? []
        console.warn(`  ${new URL(server).host}: HTTP ${res.status}`)
      } catch (err) {
        console.warn(`  ${new URL(server).host}: ${err.message}`)
      }
    }
    await sleep(10000 * (attempt + 1))
  }
  throw new Error(`No Overpass server answered for ${box}`)
}

const elements = []
for (let i = 0; i < GRID; i++) {
  for (let j = 0; j < GRID; j++) {
    const s = SOUTH + ((NORTH - SOUTH) * i) / GRID
    const w = WEST + ((EAST - WEST) * j) / GRID
    const box = [s, w, s + (NORTH - SOUTH) / GRID, w + (EAST - WEST) / GRID].map((v) => v.toFixed(3)).join(',')
    const found = await fetchTile(box)
    console.log(`tile ${i * GRID + j + 1}/${GRID * GRID} (${box}): ${found.length} ways`)
    elements.push(...found)
  }
}

const counts = new Map() // Khmer name → (English name → number of ways), to pick the usual one
for (const el of elements) {
  const name = el.tags?.name?.trim()
  const en = el.tags?.['name:en']?.trim()
  if (!name || !en || !KHMER.test(name) || KHMER.test(en)) continue
  const byEn = counts.get(name) ?? new Map()
  byEn.set(en, (byEn.get(en) ?? 0) + 1)
  counts.set(name, byEn)
}

const names = Object.fromEntries(
  [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, byEn]) => [name, [...byEn.entries()].sort((a, b) => b[1] - a[1])[0][0]]),
)
await writeFile(new URL('../src/data/streetNames.generated.json', import.meta.url), JSON.stringify(names, null, 1) + '\n')
console.log(`${elements.length} ways → ${Object.keys(names).length} Khmer street names with English names`)
