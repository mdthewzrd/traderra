import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uid, folderToApi, contentToApi, buildTree, seedDefaultFolder } from '@/lib/journal-api'

/**
 * /api/folders/[...path] — catch-all implementing the rest of the folderApi contract.
 * Folder IDs are cuids, so they never collide with the literal keywords below.
 *
 *   GET    tree | content | content/:cid | :fid | :fid/stats
 *   POST   content | content/trade-entry | content/bulk-move | content/:cid/move | :fid/move
 *   PUT    content/:cid | :fid
 *   DELETE content/:cid | :fid
 */
async function auth(req: NextRequest) {
  const userId = await uid(req)
  if (!userId) return null
  return userId
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const userId = await auth(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const seg = (await params).path

  // /tree
  if (seg.length === 1 && seg[0] === 'tree') {
    await seedDefaultFolder(userId)
    const folders = await prisma.folder.findMany({ where: { userId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
    const counts = await prisma.contentItem.groupBy({ by: ['folderId'], where: { userId, folderId: { not: null } }, _count: { _all: true } })
    const map = Object.fromEntries(counts.map(c => [c.folderId, c._count._all]))
    const totalContent = await prisma.contentItem.count({ where: { userId } })
    return NextResponse.json({ folders: buildTree(folders, map), total_folders: folders.length, total_content_items: totalContent })
  }

  // /content (list)
  if (seg.length === 1 && seg[0] === 'content') {
    const sp = req.nextUrl.searchParams
    const where: any = { userId }
    if (sp.get('folder_id')) where.folderId = sp.get('folder_id')
    if (sp.get('type')) where.type = sp.get('type')
    if (sp.get('search')) where.title = { contains: sp.get('search')!, mode: 'insensitive' }
    const tags = sp.get('tags')?.split(',').filter(Boolean)
    if (tags?.length) where.tags = { hasSome: tags }
    const limit = Math.min(Number(sp.get('limit') || 50), 200)
    const offset = Number(sp.get('offset') || 0)
    const [items, total] = await Promise.all([
      prisma.contentItem.findMany({ where, orderBy: { updatedAt: 'desc' }, take: limit, skip: offset, include: { folder: true } }),
      prisma.contentItem.count({ where }),
    ])
    const out = items.map(c => ({ ...contentToApi(c), folder_name: c.folder?.name, folder_icon: c.folder?.icon, folder_color: c.folder?.color }))
    return NextResponse.json({ items: out, total, limit, offset, has_more: offset + items.length < total })
  }

  // /content/:cid
  if (seg.length === 2 && seg[0] === 'content') {
    const c = await prisma.contentItem.findFirst({ where: { id: seg[1], userId }, include: { folder: true } })
    if (!c) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...contentToApi(c), folder_name: c.folder?.name, folder_icon: c.folder?.icon, folder_color: c.folder?.color })
  }

  // /:fid/stats
  if (seg.length === 2 && seg[1] === 'stats') {
    const folder = await prisma.folder.findFirst({ where: { id: seg[0], userId } })
    if (!folder) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    const items = await prisma.contentItem.findMany({ where: { folderId: seg[0], userId }, orderBy: { updatedAt: 'desc' }, take: 5 })
    const byType = await prisma.contentItem.groupBy({ by: ['type'], where: { folderId: seg[0], userId }, _count: { _all: true } })
    const tags = Array.from(new Set(items.flatMap(i => i.tags || [])))
    return NextResponse.json({
      folder_id: folder.id, folder_name: folder.name, content_count: items.length,
      content_types: Object.fromEntries(byType.map(t => [t.type, t._count._all])),
      recent_activity: items.map(contentToApi), tags,
    })
  }

  // /:fid
  if (seg.length === 1) {
    const f = await prisma.folder.findFirst({ where: { id: seg[0], userId } })
    if (!f) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    return NextResponse.json(folderToApi(f))
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const userId = await auth(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const seg = (await params).path
  const body = await req.json().catch(() => ({}))

  // /content (create)
  if (seg.length === 1 && seg[0] === 'content') {
    if (!body.title) return NextResponse.json({ detail: 'title required' }, { status: 400 })
    const c = await prisma.contentItem.create({
      data: { userId, folderId: body.folder_id || null, type: body.type || 'note', title: body.title, content: body.content ?? null, metadata: body.metadata ?? null, tags: body.tags || [] },
    })
    return NextResponse.json(contentToApi(c), { status: 201 })
  }

  // /content/trade-entry
  if (seg.length === 2 && seg[0] === 'content' && seg[1] === 'trade-entry') {
    const c = await prisma.contentItem.create({
      data: { userId, folderId: body.folder_id || null, type: 'trade_entry', title: body.title || 'Trade Entry', content: body.content ?? null, metadata: body.metadata ?? null, tags: body.tags || [] },
    })
    return NextResponse.json(contentToApi(c), { status: 201 })
  }

  // /content/bulk-move
  if (seg.length === 2 && seg[0] === 'content' && seg[1] === 'bulk-move') {
    const ids: string[] = body.content_item_ids || []
    const res = await prisma.contentItem.updateMany({ where: { id: { in: ids }, userId }, data: { folderId: body.folder_id || null } })
    return NextResponse.json({ message: 'moved', moved_count: res.count, target_folder_id: body.folder_id || null })
  }

  // /content/:cid/move
  if (seg.length === 3 && seg[0] === 'content' && seg[2] === 'move') {
    const c = await prisma.contentItem.updateMany({ where: { id: seg[1], userId }, data: { folderId: body.folder_id || null } })
    if (!c.count) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    const updated = await prisma.contentItem.findFirst({ where: { id: seg[1], userId } })
    return NextResponse.json(contentToApi(updated))
  }

  // /:fid/move
  if (seg.length === 2 && seg[1] === 'move') {
    const f = await prisma.folder.updateMany({ where: { id: seg[0], userId }, data: { parentId: body.new_parent_id || null, ...(body.new_position != null ? { position: body.new_position } : {}) } })
    if (!f.count) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    const updated = await prisma.folder.findFirst({ where: { id: seg[0], userId } })
    return NextResponse.json(folderToApi(updated))
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const userId = await auth(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const seg = (await params).path
  const body = await req.json().catch(() => ({}))

  // /content/:cid
  if (seg.length === 2 && seg[0] === 'content') {
    const data: any = {}
    if (body.title !== undefined) data.title = body.title
    if (body.type !== undefined) data.type = body.type
    if (body.content !== undefined) data.content = body.content
    if (body.metadata !== undefined) data.metadata = body.metadata
    if (body.tags !== undefined) data.tags = body.tags
    const r = await prisma.contentItem.updateMany({ where: { id: seg[1], userId }, data })
    if (!r.count) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    return NextResponse.json(contentToApi(await prisma.contentItem.findFirst({ where: { id: seg[1], userId } })))
  }

  // /:fid
  if (seg.length === 1) {
    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.icon !== undefined) data.icon = body.icon
    if (body.color !== undefined) data.color = body.color
    if (body.position !== undefined) data.position = body.position
    if (body.parent_id !== undefined) data.parentId = body.parent_id || null
    const r = await prisma.folder.updateMany({ where: { id: seg[0], userId }, data })
    if (!r.count) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
    return NextResponse.json(folderToApi(await prisma.folder.findFirst({ where: { id: seg[0], userId } })))
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const userId = await auth(req)
  if (!userId) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const seg = (await params).path
  const force = req.nextUrl.searchParams.get('force') === 'true'

  // /content/:cid
  if (seg.length === 2 && seg[0] === 'content') {
    await prisma.contentItem.deleteMany({ where: { id: seg[1], userId } })
    return NextResponse.json({ message: 'deleted', id: seg[1] })
  }

  // /:fid
  if (seg.length === 1) {
    // reassign children's content before delete (or wipe if force)
    if (force) {
      await prisma.contentItem.deleteMany({ where: { folderId: seg[0], userId } })
    } else {
      await prisma.contentItem.updateMany({ where: { folderId: seg[0], userId }, data: { folderId: null } })
    }
    // detach sub-folders to root
    await prisma.folder.updateMany({ where: { parentId: seg[0], userId }, data: { parentId: null } })
    await prisma.folder.deleteMany({ where: { id: seg[0], userId } })
    return NextResponse.json({ message: 'deleted', folder_id: seg[0] })
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 })
}
