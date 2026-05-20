/**
 * Volume bar rendering.
 * Extracted from renderPanel() lines 3320-3370.
 */

import type { RenderContext } from './render-types'
import { C, F } from './theme'
import { fmtVol } from './format'

export function renderVolume(rc: RenderContext) {
  if ((window as any)._barsVisible === false) return // ≡ BARS toggle
  const { ctx, data, W, chartW, PRICE_W, priceH, volH, visible, vs, barW, candleW, xLc, xCtr, pToY, inds: pi } = rc
  if (volH <= 0) return

  const maxVol = Math.max(...visible.map(b => b.volume || 0)) || 1

  // Draw volume bars
  for (let i = 0; i < visible.length; i++) {
    const b = visible[i]
    const vh = Math.max(1, ((b.volume || 0) / maxVol) * volH * 0.92)
    const vx = Math.round(xLc(i))
    const vw = Math.min(Math.round(candleW), chartW - vx - 1)
    if (vw <= 0) continue
    ctx.fillStyle = b.close >= b.open ? C.vol_up : C.vol_dn
    ctx.fillRect(vx, priceH + volH - vh, vw, vh)
  }

  // Volume label
  ctx.fillStyle = C.axisMuted
  ctx.font = `bold ${F.t}px Inter`
  ctx.textAlign = 'right'
  ctx.fillText(fmtVol(Math.max(...visible.map(b => b.volume || 0))), W - 4, priceH + 10)

  // Volume separator band
  ctx.fillStyle = C.axisbg
  ctx.fillRect(0, priceH - 1, chartW, 3)
  ctx.fillStyle = C.axisLabel
  ctx.globalAlpha = 0.25
  ctx.fillRect(0, priceH - 1, chartW, 1)
  ctx.globalAlpha = 1
  ctx.fillStyle = C.axisbg
  ctx.fillRect(chartW, priceH - 1, PRICE_W, 3)
}
