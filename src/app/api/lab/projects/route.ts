import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'

// GET /api/lab/projects — list all projects for current user (or all if no auth)
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    const where: any = {}
    if (userId) where.userId = userId

    const projects = await prisma.strategyProject.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { entries: true, phases: true } },
        phases: { orderBy: { order: 'asc' } },
      },
    })
    return NextResponse.json({ projects })
  } catch (error: any) {
    console.error('Projects GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/lab/projects — create project with default phases
export async function POST(request: NextRequest) {
  try {
    const { name, description, type, tags, linkedScanId } = await request.json()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const userId = await getAuthUserId(request)

    const defaultPhases = [
      { phase: 'scan', label: 'Scan', order: 0 },
      { phase: 'setup', label: 'Setup', order: 1 },
      { phase: 'entry', label: 'Entry', order: 2 },
      { phase: 'exit', label: 'Exit', order: 3 },
      { phase: 'backtest', label: 'Backtest', order: 4 },
    ]

    const project = await prisma.strategyProject.create({
      data: {
        userId: userId || null,
        name,
        description: description || null,
        type: type || 'setup',
        tags: JSON.stringify(tags || []),
        linkedScanId: linkedScanId || null,
        phases: { create: defaultPhases },
      },
      include: { phases: { orderBy: { order: 'asc' } } },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error: any) {
    console.error('Projects POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/lab/projects?id=... — update project
export async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const data: any = {}
    for (const k of ['name', 'description', 'type', 'status', 'linkedScanId']) {
      if (body[k] !== undefined) data[k] = body[k]
    }
    if (body.tags) data.tags = JSON.stringify(body.tags)

    const project = await prisma.strategyProject.update({ where: { id }, data })
    return NextResponse.json({ project })
  } catch (error: any) {
    console.error('Projects PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/lab/projects?id=...
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    await prisma.strategyProject.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Projects DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
