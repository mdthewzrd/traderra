import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// GET /api/chart-data/session — check auth status
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ authenticated: false })
    }
    // Try to connect to DB
    try {
      const { prisma } = await import('@/lib/prisma')
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: { id: userId },
      })
    } catch (dbErr) {
      // DB not available (no SQLite on Vercel) — return authenticated but no DB
      return NextResponse.json({ authenticated: true, userId, dbAvailable: false })
    }
    return NextResponse.json({ authenticated: true, userId, dbAvailable: true })
  } catch (e) {
    return NextResponse.json({ authenticated: false, error: String(e) }, { status: 500 })
  }
}
