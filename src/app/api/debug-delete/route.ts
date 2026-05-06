import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function DELETE() {
  try {
    const { userId } = auth()

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
