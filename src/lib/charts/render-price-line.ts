/**
 * Live price line — dashed horizontal line at last close price.
 * Extracted from renderPanel() lines 4486-4509.
 */

import type { RenderContext } from './render-types'
import { C, F } from './theme'
import { fmtPrice } from './format'

function colorToHex(col: string): string {
  if (col && col[0] === '#') return col.length === 4 ? '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3] : col
  return '#ffffff'
}

export function renderLivePriceLine(rc: RenderContext) {
  const showPriceLine = (window as any).showPriceLine
  const { ctx, data, W, chartW, PRICE_W, priceH, pToY } = rc

  if (!showPriceLine || !data.length) return

  const lastClose = data[data.length - 1].close
  const ly = pToY(lastClose)
  if (ly < 0 || ly > priceH) return

  const lineCol = data[data.length - 1].close >= data[data.length - 1].open ? C.up : C.dn

  ctx.save()
  ctx.strokeStyle = lineCol; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3])
  ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(chartW, ly); ctx.stroke()
  ctx.setLineDash([])

  // Price label background
  ctx.fillStyle = lineCol
  ctx.fillRect(chartW, ly - 10, PRICE_W, 20)

  // Text with contrast
  const hex = colorToHex(lineCol)
  const lum = (parseInt(hex.slice(1, 3), 16) * 299 + parseInt(hex.slice(3, 5), 16) * 587 + parseInt(hex.slice(5, 7), 16) * 114) / 1000
  ctx.fillStyle = lum > 160 ? '#000' : '#fff'
  ctx.font = `bold ${F.p}px Inter`
  ctx.textAlign = 'right'
  ctx.fillText(fmtPrice(lastClose), W - 4, ly + 4)
  ctx.restore()
}
