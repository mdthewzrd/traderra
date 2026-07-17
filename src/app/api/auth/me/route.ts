import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'

/** GET /api/auth/me — current user's id, email, role, status (for client guards). */
export async function GET(request: Request) {
  const user = await getCurrentUser(request)
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({ user })
}
