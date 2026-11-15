// Shared flood reports for the live app, through Supabase's REST API (no SDK needed).
//
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Vercel project settings, or .env locally)
// and run supabase/schema.sql once in the Supabase SQL editor. Without them the live app
// keeps reports on this device only and says so.
//
// The anon key is public by design: the table's row-level security only allows reading
// the last 24 hours, inserting new reports, and two narrow functions to confirm or clear one.

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const syncConfigured = Boolean(URL && KEY)

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
})

/** Database row -> app report. */
function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    khan: row.khan,
    sangkat: row.sangkat,
    lat: row.lat,
    lng: row.lng,
    depth: row.depth,
    source: row.source,
    ai: row.ai ?? null,
    confirmations: row.confirmations ?? 0,
    createdAt: Date.parse(row.created_at),
    cleared: Boolean(row.cleared_at),
    updatedAt: row.updated_at,
  }
}

/** Reports changed since `sinceIso` (new, confirmed or cleared), oldest first. */
export async function fetchChanges(sinceIso, signal) {
  const params = new URLSearchParams({ select: '*', order: 'updated_at.asc', limit: '500' })
  params.append('updated_at', `gt.${sinceIso}`)
  const res = await fetch(`${URL}/rest/v1/flood_reports?${params}`, { headers: headers(), signal })
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`)
  return (await res.json()).map(fromRow)
}

export async function insertReport(report) {
  const body = {
    id: report.id,
    name: report.name.slice(0, 120),
    area: report.area.slice(0, 120),
    khan: (report.khan ?? '').slice(0, 80),
    sangkat: (report.sangkat ?? '').slice(0, 80),
    lat: report.lat,
    lng: report.lng,
    depth: report.depth,
    source: report.source === 'citizen' ? 'citizen' : 'rider',
    ai: report.ai ?? null,
  }
  const res = await fetch(`${URL}/rest/v1/flood_reports`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`)
}

async function rpc(name, id) {
  const res = await fetch(`${URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ p_id: id }),
  })
  if (!res.ok) throw new Error(`Supabase responded ${res.status}`)
}

export const confirmRemote = (id) => rpc('confirm_report', id)
export const clearRemote = (id) => rpc('clear_report', id)
