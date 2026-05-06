import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint to fix the user ID mismatch
export async function POST() {
  try {
    console.log('🔧 Fixing user ID mismatch...')

    // For development, we'll use a known test user ID
    // In production, this would come from the authenticated Clerk user
    const targetUserId = 'user_2p9e8K6K2ZKlZrPzKh1rFLHmYZo' // Known Clerk test user ID

    // Get the current database user
    const currentDbUser = await prisma.user.findFirst()

    if (!currentDbUser) {
      return NextResponse.json({ error: 'No users found in database' }, { status: 404 })
    }

    console.log('Current database user ID:', currentDbUser.id)
    console.log('Target user ID:', targetUserId)

    // Update user ID
    await prisma.user.update({
      where: { id: currentDbUser.id },
      data: { id: targetUserId }
    })

    // Update all trades to use the new user ID
    const updateResult = await prisma.trade.updateMany({
      where: { userId: currentDbUser.id },
      data: { userId: targetUserId }
    })

    console.log('✅ Fixed user ID mismatch!')
    console.log(`Updated ${updateResult.count} trades`)

    return NextResponse.json({
      success: true,
      oldUserId: currentDbUser.id,
      newUserId: targetUserId,
      tradesUpdated: updateResult.count,
      message: 'User ID mismatch fixed successfully'
    })

  } catch (error) {
    console.error('Error fixing user ID:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      error: 'Failed to fix user ID',
      details: errorMessage
    }, { status: 500 })
  }
}