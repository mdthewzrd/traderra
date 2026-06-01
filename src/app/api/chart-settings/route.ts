import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
// GET /api/chart-settings — load saved chart settings
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)

    // No auth? Return empty — chart will use localStorage
    if (!userId) {
      return NextResponse.json({ settings: null, source: 'local' })
    }

    // Ensure user exists in DB
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId },
    })

    if (user.chartSettings) {
      return NextResponse.json({
        settings: JSON.parse(user.chartSettings),
        source: 'cloud',
      })
    }

    return NextResponse.json({ settings: null, source: 'cloud' })
  } catch (error: any) {
    console.error('Chart settings GET error:', error)
    return NextResponse.json({ settings: null, source: 'error', error: error.message }, { status: 500 })
  }
}

// POST /api/chart-settings — save chart settings
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated — settings saved to browser only' }, { status: 401 })
    }

    const body = await request.json()

    // Validate it's a flat settings object
    if (typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid settings format' }, { status: 400 })
    }

    const json = JSON.stringify(body)

    await prisma.user.upsert({
      where: { id: userId },
      update: { chartSettings: json },
      create: { id: userId, chartSettings: json },
    })

    return NextResponse.json({ ok: true, source: 'cloud' })
  } catch (error: any) {
    console.error('Chart settings POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
