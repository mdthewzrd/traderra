/**
 * Mock trade data generator for guest mode
 * Provides realistic trading data for testing Renata AI without authentication
 */

import { TraderraTrade } from '@/utils/csv-parser'

export function generateMockTrades(count: number = 100): TraderraTrade[] {
  const trades: TraderraTrade[] = []
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'SPY', 'QQQ', 'IWM']
  const strategies = ['breakout', 'pullback', 'reversal', 'momentum', 'gap', 'tail']

  const now = new Date()
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

  for (let i = 0; i < count; i++) {
    const isWin = Math.random() > 0.45 // 55% win rate
    const side: 'Long' | 'Short' = Math.random() > 0.5 ? 'Long' : 'Short'
    const entryDate = new Date(startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime()))
    const symbol = symbols[Math.floor(Math.random() * symbols.length)]
    const quantity = Math.floor(Math.random() * 200) + 50
    const entryPrice = Math.floor(Math.random() * 200) + 50

    let exitPrice: number
    let exitDate: Date

    if (isWin) {
      exitPrice = side === 'Long'
        ? entryPrice * (1 + (Math.random() * 0.05 + 0.01)) // Long: 1-6% gain
        : entryPrice * (1 - (Math.random() * 0.05 + 0.01)) // Short: 1-6% gain (price down)
      const holdDays = Math.floor(Math.random() * 5) + 1
      exitDate = new Date(entryDate.getTime() + holdDays * 24 * 60 * 60 * 1000)
    } else {
      exitPrice = side === 'Long'
        ? entryPrice * (1 - (Math.random() * 0.03 + 0.005)) // Long: 0.5-3.5% loss
        : entryPrice * (1 + (Math.random() * 0.03 + 0.005)) // Short: 0.5-3.5% loss (price up)
      const holdDays = Math.floor(Math.random() * 3) + 1
      exitDate = new Date(entryDate.getTime() + holdDays * 24 * 60 * 60 * 1000)
    }

    const pnl = side === 'Long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity

    const commission = 1.5 // $1.50 per trade

    // Calculate hold duration between entry and exit
    const holdTimeMs = exitDate.getTime() - entryDate.getTime()
    const holdDays = Math.floor(holdTimeMs / (1000 * 60 * 60 * 24))
    const holdHours = Math.floor(holdTimeMs / (1000 * 60 * 60))
    const duration = holdDays > 0 ? `${holdDays}d` : `${holdHours}h`

    // Generate entry/exit times
    const entryHour = 9 + Math.floor(Math.random() * 7) // 9-4 PM
    const entryMinute = Math.floor(Math.random() * 60)
    const entryTime = `${entryHour > 12 ? entryHour - 12 : entryHour}:${entryMinute.toString().padStart(2, '0')} ${entryHour >= 12 ? 'PM' : 'AM'}`

    const exitHour = 9 + Math.floor(Math.random() * 7)
    const exitMinute = Math.floor(Math.random() * 60)
    const exitTime = `${exitHour > 12 ? exitHour - 12 : exitHour}:${exitMinute.toString().padStart(2, '0')} ${exitHour >= 12 ? 'PM' : 'AM'}`

    // Calculate P&L percentage
    const pnlPercent = (pnl / (entryPrice * quantity)) * 100

    // Risk amount (approx 1-2% of position)
    const riskAmount = (entryPrice * quantity) * (Math.random() * 0.01 + 0.01)

    trades.push({
      id: `mock-${i}`,
      date: entryDate.toISOString().split('T')[0],
      symbol,
      side,
      quantity,
      entryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      commission,
      duration,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      notes: Math.random() > 0.8 ? 'Mock trade for testing Renata AI' : '',
      entryTime,
      exitTime,
      riskAmount,
      riskPercent: Math.random() * 2 + 0.5, // 0.5-2.5% risk
    })
  }

  return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Pre-generated mock datasets
export const mockTradeDatasets = {
  small: generateMockTrades(50),
  medium: generateMockTrades(150),
  large: generateMockTrades(500),
}

// Get mock data for guest mode
export function getMockTrades() {
  return mockTradeDatasets.medium
}
