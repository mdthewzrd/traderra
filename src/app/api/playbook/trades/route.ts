import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

const DIRECTIONS = ['short', 'long']
const ALLOWED = ['symbol', 'direction', 'date', 'entryPrice', 'exitPrice', 'qty', 'grade', 'trendStage', 'routeStart', 'routeEnd', 'sections', 'notes']

// GET — list trades for a playbook. Required ?playbookId=
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const playbookId = searchParams.get('playbookId')
  if (!playbookId) return NextResponse.json({ error: 'playbookId required' }, { status: 400 })

  // verify ownership
  const owned = await prisma.playbook.findFirst({ where: { id: playbookId, userId }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const trades = await prisma.playbookTrade.findMany({
    where: { playbookId, userId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json({ trades })
}

// POST — create a trade on a playbook
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { playbookId, direction } = body
  if (!playbookId) return NextResponse.json({ error: 'playbookId required' }, { status: 400 })
  if (!DIRECTIONS.includes(direction)) return NextResponse.json({ error: 'direction must be short|long' }, { status: 400 })

  const owned = await prisma.playbook.findFirst({ where: { id: playbookId, userId }, select: { id: true } })
  if (!owned) return NextResponse.json({ error: 'Playbook not found' }, { status: 404 })

  const data: any = { userId, playbookId, direction }
  for (const k of ALLOWED) if (k in body && body[k] !== null && body[k] !== undefined) data[k] = body[k]

  const trade = await prisma.playbookTrade.create({ data })
  return NextResponse.json({ trade })
}

// PATCH — update a trade
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (fields.direction && !DIRECTIONS.includes(fields.direction))
    return NextResponse.json({ error: 'direction must be short|long' }, { status: 400 })

  const data: any = {}
  for (const k of ALLOWED) if (k in fields) data[k] = fields[k]

  const res = await prisma.playbookTrade.updateMany({ where: { id, userId }, data })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a trade
export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.playbookTrade.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
