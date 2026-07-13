import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/watchlist-quotes
 * body: { symbols: string[] }
 * → { quotes: { [SYM]: { last, chg, chgPct, vol } | null } }
 *
 * Live price for watchlist columns. Reuses the Polygon snapshot pattern
 * proven in src/lib/dilution/store.ts (last trade → quote → prev close).
 * Per-symbol failure → null so one dead ticker never breaks the batch.
 *
 * Capped at 60 symbols/request. In-memory cache 15s to absorb accidental
 * rapid refetches on focus.
 */

const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r'
const POLY_BASE = 'https://api.polygon.io'

const CACHE_TTL = 15_000
const cache = new Map<string, { data: any; ts: number }>()

interface Quote { last: number | null; chg: number | null; chgPct: number | null; vol: number | null }

async function fetchQuote(ticker: string): Promise<Quote | null> {
  try {
    const r = await fetch(
      `${POLY_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${POLY_KEY}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    )
    if (!r.ok) return null
    const j = (await r.json()) as {
      status?: string
      ticker?: {
        lastTrade?: { p?: number }
        lastQuote?: { P?: number }
        day?: { c?: number; v?: number }
        prevDay?: { c?: number }
      }
    }
    if (j.status !== 'OK' || !j.ticker) return null
    const t = j.ticker
    // During market hours day.c may be 0; fall back to last trade → quote → prev close.
    const last = t.day?.c || t.lastTrade?.p || t.lastQuote?.P || t.prevDay?.c || null
    const prevClose = t.prevDay?.c || null
    const vol = typeof t.day?.v === 'number' ? t.day!.v : null
    if (last == null || last <= 0) return null
    const chg = prevClose ? last - prevClose : null
    const chgPct = prevClose && prevClose > 0 ? (chg! / prevClose) * 100 : null
    return { last, chg, chgPct, vol }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const raw = Array.isArray(body.symbols) ? body.symbols : []
  const symbols = raw.map((s: any) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 60)

  const now = Date.now()
  const quotes: Record<string, Quote | null> = {}
  const toFetch: string[] = []

  for (const s of symbols) {
    const hit = cache.get(s)
    if (hit && now - hit.ts < CACHE_TTL) quotes[s] = hit.data
    else toFetch.push(s)
  }

  const results = await Promise.all(toFetch.map(async s => [s, await fetchQuote(s)] as const))
  for (const [s, q] of results) {
    cache.set(s, { data: q, ts: now })
    quotes[s] = q
  }

  return NextResponse.json({ quotes })
}
