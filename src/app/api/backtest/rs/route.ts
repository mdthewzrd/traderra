import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), '.backtest-rs.json')

export async function GET() {
  try {
    const data = fs.readFileSync(FILE, 'utf-8')
    return NextResponse.json(JSON.parse(data))
  } catch {
    return NextResponse.json({ marks: [] })
  }
}

export async function POST(req: NextRequest) {
  const { marks } = await req.json()
  fs.writeFileSync(FILE, JSON.stringify({ marks, updated: new Date().toISOString() }))
  return NextResponse.json({ ok: true })
}
