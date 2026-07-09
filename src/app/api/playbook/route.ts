import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

const STATUSES = ['idea', 'spec', 'scan-built', 'validated', 'live']
const ALLOWED = ['name', 'status', 'thesis', 'sections', 'setupType', 'tags', 'grade', 'category']

// GET — list all playbooks (summary fields only; sections fetched on open)
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  // single full playbook (incl. sections) — used when opening the editor
  if (id) {
    const playbook = await prisma.playbook.findFirst({ where: { id, userId } })
    if (!playbook) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ playbook })
  }

  const playbooks = await prisma.playbook.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true, name: true, status: true, thesis: true,
      setupType: true, tags: true, grade: true, category: true,
      createdAt: true, updatedAt: true,
    },
  })
  return NextResponse.json({ playbooks })
}

// POST — create a new playbook
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = (typeof body.name === 'string' && body.name.trim()) ? body.name.trim() : 'Untitled Strategy'
  const status = STATUSES.includes(body.status) ? body.status : 'idea'

  const data: any = { userId, name, status }
  for (const k of ALLOWED) if (k in body && body[k] !== undefined && k !== 'name' && k !== 'status') data[k] = body[k]

  const playbook = await prisma.playbook.create({ data })
  return NextResponse.json({ playbook })
}

// PATCH — update a playbook (full-section saves land here)
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (fields.status && !STATUSES.includes(fields.status))
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })

  const data: any = {}
  for (const k of ALLOWED) if (k in fields) data[k] = fields[k]

  const res = await prisma.playbook.updateMany({ where: { id, userId }, data })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// DELETE — remove a playbook
export async function DELETE(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.playbook.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
