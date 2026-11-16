// Which reports this phone made, and which "still there?" prompts it has already shown,
// so a rider is never asked about their own report or asked twice about the same water.

const MINE = 'phnomflood.mine'
const ASKED = 'phnomflood.asked'
const ASK_AGAIN_MS = 6 * 3600 * 1000

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: prompts may repeat on this visit, nothing else breaks.
  }
}

// Kept in memory too, so a blocked localStorage still stops repeats within one visit.
const mine = new Set<string>(read<string[]>(MINE, []))
const asked = new Map<string, number>(Object.entries(read<Record<string, number>>(ASKED, {})))

export function markMine(id: string) {
  mine.add(id)
  write(MINE, [...mine].slice(-200))
}

export function markAsked(id: string) {
  const now = Date.now()
  asked.set(id, now)
  for (const [k, at] of asked) if (now - at > ASK_AGAIN_MS) asked.delete(k)
  write(ASKED, Object.fromEntries(asked))
}

// ── Your reports: how often other riders confirmed what this phone reported ──
// Reports leave the shared map after 24 hours, so the highest confirmation count seen for each
// of this phone's reports is kept here, and the total keeps growing over the season.
const SEEN = 'phnomflood.mine.confirmed'
const seen = new Map<string, number>(Object.entries(read<Record<string, number>>(SEEN, {})))

export interface Impact {
  /** Floods this phone reported */
  reports: number
  /** Times other riders confirmed them as still flooded */
  confirmations: number
}

/** Fold in the latest counts from the shared reports, and return the running totals. */
export function updateImpact(current: { id: string; confirmations?: number }[]): Impact {
  let changed = false
  for (const r of current) {
    if (!mine.has(r.id)) continue
    const n = r.confirmations ?? 0
    if (n > (seen.get(r.id) ?? 0)) {
      seen.set(r.id, n)
      changed = true
    }
  }
  if (changed) write(SEEN, Object.fromEntries(seen))
  let confirmations = 0
  for (const n of seen.values()) confirmations += n
  return { reports: mine.size, confirmations }
}

/** Can this phone ask about this report now? */
export function canAsk(id: string) {
  if (mine.has(id)) return false
  const at = asked.get(id)
  return !at || Date.now() - at > ASK_AGAIN_MS
}
