import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
export async function DELETE() {
  try {
    const userId = await getAuthUserId(request)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`🗑️ DEBUG DELETE: Deleting all trades for user ${userId}`)

    const deletedTrades = await prisma.trade.deleteMany({
      where: { userId }
    })

    console.log(`✅ DEBUG DELETE: Deleted ${deletedTrades.count} trades`)

    return NextResponse.json({
      message: 'All trades deleted successfully',
      deletedCount: deletedTrades.count,
      userId
    })
  } catch (error) {
    console.error('❌ DEBUG DELETE Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
