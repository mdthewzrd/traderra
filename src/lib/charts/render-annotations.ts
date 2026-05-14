/**
 * Annotation rendering — draws all drawing tool annotations on the chart.
 * Extracted from renderPanel() lines 3805-4191.
 *
 * Handles: trendlines, rays, boxes, text, highlights, callouts, notes,
 * price labels, flags, fibonacci, positions, execution arrows, stop lines.
 */

import type { RenderContext } from './render-types'
import { C, F } from './theme'
import { fmtPrice } from './format'
import { drawHandle, wrapText, annLineWidth, annLineDash, isPointArrayAnn, getScreenPointsFromAnn, getPointBounds } from './canvas-utils'

// Re-export these for legacy bridge
export { isPointArrayAnn, getScreenPointsFromAnn }

/** Render all annotations for a panel */
export function renderAnnotations(rc: RenderContext) {
  const { ctx, data, W, H, chartW, PRICE_W, priceH, visible, vs, barW, cx, cy, xCtr, pToY, annTimeToX } = rc
  const p = rc as any
  const annotations: any[] = (window as any).annotations || []
  const activeTool = (window as any).activeTool
  const _hideAll = (window as any)._hideAll
  const isAnnNear = (window as any).isAnnNear
  const selectedAnn = (window as any).selectedAnn
  const renderAdvancedAnnotation = (window as any).renderAdvancedAnnotation

  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip()

  if (p.showTL || p.showAnn) {
    for (const ann of annotations) {
      const isTL = ann.type === 'trendline' || ann.type === 'ray' || ann.type === 'hray' || ann.type === 'parallel' || ann.type === 'disjoint' || ann.type === 'xline'
      const isBox = ann.type.startsWith('box_') || ann.type === 'circle' || ann.type === 'ellipse' || ann.type === 'triangle' || ann.type === 'gann_box'
      const isTxt = ann.type.startsWith('text_')
      const isHl = ann.type.startsWith('hl_') || ann.type === 'brush' || ann.type === 'path'
      const isCallout = ann.type === 'callout'
      const isNote = ann.type === 'note'
      const isPriceLbl = ann.type === 'price_label'
      const isFlag = ann.type === 'flag'
      const isExecAnn = ann.type === 'entry_arrow' || ann.type === 'exit_arrow' || ann.type === 'short_arrow' || ann.type === 'cover_arrow' || ann.type === 'stop_line' || ann.type === 'trail_stop'
      const isFib = ann.type === 'fib_ret'
      const isHLine = ann.type === 'hline'
      const isVLine = ann.type === 'vline'
      const isPos = ann.type === 'long_pos' || ann.type === 'short_pos'

      if (_hideAll) continue
      if (isTL && !p.showTL) continue
      if ((isBox || isTxt || isHl || isCallout || isNote || isPriceLbl || isFlag) && !p.showAnn) continue
      if (isExecAnn && !p.showExec) continue
      if (!p.showOtherAnn && ann.panelIdx != null && ann.panelIdx !== p.idx) continue
      if (!isTL && !isBox && !isTxt && !isHl && !isExecAnn && !isFib && !isHLine && !isVLine && !isPos && !isCallout && !isNote && !isPriceLbl && !isFlag) continue
      if (ann.hidden) continue

      const annAlpha = ann.opacity != null ? ann.opacity : 1
      if (annAlpha < 1) ctx.globalAlpha = annAlpha

      // Try advanced annotation renderer first
      if (renderAdvancedAnnotation && renderAdvancedAnnotation(ctx, ann, p, chartW, priceH, chartW, priceH, annTimeToX, pToY)) {
        ctx.globalAlpha = 1
        // Delete/edit hover highlight
        if ((activeTool === 'del' || activeTool === 'edit') && cx >= 0 && cy >= 0 && isAnnNear && isAnnNear(ann, cx, cy, p, annTimeToX, pToY)) {
          const hlCol = activeTool === 'edit' ? 'rgba(251,191,36,0.7)' : 'rgba(255,61,87,0.7)'
          ctx.strokeStyle = hlCol; ctx.lineWidth = 2; ctx.setLineDash([4, 3])
          if (isPointArrayAnn(ann)) {
            const pts = getScreenPointsFromAnn(ann, annTimeToX, pToY), bounds = getPointBounds(pts)
            if (bounds) ctx.strokeRect(bounds.minX - 4, bounds.minY - 4, bounds.maxX - bounds.minX + 8, bounds.maxY - bounds.minY + 8)
          } else {
            const x1 = annTimeToX(ann.x1), y1 = pToY(ann.y1)
            const x2 = ann.x2 != null ? annTimeToX(ann.x2) : x1, y2 = ann.y2 != null ? pToY(ann.y2) : y1
            if (x1 != null) ctx.strokeRect(Math.min(x1, x2) - 4, Math.min(y1, y2) - 4, Math.abs((x2 ?? x1) - x1) + 8, Math.abs((y2 ?? y1) - y1) + 8)
          }
          ctx.setLineDash([])
        }
        continue
      }

      // ── Fibonacci retracement ──
      if (isFib) {
        renderFib(ctx, rc, ann)
        ctx.globalAlpha = 1
        continue
      }

      // ── Position (long/short) ──
      if (isPos) {
        renderPosition(ctx, rc, ann)
        ctx.globalAlpha = 1
        continue
      }

      // ── Execution arrows ──
      if (isExecAnn) {
        renderExecAnnotation(ctx, rc, ann)
        ctx.globalAlpha = 1
        continue
      }

      const x1 = annTimeToX(ann.x1); if (x1 == null) { ctx.globalAlpha = 1; continue }
      const y1 = pToY(ann.y1)

      // ── Horizontal line ──
      if (isHLine) {
        ctx.strokeStyle = ann.color || C.trendline; ctx.lineWidth = annLineWidth(ann); ctx.setLineDash(annLineDash(ann))
        ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(chartW, y1); ctx.stroke(); ctx.setLineDash([])
      }
      // ── Vertical line ──
      else if (isVLine) {
        const vx = annTimeToX(ann.x1); if (vx == null) { ctx.globalAlpha = 1; continue }
        ctx.strokeStyle = ann.color || C.trendline; ctx.lineWidth = annLineWidth(ann); ctx.setLineDash(annLineDash(ann))
        ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, priceH); ctx.stroke(); ctx.setLineDash([])
      }
      // ── Trendline ──
      else if (isTL) {
        const x2 = annTimeToX(ann.x2); if (x2 == null) { ctx.globalAlpha = 1; continue }
        const y2 = pToY(ann.y2)
        ctx.strokeStyle = ann.color || C.trendline; ctx.lineWidth = annLineWidth(ann); ctx.setLineDash(annLineDash(ann))
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([])
        // Endpoints
        ctx.fillStyle = ann.color || C.trendline
        ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = C.bg
        ctx.beginPath(); ctx.arc(x1, y1, 1.5, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x2, y2, 1.5, 0, Math.PI * 2); ctx.fill()
      }
      // ── Box ──
      else if (isBox) {
        const x2 = annTimeToX(ann.x2); if (x2 == null) { ctx.globalAlpha = 1; continue }
        const y2 = pToY(ann.y2)
        const col = ann.type === 'box_orange' ? C.box_orange : C.box_yellow
        const bxX = Math.min(x1, x2), bxY = Math.min(y1, y2), bxW = Math.abs(x2 - x1), bxH = Math.abs(y2 - y1)
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([])
        ctx.strokeRect(bxX, bxY, bxW, bxH)
        const rv = parseInt(col.slice(1, 3), 16), gv = parseInt(col.slice(3, 5), 16), bv = parseInt(col.slice(5, 7), 16)
        ctx.fillStyle = `rgba(${rv},${gv},${bv},0.07)`; ctx.fillRect(bxX, bxY, bxW, bxH)
      }
      // ── Text ──
      else if (isTxt) {
        renderTextAnnotation(ctx, rc, ann, x1, y1)
      }
      // ── Highlight ──
      else if (isHl) {
        const x2 = annTimeToX(ann.x2); if (x2 == null) { ctx.globalAlpha = 1; continue }
        const y2 = pToY(ann.y2)
        const col = (C as any)[ann.type] || '#22d3ee'
        const bxX = Math.min(x1, x2), bxY = Math.min(y1, y2), bxW = Math.abs(x2 - x1), bxH = Math.abs(y2 - y1)
        const rv = parseInt(col.slice(1, 3), 16), gv = parseInt(col.slice(3, 5), 16), bv = parseInt(col.slice(5, 7), 16)
        const op = ann.opacity ?? 0.15
        ctx.fillStyle = `rgba(${rv},${gv},${bv},${op})`; ctx.fillRect(bxX, bxY, bxW, bxH)
        ctx.strokeStyle = `rgba(${rv},${gv},${bv},${Math.min(1, op + 0.15)})`; ctx.lineWidth = 1; ctx.setLineDash([])
        ctx.strokeRect(bxX, bxY, bxW, bxH)
      }
      // ── Callout ──
      else if (isCallout) {
        renderCallout(ctx, rc, ann)
      }
      // ── Note ──
      else if (isNote) {
        renderNote(ctx, rc, ann, x1, y1)
      }
      // ── Price label ──
      else if (isPriceLbl) {
        renderPriceLabel(ctx, rc, ann, y1)
      }
      // ── Flag ──
      else if (isFlag) {
        renderFlag(ctx, rc, ann, x1, y1)
      }

      // Reset
      ctx.globalAlpha = 1

      // Delete hover highlight for simple types
      if (activeTool === 'del' && cx >= 0 && cy >= 0 && isAnnNear && isAnnNear(ann, cx, cy, p, annTimeToX, pToY)) {
        ctx.strokeStyle = 'rgba(255,61,87,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3])
        if (isTL) { const x2 = annTimeToX(ann.x2) || x1, y2 = pToY(ann.y2); ctx.beginPath(); ctx.moveTo(x1 - 4, y1 - 4); ctx.lineTo(x2 + 4, y2 + 4); ctx.stroke() }
        else if (isBox || isHl) { const x2 = annTimeToX(ann.x2) || x1, y2 = pToY(ann.y2); ctx.strokeRect(Math.min(x1, x2) - 3, Math.min(y1, y2) - 3, Math.abs(x2 - x1) + 6, Math.abs(y2 - y1) + 6) }
        else if (isTxt) { ctx.strokeRect(x1 - 3, y1 - 14, 60, 18) }
        ctx.setLineDash([])
      }
    }
  }

  // ── Selection highlight ──
  if (selectedAnn && selectedAnn.panelIdx === p.idx) {
    renderSelectionHighlight(ctx, rc, selectedAnn)
  }

  ctx.restore()
}

// ── Sub-renderers ──

function renderFib(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any) {
  const { chartW, priceH, pToY, annTimeToX } = rc
  const fibHigh = Math.max(ann.y1, ann.y2)
  const fibLow = Math.min(ann.y1, ann.y2)
  const swing = fibHigh - fibLow
  if (swing <= 0) return

  const FIB_LEVELS = [
    { pct: 0.30, col: '#f472b6', label: '30%' },
    { pct: 0.40, col: '#fb923c', label: '40%' },
    { pct: 0.50, col: '#facc15', label: '50%' },
    { pct: 0.60, col: '#34d399', label: '60%' },
    { pct: 0.70, col: '#60a5fa', label: '70%' },
  ]

  ctx.font = `bold ${F.p}px Inter`
  for (const fl of FIB_LEVELS) {
    const price = fibHigh - swing * fl.pct
    const y = pToY(price)
    if (y < -2 || y > priceH + 2) continue
    ctx.strokeStyle = fl.col; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4])
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke(); ctx.setLineDash([])
    const lbl = `${fl.label} ${fmtPrice(price)}`
    const tw = ctx.measureText(lbl).width
    ctx.fillStyle = 'rgba(10,12,20,0.78)'
    ctx.fillRect(chartW - tw - 8, y - 11, tw + 6, 13)
    ctx.fillStyle = fl.col; ctx.textAlign = 'right'
    ctx.fillText(lbl, chartW - 4, y - 1)
  }
  for (const bPrice of [fibHigh, fibLow]) {
    const y = pToY(bPrice)
    if (y < -2 || y > priceH + 2) continue
    ctx.strokeStyle = 'rgba(167,139,250,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartW, y); ctx.stroke(); ctx.setLineDash([])
  }
}

function renderPosition(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any) {
  const { chartW, priceH, pToY, annTimeToX } = rc
  const x = annTimeToX(ann.x1); if (x == null) return
  const entry = ann.y1, tp = ann.y2, stop = ann.y3 || 0
  if (!stop) return
  const ey = pToY(entry), tpy = pToY(tp), sty = pToY(stop)
  ctx.fillStyle = 'rgba(38,166,154,.08)'
  ctx.fillRect(x - 20, Math.min(ey, tpy), chartW - x + 20, Math.abs(tpy - ey))
  ctx.fillStyle = 'rgba(239,83,80,.08)'
  ctx.fillRect(x - 20, Math.min(ey, sty), chartW - x + 20, Math.abs(sty - ey))
  ctx.setLineDash([4, 3]); ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(38,166,154,.5)'; ctx.beginPath(); ctx.moveTo(x - 20, tpy); ctx.lineTo(chartW, tpy); ctx.stroke()
  ctx.strokeStyle = 'rgba(221,227,240,.3)'; ctx.beginPath(); ctx.moveTo(x - 20, ey); ctx.lineTo(chartW, ey); ctx.stroke()
  ctx.strokeStyle = 'rgba(239,83,80,.5)'; ctx.beginPath(); ctx.moveTo(x - 20, sty); ctx.lineTo(chartW, sty); ctx.stroke()
  ctx.setLineDash([])
  ctx.textAlign = 'right'; ctx.font = 'bold 10px Inter'
  const tpPct = ((Math.abs(tp - entry) / entry) * 100).toFixed(1)
  ctx.fillStyle = 'rgba(10,12,20,.8)'; ctx.fillRect(chartW - 74, tpy - 10, 72, 14)
  ctx.fillStyle = '#26a69a'; ctx.fillText('TP ' + fmtPrice(tp) + ' +' + tpPct + '%', chartW - 4, tpy + 2)
  ctx.fillStyle = 'rgba(10,12,20,.8)'; ctx.fillRect(chartW - 74, ey - 10, 72, 14)
  ctx.fillStyle = '#dde3f0'; ctx.fillText('E ' + fmtPrice(entry), chartW - 4, ey + 2)
  const stPct = ((Math.abs(stop - entry) / entry) * 100).toFixed(1)
  ctx.fillStyle = 'rgba(10,12,20,.8)'; ctx.fillRect(chartW - 74, sty - 10, 72, 14)
  ctx.fillStyle = '#ef5350'; ctx.fillText('SL ' + fmtPrice(stop) + ' -' + stPct + '%', chartW - 4, sty + 2)
  const rr = Math.abs(tp - entry) / Math.abs(entry - stop)
  const rrY = (ey + tpy) / 2
  ctx.fillStyle = 'rgba(10,12,20,.85)'; ctx.fillRect(x - 58, rrY - 8, 54, 16)
  ctx.fillStyle = '#D4AF37'; ctx.font = 'bold 11px Inter'
  ctx.textAlign = 'center'; ctx.fillText('R:R ' + rr.toFixed(2), x - 31, rrY + 4)
  ctx.textAlign = 'right'
}

function renderExecAnnotation(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any) {
  const { chartW, priceH, visible, barW, xCtr, pToY, annTimeToX, cx, cy } = rc
  const p = rc as any
  const activeTool = (window as any).activeTool
  const isAnnNear = (window as any).isAnnNear
  const x = annTimeToX(ann.x1); if (x == null) return
  const y = pToY(ann.y1)
  const lbl = ann.label || fmtPrice(ann.y1)
  const size = 7

  const placeLbl = placeLabelHelper(ctx, rc, x)

  if (ann.type === 'entry_arrow') {
    const col = '#ff9800'
    ctx.beginPath(); ctx.moveTo(x, y - size - 2); ctx.lineTo(x + size, y + 2); ctx.lineTo(x - size, y + 2); ctx.closePath()
    ctx.fillStyle = col; ctx.fill()
    const prefBelow = ann.stopPrice == null
    placeLbl(lbl, col, ann.stopPrice != null ? y - size - 2 : y + size + 2, prefBelow)
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke(); ctx.setLineDash([])
  } else if (ann.type === 'exit_arrow') {
    const col = '#40c4ff'
    ctx.beginPath(); ctx.moveTo(x, y + size + 2); ctx.lineTo(x + size, y - 2); ctx.lineTo(x - size, y - 2); ctx.closePath()
    ctx.fillStyle = col; ctx.fill()
    placeLbl(lbl, col, y - size - 2, false)
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke(); ctx.setLineDash([])
  } else if (ann.type === 'short_arrow') {
    const col = '#ff5252'
    ctx.beginPath(); ctx.moveTo(x, y + size + 2); ctx.lineTo(x + size, y - 2); ctx.lineTo(x - size, y - 2); ctx.closePath()
    ctx.fillStyle = col; ctx.fill()
    const prefBelow2 = ann.stopPrice == null
    placeLbl(lbl, col, ann.stopPrice != null ? y + size + 2 : y - size - 2, prefBelow2)
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke(); ctx.setLineDash([])
  } else if (ann.type === 'cover_arrow') {
    const col = '#00e676'
    ctx.beginPath(); ctx.moveTo(x, y - size - 2); ctx.lineTo(x + size, y + 2); ctx.lineTo(x - size, y + 2); ctx.closePath()
    ctx.fillStyle = col; ctx.fill()
    placeLbl(lbl, col, y + size + 2, true)
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke(); ctx.setLineDash([])
  } else if (ann.type === 'stop_line') {
    if (ann._autoStop) {
      const leftW = Math.max(14, barW * 1.5), rightW = Math.max(60, barW * 8)
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(x - leftW, y); ctx.lineTo(x + rightW, y); ctx.stroke(); ctx.setLineDash([])
      ctx.font = `bold ${F.p}px Inter`; ctx.textAlign = 'left'
      const slbl2 = 'S:' + lbl; const sw = ctx.measureText(slbl2).width
      const lx = x + rightW + 3, ly = y + 4
      ctx.fillStyle = 'rgba(10,12,20,0.8)'; ctx.fillRect(lx - 2, ly - 10, sw + 4, 12)
      ctx.fillStyle = '#facc15'; ctx.fillText(slbl2, lx, ly)
    } else {
      const halfW = Math.max(14, barW * 2.5)
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(x - halfW, y); ctx.lineTo(x + halfW, y); ctx.stroke(); ctx.setLineDash([])
      placeLbl('S:' + lbl, '#facc15', y, false)
    }
  } else if (ann.type === 'trail_stop') {
    const halfW = Math.max(14, barW * 2.5)
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 2])
    ctx.beginPath(); ctx.moveTo(x - halfW, y); ctx.lineTo(x + halfW, y); ctx.stroke(); ctx.setLineDash([])
    placeLbl('T:' + lbl, '#38bdf8', y, false)
  }

  if ((activeTool === 'del' || activeTool === 'edit') && cx >= 0 && cy >= 0 && isAnnNear && isAnnNear(ann, cx, cy, p, annTimeToX, pToY)) {
    const hlCol = activeTool === 'edit' ? 'rgba(251,191,36,0.7)' : 'rgba(255,61,87,0.7)'
    ctx.strokeStyle = hlCol; ctx.lineWidth = 2; ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
  }
}

function renderTextAnnotation(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any, x1: number, y1: number) {
  const tCol = ann.type === 'text_orange' ? C.box_orange : C.box_yellow
  const txt = ann.text || ''
  const fs = ann.fontSize || 11
  ctx.font = `${ann.fontWeight || 'bold'} ${fs}px Inter`
  const tw = ctx.measureText(txt).width
  const pad = 6, bh = fs + pad * 2, bw = tw + pad * 2
  const bx = x1 - 2, by = y1 - fs - pad + 2
  const r = parseInt(tCol.slice(1, 3), 16), g = parseInt(tCol.slice(3, 5), 16), b = parseInt(tCol.slice(5, 7), 16)
  ctx.fillStyle = `rgba(${r},${g},${b},0.12)`
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill()
  ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.stroke()
  ctx.fillStyle = tCol; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  ctx.fillText(txt, bx + pad, by + pad)
  ctx.textBaseline = 'alphabetic'
}

function renderCallout(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any) {
  const { pToY, annTimeToX } = rc
  const x1 = annTimeToX(ann.x1), x2 = annTimeToX(ann.x2); if (x1 == null || x2 == null) return
  const y1 = pToY(ann.y1), y2 = pToY(ann.y2)
  const txt = ann.text || 'Callout'; const fs = ann.fontSize || 11
  ctx.font = `bold ${fs}px Inter`
  const tw = ctx.measureText(txt).width; const pad = 8, bh = fs + pad * 2, bw = tw + pad * 2
  const bx = x2 - bw / 2, by = y2 - bh / 2
  ctx.strokeStyle = ann.color || '#f97316'; ctx.lineWidth = 1.5; ctx.setLineDash([])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.fillStyle = ann.color || '#f97316'
  ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(20,25,38,0.95)'
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill()
  ctx.strokeStyle = ann.color || '#f97316'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.stroke()
  ctx.fillStyle = ann.color || '#f97316'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(txt, x2, y2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

function renderNote(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any, x1: number, y1: number) {
  const txt = ann.text || 'Note'; const fs = ann.fontSize || 11; const noteW = ann.noteWidth || 120
  ctx.font = `${fs}px Inter`
  const lines = wrapText(ctx, txt, noteW - 16)
  const lh = fs * 1.35; const noteH = Math.max(lines.length * lh + 16, fs + 20); const foldSize = 10
  const noteCol = ann.noteColor || '#fbbf24'
  const nr = parseInt(noteCol.slice(1, 3), 16), ng = parseInt(noteCol.slice(3, 5), 16), nb = parseInt(noteCol.slice(5, 7), 16)
  ctx.fillStyle = `rgba(${nr},${ng},${nb},0.15)`
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x1 + noteW - foldSize, y1); ctx.lineTo(x1 + noteW, y1 + foldSize)
  ctx.lineTo(x1 + noteW, y1 + noteH); ctx.lineTo(x1, y1 + noteH); ctx.closePath(); ctx.fill()
  ctx.fillStyle = `rgba(${nr},${ng},${nb},0.3)`
  ctx.beginPath()
  ctx.moveTo(x1 + noteW - foldSize, y1); ctx.lineTo(x1 + noteW - foldSize, y1 + foldSize)
  ctx.lineTo(x1 + noteW, y1 + foldSize); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = `rgba(${nr},${ng},${nb},0.4)`; ctx.lineWidth = 1; ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x1 + noteW - foldSize, y1); ctx.lineTo(x1 + noteW, y1 + foldSize)
  ctx.lineTo(x1 + noteW, y1 + noteH); ctx.lineTo(x1, y1 + noteH); ctx.closePath(); ctx.stroke()
  ctx.fillStyle = noteCol; ctx.beginPath(); ctx.arc(x1 + 6, y1 + 3, 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#dde3f0'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], x1 + 8, y1 + 10 + i * lh)
  ctx.textBaseline = 'alphabetic'
}

function renderPriceLabel(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any, y1: number) {
  const { W, PRICE_W } = rc
  const p = rc as any
  const txt = ann.text || (ann.y1 ? ann.y1.toFixed(2) : '')
  const fs = ann.fontSize || 10
  ctx.font = `bold ${fs}px Inter`
  const tw = ctx.measureText(txt).width
  const pad = 6, bh = fs + pad * 2, bw = tw + pad * 2 + 6
  const pRight = W - PRICE_W; const lx = pRight - 4, ly = y1 - bh / 2
  ctx.fillStyle = ann.color || '#26a69a'
  ctx.beginPath(); ctx.roundRect(lx - bw, ly, bw, bh, bh / 2); ctx.fill()
  ctx.beginPath(); ctx.moveTo(lx, y1 - 4); ctx.lineTo(lx + 4, y1); ctx.lineTo(lx, y1 + 4); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#000'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.fillText(txt, lx - pad, ly + bh / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

function renderFlag(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any, x1: number, y1: number) {
  const flagCol = ann.color || '#ef5350'
  const fr = parseInt(flagCol.slice(1, 3), 16), fg = parseInt(flagCol.slice(3, 5), 16), fb = parseInt(flagCol.slice(5, 7), 16)
  ctx.strokeStyle = flagCol; ctx.lineWidth = 1.5; ctx.setLineDash([])
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 - 24); ctx.stroke()
  ctx.fillStyle = `rgba(${fr},${fg},${fb},0.8)`
  ctx.beginPath(); ctx.moveTo(x1, y1 - 24); ctx.lineTo(x1 + 16, y1 - 20); ctx.lineTo(x1, y1 - 16); ctx.closePath(); ctx.fill()
  if (ann.text) {
    ctx.font = 'bold 9px Inter'; ctx.fillStyle = flagCol; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(ann.text, x1 + 20, y1 - 20); ctx.textBaseline = 'alphabetic'
  }
}

function renderSelectionHighlight(ctx: CanvasRenderingContext2D, rc: RenderContext, ann: any) {
  const { chartW, priceH, pToY, annTimeToX } = rc
  const activeTool = (window as any).activeTool

  if (isPointArrayAnn(ann)) {
    const pts = getScreenPointsFromAnn(ann, annTimeToX, pToY)
    const bounds = getPointBounds(pts)
    if (bounds) {
      ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 2; ctx.setLineDash([])
      ctx.strokeRect(bounds.minX - 3, bounds.minY - 3, bounds.maxX - bounds.minX + 6, bounds.maxY - bounds.minY + 6)
      drawHandle(ctx, bounds.minX, bounds.minY, '#D4AF37')
      drawHandle(ctx, bounds.maxX, bounds.maxY, '#D4AF37')
    }
  } else {
    const x1 = annTimeToX(ann.x1), y1 = pToY(ann.y1)
    if (x1 == null) return
    const x2 = ann.x2 != null ? annTimeToX(ann.x2) : x1
    const y2 = ann.y2 != null ? pToY(ann.y2) : y1
    drawHandle(ctx, x1, y1, '#D4AF37')
    if (x2 != null && ann.type !== 'hline' && ann.type !== 'vline') {
      drawHandle(ctx, x2, y2, '#D4AF37')
    }
    if (ann.type === 'parallel' || ann.type === 'disjoint' || ann.type === 'long_pos' || ann.type === 'short_pos') {
      const x3 = annTimeToX(ann.x3), y3 = pToY(ann.y3)
      if (x3 != null) drawHandle(ctx, x3, y3, '#D4AF37')
    }
  }
}

/** Smart label placement helper for execution arrows */
function placeLabelHelper(ctx: CanvasRenderingContext2D, rc: RenderContext, anchorX: number) {
  const { chartW, priceH, visible, barW, xCtr, pToY } = rc
  return (lbl: string, col: string, anchorY: number, prefBelow: boolean) => {
    ctx.font = 'bold 11px Inter'
    const tw = ctx.measureText(lbl).width, th = 12, pad = 4
    const nearBars: any[] = []
    for (let ni = 0; ni < visible.length; ni++) {
      const bx = (ni + 0.5) * barW; if (Math.abs(bx - anchorX) < barW * 2.5) nearBars.push(visible[ni])
    }
    const chY = nearBars.length ? Math.min(...nearBars.map(b => pToY(b.high))) : 0
    const clY = nearBars.length ? Math.max(...nearBars.map(b => pToY(b.low))) : priceH
    type Cand = { tx: number; ty: number; al: CanvasTextAlign }
    const cands: Cand[] = prefBelow
      ? [{ tx: anchorX, ty: anchorY + pad + th, al: 'center' }, { tx: anchorX, ty: anchorY - pad, al: 'center' }, { tx: anchorX + tw / 2 + pad + 4, ty: anchorY + 4, al: 'left' }, { tx: anchorX - tw / 2 - pad - 4, ty: anchorY + 4, al: 'right' }]
      : [{ tx: anchorX, ty: anchorY - pad, al: 'center' }, { tx: anchorX, ty: anchorY + pad + th, al: 'center' }, { tx: anchorX + tw / 2 + pad + 4, ty: anchorY + 4, al: 'left' }, { tx: anchorX - tw / 2 - pad - 4, ty: anchorY + 4, al: 'right' }]
    const sc = (pos: Cand) => {
      let pen = 0
      if (pos.ty > chY && (pos.ty - th) < clY) pen += 100
      if (pos.ty < 0 || pos.ty > priceH) pen += 200
      const tl = pos.al === 'center' ? pos.tx - tw / 2 : pos.al === 'left' ? pos.tx : pos.tx - tw
      if (tl < 0) pen += 50; if (tl + tw > chartW) pen += 50
      return pen
    }
    cands.sort((a, b) => sc(a) - sc(b))
    const best = cands[0]
    ctx.textAlign = best.al
    const bgX = best.al === 'center' ? best.tx - tw / 2 - 2 : best.al === 'left' ? best.tx - 2 : best.tx - tw - 2
    ctx.fillStyle = 'rgba(10,12,20,0.75)'; ctx.fillRect(bgX, best.ty - th, tw + 4, th + 2)
    ctx.fillStyle = col; ctx.fillText(lbl, best.tx, best.ty)
  }
}
