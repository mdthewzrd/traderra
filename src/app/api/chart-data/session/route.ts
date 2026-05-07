import { NextResponse } from "next/server"
import { getAuthUserId } from "@/lib/auth-helpers"

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId(request)

    // Also try cookie session for same-origin
    if (!userId) {
      const { auth } = await import("@/lib/auth")
      try {
        const session = await auth.api.getSession({ headers: request.headers })
        if (session?.user?.id) {
          return NextResponse.json({
            authenticated: true,
            userId: session.user.id,
            email: session.user.email,
            name: session.user.name,
            dbAvailable: true,
          })
        }
      } catch {}
    }

    if (!userId) {
      return NextResponse.json({ authenticated: false })
    }

    // Get user info via bearer token lookup
    const { prisma } = await import("@/lib/prisma")
    const user = await prisma.user.findUnique({ where: { id: userId } })

    return NextResponse.json({
      authenticated: true,
      userId,
      email: user?.email,
      name: user?.name,
      dbAvailable: true,
    })
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, error: e.message }, { status: 500 })
  }
}
