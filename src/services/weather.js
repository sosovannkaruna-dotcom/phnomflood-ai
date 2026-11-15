// Rainfall for central Phnom Penh.
//
// demo: a fixed storm scenario, so the pitch always shows the same alert.
// live: Open-Meteo (free, no key): rain falling now plus the next three hours.

const LAT = 11.5564
const LNG = 104.9282
// WMO / AMS: 7.6 mm/h and above is heavy rain; enough to flood low streets quickly in Phnom Penh.
export const HEAVY_MM_PER_HOUR = 7.6

export const DEMO_WEATHER = {
  simulated: true,
  source: 'Demo scenario',
  rainNow: 32,
  next3h: 61,
  chance: 95,
  heavy: true,
  observedAt: null,
}

export async function fetchLiveWeather(signal) {
  const params = new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LNG),
    current: 'precipitation,rain',
    hourly: 'precipitation,precipitation_probability',
    forecast_hours: '4',
    timezone: 'Asia/Phnom_Penh',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal })
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)
  const json = await res.json()
  const rainNow = Number(json.current?.precipitation ?? 0)
  const hourly = json.hourly ?? {}
  // hourly starts at the current hour: the next three hours are indices 1–3
  const next = (hourly.precipitation ?? []).slice(1, 4)
  const next3h = Math.round(next.reduce((a, b) => a + (b ?? 0), 0) * 10) / 10
  const chance = Math.max(0, ...(hourly.precipitation_probability ?? []).slice(0, 4).map((x) => x ?? 0))
  return {
    simulated: false,
    source: 'Open-Meteo',
    rainNow,
    next3h,
    chance,
    heavy: rainNow >= HEAVY_MM_PER_HOUR || next3h >= HEAVY_MM_PER_HOUR * 2,
    observedAt: json.current?.time ?? null,
  }
}
