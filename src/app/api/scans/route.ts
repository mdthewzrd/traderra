import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
// GET /api/scans — list all saved scans (optionally filter by userId or strategy)
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl
    const userId = url.searchParams.get('userId')
    const strategy = url.searchParams.get('strategy')

    const where: any = {}
    if (userId) where.userId = userId
    if (strategy) where.strategy = strategy

    const scans = await prisma.savedScan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        type: true,
        strategy: true,
        dateRange: true,
        filterMode: true,
        resultCount: true,
        cachedCount: true,
        cachedFrom: true,
        cachedTo: true,
        tags: true,
        notes: true,
        isFavorite: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { runs: true } },
        // intentionally omit code + results for list view
      },
    })

    return NextResponse.json({ scans: scans.map(s => ({ ...s, runCount: s._count.runs })) })
  } catch (error: any) {
    console.error('Scans GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/scans — create a new saved scan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      name,
      type = 'imported',
      strategy = 'custom',
      code,
      dateRange,
      filterMode = '3',
      results,
      tags,
      notes,
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const resultsArr = Array.isArray(results) ? results : []
    const dateRangeStr = dateRange ? JSON.stringify(dateRange) : null
    const tagsStr = JSON.stringify(tags || [])

    const scan = await prisma.savedScan.create({
      data: {
        userId: userId || null,
        name,
        type,
        strategy,
        code: code || null,
        dateRange: dateRangeStr,
        filterMode,
        results: JSON.stringify(resultsArr),
        resultCount: resultsArr.length,
        tags: tagsStr,
        notes: notes || null,
      },
    })

    return NextResponse.json({ scan }, { status: 201 })
  } catch (error: any) {
    console.error('Scans POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/scans?id=... — delete a saved scan
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.savedScan.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Scans DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/scans?id=... — update a saved scan (rename, update results, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const body = await request.json()
    const allowed = ['name', 'notes', 'tags', 'isFavorite', 'results', 'resultCount', 'filterMode']
    const data: any = {}

    for (const key of allowed) {
      if (body[key] !== undefined) {
        if (key === 'results') {
          data.results = JSON.stringify(body.results)
          data.resultCount = Array.isArray(body.results) ? body.results.length : 0
        } else if (key === 'tags') {
          data.tags = JSON.stringify(body.tags)
        } else {
          data[key] = body[key]
        }
      }
    }

    const scan = await prisma.savedScan.update({
      where: { id },
      data,
    })

    return NextResponse.json({ scan })
  } catch (error: any) {
    console.error('Scans PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
