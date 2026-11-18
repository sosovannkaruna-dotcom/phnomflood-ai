// This phone's report secret: a random value made once and kept on the phone. It goes with each
// report and "still there"; the database keeps only a hash of it, away from public view, to work out
// how far other riders have confirmed this phone's reports (rider trust, supabase/schema.sql).
// No name, number or account: clearing the browser's data starts a new, untrusted phone.

const KEY = 'phnomflood.device'

let cached = null

export function deviceSecret() {
  if (cached) return cached
  try {
    cached = window.localStorage.getItem(KEY)
    if (cached && /^[0-9a-f]{32}$/.test(cached)) return cached
  } catch {
    // Storage blocked: a fresh secret for this visit only.
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  cached = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  try {
    window.localStorage.setItem(KEY, cached)
  } catch {
    // Kept in memory only.
  }
  return cached
}
