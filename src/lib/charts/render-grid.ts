/**
 * Grid rendering — horizontal price grid lines and vertical time grid lines.
 * Extracted from renderPanel() lines 3097-3135.
 */

import type { RenderContext } from './render-types'
import { C, F } from './theme'
import { fmtPrice, fmtTimeAxis } from './format'

export function renderGrid(rc: RenderContext) {
  const { ctx, chartW, priceH, volH, visible, vs, ve, minP, maxP, xCtr, pToY } = rc
  ctx.strokeStyle = C.grid
  ctx.lineWidth = 1

  // ── Horizontal grid (nice price levels) ──
  const priceRange = maxP - minP
  const rawStep = priceRange / 6
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / mag
  let niceStep: number
  if (normalized <= 1) niceStep = mag
  else if (normalized <= 2) niceStep = 2 * mag
  else if (normalized <= 5) niceStep = 5 * mag
  else niceStep = 10 * mag

  const gridMinP = Math.ceil(minP / niceStep) * niceStep
  for (let gp = gridMinP; gp <= maxP; gp += niceStep) {
    const y = Math.round(pToY(gp)) + 0.5
    if (y < 0 || y > priceH) continue
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke()
  }

  // ── Vertical grid (candle boundaries) ──
  const RIGHT_PAD = (window as any).RIGHT_PAD || 6
  const barW = rc.barW
  const pxPerBar = chartW / (visible.length + RIGHT_PAD)
  const barsPerStep = Math.max(1, Math.round(80 / pxPerBar))
  const firstGridBar = Math.ceil(vs / barsPerStep) * barsPerStep
  for (let bi = firstGridBar; bi <= ve; bi += barsPerStep) {
    const i_ = bi - vs
    if (i_ < 0 || i_ >= visible.length) continue
    const x = Math.round(xCtr(i_)) + 0.5
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke()
    if (volH > 0) { ctx.beginPath(); ctx.moveTo(x, priceH + 1); ctx.lineTo(x, priceH + volH); ctx.stroke() }
  }

  return { niceStep, gridMinP }
}

export function renderPriceAxis(rc: RenderContext, niceStep: number, gridMinP: number) {
  const { ctx, W, PRICE_W, priceH, maxP, pToY } = rc
  ctx.fillStyle = C.axisLabel
  ctx.font = `bold ${F.p}px Inter`
  ctx.textAlign = 'right'
  for (let gp = gridMinP; gp <= maxP; gp += niceStep) {
    const y = pToY(gp)
    if (y < 0 || y > priceH) continue
    ctx.fillText(fmtPrice(gp), W - 4, y + 4)
  }
}

export function renderTimeAxis(rc: RenderContext) {
  const { ctx, W, H, chartW, TIME_H, visible, tf, barW, vs } = rc
  const RIGHT_PAD = (window as any).RIGHT_PAD || 6
  ctx.fillStyle = C.axisLabel
  ctx.font = `bold ${F.t}px Inter`
  ctx.textAlign = 'center'

  const lastBar = visible[visible.length - 1]
  const barIntervalSec = visible.length > 1
    ? (Number(visible[visible.length - 1].time) - Number(visible[0].time)) / (visible.length - 1)
    : (parseInt(tf) || 5) * 60

  const totalLabelSlots = visible.length + RIGHT_PAD
  const labelCount = Math.min(8, Math.floor(chartW / 70))
  for (let li = 0; li <= labelCount; li++) {
    const slotIdx = Math.round(li / labelCount * (totalLabelSlots - 1))
    const x = slotIdx * barW + barW / 2
    if (x > chartW - 4) break
    let label: string
    if (slotIdx < visible.length) {
      label = fmtTimeAxis(visible[slotIdx].time, tf)
    } else {
      const futureOffset = slotIdx - visible.length + 1
      const futureTs = typeof lastBar.time === 'number'
        ? lastBar.time + futureOffset * barIntervalSec : null
      label = futureTs ? fmtTimeAxis(futureTs, tf) : ''
    }
    ctx.fillText(label, Math.round(x), H - TIME_H + 13)
  }
}
