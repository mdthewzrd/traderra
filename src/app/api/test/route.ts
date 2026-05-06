import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ test: 'success', timestamp: new Date().toISOString() })
}
