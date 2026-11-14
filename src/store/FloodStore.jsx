// Single source of truth shared by the Citizen app and the Municipal dashboard.
// A report submitted in one view shows up in the other immediately.

import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { SEED_REPORTS, SEED_QUEUE, BASE_RIDERS_REROUTED } from '../data/seed'
import { clearState, loadState, saveState } from '../services/api'
import { DEPTHS } from '../lib/severity'

const FloodContext = createContext(null)

const minutesAgo = (m) => Date.now() - m * 60 * 1000

function freshState() {
  return {
    reports: SEED_REPORTS.map(({ minutesAgo: m, ...r }) => ({ ...r, createdAt: minutesAgo(m) })),
    queue: SEED_QUEUE.map((q) => ({ ...q, status: 'open' })),
    ridersRerouted: BASE_RIDERS_REROUTED,
    feed: [],
  }
}

function initialState() {
  const saved = loadState()
  if (saved?.reports?.length && saved?.queue) return { ...freshState(), ...saved }
  return freshState()
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
    diagnosis: `Citizen photo verified by Vision AI: ${report.ai.drainage.status.toLowerCase()} (${Math.round(
      report.ai.drainage.confidence * 100,
    )}% confidence)`,
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
      const queue = report.ai?.drainage?.blocked ? [queueItemFrom(report), ...state.queue] : state.queue
      const event = {
        id: `e-${report.id}`,
        at: report.createdAt,
        text: `${DEPTHS[report.depth].label} flood reported at ${report.name}`,
        detail: report.ai ? 'Photo verified by Vision AI' : 'Unverified citizen report',
        depth: report.depth,
      }
      return {
        ...state,
        reports: [...state.reports, report],
        queue,
        feed: [event, ...state.feed].slice(0, 8),
      }
    }
    case 'DISPATCH_CREW':
      return {
        ...state,
        queue: state.queue.map((q) =>
          q.id === action.id ? { ...q, status: 'dispatched', dispatchedAt: Date.now() } : q,
        ),
      }
    case 'CONFIRM_REPORT':
      return {
        ...state,
        reports: state.reports.map((r) => (r.id === action.id ? { ...r, confirmations: (r.confirmations ?? 0) + 1, createdAt: Date.now() } : r)),
      }
    case 'CLEAR_REPORT':
      return { ...state, reports: state.reports.filter((r) => r.id !== action.id) }
    case 'ADD_REROUTED':
      return { ...state, ridersRerouted: state.ridersRerouted + action.count }
    case 'RESET':
      return freshState()
    default:
      return state
  }
}

export function FloodProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    // Uploaded photos are in-memory object URLs: don't persist those.
    saveState({
      ...state,
      reports: state.reports.map((r) => (r.photo?.startsWith('blob:') ? { ...r, photo: null } : r)),
    })
  }, [state])

  const value = useMemo(
    () => ({
      ...state,
      addReport: (report) => dispatch({ type: 'ADD_REPORT', report }),
      dispatchCrew: (id) => dispatch({ type: 'DISPATCH_CREW', id }),
      addRerouted: (count) => dispatch({ type: 'ADD_REROUTED', count }),
      confirmReport: (id) => dispatch({ type: 'CONFIRM_REPORT', id }),
      clearReport: (id) => dispatch({ type: 'CLEAR_REPORT', id }),
      resetDemo: () => {
        clearState()
        dispatch({ type: 'RESET' })
      },
    }),
    [state],
  )

  return <FloodContext.Provider value={value}>{children}</FloodContext.Provider>
}

export function useFlood() {
  const ctx = useContext(FloodContext)
  if (!ctx) throw new Error('useFlood must be used inside <FloodProvider>')
  return ctx
}
