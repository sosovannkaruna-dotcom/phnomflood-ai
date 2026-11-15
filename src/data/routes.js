// Preset demo trips.
//
// GEOMETRY IS REAL: every `path` in routeGeometry.json follows actual streets. It
// was pre-computed once with the public OSRM engine on OpenStreetMap data, so the
// app needs no routing server at runtime.
//
// ETAs ARE ILLUSTRATIVE: `typicalMinutes` are demo values for a motorbike in rain
// traffic, not measurements. Replace them with live engine durations later.
//
// candidates[0] is always the "standard" route a generic map app would suggest.

import geometry from './routeGeometry.json'
import generated from './routeMeta.generated.json'

const candidate = (id, via, typicalMinutes) => ({
  id,
  via,
  typicalMinutes,
  distanceM: geometry[id].distanceM,
  path: geometry[id].path,
})

const endpoint = (name, short, point) => ({ name, short, lat: point[0], lng: point[1] })

function preset(id, origin, destination, candidates) {
  const path = candidates[0].path
  return {
    id,
    label: `${origin.short} → ${destination.short}`,
    origin: endpoint(origin.name, origin.short, path[0]),
    destination: endpoint(destination.name, destination.short, path[path.length - 1]),
    candidates,
  }
}

const HAND_MADE = [
  preset(
    'rupp-bkk',
    { name: 'Royal University of Phnom Penh (RUPP)', short: 'RUPP' },
    { name: 'BKK1 Market (Phsar Boeung Keng Kang)', short: 'BKK1 Market' },
    [
      candidate('rupp-bkk-a', 'Russian Blvd → Nehru Blvd → Sihanouk Blvd', 14),
      candidate('rupp-bkk-b', 'Kampuchea Krom Blvd → Mao Tse Toung Blvd', 17),
      candidate('rupp-bkk-c', 'Kampuchea Krom Blvd → Nehru Blvd → St. 63', 19),
    ],
  ),
  preset(
    'watphnom-russianmarket',
    { name: 'Wat Phnom', short: 'Wat Phnom' },
    { name: 'Russian Market (Phsar Toul Tompoung)', short: 'Russian Market' },
    [
      candidate('watphnom-russianmarket-a', 'Charles de Gaulle Blvd → St. 163', 13),
      candidate('watphnom-russianmarket-b', 'Norodom Blvd → Mao Tse Toung Blvd', 16),
      candidate('watphnom-russianmarket-c', 'Sisowath Quay → Sihanouk Blvd → Norodom Blvd', 18),
    ],
  ),
  preset(
    'tk-rupp',
    { name: 'TK Avenue, Tuol Kork', short: 'TK Avenue' },
    { name: 'Royal University of Phnom Penh (RUPP)', short: 'RUPP' },
    [
      candidate('tk-rupp-a', 'Street 289 → Russian Blvd', 8),
      candidate('tk-rupp-b', 'St. 317 → St. 598 → Kampuchea Krom Blvd', 11),
    ],
  ),
]

// More destinations, generated once offline (the generator is not in this repo): real OSRM geometry,
// English street names and Sangkat/Khan from OpenStreetMap (Nominatim), turn lists from the OSRM steps.
// ETAs are illustrative, like the hand-made trips above.
const GENERATED = generated.presets.map((p) =>
  preset(
    p.id,
    p.origin,
    p.destination,
    p.candidates.map((c) => candidate(c.id, c.via, c.typicalMinutes)),
  ),
)

export const ROUTE_PRESETS = [...HAND_MADE, ...GENERATED]

export const PHNOM_PENH_CENTER = [11.5564, 104.9282]
