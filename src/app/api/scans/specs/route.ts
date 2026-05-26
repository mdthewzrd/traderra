import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/scans/specs — list available scan specs (type='spec' in SavedScan)
 * POST /api/scans/specs — upload a new scan spec (YAML)
 * DELETE /api/scans/specs?name=... — delete a spec
 */

export async function GET() {
  try {
    const scans = await prisma.savedScan.findMany({
      where: { type: 'spec' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        strategy: true,
        code: true,
        tags: true,
        createdAt: true,
      },
    })
    // Parse tags and extract spec name from strategy field
    const specs = scans.map(s => ({
      id: s.id,
      name: s.name,
      spec: s.strategy,
      yaml: s.code || '',
      tags: JSON.parse(s.tags || '[]'),
      createdAt: s.createdAt,
    }))
    return NextResponse.json({ specs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, yaml, tags } = body
    if (!name || !yaml) {
      return NextResponse.json({ error: 'name and yaml required' }, { status: 400 })
    }

    // Upsert: if spec with same strategy name exists, update it
    const strategy = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()

    const existing = await prisma.savedScan.findFirst({
      where: { type: 'spec', strategy },
    })

    let scan
    if (existing) {
      scan = await prisma.savedScan.update({
        where: { id: existing.id },
        data: {
          name,
          code: yaml,
          tags: JSON.stringify(tags || ['spec']),
        },
      })
    } else {
      scan = await prisma.savedScan.create({
        data: {
          name,
          type: 'spec',
          strategy,
          code: yaml,
          tags: JSON.stringify(tags || ['spec']),
        },
      })
    }

    return NextResponse.json({ ok: true, id: scan.id, spec: strategy })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get('name')
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const strategy = name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
    const existing = await prisma.savedScan.findFirst({
      where: { type: 'spec', strategy },
    })
    if (existing) {
      await prisma.savedScan.delete({ where: { id: existing.id } })
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
