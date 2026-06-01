import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/scans/columns?scanId=... — list custom columns for a scan
export async function GET(request: NextRequest) {
  try {
    const scanId = request.nextUrl.searchParams.get('scanId')
    if (!scanId) {
      return NextResponse.json({ error: 'scanId is required' }, { status: 400 })
    }

    const columns = await prisma.scanCustomColumn.findMany({
      where: { scanId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({
      columns: columns.map(c => ({
        ...c,
        // parsed from JSON strings
      })),
    })
  } catch (error: any) {
    console.error('Columns GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/scans/columns — create a custom column
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scanId, name, key, formula, format, colorExpr, order, isDefault } = body

    if (!scanId || !name || !key || !formula) {
      return NextResponse.json({ error: 'scanId, name, key, formula are required' }, { status: 400 })
    }

    const column = await prisma.scanCustomColumn.create({
      data: {
        scanId,
        name,
        key,
        formula,
        format: format || null,
        colorExpr: colorExpr || null,
        order: order || 0,
        isDefault: isDefault || false,
      },
    })

    return NextResponse.json({ column }, { status: 201 })
  } catch (error: any) {
    console.error('Columns POST error:', error)
    if (error.code === 'P2002') {
      return NextResponse.json({ error: `Column key "${body.key}" already exists for this scan` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/scans/columns?id=... — update a custom column
export async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const body = await request.json()
    const allowed = ['name', 'formula', 'format', 'colorExpr', 'order', 'isDefault']
    const data: any = {}

    for (const key of allowed) {
      if (body[key] !== undefined) {
        data[key] = body[key]
      }
    }

    const column = await prisma.scanCustomColumn.update({
      where: { id },
      data,
    })

    return NextResponse.json({ column })
  } catch (error: any) {
    console.error('Columns PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/scans/columns?id=... — delete a custom column
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.scanCustomColumn.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Columns DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
