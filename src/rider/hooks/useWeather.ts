import { useEffect, useState } from 'react'
import type { AppMode } from '../../shared/mode'
import { DEMO_WEATHER, demoRainSeries, fetchLiveWeather } from '../../services/weather'

export interface Weather {
  simulated: boolean
  source: string
  /** mm/h falling now */
  rainNow: number
  /** mm expected over the next three hours */
  next3h: number
  /** highest precipitation probability in the next hours, % */
  chance: number
  heavy: boolean
  observedAt: string | null
  /** Rain in 15-minute steps, the last two hours and the next six (start time, mm/h); demo: the scripted storm */
  series?: RainSlot[]
  /** Live, no signal: when this reading was saved on the phone */
  savedAt?: number
}

export interface RainSlot {
  at: number
  mmh: number
}

export type WeatherState = { status: 'loading' } | { status: 'ready'; weather: Weather } | { status: 'error' }

const REFRESH_MS = 10 * 60 * 1000
// Live: the last reading, kept for up to six hours so a phone with no signal still shows the rain.
const SAVED = 'phnomflood.weather'
const SAVED_MAX_MS = 6 * 3600 * 1000

function loadSaved(): Weather | null {
  try {
    const raw = window.localStorage.getItem(SAVED)
    if (!raw) return null
    const { at, weather } = JSON.parse(raw) as { at: number; weather: Weather }
    return Date.now() - at < SAVED_MAX_MS ? { ...weather, savedAt: at, source: `${weather.source}, saved` } : null
  } catch {
    return null
  }
}

function save(weather: Weather) {
  try {
    window.localStorage.setItem(SAVED, JSON.stringify({ at: Date.now(), weather }))
  } catch {
    // Storage blocked: offline simply shows no rain data.
  }
}

/** Demo: the scripted storm. Live: Open-Meteo now and every ten minutes. */
export function useWeather(mode: AppMode): WeatherState {
  const [state, setState] = useState<WeatherState>(() => (mode === 'demo' ? { status: 'ready', weather: { ...DEMO_WEATHER, series: demoRainSeries() } } : { status: 'loading' }))

  useEffect(() => {
    if (mode === 'demo') return
    let controller: AbortController | null = null
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      fetchLiveWeather(controller.signal)
        .then((weather: Weather) => {
          save(weather)
          setState({ status: 'ready', weather })
        })
        .catch((error: Error) => {
          if (error.name === 'AbortError') return
          const saved = loadSaved()
          setState((s) => (s.status === 'ready' ? s : saved ? { status: 'ready', weather: saved } : { status: 'error' }))
        })
    }
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      window.clearInterval(timer)
      controller?.abort()
    }
  }, [mode])

  return state
}
