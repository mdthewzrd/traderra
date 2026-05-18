/**
 * Annotation preview — drawing in-progress overlay.
 * Extracted from renderPanel() lines 4256-4395.
 * Shows ghost shapes while the user is actively drawing.
 */

import type { RenderContext } from './render-types'
import { C, F } from './theme'
import { fmtPrice } from './format'

export function renderAnnotationPreview(rc: RenderContext) {
  const { ctx, chartW, priceH, cx, cy, pToY, annTimeToX } = rc
  const p = rc as any
  const activeTool = (window as any).activeTool
  const toolAnchor = (window as any).toolAnchor
  const toolStep = (window as any).toolStep
  const freehandState = (window as any).freehandState
  const renderAdvancedPreview = (window as any).renderAdvancedPreview
  const getMinMax = (window as any).getMinMax

  if (!((activeTool && toolAnchor?.panelIdx === p.idx && cx >= 0 && cy >= 0) || freehandState?.panelIdx === p.idx)) return

  // Try advanced preview renderer
  if (renderAdvancedPreview && renderAdvancedPreview(ctx, p, chartW, priceH, annTimeToX, pToY, cx, cy)) return

  if (!(activeTool && toolStep === 'second' && toolAnchor?.panelIdx === p.idx && cx >= 0 && cy >= 0)) return

  const ax = annTimeToX(toolAnchor.time) || toolAnchor.rawX
  const ay = pToY(toolAnchor.price)
  const col = activeTool === 'trendline' ? C.trendline : (C as any)[activeTool] || (activeTool === 'box_orange' ? C.box_orange : C.box_yellow)

  if (activeTool === 'trendline' || activeTool === 'ray') {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy)
    if (activeTool === 'ray') ctx.lineTo(cx + (cx - ax) * 3, cy + (cy - ay) * 3)
    ctx.stroke(); ctx.setLineDash([])
  } else if (activeTool === 'measure') {
    ctx.strokeStyle = '#8aa0c0'; ctx.lineWidth = 1; ctx.setLineDash([3, 2])
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([])
    const dt = Math.abs(cx - ax), dp = Math.abs(cy - ay)
    ctx.fillStyle = '#dde3f0'; ctx.font = F.p + 'px Inter'
    ctx.fillText(dt.toFixed(0) + 'px, ' + dp.toFixed(0) + 'px', (ax + cx) / 2 + 4, (ay + cy) / 2 - 4)
  } else if (activeTool.startsWith('box_')) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
    ctx.strokeRect(Math.min(ax, cx), Math.min(ay, cy), Math.abs(cx - ax), Math.abs(cy - ay))
    ctx.setLineDash([])
  } else if (activeTool.startsWith('hl_')) {
    const rv = parseInt(col.slice(1, 3), 16), gv = parseInt(col.slice(3, 5), 16), bv = parseInt(col.slice(5, 7), 16)
    const hlOpEl = document.getElementById('hl-opacity') as HTMLInputElement | null
    const op = (hlOpEl ? parseInt(hlOpEl.value) : 35) / 100
    ctx.fillStyle = `rgba(${rv},${gv},${bv},${op})`
    ctx.fillRect(Math.min(ax, cx), Math.min(ay, cy), Math.abs(cx - ax), Math.abs(cy - ay))
    ctx.strokeStyle = `rgba(${rv},${gv},${bv},${Math.min(1, op + 0.15)})`; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
    ctx.strokeRect(Math.min(ax, cx), Math.min(ay, cy), Math.abs(cx - ax), Math.abs(cy - ay))
    ctx.setLineDash([])
  } else if (activeTool === 'fib_ret') {
    if (!getMinMax) return
    const { min: gMin, max: gMax } = getMinMax(p)
    const cursorPrice = gMin + (gMax - gMin) * (1 - cy / priceH)
    const gH = Math.max(toolAnchor.price, cursorPrice)
    const gL = Math.min(toolAnchor.price, cursorPrice)
    const gSwing = gH - gL
    if (gSwing > 0) {
      const GHOST_LEVELS = [
        { pct: 0.30, col: '#f472b6' }, { pct: 0.40, col: '#fb923c' },
        { pct: 0.50, col: '#facc15' }, { pct: 0.60, col: '#34d399' }, { pct: 0.70, col: '#60a5fa' },
      ]
      ctx.font = `bold ${F.p}px Inter`
      ctx.fillStyle = 'rgba(167,139,250,0.8)'
      ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill()
      for (const fl of GHOST_LEVELS) {
        const price = gH - gSwing * fl.pct
        const y = pToY(price)
        if (y < -2 || y > priceH + 2) continue
        ctx.strokeStyle = fl.col + 'aa'; ctx.lineWidth = 1; ctx.setLineDash([5, 4])
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke(); ctx.setLineDash([])
        const lbl = `${(fl.pct * 100).toFixed(0)}% ${fmtPrice(price)}`
        const tw = ctx.measureText(lbl).width
        ctx.fillStyle = 'rgba(10,12,20,0.65)'
        ctx.fillRect(chartW - tw - 8, y - 11, tw + 6, 13)
        ctx.fillStyle = fl.col + 'cc'; ctx.textAlign = 'right'
        ctx.fillText(lbl, chartW - 4, y - 1)
      }
    }
  }
}
