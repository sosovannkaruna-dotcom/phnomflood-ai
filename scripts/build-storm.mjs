// Builds src/data/storm-2026-02-26.generated.json: the map and rain data behind the storm replay
// on the Open data page (the story itself, with its sources, is in src/data/storms.ts).
//
// - District outlines for the four khans Khmer Times named, and Preah Sisowath Quay (the riverside
//   in Daun Penh), from OpenStreetMap through Nominatim. Data © OpenStreetMap contributors, ODbL.
// - What the weather models had for central Phnom Penh that day, hour by hour (mm), from
//   Open-Meteo's historical forecast archive. CC BY 4.0.
//
// Run:  node scripts/build-storm.mjs

import { writeFile } from 'node:fs/promises'

const DATE = '2026-02-26'
const UA = { 'User-Agent': 'phnomflood-ai storm build script' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// OpenStreetMap boundary relations (admin level 6, khan)
const KHANS = [
  { id: 'daun-penh', osm: 'R2259499' },
  { id: 'tuol-kouk', osm: 'R2259504' },
  { id: 'sen-sok', osm: 'R2259503' },
  { id: 'boeng-keng-kang', osm: 'R11165749' },
]

const round = (geom) => JSON.parse(JSON.stringify(geom, (_, v) => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v)))

async function nominatim(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, { headers: UA, signal: AbortSignal.timeout(30000) })
      if (res.ok) return await res.json()
    } catch {}
    await sleep(2000 * (attempt + 1))
  }
  throw new Error(`nominatim failed: ${path}`)
}

const areas = []
for (const k of KHANS) {
  const [hit] = await nominatim(`lookup?osm_ids=${k.osm}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.0004`)
  areas.push({ id: k.id, centre: [Math.round(Number(hit.lat) * 1e5) / 1e5, Math.round(Number(hit.lon) * 1e5) / 1e5], geometry: round(hit.geojson) })
  console.log(k.id, hit.geojson.type)
  await sleep(1200)
}

// The riverside: every mapped piece of Preah Sisowath Quay inside Daun Penh.
const quay = await nominatim(`search?q=${encodeURIComponent('Preah Sisowath Quay, Phnom Penh')}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.0001&limit=20`)
const riverside = quay.filter((q) => q.geojson?.type === 'LineString').map((q) => round(q.geojson).coordinates)
console.log('riverside pieces', riverside.length)

// What the models had (no rain gauge record is openly available for the day).
const MODELS = [
  { id: 'best_match', label: 'Open-Meteo best match' },
  { id: 'ecmwf_ifs025', label: 'ECMWF IFS' },
  { id: 'icon_seamless', label: 'DWD ICON' },
  { id: 'gfs_seamless', label: 'NOAA GFS' },
]
const models = []
for (const m of MODELS) {
  const params = new URLSearchParams({ latitude: '11.56', longitude: '104.92', start_date: DATE, end_date: DATE, hourly: 'precipitation', timezone: 'Asia/Phnom_Penh', models: m.id })
  const res = await fetch(`https://historical-forecast-api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`open-meteo ${m.id}: ${res.status}`)
  const json = await res.json()
  models.push({ ...m, hourly: json.hourly.precipitation.map((v) => v ?? 0) })
  console.log(m.id, json.hourly.precipitation.join(' '))
}

await writeFile(
  new URL('../src/data/storm-2026-02-26.generated.json', import.meta.url),
  JSON.stringify({
    note: 'Built by scripts/build-storm.mjs. Outlines © OpenStreetMap contributors (ODbL); model rain from Open-Meteo historical forecasts (CC BY 4.0), mm per hour, local time.',
    date: DATE,
    areas,
    riverside,
    models,
  }),
)
console.log('done')
