import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

const VALID_TYPES = ['text', 'number', 'select', 'multiselect', 'boolean', 'date', 'grade']

// GET — list this user's custom field definitions, ordered
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const fields = await prisma.corpusField.findMany({
    where: { userId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ fields })
}

// POST — create a new custom column
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, type, options, colors } = body
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid type. Valid: ${VALID_TYPES.join(', ')}` }, { status: 400 })
  }
  const opts: string[] = (type === 'select' || type === 'multiselect')
    ? Array.isArray(options) ? options.map(String).filter(Boolean) : []
    : []
  const colorMap = colors && typeof colors === 'object' ? colors : null

  const maxOrder = await prisma.corpusField.aggregate({
    where: { userId }, _max: { order: true },
  })
  const field = await prisma.corpusField.create({
    data: {
      userId,
      name: name.trim(),
      type,
      options: opts,
      colors: colorMap,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  })
  return NextResponse.json({ field })
}

// PATCH — rename, change options, reorder
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, name, options, colors } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const data: any = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (Array.isArray(options)) data.options = options.map(String).filter(Boolean)
  if (colors && typeof colors === 'object') data.colors = colors

  const field = await prisma.corpusField.updateMany({ where: { id, userId }, data })
  if (field.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a field definition. Also scrubs its value from every row's customValues.
export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // scrub the field's value from all customValues JSON blobs
  const rows = await prisma.corpusRow.findMany({
    where: { userId },
    select: { id: true, customValues: true },
  })
  for (const r of rows) {
    if (r.customValues && typeof r.customValues === 'object' && id in (r.customValues as object)) {
      const next = { ...(r.customValues as object) }
      delete (next as any)[id]
      await prisma.corpusRow.updateMany({ where: { id: r.id, userId }, data: { customValues: next } })
    }
  }

  await prisma.corpusField.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
