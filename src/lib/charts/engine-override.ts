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
import { fmtPrice, fmtVol, fmtTimeAxis, fmtTimeCross, getNY, nyMins, isIntraday } from './format'
import { calcEMA, calcSMA, calcBollinger, calcVolSMA, calcVWAP, calcATR, calcATRSMA } from './indicators'
import { C, F } from './theme'

// Feature flags — set to false to use inline JS for that section
const FLAGS = {
  overrideRenderPanel: true,
  useTsAnnotations: true,
  useTsPreview: true,
  useTsCrosshair: true,
  useTsBtMarkers: true,
  useTsPriceLine: true,
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

  // Override renderPanel: run original, then overlay TS modules
  ;(window as any).renderPanel = function(p: any) {
    // 1. Run the original inline renderPanel (draws everything)
    originalRenderPanel.call(null, p)

    // 2. Build RenderContext from panel state for our TS modules
    const rc = buildRC(p)
    if (!rc) return

    // 3. Overlay our TS modules on top of what the inline code drew
    //    These redraw sections that we've fully extracted

    if (FLAGS.useTsAnnotations) {
      try { renderAnnotations(rc) } catch (e) { console.warn('[TS] Annotations failed:', e) }
    }

    if (FLAGS.useTsPreview) {
      try { renderAnnotationPreview(rc) } catch (e) { console.warn('[TS] Preview failed:', e) }
    }

    if (FLAGS.useTsBtMarkers) {
      try { renderBtMarkers(rc) } catch (e) { console.warn('[TS] BT markers failed:', e) }
    }

    if (FLAGS.useTsCrosshair) {
      try { renderCrosshair(rc) } catch (e) { console.warn('[TS] Crosshair failed:', e) }
    }

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
    ;(window as any).calcATRSMA = calcATRSMA
  }

  // Override theme colors
  if (FLAGS.useTsTheme) {
    if (!(window as any).C) (window as any).C = {}
    if (!(window as any).F) (window as any).F = {}
    Object.assign((window as any).C, C)
    Object.assign((window as any).F, F)
  }

  // Signal to inline code that we're overriding these sections
  ;(window as any).__tsOverride = true

  console.log('[Charts] TypeScript engine overrides active (overlay mode)')
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
