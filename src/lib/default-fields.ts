import { prisma } from '@/lib/prisma'

// Sensible default custom columns seeded into every new (or field-less) database.
// Mirrors CorpusField's shape: { name, type, options, colors }. `order` is
// assigned sequentially, `id`/`userId`/`databaseId` by the caller.
export const DEFAULT_FIELDS = [
  { name: 'Personality', type: 'select', options: [] as string[], colors: null },
  { name: 'Notes', type: 'text', options: [] as string[], colors: null },
] as const

// Seed DEFAULT_FIELDS for a (userId, databaseId) only if none exist yet.
// Idempotent — no-ops if the database already has fields, never overwrites a
// user's customized set. Used by the fields GET route (lazy seed) and the
// databases POST route (seed on create). Note: the count-check + createMany is
// not atomic, so concurrent first-opens could double-seed; this mirrors the
// existing orphan-adoption race in ensureDatabases and is acceptable for a
// single-user local-first app.
export async function seedDefaultFields(userId: string, databaseId: string) {
  const existing = await prisma.corpusField.count({ where: { userId, databaseId } })
  if (existing > 0) return // never overwrite a user's customized set

  await prisma.corpusField.createMany({
    data: DEFAULT_FIELDS.map((f, i) => ({
      userId,
      databaseId,
      name: f.name,
      type: f.type,
      options: f.options,
      colors: f.colors,
      order: i,
    })),
  })
}
