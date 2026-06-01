import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_backtest_kv" (key TEXT PRIMARY KEY, value TEXT NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW())`)
    const rows: any[] = await prisma.$queryRaw`SELECT value FROM "_backtest_kv" WHERE key = 'rs-marks'`
    if (rows.length > 0) return NextResponse.json(JSON.parse(rows[0].value))
    return NextResponse.json({ marks: [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, marks: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const value = JSON.stringify(body)
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_backtest_kv" (key TEXT PRIMARY KEY, value TEXT NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW())`)
    await prisma.$executeRawUnsafe(`INSERT INTO "_backtest_kv" (key, value, "updatedAt") VALUES ('rs-marks', '${value.replace(/'/g, "''")}', NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
