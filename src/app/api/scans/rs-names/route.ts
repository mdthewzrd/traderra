import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/scans/rs-names — "R/S Names" scan.
 *
 * Dilution-DB-derived: emits one signal per reverse-split FILING. The
 * reverse-split date is the setup anchor. Each row carries the offerings that
 * fired AFTER the split (the fade triggers), the cycle state, prior-split count,
 * and the documented gap day AFTER the split (joined from the d1-gap* scan
 * results blobs).
 *
 * Writes the result array to SavedScan.results (the store the scanner reads).
 * No Python, no SEC calls at runtime — DB + existing scan results are source of truth.
 *
 * Query: ?lookback=24 (months)
 */
const OFFERING_TAGS = ['shelf', 'atm', 'convertible', 'equity-line']

function isOffering(f: { dilutionTags: string[]; formType: string }): boolean {
  return (
    (f.dilutionTags || []).some((t) => OFFERING_TAGS.includes(t)) ||
    (f.formType || '').startsWith('424B5')
  )
}

/**
 * Cluster a CIK's reverse-split filings into distinct SPLIT EVENTS.
 * Multiple forms (DEF 14A + 8-K Item 5.03 + 8-A + 10-Q note) often reference
 * the SAME split and land within days of each other. Group filings within
 * `gapDays` into one event. Anchor = earliest filing date in the cluster
 * (effectiveDate is never populated in rawPayload — 0/902 — so filing date is
 * the best proxy). Ratio comes from whichever filing the body scanner parsed.
 */
function clusterSplits(
  filings: any[],
  gapDays = 30
): { anchor: Date; filings: any[]; ratio: string | null }[] {
  const sorted = [...filings].sort((a, b) => (a.filingDate < b.filingDate ? -1 : 1))
  const clusters: { anchor: Date; filings: any[]; ratio: string | null }[] = []
  for (const f of sorted) {
    const last = clusters[clusters.length - 1]
    if (last && (f.filingDate.getTime() - last.anchor.getTime()) / 86400000 <= gapDays) {
      last.filings.push(f)
      const rp = f.rawPayload as any
      if (!last.ratio && rp?.reverseSplit?.ratio) last.ratio = rp.reverseSplit.ratio
    } else {
      const rp = f.rawPayload as any
      clusters.push({
        anchor: f.filingDate,
        filings: [f],
        ratio: rp?.reverseSplit?.ratio || null,
      })
    }
  }
  return clusters
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const lookbackMonths = parseInt(sp.get('lookback') || '24', 10)
  const since = new Date(Date.now() - lookbackMonths * 30 * 86400000)

  // 1. Find or create the R/S Names SavedScan
  let scan = await prisma.savedScan.findFirst({ where: { strategy: 'r/s-names' } })
  if (!scan) {
    scan = await prisma.savedScan.create({
      data: {
        name: 'R/S Names',
        type: 'code',
        strategy: 'r/s-names',
        tags: JSON.stringify(['dilution', 'reverse-split']),
      },
    })
  }

  // 2. Load gap-day data from the d1-gap* scan RESULTS BLOBS (not ScanSignal,
  //    which is empty for these scans). Build ticker -> sorted gap-date list.
  //    Scan results store one row per gap event with {ticker, date, gap, pm_high,...}
  const GAP_STRATEGIES = ['d1-gap-potential', 'd1-gap-wide', 'd1-gap']
  const gapScans = await prisma.savedScan.findMany({
    where: { strategy: { in: GAP_STRATEGIES } },
    select: { strategy: true, results: true },
  })
  const gapByTicker = new Map<string, { date: string; gap: number | null; pmHigh: number | null }[]>()
  for (const g of gapScans) {
    if (!g.results) continue
    let arr: any[]
    try { arr = JSON.parse(g.results) } catch { continue }
    if (!Array.isArray(arr)) continue
    for (const r of arr) {
      const t = (r.ticker || '').toUpperCase().trim()
      if (!t || !r.date) continue
      const list = gapByTicker.get(t) || []
      list.push({ date: r.date, gap: r.gap ?? r.gap_pct ?? null, pmHigh: r.pm_high ?? null })
      gapByTicker.set(t, list)
    }
  }
  // sort each ticker's gaps ascending by date for fast lookup
  for (const list of gapByTicker.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1))

  // 3. Universe: reverse-split filings within lookback (the anchors)
  const rsFilings = await prisma.dilutionFiling.findMany({
    where: { dilutionTags: { has: 'reverse-split' }, filingDate: { gte: since } },
    include: { company: { select: { tickers: true, name: true } } },
    orderBy: { filingDate: 'asc' },
  })

  // 4. Gather ALL cycle-relevant filings per cik (splits + offerings) in one pass
  const ciks = [...new Set(rsFilings.map((f) => f.cik))]
  const allByCik = new Map<string, any[]>()
  if (ciks.length) {
    const allFilings = await prisma.dilutionFiling.findMany({
      where: {
        cik: { in: ciks },
        filingDate: { gte: since },
        OR: [
          { dilutionTags: { has: 'reverse-split' } },
          { dilutionTags: { has: 'shelf' } },
          { dilutionTags: { has: 'atm' } },
          { dilutionTags: { has: 'convertible' } },
          { dilutionTags: { has: 'equity-line' } },
          { formType: { startsWith: '424B5' } },
        ],
      },
      orderBy: { filingDate: 'asc' },
    })
    for (const f of allFilings) {
      const arr = allByCik.get(f.cik) || []
      arr.push(f)
      allByCik.set(f.cik, arr)
    }
  }

  // 5. Build the results array (shape matches the scanner's Signal interface).
  //    DE-DUP: cluster same-CIK RS filings within 30d into one SPLIT EVENT so a
  //    single real split isn't emitted as N rows (DEF14A + 8-K Item 5.03 + 8-A
  //    all reference the same event). Anchor = earliest filing date in cluster.
  const results: any[] = []
  let postSplit = 0
  let offered = 0
  let withGap = 0
  let dateMin: string | null = null
  let dateMax: string | null = null

  // Pre-cluster: group rsFilings by cik, then into 30d events.
  const rsByCik = new Map<string, any[]>()
  for (const f of rsFilings) {
    const arr = rsByCik.get(f.cik) || []
    arr.push(f)
    rsByCik.set(f.cik, arr)
  }
  type Signal = { anchor: Date; cik: string; ticker: string; name: string | null; ratio: string | null }
  const signals: Signal[] = []
  for (const [cik, fils] of rsByCik) {
    const ticker = (fils[0]?.company?.tickers || [])[0]
    if (!ticker) continue
    const name = fils[0]?.company?.name || null
    for (const c of clusterSplits(fils)) {
      signals.push({ anchor: c.anchor, cik, ticker, name, ratio: c.ratio })
    }
  }
  signals.sort((a, b) => (a.anchor < b.anchor ? 1 : -1))

  for (const sig of signals) {
    const splitDate = sig.anchor.toISOString().slice(0, 10)
    if (!dateMin || splitDate < dateMin) dateMin = splitDate
    if (!dateMax || splitDate > dateMax) dateMax = splitDate

    const companyFilings = allByCik.get(sig.cik) || []

    // offerings AFTER this split event (the fade triggers)
    const offeringsSince = companyFilings
      .filter((f) => f.filingDate > sig.anchor && isOffering(f))
      .map((f) => ({
        date: f.filingDate.toISOString().slice(0, 10),
        formType: f.formType,
        type: (f.dilutionTags || []).find((t: string) => OFFERING_TAGS.includes(t)) || 'offering',
      }))

    // prior split EVENTS within 12mo before this one (clustered, not raw filings,
    // so a multi-form split counts once)
    const rsFilingsForCik = companyFilings.filter((f) =>
      (f.dilutionTags || []).includes('reverse-split')
    )
    const priorEvents = clusterSplits(rsFilingsForCik)
    const yBefore = new Date(sig.anchor.getTime() - 365 * 86400000)
    const priorSplits12mo = priorEvents.filter(
      (c) => c.anchor < sig.anchor && c.anchor >= yBefore
    ).length

    const state = offeringsSince.length ? 'offered' : 'post-split'
    if (state === 'post-split') postSplit++
    else offered++

    // gap-day join: earliest documented gap AFTER this split (from gap-scan results)
    let d1GapDate: string | null = null
    let d1GapPct: number | null = null
    const gaps = gapByTicker.get(sig.ticker)
    if (gaps) {
      const nextGap = gaps.find((g) => g.date > splitDate)
      if (nextGap) {
        d1GapDate = nextGap.date
        d1GapPct = nextGap.gap
        withGap++
      }
    }

    results.push({
      ticker: sig.ticker,
      symbol: sig.ticker,
      date: splitDate,
      // No OHLCV — filing event, not a price bar. Chart fetches its own bars.
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      signal: state, // 'post-split' | 'offered'
      rsRatio: sig.ratio,
      priorSplits12mo,
      offeringsSince,
      offeringsCount: offeringsSince.length,
      state,
      d1GapDate,
      d1GapPct,
      companyName: sig.name,
      cik: sig.cik,
    })
  }

  // newest split first (matches the scanner's default recency sort)
  results.sort((a, b) => (a.date < b.date ? 1 : -1))

  // 6. Persist to SavedScan.results (the store the scanner reads)
  await prisma.savedScan.update({
    where: { id: scan.id },
    data: {
      results: JSON.stringify(results),
      resultCount: results.length,
      cachedCount: results.length,
      dateRange: JSON.stringify({ from: dateMin, to: dateMax }),
    },
  })

  return NextResponse.json({
    ok: true,
    scanId: scan.id,
    name: 'R/S Names',
    lookbackMonths,
    signals: results.length,
    postSplit,
    offered,
    withGap, // how many rows have a documented post-split gap day
    dateRange: { from: dateMin, to: dateMax },
  })
}
