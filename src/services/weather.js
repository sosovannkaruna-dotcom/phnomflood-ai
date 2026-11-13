// Rainfall feed.
//
// Today: a fixed demo scenario (heavy rain) so the pitch video always shows the
// same alert. Later: call `fetchLiveRainfall` — Open-Meteo is free and needs no key.

export const DEMO_WEATHER = {
  city: 'Phnom Penh',
  alert: 'Heavy Rain Alert',
  rainMmPerHour: 32,
  source: 'Open-Meteo',
}

export function getWeather() {
  return DEMO_WEATHER
}

/** Live current precipitation for central Phnom Penh (not used by the demo). */
export async function fetchLiveRainfall() {
  const url =
    'https://api.open-meteo.com/v1/forecast?latitude=11.5564&longitude=104.9282&current=precipitation,rain'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`)
  const json = await res.json()
  return {
    city: 'Phnom Penh',
    rainMmPerHour: json.current?.precipitation ?? 0,
    observedAt: json.current?.time,
    source: 'Open-Meteo',
  }
}
