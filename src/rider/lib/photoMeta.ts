// Where and when a flood photo was taken, from its EXIF data, and whether that fits the report.
//
// A photo check (Gemini) can only say "this shows a flood about 30 cm deep", not that it shows THIS
// street NOW. So the check counts for a report only when the photo itself backs that up: its GPS
// within PHOTO_NEAR_M of the pin and taken within PHOTO_RECENT_MS, or, with no metadata (phones often
// strip it), a file created moments ago by the camera. Otherwise the report is still filed, as the
// rider's own depth, without the "photo verified" weight.
//
// A minimal reader for JPEG EXIF (TIFF IFD0, Exif and GPS sub-IFDs); everything else returns {}.

import type { LatLng } from '../types'

export const PHOTO_NEAR_M = 300
export const PHOTO_RECENT_MS = 3 * 3600 * 1000
/** A file this new with no metadata was just taken with the camera */
const FRESH_FILE_MS = 15 * 60 * 1000

export interface PhotoMeta {
  lat?: number
  lng?: number
  takenAt?: number
}

export type Provenance =
  | { ok: true; kind: 'here'; metres: number; minutes: number | null }
  | { ok: true; kind: 'fresh' }
  | { ok: true; kind: 'demo' }
  | { ok: false; kind: 'far'; metres: number }
  | { ok: false; kind: 'old'; hours: number }
  | { ok: false; kind: 'unknown' }
  | { ok: false; kind: 'sample' }

export async function readPhotoMeta(file: Blob): Promise<PhotoMeta> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer())
    if (view.getUint16(0) !== 0xffd8) return {}
    let p = 2
    while (p + 4 < view.byteLength) {
      const marker = view.getUint16(p)
      const size = view.getUint16(p + 2)
      if (marker === 0xffe1 && view.getUint32(p + 4) === 0x45786966) return parseTiff(view, p + 10)
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break
      p += 2 + size
    }
  } catch {
    // Unreadable: treated as no metadata.
  }
  return {}
}

function parseTiff(view: DataView, start: number): PhotoMeta {
  const little = view.getUint16(start) === 0x4949
  const u16 = (o: number) => view.getUint16(start + o, little)
  const u32 = (o: number) => view.getUint32(start + o, little)
  const entries = (ifd: number) => {
    const out = new Map<number, { type: number; count: number; at: number }>()
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      const type = u16(e + 2)
      const count = u32(e + 4)
      const bytes = count * ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }[type] ?? 1)
      out.set(u16(e), { type, count, at: bytes <= 4 ? e + 8 : u32(e + 8) })
    }
    return out
  }
  const ascii = (tag?: { count: number; at: number }) => {
    if (!tag) return ''
    let s = ''
    for (let i = 0; i < tag.count - 1; i++) s += String.fromCharCode(view.getUint8(start + tag.at + i))
    return s
  }
  const rational = (o: number) => u32(o) / (u32(o + 4) || 1)
  const degrees = (tag?: { at: number }) => (tag ? rational(tag.at) + rational(tag.at + 8) / 60 + rational(tag.at + 16) / 3600 : NaN)

  const meta: PhotoMeta = {}
  const ifd0 = entries(u32(4))
  const exifPtr = ifd0.get(0x8769)
  const gpsPtr = ifd0.get(0x8825)
  let stamp = ascii(ifd0.get(0x0132))
  let offset = ''
  if (exifPtr) {
    const exif = entries(u32(exifPtr.at))
    stamp = ascii(exif.get(0x9003)) || stamp
    offset = ascii(exif.get(0x9011))
  }
  // "2026:11:18 17:42:05", local time; Phnom Penh (+07:00) when the phone did not record its offset.
  const m = stamp.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${/^[+-]\d{2}:\d{2}$/.test(offset) ? offset : '+07:00'}`)
    if (Number.isFinite(t)) meta.takenAt = t
  }
  if (gpsPtr) {
    const gps = entries(u32(gpsPtr.at))
    const lat = degrees(gps.get(2))
    const lng = degrees(gps.get(4))
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
      meta.lat = ascii(gps.get(1)) === 'S' ? -lat : lat
      meta.lng = ascii(gps.get(3)) === 'W' ? -lng : lng
    }
  }
  return meta
}

const metresBetween = (a: LatLng, b: LatLng) => {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** Does this photo back up a report at `position`, now? */
export function provenance(meta: PhotoMeta, fileModified: number | null, position: LatLng, now = Date.now()): Provenance {
  if (meta.takenAt && now - meta.takenAt > PHOTO_RECENT_MS) return { ok: false, kind: 'old', hours: Math.round((now - meta.takenAt) / 360000) / 10 }
  if (meta.lat !== undefined && meta.lng !== undefined) {
    const metres = Math.round(metresBetween([meta.lat, meta.lng], position))
    if (metres > PHOTO_NEAR_M) return { ok: false, kind: 'far', metres }
    return { ok: true, kind: 'here', metres, minutes: meta.takenAt ? Math.max(0, Math.round((now - meta.takenAt) / 60000)) : null }
  }
  if (meta.takenAt) return { ok: true, kind: 'here', metres: -1, minutes: Math.max(0, Math.round((now - meta.takenAt) / 60000)) }
  if (fileModified && now - fileModified < FRESH_FILE_MS && fileModified <= now + 60000) return { ok: true, kind: 'fresh' }
  return { ok: false, kind: 'unknown' }
}
