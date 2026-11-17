// GET /api/briefing?lang=en|km  (Vercel serverless function): a short AI summary of the city's
// flooding right now, written by Gemini from the live reports and the rain forecast only.
//
// Reply: { headline, summary, areas: [{ name, note }], advice, ai, model, lang,
//          basedOn: { reports, verified, rainNow, next3h }, generatedAt }
// With no reports there is nothing for the model to summarise, so the reply is written here
// (ai: false) and never invented. Answers are cached for a few minutes per language.

import { fetchReports, reportsConfigured } from './_lib/reports.js'
import { generateJson } from './_lib/gemini.js'
import { fetchRain } from './_lib/rain.js'

const HEAVY = 7.6
const TTL_MS = 3 * 60 * 1000
const cache = new Map()

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING', description: 'At most 10 words: the one thing a rider must know right now.' },
    summary: { type: 'STRING', description: 'Two or three short sentences, at most 55 words.' },
    areas: {
      type: 'ARRAY',
      description: 'Up to 3 worst-hit areas, worst first, named exactly as in the data.',
      items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, note: { type: 'STRING', description: 'At most 8 words.' } }, required: ['name', 'note'] },
    },
    advice: { type: 'STRING', description: 'One short sentence of practical advice for riders.' },
  },
  required: ['headline', 'summary', 'areas', 'advice'],
}


/** Written here, without the model, when no water is reported. */
function quietBriefing(lang, rain) {
  const heavySoon = rain && (rain.rainNow >= HEAVY || rain.next3h >= HEAVY * 2)
  if (lang === 'km') {
    return {
      headline: heavySoon ? 'មិនទាន់មានទឹកលិច ប៉ុន្តែភ្លៀងខ្លាំងនឹងមកដល់' : 'គ្មានរបាយការណ៍ទឹកលិចក្នុង ២៤ ម៉ោងចុងក្រោយ',
      summary: heavySoon
        ? `អ្នកជិះមិនទាន់រាយការណ៍ទឹកលិចទេ។ រំពឹងថានឹងមានភ្លៀង ${rain.next3h} មម ក្នុង ៣ ម៉ោងខាងមុខ ដូច្នេះផ្លូវទាបអាចលិចឆាប់ៗ។`
        : 'អ្នកជិះមិនទាន់រាយការណ៍ទឹកលិចនៅភ្នំពេញក្នុង ២៤ ម៉ោងចុងក្រោយនេះទេ។',
      areas: [],
      advice: 'ឃើញទឹកលិចមែនទេ? រាយការណ៍ក្នុងការចុចពីរដង ដើម្បីជួយអ្នកជិះផ្សេងទៀត។',
    }
  }
  return {
    headline: heavySoon ? 'No flooding yet, but heavy rain is coming' : 'No floods reported in the last 24 hours',
    summary: heavySoon
      ? `Riders have not reported any water yet. ${rain.next3h} mm of rain is forecast over the next three hours, so low streets may flood soon.`
      : 'Riders have not reported any flooding in Phnom Penh in the last 24 hours.',
    areas: [],
    advice: 'See water? Report it in two taps so other riders can avoid it.',
  }
}

function promptFor(lang, reports, rain) {
  const data = reports.slice(0, 80).map((r) => ({
    place: r.place,
    sangkat: r.sangkat,
    khan: r.khan,
    depth: r.depth,
    depth_cm: r.depth_cm,
    photo_verified: r.depth_source === 'photo_ai',
    confirmations: r.confirmations,
    minutes_ago: Math.round((Date.now() - Date.parse(r.reported_at)) / 60000),
  }))
  return `You write the live flood briefing for PhnomFlood, a navigation app for motorbike riders in Phnom Penh.
Write it in ${lang === 'km' ? 'Khmer (ភាសាខ្មែរ), keeping place names as they appear in the data' : 'plain English'}.
Use ONLY the data below. Do not invent places, depths, numbers, causes or forecasts.
Name areas exactly as given (khan or sangkat, or the place when those are empty). Group nearby reports by khan.
Depths: ankle about 10 cm (motorbikes slow down), knee about 25 cm (motorbikes and tuk-tuks should avoid), waist about 40 cm (nothing should pass).
Reports are from riders and are estimates; photo-verified reports and confirmations make one more reliable; older reports may have drained.
Be calm, direct and short. No greetings, no emoji, no markdown.

Rain (Open-Meteo): ${rain ? `${rain.rainNow} mm/h now, ${rain.next3h} mm expected over the next 3 hours (heavy is 7.6 mm/h or more)` : 'unavailable'}.
Active flood reports from the last 24 hours (${data.length}):
${JSON.stringify(data)}`
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!reportsConfigured) return res.status(503).json({ error: 'not_configured' })
  const lang = new URL(req.url ?? '/', 'http://local').searchParams.get('lang') === 'km' ? 'km' : 'en'

  let reports
  try {
    reports = await fetchReports({ hours: 24 })
  } catch {
    return res.status(502).json({ error: 'upstream' })
  }
  const rain = await fetchRain()
  const basedOn = { reports: reports.length, verified: reports.filter((r) => r.depth_source === 'photo_ai').length, rainNow: rain?.rainNow ?? null, next3h: rain?.next3h ?? null }

  // Same reports, same rain, same language: reuse the last briefing for a few minutes.
  const fingerprint = `${lang}|${reports.map((r) => `${r.id}:${r.updated_at}`).join(',')}|${rain ? `${Math.round(rain.rainNow)}:${Math.round(rain.next3h)}` : '-'}`
  const hit = cache.get(lang)
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
  if (hit && hit.fingerprint === fingerprint && Date.now() - hit.at < TTL_MS) return res.status(200).json(hit.body)

  let body
  const key = process.env.GEMINI_API_KEY
  if (!reports.length) {
    body = { ...quietBriefing(lang, rain), ai: false, model: null }
  } else if (!key) {
    return res.status(503).json({ error: 'ai_not_configured', basedOn })
  } else {
    const out = await generateJson({ key, prompt: promptFor(lang, reports, rain), schema: SCHEMA })
    if (!out.ok) return res.status(502).json({ error: 'ai_unavailable', status: out.status, tried: out.tried, basedOn })
    body = {
      headline: clean(out.data.headline, 120),
      summary: clean(out.data.summary, 500),
      areas: (Array.isArray(out.data.areas) ? out.data.areas : []).slice(0, 3).map((a) => ({ name: clean(a?.name, 60), note: clean(a?.note, 80) })).filter((a) => a.name),
      advice: clean(out.data.advice, 200),
      ai: true,
      model: out.model,
    }
  }
  body = { ...body, lang, basedOn, generatedAt: new Date().toISOString() }
  cache.set(lang, { fingerprint, at: Date.now(), body })
  return res.status(200).json(body)
}
