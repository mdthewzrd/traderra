import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Debug endpoint to check user ID mapping and trade counts
export async function GET() {
  try {
    // Get all users and their trade counts
    const usersWithTrades = await prisma.$queryRaw<Array<{
      userId: string;
      trade_count: bigint;
      first_trade: string;
      last_trade: string;
    }>>`
      SELECT
        userId,
        COUNT(*) as trade_count,
        MIN(date) as first_trade,
        MAX(date) as last_trade
      FROM Trade
      GROUP BY userId
      ORDER BY trade_count DESC
    `

    // Get total trades
    const totalTrades = await prisma.trade.count()

    // Get sample of recent trades
    const recentTrades = await prisma.trade.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      select: {
        userId: true,
        symbol: true,
        date: true,
        pnl: true,
        side: true
      }
    })

    return NextResponse.json({
      totalTrades,
      usersWithTrades: usersWithTrades.map(row => ({
        ...row,
        trade_count: Number(row.trade_count)
      })),
      recentTrades,
      databasePath: process.env.DATABASE_URL
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Debug endpoint error',
      message: error.message
    }, { status: 500 })
  }
}