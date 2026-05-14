/**
 * Indicator line rendering primitives.
 * Extracted from renderPanel() lines 3454-3530.
 *
 * These are pure canvas functions that take value arrays and draw lines/bands.
 * They don't depend on global state — all context comes via RenderContext.
 */

import type { RenderContext } from './render-types'

/** Draw a line from an array of values (skipping nulls). */
export function drawLine(
  rc: RenderContext,
  vals: (number | null)[] | null,
  color: string,
  lw?: number,
  dashed?: boolean
) {
  if (!vals) return
  const { ctx, priceH, vs, visible, xCtr, pToY } = rc
  ctx.strokeStyle = color; ctx.lineWidth = lw || 1.6; ctx.setLineDash(dashed ? [6, 4] : [])
  ctx.beginPath(); let s = false
  for (let i = 0; i < visible.length; i++) {
    const ai = vs + i
    if (vals[ai] == null || isNaN(vals[ai])) { s = false; continue }
    const x = xCtr(i), y = pToY(vals[ai])
    if (y < -2 || y > priceH + 2) { s = false; continue }
    if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
  }
  ctx.stroke(); ctx.setLineDash([])
}

/** Draw filled area between two value arrays (top and bottom). */
export function drawBandFill(
  rc: RenderContext,
  tV: (number | null)[] | null,
  bV: (number | null)[] | null,
  fill: string
) {
  if (!tV || !bV) return
  const { ctx, vs, visible, xCtr, pToY } = rc
  ctx.beginPath(); let s = false
  for (let i = 0; i < visible.length; i++) {
    const ai = vs + i; if (tV[ai] == null) { s = false; continue }
    const x = xCtr(i), y = pToY(tV[ai])
    if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
  }
  for (let i = visible.length - 1; i >= 0; i--) {
    const ai = vs + i; if (bV[ai] == null) continue
    ctx.lineTo(xCtr(i), pToY(bV[ai]))
  }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
}

/** Draw border lines on top and bottom of a band. */
export function drawBandLines(
  rc: RenderContext,
  tV: (number | null)[] | null,
  bV: (number | null)[] | null,
  line: string
) {
  if (!tV || !bV) return
  const { ctx, vs, visible, xCtr, pToY } = rc
  for (const vals of [tV, bV]) {
    ctx.strokeStyle = line; ctx.lineWidth = 1.2; ctx.setLineDash([]); ctx.beginPath(); let s = false
    for (let i = 0; i < visible.length; i++) {
      const ai = vs + i; if (vals[ai] == null) { s = false; continue }
      const x = xCtr(i), y = pToY(vals[ai])
      if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

/**
 * Draw EMA band with crossover-based green/red coloring.
 * Fills and border lines change color based on which EMA is above.
 */
export function drawEMABand(
  rc: RenderContext,
  fastEma: (number | null)[] | null,
  slowEma: (number | null)[] | null,
  fillGreen: string,
  fillRed: string,
  lineGreen: string,
  lineRed: string
) {
  if (!fastEma || !slowEma) return
  const { ctx, vs, visible, xCtr, pToY } = rc
  const top = fastEma, bot = slowEma

  let segStart = -1, segDir: string | null = null
  const flush = (endI: number) => {
    if (segStart < 0) return
    const clr = segDir === 'up' ? fillGreen : fillRed
    ctx.beginPath(); let s = false
    for (let j = segStart; j <= endI; j++) {
      const aj = vs + j; if (top[aj] == null || bot[aj] == null) { s = false; continue }
      const x = xCtr(j), y = pToY(top[aj])
      if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
    }
    for (let j = endI; j >= segStart; j--) {
      const aj = vs + j; if (bot[aj] == null) continue
      ctx.lineTo(xCtr(j), pToY(bot[aj]))
    }
    ctx.closePath(); ctx.fillStyle = clr; ctx.fill()

    for (const vals of [top, bot]) {
      const lc = segDir === 'up' ? lineGreen : lineRed
      ctx.strokeStyle = lc; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.beginPath(); let ls = false
      for (let j = segStart; j <= endI; j++) {
        const aj = vs + j; if (vals[aj] == null) { ls = false; continue }
        const x = xCtr(j), y = pToY(vals[aj])
        if (!ls) { ctx.moveTo(x, y); ls = true } else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  for (let i = 0; i < visible.length; i++) {
    const ai = vs + i
    if (top[ai] == null || bot[ai] == null) { flush(i - 1); segStart = -1; segDir = null; continue }
    const dir = top[ai] >= bot[ai] ? 'up' : 'dn'
    if (dir !== segDir) { flush(i - 1); segStart = i; segDir = dir }
    else if (segStart < 0) { segStart = i; segDir = dir }
  }
  flush(visible.length - 1)
}

/**
 * Draw deviation band (ATR-based).
 * Upper = fastEMA + (mult × fastATR), Lower = slowEMA - (mult × slowATR)
 */
export function drawDevBand(
  rc: RenderContext,
  fastEma: (number | null)[] | null,
  fastAtr: (number | null)[] | null,
  slowEma: (number | null)[] | null,
  slowAtr: (number | null)[] | null,
  upMults: number[],
  dnMults: number[],
  upFill: string,
  upLine: string,
  dnFill: string,
  dnLine: string
) {
  if (!fastEma || !fastAtr || !slowEma || !slowAtr) return
  const up1 = fastEma.map((v, i) => v! + (fastAtr[i] || 0) * upMults[0])
  const up2 = fastEma.map((v, i) => v! + (fastAtr[i] || 0) * upMults[1])
  const dn1 = slowEma.map((v, i) => v! - (slowAtr[i] || 0) * dnMults[0])
  const dn2 = slowEma.map((v, i) => v! - (slowAtr[i] || 0) * dnMults[1])
  drawBandFill(rc, up1, up2, upFill); drawBandLines(rc, up1, up2, upLine)
  drawBandFill(rc, dn1, dn2, dnFill); drawBandLines(rc, dn1, dn2, dnLine)
}
