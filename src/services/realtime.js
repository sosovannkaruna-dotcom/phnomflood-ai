// Instant sync: Supabase Realtime tells this phone the moment any flood report is added,
// confirmed or cleared, so it fetches the change at once instead of waiting for the next poll.
// It speaks Supabase's Phoenix websocket protocol directly (no SDK needed).
//
// Needs flood_reports in the supabase_realtime publication (see supabase/schema.sql).
// Without it the socket connects but no events arrive, and polling carries on as before.

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const TOPIC = 'realtime:public:flood_reports'
const HEARTBEAT_MS = 25000

/**
 * @param {{ onChange: () => void, onEvent?: () => void }} handlers
 *   onChange: something changed, fetch now. onEvent: a change event arrived (realtime is proven to work).
 * @returns {() => void} disconnect
 */
export function connectRealtime({ onChange, onEvent }) {
  if (!URL || !KEY || typeof WebSocket === 'undefined') return () => {}
  const endpoint = `${URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`
  let socket = null
  let heartbeat = 0
  let retry = 0
  let retryTimer = 0
  let ref = 0
  let closed = false

  const send = (msg) => socket?.readyState === 1 && socket.send(JSON.stringify({ ...msg, ref: String(++ref) }))

  const open = () => {
    if (closed) return
    socket = new WebSocket(endpoint)
    socket.onopen = () => {
      retry = 0
      send({
        topic: TOPIC,
        event: 'phx_join',
        join_ref: '1',
        payload: {
          config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: 'flood_reports' }], private: false },
          access_token: KEY,
        },
      })
      heartbeat = window.setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {} }), HEARTBEAT_MS)
      // Anything missed while disconnected
      onChange()
    }
    socket.onmessage = (message) => {
      let msg
      try {
        msg = JSON.parse(message.data)
      } catch {
        return
      }
      if (msg.topic === TOPIC && msg.event === 'postgres_changes') {
        onEvent?.()
        onChange()
      }
    }
    socket.onclose = () => {
      window.clearInterval(heartbeat)
      if (closed) return
      // Back off: 1 s, 2 s, 4 s ... up to 30 s
      retryTimer = window.setTimeout(open, Math.min(30000, 1000 * 2 ** retry++))
    }
    socket.onerror = () => socket?.close()
  }

  open()
  return () => {
    closed = true
    window.clearInterval(heartbeat)
    window.clearTimeout(retryTimer)
    socket?.close()
  }
}
