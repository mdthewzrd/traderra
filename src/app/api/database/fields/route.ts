import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'
import { getDatabaseId } from '@/lib/db-id'
import { seedDefaultFields } from '@/lib/default-fields'

const VALID_TYPES = ['text', 'number', 'select', 'multiselect', 'boolean', 'date', 'grade']

// Custom columns (CorpusField) are scoped per-database-per-user: each database
// owns its own editable column set. The active database is resolved from the
// `x-db-id` header / `db` param via getDatabaseId. On first access of a
// field-less database we lazily seed the default columns.

// GET — list this database's custom field definitions, ordered (seeds defaults if empty)
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const databaseId = await getDatabaseId(request, userId)

  // Lazy-seed sensible defaults the first time a database is opened.
  await seedDefaultFields(userId, databaseId)

  const fields = await prisma.corpusField.findMany({
    where: { userId, databaseId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ fields })
}

// POST — create a new custom column in the active database
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const databaseId = await getDatabaseId(request, userId)

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
    where: { userId, databaseId }, _max: { order: true },
  })
  const field = await prisma.corpusField.create({
    data: {
      userId,
      databaseId,
      name: name.trim(),
      type,
      options: opts,
      colors: colorMap,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  })
  return NextResponse.json({ field })
}

// PATCH — rename, change options, reorder (scoped to the active database)
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const databaseId = await getDatabaseId(request, userId)

  const body = await request.json()
  const { id, name, options, colors } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const data: any = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (Array.isArray(options)) data.options = options.map(String).filter(Boolean)
  if (colors && typeof colors === 'object') data.colors = colors

  const field = await prisma.corpusField.updateMany({ where: { id, userId, databaseId }, data })
  if (field.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a field definition from the active database. Also scrubs its
// value from that database's rows' customValues.
export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const databaseId = await getDatabaseId(request, userId)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // scrub the field's value from customValues JSON blobs of rows in this database
  const rows = await prisma.corpusRow.findMany({
    where: { userId, databaseId },
    select: { id: true, customValues: true },
  })
  for (const r of rows) {
    if (r.customValues && typeof r.customValues === 'object' && id in (r.customValues as object)) {
      const next = { ...(r.customValues as object) }
      delete (next as any)[id]
      await prisma.corpusRow.updateMany({ where: { id: r.id, userId }, data: { customValues: next } })
    }
  }

  await prisma.corpusField.deleteMany({ where: { id, userId, databaseId } })
  return NextResponse.json({ ok: true })
}
