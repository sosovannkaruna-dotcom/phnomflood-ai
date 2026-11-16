// Offline outbox for the live app: a report, confirmation or clear made without signal is kept on
// the phone and sent, in order, as soon as the shared reports can be reached again.
// The report shows on this phone at once; other riders get it when it goes out.

import { clearRemote, confirmRemote, insertReport } from './sync'

const KEY = 'phnomflood.outbox'

function load() {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(items) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Storage blocked: the item stays in memory for this visit.
  }
}

let items = load()
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn(items.length))

export const pendingCount = () => items.length

export function onPendingChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Keep an action to send later. `report` is the full report for an insert. */
export function enqueue(kind, id, report) {
  // A photo can be large and is never sent to the shared table anyway.
  const slim = report ? { ...report, photo: null, isNew: undefined } : undefined
  items = [...items, { kind, id, report: slim, at: Date.now() }]
  save(items)
  notify()
}

let flushing = false

/** Send what is waiting, oldest first; stops at the first network failure. */
export async function flush() {
  if (flushing || !items.length) return
  flushing = true
  try {
    while (items.length) {
      const item = items[0]
      try {
        if (item.kind === 'insert') await insertReport(item.report)
        else if (item.kind === 'confirm') await confirmRemote(item.id)
        else if (item.kind === 'clear') await clearRemote(item.id)
      } catch (error) {
        // 409: the report already arrived (the first try got through). Other 4xx: the server will
        // never accept it (for example a report older than the 24-hour window). Either way, drop it.
        const status = error?.status ?? 0
        if (!(status === 409 || (status >= 400 && status < 500))) break
      }
      items = items.slice(1)
      save(items)
      notify()
    }
  } finally {
    flushing = false
  }
}
