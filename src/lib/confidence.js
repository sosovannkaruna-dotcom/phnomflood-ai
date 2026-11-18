// How much to trust a flood report right now: high, medium or low, with the reasons.
//
// Shared by the app (flood card, nearby list) and the open data feed (/api/reports), so a report
// reads the same everywhere. Plain JavaScript on purpose: the serverless functions import it too.
//
// Transparent rules, not a model. A single fresh report starts in the middle; a photo check that
// agrees with the depth, or other riders confirming it, raise it; time past the usual drain time
// lowers it; rain still falling keeps water plausible. There are no accounts, so a reporter's past
// accuracy is not used.

/** Typical depth for each reported class, in cm (the same values as DEPTHS in severity.js). */
export const DEPTH_CM = { ankle: 10, knee: 25, waist: 40 }
const RANK = { ankle: 1, knee: 2, waist: 3 }
const rankOfCm = (cm) => (cm >= 40 ? 3 : cm >= 25 ? 2 : cm >= 10 ? 1 : 0)

/**
 * Minutes a street flood of `cm` usually takes to drain: one to a few hours in Phnom Penh,
 * slower while it keeps raining. An estimate, not a measurement.
 * @param {number} cm
 * @param {number} [rainNow] mm/h
 */
export function drainMinutes(cm, rainNow = 0) {
  const rainFactor = rainNow >= 7.6 ? 1.6 : rainNow > 0 ? 1.2 : 1
  return cm * 3.5 * rainFactor
}

/**
 * @typedef {'high' | 'medium' | 'low'} ConfidenceLevel
 * @typedef {'photo_agrees' | 'photo_close' | 'photo_disagrees' | 'photo_dry' | 'confirmed' | 'recent' | 'may_have_drained' | 'likely_drained' | 'raining' | 'trusted_reporter'} ConfidenceReason
 * @typedef {'new' | 'regular' | 'trusted'} TrustLevel
 */

/**
 * A reporter's standing (set by the database from that phone's past reports, see
 * supabase/schema.sql): a trusted reporter's water is believed a little longer.
 */
const TRUST_HOLD = { new: 1, regular: 1, trusted: 1.25 }

/**
 * When a rider last saw the water: the report itself, or a later "still there" confirmation.
 * @param {{ createdAt: number, updatedAt?: string | null, confirmations?: number }} report
 */
export function lastSeenOf(report) {
  const updated = report.confirmations && report.updatedAt ? Date.parse(report.updatedAt) || 0 : 0
  return Math.max(report.createdAt, updated)
}

/** The app's report shape → confidence() input. */
export function confidenceInput(report, rainNow = 0, now = Date.now()) {
  const aiCm = report.ai?.depthCm
  return {
    depth: report.depth,
    aiCm: typeof aiCm === 'number' ? aiCm : null,
    confirmations: report.confirmations ?? 0,
    reportedAt: report.createdAt,
    lastSeenAt: lastSeenOf(report),
    rainNow,
    now,
    trust: report.trust ?? null,
  }
}

const DEPTH_OF_RANK = ['clear', 'ankle', 'knee', 'waist']

/**
 * How deep a report counts for routing right now. Water drains as pumps and drains catch up, so a
 * report nobody has confirmed loses weight with time: at full depth until its usual drain time
 * (drainMinutes; a trusted reporter's a quarter longer), one step shallower until twice that, then
 * not at all. A "still there" confirmation starts the clock again.
 * @returns {'ankle' | 'knee' | 'waist' | null} null: likely drained, no longer routed around
 */
export function routingDepth(report, rainNow = 0, now = Date.now()) {
  const rank = RANK[report.depth] ?? 0
  if (!rank) return null
  const aiCm = report.ai?.depthCm
  const cm = typeof aiCm === 'number' && aiCm > 0 ? aiCm : DEPTH_CM[report.depth]
  const hold = drainMinutes(cm, rainNow) * (TRUST_HOLD[report.trust] ?? 1)
  const age = (now - lastSeenOf(report)) / 60000
  if (age <= hold) return report.depth
  if (age <= hold * 2) return /** @type {'ankle' | 'knee' | 'waist' | null} */ (DEPTH_OF_RANK[rank - 1] === 'clear' ? null : DEPTH_OF_RANK[rank - 1])
  return null
}

/**
 * @param {{ depth: 'ankle' | 'knee' | 'waist', aiCm?: number | null, confirmations?: number, reportedAt: number, lastSeenAt?: number | null, rainNow?: number, now?: number, trust?: TrustLevel | null }} r
 *   lastSeenAt: the last time a rider confirmed it (the report's updated time), if later than reportedAt.
 * @returns {{ level: ConfidenceLevel, score: number, reasons: ConfidenceReason[] }}
 */
export function confidence(r) {
  const now = r.now ?? Date.now()
  const rain = r.rainNow ?? 0
  /** @type {ConfidenceReason[]} */
  const reasons = []
  let score = 0.5

  // The photo check: does the water in the picture match the depth the rider chose?
  if (typeof r.aiCm === 'number') {
    if (r.aiCm <= 0) {
      score -= 0.3
      reasons.push('photo_dry')
    } else {
      const gap = Math.abs(rankOfCm(r.aiCm) - (RANK[r.depth] ?? 1))
      if (gap === 0) {
        score += 0.25
        reasons.push('photo_agrees')
      } else if (gap === 1) {
        score += 0.1
        reasons.push('photo_close')
      } else {
        score -= 0.2
        reasons.push('photo_disagrees')
      }
    }
  }

  // Other riders who passed and said the water is still there.
  const confirmations = r.confirmations ?? 0
  if (confirmations > 0) {
    score += Math.min(0.3, 0.15 * confirmations)
    reasons.push('confirmed')
  }

  // A phone whose past reports other riders confirmed.
  if (r.trust === 'trusted') {
    score += 0.1
    reasons.push('trusted_reporter')
  }

  // Time since anyone last saw it, against how long water that deep usually takes to drain.
  const seen = Math.max(r.reportedAt, r.lastSeenAt ?? 0)
  const age = (now - seen) / 60000
  const cm = typeof r.aiCm === 'number' && r.aiCm > 0 ? r.aiCm : DEPTH_CM[r.depth] ?? 10
  const drain = drainMinutes(cm, rain) * (TRUST_HOLD[r.trust] ?? 1)
  if (age > drain * 2) {
    score -= 0.35
    reasons.push('likely_drained')
  } else if (age > drain) {
    score -= 0.2
    reasons.push('may_have_drained')
  } else if (age < 30) {
    score += 0.05
    reasons.push('recent')
  }

  if (rain >= 2) {
    score += 0.1
    reasons.push('raining')
  }

  score = Math.round(Math.min(1, Math.max(0, score)) * 100) / 100
  return { level: score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low', score, reasons }
}
