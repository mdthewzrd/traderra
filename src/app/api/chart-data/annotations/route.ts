import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// GET /api/chart-data/annotations?symbol=AAPL
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  const ann = await prisma.chartAnnotation.findUnique({ where: { userId_symbol: { userId, symbol } } })
  return NextResponse.json({ annotations: ann ? JSON.parse(ann.data) : [] })
}

// PUT /api/chart-data/annotations?symbol=AAPL
export async function PUT(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  const { data } = await req.json()

  await prisma.chartAnnotation.upsert({
    where: { userId_symbol: { userId, symbol } },
    create: { userId, symbol, data: JSON.stringify(data || []) },
    update: { data: JSON.stringify(data || []) },
  })

  return NextResponse.json({ ok: true })
}
