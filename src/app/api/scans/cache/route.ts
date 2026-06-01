import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// POST /api/scans/cache — upsert signals into the cache after a scan run
// Body: { scanId, signals[], scannedDates?, runLabel? }
// Creates a ScanRun record automatically
export async function POST(request: NextRequest) {
  try {
    const { scanId, signals, scannedDates, runLabel, runParams } = await request.json()

    if (!scanId || !Array.isArray(signals)) {
      return NextResponse.json({ error: 'scanId and signals[] required' }, { status: 400 })
    }

    let upserted = 0
    let skipped = 0
    let dateMin: string | null = null
    let dateMax: string | null = null

    for (const sig of signals) {
      const ticker = sig.ticker
      if (!ticker) { skipped++; continue }

      // Normalize the date to YYYY-MM-DD
      let signalDate = sig.date || sig.d1Date || sig.restDate || ''
      signalDate = String(signalDate).slice(0, 10)
      if (!signalDate || signalDate.length < 10) { skipped++; continue }

      // Track date range
      if (!dateMin || signalDate < dateMin) dateMin = signalDate
      if (!dateMax || signalDate > dateMax) dateMax = signalDate

      // Clean signal data — remove internal fields
      const cleanData = { ...sig }
      delete cleanData._cacheId

      try {
        await prisma.scanSignal.upsert({
          where: {
            scanId_ticker_signalDate: {
              scanId,
              ticker,
              signalDate,
            },
          },
          create: {
            scanId,
            ticker,
            signalDate,
            data: JSON.stringify(cleanData),
          },
          update: {
            data: JSON.stringify(cleanData),
          },
        })
        upserted++
      } catch (e: any) {
        // Skip duplicates gracefully
        skipped++
      }
    }

    // ── Create a ScanRun record ──
    let run = null
    if (dateMin && dateMax) {
      const label = runLabel || `${dateMin} – ${dateMax}`
      try {
        run = await prisma.scanRun.create({
          data: {
            scanId,
            label,
            dateFrom: dateMin,
            dateTo: dateMax,
            signalCount: upserted,
            status: 'completed',
            params: runParams ? JSON.stringify(runParams) : null,
          },
        })
      } catch(e) {
        console.warn('Failed to create ScanRun:', e)
      }
    }

    // Update scan metadata with new cached range
    const scan = await prisma.savedScan.findUnique({ where: { id: scanId } })
    if (scan) {
      const newFrom = scan.cachedFrom
        ? (dateMin && dateMin < scan.cachedFrom ? dateMin : scan.cachedFrom)
        : dateMin
      const newTo = scan.cachedTo
        ? (dateMax && dateMax > scan.cachedTo ? dateMax : scan.cachedTo)
        : dateMax

      // Count total cached signals
      const totalCached = await prisma.scanSignal.count({ where: { scanId } })

      await prisma.savedScan.update({
        where: { id: scanId },
        data: {
          cachedCount: totalCached,
          cachedFrom: newFrom,
          cachedTo: newTo,
          // Also update the latest-run fields for backward compat
          results: JSON.stringify(signals),
          resultCount: signals.length,
          dateRange: JSON.stringify({ from: dateMin, to: dateMax }),
        },
      })
    }

    // ── Record scanned dates (so we know which days have been checked) ──
    const datesToRecord = scannedDates || []
    // Also derive dates from signals
    const signalDates = new Set(signals.map(s => String(s.date || s.d1Date || s.restDate || '').slice(0, 10)).filter(d => d.length === 10))
    for (const d of datesToRecord) signalDates.add(d)
    
    for (const dateStr of signalDates) {
      if (!dateStr || dateStr.length < 10) continue
      try {
        await prisma.scannedDate.upsert({
          where: { scanId_date: { scanId, date: dateStr } },
          create: { scanId, date: dateStr },
          update: {},
        })
      } catch(e) {}
    }

    // Return updated stats
    const totalCached = await prisma.scanSignal.count({ where: { scanId } })

    return NextResponse.json({
      upserted,
      skipped,
      totalCached,
      run: run ? { id: run.id, label: run.label, dateFrom: run.dateFrom, dateTo: run.dateTo } : null,
    })
  } catch (error: any) {
    console.error('Cache POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
