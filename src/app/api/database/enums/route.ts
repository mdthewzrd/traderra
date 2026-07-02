import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

// Default taxonomies — seeded into CorpusEnum on first access so the user can edit them.
const DEFAULTS: Record<string, { label: string; color?: string }[]> = {
  setupType: [
    'D1', 'FRD', 'Backside', 'LC FRD', 'Structure', 'Long',
  ].map((label) => ({ label })),
  setup: [
    'D1 Gap & Crap', 'D1 Dilutive', 'FRD-ET 2-leg', 'FRD-ET 1-leg', 'FRD-TB',
    'Backside Cont', 'Backside Reset', 'Backside Extreme', 'LC FRD ET', 'LC FRD TB',
    'Consolidation Sweep', 'Breakout', 'Breakdown', 'Uptrend Cont', 'Euphoric Low',
    'Euphoric Bottom', 'Trendbreak',
  ].map((label) => ({ label })),
  grade: [
    { label: 'A+', color: '#34d399' },
    { label: 'A', color: '#D4AF37' },
    { label: 'B', color: '#f59e0b' },
  ],
  trendStage: [
    { label: 'Euphoric Top', color: '#ef4444' },
    { label: 'Trendbreak', color: '#f59e0b' },
    { label: 'Backside', color: '#3b82f6' },
    { label: 'Continuation', color: '#14b8a6' },
    { label: 'Reclaim', color: '#34d399' },
  ],
  move: [], // user-defined cycle names — links scans into one move
  routeStart: [], // user-defined: where a trade route starts
  routeEnd: [],   // user-defined: where a trade route ends
}

// GET — all managed enums for this user, seeded with defaults if missing
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.corpusEnum.findMany({ where: { userId } })
  const have = new Set(existing.map((e) => e.key))
  const out: Record<string, { label: string; color?: string }[]> = {}
  for (const [key, seed] of Object.entries(DEFAULTS)) {
    const rec = existing.find((e) => e.key === key)
    out[key] = rec ? (rec.options as any) : seed
  }
  return NextResponse.json({ enums: out })
}

// PUT — replace the full option list for a key (upsert)
export async function PUT(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, options } = await request.json()
  if (!key || typeof key !== 'string') return NextResponse.json({ error: 'key required' }, { status: 400 })
  if (!Array.isArray(options)) return NextResponse.json({ error: 'options must be an array' }, { status: 400 })

  const clean = options
    .map((o: any) => (typeof o === 'string' ? { label: o } : { label: String(o?.label ?? ''), color: o?.color }))
    .filter((o: any) => o.label)

  await prisma.corpusEnum.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, options: clean },
    update: { options: clean },
  })
  return NextResponse.json({ ok: true, options: clean })
}
