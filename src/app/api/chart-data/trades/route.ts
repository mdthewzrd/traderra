export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/chart-data/trades — Proxy to Polygon.io for tick-level trade data.
 * Used for fake print validation. Only called when 1m analysis suggests a wick.
 *
 * Params: symbol, from (YYYY-MM-DD or nanosecond), to, limit (default 50000)
 */
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r'
const POLY_BASE = 'https://api.polygon.io'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const timestamp = searchParams.get('timestamp') // YYYY-MM-DD or nanosecond ts
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = searchParams.get('limit') || '50000'

  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  // Build Polygon trades URL
  // /v3/trades/{ticker}?timestamp=...&order=asc&limit=...
  const params = new URLSearchParams()
  params.set('order', 'asc')
  params.set('limit', limit)
  if (timestamp) params.set('timestamp', timestamp)

  // If from/to are nanosecond timestamps, use them
  // Polygon trades API accepts timestamp date or nanosecond
  const url = `${POLY_BASE}/v3/trades/${encodeURIComponent(symbol)}?${params}` +
    (from ? `&timestamp.gte=${from}` : '') +
    (to ? `&timestamp.lte=${to}` : '')

  try {
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${POLY_KEY}` },
      next: { revalidate: 3600 },
    })
    const data = await resp.json()

    if (data.status === 'ERROR') {
      return NextResponse.json({ error: data.error || 'Polygon error', trades: [] }, { status: 500 })
    }

    return NextResponse.json({
      trades: (data.results || []).map((t: any) => ({
        price: t.price,
        size: t.size,
        exchange: t.exchange,
        condition: t.conditions,  // array of condition codes
        timestamp: t.timestamp,   // nanosecond precision
      })),
      count: (data.results || []).length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, trades: [] }, { status: 500 })
  }
}
