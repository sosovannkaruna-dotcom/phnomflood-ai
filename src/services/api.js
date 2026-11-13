// Persistence layer.
//
// Today: everything lives in localStorage so the prototype runs with zero setup.
// Later: swap the bodies of these functions for Supabase calls. The rest of the
// app only talks to this module (through src/store/FloodStore.jsx).
//
// Suggested Supabase tables:
//   flood_reports   (id, name, khan, sangkat, lat, lng, depth, source, created_at,
//                    photo_url, ai jsonb)
//   dispatch_queue  (id, report_id, name, khan, sangkat, lat, lng, diagnosis,
//                    frequency, urgency, status, created_at)
//
//   import { createClient } from '@supabase/supabase-js'
//   const supabase = createClient(import.meta.env.VITE_SUPABASE_URL,
//                                 import.meta.env.VITE_SUPABASE_ANON_KEY)
//   export const loadState = async () => {
//     const { data: reports } = await supabase.from('flood_reports').select('*')
//     const { data: queue } = await supabase.from('dispatch_queue').select('*')
//     return { reports, queue }
//   }
//   …and subscribe to realtime inserts with supabase.channel(...).on('postgres_changes', …)

const KEY = 'phnomflood.state.v1'

export function loadState() {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked (private mode): the app still works in memory.
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
