import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { TraderraTrade } from '@/utils/csv-parser'

// Force recompilation - debugging statistics dashboard data issue - update

// Mock trade data for development (updated with diverse 2025 dates including today)
const getMockTrades = (): TraderraTrade[] => {
  const today = new Date()
  const todayString = today.toISOString().split('T')[0] // Format: YYYY-MM-DD

  return [
    {
      id: 'trade-today-1',
      date: `${todayString}T10:30:00Z`,
      symbol: 'SPY',
      side: 'Long',
      quantity: 100,
      entryPrice: 450.25,
      exitPrice: 452.80,
      pnl: 255.00,
      pnlPercent: 0.57,
      commission: 1.50,
      duration: '2h 15m',
      strategy: 'Momentum',
      notes: 'Strong market open, captured the morning rally in SPY.',
      entryTime: '09:15:00',
      exitTime: '11:30:00',
      riskAmount: 200.00,
      riskPercent: 2.0,
      stopLoss: 448.00,
      rMultiple: 1.28,
      mfe: 3.20,
      mae: -0.75
    },
    {
      id: 'trade-1',
      date: '2025-11-29T14:30:00Z',
      symbol: 'NVDA',
      side: 'Long',
      quantity: 100,
      entryPrice: 485.50,
      exitPrice: 492.80,
      pnl: 730.00,
      pnlPercent: 1.50,
      commission: 2.00,
      duration: '45 minutes',
      strategy: 'Breakout',
      notes: 'Perfect AI sector breakout play. NVDA broke above key resistance at 485 with strong volume.',
      entryTime: '14:30:00',
      exitTime: '15:15:00',
      riskAmount: 100.00,
      riskPercent: 1.0,
      stopLoss: 480.00,
      rMultiple: 1.32,
      mfe: 8.50,
      mae: 0.80
    },
    {
      id: 'trade-2',
      date: '2025-11-28T10:15:00Z',
      symbol: 'TSLA',
      side: 'Long',
      quantity: 100,
      entryPrice: 248.20,
      exitPrice: 251.40,
      pnl: 320.00,
      pnlPercent: 1.29,
      commission: 2.00,
      duration: '15 minutes',
      strategy: 'Scalp',
      notes: 'Quick morning momentum scalp. TSLA showing strength on opening gap up.',
      entryTime: '10:15:00',
      exitTime: '10:30:00',
      riskAmount: 75.00,
      riskPercent: 0.75,
      stopLoss: 247.50,
      rMultiple: 4.27,
      mfe: 3.80,
      mae: 0.30
    },
    {
      id: 'trade-3',
      date: '2025-11-20T11:45:00Z',
      symbol: 'AAPL',
      side: 'Long',
      quantity: 100,
      entryPrice: 225.80,
      exitPrice: 224.20,
      pnl: -160.00,
      pnlPercent: -0.71,
      commission: 2.00,
      duration: '20 minutes',
      strategy: 'Breakout',
      notes: 'Failed breakout attempt. AAPL looked ready to break resistance at 226, but failed and reversed quickly.',
      entryTime: '11:45:00',
      exitTime: '12:05:00',
      riskAmount: 150.00,
      riskPercent: 1.5,
      stopLoss: 224.50,
      rMultiple: -1.07,
      mfe: 0.50,
      mae: -1.60
    },
    {
      id: 'trade-4',
      date: '2025-11-15T09:45:00Z',
      symbol: 'QQQ',
      side: 'Long',
      quantity: 150,
      entryPrice: 475.30,
      exitPrice: 478.90,
      pnl: 540.00,
      pnlPercent: 0.76,
      commission: 2.25,
      duration: '3h 20m',
      strategy: 'Swing',
      notes: 'Tech rally continuation, QQQ showed relative strength vs SPY.',
      entryTime: '09:45:00',
      exitTime: '13:05:00',
      riskAmount: 225.00,
      riskPercent: 2.2,
      stopLoss: 471.00,
      rMultiple: 2.40,
      mfe: 4.10,
      mae: -0.95
    },
    {
      id: 'trade-5',
      date: '2025-11-10T13:20:00Z',
      symbol: 'META',
      side: 'Short',
      quantity: 80,
      entryPrice: 325.40,
      exitPrice: 322.10,
      pnl: 264.00,
      pnlPercent: 1.01,
      commission: 2.00,
      duration: '1h 45m',
      strategy: 'Reversal',
      notes: 'Meta failed at resistance, good short setup with bearish divergence.',
      entryTime: '13:20:00',
      exitTime: '15:05:00',
      riskAmount: 120.00,
      riskPercent: 1.3,
      stopLoss: 328.00,
      rMultiple: 2.20,
      mfe: 3.80,
      mae: -0.60
    }
  ]
}

// GET /api/trades - Get all trades for the authenticated user
export async function GET(request: Request) {
  try {
    console.log('🔍 API /trades called - NODE_ENV:', process.env.NODE_ENV)

    const userId = await getAuthUserId(request)
    console.log('🔐 Auth check - userId:', userId ? `authenticated (${userId})` : 'not authenticated')

    // Parse URL for query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '1000')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Use authenticated userId, or fall back to default_user for demo mode
    const queryUserId = userId || 'default_user'

    // Get trades for the user with pagination
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where: { userId: queryUserId },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.trade.count({
        where: { userId: queryUserId }
      })
    ])

    console.log(`📊 Found ${trades.length} trades for user ${queryUserId} (total: ${total})`)

    return NextResponse.json({ trades, total })
  } catch (error) {
    console.error('Error fetching trades:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/trades - Save multiple trades for the authenticated user
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId(request)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trades }: { trades: TraderraTrade[] } = await request.json()

    if (!trades || !Array.isArray(trades)) {
      return NextResponse.json({ error: 'Invalid trades data' }, { status: 400 })
    }

    // Ensure user exists in database
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    })

    // Clear existing trades and insert new ones
    await prisma.trade.deleteMany({
      where: { userId }
    })

    // Convert TraderraTrade to database format and insert
    const dbTrades = trades.map((trade) => ({
      userId,
      id: trade.id,
      date: trade.date,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      commission: trade.commission,
      duration: trade.duration,
      strategy: trade.strategy,
      notes: trade.notes,
      entryTime: trade.entryTime,
      exitTime: trade.exitTime,
      riskAmount: trade.riskAmount,
      riskPercent: trade.riskPercent,
      stopLoss: trade.stopLoss,
      rMultiple: trade.rMultiple,
      mfe: trade.mfe,
      mae: trade.mae
    }))

    await prisma.trade.createMany({
      data: dbTrades
    })

    return NextResponse.json({
      message: 'Trades saved successfully',
      count: trades.length
    })
  } catch (error) {
    console.error('Error saving trades:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/trades - Delete all trades for the authenticated user
export async function DELETE() {
  try {
    console.log('🗑️ DELETE /api/trades called')
    const userId = await getAuthUserId(request)
    console.log('🔐 Auth userId:', userId)

    if (!userId) {
      console.log('❌ No userId found - unauthorized')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`📊 Attempting to delete all trades for user: ${userId}`)

    // Delete all trades for the user
    const deletedTrades = await prisma.trade.deleteMany({
      where: { userId }
    })

    console.log(`✅ Successfully deleted ${deletedTrades.count} trades for user ${userId}`)

    return NextResponse.json({
      message: 'All trades deleted successfully',
      deletedCount: deletedTrades.count
    })
  } catch (error) {
    console.error('❌ Error deleting trades:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}