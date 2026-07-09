import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { getDatabaseId } from '@/lib/db-id'
import { prisma } from '@/lib/prisma'

/**
 * GET  /api/database/backup          → download full JSON backup
 * POST /api/database/backup          → restore from JSON body { backup: {...} }
 *
 * Backup includes: CorpusRow, CorpusTrade, CorpusView, CorpusField, CorpusEnum.
 * Screenshots embedded as base64 inside trade.sections — fully self-contained.
 */
export async function GET(request: NextRequest) {
  const uid = await getAuthUserId(request)
  if (!uid) return NextResponse.json({ error: '401' }, { status: 401 })

  const dbId = await getDatabaseId(request, uid)
  const rows = await prisma.corpusRow.findMany({ where: { userId: uid, databaseId: dbId } })
  const rowIds = rows.map((r) => r.id)
  const [trades, views, fields, enums] = await Promise.all([
    prisma.corpusTrade.findMany({ where: { userId: uid, setupRowId: { in: rowIds } } }),
    prisma.corpusView.findMany({ where: { userId: uid } }),
    prisma.corpusField.findMany({ where: { userId: uid } }),
    prisma.corpusEnum.findMany({ where: { userId: uid } }),
  ])

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: uid,
    counts: { rows: rows.length, trades: trades.length, views: views.length, fields: fields.length, enums: enums.length },
    corpusRows: rows,
    corpusTrades: trades,
    corpusViews: views,
    corpusFields: fields,
    corpusEnums: enums,
  }

  // Return as a downloadable file
  const json = JSON.stringify(backup, null, 2)
  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="traderra-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}

export async function POST(request: NextRequest) {
  const uid = await getAuthUserId(request)
  if (!uid) return NextResponse.json({ error: '401' }, { status: 401 })

  try {
    const body = await request.json()
    const b = body.backup || body
    if (!b || !Array.isArray(b.corpusRows)) {
      return NextResponse.json({ error: 'Invalid backup format' }, { status: 400 })
    }

    // Restore affects ONLY the current database: wipe its rows (trades cascade),
    // then reinsert the backup's rows + trades here. Enums/Fields/Views are
    // shared across databases and left untouched.
    const dbId = await getDatabaseId(request, uid)
    await prisma.corpusRow.deleteMany({ where: { userId: uid, databaseId: dbId } })
    if (b.corpusRows?.length) await prisma.corpusRow.createMany({ data: b.corpusRows.map((r: any) => ({ ...r, userId: uid, databaseId: dbId })) })
    if (b.corpusTrades?.length) await prisma.corpusTrade.createMany({ data: b.corpusTrades.map((r: any) => ({ ...r, userId: uid })) })

    return NextResponse.json({ ok: true, restored: { rows: b.corpusRows?.length || 0, trades: b.corpusTrades?.length || 0 } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


