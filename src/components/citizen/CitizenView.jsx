import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import PhoneFrame from './PhoneFrame'
import CitizenMap from './CitizenMap'
import RoutePlanner from './RoutePlanner'
import RouteSummary, { describePlan } from './RouteSummary'
import ReportDrawer from './ReportDrawer'
import Toasts from './Toasts'
import { useFlood } from '../../store/FloodStore'
import { ROUTE_PRESETS } from '../../data/routes'
import { GAZETTEER } from '../../data/gazetteer'
import { planTrip, riderPosition } from '../../lib/routing'
import { nearestPlace } from '../../lib/geo'
import { DEPTHS, VEHICLES } from '../../lib/severity'
import { getWeather } from '../../services/weather'

const RECALC_MS = 1900

export default function CitizenView() {
  const { reports, addReport, addRerouted } = useFlood()
  const weather = getWeather()

  const [presetId, setPresetId] = useState(ROUTE_PRESETS[0].id)
  const [vehicleId, setVehicleId] = useState('moto')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pickMode, setPickMode] = useState(false)
  const [location, setLocation] = useState(null) // { lat, lng, place }
  const [usingCurrentPin, setUsingCurrentPin] = useState(false)
  const [toasts, setToasts] = useState([])

  const preset = ROUTE_PRESETS.find((p) => p.id === presetId) ?? ROUTE_PRESETS[0]
  const plan = useMemo(() => planTrip(preset, reports, vehicleId), [preset, reports, vehicleId])

  // The safe route on screen lags the computed one while "recalculating".
  const [shownSafeId, setShownSafeId] = useState(plan.safe.candidate.id)
  const [recalculating, setRecalculating] = useState(false)

  const pushToast = useCallback((kind, text, ms = 4200) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((list) => [...list.slice(-1), { id, kind, text }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), ms)
  }, [])

  const previous = useRef({ presetId, vehicleId, count: reports.length })
  const targetId = plan.safe.candidate.id
  useEffect(() => {
    const prev = previous.current
    const tripChanged = prev.presetId !== presetId || prev.vehicleId !== vehicleId
    const newReport = reports.length > prev.count
    previous.current = { presetId, vehicleId, count: reports.length }

    if (targetId === shownSafeId) {
      setRecalculating(false)
      if (newReport && !tripChanged && !plan.hasDryRoute) {
        pushToast('warning', 'Flood reported on your route. No fully dry alternative: proceed with caution.')
      }
      return
    }
    if (tripChanged || !newReport) {
      setRecalculating(false)
      setShownSafeId(targetId)
      return
    }

    // A new flood landed on the active safe route: announce, then shift the line.
    const noun = VEHICLES[vehicleId].noun
    setRecalculating(true)
    pushToast('warning', `New flood detected ahead! Recalculating dry ${noun} route...`, RECALC_MS + 600)
    const timer = window.setTimeout(() => {
      setShownSafeId(targetId)
      setRecalculating(false)
      addRerouted(24 + Math.floor(Math.random() * 18))
      const extra = plan.safe.minutes - plan.standard.minutes
      pushToast(
        'success',
        plan.hasDryRoute
          ? `Safe ${noun} route updated${extra > 0 ? ` • +${extra} mins` : ''} • via ${plan.safe.candidate.via}`
          : 'No fully dry route left: showing the least-flooded option.',
      )
    }, RECALC_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, presetId, vehicleId, reports.length])

  // Entry (route + flood analysis) for the route currently drawn.
  const safeEntry = useMemo(() => {
    const found = [plan.standard, plan.safe].find((a) => a.candidate.id === shownSafeId)
    if (found) return found
    // The drawn route is neither of the planned ones (mid-recalculation or just after a trip change).
    const shown = preset.candidates.filter((c) => c.id === shownSafeId)
    if (!shown.length) return plan.safe
    return planTrip({ ...preset, candidates: shown }, reports, vehicleId).standard
  }, [plan, shownSafeId, preset, reports, vehicleId])

  const staleCandidate = recalculating ? safeEntry.candidate : null
  const texts = describePlan(plan, safeEntry, vehicleId)
  const rider = useMemo(() => riderPosition(preset, shownSafeId), [preset, shownSafeId])

  const placeFor = (point) => {
    const { place } = nearestPlace(point, GAZETTEER)
    return { lat: point[0], lng: point[1], place }
  }

  function openDrawer() {
    setLocation(null)
    setUsingCurrentPin(false)
    setDrawerOpen(true)
  }

  function submitReport({ depth, ai, photo }) {
    const now = Date.now()
    addReport({
      id: `r-${now}`,
      name: location.place.name,
      area: location.place.area,
      khan: location.place.khan,
      sangkat: location.place.sangkat,
      lat: location.lat,
      lng: location.lng,
      depth,
      source: 'citizen',
      createdAt: now,
      isNew: true,
      ai,
      photo,
    })
    setDrawerOpen(false)
    setLocation(null)
    pushToast(
      'success',
      ai
        ? `${DEPTHS[depth].label} flood verified by Vision AI • synced to the city dashboard`
        : 'Unverified report submitted • synced to the city dashboard',
      3000,
    )
  }

  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-[#E9EDF2] px-3 py-4">
      <PhoneFrame>
        <div className="relative min-h-0 flex-1 bg-canvas">
          {/* Full-bleed map */}
          <div className="map-muted absolute inset-0 z-0">
            <CitizenMap
              preset={preset}
              plan={plan}
              safeEntry={safeEntry}
              staleCandidate={staleCandidate}
              texts={texts}
              reports={reports}
              rider={rider}
              draft={pickMode || !location ? null : [location.lat, location.lng]}
              pickMode={pickMode}
              onPick={(point) => {
                setLocation(placeFor(point))
                setUsingCurrentPin(false)
                setPickMode(false)
                setDrawerOpen(true)
              }}
              fitKey={`${presetId}:${shownSafeId}`}
            />
          </div>

          <Toasts toasts={toasts} />

          {pickMode ? (
            <div className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white px-3 py-2.5 text-[13px] font-medium text-ink shadow-float">
              Tap the map where the flood is
              <button
                onClick={() => {
                  setPickMode(false)
                  setDrawerOpen(true)
                }}
                className="flex items-center gap-1 text-[13px] font-medium text-muted"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 space-y-2">
              <RoutePlanner presets={ROUTE_PRESETS} presetId={presetId} onPresetChange={setPresetId} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-float">
                <span className="h-1.5 w-1.5 rounded-full bg-caution" />
                {weather.city}: {weather.alert} • {weather.rainMmPerHour}mm/hr
              </span>
            </div>
          )}

          {!pickMode && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-end">
              <button
                onClick={openDrawer}
                className="pointer-events-auto mb-3 mr-3 flex items-center gap-1.5 rounded-full bg-danger px-4 py-2.5 text-[13px] font-semibold text-white shadow-float transition hover:bg-red-600 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} /> Report Flood
              </button>
              <div className="w-full">
                <RouteSummary
                  plan={plan}
                  safeEntry={safeEntry}
                  vehicleId={vehicleId}
                  onVehicleChange={setVehicleId}
                  recalculating={recalculating}
                />
              </div>
            </div>
          )}

          {drawerOpen && !pickMode && (
            <ReportDrawer
              location={location}
              usingCurrentPin={usingCurrentPin}
              onUseCurrentPin={() => {
                setLocation(placeFor(rider))
                setUsingCurrentPin(true)
              }}
              onPickOnMap={() => setPickMode(true)}
              onClose={() => {
                setDrawerOpen(false)
                setLocation(null)
              }}
              onSubmit={submitReport}
            />
          )}
        </div>
      </PhoneFrame>
    </div>
  )
}
