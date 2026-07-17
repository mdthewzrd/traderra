import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uid, contentToApi, seedDefaultFolder } from '@/lib/journal-api'

/**
 * POST /api/calendar/reviews/import
 * Body: { reviews: [{ date: 'YYYY-MM-DD', title?: string, content?: string }] }
 *
 * Bulk-import daily reviews (e.g. from a Notion markdown export). Idempotent by
 * date: if a review already exists for that date, its title + content are
 * updated; otherwise a new review is created. Returns a per-item result summary.
 */
export async function POST(req: NextRequest) {
  const userId = await uid(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  await seedDefaultFolder(userId)

  const body = await req.json().catch(() => ({}))
  const incoming = Array.isArray(body?.reviews) ? body.reviews : null
  if (!incoming) {
    return NextResponse.json({ detail: 'reviews[] required' }, { status: 400 })
  }

  // Load existing reviews once for idempotent upsert by date.
  const existing = await prisma.contentItem.findMany({ where: { userId, type: 'review' } })
  const byDate = new Map<string, string>()
  for (const it of existing) {
    const d = (it.metadata as any)?.reviewDate
    if (typeof d === 'string') byDate.set(d, it.id)
  }

  const results: { date: string; status: 'created' | 'updated' | 'skipped'; id?: string; error?: string }[] = []

  for (const r of incoming) {
    const date = typeof r?.date === 'string' ? r.date : null
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      results.push({ date: r?.date ?? '?', status: 'skipped', error: 'invalid date' })
      continue
    }
    const title = typeof r.title === 'string' && r.title.trim()
      ? r.title.trim().slice(0, 200)
      : `Daily Review - ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    const content = typeof r.content === 'string' ? r.content : ''

    try {
      const existingId = byDate.get(date)
      if (existingId) {
        await prisma.contentItem.update({
          where: { id: existingId },
          data: { title, content },
        })
        byDate.set(date, existingId)
        results.push({ date, status: 'updated', id: existingId })
      } else {
        const created = await prisma.contentItem.create({
          data: { userId, type: 'review', title, content, metadata: { reviewDate: date }, tags: ['calendar-linked'] },
        })
        byDate.set(date, created.id)
        results.push({ date, status: 'created', id: created.id })
      }
    } catch (e: any) {
      results.push({ date, status: 'skipped', error: e?.message || 'db error' })
    }
  }

  const created = results.filter((r) => r.status === 'created').length
  const updated = results.filter((r) => r.status === 'updated').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  return NextResponse.json({ created, updated, skipped, results })
}
