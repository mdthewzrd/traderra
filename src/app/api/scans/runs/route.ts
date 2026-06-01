import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/scans/runs?scanId=... — list runs for a scan
export async function GET(request: NextRequest) {
  try {
    const scanId = request.nextUrl.searchParams.get('scanId')
    if (!scanId) {
      return NextResponse.json({ error: 'scanId is required' }, { status: 400 })
    }

    const runs = await prisma.scanRun.findMany({
      where: { scanId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { signals: true } },
      },
    })

    return NextResponse.json({
      runs: runs.map(r => ({
        id: r.id,
        scanId: r.scanId,
        label: r.label,
        dateFrom: r.dateFrom,
        dateTo: r.dateTo,
        signalCount: r._count.signals,
        status: r.status,
        params: r.params ? JSON.parse(r.params) : null,
        createdAt: r.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Runs GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/scans/runs — create a new run
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scanId, label, dateFrom, dateTo, signalCount, status, params } = body

    if (!scanId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: 'scanId, dateFrom, dateTo are required' }, { status: 400 })
    }

    const run = await prisma.scanRun.create({
      data: {
        scanId,
        label: label || `${dateFrom} – ${dateTo}`,
        dateFrom,
        dateTo,
        signalCount: signalCount || 0,
        status: status || 'completed',
        params: params ? JSON.stringify(params) : null,
      },
    })

    return NextResponse.json({ run }, { status: 201 })
  } catch (error: any) {
    console.error('Runs POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/scans/runs?id=... — delete a run and its signals
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Delete signals first (cascade should handle, but explicit is safer for SQLite)
    await prisma.scanSignal.deleteMany({ where: { runId: id } })
    await prisma.scanRun.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Runs DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
