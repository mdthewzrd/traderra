/**
 * Crosshair rendering — cursor crosshair, synced crosshair, OHLC tooltip.
 * Extracted from renderPanel() lines ~4402-4486.
 */

import type { RenderContext } from './render-types'
import { C, F } from './theme'
import { fmtPrice, fmtVol, fmtTimeCross } from './format'

export function renderCrosshair(rc: RenderContext) {
  const { ctx, data, W, H, chartW, PRICE_W, TIME_H, priceH, volH, visible, vs, barW, cx, cy, tf, xCtr, minP, maxP, priceRange, pToY } = rc

  // ── Sync crosshair from another panel ──
  const globalCrossTime = (window as any).globalCrossTime || 0
  const globalCrossPrice = (window as any).globalCrossPrice || 0

  if ((cx < 0 || cx > chartW) && globalCrossTime > 0 && data.length) {
    let syncBi = -1, bestD = Infinity
    for (let _i = 0; _i < visible.length; _i++) {
      const d = Math.abs(visible[_i].time - globalCrossTime)
      if (d < bestD) { bestD = d; syncBi = _i }
    }
    if (syncBi >= 0) {
      const syncX = xCtr(syncBi)
      ctx.strokeStyle = 'rgba(180,200,255,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(syncX, 0); ctx.lineTo(syncX, priceH + volH); ctx.stroke()
      if (globalCrossPrice > 0 && priceRange > 0) {
        const syncY = priceH * (1 - (globalCrossPrice - minP) / priceRange)
        if (syncY >= 0 && syncY <= priceH) {
          ctx.beginPath(); ctx.moveTo(0, syncY); ctx.lineTo(chartW, syncY); ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = C.crossLabelBg; ctx.fillRect(chartW, syncY - 10, PRICE_W, 20)
          ctx.strokeStyle = C.crossLabelBd; ctx.lineWidth = 1; ctx.strokeRect(chartW, syncY - 10, PRICE_W, 20)
          ctx.fillStyle = C.axisHighlight; ctx.font = `bold ${F.p}px Inter`; ctx.textAlign = 'right'
          ctx.fillText(fmtPrice(globalCrossPrice), W - 4, syncY + 4)
        }
      }
      ctx.setLineDash([])
      const slbl = fmtTimeCross(visible[syncBi].time, tf)
      ctx.font = `bold ${F.t}px Inter`; ctx.textAlign = 'center'
      const stw = ctx.measureText(slbl).width + 10
      ctx.fillStyle = '#141a2a'; ctx.fillRect(syncX - stw / 2, H - TIME_H, stw, TIME_H)
      ctx.strokeStyle = '#2a3050'; ctx.lineWidth = 1; ctx.strokeRect(syncX - stw / 2, H - TIME_H, stw, TIME_H)
      ctx.fillStyle = '#8090b0'; ctx.fillText(slbl, syncX, H - TIME_H + 13)
    }
  }

  // ── Active crosshair ──
  if (cx >= 0 && cx <= chartW && cy >= 0 && cy <= priceH + volH) {
    ctx.strokeStyle = C.cross; ctx.lineWidth = 1; ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, priceH + volH); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(chartW, cy); ctx.stroke()
    ctx.setLineDash([])

    if (cy <= priceH) {
      const hp = minP + priceRange * (1 - cy / priceH)
      ctx.fillStyle = '#1a2040'; ctx.fillRect(chartW, cy - 10, PRICE_W, 20)
      ctx.strokeStyle = '#2a3050'; ctx.lineWidth = 1; ctx.strokeRect(chartW, cy - 10, PRICE_W, 20)
      ctx.fillStyle = '#00e676'; ctx.font = `bold ${F.p}px Inter`; ctx.textAlign = 'right'
      ctx.fillText(fmtPrice(hp), W - 4, cy + 4)
    } else if (volH > 0 && cy > priceH && cy <= priceH + volH) {
      const maxVol = Math.max(...visible.map(b => b.volume || 0)) || 1
      const volFrac = 1 - (cy - priceH) / volH
      const hv = maxVol * volFrac / 0.92
      ctx.fillStyle = '#1a2040'; ctx.fillRect(chartW, cy - 10, PRICE_W, 20)
      ctx.strokeStyle = '#2a3050'; ctx.lineWidth = 1; ctx.strokeRect(chartW, cy - 10, PRICE_W, 20)
      ctx.fillStyle = '#8080e8'; ctx.font = `bold ${F.p}px Inter`; ctx.textAlign = 'right'
      ctx.fillText(fmtVol(Math.max(0, hv)), W - 4, cy + 4)
    }

    // OHLC tooltip
    const bi = Math.max(0, Math.min(visible.length - 1, Math.round(cx / barW)))
    const bar = visible[bi]
    if (bar) {
      const lbl = fmtTimeCross(bar.time, tf)
      ctx.font = `bold ${F.t}px Inter`; ctx.textAlign = 'center'
      const tw = ctx.measureText(lbl).width + 10
      const lx = xCtr(bi)
      ctx.fillStyle = '#1a2040'; ctx.fillRect(lx - tw / 2, H - TIME_H, tw, TIME_H)
      ctx.strokeStyle = '#2a3050'; ctx.strokeRect(lx - tw / 2, H - TIME_H, tw, TIME_H)
      ctx.fillStyle = '#D4AF37'; ctx.fillText(lbl, lx, H - TIME_H + 13)

      // Update OHLC display
      const p = (rc as any)
      const chg = bar.close - bar.open, pct = ((chg / bar.open) * 100).toFixed(2)
      const cc = chg >= 0 ? '#26a69a' : '#ef5350'
      const ohlcEl = document.getElementById(`ohlc-${p.idx}`)
      if (ohlcEl) {
        ohlcEl.innerHTML =
          `O<span style="color:#dde3f0"> ${fmtPrice(bar.open)}</span> ` +
          `H<span style="color:#26a69a"> ${fmtPrice(bar.high)}</span> ` +
          `L<span style="color:#ef5350"> ${fmtPrice(bar.low)}</span> ` +
          `C<span style="color:${cc}"> ${fmtPrice(bar.close)}</span> ` +
          `V<span style="color:#8080e8"> ${fmtVol(bar.volume)}</span> ` +
          `<span style="color:${cc}">(${chg >= 0 ? '+' : ''}${pct}%)</span>`
      }
    }
  }

  // Chart border
  ctx.strokeStyle = '#1e2535'; ctx.lineWidth = 1; ctx.setLineDash([])
  ctx.strokeRect(0.5, 0.5, chartW - 1, priceH + volH - 1)
}
