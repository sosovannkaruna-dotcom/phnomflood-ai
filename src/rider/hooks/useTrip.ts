import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FloodReport } from '../../shared/types'
import type { LatLng, Preset, RouteEntry, VehicleId } from '../types'
import { PRESETS, analyse, bearingAt, divergence, fractionNear, metresBetween, pointAt, riderFraction, safest } from '../lib/trip'

const RECALC_MS = 1900
export const VEHICLE_NOUN: Record<VehicleId, string> = { moto: 'motorbike', tuktuk: 'tuk-tuk', car: 'car' }

/** Banner notices are data, so the UI can word them in either language. */
export type Notice = { kind: 'nodry' } | { kind: 'updated'; extra: number; via: string } | { kind: 'scripted' }

/**
 * Trip state for the rider: which route is active, and the short "recalculating"
 * phase when a new flood report lands on it.
 */
export function useTrip(
  reports: FloodReport[],
  onRerouted: () => void,
  rideFraction: number | null = null,
  options: {
    /** Demo trip list (shuffled per visit) */
    presets?: Preset[]
    /** Live mode: the route built from search + OSRM (or a stand-in while no destination is chosen) */
    override?: Preset | null
    /** Live mode: the real GPS fix, which replaces the simulated position */
    gps?: LatLng | null
    heading?: number | null
  } = {},
) {
  const list = options.presets ?? PRESETS
  const [presetId, setPresetId] = useState(list[0].id)
  const [vehicle, setVehicleState] = useState<VehicleId>('moto')
  const [dryOnly, setDryOnly] = useState(true)
  const [manualId, setManualId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const preset = options.override ?? list.find((p) => p.id === presetId) ?? list[0]
  const presetKey = preset.id
  const entries = useMemo(() => analyse(preset, reports, vehicle), [preset, reports, vehicle])
  const standard = entries[0]

  // The route on screen lags the computed one while "recalculating".
  const [shownId, setShownId] = useState(() => (dryOnly ? safest(entries) : standard).candidate.id)
  const shown = entries.find((e) => e.candidate.id === shownId) ?? null

  const gps = options.gps ?? null
  const live = options.override !== undefined
  // Live: where the real fix sits along the route on screen (also used for turn-by-turn below).
  const onRoute = useMemo(
    () => (live && gps && shown && shown.candidate.distanceM > 0 ? fractionNear(shown.candidate, gps) : null),
    [live, gps, shown],
  )
  // Mid-ride, only routes the rider can still take without turning around: the rider must not have
  // passed the point where they leave the current route (the ride holds still while rerouting, so a
  // split right at the start still counts).
  const ridingAt = rideFraction === null ? null : live ? (onRoute ?? 0) : rideFraction
  const options2 = ridingAt === null || !shown ? entries : entries.filter((e) => e === shown || divergence(shown.candidate, e.candidate) + 15 / Math.max(1, shown.candidate.distanceM) >= ridingAt)

  // A hand-picked route is kept unless "dry routes only" is on and it floods.
  const manual = options2.find((e) => e.candidate.id === manualId)
  const target: RouteEntry = manual && (!dryOnly || manual.blockers.length === 0) ? manual : dryOnly ? safest(options2) : (options2.includes(standard) ? standard : (shown ?? standard))
  const targetId = target.candidate.id
  const [recalculating, setRecalculating] = useState(false)
  const previous = useRef({ presetKey, vehicle, dryOnly, manualId, count: reports.length })
  const onReroutedRef = useRef(onRerouted)
  onReroutedRef.current = onRerouted

  useEffect(() => {
    const prev = previous.current
    const userChanged = prev.presetKey !== presetKey || prev.vehicle !== vehicle || prev.dryOnly !== dryOnly || prev.manualId !== manualId
    const newReport = reports.length > prev.count
    previous.current = { presetKey, vehicle, dryOnly, manualId, count: reports.length }

    if (targetId === shownId) {
      setRecalculating(false)
      return
    }
    if (userChanged || !newReport) {
      setRecalculating(false)
      setShownId(targetId)
      return
    }

    // A new flood landed on the active route: announce it, then switch the line.
    setRecalculating(true)
    setNotice(null)
    const timer = window.setTimeout(() => {
      setShownId(targetId)
      setRecalculating(false)
      onReroutedRef.current()
      const extra = target.minutes - standard.minutes
      setNotice(target.blockers.length ? { kind: 'nodry' } : { kind: 'updated', extra, via: target.candidate.via })
    }, RECALC_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, presetKey, vehicle, dryOnly, manualId, reports.length])

  // Notices clear themselves.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const active = shown ?? target
  // Demo, parked: a fixed fix part-way along the route. Demo, riding: the simulated ride's progress.
  // Live: the real GPS fix, matched to the nearest point of the route for turn-by-turn.
  const parked = useMemo(() => (live ? 0 : riderFraction(preset, active.candidate.id)), [live, preset, active.candidate.id])
  const fraction = live ? (onRoute ?? 0) : (rideFraction ?? parked)
  const routePoint = useMemo(() => pointAt(active.candidate, fraction), [active.candidate, fraction])
  // Live: snap to the road when the fix is close to it, otherwise show the raw fix.
  const position: LatLng = useMemo(() => {
    if (!live) return routePoint
    if (!gps) return routePoint
    return rideFraction !== null && metresBetween(gps, routePoint) < 40 ? routePoint : gps
  }, [live, gps, routePoint, rideFraction])
  const routeBearing = useMemo(() => bearingAt(active.candidate, fraction), [active.candidate, fraction])
  const bearing = live && rideFraction === null && options.heading != null ? options.heading : routeBearing

  const setPreset = useCallback((id: string) => {
    setManualId(null)
    setPresetId(id)
  }, [])
  const setVehicle = useCallback((id: VehicleId) => {
    setManualId(null)
    setVehicleState(id)
  }, [])

  return {
    presets: list,
    live,
    preset,
    entries,
    standard,
    active,
    vehicle,
    dryOnly,
    recalculating,
    notice,
    fraction,
    position,
    bearing,
    setPreset,
    setVehicle,
    toggleDryOnly: useCallback(() => setDryOnly((d) => !d), []),
    chooseRoute: setManualId,
    announce: setNotice,
  }
}

export type Trip = ReturnType<typeof useTrip>
