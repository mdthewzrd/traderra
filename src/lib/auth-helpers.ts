import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers as nextHeaders } from 'next/headers'
import { OWNER_EMAIL, isAdminRole } from '@/lib/access'

// Resolve userId for a request. NOTE: better-auth's getSession() via next/headers
// does NOT reliably resolve sessions in this app's route handlers (verified 401
// even with a fresh session cookie). So we read the token directly from either
// the Authorization header or the better-auth.session_token cookie, and look it
// up in the session table ourselves — the path proven to work.

// Extract the session token from Bearer header or better-auth cookie.
function extractTokenFromHeaders(h?: Headers | null): string | null {
  if (!h) return null
  const authHeader = h.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim()
  const cookie = h.get('cookie') || ''
  const m = cookie.match(/better-auth\.session_token=([^;\s]+)/)
  if (m) {
    // better-auth cookie format is "token.signature" — the session table
    // stores only the token half, so strip the signature suffix before lookup.
    let val = decodeURIComponent(m[1])
    const dot = val.indexOf('.')
    if (dot > 0) val = val.slice(0, dot)
    return val
  }
  return null
}

export async function getAuthUserId(request?: Request): Promise<string | null> {
  // 1. token from request headers
  let token = extractTokenFromHeaders(request?.headers ?? null)

  // 2. token from next/headers cookies (route-handler path)
  if (!token) {
    try { token = extractTokenFromHeaders(await nextHeaders()) } catch {}
  }

  // 3. look the token up in the session table
  if (token) {
    try {
      const session = await prisma.session.findFirst({ where: { token } })
      if (session && new Date(session.expiresAt) > new Date()) {
        return session.userId
      }
    } catch {}
  }

  // 4. last resort: try better-auth's getSession (kept for completeness)
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() })
    if (session?.user?.id) return session.user.id
  } catch {}

  return null
}

export interface CurrentUser {
  id: string
  email: string | null
  name: string | null
  role: string
  status: string
}

/**
 * Resolve the full current-user record (incl. role/status) for a request.
 * Auto-corrects OWNER_EMAIL to role:owner + status:approved so the owner can
 * never be locked out, even if the DB is reset.
 */
export async function getCurrentUser(request?: Request): Promise<CurrentUser | null> {
  const userId = await getAuthUserId(request)
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, status: true },
  })
  if (!user) return null
  if (user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    if (user.role !== 'owner' || user.status !== 'approved') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'owner', status: 'approved' },
      })
      user.role = 'owner'
      user.status = 'approved'
    }
  }
  return user
}

/** Require an approved admin-or-owner user. Returns the user or null. */
export async function requireAdmin(request?: Request): Promise<CurrentUser | null> {
  const user = await getCurrentUser(request)
  if (!user) return null
  if (!isAdminRole(user.role) || user.status !== 'approved') return null
  return user
}
