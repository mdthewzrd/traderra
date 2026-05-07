import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type AuthContext = { userId: string }

async function getAuth(req: Request): Promise<AuthContext | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (session?.user?.id) return { userId: session.user.id }
  } catch {}
  return null
}

// GET /api/chart-data/layout
export async function GET(req: Request) {
  const ctx = await getAuth(req)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let layout = await prisma.chartLayout.findFirst({ where: { userId: ctx.userId, isDefault: true } })
  if (!layout) layout = await prisma.chartLayout.findFirst({ where: { userId: ctx.userId } })
  if (!layout) return NextResponse.json({ layout: null })

  return NextResponse.json({
    layout: {
      id: layout.id,
      name: layout.name,
      tools: JSON.parse(layout.tools),
      preset: layout.preset,
      presetIndCustoms: JSON.parse(layout.presetIndCustoms || '{}'),
      chartSettings: JSON.parse(layout.chartSettings || '{}'),
      chartStyle: JSON.parse(layout.chartStyle || '{}'),
    }
  })
}

// PUT /api/chart-data/layout
export async function PUT(req: Request) {
  const ctx = await getAuth(req)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { tools, preset, presetIndCustoms, chartSettings, chartStyle } = body

  const data: any = {
    tools: JSON.stringify(tools || []),
    preset: preset || null,
    presetIndCustoms: JSON.stringify(presetIndCustoms || {}),
    chartSettings: JSON.stringify(chartSettings || {}),
    chartStyle: JSON.stringify(chartStyle || {}),
    isDefault: true,
  }

  const layout = await prisma.chartLayout.upsert({
    where: { id: body.id || `layout_${ctx.userId}_default` },
    create: { id: `layout_${ctx.userId}_default`, userId: ctx.userId, name: 'default', ...data },
    update: data,
  })

  return NextResponse.json({ ok: true, id: layout.id })
}
