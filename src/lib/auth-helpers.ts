import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Get userId from either cookie session OR Authorization: Bearer <token>
export async function getAuthUserId(request: Request): Promise<string | null> {
  // Try cookie-based session first
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session?.user?.id) return session.user.id
  } catch {}

  // Try bearer token — look up session in DB
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).split('.')[0] // token is before the dot
    try {
      const session = await prisma.session.findUnique({ where: { token } })
      if (session && new Date(session.expiresAt) > new Date()) {
        return session.userId
      }
    } catch {}
  }

  return null
}
