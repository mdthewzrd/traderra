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

/** VWAP — resets daily at market open (9:30 ET) for intraday, cumulative for daily+.
 *  Only meaningful on 5m and 15m timeframes. */
export function calcVWAP(data: CalcBar[], intraday: boolean): (number | null)[] {
  const out: (number | null)[] = []
  let cumPV = 0, cumV = 0, lastMktDay: string | null = null

  for (let i = 0; i < data.length; i++) {
    const b = data[i]
    if (!intraday) {
      // Daily+ — simple cumulative
      const tp = (b.high + b.low + b.close) / 3
      cumPV += tp * (b.volume || 0)
      cumV += (b.volume || 0)
      out.push(cumV > 0 ? cumPV / cumV : tp)
      continue
    }

    // Intraday — determine market day in ET
    const ts = Number(b.time) * 1000
    const utcH = new Date(ts).getUTCHours()
    // If UTC hour is 0–4 (i.e. 7pm–11:59pm ET previous day), shift back one day
    const etDate = new Date(ts - (utcH < 5 ? 86400000 : 0))
    const mktDay = etDate.toISOString().slice(0, 10)

    if (mktDay !== lastMktDay) {
      cumPV = 0
      cumV = 0
      lastMktDay = mktDay
    }

    const tp = (b.high + b.low + b.close) / 3
    cumPV += tp * (b.volume || 0)
    cumV += (b.volume || 0)
    out.push(cumV > 0 ? cumPV / cumV : tp)
  }
  return out
}

/**
 * Trail Stop - EMA + ATR * mult.
 * Simple stop level for visualization. Ratchet logic will be added
 * when route start anchoring is implemented.
 */
export function calcTrailStop(
  data: CalcBar[],
  ema: (number | null)[],
  atr: (number | null)[],
  mult: number,
): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (ema[i] == null || atr[i] == null) { out.push(null); continue }
    out.push(ema[i]! + atr[i]! * mult)
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
  trailStop: (number | null)[] | null
}

/**
 * Compute all needed indicators for a panel.
 * `inds` is the panel's indicator toggle state (e.g. {ema9: true, ema20: true, vwap: false}).
 */
export interface ToolOverride {
  indKey: string
  params: Record<string, number>
  colors: Record<string, string>
}

export function computeIndicators(
  data: CalcBar[],
  inds: Record<string, boolean>,
  tf: string,
  toolOverrides?: ToolOverride[]
): IndicatorCache {
  const cache: IndicatorCache = { ema: {}, atr: {}, sma: {}, vwap: null, bollinger: null, volSma: null, trailStop: null }

  const ensureEMA = (period: number) => {
    if (!cache.ema[period]) cache.ema[period] = calcEMA(data, period)
  }
  const ensureATR = (period: number) => {
    if (!cache.atr[period]) cache.atr[period] = calcATR(data, period)
  }
  const ensureSMA = (period: number) => {
    if (!cache.sma[period]) cache.sma[period] = calcSMA(data, period)
  }

  // Build a map of indKey → tool override for quick lookup
  const toolMap: Record<string, ToolOverride> = {}
  if (toolOverrides) for (const t of toolOverrides) toolMap[t.indKey] = t

  // Resolve EMA deps — tool overrides take priority
  const ema9Tool = toolMap['ema9']
  const ema20Tool = toolMap['ema20']
  const ema50Tool = toolMap['ema50']
  const ema150Tool = toolMap['ema150']
  const ema200Tool = toolMap['ema200']
  const emaTool = toolMap['ema']
  const smaTool = toolMap['sma']

  if (inds.ema9 || inds.dev_s_9_20 || inds.dev_l_9_20 || inds.db_upper || inds.trail_stop) ensureEMA(ema9Tool?.params?.period ?? 9)
  // Trail stop may use custom EMA/ATR periods — ensure they're computed
  if (inds.trail_stop) {
    const tsTool = toolMap['trail_stop']
    if (tsTool?.params?.ema) ensureEMA(tsTool.params.ema)
    if (tsTool?.params?.atr) ensureATR(tsTool.params.atr)
  }
  if (inds.ema20 || inds.db_low1 || inds.db_low2 || inds.band_9_20 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureEMA(ema20Tool?.params?.period ?? 20)
  if (inds.ema50) ensureEMA(ema50Tool?.params?.period ?? 50)
  if (inds.ema150) ensureEMA(ema150Tool?.params?.period ?? 150)
  if (inds.ema200) ensureEMA(ema200Tool?.params?.period ?? 200)
  if (inds.ema40_60) { ensureEMA(40); ensureEMA(60) }
  if (inds.band_72_89 || inds.db_72_89) { ensureEMA(72); ensureEMA(89) }
  if (inds.ema || emaTool) ensureEMA(emaTool?.params?.period ?? 20)

  // Generic EMA from tool overrides (keys like ema_50, ema_100, etc.)
  for (const t of (toolOverrides || [])) {
    if (t.indKey.startsWith('ema') && !['ema9','ema20','ema50','ema150','ema200','ema40_60'].includes(t.indKey)) {
      if (t.params?.period) ensureEMA(t.params.period)
    }
  }

  // ATR deps
  if (inds.db_upper || inds.dev_s_9_20 || inds.dev_l_9_20 || inds.trail_stop) ensureATR(9)
  if (inds.db_low1 || inds.db_low2 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureATR(20)
  if (inds.db_72_89) { ensureATR(72); ensureATR(89) }

  // VWAP — only compute on 5m and 15m
  if (inds.vwap && (tf === '5' || tf === '5m' || tf === '15' || tf === '15m')) {
    cache.vwap = calcVWAP(data, true)
  }

  // Bollinger
  if (inds.bollinger) {
    const bt = toolMap['bollinger']
    cache.bollinger = calcBollinger(data, bt?.params?.period ?? 20, bt?.params?.stddev ?? 2)
  }

  // SMA
  if (inds.sma || smaTool) {
    ensureSMA(smaTool?.params?.period ?? 20)
  }

  // Volume SMA
  if (inds.sma_vol) {
    const vt = toolMap['sma_vol']
    cache.volSma = calcVolSMA(data, vt?.params?.period ?? 20)
  }

  // Trail Stop — ratcheting short trailing stop
  if (inds.trail_stop) {
    const tsTool = toolMap['trail_stop']
    const emaPeriod = tsTool?.params?.ema ?? 9
    const atrPeriod = tsTool?.params?.atr ?? 9
    const mult = tsTool?.params?.mult ?? 1.5
    ensureEMA(emaPeriod)
    ensureATR(atrPeriod)
    cache.trailStop = calcTrailStop(data, cache.ema[emaPeriod]!, cache.atr[atrPeriod]!, mult)
  }

  return cache
}
