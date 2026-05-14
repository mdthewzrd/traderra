/**
 * renderPanel — main chart rendering orchestrator.
 * Extracted from inline JS (lines 3041-4509).
 *
 * This function sets up coordinate transforms and delegates to sub-renderers:
 * - renderGrid (grid lines + price/time axes)
 * - renderVolume (volume bars)
 * - renderCandles (OHLC bars, line, area, Heikin Ashi, etc.)
 * - renderLivePriceLine (dashed line at last close)
 *
 * Indicator rendering, session shading, annotations, and backtest markers
 * still use inline code (to be extracted in future passes).
 */

import type { RenderContext } from './render-types'
import { C } from './theme'
import { renderGrid, renderPriceAxis, renderTimeAxis } from './render-grid'
import { renderVolume } from './render-volume'
import { renderCandles } from './render-candles'
import { renderLivePriceLine } from './render-price-line'

const VOL_FRAC_DEFAULT = 0.20
const RIGHT_PAD = 6

export function renderPanelSetup(p: any): RenderContext | null {
  const { canvas, ctx, data, W, H, PRICE_W, TIME_H, viewStart, viewBars, cx, cy, tf, inds: pi } = p
  if (!ctx || W <= 0 || H <= 0 || !data.length) return null

  const chartW = W - PRICE_W
  const volFrac = p.volFrac || VOL_FRAC_DEFAULT
  const volH = pi.vol ? Math.round(H * volFrac) : 0
  const priceH = H - TIME_H - volH
  if (chartW <= 0 || priceH <= 10) return null

  // Clear & fill backgrounds
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = C.axisbg
  ctx.fillRect(chartW, 0, PRICE_W, H)
  ctx.fillRect(0, H - TIME_H, W, TIME_H)

  // Visible bar range
  const maxStart = Math.max(0, data.length - viewBars)
  const vs = Math.max(0, Math.min(viewStart, maxStart))
  const ve = Math.min(vs + viewBars, data.length)
  const visible = data.slice(vs, ve)
  if (!visible.length) return null

  // Bar sizing
  const rightPad = (window as any).RIGHT_PAD || RIGHT_PAD
  const barW = chartW / Math.max(visible.length + rightPad, 1)
  const GAP = Math.max(2, Math.round(barW * 0.25))
  const candleW = Math.max(1, barW - GAP)
  const xCtr = (i: number) => i * barW + barW / 2
  const xLc = (i: number) => i * barW + GAP / 2
  const xL = (i: number) => i * barW

  // Price range (from candle highs/lows only)
  let minP = Infinity, maxP = -Infinity
  for (const b of visible) { if (b.low < minP) minP = b.low; if (b.high > maxP) maxP = b.high }
  const pad = (maxP - minP) * 0.15 || minP * 0.02
  minP -= pad; maxP += pad
  const midP = (minP + maxP) / 2, halfRange = (maxP - minP) / 2
  const scaledHalf = halfRange * (p.priceScale || 1)
  minP = midP - scaledHalf; maxP = midP + scaledHalf
  const priceRange = maxP - minP
  const pToY = (v: number) => Math.max(0, Math.min(priceH, priceH - ((v - minP) / priceRange) * priceH))

  // Annotation time→X
  function annTimeToX(t: number): number | null {
    const toUnix = (window as any).toUnix
    const ts = toUnix ? toUnix(t) : t
    let lo = -1, hi = -1
    for (let i = 0; i < data.length; i++) {
      const bt = toUnix ? toUnix(data[i].time) : data[i].time
      if (bt <= ts) lo = i
      if (bt >= ts && hi < 0) hi = i
    }
    if (lo < 0 && hi < 0) return null
    if (lo < 0) return (hi - vs + 0.5) * barW
    if (hi < 0) return (lo - vs + 0.5) * barW
    if (lo === hi) return (lo - vs + 0.5) * barW
    const loT = toUnix ? toUnix(data[lo].time) : data[lo].time
    const hiT = toUnix ? toUnix(data[hi].time) : data[hi].time
    const frac = (hiT === loT) ? 0 : (ts - loT) / (hiT - loT)
    return ((lo + frac * (hi - lo)) - vs + 0.5) * barW
  }

  return {
    canvas, ctx, data, W, H, PRICE_W, TIME_H, viewStart, viewBars, cx, cy, tf, inds: pi,
    volFrac, priceScale: p.priceScale,
    chartW, volH, priceH, vs, ve, visible,
    barW, GAP, candleW, xCtr, xLc, xL,
    minP, maxP, priceRange, pToY, annTimeToX,
  }
}

/**
 * Render extracted portions of the panel (grid, axes, volume, candles, price line).
 * Returns the RenderContext for inline code to continue rendering indicators/annotations.
 */
export function renderPanelExtracted(p: any): RenderContext | null {
  const rc = renderPanelSetup(p)
  if (!rc) return null

  // Grid + axes
  const { niceStep, gridMinP } = renderGrid(rc)
  renderPriceAxis(rc, niceStep, gridMinP)
  renderTimeAxis(rc)

  // Store rc for inline code to continue
  ;(window as any).__rc = rc

  return rc
}
