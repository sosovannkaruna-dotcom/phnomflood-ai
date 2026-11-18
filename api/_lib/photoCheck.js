// The Gemini photo check, shared by /api/verify-photo (the app) and /api/telegram-webhook (the bot):
// does this photo show a flooded street, how deep, and is debris blocking a drain?
// Never returns or logs the key.

const PROMPT = `You check citizen flood reports for a navigation app in Phnom Penh.
Look only at this photo. First decide if it shows a flooded street or road.
A dry street, an indoor photo, a selfie, a screenshot or anything unrelated is NOT a flood.
If it is a flood, estimate the water depth from visual references such as wheels, exhausts,
curbs, steps, or people's legs, and say whether debris is blocking a visible drain.
Depth classes: ankle (about 5-15 cm), knee (about 15-35 cm), waist (over 35 cm, impassable).`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    isFlood: { type: 'BOOLEAN' },
    reason: { type: 'STRING', description: 'One short sentence: what the photo shows.' },
    depth: { type: 'STRING', enum: ['ankle', 'knee', 'waist'] },
    depthCm: { type: 'NUMBER' },
    referenceObject: { type: 'STRING', description: 'The object measured against, e.g. "Motorbike wheel".' },
    cue: { type: 'STRING', description: 'Short phrase, e.g. "water reaching the wheel hubs".' },
    submersionPct: { type: 'NUMBER' },
    debrisBlockingDrain: { type: 'BOOLEAN' },
    drainageStatus: { type: 'STRING', description: 'Short phrase about the drain, or that none is visible.' },
    confidence: { type: 'NUMBER' },
  },
  required: ['isFlood', 'reason'],
}

const DEFAULT_CM = { ankle: 10, knee: 25, waist: 45 }
// Fast Flash-Lite first (a photo check should take seconds), then full Flash, then Google's aliases.
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest']
// Whole request budget, under the 60 s limit set for this function in vercel.json.
const DEADLINE_MS = 55_000
const PER_MODEL_MS = 15_000

export function normalize(raw) {
  if (!raw || !raw.isFlood) return { isFlood: false, reason: String(raw?.reason ?? 'No street flooding visible.').slice(0, 240) }
  const depth = ['ankle', 'knee', 'waist'].includes(raw.depth) ? raw.depth : 'ankle'
  const clamp = (n, lo, hi, fallback) => (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : fallback)
  const object = String(raw.referenceObject || 'Visual reference').slice(0, 60)
  const blocked = Boolean(raw.debrisBlockingDrain)
  return {
    isFlood: true,
    reason: String(raw.reason ?? '').slice(0, 240),
    depth,
    depthCm: Math.round(clamp(raw.depthCm, 1, 150, DEFAULT_CM[depth])),
    cue: String(raw.cue || `${object.toLowerCase()} submersion`).slice(0, 120),
    reference: { object, submersionPct: Math.round(clamp(raw.submersionPct, 0, 100, 0)), debris: blocked },
    drainage: {
      status: String(raw.drainageStatus || (blocked ? 'Debris blocking a drain grate' : 'No blockage visible')).slice(0, 80),
      blocked,
      confidence: clamp(raw.confidence, 0, 1, 0.7),
    },
  }
}

/**
 * @param {{ key: string, image: string, mimeType: string, deadlineMs?: number }} input image: base64, no data: prefix
 * @returns {Promise<{ ok: true, verdict: ReturnType<typeof normalize> } | { ok: false, timedOut: boolean, status?: number, tried: object[] }>}
 */
export async function checkPhoto({ key, image, mimeType, deadlineMs = DEADLINE_MS }) {
  // Try models in order; a missing, overloaded or slow model hands over to the next one.
  const models = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean))]
  const started = Date.now()
  // What happened with each model, returned on failure so a problem can be diagnosed (never the key).
  const tried = []
  let last = null
  for (const model of models) {
    // Newer models think before answering; low effort keeps a photo check to a few seconds.
    let thinking = true
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadlineMs - (Date.now() - started)
      if (remaining < 3000) break
      const t0 = Date.now()
      let upstream
      try {
        upstream = await callGemini(key, model, mimeType, image, thinking, Math.min(PER_MODEL_MS, remaining))
      } catch (error) {
        tried.push({ model, result: error?.name === 'TimeoutError' ? 'timeout' : 'network', ms: Date.now() - t0 })
        break // slow or unreachable: next model
      }
      tried.push({ model, thinking, result: upstream.status, ms: Date.now() - t0 })
      if (upstream.ok) {
        try {
          const json = await upstream.json()
          const text = (json.candidates?.[0]?.content?.parts ?? []).find((p) => typeof p.text === 'string' && !p.thought)?.text
          if (text) return { ok: true, verdict: normalize(JSON.parse(text)) }
          last = 'empty'
        } catch {
          last = 'bad_json'
        }
        break
      }
      last = upstream.status
      if (upstream.status === 400 && thinking) {
        thinking = false // this model does not take the thinking setting: ask again without it
        continue
      }
      if (upstream.status === 503 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800)) // briefly overloaded: one quick retry
        continue
      }
      break
    }
    // Key or quota problems will not be fixed by another model.
    if (last === 401 || last === 403 || last === 429) break
  }
  const timedOut = tried.length > 0 && tried.every((t) => t.result === 'timeout')
  return { ok: false, timedOut, status: typeof last === 'number' ? last : undefined, tried }
}

function callGemini(key, model, mimeType, image, thinking, timeoutMs) {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 }
  if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' }
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: image } }, { text: PROMPT }] }],
      generationConfig,
    }),
    signal: AbortSignal.timeout(Math.min(40_000, timeoutMs)),
  })
}
