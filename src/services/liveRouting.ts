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
  const number = plain.match(/\((\d+[A-Za-z]?)\)/)?.[1] ?? plain.match(/^ផ្លូវ(?:លេខ)?\s*(\d+[A-Za-z]?)/)?.[1]
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

export interface Endpoint {
  name: string
  short: string
  lat: number
  lng: number
}

/** Fetch up to three routes between two points and shape them as a trip. */
export async function routeBetween(id: string, generation: number, origin: Endpoint, destination: Endpoint, unnamed: string, english: boolean, signal?: AbortSignal): Promise<Preset> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=3&overview=full&geometries=geojson&steps=true`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`osrm ${res.status}`)
  const json = (await res.json()) as { code: string; routes?: OsrmRoute[] }
  if (json.code !== 'Ok' || !json.routes?.length) throw new Error(`osrm ${json.code}`)
  const candidates = json.routes.slice(0, 3).map((r, i) => toCandidate(r, `${id}-${generation}-${'abc'[i]}`, destination.short, unnamed, english))
  const path = candidates[0].path
  return {
    id,
    label: `${origin.short} → ${destination.short}`,
    origin: { ...origin, lat: path[0][0], lng: path[0][1] },
    destination: { ...destination, lat: path[path.length - 1][0], lng: path[path.length - 1][1] },
    candidates,
  }
}
