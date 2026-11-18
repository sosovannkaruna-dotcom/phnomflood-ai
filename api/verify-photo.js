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

import { checkPhoto, normalize } from './_lib/photoCheck.js'

export { normalize }

const MAX_BASE64 = 4_000_000 // about 3 MB of image
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 30 // checks per IP per window (best effort: memory resets with each cold start)
const hits = new Map()

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

  const result = await checkPhoto({ key, image, mimeType })
  if (result.ok) return res.status(200).json(result.verdict)
  return res.status(result.timedOut ? 504 : 502).json({ error: result.timedOut ? 'timeout' : 'upstream', status: result.status, tried: result.tried })
}
