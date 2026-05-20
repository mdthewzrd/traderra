/**
 * Candle/bar rendering — supports candles, hollow, OHLC, line, area, Heikin Ashi, baseline.
 * Extracted from renderPanel() lines 3596-3692.
 */

import type { RenderContext } from './render-types'
import { C, hexRgb } from './theme'

export function renderCandles(rc: RenderContext) {
  if ((window as any)._barsVisible === false) return // ≡ BARS toggle
  const { ctx, data, chartW, priceH, volH, visible, vs, barW, candleW, xLc, xCtr, pToY } = rc
  const chartStyle = (window as any)._chartStyle || 'candles'

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, chartW, priceH + volH)
  ctx.clip()

  for (let i = 0; i < visible.length; i++) {
    const b = visible[i]
    const up = b.close >= b.open
    const col = up ? C.up : C.dn
    const cx2 = Math.min(Math.round(xCtr(i)) + 0.5, chartW - 1)
    const bodyX = Math.round(xLc(i))
    const bodyW = Math.min(Math.round(candleW), chartW - bodyX - 1)
    if (bodyW <= 0) continue
    const hY = Math.round(pToY(b.high))
    const lY = Math.round(pToY(b.low))
    const bTop = Math.round(Math.min(pToY(b.open), pToY(b.close)))
    const bH = Math.max(2, Math.round(Math.abs(pToY(b.close) - pToY(b.open))))

    if (chartStyle === 'candles' || chartStyle === 'hollow') {
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(cx2, hY); ctx.lineTo(cx2, lY); ctx.stroke()
      if (chartStyle === 'hollow' && up) {
        ctx.strokeStyle = col; ctx.strokeRect(bodyX, bTop, bodyW, bH)
      } else {
        ctx.fillStyle = col; ctx.fillRect(bodyX, bTop, bodyW, bH)
      }
    } else if (chartStyle === 'ohlc') {
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(cx2, hY); ctx.lineTo(cx2, lY); ctx.stroke()
      const oY = Math.round(pToY(b.open)), cY = Math.round(pToY(b.close))
      ctx.beginPath(); ctx.moveTo(bodyX, oY); ctx.lineTo(cx2, oY); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx2, cY); ctx.lineTo(bodyX + bodyW, cY); ctx.stroke()
    } else if (chartStyle === 'line') {
      if (i === 0) { ctx.beginPath(); ctx.strokeStyle = C.up; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.moveTo(cx2, Math.round(pToY(b.close))) }
      else ctx.lineTo(cx2, Math.round(pToY(b.close)))
      if (i === visible.length - 1) ctx.stroke()
    } else if (chartStyle === 'area') {
      if (i === 0) { ctx.beginPath(); ctx.moveTo(cx2, Math.round(pToY(b.close))) }
      else ctx.lineTo(cx2, Math.round(pToY(b.close)))
      if (i === visible.length - 1) {
        ctx.lineTo(cx2, priceH); ctx.lineTo(Math.round(xCtr(0)), priceH); ctx.closePath()
        ctx.fillStyle = up ? `rgba(${hexRgb(C.up).r},${hexRgb(C.up).g},${hexRgb(C.up).b},.18)` : `rgba(${hexRgb(C.dn).r},${hexRgb(C.dn).g},${hexRgb(C.dn).b},.18)`
        ctx.fill()
        ctx.beginPath()
        for (let j = 0; j < visible.length; j++) {
          const x = Math.min(Math.round(xCtr(j)) + 0.5, chartW - 1), y = Math.round(pToY(visible[j].close))
          j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = C.up; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke()
      }
    } else if (chartStyle === 'heikin') {
      // Heikin Ashi
      if (!(rc as any)._haData || (rc as any)._haData.length !== data.length) {
        ;(rc as any)._haData = []
        const ha = (rc as any)._haData
        for (let h = 0; h < data.length; h++) {
          const bd = data[h]
          if (h === 0) { ha.push({ o: bd.open, h: bd.high, l: bd.low, c: bd.close }); continue }
          const pv = ha[h - 1]
          const haC = (bd.open + bd.high + bd.low + bd.close) / 4
          const haO = (pv.o + pv.c) / 2
          ha.push({ o: haO, h: Math.max(bd.high, haO, haC), l: Math.min(bd.low, haO, haC), c: haC })
        }
      }
      const hb = (rc as any)._haData[vs + i] || b
      const haUp = hb.c >= hb.o, haCol = haUp ? C.up : C.dn
      const haH = Math.round(pToY(hb.h)), haL = Math.round(pToY(hb.l))
      const haBTop = Math.round(Math.min(pToY(hb.o), pToY(hb.c)))
      const haBH = Math.max(2, Math.round(Math.abs(pToY(hb.c) - pToY(hb.o))))
      ctx.strokeStyle = haCol; ctx.lineWidth = 1; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(cx2, haH); ctx.lineTo(cx2, haL); ctx.stroke()
      ctx.fillStyle = haCol; ctx.fillRect(bodyX, haBTop, bodyW, haBH)
    } else if (chartStyle === 'baseline') {
      const ref = (window as any)._baselineRef ?? b.close
      const refY = Math.round(pToY(ref))
      const cY2 = Math.round(pToY(b.close))
      ctx.fillStyle = cY2 < refY ? `rgba(${hexRgb(C.up).r},${hexRgb(C.up).g},${hexRgb(C.up).b},.25)` : `rgba(${hexRgb(C.dn).r},${hexRgb(C.dn).g},${hexRgb(C.dn).b},.25)`
      ctx.fillRect(bodyX, Math.min(cY2, refY), bodyW, Math.abs(cY2 - refY) || 1)
      if (i === 0) {
        ctx.beginPath(); ctx.strokeStyle = '#4a6080'; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3])
        ctx.moveTo(0, refY); ctx.lineTo(chartW, refY); ctx.stroke(); ctx.setLineDash([])
      }
      if (i === 0) { ctx.beginPath(); ctx.strokeStyle = C.up; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.moveTo(cx2, cY2) }
      else ctx.lineTo(cx2, cY2)
      if (i === visible.length - 1) ctx.stroke()
    }
  }
  ctx.restore()
}
