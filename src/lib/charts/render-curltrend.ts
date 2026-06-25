/**
 * render-curltrend.ts — "the curl" trendline, standalone tool.
 *
 * Built on the SAME proven JD swing pivots as the working main/light trendlines
 * (fractalPivots + confirmPivot, module-level in render-lingua.ts). So pivots are
 * GUARANTEED to exist — the only question is what we do with them.
 *
 * A curl line = a ROLLING least-squares regression through the N freshest confirmed
 * same-type pivots (N = ctPivots, default 3). As a new swing confirms, the oldest drops
 * out → the slope STEEPENS = the curl that tracks an accelerating trend and tightens
 * until break. Unlike a FROZEN line, the forward slope is LIVE (recomputed per bar from
 * the freshest structure), so a break fires when price closes through THIS bar's curled
 * level — leading the laggy EMA flip.
 *
 * Drawing is SIMPLE and guaranteed: whenever ≥2 confirmed pivots exist, the line draws
 * (no hard disp_select slope filter that starves the fit). Direction follows the
 * regression slope naturally — rising support from lows, falling resistance from highs.
 *
 * Point-in-time safe: at bar k only pivots confirmed as-of k (idx + ctRight ≤ k) are used.
 */
import type { RenderContext } from './render-types'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'
import { drawLine } from './render-indicators'

// ── Pivot detection (verbatim from the proven JD machinery in render-lingua.ts) ──

/** fractalPivots — local extrema. findHigh=true → peaks, false → troughs. Equal allowed. */
function fractalPivots(src: number[], left: number, right: number, findHigh: boolean): { idx: number; price: number }[] {
  const n = src.length
  const out: { idx: number; price: number }[] = []
  for (let i = left; i < n - right; i++) {
    const v = src[i]
    if (isNaN(v)) continue
    let ok = true
    for (let k = 1; k <= left && ok; k++) { const x = src[i - k]; if (isNaN(x) || (findHigh ? x > v : x < v)) ok = false }
    for (let k = 1; k <= right && ok; k++) { const x = src[i + k]; if (isNaN(x) || (findHigh ? x > v : x < v)) ok = false }
    if (ok) out.push({ idx: i, price: v })
  }
  return out
}

/** confirmPivot — second look-window confirmation (drops weak pattern pivots). */
function confirmPivot(
  cands: { idx: number; price: number }[], src: number[], findHigh: boolean,
  left: number, right: number,
): { idx: number; price: number }[] {
  return cands.filter(p => {
    for (let k = p.idx - left; k <= p.idx + right; k++) {
      if (k === p.idx || k < 0 || k >= src.length) continue
      if (isNaN(src[k])) continue
      if (findHigh ? src[k] > p.price : src[k] < p.price) return false
    }
    return true
  })
}

/** min-spacing filter — keep only significant pivots (drop micro-noise). */
function spacePivots(pv: { idx: number; price: number }[], minD: number): { idx: number; price: number }[] {
  const out: { idx: number; price: number }[] = []
  for (const p of pv) if (!out.length || p.idx - out[out.length - 1].idx >= minD) out.push(p)
  return out
}

// ── The curl: rolling N-pivot least-squares regression ──

export interface CurlResult {
  sup: number[]        // support line (from lows); NaN where no fit
  res: number[]        // resistance line (from highs); NaN where no fit
  supBreak: number     // first close below support (-1 none)
  resBreak: number     // first close above resistance (-1 none)
}

export function computeCurlTrend(
  high: number[], low: number[], close: number[],
  pattern: number, left: number, right: number, nPiv: number,
): CurlResult {
  const n = close.length
  const N = Math.max(2, Math.round(nPiv))
  const patSide = Math.max(1, Math.floor((pattern - 1) / 2))

  // Same 2-tier pivot detection as the working main/light trendlines.
  const lo = spacePivots(confirmPivot(fractalPivots(low, patSide, patSide, false), low, false, left, right), left)
  const hi = spacePivots(confirmPivot(fractalPivots(high, patSide, patSide, true), high, true, left, right), left)

  // Rolling least-squares fit through the N freshest confirmed-as-of-k pivots.
  // Draws whenever ≥2 pivots exist — NO hard disp_select. Direction follows the slope.
  const fit = (pv: { idx: number; price: number }[]): number[] => {
    const out: number[] = new Array(n).fill(NaN)
    for (let k = 0; k < n; k++) {
      const win = pv.filter(p => p.idx + right <= k).slice(-N)   // pivots confirmed as-of bar k
      const M = win.length
      if (M < 2) continue
      const x0 = win[0].idx
      let sx = 0, sy = 0, sxy = 0, sxx = 0
      for (const p of win) { const x = p.idx - x0; sx += x; sy += p.price; sxy += x * p.price; sxx += x * x }
      const denom = M * sxx - sx * sx
      if (Math.abs(denom) < 1e-9) continue
      const m = (M * sxy - sx * sy) / denom
      const b = (sy - m * sx) / M
      out[k] = b + m * (k - x0)
    }
    return out
  }

  const sup = fit(lo)
  const res = fit(hi)

  // Break = first close through the live curled level.
  let supBreak = -1, resBreak = -1
  for (let k = 0; k < n; k++) {
    if (supBreak < 0 && !isNaN(sup[k]) && close[k] < sup[k]) supBreak = k
    if (resBreak < 0 && !isNaN(res[k]) && close[k] > res[k]) resBreak = k
  }
  // "tightens until it breaks" — stop the line at the break.
  if (supBreak >= 0) for (let k = supBreak + 1; k < n; k++) sup[k] = NaN
  if (resBreak >= 0) for (let k = resBreak + 1; k < n; k++) res[k] = NaN

  return { sup, res, supBreak, resBreak }
}

// ── Render ──

let _curlLogged = false   // one-shot log, can never flood

export function renderCurlTrend(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'curltrend')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'curltrend') as any
    const ctPattern = (p.ctPattern as number) ?? 5
    const ctLeft = (p.ctLeft as number) ?? 69
    const ctRight = (p.ctRight as number) ?? 21
    const ctPivots = (p.ctPivots as number) ?? 3
    const ctShowBreak = ((p.ctShowBreak as number) ?? 1) === 1
    const { ctx, data, vs, visible, xCtr, pToY, barW } = rc
    if (!data || data.length < ctLeft + ctRight + 10 || visible.length === 0) return

    const high = data.map((b: any) => b.high as number)
    const low = data.map((b: any) => b.low as number)
    const close = data.map((b: any) => b.close as number)
    const c = computeCurlTrend(high, low, close, ctPattern, ctLeft, ctRight, ctPivots)

    if (!_curlLogged) {
      _curlLogged = true
      console.log('[curltrend] plotted ok. data:' + data.length, 'sup valid:' + c.sup.filter(v => !isNaN(v)).length, 'res valid:' + c.res.filter(v => !isNaN(v)).length)
    }

    const supCol = (p.ct_sup as string) || 'rgba(86,156,214,0.95)'    // blue — support
    const resCol = (p.ct_res as string) || 'rgba(230,150,40,0.95)'    // orange — resistance
    const brkCol = (p.ct_break as string) || 'rgba(250,204,21,0.95)'  // yellow — break

    drawLine(rc, c.sup, supCol, 2)
    drawLine(rc, c.res, resCol, 2)

    if (ctShowBreak) {
      const mark = (k: number) => {
        if (k < 0 || k - vs < 0 || k - vs >= visible.length) return
        const x = xCtr(k - vs), y = pToY(close[k])
        ctx.fillStyle = brkCol
        ctx.beginPath(); ctx.arc(x, y, Math.max(3, barW * 0.4), 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke()
      }
      mark(c.supBreak); mark(c.resBreak)
    }
  } catch (e) {
    if (!_curlLogged) { _curlLogged = true; console.error('[curltrend] threw:', e) }
  }
}
