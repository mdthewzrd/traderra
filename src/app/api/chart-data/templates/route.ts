import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// GET /api/chart-data/templates
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const templates = await prisma.chartTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        tools: JSON.parse(t.tools),
        createdAt: t.createdAt,
      }))
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/chart-data/templates — upsert template
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { id, name, tools } = await req.json()

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const template = await prisma.chartTemplate.upsert({
      where: { id: id || `tpl_${Date.now()}` },
      create: { userId, name, tools: JSON.stringify(tools || []) },
      update: { name, tools: JSON.stringify(tools || []) },
    })

    return NextResponse.json({ ok: true, id: template.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/chart-data/templates?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await prisma.chartTemplate.deleteMany({ where: { id, userId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
