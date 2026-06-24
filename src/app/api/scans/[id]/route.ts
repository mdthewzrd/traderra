import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/scans/[id] — get full scan including results + code
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scan = await prisma.savedScan.findUnique({ where: { id } })

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }

    // Parse JSON fields
    return NextResponse.json({
      ...scan,
      dateRange: scan.dateRange ? JSON.parse(scan.dateRange) : null,
      results: JSON.parse(scan.results),
      tags: JSON.parse(scan.tags),
    })
  } catch (error: any) {
    console.error('Scan GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/scans/[id] — update scan (rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data: Record<string, any> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.tags !== undefined) data.tags = JSON.stringify(body.tags)
    const scan = await prisma.savedScan.update({ where: { id }, data })
    return NextResponse.json(scan)
  } catch (error: any) {
    console.error('Scan PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/scans/[id] — delete a saved scan
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scan = await prisma.savedScan.findUnique({ where: { id } })
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }
    await prisma.savedScan.delete({ where: { id } })
    return NextResponse.json({ deleted: id })
  } catch (error: any) {
    console.error('Scan DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
