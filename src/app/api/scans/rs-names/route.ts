import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/scans/rs-names — "R/S Names" scan.
 *
 * Dilution-DB-derived: emits one ScanSignal per reverse-split FILING. The
 * reverse-split date is the setup anchor (signalDate). Each row carries the
 * offerings that fired AFTER the split (the fade triggers), the cycle state,
 * prior-split count, and a nullable d1GapDate (joined from d1-gap* scans).
 *
 * No Python, no SEC calls at runtime — DB is source of truth.
 *
 * Query: ?lookback=24 (months)  ?mode=backfill|incremental
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
  const mode = sp.get('mode') || 'backfill'
  const since = new Date(Date.now() - lookbackMonths * 30 * 86400000)

  // 1. Find or create the R/S Names SavedScan (own scanSource)
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

  let upserted = 0
  const stats = { postSplit: 0, offered: 0 }

  // 5. For each split filing → compute cycle + upsert ScanSignal
  for (const split of rsFilings) {
    const ticker = (split.company?.tickers || [])[0]
    if (!ticker) continue
    const splitDate = split.filingDate.toISOString().slice(0, 10)
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
      (f) => (f.dilutionTags || []).includes('reverse-split') && f.filingDate < split.filingDate && f.filingDate >= yBefore
    ).length

    const state = offeringsSince.length ? 'offered' : 'post-split'

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

    const data = {
      rsFilingDate: splitDate,
      rsRatio,
      rsAccession: split.accessionNo,
      companyName: split.company?.name || null,
      offeringsSince,
      priorSplits12mo,
      state,
      d1GapDate,
    }

    await prisma.scanSignal.upsert({
      where: { scanId_ticker_signalDate: { scanId: scan.id, ticker, signalDate: splitDate } },
      create: { scanId: scan.id, ticker, signalDate: splitDate, data: JSON.stringify(data) },
      update: { data: JSON.stringify(data) },
    })
    upserted++
    if (state === 'post-split') stats.postSplit++
    else stats.offered++
  }

  // 6. Refresh SavedScan meta
  await prisma.savedScan.update({
    where: { id: scan.id },
    data: {
      resultCount: upserted,
      cachedCount: upserted,
      dateRange: JSON.stringify({
        from: since.toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      }),
    },
  })

  return NextResponse.json({
    ok: true,
    scanId: scan.id,
    name: 'R/S Names',
    mode,
    lookbackMonths,
    signals: upserted,
    postSplit: stats.postSplit,
    offered: stats.offered,
  })
}
