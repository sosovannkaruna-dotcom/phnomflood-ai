// POST /api/telegram-webhook  (Vercel serverless function): the PhnomFlood Telegram bot.
//
// Riders in Phnom Penh live on Telegram, so they can report water without opening the app:
//   1. Share a location (📎 → Location). The bot answers with the point, as a message to reply to.
//   2. Reply to that message with a photo of the water, within 15 minutes.
//   3. The same Gemini photo check as the app decides whether it is a flooded street and how deep.
//      A flood goes straight onto the live map and the open data feed with source "telegram";
//      anything else is turned down and nothing is filed.
// Telegram cannot send a photo and a location in one message; the bot's reply carries the point,
// so no state is kept between messages.
//
// Set up (see scripts/telegram-setup.mjs): TELEGRAM_BOT_TOKEN (from @BotFather) and
// TELEGRAM_WEBHOOK_SECRET (any long random string) in Vercel, then register the webhook.
// Also uses GEMINI_API_KEY and the Supabase URL and anon key the rest of the API uses.
//
// Safety: Telegram's secret header is checked on every call; each report's id is made from the
// chat and message ids, so a retried update can never file a second report; the Telegram user id
// is never stored (only a keyed hash, for rider trust, which the database hashes again); photos
// are checked and dropped, never kept.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { checkPhoto } from './_lib/photoCheck.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const SUPABASE = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
const SITE = 'https://phnomflood-ai.vercel.app/#/live'

/** A shared location is good for this long: the photo must follow within it. */
const LOCATION_MS = 15 * 60 * 1000
const MAX_PHOTO_BYTES = 3_000_000
const LIMIT = 8 // reports per chat per window (best effort: memory resets with each cold start)
const WINDOW_MS = 10 * 60 * 1000
const hits = new Map()
// Greater Phnom Penh, the box the database accepts.
const inCity = (lat, lng) => lat > 11.3 && lat < 11.8 && lng > 104.7 && lng < 105.1
const PIN = /📍 (-?\d+\.\d{5}), (-?\d+\.\d{5})/

const DEPTH_WORDS = { ankle: 'ankle-deep', knee: 'knee-deep', waist: 'waist-deep' }
const DEPTH_KM = { ankle: 'ជម្រៅត្រឹមកជើង', knee: 'ជម្រៅត្រឹមជង្គង់', waist: 'ជម្រៅត្រឹមចង្កេះ' }

const TEXT = {
  start:
    'PhnomFlood flood reports\n\n1. Share your location: 📎 → Location.\n2. Reply to my answer with a photo of the water.\n\nA photo check reads the depth, and the report goes on the live map for every rider.\n\n' +
    'របាយការណ៍ទឹកជំនន់ PhnomFlood\n\n១. ចែករំលែកទីតាំង៖ 📎 → Location។\n២. ឆ្លើយតបសាររបស់ខ្ញុំ ដោយផ្ញើរូបថតទឹក។',
  outside: 'That location is outside Phnom Penh. Reports are for Phnom Penh streets only.\nទីតាំងនេះនៅក្រៅភ្នំពេញ។',
  pinned: (lat, lng) =>
    `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}\nGot your location. Now reply to this message with a photo of the water (within 15 minutes).\nសូមឆ្លើយតបសារនេះ ដោយផ្ញើរូបថតទឹក (ក្នុងរយៈពេល ១៥ នាទី)។`,
  needLocation: 'First share your location (📎 → Location), then reply to my answer with the photo.\nសូមចែករំលែកទីតាំងជាមុនសិន រួចឆ្លើយតបដោយរូបថត។',
  stale: 'That location is more than 15 minutes old. Please share your location again.\nទីតាំងនោះចាស់ជាង ១៥ នាទី។ សូមចែករំលែកម្ដងទៀត។',
  busy: 'Too many reports from this chat just now. Please try again in a few minutes.',
  notFlood: (reason) => `The photo check did not see a flooded street${reason ? ` (${reason})` : ''}, so nothing was added.\nការត្រួតពិនិត្យរូបថតមិនឃើញផ្លូវលិចទឹកទេ។`,
  failed: 'The photo check is not available right now, so nothing was added. Please try again in a few minutes.',
  saveFailed: 'The photo shows flooding, but the map could not save it just now. Please send the photo again in a few minutes.',
  added: (depth, cm, place) =>
    `✅ Added to the live map: ${DEPTH_WORDS[depth]} (~${cm} cm) at ${place}. Riders are now routed around it. Thank you!\n` +
    `✅ បានដាក់លើផែនទី៖ ${DEPTH_KM[depth]} (~${cm} ស.ម) នៅ ${place}។ សូមអរគុណ!\n${SITE}`,
}

function rateLimited(chat) {
  const now = Date.now()
  const entry = hits.get(chat)
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(chat, { start: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > LIMIT
}

function sameSecret(given) {
  if (typeof given !== 'string' || !SECRET) return false
  const a = Buffer.from(given)
  const b = Buffer.from(SECRET)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`telegram ${method} ${res.status}`)
  return (await res.json()).result
}

const reply = (message, text, extra = {}) =>
  telegram('sendMessage', { chat_id: message.chat.id, text, reply_parameters: { message_id: message.message_id }, disable_web_page_preview: true, ...extra }).catch(() => null)

/** The largest version of the photo under the size limit, as base64. */
async function downloadPhoto(sizes) {
  const pick = [...sizes].reverse().find((p) => !p.file_size || p.file_size <= MAX_PHOTO_BYTES) ?? sizes[0]
  const file = await telegram('getFile', { file_id: pick.file_id })
  const res = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`photo ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('photo too large')
  return bytes.toString('base64')
}

/** Street, sangkat and khan for the point (OpenStreetMap), or a plain fallback. */
async function placeName(lat, lng) {
  try {
    const params = new URLSearchParams({ format: 'jsonv2', zoom: '17', addressdetails: '1', lat: String(lat), lon: String(lng), 'accept-language': 'en' })
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { 'User-Agent': 'PhnomFlood flood report bot' }, signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const a = (await res.json()).address ?? {}
      const strip = (s) => (s ?? '').replace(/^(Khan|Sangkat)\s+/i, '')
      const name = a.road ?? a.neighbourhood ?? a.suburb
      if (name) return { name, area: a.suburb ?? a.neighbourhood ?? name, sangkat: strip(a.quarter ?? a.village ?? a.suburb), khan: strip(a.city_district ?? a.town ?? a.county) }
    }
  } catch {
    // Fall through to the plain name.
  }
  return { name: 'Reported location', area: 'Phnom Penh', sangkat: '', khan: '' }
}

/** File the report; a retried update finds its id already there (409) and counts as done. */
async function insertReport(row) {
  const post = (body) =>
    fetch(`${SUPABASE}/rest/v1/flood_reports`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    })
  let res = await post(row)
  // A database without the rider-trust update: no device_id column yet.
  if (res.status === 400) {
    const { device_id, ...plain } = row
    res = await post(plain)
  }
  if (res.ok || res.status === 409) return
  throw new Error(`supabase ${res.status}`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!TOKEN || !SECRET) return res.status(503).json({ error: 'not_configured' })
  if (!sameSecret(req.headers['x-telegram-bot-api-secret-token'])) return res.status(401).json({ error: 'unauthorized' })

  const update = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}
  const message = update.message
  // Anything else (edits, joins, other update types): acknowledged, nothing to do.
  if (!message?.chat?.id) return res.status(200).json({ ok: true })

  try {
    await handle(message)
  } catch (error) {
    console.error('telegram-webhook', error?.message)
  }
  // Always 200 once authenticated: Telegram retries anything else, and a retry must not repeat work.
  return res.status(200).json({ ok: true })
}

async function handle(message) {
  const text = message.text ?? ''
  if (/^\/(start|help)\b/.test(text)) return reply(message, TEXT.start)

  if (message.location) {
    const { latitude: lat, longitude: lng } = message.location
    if (!inCity(lat, lng)) return reply(message, TEXT.outside)
    return reply(message, TEXT.pinned(lat, lng), { reply_markup: { force_reply: true, input_field_placeholder: 'Photo of the water' } })
  }

  if (!message.photo?.length) return reply(message, TEXT.needLocation)

  // The photo answers the bot's location message: the point is in that message's text.
  const pinned = message.reply_to_message
  const match = pinned?.from?.is_bot && typeof pinned.text === 'string' ? pinned.text.match(PIN) : null
  if (!match) return reply(message, TEXT.needLocation)
  if ((message.date - pinned.date) * 1000 > LOCATION_MS) return reply(message, TEXT.stale)
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!inCity(lat, lng)) return reply(message, TEXT.outside)
  if (rateLimited(message.chat.id)) return reply(message, TEXT.busy)

  const key = process.env.GEMINI_API_KEY
  if (!key || !SUPABASE || !ANON) return reply(message, TEXT.failed)
  void telegram('sendChatAction', { chat_id: message.chat.id, action: 'typing' }).catch(() => null)

  const image = await downloadPhoto(message.photo)
  const check = await checkPhoto({ key, image, mimeType: 'image/jpeg', deadlineMs: 40_000 })
  if (!check.ok) return reply(message, TEXT.failed)
  const verdict = check.verdict
  if (!verdict.isFlood) return reply(message, TEXT.notFlood(verdict.reason))

  const place = await placeName(lat, lng)
  // Rider trust without storing who it is: a keyed hash of the Telegram user, hashed again by the database.
  const device = message.from?.id ? createHmac('sha256', SECRET).update(`telegram:${message.from.id}`).digest('hex').slice(0, 40) : null
  try {
    await insertReport({
    id: `tg-${message.chat.id}-${message.message_id}`.slice(0, 64),
    name: place.name.slice(0, 120),
    area: place.area.slice(0, 120),
    khan: place.khan.slice(0, 80),
    sangkat: place.sangkat.slice(0, 80),
    lat,
    lng,
    depth: verdict.depth,
    source: 'telegram',
    ai: { depthCm: verdict.depthCm, drainage: verdict.drainage },
    ...(device ? { device_id: device } : {}),
    })
  } catch (error) {
    console.error('telegram-webhook insert', error?.message)
    return reply(message, TEXT.saveFailed)
  }
  return reply(message, TEXT.added(verdict.depth, verdict.depthCm, place.name))
}
