import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuth(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (session?.user?.id) return session.user.id
  } catch {}
  return null
}

// GET /api/chart-data/templates
export async function GET(req: Request) {
  const userId = await getAuth(req)
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
    }))
  })
}

// PUT /api/chart-data/templates
export async function PUT(req: Request) {
  const userId = await getAuth(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, name, tools } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const template = await prisma.chartTemplate.upsert({
    where: { id: id || `tpl_${Date.now()}` },
    create: { userId, name, tools: JSON.stringify(tools || []) },
    update: { name, tools: JSON.stringify(tools || []) },
  })

  return NextResponse.json({ ok: true, id: template.id })
}

// DELETE /api/chart-data/templates?id=xxx
export async function DELETE(req: NextRequest) {
  const userId = await getAuth(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.chartTemplate.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
