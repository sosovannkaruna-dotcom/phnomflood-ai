import { useEffect } from 'react'
import { Circle, CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet'
import FloodLayer from '../map/FloodLayer'
import { DRAIN_HEAT_POINTS, ELEVATION_ZONES } from '../../data/seed'

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function FlyTo({ focus }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 16, { duration: 0.8 })
  }, [focus, map])
  return null
}

/** One heat blob = two stacked, blurred circles (no heatmap plugin needed). */
function HeatBlob({ lat, lng, weight }) {
  return [
    { radius: 260, opacity: 0.2 },
    { radius: 130, opacity: 0.38 },
  ].map((ring) => (
    <Circle
      key={ring.radius}
      center={[lat, lng]}
      radius={ring.radius * (0.6 + weight * 0.5)}
      className="heat-blob"
      pathOptions={{ stroke: false, fillColor: '#F97316', fillOpacity: ring.opacity * (0.55 + weight * 0.45) }}
      interactive={false}
    />
  ))
}

/** Micro-drainage & elevation risk map on muted OpenStreetMap tiles. */
export default function RiskMap({ reports, queue, layers, focus }) {
  // Seeded history plus any grate newly flagged from a citizen report.
  const heat = [
    ...DRAIN_HEAT_POINTS,
    ...queue.filter((q) => q.isNew && q.grateFlagged).map((q) => [q.lat, q.lng, 1]),
  ]

  return (
    <div className="map-muted h-full w-full">
      <MapContainer center={[11.5605, 104.912]} zoom={14} zoomControl className="h-full w-full">
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <FlyTo focus={focus} />

        {layers.elevation &&
          ELEVATION_ZONES.map((zone) => (
            <Polygon
              key={zone.id}
              positions={zone.outline}
              pathOptions={{ color: '#334155', weight: 1.5, dashArray: '4 5', fillColor: '#475569', fillOpacity: 0.1 }}
            >
              <Tooltip sticky className="pf-tip">
                {zone.name} · low-elevation bowl · {zone.risk} risk
              </Tooltip>
            </Polygon>
          ))}

        {layers.heat && heat.map(([lat, lng, weight]) => <HeatBlob key={`${lat}-${lng}`} lat={lat} lng={lng} weight={weight} />)}

        {layers.pins && <FloodLayer reports={reports} />}

        {/* Ticket selected in the queue */}
        {focus && (
          <CircleMarker
            key={focus.id}
            center={[focus.lat, focus.lng]}
            radius={20}
            pathOptions={{ color: '#0284C7', weight: 3, fillColor: '#0284C7', fillOpacity: 0.12 }}
            interactive={false}
          />
        )}
      </MapContainer>
    </div>
  )
}
