import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * Watchlist CRUD — server persistence for chart watchlists.
 * Backs the ChartWatchlist Prisma model (previously a stub dir, never used).
 *
 * GET    /api/chart-data/watchlists          → list user's watchlists
 * POST   /api/chart-data/watchlists          → create watchlist { name, symbols?, columns? }
 */

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const lists = await prisma.chartWatchlist.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({
    lists: lists.map(l => ({
      id: l.id,
      name: l.name,
      symbols: safeParseArray(l.symbols),
      columns: safeParseObj(l.columns),
      meta: safeParseObj(l.meta),
      isDefault: l.isDefault,
    })),
  })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name || 'New List').slice(0, 60)
  const symbols = Array.isArray(body.symbols)
    ? body.symbols.map((s: any) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 500)
    : []

  // Cap total lists per user to avoid runaway growth
  const count = await prisma.chartWatchlist.count({ where: { userId } })
  if (count >= 50) return NextResponse.json({ error: 'limit reached (50 max)' }, { status: 429 })

  const created = await prisma.chartWatchlist.create({
    data: {
      userId,
      name,
      symbols: JSON.stringify(symbols),
    },
  })

  return NextResponse.json({
    list: {
      id: created.id,
      name: created.name,
      symbols,
      columns: {},
      isDefault: created.isDefault,
    },
  }, { status: 201 })
}

function safeParseArray(s: string | null | undefined): string[] {
  if (!s) return []
  try { const a = JSON.parse(s); return Array.isArray(a) ? a.map(x => String(x)) : [] } catch { return [] }
}
function safeParseObj(s: string | null | undefined): Record<string, any> {
  if (!s) return {}
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? o : {} } catch { return {} }
}
