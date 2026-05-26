import { NextRequest, NextResponse } from 'next/server'

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
