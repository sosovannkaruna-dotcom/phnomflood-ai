// Shared by the open data feed (/api/reports) and the AI briefing (/api/briefing):
// reads live flood reports from Supabase with the public anon key. Row-level security
// already limits what that key can see to the last 24 hours, so nothing private leaks here.

const BASE = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY

export const reportsConfigured = Boolean(BASE && KEY)

// Typical depth for each reported class, in cm (the same values the app uses).
export const DEPTH_CM = { ankle: 10, knee: 25, waist: 40 }

/**
 * Reports from the last `hours` (1-24), newest first. Cleared reports only when asked.
 * Each row comes back in the open data shape (snake_case, no internal fields).
 */
export async function fetchReports({ hours = 24, includeCleared = false, signal } = {}) {
  const span = Math.min(24, Math.max(1, Math.round(hours)))
  const since = new Date(Date.now() - span * 3600 * 1000).toISOString()
  const params = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: '1000' })
  params.append('created_at', `gt.${since}`)
  if (!includeCleared) params.append('cleared_at', 'is.null')
  const res = await fetch(`${BASE}/rest/v1/flood_reports?${params}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    signal: signal ?? AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`supabase ${res.status}`)
  return (await res.json()).map(toOpen)
}

function toOpen(row) {
  const aiCm = Number(row.ai?.depthCm)
  const verified = Number.isFinite(aiCm) && aiCm > 0
  return {
    id: row.id,
    status: row.cleared_at ? 'cleared' : 'active',
    depth: row.depth,
    depth_cm: verified ? Math.round(aiCm) : DEPTH_CM[row.depth] ?? null,
    depth_source: verified ? 'photo_ai' : 'rider',
    drain_blocked: verified ? Boolean(row.ai?.drainage?.blocked) : null,
    place: row.name,
    area: row.area,
    sangkat: row.sangkat || null,
    khan: row.khan || null,
    lat: Math.round(row.lat * 1e6) / 1e6,
    lng: Math.round(row.lng * 1e6) / 1e6,
    confirmations: row.confirmations ?? 0,
    reported_at: row.created_at,
    updated_at: row.updated_at,
    cleared_at: row.cleared_at ?? null,
  }
}
