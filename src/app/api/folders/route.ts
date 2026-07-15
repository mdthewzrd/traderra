import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uid, folderToApi, seedDefaultFolder } from '@/lib/journal-api'

/**
 * /api/folders  — root
 *   GET    list folders for the session user (?parent_id=&include_content_count=)
 *   POST   create folder { name, parent_id?, icon?, color?, position? }
 */
export async function GET(request: NextRequest) {
  const userId = await uid(request)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  await seedDefaultFolder(userId)

  const sp = request.nextUrl.searchParams
  const parentId = sp.get('parent_id') || undefined
  const folders = await prisma.folder.findMany({
    where: { userId, ...(parentId ? { parentId } : {}) },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })

  let result: any[] = folders.map(folderToApi)
  if (sp.get('include_content_count') === 'true') {
    const counts = await prisma.contentItem.groupBy({
      by: ['folderId'], where: { userId, folderId: { not: null } },
      _count: { _all: true },
    })
    const map = Object.fromEntries(counts.map(c => [c.folderId, c._count._all]))
    result = result.map(f => ({ ...f, content_count: map[f.id] || 0 }))
  }
  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const userId = await uid(request)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (!body.name) return NextResponse.json({ detail: 'name required' }, { status: 400 })

  const folder = await prisma.folder.create({
    data: {
      userId,
      name: body.name,
      parentId: body.parent_id || null,
      icon: body.icon || 'folder',
      color: body.color || '#888',
      position: body.position ?? 0,
    },
  })
  return NextResponse.json(folderToApi(folder), { status: 201 })
}
