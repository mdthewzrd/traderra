import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'
import { OWNER_EMAIL } from '@/lib/access'

/**
 * POST /api/admin/approve — approve a user.
 * Body: { userId, role? }  role defaults to 'user'. Owner role reserved for OWNER_EMAIL.
 * Only the owner can promote others to admin.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { userId, role } = await request.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  // Never demote the owner or hand out owner role
  if (target.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'cannot modify owner' }, { status: 403 })
  }

  const newRole = role === 'admin' && admin.role === 'owner' ? 'admin' : 'user'
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: 'approved', role: newRole },
    select: { id: true, email: true, name: true, role: true, status: true },
  })
  return NextResponse.json({ user: updated })
}
