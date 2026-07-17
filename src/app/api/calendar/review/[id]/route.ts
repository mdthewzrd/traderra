import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uid, contentToApi } from '@/lib/journal-api'

/**
 * /api/calendar/review/[id]
 *   GET    → full review doc (with content)
 *   PUT    { title?, content?, tags? } → update, returns doc
 */
async function own(userId: string, id: string) {
  return prisma.contentItem.findFirst({ where: { id, userId, type: 'review' } })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await uid(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const item = await own(userId, id)
  if (!item) return NextResponse.json({ detail: 'not found' }, { status: 404 })
  return NextResponse.json(contentToApi(item))
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await uid(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const item = await own(userId, id)
  if (!item) return NextResponse.json({ detail: 'not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const updated = await prisma.contentItem.update({
    where: { id },
    data: {
      ...(typeof body.title === 'string' ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(Array.isArray(body.tags) ? { tags: body.tags } : {}),
    },
  })
  return NextResponse.json(contentToApi(updated))
}
