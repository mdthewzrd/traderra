import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/scans/[id]/signals — get cached signals with optional date filter
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = request.nextUrl
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const where: any = { scanId: id }
    if (from || to) {
      where.signalDate = {}
      if (from) where.signalDate.gte = from
      if (to) where.signalDate.lte = to
    }
    // Support filtering by run
    const runId = url.searchParams.get('runId')
    if (runId) where.runId = runId

    const signals = await prisma.scanSignal.findMany({
      where,
      orderBy: { signalDate: 'desc' },
    })

    // Parse JSON data for each signal
    const results = signals.map(s => ({
      ...JSON.parse(s.data),
      _cacheId: s.id,
    }))

    // Get scan metadata for cached range
    const scan = await prisma.savedScan.findUnique({
      where: { id },
      select: { cachedCount: true, cachedFrom: true, cachedTo: true, name: true },
    })

    return NextResponse.json({
      signals: results,
      count: results.length,
      totalCached: scan?.cachedCount || 0,
      cachedFrom: scan?.cachedFrom || null,
      cachedTo: scan?.cachedTo || null,
      scanName: scan?.name || null,
    })
  } catch (error: any) {
    console.error('Signals GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
