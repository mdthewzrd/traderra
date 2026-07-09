import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'
import { ensureDatabases } from '@/lib/db-id'

// /api/database/databases — CorpusDatabase (workspace) CRUD.
// A workspace = an isolated collection of classified CorpusRows.
// Enums/Fields/Views stay shared (your vocabulary), only rows + their
// trades are partitioned per database.

// GET — list all databases for the user with row counts (auto-provisions Main).
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbs = await ensureDatabases(userId)
  const counts = await prisma.corpusRow.groupBy({
    by: ['databaseId'],
    where: { userId },
    _count: { _all: true },
  })
  const countMap: Record<string, number> = {}
  for (const c of counts) countMap[c.databaseId || '__orphan'] = c._count._all

  return NextResponse.json({
    databases: dbs.map((d) => ({ ...d, rowCount: countMap[d.id] || 0 })),
  })
}

// POST — create a database.
// Body: { name: string, duplicateFrom?: string }
//   - no duplicateFrom → empty new database
//   - duplicateFrom    → copy all rows + their trades from the source db
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = String(body.name || '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // reject duplicate names within the user
  const clash = await prisma.corpusDatabase.findFirst({ where: { userId, name } })
  if (clash) return NextResponse.json({ error: `A database named "${name}" already exists` }, { status: 409 })

  const sourceId = body.duplicateFrom ? String(body.duplicateFrom) : null

  const newDb = await prisma.corpusDatabase.create({ data: { userId, name } })

  if (sourceId) {
    // verify source belongs to user
    const src = await prisma.corpusDatabase.findFirst({ where: { id: sourceId, userId }, select: { id: true } })
    if (!src) {
      // roll back the empty db we just made
      await prisma.corpusDatabase.delete({ where: { id: newDb.id } })
      return NextResponse.json({ error: 'Source database not found' }, { status: 404 })
    }

    const rows = await prisma.corpusRow.findMany({ where: { databaseId: sourceId } })
    for (const r of rows) {
      const { id: _rid, databaseId: _d, createdAt: _ca, updatedAt: _ua, ...rest } = r
      const newRow = await prisma.corpusRow.create({
        data: { ...rest, databaseId: newDb.id },
      })
      const trades = await prisma.corpusTrade.findMany({ where: { setupRowId: r.id } })
      for (const t of trades) {
        const { id: _tid, setupRowId: _s, createdAt: _tca, updatedAt: _tua, ...trest } = t
        await prisma.corpusTrade.create({ data: { ...trest, setupRowId: newRow.id } })
      }
    }
  }

  return NextResponse.json({ database: newDb })
}

// PATCH — rename a database. Body: { id, name }
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id = String(body.id || '')
  const name = String(body.name || '').trim()
  if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 })

  const clash = await prisma.corpusDatabase.findFirst({ where: { userId, name, NOT: { id } } })
  if (clash) return NextResponse.json({ error: `A database named "${name}" already exists` }, { status: 409 })

  const res = await prisma.corpusDatabase.updateMany({ where: { id, userId }, data: { name } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a database and all its rows (cascade) + trades (cascade via row).
// Guards: never delete the user's last database.
export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const total = await prisma.corpusDatabase.count({ where: { userId } })
  if (total <= 1) return NextResponse.json({ error: 'Cannot delete your only database' }, { status: 400 })

  const r = await prisma.corpusDatabase.deleteMany({ where: { id, userId } })
  if (r.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
