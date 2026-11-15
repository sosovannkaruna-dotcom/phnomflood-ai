import { useEffect, useState } from 'react'
import type { AppMode } from '../../shared/mode'
import { DEMO_WEATHER, fetchLiveWeather } from '../../services/weather'

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
}

export type WeatherState = { status: 'loading' } | { status: 'ready'; weather: Weather } | { status: 'error' }

const REFRESH_MS = 10 * 60 * 1000

/** Demo: the scripted storm. Live: Open-Meteo now and every ten minutes. */
export function useWeather(mode: AppMode): WeatherState {
  const [state, setState] = useState<WeatherState>(() => (mode === 'demo' ? { status: 'ready', weather: DEMO_WEATHER } : { status: 'loading' }))

  useEffect(() => {
    if (mode === 'demo') return
    let controller: AbortController | null = null
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      fetchLiveWeather(controller.signal)
        .then((weather: Weather) => setState({ status: 'ready', weather }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') setState((s) => (s.status === 'ready' ? s : { status: 'error' }))
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
