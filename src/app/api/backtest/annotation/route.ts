import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// GET ?scanId=&ticker=&date=  → { note, labImage, tag } or null
// POST { scanId, ticker, signalDate, note?, labImage?, tag? }  → upsert
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const scanId = searchParams.get('scanId') || ''
  const ticker = searchParams.get('ticker') || ''
  const date = searchParams.get('date') || ''
  if (!scanId || !ticker || !date) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  const a = await prisma.backtestAnnotation.findUnique({
    where: { scanId_ticker_signalDate: { scanId, ticker, signalDate: date } },
  })
  return NextResponse.json(a || { note: '', labImage: null, tag: null })
}

export async function POST(req: NextRequest) {
  try {
    const { scanId, ticker, signalDate, note, labImage, tag } = await req.json()
    if (!scanId || !ticker || !signalDate) return NextResponse.json({ error: 'missing key' }, { status: 400 })
    const a = await prisma.backtestAnnotation.upsert({
      where: { scanId_ticker_signalDate: { scanId, ticker, signalDate } },
      create: { scanId, ticker, signalDate, note: note ?? '', labImage: labImage ?? null, tag: tag ?? null },
      update: {
        ...(note !== undefined ? { note } : {}),
        ...(labImage !== undefined ? { labImage } : {}),
        ...(tag !== undefined ? { tag } : {}),
      },
    })
    return NextResponse.json(a)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
