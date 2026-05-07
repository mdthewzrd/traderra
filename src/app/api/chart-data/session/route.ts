import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// GET /api/chart-data/session — check auth status
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ authenticated: false })
    }

    return NextResponse.json({
      authenticated: true,
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      dbAvailable: true,
    })
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, error: e.message }, { status: 500 })
  }
}
