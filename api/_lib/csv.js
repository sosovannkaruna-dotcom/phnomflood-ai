// CSV for the open data endpoints. The byte-order mark lets spreadsheet apps read Khmer correctly.

export const FIELDS = ['id', 'status', 'depth', 'depth_cm', 'depth_source', 'drain_blocked', 'place', 'area', 'sangkat', 'khan', 'lat', 'lng', 'confirmations', 'confidence', 'confidence_score', 'confidence_reasons', 'reported_at', 'updated_at', 'cleared_at']

// History rows are past reports: confidence is a judgement about now, so it is left out there.
export const HISTORY_FIELDS = FIELDS.filter((f) => !f.startsWith('confidence'))

const cell = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, fields = FIELDS) {
  return `﻿${[fields.join(','), ...rows.map((r) => fields.map((f) => cell(r[f])).join(','))].join('\r\n')}\r\n`
}

export function sendCsv(res, rows, name, fields = FIELDS) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${stamp}.csv"`)
  return res.status(200).send(toCsv(rows, fields))
}
