import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppMode } from '../../shared/mode'
import type { Trip } from './useTrip'
import { fractionNear } from '../lib/trip'
import type { LatLng } from '../types'

export type RideStatus = 'idle' | 'riding' | 'arrived'

export interface RideState {
  status: RideStatus
  /** Progress along the active route, 0–1 */
  fraction: number
  /** The demo's scripted flood has been dropped on this ride */
  scripted: boolean
}

const TICK_MS = 200
/** Demo: how far along the route (0–1) the scripted flood is reported */
const SCRIPTED_AT = 0.12
/** A city motorbike in rain traffic, about 25 km/h. */
const REAL_SPEED = 25 / 3.6
/** The simulation runs at 8× real time, faster on long trips so no ride takes much over 90 seconds. */
export const rideSpeed = (distanceM: number) => Math.max(REAL_SPEED * 8, distanceM / 90)
export const rideSpeedFactor = (distanceM: number) => Math.round(rideSpeed(distanceM) / REAL_SPEED)
/** Riding through water: the simulated rider slows down, like a real one would. */
const FLOOD_SLOWDOWN = { caution: 0.6, danger: 0.4 } as const
/** The puck and camera move between ticks with a linear glide of the same length. */
export const RIDE_GLIDE_MS = TICK_MS + 40

const IDLE: RideState = { status: 'idle', fraction: 0, scripted: false }

/** Ride state, kept outside the trip so the trip can read its progress. */
export function useRide() {
  const [ride, setRide] = useState<RideState>(IDLE)
  const start = useCallback(() => setRide({ status: 'riding', fraction: 0, scripted: false }), [])
  const stop = useCallback(() => setRide(IDLE), [])
  return { ride, setRide, start, stop }
}

/**
 * Drives a demo ride: moves the rider along the active route, holds while a reroute is calculated,
 * slows down in water, carries on from the rider's spot when the route changes, and drops one
 * scripted flood ahead early in the ride so the reroute happens on cue.
 * Live rides are driven by real GPS instead (see RiderApp), so this clock only moves the demo.
 */
export function useRideClock({
  ride,
  setRide,
  trip,
  mode,
  paused = false,
  flood = null,
  scriptedAt = SCRIPTED_AT,
  onScriptedFlood,
}: {
  ride: RideState
  setRide: React.Dispatch<React.SetStateAction<RideState>>
  trip: Trip
  mode: AppMode
  /** Hold position, e.g. while the rider fills in a report */
  paused?: boolean
  /** Water at the rider's position right now */
  flood?: 'caution' | 'danger' | null
  /** Demo: where (0–1) the scripted flood is reported; early enough that the reroute comes before the turn-off */
  scriptedAt?: number
  onScriptedFlood: (fraction: number) => void
}) {
  const latest = useRef({ trip, onScriptedFlood, paused, flood })
  latest.current = { trip, onScriptedFlood, paused, flood }

  // Advance.
  useEffect(() => {
    if (mode !== 'demo' || ride.status !== 'riding') return
    const timer = window.setInterval(() => {
      const { trip, paused, flood } = latest.current
      if (paused || trip.recalculating) return // the rider holds while a report is filed or a new route is found
      const length = Math.max(1, trip.active.candidate.distanceM)
      const slow = flood ? FLOOD_SLOWDOWN[flood] : 1
      const step = (rideSpeed(length) * slow * TICK_MS) / 1000 / length
      setRide((r) => {
        if (r.status !== 'riding') return r
        const fraction = Math.min(1, r.fraction + step)
        return fraction >= 0.995 ? { ...r, status: 'arrived', fraction: 1 } : { ...r, fraction }
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [ride.status, mode, setRide])

  // Demo: once the rider is under way, a rider ahead reports deep water on the route.
  useEffect(() => {
    if (mode !== 'demo' || ride.status !== 'riding' || ride.scripted || paused || ride.fraction < (scriptedAt > 1 ? 2 : Math.min(SCRIPTED_AT, scriptedAt)) || (scriptedAt > 0 && ride.fraction === 0)) return
    setRide((r) => ({ ...r, scripted: true }))
    latest.current.onScriptedFlood(ride.fraction)
  }, [ride, mode, setRide, scriptedAt, paused])

  // The active route changed mid-ride: carry on from where the rider is now.
  const lastRoute = useRef(trip.active.candidate.id)
  const lastPosition = useRef<LatLng>(trip.position)
  useEffect(() => {
    if (lastRoute.current !== trip.active.candidate.id) {
      lastRoute.current = trip.active.candidate.id
      if (ride.status === 'riding' && mode === 'demo') {
        const from = lastPosition.current
        setRide((r) => ({ ...r, fraction: fractionNear(trip.active.candidate, from) }))
      }
    }
    lastPosition.current = trip.position
  })

  // A new destination ends the ride.
  const lastPreset = useRef(trip.preset.id)
  useEffect(() => {
    if (lastPreset.current === trip.preset.id) return
    lastPreset.current = trip.preset.id
    setRide({ status: 'idle', fraction: 0, scripted: false })
  }, [trip.preset.id, setRide])
}
