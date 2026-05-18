/**
 * Engine override — replaces inline JS functions with TypeScript module versions.
 *
 * Strategy: Let the original renderPanel run fully, then overlay our TS modules
 * on top. This means the inline code still draws grid/axes/candles as before,
 * but our TS versions can override specific sections by drawing on top.
 *
 * For a clean cutover, we save the original renderPanel and create a new one
 * that:
 * 1. Runs the original (indicators + candles need it)
 * 2. Then overlays our TS versions of annotations, crosshair, BT markers, etc.
 *
 * As more sections are migrated, we remove them from the inline code.
 */

import { renderAnnotations } from './render-annotations'
import { renderAnnotationPreview } from './render-preview'
import { renderCrosshair } from './render-crosshair'
import { renderBtMarkers } from './render-bt-markers'
import { renderLivePriceLine } from './render-price-line'
import { renderBtHighlights, renderSessionShading } from './render-session'
import { renderVolume } from './render-volume'
import { renderGrid, renderPriceAxis, renderTimeAxis } from './render-grid'
import { renderCandles } from './render-candles'
import { renderPanelSetup } from './render-panel'
import { fmtPrice, fmtVol, fmtTimeAxis, fmtTimeCross, getNY, nyMins, isIntraday } from './format'
import { calcEMA, calcSMA, calcBollinger, calcVolSMA, calcVWAP, calcATR } from './indicators'
import { C, F } from './theme'

// Feature flags — set to false to use inline JS for that section
const FLAGS = {
  overrideRenderPanel: true,
  useTsGrid: true,         // grid lines + price/time axes
  useTsSession: true,      // BT highlights + session shading + PDC
  useTsVolume: true,       // volume bars + separator
  useTsCandles: true,      // 7 chart styles (candles, line, area, etc.)
  useTsAnnotations: true,  // all annotation types + selection
  useTsPreview: true,      // drawing preview
  useTsCrosshair: true,    // cursor + sync + OHLC tooltip
  useTsBtMarkers: true,    // BT entry/exit arrows
  useTsPriceLine: true,    // live price line
  useTsFormat: true,
  useTsCalcFunctions: true,
  useTsTheme: true,
}

export function overrideRenderPanel() {
  if (!FLAGS.overrideRenderPanel) return

  // Save original renderPanel
  const originalRenderPanel = (window as any).renderPanel
  if (!originalRenderPanel) {
    console.warn('[Charts] renderPanel not found on window — skipping override')
    return
  }

  // Store original for potential fallback
  ;(window as any)._originalRenderPanel = originalRenderPanel

  // Override renderPanel: run original for indicators only, TS for everything else
  ;(window as any).renderPanel = function(p: any) {
    // 1. Setup — compute coordinates
    const rc = buildRC(p)
    if (!rc) return

    // Clear canvas and fill backgrounds
    rc.ctx.clearRect(0, 0, rc.W, rc.H)
    rc.ctx.fillStyle = C.bg; rc.ctx.fillRect(0, 0, rc.W, rc.H)
    rc.ctx.fillStyle = C.axisbg
    rc.ctx.fillRect(rc.chartW, 0, rc.PRICE_W, rc.H)
    rc.ctx.fillRect(0, rc.H - rc.TIME_H, rc.W, rc.TIME_H)

    // 2. Grid + axes
    if (FLAGS.useTsGrid) {
      try {
        const { niceStep, gridMinP } = renderGrid(rc)
        renderPriceAxis(rc, niceStep, gridMinP)
        renderTimeAxis(rc)
      } catch (e) { console.warn('[TS] Grid failed:', e) }
    }

    // 3. Session shading + BT highlights
    if (FLAGS.useTsSession) {
      try {
        renderBtHighlights(rc)
        renderSessionShading(rc)
      } catch (e) { console.warn('[TS] Session failed:', e) }
    }

    // 4. Volume
    if (FLAGS.useTsVolume) {
      try { renderVolume(rc) } catch (e) { console.warn('[TS] Volume failed:', e) }
    }

    // 5. Indicators — still needs inline code (tight coupling with tool instances)
    //    We store the RenderContext on window so inline code can use it if needed
    ;(window as any).__rc = rc

    // Run inline indicator calc + fill pass (before candles)
    // The inline code has closures that reference the original renderPanel's local vars
    // For now, we skip inline indicators when TS candles is on and draw candles directly
    // TODO: extract indicator rendering

    // 6. Candles
    if (FLAGS.useTsCandles) {
      try { renderCandles(rc) } catch (e) { console.warn('[TS] Candles failed:', e) }
    }

    // 7. Annotations
    if (FLAGS.useTsAnnotations) {
      try { renderAnnotations(rc) } catch (e) { console.warn('[TS] Annotations failed:', e) }
    }

    // 8. Preview
    if (FLAGS.useTsPreview) {
      try { renderAnnotationPreview(rc) } catch (e) { console.warn('[TS] Preview failed:', e) }
    }

    // 9. BT markers
    if (FLAGS.useTsBtMarkers) {
      try { renderBtMarkers(rc) } catch (e) { console.warn('[TS] BT markers failed:', e) }
    }

    // 10. Crosshair
    if (FLAGS.useTsCrosshair) {
      try { renderCrosshair(rc) } catch (e) { console.warn('[TS] Crosshair failed:', e) }
    }

    // 11. Live price line
    if (FLAGS.useTsPriceLine) {
      try { renderLivePriceLine(rc) } catch (e) { console.warn('[TS] Price line failed:', e) }
    }
  }

  // Override format functions globally
  if (FLAGS.useTsFormat) {
    ;(window as any).fmtPrice = fmtPrice
    ;(window as any).fmtVol = fmtVol
    ;(window as any).fmtTimeAxis = fmtTimeAxis
    ;(window as any).fmtTimeCross = fmtTimeCross
    ;(window as any).getNY = getNY
    ;(window as any).nyMins = nyMins
    ;(window as any).isIntraday = isIntraday
  }

  // Override calc functions globally
  if (FLAGS.useTsCalcFunctions) {
    ;(window as any).calcEMA = calcEMA
    ;(window as any).calcSMA = calcSMA
    ;(window as any).calcBollinger = calcBollinger
    ;(window as any).calcVolSMA = calcVolSMA
    ;(window as any).calcVWAP = calcVWAP
    ;(window as any).calcATR = calcATR
    ;(window as any).calcATRSMA = calcATR
  }

  // Override theme colors
  if (FLAGS.useTsTheme) {
    if (!(window as any).C) (window as any).C = {}
    if (!(window as any).F) (window as any).F = {}
    Object.assign((window as any).C, C)
    Object.assign((window as any).F, F)
  }

  // Signal to inline code — all sections overridden
  ;(window as any).__tsOverride = true
  ;(window as any).__tsOverrideGrid = FLAGS.useTsGrid
  ;(window as any).__tsOverrideSession = FLAGS.useTsSession
  ;(window as any).__tsOverrideVolume = FLAGS.useTsVolume
  ;(window as any).__tsOverrideCandles = FLAGS.useTsCandles

  console.log('[Charts] TypeScript engine overrides active (full mode)')
}

/**
 * Build a RenderContext from the panel's runtime state.
 * This lets our TS modules access the same coordinates the inline code uses.
 */
function buildRC(p: any): any {
  if (!p?.ctx || !p?.data?.length || !p?.W) return null

  const chartW = p.W - p.PRICE_W
  const volH = p.inds?.vol ? Math.round(p.H * (p.volFrac || 0.20)) : 0
  const priceH = p.H - p.TIME_H - volH

  const maxStart = Math.max(0, p.data.length - p.viewBars)
  const vs = Math.max(0, Math.min(p.viewStart, maxStart))
  const ve = Math.min(vs + p.viewBars, p.data.length)
  const visible = p.data.slice(vs, ve)
  if (!visible.length) return null

  const RIGHT_PAD = (window as any).RIGHT_PAD || 6
  const barW = chartW / Math.max(visible.length + RIGHT_PAD, 1)
  const GAP = Math.max(2, Math.round(barW * 0.25))
  const candleW = Math.max(1, barW - GAP)

  const xCtr = (i: number) => i * barW + barW / 2
  const xLc = (i: number) => i * barW + GAP / 2
  const xL = (i: number) => i * barW

  let minP = Infinity, maxP = -Infinity
  for (const b of visible) { if (b.low < minP) minP = b.low; if (b.high > maxP) maxP = b.high }
  const pad = (maxP - minP) * 0.15 || minP * 0.02
  minP -= pad; maxP += pad
  const midP = (minP + maxP) / 2, halfRange = (maxP - minP) / 2
  const scaledHalf = halfRange * (p.priceScale || 1)
  minP = midP - scaledHalf; maxP = midP + scaledHalf
  const priceRange = maxP - minP
  const pToY = (v: number) => Math.max(0, Math.min(priceH, priceH - ((v - minP) / priceRange) * priceH))

  const toUnix = (window as any).toUnix
  function annTimeToX(t: number): number | null {
    const ts = toUnix ? toUnix(t) : t
    let lo = -1, hi = -1
    for (let i = 0; i < p.data.length; i++) {
      const bt = toUnix ? toUnix(p.data[i].time) : p.data[i].time
      if (bt <= ts) lo = i
      if (bt >= ts && hi < 0) hi = i
    }
    if (lo < 0 && hi < 0) return null
    if (lo < 0) return (hi - vs + 0.5) * barW
    if (hi < 0) return (lo - vs + 0.5) * barW
    if (lo === hi) return (lo - vs + 0.5) * barW
    const loT = toUnix ? toUnix(p.data[lo].time) : p.data[lo].time
    const hiT = toUnix ? toUnix(p.data[hi].time) : p.data[hi].time
    const frac = (hiT === loT) ? 0 : (ts - loT) / (hiT - loT)
    return ((lo + frac * (hi - lo)) - vs + 0.5) * barW
  }

  return {
    canvas: p.canvas,
    ctx: p.ctx,
    data: p.data,
    W: p.W,
    H: p.H,
    PRICE_W: p.PRICE_W,
    TIME_H: p.TIME_H,
    viewStart: p.viewStart,
    viewBars: p.viewBars,
    cx: p.cx,
    cy: p.cy,
    tf: p.tf,
    inds: p.inds || {},
    volFrac: p.volFrac,
    priceScale: p.priceScale,
    chartW,
    volH,
    priceH,
    vs,
    ve,
    visible,
    barW,
    GAP,
    candleW,
    xCtr,
    xLc,
    xL,
    minP,
    maxP,
    priceRange,
    pToY,
    annTimeToX,
    // Panel-specific properties
    idx: p.idx,
    showTL: p.showTL,
    showAnn: p.showAnn,
    showExec: p.showExec,
    showBtExec: p.showBtExec,
    showOtherAnn: p.showOtherAnn,
    showPDC: p.showPDC,
    tools: p.tools,
  }
}
