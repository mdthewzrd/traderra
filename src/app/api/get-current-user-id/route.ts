import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Endpoint to get current authenticated user ID
export async function GET() {
  try {
    const { userId } = auth()

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({
      userId,
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