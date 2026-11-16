// GET /api/reports  (Vercel serverless function): PhnomFlood's open flood data feed.
//
//   format   geojson (default) | csv | json
//   hours    1-24, how far back to look (default 24; the database keeps reports public for 24 h)
//   include  "cleared" to also list reports riders have marked as drained
//   drain    "blocked" to list only reports whose photo showed a drain blocked by debris
//
// Public, read-only and cacheable: anyone may call it from any site (CORS *).
// Docs for people: the Open data page at /#/data.

import { fetchReports, reportsConfigured } from './_lib/reports.js'
import { sendCsv } from './_lib/csv.js'

export const LICENCE = {
  name: 'Open Database License (ODbL) 1.0',
  url: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution: 'PhnomFlood AI riders; place names © OpenStreetMap contributors',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!reportsConfigured) return res.status(503).json({ error: 'not_configured' })

  const query = new URL(req.url ?? '/', 'http://local').searchParams
  const format = (query.get('format') ?? 'geojson').toLowerCase()
  if (!['geojson', 'csv', 'json'].includes(format)) return res.status(400).json({ error: 'bad_format', allowed: ['geojson', 'csv', 'json'] })
  const hours = Number(query.get('hours') ?? 24)
  const includeCleared = query.get('include') === 'cleared'
  const drainOnly = query.get('drain') === 'blocked'

  let reports
  try {
    reports = await fetchReports({ hours: Number.isFinite(hours) ? hours : 24, includeCleared })
    if (drainOnly) reports = reports.filter((r) => r.drain_blocked === true)
  } catch {
    return res.status(502).json({ error: 'upstream' })
  }

  // Fresh enough for a flood map, light on the database: shared caches keep a copy for 20 s.
  res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60')
  const generated = new Date().toISOString()
  const window = Math.min(24, Math.max(1, Math.round(Number.isFinite(hours) ? hours : 24)))

  if (format === 'csv') return sendCsv(res, reports, drainOnly ? 'phnomflood-blocked-drains' : 'phnomflood-reports')

  const meta = {
    source: 'PhnomFlood AI live flood reports, Phnom Penh',
    generated_at: generated,
    window_hours: window,
    includes_cleared: includeCleared,
    count: reports.length,
    licence: LICENCE,
    docs: 'https://phnomflood-ai.vercel.app/#/data',
    note: 'Reports come from riders and may be wrong. depth_cm is an estimate: from the AI photo check when depth_source is photo_ai, otherwise the typical depth for the class.',
  }

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(200).json({ ...meta, reports })
  }

  res.setHeader('Content-Type', 'application/geo+json; charset=utf-8')
  return res.status(200).json({
    type: 'FeatureCollection',
    metadata: meta,
    features: reports.map(({ lat, lng, ...properties }) => ({
      type: 'Feature',
      id: properties.id,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties,
    })),
  })
}
