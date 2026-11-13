import { useState } from 'react'
import RiskMap from './RiskMap'
import DispatchQueue from './DispatchQueue'
import { useFlood } from '../../store/FloodStore'
import { DEPTHS, isActiveFlood } from '../../lib/severity'
import { timeAgo } from '../../lib/time'
import { getWeather } from '../../services/weather'

const LAYER_TOGGLES = [
  { id: 'pins', label: 'Show Flood Pins', swatch: '#EF4444' },
  { id: 'heat', label: 'Show Clogged Drain Heatmap', swatch: '#F97316' },
  { id: 'elevation', label: 'Show Elevation Risk Zones', swatch: '#475569' },
]

const DATASETS = [
  { name: 'OpenStreetMap', role: 'Road Network' },
  { name: 'NASA SRTM Digital Elevation Model', role: 'Topography' },
  { name: 'Open-Meteo API', role: 'Rainfall' },
]

export default function DashboardView() {
  const { reports, queue, ridersRerouted, feed, dispatchCrew } = useFlood()
  const weather = getWeather()
  const [layers, setLayers] = useState({ pins: true, heat: true, elevation: true })
  const [focus, setFocus] = useState(null)

  const active = reports.filter(isActiveFlood)
  const severe = active.filter((r) => DEPTHS[r.depth].rank >= 2).length
  const flagged = queue.filter((q) => q.grateFlagged).length
  const dispatched = queue.filter((q) => q.status === 'dispatched').length
  const latest = feed[0]

  const kpis = [
    {
      label: 'Active Flood Zones',
      figure: active.length,
      unit: 'Active Hotspots',
      note: `${severe} severe · ${active.length - severe} caution`,
    },
    {
      label: 'Probable Clogged Storm Drains',
      figure: flagged,
      unit: 'Flagged Grates',
      note: dispatched ? `${dispatched} crew${dispatched > 1 ? 's' : ''} dispatched` : 'Flooding repeatedly in moderate rain',
    },
    {
      label: 'Delivery Riders Rerouted Today',
      figure: ridersRerouted.toLocaleString('en-US'),
      unit: 'Safe Trips',
      note: 'B2B fleet routing API',
    },
    {
      label: 'Open Data Feeds',
      text: 'OSM + DEM Elevation + Open-Meteo',
      note: 'Live',
      live: true,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-[#F1F5F9] p-3 text-ink sm:p-4">
      {/* Page header */}
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] text-muted">Phnom Penh Capital Administration · Public Works</p>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">Municipal &amp; Venture Command Center</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {latest && (
            <span key={latest.id} className="hidden animate-fade-in text-muted lg:inline">
              <span className="font-medium text-ink">Latest:</span> {latest.text} · {latest.detail} · {timeAgo(latest.at)}
            </span>
          )}
          <span className="rounded-md px-2 py-1 font-medium" style={{ background: '#FFFBEB', color: '#92400E' }}>
            {weather.alert} • {weather.rainMmPerHour}mm/hr
          </span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(({ label, figure, unit, text, note, live }) => (
          <div key={label} className="rounded-xl border border-hairline bg-white px-4 py-3">
            <p className="text-[12px] font-medium text-muted">{label}</p>
            {text ? (
              <p className="mt-1.5 text-[15px] font-semibold leading-8 text-ink">{text}</p>
            ) : (
              <p key={figure} className="mt-1.5 flex animate-fade-in items-baseline gap-2">
                <span className="text-[26px] font-semibold leading-8 tracking-tight tabular-nums text-ink">{figure}</span>
                <span className="text-[13px] font-medium text-ink">{unit}</span>
              </p>
            )}
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
              {live && <span className="h-1.5 w-1.5 rounded-full bg-clear" />}
              {note}
            </p>
          </div>
        ))}
      </div>

      {/* Map + queue */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[65fr_35fr]">
        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-hairline bg-white">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Micro-Drainage &amp; Elevation Risk Map</h2>
              <p className="text-[12px] text-muted">Active flood reports over low-elevation “bowl” zones</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {LAYER_TOGGLES.map(({ id, label, swatch }) => (
                <label key={id} className="flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={layers[id]}
                    onChange={() => setLayers((l) => ({ ...l, [id]: !l[id] }))}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0F172A]"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />
                  {label}
                </label>
              ))}
            </div>
          </header>
          <div className="relative z-0 min-h-0 flex-1">
            <RiskMap reports={reports} queue={queue} layers={layers} focus={focus} />
          </div>
        </section>

        <DispatchQueue queue={queue} onDispatch={dispatchCrew} onFocus={setFocus} focusId={focus?.id} />
      </div>

      {/* Open data & AI attribution */}
      <footer className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-hairline bg-white px-4 py-2 text-[12px]">
        <span className="font-medium text-muted">Open data powering the model</span>
        {DATASETS.map(({ name, role }) => (
          <span key={name} className="text-ink">
            <span className="font-semibold">{name}</span> <span className="text-muted">({role})</span>
          </span>
        ))}
        <span className="ml-auto text-slate-400">Prototype build · figures simulated</span>
      </footer>
    </div>
  )
}
