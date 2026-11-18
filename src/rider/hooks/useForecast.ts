import { useEffect, useMemo, useRef, useState } from 'react'
import { DEPTHS } from '../../lib/severity'
import type { FloodReport } from '../../shared/types'
import type { ForecastResult, Observation, RainSlot } from '../lib/forecast'

export type ForecastState = { status: 'off' } | { status: 'loading' } | { status: 'ready'; result: ForecastResult } | { status: 'error' }

/** Rerun as time moves on, even when nothing else changes. */
const REFRESH_MS = 5 * 60 * 1000

let worker: Worker | null = null
let nextId = 0
const waiting = new Map<number, { resolve: (r: ForecastResult) => void; reject: (e: Error) => void }>()

function run(input: { rain: RainSlot[]; now: number; observations: Observation[]; hotspots: { lat: number; lng: number }[] }): Promise<ForecastResult> {
  if (!worker) {
    worker = new Worker(new URL('../lib/forecast.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; result?: ForecastResult; error?: string }>) => {
      const job = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      if (!job) return
      if (e.data.result) job.resolve(e.data.result)
      else job.reject(new Error(e.data.error ?? 'forecast failed'))
    }
  }
  const id = ++nextId
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    worker!.postMessage({ id, input })
  })
}

/** What riders saw, as the model reads it: depth in cm where and when (a cleared spot is 0 cm). */
export function observationsOf(reports: FloodReport[]): Observation[] {
  return reports.map((r) => {
    const depth = DEPTHS[r.depth]
    const seen = Math.max(r.createdAt, r.updatedAt ? Date.parse(r.updatedAt) || 0 : 0)
    return { lat: r.lat, lng: r.lng, cm: r.depth === 'clear' ? 0 : (r.ai?.depthCm ?? depth.cm), at: seen, radiusM: depth.zoneRadius }
  })
}

/**
 * The flood forecast for the next two hours, from the rain series, the reports and the flood-prone
 * spots. Runs in a worker; reruns when any of them change (half a second after the last change)
 * and every five minutes.
 */
export function useForecast(enabled: boolean, rain: RainSlot[] | undefined, reports: FloodReport[], hotspots: { lat: number; lng: number }[]): ForecastState {
  const [state, setState] = useState<ForecastState>({ status: 'off' })
  const [tick, setTick] = useState(0)
  // Inputs as a key, so a new array with the same contents does not rerun the model.
  const key = useMemo(
    () =>
      JSON.stringify([
        rain?.map((s) => [s.at, Math.round(s.mmh * 10)]),
        reports.map((r) => [r.id, r.depth, r.confirmations ?? 0, r.updatedAt ?? '']),
        hotspots.map((h) => [h.lat, h.lng]),
      ]),
    [rain, reports, hotspots],
  )
  const inputs = useRef({ rain, reports, hotspots })
  inputs.current = { rain, reports, hotspots }

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setTick((n) => n + 1), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [enabled])

  useEffect(() => {
    if (!enabled || !rain?.length) {
      setState({ status: 'off' })
      return
    }
    let stale = false
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }))
    const timer = window.setTimeout(() => {
      const { rain: r, reports: rep, hotspots: spots } = inputs.current
      run({ rain: r ?? [], now: Date.now(), observations: observationsOf(rep), hotspots: spots })
        .then((result) => !stale && setState({ status: 'ready', result }))
        .catch(() => !stale && setState((s) => (s.status === 'ready' ? s : { status: 'error' })))
    }, 500)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [enabled, key, tick, rain?.length])

  return state
}
