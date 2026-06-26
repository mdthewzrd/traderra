/**
 * render-linguafast.ts — "Lingua Cycle (Fast)": structural-break-primary regime classifier.
 *
 * Built per user spec (Option A): regime changes fire off the MIKE'S BANDS STRUCTURAL
 * TRENDLINE BREAK — price closing through the swing-pivot-anchored line — NOT EMA slope.
 * The old Lingua decides base regime from EMA angle (laggy) and only *corrects* with a
 * trendbreak stage that runs last; a real reversal waits for 3 stacked lagging gates.
 * This tool inverts the priority: the break IS the trigger.
 *
 * Logic (point-in-time, scan-safe — reuses the non-repainting computeAnchoredTrendline):
 *  - A SUPPORT segment alive (set, unbroken) at bar i → UPTREND
 *  - A RESISTANCE segment alive → BACKSIDE
 *  - No alive structure (we're between a break and the next segment setting) →
 *      first `blendBars` after the break = TRENDBREAK; beyond that the slower EMAs
 *      (50/59) decide UP CONS / DOWN CONS / CONSOLIDATION ("blend the slower parts").
 *
 * All EMAs editable (9/20 fast, 50/59 slow) so you can tune the blend band.
 */
import type { RenderContext } from './render-types'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'
import { computeAnchoredTrendline } from './render-lingua'

export type FastStage = 'UPTREND' | 'BACKSIDE' | 'TRENDBREAK' | 'CONSOLIDATION' | 'UP CONS' | 'DOWN CONS'

// inline EMA (decouple from render-lingua's local helper)
function ema(src: number[], len: number): number[] {
  const n = src.length, k = 2 / (len + 1), out = new Array(n).fill(NaN)
  let prev = NaN
  for (let i = 0; i < n; i++) {
    const v = src[i]
    if (isNaN(v)) continue
    if (isNaN(prev)) prev = v
    else prev = v * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/**
 * Derive a regime array from trendline SEGMENTS (structure), not EMA slope.
 * Primary trigger = the break itself. Between breaks, blend slower EMAs.
 */
export function classifyFromStructure(
  segments: { dir: 1 | -1; setBar: number; breakBar: number; main: boolean }[],
  n: number,
  close: number[],
  blendBars: number,
  eMid: number[], eSlow: number[],
): FastStage[] {
  const out: FastStage[] = new Array(n).fill('CONSOLIDATION')
  for (let i = 0; i < n; i++) {
    // alive = set and not yet broken (or broken exactly at i)
    let active: { dir: 1 | -1; setBar: number } | null = null
    let broken: { dir: 1 | -1; breakBar: number } | null = null
    for (const s of segments) {
      const alive = s.setBar <= i && (s.breakBar < 0 || i <= s.breakBar)
      if (alive) {
        if (!active || s.setBar > active.setBar) active = { dir: s.dir, setBar: s.setBar }
      }
      if (s.breakBar >= 0 && i > s.breakBar) {
        if (!broken || s.breakBar > broken.breakBar) broken = { dir: s.dir, breakBar: s.breakBar }
      }
    }
    if (active) {
      // structure holding → trend residence from the live segment
      out[i] = active.dir === 1 ? 'UPTREND' : 'BACKSIDE'
    } else if (broken) {
      // in a transition window between break and next segment
      const since = i - broken.breakBar
      if (since <= blendBars) {
        out[i] = 'TRENDBREAK'
      } else {
        // "blend the slower parts": beyond the break window, let the 50/59 EMAs classify
        // the consolidation flavor so we don't sit blank during a prolonged chop.
        const c = close[i], m = eMid[i], s = eSlow[i]
        if (!isNaN(c) && !isNaN(m) && !isNaN(s)) {
          if (c > m && m > s) out[i] = 'UP CONS'
          else if (c < m && m < s) out[i] = 'DOWN CONS'
          else out[i] = 'CONSOLIDATION'
        } else out[i] = 'CONSOLIDATION'
      }
    } else {
      out[i] = 'CONSOLIDATION'
    }
  }
  return out
}

const STAGE_COLORS: Record<FastStage, string> = {
  'UPTREND':        'rgba(0,180,140,0.14)',   // teal-green
  'UP CONS':        'rgba(0,150,120,0.08)',
  'CONSOLIDATION':  'rgba(150,150,170,0.07)',  // neutral gray
  'DOWN CONS':      'rgba(190,110,50,0.08)',
  'BACKSIDE':       'rgba(210,70,50,0.14)',    // red
  'TRENDBREAK':     'rgba(250,180,40,0.22)',   // gold — the signal
}

export function renderLinguaFast(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'linguafast')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'linguafast') as any

    const lfFast1 = (p.lfFast1 as number) ?? 9
    const lfFast2 = (p.lfFast2 as number) ?? 20
    const lfMid = (p.lfMid as number) ?? 50
    const lfSlow = (p.lfSlow as number) ?? 59
    const lfBlendBars = (p.lfBlendBars as number) ?? 6

    // structural trendline params (reuse the proven anchored detection)
    const lfLeft = (p.lfLeft as number) ?? 30
    const lfRight = (p.lfRight as number) ?? 10
    const lfPattern = (p.lfPattern as number) ?? 2
    const lfMainLeft = (p.lfMainLeft as number) ?? 30
    const lfMainRight = (p.lfMainRight as number) ?? 10
    const lfMainPattern = (p.lfMainPattern as number) ?? 3
    const lfMinSize = (p.lfMinSize as number) ?? 0
    const lfShowEmas = ((p.lfShowEmas as number) ?? 1) === 1

    const { ctx, data, vs, visible, xCtr, pToY, barW } = rc
    if (!data || data.length < 50 || visible.length === 0) return

    const high = data.map((b: any) => b.high as number)
    const low = data.map((b: any) => b.low as number)
    const close = data.map((b: any) => b.close as number)
    const n = close.length

    // ── 1. Structural regime from trendline segments ──
    const tl = computeAnchoredTrendline(high, low, close, 1, lfLeft, lfRight, lfPattern, lfMainLeft, lfMainRight, lfMainPattern, lfMinSize, 1, 0)
    const eMid = ema(close, lfMid)
    const eSlow = ema(close, lfSlow)
    const stages = classifyFromStructure(tl.segments, n, close, lfBlendBars, eMid, eSlow)

    // ── 2. Stage background fills ──
    for (let i = 0; i < visible.length; i++) {
      const ai = vs + i
      const stage = stages[ai]
      if (!stage) continue
      ctx.fillStyle = STAGE_COLORS[stage]
      const x1 = xCtr(i) - barW / 2
      // fill full vertical price area of the panel
      ctx.fillRect(x1, pToY(rc.maxP), barW + 0.5, pToY(rc.minP) - pToY(rc.maxP))
    }

    // ── 3. EMAs overlay (editable 9/20 fast, 50/59 slow) ──
    if (lfShowEmas) {
      const e9 = ema(close, lfFast1), e20 = ema(close, lfFast2)
      drawEmaLine(rc, e9, 'rgba(120,200,255,0.85)', 1.4)    // light blue — fast
      drawEmaLine(rc, e20, 'rgba(0,229,255,0.85)', 1.4)     // cyan — fast
      drawEmaLine(rc, eMid, 'rgba(200,180,100,0.7)', 1.2)   // gold — mid (blend band)
      drawEmaLine(rc, eSlow, 'rgba(200,120,200,0.7)', 1.2)  // magenta — slow (blend band)
    }

    // ── 4. Structural break markers (the TRENDBREAK signal points) ──
    let prevStage: FastStage | null = null
    for (let i = 0; i < visible.length; i++) {
      const ai = vs + i
      const st = stages[ai]
      if (st === 'TRENDBREAK' && prevStage && prevStage !== 'TRENDBREAK') {
        const x = xCtr(i), y = pToY(close[ai])
        ctx.fillStyle = 'rgba(250,204,21,0.95)'
        ctx.beginPath(); ctx.arc(x, y, Math.max(3, barW * 0.55), 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke()
      }
      prevStage = st
    }
  } catch (e) {
    console.error('[linguafast] threw:', e)
  }
}

// minimal EMA line drawer (NaN-aware, visible-range only)
function drawEmaLine(rc: RenderContext, vals: number[], color: string, lw: number) {
  const { ctx, vs, visible, xCtr, pToY } = rc
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'
  ctx.beginPath()
  let started = false
  for (let i = 0; i < visible.length; i++) {
    const ai = vs + i
    const v = vals[ai]
    if (v == null || isNaN(v)) { started = false; continue }
    const x = xCtr(i), y = pToY(v)
    if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
  }
  ctx.stroke()
}
