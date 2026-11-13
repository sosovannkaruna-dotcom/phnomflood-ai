// Leaflet divIcons (pure HTML/CSS, so there are no marker image files to break).
import L from 'leaflet'
import { DEPTHS } from '../../lib/severity'

const WAVES =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c.6.5 1.200 1 2.500 1C7 9 7 7 9.500 7c2.600 0 2.400 2 5 2 2.500 0 2.500-2 5-2 1.300 0 1.900.5 2.500 1"/><path d="M2 14c.6.5 1.200 1 2.500 1 2.500 0 2.500-2 5-2 2.600 0 2.400 2 5 2 2.500 0 2.500-2 5-2 1.300 0 1.900.5 2.500 1"/></svg>'
const CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

const cache = new Map()

/** Coloured flood pin. Severe and freshly submitted pins pulse. */
export function floodIcon(depthId, { isNew = false } = {}) {
  const key = `${depthId}:${isNew}`
  if (cache.has(key)) return cache.get(key)
  const depth = DEPTHS[depthId] ?? DEPTHS.clear
  const pulse = depth.rank >= 2 || isNew
  const icon = L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
    html: `<div class="pf-pin${pulse ? ' pf-pulse' : ''}${isNew ? ' pf-new' : ''}" style="background:${
      depth.color
    };--pf-color:${depth.color}">${depth.rank === 0 ? CHECK : WAVES}${
      isNew ? '<span class="pf-new-tag">NEW</span>' : ''
    }</div>`,
  })
  cache.set(key, icon)
  return icon
}

export const riderIcon = L.divIcon({
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: '<div class="pf-rider"></div>',
})

export const originIcon = L.divIcon({
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<div class="pf-end"></div>',
})

export const destinationIcon = L.divIcon({
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  html: '<div class="pf-end pf-dest"></div>',
})

/** Small text bubble pinned to a route ("Safe +3 min", "Blocked"). */
export function routeLabelIcon(text, kind) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<span class="pf-route-label is-${kind}">${text}</span>`,
  })
}
