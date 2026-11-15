// POST /api/verify-photo  (Vercel serverless function)
//
// Body: { image: <base64 JPEG/PNG/WebP, no data: prefix>, mimeType }
// Reply: { isFlood, reason, depth, depthCm, cue, reference: { object, submersionPct, debris },
//          drainage: { status, blocked, confidence } }
//
// Needs GEMINI_API_KEY in the Vercel project's environment variables (never a VITE_ variable,
// so the key stays on the server). GEMINI_MODEL is optional. Without a key it answers 503
// and the app files the report as unverified. If the configured model has been retired (404),
// it falls back to the current stable Flash model, then to Google's always-current alias.

const MAX_BASE64 = 4_000_000 // about 3 MB of image
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 30 // checks per IP per window (best effort: memory resets with each cold start)
const hits = new Map()

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
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest']
// Whole request budget, under the 60 s limit set for this function in vercel.json.
const DEADLINE_MS = 55_000

function rateLimited(ip) {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > LIMIT
}

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'not_configured' })

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const { image, mimeType = 'image/jpeg' } = body
  if (typeof image !== 'string' || !image || image.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200)))
    return res.status(400).json({ error: 'bad_image' })
  if (!ALLOWED.has(mimeType)) return res.status(400).json({ error: 'bad_type' })

  const models = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean))]
  const started = Date.now()
  try {
    let upstream = null
    for (const model of models) {
      // Newer models think before answering; low effort keeps a photo check to a few seconds.
      let thinking = true
      for (let attempt = 0; attempt < 3; attempt++) {
        const remaining = DEADLINE_MS - (Date.now() - started)
        if (remaining < 3000) break
        upstream = await callGemini(key, model, mimeType, image, thinking, remaining)
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
      if (!upstream || upstream.status !== 404) break // only a missing model moves on to the next one
    }
    if (!upstream) return res.status(504).json({ error: 'timeout' })
    if (!upstream.ok) return res.status(502).json({ error: 'upstream', status: upstream.status })
    const json = await upstream.json()
    const text = (json.candidates?.[0]?.content?.parts ?? []).find((p) => typeof p.text === 'string' && !p.thought)?.text
    if (!text) return res.status(502).json({ error: 'empty' })
    return res.status(200).json(normalize(JSON.parse(text)))
  } catch (error) {
    return res.status(error?.name === 'TimeoutError' ? 504 : 502).json({ error: error?.name === 'TimeoutError' ? 'timeout' : 'upstream' })
  }
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
