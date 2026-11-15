import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Crosshair as LocateFixed, Minus, NavigationArrow, Plus, SpeakerHigh as Volume2, SpeakerX as VolumeX } from '@phosphor-icons/react'
import RiderMap, { type RiderMapHandle } from './components/RiderMap'
import TopHud from './components/TopHud'
import BottomSheet from './components/BottomSheet'
import ReportDrawer from './components/ReportDrawer'
import ArrivalCard from './components/ArrivalCard'
import NavBar from './components/NavBar'
import { useTrip } from './hooks/useTrip'
import { RIDE_GLIDE_MS, rideSpeedFactor, useRide, useRideClock } from './hooks/useRide'
import { useWeather } from './hooks/useWeather'
import { hazardAhead, placeAt } from './lib/trip'
import { useFlood } from '../shared/useFlood'
import { useMode } from '../shared/mode'
import { LangProvider, useT } from '../i18n'
import type { FloodReport } from '../shared/types'
import type { MapMode, VisionResult } from './types'

/** Short two-tone alert through Web Audio (no sound file needed). */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.16)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.16 + 0.14)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.16)
      osc.stop(ctx.currentTime + i * 0.16 + 0.15)
    })
    window.setTimeout(() => void ctx.close(), 600)
  } catch {
    // Audio is unavailable or blocked: the visual alert still shows.
  }
}

/** Rider / field navigation app: full-bleed map with a three-zone HUD. */
function Rider({ onHome }: { onHome: () => void }) {
  const { t } = useT()
  const appMode = useMode()
  const { reports, sync, addReport, addRerouted, confirmReport, clearReport } = useFlood()
  const { ride, setRide, start: startRide, stop } = useRide()
  const riding = ride.status === 'riding'
  const trip = useTrip(reports, () => addRerouted(24 + Math.floor(Math.random() * 18)), ride.status === 'idle' ? null : ride.fraction)
  const weather = useWeather(appMode)
  // Depth tags and red / amber hazard markers are always on: they are the warning.
  const mapMode: MapMode = 'depth'
  const [muted, setMuted] = useState(false)
  const [reporting, setReporting] = useState(false)
  // Navigating = a ride in progress: tilted heading-up camera, turn banner, bottom bar, voice.
  const navigating = riding
  const [panned, setPanned] = useState(false)
  useEffect(() => {
    if (navigating) setPanned(false)
  }, [navigating])
  const map = useRef<RiderMapHandle>(null)

  // Each demo ride starts clean: the scripted flood from the last ride (ids starting "s-") is cleared,
  // so repeated rehearsals never pile floods up until every route is blocked.
  const start = useCallback(() => {
    if (appMode === 'demo') reports.filter((r) => r.id.startsWith('s-')).forEach((r) => clearReport(r.id))
    startRide()
  }, [appMode, reports, clearReport, startRide])

  const place = useMemo(() => placeAt(trip.position), [trip.position])
  const speedFactor = rideSpeedFactor(trip.active.candidate.distanceM)

  // Demo: a rider ahead reports deep water on the active route, once per ride.
  const onScriptedFlood = useCallback(
    (fraction: number) => {
      const { point } = hazardAhead(trip.preset, trip.active.candidate.id, fraction)
      const spot = placeAt(point)
      const now = Date.now()
      trip.announce({ kind: 'scripted' })
      addReport({
        id: `s-${now}`,
        name: spot.name,
        area: spot.area,
        khan: spot.khan,
        sangkat: spot.sangkat,
        lat: point[0],
        lng: point[1],
        depth: 'waist',
        source: 'rider',
        createdAt: now,
        isNew: true,
      })
    },
    [trip, addReport],
  )
  // The ride holds still while the rider fills in a report.
  useRideClock({ ride, setRide, trip, mode: appMode, paused: reporting, onScriptedFlood })

  // Audible alert when a flood forces a reroute.
  useEffect(() => {
    if (trip.recalculating && !muted) beep()
  }, [trip.recalculating, muted])

  const submit = useCallback(
    ({ depth, ai, photo }: { depth: FloodReport['depth']; ai: VisionResult | null; photo: string | null }) => {
      const now = Date.now()
      addReport({
        id: `r-${now}-${Math.random().toString(36).slice(2, 7)}`,
        name: place.name,
        area: place.area,
        khan: place.khan,
        sangkat: place.sangkat,
        lat: trip.position[0],
        lng: trip.position[1],
        depth,
        source: 'rider',
        createdAt: now,
        isNew: true,
        ai: ai && ai.drainage && ai.depthCm ? { depthCm: ai.depthCm, drainage: ai.drainage } : null,
        photo,
      })
      setReporting(false)
    },
    [addReport, place, trip.position],
  )

  const control = 'rd-press grid h-11 w-11 place-items-center text-zinc-100'

  return (
    <div className={`rd-root relative h-full w-full select-none overflow-hidden bg-void text-zinc-100 ${navigating ? 'is-nav' : ''}`}>
      <RiderMap
        ref={map}
        preset={trip.preset}
        entries={trip.entries}
        active={trip.active}
        recalculating={trip.recalculating}
        reports={reports}
        mode={mapMode}
        position={trip.position}
        bearing={trip.bearing}
        progress={trip.fraction}
        navigating={navigating}
        panned={panned}
        onUserPan={() => setPanned(true)}
        glideMs={riding ? RIDE_GLIDE_MS : 900}
      />

      <TopHud trip={trip} place={place} mode={appMode} sync={sync} weather={weather} riding={riding} navigating={navigating} quiet={ride.status === 'arrived'} speedFactor={speedFactor} onHome={onHome} />

      {/* Right-edge map controls, in thumb reach just above the sheet */}
      <div className="rd-controls cc-panel absolute right-3 z-10 flex flex-col divide-y divide-white/[0.12]">
        {!navigating && (
          <>
            <button onClick={() => map.current?.recenter()} aria-label={t('controls.recenter')} className={control}>
              <LocateFixed className="h-5 w-5" />
            </button>
            <button onClick={() => map.current?.zoomBy(1)} aria-label={t('controls.zoomIn')} className={control}>
              <Plus className="h-5 w-5" />
            </button>
            <button onClick={() => map.current?.zoomBy(-1)} aria-label={t('controls.zoomOut')} className={control}>
              <Minus className="h-5 w-5" />
            </button>
          </>
        )}
        <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? t('controls.unmute') : t('controls.mute')} className={control}>
          {muted ? <VolumeX className="h-5 w-5 text-zinc-500" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Dragged away while navigating: one tap brings the camera back behind the rider */}
      {navigating && panned && (
        <button
          onClick={() => setPanned(false)}
          className="rd-press absolute bottom-[calc(118px+env(safe-area-inset-bottom,0px))] left-3 z-10 flex h-11 items-center gap-2 bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
        >
          <NavigationArrow className="h-4 w-4" /> {t('nav.recenter')}
        </button>
      )}

      {navigating ? (
        <NavBar trip={trip} onReport={() => setReporting(true)} onExit={stop} />
      ) : (
      <BottomSheet
        trip={trip}
        reports={reports}
        position={trip.position}
        mode={appMode}
        sync={sync}
        ride={ride.status}
        onStartRide={start}
        onStopRide={stop}
        onReport={() => setReporting(true)}
        onConfirm={confirmReport}
        onClear={clearReport}
      />
      )}

      <AnimatePresence>{ride.status === 'arrived' && <ArrivalCard key="arrived" trip={trip} speedFactor={speedFactor} onAgain={start} onDone={stop} />}</AnimatePresence>

      <AnimatePresence>
        {reporting && <ReportDrawer key="report" place={place} position={trip.position} onClose={() => setReporting(false)} onSubmit={submit} />}
      </AnimatePresence>
    </div>
  )
}

export default function RiderApp({ onHome }: { onHome: () => void }) {
  return (
    <LangProvider>
      <Rider onHome={onHome} />
    </LangProvider>
  )
}
