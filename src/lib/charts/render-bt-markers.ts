/**
 * Backtest marker rendering — entry/exit arrows, stop lines, labels.
 * Extracted from renderPanel() lines ~4318-4402.
 */

import type { RenderContext } from './render-types'
import { isIntraday } from './format'

export function renderBtMarkers(rc: RenderContext) {
  const btMarkers = (window as any).btMarkers || []
  const btStrategyMode = (window as any).btStrategyMode || 'long'
  const p = rc as any

  if (!btMarkers.length || !p.showBtExec) return

  const { ctx, chartW, priceH, visible, barW, pToY, annTimeToX, tf } = rc
  const useDate = !isIntraday(tf)

  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip()

  // Smart label placement helper
  const placeLbl = (ctx: CanvasRenderingContext2D, lbl: string, col: string, x: number, anchorY: number, prefBelow: boolean) => {
    ctx.font = 'bold 11px Inter'
    const tw = ctx.measureText(lbl).width
    const th = 12, pad = 4

    // Find nearby candle Y ranges
    const nearBars: any[] = []
    for (let ni = 0; ni < visible.length; ni++) {
      const bx = (ni + 0.5) * barW
      if (Math.abs(bx - x) < barW * 2.5) nearBars.push(visible[ni])
    }
    const candleHighY = nearBars.length ? Math.min(...nearBars.map(b => pToY(b.high))) : 0
    const candleLowY = nearBars.length ? Math.max(...nearBars.map(b => pToY(b.low))) : priceH

    const below = { tx: x, ty: anchorY + pad + th, align: 'center' as const }
    const above = { tx: x, ty: anchorY - pad, align: 'center' as const }
    const right = { tx: x + tw / 2 + pad + 4, ty: anchorY + 4, align: 'left' as const }
    const left = { tx: x - tw / 2 - pad - 4, ty: anchorY + 4, align: 'right' as const }

    const score = (pos: { tx: number; ty: number; align: string }) => {
      let penalty = 0
      if (pos.ty > candleHighY && pos.ty - th < candleLowY) penalty += 100
      if (pos.ty < 0 || pos.ty > priceH) penalty += 200
      const txtL = pos.align === 'left' ? pos.tx : pos.align === 'right' ? pos.tx - tw : pos.tx - tw / 2
      if (txtL < 0) penalty += 50
      if (txtL + tw > chartW) penalty += 50
      return penalty
    }

    const candidates = prefBelow ? [below, above, right, left] : [above, below, right, left]
    candidates.sort((a, b) => score(a) - score(b))
    const best = candidates[0]
    ctx.textAlign = best.align

    const bgX = best.align === 'center' ? best.tx - tw / 2 - 2 : best.align === 'left' ? best.tx - 2 : best.tx - tw - 2
    ctx.fillStyle = 'rgba(10,12,20,0.75)'
    ctx.fillRect(bgX, best.ty - th, tw + 4, th + 2)
    ctx.fillStyle = col
    ctx.fillText(lbl, best.tx, best.ty)
  }

  for (const m of btMarkers) {
    const matchTime = useDate ? m.date : m.time
    const x = annTimeToX(matchTime)
    if (x == null) continue
    const y = pToY(m.price)
    const isEntry = m.type === 'entry'
    const isStop = m.type === 'stop'

    if (isStop) {
      const halfW = Math.max(14, barW * 2.5)
      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(x - halfW, y); ctx.lineTo(x + halfW, y); ctx.stroke()
      ctx.setLineDash([])
      placeLbl(ctx, 'S:' + m.label, '#facc15', x + halfW + ctx.measureText('S:' + m.label).width / 2 + 4, y, false)
      continue
    }

    const col = (btStrategyMode === 'long') ? (isEntry ? '#00e676' : '#ff5252') : (isEntry ? '#ff5252' : '#00e676')
    const size = 7
    ctx.beginPath()
    if (isEntry) {
      ctx.moveTo(x, y - size - 2); ctx.lineTo(x + size, y + 2); ctx.lineTo(x - size, y + 2)
    } else {
      ctx.moveTo(x, y + size + 2); ctx.lineTo(x + size, y - 2); ctx.lineTo(x - size, y - 2)
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill()
    placeLbl(ctx, m.label, col, x, isEntry ? y + size + 2 : y - size - 2, isEntry)
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, priceH); ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.restore()
}
