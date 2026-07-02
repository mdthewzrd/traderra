import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

// /api/database/views — saved CorpusView definitions (table/board/gallery + filters)

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const views = await prisma.corpusView.findMany({
    where: { userId, hidden: false },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ views })
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const view = await prisma.corpusView.create({
    data: {
      userId,
      name: body.name,
      type: body.type ?? 'table',
      filters: body.filters,
      groupBy: body.groupBy,
      sortBy: body.sortBy,
    },
  })
  return NextResponse.json({ view })
}

export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body
  const allowed = ['name', 'type', 'filters', 'groupBy', 'sortBy', 'hidden']
  const data: any = {}
  for (const k of allowed) if (k in fields) data[k] = fields[k]

  await prisma.corpusView.updateMany({ where: { id, userId }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.corpusView.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
