import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { LocateFixed, Minus, Plus, Volume2, VolumeX } from 'lucide-react'
import RiderMap, { type RiderMapHandle } from './components/RiderMap'
import TopHud from './components/TopHud'
import BottomSheet from './components/BottomSheet'
import ReportDrawer from './components/ReportDrawer'
import { useTrip } from './hooks/useTrip'
import { placeAt } from './lib/trip'
import { useFlood } from '../command/store'
import type { FloodReport } from '../command/types'
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
export default function RiderApp({ onOpenCity }: { onOpenCity: () => void }) {
  const { reports, addReport, addRerouted, confirmReport, clearReport } = useFlood()
  const trip = useTrip(reports, () => addRerouted(24 + Math.floor(Math.random() * 18)))
  const [mode, setMode] = useState<MapMode>('depth')
  const [muted, setMuted] = useState(false)
  const [reporting, setReporting] = useState(false)
  const map = useRef<RiderMapHandle>(null)

  const place = useMemo(() => placeAt(trip.position), [trip.position])

  // Audible alert when a flood forces a reroute.
  useEffect(() => {
    if (trip.recalculating && !muted) beep()
  }, [trip.recalculating, muted])

  const submit = useCallback(
    ({ depth, ai, photo }: { depth: FloodReport['depth']; ai: VisionResult | null; photo: string | null }) => {
      const now = Date.now()
      addReport({
        id: `r-${now}`,
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
        ai: ai as FloodReport['ai'],
        photo,
      })
      setReporting(false)
    },
    [addReport, place, trip.position],
  )

  const control = 'cc-panel rd-press grid h-11 w-11 place-items-center rounded-lg text-zinc-100'

  return (
    <div className="rd-root relative h-full w-full select-none overflow-hidden bg-[#090A0F] text-zinc-100">
      <RiderMap
        ref={map}
        preset={trip.preset}
        entries={trip.entries}
        active={trip.active}
        recalculating={trip.recalculating}
        reports={reports}
        mode={mode}
        position={trip.position}
        bearing={trip.bearing}
      />

      <TopHud trip={trip} place={place} mode={mode} onToggleMode={() => setMode((m) => (m === 'depth' ? 'passability' : 'depth'))} onOpenCity={onOpenCity} />

      {/* Right-edge map controls, in thumb reach just above the sheet */}
      <div className="rd-controls absolute right-3 z-10 flex flex-col gap-2">
        <button onClick={() => map.current?.recenter()} aria-label="Re-centre on my position" className={control}>
          <LocateFixed className="h-5 w-5" />
        </button>
        <button onClick={() => map.current?.zoomBy(1)} aria-label="Zoom in" className={control}>
          <Plus className="h-5 w-5" />
        </button>
        <button onClick={() => map.current?.zoomBy(-1)} aria-label="Zoom out" className={control}>
          <Minus className="h-5 w-5" />
        </button>
        <button onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? 'Unmute audio alerts' : 'Mute audio alerts'} className={control}>
          {muted ? <VolumeX className="h-5 w-5 text-zinc-500" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      <BottomSheet trip={trip} reports={reports} position={trip.position} onReport={() => setReporting(true)} onConfirm={confirmReport} onClear={clearReport} />

      <AnimatePresence>
        {reporting && <ReportDrawer key="report" place={place} position={trip.position} onClose={() => setReporting(false)} onSubmit={submit} />}
      </AnimatePresence>
    </div>
  )
}
