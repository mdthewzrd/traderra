import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers as nextHeaders } from 'next/headers'

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
  if (m) return decodeURIComponent(m[1])
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
