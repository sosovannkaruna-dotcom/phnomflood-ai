import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import PhoneFrame from './PhoneFrame'
import CitizenMap from './CitizenMap'
import RoutePlanner, { VehicleSwitch } from './RoutePlanner'
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
    <div className="flex h-full items-center justify-center overflow-hidden bg-slate-200 sm:px-3 sm:py-4">
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
            <div className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-compact font-medium text-ink shadow-sm">
              Tap the map where the flood is
              <button
                onClick={() => {
                  setPickMode(false)
                  setDrawerOpen(true)
                }}
                className="flex items-center gap-1 text-compact font-medium text-accent"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 space-y-2">
              <RoutePlanner presets={ROUTE_PRESETS} presetId={presetId} onPresetChange={setPresetId} />
              <VehicleSwitch vehicleId={vehicleId} onChange={setVehicleId} />
            </div>
          )}

          {!pickMode && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
              <div className="flex items-end justify-between gap-2 px-3 pb-3">
                {/* Live status only: rainfall alert and map credit */}
                <div className="space-y-1">
                  <span className="flex w-fit items-center gap-2 whitespace-nowrap rounded-md border border-hairline bg-white px-2 py-1 text-2xs font-semibold text-[#92400E] shadow-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-caution" />
                    {weather.alert} • {weather.rainMmPerHour}mm/hr
                  </span>
                  <span className="block w-fit rounded bg-white/90 px-1 text-2xs text-muted">© OpenStreetMap contributors</span>
                </div>
                {/* The one primary action on this screen */}
                <button
                  onClick={openDrawer}
                  className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 active:scale-95"
                >
                  <Plus className="h-5 w-5" /> Report Flood
                </button>
              </div>
              <RouteSummary plan={plan} safeEntry={safeEntry} vehicleId={vehicleId} recalculating={recalculating} />
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
