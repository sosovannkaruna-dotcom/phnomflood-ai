import { useEffect, useState } from 'react'

// The AI city flood briefing (api/briefing.js), refreshed every five minutes and whenever
// the reports change.

export interface Briefing {
  headline: string
  summary: string
  areas: { name: string; note: string }[]
  advice: string
  ai: boolean
  model: string | null
  lang: 'en' | 'km'
  basedOn: { reports: number; verified: number; rainNow: number | null; next3h: number | null }
  generatedAt: string
}

export type BriefingState = { status: 'loading' } | { status: 'ready'; briefing: Briefing } | { status: 'error' }

const REFRESH_MS = 5 * 60 * 1000

/** `changeKey`: anything that changes when the reports change (count, latest id), to refetch sooner. */
export function useBriefing(lang: 'en' | 'km', enabled: boolean, changeKey: string | number = 0): BriefingState {
  const [state, setState] = useState<BriefingState>({ status: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let controller: AbortController | null = null
    const load = () => {
      controller?.abort()
      controller = new AbortController()
      fetch(`/api/briefing?lang=${lang}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((briefing: Briefing) => setState({ status: 'ready', briefing }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') setState((s) => (s.status === 'ready' ? s : { status: 'error' }))
        })
    }
    // A burst of report changes settles before asking again.
    const soon = window.setTimeout(load, 600)
    const timer = window.setInterval(load, REFRESH_MS)
    return () => {
      window.clearTimeout(soon)
      window.clearInterval(timer)
      controller?.abort()
    }
  }, [lang, enabled, changeKey])

  return state
}

export const minutesSince = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
