// Scripted hydrological analyst.
//
// No language model is called. Each briefing is assembled from the simulated
// telemetry at the selected hour, so the numbers always match the map and the
// inspector. Swap `answer` for a model call later and keep the Block format.

import type { AnalystContext, Block, KhanState, Part } from '../types'
import { KHANS, LEVEL_LABEL, cityMetrics, cityRain, khanState, khanStates, peakHour, riverLevel, sensorStates, RIVER } from './hydrology'

const ALIASES: Record<string, string[]> = {
  'daun-penh': ['daun penh', 'doun penh', 'central market', 'wat phnom', 'riverside'],
  'chamkar-mon': ['chamkar mon', 'chamkarmon', 'boeung trabek'],
  'prampir-makara': ['7 makara', 'prampir makara', 'olympic'],
  'tuol-kork': ['tuol kork', 'toul kork', 'tuol kouk', 'street 289', 'st. 289'],
  'boeung-keng-kang': ['boeung keng kang', 'bkk'],
  'sen-sok': ['sen sok'],
  'russey-keo': ['russey keo', 'russei keo'],
  'chroy-changvar': ['chroy changvar', 'chrouy changvar'],
  'mean-chey': ['mean chey', 'meanchey', 'boeung tompun', 'stung meanchey'],
  'chbar-ampov': ['chbar ampov'],
  'por-senchey': ['por senchey', 'pou senchey', 'airport'],
  dangkao: ['dangkao', 'dangkor'],
  'prek-pnov': ['prek pnov'],
  kamboul: ['kamboul'],
}

const n0 = (v: number) => Math.round(v).toString()
const n1 = (v: number) => v.toFixed(1)
const tag = (id: string): Part => ({ khan: id })
const when = (hour: number) => (Math.abs(hour) < 0.05 ? 'now' : hour > 0 ? `T+${n1(hour)} h` : `T${n1(hour)} h`)

function findKhan(query: string): string | null {
  const q = query.toLowerCase()
  for (const [id, names] of Object.entries(ALIASES)) if (names.some((name) => q.includes(name))) return id
  return null
}

function districtBriefing(id: string, ctx: AnalystContext, pumpFocus: boolean): Block[] {
  const meta = KHANS.find((k) => k.id === id)!
  const now = khanState(meta, ctx.hour)
  const peakAt = peakHour()
  const peak = khanState(meta, Math.max(ctx.hour, peakAt))
  const sensors = sensorStates(ctx.hour).filter((s) => s.khanId === id)
  const hot = sensors.filter((s) => s.level !== 'nominal')
  const pumps = sensors.filter((s) => s.kind === 'pump')
  const reports = ctx.reports.filter((r) => r.depth !== 'clear' && r.khan.toLowerCase() === meta.name.toLowerCase())
  const tickets = ctx.queue.filter((t) => t.status === 'open' && t.khan.toLowerCase() === meta.name.toLowerCase())

  const blocks: Block[] = [
    {
      type: 'p',
      parts: [tag(id), ` is at ${LEVEL_LABEL[now.level].toLowerCase()} runoff risk (${n0(now.risk)}/100) as of ${when(ctx.hour)}. Drains are ${now.drainStatus.toLowerCase()}.`],
    },
    {
      type: 'table',
      head: ['Metric', when(ctx.hour), 'At peak'],
      rows: [
        ['Rainfall', `${n1(now.rain)} mm/h`, `${n1(peak.rain)} mm/h`],
        ['Soil saturation', `${n0(now.saturation)} %`, `${n0(peak.saturation)} %`],
        ['Drain load', `${n0(now.drainLoad)} %`, `${n0(peak.drainLoad)} %`],
        ['Risk score', n0(now.risk), n0(peak.risk)],
      ],
    },
  ]

  const items: Part[][] = []
  if (pumpFocus) {
    if (pumps.length) pumps.forEach((p) => items.push([`${p.name} (${p.id}) is running at ${p.value} % of rated capacity.`]))
    else items.push([`No pumping station is instrumented in this Khan. It drains by gravity to neighbouring basins, so load shows up as drain load (${n0(now.drainLoad)} %).`])
    items.push([peak.drainLoad >= 95 ? `Projected load passes capacity near the squall peak (${n0(peak.drainLoad)} %). Pre-position a mobile pump.` : `Projected peak load is ${n0(peak.drainLoad)} %: within capacity, no extra pumping needed.`])
  }
  hot.forEach((s) => items.push([`${s.name} (${s.id}): ${s.value} ${s.unit}, above its ${s.warn} ${s.unit} warning threshold.`]))
  if (reports.length) items.push([`${reports.length} citizen flood report${reports.length > 1 ? 's' : ''} active here, including ${reports[0].name}.`])
  if (tickets.length) items.push([`${tickets.length} open drain ticket${tickets.length > 1 ? 's' : ''}; highest urgency ${Math.max(...tickets.map((t) => t.urgency))}/100 at ${tickets[0].name}.`])
  if (!items.length) items.push(['No sensors above threshold and no open tickets.'])
  blocks.push({ type: 'list', items })
  return blocks
}

function forecastBriefing(ctx: AnalystContext): Block[] {
  const peakAt = peakHour()
  const horizon = Math.max(ctx.hour, 0) + 6
  const first = khanStates(Math.min(horizon, peakAt + 1)).filter((k) => k.level !== 'nominal').slice(0, 4)
  return [
    {
      type: 'p',
      parts: [`City rainfall peaks at about ${n0(cityRain(peakAt))} mm/h around T+${n1(peakAt)} h, then eases. A weaker cell follows near T+14 h.`],
    },
    {
      type: 'table',
      head: ['Khan', 'Risk at peak', 'Drains'],
      rows: first.map((k) => [tag(k.id), `${n0(k.risk)} · ${LEVEL_LABEL[k.level]}`, k.drainStatus]),
    },
    {
      type: 'list',
      items: [
        ['Low-lying Khans with weak drainage flood first: water has nowhere to go once drains pass capacity.'],
        [`River stage stays below alarm: ${riverLevel(horizon).toFixed(2)} m against ${RIVER.alarm.toFixed(2)} m. This is a rainfall flood, not a river flood.`],
      ],
    },
  ]
}

function alertBriefing(ctx: AnalystContext): Block[] {
  const states = khanStates(ctx.hour)
  const critical = states.filter((k) => k.level === 'critical')
  const sensors = sensorStates(ctx.hour).filter((s) => s.level !== 'nominal')
  const reports = ctx.reports.filter((r) => r.depth === 'knee' || r.depth === 'waist')
  const open = ctx.queue.filter((t) => t.status === 'open').sort((a, b) => b.urgency - a.urgency)
  const items: Part[][] = []
  if (critical.length) {
    const line: Part[] = [`${critical.length} Khan${critical.length > 1 ? 's' : ''} at critical runoff risk: `]
    critical.forEach((k, i) => line.push(tag(k.id), i < critical.length - 1 ? ', ' : '.'))
    items.push(line)
  } else items.push(['No Khan is at critical runoff risk.'])
  items.push([`${sensors.length} telemetry node${sensors.length === 1 ? '' : 's'} above warning threshold.`])
  items.push([`${reports.length} citizen report${reports.length === 1 ? '' : 's'} of knee-deep water or worse.`])
  if (open.length) items.push([`${open.length} open drain tickets. Most urgent: ${open[0].name} (${open[0].urgency}/100).`])
  items.push([`${ctx.ridersRerouted.toLocaleString('en-US')} delivery riders rerouted around flooded segments today.`])
  return [{ type: 'p', parts: [`Active alerts as of ${when(ctx.hour)}:`] }, { type: 'list', items }]
}

function situationBriefing(ctx: AnalystContext): Block[] {
  const city = cityMetrics(ctx.hour)
  const top: KhanState[] = khanStates(ctx.hour).slice(0, 4)
  return [
    {
      type: 'p',
      parts: [`Phnom Penh as of ${when(ctx.hour)}: ${n1(city.rain)} mm/h rainfall, soils ${n0(city.saturation)} % saturated, ${n0(city.drainFree)} % drainage capacity free.`],
    },
    {
      type: 'table',
      head: ['Khan', 'Rain', 'Drain load', 'Risk'],
      rows: top.map((k) => [tag(k.id), `${n1(k.rain)} mm/h`, `${n0(k.drainLoad)} %`, `${n0(k.risk)} · ${LEVEL_LABEL[k.level]}`]),
    },
    { type: 'p', parts: ['Ask about a Khan by name, pump load, the forecast, or active alerts.'] },
  ]
}

/** Route a question to a briefing. Unknown questions get the city situation report. */
export function answer(query: string, ctx: AnalystContext): Block[] {
  const q = query.toLowerCase()
  const khan = findKhan(q) ?? (/(this|here|selected)/.test(q) ? ctx.selectedKhan : null)
  const pump = /pump|load|capacity/.test(q)
  if (khan) return districtBriefing(khan, ctx, pump)
  if (pump && ctx.selectedKhan) return districtBriefing(ctx.selectedKhan, ctx, true)
  if (/forecast|tonight|next|first|peak|hours|squall|when/.test(q)) return forecastBriefing(ctx)
  if (/alert|summar|active|ticket|report|rider/.test(q)) return alertBriefing(ctx)
  return situationBriefing(ctx)
}

/** Two or three suggested questions that follow the current selection. */
export function quickQueries(ctx: AnalystContext): string[] {
  const name = KHANS.find((k) => k.id === ctx.selectedKhan)?.name ?? 'Daun Penh'
  return [`Assess ${name} pump load for tonight's squall`, 'Which Khans flood first in the next 6 hours?', 'Summarise active alerts']
}
