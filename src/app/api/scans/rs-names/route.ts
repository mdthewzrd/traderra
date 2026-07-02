import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/scans/rs-names — "R/S Names" scan.
 *
 * Dilution-DB-derived: emits one signal per reverse-split FILING. The
 * reverse-split date is the setup anchor. Each row carries the offerings that
 * fired AFTER the split (the fade triggers), the cycle state, prior-split count,
 * and a nullable d1GapDate (joined from d1-gap* scans).
 *
 * Writes the result array to SavedScan.results (the store the scanner reads,
 * same model as eod-trig-day). No Python, no SEC calls at runtime.
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

  // 2. d1-gap* scan ids for the (nullable) d1GapDate join
  const d1Scans = await prisma.savedScan.findMany({
    where: { name: { contains: 'd1', mode: 'insensitive' } },
    select: { id: true },
  })
  const d1ScanIds = d1Scans.map((s) => s.id)

  // 3. Universe: reverse-split filings within lookback (the anchors)
  const rsFilings = await prisma.dilutionFiling.findMany({
    where: { dilutionTags: { has: 'reverse-split' }, filingDate: { gte: since } },
    include: { company: { select: { tickers: true, name: true } } },
    orderBy: { filingDate: 'asc' },
  })

  // 4. Gather ALL cycle-relevant filings per cik (splits + offerings) so each
  //    split can be paired with its subsequent offerings in one pass.
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

  // 5. Build the results array (shape matches the scanner's Signal interface)
  const results: any[] = []
  let postSplit = 0
  let offered = 0
  let dateMin: string | null = null
  let dateMax: string | null = null

  for (const split of rsFilings) {
    const ticker = (split.company?.tickers || [])[0]
    if (!ticker) continue
    const splitDate = split.filingDate.toISOString().slice(0, 10)
    if (!dateMin || splitDate < dateMin) dateMin = splitDate
    if (!dateMax || splitDate > dateMax) dateMax = splitDate

    const companyFilings = allByCik.get(split.cik) || []

    // offerings AFTER this split (the fade triggers)
    const offeringsSince = companyFilings
      .filter((f) => f.filingDate > split.filingDate && isOffering(f))
      .map((f) => ({
        date: f.filingDate.toISOString().slice(0, 10),
        formType: f.formType,
        type: (f.dilutionTags || []).find((t: string) => OFFERING_TAGS.includes(t)) || 'offering',
      }))

    // prior reverse-splits within 12mo before this one
    const yBefore = new Date(split.filingDate.getTime() - 365 * 86400000)
    const priorSplits12mo = companyFilings.filter(
      (f) =>
        (f.dilutionTags || []).includes('reverse-split') &&
        f.filingDate < split.filingDate &&
        f.filingDate >= yBefore
    ).length

    const state = offeringsSince.length ? 'offered' : 'post-split'
    if (state === 'post-split') postSplit++
    else offered++

    // ratio from rawPayload.reverseSplit if the sync stored it
    let rsRatio: string | null = null
    const rp = split.rawPayload as any
    if (rp && rp.reverseSplit && rp.reverseSplit.ratio) rsRatio = rp.reverseSplit.ratio

    // d1GapDate join — nullable (populates as d1-gap* scans run)
    let d1GapDate: string | null = null
    if (d1ScanIds.length) {
      const gap = await prisma.scanSignal.findFirst({
        where: { scanId: { in: d1ScanIds }, ticker, signalDate: { gt: splitDate } },
        orderBy: { signalDate: 'asc' },
        select: { signalDate: true },
      })
      d1GapDate = gap?.signalDate || null
    }

    results.push({
      ticker,
      symbol: ticker,
      date: splitDate,
      // No OHLCV — this is a filing event, not a price bar. Chart fetches its
      // own bars via /api/chart-data; these zeros are just structural.
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
      signal: state, // 'post-split' | 'offered' — filterable signal type
      // Dilution context (rides along as extra columns in the detail panel)
      rsRatio,
      priorSplits12mo,
      offeringsSince,
      offeringsCount: offeringsSince.length,
      state,
      d1GapDate,
      companyName: split.company?.name || null,
      cik: split.cik,
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
    dateRange: { from: dateMin, to: dateMax },
  })
}
