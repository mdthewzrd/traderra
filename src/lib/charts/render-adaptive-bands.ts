/**
 * Adaptive Dev Band — deviation band with a CATALYST-ADAPTIVE center.
 *
 * The slow mean (EMA72+EMA89)/2 carries ~2 weeks of data. After a catalyst the
 * trend angle steepens, but the slow mean still references the OLD regime for
 * 72+ bars — so price reads as "extreme" against stale data. This tool blends
 * in the fast EMA (default 20) when expansion velocity is high, so the mean
 * tracks the CURRENT trend angle and the band chases the move — then relaxes
 * back to the honest slow mean once the pulse passes.
 *
 *   slow_mean  = (EMA72 + EMA89) / 2
 *   dist       = |close - EMAfast|
 *   baseline   = SMA(dist, 20)       fast_dist = SMA(dist, 3)
 *   ratio      = fast_dist / baseline          (expansion velocity)
 *   cum        = |pct_change(close, 5)|        (spike confirmer)
 *   w1 = wMin + (wMax-wMin) / (1 + e^(-2(ratio-2)))   (sigmoid on velocity)
 *   w2 = wMin + (wMax-wMin) * min(cum / 0.04, 1)       (ramp on cumulative move)
 *   w  = clip(max(w1, w2), wMin, wMax)
 *   adaptive_mean = (1-w) * slow_mean + w * EMAfast
 *   band = adaptive_mean ± mult * ATR(14)   (mults: partial=6, extreme=6.9)
 *
 * Renders via the SAME drawDevBand primitive as the 'db_72_89' tool — identical
 * style — just with the adaptive center. Optional dashed center line shows the
 * mean chasing the trend (the visible proof it is "adaptive").
 *
 * Mirrors explore_adaptive.py / validate_cycle.compute() exactly.
 */
import type { RenderContext } from './render-types'
import { drawDevBand, drawLine } from './render-indicators'
import { useToolStore } from '@/stores/charts/toolStore'

// detection-window defaults (structural; not exposed as params)
const BASELINE = 20
const FASTWIN = 3
const CUMWIN = 5
const CUMT = 0.04
const RATT = 2.0

function ema(vals: number[], span: number): number[] {
  const n = vals.length
  const out: number[] = new Array(n).fill(NaN)
  if (n === 0) return out
  const k = 2 / (span + 1)
  let prev = vals[0]
  out[0] = prev
  for (let i = 1; i < n; i++) {
    if (isNaN(vals[i])) { out[i] = prev; continue }
    prev = vals[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function wilderAtr(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length
  const out: number[] = new Array(n).fill(NaN)
  if (n < len + 1) return out
  let a = 0
  for (let i = 1; i <= len; i++) {
    a += Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  }
  a /= len
  out[len] = a
  for (let i = len + 1; i < n; i++) {
    const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
    a = (a * (len - 1) + tr) / len
    out[i] = a
  }
  return out
}

function rollingMean(vals: number[], win: number): number[] {
  const n = vals.length
  const out: number[] = new Array(n).fill(NaN)
  let sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    const v = vals[i]
    if (!isNaN(v)) { sum += v; count++ }
    if (i >= win) {
      const old = vals[i - win]
      if (!isNaN(old)) { sum -= old; count-- }
    }
    if (i >= win - 1 && count > 0) out[i] = sum / count
  }
  return out
}

const NL = (a: number[]) => a.map(v => (isNaN(v) ? null : v))

export function renderAdaptiveBands(rc: RenderContext) {
  const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'adp_bands')
  if (!tool || !tool.on) return
  const p = (tool.params as Record<string, any>) || {}
  const tc = (tool.colors as Record<string, string>) || {}

  const xtreme = (p.xtreme as number) ?? 6
  const euThr = (p.euThr as number) ?? 6.9
  const emaFast = (p.emaFast as number) ?? 20
  const wMin = (p.wMin as number) ?? 0.10
  const wMax = (p.wMax as number) ?? 0.40
  const showCenter = (p.showCenter as number) !== 0

  const upFill = tc.up_fill || 'rgba(239,68,68,.15)'
  const upLine = tc.up_line || 'rgba(239,68,68,.40)'
  const dnFill = tc.dn_fill || 'rgba(34,197,94,.15)'
  const dnLine = tc.dn_line || 'rgba(34,197,94,.40)'
  const centerCol = tc.center || 'rgba(212,175,55,.55)'

  const { data } = rc
  if (!data || data.length < 95) return

  const close = data.map((b: any) => b.close as number)
  const high = data.map((b: any) => b.high as number)
  const low = data.map((b: any) => b.low as number)
  const e20 = ema(close, emaFast)
  const e72 = ema(close, 72)
  const e89 = ema(close, 89)
  const atr = wilderAtr(high, low, close, 14)

  const n = close.length
  const slowMean = close.map((_, i) => (e72[i] + e89[i]) / 2)
  const dist = close.map((c, i) => Math.abs(c - e20[i]))
  const baseline = rollingMean(dist, BASELINE)
  const fastDist = rollingMean(dist, FASTWIN)
  const adpMean: number[] = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    if (isNaN(slowMean[i])) continue
    const b = baseline[i]
    const ratio = b && b > 0 ? fastDist[i] / b : 0
    const cum = i >= CUMWIN && close[i - CUMWIN] ? Math.abs(close[i] / close[i - CUMWIN] - 1) : 0
    const w1 = wMin + (wMax - wMin) / (1 + Math.exp(-2.0 * (ratio - RATT)))
    const w2 = wMin + (wMax - wMin) * Math.min(cum / CUMT, 1.0)
    let w = Math.max(w1, w2)
    if (w < wMin) w = wMin
    if (w > wMax) w = wMax
    adpMean[i] = (1 - w) * slowMean[i] + w * e20[i]
  }

  // Dev band: symmetric around the adaptive mean, ATR(14), mults xtreme/euThr.
  // drawDevBand upper = fastEma + fastAtr*mult ; lower = slowEma - slowAtr*mult.
  // Both feed the adaptive mean + same ATR → symmetric band that chases the trend.
  drawDevBand(rc, NL(adpMean), NL(atr), NL(adpMean), NL(atr),
    [xtreme, euThr], [xtreme, euThr], upFill, upLine, dnFill, dnLine)

  if (showCenter) drawLine(rc, NL(adpMean), centerCol, 1.2, true)
}
