import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/gap-stats?ticker=XYZ&window=2y
 *
 * Gap microstructure engine — FADE-CENTRIC, smart-fetched, durably cached.
 *
 * Pipeline (smart fetch):
 *   1. adjusted + unadjusted DAILY bars for the window (2 cheap calls, paginated).
 *   2. detect gap days (open/prevClose-1 >= 20%) from daily.
 *   3. fetch 5m + 15m intraday ONLY for those gap dates (per-day, concurrency-limited).
 *      → previously fetched years of intraday for the whole window; now bounded by gap count.
 *      → makes 'all' window truly all-time (daily since inception, intraday only for gaps).
 *   4. per-gap-day session-scoped indicators (VWAP/EMA anchored at RTH open).
 *
 * Stats are FADE-CENTRIC: cascade outcome "no new HOD after trigger" = the fade (green).
 *   fadeRate = 1 − newHodRate. 0% new HOD → 100% fade.
 *
 * Cache: process.cwd()/.cache/gap-stats.json — survives builds & restarts (7-day TTL;
 * historical bars immutable, today excluded).
 */
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r'
const POLY_BASE = 'https://api.polygon.io'
const ET = 'America/New_York'
const RTH_OPEN_MIN = 570   // 9:30 ET
const RTH_CLOSE_MIN = 960  // 16:00 ET
const FETCH_CONCURRENCY = 8

// ── durable cache (outside .next, survives builds) ──────────
const CACHE_FILE = join(process.cwd(), '.cache', 'gap-stats.json')
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

// ── Polygon fetch + paginate ────────────────────────────────
type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number }
async function fetchAggs(symbol: string, mult: number, span: string, from: string, to: string, adjusted: boolean): Promise<Bar[]> {
  let url = `${POLY_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${mult}/${span}/${from}/${to}?adjusted=${adjusted ? 'true' : 'false'}&sort=asc&limit=50000&apiKey=${POLY_KEY}`
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

// fetch intraday for a list of specific calendar dates — concurrency-limited
async function fetchDays(symbol: string, dates: string[], mult: number, span: string): Promise<Map<string, Bar[]>> {
  const out = new Map<string, Bar[]>()
  let cursor = 0
  const worker = async () => {
    while (cursor < dates.length) {
      const d = dates[cursor++]   // safe: synchronous read+increment, no await between
      try { out.set(d, await fetchAggs(symbol, mult, span, d, d, true)) } catch { out.set(d, []) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, dates.length) || 1 }, worker))
  return out
}

// ── session-scoped indicators (anchored at RTH open) ────────
function sessionVWAP(bars: Bar[]): number[] {
  const out: number[] = []; let cumPV = 0, cumV = 0
  for (const b of bars) { const tp = (b.high + b.low + b.close) / 3; cumPV += tp * (b.volume || 0); cumV += (b.volume || 0); out.push(cumV > 0 ? cumPV / cumV : b.close) }
  return out
}
function emaArr(bars: Bar[], p: number): number[] {
  const k = 2 / (p + 1); const out: number[] = []; let prev = NaN
  for (let i = 0; i < bars.length; i++) { const c = bars[i].close; prev = i === 0 ? c : c * k + prev * (1 - k); out.push(prev) }
  return out
}

// ── ET helpers ──────────────────────────────────────────────
function etDate(ms: number): string { return new Date(ms).toLocaleDateString('en-CA', { timeZone: ET }) }
function etMinOfDay(ms: number): number {
  const t = new Date(ms).toLocaleTimeString('en-GB', { timeZone: ET, hour12: false })
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function fmtMin(min: number): string { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}` }
function median(arr: number[]): number { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

// ── per-session microstructure ──────────────────────────────
interface DayResult {
  date: string; gapPct: number; g50: boolean
  open: number; close: number; high: number; low: number; pdc: number
  realOpen: number | null; realClose: number | null; realHigh: number | null
  pmh: number | null; rthHigh: number | null; rthLow: number | null
  highTime: string | null; lowTime: string | null
  faded: boolean
  c: (boolean | null)[]   // per cascade: true=newHOD, false=NO newHOD (fade), null=trigger never fired
}
interface S5 { bar: Bar; vwap: number | null; ema9: number | null; ema20: number | null }
interface S15 { bar: Bar; vwap: number | null }

function analyzeDay(
  date: string, rth5: S5[], rth15: S15[], pre5: Bar[],
  daily: Bar, pdc: number, realDaily: Bar | null
): DayResult {
  const pmh = pre5.length ? Math.max(...pre5.map(b => b.high)) : null

  // RTH high/low + times (5m granularity)
  let rthHigh = -Infinity, rthLow = Infinity, highMs = 0, lowMs = 0
  for (const s of rth5) {
    if (s.bar.high > rthHigh) { rthHigh = s.bar.high; highMs = s.bar.time * 1000 }
    if (s.bar.low < rthLow) { rthLow = s.bar.low; lowMs = s.bar.time * 1000 }
  }
  rthHigh = rth5.length ? rthHigh : null
  rthLow = rth5.length ? rthLow : null
  const highTime = rth5.length ? new Date(highMs).toLocaleTimeString('en-GB', { timeZone: ET, hour12: false }).slice(0, 5) : null
  const lowTime = rth5.length ? new Date(lowMs).toLocaleTimeString('en-GB', { timeZone: ET, hour12: false }).slice(0, 5) : null

  // ── cascades: after trigger (post-open), did price make a new RTH HOD? ──
  const highs5 = rth5.map(s => s.bar.high)
  const newHodAfter5 = (triggerPos: number): boolean | null => {
    if (triggerPos < 0) return null
    let maxUpTo = -Infinity
    for (let k = 0; k <= triggerPos; k++) maxUpTo = Math.max(maxUpTo, highs5[k])
    for (let k = triggerPos + 1; k < highs5.length; k++) if (highs5[k] > maxUpTo) return true   // reclaimed = new HOD
    return false   // no reclaim = FADE
  }
  const pos15to5 = (p15: number): number => { if (p15 < 0) return -1; const t = rth15[p15].bar.time; let best = 0, bd = Infinity; for (let k = 0; k < rth5.length; k++) { const dd = Math.abs(rth5[k].bar.time - t); if (dd < bd) { bd = dd; best = k } } return best }

  let p = -1; for (let k = 1; k < rth15.length; k++) { if (rth15[k].bar.close < rth15[k - 1].bar.low) { p = k; break } }
  const c1Fired = p >= 0
  let q = -1; for (let k = 0; k < rth5.length; k++) { if (rth5[k].vwap != null && rth5[k].bar.close < rth5[k].vwap!) { q = k; break } }
  let r = -1; for (let k = 0; k < rth15.length; k++) { if (rth15[k].vwap != null && rth15[k].bar.close < rth15[k].vwap!) { r = k; break } }
  const c3Fired = r >= 0
  let s4 = -1; for (let k = 1; k < rth5.length; k++) { const a = rth5[k].ema9, b = rth5[k].ema20, pa = rth5[k - 1].ema9, pb = rth5[k - 1].ema20; if (a != null && b != null && pa != null && pb != null && a < b && pa >= pb) { s4 = k; break } }
  let s5 = -1; for (let k = 1; k < rth5.length; k++) { if (rth5[k].bar.close < rth5[k - 1].bar.low) { s5 = k; break } }
  let s6 = -1
  for (let k = 0; k < rth15.length; k++) {
    const t = rth15[k].bar.time; let prior5Low: number | null = null
    for (let m = rth5.length - 1; m >= 0; m--) { if (rth5[m].bar.time <= t) { prior5Low = rth5[m].bar.low; break } }
    if (prior5Low != null && rth15[k].bar.close < prior5Low) { s6 = k; break }
  }

  const c = [
    newHodAfter5(pos15to5(p)),   // c1
    newHodAfter5(q),             // c2
    newHodAfter5(pos15to5(r)),   // c3
    newHodAfter5(s4),            // c4
    newHodAfter5(s5),            // c5
    newHodAfter5(pos15to5(s6)),  // c6
  ]
  const faded = c1Fired && c3Fired   // runner filter for time stats

  return {
    date, gapPct: daily.open / pdc - 1, g50: daily.open / pdc - 1 >= 0.5,
    open: daily.open, close: daily.close, high: daily.high, low: daily.low, pdc,
    realOpen: realDaily?.open ?? null, realClose: realDaily?.close ?? null, realHigh: realDaily?.high ?? null,
    pmh, rthHigh, rthLow, highTime, lowTime, faded, c,
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

  const spanDays = window === '1y' ? 375 : window === '2y' ? 740 : window === '5y' ? 1825 : 3650 // 'all' = ~10y daily
  const to = new Date()
  const from = new Date(to.getTime() - spanDays * 86400000)
  const fromAdj = new Date(from.getTime() - 10 * 86400000) // prevClose headroom
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  try {
    // ── STEP 1: daily (cheap) ──
    const [daily, dailyUnadj] = await Promise.all([
      fetchAggs(ticker, 1, 'day', fmt(fromAdj), fmt(to), true),
      fetchAggs(ticker, 1, 'day', fmt(fromAdj), fmt(to), false),
    ])
    if (daily.length < 2) return NextResponse.json({ error: `No daily history for ${ticker}` }, { status: 404 })

    const unadjByDate: Record<string, Bar> = {}
    for (const b of dailyUnadj) unadjByDate[etDate(b.time * 1000)] = b

    // ── STEP 2: detect gap dates from daily ──
    const gapMeta: { date: string; daily: Bar; pdc: number; realDaily: Bar | null }[] = []
    for (let i = 1; i < daily.length; i++) {
      const pdc = daily[i - 1].close
      if (pdc <= 0) continue
      if (daily[i].open / pdc - 1 < 0.20) continue
      const d = etDate(daily[i].time * 1000)
      // exclude today (partial session)
      if (d === etDate(Date.now())) continue
      gapMeta.push({ date: d, daily: daily[i], pdc, realDaily: unadjByDate[d] || null })
    }
    const gapDates = gapMeta.map(g => g.date)

    // ── STEP 3: fetch intraday ONLY for gap dates (smart) ──
    const [day5Map, day15Map] = await Promise.all([
      fetchDays(ticker, gapDates, 5, 'minute'),
      fetchDays(ticker, gapDates, 15, 'minute'),
    ])

    // ── STEP 4: per-day session-scoped indicators + analyze ──
    const gapDays: DayResult[] = []
    for (const g of gapMeta) {
      const d5 = day5Map.get(g.date) || [], d15 = day15Map.get(g.date) || []
      const rth5Raw: Bar[] = [], pre5: Bar[] = [], rth15Raw: Bar[] = []
      for (const b of d5) { const min = etMinOfDay(b.time * 1000); if (min >= RTH_OPEN_MIN && min < RTH_CLOSE_MIN) rth5Raw.push(b); else if (min < RTH_OPEN_MIN) pre5.push(b) }
      for (const b of d15) { const min = etMinOfDay(b.time * 1000); if (min >= RTH_OPEN_MIN && min < RTH_CLOSE_MIN) rth15Raw.push(b) }
      const vw5 = sessionVWAP(rth5Raw), e9 = emaArr(rth5Raw, 9), e20 = emaArr(rth5Raw, 20)
      const vw15 = sessionVWAP(rth15Raw)
      const rth5: S5[] = rth5Raw.map((b, i) => ({ bar: b, vwap: vw5[i] ?? null, ema9: e9[i] ?? null, ema20: e20[i] ?? null }))
      const rth15: S15[] = rth15Raw.map((b, i) => ({ bar: b, vwap: vw15[i] ?? null }))
      gapDays.push(analyzeDay(g.date, rth5, rth15, pre5, g.daily, g.pdc, g.realDaily))
    }
    gapDays.sort((a, b) => a.date < b.date ? 1 : -1)

    // ── aggregate (FADE-CENTRIC) ──
    const g50 = gapDays.filter(d => d.g50)
    const aggFor = (set: DayResult[]) => {
      const fadedSet = set.filter(d => d.faded)
      const fadeRate = set.filter(d => d.close < d.open).length / Math.max(1, set.length)
      const avgRange = set.reduce((s, d) => s + (d.high - d.low), 0) / Math.max(1, set.length)
      const htMin = fadedSet.filter(d => d.highTime).map(d => Number(d.highTime!.slice(0, 2)) * 60 + Number(d.highTime!.slice(3, 5)))
      const ltMin = fadedSet.filter(d => d.lowTime).map(d => Number(d.lowTime!.slice(0, 2)) * 60 + Number(d.lowTime!.slice(3, 5)))
      const pmhDays = set.filter(d => d.pmh != null && d.pmh > 0)
      const pmhBreak = pmhDays.filter(d => (d.rthHigh ?? -Infinity) > d.pmh!)
      const hh = set.map(d => Math.max(d.pmh ?? -Infinity, d.rthHigh ?? -Infinity))
      const fadeDepth = set.map((d, k) => hh[k] > 0 && (d.rthLow ?? 0) > 0 ? (hh[k] - (d.rthLow ?? 0)) / d.pdc : NaN).filter(v => !isNaN(v))
      const casc: Record<string, { fired: number; newHod: number; faded: number; newHodRate: number; fadeRate: number }> = {}
      for (let ci = 0; ci < 6; ci++) {
        const fired = set.filter(d => d.c[ci] !== null)
        const nh = fired.filter(d => d.c[ci] === true).length    // made new HOD (kept running)
        const fd = fired.filter(d => d.c[ci] === false).length   // NO new HOD (faded) ← the win
        casc[String(ci + 1)] = {
          fired: fired.length, newHod: nh, faded: fd,
          newHodRate: fired.length ? nh / fired.length : 0,
          fadeRate: fired.length ? fd / fired.length : 0,        // FADE-CENTRIC: 1 − newHodRate
        }
      }
      return {
        n: set.length, fadeRate, avgRange,
        avgHighTime: htMin.length ? fmtMin(htMin.reduce((a, b) => a + b, 0) / htMin.length) : null,
        medHighTime: htMin.length ? fmtMin(median(htMin)) : null,
        avgLowTime: ltMin.length ? fmtMin(ltMin.reduce((a, b) => a + b, 0) / ltMin.length) : null,
        medLowTime: ltMin.length ? fmtMin(median(ltMin)) : null,
        fadedN: fadedSet.length,
        pmhBreakFreq: pmhDays.length ? pmhBreak.length / pmhDays.length : 0,
        pmhBreakAvgPct: pmhBreak.length ? pmhBreak.reduce((s, d) => s + ((d.rthHigh ?? 0) / (d.pmh!) - 1), 0) / pmhBreak.length : 0,
        fadeDepthAvgPct: fadeDepth.length ? fadeDepth.reduce((a, b) => a + b, 0) / fadeDepth.length : 0,
        cascades: casc,
      }
    }

    const data = {
      ticker, window, asOf: new Date().toISOString(),
      count20: gapDays.length, count50: g50.length,
      agg20: aggFor(gapDays), agg50: aggFor(g50),
      days: gapDays,
    }
    memCache.set(cacheKey, { data, ts: Date.now() })
    spillCache()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'gap-stats failed' }, { status: 500 })
  }
}
