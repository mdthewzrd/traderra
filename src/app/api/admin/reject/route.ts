import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { OWNER_EMAIL } from '@/lib/access'

/**
 * POST /api/admin/reject — reject a pending user.
 * Body: { userId }  Sets status='rejected'. The owner is protected.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { userId } = await request.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return NextResponse.json({ error: 'user not found' }, { status: 404 })
  if (target.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'cannot modify owner' }, { status: 403 })
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: 'rejected' },
  })
  return NextResponse.json({ ok: true })
}
