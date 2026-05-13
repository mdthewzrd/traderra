import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

async function generateUniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = nanoid(8)
    const existing = await prisma.sharedItem.findUnique({ where: { slug } })
    if (!existing) return slug
  }
  throw new Error('Failed to generate unique slug')
}

// POST /api/shared — create a shared link
export async function POST(req: Request) {
  const userId = await getAuthUserId(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { type, sourceId, name, description } = await req.json()
    if (!type || !sourceId || !name) {
      return NextResponse.json({ error: 'type, sourceId, and name are required' }, { status: 400 })
    }

    if (!['template', 'scan', 'layout'].includes(type)) {
      return NextResponse.json({ error: 'type must be template, scan, or layout' }, { status: 400 })
    }

    // Rate limit: max 50 shared items per user
    const userShareCount = await prisma.sharedItem.count({ where: { userId } })
    if (userShareCount >= 50) {
      return NextResponse.json({ error: 'Share limit reached (50 max)' }, { status: 429 })
    }

    // Look up source item, verify ownership, snapshot data
    let data: any = {}

    if (type === 'template') {
      const tpl = await prisma.chartTemplate.findFirst({ where: { id: sourceId, userId } })
      if (!tpl) return NextResponse.json({ error: 'template not found or not owned' }, { status: 404 })
      data = { tools: JSON.parse(tpl.tools) }
    } else if (type === 'scan') {
      const scan = await prisma.savedScan.findFirst({ where: { id: sourceId, userId } })
      if (!scan) return NextResponse.json({ error: 'scan not found or not owned' }, { status: 404 })
      data = {
        type: scan.type,
        strategy: scan.strategy,
        code: scan.code,
        dateRange: scan.dateRange ? JSON.parse(scan.dateRange) : null,
        filterMode: scan.filterMode,
        tags: JSON.parse(scan.tags),
      }
    } else if (type === 'layout') {
      const layout = await prisma.chartLayout.findFirst({ where: { id: sourceId, userId } })
      if (!layout) return NextResponse.json({ error: 'layout not found or not owned' }, { status: 404 })
      data = {
        tools: JSON.parse(layout.tools),
        preset: layout.preset,
        chartSettings: JSON.parse(layout.chartSettings || '{}'),
      }
    }

    const slug = await generateUniqueSlug()

    const sharedItem = await prisma.sharedItem.create({
      data: {
        userId,
        type,
        sourceId,
        slug,
        name,
        description: description || null,
        data: JSON.stringify(data),
      },
    })

    return NextResponse.json({ ok: true, slug: sharedItem.slug, id: sharedItem.id })
  } catch (error: any) {
    console.error('Shared POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
