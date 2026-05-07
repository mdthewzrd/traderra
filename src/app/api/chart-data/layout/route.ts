import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET /api/chart-data/layout
export async function GET(req: Request) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let layout = await prisma.chartLayout.findFirst({ where: { userId, isDefault: true } })
  if (!layout) layout = await prisma.chartLayout.findFirst({ where: { userId } })
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
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

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
    where: { id: body.id || `layout_${userId}_default` },
    create: { id: `layout_${userId}_default`, userId, name: 'default', ...data },
    update: data,
  })

  return NextResponse.json({ ok: true, id: layout.id })
}
