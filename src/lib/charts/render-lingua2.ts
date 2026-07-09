/**
 * Lingua Cycle v2 — CLEAN discriminator-first cycle (2026-07-05).
 *
 * Replaces the classic 9-stage renderer's experimental layers (Theil–Sen pitch, struct
 * gate, ER cleanliness, ~20 params) with the PROVEN core from DISCRIMINATOR-FINDINGS.md:
 *
 *   THE 3-TF ALIGNMENT MATRIX is the cycle's first-class engine (close-based dev):
 *     EUPHORIC : 15m ≥ ext  AND  1H ≥ ext  AND  4H ≥ ext  → all aligned, TERMINAL top (fade)
 *     CONT     : 15m ≥ ext  AND  NOT(1H & 4H ≥ ext)        → LTF extreme, HTF tame (revert, trend resumes)
 *     DECOY    : 15m < ext  AND  (1H ≥ ext OR 4H ≥ ext)    → HTF overextended, LTF won't confirm → EUPHORIC VETO
 *     (none)   : nothing extreme                           → slope regime below
 *
 *   dev = (close − eMid) / atrMid   [CLOSE-based — proven a better decoy filter than high-based]
 *
 *   Then the slope regime (only when no extreme active):
 *     UPTREND   : aop > flat AND close holding eTrend
 *     TRENDBREAK: close loses eTrend (the early structural break, leads the slope flip)
 *     BACKSIDE  : aop < −flat (slope confirms down)
 *     CONSOLIDATION : |aop| ≤ flat
 *
 *   7 stages. 6 params. DECOY is a first-class stage — the systematic encoding of the MSTZ
 *   euphoric-rejection (your newest understanding, not in the classic renderer).
 *
 * Bars: reuses the classic Lingua tool's MTF/HTF/LTF slots via getLinguaCycleBars() — so it
 * shares the bar feed, not the classifier. Decoupled from the old tool's param coupling.
 */
import type { RenderContext } from './render-types'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'
import { getLinguaCycleBars } from './render-lingua'
import { drawEMABand, drawDevBand, drawLine } from './render-indicators'
import { C } from './theme'

type Stage = 'CONSOLIDATION' | 'UPTREND' | 'BACKSIDE' | 'EXTREME' | 'UP CONS' | 'DOWN CONS'
// v1-matched palette: subtle full-height tint + vivid transition line + label text.
// DECOY (gold) is the new stage — distinct from EUPHORIC's terminal orange-red.
const COL: Record<Stage, { tint: string; line: string; text: string }> = {
  'CONSOLIDATION': { tint: 'rgba(120,140,170,0.05)', line: 'rgba(150,160,180,0.5)',  text: 'rgba(180,190,210,0.85)' },
  'UPTREND':       { tint: 'rgba(76,175,80,0.06)',   line: 'rgba(76,175,80,0.6)',    text: 'rgba(129,199,132,0.95)' },
  'BACKSIDE':      { tint: 'rgba(239,83,80,0.06)',   line: 'rgba(239,83,80,0.6)',    text: 'rgba(239,154,154,0.95)' },
  'EXTREME':       { tint: 'rgba(255,193,7,0.08)',   line: 'rgba(255,193,7,0.55)',   text: 'rgba(255,213,79,0.9)' },
  'UP CONS':       { tint: 'rgba(76,175,80,0.035)',  line: 'rgba(129,199,132,0.35)', text: 'rgba(129,199,132,0.7)' },
  'DOWN CONS':     { tint: 'rgba(239,83,80,0.035)',  line: 'rgba(239,154,154,0.35)', text: 'rgba(239,154,154,0.7)' },
}
const SHORT: Record<Stage, string> = {
  'CONSOLIDATION':'CO', 'UPTREND':'UP', 'BACKSIDE':'BK', 'EXTREME':'EX', 'UP CONS':'UC', 'DOWN CONS':'DC',
}

// ── indicators (self-contained, CLOSE-based dev) ──
function ema(vals: number[], span: number): number[] {
  const n = vals.length, out = new Array(n).fill(NaN)
  if (!n) return out
  const k = 2 / (span + 1)
  let prev = NaN, start = 0
  for (let i = 0; i < n; i++) { if (!isNaN(vals[i])) { prev = vals[i]; start = i; break } out[i] = NaN }
  if (isNaN(prev)) return out
  out[start] = prev
  for (let i = start + 1; i < n; i++) { if (isNaN(vals[i])) { out[i] = prev; continue } prev = vals[i] * k + prev * (1 - k); out[i] = prev }
  return out
}
function wilderAtr(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length, out = new Array(n).fill(NaN)
  if (!n) return out
  if (n === 1) { out[0] = high[0] - low[0]; return out }
  const tr = (i: number) => Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  out[0] = high[0] - low[0]; let a = tr(1); out[1] = a
  for (let i = 2; i < n; i++) { if (i <= len) a = (a * (i - 1) + tr(i)) / i; else a = (a * (len - 1) + tr(i)) / len; out[i] = a }
  return out
}
// per-TF indicator pack: eMid, atrMid, eTrend, aop (slope off the FASTER slopeEma, not eMid), dev (close-based)
function packTF(bars: { time: number; high: number; low: number; close: number }[], emaMid: number, trendEma: number, slopeN: number, slopeEma: number) {
  const t = bars.map(b => b.time), h = bars.map(b => b.high), l = bars.map(b => b.low), c = bars.map(b => b.close)
  const eMid = ema(c, emaMid), eTrend = ema(c, trendEma), eSlope = ema(c, slopeEma)
  const atrMid = wilderAtr(h, l, c, emaMid), atr14 = wilderAtr(h, l, c, 14)
  const dev = c.map((v, i) => (isFinite(atrMid[i]) && atrMid[i] > 0) ? (v - eMid[i]) / atrMid[i] : NaN)
  const aop = new Array(c.length).fill(NaN)
  const er = new Array(c.length).fill(NaN)   // Kaufman efficiency ratio: trend cleanliness (1=clean, 0=chop)
  for (let i = slopeN; i < c.length; i++) {
    if (isNaN(eSlope[i - slopeN]) || !isFinite(atr14[i]) || atr14[i] === 0) continue
    aop[i] = (eSlope[i] - eSlope[i - slopeN]) / slopeN / atr14[i]
    let path = 0
    for (let j = i - slopeN + 1; j <= i; j++) { if (!isNaN(c[j]) && !isNaN(c[j - 1])) path += Math.abs(c[j] - c[j - 1]) }
    const dir = Math.abs(c[i] - c[i - slopeN])
    er[i] = path > 0 ? dir / path : 0
  }
  return { t, c, eMid, eTrend, atrMid, dev, aop, er }
}
// last-closed coarser bar index at display-time cutoff (no lookahead)
function alignFinerToCoarse(tFiner: number[], tCoarse: number[]): Int32Array {
  const out = new Int32Array(tFiner.length).fill(-1); let j = 0
  for (let i = 0; i < tFiner.length; i++) { while (j < tCoarse.length && tCoarse[j] <= tFiner[i]) j++; out[i] = j - 1 }
  return out
}

export function renderLinguaCycle2(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'lingua2')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'lingua2') as any
    // 6 clean params
    const flat    = (p.flat as number) ?? 0.03
    const emaMid  = (p.emaMid as number) ?? 72
    const emaSlow = (p.emaSlow as number) ?? 89
    const trendEma= (p.trendEma as number) ?? 39
    const slopeEma= (p.slopeEma as number) ?? 20   // slope measured off the FAST 20-EMA → snappy regime flips
    const extThr  = (p.extThr as number) ?? 6.9     // 72/89 upper-1 = EMA72 + ATR72×6.9 (THE extreme trigger)
    const contThr = (p.contThr as number) ?? 5.5    // softer LTF threshold for CONT continuation extreme
    const chopThr = (p.chopThr as number) ?? 0.30   // ER below this = choppy trend → UP/DOWN CONS variant
    const schmitt = (p.schmitt as number) ?? 0.4    // exit gate as fraction of flat (0=max stickiness, 1=no Schmitt)
    const holdBars= (p.holdBars as number) ?? 2
    const slopeN  = (p.slopeN as number) ?? 10

    const { ctx, data, visible, xCtr, xL, priceH, pToY, barW } = rc as any
    if (!data || data.length < 30 || visible.length === 0) return

    // ── fetch the 3 TFs from the shared Lingua bar slots ──
    const mtf = packTF(getLinguaCycleBars(panelIdx, 'mtf'), emaMid, trendEma, slopeN, slopeEma)
    const htf = packTF(getLinguaCycleBars(panelIdx, 'htf'), emaMid, trendEma, slopeN, slopeEma)
    const ltf = packTF(getLinguaCycleBars(panelIdx, 'ltf'), emaMid, trendEma, slopeN, slopeEma)
    if (mtf.t.length < 80) return

    // ── classify per MTF bar (1H = primary), DECOY-aware ──
    const aH = alignFinerToCoarse(mtf.t, htf.t)   // for each MTF bar, last-closed HTF bar
    const aL = alignFinerToCoarse(mtf.t, ltf.t)    // last-closed LTF bar
    const raw: Stage[] = new Array(mtf.t.length).fill('CONSOLIDATION')
    // Schmitt trigger state: once a regime is entered it HOLDS until the slope meaningfully
    // reverses (exitGate = flat*schmitt). Kills the trend-dip-into-CONSOLIDATION chatter.
    let regime: 'up' | 'down' | 'flat' = 'flat'
    const exitGate = flat * schmitt
    for (let i = 0; i < mtf.t.length; i++) {
      const dm = mtf.dev[i]
      const dh = aH[i] >= 0 ? htf.dev[aH[i]] : NaN
      const dl = aL[i] >= 0 ? ltf.dev[aL[i]] : NaN
      const aop = mtf.aop[i]
      const clean = isFinite(mtf.er[i]) && mtf.er[i] >= chopThr
      // 1) EXTREME — MTF (1H) close-dev hits the band. Matches the classic tool's
      //    EXTREME CONT heartbeat: the recurring trigger is SINGLE-timeframe (1H alone),
      //    NOT all-three-TFs. The all-three gate I had was too strict and starved extremes.
      if (isFinite(dm) && dm >= extThr) { raw[i] = 'EXTREME'; continue }
      // 2) slope regime — Schmitt trigger: sticky trends, full reversal to flip sides
      if (regime === 'up') { if (aop < -flat) regime = 'down'; else if (aop < exitGate) regime = 'flat' }
      else if (regime === 'down') { if (aop > flat) regime = 'up'; else if (aop > -exitGate) regime = 'flat' }
      else { if (aop > flat) regime = 'up'; else if (aop < -flat) regime = 'down' }
      if (regime === 'up')        raw[i] = clean ? 'UPTREND' : 'UP CONS'
      else if (regime === 'down') raw[i] = clean ? 'BACKSIDE' : 'DOWN CONS'
      else                        raw[i] = 'CONSOLIDATION'
    }

    // ── hysteresis: hold non-extreme stages for holdBars to kill flicker ──
    const stages = raw.slice()
    let hold = 0, last: Stage = 'CONSOLIDATION'
    const EXTREME: Record<string, boolean> = { 'EXTREME': true }
    for (let i = 0; i < stages.length; i++) {
      if (EXTREME[stages[i]]) { hold = 0; last = stages[i]; continue }
      if (stages[i] !== last) { hold++; if (hold >= holdBars) { last = stages[i]; hold = 0 } stages[i] = last }
      else hold = 0
    }

    // ── map MTF stages onto the DISPLAYED chart bars by time ──
    const dispT = (data as any[]).map((b: any) => b.time)
    const aM = alignFinerToCoarse(dispT, mtf.t)   // for each display bar, last-closed MTF bar

    // ── DISPLAYED-TF indicators (clouds/bands/line drawn on the chart you're looking at) ──
    const dC = (data as any[]).map((b: any) => b.close as number)
    const dH = (data as any[]).map((b: any) => b.high as number)
    const dL = (data as any[]).map((b: any) => b.low as number)
    const e9 = ema(dC, 9), e20 = ema(dC, 20)
    const dEMid = ema(dC, emaMid), dESlow = ema(dC, emaSlow), dETrend = ema(dC, trendEma)
    const dAtrMid = wilderAtr(dH, dL, dC, emaMid), dAtrSlow = wilderAtr(dH, dL, dC, emaSlow)
    const eCF = ema(dC, 200), eCS = ema(dC, 236)
    const NL = (a: number[]) => a.map(v => (isNaN(v) ? null : v))

    // Clouds FIRST (under the stage tints): 9/20 trail + mean cloud + 200/236 macro cloud
    drawEMABand(rc, NL(e9), NL(e20),
      C.band_9_20_bull_fill, C.band_9_20_bear_fill, C.band_9_20_bull_line, C.band_9_20_bear_line)
    drawEMABand(rc, NL(dEMid), NL(dESlow),
      C.band_72_89_bull_fill, C.band_72_89_bear_fill, C.band_72_89_bull_line, C.band_72_89_bear_line)
    drawEMABand(rc, NL(eCF), NL(eCS),
      'rgba(76,175,80,0.12)', 'rgba(239,83,80,0.12)', 'rgba(76,175,80,0.6)', 'rgba(239,83,80,0.6)')
    // Dev band at v2's tracked thresholds (contThr/extThr) — what you SEE = what the classifier tracks
    drawDevBand(rc, NL(dEMid), NL(dAtrMid), NL(dESlow), NL(dAtrSlow),
      [contThr, extThr], [contThr, extThr],
      'rgba(239,68,68,.15)', 'rgba(239,68,68,.40)', 'rgba(34,197,94,.15)', 'rgba(34,197,94,.40)')
    // Gold trend EMA line
    drawLine(rc, NL(dETrend), 'rgba(212,175,55,0.7)', 1.8)

    // ── STAGE SHADING (matches v1: full-height tint + dashed divider + label pill) ──
    const slot = (barW && barW > 0) ? barW : 6
    const half = slot / 2
    ctx.font = '600 9px ui-monospace, monospace'
    ctx.textBaseline = 'top'
    let prevStage: Stage | null = null
    for (let vi = 0; vi < visible.length; vi++) {
      const di = vs_index(rc, vi)
      const mi = aM[di]
      const s: Stage = mi >= 0 ? stages[mi] : 'CONSOLIDATION'
      const c = COL[s]
      const x = xCtr(vi)
      ctx.fillStyle = c.tint
      ctx.fillRect(x - half, 0, slot, priceH)
      if (s !== prevStage) {
        ctx.strokeStyle = c.line
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x - half, 0)
        ctx.lineTo(x - half, priceH)
        ctx.stroke()
        ctx.setLineDash([])
        const label = SHORT[s]
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(8,12,20,0.72)'
        ctx.fillRect(x + 3, 3, tw + 6, 13)
        ctx.fillStyle = c.text
        ctx.fillText(label, x + 6, 4)
      }
      prevStage = s
    }
    ctx.setLineDash([])
  } catch (e) { console.error('[lingua2] render error:', e) }
}

// map a visible-slice index back to the full data index (vs offset)
function vs_index(rc: any, vi: number): number {
  return (rc.vs | 0) + vi
}
