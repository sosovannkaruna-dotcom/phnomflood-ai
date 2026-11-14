// Ultra-dark, low-contrast basemap drawn from OpenFreeMap vector tiles
// (OpenMapTiles schema, OpenStreetMap data, no API key).
import type { StyleSpecification } from 'maplibre-gl'

const LATIN_NAME = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ''] as unknown as string

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#0D0F14' } },
    {
      id: 'green',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      paint: { 'fill-color': '#0F1218', 'fill-opacity': 0.9 },
    },
    // Tonle Sap, Mekong, Bassac and the remaining lakes
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#0C4A6E' } },
    {
      id: 'shoreline',
      type: 'line',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'line-color': '#0284C7', 'line-width': 0.8, 'line-opacity': 0.75 },
    },
    {
      id: 'canals',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: { 'line-color': '#0C4A6E', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 16, 3] },
    },
    {
      id: 'buildings',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': '#11141B', 'fill-opacity': 0.8 },
    },
    {
      id: 'roads-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      minzoom: 12.5,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1B1F2A', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 3.5] },
    },
    {
      id: 'roads-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#252A37', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12, 1.2, 16, 6] },
    },
    {
      id: 'road-names',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'transportation_name',
      minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': LATIN_NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 10 },
      paint: { 'text-color': '#565D6D', 'text-halo-color': '#0D0F14', 'text-halo-width': 1 },
    },
    {
      id: 'water-names',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'water_name',
      layout: { 'text-field': LATIN_NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-letter-spacing': 0.08 },
      paint: { 'text-color': '#38BDF8', 'text-opacity': 0.7, 'text-halo-color': '#0C4A6E', 'text-halo-width': 1 },
    },
    {
      id: 'place-names',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'place',
      minzoom: 12.5,
      filter: ['in', ['get', 'class'], ['literal', ['suburb', 'quarter', 'neighbourhood', 'village']]],
      layout: { 'text-field': LATIN_NAME, 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-max-width': 7 },
      paint: { 'text-color': '#4B5262', 'text-halo-color': '#0D0F14', 'text-halo-width': 1 },
    },
  ],
}
