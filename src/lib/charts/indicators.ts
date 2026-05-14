/**
 * Technical indicator calculation functions.
 * Extracted from inline JS (lines 2624-2850).
 * Pure functions — no DOM or state dependencies.
 */

export interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export function calcEMA(data: Bar[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  let ema: number | null = null
  const out: (number | null)[] = []
  for (const b of data) {
    ema = ema === null ? b.close : b.close * k + ema * (1 - k)
    out.push(ema)
  }
  return out
}

export function calcSMA(data: Bar[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close
    if (i >= period) sum -= data[i - period].close
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

export function calcBollinger(data: Bar[], period: number, mult: number) {
  const sma = calcSMA(data, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) { upper.push(null); lower.push(null); continue }
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) sumSq += (data[j].close - sma[i]!) * (data[j].close - sma[i]!)
    const std = Math.sqrt(sumSq / period)
    upper.push(sma[i]! + std * mult)
    lower.push(sma[i]! - std * mult)
  }
  return { upper, middle: sma, lower }
}

export function calcVolSMA(data: Bar[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].volume || 0
    if (i >= period) sum -= (data[i - period].volume || 0)
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

export function calcVWAP(data: Bar[], intraday: boolean): number[] {
  const out: number[] = []
  let cumPV = 0, cumV = 0, lastDay: string | null = null
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    const day = intraday ? new Date(b.time * 1000).toISOString().slice(0, 10) : null
    if (intraday && day !== lastDay) { cumPV = 0; cumV = 0; lastDay = day }
    const tp = (b.high + b.low + b.close) / 3
    cumPV += tp * (b.volume || 0)
    cumV += (b.volume || 0)
    out.push(cumV > 0 ? cumPV / cumV : tp)
  }
  return out
}

export function calcATR(data: Bar[], period = 14): number[] {
  let atr: number | null = null
  const out: number[] = []
  for (let i = 0; i < data.length; i++) {
    const hi = data[i].high, lo = data[i].low
    const pc = i > 0 ? data[i - 1].close : data[i].open
    const tr = Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc))
    atr = atr === null ? tr : (atr * (period - 1) + tr) / period
    out.push(atr)
  }
  return out
}

export function calcATRSMA(data: Bar[], period = 14): (number | null)[] {
  const trs: number[] = []
  for (let i = 0; i < data.length; i++) {
    const hi = data[i].high, lo = data[i].low
    const pc = i > 0 ? data[i - 1].close : data[i].open
    trs.push(Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc)))
  }
  const out: (number | null)[] = []
  for (let i = 0; i < trs.length; i++) {
    if (i < period - 1) { out.push(null); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += trs[j]
    out.push(sum / period)
  }
  return out
}
