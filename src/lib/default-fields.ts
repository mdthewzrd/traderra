import { prisma } from '@/lib/prisma'

// Sensible default custom columns seeded into every new (or field-less) database.
// Mirrors CorpusField's shape: { name, type, options, colors }. `order` is
// assigned sequentially, `id`/`userId`/`databaseId` by the caller.
export const DEFAULT_FIELDS = [
  { name: 'Personality', type: 'select', options: [] as string[], colors: null },
  { name: 'Notes', type: 'text', options: [] as string[], colors: null },
] as const

// Seed DEFAULT_FIELDS for a (userId, databaseId) only if none exist yet.
// Idempotent — returns the current field set afterwards. Used by the fields
// GET route (lazy seed) and the databases POST route (seed on create).
export async function seedDefaultFields(userId: string, databaseId: string) {
  const existing = await prisma.corpusField.count({ where: { userId, databaseId } })
  if (existing > 0) return // never overwrite a user's customized set

  const maxOrder = await prisma.corpusField.aggregate({
    where: { userId, databaseId },
    _max: { order: true },
  })
  let order = (maxOrder._max.order ?? -1) + 1
  await prisma.corpusField.createMany({
    data: DEFAULT_FIELDS.map((f) => ({
      userId,
      databaseId,
      name: f.name,
      type: f.type,
      options: f.options,
      colors: f.colors,
      order: order++,
    })),
  })
}
