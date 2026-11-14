import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Drawer } from 'vaul'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import MapCanvas from './components/MapCanvas'
import TopBar from './components/TopBar'
import Inspector from './components/Inspector'
import Analyst from './components/Analyst'
import Timeline from './components/Timeline'
import { useFlood } from './store'
import type { AnalystContext, LayerId, LayerState, ViewId } from './types'

type Sheet = 'telemetry' | 'analyst' | null

const panelMotion = (from: number) => ({
  initial: { opacity: 0, x: from },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: from },
  transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const },
})

/** Full-bleed map with floating HUD panels: the city operations view. */
export default function CommandCenter({ onOpenRiderApp }: { onOpenRiderApp: () => void }) {
  const { reports, queue, ridersRerouted, dispatchCrew, resetDemo } = useFlood()
  const [view, setView] = useState<ViewId>('live')
  const [hour, setHour] = useState(0)
  const [layers, setLayers] = useState<LayerState>({ radar: true, sensors: true, zones: true })
  const [selectedKhan, setSelectedKhan] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [loaded, setLoaded] = useState(false)

  // Brief skeleton state while the first telemetry frame "arrives".
  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 900)
    return () => window.clearTimeout(timer)
  }, [])

  // Only the forecast view scrubs time; the other views always show now.
  const changeView = useCallback((next: ViewId) => {
    setView(next)
    if (next !== 'forecast') setHour(0)
  }, [])

  const toggleLayer = useCallback((id: LayerId) => setLayers((l) => ({ ...l, [id]: !l[id] })), [])
  const activeReports = useMemo(() => reports.filter((r) => r.depth !== 'clear'), [reports])

  const context: AnalystContext = useMemo(
    () => ({ hour, selectedKhan, reports, queue, ridersRerouted }),
    [hour, selectedKhan, reports, queue, ridersRerouted],
  )

  const inspector = (
    <Inspector
      hour={hour}
      view={view}
      loaded={loaded}
      selectedKhan={selectedKhan}
      onSelectKhan={setSelectedKhan}
      tickets={queue}
      onDispatch={dispatchCrew}
      onFocus={(point) => {
        setFocus(point)
        setSheet(null)
      }}
      reportCount={activeReports.filter((r) => r.depth !== 'ankle').length}
      ridersRerouted={ridersRerouted}
    />
  )
  const analyst = (
    <Analyst
      context={context}
      onKhan={(id) => {
        setSelectedKhan(id)
        setSheet(null)
      }}
    />
  )

  return (
    <div className={`cc-root relative h-full w-full overflow-hidden bg-[#090A0F] text-zinc-100 ${view === 'forecast' ? 'cc-has-timeline' : ''}`}>
      <MapCanvas
        hour={hour}
        view={view}
        layers={layers}
        selectedKhan={selectedKhan}
        onSelectKhan={setSelectedKhan}
        reports={reports}
        tickets={queue}
        focus={focus}
      />

      <TopBar view={view} onViewChange={changeView} layers={layers} onToggleLayer={toggleLayer} onOpenRiderApp={onOpenRiderApp} onReset={resetDemo} />

      {/* Desktop: floating side panels */}
      <AnimatePresence initial={false}>
        {leftOpen && (
          <motion.aside key="left" {...panelMotion(-16)} aria-label="Telemetry inspector" className="cc-panel cc-scroll absolute bottom-4 left-4 top-20 z-10 hidden w-[340px] overflow-y-auto rounded-lg lg:block">
            {inspector}
          </motion.aside>
        )}
        {rightOpen && (
          <motion.aside key="right" {...panelMotion(16)} aria-label="Analysis assistant" className="cc-panel absolute bottom-4 right-4 top-20 z-10 hidden w-[380px] rounded-lg lg:block">
            {analyst}
          </motion.aside>
        )}
      </AnimatePresence>

      <button
        onClick={() => setLeftOpen((o) => !o)}
        aria-label={leftOpen ? 'Collapse telemetry inspector' : 'Open telemetry inspector'}
        className="cc-panel cc-btn absolute top-20 z-10 hidden h-8 w-8 place-items-center rounded-md text-zinc-400 transition-[left] duration-200 lg:grid"
        style={{ left: leftOpen ? 364 : 16 }}
      >
        {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>
      <button
        onClick={() => setRightOpen((o) => !o)}
        aria-label={rightOpen ? 'Collapse analysis assistant' : 'Open analysis assistant'}
        className="cc-panel cc-btn absolute top-20 z-10 hidden h-8 w-8 place-items-center rounded-md text-zinc-400 transition-[right] duration-200 lg:grid"
        style={{ right: rightOpen ? 404 : 16 }}
      >
        {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </button>

      {/* Forecast timeline */}
      <AnimatePresence>
        {view === 'forecast' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-x-3 bottom-16 z-10 lg:bottom-4 lg:left-[420px] lg:right-[460px]"
          >
            <Timeline hour={hour} onChange={setHour} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phone: the panels live in a draggable bottom sheet so the map stays clear */}
      <div className="absolute inset-x-3 bottom-3 z-10 grid grid-cols-2 gap-2 lg:hidden">
        <button onClick={() => setSheet('telemetry')} className="cc-panel cc-btn rounded-lg py-2.5 text-xs font-medium text-zinc-100">
          Telemetry
        </button>
        <button onClick={() => setSheet('analyst')} className="cc-panel cc-btn rounded-lg py-2.5 text-xs font-medium text-zinc-100">
          Analyst
        </button>
      </div>

      <Drawer.Root open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[1200] bg-black/50" />
          <Drawer.Content className="cc-root fixed inset-x-0 bottom-0 z-[1201] flex h-[78dvh] flex-col rounded-t-xl border-t border-white/[0.08] bg-[#0F1117] text-zinc-100 outline-none">
            <span className="mx-auto my-2 h-1 w-9 shrink-0 rounded-full bg-white/20" />
            <Drawer.Title className="sr-only">{sheet === 'analyst' ? 'Analysis assistant' : 'Telemetry inspector'}</Drawer.Title>
            <Drawer.Description className="sr-only">Drag down to close and return to the map.</Drawer.Description>
            <div className={`min-h-0 flex-1 ${sheet === 'analyst' ? '' : 'cc-scroll overflow-y-auto'}`}>{sheet === 'analyst' ? analyst : inspector}</div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  )
}
