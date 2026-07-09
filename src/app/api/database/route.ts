import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'
import { getDatabaseId } from '@/lib/db-id'

// /api/database — CorpusRow CRUD (pre-trade pattern corpus)
// A row = one deduped scan hit (symbol+signalDate), human-classified into the playbook.

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dbId = await getDatabaseId(request, userId)
  const where: any = { userId, databaseId: dbId }

  if (searchParams.get('grade')) where.grade = searchParams.get('grade')
  if (searchParams.get('setupType')) where.setupType = searchParams.get('setupType')
  if (searchParams.get('scan')) where.scanSources = { has: searchParams.get('scan') }
  if (searchParams.get('status')) {
    where.status = searchParams.get('status')
  } else if (searchParams.get('archived') !== '1') {
    where.status = { not: 'archived' }
  }
  if (searchParams.get('symbol')) {
    where.symbol = { equals: searchParams.get('symbol') as string, mode: 'insensitive' }
  }

  const rows = await prisma.corpusRow.findMany({
    where,
    orderBy: { signalDate: 'desc' },
    take: Number(searchParams.get('limit') || 1000),
  })
  return NextResponse.json({ rows })
}

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbId = await getDatabaseId(request, userId)
  const body = await request.json()
  const data: any = {
    userId,
    databaseId: dbId,
    symbol: body.symbol,
    signalDate: body.signalDate,
    scanSources: Array.isArray(body.scanSources) ? body.scanSources : (body.scanSource ? [body.scanSource] : []),
    metrics: body.metrics,
  }
  const row = await prisma.corpusRow.create({ data })
  return NextResponse.json({ row })
}

export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body
  const allowed = [
    'setupType', 'setup', 'grade', 'move', 'tags', 'notes',
    'annotations', 'status', 'symbol', 'signalDate', 'customValues',
  ]
  const data: any = {}
  for (const k of allowed) if (k in fields) data[k] = fields[k]

  const row = await prisma.corpusRow.updateMany({ where: { id, userId }, data })
  if (row.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dbId = await getDatabaseId(request, userId)

  const { searchParams } = new URL(request.url)

  // Mode: clear all non-archived rows for this user
  if (searchParams.get('all')) {
    const r = await prisma.corpusRow.deleteMany({ where: { userId, databaseId: dbId, status: { not: 'archived' } } })
    return NextResponse.json({ ok: true, deleted: r.count })
  }

  // Mode: evict a single scan source from the corpus
  // (removes the scan from every row's scanSources; deletes rows left with no source)
  const scan = searchParams.get('scan')
  if (scan) {
    const hits = await prisma.corpusRow.findMany({
      where: { userId, databaseId: dbId, scanSources: { has: scan } },
      select: { id: true, scanSources: true },
    })
    let deleted = 0, updated = 0
    for (const h of hits) {
      const remaining = h.scanSources.filter((s) => s !== scan)
      if (remaining.length === 0) {
        await prisma.corpusRow.deleteMany({ where: { id: h.id, userId } })
        deleted++
      } else {
        await prisma.corpusRow.updateMany({ where: { id: h.id, userId }, data: { scanSources: remaining } })
        updated++
      }
    }
    return NextResponse.json({ ok: true, deleted, updated })
  }

  // Mode: single row by id
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const row = await prisma.corpusRow.deleteMany({ where: { id, userId } })
  if (row.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
