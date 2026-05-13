import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const { userId } = getAuthUserId(request)

    // Get trade counts for this user
    const tradeCount = userId ? await prisma.trade.count({
      where: { userId }
    }) : 0

    // Also check default_user
    const defaultUserCount = await prisma.trade.count({
      where: { userId: 'default_user' }
    })

    return NextResponse.json({
      authenticated: !!userId,
      userId: userId || null,
      tradeCount,
      defaultUserTradeCount: defaultUserCount,
      message: userId
        ? `You are authenticated as ${userId}. You have ${tradeCount} trades in the database.`
        : 'You are not authenticated. Using demo mode.'
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
