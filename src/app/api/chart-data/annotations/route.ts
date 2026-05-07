import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

// GET /api/chart-data/annotations?symbol=AAPL
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const symbol = req.nextUrl.searchParams.get('symbol')
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

    const ann = await prisma.chartAnnotation.findUnique({ where: { userId_symbol: { userId, symbol } } })

    return NextResponse.json({ annotations: ann ? JSON.parse(ann.data) : [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PUT /api/chart-data/annotations?symbol=AAPL
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const symbol = req.nextUrl.searchParams.get('symbol')
    if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

    const { data } = await req.json()

    const ann = await prisma.chartAnnotation.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol, data: JSON.stringify(data || []) },
      update: { data: JSON.stringify(data || []) },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
