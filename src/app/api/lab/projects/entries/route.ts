import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/lab/projects/entries?projectId=...&phaseId=...&type=...
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const projectId = url.searchParams.get('projectId')
    const phaseId = url.searchParams.get('phaseId')
    const type = url.searchParams.get('type')

    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const where: any = { projectId }
    if (phaseId) where.phaseId = phaseId
    if (type) where.type = type

    const entries = await prisma.projectEntry.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })

    // Parse meta JSON
    const parsed = entries.map(e => ({
      ...e,
      meta: e.meta ? JSON.parse(e.meta) : null,
    }))

    return NextResponse.json({ entries: parsed })
  } catch (error: any) {
    console.error('Entries GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/lab/projects/entries — create entry
export async function POST(request: NextRequest) {
  try {
    const { projectId, phaseId, parentId, type, title, body, imageData, meta, order } = await request.json()
    if (!projectId || !type) {
      return NextResponse.json({ error: 'projectId and type are required' }, { status: 400 })
    }

    // For screenshots, validate size (max ~5MB base64 ≈ 7M chars)
    if (imageData && imageData.length > 7_000_000) {
      return NextResponse.json({ error: 'Screenshot too large (max 5MB)' }, { status: 400 })
    }

    const entry = await prisma.projectEntry.create({
      data: {
        projectId,
        phaseId: phaseId || null,
        parentId: parentId || null,
        type,
        title: title || null,
        body: body || null,
        imageData: imageData || null,
        meta: meta ? JSON.stringify(meta) : null,
        order: order || 0,
      },
    })

    return NextResponse.json({ entry }, { status: 201 })
  } catch (error: any) {
    console.error('Entries POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/lab/projects/entries?id=... — update entry
export async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const data: any = {}
    for (const k of ['title', 'body', 'imageData', 'phaseId', 'order']) {
      if (body[k] !== undefined) data[k] = body[k]
    }
    if (body.meta) data.meta = JSON.stringify(body.meta)

    const entry = await prisma.projectEntry.update({ where: { id }, data })
    return NextResponse.json({ entry })
  } catch (error: any) {
    console.error('Entries PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/lab/projects/entries?id=...
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Also delete child comments
    await prisma.projectEntry.deleteMany({ where: { parentId: id } })
    await prisma.projectEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Entries DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
