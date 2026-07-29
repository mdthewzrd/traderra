import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/personality?ticker=XYZ&window=2y
 *
 * Mean-Reversion PERSONALITY engine — descriptive push/fade inventory.
 * Ports assets/backtest/skyq-personality.mjs (v3, ATR-normalized) to TS.
 *
 * What it does:
 *   1. daily + 4h + 5m bars for the window (Polygon, paginated, cached).
 *   2. push days = daily high ≥ prevClose + 1.0 × daily-ATR14(prev). Grouped into events.
 *   3. per event: peak/trough on 5m, excursion(ATR+%), parabolic-accel, velocity,
 *      peakVol, devσ(4h 89-EMA), fade%(+3d), hrs-to-trough, reclaim, close color.
 *   4. verdict = fade-rate × reclaim% (Fader / Trender / Range). NAME-CHARACTER, not trend.
 *
 * Descriptive: fade = peak→trough as a FACT, no entry trigger tested.
 * Cache: .cache/personality.json — historical bars immutable (7-day TTL, today excluded).
 */
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r'
const POLY_BASE = 'https://api.polygon.io'
const ET = 'America/New_York'
const FETCH_CONCURRENCY = 6

const CFG = {
  pushATR: 1.0,        // push day = daily high ≥ prevClose + N × daily-ATR14(prev)
  atrPeriod: 14,
  gapThresh: 0.04,
  pmCutoffET: 9.5,     // 09:30 ET
  gapHighCutoff: 10.5, // 10:30 ET
  fadeWindowDays: 3,
  fadeNoonET: 12,        // noon ET split for the time-cap
  fadeCapAmHours: 12,    // peak before noon → 12h fade search
  fadeCapPmHours: 20,    // peak at/after noon → 20h fade search
}

// ── durable cache (outside .next, survives builds/restarts) ──────────────────
const CACHE_FILE = join(process.cwd(), '.cache', 'personality.json')
const memCache = new Map<string, { data: any; ts: number }>()
const TTL = 7 * 24 * 60 * 60 * 1000 // 7 days — historical bars immutable
try {
  if (existsSync(CACHE_FILE)) {
    for (const [k, v] of JSON.parse(readFileSync(CACHE_FILE, 'utf8'))) memCache.set(k, v)
  }
} catch {}
let spillTimer: ReturnType<typeof setTimeout> | null = null
function spillCache() {
  if (spillTimer) clearTimeout(spillTimer)
  spillTimer = setTimeout(() => {
    try { mkdirSync(join(CACHE_FILE, '..'), { recursive: true }); writeFileSync(CACHE_FILE, JSON.stringify([...memCache.entries()])) } catch {}
    spillTimer = null
  }, 5000)
}

// ── Polygon fetch + paginate ─────────────────────────────────────────────────
type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number }
async function fetchAggs(symbol: string, mult: number, span: string, from: string, to: string): Promise<Bar[]> {
  let url = `${POLY_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${mult}/${span}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${POLY_KEY}`
  const out: Bar[] = []
  let guard = 0
  while (url && guard++ < 40) {
    const r = await fetch(url)
    if (!r.ok) break
    const d = await r.json()
    if (Array.isArray(d.results)) for (const b of d.results) out.push({ time: Math.floor(b.t / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v })
    url = d.next_url ? `${d.next_url}&apiKey=${POLY_KEY}` : null
  }
  return out
}

// ── indicators (verbatim from skyq-personality.mjs) ──────────────────────────
function ema(v: number[], span: number): number[] {
  const n = v.length, o = new Array(n).fill(NaN)
  if (!n) return o
  const k = 2 / (span + 1); let p = v[0]; o[0] = p
  for (let i = 1; i < n; i++) { if (isNaN(v[i])) { o[i] = p; continue } p = v[i] * k + p * (1 - k); o[i] = p }
  return o
}
function wilderAtr(H: number[], L: number[], C: number[], len: number): number[] {
  const n = C.length, o = new Array(n).fill(NaN)
  if (!n) return o
  o[0] = H[0] - L[0]; let a = o[0]
  for (let i = 1; i < n; i++) {
    const tr = Math.max(H[i] - L[i], Math.abs(H[i] - C[i - 1]), Math.abs(L[i] - C[i - 1]))
    a = i <= len ? (a * (i - 1) + tr) / i : (a * (len - 1) + tr) / len
    o[i] = a
  }
  return o
}
function median(a: number[]): number { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// ── ET helpers ───────────────────────────────────────────────────────────────
function etDate(ms: number): string { return new Date(ms).toLocaleDateString('en-CA', { timeZone: ET }) }
function etMinOfDay(ms: number): number {
  const t = new Date(ms).toLocaleTimeString('en-GB', { timeZone: ET, hour12: false })
  const [h, m] = t.split(':').map(Number); return h * 60 + m
}
const etHour = (ms: number) => etMinOfDay(ms) / 60
const dateStr = (ts: number) => new Date(ts * 1000).toISOString().split('T')[0]

// lower-bound: first index in sorted-by-time bars where time >= ts
function lowerBound(bars: Bar[], ts: number, lo = 0): number {
  let lo2 = lo, hi = bars.length
  while (lo2 < hi) { const mid = (lo2 + hi) >> 1; if (bars[mid].time < ts) lo2 = mid + 1; else hi = mid }
  return lo2
}

// parabolicness of run-up [s..p]; vel in ATR/bar (atrRef = daily ATR at push start)
function runupStats(m: Bar[], s: number, p: number, atrRef: number) {
  const n = p - s + 1; if (n < 4) return { accel: NaN, vel: NaN }
  let lo = Infinity; for (let i = s; i <= p; i++) lo = Math.min(lo, m[i].low)
  const peak = m[p].high, totalRet = (peak - lo) / lo
  const split = Math.max(1, Math.floor(n * 2 / 3))
  let mx1 = -Infinity; for (let i = s; i < s + split; i++) mx1 = Math.max(mx1, m[i].high)
  const gainAtSplit = (mx1 - lo) / lo, lastThird = totalRet - gainAtSplit
  const accel = gainAtSplit > 1e-9 ? lastThird / gainAtSplit : (lastThird > 0 ? 99 : 0)
  const vel = atrRef > 0 ? (peak - lo) / atrRef / n : NaN
  return { accel, vel }
}

interface PushEvent {
  date: string; cat: string; span: number
  excursion: number; excursionPct: number; peak: number
  originET: number; gapped: boolean; accel: number; vel: number
  peakVolRatio: number; devSigma: number
  fadeDepth: number; tTroughH: number; reclaim: boolean; fadeDayCloseRed: boolean | null
  tag89: boolean; overshoot89: number   // fade = post-peak tag of 15m 89-EMA; push-min (fadeDepth) retained
  flipLagMin: number | null; flipCount: number; declineVolRatio: number   // 5m 9/20 bearish-flip timing + fade conviction
  // fade signals: 4h 72/89 cloud break, 15m 89-reclaim, trough time-of-day
  cloudBreak4h: boolean; reclaim89: boolean; troughHour: number
  // 1H VWAP reclaim (Ask 2) + 89-tag short-payoff geometry (peak→89 latency & R-target)
  reclaimVwap: boolean; tag89LagMin: number | null; rPeakTo89: number | null
}

// 1H session VWAP — resets at 09:30 ET RTH open (modeled on gap-stats/route.ts sessionVWAP).
// NaN for pre-market / after-hours bars; VWAP is only meaningful inside the RTH session.
function sessionVWAPHourly(h1: Bar[]): number[] {
  const n = h1.length, out = new Array(n).fill(NaN)
  let cumVP = 0, cumV = 0, curDay: string | null = null
  for (let i = 0; i < n; i++) {
    const b = h1[i]
    const etH = etHour(b.time * 1000)
    if (etH >= 9.5 && etH < 16) {                          // RTH 09:30–16:00 ET
      const dk = dateStr(b.time)
      if (dk !== curDay) { cumVP = 0; cumV = 0; curDay = dk }  // reset at first RTH bar of each day
      const typical = (b.high + b.low + b.close) / 3
      cumVP += typical * b.volume
      cumV += b.volume
      out[i] = cumV > 0 ? cumVP / cumV : b.close
    }   // else leave NaN (non-RTH)
  }
  return out
}

async function computeInventory(symbol: string, from: string, to: string) {
  const [daily, h4, h1, m5, m15] = await Promise.all([
    fetchAggs(symbol, 1, 'day', from, to),
    fetchAggs(symbol, 4, 'hour', from, to),
    fetchAggs(symbol, 1, 'hour', from, to),
    fetchAggs(symbol, 5, 'minute', from, to),
    fetchAggs(symbol, 15, 'minute', from, to),
  ])
  if (!daily.length || !h4.length) return { error: `No history for ${symbol}` }

  // 1H session VWAP (Ask 2 reclaim target).
  const vwap1 = sessionVWAPHourly(h1)

  const c4 = h4.map(b => b.close), H4 = h4.map(b => b.high), L4 = h4.map(b => b.low)
  const e89_4 = ema(c4, 89), atr89_4 = wilderAtr(H4, L4, c4, 89), e72_4 = ema(c4, 72)
  const e89_15 = ema(m15.map(b => b.close), 89)   // 15m 89-EMA = the mean-reversion fade target
  const e9_5 = ema(m5.map(b => b.close), 9), e20_5 = ema(m5.map(b => b.close), 20)   // 5m 9/20 = momentum-flip layer
  const atrD = wilderAtr(daily.map(b => b.high), daily.map(b => b.low), daily.map(b => b.close), CFG.atrPeriod)
  const last = h4.length - 1, dlast = daily.length - 1
  const regime = e89_4[last] > atr89_4[last] ? 'BULL' : 'BEAR' // placeholder, fixed below
  const dailyATR = atrD[dlast]

  const devSigmaAt = (price: number, unixSec: number) => {
    let bi = 0; for (let i = 0; i < h4.length; i++) { if (h4[i].time <= unixSec) bi = i; else break }
    return atr89_4[bi] > 0 ? (price - e89_4[bi]) / atr89_4[bi] : 0
  }
  const excATR = (i: number) => { const a = atrD[i - 1]; return a > 0 ? (daily[i].high - daily[i - 1].close) / a : 0 }
  const excPct = (i: number) => daily[i - 1].close > 0 ? (daily[i].high - daily[i - 1].close) / daily[i - 1].close : 0

  // threshold sensitivity
  const sens: Record<string, number> = {}
  for (const t of [0.75, 1.0, 1.5, 2.0, 2.5]) { let c = 0; for (let i = 1; i < daily.length; i++) if (excATR(i) >= t) c++; sens[String(t)] = c }

  // push days + grouping into events (consecutive idx)
  const pushIdx: number[] = []
  for (let i = 1; i < daily.length; i++) if (excATR(i) >= CFG.pushATR) pushIdx.push(i)
  const events: number[][] = []; let cur: number[] = []
  for (const idx of pushIdx) { if (cur.length && idx === cur[cur.length - 1] + 1) cur.push(idx); else { if (cur.length) events.push(cur); cur = [idx] } }
  if (cur.length) events.push(cur)

  const out: PushEvent[] = []
  for (const ev of events) {
    const startIdx = ev[0], endIdx = ev[ev.length - 1]
    const evStartTime = daily[startIdx].time
    const runStart = lowerBound(m5, evStartTime)
    if (runStart >= m5.length) continue
    const atrRef = atrD[startIdx - 1] || 1
    // peak over the run window — EXACT match to validated skyq-personality.mjs:
    // barsPerDay≈90 (7.5h of 5m bars) × span. Wider windows skew the fade measurement.
    const barsPerDay = 90
    const peakSearchEnd = Math.min(m5.length - 1, runStart + ev.length * barsPerDay)
    let peakIdx = runStart; for (let i = runStart; i <= peakSearchEnd; i++) if (m5[i].high > m5[peakIdx].high) peakIdx = i
    const peakTime = m5[peakIdx].time
    const peakET = etHour(peakTime * 1000)
    // fade window = MIN(fadeWindowDays, time-of-day cap). Cap shrinks the search so only
    // genuine same-session fade-overs count (AM peak → 12h, PM peak → 20h, per REQ-278).
    const fadeCapSec = (peakET < CFG.fadeNoonET ? CFG.fadeCapAmHours : CFG.fadeCapPmHours) * 3600
    const fadeEndBars = Math.min(m5.length - 1, peakIdx + CFG.fadeWindowDays * barsPerDay)
    const fadeEndCap  = Math.min(m5.length - 1, lowerBound(m5, peakTime + fadeCapSec, peakIdx))
    const fadeEnd = Math.min(fadeEndBars, fadeEndCap)
    let troughIdx = peakIdx; for (let i = peakIdx + 1; i <= fadeEnd; i++) if (m5[i].low < m5[troughIdx].low) troughIdx = i
    const reclaim = m5.slice(peakIdx + 1, fadeEnd + 1).some(b => b.high > m5[peakIdx].high)
    const tTroughH = (m5[troughIdx].time - m5[peakIdx].time) / 3600
    const fadeDepth = (m5[peakIdx].high - m5[troughIdx].low) / m5[peakIdx].high
    // 15m 89-EMA FADE TAG: after the push high, did price come back and touch the 15m 89-EMA?
    // (the fade gate). push-min (troughIdx/fadeDepth) still recorded for depth/overshoot.
    const p15 = lowerBound(m15, peakTime)                                    // first 15m bar at/after the peak
    const f15Bars = Math.min(m15.length - 1, lowerBound(m15, peakTime + CFG.fadeWindowDays * 86400, p15))
    const f15Cap  = Math.min(m15.length - 1, lowerBound(m15, peakTime + fadeCapSec, p15))
    const f15 = Math.min(f15Bars, f15Cap)
    let tag89 = false, tagBar15 = -1, overshoot89 = 0, reclaim89 = false
    let tag89LagMin: number | null = null, rPeakTo89: number | null = null
    if (p15 < m15.length) {
      const emaAtPeak = e89_15[p15]
      if (!isNaN(emaAtPeak) && m5[peakIdx].high > emaAtPeak) {               // only if push peaked ABOVE the 89
        for (let i = p15; i <= f15; i++) if (m15[i].low <= e89_15[i]) { tag89 = true; tagBar15 = i; break }
        const t15 = Math.min(m15.length - 1, lowerBound(m15, m5[troughIdx].time, p15))
        const et = e89_15[t15]
        if (!isNaN(et) && et > 0) overshoot89 = (et - m15[t15].low) / et       // +ve = trough below the 89
        // did a later 15m bar CLOSE back above the 89 after the tag? (V-reclaim vs lower-low drift)
        if (tagBar15 >= 0) for (let i = tagBar15 + 1; i <= f15; i++) if (m15[i].close > e89_15[i]) { reclaim89 = true; break }
        // short-payoff geometry: peak→89-tag latency (min) and peak→89 R-target (ATR multiples)
        if (tag89 && tagBar15 >= 0) {
          tag89LagMin = (tagBar15 - p15) * 15
          const emaAtTag = e89_15[tagBar15]
          rPeakTo89 = (!isNaN(emaAtTag) && atrRef > 0) ? (m5[peakIdx].high - emaAtTag) / atrRef : null
        }
      }
    }
    // 1H VWAP reclaim (Ask 2): within peak → +5d, price must first fade to/below VWAP (hit the target),
    // then post TWO consecutive 1H closes above VWAP (bounced high and held — not a wick that fails).
    let reclaimVwap = false
    const reclaimWindowDays = 5
    if (h1.length) {
      const h1Start = lowerBound(h1, peakTime)
      const h1End = Math.min(h1.length - 1, lowerBound(h1, peakTime + reclaimWindowDays * 86400, h1Start))
      let brokeBelow = false, prevAbove = false
      for (let i = h1Start; i <= h1End; i++) {
        if (isNaN(vwap1[i])) { prevAbove = false; continue }
        const above = h1[i].close > vwap1[i]
        if (!above) { brokeBelow = true; prevAbove = false }
        else if (brokeBelow && prevAbove) { reclaimVwap = true; break }       // 2 consec holds after a fade
        else prevAbove = true
      }
    }
    // 5m 9/20 momentum flips during the fade: first bearish-flip lag (peak→roll-over) + count (choppiness)
    let flipLagMin: number | null = null, flipCount = 0
    for (let i = peakIdx + 1; i <= fadeEnd; i++) {
      if (e9_5[i - 1] >= e20_5[i - 1] && e9_5[i] < e20_5[i]) {   // bearish cross (9↓20)
        flipCount++
        if (flipLagMin === null) flipLagMin = (i - peakIdx) * 5    // 5m bars → minutes
      }
    }
    const { accel, vel } = runupStats(m5, runStart, peakIdx, atrRef)
    // peakVol = peak bar ÷ median(all non-zero pre-push 5m vol), floored at 1
    const preVol: number[] = []; for (let i = 0; i < runStart; i++) if (m5[i].volume > 0) preVol.push(m5[i].volume)
    const preMed = preVol.length ? Math.max(1, median(preVol)) : 1
    const peakVolRatio = m5[peakIdx].volume / preMed
    // fade-leg conviction: mean DECLINE volume (peak→trough) vs mean PUSH-leg volume (runStart→peak).
    // >1 = heavier selling than buying (conviction fade); <1 = drift. Regime-invariant within-move ratio.
    let pushLegVol = 0, declineVol = 0, pushN = 0, declineN = 0
    for (let i = runStart; i < peakIdx; i++) { pushLegVol += m5[i].volume; pushN++ }
    for (let i = peakIdx + 1; i <= troughIdx; i++) { declineVol += m5[i].volume; declineN++ }
    const declineVolRatio = (pushN && declineN) ? (declineVol / declineN) / (pushLegVol / pushN) : 0
    const troughHour = etHour(m5[troughIdx].time * 1000)
    // 4h 72/89 EMA cloud at the trough — did the fade break back down through it?
    const h4idx = Math.min(h4.length - 1, lowerBound(h4, m5[troughIdx].time))
    const cloudBreak4h = m5[troughIdx].low < Math.min(e72_4[h4idx], e89_4[h4idx])
    const gapped = daily[startIdx].open >= daily[startIdx - 1].close * (1 + CFG.gapThresh)
    let cat = ev.length === 1 ? 'd1' : ev.length === 2 ? 'd2' : 'mdr', sub = cat
    if (cat === 'd1') {
      if (peakET < CFG.pmCutoffET) sub = 'd1 pm/ah'
      else if (gapped && peakET < CFG.gapHighCutoff) sub = 'd1 gap'
      else sub = 'd1 intraday para'
    }
    let excursion = 0, excursionPct = 0
    for (const i of ev) { const a = excATR(i); if (a > excursion) { excursion = a; excursionPct = excPct(i) } }
    const fday = daily.find(b => dateStr(b.time) === dateStr(m5[troughIdx].time))
    out.push({
      date: dateStr(daily[startIdx].time), cat: sub, span: ev.length,
      excursion: +excursion.toFixed(2), excursionPct: +excursionPct.toFixed(3),
      peak: +m5[peakIdx].high.toFixed(2), originET: +peakET.toFixed(2), gapped,
      accel: +(accel || 0).toFixed(2), vel: +(vel || 0).toFixed(3),
      peakVolRatio: +peakVolRatio.toFixed(1), devSigma: +(devSigmaAt(m5[peakIdx].high, m5[peakIdx].time) || 0).toFixed(1),
      fadeDepth: +fadeDepth.toFixed(3), tTroughH: +tTroughH.toFixed(1), reclaim,
      fadeDayCloseRed: fday ? fday.close < fday.open : null,
      tag89, overshoot89: +overshoot89.toFixed(3),
      flipLagMin: flipLagMin === null ? null : +flipLagMin.toFixed(0), flipCount, declineVolRatio: +declineVolRatio.toFixed(1),
      cloudBreak4h, reclaim89, troughHour: +troughHour.toFixed(2),
      reclaimVwap, tag89LagMin: tag89LagMin === null ? null : +tag89LagMin.toFixed(0), rPeakTo89: rPeakTo89 === null ? null : +rPeakTo89.toFixed(2),
    })
  }

  // aggregates
  const byCat: Record<string, number> = {}; for (const e of out) byCat[e.cat] = (byCat[e.cat] || 0) + 1
  const months: Record<string, number> = {}; for (const e of out) { const k = e.date.slice(0, 7); months[k] = (months[k] || 0) + 1 }
  const faded = out.filter(e => e.fadeDepth >= 0.10)
  const faded89 = out.filter(e => e.tag89)        // fade = post-peak tag of the 15m 89-EMA
  const euph = out.filter(e => e.devSigma >= 6.9)
  const med = {
    ex: median(out.map(e => e.excursion)), exP: median(out.map(e => e.excursionPct)),
    ac: median(out.map(e => e.accel)), ve: median(out.map(e => e.vel)),
    pv: median(out.map(e => e.peakVolRatio)), ds: median(out.map(e => e.devSigma)),
    fd: median(faded.map(e => e.fadeDepth)), tt: median(faded.map(e => e.tTroughH)),
    osh: median(out.map(e => e.overshoot89)),
    fl: median(out.filter(e => e.flipLagMin !== null).map(e => e.flipLagMin as number)),
    fc: median(out.map(e => e.flipCount)),
    dv: median(out.map(e => e.declineVolRatio)),
    th: median(out.map(e => e.troughHour)),               // median trough hour-of-day (ET)
    tl89: median(out.filter(e => e.tag89LagMin !== null).map(e => e.tag89LagMin as number)),   // median peak→89-tag latency (min)
    r89: median(out.filter(e => e.rPeakTo89 !== null).map(e => e.rPeakTo89 as number)),       // median peak→89 R-target (ATR)
  }

  // ── VERDICT: fade-rate (15m 89-EMA tag) × reclaim% (1H VWAP hold) ──
  // fadeRate baseline = pushes that TAGGED the 15m 89-EMA post-peak (the MR fade gate).
  // reclaimVwapRate = pushes that faded to VWAP then posted 2 consec 1H closes above it (held).
  // fadeRateDepth (legacy ≥10% peak→trough) retained for reference.
  const total = out.length
  const fadeRate = total ? faded89.length / total : 0          // baseline: 89-EMA tag
  const fadeRate89 = fadeRate                                  // alias (backward compat)
  const fadeRateDepth = total ? faded.length / total : 0       // legacy depth-based
  const reclaimRate = total ? out.filter(e => e.reclaim).length / total : 0
  const reclaimVwapRate = total ? out.filter(e => e.reclaimVwap).length / total : 0
  // short-payoff aggregates: cleanShort = tagged 89 and NOT reclaimed; failedFade = tagged 89 but reclaimed.
  const cleanShortN = out.filter(e => e.tag89 && !e.reclaimVwap).length
  const failedFadeN = out.filter(e => e.tag89 && e.reclaimVwap).length
  const cleanShortRate = total ? cleanShortN / total : 0
  const failedFadeRate = total ? failedFadeN / total : 0
  let verdict: 'Fader' | 'Trender' | 'Range' = 'Range'
  if (fadeRate >= 0.5 && reclaimVwapRate <= 0.6) verdict = 'Fader'
  else if (fadeRate <= 0.15 && reclaimVwapRate >= 0.7) verdict = 'Trender'

  // regime from 4h EMA72 vs EMA89 (e72_4 declared alongside e89_4 at top of fn — reused in per-push 4h cloud break)
  const regimeFinal = e72_4[last] > e89_4[last] ? 'BULL' : 'BEAR'

  // trajectory for archetype naming (straight-down vs round-trip vs uptrend vs range-bound)
  const dHigh = daily.reduce((mx, b) => Math.max(mx, b.high), 0)
  const fromClose = daily[0].close, closeNow = daily[dlast].close
  const traj = {
    fromClose: +fromClose.toFixed(2), high: +dHigh.toFixed(2), close: +closeNow.toFixed(2),
    trajPct: fromClose > 0 ? +((closeNow - fromClose) / fromClose).toFixed(3) : 0,
    peakDropPct: dHigh > 0 ? +((dHigh - closeNow) / dHigh).toFixed(3) : 0,
  }

  return {
    symbol, regime: regimeFinal, verdict, fadeRate, fadeRate89, fadeRateDepth, reclaimRate, reclaimVwapRate,
    dailyATR: +dailyATR.toFixed(3), atrPctOfPrice: daily[dlast].close > 0 ? +(dailyATR / daily[dlast].close).toFixed(3) : 0,
    generatedAt: new Date().toISOString(), range: { from: dateStr(daily[0].time), to: dateStr(daily[dlast].time) },
    bars: { daily: daily.length, h4: h4.length, h1: h1.length, m5: m5.length, m15: m15.length },
    close: +daily[dlast].close.toFixed(2),
    trajectory: traj,
    aggregates: {
      byCat, count: total, sensitivity: sens, medians: med,
      fadedN: faded.length, faded89N: faded89.length, reclaim89N: out.filter(e => e.reclaim89).length,
      reclaimVwapN: out.filter(e => e.reclaimVwap).length,
      cleanShortN, failedFadeN, cleanShortRate, failedFadeRate,
      cloudBreak4hN: out.filter(e => e.cloudBreak4h).length, euphoricN: euph.length,
      cadencePerMonth: total / (Object.keys(months).length || 1),
    },
    vwap: vwap1,   // debug: full 1H session-VWAP series
    inventory: out,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ticker = (searchParams.get('ticker') || '').toUpperCase().trim()
  const window = (searchParams.get('window') || '2y') as '1y' | '2y' | '5y' | 'all'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const cacheKey = `${ticker}|${window}`
  const hit = memCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < TTL) return NextResponse.json(hit.data)

  const spanDays = window === '1y' ? 375 : window === '2y' ? 740 : window === '5y' ? 1825 : 3650
  const to = new Date(); const from = new Date(to.getTime() - spanDays * 86400000)
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  try {
    const data = await computeInventory(ticker, fmt(from), fmt(to))
    if ((data as any).error) return NextResponse.json({ error: (data as any).error }, { status: 404 })
    memCache.set(cacheKey, { data, ts: Date.now() }); spillCache()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'personality failed' }, { status: 500 })
  }
}
