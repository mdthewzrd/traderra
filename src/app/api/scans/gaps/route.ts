import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/scans/gaps?scanId=...&from=...&to=...
// Returns which trading days in the range have NOT been scanned yet
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const scanId = url.searchParams.get('scanId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if (!scanId || !from || !to) {
      return NextResponse.json({ error: 'scanId, from, to required' }, { status: 400 })
    }

    // Get all dates that have been scanned (regardless of signals)
    const scanned = await prisma.scannedDate.findMany({
      where: {
        scanId,
        date: { gte: from, lte: to },
      },
      select: { date: true },
    })
    const scannedDates = new Set(scanned.map(s => s.date))

    // Also get signal count for stats
    const signalCount = await prisma.scanSignal.count({
      where: {
        scanId,
        signalDate: { gte: from, lte: to },
      },
    })

    // Generate all trading days in range (Mon-Fri)
    const allDates: string[] = []
    const d = new Date(from + 'T12:00:00')
    const endDate = new Date(to + 'T12:00:00')
    while (d <= endDate) {
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        allDates.push(d.toISOString().slice(0, 10))
      }
      d.setDate(d.getDate() + 1)
    }

    const uncachedDates = allDates.filter(d => !scannedDates.has(d))

    // Compute contiguous ranges of uncached dates
    const ranges: Array<{ from: string; to: string }> = []
    if (uncachedDates.length > 0) {
      let rangeStart = uncachedDates[0]
      let prevDate = uncachedDates[0]
      for (let i = 1; i < uncachedDates.length; i++) {
        const curr = uncachedDates[i]
        const prev = new Date(prevDate + 'T12:00:00')
        const next = new Date(curr + 'T12:00:00')
        const diffDays = (next.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays > 3) {
          ranges.push({ from: rangeStart, to: prevDate })
          rangeStart = curr
        }
        prevDate = curr
      }
      ranges.push({ from: rangeStart, to: prevDate })
    }

    return NextResponse.json({
      scanId,
      requestedFrom: from,
      requestedTo: to,
      totalTradingDays: allDates.length,
      scannedDays: scannedDates.size,
      uncachedDays: uncachedDates.length,
      uncachedDates,
      ranges,
      signalsInRange: signalCount,
      fullyCached: uncachedDates.length === 0,
    })
  } catch (error: any) {
    console.error('Gaps GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
