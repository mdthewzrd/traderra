import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Build the connection URL with pool params. Railway's Postgres URL has no
// query string (postgresql://user:pass@host:port/db), so appending '&'
// produces an invalid URL. Detect the separator.
function buildDbUrl(base: string | undefined): string | undefined {
  if (!base) return undefined
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}connection_limit=10&pool_timeout=30`
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: buildDbUrl(process.env.DATABASE_URL),
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
