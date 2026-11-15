import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FloodReport } from '../../shared/types'
import type { RouteEntry, VehicleId } from '../types'
import { PRESETS, analyse, bearingAt, pointAt, riderFraction, safest } from '../lib/trip'

const RECALC_MS = 1900
export const VEHICLE_NOUN: Record<VehicleId, string> = { moto: 'motorbike', tuktuk: 'tuk-tuk', car: 'car' }

/**
 * Trip state for the rider: which route is active, and the short "recalculating"
 * phase when a new flood report lands on it.
 */
export function useTrip(reports: FloodReport[], onRerouted: () => void) {
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [vehicle, setVehicleState] = useState<VehicleId>('moto')
  const [dryOnly, setDryOnly] = useState(true)
  const [manualId, setManualId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]
  const entries = useMemo(() => analyse(preset, reports, vehicle), [preset, reports, vehicle])
  const standard = entries[0]

  // A hand-picked route is kept unless "dry routes only" is on and it floods.
  const manual = entries.find((e) => e.candidate.id === manualId)
  const target: RouteEntry = manual && (!dryOnly || manual.blockers.length === 0) ? manual : dryOnly ? safest(entries) : standard
  const targetId = target.candidate.id

  // The route on screen lags the computed one while "recalculating".
  const [shownId, setShownId] = useState(targetId)
  const [recalculating, setRecalculating] = useState(false)
  const previous = useRef({ presetId, vehicle, dryOnly, manualId, count: reports.length })
  const onReroutedRef = useRef(onRerouted)
  onReroutedRef.current = onRerouted

  useEffect(() => {
    const prev = previous.current
    const userChanged = prev.presetId !== presetId || prev.vehicle !== vehicle || prev.dryOnly !== dryOnly || prev.manualId !== manualId
    const newReport = reports.length > prev.count
    previous.current = { presetId, vehicle, dryOnly, manualId, count: reports.length }

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
      setNotice(
        target.blockers.length
          ? 'No fully dry route left. Showing the least-flooded option.'
          : `Route updated${extra > 0 ? ` · +${extra} min` : ''} · via ${target.candidate.via}`,
      )
    }, RECALC_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, presetId, vehicle, dryOnly, manualId, reports.length])

  // Notices clear themselves.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const active = entries.find((e) => e.candidate.id === shownId) ?? target
  const fraction = useMemo(() => riderFraction(preset, active.candidate.id), [preset, active.candidate.id])
  const position = useMemo(() => pointAt(active.candidate, fraction), [active.candidate, fraction])
  const bearing = useMemo(() => bearingAt(active.candidate, fraction), [active.candidate, fraction])

  const setPreset = useCallback((id: string) => {
    setManualId(null)
    setPresetId(id)
  }, [])
  const setVehicle = useCallback((id: VehicleId) => {
    setManualId(null)
    setVehicleState(id)
  }, [])

  return {
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
  }
}

export type Trip = ReturnType<typeof useTrip>
