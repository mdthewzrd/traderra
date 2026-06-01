import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/lab/projects/phases?projectId=...
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })

    const phases = await prisma.projectPhase.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: { _count: { select: { entries: true } } },
    })
    return NextResponse.json({ phases })
  } catch (error: any) {
    console.error('Phases GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/lab/projects/phases?id=... — update phase label/order
export async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = await request.json()
    const data: any = {}
    for (const k of ['label', 'order']) {
      if (body[k] !== undefined) data[k] = body[k]
    }

    const phase = await prisma.projectPhase.update({ where: { id }, data })
    return NextResponse.json({ phase })
  } catch (error: any) {
    console.error('Phases PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
