// Flood reports for the rider app, in two modes:
// - demo: seeded mock reports, kept in this browser.
// - live: starts empty; shared between devices through Supabase when configured
//   (src/services/sync.js), otherwise kept in this browser and labelled as such.

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { SEED_REPORTS, SEED_QUEUE, BASE_RIDERS_REROUTED } from '../data/seed'
import { clearState, loadState, saveState } from '../services/api'
import { clearRemote, confirmRemote, fetchChanges, insertReport, syncConfigured } from '../services/sync'
import { DEPTHS } from '../lib/severity'

const FloodContext = createContext(null)

const minutesAgo = (m) => Date.now() - m * 60 * 1000
const POLL_MS = 3000

function freshState(mode) {
  if (mode === 'live') return { reports: [], queue: [], ridersRerouted: 0, feed: [] }
  return {
    reports: SEED_REPORTS.map(({ minutesAgo: m, ...r }) => ({ ...r, createdAt: minutesAgo(m) })),
    queue: SEED_QUEUE.map((q) => ({ ...q, status: 'open' })),
    ridersRerouted: BASE_RIDERS_REROUTED,
    feed: [],
  }
}

function initialState(mode) {
  // With shared sync on, the server is the source of truth: start empty and load from it.
  if (mode === 'live' && syncConfigured) return freshState('live')
  const saved = loadState(mode)
  if (mode === 'demo' && saved?.reports?.length && saved?.queue) return { ...freshState(mode), ...saved }
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
        const { cleared, updatedAt, ...report } = row
        if (existing) reports = reports.map((r) => (r.id === row.id ? { ...r, confirmations: report.confirmations } : r))
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

  // Persist (not when the server is the source of truth).
  useEffect(() => {
    if (shared) return
    saveState(
      { ...state, reports: state.reports.map((r) => (r.photo?.startsWith('blob:') ? { ...r, photo: null } : r)) },
      mode,
    )
  }, [state, mode, shared])

  // Live sync: poll for changes, pause while the tab is hidden.
  useEffect(() => {
    if (!shared) return
    let stopped = false
    let timer = 0
    let first = true
    let controller = null
    const tick = async () => {
      if (stopped) return
      if (document.visibilityState === 'visible') {
        controller = new AbortController()
        try {
          const rows = await fetchChanges(cursor.current, controller.signal)
          if (rows.length) {
            cursor.current = rows[rows.length - 1].updatedAt
            dispatch({ type: 'MERGE_REMOTE', rows, initial: first })
          }
          first = false
          setSync('live')
        } catch (error) {
          if (error.name !== 'AbortError') setSync('offline')
        }
      }
      timer = window.setTimeout(tick, POLL_MS)
    }
    tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      controller?.abort()
    }
  }, [shared])

  const value = useMemo(
    () => ({
      ...state,
      mode,
      sync,
      addReport: (report) => {
        dispatch({ type: 'ADD_REPORT', report })
        if (shared) insertReport(report).catch(() => setSync('offline'))
      },
      dispatchCrew: (id) => dispatch({ type: 'DISPATCH_CREW', id }),
      addRerouted: (count) => dispatch({ type: 'ADD_REROUTED', count }),
      confirmReport: (id) => {
        dispatch({ type: 'CONFIRM_REPORT', id })
        if (shared) confirmRemote(id).catch(() => setSync('offline'))
      },
      clearReport: (id) => {
        dispatch({ type: 'CLEAR_REPORT', id })
        if (shared) clearRemote(id).catch(() => setSync('offline'))
      },
      resetDemo: () => {
        clearState(mode)
        dispatch({ type: 'RESET', mode })
      },
    }),
    [state, mode, sync, shared],
  )

  return <FloodContext.Provider value={value}>{children}</FloodContext.Provider>
}

export function useFlood() {
  const ctx = useContext(FloodContext)
  if (!ctx) throw new Error('useFlood must be used inside <FloodProvider>')
  return ctx
}
