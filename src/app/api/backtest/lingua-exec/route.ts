import { NextRequest, NextResponse } from 'next/server'
import { runLinguaExecBacktest, type LinguaExecParams, type LEBBar } from '@/lib/backtest/lingua-exec-bt'

/**
 * POST /api/backtest/lingua-exec
 * Body: { symbol, tf, from, to, params? }
 * Fetches OHLC bars from Polygon (same paginated route as the chart) and runs the
 * Lingua Exec engine server-side. Returns { trades, stats }.
 */
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r'
const POLY_BASE = 'https://api.polygon.io'

const TF_MAP: Record<string, { multiplier: number; timespan: string }> = {
  '1': { multiplier: 1, timespan: 'minute' }, '5': { multiplier: 5, timespan: 'minute' },
  '15': { multiplier: 15, timespan: 'minute' }, '30': { multiplier: 30, timespan: 'minute' },
  '60': { multiplier: 60, timespan: 'minute' }, '120': { multiplier: 120, timespan: 'minute' },
  '240': { multiplier: 240, timespan: 'minute' }, 'D': { multiplier: 1, timespan: 'day' },
  'W': { multiplier: 1, timespan: 'week' },
}

async function fetchBars(symbol: string, tf: string, from: string, to: string): Promise<LEBBar[]> {
  const { multiplier, timespan } = TF_MAP[tf] || { multiplier: 60, timespan: 'minute' }
  const all: any[] = []
  let nextUrl: string | null =
    `${POLY_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${POLY_KEY}`
  let pages = 0
  while (nextUrl && pages < 25) {
    const resp = await fetch(nextUrl)
    const data = await resp.json()
    if (data.status === 'ERROR') throw new Error(data.error || 'Polygon error')
    all.push(...(data.results || []))
    nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLY_KEY}` : null
    pages++
    if (nextUrl) await new Promise(r => setTimeout(r, 120))
  }
  return all.map(r => ({
    time: timespan === 'day' || timespan === 'week'
      ? new Date(r.t).toISOString().slice(0, 10)
      : Math.floor(r.t / 1000),
    open: r.o, high: r.h, low: r.l, close: r.c,
  }))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, tf = '60', from, to, params = {} } = body
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
    if (!from || !to) return NextResponse.json({ error: 'from and to required (YYYY-MM-DD)' }, { status: 400 })

    const bars = await fetchBars(symbol, tf, from, to)
    if (bars.length < 200) return NextResponse.json({ error: `Not enough bars (${bars.length}); widen the date range.`, bars: bars.length }, { status: 400 })

    const { trades, stats } = runLinguaExecBacktest(bars, params as LinguaExecParams)
    return NextResponse.json({ trades, stats, barCount: bars.length, range: { from, to, tf } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
