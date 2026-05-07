import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// GET /api/chart-data/settings
export async function GET() {
  try {
    const { userId } = await auth()
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
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/chart-data/settings
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()

    const settings = await prisma.chartUserSettings.upsert({
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
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
