import { useEffect, useRef } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import FloodLayer from '../map/FloodLayer'
import { destinationIcon, floodIcon, originIcon, riderIcon, routeLabelIcon } from '../map/icons'
import { boundsOf, pointAlong } from '../../lib/geo'
import { PHNOM_PENH_CENTER } from '../../data/routes'

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

/** Fits the view to the active routes and forwards map taps while picking a pin. */
function MapController({ paths, fitKey, pickMode, onPick }) {
  const map = useMap()

  useEffect(() => {
    if (!paths.length) return
    // Padding leaves room for the planner card (top) and summary card (bottom).
    // Capped so the routes still fit on short screens.
    const h = map.getSize().y
    map.fitBounds(boundsOf(paths), {
      paddingTopLeft: [28, Math.min(110, h * 0.18)],
      paddingBottomRight: [28, Math.min(170, h * 0.26)],
      animate: true,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map])

  useEffect(() => {
    map.getContainer().style.cursor = pickMode ? 'crosshair' : ''
  }, [pickMode, map])

  useMapEvents({
    click(event) {
      if (pickMode) onPick([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

/** Solid safe route that draws itself on whenever it changes. */
function SafeRoute({ candidate, tooltip, warn }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current?.getElement?.()
    if (!el) return
    el.classList.add('route-draw')
    const t = window.setTimeout(() => el.classList.remove('route-draw'), 1200)
    return () => window.clearTimeout(t)
  }, [candidate.id])

  return (
    <>
      <Polyline positions={candidate.path} pathOptions={{ color: '#ffffff', weight: 8, opacity: 1 }} interactive={false} />
      <Polyline
        ref={ref}
        positions={candidate.path}
        pathOptions={{ color: warn ? '#F59E0B' : '#10B981', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
      >
        <Tooltip sticky className="pf-tip">
          {tooltip}
        </Tooltip>
      </Polyline>
    </>
  )
}

export default function CitizenMap({
  preset,
  plan,
  safeEntry,
  staleCandidate,
  texts,
  reports,
  rider,
  draft,
  pickMode,
  onPick,
  fitKey,
}) {
  const standard = plan.standard.candidate
  const safe = safeEntry.candidate
  const sameRoute = safe.id === standard.id
  const paths = sameRoute ? [safe.path] : [standard.path, safe.path]
  const extra = safeEntry.minutes - plan.standard.minutes

  return (
    <MapContainer center={PHNOM_PENH_CENTER} zoom={13} zoomControl={false} attributionControl={false} className="h-full w-full">
      <TileLayer url={OSM_TILES} maxZoom={19} />
      <MapController paths={paths} fitKey={fitKey} pickMode={pickMode} onPick={onPick} />

      <FloodLayer reports={reports} />

      {/* Standard route: dashed red when blocked, grey when merely not chosen */}
      {!sameRoute && (
        <Polyline
          key={`std-${standard.id}-${texts.blocked}`}
          positions={standard.path}
          pathOptions={{
            color: texts.blocked ? '#EF4444' : '#94A3B8',
            weight: 4,
            opacity: 0.9,
            dashArray: '2 9',
            lineCap: 'round',
          }}
        >
          <Tooltip sticky className="pf-tip">{`Standard Route (${texts.standardText})`}</Tooltip>
        </Polyline>
      )}

      {/* Route being replaced, shown fading while the new one is calculated */}
      {staleCandidate && (
        <Polyline
          key={`stale-${staleCandidate.id}`}
          positions={staleCandidate.path}
          className="route-stale"
          pathOptions={{ color: '#F59E0B', weight: 5, dashArray: '6 10' }}
          interactive={false}
        />
      )}

      {!staleCandidate && (
        <SafeRoute
          key={safe.id}
          candidate={safe}
          warn={safeEntry.blockers.length > 0}
          tooltip={sameRoute ? `Standard Route (${texts.standardText})` : `PhnomFlood Safe Route (${texts.safeText})`}
        />
      )}

      {/* Route bubbles */}
      {!sameRoute && (
        <Marker
          position={pointAlong(standard.path, 0.42)}
          icon={routeLabelIcon(texts.blocked ? 'Standard · blocked' : 'Standard', texts.blocked ? 'blocked' : 'neutral')}
          interactive={false}
          zIndexOffset={-200}
        />
      )}
      {!staleCandidate && !sameRoute && (
        <Marker
          key={`lbl-${safe.id}`}
          position={pointAlong(safe.path, 0.68)}
          icon={routeLabelIcon(extra > 0 ? `Safe · +${extra} min` : 'Safe route', 'safe')}
          interactive={false}
          zIndexOffset={-200}
        />
      )}

      <Marker position={[preset.origin.lat, preset.origin.lng]} icon={originIcon}>
        <Tooltip className="pf-tip">{preset.origin.name}</Tooltip>
      </Marker>
      <Marker position={[preset.destination.lat, preset.destination.lng]} icon={destinationIcon}>
        <Tooltip className="pf-tip">{preset.destination.name}</Tooltip>
      </Marker>

      {rider && (
        <Marker position={rider} icon={riderIcon} zIndexOffset={500}>
          <Tooltip className="pf-tip">Your current position</Tooltip>
        </Marker>
      )}
      {draft && <Marker position={draft} icon={floodIcon('knee', { isNew: true })} zIndexOffset={600} interactive={false} />}
    </MapContainer>
  )
}
