import { useState } from 'react'
import RiskMap from './RiskMap'
import DispatchQueue from './DispatchQueue'
import { useFlood } from '../../store/FloodStore'
import { DEPTHS, isActiveFlood } from '../../lib/severity'
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
  const { reports, queue, ridersRerouted, dispatchCrew } = useFlood()
  const weather = getWeather()
  const [layers, setLayers] = useState({ pins: true, heat: true, elevation: true })
  const [focus, setFocus] = useState(null)

  const active = reports.filter(isActiveFlood)
  const severe = active.filter((r) => DEPTHS[r.depth].rank >= 2).length
  const flagged = queue.filter((q) => q.grateFlagged).length

  // Secondary metrics live in compact top-bar pills; the map and queue get the space.
  const metrics = [
    { label: 'Active Flood Zones', value: `${active.length} Active Hotspots`, detail: `${severe} severe` },
    { label: 'Probable Clogged Storm Drains', value: `${flagged} Flagged Grates` },
    { label: 'Delivery Riders Rerouted Today', value: `${ridersRerouted.toLocaleString('en-US')} Safe Trips` },
    { label: 'Open Data Feeds', value: 'OSM + DEM Elevation + Open-Meteo', live: true },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-slate-100 p-3 text-ink sm:p-4">
      {/* Title + metric pills */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink">Municipal &amp; Venture Command Center: Phnom Penh Flood Operations</h1>
        <span className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold" style={{ background: '#FFFBEB', color: '#92400E' }}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-caution" />
          {weather.alert} • {weather.rainMmPerHour}mm/hr
        </span>
      </div>

      <dl className="flex shrink-0 flex-wrap gap-2">
        {metrics.map(({ label, value, detail, live }) => (
          <div key={label} className="flex items-baseline gap-2 rounded-lg border border-hairline bg-white px-3 py-2 shadow-sm">
            <dt className="text-xs text-muted">{label}</dt>
            <dd key={value} className="flex animate-fade-in items-center gap-2 text-compact font-semibold text-ink">
              {live && <span className="h-2 w-2 rounded-full bg-clear" title="Live" />}
              {value}
              {detail && <span className="text-xs font-medium text-[#B91C1C]">{detail}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {/* Map + queue take the primary visual weight */}
      <div className="grid shrink-0 grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[65fr_35fr]">
        <section className="flex h-96 flex-col overflow-hidden rounded-xl border border-hairline bg-white shadow-sm lg:h-auto lg:min-h-80">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Phnom Penh Micro-Drainage &amp; Elevation Risk Map</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {LAYER_TOGGLES.map(({ id, label, swatch }) => (
                <label key={id} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={layers[id]}
                    onChange={() => setLayers((l) => ({ ...l, [id]: !l[id] }))}
                    className="h-4 w-4 rounded accent-[#0284C7]"
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

      {/* Open data attribution */}
      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted">
        <span>Open data powering the model:</span>
        {DATASETS.map(({ name, role }) => (
          <span key={name}>
            <span className="font-semibold text-ink">{name}</span> ({role})
          </span>
        ))}
        <span className="ml-auto">Prototype build · figures simulated</span>
      </footer>
    </div>
  )
}
