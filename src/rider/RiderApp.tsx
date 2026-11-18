import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CloudRain, Crosshair as LocateFixed, Minus, Mountains, NavigationArrow, Plus, SpeakerHigh as Volume2, SpeakerX as VolumeX, Waves } from '@phosphor-icons/react'
import RiderMap, { type RiderMapHandle } from './components/RiderMap'
import TopHud from './components/TopHud'
import BottomSheet from './components/BottomSheet'
import ReportDrawer from './components/ReportDrawer'
import ArrivalCard from './components/ArrivalCard'
import NavBar from './components/NavBar'
import PlaceSearch from './components/PlaceSearch'
import { useTrip } from './hooks/useTrip'
import { RIDE_GLIDE_MS, rideSpeedFactor, useRide, useRideClock } from './hooks/useRide'
import { useWeather } from './hooks/useWeather'
import { useGps, useLiveRoute } from './hooks/useLive'
import { PRESETS, analyse, clearsIn, divergence, floodAhead, floodAt, floodsOnRoute, hazardAhead, metresBetween, placeAt, safest } from './lib/trip'
import { drainText } from './lib/format'
import FloodCard from './components/FloodCard'
import TourOverlay from './components/TourOverlay'
import StillThere, { type StillAnswer } from './components/StillThere'
import { canAsk, markAsked, markMine, updateImpact } from './lib/asked'
import { useBriefing } from '../services/briefing'
import { useHotspots } from './hooks/useHotspots'
import { loadLowGround, lowMetres, type LowGround } from './lib/lowGround'
import { routeForecast } from './lib/forecast'
import { useForecast } from './hooks/useForecast'
import ForecastBar from './components/ForecastBar'
import { distanceToPath } from '../lib/geo'
import { DEPTHS } from '../lib/severity'
import { reverseName } from '../services/liveRouting'
import { useFlood } from '../shared/useFlood'
import { useMode } from '../shared/mode'
import { LangProvider, useT, type Key } from '../i18n'
import type { FloodReport } from '../shared/types'
import type { LatLng, MapMode, Place, Preset, VisionResult } from './types'

/**
 * Demo trips in a fresh order on every visit. The first one shown always has two dry routes
 * for a motorbike, so the scripted flood on it ends in a real reroute.
 */
function shuffledTrips(reports: FloodReport[]): Preset[] {
  const list = [...PRESETS]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  const good = list.findIndex((p) => analyse(p, reports, 'moto').filter((e) => e.blockers.length === 0).length >= 2)
  if (good > 0) list.unshift(...list.splice(good, 1))
  return list
}

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
/** Guided demo: the steps that have a caption (the closing card comes after the last one). */
const TOUR_STEPS = 5

function Rider({ onHome, tour = false }: { onHome: () => void; tour?: boolean }) {
  const { t, lang } = useT()
  const appMode = useMode()
  const { reports, sync, pending, savedAt, addReport, addRerouted, confirmReport, clearReport } = useFlood()
  const { ride, setRide, start: startRide, stop } = useRide()
  const riding = ride.status === 'riding'
  const live = appMode === 'live'

  // Live: the real GPS fix and routes to any searched place. Demo: the shuffled trip list.
  const gps = useGps(live)
  const liveRoute = useLiveRoute(gps, t('live.unnamed'), lang === 'en')
  const [demoTrips] = useState(() => shuffledTrips(reports))
  const weather = useWeather(appMode)
  // Live: flood-prone spots from report history, shown by themselves when heavy rain is falling or forecast.
  const hotspotState = useHotspots(live)
  const [spotsOn, setSpotsOn] = useState(false)
  const heavyRain = weather.status === 'ready' && weather.weather.heavy

  // Flood forecast: where water should stand over the next two hours (rain forecast × terrain,
  // corrected by reports). On by itself in live heavy rain; a switch in both versions. While it is
  // on, routes also avoid the water it expects, so what the map shows is what the routing uses.
  const [fcChoice, setFcChoice] = useState<boolean | null>(null)
  const fcOn = fcChoice ?? (live && heavyRain)
  const allSpots = useMemo(() => (hotspotState.status === 'ready' ? hotspotState.spots : []), [hotspotState])
  const forecast = useForecast(fcOn, weather.status === 'ready' ? weather.weather.series : undefined, reports, allSpots)
  const fcResult = fcOn && forecast.status === 'ready' ? forecast.result : null
  const [fcFrame, setFcFrame] = useState(0)
  const [fcBarH, setFcBarH] = useState(0)
  const mapForecast = useMemo(() => (fcResult ? { result: fcResult, frame: fcFrame } : null), [fcResult, fcFrame])

  const trip = useTrip(
    reports,
    () => addRerouted(24 + Math.floor(Math.random() * 18)),
    ride.status === 'idle' ? null : ride.fraction,
    live ? { override: liveRoute.trip, gps: gps.point, heading: gps.heading, forecast: fcResult } : { presets: demoTrips, forecast: fcResult },
  )
  const planning = live && !liveRoute.preset
  // Live: what this phone's reports have done (confirmations by other riders), kept across visits.
  const impact = useMemo(() => (live ? updateImpact(reports) : null), [live, reports])

  // Live: the rain radar, on by itself in heavy rain until the rider switches it.
  const [radarChoice, setRadarChoice] = useState<boolean | null>(null)
  const radarOn = live && (radarChoice ?? heavyRain)
  const [radarTime, setRadarTime] = useState<number | null>(null)
  // Low ground from a terrain model: where water collects before anyone reports it. On by itself in
  // live heavy rain (the map may have no reports yet); a switch in both versions.
  const [lowChoice, setLowChoice] = useState<boolean | null>(null)
  const lowOn = lowChoice ?? (live && heavyRain)
  const [lowGround, setLowGround] = useState<LowGround | null>(null)
  useEffect(() => {
    if (lowOn && !lowGround) void loadLowGround().then(setLowGround)
  }, [lowOn, lowGround])
  // How much of the route on screen crosses low ground, for the note in the sheet.
  const routeLowM = useMemo(
    () => (lowOn && lowGround && !planning ? lowMetres(lowGround, trip.active.candidate.path) : null),
    [lowOn, lowGround, planning, trip.active.candidate.path],
  )
  const spotsShown = live && hotspotState.status === 'ready' && (heavyRain || spotsOn) ? hotspotState.spots : []
  const briefing = useBriefing(lang, live, `${reports.length}:${reports.reduce((s, r) => s + (r.confirmations ?? 0), 0)}`)
  const rainNow = weather.status === 'ready' ? weather.weather.rainNow : 0
  // Depth tags and red / amber hazard markers are always on: they are the warning.
  const mapMode: MapMode = 'depth'
  const [muted, setMuted] = useState(false)
  const [reporting, setReporting] = useState(false)
  // Guided tour: the rider holds still at the start of the ride step (see the tour below).
  const [tourHold, setTourHold] = useState(false)
  // Navigating = a ride in progress: tilted heading-up camera, turn banner, bottom bar.
  const navigating = riding
  // Live, no ride started: the camera still follows the rider once they move or tap the locate
  // button, top-down and north-up. Only a ride tilts the camera heading-up.
  const [follow, setFollow] = useState(false)
  const mapNav = riding || (live && follow)
  const [panned, setPanned] = useState(false)
  useEffect(() => {
    if (mapNav) setPanned(false)
  }, [mapNav])
  const map = useRef<RiderMapHandle>(null)

  // Each demo ride starts clean: the scripted flood from the last ride (ids starting "s-") is cleared,
  // so repeated rehearsals never pile floods up until every route is blocked.
  const start = useCallback(() => {
    if (appMode === 'demo') reports.filter((r) => r.id.startsWith('s-')).forEach((r) => clearReport(r.id))
    startRide()
  }, [appMode, reports, clearReport, startRide])

  // Where the rider is, by name. Live: a reverse geocode of the GPS fix (refreshed every ~150 m).
  const [livePlace, setLivePlace] = useState<Place | null>(null)
  const lookedUp = useRef<LatLng | null>(null)
  useEffect(() => {
    if (!live || !gps.point) return
    if (lookedUp.current && metresBetween(lookedUp.current, gps.point) < 150) return
    const at = gps.point
    lookedUp.current = at
    void reverseName(at, lang).then((found) => {
      if (found) setLivePlace({ name: found.name, area: found.name, khan: found.khan, sangkat: found.sangkat, lat: at[0], lng: at[1] })
    })
  }, [live, gps.point, lang])
  const place = useMemo(() => (live && livePlace ? livePlace : placeAt(trip.position)), [live, livePlace, trip.position])
  const speedFactor = rideSpeedFactor(trip.active.candidate.distanceM)

  // Live: is the rider actually moving? (GPS speed, or 40 m from where they were standing)
  const [moving, setMoving] = useState(false)
  const anchor = useRef<{ at: LatLng; time: number } | null>(null)
  useEffect(() => {
    if (!live || !gps.point) return
    const now = Date.now()
    const a = anchor.current
    if ((gps.speed ?? 0) > 2.5 || (a && metresBetween(a.at, gps.point) > 40)) {
      setMoving(true)
      anchor.current = { at: gps.point, time: now }
    } else if (!a || now - a.time > 30000) {
      if (a) setMoving(false)
      anchor.current = { at: gps.point, time: now }
    }
  }, [live, gps.point, gps.speed])

  // A new route on screen: show the overview first (route brief), not the follow camera.
  const previewId = liveRoute.preset?.id ?? null
  useEffect(() => {
    if (previewId) setFollow(false)
  }, [previewId])
  // Moving without pressing Start: with a route, start guidance; without one, follow the rider.
  useEffect(() => {
    if (!live || !moving || ride.status !== 'idle') return
    if (liveRoute.preset && liveRoute.status === 'ready') startRide()
    else setFollow(true)
  }, [live, moving, ride.status, liveRoute.preset, liveRoute.status, startRide])

  // Riding through water (most likely with "Dry only" off, or when no dry route is left).
  const inWater = useMemo(() => (riding ? floodAt(trip.position, reports) : null), [riding, trip.position, reports])
  const waterKind = inWater ? (DEPTHS[inWater.depth].rank >= 2 ? 'danger' : 'caution') : null
  const lastWater = useRef<string | null>(null)

  // Flooded stretch coming up on the active route: warned well before the rider reaches it.
  const routeFloods = useMemo(() => floodsOnRoute(trip.active.candidate, reports), [trip.active.candidate, reports])
  const ahead = riding && !inWater ? floodAhead(routeFloods, trip.active.candidate, trip.fraction, 700) : null
  const lastAhead = useRef<string | null>(null)
  // Forecast water coming up on the route, at the time the rider will get there (checked every ~0.5 % of the route).
  const fcStep = Math.round(trip.fraction * 200)
  const fcAhead = useMemo(() => {
    if (!riding || !fcResult) return null
    const route = trip.active.candidate
    const first = routeForecast(fcResult, route.path, trip.active.minutes, Date.now(), fcStep / 200).first
    const metres = first ? Math.round(((first.fraction - fcStep / 200) * route.distanceM) / 10) * 10 : Infinity
    // Keyed by where the wet stretch is on the route, so the banner stays put while the distance counts down.
    return first && metres <= 1000 ? { cm: first.cm, metres: Math.max(10, metres), key: Math.round(first.fraction * 50) } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riding, fcResult, trip.active, fcStep])

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
  // Demo: report the scripted flood while the rider can still take the turn-off to a dry alternative
  // (~250 m before the first point where one leaves the current route), so the reroute never means turning around.
  const scriptedAt = useMemo(() => {
    const route = trip.active.candidate
    const turnOffs = trip.entries.filter((e) => e !== trip.active && e.blockers.length === 0).map((e) => divergence(route, e.candidate))
    // No dry alternative to send the rider to: don't flood their only dry road.
    if (!turnOffs.length) return 2
    // A split at (or near) the start: report it the moment the ride starts, before the rider moves.
    return Math.max(0, Math.min(...turnOffs) - 250 / Math.max(1, route.distanceM))
  }, [trip.active, trip.entries])

  // The ride holds still while the rider fills in a report.
  useRideClock({ ride, setRide, trip, mode: appMode, paused: reporting || tourHold, flood: waterKind, scriptedAt, onScriptedFlood })

  // Audible alert when a flood forces a reroute, and when the rider rides into water.
  useEffect(() => {
    if (trip.recalculating && !muted) beep()
  }, [trip.recalculating, muted])
  useEffect(() => {
    const id = inWater?.id ?? null
    if (id && id !== lastWater.current && !muted) beep()
    lastWater.current = id
  }, [inWater, muted])
  useEffect(() => {
    const id = ahead?.report.id ?? null
    if (id && id !== lastAhead.current && !muted) beep()
    lastAhead.current = id
  }, [ahead, muted])

  // Live: arrive at the destination, and fetch a new route when the rider leaves this one.
  useEffect(() => {
    if (!live || !riding || !gps.point || !liveRoute.preset) return
    const { destination } = liveRoute.preset
    if (metresBetween(gps.point, [destination.lat, destination.lng]) < 35) {
      setRide((r) => ({ ...r, status: 'arrived', fraction: 1 }))
      return
    }
    const off = distanceToPath(gps.point, trip.active.candidate.path) as number
    if (off > 60 + (gps.accuracy ?? 0) * 0.5) liveRoute.rerouteFrom(gps.point)
    // A flood now blocks the road ahead and no turn-off to a drier option is left: a fresh route from here.
    else if (trip.active.blockers.length && !trip.recalculating) liveRoute.rerouteFrom(gps.point, true)
  }, [live, riding, gps.point, gps.accuracy, liveRoute, trip.active, trip.recalculating, setRide])

  // Alerts over the map while riding: in water now, or heading into water on purpose.
  const routeWet = trip.active.blockers.length + trip.active.cautions.length > 0
  const alert = inWater
    ? {
        id: `in-${inWater.id}`,
        text: t('flood.in', { depth: t(`depth.${inWater.depth}`).toLowerCase(), cm: inWater.ai?.depthCm ?? DEPTHS[inWater.depth].cm }),
        color: waterKind === 'danger' ? '#EF4444' : '#F59E0B',
      }
    : ahead
      ? {
          id: `ahead-${ahead.report.id}`,
          text: t('flood.ahead', {
            m: ahead.metres >= 1000 ? `${(ahead.metres / 1000).toFixed(1)} km` : `${ahead.metres} m`,
            depth: t(`depth.${ahead.report.depth}`).toLowerCase(),
            cm: ahead.report.ai?.depthCm ?? DEPTHS[ahead.report.depth].cm,
          }) + ` · ${drainText(t, clearsIn(ahead.report, rainNow))}`,
          color: DEPTHS[ahead.report.depth].rank >= 2 ? '#EF4444' : '#F59E0B',
        }
    : fcAhead
      ? {
          id: `fc-${fcAhead.key}`,
          text: t('fc.ahead', { cm: fcAhead.cm, m: fcAhead.metres >= 1000 ? `${(fcAhead.metres / 1000).toFixed(1)} km` : `${fcAhead.metres} m` }),
          color: '#38BDF8',
        }
    : riding && !trip.dryOnly && routeWet
      ? { id: 'dry-off', text: t('flood.dryOff'), color: '#F59E0B' }
      : live && liveRoute.rerouting
        ? { id: 'rerouting', text: t('live.rerouting'), color: '#F59E0B' }
        : null

  const liveNote = !live
    ? null
    : liveRoute.status === 'routing'
      ? t('live.routing')
      : liveRoute.status === 'error'
        ? t('live.routeError')
        : gps.status === 'locating' && !liveRoute.origin
          ? t('live.locating')
          : liveRoute.fromCentre
            ? t('live.noGps')
            : null

  const tourOnRef = useRef(tour)
  const submit = useCallback(
    ({ depth, ai, photo }: { depth: FloodReport['depth']; ai: VisionResult | null; photo: string | null }) => {
      const now = Date.now()
      const id = `${tourOnRef.current ? 's-r' : 'r'}-${now}-${Math.random().toString(36).slice(2, 7)}`
      if (live) markMine(id)
      addReport({
        // The tour's own report is marked scripted ("s-"), so it is cleared when the tour ends or replays.
        id,
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
      setTourStep((s) => (s === TOUR_STEPS ? TOUR_STEPS + 1 : s))
    },
    [addReport, place, trip.position, live],
  )

  // A tapped flood line: its details, while browsing the map (not while navigating).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = navigating || reporting ? null : (reports.find((r) => r.id === selectedId && r.depth !== 'clear') ?? null)

  // Live: passing a flood someone else reported? Ask whether it is still there, once.
  // This is what keeps the shared map fresh without anyone opening a menu.
  const [asking, setAsking] = useState<FloodReport | null>(null)
  useEffect(() => {
    if (!live || asking || reporting || selected || !gps.point || (gps.accuracy ?? 999) > 60) return
    const here = gps.point
    const near = reports
      .filter((r) => r.depth !== 'clear' && canAsk(r.id))
      .map((r) => ({ r, m: metresBetween(here, [r.lat, r.lng]) }))
      .filter((x) => x.m <= 60)
      .sort((a, b) => a.m - b.m)[0]
    if (near) setAsking(near.r)
  }, [live, asking, reporting, selected, gps.point, gps.accuracy, reports])
  const answerStill = useCallback(
    (answer: StillAnswer | null) => {
      if (!asking) return
      markAsked(asking.id)
      if (answer === 'still') confirmReport(asking.id)
      if (answer === 'cleared') clearReport(asking.id)
      setAsking(null)
    },
    [asking, confirmReport, clearReport],
  )

  // ── Guided demo ("Watch it work"): five captioned steps that drive the real app ──
  const [tourOn, setTourOn] = useState(tour)
  tourOnRef.current = tourOn
  const [tourStep, setTourStep] = useState(tour ? 1 : 0)
  const root = useRef<HTMLDivElement>(null)
  // A trip where the usual map route crosses water and a second dry route exists, so both the
  // comparison and the reroute show.
  const [tourTrip] = useState(() => {
    const good = (p: (typeof demoTrips)[number], needDiff: boolean) => {
      const entries = analyse(p, reports, 'moto')
      const dry = entries.filter((e) => e.blockers.length === 0)
      const safe = safest(entries)
      return dry.length >= 2 && (!needDiff || (safe.candidate.id !== entries[0].candidate.id && entries[0].worst > safe.worst))
    }
    return (demoTrips.find((p) => good(p, true)) ?? demoTrips.find((p) => good(p, false)) ?? demoTrips[0]).id
  })
  useEffect(() => {
    if (!tourOn) return
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    if (tourStep === 1) after(4500, () => setTourStep(2))
    if (tourStep === 2) {
      trip.setPreset(tourTrip)
      after(6500, () => setTourStep(3))
    }
    if (tourStep === 3) {
      // Navigation view first, rider holding still, so step 3 can be read before the flood arrives.
      setTourHold(true)
      start()
      after(4000, () => setTourHold(false))
      after(19000, () => setTourStep(4))
    }
    if (tourStep === 4) after(7000, () => {
      stop()
      setTourStep(5)
    })
    if (tourStep === 5) after(1400, () => setReporting(true))
    return () => timers.forEach((id) => window.clearTimeout(id))
    // Each step runs once when it begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOn, tourStep])
  // The reroute is the moment step 4 explains, so the caption changes the instant it starts.
  useEffect(() => {
    if (tourOn && tourStep === 3 && trip.recalculating) setTourStep(4)
  }, [tourOn, tourStep, trip.recalculating])
  const endTour = () => {
    setTourHold(false)
    reports.filter((r) => r.id.startsWith('s-')).forEach((r) => clearReport(r.id))
    setTourOn(false)
    setTourStep(0)
    setReporting(false)
    stop()
    // Stay on this screen as the normal demo (no reload, so the map keeps its place).
    window.history.replaceState(null, '', '#/demo')
  }
  const replayTour = () => {
    setReporting(false)
    stop()
    reports.filter((r) => r.id.startsWith('s-')).forEach((r) => clearReport(r.id))
    setTourStep(1)
  }
  // Height of whichever bottom panel is open (sheet or navigation bar), so cards and captions sit just above it.
  const [panelH, setPanelH] = useState(220)
  useEffect(() => {
    const el = root.current?.querySelector('[data-bottom-panel]')
    if (!el) return
    const observer = new ResizeObserver(() => setPanelH(Math.round(el.getBoundingClientRect().height)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [navigating])

  const control = 'rd-press grid h-10 w-10 place-items-center text-zinc-100'

  return (
    <div ref={root} className={`rd-root relative h-full w-full select-none overflow-hidden bg-void text-zinc-100 ${navigating ? 'is-nav' : ''}`}>
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
        navigating={mapNav}
        flat={!riding}
        panned={panned}
        onUserPan={() => setPanned(true)}
        glideMs={live ? 0 : riding ? RIDE_GLIDE_MS : 900}
        planning={planning}
        floodAt={waterKind}
        onFloodTap={setSelectedId}
        hotspots={spotsShown}
        radar={radarOn}
        onRadarFrame={setRadarTime}
        lowGround={lowOn ? lowGround : null}
        forecast={mapForecast}
      />

      {/* Riding through water: the screen edge pulses in the flood's colour */}
      {waterKind && <div className="rd-flood-edge" style={{ ['--flood' as string]: waterKind === 'danger' ? '#EF4444' : '#F59E0B' }} aria-hidden />}

      <TopHud trip={trip} place={place} mode={appMode} sync={sync} weather={weather} riding={riding && !live} navigating={navigating} planning={planning} alert={alert} quiet={ride.status === 'arrived'} speedFactor={speedFactor} onHome={onHome} />

      {/* Right-edge map controls, in thumb reach just above the sheet */}
      {/* Sits just above whichever bottom panel is open, at its real height (the sheet grows with notes and the briefing) */}
      <div className="rd-controls cc-panel absolute right-3 z-10 flex flex-col divide-y divide-white/[0.12]" style={{ bottom: panelH + 8 }}>
        {!navigating && (
          <>
            <button
              onClick={() => {
                if (live && gps.point) {
                  setFollow(true)
                  setPanned(false)
                } else map.current?.recenter()
              }}
              aria-label={t('controls.recenter')} className={control}>
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
        {live && (
          <button onClick={() => setRadarChoice(!radarOn)} aria-pressed={radarOn} aria-label={radarOn ? t('radar.hide') : t('radar.show')} className={control}>
            <CloudRain weight={radarOn ? 'fill' : 'bold'} className={`h-5 w-5 ${radarOn ? 'text-water' : ''}`} />
          </button>
        )}
        <button onClick={() => setFcChoice(!fcOn)} aria-pressed={fcOn} aria-label={fcOn ? t('fc.hide') : t('fc.show')} title={fcOn ? t('fc.hide') : t('fc.show')} className={control}>
          <Waves weight={fcOn ? 'fill' : 'bold'} className={`h-5 w-5 ${fcOn ? 'text-water' : ''}`} />
        </button>
        <button onClick={() => setLowChoice(!lowOn)} aria-pressed={lowOn} aria-label={lowOn ? t('low.hide') : t('low.show')} title={lowOn ? t('low.hide') : t('low.show')} className={control}>
          <Mountains weight={lowOn ? 'fill' : 'bold'} className={`h-5 w-5 ${lowOn ? 'text-indigo-400' : ''}`} />
        </button>
        <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? t('controls.unmute') : t('controls.mute')} className={control}>
          {muted ? <VolumeX className="h-5 w-5 text-zinc-500" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Flood forecast: the time control and what the blue means (hidden while riding; the alerts speak then) */}
      {fcOn && !navigating && <ForecastBar state={forecast} frame={fcFrame} onFrame={setFcFrame} bottom={panelH} onHeight={setFcBarH} />}

      {/* Rain radar caption: which frame is showing, and what it can and cannot show */}
      {radarOn && !navigating && (
        <p className="pointer-events-none absolute left-3 z-10 max-w-[60%] border border-white/[0.12] bg-void/85 px-2 py-1 text-[11px] leading-snug text-zinc-300" style={{ bottom: panelH + 8 + (fcBarH ? fcBarH + 6 : 0) }}>
          {radarTime
            ? t('radar.caption', { time: new Intl.DateTimeFormat(lang === 'km' ? 'km-KH' : 'en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Phnom_Penh' }).format(radarTime * 1000) })
            : t('radar.loading')}
        </p>
      )}

      {/* Dragged away while navigating: one tap brings the camera back behind the rider */}
      {mapNav && panned && (
        <button
          onClick={() => setPanned(false)}
          style={{ bottom: panelH + 8 + (!navigating && fcBarH ? fcBarH + 6 : 0) }}
          className="rd-press absolute left-3 z-10 flex h-10 items-center gap-2 bg-zinc-100 px-3.5 text-sm font-semibold text-zinc-950 shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
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
        rainNow={rainNow}
        forecast={weather.status === 'ready' ? weather.weather.series : undefined}
        briefing={live ? briefing : undefined}
        impact={impact}
        lowGround={lowOn ? { loading: !lowGround, auto: lowChoice === null, routeM: routeLowM } : undefined}
        floodForecast={fcOn ? forecast : undefined}
        offline={live ? { savedAt, pending } : undefined}
        spots={live ? { state: hotspotState, shown: spotsShown.length, auto: heavyRain, manual: spotsOn, toggle: () => setSpotsOn((v) => !v) } : undefined}
        live={
          live
            ? {
                origin: liveRoute.origin?.short ?? (liveRoute.fromCentre ? t('live.centre') : t('live.yourLocation')),
                destination: liveRoute.destination?.short ?? null,
                status: liveRoute.status,
                note: liveNote,
                onClear: () => liveRoute.setDestination(null),
                renderSearch: (close) => (
                  <PlaceSearch
                    near={gps.point}
                    origin={liveRoute.origin}
                    initialTarget="to"
                    onPickOrigin={liveRoute.setOrigin}
                    onPickDestination={liveRoute.setDestination}
                    onClose={close}
                  />
                ),
              }
            : undefined
        }
      />
      )}

      <AnimatePresence>{ride.status === 'arrived' && <ArrivalCard key="arrived" trip={trip} speedFactor={live ? null : speedFactor} onAgain={start} onDone={stop} />}</AnimatePresence>

      <AnimatePresence>
        {selected && (
          <FloodCard
            key={selected.id}
            report={selected}
            rainNow={rainNow}
            bottom={panelH}
            onClose={() => setSelectedId(null)}
            onConfirm={(id) => {
              confirmReport(id)
              setSelectedId(null)
            }}
            onClear={(id) => {
              clearReport(id)
              setSelectedId(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{asking && !reporting && <StillThere key={asking.id} report={asking} bottom={panelH} onAnswer={answerStill} />}</AnimatePresence>

      <AnimatePresence>
        {reporting && <ReportDrawer key="report" place={place} position={trip.position} onClose={() => setReporting(false)} onSubmit={submit} autoplay={tourOn && tourStep === TOUR_STEPS} />}
      </AnimatePresence>

      {tourOn && tourStep > 0 && (
        <TourOverlay
          step={tourStep}
          total={TOUR_STEPS}
          text={t(`tour.${Math.min(tourStep, TOUR_STEPS + 1)}` as Key)}
          bottom={reporting ? null : panelH}
          onSkip={endTour}
          onExplore={endTour}
          onReplay={replayTour}
        />
      )}
    </div>
  )
}

export default function RiderApp({ onHome, tour = false }: { onHome: () => void; tour?: boolean }) {
  return (
    <LangProvider>
      <Rider onHome={onHome} tour={tour} />
    </LangProvider>
  )
}
