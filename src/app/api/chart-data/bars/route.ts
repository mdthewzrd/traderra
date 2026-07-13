import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/chart-data/bars — Proxy to Polygon.io for OHLCV data.
 * Moves API key server-side so it's not exposed in client JS.
 * In-memory cache: historical bars never change (past trading days are
 * immutable), so we cache aggressively. "Live" data (to >= today) gets a
 * short TTL; fully-historical ranges cache for an hour.
 */
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r'
const POLY_BASE = 'https://api.polygon.io'

// Module-level cache (persists across requests in pm2's long-running process)
const barCache = new Map<string, { data: any; ts: number }>()
const LIVE_TTL = 2 * 60 * 1000      // 2 min for data including today
const HIST_TTL = 60 * 60 * 1000     // 1 hr for fully-historical ranges

// Fix D: persist barCache to disk so pm2 restarts don't force cold Polygon
// reloads. Historical bars are immutable, so disk-cached entries within TTL
// serve instantly on the first request after restart.
const CACHE_FILE = join(process.cwd(), '.next', 'cache', 'bars-cache.json')
try {
  if (existsSync(CACHE_FILE)) {
    const entries = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    if (Array.isArray(entries)) for (const [k, v] of entries) barCache.set(k, v)
    console.log(`[bars] restored ${barCache.size} cached entries from disk`)
  }
} catch {}
let spillTimer: ReturnType<typeof setTimeout> | null = null
function spillCache() {
  if (spillTimer) clearTimeout(spillTimer)
  spillTimer = setTimeout(() => {
    try {
      mkdirSync(join(CACHE_FILE, '..'), { recursive: true })
      writeFileSync(CACHE_FILE, JSON.stringify([...barCache.entries()]))
    } catch {}
    spillTimer = null
  }, 5000) // debounce: one write per 5s burst
}

function tfToPolygon(tf: string): { multiplier: number; timespan: string } {
  const map: Record<string, { multiplier: number; timespan: string }> = {
    '1': { multiplier: 1, timespan: 'minute' },
    '2': { multiplier: 2, timespan: 'minute' },
    '5': { multiplier: 5, timespan: 'minute' },
    '15': { multiplier: 15, timespan: 'minute' },
    '30': { multiplier: 30, timespan: 'minute' },
    '60': { multiplier: 60, timespan: 'minute' },
    '120': { multiplier: 120, timespan: 'minute' },
    '240': { multiplier: 240, timespan: 'minute' },
    'D': { multiplier: 1, timespan: 'day' },
    'W': { multiplier: 1, timespan: 'week' },
    'M': { multiplier: 1, timespan: 'month' },
  }
  return map[tf] || { multiplier: 5, timespan: 'minute' }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  const tf = searchParams.get('tf') || '5'
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!symbol) {
    return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  }

  const { multiplier, timespan } = tfToPolygon(tf)

  // Default date range if not specified
  const toDate = to || new Date().toISOString().split('T')[0]
  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Cache key includes everything that affects the response
  const cacheKey = `${symbol}|${tf}|${fromDate}|${toDate}`
  const today = new Date().toISOString().slice(0, 10)
  const isLive = toDate >= today
  const ttl = isLive ? LIVE_TTL : HIST_TTL
  const hit = barCache.get(cacheKey)
  if (hit && Date.now() - hit.ts < ttl) {
    return NextResponse.json(hit.data)
  }

  try {
    // Paginated fetch — Polygon caps each response (~880 bars on this tier) and
    // returns a `next_url` for the remainder. Following it collects the full range;
    // without this, wide `from`/`to` windows silently truncate to the OLDEST chunk
    // (which is why a 220-day 1H request returned data ending in January, not today).
    const allResults: any[] = []
    let nextUrl: string | null =
      `${POLY_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${fromDate}/${toDate}?adjusted=true&sort=asc&limit=50000&apiKey=${POLY_KEY}`
    let pages = 0
    while (nextUrl && pages < 25) {
      const resp = await fetch(nextUrl)
      const data = await resp.json()
      if (data.status === 'ERROR') {
        return NextResponse.json({ error: data.error }, { status: 500 })
      }
      allResults.push(...(data.results || []))
      nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLY_KEY}` : null
      pages++
      // Respect free-tier rate limits between paginated calls
      if (nextUrl) await new Promise(r => setTimeout(r, 120))
    }

    // Normalize bars — convert Polygon ms timestamps to seconds for intraday,
    // or to date strings for daily+ (matching charts-engine.js convention)
    const bars = allResults.map((r: any) => ({
      time: timespan === 'day' || timespan === 'week' || timespan === 'month'
        ? new Date(r.t).toISOString().slice(0, 10)
        : Math.floor(r.t / 1000),
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
      vwap: r.vw,
      n: r.n,
    }))

    const payload = { bars, symbol, tf, pages }
    // store in cache
    barCache.set(cacheKey, { data: payload, ts: Date.now() })
    spillCache()
    // prevent unbounded growth — evict oldest entries past 400 keys
    if (barCache.size > 400) {
      const oldest = [...barCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
      if (oldest) barCache.delete(oldest[0])
    }
    return NextResponse.json(payload)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
