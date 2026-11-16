import { useEffect, useState } from 'react'
import { fetchHotspots, syncConfigured } from '../../services/sync'

/** A place riders have reported water on two or more different days. */
export interface Hotspot {
  lat: number
  lng: number
  name: string
  khan: string
  reports: number
  /** of which knee- or waist-deep */
  deep: number
  /** distinct days with a report */
  days: number
  lastReported: number
}

export type HotspotState = { status: 'off' } | { status: 'loading' } | { status: 'ready'; spots: Hotspot[] } | { status: 'not-set-up' } | { status: 'error' }

const REFRESH_MS = 30 * 60 * 1000

/** Live only: flood-prone spots from report history, refreshed every half hour. */
export function useHotspots(enabled: boolean): HotspotState {
  const on = enabled && syncConfigured
  const [state, setState] = useState<HotspotState>(on ? { status: 'loading' } : { status: 'off' })
  useEffect(() => {
    if (!on) return
    let controller: AbortController | null = null
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      fetchHotspots(90, controller.signal)
        .then((spots: Hotspot[]) => setState({ status: 'ready', spots }))
        .catch((error: Error) => {
          if (error.name === 'AbortError') return
          setState((s) => (s.status === 'ready' ? s : { status: error.name === 'NotSetUp' ? 'not-set-up' : 'error' }))
        })
    }
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      window.clearInterval(timer)
      controller?.abort()
    }
  }, [on])
  return state
}
