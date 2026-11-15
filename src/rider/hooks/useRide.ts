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
/** A city motorbike in rain traffic, about 25 km/h. */
const REAL_SPEED = 25 / 3.6
/** The simulation runs at least 20× real time, faster on long trips so no ride takes over a minute. */
export const rideSpeed = (distanceM: number) => Math.max(REAL_SPEED * 20, distanceM / 55)
export const rideSpeedFactor = (distanceM: number) => Math.round(rideSpeed(distanceM) / REAL_SPEED)
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
 * Drives a ride: advances along the active route, pauses while a reroute is calculated,
 * continues from the rider's spot when the route changes, and in the demo drops one
 * scripted flood ahead so the reroute happens on cue.
 */
export function useRideClock({
  ride,
  setRide,
  trip,
  mode,
  onScriptedFlood,
}: {
  ride: RideState
  setRide: React.Dispatch<React.SetStateAction<RideState>>
  trip: Trip
  mode: AppMode
  onScriptedFlood: (fraction: number) => void
}) {
  const latest = useRef({ trip, onScriptedFlood })
  latest.current = { trip, onScriptedFlood }

  // Advance.
  useEffect(() => {
    if (ride.status !== 'riding') return
    const timer = window.setInterval(() => {
      const { trip } = latest.current
      if (trip.recalculating) return // the rider slows while the new route is found
      const length = Math.max(1, trip.active.candidate.distanceM)
      const step = (rideSpeed(length) * TICK_MS) / 1000 / length
      setRide((r) => {
        if (r.status !== 'riding') return r
        const fraction = Math.min(1, r.fraction + step)
        return fraction >= 0.995 ? { ...r, status: 'arrived', fraction: 1 } : { ...r, fraction }
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [ride.status, setRide])

  // Demo: once the rider is under way, a flood is reported on the road ahead.
  useEffect(() => {
    if (mode !== 'demo' || ride.status !== 'riding' || ride.scripted || ride.fraction < 0.16) return
    setRide((r) => ({ ...r, scripted: true }))
    latest.current.onScriptedFlood(ride.fraction)
  }, [ride, mode, setRide])

  // The active route changed mid-ride: carry on from where the rider is now.
  const lastRoute = useRef(trip.active.candidate.id)
  const lastPosition = useRef<LatLng>(trip.position)
  useEffect(() => {
    if (lastRoute.current !== trip.active.candidate.id) {
      lastRoute.current = trip.active.candidate.id
      if (ride.status === 'riding') {
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
