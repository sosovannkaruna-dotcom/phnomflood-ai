// Vision AI check of a citizen flood photo.
//
// The verdict is INDEPENDENT of the user's claim: it comes from the image, then is compared
// with the depth the user picked, to confirm it, correct it (up or down) or reject the photo.
//
// demo: the four sample photos have fixed, pre-written verdicts (simulated, offline).
// live: every photo, samples included, goes to /api/verify-photo, a server function that
//       calls Google Gemini with a key that never reaches the browser.
//
// Results carry codes, not sentences; the UI words them in English or Khmer.

import { DEPTHS } from '../lib/severity'

const MIN_SCAN_MS = 1500
const MAX_SIDE = 1280

export const DEMO_SCENARIOS = [
  {
    id: 'ankle',
    title: 'Shallow flood',
    hint: 'Water at wheel-hub height',
    image: '/scenarios/ankle-deep-puddle.jpg',
    credit: 'Biplab Sau / Pexels',
    verdict: {
      isFlood: true,
      depth: 'ankle',
      depthCm: 12,
      cue: 'water reaching the bicycle wheel hubs',
      reference: { object: 'Bicycle Wheel Hub', submersionPct: 30, debris: false },
      drainage: { status: 'Drain Inlet Not Visible Under Moving Water', blocked: false, confidence: 0.55 },
    },
  },
  {
    id: 'knee',
    title: 'Wading street',
    hint: 'Knee to thigh depth',
    image: '/scenarios/knee-deep-flood.jpg',
    credit: 'Lâm Trần / Pexels',
    verdict: {
      isFlood: true,
      depth: 'knee',
      depthCm: 28,
      cue: 'water reaching the knees and thighs of people wading',
      reference: { object: 'Pedestrian Knee', submersionPct: 45, debris: false },
      drainage: { status: 'Street Fully Submerged, Drain Not Visible', blocked: false, confidence: 0.6 },
    },
  },
  {
    id: 'waist',
    title: 'Stalled bike',
    hint: 'Impassable, seat-height water',
    image: '/scenarios/waist-deep-flood.jpg',
    credit: 'Dibakar Roy / Pexels',
    verdict: {
      isFlood: true,
      depth: 'waist',
      depthCm: 45,
      cue: 'water reaching the seat of a stalled motorbike',
      reference: { object: 'Motorbike Footpegs and Rear Wheel', submersionPct: 80, debris: false },
      drainage: { status: 'Road Fully Submerged, Drain Not Visible', blocked: false, confidence: 0.58 },
    },
  },
  {
    id: 'dry',
    title: 'Dry street',
    hint: 'Not a flood photo',
    image: '/scenarios/dry-street.jpg',
    credit: 'Kiensvay / Wikimedia Commons, CC BY-SA 3.0',
    verdict: {
      isFlood: false,
      reason: 'Dry road surface with visible lane markings and no standing water.',
    },
  },
]

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

function compareWithUser(verdict, userDepth) {
  if (!userDepth || userDepth === verdict.depth) return { agreement: userDepth ? 'confirmed' : 'ai-only', correction: null }
  const upgraded = DEPTHS[verdict.depth].rank > DEPTHS[userDepth].rank
  return { agreement: 'corrected', correction: { from: userDepth, to: verdict.depth, direction: upgraded ? 'up' : 'down' } }
}

function buildResult(verdict, userDepth, source) {
  if (!verdict.isFlood) return { status: 'rejected', isFlood: false, reason: verdict.reason, source }
  return {
    status: 'verified',
    isFlood: true,
    depth: verdict.depth,
    depthCm: verdict.depthCm,
    cue: verdict.cue,
    reference: verdict.reference,
    drainage: verdict.drainage,
    ...compareWithUser(verdict, userDepth),
    source,
  }
}

/** Shrink a photo to at most 1280 px and re-encode as JPEG, so phone photos upload fast. */
async function toJpegBase64(blob) {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
  return dataUrl.split(',')[1]
}

async function verifyLive(blob) {
  const image = await toJpegBase64(blob)
  const res = await fetch('/api/verify-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
  })
  if (res.status === 503) return { code: 'not_configured' }
  if (!res.ok) return { code: 'failed' }
  return { verdict: await res.json() }
}

/**
 * @param {{ mode: 'demo'|'live', scenarioId?: string, file?: File, userDepth?: 'ankle'|'knee'|'waist'|null }} input
 * @returns {Promise<object>} `status`: 'verified' | 'rejected' | 'unavailable' (with `code`)
 */
export async function analyzeFloodPhoto({ mode = 'demo', scenarioId, file, userDepth = null }) {
  const started = Date.now()
  const settle = async (result) => {
    await wait(Math.max(0, MIN_SCAN_MS - (Date.now() - started)))
    return result
  }

  if (mode === 'demo') {
    if (scenarioId) {
      const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId)
      return settle(buildResult(scenario.verdict, userDepth, 'demo'))
    }
    return settle({ status: 'unavailable', code: 'demo_upload', source: 'demo' })
  }

  try {
    let blob = file
    if (scenarioId) {
      const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId)
      blob = await (await fetch(scenario.image)).blob()
    }
    const outcome = await verifyLive(blob)
    if (outcome.code) return settle({ status: 'unavailable', code: outcome.code, source: 'live' })
    return settle(buildResult(outcome.verdict, userDepth, 'live'))
  } catch {
    return settle({ status: 'unavailable', code: 'failed', source: 'live' })
  }
}
