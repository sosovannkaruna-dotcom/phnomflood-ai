// "Leave now or wait?": one line of advice before a live ride, from the 15-minute rain forecast,
// the trip's length and the drain estimate for water already on the roads.
// Every number here is an estimate and the UI says so.

import type { Key } from '../../i18n'
import type { RainSlot } from '../hooks/useWeather'

/** WMO / AMS heavy rain: the rate at which Phnom Penh's low streets start to flood. */
export const HEAVY = 7.6
const LIGHT = 1
/** Time the streets need to start draining after heavy rain stops (an assumption, labelled as one). */
const DRAIN_BUFFER_MIN = 30
const SLOT_MS = 15 * 60 * 1000

export type AdviceTone = 'go' | 'wait' | 'warn'

export interface Advice {
  tone: AdviceTone
  key: Key
  vars: Record<string, string | number>
}

interface Input {
  series: RainSlot[]
  /** The chosen route's riding time, minutes */
  tripMin: number
  /** Minutes until water on the usual (fastest) route should drain, when it is wetter than ours */
  usualDrainMin: number | null
  /** Extra minutes the dry route takes over the usual one */
  extraMin: number
  /** Minutes until water on our own route should drain (no dry route left) */
  ownDrainMin: number | null
  format: (ms: number) => string
  now?: number
}

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)

export function departureAdvice({ series, tripMin, usualDrainMin, extraMin, ownDrainMin, format, now = Date.now() }: Input): Advice | null {
  // The slot we are in, and everything after it.
  const slots = series.filter((s) => s.at + SLOT_MS > now)
  if (slots.length < 4) return null
  const end = slots[slots.length - 1].at + SLOT_MS
  const hours = Math.round((end - now) / 3600000)

  const heavyFrom = (i: number) => slots.findIndex((s, j) => j >= i && s.mmh >= HEAVY)
  // Heavy rain eases when two slots in a row fall below the threshold.
  const easesAfter = (i: number) => slots.findIndex((s, j) => j > i && s.mmh < HEAVY && (slots[j + 1]?.mmh ?? 0) < HEAVY)

  if (slots[0].mmh >= HEAVY) {
    const ease = easesAfter(0)
    if (ease !== -1 && slots[ease].at - now <= 90 * 60000) return { tone: 'wait', key: 'leave.heavyNowEase', vars: { time: format(slots[ease].at) } }
    return { tone: 'warn', key: 'leave.heavyNowLong', vars: { time: format(ease === -1 ? end : slots[ease].at) } }
  }

  const start = heavyFrom(0)
  if (start !== -1) {
    const arrive = now + tripMin * 60000
    const startAt = slots[start].at
    // Arrive with at least ten minutes to spare before it starts.
    if (startAt > arrive + 10 * 60000) return { tone: 'go', key: 'leave.beforeRain', vars: { n: roundTo5((startAt - arrive) / 60000), time: format(startAt) } }
    const ease = easesAfter(start)
    if (ease === -1) return { tone: 'warn', key: 'leave.duringRainLong', vars: { start: format(startAt) } }
    return {
      tone: 'wait',
      key: 'leave.duringRain',
      vars: { start: format(startAt), end: format(slots[ease].at), after: format(slots[ease].at + DRAIN_BUFFER_MIN * 60000) },
    }
  }

  if (ownDrainMin && ownDrainMin > 0) return { tone: 'wait', key: 'leave.drainAll', vars: { wait: roundTo5(ownDrainMin) } }
  if (usualDrainMin && usualDrainMin > 0 && extraMin > 0) return { tone: 'go', key: 'leave.drainUsual', vars: { extra: extraMin, wait: roundTo5(usualDrainMin) } }
  const light = slots.some((s) => s.at < now + tripMin * 60000 && s.mmh >= LIGHT)
  return light ? { tone: 'go', key: 'leave.light', vars: {} } : { tone: 'go', key: 'leave.clear', vars: { h: hours } }
}
