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
  // Dates that existed BEFORE this batch started. Reviews on these dates get
  // REPLACED (clean re-import semantics) — never merged/doubled.
  const preExistingDates = new Set<string>()
  for (const it of existing) {
    const d = (it.metadata as any)?.reviewDate
    if (typeof d === 'string') { byDate.set(d, it.id); preExistingDates.add(d) }
  }
  // Dates already processed in THIS batch. Used to detect within-batch
  // duplicates (two .md files, same date) — those merge into the just-created
  // review so neither is lost. Different from pre-existing (replace).
  const seenInBatch = new Set<string>()

  const results: { date: string; status: 'created' | 'updated' | 'merged' | 'skipped'; id?: string; error?: string }[] = []

  for (const r of incoming) {
    const date = typeof r?.date === 'string' ? r.date : null
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      results.push({ date: r?.date ?? '?', status: 'skipped', error: 'invalid date' })
      continue
    }
    const rawTitle = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 200) : ''
    const content = typeof r.content === 'string' ? r.content : ''
    const kind = (r.kind === 'daily' || r.kind === 'weekly' || r.kind === 'trade-review' || r.kind === 'setup-review') ? r.kind : 'daily'
    const isWeekly = kind === 'weekly'
    const importedAt = new Date().toISOString()
    // Only dailies + weeklies get the 'calendar-linked'/'weekly-review' tag.
    // Trade/setup reviews get their own tag so they don't pollute the calendar.
    const tags = kind === 'daily'
      ? ['calendar-linked', 'imported']
      : kind === 'weekly'
        ? ['weekly-review', 'imported']
        : [kind, 'imported']
    const titlePrefix = kind === 'daily' ? 'Daily Review' : kind === 'weekly' ? 'Weekly Review' : kind === 'trade-review' ? 'Trade Review' : 'Setup Review'
    const title = `${titlePrefix} - ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    // Prepend original title to content so nothing is lost.
    const finalContent = rawTitle && !/^Daily Review|^Weekly Review|^Trade Review|^Setup Review/.test(rawTitle)
      ? `<p><em>Originally: "${rawTitle.replace(/</g,'&lt;')}"</em></p>${content}`
      : content

    try {
      // Weeklies: dedup by date+title (never merge into dailies).
      let existingId: string | undefined
      if (isWeekly) {
        const wk = await prisma.contentItem.findFirst({ where: { userId, type: 'review', metadata: { path: ['reviewDate'], equals: date }, tags: { has: 'weekly-review' } } })
        existingId = wk?.id
      } else {
        existingId = byDate.get(date)
      }

      const wasPreExisting = preExistingDates.has(date)
      const isWithinBatchDup = !wasPreExisting && seenInBatch.has(date)

      if (existingId && isWithinBatchDup && !isWeekly) {
        // Two .md files in THIS batch share a date — merge so neither is lost.
        // (Calendar stays one-review-per-day, both originals preserved in text.)
        const cur = await prisma.contentItem.findUnique({ where: { id: existingId }, select: { title: true, content: true } })
        const divider = `<hr /><p><em>— additional review ("${rawTitle || 'untitled'}"):</em></p>`
        const mergedContent = `${cur?.content ?? ''}${divider}${finalContent}`
        await prisma.contentItem.update({ where: { id: existingId }, data: { content: mergedContent } })
        results.push({ date, status: 'merged', id: existingId })
      } else if (existingId) {
        // Pre-existing review on this date (from a PRIOR import) → REPLACE.
        // Preserve any structured sections the user may have filled in: if the
        // existing content is JSON {sections, legacyHtml}, only swap legacyHtml.
        const cur = await prisma.contentItem.findUnique({ where: { id: existingId }, select: { content: true } })
        let newContent: string
        if (typeof cur?.content === 'string' && cur.content.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(cur.content)
            if (parsed && typeof parsed === 'object' && parsed.sections) {
              parsed.legacyHtml = finalContent
              newContent = JSON.stringify(parsed)
            } else { newContent = finalContent }
          } catch { newContent = finalContent }
        } else {
          newContent = finalContent
        }
        await prisma.contentItem.update({ where: { id: existingId }, data: { title, content: newContent, tags, metadata: { reviewDate: date, importedAt, kind } } })
        results.push({ date, status: 'updated', id: existingId })
      } else {
        const created = await prisma.contentItem.create({
          data: { userId, type: 'review', title, content: finalContent, metadata: { reviewDate: date, importedAt, kind }, tags },
        })
        if (!isWeekly && kind === 'daily') { byDate.set(date, created.id); seenInBatch.add(date) }
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
