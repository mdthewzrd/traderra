/**
 * Dev Zones — simplest possible indicator. ONE thing.
 *
 * Computes the Mike's Bands deviation on the DISPLAYED timeframe:
 *   mean = (EMA72 + EMA89) / 2
 *   dev  = (close - mean) / ATR(14)
 *
 * Shades the background per bar:
 *   |dev| >= 6.9  → dark orange  (full extreme)
 *   |dev| >= 6.0  → dark red    (partial extreme)
 *
 * No stages, no timeframes, no hysteresis, no labels. Just the shading.
 */
import type { RenderContext } from './render-types'
import { useToolStore } from '@/stores/charts/toolStore'

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

export function renderDevZones(rc: RenderContext) {
  const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'devzones')
  if (!tool || !tool.on) return
  const p = (tool.params as Record<string, any>) || {}
  const tc = (tool.colors as Record<string, string>) || {}

  const partThr = (p.partThr as number) ?? 6.0
  const fullThr = (p.fullThr as number) ?? 6.9
  const partCol = tc.part_fill || 'rgba(183,28,28,0.45)'   // dark red
  const fullCol = tc.full_fill || 'rgba(230,81,0,0.55)'    // dark orange

  const { ctx, data, vs, visible, xCtr, priceH } = rc
  if (!data || data.length < 90 || visible.length === 0) return

  // Compute deviation over the FULL bar array (warmup), shade only visible.
  const close = data.map((b: any) => b.close as number)
  const high = data.map((b: any) => b.high as number)
  const low = data.map((b: any) => b.low as number)
  const e72 = ema(close, 72)
  const e89 = ema(close, 89)
  const atr = wilderAtr(high, low, close, 14)

  const slot = rc.barW && rc.barW > 0 ? rc.barW : 6
  const half = slot / 2

  let partialCount = 0, fullCount = 0
  // Track peak dev across ALL bars (not just visible) to prove computation correctness
  let peakDev = 0, peakIdx = -1, peakTime: any = null
  for (let i = 89; i < data.length; i++) {
    const m = (e72[i] + e89[i]) / 2
    if (isNaN(m) || isNaN(atr[i]) || atr[i] === 0) continue
    const dd = (close[i] - m) / atr[i]   // UPPER BAND ONLY: positive dev = stretched above mean
    if (dd > peakDev) { peakDev = dd; peakIdx = i; peakTime = (data[i] as any).time }
  }
  for (let i = 0; i < visible.length; i++) {
    const idx = vs + i
    const m = (e72[idx] + e89[idx]) / 2
    if (isNaN(m) || isNaN(atr[idx]) || atr[idx] === 0) continue
    const dev = (close[idx] - m) / atr[idx]   // UPPER BAND ONLY (user trades the tops/shorts side)
    if (dev >= fullThr) {
      ctx.fillStyle = fullCol
      ctx.fillRect(xCtr(i) - half, 0, slot, priceH)
      fullCount++
    } else if (dev >= partThr) {
      ctx.fillStyle = partCol
      ctx.fillRect(xCtr(i) - half, 0, slot, priceH)
      partialCount++
    }
  }

  ;(globalThis as any).__devzonesState = {
    ran: true, bars: data.length, visibleBars: visible.length,
    partThr, fullThr, partialCount, fullCount,
    peakDev: +peakDev.toFixed(2), peakIdx, peakTime,
    visibleStart: vs, visibleEnd: vs + visible.length,
    lastDev: (() => {
      const idx = vs + visible.length - 1
      const m = (e72[idx] + e89[idx]) / 2
      return (!isNaN(m) && atr[idx]) ? +(Math.abs((close[idx] - m) / atr[idx])).toFixed(2) : null
    })(),
  }
}
