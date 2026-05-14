/**
 * Chart formatting helpers.
 * Extracted from inline JS (lines 2579-2640).
 * Pure functions — no DOM or state dependencies.
 */

const _nyFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
})

export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return ''
  return v >= 10000 ? v.toFixed(0) : v.toFixed(2)
}

export function fmtVol(v: number | null | undefined): string {
  if (v == null || v === 0) return '—'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}

export function fmtPnl(v: number): string {
  if (v == null) return '—'
  const s = v >= 0 ? '+' : ''
  return s + fmtPrice(v)
}

export interface NYTime {
  year: number; month: number; day: number; hour: number; minute: number
}

export function getNY(ts: number): NYTime {
  if (typeof ts !== 'number') return { year: 0, month: 0, day: 0, hour: 0, minute: 0 }
  const p: Record<string, number> = {}
  for (const { type, value } of _nyFmt.formatToParts(new Date(ts * 1000))) {
    p[type] = parseInt(value, 10)
  }
  if (p.hour === 24) p.hour = 0
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute }
}

export function nyMins(ts: number): number {
  const { hour, minute } = getNY(ts)
  return hour * 60 + minute
}

export function isIntraday(tf: string): boolean {
  return ['1m','5m','15m','30m','60m'].includes(tf)
}

export function fmtTimeAxis(ts: number | string, tf: string): string {
  if (!isIntraday(tf)) {
    const [y, m, d] = String(ts).split('-')
    return `${m}/${d}/${y.slice(2)}`
  }
  const { hour, minute } = getNY(ts as number)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function fmtTimeCross(ts: number | string, tf: string): string {
  if (!isIntraday(tf)) {
    const [y, m, d] = String(ts).split('-')
    return `${m}/${d}/${y}`
  }
  const { year, month, day, hour, minute } = getNY(ts as number)
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ET`
}
