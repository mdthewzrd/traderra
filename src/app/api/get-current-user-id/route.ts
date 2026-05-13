import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// Endpoint to get current authenticated user ID and email
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user data from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, image: true, createdAt: true }
    })

    return NextResponse.json({
      userId,
      email: user?.email || null,
      name: user?.name || null,
      image: user?.image || null,
      createdAt: user?.createdAt || null,
      message: 'Current authenticated user ID'
    })
  } catch (error) {
    console.error('Error getting user ID:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}