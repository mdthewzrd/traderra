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

  const results: { date: string; status: 'created' | 'updated' | 'merged' | 'skipped'; id?: string; error?: string }[] = []

  for (const r of incoming) {
    const date = typeof r?.date === 'string' ? r.date : null
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      results.push({ date: r?.date ?? '?', status: 'skipped', error: 'invalid date' })
      continue
    }
    const rawTitle = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 200) : ''
    const content = typeof r.content === 'string' ? r.content : ''
    const isWeekly = /weekly/i.test(rawTitle)
    const importedAt = new Date().toISOString()
    const tags = isWeekly ? ['weekly-review', 'imported'] : ['calendar-linked', 'imported']
    // ALWAYS use the clean 'Daily Review - <date>' title (matches the template).
    // The original Notion title is preserved in the content header for provenance.
    const title = isWeekly
      ? `Weekly Review - ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `Daily Review - ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    // Prepend original title to content so nothing is lost.
    const finalContent = rawTitle && !/^Daily Review|^Weekly Review/.test(rawTitle)
      ? `<p><em>Originally: "${rawTitle.replace(/</g,'&lt;')}"</em></p>${content}`
      : content

    try {
      // Weeklies: dedup by date+title (never merge into dailies).
      // Dailies: MERGE on duplicate date (concatenate content w/ divider) so
      // nothing is ever lost — calendar stays one-review-per-day.
      let existingId: string | undefined
      if (isWeekly) {
        const wk = await prisma.contentItem.findFirst({ where: { userId, type: 'review', metadata: { path: ['reviewDate'], equals: date }, tags: { has: 'weekly-review' } } })
        existingId = wk?.id
      } else {
        existingId = byDate.get(date)
      }

      if (existingId) {
        if (isWeekly) {
          await prisma.contentItem.update({ where: { id: existingId }, data: { title, content: finalContent, tags } })
          results.push({ date, status: 'updated', id: existingId })
        } else {
          const cur = await prisma.contentItem.findUnique({ where: { id: existingId }, select: { title: true, content: true } })
          const mergedTitle = title
          const divider = `<hr /><p><em>— additional review ("${rawTitle || 'untitled'}"):</em></p>`
          const mergedContent = `${cur?.content ?? ''}${divider}${finalContent}`
          await prisma.contentItem.update({ where: { id: existingId }, data: { title: mergedTitle, content: mergedContent, tags } })
          results.push({ date, status: 'merged', id: existingId })
        }
      } else {
        const created = await prisma.contentItem.create({
          data: { userId, type: 'review', title, content: finalContent, metadata: { reviewDate: date, importedAt }, tags },
        })
        if (!isWeekly) byDate.set(date, created.id)
        results.push({ date, status: 'created', id: created.id })
      }
    } catch (e: any) {
      results.push({ date, status: 'skipped', error: e?.message || 'db error' })
    }
  }

  const created = results.filter((r) => r.status === 'created').length
  const updated = results.filter((r) => r.status === 'updated').length
  const merged = results.filter((r) => r.status === 'merged').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  return NextResponse.json({ created, updated, merged, skipped, results })
}
