import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

/** GET /api/admin/pending — users awaiting approval (owner/admin only). */
export async function GET(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const pending = await prisma.user.findMany({
    where: { status: 'pending' },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ pending })
}
