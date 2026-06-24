import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

// /api/lab/projects       — GET (list), POST (create)
// /api/lab/projects/[id]  — GET, PATCH, DELETE
// /api/lab/entries         — GET (list by project), POST (create)
// /api/lab/entries/[id]    — PATCH, DELETE

// ── Projects CRUD ──

export async function GET_projects(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const projects = await prisma.strategyProject.findMany({
    where: { userId },
    include: {
      phases: { orderBy: { order: 'asc' } },
      _count: { select: { entries: true, phases: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ projects })
}

export async function POST_project(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { name, type, description, linkedScanId } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  const project = await prisma.strategyProject.create({
    data: {
      userId,
      name: name.trim(),
      type: type || 'setup',
      description: description || '',
      linkedScanId: linkedScanId || null,
      phases: {
        create: [
          { phase: 'scan', label: 'Scan', order: 0 },
          { phase: 'setup', label: 'Setup', order: 1 },
          { phase: 'entry', label: 'Entry', order: 2 },
          { phase: 'exit', label: 'Exit', order: 3 },
          { phase: 'backtest', label: 'Backtest', order: 4 },
        ],
      },
    },
    include: {
      phases: { orderBy: { order: 'asc' } },
      _count: { select: { entries: true, phases: true } },
    },
  })

  return NextResponse.json({ project }, { status: 201 })
}

export async function PATCH_project(req: NextRequest, id: string) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()

  // Verify ownership
  const existing = await prisma.strategyProject.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const project = await prisma.strategyProject.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.linkedScanId !== undefined && { linkedScanId: body.linkedScanId }),
    },
    include: {
      phases: { orderBy: { order: 'asc' } },
      _count: { select: { entries: true, phases: true } },
    },
  })

  return NextResponse.json({ project })
}

export async function DELETE_project(req: NextRequest, id: string) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const existing = await prisma.strategyProject.findFirst({ where: { id, userId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.strategyProject.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}

// ── Entries CRUD ──

export async function GET_entries(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const url = new URL(req.url)
  const projectId = url.searchParams.get('projectId')
  const phaseId = url.searchParams.get('phaseId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // Verify ownership
  const project = await prisma.strategyProject.findFirst({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const where: any = { projectId }
  if (phaseId) where.phaseId = phaseId

  const entries = await prisma.projectEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ entries })
}

export async function POST_entry(req: NextRequest) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const { projectId, phaseId, parentId, type, title, body: content, imageData } = body

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  // Verify ownership
  const project = await prisma.strategyProject.findFirst({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const entry = await prisma.projectEntry.create({
    data: {
      projectId,
      phaseId: phaseId || null,
      parentId: parentId || null,
      type: type || 'note',
      title: title || 'Note',
      body: content || '',
      imageData: imageData || null,
    },
  })

  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH_entry(req: NextRequest, id: string) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()

  // Verify ownership via project
  const entry = await prisma.projectEntry.findUnique({ where: { id }, include: { project: true } })
  if (!entry || entry.project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.projectEntry.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { body: body.content }),
      ...(body.imageData !== undefined && { imageData: body.imageData }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.phaseId !== undefined && { phaseId: body.phaseId }),
    },
  })

  return NextResponse.json({ entry: updated })
}

export async function DELETE_entry(req: NextRequest, id: string) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const entry = await prisma.projectEntry.findUnique({ where: { id }, include: { project: true } })
  if (!entry || entry.project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.projectEntry.delete({ where: { id } })
  return NextResponse.json({ deleted: true })
}
