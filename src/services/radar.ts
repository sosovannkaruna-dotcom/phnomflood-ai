// Rain radar from RainViewer (free, no key): the last two hours in 10-minute frames.
// The free tiles stop at zoom 7, so over the city the rain shows as a soft regional layer, not
// street detail, and radar coverage over Cambodia can be partial. The app says both.

export interface RadarFrame {
  /** Unix seconds */
  time: number
  /** Tile URL template for MapLibre */
  tiles: string
}

export const RADAR_MAX_ZOOM = 7

export async function fetchRadarFrames(signal?: AbortSignal): Promise<RadarFrame[]> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', { signal })
  if (!res.ok) throw new Error(`rainviewer ${res.status}`)
  const json = (await res.json()) as { host: string; radar?: { past?: { time: number; path: string }[] } }
  // Colour scheme 2 ("universal blue"), smoothed, with snow shown as rain.
  return (json.radar?.past ?? []).map((f) => ({ time: f.time, tiles: `${json.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png` }))
}
