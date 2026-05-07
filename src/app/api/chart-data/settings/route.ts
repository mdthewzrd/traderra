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

// GET /api/chart-data/settings
export async function GET(req: Request) {
  const userId = await getAuth(req)
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
  const userId = await getAuth(req)
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
