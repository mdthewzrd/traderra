import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
