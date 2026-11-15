// Browser persistence, one slot per app mode.
// Shared live sync with other devices lives in ./sync.js.

const KEYS = { demo: 'phnomflood.state.v1', live: 'phnomflood.live.v1' }
const keyFor = (mode = 'demo') => KEYS[mode] ?? KEYS.demo

export function loadState(mode) {
  try {
    const raw = window.localStorage.getItem(keyFor(mode))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveState(state, mode) {
  try {
    window.localStorage.setItem(keyFor(mode), JSON.stringify(state))
  } catch {
    // Storage full or blocked (private mode): the app still works in memory.
  }
}

export function clearState(mode) {
  try {
    window.localStorage.removeItem(keyFor(mode))
  } catch {
    // ignore
  }
}
