import { prisma } from '@/lib/prisma'

// Resolve the active CorpusDatabase for a request.
// Precedence: `x-db-id` header → `db` query param → user's first db
// (auto-creating "Main" + adopting orphan rows on first contact).
// All corpus-row queries should be scoped by the returned id so each
// workspace stays isolated.
export async function getDatabaseId(request: Request, userId: string): Promise<string> {
  let dbId: string | null = request.headers.get('x-db-id')

  if (!dbId) {
    try {
      const u = new URL(request.url)
      dbId = u.searchParams.get('db')
    } catch {}
  }

  if (dbId) {
    const owned = await prisma.corpusDatabase.findFirst({
      where: { id: dbId, userId },
      select: { id: true },
    })
    if (owned) return dbId
  }

  // Fallback: user's earliest database; provision Main if none exists.
  let db = await prisma.corpusDatabase.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  if (!db) {
    db = await prisma.corpusDatabase.create({ data: { userId, name: 'Main' } })
    // Adopt any pre-existing rows that predate the workspace model.
    await prisma.corpusRow.updateMany({
      where: { userId, databaseId: null },
      data: { databaseId: db.id },
    })
  }
  return db.id
}

// Ensure the user has at least one database (auto-provision Main). Returns all dbs.
export async function ensureDatabases(userId: string) {
  const existing = await prisma.corpusDatabase.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  if (existing.length === 0) {
    const main = await prisma.corpusDatabase.create({ data: { userId, name: 'Main' } })
    await prisma.corpusRow.updateMany({
      where: { userId, databaseId: null },
      data: { databaseId: main.id },
    })
    // Adopt any pre-workspace CorpusFields (databaseId null) into Main.
    await prisma.corpusField.updateMany({
      where: { userId, databaseId: null },
      data: { databaseId: main.id },
    })
    return [main]
  }
  // Self-heal: adopt orphans into the first db (covers edge cases).
  const orphanCount = await prisma.corpusRow.count({
    where: { userId, databaseId: null },
  })
  if (orphanCount > 0) {
    await prisma.corpusRow.updateMany({
      where: { userId, databaseId: null },
      data: { databaseId: existing[0].id },
    })
  }
  // One-time backfill: assign any legacy per-user CorpusFields to the
  // earliest database so they're preserved (not lost) under the per-db model.
  const orphanFields = await prisma.corpusField.count({
    where: { userId, databaseId: null },
  })
  if (orphanFields > 0) {
    await prisma.corpusField.updateMany({
      where: { userId, databaseId: null },
      data: { databaseId: existing[0].id },
    })
  }
  return existing
}
