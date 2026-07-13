import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

/**
 * PUT    /api/chart-data/watchlists/[id]   → update name / symbols / columns
 * DELETE /api/chart-data/watchlists/[id]   → delete watchlist
 */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  // Verify ownership
  const existing = await prisma.chartWatchlist.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const data: any = {}
  if (typeof body.name === 'string') data.name = body.name.slice(0, 60)
  if (Array.isArray(body.symbols)) {
    data.symbols = JSON.stringify(
      body.symbols.map((s: any) => String(s).toUpperCase().trim()).filter(Boolean).slice(0, 500),
    )
  }
  if (body.columns !== undefined) {
    data.columns = JSON.stringify(body.columns ?? {})
  }
  if (body.meta !== undefined) {
    data.meta = JSON.stringify(body.meta ?? {})
  }

  const updated = await prisma.chartWatchlist.update({ where: { id }, data })
  return NextResponse.json({ ok: true, updatedAt: updated.updatedAt })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.chartWatchlist.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Never let the user delete their last list
  const count = await prisma.chartWatchlist.count({ where: { userId } })
  if (count <= 1) return NextResponse.json({ error: 'cannot delete last watchlist' }, { status: 400 })

  await prisma.chartWatchlist.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
