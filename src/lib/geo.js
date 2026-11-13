// Small geometry helpers. Paths are arrays of [lat, lng] pairs (Leaflet order).

const R = 6371000
const toRad = (d) => (d * Math.PI) / 180

/** Great-circle distance in metres between two [lat, lng] points. */
export function haversine(a, b) {
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Project to local metres around a reference latitude (accurate at city scale).
function toXY(p, refLat) {
  return [toRad(p[1]) * R * Math.cos(toRad(refLat)), toRad(p[0]) * R]
}

/** Shortest distance in metres from a point to a polyline. */
export function distanceToPath(point, path) {
  if (!path || path.length === 0) return Infinity
  const ref = point[0]
  const [px, py] = toXY(point, ref)
  let best = Infinity
  let [ax, ay] = toXY(path[0], ref)
  if (path.length === 1) return Math.hypot(px - ax, py - ay)
  for (let i = 1; i < path.length; i++) {
    const [bx, by] = toXY(path[i], ref)
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (d < best) best = d
    ax = bx
    ay = by
  }
  return best
}

/** Total length of a path in metres. */
export function pathLength(path) {
  let total = 0
  for (let i = 1; i < path.length; i++) total += haversine(path[i - 1], path[i])
  return total
}

/** The point a given fraction (0–1) of the way along a path. */
export function pointAlong(path, fraction) {
  const target = pathLength(path) * Math.max(0, Math.min(1, fraction))
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    const seg = haversine(path[i - 1], path[i])
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t,
      ]
    }
    walked += seg
  }
  return path[path.length - 1]
}

/** [[south, west], [north, east]] bounds covering every given path. */
export function boundsOf(paths) {
  let s = 90
  let w = 180
  let n = -90
  let e = -180
  for (const path of paths) {
    for (const [lat, lng] of path) {
      if (lat < s) s = lat
      if (lat > n) n = lat
      if (lng < w) w = lng
      if (lng > e) e = lng
    }
  }
  return [
    [s, w],
    [n, e],
  ]
}

/** Nearest entry of a list of { lat, lng } places to a point, with its distance. */
export function nearestPlace(point, places) {
  let best = null
  let bestD = Infinity
  for (const place of places) {
    const d = haversine(point, [place.lat, place.lng])
    if (d < bestD) {
      bestD = d
      best = place
    }
  }
  return { place: best, distance: bestD }
}
