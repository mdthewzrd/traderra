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

type Stage = 'CONSOLIDATION' | 'UPTREND' | 'TRENDBREAK' | 'BACKSIDE' | 'EXTREME CONT' | 'EXTREME LOWER' | 'EUPHORIC'

// Hierarchical classify: MTF base regime + HTF alignment splits extremes.
// Consolidation requires BOTH 1H and 4H AoP flat (4H gates the noise — a brief 1H
// wiggle barely moves the slow 4H oscillator, so only genuine ranges flatten both).
// A 1H flat spot during a 4H trend = pause within the trend → inherits 4H direction.
function classifyHier(aop_m: number, dev_m: number, devLow_m: number, dev_h: number, devLow_h: number, aop_h: number, flat: number, flatH: number, xtreme: number, euThr: number): Stage {
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
  if (mFlat && hFlat) return 'CONSOLIDATION'
  if (mFlat) return (aop_h > 0 ? 'UPTREND' : 'BACKSIDE')   // 1H flat, 4H trending → pause
  return aop_m > flat ? 'UPTREND' : 'BACKSIDE'
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
const VALID_STAGES: Record<string, true> = { 'CONSOLIDATION': true, 'UPTREND': true, 'TRENDBREAK': true, 'BACKSIDE': true, 'EXTREME CONT': true, 'EXTREME LOWER': true, 'EUPHORIC': true }

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
    } else if (out[i] === 'UPTREND') {
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
function computeCachedClassification(panelIdx: number, flat: number, flatH: number, xtreme: number, euThr: number, holdBars: number, tbOn: number, tbConfirm: number, tbMargin: number, tbReclaim: number): {
  mtfHyst: Stage[], rawTrans: number, hystTrans: number, n: number,
} {
  const mtf = tfSlot(MTF, panelIdx), htf = tfSlot(HTF, panelIdx)
  const n = mtf.times.length
  // _feedGen busts the cache when MTF/HTF bars are re-fed (incl. on param change, which
  // re-runs setLinguaMtfBars via the ReactChartPanel param-subscription effect).
  const sig = `${n}|${mtf.times[n-1]}|${htf.times.length}|${flat}|${flatH}|${xtreme}|${euThr}|${holdBars}|${tbOn}|${tbConfirm}|${tbMargin}|${tbReclaim}|${_feedGen[panelIdx] || 0}`
  const cached = _cacheMtfHyst[panelIdx]
  if (sig === _cacheSig[panelIdx] && cached && cached.length === n) {
    return { mtfHyst: cached, rawTrans: _cacheRawTransitions[panelIdx] || 0, hystTrans: _cacheHystTransitions[panelIdx] || 0, n }
  }
  // Recompute only on signature change (bars arrived / params changed)
  const mtfRaw: Stage[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const h = ffill(htf, mtf.times[i])
    mtfRaw[i] = classifyHier(mtf.aop[i], mtf.dev[i], mtf.devLow[i], h.dev, h.devLow, h.aop, flat, flatH, xtreme, euThr)
  }
  const mtfHyst0 = applyHysteresis(mtfRaw, holdBars)
  // Post-extreme reset on the 1H timeline: EC/EUPHORIC/EL fires once, holds until price
  // touches the 1H slow EMA (eSlow), then UPTREND/BACKSIDE resumes.
  const mtfHystExt = applyExtremeReset(mtfHyst0, mtf.dev, mtf.eSlow, mtf.high, mtf.low)
  // Trendbreak detection: UPTREND → TRENDBREAK when close loses the gold eTrend line;
  // resolves to BACKSIDE when eSlow slope confirms down, or back to UPTREND if price
  // reclaims eTrend. Early structural break — fires before the slope-based BACKSIDE.
  const mtfHyst = tbOn ? applyTrendBreak(mtfHystExt, mtf.aop, mtf.eTrend, mtf.atrMid, mtf.close, flat, tbConfirm, tbMargin, tbReclaim) : mtfHystExt
  let rawTrans = 0, hystTrans = 0
  for (let i = 1; i < n; i++) {
    if (mtfRaw[i] !== mtfRaw[i - 1]) rawTrans++
    if (mtfHyst[i] !== mtfHyst[i - 1]) hystTrans++
  }
  _cacheSig[panelIdx] = sig
  _cacheMtfHyst[panelIdx] = mtfHyst
  _cacheRawTransitions[panelIdx] = rawTrans
  _cacheHystTransitions[panelIdx] = hystTrans
  return { mtfHyst, rawTrans, hystTrans, n }
}

// ── displayed-TF indicator cache (for bands/clouds overlay) ──
// Computed on the VISIBLE timeframe bars (aligns with candles on screen),
// independent of the MTF/HTF classification caches above. Per-panelIdx so charts with
// different emaMid/emaSlow params don't share one displayed-TF slot.
let _dcSig: Record<number, string> = {}
let _dc: Record<number, { e9: number[]; e20: number[]; eMid: number[]; eSlow: number[]; eTrend: number[]; pitch: number[]; atr: number[]; atrMid: number[]; atrSlow: number[]; mean: number[] }> = {}
// Last computed displayed-TF pitch per panel — consumed by renderLinguaPitchOverlay,
// which runs AFTER the crosshair (called from ReactChartPanel) so the crosshair's dashed
// lines don't slash through / overwrite the pitch readout.
let _panelPitch: Record<number, { pitch: number[]; vs: number }> = {}
function computeDisplayedTF(panelIdx: number, data: any[]) {
  const tp = getMergedToolParams(panelIdx, 'lingua') as any
  const emaMid = tp.emaMid ?? 59
  const emaSlow = tp.emaSlow ?? 69
  const trendEma = tp.trendEma ?? 39
  const cached = _dc[panelIdx]
  if (!data || data.length === 0) return cached || { e9: [], e20: [], eMid: [], eSlow: [], eTrend: [], pitch: [], atr: [], atrMid: [], atrSlow: [], mean: [] }
  const sig = `${data.length}|${data[data.length - 1].time}|${emaMid}|${emaSlow}|${trendEma}`
  if (sig === _dcSig[panelIdx] && cached) return cached
  const close = data.map((b: any) => b.close as number)
  const high = data.map((b: any) => b.high as number)
  const low = data.map((b: any) => b.low as number)
  const e9 = ema(close, 9), e20 = ema(close, 20), eMid = ema(close, emaMid), eSlow = ema(close, emaSlow)
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
  _dcSig[panelIdx] = sig; _dc[panelIdx] = { e9, e20, eMid, eSlow, eTrend, pitch, atr, atrMid, atrSlow, mean }
  return _dc[panelIdx]
}

// ── main render (guarded) ──
export function renderLinguaCycle(rc: RenderContext) {
  try { _render(rc) }
  catch (e) { console.error('[lingua] render error:', e) }
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
  const tbLtfOn = (p.tbLtfOn as number) ?? 1   // 15m fractal-child LEAD markers (extra fetch)
  const showClouds = (p.showClouds as number) !== 0
  const showBands = (p.showBands as number) !== 0
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
  const { mtfHyst, rawTrans, hystTrans, n } = computeCachedClassification(panelIdx, flat, flatH, xtreme, euThr, holdBars, tbOn, tbConfirm, tbMargin, tbReclaim)

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
  }

  // Short on-chart labels (2-letter) for readability. Internal stage values unchanged.
  const SHORT: Record<Stage, string> = {
    'CONSOLIDATION': 'CO', 'UPTREND': 'UP', 'TRENDBREAK': 'TB', 'BACKSIDE': 'BK',
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
      prevStage = st
    }
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
