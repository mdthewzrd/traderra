import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'

/**
 * Journal API helpers — folder + content item CRUD for /journal.
 * Secured by cookie auth (getAuthUserId). The client-sent user_id is ignored;
 * the real session user is always used. Responses are snake_case to match the
 * existing folderApi.ts client contract.
 */

export async function uid(request: Request): Promise<string | null> {
  return getAuthUserId(request)
}

export function folderToApi(f: any) {
  return {
    id: f.id, name: f.name, parent_id: f.parentId, user_id: f.userId,
    icon: f.icon, color: f.color, position: f.position,
    created_at: f.createdAt.toISOString(), updated_at: f.updatedAt.toISOString(),
  }
}

export function contentToApi(c: any) {
  return {
    id: c.id, folder_id: c.folderId, type: c.type, title: c.title,
    content: c.content ?? null, metadata: c.metadata ?? {},
    tags: c.tags ?? [], user_id: c.userId,
    created_at: c.createdAt.toISOString(), updated_at: c.updatedAt.toISOString(),
  }
}

// Build nested tree with content_count per folder.
export function buildTree(folders: any[], counts: Record<string, number>) {
  const byId = new Map(folders.map(f => [f.id, { ...folderToApi(f), children: [], content_count: counts[f.id] || 0 }]))
  const roots: any[] = []
  for (const f of folders) {
    const node = byId.get(f.id)!
    if (f.parentId && byId.has(f.parentId)) byId.get(f.parentId)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

// Ensure a first-time user has a default folder to work in.
export async function seedDefaultFolder(userId: string) {
  const count = await prisma.folder.count({ where: { userId } })
  if (count === 0) {
    await prisma.folder.create({
      data: { userId, name: 'Journal', icon: 'book', color: '#D4AF37', position: 0 },
    })
  }
}
