import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const row = await prisma.btKV.findUnique({ where: { key: 'rs-marks' } })
  return NextResponse.json(row ? JSON.parse(row.value) : { marks: [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  await prisma.btKV.upsert({
    where: { key: 'rs-marks' },
    update: { value: JSON.stringify(body) },
    create: { key: 'rs-marks', value: JSON.stringify(body) },
  })
  return NextResponse.json({ ok: true })
}
