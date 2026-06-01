import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const row = await prisma.btKV.findUnique({ where: { key: 'rs-marks' } })
    return NextResponse.json(row ? JSON.parse(row.value) : { marks: [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, marks: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await prisma.btKV.upsert({
      where: { key: 'rs-marks' },
      update: { value: JSON.stringify(body) },
      create: { key: 'rs-marks', value: JSON.stringify(body) },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
