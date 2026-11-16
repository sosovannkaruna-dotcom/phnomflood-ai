// GET /api/history  (Vercel serverless function): past flood reports, for the flood replay and
// the blocked-drain watch on the Open data page, and for anyone who wants the archive.
//
//   days    1-90 (default 7)
//   format  json (default) | csv
//   drain   "blocked" to list only reports whose photo showed a drain blocked by debris
//
// Each report carries status: active, cleared (riders marked it drained) or expired (over 24 h).
// Until the flood_history database function exists, this falls back to the last 24 hours.

import { fetchHistory, fetchReports, reportsConfigured } from './_lib/reports.js'
import { sendCsv } from './_lib/csv.js'
import { LICENCE } from './reports.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!reportsConfigured) return res.status(503).json({ error: 'not_configured' })

  const query = new URL(req.url ?? '/', 'http://local').searchParams
  const days = Math.min(90, Math.max(1, Math.round(Number(query.get('days') ?? 7)) || 7))
  const format = (query.get('format') ?? 'json').toLowerCase()
  if (!['json', 'csv'].includes(format)) return res.status(400).json({ error: 'bad_format', allowed: ['json', 'csv'] })
  const drainOnly = query.get('drain') === 'blocked'

  let reports
  let window = days
  let historyAvailable = true
  try {
    reports = await fetchHistory({ days })
    if (!reports) {
      historyAvailable = false
      window = 1
      reports = (await fetchReports({ hours: 24, includeCleared: true })).reverse()
    }
  } catch {
    return res.status(502).json({ error: 'upstream' })
  }
  if (drainOnly) reports = reports.filter((r) => r.drain_blocked === true)

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  if (format === 'csv') return sendCsv(res, reports, drainOnly ? 'phnomflood-blocked-drains' : 'phnomflood-history')

  const to = new Date()
  return res.status(200).json({
    source: 'PhnomFlood AI flood report history, Phnom Penh',
    generated_at: to.toISOString(),
    from: new Date(to.getTime() - window * 24 * 3600 * 1000).toISOString(),
    to: to.toISOString(),
    window_days: window,
    history_available: historyAvailable,
    drain_blocked_only: drainOnly,
    count: reports.length,
    licence: LICENCE,
    docs: 'https://phnomflood-ai.vercel.app/#/data',
    reports,
  })
}
