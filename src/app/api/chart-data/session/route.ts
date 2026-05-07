import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ authenticated: false })
    }
    return NextResponse.json({ authenticated: true, userId, dbAvailable: false })
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, error: e.message }, { status: 500 })
  }
}
