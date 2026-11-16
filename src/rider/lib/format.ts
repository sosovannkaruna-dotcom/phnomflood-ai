import type { Key } from '../../i18n'

type T = (key: Key, vars?: Record<string, string | number>) => string

/** "likely clear in ~40 min" / "~1.5 h" / "clearing now", from minutes left. */
export function drainText(t: T, minutes: number): string {
  if (minutes <= 5) return t('drain.now')
  if (minutes < 60) return t('drain.min', { n: minutes })
  return t('drain.hour', { n: Math.round(minutes / 30) / 2 })
}

/** "4 min ago" style age of a timestamp. */
export function agoText(t: T, timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000))
  return minutes < 1 ? t('ago.now') : minutes < 60 ? t('ago.min', { n: minutes }) : t('ago.hour', { n: Math.round(minutes / 60) })
}
