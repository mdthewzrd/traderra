import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// GET ?scanId=&ticker=&date=        → single annotation { note, images[], tags[], strategy }
// GET ?scanId=&list=1               → ALL annotations for that scan (for tag filter / organization)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scanId = searchParams.get('scanId') || ''

  // list mode: return every annotation for the scan (lightweight)
  if (searchParams.get('list') === '1' && scanId) {
    const rows = await prisma.backtestAnnotation.findMany({
      where: { scanId },
      select: { ticker: true, signalDate: true, tags: true, strategy: true, note: true },
    })
    return NextResponse.json({ annotations: rows })
  }

  const ticker = searchParams.get('ticker') || ''
  const date = searchParams.get('date') || ''
  if (!scanId || !ticker || !date) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  const a = await prisma.backtestAnnotation.findUnique({
    where: { scanId_ticker_signalDate: { scanId, ticker, signalDate: date } },
  })
  return NextResponse.json(a || { note: '', images: [], tags: [], strategy: null })
}

// POST { scanId, strategy?, ticker, signalDate, note?, images?, tags? } → upsert
// Supports partial patches (only provided fields update). Arrays fully replace.
export async function POST(req: NextRequest) {
  try {
    const { scanId, strategy, ticker, signalDate, note, images, tags } = await req.json()
    if (!scanId || !ticker || !signalDate) return NextResponse.json({ error: 'missing key' }, { status: 400 })
    const a = await prisma.backtestAnnotation.upsert({
      where: { scanId_ticker_signalDate: { scanId, ticker, signalDate } },
      create: {
        scanId, strategy: strategy ?? null, ticker, signalDate,
        note: note ?? '', images: images ?? [], tags: tags ?? [],
      },
      update: {
        ...(strategy !== undefined ? { strategy } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(images !== undefined ? { images } : {}),
        ...(tags !== undefined ? { tags } : {}),
      },
    })
    return NextResponse.json(a)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
