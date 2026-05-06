import { NextResponse } from 'next/server'

// Debug endpoint to test trades API without authentication
export async function GET() {
  try {
    // Return mock trade data for testing
    const mockTrades = [
      {
        id: 'test-1',
        date: '2024-10-20',
        symbol: 'AAPL',
        side: 'Long',
        quantity: 100,
        entryPrice: 150.00,
        exitPrice: 155.00,
        pnl: 500.00,
        pnlPercent: 3.33,
        commission: 2.00,
        duration: '2 hours',
        strategy: 'Day Trade',
        notes: 'Good momentum play',
        entryTime: '09:30:00',
        exitTime: '11:30:00',
        riskAmount: 200,
        riskPercent: 1.5,
        stopLoss: 148.00,
        rMultiple: 2.5,
        mfe: 156.00,
        mae: 149.50
      },
      {
        id: 'test-2',
        date: '2024-10-20',
        symbol: 'TSLA',
        side: 'Short',
        quantity: 50,
        entryPrice: 250.00,
        exitPrice: 245.00,
        pnl: 250.00,
        pnlPercent: 2.00,
        commission: 1.50,
        duration: '1 hour',
        strategy: 'Scalp',
        notes: 'Quick reversal trade',
        entryTime: '10:00:00',
        exitTime: '11:00:00',
        riskAmount: 150,
        riskPercent: 1.0,
        stopLoss: 252.00,
        rMultiple: 1.67,
        mfe: 244.00,
        mae: 251.50
      },
      {
        id: 'test-3',
        date: '2024-10-19',
        symbol: 'NVDA',
        side: 'Long',
        quantity: 25,
        entryPrice: 400.00,
        exitPrice: 385.00,
        pnl: -375.00,
        pnlPercent: -3.75,
        commission: 1.00,
        duration: '4 hours',
        strategy: 'Swing Trade',
        notes: 'Stopped out on news',
        entryTime: '09:30:00',
        exitTime: '13:30:00',
        riskAmount: 300,
        riskPercent: 2.0,
        stopLoss: 388.00,
        rMultiple: -1.25,
        mfe: 405.00,
        mae: 385.00
      }
    ]

    return NextResponse.json({ trades: mockTrades })
  } catch (error) {
    console.error('Error in debug trades endpoint:', error)
    return NextResponse.json({ error: 'Debug endpoint error' }, { status: 500 })
  }
}