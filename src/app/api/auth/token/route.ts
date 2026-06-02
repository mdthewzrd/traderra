import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * Returns a session token that the charts inline JS can use as Bearer token.
 * The charts-engine.js CloudStore reads from localStorage 'traderra-auth-token'.
 * This endpoint generates a token from the current cookie session.
 */
export async function GET() {
  try {
    const { auth } = await import('@/lib/auth')
    const hdrs = await headers()
    const session = await auth.api.getSession({ headers: hdrs })

    if (!session?.session?.token) {
      // Local dev bypass — return a dummy token
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({ token: 'local-dev-token' })
      }
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({ token: session.session.token })
  } catch (e: any) {
    // Local dev fallback if auth isn't configured
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ token: 'local-dev-token' })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
