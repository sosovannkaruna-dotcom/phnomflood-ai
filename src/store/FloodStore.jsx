// Flood reports for the rider app, in two modes:
// - demo: seeded mock reports, kept in this browser.
// - live: starts empty; shared between devices through Supabase when configured
//   (src/services/sync.js), otherwise kept in this browser and labelled as such.

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { SEED_REPORTS, SEED_QUEUE, BASE_RIDERS_REROUTED, SEED_VERSION } from '../data/seed'
import { clearState, loadState, saveState } from '../services/api'
import { clearRemote, confirmRemote, fetchChanges, insertReport, syncConfigured } from '../services/sync'
import { connectRealtime } from '../services/realtime'
import { enqueue, flush, onPendingChange, pendingCount } from '../services/outbox'

// Live: the last reports seen, kept on the phone so the map still shows them without signal.
const SNAPSHOT = 'phnomflood.live.snapshot'
const DAY_MS = 24 * 3600 * 1000

function loadSnapshot() {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT)
    if (!raw) return null
    const snap = JSON.parse(raw)
    const reports = (snap.reports ?? []).filter((r) => Date.now() - r.createdAt < DAY_MS)
    return reports.length ? { at: snap.at, reports } : null
  } catch {
    return null
  }
}

function saveSnapshot(reports) {
  try {
    window.localStorage.setItem(SNAPSHOT, JSON.stringify({ at: Date.now(), reports: reports.map(({ photo, isNew, ...r }) => r) }))
  } catch {
    // Storage full or blocked: offline just shows an empty map.
  }
}
import { DEPTHS } from '../lib/severity'

const FloodContext = createContext(null)

const minutesAgo = (m) => Date.now() - m * 60 * 1000
const POLL_MS = 3000
const PUSHED_POLL_MS = 20000

function freshState(mode) {
  if (mode === 'live') return { reports: [], queue: [], ridersRerouted: 0, feed: [] }
  return {
    reports: SEED_REPORTS.map(({ minutesAgo: m, ...r }) => ({ ...r, createdAt: minutesAgo(m) })),
    queue: SEED_QUEUE.map((q) => ({ ...q, status: 'open' })),
    ridersRerouted: BASE_RIDERS_REROUTED,
    feed: [],
    seedVersion: SEED_VERSION,
  }
}

function initialState(mode) {
  // With shared sync on, the server is the source of truth: start from the last reports this phone
  // saw (so a phone with no signal still shows them), then load the truth from the server.
  if (mode === 'live' && syncConfigured) {
    const snap = loadSnapshot()
    return { ...freshState('live'), reports: snap?.reports ?? [], savedAt: snap?.at ?? null }
  }
  const saved = loadState(mode)
  if (mode === 'demo' && saved?.reports?.length && saved?.queue && saved?.seedVersion === SEED_VERSION) {
    // Seed reports are "N minutes ago" on every visit: reports lose weight with time (routingDepth),
    // so a demo saved yesterday must not open with every flood already drained.
    const ages = new Map(SEED_REPORTS.map((r) => [r.id, r.minutesAgo]))
    const reports = saved.reports.map((r) => (ages.has(r.id) && !r.confirmations ? { ...r, createdAt: minutesAgo(ages.get(r.id)) } : r))
    return { ...freshState(mode), ...saved, reports }
  }
  if (mode === 'live' && saved?.reports) return { ...freshState(mode), ...saved }
  return freshState(mode)
}

// AI urgency score (0–100) for a grate flagged by a citizen report.
function urgencyFor(report) {
  const base = { ankle: 58, knee: 84, waist: 93 }[report.depth] ?? 50
  const confidence = report.ai?.drainage?.confidence ?? 0.5
  return Math.min(99, Math.round(base + confidence * 14))
}

function queueItemFrom(report) {
  return {
    id: `q-${report.id}`,
    reportId: report.id,
    name: report.name,
    khan: report.khan,
    sangkat: report.sangkat,
    lat: report.lat,
    lng: report.lng,
    diagnosis: `Citizen photo verified by Vision AI: ${report.ai.drainage.status.toLowerCase()} (${Math.round(report.ai.drainage.confidence * 100)}% confidence)`,
    frequency: 1,
    urgency: urgencyFor(report),
    crew: 'Cleanup crew + pump truck',
    grateFlagged: true,
    isNew: true,
    status: 'open',
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_REPORT': {
      const report = action.report
      if (state.reports.some((r) => r.id === report.id)) return state
      const queue = report.ai?.drainage?.blocked ? [queueItemFrom(report), ...state.queue] : state.queue
      const event = {
        id: `e-${report.id}`,
        at: report.createdAt,
        text: `${DEPTHS[report.depth].label} flood reported at ${report.name}`,
        detail: report.ai ? 'Photo verified by Vision AI' : 'Unverified citizen report',
        depth: report.depth,
      }
      return { ...state, reports: [...state.reports, report], queue, feed: [event, ...state.feed].slice(0, 8) }
    }
    case 'MERGE_REMOTE': {
      // Changes from other devices: new reports arrive as "new" so they animate and can trigger a reroute.
      let reports = state.reports
      for (const row of action.rows) {
        const existing = reports.find((r) => r.id === row.id)
        if (row.cleared) {
          if (existing) reports = reports.filter((r) => r.id !== row.id)
          continue
        }
        // updatedAt moves with each "still there", which is when the water was last seen (lastSeenOf).
        const { cleared, ...report } = row
        if (existing) reports = reports.map((r) => (r.id === row.id ? { ...r, confirmations: report.confirmations, updatedAt: report.updatedAt } : r))
        else reports = [...reports, { ...report, isNew: !action.initial }]
      }
      return reports === state.reports ? state : { ...state, reports }
    }
    case 'DISPATCH_CREW':
      return { ...state, queue: state.queue.map((q) => (q.id === action.id ? { ...q, status: 'dispatched', dispatchedAt: Date.now() } : q)) }
    case 'CONFIRM_REPORT':
      return { ...state, reports: state.reports.map((r) => (r.id === action.id ? { ...r, confirmations: (r.confirmations ?? 0) + 1, createdAt: Date.now() } : r)) }
    case 'CLEAR_REPORT':
      return { ...state, reports: state.reports.filter((r) => r.id !== action.id) }
    case 'LIVE':
      return state.savedAt ? { ...state, savedAt: null } : state
    case 'ADD_REROUTED':
      return { ...state, ridersRerouted: state.ridersRerouted + action.count }
    case 'RESET':
      return freshState(action.mode)
    default:
      return state
  }
}

export function FloodProvider({ mode = 'demo', children }) {
  const [state, dispatch] = useReducer(reducer, mode, initialState)
  const shared = mode === 'live' && syncConfigured
  // local: this device only · connecting · live: shared and healthy · offline: shared but unreachable
  const [sync, setSync] = useState(shared ? 'connecting' : 'local')
  const cursor = useRef(new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  const [pending, setPending] = useState(pendingCount)
  useEffect(() => onPendingChange(setPending), [])

  // Live: keep the latest reports on the phone for the next time there is no signal.
  useEffect(() => {
    if (shared && !state.savedAt) saveSnapshot(state.reports)
  }, [shared, state.reports, state.savedAt])

  // Persist (not when the server is the source of truth).
  useEffect(() => {
    if (shared) return
    saveState(
      { ...state, reports: state.reports.map((r) => (r.photo?.startsWith('blob:') ? { ...r, photo: null } : r)) },
      mode,
    )
  }, [state, mode, shared])

  // Live sync: Realtime pushes "something changed" and the app fetches at once; polling stays on
  // as the safety net (every 3 s until a realtime event has proven the push works, then every 20 s).
  useEffect(() => {
    if (!shared) return
    let stopped = false
    let timer = 0
    let first = true
    let controller = null
    let pushed = false
    let busy = false
    const tick = async () => {
      if (stopped) return
      window.clearTimeout(timer)
      if (busy) {
        timer = window.setTimeout(tick, 300)
        return
      }
      if (document.visibilityState === 'visible') {
        busy = true
        controller = new AbortController()
        try {
          const rows = await fetchChanges(cursor.current, controller.signal)
          if (rows.length) {
            cursor.current = rows[rows.length - 1].updatedAt
            dispatch({ type: 'MERGE_REMOTE', rows, initial: first })
          }
          first = false
          setSync('live')
          dispatch({ type: 'LIVE' })
          // Back in reach: send anything made while offline.
          void flush()
        } catch (error) {
          if (error.name !== 'AbortError') setSync('offline')
        }
        busy = false
      }
      timer = window.setTimeout(tick, pushed ? PUSHED_POLL_MS : POLL_MS)
    }
    tick()
    const disconnect = connectRealtime({
      onChange: () => void tick(),
      onEvent: () => {
        pushed = true
      },
    })
    // Back to the tab, or back online: catch up at once.
    const onVisible = () => document.visibilityState === 'visible' && void tick()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      controller?.abort()
      disconnect()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [shared])

  const value = useMemo(
    () => ({
      ...state,
      mode,
      sync,
      pending,
      savedAt: state.savedAt ?? null,
      addReport: (report) => {
        dispatch({ type: 'ADD_REPORT', report })
        if (shared)
          insertReport(report).catch((error) => {
            setSync('offline')
            if (!error?.status || error.status >= 500) enqueue('insert', report.id, report)
          })
      },
      dispatchCrew: (id) => dispatch({ type: 'DISPATCH_CREW', id }),
      addRerouted: (count) => dispatch({ type: 'ADD_REROUTED', count }),
      confirmReport: (id) => {
        dispatch({ type: 'CONFIRM_REPORT', id })
        if (shared)
          confirmRemote(id).catch((error) => {
            setSync('offline')
            if (!error?.status || error.status >= 500) enqueue('confirm', id)
          })
      },
      clearReport: (id) => {
        dispatch({ type: 'CLEAR_REPORT', id })
        if (shared)
          clearRemote(id).catch((error) => {
            setSync('offline')
            if (!error?.status || error.status >= 500) enqueue('clear', id)
          })
      },
      resetDemo: () => {
        clearState(mode)
        dispatch({ type: 'RESET', mode })
      },
    }),
    [state, mode, sync, shared, pending],
  )

  return <FloodContext.Provider value={value}>{children}</FloodContext.Provider>
}

export function useFlood() {
  const ctx = useContext(FloodContext)
  if (!ctx) throw new Error('useFlood must be used inside <FloodProvider>')
  return ctx
}
