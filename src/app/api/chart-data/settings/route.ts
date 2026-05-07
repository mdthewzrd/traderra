import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET /api/chart-data/settings
export async function GET(req: Request) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const settings = await prisma.chartUserSettings.findUnique({ where: { userId } })
  if (!settings) return NextResponse.json({ settings: null })

  return NextResponse.json({
    settings: {
      drawDefaults: JSON.parse(settings.drawDefaults || '{}'),
      toolbarPosition: JSON.parse(settings.toolbarPosition || '{}'),
      theme: settings.theme || 'dark',
      themeColors: JSON.parse(settings.themeColors || '{}'),
      trackpadSettings: JSON.parse(settings.trackpadSettings || '{}'),
    }
  })
}

// PUT /api/chart-data/settings
export async function PUT(req: Request) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()

  await prisma.chartUserSettings.upsert({
    where: { userId },
    create: {
      userId,
      drawDefaults: JSON.stringify(body.drawDefaults || {}),
      toolbarPosition: JSON.stringify(body.toolbarPosition || {}),
      theme: body.theme || 'dark',
      themeColors: JSON.stringify(body.themeColors || {}),
      trackpadSettings: JSON.stringify(body.trackpadSettings || {}),
    },
    update: {
      drawDefaults: JSON.stringify(body.drawDefaults || {}),
      toolbarPosition: JSON.stringify(body.toolbarPosition || {}),
      theme: body.theme || 'dark',
      themeColors: JSON.stringify(body.themeColors || {}),
      trackpadSettings: JSON.stringify(body.trackpadSettings || {}),
    },
  })

  return NextResponse.json({ ok: true })
}
