// Structured (JSON) text generation with Gemini, shared by server functions.
// Tries the configured model, then Google's current aliases; a missing, overloaded or slow model
// hands over to the next one. Never returns or logs the key.

const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest']

/**
 * @param {{ key: string, prompt: string, schema: object, deadlineMs?: number, perModelMs?: number, temperature?: number }} options
 * @returns {Promise<{ ok: true, data: any, model: string } | { ok: false, status: number|string, tried: object[] }>}
 */
export async function generateJson({ key, prompt, schema, deadlineMs = 25_000, perModelMs = 12_000, temperature = 0.3 }) {
  const models = [...new Set([process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean))]
  const started = Date.now()
  const tried = []
  let last = null
  for (const model of models) {
    let thinking = true
    for (let attempt = 0; attempt < 3; attempt++) {
      const remaining = deadlineMs - (Date.now() - started)
      if (remaining < 2500) return { ok: false, status: 'timeout', tried }
      const t0 = Date.now()
      let res
      try {
        const generationConfig = { responseMimeType: 'application/json', responseSchema: schema, temperature }
        if (thinking) generationConfig.thinkingConfig = { thinkingLevel: 'low' }
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
          signal: AbortSignal.timeout(Math.min(perModelMs, remaining)),
        })
      } catch (error) {
        tried.push({ model, result: error?.name === 'TimeoutError' ? 'timeout' : 'network', ms: Date.now() - t0 })
        break
      }
      tried.push({ model, thinking, result: res.status, ms: Date.now() - t0 })
      if (res.ok) {
        try {
          const json = await res.json()
          const text = (json.candidates?.[0]?.content?.parts ?? []).find((p) => typeof p.text === 'string' && !p.thought)?.text
          if (text) return { ok: true, data: JSON.parse(text), model }
          last = 'empty'
        } catch {
          last = 'bad_json'
        }
        break
      }
      last = res.status
      if (res.status === 400 && thinking) {
        thinking = false // this model does not take the thinking setting
        continue
      }
      if (res.status === 503 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 800))
        continue
      }
      break
    }
    // Key or quota problems will not be fixed by another model.
    if (last === 401 || last === 403 || last === 429) break
  }
  return { ok: false, status: last ?? 'unknown', tried }
}
