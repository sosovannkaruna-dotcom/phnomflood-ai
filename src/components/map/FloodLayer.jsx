import { Fragment } from 'react'
import { Circle, Marker, Popup } from 'react-leaflet'
import { DEPTHS } from '../../lib/severity'
import { timeAgo } from '../../lib/time'
import { floodIcon } from './icons'

const SOURCE_LABEL = {
  citizen: 'Citizen report',
  rider: 'Rider report',
  monitor: 'Route monitoring',
}

/** Flood pins with their colour-coded radius zones. Used by both maps. */
export default function FloodLayer({ reports, showZones = true }) {
  return reports.map((report) => {
    const depth = DEPTHS[report.depth] ?? DEPTHS.clear
    const position = [report.lat, report.lng]
    return (
      <Fragment key={report.id}>
        {showZones && (
          <Circle
            center={position}
            radius={depth.zoneRadius}
            pathOptions={{
              color: depth.color,
              weight: 1,
              opacity: 0.6,
              fillColor: depth.color,
              fillOpacity: depth.rank >= 2 ? 0.16 : 0.12,
            }}
          />
        )}
        <Marker position={position} icon={floodIcon(report.depth, { isNew: report.isNew })} zIndexOffset={depth.rank * 100}>
          <Popup>
            <div className="min-w-[180px]">
              <div className="text-[13px] font-semibold text-slate-900">{report.name}</div>
              <div className="mb-2 text-[11px] text-slate-500">
                Khan {report.khan} · Sangkat {report.sangkat}
              </div>
              <span
                className="inline-block rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ background: depth.soft, color: depth.text }}
              >
                {depth.label}
                {depth.cm ? ` · ~${report.ai?.depthCm ?? depth.cm} cm` : ''}
              </span>
              <div className="mt-1.5 text-[11px] text-slate-600">{depth.advice}</div>
              {report.ai && (
                <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
                  AI verified · {report.ai.drainage.status}
                </div>
              )}
              <div className="mt-1.5 text-[10px] text-slate-400">
                {SOURCE_LABEL[report.source] ?? 'Report'} · {timeAgo(report.createdAt)}
              </div>
            </div>
          </Popup>
        </Marker>
      </Fragment>
    )
  })
}
