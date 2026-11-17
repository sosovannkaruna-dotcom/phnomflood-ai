// Rain over central Phnom Penh from Open-Meteo (free, no key): falling now (mm/h) and the next
// three hours (mm). Shared by the AI briefing and the open data feed. Null when it cannot be read.
export async function fetchRain({ timeout = 5000 } = {}) {
  try {
    const params = new URLSearchParams({ latitude: '11.5564', longitude: '104.9282', current: 'precipitation', hourly: 'precipitation', forecast_hours: '4', timezone: 'Asia/Phnom_Penh' })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(timeout) })
    if (!res.ok) return null
    const json = await res.json()
    const next3h = (json.hourly?.precipitation ?? []).slice(1, 4).reduce((a, b) => a + (b ?? 0), 0)
    return { rainNow: Number(json.current?.precipitation ?? 0), next3h: Math.round(next3h * 10) / 10 }
  } catch {
    return null
  }
}
