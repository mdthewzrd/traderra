import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

// POST — rename every review to the clean template title based on its
// metadata.reviewDate ("Daily Review - Mon D, YYYY" / "Weekly Review - ...").
// Idempotent. Original titles are preserved in content (prepended if missing).
// Optionally pass ?undo=imported to DELETE all reviews tagged 'imported'
// (the "oops, undo the import" path) instead of normalizing.
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const undo = url.searchParams.get('undo')

  if (undo === 'imported') {
    // Fetch then delete (Json tag filter is awkward across prisma versions).
    const all = await prisma.contentItem.findMany({
      where: { userId, type: 'review' },
      select: { id: true, tags: true },
    })
    const toDelete = all.filter((r) => Array.isArray(r.tags) && r.tags.includes('imported')).map((r) => r.id)
    if (toDelete.length) {
      await prisma.contentItem.deleteMany({ where: { id: { in: toDelete } } })
    }
    return NextResponse.json({ deleted: toDelete.length })
  }

  // Normalize titles.
  const all = await prisma.contentItem.findMany({
    where: { userId, type: 'review' },
    select: { id: true, title: true, content: true, metadata: true, tags: true },
  })

  let renamed = 0
  for (const r of all) {
    const meta = (r.metadata as any) || {}
    const date = meta.reviewDate
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const isWeekly = Array.isArray(r.tags) && r.tags.includes('weekly-review')
    const cleanTitle = isWeekly
      ? `Weekly Review - ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : `Daily Review - ${new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    if (r.title === cleanTitle) continue

    // Stash the old title at the top of content if it isn't already noted
    // (so provenance is never lost when we overwrite the title).
    const alreadyNoted = /Originally:|additional review/.test(r.content || '')
    const newContent = alreadyNoted || /^Daily Review|^Weekly Review/.test(r.title || '')
      ? r.content
      : `<p><em>Originally: "${(r.title || '').replace(/</g, '&lt;')}"</em></p>${r.content || ''}`

    await prisma.contentItem.update({
      where: { id: r.id },
      data: { title: cleanTitle, content: newContent },
    })
    renamed++
  }

  return NextResponse.json({ renamed, total: all.length })
}
