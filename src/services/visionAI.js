// Vision AI verification of a citizen flood photo.
//
// The verifier is INDEPENDENT of the user's claim: it reaches its own verdict from
// the image, then compares that verdict with the depth the user selected and
// either confirms it, corrects it (up or down), or rejects the photo outright.
//
// Two paths:
//   1. LIVE  — a real uploaded file is sent to Gemini when VITE_GEMINI_API_KEY is
//              set in .env. (For production, move this call behind a server or
//              Supabase Edge Function so the key never ships to the browser.)
//   2. DEMO  — three bundled scenario photos with fixed, pre-written verdicts so
//              the pitch video works offline. These verdicts are simulated, but
//              they never read the user's selection.
//
// A real upload with no API key is NOT given a made-up verdict: it comes back as
// `status: 'unavailable'` and can only be filed as an unverified report.

import { DEPTHS } from '../lib/severity'

const MIN_SCAN_MS = 1500
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

export const isLiveVisionConfigured = Boolean(GEMINI_KEY)

const RISK = {
  ankle: { level: 'Caution', label: 'Caution for Motorbikes' },
  knee: { level: 'High Hazard', label: 'High Hazard for Motorbikes' },
  waist: { level: 'Severe', label: 'Impassable for All Vehicles' },
}

/** Bundled demo scenarios. `verdict` is what the image shows, whatever the user claims. */
export const DEMO_SCENARIOS = [
  {
    id: 'knee',
    title: 'Flooded street',
    hint: 'Knee-deep + clogged grate',
    image: '/scenarios/knee-deep-flood.jpg',
    credit: 'Albeiro Rodas / Wikimedia Commons, CC BY-SA 3.0',
    verdict: {
      isFlood: true,
      depth: 'knee',
      depthCm: 28,
      cue: 'tire submersion',
      reference: { object: 'Motorbike Wheel Hub', submersionPct: 50, debris: true },
      drainage: { status: 'Plastic Debris Blocking Curb Grate', blocked: true, confidence: 0.94 },
    },
  },
  {
    id: 'ankle',
    title: 'Minor puddle',
    hint: 'Shallow surface water',
    image: '/scenarios/ankle-deep-puddle.jpg',
    credit: 'Julie Rigsby / Wikimedia Commons, CC BY 2.0',
    verdict: {
      isFlood: true,
      depth: 'ankle',
      depthCm: 8,
      cue: 'water below pedestrians’ ankles',
      reference: { object: 'Pedestrian Lower Leg', submersionPct: 18, debris: false },
      drainage: { status: 'No Blockage Visible — Water Draining', blocked: false, confidence: 0.88 },
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

/** Compare the AI's own depth with the user's claim and write the outcome. */
function compareWithUser(verdict, userDepth) {
  if (!userDepth || userDepth === verdict.depth) {
    return { agreement: userDepth ? 'confirmed' : 'ai-only', correction: null }
  }
  const from = DEPTHS[userDepth]
  const to = DEPTHS[verdict.depth]
  const upgraded = to.rank > from.rank
  const tail = upgraded
    ? `Severity upgraded to ${RISK[verdict.depth].level}.`
    : `Severity downgraded to ${RISK[verdict.depth].level} so no false alarm reaches the map.`
  return {
    agreement: 'corrected',
    correction: {
      from: userDepth,
      to: verdict.depth,
      direction: upgraded ? 'up' : 'down',
      message: `AI Depth Correction: You selected ${from.label}, but ${verdict.cue} indicates ${to.label} (~${verdict.depthCm}cm). ${tail}`,
    },
  }
}

function buildResult(verdict, userDepth, source) {
  if (!verdict.isFlood) {
    return {
      status: 'rejected',
      isFlood: false,
      message: 'Verification Failed: No street flooding detected in this image. Report rejected to prevent map spam.',
      reason: verdict.reason,
      source,
    }
  }
  return {
    status: 'verified',
    isFlood: true,
    depth: verdict.depth,
    depthCm: verdict.depthCm,
    reference: verdict.reference,
    drainage: verdict.drainage,
    risk: RISK[verdict.depth],
    ...compareWithUser(verdict, userDepth),
    source,
  }
}

/**
 * @param {{ scenarioId?: string, file?: File, userDepth?: 'ankle'|'knee'|'waist'|null }} input
 * @returns {Promise<object>} result with `status`: 'verified' | 'rejected' | 'unavailable'
 */
export async function analyzeFloodPhoto({ scenarioId, file, userDepth = null }) {
  const started = Date.now()
  const settle = async (result) => {
    await wait(Math.max(0, MIN_SCAN_MS - (Date.now() - started)))
    return result
  }

  if (scenarioId) {
    const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId)
    return settle(buildResult(scenario.verdict, userDepth, 'Demo preset'))
  }

  if (!GEMINI_KEY) {
    return settle({
      status: 'unavailable',
      message: 'Vision AI is not connected. Add VITE_GEMINI_API_KEY to .env to verify your own photos.',
      source: 'offline',
    })
  }

  try {
    const verdict = await analyzeWithGemini(file)
    return settle(buildResult(verdict, userDepth, `Gemini · ${GEMINI_MODEL}`))
  } catch (error) {
    return settle({
      status: 'unavailable',
      message: `Vision AI request failed (${error.message}). You can still file an unverified report.`,
      source: 'error',
    })
  }
}

// ─── Live path: Gemini multimodal ───────────────────────────────────────────

const PROMPT = `Analyze this street photo. First, determine if it actually shows street flooding.
If it is a dry street, indoor photo, selfie, or unrelated image, reject it (isFlood: false).
If it is a flood, estimate the true water depth (ankle, knee, or waist) using visual reference
cues (car tires, motorbike exhausts, curbs, pedestrians) and check if plastic debris is blocking
a drain grate. Judge only from the image.
Reply with JSON only:
{
  "isFlood": boolean,
  "reason": string,                 // one sentence, why it is or is not a flood
  "depth": "ankle" | "knee" | "waist",
  "depthCm": number,                // best estimate in centimetres
  "referenceObject": string,        // the object you measured against, e.g. "Car tyre"
  "submersionPct": number,          // 0-100, how much of that object is under water
  "debrisBlockingDrain": boolean,
  "drainageStatus": string,         // short phrase
  "confidence": number              // 0-1
}`

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('could not read the image'))
    reader.readAsDataURL(file)
  })
}

async function analyzeWithGemini(file) {
  const data = await fileToBase64(file)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: file.type || 'image/jpeg', data } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    },
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const json = await response.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('empty response')
  const raw = JSON.parse(text)

  if (!raw.isFlood) return { isFlood: false, reason: raw.reason }
  const depth = DEPTHS[raw.depth] && raw.depth !== 'clear' ? raw.depth : 'ankle'
  const object = raw.referenceObject || 'Visual reference'
  return {
    isFlood: true,
    depth,
    depthCm: Math.round(raw.depthCm ?? DEPTHS[depth].cm),
    cue: `${object.toLowerCase()} submersion`,
    reference: {
      object,
      submersionPct: Math.round(raw.submersionPct ?? 0),
      debris: Boolean(raw.debrisBlockingDrain),
    },
    drainage: {
      status: raw.drainageStatus || (raw.debrisBlockingDrain ? 'Debris Blocking Drain Grate' : 'No Blockage Visible'),
      blocked: Boolean(raw.debrisBlockingDrain),
      confidence: Math.max(0, Math.min(1, raw.confidence ?? 0.7)),
    },
  }
}
