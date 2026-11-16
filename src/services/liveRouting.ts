// Live mode: search any place and route to it, like a normal map app.
//
// - Place search: Photon (komoot), an open geocoder built on OpenStreetMap, biased to the rider
//   and limited to greater Phnom Penh. Falls back to Nominatim if Photon is unreachable.
// - Routing: the public OSRM server on OpenStreetMap roads, with up to three alternatives.
//   Every alternative is then checked against the flood reports, exactly like the demo trips.

import type { Candidate, LatLng, Maneuver, Preset } from '../rider/types'

/** Greater Phnom Penh: west, south, east, north */
const BBOX = [104.72, 11.42, 105.08, 11.72] as const

export interface FoundPlace {
  id: string
  name: string
  /** street, Sangkat or Khan, for the second line of a result */
  detail: string
  lat: number
  lng: number
}

const clean = (parts: (string | undefined)[]) => [...new Set(parts.filter((p): p is string => !!p && p.trim().length > 0))].join(', ')

async function photon(query: string, near: LatLng | null, signal: AbortSignal): Promise<FoundPlace[]> {
  const params = new URLSearchParams({ q: query, limit: '8', bbox: BBOX.join(',') })
  if (near) {
    params.set('lat', String(near[0]))
    params.set('lon', String(near[1]))
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!res.ok) throw new Error(`photon ${res.status}`)
  const json = (await res.json()) as {
    features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[]
  }
  return json.features.map((f, i) => {
    const p = f.properties
    const name = p.name ?? clean([p.housenumber, p.street]) ?? 'Place'
    return {
      id: `${p.osm_type ?? 'x'}${p.osm_id ?? i}`,
      name,
      detail: clean([p.street !== name ? p.street : undefined, p.district, p.locality, p.city]),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }
  })
}

async function nominatim(query: string, lang: string, signal: AbortSignal): Promise<FoundPlace[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '8',
    bounded: '1',
    viewbox: `${BBOX[0]},${BBOX[3]},${BBOX[2]},${BBOX[1]}`,
    'accept-language': lang === 'km' ? 'km,en' : 'en',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal })
  if (!res.ok) throw new Error(`nominatim ${res.status}`)
  const json = (await res.json()) as { place_id: number; name: string; display_name: string; lat: string; lon: string }[]
  return json.map((r) => {
    const parts = r.display_name.split(',').map((s) => s.trim())
    return { id: String(r.place_id), name: r.name || parts[0], detail: parts.slice(1, 4).join(', '), lat: +r.lat, lng: +r.lon }
  })
}

/** The geocoders can list one place more than once (e.g. a park as an area and as a point). */
function unique(places: FoundPlace[]): FoundPlace[] {
  const seen = new Set<string>()
  return places.filter((p) => {
    const key = `${p.name}|${p.lat.toFixed(3)},${p.lng.toFixed(3)}`
    if (seen.has(key) || seen.has(p.id)) return false
    seen.add(key)
    seen.add(p.id)
    return true
  })
}

export async function searchPlaces(query: string, near: LatLng | null, lang: string, signal: AbortSignal): Promise<FoundPlace[]> {
  try {
    const found = await photon(query, near, signal)
    if (found.length) return unique(found)
  } catch (err) {
    if (signal.aborted) throw err
  }
  return unique(await nominatim(query, lang, signal))
}

/** Street name for a point (used to name the rider's spot in live reports). */
export async function reverseName(point: LatLng, lang: string): Promise<{ name: string; sangkat: string; khan: string } | null> {
  try {
    const params = new URLSearchParams({ format: 'jsonv2', zoom: '17', addressdetails: '1', lat: String(point[0]), lon: String(point[1]), 'accept-language': lang === 'km' ? 'km,en' : 'en' })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)
    if (!res.ok) return null
    const json = (await res.json()) as { address?: Record<string, string> }
    const a = json.address ?? {}
    const strip = (s?: string) => (s ?? '').replace(/^(Khan|Sangkat)\s+/i, '')
    const name = a.road ?? a.neighbourhood ?? a.suburb ?? ''
    if (!name) return null
    return { name, sangkat: strip(a.quarter ?? a.village ?? a.suburb), khan: strip(a.city_district ?? a.town ?? a.county) }
  } catch {
    return null
  }
}

// ── Routing ──

interface OsrmStep {
  distance: number
  name: string
  ref?: string
  maneuver: { type: string; modifier?: string }
}
interface OsrmRoute {
  distance: number
  duration: number
  geometry: { coordinates: [number, number][] }
  legs: { steps: OsrmStep[] }[]
}

const KHMER = /[ក-៿]/
const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩'
const arabic = (text: string) => text.replace(/[០-៩]/g, (d) => String(KHMER_DIGITS.indexOf(d)))

/**
 * OSRM gives the local (Khmer) street name. In English, a numbered street reads as "St. 53",
 * the way it is signed and said; a named street without a number keeps its Khmer name.
 */
function roadName(step: OsrmStep, english: boolean): string {
  const name = step.name || step.ref || ''
  if (!english || !KHMER.test(name)) return name
  const plain = arabic(name)
  // "… (២៧៤)", "… (ផ្លូវ ១២៨)" or "ផ្លូវលេខ ៥៣"
  const number = plain.match(/\((?:ផ្លូវ(?:លេខ)?\s*)?(\d+[A-Za-z]?)\)/)?.[1] ?? plain.match(/^ផ្លូវ(?:លេខ)?\s*(\d+[A-Za-z]?)/)?.[1]
  if (number) return /មហាវិថី/.test(name) ? `Blvd ${number}` : `St. ${number}`
  if (/^\d+[A-Za-z]?$/.test(plain.trim())) return `St. ${plain.trim()}`
  return name
}

const turnOf = (modifier = ''): Maneuver['turn'] => (/left/.test(modifier) ? 'left' : /right/.test(modifier) ? 'right' : 'straight')

function toCandidate(route: OsrmRoute, id: string, destination: string, unnamed: string, english: boolean): Candidate {
  const steps = route.legs[0]?.steps ?? []
  const total = steps.reduce((sum, s) => sum + s.distance, 0) || 1
  const maneuvers: Maneuver[] = []
  const byRoad = new Map<string, number>()
  let walked = 0
  let lastRoad = ''
  for (const step of steps) {
    const road = roadName(step, english)
    if (road) byRoad.set(road, (byRoad.get(road) ?? 0) + step.distance)
    const type = step.maneuver.type
    const turn = turnOf(step.maneuver.modifier)
    const keep = type !== 'depart' && type !== 'arrive' && !((type === 'continue' || type === 'new name') && turn === 'straight')
    if (keep && (road || turn !== 'straight') && road !== lastRoad) {
      maneuvers.push({ at: +(walked / total).toFixed(4), turn, street: road || unnamed })
      lastRoad = road
    }
    walked += step.distance
  }
  maneuvers.forEach((m, i) => (m.toward = maneuvers[i + 1]?.street ?? destination))
  maneuvers.push({ at: 1, turn: 'arrive', street: destination })

  // "via": the longest roads, in the order they are ridden.
  const main = [...byRoad.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([road]) => road)
  const order = [...new Set(steps.map((s) => roadName(s, english)).filter((r) => main.includes(r)))]

  return {
    id,
    via: order.join(' → ') || unnamed,
    // A motorbike in rain traffic, about 25 km/h (OSRM's own durations are for a car on empty roads).
    typicalMinutes: Math.max(1, Math.round(route.distance / 417)),
    distanceM: Math.round(route.distance),
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
    maneuvers,
  }
}

// ── English street names ──
//
// OSRM only passes on each street's main OpenStreetMap name, which in Phnom Penh is often Khmer.
// Many of those streets also carry a `name:en` tag. A ready-made "Khmer name → English name" list
// for greater Phnom Penh (scripts/build-street-names.mjs) is loaded with the first live route, so
// names switch at once. A route that leaves that area asks Overpass for its remaining names.

const englishNames = new Map<string, string>()
let listLoad: Promise<void> | null = null

/** Load the built-in street-name list once (its own file, so the demo never downloads it). */
function loadStreetList(): Promise<void> {
  listLoad ??= import('../data/streetNames.generated.json')
    .then((m) => {
      for (const [km, en] of Object.entries(m.default as Record<string, string>)) if (!englishNames.has(km)) englishNames.set(km, en)
    })
    .catch(() => {
      listLoad = null // try again with the next route
    })
  return listLoad
}

const insideList = ([lat, lng]: LatLng) => lat >= BBOX[1] && lat <= BBOX[3] && lng >= BBOX[0] && lng <= BBOX[2]
/** Names already asked about (found or not), so a reroute doesn't ask again */
const lookedUp = new Set<string>()

const hasKhmer = (text: string) => KHMER.test(text)

function renameText(text: string | undefined): string | undefined {
  if (!text || !hasKhmer(text)) return text
  return text
    .split(' → ')
    .map((part) => englishNames.get(part) ?? part)
    .join(' → ')
}

/** The trip with every Khmer street name that has a known English name swapped. Same object if nothing changed. */
export function withEnglishNames(preset: Preset): Preset {
  let changed = false
  const candidates = preset.candidates.map((c) => {
    const via = renameText(c.via) ?? c.via
    const maneuvers = c.maneuvers?.map((m) => {
      const street = renameText(m.street) ?? m.street
      const toward = renameText(m.toward)
      if (street === m.street && toward === m.toward) return m
      return { ...m, street, toward }
    })
    if (via === c.via && maneuvers?.every((m, i) => m === c.maneuvers?.[i])) return c
    changed = true
    return { ...c, via, maneuvers }
  })
  return changed ? { ...preset, candidates } : preset
}

/** True while some street name on the trip is still in Khmer. */
export function hasKhmerNames(preset: Preset): boolean {
  return preset.candidates.some((c) => hasKhmer(c.via) || c.maneuvers?.some((m) => hasKhmer(m.street)))
}

/**
 * For a trip that leaves the area of the built-in list: learn English names for its remaining
 * Khmer-named streets (one Overpass request, asking only for those names inside the trip's area).
 * Resolves true when new names were learned. Failures are silent: the Khmer names stay.
 */
export async function learnEnglishNames(preset: Preset, signal?: AbortSignal): Promise<boolean> {
  // The built-in list already covers every street inside its area that has an English name.
  if (preset.candidates.every((c) => c.path.every(insideList))) return false
  const names = new Set<string>()
  for (const c of preset.candidates) {
    for (const m of c.maneuvers ?? []) if (hasKhmer(m.street)) names.add(m.street)
    for (const part of c.via.split(' → ')) if (hasKhmer(part)) names.add(part)
  }
  const wanted = [...names].filter((n) => !lookedUp.has(n))
  const points = preset.candidates.flatMap((c) => c.path)
  if (!wanted.length || !points.length) return false
  const pad = 0.003 // ~300 m
  const lats = points.map((p) => p[0])
  const lngs = points.map((p) => p[1])
  const box = [Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad].map((v) => v.toFixed(4)).join(',')
  const quote = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const query = `[out:json][timeout:20];(${wanted.map((n) => `way["highway"]["name"=${quote(n)}]["name:en"](${box});`).join('')});out tags;`
  // The main public server is sometimes busy (502/504): try a second public instance.
  for (const server of OVERPASS) {
    if (signal?.aborted) return false
    try {
      const res = await fetch(server, { method: 'POST', body: new URLSearchParams({ data: query }), signal })
      if (!res.ok) continue
      return learnFrom((await res.json()) as OverpassResult, wanted)
    } catch {
      // try the next server
    }
  }
  return false
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
type OverpassResult = { elements?: { tags?: Record<string, string> }[] }

function learnFrom(json: OverpassResult, wanted: string[]): boolean {
  wanted.forEach((n) => lookedUp.add(n))
  let learned = false
  for (const el of json.elements ?? []) {
    const name = el.tags?.name
    const en = el.tags?.['name:en']?.trim()
    if (!name || !en || !hasKhmer(name) || hasKhmer(en) || englishNames.get(name) === en) continue
    englishNames.set(name, en)
    learned = true
  }
  return learned
}

export interface Endpoint {
  name: string
  short: string
  lat: number
  lng: number
}

/** Fetch up to three routes between two points and shape them as a trip. */
export async function routeBetween(id: string, generation: number, origin: Endpoint, destination: Endpoint, unnamed: string, english: boolean, signal?: AbortSignal): Promise<Preset> {
  const names = english ? loadStreetList() : null // loads while the route is fetched
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=3&overview=full&geometries=geojson&steps=true`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`osrm ${res.status}`)
  const json = (await res.json()) as { code: string; routes?: OsrmRoute[] }
  if (json.code !== 'Ok' || !json.routes?.length) throw new Error(`osrm ${json.code}`)
  const candidates = json.routes.slice(0, 3).map((r, i) => toCandidate(r, `${id}-${generation}-${'abc'[i]}`, destination.short, unnamed, english))
  const path = candidates[0].path
  const preset: Preset = {
    id,
    label: `${origin.short} → ${destination.short}`,
    origin: { ...origin, lat: path[0][0], lng: path[0][1] },
    destination: { ...destination, lat: path[path.length - 1][0], lng: path[path.length - 1][1] },
    candidates,
  }
  if (!english) return preset
  await names
  return withEnglishNames(preset)
}
