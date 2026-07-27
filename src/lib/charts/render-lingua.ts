/**
 * Lingua Trend Cycle — stage markers (3-TIER HIERARCHICAL).
 *
 * Architecture: fractal three-tier model.
 *   • MTF (1H)  = PRIMARY regime (base stage from 1H AoP)
 *   • HTF (4H)  = CONTEXT / VETO (governs Extreme Deviation lock-in)
 *   • LTF (15m) = display / execution layer (renders here)
 *
 * Extreme Deviation SPLIT into two flavors (key insight from user's reference markup):
 *   • CONTINUATION EXTREME — MTF (1H) at band, HTF (4H) NOT yet extended.
 *     Healthy thrust WITHIN a trend → reverts to mean → trend CONTINUES.
 *     This is the recurring heartbeat: UPTREND → EXTREME CONT → REVERSION → UPTREND.
 *   • EUPHORIC — MTF AND HTF BOTH at band. Catalytic terminal top/bottom. Move is done.
 *
 * Same indicator (dev band), same threshold (xtreme, Lingua-tuned) on both TFs —
 * the timeframe ALIGNMENT does the discrimination. Simple + robust.
 *
 * Stages: CONSOLIDATION | UPTREND | BACKSIDE | EXTREME CONT | EUPHORIC
 */

import type { RenderContext } from './render-types'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'
import { drawEMABand, drawDevBand, drawLine } from './render-indicators'
import { C } from './theme'
import { renderPivotZones } from './render-pzones'

// ── math helpers ──
function ema(vals: number[], span: number): number[] {
  const n = vals.length
  const out: number[] = new Array(n).fill(NaN)
  if (n === 0) return out
  const k = 2 / (span + 1)
  // Seed from the first FINITE value (not vals[0]) — pitch/ATR arrays have leading NaN
  // warmup zones. Seeding from NaN would poison every subsequent output (NaN propagates
  // through `prev = v*k + prev*(1-k)`), so the EMA line would never plot.
  let prev = NaN
  let startIdx = 0
  for (let i = 0; i < n; i++) {
    if (!isNaN(vals[i])) { prev = vals[i]; startIdx = i; break }
    out[i] = NaN
  }
  if (isNaN(prev)) return out // all-NaN input
  out[startIdx] = prev
  for (let i = startIdx + 1; i < n; i++) {
    if (isNaN(vals[i])) { out[i] = prev; continue }
    prev = vals[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function wilderAtr(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length
  const out: number[] = new Array(n).fill(NaN)
  if (n === 0) return out
  if (n === 1) { out[0] = high[0] - low[0]; return out }
  // Running-seed ATR: provisional value from bar 1 (running avg of TRs) that converges to
  // the EXACT Wilder seed at bar `len`, then standard Wilder smoothing. Lets the deviation
  // bands/clouds plot from the FIRST candle instead of leaving a `len`-bar gap on the left.
  // Values before `len` are converging estimates (standard charting practice).
  const tr = (i: number) => Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  out[0] = high[0] - low[0]            // no prev close at bar 0 → bar range is best estimate
  let a = tr(1)
  out[1] = a
  for (let i = 2; i < n; i++) {
    if (i <= len) a = (a * (i - 1) + tr(i)) / i      // running avg → equals Wilder seed at i=len
    else a = (a * (len - 1) + tr(i)) / len           // standard Wilder smoothing
    out[i] = a
  }
  return out
}

function sma(vals: number[], len: number): number[] {
  const n = vals.length
  const out: number[] = new Array(n).fill(NaN)
  let sum = 0, cnt = 0
  for (let i = 0; i < n; i++) {
    if (!isNaN(vals[i])) { sum += vals[i]; cnt++ }
    if (i >= len && !isNaN(vals[i - len])) { sum -= vals[i - len]; cnt-- }
    if (cnt === len) out[i] = sum / len
  }
  return out
}

// Compute AoP + Dev arrays for a bar set. Returns aligned arrays + times.
function computeIndicators(times: number[], high: number[], low: number[], close: number[], slopeN: number, smooth: number, emaMid: number, emaSlow: number, trendEma: number) {
  const eMid = ema(close, emaMid)
  const eSlow = ema(close, emaSlow)
  const a = wilderAtr(high, low, close, 14)            // AoP slope normalization
  const aMid = wilderAtr(high, low, close, emaMid)     // band-matching ATR (aligns dev to drawn line)
  const rawSlope: number[] = new Array(close.length).fill(NaN)
  for (let i = slopeN; i < close.length; i++) {
    if (isNaN(eSlow[i - slopeN]) || isNaN(a[i]) || a[i] === 0) continue
    rawSlope[i] = (eSlow[i] - eSlow[i - slopeN]) / slopeN / a[i]
  }
  const aop = sma(rawSlope, smooth)
  // Dev metric ALIGNED to the drawn upper band (eMid + mult·ATR(emaMid)) — EC/EUPHORIC
  // fire exactly when price tags the visible xtreme/euThr line. Previously used the
  // (eMid+eSlow)/2 mean + ATR(14), which drifted above the drawn line in trends and made
  // triggers lead the visual by 10-30 bars.
  const dev: number[] = close.map((c, i) =>
    (isNaN(eMid[i]) || isNaN(aMid[i]) || aMid[i] === 0) ? NaN : (c - eMid[i]) / aMid[i]
  )
  // Downside dev — ALIGNED to the drawn LOWER band (eSlow − mult·ATR(emaSlow)). Mirrors
  // the upside dev contract: EXTREME LOWER fires exactly when price tags the visible
  // lower xtreme line. Uses eSlow + ATR(emaSlow), NOT eMid/atrMid (different center).
  const aSlow = wilderAtr(high, low, close, emaSlow)
  const devLow: number[] = close.map((c, i) =>
    (isNaN(eSlow[i]) || isNaN(aSlow[i]) || aSlow[i] === 0) ? NaN : (c - eSlow[i]) / aSlow[i]
  )
  // Trend Pitch — blended slope of a slower trend EMA (default 63) over 10/30/60-bar
  // windows, ATR-normalized so it's comparable across tickers/TFs. Drives the on-chart
  // pitch readout and is the future input for param auto-adapt (dynamism). Windows are
  // hardcoded (10/30/60 per spec) to keep calibration simple — only trendEma is tunable.
  const eTrend = ema(close, trendEma)
  const aTrend = wilderAtr(high, low, close, trendEma)
  const PITCH_WIN = [10, 30, 60]
  const pitch: number[] = new Array(close.length).fill(NaN)
  for (let i = 0; i < close.length; i++) {
    if (isNaN(eTrend[i]) || isNaN(aTrend[i]) || aTrend[i] === 0) continue
    let sum = 0, cnt = 0
    for (const w of PITCH_WIN) {
      if (i >= w && !isNaN(eTrend[i - w])) { sum += (eTrend[i] - eTrend[i - w]) / w / aTrend[i]; cnt++ }
    }
    if (cnt > 0) pitch[i] = sum / cnt
  }
  return { times, aop, dev, devLow, eMid, eSlow, eTrend, pitch, atrMid: aMid, atrSlow: aSlow, high, low }
}

type TFIndicators = { times: number[]; aop: number[]; dev: number[]; devLow: number[]; eMid: number[]; eSlow: number[]; eTrend: number[]; pitch: number[]; atrMid: number[]; atrSlow: number[]; high: number[]; low: number[]; close: number[] }

// ── multi-TF cache (fed by ReactChartPanel via setLinguaMtfBars) ──
// Keyed by panelIdx: two charts with different Lingua params each get their own MTF/HTF
// slot, so neither clobbers the other's classification (the old singletons meant the
// last-fed panel always won).
const MTF: Record<number, TFIndicators> = {}
const HTF: Record<number, TFIndicators> = {}
// LTF — fractal CHILD frame (MTF÷4, e.g. 1H→15m). Fed like MTF/HTF but used ONLY for
// the trendbreak LEAD markers: its structure cracks before the 1H, so its trendbreaks
// fire early. Single-frame (no coarser co-parent) — classification is slope-only.
const LTF: Record<number, TFIndicators> = {}
function tfSlot(map: Record<number, TFIndicators>, panelIdx: number): TFIndicators {
  return map[panelIdx] || (map[panelIdx] = { times: [], aop: [], dev: [], devLow: [], eMid: [], eSlow: [], eTrend: [], pitch: [], atrMid: [], atrSlow: [], high: [], low: [], close: [] })
}

// Raw bars from the shared MTF/HTF/LTF slots — consumed by render-lingua2.ts (the clean
// v2 cycle) so it shares the bar feed WITHOUT inheriting the classic tool's param coupling.
export function getLinguaCycleBars(panelIdx: number, role: 'mtf' | 'htf' | 'ltf'): { time: number; high: number; low: number; close: number }[] {
  const map = role === 'mtf' ? MTF : role === 'htf' ? HTF : LTF
  const s = tfSlot(map, panelIdx)
  const n = s.times.length
  const out: { time: number; high: number; low: number; close: number }[] = new Array(n)
  for (let i = 0; i < n; i++) out[i] = { time: s.times[i], high: s.high[i], low: s.low[i], close: s.close[i] }
  return out
}

// HTF auto-derivation: confirmation TF = primary MTF TF × 4 minutes. Preserves the
// fractal hierarchy (1H→4H, 30m→2H, 15m→1H). Daily/weekly roll up to D/W.
export function htfOf(tf: string): string {
  const DAYLY: Record<string, number> = { 'D': 1440, 'W': 10080 }
  const m = DAYLY[tf] ?? parseInt(tf, 10)
  if (!m || isNaN(m)) return '240'   // sane default
  const h = m * 4
  if (h >= 10080) return 'W'
  if (h >= 1440) return 'D'
  return String(h)
}

// LTF auto-derivation: trendbreak LEAD frame = primary MTF TF ÷ 4 minutes, snapped UP to
// the nearest supported sub-TF (so bar counts stay sane). 1H→15m, 30m→15m, 15m→5m,
// 5m→3m, 4H→60, D→240. This is the fractal child whose trendbreaks lead the 1H breaks.
export function ltfOf(tf: string): string {
  const SUB = [1, 3, 5, 15, 30, 60, 120, 240]
  const DAYLY: Record<string, number> = { 'D': 1440, 'W': 10080 }
  const m = DAYLY[tf] ?? parseInt(tf, 10)
  if (!m || isNaN(m)) return '15'   // sane default (matches the 1H working-TF case)
  const target = m / 4
  const snap = SUB.find(s => s >= target)
  return snap != null ? String(snap) : '240'
}

// _feedGen — bumped on every setLinguaMtfBars write. Busts the classification cache when
// bars OR params change. Per-panelIdx so each chart busts independently.
let _feedGen: Record<number, number> = {}

export function setLinguaMtfBars(panelIdx: number, role: 'mtf' | 'htf' | 'ltf', tf: string, bars: { time: number; high: number; low: number; close: number }[]) {
  if (!bars || bars.length < 75) return
  const lp = getMergedToolParams(panelIdx, 'lingua') as any
  const slopeN = lp.slopeN ?? 10
  const smooth = lp.smooth ?? 5
  const emaMid = lp.emaMid ?? 59
  const emaSlow = lp.emaSlow ?? 69
  const trendEma = lp.trendEma ?? 39
  const times = bars.map(b => b.time)
  const high = bars.map(b => b.high)
  const low = bars.map(b => b.low)
  const close = bars.map(b => b.close)
  const res = computeIndicators(times, high, low, close, slopeN, smooth, emaMid, emaSlow, trendEma)
  const target = tfSlot(role === 'mtf' ? MTF : role === 'ltf' ? LTF : HTF, panelIdx)
  target.times = res.times
  target.aop = res.aop
  target.dev = res.dev
  target.eMid = res.eMid
  target.eSlow = res.eSlow
  target.atrMid = res.atrMid
  target.atrSlow = res.atrSlow
  target.eTrend = res.eTrend
  target.pitch = res.pitch
  target.devLow = res.devLow
  target.high = res.high
  target.low = res.low
  target.close = close
  _feedGen[panelIdx] = (_feedGen[panelIdx] || 0) + 1
}

// Forward-fill lookup: most recent sample at/before `t`. Both arrays sorted by time asc.
function ffill(src: TFIndicators, t: number): { aop: number; dev: number; devLow: number } {
  const { times, aop, dev, devLow } = src
  if (times.length === 0) return { aop: NaN, dev: NaN, devLow: NaN }
  // binary search for largest time <= t
  let lo = 0, hi = times.length - 1, ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= t) { ans = mid; lo = mid + 1 }
    else hi = mid - 1
  }
  if (ans < 0) return { aop: NaN, dev: NaN, devLow: NaN }
  return { aop: aop[ans], dev: dev[ans], devLow: devLow[ans] }
}

type Stage = 'CONSOLIDATION' | 'UP CONS' | 'DOWN CONS' | 'UPTREND' | 'TRENDBREAK' | 'BACKSIDE' | 'EXTREME CONT' | 'EXTREME LOWER' | 'EUPHORIC'

// Hierarchical classify: MTF base regime + HTF alignment splits extremes.
// Consolidation requires BOTH 1H and 4H AoP flat (4H gates the noise — a brief 1H
// wiggle barely moves the slow 4H oscillator, so only genuine ranges flatten both).
// A 1H flat spot during a 4H trend = pause within the trend → inherits 4H direction.
function classifyHier(aop_m: number, dev_m: number, devLow_m: number, dev_h: number, devLow_h: number, aop_h: number, flat: number, flatH: number, xtreme: number, euThr: number, er: number, erOn: boolean, chopThr: number): Stage {
  if (isNaN(aop_m) || isNaN(dev_m)) return 'CONSOLIDATION'
  // UPSIDE extremes (uptrend): EC at the partial band (xtreme), EUPHORIC at the full
  // band (euThr) on BOTH TFs. Catalytic top vs recurring heartbeat. Upside-only — the
  // downside has its own mirror stage (EXTREME LOWER) below.
  if (dev_m >= euThr && !isNaN(dev_h) && dev_h >= euThr) return 'EUPHORIC'
  if (dev_m >= xtreme) return 'EXTREME CONT'
  // DOWNSIDE extremes (backside mirror). Both use the LOWER band (devLow, eSlow/69-EMA
  // based) at the SAME xtreme threshold (6.3) — distinguished by HTF confirmation, not a
  // higher threshold (differs from upside which uses euThr=7.2 for EUPHORIC).
  // EUPHORIC (terminal bottom): BOTH 1H and 4H stretched to the lower band → catalytic
  // bottom, move is done. Checked before EL so the terminal signal wins on confirmation.
  if (!isNaN(devLow_m) && devLow_m <= -xtreme && !isNaN(devLow_h) && devLow_h <= -xtreme) return 'EUPHORIC'
  // EXTREME LOWER: 1H stretched to the lower band, 4H not confirmed → healthy downtrend
  // thrust. Triggers a downside cooldown that holds until price reverts UP to eSlow.
  if (!isNaN(devLow_m) && devLow_m <= -xtreme) return 'EXTREME LOWER'
  const mFlat = Math.abs(aop_m) <= flat
  const hFlat = isNaN(aop_h) ? true : Math.abs(aop_h) <= flatH
  // CLEANLINESS dim (Efficiency Ratio): low ER = choppy (movement, little net progress).
  // A choppy-but-directional move is noise around a mean → consolidation flavor, NOT a
  // clean trend. Splits each directional residence stage into CLEAN (UPTREND/BACKSIDE) vs
  // CHOPPY (UP CONS / DOWN CONS). This kills the rapid UP↔BACKSIDE flicker through chop:
  // those oscillations now resolve to a single net-direction consolidation stage.
  const chop = erOn && !isNaN(er) && er < chopThr
  // Both TFs flat → consolidation regardless of cleanliness.
  if (mFlat && hFlat) return 'CONSOLIDATION'
  // Net direction: MTF angle if trending, else HTF angle (MTF pausing inside HTF trend).
  const up = mFlat ? aop_h > 0 : aop_m > flat
  if (chop) return up ? 'UP CONS' : 'DOWN CONS'
  return up ? 'UPTREND' : 'BACKSIDE'
}

// Schmitt-trigger hysteresis: a new stage must persist before it locks in.
// Option B (asymmetric): EXTREME events (EC/EUPHORIC) lock in 1 bar — they are binary
// (price is AT the band; there's nothing to debounce). Residence stages (UP/CO/Backside)
// still need `holdBars` consecutive bars to kill flicker in chop. Fixes "hits ec late"
// without loosening the noise filter on the stages where noise actually lives.
function applyHysteresis(stages: Stage[], holdBars: number): Stage[] {
  if (stages.length === 0 || holdBars <= 1) return stages
  const EXTREME: Record<string, true> = { 'EXTREME CONT': true, 'EUPHORIC': true, 'EXTREME LOWER': true }
  const holdFor = (s: Stage) => EXTREME[s] ? 1 : holdBars
  const out: Stage[] = new Array(stages.length)
  let locked: Stage = stages[0] in VALID_STAGES ? stages[0] : 'CONSOLIDATION'
  let candidate: Stage | null = null
  let count = 0
  for (let i = 0; i < stages.length; i++) {
    const raw = stages[i] in VALID_STAGES ? stages[i] : 'CONSOLIDATION'
    if (raw === locked) {
      candidate = null; count = 0
    } else if (raw === candidate) {
      count++
      if (count >= holdFor(raw)) { locked = candidate!; candidate = null; count = 0 }
    } else {
      candidate = raw; count = 1
      if (count >= holdFor(raw)) { locked = candidate!; candidate = null; count = 0 }
    }
    out[i] = locked
  }
  return out
}

// Post-extreme reset: an EC/EUPHORIC/EL fires ONCE, then is held (cooldown) until price
// returns to the 1H slow EMA (eSlow — the lower mean line, parametric), at which point
// UPTREND/BACKSIDE resumes. Kills repeat-extreme flicker while still extended; enforces
// the mean-reversion gate before the trend resumes.
// (Per user spec: reset gate on the slow EMA — EC fires once, then UPTREND resumes when
//  price reverts to eSlow. eSlow default = 69.)
function applyExtremeReset(stages: Stage[], dev: number[], eSlow: number[], high: number[], low: number[]): Stage[] {
  const EXTREME: Record<string, true> = { 'EXTREME CONT': true, 'EUPHORIC': true, 'EXTREME LOWER': true }
  const RANK: Record<string, number> = { 'EXTREME CONT': 1, 'EUPHORIC': 2, 'EXTREME LOWER': 1 }   // escalate EC→EUPHORIC mid-cooldown
  const out: Stage[] = stages.slice()
  let cd = false
  let cdDir = 0        // +1 upside extreme (resume UPTREND), -1 downside (resume BACKSIDE)
  let cdLabel: Stage = 'CONSOLIDATION'
  for (let i = 0; i < stages.length; i++) {
    const e = eSlow[i], d = dev[i]
    if (cd) {
      const touched = !isNaN(e) && ((cdDir > 0 && low[i] <= e) || (cdDir < 0 && high[i] >= e))
      if (touched) {
        cd = false
        out[i] = cdDir > 0 ? 'UPTREND' : 'BACKSIDE'
      } else {
        // hold the cooldown label, but escalate if the move worsens (EC→EUPHORIC) —
        // preserves the terminal-top signal without re-firing a separate event
        const s = stages[i]
        if (EXTREME[s] && (RANK[s] || 0) > (RANK[cdLabel] || 0)) cdLabel = s
        out[i] = cdLabel
      }
    } else {
      const s = stages[i]
      if (EXTREME[s] && !isNaN(d) && !isNaN(e)) {
        // Direction from stage name (robust): downside extreme → −1, upside → +1.
        cd = true; cdDir = d >= 0 ? 1 : -1; cdLabel = s; out[i] = s
      } else out[i] = s
    }
  }
  return out
}
const VALID_STAGES: Record<string, true> = { 'CONSOLIDATION': true, 'UP CONS': true, 'DOWN CONS': true, 'UPTREND': true, 'TRENDBREAK': true, 'BACKSIDE': true, 'EXTREME CONT': true, 'EXTREME LOWER': true, 'EUPHORIC': true }

// Trendbreak detection — the EARLY structural break. During a respected uptrend, the
// gold eTrend (default 39) is the trend line price holds. The bar where close LOSES it
// = the trendbreak — this fires well before the eSlow slope flips (the delayed BACKSIDE
// confirmation). So the pipeline becomes: UPTREND → TRENDBREAK → BACKSIDE (slope confirm)
// or → back to UPTREND if price reclaims eTrend (failed break). Runs last so it doesn't
// interfere with extreme cooldowns; upside-only for now (downside has EL/EUPHORIC).
function applyTrendBreak(
  stages: Stage[], aop: number[], eTrend: number[], atrMid: number[], close: number[],
  flat: number, tbConfirm: number, tbMargin: number, tbReclaim: number,
): Stage[] {
  const out: Stage[] = stages.slice()
  let inBreak = false
  let belowBars = 0      // consecutive closes below eTrend (build toward a confirmed break)
  let breakStart = -1    // index where the break streak began (retro-label the window)
  let reclaimBars = 0    // consecutive closes back ≥ eTrend while breaking (fail the break)
  for (let i = 0; i < stages.length; i++) {
    const t = eTrend[i], c = close[i], a = aop[i], atr = atrMid[i]
    // tbMargin = how far below eTrend (in ATR units) a close must sit to count as a break.
    // Filters microscopic tags — a close that merely wicks through doesn't qualify.
    const margin = (!isNaN(atr) && atr > 0) ? tbMargin * atr : 0
    const broke = !isNaN(t) && !isNaN(c) && c < t - margin
    const reclaimed = !isNaN(t) && !isNaN(c) && c >= t
    if (inBreak) {
      // Resolve the break attempt: slope confirms dead (aop ≤ −flat) → BACKSIDE; or price
      // reclaims the gold line for tbReclaim bars → failed break, back to UPTREND.
      if (reclaimed) reclaimBars++; else reclaimBars = 0
      if (!isNaN(a) && a <= -flat) { inBreak = false; reclaimBars = 0; out[i] = 'BACKSIDE' }
      else if (reclaimBars >= tbReclaim) { inBreak = false; reclaimBars = 0; out[i] = 'UPTREND' }
      else out[i] = 'TRENDBREAK'
    } else if (out[i] === 'UPTREND' || out[i] === 'UP CONS') {
      // Build a break streak: tbConfirm consecutive qualifying closes before TRENDBREAK
      // commits. Retro-labels the whole window so the orange region starts where price
      // first lost the line, not where it "confirmed."
      if (broke) { if (belowBars === 0) breakStart = i; belowBars++ }
      else { belowBars = 0; breakStart = -1 }
      if (belowBars >= tbConfirm && breakStart >= 0) {
        inBreak = true
        for (let j = breakStart; j <= i; j++) out[j] = 'TRENDBREAK'
      }
    } else { belowBars = 0; breakStart = -1 }
  }
  return out
}

// ── LTF (15m) trendbreak LEAD events — fractal child frame ──
// Same triggers as the 1H trendbreak (close < eTrend during an uptrend), run on the MTF÷4
// frame. Because the finer structure breaks first, these timestamps LEAD the 1H TB band.
// Single-frame regime (slope-only raw classify — LTF has no coarser co-parent), then the
// SAME hysteresis + applyTrendBreak. Returns the START timestamp of each TRENDBREAK run.
// Cached independently of the MTF classification (separate signature, per-panelIdx).
let _cacheLtf: Record<number, { sig: string; events: number[] }> = {}
function computeLtfTrendbreakEvents(panelIdx: number, flat: number, flatH: number, holdBars: number, tbOn: number, tbLtfOn: number, tbConfirm: number, tbMargin: number, tbReclaim: number): number[] {
  if (!tbOn || !tbLtfOn) return []
  const ltf = tfSlot(LTF, panelIdx)
  const n = ltf.times.length
  if (n < 75) return []
  const sig = `${n}|${ltf.times[n-1]}|${flat}|${holdBars}|${tbConfirm}|${tbMargin}|${tbReclaim}|${_feedGen[panelIdx] || 0}`
  const c = _cacheLtf[panelIdx]
  if (c && c.sig === sig) return c.events
  // Single-frame raw regime from slope (no HTF co-parent to split extremes).
  const raw: Stage[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const a = ltf.aop[i]
    raw[i] = isNaN(a) ? 'CONSOLIDATION' : a > flat ? 'UPTREND' : a < -flat ? 'BACKSIDE' : 'CONSOLIDATION'
  }
  const hyst = applyHysteresis(raw, holdBars)
  const tb = applyTrendBreak(hyst, ltf.aop, ltf.eTrend, ltf.atrMid, ltf.close, flat, tbConfirm, tbMargin, tbReclaim)
  const events: number[] = []
  for (let i = 0; i < n; i++) {
    if (tb[i] === 'TRENDBREAK' && (i === 0 || tb[i - 1] !== 'TRENDBREAK')) events.push(ltf.times[i])
  }
  _cacheLtf[panelIdx] = { sig, events }
  return events
}

// ── memoized classification cache: only recompute when inputs change ──
// Per-panelIdx: each chart caches its own classification (different params → different stages).
let _cacheSig: Record<number, string> = {}
let _cacheMtfHyst: Record<number, Stage[]> = {}
let _cacheRawTransitions: Record<number, number> = {}
let _cacheHystTransitions: Record<number, number> = {}
function computeCachedClassification(panelIdx: number, flat: number, flatH: number, xtreme: number, euThr: number, holdBars: number, tbOn: number, tbConfirm: number, tbMargin: number, tbReclaim: number, erOn: boolean, chopThr: number, pitchOn: boolean, pitchWin: number, pitchBlend: number, structOn: boolean, structHtfExt: number, structSuppress: boolean): {
  mtfHyst: Stage[], rawTrans: number, hystTrans: number, n: number,
} {
  const mtf = tfSlot(MTF, panelIdx), htf = tfSlot(HTF, panelIdx)
  const n = mtf.times.length
  // _feedGen busts the cache when MTF/HTF bars are re-fed (incl. on param change, which
  // re-runs setLinguaMtfBars via the ReactChartPanel param-subscription effect).
  const pitchSmooth = ((getMergedToolParams(panelIdx, 'lingua') as any).cyclePitchSmooth as number) ?? 5
  const sig = `${n}|${mtf.times[n-1]}|${htf.times.length}|${flat}|${flatH}|${xtreme}|${euThr}|${holdBars}|${tbOn}|${tbConfirm}|${tbMargin}|${tbReclaim}|${erOn}|${chopThr}|${pitchOn}|${pitchWin}|${pitchBlend}|${pitchSmooth}|${structOn}|${structHtfExt}|${structSuppress}|${_feedGen[panelIdx] || 0}`
  const cached = _cacheMtfHyst[panelIdx]
  if (sig === _cacheSig[panelIdx] && cached && cached.length === n) {
    return { mtfHyst: cached, rawTrans: _cacheRawTransitions[panelIdx] || 0, hystTrans: _cacheHystTransitions[panelIdx] || 0, n }
  }
  // Recompute only on signature change (bars arrived / params changed)
  const mtfRaw: Stage[] = new Array(n)
  // EFFICIENCY RATIO (cleanliness) on MTF close — point-in-time, no look-forward. Feeds the
  // 2D angle×cleanliness stage split. Low ER = chop → UP CONS / DOWN CONS instead of trend.
  // Computed only when erOn (skipped entirely when off → zero overhead, old behavior).
  const erLen = 20, erSmooth = 10
  const erMtf: number[] = new Array(n).fill(NaN)
  if (erOn) {
    const erRaw: number[] = new Array(n).fill(NaN)
    for (let i = erLen; i < n; i++) {
      const net = Math.abs(mtf.close[i] - mtf.close[i - erLen])
      let path = 0
      for (let k = i - erLen + 1; k <= i; k++) path += Math.abs(mtf.close[k] - mtf.close[k - 1])
      erRaw[i] = path > 0 ? net / path : 0
    }
    let se = NaN; const ea = 2 / (erSmooth + 1)
    for (let i = 0; i < n; i++) { if (isNaN(erRaw[i])) continue; se = isNaN(se) ? erRaw[i] : se + (erRaw[i] - se) * ea; erMtf[i] = se }
  }
  // STRUCTURAL PITCH (Theil–Sen) — rolling MEDIAN pairwise slope of recent MTF closes,
  // ATR(14)-normalized to match `aop`'s scale. Blended into the classifier's angle signal
  // (aop, the laggy EMA-slope) to make the cycle respond to real structure faster — fixes
  // 'consolidation detected late'. On RAW bars density is uniform (1/bar) so the median
  // pairwise slope is a pure trend estimate with NO cluster bias — the per-bar analog of
  // the box-channel Theil–Sen drift, but available at classify time. Point-in-time (window
  // strictly behind i), scan-safe. OFF → aopEff === mtf.aop (exact prior behavior).
  const aopEff: number[] = mtf.aop.slice()
  if (pitchOn && pitchWin >= 5 && pitchBlend > 0) {
    const atr14 = wilderAtr(mtf.high, mtf.low, mtf.close, 14)
    const W = Math.max(5, Math.floor(pitchWin))
    const pa = 2 / (Math.max(1, pitchSmooth) + 1)   // EMA alpha — smooths the raw median (matches aop's own smoothing)
    let pse = NaN                                    // running EMA of the ATR-normalized pitch
    for (let i = W; i < n; i++) {
      const base = mtf.aop[i], den = atr14[i]
      if (isNaN(base) || isNaN(den) || den === 0) continue
      const slopes: number[] = []
      for (let a = i - W + 1; a < i; a++) {
        const ca = mtf.close[a]; if (isNaN(ca)) continue
        for (let b = a + 1; b <= i; b++) {
          const cb = mtf.close[b]; if (isNaN(cb)) continue
          slopes.push((cb - ca) / (b - a))
        }
      }
      if (slopes.length < 2) continue
      slopes.sort((x, y) => x - y)
      const m = slopes.length >> 1
      const ts = slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2  // price/bar
      const norm = ts / den                                                         // → aop scale
      pse = isNaN(pse) ? norm : pse + (norm - pse) * pa                            // EMA smooth (lag-free init)
      aopEff[i] = base * (1 - pitchBlend) + pse * pitchBlend                       // blend the SMOOTHED pitch
    }
  }
  for (let i = 0; i < n; i++) {
    const h = ffill(htf, mtf.times[i])
    mtfRaw[i] = classifyHier(aopEff[i], mtf.dev[i], mtf.devLow[i], h.dev, h.devLow, h.aop, flat, flatH, xtreme, euThr, erMtf[i], erOn, chopThr)
  }
  const mtfHyst0 = applyHysteresis(mtfRaw, holdBars)
  // Post-extreme reset on the 1H timeline: EC/EUPHORIC/EL fires once, holds until price
  // touches the 1H slow EMA (eSlow), then UPTREND/BACKSIDE resumes.
  const mtfHystExt = applyExtremeReset(mtfHyst0, mtf.dev, mtf.eSlow, mtf.high, mtf.low)
  // Trendbreak detection: UPTREND → TRENDBREAK when close loses the gold eTrend line;
  // resolves to BACKSIDE when eSlow slope confirms down, or back to UPTREND if price
  // reclaims eTrend. Early structural break — fires before the slope-based BACKSIDE.
  const mtfHyst = tbOn ? applyTrendBreak(mtfHystExt, aopEff, mtf.eTrend, mtf.atrMid, mtf.close, flat, tbConfirm, tbMargin, tbReclaim) : mtfHystExt
  // ── STRUCTURAL BREAK GATE (4th stage) ──
  // Reshape CONSOLIDATION → trend on anchored-trendline BREAKS, modulated by HTF extension.
  // Breaks detected on the MTF (1H) timeline via the SAME computeAnchoredTrendline the
  // visual main/light lines use → classifier break is coherent with what's drawn.
  // Point-in-time (breakBar uses only close[k] ≤ bar k), scan-safe. Eagerness scales with
  // HTF state at the break bar:
  //   HTF extended + ALIGNED with break → eager: flip on MAIN or LIGHT line break
  //   HTF aligned, not extended          → standard: flip on MAIN line break only
  //   HTF extended AGAINST the break     → suppress (counter-trend exhaustion; no flip)
  // The flip forward-converts the trailing consolidation RUN → accelerates the laggy EMA
  // flip to the real structural break ("consolidation detected late" / breakout).
  // OFF → mtfFinal === mtfHyst (exact prior behavior). trendline params read live so the
  // gate tracks main/light pivots; struct* params own the cache sig (bust on change).
  let mtfFinal: Stage[] = mtfHyst
  if (structOn) {
    const tp = getMergedToolParams(panelIdx, 'lingua') as any
    const tlLeft = (tp.tlLeft as number) ?? 69, tlRight = (tp.tlRight as number) ?? 21, tlPattern = (tp.tlPattern as number) ?? 5
    const tlMainLeft = (tp.tlMainLeft as number) ?? 69, tlMainRight = (tp.tlMainRight as number) ?? 15, tlMainPattern = (tp.tlMainPattern as number) ?? 3
    const tlMinSize = (tp.tlMinSize as number) ?? 1.2
    const segs = computeAnchoredTrendline(mtf.high, mtf.low, mtf.close, 1, tlLeft, tlRight, tlPattern, tlMainLeft, tlMainRight, tlMainPattern, tlMinSize, 0, 0).segments
    mtfFinal = mtfHyst.slice()
    const extThr = structHtfExt * xtreme
    const flipRun = (start: number, stage: Stage) => {
      for (let k = start; k < n; k++) {
        const s = mtfFinal[k]
        if (s !== 'CONSOLIDATION' && s !== 'UP CONS' && s !== 'DOWN CONS') break
        mtfFinal[k] = stage
      }
    }
    for (const seg of segs) {
      const i = seg.breakBar
      if (i < 0 || i >= n) continue
      const stg = mtfFinal[i]
      if (stg !== 'CONSOLIDATION' && stg !== 'UP CONS' && stg !== 'DOWN CONS') continue
      const h = ffill(htf, mtf.times[i]), hAop = h.aop
      const extUp = h.dev >= extThr, extDn = h.devLow >= extThr
      const alignedUp = !isNaN(hAop) && hAop > 0, alignedDn = !isNaN(hAop) && hAop < 0
      if (seg.dir === -1) {                 // resistance broken up → bullish breakout
        if (structSuppress && extDn && alignedDn) continue                                   // suppress: upside poke into macro DOWN
        if (!(extUp && alignedUp) && !seg.main) continue                                     // eager=main+light; standard=main only
        flipRun(i, 'UPTREND')
      } else {                               // support broken down → bearish breakdown
        if (structSuppress && extUp && alignedUp) continue                                   // suppress: downside poke into macro UP
        if (!(extDn && alignedDn) && !seg.main) continue
        flipRun(i, 'BACKSIDE')
      }
    }
  }
  let rawTrans = 0, hystTrans = 0
  for (let i = 1; i < n; i++) {
    if (mtfRaw[i] !== mtfRaw[i - 1]) rawTrans++
    if (mtfFinal[i] !== mtfFinal[i - 1]) hystTrans++
  }
  _cacheSig[panelIdx] = sig
  _cacheMtfHyst[panelIdx] = mtfFinal
  _cacheRawTransitions[panelIdx] = rawTrans
  _cacheHystTransitions[panelIdx] = hystTrans
  return { mtfHyst: mtfFinal, rawTrans, hystTrans, n }
}

// ── displayed-TF indicator cache (for bands/clouds overlay) ──
// Computed on the VISIBLE timeframe bars (aligns with candles on screen),
// independent of the MTF/HTF classification caches above. Per-panelIdx so charts with
// different emaMid/emaSlow params don't share one displayed-TF slot.
let _dcSig: Record<number, string> = {}
let _dc: Record<number, { e9: number[]; e20: number[]; eMid: number[]; eSlow: number[]; eTrend: number[]; pitch: number[]; atr: number[]; atrMid: number[]; atrSlow: number[]; mean: number[]; eCloudF?: number[]; eCloudS?: number[] }> = {}
// Last computed displayed-TF pitch per panel — consumed by renderLinguaPitchOverlay,
// which runs AFTER the crosshair (called from ReactChartPanel) so the crosshair's dashed
// lines don't slash through / overwrite the pitch readout.
let _panelPitch: Record<number, { pitch: number[]; vs: number }> = {}
function computeDisplayedTF(panelIdx: number, data: any[]) {
  const tp = getMergedToolParams(panelIdx, 'lingua') as any
  const emaMid = tp.emaMid ?? 59
  const emaSlow = tp.emaSlow ?? 69
  const trendEma = tp.trendEma ?? 39
  const cloudFast = tp.cloudFast ?? 200
  const cloudSlow = tp.cloudSlow ?? 236
  const cached = _dc[panelIdx]
  if (!data || data.length === 0) return cached || { e9: [], e20: [], eMid: [], eSlow: [], eTrend: [], pitch: [], atr: [], atrMid: [], atrSlow: [], mean: [], eCloudF: [], eCloudS: [] }
  const sig = `${data.length}|${data[data.length - 1].time}|${emaMid}|${emaSlow}|${trendEma}|${cloudFast}|${cloudSlow}`
  if (sig === _dcSig[panelIdx] && cached) return cached
  const close = data.map((b: any) => b.close as number)
  const high = data.map((b: any) => b.high as number)
  const low = data.map((b: any) => b.low as number)
  const e9 = ema(close, 9), e20 = ema(close, 20), eMid = ema(close, emaMid), eSlow = ema(close, emaSlow)
  // 200/236 long-term cycle cloud EMAs — drawn in Lingua cycle red/green (tunable periods).
  const eCloudF = ema(close, cloudFast), eCloudS = ema(close, cloudSlow)
  // Trend Pitch EMA — slower EMA (default 63) whose blended 10/30/60 slope the pitch
  // metric measures. Computed on the DISPLAYED TF so the visible line + hover readout
  // + top-right readout are all coherent (what you SEE = what you read).
  const eTrend = ema(close, trendEma)
  const aTrend = wilderAtr(high, low, close, trendEma)
  const PITCH_WIN = [10, 30, 60]
  const pitch: number[] = new Array(close.length).fill(NaN)
  for (let i = 0; i < close.length; i++) {
    if (isNaN(eTrend[i]) || isNaN(aTrend[i]) || aTrend[i] === 0) continue
    let sum = 0, cnt = 0
    for (const w of PITCH_WIN) {
      if (i >= w && !isNaN(eTrend[i - w])) { sum += (eTrend[i] - eTrend[i - w]) / w / aTrend[i]; cnt++ }
    }
    if (cnt > 0) pitch[i] = sum / cnt
  }
  // ATR period mirrors the EMA period (same construction as db_72_89).
  const atr = wilderAtr(high, low, close, 14), atrMid = wilderAtr(high, low, close, emaMid), atrSlow = wilderAtr(high, low, close, emaSlow)
  const mean = close.map((_, i) => (eMid[i] + eSlow[i]) / 2)
  _dcSig[panelIdx] = sig; _dc[panelIdx] = { e9, e20, eMid, eSlow, eTrend, pitch, atr, atrMid, atrSlow, mean, eCloudF, eCloudS }
  return _dc[panelIdx]
}

// ── SWING TRENDLINE — hand-drawn structural trend ──
// The MEAN break (applyTrendBreak) fires when close loses the gold eTrend EMA. This is
// the STRUCTURAL break: a line through the significant swing pivots (lows in an uptrend,
// highs in a downtrend), drawn exactly as a trader does by hand. Origin pivot → most
// recent higher low, extended forward; close through the extended line = the structural
// trendbreak. Drawn as a SEPARATE layer (cyan) so both breaks are visible at once.
//
// Pivot model (per user): the 3-bar fractal is the SEED concept, but a pivot only counts
// as SIGNIFICANT (anchorable) with 5-5 confirmation — the window that filters the
// wiggles a 3-bar would pass. A secondary min-swing filter (×ATR between consecutive
// anchors) keeps only the "main" swing points. The line needs 3 clear pivots before its
// break is trusted (the adaptive "wait for the trend to form" gate) — before that it is
// drawn dashed/tentative and emits NO break.

/** fractalPivots — local extrema of `src` with left/right confirmation bars.
 *  findHigh=true → swing highs (peaks), false → swing lows (troughs). A bar qualifies if
 *  NO neighbor in [i-left, i+right] is strictly beyond it (equal allowed → flat tops count). */
function fractalPivots(src: number[], left: number, right: number, findHigh: boolean): { idx: number; price: number }[] {
  const n = src.length
  const out: { idx: number; price: number }[] = []
  for (let i = left; i < n - right; i++) {
    const v = src[i]
    if (isNaN(v)) continue
    let ok = true
    for (let k = 1; k <= left && ok; k++)  { const x = src[i - k]; if (isNaN(x) || (findHigh ? x > v : x < v)) ok = false }
    for (let k = 1; k <= right && ok; k++) { const x = src[i + k]; if (isNaN(x) || (findHigh ? x > v : x < v)) ok = false }
    if (ok) out.push({ idx: i, price: v })
  }
  return out
}

/** confirmPivot — MODULE-LEVEL (shared by computeSwingTrendline + the anchored trendline
 *  tool). Filters pattern-candidate pivots by a SECOND look-window: a candidate survives
 *  only if NO bar in [idx-left, idx+right] is strictly beyond it. Pure (no closure capture)
 *  so it hoists safely. */
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

/** atrDisp — ATR (Wilder's RMA of True Range) over DISPLAYED-chart arrays. Used by the
 *  anchored trendline tool for min-size filtering (drop micro-lines < N×ATR apart). Pure,
 *  module-level so any displayed-data tool can reuse it. */
function atrDisp(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length
  const tr = new Array(n).fill(NaN)
  for (let i = 1; i < n; i++) {
    if (isNaN(high[i]) || isNaN(low[i]) || isNaN(close[i - 1])) continue
    const pc = close[i - 1]
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - pc), Math.abs(low[i] - pc))
  }
  const out = new Array(n).fill(NaN)
  const k = 1 / Math.max(1, len)
  let prev = NaN
  for (let i = 0; i < n; i++) {
    if (isNaN(tr[i])) continue
    prev = isNaN(prev) ? tr[i] : tr[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

type TrendSeg = {
  dir: 1 | -1                   // 1 = uptrend (support from lows), -1 = downtrend (resistance from highs)
  from: { idx: number; price: number }
  to: { idx: number; price: number }
  line: number[]                // MTF-timeline values; NaN outside [from.idx, break/end]
  breakIdx: number              // -1 if unbroken, else first closing candle through the line
  retestIdx: number             // -1 if none, else bar where price came back & tapped the broken line
  majorBreak: boolean           // true if a 9/20 EMA cross in the break's direction confirms it
  main: boolean                 // the consensus MAIN trend line (Theil-Sen) — bold, the break target
  touches: number               // # pivots respecting this line (main lines only)
  active: boolean               // most-recent unbroken segment (highlighted at render time)
  tentative: boolean            // most-recent pivot pair (right edge), still forming live
  tier: number                  // 1=big (major swings, thick), 2=medium, 3=small (minor, thin)
}

type SwingResult = {
  segments: TrendSeg[]          // EVERY trendline across the FULL chart history — uptrend legs from
                                // rising lows + downtrend legs from falling highs. Many legs ⇒ many
                                // lines + many breaks throughout the chart.
  pivots: { idx: number; price: number }[]   // all significant swing pivots (for dots)
}

/** computeSwingTrendline — JD-PORT trendlines (© Joris Duyck "Trendlines - JD") across the
 *  full chart history, on the MTF (1H) timeline. STRUCTURE-DRIVEN and decoupled from the
 *  stage machine. Every ADJACENT pivot pair defines one trendline at the raw slope
 *  between them; the ONLY filter is disp_select (the slope gate): FALLING highs become
 *  resistance (dir=-1), RISING lows become support (dir=1). Because consecutive
 *  significant pivots are naturally monotonic, the lines slope WITH the dominant move —
 *  trend-following is emergent, not searched. No colinearity, no touch-counting. Each
 *  line extends right from its anchor until price closes through it (debounced by
 *  swConfirm closes); the render layer drops a colored wedge on the break candle. The
 *  most-recent pair (right edge) is tentative/dashed. swTouchTol drives retest
 *  for future quality scoring; swCloudFast/Slow drive the EMA-cloud band drawn in render. */
function computeSwingTrendline(
  panelIdx: number,
  swOn: number, swPattern: number, swLeft: number, swRight: number, swMinSwing: number, swConfirm: number,
  swTouches: number, swTouchTol: number, swCloudFast: number, swCloudSlow: number,
  swBreakConfirm: number, swEmaFast: number, swEmaSlow: number, swShowBothSides: number,
): SwingResult {
  const empty: SwingResult = { segments: [], pivots: [] }
  if (!swOn) return empty
  const mtf = tfSlot(MTF, panelIdx)
  const n = mtf.times.length
  if (n < swLeft + swRight + 10) return empty

  // 9/20 EMA CROSS CONFIRMATION for major breaks. A trendline break is only "major" when
  // momentum confirms it: emaFast crosses emaSlow in the break's direction within a small
  // window of the break bar. Support break (dir=1, bearish) needs the bearish cross (fast
  // below slow); resistance break (dir=-1, bullish) needs the bullish cross (fast above
  // slow). crossFlags[k] = +1 bullish-cross bar, -1 bearish-cross bar, 0 otherwise. The EMA
  // cross lags price, so the window scans FORWARD from the break (default 8 bars).
  const emaF = ema(mtf.close, Math.max(2, swEmaFast))
  const emaS = ema(mtf.close, Math.max(3, swEmaSlow))
  const crossFlags: number[] = new Array(n).fill(0)
  for (let k = 1; k < n; k++) {
    if (isNaN(emaF[k]) || isNaN(emaS[k]) || isNaN(emaF[k - 1]) || isNaN(emaS[k - 1])) continue
    const wasBelow = emaF[k - 1] <= emaS[k - 1], isAbove = emaF[k] > emaS[k]
    const wasAbove = emaF[k - 1] >= emaS[k - 1], isBelow = emaF[k] < emaS[k]
    if (wasBelow && isAbove) crossFlags[k] = 1
    else if (wasAbove && isBelow) crossFlags[k] = -1
  }
  const CROSS_WINDOW = 8

  // (EMA cloud is drawn as a visual layer in the render block; JD's trend-following uses
  // a slope-direction filter, not a regime gate, so no cloud computation is needed here.)

  // (minSwingFilter REMOVED — it was thinning consecutive pivots and breaking the master
  // trendline chain in choppier moves. JD connects EVERY consecutive pair; the master
  // line emerges as overlapping near-colinear pairs, not from endpoint-thinning. The
  // look-window confirmation alone is the significance gate, faithful to JD.)
  // TWO-TIER pivot detection. Swing Pattern (e.g. 3-bar fractal) finds CANDIDATE pivots —
  // it's the detection sensitivity. Look Left/Right then CONFIRMS a candidate as
  // significant: it must remain the extreme across the wider [i-lookLeft, i+lookRight]
  // window (no bar more extreme in that span). This mirrors how a trader reads structure:
  // a 3-bar swing is a hint, the 5-5 window is what makes it a "main" pivot worth
  // connecting. Both knobs now matter — pattern = how many hints, look L/R = the bar.
  const patternSide = Math.max(1, Math.floor((swPattern - 1) / 2))
  // confirmPivot is now module-level (hoisted out so the anchored trendline tool can share it).
  // MULTI-SCALE pivot detection — one set per tier. detectPivots(left,right) runs the
  // 2-tier filter (pattern candidates → look-window confirmation) at a given scale.
  const detectPivots = (left: number, right: number) => ({
    lows: confirmPivot(fractalPivots(mtf.low, patternSide, patternSide, false), mtf.low, false, left, right),
    highs: confirmPivot(fractalPivots(mtf.high, patternSide, patternSide, true), mtf.high, true, left, right),
  })

  // JD-PORT TRENDLINES (© Joris Duyck "Trendlines - JD"). Connect CONSECUTIVE pivots of the
  // same type — each adjacent pair (pivot i, pivot i+1) defines one trendline at the raw
  // slope between them. No colinearity search, no 3-touch requirement, no regime gate. The
  // ONLY filter is disp_select (the genius of JD's model): draw FALLING highs (resistance,
  // slope<0) and RISING lows (support, slope>0). Consecutive pivots in a real trend are
  // monotonic, so the lines naturally slope WITH the trend and the slope filter drops
  // counter-trend ones — trend-following is EMERGENT, not computed. Each line extends
  // forward from its anchor; break = close crosses the extended line (debounced). The
  // most-recent pair draws tentative/dashed. Produces a bunch of trendlines tracking the
  // trend, exactly as JD's indicator does. dir=1 → support from lows; dir=-1 → resistance.
  const findTouchLines = (pv: { idx: number; price: number }[], dir: 1 | -1, tier: number): TrendSeg[] => {
    // (real-time extension — no batch search)
    const buildLine = (
      A: { idx: number; price: number }, B: { idx: number; price: number },
      toP: { idx: number; price: number }, slope: number, tentative: boolean, tier: number,
    ): TrendSeg => {
      const line: number[] = new Array(n).fill(NaN)
      let breakIdx = -1, streak = 0, streakStart = -1
      for (let k = A.idx; k < n; k++) {
        const v = A.price + slope * (k - A.idx)
        line[k] = v
        if (breakIdx < 0) {
          const cl = mtf.close[k]
          if (!isNaN(cl)) {
            const broken = dir === 1 ? cl < v : cl > v
            if (broken) { if (streak === 0) streakStart = k; streak++ }
            else { streak = 0; streakStart = -1 }
            if (streak >= Math.max(1, swConfirm) && streakStart >= 0) breakIdx = streakStart
          }
        }
      }
      let retestIdx = -1, majorBreak = false
      if (breakIdx >= 0) {
        for (let k = breakIdx + 1; k < n; k++) line[k] = NaN
        // MAJOR BREAK: scan forward for a 9/20 cross in the break's direction. dir=1
        // (support broke, bearish) wants cross -1; dir=-1 (resistance broke, bullish) wants +1.
        const want = dir === 1 ? -1 : 1
        for (let k = breakIdx; k < Math.min(n, breakIdx + CROSS_WINDOW + 1); k++) {
          if (crossFlags[k] === want) { majorBreak = true; break }
        }
        // RETEST: price must break AWAY from the line first, then come BACK to tap it.
        // Right after the break price is still AT the line, so a naive scan flags every
        // break as a retest. Fix: skip the immediate bars, require price to have moved
        // at least 0.5 ATR away, then flag the first tight return as the retest. Tolerance
        // is the user's Touch Tol (×ATR) param — so it's actually tunable now.
        const RETEST_TOL = Math.max(0.02, swTouchTol)
        const RETEST_SKIP = 3
        let movedAway = false
        for (let k = breakIdx + 1; k < n; k++) {
          const v = A.price + slope * (k - A.idx)
          const atr = mtf.atrMid[k]
          if (isNaN(atr) || atr <= 0) continue
          const pr = dir === 1 ? mtf.high[k] : mtf.low[k]
          if (isNaN(pr)) continue
          const dist = Math.abs(pr - v)
          if (k > breakIdx + RETEST_SKIP) {
            if (dist > 0.5 * atr) movedAway = true
            if (movedAway && dist <= RETEST_TOL * atr) { retestIdx = k; break }
          }
        }
      }
      return { dir, from: A, to: toP, line, breakIdx, retestIdx, majorBreak, active: false, tentative, tier, main: false, touches: 0 }
    }
    // JD CONSECUTIVE-PAIR MODEL: every adjacent pivot pair defines one trendline. The only
    // filter is disp_select — the slope-direction gate: falling highs (resistance) and
    // rising lows (support). This is the trend-following core: consecutive significant
    // pivots are naturally monotonic, so the lines slope WITH the dominant move and
    // counter-trend pairs are silently dropped by the slope gate. No search, no
    // colinearity, no regime map — the structure does the work.
    const out: TrendSeg[] = []
    for (let i = 0; i < pv.length - 1; i++) {
      const A = pv[i], B = pv[i + 1]
      const slope = (B.price - A.price) / (B.idx - A.idx)
      // MIN SIZE: drop micro-lines between pivots too close in price (< swMinSwing×ATR).
      // This is what the "Min Size" param actually controls — only pairs with a real price
      // move become trendlines, killing the noise from tiny adjacent pivots.
      const atrA = mtf.atrMid[A.idx]
      if (!isNaN(atrA) && atrA > 0 && Math.abs(B.price - A.price) < swMinSwing * atrA) continue
      const rising = slope > 0
      if (!swShowBothSides) {
        if (dir === 1 && !rising) continue     // support = rising lows (winning side)
        if (dir === -1 && rising) continue     // resistance = falling highs (winning side)
      }
      // The most-recent pair (right edge) is tentative/dashed — still forming live.
      const tentative = i === pv.length - 2
      out.push(buildLine(A, B, B, slope, tentative, tier))
    }
    // MAIN TREND LINE — the "consistent average" the mini-trends cluster around. Theil-Sen
    // robust regression (median of all pairwise slopes = the consensus trend direction),
    // positioned at the median intercept. The line the most pivots respect IS the key
    // structural trendline — the one we watch for the MAIN break. Requires ≥ swTouches
    // respecting pivots (within Touch Tol × ATR). Drawn bold; carries a `touches` count.
    if (pv.length >= Math.max(3, swTouches)) {
      const slopes: number[] = []
      for (let i = 0; i < pv.length; i++) for (let j = i + 1; j < pv.length; j++)
        slopes.push((pv[j].price - pv[i].price) / (pv[j].idx - pv[i].idx))
      if (slopes.length) {
        slopes.sort((a, b) => a - b)
        const mSlope = slopes[slopes.length >> 1]
        const ints = pv.map(p => p.price - mSlope * p.idx).sort((a, b) => a - b)
        const intercept = ints[ints.length >> 1]
        const respected = pv.filter(p => {
          const a = mtf.atrMid[p.idx]
          const tol = (!isNaN(a) && a > 0) ? swTouchTol * a : 0
          return Math.abs(p.price - (intercept + mSlope * p.idx)) <= Math.max(tol, 1e-9)
        })
        if (respected.length >= swTouches) {
          const A = { idx: respected[0].idx, price: intercept + mSlope * respected[0].idx }
          const last = respected[respected.length - 1]
          const seg = buildLine(A, last, last, mSlope, false, tier)
          seg.main = true
          seg.touches = respected.length
          out.push(seg)
        }
      }
    }
    return out
  }
  // ALL trendlines across chart history via the JD consecutive-pair model. findTouchLines
  // connects every adjacent pivot pair per series; the slope gate keeps only trend-aligned
  // ones. Run on 3 TIERS at different swing scales → big (major key swings, thick) +
  // medium + small (minor swings, thin). Smaller scales = more pivots = more, shorter
  // trendlines; the big tier gives the long-term structural lines. All drawn together = a
  // hierarchy of trendlines following the trend at every scale.
  // 3 TIERS of trendlines at different swing scales → big (major key swings, thick) +
  // medium + small (minor swings, thin). More pivots at smaller scales means more, shorter
  // trendlines; the big tier gives the long-term structural lines. All drawn together =
  // a hierarchy of trendlines following the trend at every scale.
  const tiers = [
    { left: swLeft, right: swRight, tier: 1 },                                              // big
    { left: Math.max(2, Math.round(swLeft / 2)), right: Math.max(2, Math.round(swRight / 2)), tier: 2 },  // medium
    { left: Math.max(2, Math.round(swLeft / 4)), right: Math.max(2, Math.round(swRight / 4)), tier: 3 },  // small
  ]
  let segments: TrendSeg[] = []
  const allPivots: { idx: number; price: number }[] = []
  for (const t of tiers) {
    const { lows: l, highs: h } = detectPivots(t.left, t.right)
    segments = segments.concat(findTouchLines(l, 1, t.tier), findTouchLines(h, -1, t.tier))
    allPivots.push(...l, ...h)
  }

  // active = the most-recent UNBROKEN segment (largest to.idx) — the level in force now.
  let activeEnd = -1, activeIdx = -1
  for (let s = 0; s < segments.length; s++)
    if (segments[s].breakIdx < 0 && segments[s].to.idx > activeEnd) { activeEnd = segments[s].to.idx; activeIdx = s }
  if (activeIdx >= 0) segments[activeIdx].active = true

  return { segments, pivots: allPivots }
}

/** AnchoredSeg — a non-repainting trendline. */
type AnchoredSeg = {
  dir: 1 | -1                  // 1 = support (lows), -1 = resistance (highs)
  setBar: number               // bar where the line is "set" (last pivot idx + look-right)
  breakBar: number            // -1 if unbroken, else first close through the line
  main: boolean               // main line (bigger look-right, persistent)
  confirmed: number[]         // A.idx → setBar (solid, established history)
  proj: number[]              // setBar → endBar (dotted, the "set" forward projection)
}

/** computeAnchoredTrendline — NON-REPAINTING, POINT-IN-TIME-STABLE trendlines (separate
 *  from the JD swing tool). Pivots come from Look Left + Look Right; a trendline connects
 *  two consecutive SAME-TYPE confirmed pivots A→B. The line is "set" once its LAST pivot
 *  clears its look-right window (setBar = B.idx + lookRight) — the slope is FROZEN there
 *  and never recomputed, so it does not drift like a Theil-Sen average. The confirmed
 *  history (A→setBar) draws solid; the forward projection (setBar→break) draws dotted and
 *  is the level price must respect / eventually break. Break = first close through the
 *  line (support breaks DOWN, resistance breaks UP).
 *  MAIN lines use a BIGGER look-right (more significant pivots, slower to confirm). They
 *  PERSIST — every main pair stays on screen until a new one forms; multiple mains
 *  coexist (a tightening trend spawns a new main inside the old one). This is the
 *  backtest/scan-safe variant: nothing beyond the confirmation delay repaints. */
export function computeAnchoredTrendline(
  high: number[], low: number[], close: number[],
  tlOn: number, tlLeft: number, tlRight: number, tlPattern: number,
  tlMainLeft: number, tlMainRight: number, tlMainPattern: number,
  tlMinSize: number, tlBothSides: number, tlShowBreaks: number,
  tlCurlProj: number = 0, tlCurlN: number = 3,
): { segments: AnchoredSeg[] } {
  const empty: { segments: AnchoredSeg[] } = { segments: [] }
  if (!tlOn) return empty
  const n = close.length
  const pat = Math.max(1, Math.round(tlPattern))
  const mainPat = Math.max(1, Math.round(tlMainPattern))
  if (n < tlLeft + Math.max(tlRight, tlMainRight) + 5) return empty
  // ATR for min-size filtering (micro-lines < tlMinSize×ATR apart are dropped).
  const atrArr = tlMinSize > 0 ? atrDisp(high, low, close, 14) : []
  const build = (isHigh: boolean, left: number, right: number, pattern: number, main: boolean): AnchoredSeg[] => {
    const src = isHigh ? high : low
    const pv = confirmPivot(fractalPivots(src, pattern, pattern, isHigh), src, isHigh, left, right)
    const out: AnchoredSeg[] = []
    for (let i = 0; i < pv.length - 1; i++) {
      const A = pv[i], B = pv[i + 1]
      const slope = (B.price - A.price) / (B.idx - A.idx)
      // MIN SIZE: drop micro-lines between pivots closer than tlMinSize×ATR in price.
      if (tlMinSize > 0) {
        const a = atrArr[A.idx]
        if (!isNaN(a) && a > 0 && Math.abs(B.price - A.price) < tlMinSize * a) continue
      }
      // BOTH-SIDES gate (default off = winning side only, like JD's disp_select):
      // support (lows) keeps RISING lines; resistance (highs) keeps FALLING lines. With
      // both sides on, every consecutive pair draws regardless of slope direction.
      if (!tlBothSides) {
        const rising = slope > 0
        if (!isHigh && !rising) continue      // support = rising lows
        if (isHigh && rising) continue        // resistance = falling highs
      }
      const setBar = Math.min(n - 1, B.idx + right)          // line SET once last pivot clears look-right
      // INVALIDATION = first close THROUGH the line (ungated). This is where price actually
      // kills the line — the dashed projection STOPS here, regardless of whether the break
      // passes the confirm/cloud SIGNAL gates. A line that price closes through is dead.
      let rawBreak = -1
      for (let k = setBar; k < n; k++) {
        const lv = A.price + slope * (k - A.idx)
        const cl = close[k]
        if (isNaN(cl)) continue
        if (isHigh ? cl > lv : cl < lv) { rawBreak = k; break }
      }
      // SIGNAL gates apply ONLY to the wedge, NOT to line termination. signalBar starts at
      // the invalidation point and is reset to -1 if confirm/cloud reject it. The line still
      // ends at rawBreak; the wedge only draws when signalBar >= 0.
      let signalBar = rawBreak
      // LINE TERMINATION: the projection extends until price INVALIDATES it (rawBreak), or
      // to end of data if never invalidated. No distance/stale proxy — the line is "in play"
      // until price actually closes through it. This is what the user asked for: "go until
      // price invalidates it".
      const endBar = rawBreak >= 0 ? rawBreak : n - 1
      const confirmed = new Array(n).fill(NaN), proj = new Array(n).fill(NaN)
      for (let k = A.idx; k <= setBar && k <= endBar; k++) confirmed[k] = A.price + slope * (k - A.idx)
      // CURL PROJECTION (tlCurlProj): the FORWARD projection RE-FITS to the N most-recent
      // confirmed pivots (as-of bar k) instead of holding the frozen A→B slope. As newer swings
      // confirm, the line re-anchors and its slope steepens with the accelerating trend → it
      // FOLLOWS the uptrend as it forms instead of lagging behind (the ~70% lag). Confirmed
      // history (A→setBar) stays frozen = no repaint, scan-safe. Point-in-time: only pivots
      // with idx+right<=k are used. Falls back to frozen slope if <2 pivots or degenerate fit.
      if (tlCurlProj) {
        const N = Math.max(2, Math.round(tlCurlN))
        for (let k = setBar; k <= endBar; k++) {
          const win = pv.filter(p => p.idx + right <= k).slice(-N)
          if (win.length >= 2) {
            const x0 = win[0].idx
            let sx = 0, sy = 0, sxy = 0, sxx = 0
            for (const p of win) { const x = p.idx - x0; sx += x; sy += p.price; sxy += x * p.price; sxx += x * x }
            const den = win.length * sxx - sx * sx
            if (Math.abs(den) >= 1e-9) {
              const m = (win.length * sxy - sx * sy) / den
              const b = (sy - m * sx) / win.length
              proj[k] = b + m * (k - x0)
            } else { proj[k] = A.price + slope * (k - A.idx) }
          } else { proj[k] = A.price + slope * (k - A.idx) }
        }
      } else {
        for (let k = setBar; k <= endBar; k++) proj[k] = A.price + slope * (k - A.idx)
      }
      out.push({ dir: isHigh ? -1 : 1, setBar, breakBar: signalBar, main, confirmed, proj })
    }
    return out
  }

  const segments: AnchoredSeg[] = [
    ...build(false, tlLeft, tlRight, pat, false),           // support (lows)
    ...build(true, tlLeft, tlRight, pat, false),            // resistance (highs)
    ...build(false, tlMainLeft, tlMainRight, mainPat, true), // main support (own left + pattern)
    ...build(true, tlMainLeft, tlMainRight, mainPat, true),  // main resistance (own left + pattern)
  ]
  return { segments }
}

// ── main render (guarded) ──
export function renderLinguaCycle(rc: RenderContext) {
  try { _render(rc) }
  catch (e) { console.error('[lingua] render error:', e) }
}

/** renderAnchoredTrendline — standalone NON-REPAINTING trendline TOOL (separate catalog
 *  entry from Lingua). Each line connects two consecutive confirmed pivots; the slope is
 *  FROZEN once the last pivot clears its look-right (setBar). Solid = confirmed history
 *  (A→setBar); dotted = forward projection (setBar→break). MAIN lines (bigger look-right)
 *  draw bold with a gold glow and PERSIST — multiple coexist as the trend tightens. Break
 *  = first close through the line (dot on the line at the break bar). Point-in-time-stable
 *  → safe for scans/backtests. */
/** computeCurlTrend — ROLLING N-pivot regression trendline ("the curl").
 *  Re-fits each bar to the N most-recent CONFIRMED same-type pivots (N=ctPivots, default 3).
 *  As a new swing confirms the oldest drops out → the slope STEEPENS = the curl that tracks an
 *  accelerating trend and tightens until the break. Unlike the FROZEN anchored line, the forward
 *  slope is LIVE (recomputed per bar from the freshest structure), so a break fires when price
 *  closes through THIS bar's curled level — leading the laggy EMA flip. Point-in-time safe: at
 *  bar k only pivots confirmed as-of k (idx + lookRight <= k) are used. Supports (lows) draw when
 *  RISING, resistances (highs) draw when FALLING (JD disp_select). Based on the JD swing pivots
 *  (fractalPivots + confirmPivot), re-purposed into a rolling fit. */
function computeCurlTrend(
  high: number[], low: number[], close: number[],
  pattern: number, left: number, right: number, nPiv: number,
): { sup: number[]; res: number[]; supBreak: number; resBreak: number } {
  const n = close.length
  const N = Math.max(2, Math.round(nPiv))
  const patSide = Math.max(1, Math.floor((pattern - 1) / 2))
  // Forward-confirmed swings: pattern fractal (local turn) + `right` bars forward hold. NO
  // symmetric confirmPivot — it invalidates trend pullbacks (the left side is ALWAYS more
  // extreme inside a trend) and starved the fit to nothing (the "nothing plots" bug). `left`
  // is now a MIN-SPACING filter between kept pivots so only significant swings anchor the curl.
  const pick = (src: number[], findHigh: boolean) => {
    const raw = fractalPivots(src, patSide, right, findHigh)
    const out: { idx: number; price: number }[] = []
    for (const p of raw) if (!out.length || p.idx - out[out.length - 1].idx >= left) out.push(p)
    return out
  }
  const lo = pick(low, false), hi = pick(high, true)

  // Rolling least-squares fit through the N freshest confirmed-as-of-k pivots of one type.
  // disp_select: support draws only when rising (slope>0), resistance only when falling (<0).
  const fit = (pv: { idx: number; price: number }[], wantPos: boolean): number[] => {
    const out: number[] = new Array(n).fill(NaN)
    for (let k = 0; k < n; k++) {
      const win = pv.filter(p => p.idx + right <= k).slice(-N)   // pivots confirmed as-of bar k
      const M = win.length
      if (M < 2) continue            // need ≥2 for a line — curls as soon as 2 confirm; grows toward N as more arrive
      const x0 = win[0].idx
      let sx = 0, sy = 0, sxy = 0, sxx = 0
      for (const p of win) { const x = p.idx - x0; sx += x; sy += p.price; sxy += x * p.price; sxx += x * x }
      const denom = M * sxx - sx * sx
      if (Math.abs(denom) < 1e-9) continue
      const m = (M * sxy - sx * sy) / denom
      if (wantPos ? m <= 0 : m >= 0) continue                       // disp_select — trend-aligned only
      const b = (sy - m * sx) / M
      out[k] = b + m * (k - x0)
    }
    return out
  }

  const sup = fit(lo, true), res = fit(hi, false)
  let supBreak = -1, resBreak = -1
  for (let k = 0; k < n; k++) {                                     // break = first close through the live curl
    if (supBreak < 0 && !isNaN(sup[k]) && close[k] < sup[k]) supBreak = k
    if (resBreak < 0 && !isNaN(res[k]) && close[k] > res[k]) resBreak = k
  }
  // "tightens until it breaks" — stop the line at the break (no draw after the trend ends)
  if (supBreak >= 0) for (let k = supBreak + 1; k < n; k++) sup[k] = NaN
  if (resBreak >= 0) for (let k = resBreak + 1; k < n; k++) res[k] = NaN
  return { sup, res, supBreak, resBreak }
}

let _curlErrOnce = false
let _curlLogOnce = false
/** renderCurlTrend — the curl trendline (separate tool, drawn on the displayed chart). */
export function renderCurlTrend(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'curltrend')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'curltrend') as any
    const ctLeft = (p.ctLeft as number) ?? 15
    const ctRight = (p.ctRight as number) ?? 10
    const ctPattern = (p.ctPattern as number) ?? 5
    const ctPivots = (p.ctPivots as number) ?? 3
    const ctShowBreak = ((p.ctShowBreak as number) ?? 1) === 1
    const { ctx, data, vs, visible, xCtr, pToY, barW } = rc
    if (!data || data.length < ctLeft + ctRight + 10 || visible.length === 0) return
    const high = data.map((b: any) => b.high as number)
    const low = data.map((b: any) => b.low as number)
    const close = data.map((b: any) => b.close as number)
    const c = computeCurlTrend(high, low, close, ctPattern, ctLeft, ctRight, ctPivots)
    if (!_curlLogOnce) {
      _curlLogOnce = true
      const patSide = Math.max(1, Math.floor((ctPattern - 1) / 2))
      const loPv = (function(){ const raw=[]; const fp=fractalPivots(low,patSide,ctRight,false); for(const x of fp) raw.push(x); return raw.length })()
      const hiPv = (function(){ const raw=[]; const fp=fractalPivots(high,patSide,ctRight,true); for(const x of fp) raw.push(x); return raw.length })()
      console.log('[curltrend] data:'+data.length, 'params:', {ctLeft,ctRight,ctPattern,ctPivots}, 'raw lows:'+loPv, 'raw highs:'+hiPv, 'sup valid:'+c.sup.filter(v=>!isNaN(v)).length, 'res valid:'+c.res.filter(v=>!isNaN(v)).length)
    }
    const supCol = (p.ct_sup as string) || 'rgba(86,156,214,0.95)'
    const resCol = (p.ct_res as string) || 'rgba(230,150,40,0.95)'
    const brkCol = (p.ct_break as string) || 'rgba(250,204,21,0.95)'
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
  } catch (e) { if (!_curlErrOnce) { _curlErrOnce = true; console.error('[curltrend] threw (logged once):', e) } }
}

export function renderAnchoredTrendline(rc: RenderContext, indKey: string = 'trendline', force: boolean = false) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === indKey)
    if (!tool || (!tool.on && !force)) return
    const p = getMergedToolParams(panelIdx, indKey) as any
    const tlLeft = (p.tlLeft as number) ?? 50
    const tlRight = (p.tlRight as number) ?? 15
    const tlPattern = (p.tlPattern as number) ?? 2
    const tlMainLeft = (p.tlMainLeft as number) ?? 69
    const tlMainRight = (p.tlMainRight as number) ?? 15
    const tlMainPattern = (p.tlMainPattern as number) ?? 3
    const tlMinSize = (p.tlMinSize as number) ?? 0
    const tlBothSides = (p.tlBothSides as number) ?? 0
    const tlShowMain = (p.tlShowMain as number) ?? 1
    const tlShowBreaks = (p.tlShowBreaks as number) ?? 0
    const tlBreakSize = Number(p.tlBreakSize) || 7
    const tlCurlProj = ((p.tlCurlProj as number) ?? 0) === 1
    const tlCurlN = (p.tlCurlN as number) ?? 3
    const tlShowCloud = (p.tlShowCloud as number) ?? 0
    const tlCloudFast = (p.tlCloudFast as number) ?? 20
    const tlCloudSlow = (p.tlCloudSlow as number) ?? 39
    const tlShowSwings = ((p.tlShowSwings as number) ?? 0) === 1
    const { ctx, data, vs, visible, xCtr, pToY, barW } = rc
    if (!data || data.length < 10 || visible.length === 0) return
    // Draw on the DISPLAYED chart (whatever timeframe is shown). This is a standalone tool
    // with NO dependency on Lingua's MTF (1H) feed — so it works whether or not Lingua is on,
    // and it draws trendlines on the actual chart you're looking at.
    const high = data.map((b: any) => b.high as number)
    const low = data.map((b: any) => b.low as number)
    const close = data.map((b: any) => b.close as number)
    const tl = computeAnchoredTrendline(high, low, close, 1, tlLeft, tlRight, tlPattern, tlMainLeft, tlMainRight, tlMainPattern, tlMinSize, tlBothSides, tlShowBreaks, tlCurlProj ? 1 : 0, tlCurlN)
    // ── EMA CLOUD (optional, toggle: tlShowCloud) — a band between Cloud Fast/Slow EMAs
    // tinted teal (fast>slow, bullish) / orange-red (slow>fast, bearish). Drawn on the
    // displayed chart, independent of Lingua's MTF cloud. Gives trend-regime context for
    // how the anchored trendlines should read.
    // Hoist the cloud EMAs so BOTH the cloud band and the swing-respect markers reference
    // the SAME fast/slow EMAs (no drift between what's tinted and what's judged).
    const cf = ema(close, Math.max(2, tlCloudFast))
    const cs = ema(close, Math.max(3, tlCloudSlow))
    if (tlShowCloud) {
      const bullCol = '0,210,170', bearCol = '232,108,40'
      for (let i = 0; i < visible.length - 1; i++) {
        const ai = vs + i, aj = vs + i + 1
        if (isNaN(cf[ai]) || isNaN(cs[ai])) continue
        const x1 = xCtr(i), x2 = xCtr(i + 1)
        const yT = pToY(Math.max(cf[ai], cs[ai])), yB = pToY(Math.min(cf[ai], cs[ai]))
        const isBull = cf[ai] >= cs[ai]
        ctx.fillStyle = `rgba(${isBull ? bullCol : bearCol},0.12)`
        ctx.fillRect(x1 - barW / 2, yT, (x2 - x1) + barW, Math.abs(yB - yT))
      }
      drawLine(rc, cf, 'rgba(120,180,200,0.4)', 1)
      drawLine(rc, cs, 'rgba(120,180,200,0.4)', 1)
    }
    // ── SWING MARKERS (tlShowSwings): dot ALL main swing points (highs AND lows).
    // All swings are shown for visibility; the TREND REGIME decides which side becomes the band
    // (lows→support in uptrend, highs→resistance in downtrend) — that's the curl's job, not the
    // markers'. Color by EMA respect: a low ABOVE the 20EMA (or high BELOW it) = green (healthy,
    // respects structure); the violation side = red.
    if (tlShowSwings) {
      const mainPat = Math.max(1, Math.round(tlMainPattern))
      const markSwings = (isHigh: boolean) => {
        const src = isHigh ? high : low
        const pv = confirmPivot(fractalPivots(src, mainPat, mainPat, isHigh), src, isHigh, tlMainLeft, tlMainRight)
        for (const p of pv) {
          const vi = p.idx - vs
          if (vi < 0 || vi >= visible.length) continue
          if (isNaN(cf[p.idx])) continue
          const respects = isHigh ? p.price < cf[p.idx] : p.price > cf[p.idx]
          const x = xCtr(vi), y = pToY(p.price)
          ctx.beginPath(); ctx.arc(x, y, Math.max(3, barW * 0.5), 0, Math.PI * 2)
          ctx.fillStyle = respects ? 'rgba(0,200,120,0.95)' : 'rgba(232,80,80,0.95)'
          ctx.fill()
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke()
        }
      }
      markSwings(false); markSwings(true)
    }
    // PALETTE — "light" variant uses faded green/red + silver-blue glow so it stays
    // visually distinct from the bold main tool (gold glow, saturated colors) when both
    // run simultaneously. Same logic, different look, separate params.
    const isLight = indKey === 'trendline_light'
    const mainGlow = isLight ? '130,160,200' : '212,175,55'
    for (const seg of tl.segments) {
      // Light variant = MAIN LINES ONLY (tight, bold, clean). Skip the thin winning-side
      // scatter entirely — that's what made it look like the "fast trend" tool. The Light
      // tool should read as a single clean trendline at a tighter scale, not a scatter.
      if (isLight && !seg.main) continue
      if (seg.main && !tlShowMain) continue
      // Light variant: BLUE (support) / ORANGE (resistance) — fully distinct from the main
      // tool's green/red/gold. Wedges flip to the opposite light color.
      const base = seg.dir === 1 ? (isLight ? [86,156,214] : [0,230,118]) : (isLight ? [230,150,40] : [255,68,68])
      // confirmed/proj are data.length-sized ABSOLUTE-indexed arrays → drawLine reads
      // vals[vs + i] directly; no mapLine / time-mapping needed.
      if (seg.main) {
        drawLine(rc, seg.confirmed, `rgba(${mainGlow},0.28)`, 4.5)
        drawLine(rc, seg.proj, `rgba(${mainGlow},0.16)`, 4.5)
        drawLine(rc, seg.confirmed, `rgba(${base[0]},${base[1]},${base[2]},0.98)`, 2.8)
        drawLine(rc, seg.proj, `rgba(${base[0]},${base[1]},${base[2]},0.8)`, 2.4, true)
      } else {
        drawLine(rc, seg.confirmed, `rgba(${base[0]},${base[1]},${base[2]},0.55)`, 1.2)
        drawLine(rc, seg.proj, `rgba(${base[0]},${base[1]},${base[2]},0.4)`, 1, true)
      }
      // break marker — OPPOSITE-COLOR WEDGE at the bar the line was broken. A support break
      // (dir=1, green line) is BEARISH → red wedge pointing down; a resistance break
      // (dir=-1, red line) is BULLISH → green wedge pointing up. Color = the NEW direction.
      // Isolated try/catch: a wedge drawing failure must NEVER abort the line loop.
      if (seg.breakBar >= 0 && tlShowBreaks) {
        try {
          const di = seg.breakBar - vs               // absolute bar → visible index
          if (di >= 0 && di < visible.length) {
            const lv = seg.proj[seg.breakBar]
            if (!isNaN(lv) && isFinite(lv)) {
              const x = xCtr(di)
              const bearish = seg.dir === 1                         // support broke → down
              const col = bearish
                ? (isLight ? 'rgba(230,150,40,1)' : 'rgba(255,68,68,1)')
                : (isLight ? 'rgba(86,156,214,1)' : 'rgba(0,230,118,1)')
              const y = bearish ? pToY(lv) + (tlBreakSize + 4) : pToY(lv) - (tlBreakSize + 4)
              const s = tlBreakSize
              ctx.fillStyle = col
              ctx.strokeStyle = 'rgba(8,12,20,0.9)'; ctx.lineWidth = 1
              ctx.beginPath()
              if (bearish) { ctx.moveTo(x, y + s); ctx.lineTo(x - s, y); ctx.lineTo(x + s, y) }
              else        { ctx.moveTo(x, y - s); ctx.lineTo(x - s, y); ctx.lineTo(x + s, y) }
              ctx.closePath(); ctx.fill(); ctx.stroke()
            }
          }
        } catch (_) { /* wedge failure must not kill the lines */ }
      }
    }
  } catch (e) { console.error('[trendline] render error:', e) }
}

/** pitchToDeg — maps the ATR-normalized EMA slope into an intuitive 0-90° scale.
 *  The raw ratio (ATR/bar over blended 10/30/60) is small for even strong trends, so a
 *  plain atan() reads 2-15°. Multiplying by PITCH_K stretches it so a typical trend
 *  sits ~40-50°, violent ~70°+, flat ~0-5° — feels like a real angle while staying
 *  zoom-invariant (unlike a true screen-pixel angle). Tunable: lower K = flatter scale. */
const PITCH_K = 6
function pitchToDeg(ratio: number): number { return Math.atan(ratio * PITCH_K) * 180 / Math.PI }

function _render(rc: RenderContext) {
  const panelIdx = rc.panelIdx ?? 0
  const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'lingua')
  if (!tool || !tool.on) return
  // MERGED params: global tool params + this panel's overrides → lets 1H & 4H differ.
  const p = getMergedToolParams(panelIdx, 'lingua') as any
  const tc = (tool.colors as Record<string, string>) || {}

  const flat = (p.flat as number) ?? 0.05
  const flatH = (p.flatH as number) ?? 0.03   // 4H AoP flat threshold (consolidation noise gate)
  const xtreme = (p.xtreme as number) ?? 6.3  // partial dev band → EXTREME CONT trigger
  const euThr = (p.euThr as number) ?? 7.2    // full extreme dev band → EUPHORIC trigger
  const holdBars = (p.holdBars as number) ?? 3
  const tbOn = (p.tbOn as number) ?? 1
  const tbConfirm = (p.tbConfirm as number) ?? 1
  const tbMargin = (p.tbMargin as number) ?? 0
  const tbReclaim = (p.tbReclaim as number) ?? 1
  const cycleErOn = ((p.cycleErOn as number) ?? 1) === 1
  const cycleChop = (p.cycleChop as number) ?? 0.30
  const cyclePitchOn = ((p.cyclePitchOn as number) ?? 1) === 1   // Theil–Sen structural pitch blended into the cycle's angle signal
  const cyclePitchWin = (p.cyclePitchWin as number) ?? 20       // rolling window (bars) for the structural slope
  const cyclePitchBlend = (p.cyclePitchBlend as number) ?? 0.6  // 0 = pure EMA aop (old), 1 = pure structural
  const cycleStructOn = ((p.cycleStructOn as number) ?? 1) === 1   // structural trendline-break gate (consolidation → trend, HTF-modulated)
  const structHtfExt = (p.structHtfExt as number) ?? 0.7          // HTF "extended" threshold as a fraction of xtreme
  const structSuppress = ((p.structSuppress as number) ?? 1) === 1 // suppress counter-trend breaks into HTF extension (don't fade macro strength)
  const tbLtfOn = (p.tbLtfOn as number) ?? 1   // 15m fractal-child LEAD markers (extra fetch)
  const showClouds = (p.showClouds as number) !== 0
  const showBands = (p.showBands as number) !== 0
  const cycleCloudOn = ((p.cycleCloudOn as number) ?? 1) === 1   // 200/236 long-term cycle cloud (Lingua red/green)
  const swHideCons = (p.swHideCons as number) !== 0   // hide built-in CONSOLIDATION stage tint/label (clean chart)
  // dev band colors default to the db_72_89 tool's exact colors → identical appearance
  const bandUpFill = tc.up_fill || 'rgba(239,68,68,.15)'
  const bandUpLine = tc.up_line || 'rgba(239,68,68,.40)'
  const bandDnFill = tc.dn_fill || 'rgba(34,197,94,.15)'
  const bandDnLine = tc.dn_line || 'rgba(34,197,94,.40)'

  const { ctx, data, vs, visible, xCtr, priceH, pToY, W, PRICE_W, cx, cy, chartW, barW } = rc
  if (!data || data.length < 10 || visible.length === 0) return

  const slot = rc.barW && rc.barW > 0 ? rc.barW : 6   // used by the stage loop below
  const half = slot / 2

  // EMA clouds + dev band — drawn via the SAME primitives the existing indicators use
  // (drawEMABand / drawDevBand) so they are visually identical to 'band_9_20'/'band_72_89'
  // and the 'db_72_89' tracking tool. Drawn BEFORE the MTF gate so they appear instantly
  // even while 1H bars load. The dev band uses Lingua's OWN thresholds (xtreme/euThr) →
  // what you SEE is exactly what the classifier TRACKS.
  const dc = computeDisplayedTF(panelIdx, data)
  const NL = (a: number[]) => a.map(v => (isNaN(v) ? null : v))
  if (showClouds) {
    // 9/20 trail cloud — green/red crossover
    drawEMABand(rc, NL(dc.e9), NL(dc.e20),
      C.band_9_20_bull_fill, C.band_9_20_bear_fill, C.band_9_20_bull_line, C.band_9_20_bear_line)
    // mean cloud — green/red crossover (EMA periods tunable via params)
    drawEMABand(rc, NL(dc.eMid), NL(dc.eSlow),
      C.band_72_89_bull_fill, C.band_72_89_bear_fill, C.band_72_89_bull_line, C.band_72_89_bear_line)
    // 200/236 long-term cycle cloud — Lingua cycle red/green (green when fast>slow).
    // Distinct palette from the means cloud so the macro trend reads at a glance.
    if (cycleCloudOn) {
      drawEMABand(rc, NL(dc.eCloudF), NL(dc.eCloudS),
        tc.cc_up_fill || 'rgba(76,175,80,0.12)', tc.cc_dn_fill || 'rgba(239,83,80,0.12)',
        tc.cc_up_line || 'rgba(76,175,80,0.6)',  tc.cc_dn_line || 'rgba(239,83,80,0.6)')
    }
  }
  if (showBands) {
    // Dev band — SAME rendering as the 'db_72_89' tool (drawDevBand, ATR period = EMA
    // period), at Lingua's tracked thresholds (xtreme/euThr).
    drawDevBand(rc,
      NL(dc.eMid), NL(dc.atrMid),
      NL(dc.eSlow), NL(dc.atrSlow),
      [xtreme, euThr], [xtreme, euThr],
      bandUpFill, bandUpLine, bandDnFill, bandDnLine)
  }
  // Trend Pitch EMA line — the slower trend EMA (trendEma, default 39) whose blended
  // 10/30/60 slope the pitch metric measures. Drawn as a visible gold line so the trend
  // channel it follows is on-screen; hover any candle to read that candle's pitch below.
  if (dc.eTrend) drawLine(rc, NL(dc.eTrend), 'rgba(212,175,55,0.7)', 1.8)

  // ── MTF gate: the 3-TF stage classification needs 1H bars (loaded async) ──
  const mtf = tfSlot(MTF, panelIdx), htf = tfSlot(HTF, panelIdx)
  const mtfReady = mtf.times.length > 0
  if (!mtfReady) {
    ;(globalThis as any).__linguaState = { ran: false, clouds: showClouds, reason: 'MTF cache empty — clouds shown, stages pending 1H' }
    return
  }

  // 1+2) Classify + hysteresis on MTF-native timeline — CACHED, only
  // recomputes when bars/params change (NOT every animation frame).
  const { mtfHyst, rawTrans, hystTrans, n } = computeCachedClassification(panelIdx, flat, flatH, xtreme, euThr, holdBars, tbOn, tbConfirm, tbMargin, tbReclaim, cycleErOn, cycleChop, cyclePitchOn, cyclePitchWin, cyclePitchBlend, cycleStructOn, structHtfExt, structSuppress)

  // 3) Map each visible bar → its MTF stage via timestamp forward-fill.
  const stages: Stage[] = new Array(visible.length)
  const times = data.map((b: any) => b.time as number)
  let mCursor = 0
  for (let i = 0; i < visible.length; i++) {
    const t = times[vs + i]
    while (mCursor + 1 < n && mtf.times[mCursor + 1] <= t) mCursor++
    stages[i] = mtfHyst[mCursor] ?? 'CONSOLIDATION'
  }

  const COL: Record<Stage, { tint: string; line: string; text: string }> = {
    'CONSOLIDATION': { tint: tc.con_tint || 'rgba(120,140,170,0.05)', line: tc.con_line || 'rgba(150,160,180,0.5)', text: tc.con_text || 'rgba(180,190,210,0.85)' },
    'UPTREND':       { tint: tc.up_tint || 'rgba(76,175,80,0.06)',   line: tc.up_line || 'rgba(76,175,80,0.6)',    text: tc.up_text || 'rgba(129,199,132,0.95)' },
    'BACKSIDE':      { tint: tc.dn_tint || 'rgba(239,83,80,0.06)',   line: tc.dn_line || 'rgba(239,83,80,0.6)',    text: tc.dn_text || 'rgba(239,154,154,0.95)' },
    // Continuation Extreme: lighter amber — healthy thrust, trend continues
    'EXTREME CONT':  { tint: tc.cont_tint || 'rgba(255,193,7,0.08)', line: tc.cont_line || 'rgba(255,193,7,0.55)', text: tc.cont_text || 'rgba(255,213,79,0.9)' },
    // Euphoric: strong orange — terminal catalytic top/bottom, move is done
    'EUPHORIC':      { tint: tc.ex_tint || 'rgba(255,87,34,0.13)',   line: tc.ex_line || 'rgba(255,87,34,0.8)',   text: tc.ex_text || 'rgba(255,138,101,0.97)' },
    // Extreme Lower: deep red — downside stretch (backside mirror of EC). Fires when
    // price tags the lower xtreme band; cooldown holds until revert up to eSlow.
    'EXTREME LOWER': { tint: tc.el_tint || 'rgba(229,57,53,0.11)',   line: tc.el_line || 'rgba(255,82,82,0.8)',   text: tc.el_text || 'rgba(255,138,138,0.95)' },
    // Trendbreak: vivid orange alert — price lost the respected gold eTrend line during
    // an uptrend. Early structural break; resolves to BACKSIDE once the slope confirms.
    'TRENDBREAK':    { tint: tc.tb_tint || 'rgba(255,111,0,0.10)',   line: tc.tb_line || 'rgba(255,111,0,0.7)',    text: tc.tb_text || 'rgba(255,145,0,0.95)' },
    // Consolidation-flavored trends (choppy but directional — low Efficiency Ratio):
    // MUTED versions of the trend tints so clean UPTREND/BACKSIDE read as stronger than
    // the choppy variants at a glance. Faint tint, faded line + label.
    'UP CONS':       { tint: tc.uc_tint || 'rgba(76,175,80,0.035)',  line: tc.uc_line || 'rgba(129,199,132,0.35)', text: tc.uc_text || 'rgba(129,199,132,0.7)' },
    'DOWN CONS':     { tint: tc.dc_tint || 'rgba(239,83,80,0.035)',  line: tc.dc_line || 'rgba(239,154,154,0.35)', text: tc.dc_text || 'rgba(239,154,154,0.7)' },
  }

  // Short on-chart labels (2-letter) for readability. Internal stage values unchanged.
  const SHORT: Record<Stage, string> = {
    'CONSOLIDATION': 'CO', 'UP CONS': 'UC', 'DOWN CONS': 'DC', 'UPTREND': 'UP', 'TRENDBREAK': 'TB', 'BACKSIDE': 'BK',
    'EXTREME CONT': 'EC', 'EUPHORIC': 'EU', 'EXTREME LOWER': 'EL',
  }

  ctx.font = '600 9px ui-monospace, monospace'
  ctx.textBaseline = 'top'

  // Debug readout
  const stageCounts: Record<string, number> = {}
  const rawTransitions = rawTrans
  const hystTransitions = hystTrans

  let prevStage: Stage | null = null
  for (let i = 0; i < visible.length; i++) {
    const st = stages[i] in COL ? stages[i] : 'CONSOLIDATION'
    stageCounts[st] = (stageCounts[st] || 0) + 1
    // swHideCons: the CONSOLIDATION stage draws NOTHING (clean chart) but still advances
    // prevStage so the next real stage draws its transition divider correctly.
    const hidden = swHideCons && st === 'CONSOLIDATION'
    if (!hidden) {
      const c = COL[st]
      const x = xCtr(i)
      ctx.fillStyle = c.tint
      ctx.fillRect(x - half, 0, slot, priceH)
      if (st !== prevStage) {
        ctx.strokeStyle = c.line
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x - half, 0)
        ctx.lineTo(x - half, priceH)
        ctx.stroke()
        ctx.setLineDash([])
        const label = SHORT[st] ?? st
        const tw = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(8,12,20,0.72)'
        ctx.fillRect(x + 3, 3, tw + 6, 13)
        ctx.fillStyle = c.text
        ctx.fillText(label, x + 6, 4)
      }
    }
    prevStage = st
  }
  ctx.setLineDash([])

  // ── LTF (15m) trendbreak LEAD markers ──
  // Fractal child frame (MTF÷4). Its trendbreaks fire BEFORE the 1H TB band because the
  // finer structure cracks first. Small orange diamonds stamped above the candle high show
  // the lead time without cluttering the stage fill. Same triggers as the 1H trendbreak,
  // just run on the finer frame. Each LTF event maps to the 1H bar that CONTAINS it.
  const ltfEvents = tbLtfOn ? computeLtfTrendbreakEvents(panelIdx, flat, flatH, holdBars, tbOn, tbLtfOn, tbConfirm, tbMargin, tbReclaim) : []
  if (ltfEvents.length) {
    let ei = 0
    for (let i = 0; i < visible.length; i++) {
      const bt = times[vs + i]
      while (ei < ltfEvents.length && ltfEvents[ei] < bt) ei++
      if (ei >= ltfEvents.length) break
      const nextBt = (vs + i + 1 < data.length) ? times[vs + i + 1] : (bt + 9e11)
      if (ltfEvents[ei] >= bt && ltfEvents[ei] < nextBt) {
        const x = xCtr(i), bar = visible[i]
        const y = Math.max(6, pToY(bar.high) - 9)
        ctx.fillStyle = 'rgba(255,111,0,0.95)'
        ctx.strokeStyle = 'rgba(10,6,0,0.9)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 4); ctx.lineTo(x - 4, y); ctx.closePath()
        ctx.fill(); ctx.stroke()
        ei++
      }
    }
  }

  // ── SWING TRENDLINE (structural, JD-port) — drawn over the stage fills ──
  // Green support lines (rising lows) + red resistance lines (falling highs), one per
  // consecutive pivot pair (JD consecutive-pair model). EMA cloud band (20/39-style) tinted
  // teal/orange-red by the 9/20-style cross. Major tier-1 breaks = wedges; break+retest =
  // wedge + hollow diamond on the line. All params live in the 'swing' group.
  const swOn = (p.swOn as number) ?? 1
  if (swOn) {
    const swLeft = (p.swLeft as number) ?? 69
    const swRight = (p.swRight as number) ?? 21
    const swPattern = (p.swPattern as number) ?? 5
    const swMinSwing = (p.swMinSwing as number) ?? 1.2
    const swConfirm = (p.swConfirm as number) ?? 2
    const swTouches = (p.swTouches as number) ?? 3
    const swTouchTol = (p.swTouchTol as number) ?? 0.1
    const swSpineLen = (p.swSpineLen as number) ?? 50
    const swCloudFast = (p.swCloudFast as number) ?? 50
    const swCloudSlow = (p.swCloudSlow as number) ?? 69
    const swShowWindow = (p.swShowWindow as number) ?? 0
    const swShowPivots = (p.swShowPivots as number) ?? 0
    const swShowBreaks = (p.swShowBreaks as number) ?? 1
    const swBreakConfirm = (p.swBreakConfirm as number) ?? 0
    const swEmaFast = (p.swEmaFast as number) ?? 39
    const swEmaSlow = (p.swEmaSlow as number) ?? 50
    const swShowBothSides = (p.swShowBothSides as number) ?? 0
    const swLineCol = tc.sw_line || 'rgba(0,229,255,0.85)'
    const swTentCol = tc.sw_tent || 'rgba(0,229,255,0.35)'
    const swPivotCol = tc.sw_pivot || 'rgba(0,229,255,1)'
    const swBreakCol = tc.sw_break || 'rgba(255,0,110,0.95)'
    // EMA9/EMA20 reference removed — replaced by the MTF EMA trend spine inside the swing
    // block (the single EMA we follow for the trend channel).
    const swing = computeSwingTrendline(panelIdx, swOn, swPattern, swLeft, swRight, swMinSwing, swConfirm, swTouches, swTouchTol, swCloudFast, swCloudSlow, swBreakConfirm, swEmaFast, swEmaSlow, swShowBothSides)
    if (swing.segments.length) {
      // map an MTF timestamp → visible-bar index (largest displayed time ≤ t)
      const visIdxForTime = (t: number): number => {
        if (t < times[vs] || t > times[vs + visible.length - 1]) return -1
        let lo = 0, hi = visible.length - 1, ans = -1
        while (lo <= hi) { const m = (lo + hi) >> 1; if (times[vs + m] <= t) { ans = m; lo = m + 1 } else hi = m - 1 }
        return ans
      }
      // map an MTF line → ABSOLUTE-indexed array. drawLine reads vals[vs + i], so the array
      // must span the FULL data range (see lesson: visible-length array ⇒ draws nothing).
      const mapLine = (mtfLine: number[]): (number | null)[] => {
        const full: (number | null)[] = new Array(data.length).fill(null)
        let sc = 0
        for (let i = 0; i < visible.length; i++) {
          const t = times[vs + i]
          while (sc + 1 < n && mtf.times[sc + 1] <= t) sc++
          const v = mtfLine[sc]
          if (!isNaN(v)) full[vs + i] = v
        }
        return full
      }
      // EMA TREND SPINE — the smoothed trend the swing lines follow.
      drawLine(rc, mapLine(ema(mtf.close, swSpineLen)), 'rgba(212,175,55,0.55)', 1.6)
      // EMA CLOUD (39-60 band shape). COLOR driven per-bar by the 9/20 momentum cross:
      // GREEN/TEAL when EMA9 is above EMA20 (bullish), ORANGE/RED when EMA20 is above
      // EMA9 (bearish). The band flips color exactly where 9/20 crosses — the same pair
      // that gates major breaks — so the cloud reads as the momentum regime map.
      {
        const cf = mapLine(ema(mtf.close, Math.max(2, swCloudFast)))
        const cs = mapLine(ema(mtf.close, Math.max(3, swCloudSlow)))
        const mEmaF = mapLine(ema(mtf.close, Math.max(2, swEmaFast)))
        const mEmaS = mapLine(ema(mtf.close, Math.max(3, swEmaSlow)))
        const bullCol = '0,210,170'   // green-teal (9 above 20)
        const bearCol = '232,108,40'  // orange-red (20 above 9)
        for (let i = 0; i < visible.length - 1; i++) {
          const ai = vs + i, aj = vs + i + 1
          if (cf[ai] == null || cs[ai] == null || cf[aj] == null || cs[aj] == null) continue
          const x1 = xCtr(i), x2 = xCtr(i + 1)
          const yT = pToY(Math.max(cf[ai]!, cs[ai]!)), yB = pToY(Math.min(cf[ai]!, cs[ai]!))
          const isBull = mEmaF[ai] != null && mEmaS[ai] != null && (mEmaF[ai] as number) >= (mEmaS[ai] as number)
          ctx.fillStyle = `rgba(${isBull ? bullCol : bearCol},0.15)`
          ctx.fillRect(x1 - barW / 2, yT, (x2 - x1) + barW, Math.abs(yB - yT))
        }
        // boundary lines colored by the CURRENT (last visible bar) 9/20 regime
        const li = vs + visible.length - 1
        const curBull = mEmaF[li] != null && mEmaS[li] != null && (mEmaF[li] as number) >= (mEmaS[li] as number)
        const lineCol = curBull ? bullCol : bearCol
        drawLine(rc, cf, `rgba(${lineCol},0.55)`, 1.2)
        drawLine(rc, cs, `rgba(${lineCol},0.55)`, 1.2)
      }
      // draw EVERY trendline, colored by role to match the hand-drawn channel legend:
      // SUPPORT (dir=1, swing lows) = GREEN (bottom of channel); RESISTANCE (dir=-1, swing
      // highs) = RED (top of channel). active (in force) = bright; broken = dim; tentative
      // (young move) = dashed/dim. Both colors drawn together = the trend channel.
      for (const seg of swing.segments) {
        const segVis = mapLine(seg.line)
        const base = seg.dir === 1 ? [0,230,118] : [255,68,68]
        if (seg.main) {
          // MAIN trend line (Theil-Sen consensus) — bold, the KEY break target. A subtle
          // gold glow under the colored line marks it as the one to watch.
          const a = seg.breakIdx >= 0 ? 0.5 : seg.active ? 1 : 0.92
          drawLine(rc, segVis, 'rgba(212,175,55,0.30)', 4)
          drawLine(rc, segVis, `rgba(${base[0]},${base[1]},${base[2]},${a})`, 2.8)
          continue
        }
        // tier scales opacity + weight: big (tier 1) = bold/opaque, small (tier 3) = faint/thin
        const tierScale = seg.tier === 1 ? 1 : seg.tier === 2 ? 0.65 : 0.45
        const a = (seg.tentative ? 0.32 : seg.active ? 0.95 : seg.breakIdx >= 0 ? 0.38 : 0.72) * tierScale
        const lw = seg.active ? 2.3 : seg.tier === 1 ? 2 : seg.tier === 2 ? 1.5 : 1.1
        drawLine(rc, segVis, `rgba(${base[0]},${base[1]},${base[2]},${a})`, lw, !!seg.tentative)
      }
      // PIVOT CONFIRMATION WINDOW (diagnostic) — toggle on to audit which bars make each
      // pivot significant. For every significant pivot, shade the bars that CONFIRM it
      // (swLeft to the left → swRight to the right) and draw the pivot's price across that
      // window. A valid swing high sits above every candle in its band; a swing low below.
      // Eyeball this to judge if swLeft/swRight are tight enough to catch real swings.
      if (swShowWindow) {
        for (const pv of swing.pivots) {
          const li = Math.max(0, pv.idx - swLeft), ri = Math.min(n - 1, pv.idx + swRight)
          const dL = visIdxForTime(mtf.times[li]), dR = visIdxForTime(mtf.times[ri])
          if (dL < 0 || dR < 0) continue
          const xL = xCtr(dL), xR = xCtr(dR), yP = pToY(pv.price)
          // faint band over the confirmation bars
          ctx.fillStyle = 'rgba(0,229,255,0.07)'
          ctx.fillRect(xL - barW / 2, 0, (xR - xL) + barW, priceH)
          // price line across the window — pivot must be the extreme of all shaded bars
          ctx.strokeStyle = 'rgba(0,229,255,0.45)'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 3])
          ctx.beginPath(); ctx.moveTo(xL - barW / 2, yP); ctx.lineTo(xR + barW / 2, yP); ctx.stroke()
          ctx.setLineDash([])
          // small ticks at the window edges (the look-left / look-right boundaries)
          ctx.strokeStyle = 'rgba(0,229,255,0.6)'
          for (const ex of [xL - barW / 2, xR + barW / 2]) {
            ctx.beginPath(); ctx.moveTo(ex, yP - 4); ctx.lineTo(ex, yP + 4); ctx.stroke()
          }
        }
      }
      // pivot dots (toggle: swShowPivots) — all significant swings the lines connect
      if (swShowPivots) {
        for (const pv of swing.pivots) {
          const di = visIdxForTime(mtf.times[pv.idx])
          if (di < 0) continue
          const x = xCtr(di), y = pToY(pv.price)
          ctx.fillStyle = swPivotCol
          ctx.strokeStyle = 'rgba(8,12,20,0.9)'
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        }
      }
      // BREAK WEDGES (toggle: swShowBreaks). MAJOR breaks only — tier 1 (big swings).
      // A break = close through the trendline (JD's triangleup/triangledown). Green wedge
      // below = support broke (dir=1); red wedge above = resistance broke (dir=-1). When
      // EMA-cross confirm is on, only momentum-confirmed breaks render. Two VISUALLY
      // DISTINCT flavors: a plain TRENDBREAK = solid wedge; a BREAK & RETEST = the SAME
      // solid wedge PLUS a large hollow DIAMOND on the trendline at the retest bar, joined
      // by a dotted connector so the pair reads as one event.
      if (swShowBreaks) {
        for (const seg of swing.segments) {
          if (seg.breakIdx < 0) continue
          // Breaks focus on the lines that matter: MAIN trend lines (the consensus break
          // target) and tier-1 big swings. Minor-tier breaks are suppressed.
          if (!seg.main && seg.tier !== 1) continue
          // When EMA-cross confirmation is on, only MAJOR breaks (confirmed by a 9/20 cross
          // in the break's direction) render a wedge. This drops the noise from minor
          // pivot breaks and keeps only momentum-confirmed structural breaks.
          if (swBreakConfirm && !seg.majorBreak) continue
          const di = visIdxForTime(mtf.times[seg.breakIdx])
          if (di < 0) continue
          const diDot = di + 1
          if (diDot >= visible.length) continue
          const x = xCtr(diDot)
          const candle = data[vs + diDot]
          if (!candle) continue
          const isUp = seg.dir === 1
          const col = isUp ? 'rgba(0,230,118,1)' : 'rgba(255,68,68,1)'
          const y = isUp ? pToY(candle.low) + 10 : pToY(candle.high) - 10
          const s = 5
          ctx.fillStyle = col
          ctx.strokeStyle = 'rgba(8,12,20,0.9)'
          ctx.lineWidth = 1
          ctx.beginPath()
          if (isUp) { ctx.moveTo(x, y - s); ctx.lineTo(x - s, y); ctx.lineTo(x + s, y) }
          else      { ctx.moveTo(x, y + s); ctx.lineTo(x - s, y); ctx.lineTo(x + s, y) }
          ctx.closePath(); ctx.fill(); ctx.stroke()
          // RETEST marker — large hollow DIAMOND on the extended line at the bar price
          // tapped it, joined to the break wedge by a dotted connector. Only real retests
          // (price moved away then returned) reach here, so this is unambiguous.
          if (seg.retestIdx >= 0) {
            const dr = visIdxForTime(mtf.times[seg.retestIdx])
            if (dr >= 0 && dr < visible.length) {
              const sl = (seg.to.price - seg.from.price) / (seg.to.idx - seg.from.idx)
              const v = seg.from.price + sl * (seg.retestIdx - seg.from.idx)
              const rx = xCtr(dr), ry = pToY(v)
              // dotted connector from break wedge to retest diamond
              ctx.strokeStyle = col
              ctx.lineWidth = 1
              ctx.setLineDash([2, 3])
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(rx, ry); ctx.stroke()
              ctx.setLineDash([])
              // hollow diamond
              const ds = 6
              ctx.fillStyle = 'rgba(8,12,20,0.95)'
              ctx.strokeStyle = col
              ctx.lineWidth = 2
              ctx.beginPath()
              ctx.moveTo(rx, ry - ds); ctx.lineTo(rx + ds, ry); ctx.lineTo(rx, ry + ds); ctx.lineTo(rx - ds, ry)
              ctx.closePath(); ctx.fill(); ctx.stroke()
            }
          }
        }
      }
    }
  }

  // Stash displayed-TF pitch for the overlay (drawn AFTER the crosshair in
  // ReactChartPanel so crosshair lines don't overwrite the readout).
  _panelPitch[panelIdx] = { pitch: dc.pitch, vs }
  // lastDeg feeds __linguaState (debug) — latest visible bar's pitch in degrees.
  const _lp = dc.pitch[vs + visible.length - 1]
  const lastDeg = !isNaN(_lp) ? pitchToDeg(_lp) : NaN

  ;(globalThis as any).__linguaState = {
    ran: true, mode: 'hierarchical-3TF+hysteresis', mtfReady, holdBars,
    mtfBars: mtf.times.length, htfBars: htf.times.length, ltfBars: tfSlot(LTF, panelIdx).times.length, ltfEvents: ltfEvents.length,
    visibleBars: visible.length, flat, xtreme, euThr,
    stageCounts,
    rawTransitions, hystTransitions,
    lastStage: stages[stages.length - 1],
    pitchDeg: isNaN(lastDeg) ? null : +lastDeg.toFixed(1),
  }

  // ── LINGUA SUB-COMPONENTS — render Key Levels + both trendlines as part of the unified
  // cycle view. Each is gated by its own Lingua toggle (lg* params) and reads ITS tool's
  // dialed-in params (no duplication — the trendline/pzones tools hold the tuning). force
  // bypasses the standalone tool's on/off so Lingua owns the draw here regardless. Drawn
  // LAST in _render so the structure sits on top of the cycle tint, under candles.
  const lgKeyLevels = ((p.lgKeyLevels as number) ?? 1) === 1
  const lgTrendMain = ((p.lgTrendMain as number) ?? 1) === 1
  const lgTrendLight = ((p.lgTrendLight as number) ?? 1) === 1
  if (lgKeyLevels) renderPivotZones(rc)
  if (lgTrendMain) renderAnchoredTrendline(rc, 'trendline', true)
  if (lgTrendLight) renderAnchoredTrendline(rc, 'trendline_light', true)
}

// ── CONSOLIDATION ZONES (standalone tool) — BIG-PICTURE swing-cluster model ──
// A consolidation is a SUSTAINED, BOUNDED range — NOT the tiny bar-by-bar chop a fixed
// rolling window catches. We detect it from STRUCTURE: significant swing pivots. A genuine
// big consolidation shows up as a CLUSTER of major swings that stay within a bounded
// envelope (floor + ceiling) over a long span. Small chop doesn't produce enough
// SIGNIFICANT pivots to cluster, so it's filtered out automatically — no micro-boxes.
//
// Algorithm (greedy range-bounded grouping):
//   1. Find major swing highs + lows (confirmPivot, coPivLeft/coPivRight) — only big moves
//      survive the lookback, matching "bigger picture".
//   2. Merge into one chronological pivot stream.
//   3. Walk it: greedily extend a group while its high-low RANGE stays within coBand×ATR.
//      The range only grows as pivots are added, so a TREND (new highs/lows keep extending
//      it) breaks the cap immediately → no box. A CONSOLIDATION oscillates, so the range
//      grows slowly and stays bounded → box forms.
//   4. A group is a BOX only if it spans ≥ coMinBars AND has ≥ coMinSwings (the big-picture
//      duration + significance gates).
//   5. Box resolves green/red on the first close outside its envelope → cycle handoff.
type ConsBox = { start: number; end: number; hi: number; lo: number; resolveDir: number; resolveBar: number; ceil?: number; floor?: number; touches?: { idx: number; price: number; bull: boolean }[]; driftH?: number; driftL?: number; channelDrift?: number; type?: number; highs?: { idx: number; price: number }[]; lows?: { idx: number; price: number }[] }

function computeConsolidation(
  high: number[], low: number[], close: number[],
  pivLeft: number, pivRight: number, bandATR: number, minBars: number, minSwings: number,
): ConsBox[] {
  const n = close.length
  const boxes: ConsBox[] = []
  if (n < 30) return boxes
  const atr = wilderAtr(high, low, close, 14)
  const avgAtr = (a: number, b: number) => {
    let s = 0, c = 0
    for (let k = a; k <= b && k < n; k++) { const v = atr[k]; if (!isNaN(v)) { s += v; c++ } }
    return c > 0 ? s / c : NaN
  }
  // significant pivots only (big lookback → major swings, the "bigger picture" filter)
  const highs = confirmPivot(fractalPivots(high, pivLeft, pivRight, true), high, true, pivLeft, pivRight)
  const lows = confirmPivot(fractalPivots(low, pivLeft, pivRight, false), low, false, pivLeft, pivRight)
  const pivs = [
    ...highs.map((p: any) => ({ idx: p.idx, price: p.price, isHigh: true })),
    ...lows.map((p: any) => ({ idx: p.idx, price: p.price, isHigh: false })),
  ].sort((a, b) => a.idx - b.idx)
  if (pivs.length < minSwings) return boxes

  // greedy range-bounded grouping
  let i = 0
  while (i < pivs.length) {
    let j = i, ceil = -Infinity, floor = Infinity
    while (j < pivs.length) {
      const p = pivs[j]
      const nC = p.isHigh ? Math.max(ceil, p.price) : ceil
      const nF = !p.isHigh ? Math.min(floor, p.price) : floor
      // can't measure a range until we've seen BOTH a high and a low — accumulate then
      if (!isFinite(ceil) || !isFinite(floor)) { ceil = nC; floor = nF; j++; continue }
      const range = nC - nF
      const a = avgAtr(pivs[i].idx, p.idx)
      if (isFinite(a) && a > 0 && range > bandATR * a) break   // range broke out → trend resumed
      ceil = nC; floor = nF; j++
    }
    const group = pivs.slice(i, j)
    const span = group.length ? group[group.length - 1].idx - group[0].idx : 0
    if (group.length >= minSwings && span >= minBars && isFinite(ceil) && isFinite(floor) && ceil > floor) {
      const start = group[0].idx, end = group[group.length - 1].idx
      // true envelope = max high / min low across the full span (incl. non-pivot bars)
      let bhi = -Infinity, blo = Infinity
      for (let k = start; k <= end; k++) { if (high[k] > bhi) bhi = high[k]; if (low[k] < blo) blo = low[k] }
      let resolveDir = 0, resolveBar = -1
      for (let k = end + 1; k < n; k++) {
        if (close[k] > bhi) { resolveDir = 1; resolveBar = k; break }
        if (close[k] < blo) { resolveDir = -1; resolveBar = k; break }
      }
      boxes.push({ start, end, hi: bhi, lo: blo, resolveDir, resolveBar })
      i = j   // skip past this consolidation (avoid overlapping sub-boxes)
    } else {
      i++     // too short → advance one pivot
    }
  }
  return boxes
}

/** aggregate — fold every `group` chart bars into one coarser HTF bar (high=max, low=min,
 *  close=last). aStart[j] = first chart index belonging to HTF bar j, so HTF box boundaries
 *  map back to the displayed chart precisely. Self-contained (no Lingua MTF dependency):
 *  the consolidation tool builds its own bigger picture from displayed data. */
function aggregateBars(
  high: number[], low: number[], close: number[], group: number,
): { ah: number[]; al: number[]; ac: number[]; aStart: number[] } {
  const n = close.length
  const ah: number[] = [], al: number[] = [], ac: number[] = [], aStart: number[] = []
  for (let i = 0; i < n; i += group) {
    let h = -Infinity, l = Infinity
    const s = i
    for (let k = i; k < Math.min(i + group, n); k++) {
      if (!isNaN(high[k]) && high[k] > h) h = high[k]
      if (!isNaN(low[k]) && low[k] < l) l = low[k]
    }
    ah.push(h); al.push(l); ac.push(close[Math.min(i + group - 1, n - 1)]); aStart.push(s)
  }
  return { ah, al, ac, aStart }
}

// ── REGIME CLASSIFIER ──────────────────────────────────────────────────────────
// Per-bar ternary regime (UP / DOWN / RANGE) via Efficiency Ratio + EMA cloud.
// Point-in-time: each bar's regime uses only data up to that bar (no look-forward) →
// scan/backtest safe. ER = |net progress| ÷ Σ|step| over rgLen bars; low ER = churning =
// RANGE ("not an uptrend"), high ER + bullish cloud = UP, high ER + bearish = DOWN.
// This is the REAL-TIME regime signal — compare against Consolidation Zones (historical):
// zones show WHERE ranges existed; regime shows "am I trending RIGHT NOW?".
export function renderRegime(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'regime')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'regime') as any
    const rgLen = Math.max(5, Math.round((p.rgLen as number) ?? 20))
    const rgSmooth = Math.max(1, Math.round((p.rgSmooth as number) ?? 10))
    const rgChop = (p.rgChop as number) ?? 0.30
    const rgCloudF = Math.max(2, Math.round((p.rgCloudF as number) ?? 16))
    const rgCloudS = Math.max(3, Math.round((p.rgCloudS as number) ?? 33))
    const rgRangeOnly = (p.rgRangeOnly as number) ?? 1
    const rgShowLabel = (p.rgShowLabel as number) ?? 1
    const rgShowDiv = (p.rgShowDiv as number) ?? 1
    const tc = (tool.colors as Record<string, string>) || {}
    const { ctx, data, visible, xCtr, priceH, barW, W, PRICE_W } = rc
    if (!data || data.length < 20 || visible.length === 0) return
    const close = data.map((b: any) => b.close as number)
    const n = close.length

    // Efficiency Ratio (Kaufman): |net| / Σ|step| over rgLen bars. Self-normalizing (0..1):
    // 1 = pure trend, 0 = pure chop. Point-in-time — only past data, never the future.
    const erRaw: number[] = new Array(n).fill(NaN)
    for (let i = rgLen; i < n; i++) {
      const net = Math.abs(close[i] - close[i - rgLen])
      let path = 0
      for (let k = i - rgLen + 1; k <= i; k++) path += Math.abs(close[k] - close[k - 1])
      erRaw[i] = path > 0 ? net / path : 0
    }
    // Smooth ER with an EMA to kill single-bar whipsaw at regime edges.
    const erS: number[] = new Array(n).fill(NaN)
    {
      let se = NaN
      const a = 2 / (rgSmooth + 1)
      for (let i = 0; i < n; i++) {
        if (isNaN(erRaw[i])) continue
        se = isNaN(se) ? erRaw[i] : se + (erRaw[i] - se) * a
        erS[i] = se
      }
    }
    // EMA cloud for direction (defaults match the consolidation Leg EMA so the two tools
    // agree on what a "leg" is — the regime is the real-time version of the leg model).
    const cf = ema(close, rgCloudF), cs = ema(close, rgCloudS)

    // Regime per bar: 1=UP, -1=DOWN, 0=RANGE. RANGE wins when ER is below the chop floor.
    const regime: number[] = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      if (isNaN(erS[i]) || isNaN(cf[i]) || isNaN(cs[i])) { regime[i] = 0; continue }
      regime[i] = erS[i] < rgChop ? 0 : (cf[i] >= cs[i] ? 1 : -1)
    }

    // ── Tint per visible bar. ──
    const slot = barW && barW > 0 ? barW : 6
    const half = slot / 2
    const upT = tc.rg_up || 'rgba(34,197,94,0.09)'
    const dnT = tc.rg_dn || 'rgba(239,68,68,0.09)'
    const rngT = tc.rg_range || 'rgba(160,165,180,0.18)'
    // TINT PASS — gray zones on range bars; trends stay clean (rangeOnly) or get faint
    // green/red (ternary mode).
    let prev: number | null = null
    for (let vi = 0; vi < visible.length; vi++) {
      const ai = visible[vi]
      if (ai < 0 || ai >= n) { prev = null; continue }
      const r = regime[ai]
      const x = xCtr(vi)
      let fill = ''
      if (r === 0) fill = rngT
      else if (!rgRangeOnly) fill = r > 0 ? upT : dnT
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(x - half, 0, slot, priceH) }
      prev = r
    }
    // BRACKET PASS — solid gray lines at the START and END of each range zone, drawn on
    // top of the tint so each gray block is clearly fenced in. (No lines on trend bars.)
    if (rgShowDiv) {
      ctx.strokeStyle = 'rgba(160,165,180,0.75)'
      ctx.lineWidth = 1.5; ctx.setLineDash([])
      let pv: number | null = null, pvX = 0
      for (let vi = 0; vi < visible.length; vi++) {
        const ai = visible[vi]
        if (ai < 0 || ai >= n) { pv = null; continue }
        const r = regime[ai]
        const x = xCtr(vi)
        if (r === 0 && pv !== 0) {  // range zone START (left edge)
          ctx.beginPath(); ctx.moveTo(x - half, 0); ctx.lineTo(x - half, priceH); ctx.stroke()
        }
        if (pv === 0 && r !== 0 && vi > 0) {  // range zone END (right edge of last range bar)
          ctx.beginPath(); ctx.moveTo(pvX + half, 0); ctx.lineTo(pvX + half, priceH); ctx.stroke()
        }
        pv = r; pvX = x
      }
    }

    // ── Current-regime label (top-left of price panel). ──
    if (rgShowLabel) {
      const lastAi = visible[visible.length - 1]
      const r = lastAi >= 0 && lastAi < n ? regime[lastAi] : 0
      const ev = lastAi >= 0 && lastAi < n ? erS[lastAi] : NaN
      const name = r > 0 ? 'UP' : r < 0 ? 'DOWN' : 'RANGE'
      const col = r > 0 ? 'rgba(129,199,132,0.95)' : r < 0 ? 'rgba(248,113,113,0.95)' : 'rgba(180,185,200,0.95)'
      const txt = `REGIME ${name}${isFinite(ev) ? ` · ER ${ev.toFixed(2)}` : ''}`
      ctx.font = '11px ui-monospace, monospace'
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      const tw = ctx.measureText(txt).width
      const lx = (PRICE_W ?? 0) + 8, ly = 6
      ctx.fillStyle = 'rgba(8,12,20,0.72)'
      ctx.fillRect(lx, ly, tw + 8, 16)
      ctx.fillStyle = col
      ctx.fillText(txt, lx + 4, ly + 2)
      // textAlign restored to default (other render code leaks non-left).
      ctx.textAlign = 'left'
    }
  } catch (e) { /* render must not crash the chart */ }
}

export function renderConsolidation(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'consolidation')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'consolidation') as any
    const coPivLeft = (p.coPivLeft as number) ?? 8
    const coPivRight = (p.coPivRight as number) ?? 8
    const coBand = (p.coBand as number) ?? 8
    const coMinBars = (p.coMinBars as number) ?? 30
    const coMinSwings = (p.coMinSwings as number) ?? 4
    const coUseHtf = (p.coUseHtf as number) ?? 1
    const coHtfGroup = (p.coHtfGroup as number) ?? 5
    const coShowBreak = (p.coShowBreak as number) ?? 1
    const coMaxHeight = (p.coMaxHeight as number) ?? 0
    const coMaxHeightPct = (p.coMaxHeightPct as number) ?? 0
    const coAtrLen = (p.coAtrLen as number) ?? 14
    const coTouches = (p.coTouches as number) ?? 2
    const coTouchBand = (p.coTouchBand as number) ?? 12
    const coLegFast = (p.coLegFast as number) ?? 7
    const coLegSlow = (p.coLegSlow as number) ?? 14
    const coMaxDrift = (p.coMaxDrift as number) ?? 75
    const coDirDrift = (p.coDirDrift as number) ?? 40
    const coColorType = (p.coColorType as number) ?? 1
    const coShowChannel = (p.coShowChannel as number) ?? 0
    const coShowVals = (p.coShowVals as number) ?? 1
    const coShowTouches = (p.coShowTouches as number) ?? 1
    const tc = (tool.colors as Record<string, string>) || {}
    const { ctx, data, vs, visible, xCtr, pToY, barW } = rc
    if (!data || data.length < 20 || visible.length === 0) return
    const high = data.map((b: any) => b.high as number)
    const low = data.map((b: any) => b.low as number)
    const close = data.map((b: any) => b.close as number)
    // BIG-PICTURE: run the swing-cluster on AGGREGATED HTF data (default ON). Grouping every
    // `coHtfGroup` chart bars into one coarser bar means only multi-week ranges produce
    // enough significant pivots to cluster — the daily chop that made 17 boxes collapses to
    // the one big multi-week consolidation. HTF box boundaries map back to chart bars via
    // aStart; the price envelope is recomputed from the real chart high/low for precision.
    // Toggle off (coUseHtf=0) to detect on the raw chart TF instead.
    let boxes: ConsBox[]
    if (coUseHtf) {
      const group = Math.max(2, Math.round(coHtfGroup))
      const { ah, al, ac, aStart } = aggregateBars(high, low, close, group)
      const htfBoxes = computeConsolidation(ah, al, ac, Math.round(coPivLeft), Math.round(coPivRight), coBand, Math.round(coMinBars), Math.round(coMinSwings))
      // map HTF indices back to chart indices; recompute envelope from real chart bars
      boxes = htfBoxes.map(bx => {
        const start = aStart[bx.start] ?? 0
        const endIdx = Math.min(high.length - 1, (aStart[bx.end] ?? 0) + group - 1)
        let bhi = -Infinity, blo = Infinity
        for (let k = start; k <= endIdx; k++) { if (high[k] > bhi) bhi = high[k]; if (low[k] < blo) blo = low[k] }
        const resolveBar = bx.resolveBar >= 0 ? (aStart[bx.resolveBar] ?? high.length - 1) : -1
        return { start, end: endIdx, hi: bhi, lo: blo, resolveDir: bx.resolveDir, resolveBar }
      })
    } else {
      boxes = computeConsolidation(high, low, close, Math.round(coPivLeft), Math.round(coPivRight), coBand, Math.round(coMinBars), Math.round(coMinSwings))
    }
    // MAX HEIGHT post-filters: reject boxes that are too tall. Two independent caps, each
    // default 0 = off. A box survives only if it passes BOTH active caps.
    //   coMaxHeight   — range ÷ ATR(coAtrLen). Tunable ratio (multi-week daily ≈ 6–10× daily ATR).
    //   coMaxHeightPct — range ÷ mid-price × 100. Volatility-independent sanity cap.
    // Unlike coBand (a grouping rule measured on the inflated HTF ATR, effectively never
    // binding), these are HARD size caps on the displayed-timeframe ATR/price.
    const chartAtrLen = Math.max(2, Math.round(coAtrLen))
    if (boxes.length && (coMaxHeight > 0 || coMaxHeightPct > 0)) {
      const chartAtr = atrDisp(high, low, close, chartAtrLen)
      boxes = boxes.filter(bx => {
        const mid = Math.floor((bx.start + bx.end) / 2)
        const a = chartAtr[mid]
        const rng = bx.hi - bx.lo
        const midP = (bx.hi + bx.lo) / 2
        if (coMaxHeight > 0 && isFinite(a) && a > 0 && rng / a > coMaxHeight) return false
        if (coMaxHeightPct > 0 && midP > 0 && rng / midP * 100 > coMaxHeightPct) return false
        return true
      })
    }
    const chartAtrAll = (coShowVals || coMaxHeight > 0 || coMaxHeightPct > 0) ? atrDisp(high, low, close, chartAtrLen) : []
    // STRUCTURAL TOUCH FILTER — leg-based (7/14 EMA cloud): a consolidation is TESTED
    // repeatedly on BOTH sides, but multiple fractal pivots form on ONE leg. To count each
    // swing only once, segment bars into legs via a coLegFast/coLegSlow EMA cross, then keep
    // ONE extreme per leg: a BULL leg → its highest high (a ceiling probe), a BEAR leg → its
    // lowest low (a floor probe). A touch = a leg whose extreme falls within coTouchBand% of
    // the boundary. Require ≥ coTouches ceiling AND ≥ coTouches floor. This collapses noise
    // (many micro-pivots on one move count as 1) and cleanly separates a real range (many
    // alternating legs probing both edges) from a trend-to-trend fake (few, one-sided).
    // Legs are computed once over the whole series; the qualifying extremes are attached to
    // each box so the render can highlight them (red = bull-leg ceiling, green = bear-leg
    // floor — opposite the cloud direction, per the user's color convention).
    type Leg = { bull: boolean; start: number; end: number; extIdx: number; extPrice: number }
    const legs: Leg[] = []
    const legF = ema(close, Math.max(2, Math.round(coLegFast)))
    const legS = ema(close, Math.max(3, Math.round(coLegSlow)))
    {
      let cur: Leg | null = null
      for (let k = 0; k < close.length; k++) {
        if (isNaN(legF[k]) || isNaN(legS[k])) continue
        const bull = legF[k] >= legS[k]
        if (!cur || cur.bull !== bull) {
          cur = { bull, start: k, end: k, extIdx: k, extPrice: bull ? high[k] : low[k] }
          legs.push(cur)
        } else {
          cur.end = k
          if (bull ? high[k] > cur.extPrice : low[k] < cur.extPrice) { cur.extPrice = bull ? high[k] : low[k]; cur.extIdx = k }
        }
      }
    }
    // CONFIRMED SWING PIVOTS (dense, 1 per real swing) — drive the drift regression + the
    // channel draw. These capture EVERY confirmed pivot (unlike leg extremes = 1 per EMA
    // leg), so the regression slope is robust. The leg-extreme regression was masking
    // staircase descents by grabbing each step's top; dense pivots expose the true tilt.
    const pL = Math.round(coPivLeft), pR = Math.round(coPivRight)
    const allHighPivots = (coMaxDrift > 0 || coShowChannel)
      ? confirmPivot(fractalPivots(high, pL, pR, true), high, true, pL, pR) : []
    const allLowPivots = (coMaxDrift > 0 || coShowChannel)
      ? confirmPivot(fractalPivots(low, pL, pR, false), low, false, pL, pR) : []
    // lineDrift — how much a swing-point line tilts across the box, as % of the box range.
    // Regressed over ALL confirmed pivots in the box. Flat (≈0%) = stationary = genuine
    // consolidation; large tilt = migrating pivots = a trend hiding inside the box.
    // Theil–Sen slope = MEDIAN of all pairwise slopes (one vote per pivot PAIR, not per
    // point). This is the fix for flat-then-trend boxes: a flat region spawns MANY pivots
    // (price oscillates) while a trend spawns FEW (price runs). Least-squares weights by
    // point density → the dense flat-start cluster outvotes the sparse trend-end and
    // under-reports the pitch. Theil–Sen gives each pair one vote, so the true channel
    // slope wins. Robust 'average' over ALL swing points — what the pitch should be.
    const lineDrift = (pts: { idx: number; price: number }[], span: number, range: number): number => {
      if (pts.length < 2 || range <= 0) return 0
      const slopes: number[] = []
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[j].idx - pts[i].idx
          if (dx <= 0) continue
          slopes.push((pts[j].price - pts[i].price) / dx)
        }
      if (!slopes.length) return 0
      slopes.sort((a, b) => a - b)
      const m = Math.floor(slopes.length / 2)
      const slope = slopes.length % 2 ? slopes[m] : (slopes[m - 1] + slopes[m]) / 2
      return slope * span / range * 100  // signed: + = rising channel, - = falling
    }
    if (boxes.length && (coTouches > 0 || coMaxDrift > 0 || coShowChannel)) {
      boxes = boxes.filter(bx => {
        const rng = bx.hi - bx.lo
        const span = bx.end - bx.start
        const band = rng * (coTouchBand / 100)
        const ceilThresh = bx.hi - band, floorThresh = bx.lo + band
        // TOUCHES — leg-based (1 per EMA leg, deduped). Bull leg highest = ceiling touch;
        // bear leg lowest = floor touch. This is the structural touch COUNT (↑N ↓N).
        const touches: { idx: number; price: number; bull: boolean }[] = []
        let ceil = 0, floor = 0
        for (const leg of legs) {
          if (leg.end < bx.start || leg.start > bx.end) continue
          if (leg.bull) {
            if (leg.extPrice >= ceilThresh) { ceil++; touches.push({ idx: leg.extIdx, price: leg.extPrice, bull: true }) }
          } else {
            if (leg.extPrice <= floorThresh) { floor++; touches.push({ idx: leg.extIdx, price: leg.extPrice, bull: false }) }
          }
        }
        bx.ceil = ceil; bx.floor = floor; bx.touches = touches
        // CHANNEL PIVOTS — dense (all confirmed swings in the box). Drive the drift regression
        // + the channel draw. Denser than leg extremes → robust slope, no staircase masking.
        const highs = allHighPivots.filter(pv => pv.idx >= bx.start && pv.idx <= bx.end)
        const lows = allLowPivots.filter(pv => pv.idx >= bx.start && pv.idx <= bx.end)
        bx.highs = highs; bx.lows = lows
        bx.driftH = rng > 0 ? lineDrift(highs, span, rng) : 0
        bx.driftL = rng > 0 ? lineDrift(lows, span, rng) : 0
        // CHANNEL DRIFT — signed average of the high + low pivot lines. + = rising channel
        // (uptrend consolidation), - = falling (downtrend consolidation). Magnitude = how
        // strongly pivots migrate across the box. Used to CLASSIFY, not reject.
        const channelDrift = (bx.driftH + bx.driftL) / 2
        const absDrift = Math.abs(channelDrift)
        bx.channelDrift = channelDrift
        bx.type = absDrift < coDirDrift ? 0 : (channelDrift >= 0 ? 1 : -1)
        // touch gate: must have ≥ coTouches ceiling AND floor probes
        if (coTouches > 0 && (ceil < coTouches || floor < coTouches)) return false
        // HARD DRIFT CAP: reject only if channel tilts > coMaxDrift% (pure trend, not a
        // consolidation). Directional consolidations (coDirDrift..coMaxDrift) SURVIVE.
        if (coMaxDrift > 0 && absDrift > coMaxDrift) return false
        return true
      })
    }
    // BOX COLOR — by consolidation TYPE when coColorType is on: range=slate, uptrend=cyan,
    // downtrend=amber. These are DISTINCT from green/red (reserved for breakouts +
    // support/resistance). Otherwise color by breakout direction (resolveDir) as before.
    const typeFill = (t: number) => t > 0 ? 'rgba(56,189,248,0.16)' : t < 0 ? 'rgba(251,146,60,0.16)' : (tc.co_neutral || 'rgba(180,185,205,0.16)')
    const typeBorder = (t: number) => t > 0 ? 'rgba(56,189,248,0.85)' : t < 0 ? 'rgba(251,146,60,0.85)' : (tc.co_neutral_line || 'rgba(180,185,205,0.7)')
    const fill = (b: ConsBox) => coColorType ? typeFill(b.type ?? 0)
      : !coShowBreak || b.resolveDir === 0
        ? (tc.co_neutral || 'rgba(180,185,205,0.16)')
        : b.resolveDir > 0 ? (tc.co_up || 'rgba(34,197,94,0.22)') : (tc.co_dn || 'rgba(239,68,68,0.22)')
    const border = (b: ConsBox) => coColorType ? typeBorder(b.type ?? 0)
      : !coShowBreak || b.resolveDir === 0
        ? (tc.co_neutral_line || 'rgba(180,185,205,0.7)')
        : b.resolveDir > 0 ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)'
    for (const bx of boxes) {
      const iStart = bx.start - vs, iEnd = bx.end - vs
      if (iEnd < 0 || iStart >= visible.length) continue
      const rightBar = bx.resolveBar >= 0 ? bx.resolveBar : (visible.length - 1 + vs)
      const iRight = Math.min(visible.length - 1, rightBar - vs)
      if (iRight < iStart) continue
      const xL = xCtr(Math.max(0, iStart)) - barW / 2
      const xR = xCtr(iRight) + barW / 2
      const yT = pToY(bx.hi), yB = pToY(bx.lo)
      ctx.fillStyle = fill(bx)
      ctx.fillRect(xL, yT, xR - xL, yB - yT)
      // TOUCH BAND ZONES — faint shaded bands near ceiling/floor marking where touches count.
      // Makes the percentile region the filter uses visible, and shows WHY a touch qualifies.
      if (coTouches > 0 || coShowVals) {
        const band = (bx.hi - bx.lo) * (coTouchBand / 100)
        const yCeilBand = pToY(bx.hi - band), yFloorBand = pToY(bx.lo + band)
        if (coShowTouches) {
          ctx.fillStyle = 'rgba(250,204,21,0.07)'
          ctx.fillRect(xL, yT, xR - xL, yCeilBand - yT)
          ctx.fillRect(xL, yFloorBand, xR - xL, yB - yFloorBand)
        }
      }
      ctx.strokeStyle = border(bx)
      ctx.lineWidth = 1
      ctx.strokeRect(xL, yT, xR - xL, yB - yT)
      // TOUCH DOTS — highlight the swing pivots that fall within the touch bands. Ceiling
      // touches = gold ring at the pivot high; floor touches = teal ring at the pivot low.
      // These are the actual touches counted by the filter, so you can SEE the ↑N ↓N tally.
      // TOUCH DOTS — one dot per qualifying LEG (7/14 EMA). Bull leg → red dot at its
      // highest high (ceiling probe); bear leg → green dot at its lowest low (floor probe).
      // Dot color is opposite the cloud direction (bull cloud = red dot, bear cloud = green
      // dot), matching the convention. These ARE the touches counted by the filter.
      if (coShowTouches && bx.touches) {
        for (const t of bx.touches) {
          const vi = t.idx - vs
          if (vi < 0 || vi >= visible.length) continue
          const dx = xCtr(vi), dy = pToY(t.price)
          ctx.beginPath(); ctx.arc(dx, dy, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = t.bull ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.95)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(8,12,20,0.8)'; ctx.lineWidth = 1; ctx.stroke()
        }
      }
      // SWING-POINT CHANNEL — faint connection lines through the swing highs (upper, red)
      // and swing lows (lower, green). Flat lines = consolidation; sloped lines = trend-in-
      // box. This is the visual the drift filter measures — turn it on to SEE why a box
      // passed or failed the tilt test.
      if (coShowChannel) {
        const drawChan = (pts: { idx: number; price: number }[], stroke: string) => {
          if (!pts || pts.length < 2) return
          ctx.strokeStyle = stroke; ctx.lineWidth = 1.25; ctx.setLineDash([])
          ctx.beginPath(); let started = false
          for (const p of pts) {
            const vi = p.idx - vs
            if (vi < 0 || vi >= visible.length) continue
            const dx = xCtr(vi), dy = pToY(p.price)
            if (!started) { ctx.moveTo(dx, dy); started = true } else ctx.lineTo(dx, dy)
          }
          ctx.stroke()
        }
        drawChan(bx.highs, 'rgba(239,68,68,0.55)')
        drawChan(bx.lows, 'rgba(34,197,94,0.55)')
      }
      // midpoint guide
      ctx.strokeStyle = 'rgba(180,185,205,0.18)'
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(xL, (yT + yB) / 2); ctx.lineTo(xR, (yT + yB) / 2); ctx.stroke()
      ctx.setLineDash([])
      // value label — shows the box's range in ×ATR (chart TF) and % of price, so the user
      // can READ each box and calibrate coMaxHeight between the values to kill the tall one.
      if (coShowVals) {
        const mid = Math.floor((bx.start + bx.end) / 2)
        const a = chartAtrAll[mid]
        const rng = bx.hi - bx.lo
        const pct = rng / ((bx.hi + bx.lo) / 2) * 100
        const atrX = (isFinite(a) && a > 0) ? (rng / a) : NaN
        const lbl = `R ${isFinite(atrX) ? atrX.toFixed(1) + '×ATR' : '?'} · ${pct.toFixed(1)}%${bx.ceil != null && bx.floor != null ? ` · ↑${bx.ceil} ↓${bx.floor}` : ''}${bx.channelDrift != null && bx.type != null ? ` · ${(bx.type > 0 ? '↑' : bx.type < 0 ? '↓' : '≈')}${Math.abs(bx.channelDrift).toFixed(0)}%` : ''}`
        // pin BOTH alignment anchors — other render code leaves ctx.textAlign in a non-left
        // state, which makes fillText glyphs drift left of their fillRect (fillRect ignores
        // textAlign, fillText obeys it → misaligned text/background). Restore after drawing.
        const prevAlign = ctx.textAlign, prevBase = ctx.textBaseline
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.font = '11px ui-monospace, monospace'
        const tw = ctx.measureText(lbl).width
        const lblX = xL + 4
        const lblY = yB + 4   // BELOW the box, bottom-left, outside
        ctx.fillStyle = 'rgba(8,12,20,0.85)'
        ctx.fillRect(lblX, lblY, tw + 8, 16)
        ctx.fillStyle = 'rgba(215,220,235,0.95)'
        ctx.fillText(lbl, lblX + 4, lblY + 2)
        ctx.textAlign = prevAlign
        ctx.textBaseline = prevBase
      }
    }
  } catch (e) {
    console.error('[renderConsolidation]', e)
  }
}

/** Pitch overlay — drawn AFTER the crosshair (called from ReactChartPanel, post-crosshair)
 *  so the crosshair's dashed lines no longer slash through / overwrite the readout.
 *  Shows the latest visible bar's pitch (top-right) and the hovered candle's pitch
 *  (follows the cursor). Both read from the displayed-TF pitch stashed by _render. */
export function renderLinguaPitchOverlay(rc: RenderContext) {
  const panelIdx = rc.panelIdx ?? 0
  const st = _panelPitch[panelIdx]
  if (!st || !st.pitch || !st.pitch.length) return
  const { ctx, W, PRICE_W, cx, cy, chartW, priceH, barW, xCtr, visible } = rc as any
  if (!visible || !visible.length) return
  const pitchAt = (ai: number) => (st.pitch[ai] != null && !isNaN(st.pitch[ai] as number)) ? st.pitch[ai] as number : NaN
  const pitchInfo = (deg: number) => {
    const absD = Math.abs(deg)
    let regime = 'FLAT'
    if (deg > 1) regime = absD > 55 ? 'VIOLENT' : absD > 25 ? 'TRENDING' : 'RISING'
    else if (deg < -1) regime = absD > 55 ? 'CRASHING' : absD > 25 ? 'DOWNTREND' : 'FALLING'
    return { absD, regime, arrow: deg >= 0 ? '▲' : '▼', col: deg >= 0 ? '#81c998' : '#ef9a9a' }
  }
  ctx.font = '10px "JetBrains Mono", monospace'
  ctx.textBaseline = 'top'
  // Hover label: pitch at the crosshair's candle, centered on that candle.
  const hovering = cx >= 0 && cx <= chartW && cy >= 0 && cy <= priceH
  if (hovering && barW > 0) {
    const hovBi = Math.max(0, Math.min(visible.length - 1, Math.round(cx / barW)))
    const hovPitch = pitchAt(st.vs + hovBi)
    const hovDeg = !isNaN(hovPitch) ? pitchToDeg(hovPitch) : NaN
    if (!isNaN(hovDeg)) {
      const { absD, regime, arrow, col } = pitchInfo(hovDeg)
      const hlbl = `${arrow} ${absD.toFixed(1)}° ${regime}`
      const htw = ctx.measureText(hlbl).width
      const hx = xCtr(hovBi)
      const hLeft = Math.max(2, Math.min(hx - htw / 2, W - PRICE_W - htw - 4))
      ctx.fillStyle = 'rgba(8,12,20,0.92)'
      ctx.fillRect(hLeft - 4, 20, htw + 8, 14)
      ctx.fillStyle = col
      ctx.fillText(hlbl, hLeft, 22)
    }
  }
}
