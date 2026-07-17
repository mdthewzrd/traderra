import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uid, contentToApi, seedDefaultFolder } from '@/lib/journal-api'

/**
 * /api/calendar/reviews
 *   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD  → { reviews: { [dateKey]: {id,title,updated_at} } }
 *        Reviews are ContentItems with type='review' and metadata.reviewDate='YYYY-MM-DD'.
 *   POST { date, title? }  → create a daily-review doc for that date, returns full item.
 */
export async function GET(request: NextRequest) {
  const userId = await uid(request)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const from = sp.get('from')
  const to = sp.get('to')

  const items = await prisma.contentItem.findMany({
    where: { userId, type: 'review' },
    select: { id: true, title: true, metadata: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const map: Record<string, { id: string; title: string; updated_at: string }> = {}
  for (const it of items) {
    const meta = it.metadata as any
    const d = meta?.reviewDate
    if (!d || typeof d !== 'string') continue
    if (from && d < from) continue
    if (to && d > to) continue
    map[d] = { id: it.id, title: it.title, updated_at: it.updatedAt.toISOString() }
  }
  return NextResponse.json({ reviews: map })
}

export async function POST(request: NextRequest) {
  const userId = await uid(request)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  await seedDefaultFolder(userId)

  const body = await request.json().catch(() => ({}))
  const date = typeof body.date === 'string' ? body.date : null
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ detail: 'date (YYYY-MM-DD) required' }, { status: 400 })
  }

  // Reuse an existing review for this date if present (idempotent open).
  const candidates = await prisma.contentItem.findMany({ where: { userId, type: 'review' } })
  const found = candidates.find((c) => (c.metadata as any)?.reviewDate === date)
  if (found) return NextResponse.json(contentToApi(found))

  const pretty = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const created = await prisma.contentItem.create({
    data: {
      userId,
      type: 'review',
      title: body.title || `Daily Review - ${pretty}`,
      metadata: { reviewDate: date },
      tags: ['calendar-linked'],
    },
  })
  return NextResponse.json(contentToApi(created), { status: 201 })
}
