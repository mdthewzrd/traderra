import { NextRequest, NextResponse } from 'next/server'

// In-memory progress store — lives in the serverless function's process
// Key: `${spec}:${from}:${to}`, Value: progress object
const progressStore = new Map<string, {
  spec: string
  from: string
  to: string
  currentDay: string
  currentIndex: number
  totalDays: number
  signalsSoFar: number
  status: 'running' | 'done' | 'error'
  updatedAt: number
}>()

// Cleanup entries older than 30 minutes
function cleanup() {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [k, v] of progressStore) {
    if (v.updatedAt < cutoff) progressStore.delete(k)
  }
}

export async function POST(request: NextRequest) {
  cleanup()
  try {
    const body = await request.json()
    const { spec, from, to, currentDay, currentIndex, totalDays, signalsSoFar, status } = body
    const key = `${spec}:${from}:${to}`
    progressStore.set(key, {
      spec, from, to,
      currentDay: currentDay || '',
      currentIndex: currentIndex || 0,
      totalDays: totalDays || 0,
      signalsSoFar: signalsSoFar || 0,
      status: status || 'running',
      updatedAt: Date.now(),
    })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  cleanup()
  const url = request.nextUrl
  const spec = url.searchParams.get('spec')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  
  if (spec && from && to) {
    const key = `${spec}:${from}:${to}`
    const entry = progressStore.get(key)
    return NextResponse.json(entry || null)
  }
  
  // Return all active progress entries
  const all: any[] = []
  for (const [, v] of progressStore) {
    all.push(v)
  }
  return NextResponse.json({ progress: all })
}
