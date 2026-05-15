/**
 * Indicator calculations — pure functions on bar arrays.
 * Extracted from charts-engine.js lines 1151-1230.
 * No global state, no DOM dependencies.
 */

export interface CalcBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Exponential Moving Average */
export function calcEMA(data: CalcBar[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  let ema: number | null = null
  const out: (number | null)[] = []
  for (const b of data) {
    ema = ema === null ? b.close : b.close * k + ema * (1 - k)
    out.push(ema)
  }
  return out
}

/** Simple Moving Average (on close) */
export function calcSMA(data: CalcBar[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close
    if (i >= period) sum -= data[i - period].close
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

/** Average True Range */
export function calcATR(data: CalcBar[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  if (data.length === 0) return out
  out.push(null)
  let sum = 0
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close)
    )
    sum += tr
    if (i < period) {
      out.push(null)
    } else if (i === period) {
      out.push(sum / period)
    } else {
      const prev = out[i - 1]!
      out.push((prev * (period - 1) + tr) / period)
    }
  }
  return out
}

/** Bollinger Bands */
export function calcBollinger(
  data: CalcBar[],
  period: number,
  mult: number
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const sma = calcSMA(data, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) { upper.push(null); lower.push(null); continue }
    let sumSq = 0
    for (let j = i - period + 1; j <= i; j++) {
      sumSq += (data[j].close - sma[i]!) * (data[j].close - sma[i]!)
    }
    const std = Math.sqrt(sumSq / period)
    upper.push(sma[i]! + std * mult)
    lower.push(sma[i]! - std * mult)
  }
  return { upper, middle: sma, lower }
}

/** Volume SMA */
export function calcVolSMA(data: CalcBar[], period: number): (number | null)[] {
  const out: (number | null)[] = []
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].volume || 0
    if (i >= period) sum -= (data[i - period].volume || 0)
    out.push(i >= period - 1 ? sum / period : null)
  }
  return out
}

/** VWAP — resets daily for intraday, cumulative for daily+ */
export function calcVWAP(data: CalcBar[], intraday: boolean): (number | null)[] {
  const out: (number | null)[] = []
  let cumPV = 0, cumV = 0, lastDay: string | null = null
  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    const day = intraday ? new Date(Number(b.time) * 1000).toISOString().slice(0, 10) : null
    if (intraday && day !== lastDay) { cumPV = 0; cumV = 0; lastDay = day }
    const tp = (b.high + b.low + b.close) / 3
    cumPV += tp * (b.volume || 0)
    cumV += (b.volume || 0)
    out.push(cumV > 0 ? cumPV / cumV : tp)
  }
  return out
}

/**
 * Cached indicator computation.
 * Call computeIndicators() once per frame — returns cached results.
 */
export interface IndicatorCache {
  ema: Record<number, (number | null)[]>
  atr: Record<number, (number | null)[]>
  sma: Record<number, (number | null)[]>
  vwap: (number | null)[] | null
  bollinger: { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } | null
  volSma: (number | null)[] | null
}

/**
 * Compute all needed indicators for a panel.
 * `inds` is the panel's indicator toggle state (e.g. {ema9: true, ema20: true, vwap: false}).
 */
export function computeIndicators(
  data: CalcBar[],
  inds: Record<string, boolean>,
  tf: string
): IndicatorCache {
  const cache: IndicatorCache = { ema: {}, atr: {}, sma: {}, vwap: null, bollinger: null, volSma: null }

  const ensureEMA = (period: number) => {
    if (!cache.ema[period]) cache.ema[period] = calcEMA(data, period)
  }
  const ensureATR = (period: number) => {
    if (!cache.atr[period]) cache.atr[period] = calcATR(data, period)
  }

  // Resolve EMA deps
  if (inds.ema9 || inds.db_upper || inds.band_9_20 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureEMA(9)
  if (inds.ema20 || inds.db_low1 || inds.db_low2 || inds.band_9_20 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureEMA(20)
  if (inds.ema50) ensureEMA(50)
  if (inds.ema150) ensureEMA(150)
  if (inds.ema200) ensureEMA(200)
  if (inds.ema40_60) { ensureEMA(40); ensureEMA(60) }
  if (inds.band_72_89 || inds.db_72_89) { ensureEMA(72); ensureEMA(89) }

  // ATR deps
  if (inds.db_upper || inds.dev_s_9_20 || inds.dev_l_9_20) ensureATR(9)
  if (inds.db_low1 || inds.db_low2 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureATR(20)
  if (inds.db_72_89) { ensureATR(72); ensureATR(89) }

  // VWAP
  if (inds.vwap) {
    const isIntra = ['1','2','3','5','10','15','30','60','240','1m','2m','5m','10m','15m','30m','60m'].includes(tf)
    cache.vwap = calcVWAP(data, isIntra)
  }

  // Bollinger
  if (inds.bollinger) {
    cache.bollinger = calcBollinger(data, 20, 2)
  }

  // SMA
  if (inds.sma) {
    const period = 20
    cache.sma[period] = calcSMA(data, period)
  }

  // Volume SMA
  if (inds.sma_vol) {
    cache.volSma = calcVolSMA(data, 20)
  }

  return cache
}
