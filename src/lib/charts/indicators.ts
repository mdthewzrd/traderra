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
  if (data.length === 1) { out.push(data[0].high - data[0].low); return out }
  // Running-seed: provisional ATR from bar 1 (running avg of TRs) converging to the exact
  // Wilder seed at bar `period`, then standard smoothing. Plots from the first candle
  // instead of leaving a `period`-bar null gap on the left edge of the chart.
  const tr = (i: number) => Math.max(
    data[i].high - data[i].low,
    Math.abs(data[i].high - data[i - 1].close),
    Math.abs(data[i].low - data[i - 1].close)
  )
  out.push(data[0].high - data[0].low)
  let a = tr(1)
  out.push(a)
  for (let i = 2; i < data.length; i++) {
    if (i <= period) a = (a * (i - 1) + tr(i)) / i
    else a = (a * (period - 1) + tr(i)) / period
    out.push(a)
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
 * Trail Stop (short) \u2014 adaptive ATR trailing stop with swing structure.
 *
 * Inspired by modified ATR trailing stop methodology:
 * - Uses modified true range (capped at 1.5x average range) to filter noise
 * - Loss = ATR(factor) * multiplier — wide in consolidation, ratchets tight in trend
 * - Swing structure for additional stair-step confirmation
 * - State machine: active on bearish crossover, resets on bullish crossover
 * - Never retreats — only ratchets down
 */
export function calcTrailStop(
  data: CalcBar[],
  emaFast: (number | null)[],
  emaSlow: (number | null)[],
  atrFast: (number | null)[],
  bandMult: number = 3.0,
  lookback: number = 5,
): (number | null)[] {
  const n = data.length
  const out: (number | null)[] = new Array(n).fill(null)

  // Modified true range: cap at 1.5x average range over ATR period
  function modTrueRange(i: number): number {
    if (i < 1) return data[i].high - data[i].low
    const prevClose = data[i - 1].close
    const h = data[i].high
    const l = data[i].low
    const rawRange = h - l
    // HRef and LRef from the Pine script
    const hRef = l <= data[i - 1].high
      ? h - prevClose
      : (h - prevClose) - 0.5 * (l - data[i - 1].high)
    const lRef = h >= data[i - 1].low
      ? prevClose - l
      : (prevClose - l) - 0.5 * (data[i - 1].low - h)
    // Cap at 1.5x average range
    const avgRange = rawRange // simplified — ATR already handles averaging
    const hiLo = Math.min(rawRange, 1.5 * avgRange)
    return Math.max(hiLo, Math.max(hRef, lRef))
  }

  // Swing detection
  function isSwHigh(i: number): boolean {
    if (i < lookback || i >= n - lookback) return false
    const h = data[i].high
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j].high >= h) return false
    }
    return true
  }
  function isSwLow(i: number): boolean {
    if (i < lookback || i >= n - lookback) return false
    const l = data[i].low
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j].low <= l) return false
    }
    return true
  }

  let trailActive = false
  let trailLevel = 0
  let pendingSwHigh = 0
  let triggerSwLow = Infinity

  for (let i = 1; i < n; i++) {
    if (emaFast[i] == null || emaSlow[i] == null) continue

    const fast = emaFast[i]!
    const slow = emaSlow[i]!
    const pf = emaFast[i - 1]
    const ps = emaSlow[i - 1]

    // Bearish crossover: fast crosses below slow
    if (pf != null && ps != null && pf >= ps && fast < slow) {
      trailActive = true
      // Start at highest high from prior bullish period
      let hh = data[i].high
      for (let j = i - 1; j >= 0; j--) {
        if (emaFast[j] == null || emaSlow[j] == null) break
        if (emaFast[j]! < emaSlow[j]!) break
        hh = Math.max(hh, data[j].high)
      }
      trailLevel = hh
      pendingSwHigh = 0
      triggerSwLow = Infinity
    }

    // Bullish crossover: reset
    if (pf != null && ps != null && pf <= ps && fast > slow) {
      trailActive = false
    }

    if (!trailActive) continue

    // Core trail: loss = ATR * bandMult, ratchet down only
    if (atrFast[i] != null) {
      const loss = atrFast[i]! * bandMult
      const stopLevel = data[i].close + loss
      // Ratchet: only move DOWN (tighter for shorts)
      trailLevel = Math.min(trailLevel, stopLevel)
    }

    // Swing structure: additional stair-step confirmation
    const ci = i - lookback
    if (ci >= lookback) {
      if (isSwHigh(ci)) {
        const sh = data[ci].high
        if (sh < trailLevel) {
          pendingSwHigh = sh
          triggerSwLow = Infinity
        }
      }
      if (isSwLow(ci)) {
        triggerSwLow = Math.min(triggerSwLow, data[ci].low)
      }
    }

    // Swing low broken -> step down to pending swing high
    if (pendingSwHigh > 0 && triggerSwLow < Infinity && data[i].close < triggerSwLow) {
      trailLevel = pendingSwHigh
      pendingSwHigh = 0
      triggerSwLow = Infinity
    }

    out[i] = trailLevel
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
  // Trail stop needs fast + slow EMA and fast ATR
  if (inds.trail_stop) {
    const tsTool = toolMap['trail_stop']
    const fp = tsTool?.params?.fast ?? 9
    const sp = tsTool?.params?.slow ?? 20
    ensureEMA(fp)
    ensureEMA(sp)
    ensureATR(fp)
  }
  if (inds.ema20 || inds.db_low1 || inds.db_low2 || inds.band_9_20 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureEMA(ema20Tool?.params?.period ?? 20)
  if (inds.ema50) ensureEMA(ema50Tool?.params?.period ?? 50)
  if (inds.ema150) ensureEMA(ema150Tool?.params?.period ?? 150)
  if (inds.ema200) ensureEMA(ema200Tool?.params?.period ?? 200)
  if (inds.ema40_60) { ensureEMA(40); ensureEMA(60) }
  if (inds.band_72_89 || inds.db_72_89 || inds.db_72_89_tight) { ensureEMA(72); ensureEMA(89) }
  // EMA Cloud — editable fast/slow spans. toolMap is indKey-keyed so it only holds ONE
  // emacloud instance; iterate toolOverrides to cache EVERY duplicate's spans.
  if (inds.emacloud && toolOverrides) {
    for (const t of toolOverrides) {
      if (t.indKey !== 'emacloud') continue
      ensureEMA((t.params?.fast as number) ?? 9)
      ensureEMA((t.params?.slow as number) ?? 20)
    }
  }
  if (inds.ema || emaTool) ensureEMA(emaTool?.params?.period ?? 20)

  // Generic EMA from tool overrides (keys like ema_50, ema_100, etc.)
  for (const t of (toolOverrides || [])) {
    if (t.indKey.startsWith('ema') && !['ema9','ema20','ema50','ema150','ema200','ema40_60'].includes(t.indKey)) {
      if (t.params?.period) ensureEMA(t.params.period)
    }
  }

  // ATR deps
  if (inds.db_upper || inds.dev_s_9_20 || inds.dev_l_9_20) ensureATR(9)
  if (inds.db_low1 || inds.db_low2 || inds.dev_s_9_20 || inds.dev_l_9_20) ensureATR(20)
  if (inds.db_72_89 || inds.db_72_89_tight) { ensureATR(72); ensureATR(89) }

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

  // Trail Stop — swing-structure trailing stop
  if (inds.trail_stop) {
    const tsTool = toolMap['trail_stop']
    const fastPeriod = tsTool?.params?.fast ?? 9
    const slowPeriod = tsTool?.params?.slow ?? 20
    const bandMult = tsTool?.params?.band_mult ?? 1.0
    const lookback = tsTool?.params?.lookback ?? 5
    ensureEMA(fastPeriod)
    ensureEMA(slowPeriod)
    ensureATR(fastPeriod)
    cache.trailStop = calcTrailStop(data, cache.ema[fastPeriod]!, cache.ema[slowPeriod]!, cache.atr[fastPeriod]!, bandMult, lookback)
  }

  return cache
}
