'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { DailySummaryCard } from '@/components/dashboard/daily-summary-card'
import { Calendar, TrendingUp, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePnLMode } from '@/contexts/TraderraContext'
import { getRMultipleValue } from '@/utils/trade-statistics'
import { useTrades } from '@/hooks/useTrades'
import { useComponentRegistry, type ScrollBehavior } from '@/lib/ag-ui/component-registry'
import { useCopilotReadable } from '@/hooks/useCopilotReadableWithContext'

// Mock data for demo - in real app this would come from API
const mockTrades = [
  {
    id: 'trade_1',
    symbol: 'AAPL',
    side: 'Long' as const,
    pnl: 850.25,
    rMultiple: 2.1,
    quantity: 200,
    entryPrice: 175.50,
    exitPrice: 179.76,
    strategy: 'Momentum'
  },
  {
    id: 'trade_2',
    symbol: 'TSLA',
    side: 'Long' as const,
    pnl: -245.80,
    rMultiple: -0.9,
    quantity: 50,
    entryPrice: 242.15,
    exitPrice: 237.24,
    strategy: 'Breakout'
  },
  {
    id: 'trade_3',
    symbol: 'NVDA',
    side: 'Short' as const,
    pnl: 1200.50,
    rMultiple: 3.2,
    quantity: 100,
    entryPrice: 428.75,
    exitPrice: 416.75,
    strategy: 'Reversal'
  },
  {
    id: 'trade_4',
    symbol: 'SPY',
    side: 'Long' as const,
    pnl: 180.25,
    rMultiple: 1.1,
    quantity: 150,
    entryPrice: 425.80,
    exitPrice: 427.00,
    strategy: 'Scalp'
  },
  {
    id: 'trade_5',
    symbol: 'QQQ',
    side: 'Long' as const,
    pnl: -180.50,
    rMultiple: -0.6,
    quantity: 80,
    entryPrice: 350.25,
    exitPrice: 348.00,
    strategy: 'Gap Fill'
  }
]

export default function DailySummaryPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const { pnlMode } = usePnLMode()
  const { trades, isLoading, error } = useTrades()
  const router = useRouter()

  // Register daily-summary components with AG-UI registry
  useComponentRegistry('daily-summary.date', {
    setState: (state) => {
      if (typeof state === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(state)) {
        setSelectedDate(state)
      }
    }
  })

  useComponentRegistry('daily-summary.stats', {
    scroll: (behavior) => {
      const element = document.getElementById('daily-summary-stats-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  useComponentRegistry('daily-summary.trades', {
    scroll: (behavior) => {
      const element = document.getElementById('daily-summary-trades-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  const navigateDate = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate)
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1)
    } else {
      currentDate.setDate(currentDate.getDate() + 1)
    }
    setSelectedDate(currentDate.toISOString().split('T')[0])
  }

  const handleTradeClick = (tradeId: string) => {
    // Navigate to trades page with the specific trade highlighted/selected
    router.push(`/trades?selectedTrade=${tradeId}`)
  }

  // Filter trades for the selected date
  const selectedDateTrades = trades.filter(trade => trade.date === selectedDate)

  const accountSize = 50000
  const startingBalance = 48500
  const totalPnL = selectedDateTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const endingBalance = startingBalance + totalPnL

  const todayStats = {
    totalTrades: selectedDateTrades.length,
    winningTrades: selectedDateTrades.filter(t => t.pnl > 0).length,
    totalVolume: selectedDateTrades.reduce((sum, trade) => sum + (trade.quantity * trade.entryPrice), 0),
    avgRMultiple: selectedDateTrades.length > 0
      ? selectedDateTrades.reduce((sum, trade) => sum + getRMultipleValue(trade, pnlMode), 0) / selectedDateTrades.length
      : 0
  }

  // Expose daily summary data to Renata AI for context awareness
  // Only include data that's actually visible on the page to prevent hallucination
  useCopilotReadable({
    description: 'Daily summary page showing trading performance for a specific date',
    value: {
      currentPage: 'daily-summary',
      selectedDate,
      pnlMode,
      totalPnL,
      // Only expose data that's actually visible on the UI
      trades: selectedDateTrades.length,
      winningTrades: todayStats.winningTrades,
      losingTrades: todayStats.totalTrades - todayStats.winningTrades,
      winRate: todayStats.totalTrades > 0
        ? (todayStats.winningTrades / todayStats.totalTrades) * 100
        : 0,
      avgRiskMultiple: todayStats.avgRMultiple,
      isLoading,
      hasError: !!error,
      error
    }
  })

  return (
    <AppLayout
      pageClassName="min-h-screen"
      showPageHeader={true}
      pageHeaderContent={
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold studio-text">Daily Summary</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateDate('prev')}
                  className="p-1 rounded hover:bg-studio-border transition-colors"
                  title="Previous day"
                >
                  <ChevronLeft className="h-4 w-4 studio-muted" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1 studio-surface border border-studio-border rounded text-sm studio-text focus:ring-2 focus:ring-primary focus:border-primary"
                  max={new Date().toISOString().split('T')[0]}
                />
                <button
                  onClick={() => navigateDate('next')}
                  className="p-1 rounded hover:bg-studio-border transition-colors"
                  title="Next day"
                >
                  <ChevronRight className="h-4 w-4 studio-muted" />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <div className="p-6">
          {error && (
            <div className="mx-auto max-w-6xl mb-6">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm">Error loading trades: {error}</p>
              </div>
            </div>
          )}
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Quick Stats */}
            <div id="daily-summary-stats-section">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="studio-surface rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm studio-muted">Daily P&L</div>
                    <div className={`text-xl font-semibold ${totalPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                      {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="studio-surface rounded-lg p-4">
                <div className="text-sm studio-muted">Total Trades</div>
                <div className="text-xl font-semibold studio-text">{todayStats.totalTrades}</div>
                <div className="text-xs studio-muted">
                  {todayStats.winningTrades} wins • {todayStats.totalTrades - todayStats.winningTrades} losses
                </div>
              </div>

              <div className="studio-surface rounded-lg p-4">
                <div className="text-sm studio-muted">Win Rate</div>
                <div className="text-xl font-semibold studio-text">
                  {todayStats.totalTrades > 0
                    ? ((todayStats.winningTrades / todayStats.totalTrades) * 100).toFixed(1) + '%'
                    : '0%'
                  }
                </div>
              </div>

              <div className="studio-surface rounded-lg p-4">
                <div className="text-sm studio-muted">Avg R-Multiple</div>
                <div className={`text-xl font-semibold ${todayStats.avgRMultiple >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                  {todayStats.avgRMultiple >= 0 ? '+' : ''}{todayStats.avgRMultiple.toFixed(2)}R
                </div>
              </div>
            </div>
            </div>

            {/* Summary Card */}
            <DailySummaryCard
              date={selectedDate}
              trades={selectedDateTrades}
              accountSize={accountSize}
              startingBalance={startingBalance}
              endingBalance={endingBalance}
            />

            {/* Trade List */}
            <div id="daily-summary-trades-section">
              <div className="studio-surface rounded-lg">
              <div className="p-6 border-b border-[#1a1a1a]">
                <h3 className="text-lg font-semibold studio-text">Today's Trades</h3>
                <p className="text-sm studio-muted">Detailed breakdown of all trades for {new Date(selectedDate).toLocaleDateString()}</p>
              </div>
              <div className="divide-y divide-[#1a1a1a]">
                {isLoading ? (
                  <div className="p-8 text-center studio-muted">
                    Loading trades...
                  </div>
                ) : selectedDateTrades.length === 0 ? (
                  <div className="p-8 text-center studio-muted">
                    No trades found for {new Date(selectedDate).toLocaleDateString()}
                  </div>
                ) : (
                  selectedDateTrades.map((trade) => (
                    <button
                      key={trade.id}
                      className="w-full p-4 hover:bg-[#111111] transition-colors text-left cursor-pointer border-none bg-transparent"
                      onClick={() => handleTradeClick(trade.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="text-sm font-medium studio-text">{trade.symbol}</div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            trade.side === 'Long'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {trade.side}
                          </div>
                          <div className="text-sm studio-muted">{trade.quantity} shares</div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-sm studio-muted">
                            ${trade.entryPrice.toFixed(2)} → ${trade.exitPrice.toFixed(2)}
                          </div>
                          <div className={`text-sm font-medium ${trade.pnl >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </div>
                          <div className={`text-sm font-medium ${getRMultipleValue(trade, pnlMode) >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                            {getRMultipleValue(trade, pnlMode) >= 0 ? '+' : ''}{getRMultipleValue(trade, pnlMode).toFixed(2)}R
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            </div>
          </div>
      </div>
    </AppLayout>
  )
}