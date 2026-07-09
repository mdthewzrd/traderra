import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/scans/push — Push scan results from Renata agent to connected clients.
 * Stores in memory and broadcasts to SSE listeners.
 *
 * Body: { name: string, results: ScanResult[], spec?: string, meta?: object }
 */

interface PushedScan {
  id: string
  name: string
  results: any[]
  spec?: string
  meta?: any
  createdAt: number
}

// In-memory store for pushed scans (resets on server restart, that's fine)
const pushedScans: PushedScan[] = []

// SSE listeners
const listeners = new Set<(scan: PushedScan) => void>()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, results, spec, meta } = body

    if (!name || !Array.isArray(results)) {
      return NextResponse.json({ error: 'name and results[] required' }, { status: 400 })
    }

    const scan: PushedScan = {
      id: 'push-' + Date.now(),
      name,
      results,
      spec: spec || undefined,
      meta: meta || undefined,
      createdAt: Date.now(),
    }

    pushedScans.push(scan)

    // Persist live full-state snapshots to DB so names survive server restarts
    // and page reloads through end of day (fulfils "keep till tomorrow").
    // Only for live re-broadcasts (meta.fullState + spec); historical/agent
    // pushes are unaffected. Upsert one row per strategy, type='live'.
    if (scan.meta?.fullState && scan.spec) {
      try {
        const strat = scan.spec
        const dateRange = JSON.stringify({ from: new Date(scan.createdAt).toISOString().slice(0,10), to: new Date(scan.createdAt).toISOString().slice(0,10) })
        const existing = await prisma.savedScan.findFirst({ where: { strategy: strat, type: 'live' }, select: { id: true } })
        if (existing) {
          await prisma.savedScan.update({ where: { id: existing.id }, data: { name: scan.name, results: JSON.stringify(scan.results), resultCount: scan.results.length, dateRange } })
        } else {
          await prisma.savedScan.create({ data: { name: scan.name, type: 'live', strategy: strat, results: JSON.stringify(scan.results), resultCount: scan.results.length, dateRange } })
        }
      } catch {}
    }

    // Broadcast to all SSE listeners
    listeners.forEach(fn => fn(scan))

    return NextResponse.json({ ok: true, id: scan.id, count: results.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Return recent pushed scans (for polling fallback)
  const since = parseInt(req.nextUrl.searchParams.get('since') || '0')
  const recent = pushedScans.filter(s => s.createdAt > since)
  return NextResponse.json({ scans: recent })
}

// Export listeners for SSE stream route
export { pushedScans, listeners }
