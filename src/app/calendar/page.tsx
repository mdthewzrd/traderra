'use client'

import { useState, useMemo, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { DisplayModeToggle } from '@/components/ui/display-mode-toggle'
import { PnLModeToggle } from '@/components/ui/pnl-mode-toggle'
import { TraderViewDateSelector } from '@/components/ui/traderview-date-selector'
import { useChatContext, useDateRange, usePnLMode, useDisplayMode } from '@/contexts/TraderraContext'
import { useTrades } from '@/hooks/useTrades'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useComponentRegistry } from '@/lib/ag-ui/component-registry'
import { useCopilotReadable } from '@/hooks/useCopilotReadableWithContext'

type ViewMode = 'year' | 'month'

// Generate sample trades for demo purposes
const generateSampleTrades = (year: number) => {
  const sampleTrades = []
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Skip weekends
    const dayOfWeek = d.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue

    // 70% chance of having a trade on weekdays
    if (Math.random() > 0.3) {
      const isWin = Math.random() > 0.45
      const pnl = isWin
        ? Math.round((Math.random() * 2000 + 100) * 100) / 100 // $100 - $2100 profit
        : -Math.round((Math.random() * 1500 + 50) * 100) / 100 // -$50 to -$1550 loss

      // Generate risk amount and calculate R-multiple
      const riskAmount = Math.round((Math.random() * 500 + 100) * 100) / 100 // $100 - $600 risk
      const rMultiple = pnl / riskAmount // Calculate R-multiple

      sampleTrades.push({
        id: `sample-${d.toISOString().split('T')[0]}`,
        date: d.toISOString().split('T')[0],
        symbol: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META'][Math.floor(Math.random() * 7)],
        entry_price: Math.random() * 500 + 50,
        exit_price: Math.random() * 500 + 50,
        quantity: Math.floor(Math.random() * 100) + 1,
        pnl: pnl,
        side: Math.random() > 0.5 ? 'long' : 'short',
        commission: -(Math.random() * 10 + 2), // $2 - $12 commission
        riskAmount: riskAmount,
        rMultiple: rMultiple
      })
    }
  }

  return sampleTrades
}

export default function CalendarPage() {
  const { isSidebarOpen, setIsSidebarOpen } = useChatContext()
  const { trades, isLoading: tradesLoading } = useTrades()
  const { selectedRange, customStartDate, customEndDate } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { pnlMode, isGrossPnL, isNetPnL } = usePnLMode()
  const [viewMode, setViewMode] = useState<ViewMode>('year')

  // Detect the year from trades or default to current year
  const detectedYear = useMemo(() => {
    if (trades && trades.length > 0) {
      // Find the year with the most trades
      const years = trades.map(t => {
        const date = t.date instanceof Date ? t.date : new Date(t.date)
        return date.getFullYear()
      }).filter(y => !isNaN(y))

      if (years.length > 0) {
        // Return the most common year
        const yearCounts = years.reduce((acc, year) => {
          acc[year] = (acc[year] || 0) + 1
          return acc
        }, {} as Record<number, number>)

        const sortedYears = Object.entries(yearCounts).sort((a, b) => b[1] - a[1])
        const mostCommonYear = parseInt(sortedYears[0][0])
        console.log('[Calendar] Detected most common trade year:', mostCommonYear, 'with', sortedYears[0][1], 'trades')
        return mostCommonYear
      }
    }
    return new Date().getFullYear()
  }, [trades])

  // Initialize with current year, will update when trades load
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const initial = new Date().getFullYear()
    console.log('[Calendar] Initial year:', initial)
    return initial
  })
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // Track if we've already initialized with detected year
  const [initializedWithTrades, setInitializedWithTrades] = useState(false)

  // Update current year when detected year changes (e.g., after trades load)
  // Only do this once on initial load, then respect user's manual changes
  useEffect(() => {
    // Only initialize if we haven't already AND detected year is different from current year
    if (!initializedWithTrades && detectedYear !== currentYear) {
      console.log('[Calendar] Initializing year from', currentYear, 'to', detectedYear)
      setCurrentYear(detectedYear)
      setInitializedWithTrades(true)
    } else if (!initializedWithTrades && detectedYear === currentYear) {
      // Years are already the same, mark as initialized so we don't override user changes later
      console.log('[Calendar] Years match, marking as initialized')
      setInitializedWithTrades(true)
    }
  }, [detectedYear, currentYear, initializedWithTrades])

  // Filter trades based on selected date range
  const filteredTrades = useMemo(() => {
    if (!trades || trades.length === 0) {
      console.log('[Calendar] No trades to filter')
      return []
    }

    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (selectedRange) {
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 30)
        break
      case '90day':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 90)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1) // Jan 1 of current year
        break
      case 'all':
        // Show all trades, no filtering
        console.log('[Calendar] Showing all', trades.length, 'trades')
        return trades
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          endDate = new Date(customEndDate)
          console.log('[Calendar] Custom range:', startDate, 'to', endDate)
        } else {
          return trades
        }
        break
      default:
        return trades
    }

    // Filter trades within the date range
    const filtered = trades.filter(t => {
      const tradeDate = t.date instanceof Date ? t.date : new Date(t.date)
      return tradeDate >= startDate && tradeDate <= endDate
    })

    console.log('[Calendar] Filtered', trades.length, 'trades to', filtered.length, 'trades for range:', selectedRange)
    return filtered
  }, [trades, selectedRange, customStartDate, customEndDate])

  // Use sample trades if no real trades exist
  const displayTrades = useMemo(() => {
    // If we have filtered real trades, use them
    if (filteredTrades.length > 0) {
      console.log('[Calendar] Using', filteredTrades.length, 'filtered trades for year', currentYear)
      return filteredTrades
    }

    // Otherwise, generate sample data for demonstration
    // This runs when trades is an empty array (not authenticated or no trades)
    console.log('[Calendar] No trades loaded, generating sample data for year:', currentYear)
    const sampleTrades = generateSampleTrades(currentYear)

    // Apply date range filter to sample trades too
    if (selectedRange === 'all') {
      console.log('[Calendar] Showing all sample trades:', sampleTrades.length)
      return sampleTrades
    }

    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (selectedRange) {
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 30)
        break
      case '90day':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 90)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1) // Jan 1 of current year
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate)
          endDate = new Date(customEndDate)
        } else {
          return sampleTrades
        }
        break
      default:
        return sampleTrades
    }

    const filteredSamples = sampleTrades.filter(t => {
      const tradeDate = t.date instanceof Date ? t.date : new Date(t.date)
      return tradeDate >= startDate && tradeDate <= endDate
    })

    console.log('[Calendar] Filtered sample trades:', sampleTrades.length, 'to', filteredSamples.length, 'for range:', selectedRange)
    return filteredSamples
  }, [filteredTrades, currentYear, selectedRange, customStartDate, customEndDate])

  // Register calendar components with AG-UI registry
  useComponentRegistry('calendar.view-mode', {
    setState: (state) => {
      if (state === 'year' || state === 'month') {
        setViewMode(state)
      }
    }
  })

  useComponentRegistry('calendar.year', {
    setState: (state) => {
      const year = typeof state === 'number' ? state : parseInt(state)
      if (!isNaN(year)) {
        setCurrentYear(year)
      }
    }
  })

  useComponentRegistry('calendar.month', {
    setState: (state) => {
      const month = typeof state === 'number' ? state : parseInt(state)
      if (!isNaN(month) && month >= 0 && month <= 11) {
        setSelectedMonth(month)
        setViewMode('month')
      }
    }
  })

  // Generate data for all months in the current year
  const monthsData = useMemo(() => {
    const months = []
    for (let month = 0; month < 12; month++) {
      const monthTrades = displayTrades.filter(trade => {
        const tradeDate = new Date(trade.date)
        return tradeDate.getFullYear() === currentYear && tradeDate.getMonth() === month
      })

      // Calculate values based on display mode and P&L mode
      let totalValue = 0
      let winningDays = 0
      let totalTradesCount = 0

      for (const trade of monthTrades) {
        // Get P&L based on Gross vs Net mode
        let tradePnL = trade.pnl || 0
        if (isGrossPnL && trade.commission) {
          // Gross P&L = Net P&L + Commissions
          tradePnL = tradePnL + Math.abs(trade.commission)
        }

        // Get value based on Dollar vs R mode
        if (displayMode === 'r') {
          // Use R-multiple if available, otherwise calculate from risk amount
          if (trade.rMultiple !== undefined && trade.rMultiple !== null) {
            totalValue += trade.rMultiple
          } else if (trade.riskAmount && trade.riskAmount !== 0) {
            // Calculate R-multiple: P&L / Risk
            totalValue += tradePnL / Math.abs(trade.riskAmount)
          } else {
            // Default to showing P&L if no risk info available
            totalValue += tradePnL
          }
        } else {
          // Dollar mode - use P&L
          totalValue += tradePnL
        }

        if (tradePnL > 0) {
          winningDays++
        }
        totalTradesCount++
      }

      const tradingDays = new Set(monthTrades.map(t => t.date)).size

      months.push({
        month,
        name: new Date(currentYear, month, 1).toLocaleDateString('en-US', { month: 'long' }),
        totalPnL: totalValue,
        winningDays,
        tradingDays,
        totalTrades: totalTradesCount
      })
    }
    return months
  }, [currentYear, displayTrades, displayMode, pnlMode, isGrossPnL, isNetPnL])

  // Expose calendar data to Renata AI for context awareness
  useCopilotReadable({
    description: 'Trading calendar showing monthly and daily performance breakdown',
    value: {
      currentPage: 'calendar',
      currentYear,
      selectedMonth,
      viewMode,
      totalTrades: displayTrades.length,
      filteredTrades: filteredTrades.length,
      isLoading: tradesLoading,
      displayMode,
      pnlMode,
      selectedRange,
      // Monthly summary for context
      yearlyMonths: monthsData.map(m => ({
        month: m.month,
        name: m.name,
        totalPnL: m.totalPnL,
        totalTrades: m.totalTrades,
        tradingDays: m.tradingDays,
        winningDays: m.winningDays
      }))
    }
  })

  // Generate calendar days for selected month
  const generateMonthDays = (month: number) => {
    const year = currentYear
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay()

    const days = []

    // Previous month days
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
        day: prevMonthDays - i
      })
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateStr = date.toISOString().split('T')[0]
      const dayTrades = displayTrades.filter(t => {
        const tradeDateStr = t.date instanceof Date
          ? t.date.toISOString().split('T')[0]
          : (typeof t.date === 'string' ? t.date.split('T')[0] : t.date)
        return tradeDateStr === dateStr
      })

      // Calculate daily value based on display modes
      let dailyValue = 0
      for (const trade of dayTrades) {
        // Get P&L based on Gross vs Net mode
        let tradePnL = trade.pnl || 0
        if (isGrossPnL && trade.commission) {
          // Gross P&L = Net P&L + Commissions
          tradePnL = tradePnL + Math.abs(trade.commission)
        }

        // Get value based on Dollar vs R mode
        if (displayMode === 'r') {
          // Use R-multiple if available, otherwise calculate from risk amount
          if (trade.rMultiple !== undefined && trade.rMultiple !== null) {
            dailyValue += trade.rMultiple
          } else if (trade.riskAmount && trade.riskAmount !== 0) {
            // Calculate R-multiple: P&L / Risk
            dailyValue += tradePnL / Math.abs(trade.riskAmount)
          } else {
            // Default to showing P&L if no risk info available
            dailyValue += tradePnL
          }
        } else {
          // Dollar mode - use P&L
          dailyValue += tradePnL
        }
      }

      days.push({
        date,
        isCurrentMonth: true,
        day,
        trades: dayTrades.length,
        pnl: dailyValue
      })
    }

    // Next month days
    const remainingCells = 42 - days.length
    for (let day = 1; day <= remainingCells; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
        day
      })
    }

    return days
  }

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sa']

  // Helper function to format value based on display mode
  const formatValue = (value: number) => {
    if (displayMode === 'r') {
      // R mode - show as number with 'R' suffix
      return `${value.toFixed(1)}R`
    } else {
      // Dollar mode - show as currency
      return `${value >= 0 ? '+' : ''}$${value.toFixed(0)}`
    }
  }

  return (
    <AppLayout
      showPageHeader={true}
      pageHeaderContent={
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold studio-text">Trading Calendar</h1>

            <div className="flex items-center space-x-4">
              <DisplayModeToggle size="sm" variant="flat" />
              <PnLModeToggle />
              <TraderViewDateSelector />
              {/* View Mode Toggle */}
              <div className="flex items-center bg-[#1a1a1a] rounded-lg p-1">
                <button
                  onClick={() => setViewMode('year')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'year' ? 'bg-primary text-black' : 'studio-muted hover:studio-text'
                  }`}
                >
                  Year
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'month' ? 'bg-primary text-black' : 'studio-muted hover:studio-text'
                  }`}
                >
                  Month
                </button>
              </div>

              {/* Year Navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentYear(currentYear - 1)}
                  className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
                  title="Previous year"
                >
                  <ChevronLeft className="h-5 w-5 studio-muted" />
                </button>
                <span className="text-lg font-semibold studio-text min-w-[80px] text-center">
                  {currentYear}
                </span>
                <button
                  onClick={() => setCurrentYear(currentYear + 1)}
                  className="p-2 hover:bg-[#1a1a1a] rounded transition-colors"
                  title="Next year"
                >
                  <ChevronRight className="h-5 w-5 studio-muted" />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* Main Content */}
      <div className="overflow-y-auto px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {viewMode === 'year' ? (
            /* Yearly View - All Months */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {monthsData.map((monthData) => {
                const isCurrentMonth = new Date().getMonth() === monthData.month && new Date().getFullYear() === currentYear

                return (
                  <button
                    key={monthData.month}
                    onClick={() => {
                      setSelectedMonth(monthData.month)
                      setViewMode('month')
                    }}
                    className={`
                      studio-surface border p-4 text-left transition-all
                      hover:border-[#333] hover:shadow-lg
                      ${isCurrentMonth ? 'border-primary/30' : 'border-[#1a1a1a]'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-semibold ${isCurrentMonth ? 'text-primary' : 'studio-text'}`}>
                        {monthData.name}
                      </h3>
                      <span className={`text-xs px-2 py-1 ${
                        monthData.totalPnL >= 0
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}>
                        {formatValue(monthData.totalPnL)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="studio-muted">Trading Days</span>
                        <span className="studio-text font-medium">{monthData.tradingDays}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="studio-muted">Winning Days</span>
                        <span className="text-green-400 font-medium">{monthData.winningDays}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="studio-muted">Total Trades</span>
                        <span className="studio-text font-medium">{monthData.totalTrades}</span>
                      </div>
                    </div>

                    {/* Mini calendar preview */}
                    <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
                      <div className="grid grid-cols-7 gap-0.5 text-xs">
                        {['S','M','T','W','T','F','S'].map((d, idx) => (
                          <div key={`dow-${idx}`} className="text-center studio-muted py-0.5">{d}</div>
                        ))}
                        {generateMonthDays(monthData.month)
                          .filter((d, i) => i < 35) // Show first 35 cells (5 weeks)
                          .map((dayInfo, i) => {
                            const pnl = dayInfo.pnl || 0
                            const dateKey = `${monthData.month}-${i}-${dayInfo.day}`
                            return (
                              <div
                                key={dateKey}
                                className={`
                                  text-center py-0.5 text-xs
                                  ${!dayInfo.isCurrentMonth ? 'opacity-20' : ''}
                                  ${dayInfo.isCurrentMonth
                                    ? pnl > 0
                                      ? 'bg-green-900/40 text-green-400'
                                      : pnl < 0
                                        ? 'bg-red-900/40 text-red-400'
                                        : 'bg-[#1a1a1a] text-gray-400'
                                    : ''
                                  }
                                `}
                              >
                                {dayInfo.day}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            /* Monthly View */
            <div className="space-y-6">
              {/* Back to Year View */}
              <button
                onClick={() => {
                  setViewMode('year')
                  setSelectedMonth(null)
                }}
                className="flex items-center space-x-2 text-sm studio-muted hover:text-studio-text transition-colors mb-4"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Year View</span>
              </button>

              {/* Month Detail */}
              <div className="studio-surface border p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold studio-text mb-2">
                    {new Date(currentYear, selectedMonth || 0, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
                  <div className="flex items-center space-x-6 text-sm">
                    <span className="studio-muted">
                      Total P&L: <span className={`ml-2 font-semibold ${monthsData[selectedMonth || 0].totalPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'}`}>
                        {formatValue(monthsData[selectedMonth || 0].totalPnL)}
                      </span>
                    </span>
                    <span className="studio-muted">
                      Trading Days: <span className="ml-2 font-semibold studio-text">{monthsData[selectedMonth || 0].tradingDays}</span>
                    </span>
                    <span className="studio-muted">
                      Total Trades: <span className="ml-2 font-semibold studio-text">{monthsData[selectedMonth || 0].totalTrades}</span>
                    </span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {daysOfWeek.map((day, idx) => (
                    <div key={`dow-${idx}`} className="text-center py-2 text-sm font-medium studio-muted">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0">
                  {generateMonthDays(selectedMonth || 0).map((dayInfo, index) => {
                    const isToday = dayInfo.date.toDateString() === new Date().toDateString()
                    const pnl = dayInfo.pnl || 0
                    const hasTrades = dayInfo.trades > 0
                    const dateKey = dayInfo.date.toISOString().split('T')[0]

                    return (
                      <div
                        key={dateKey}
                        className={`
                          min-h-[140px] p-2
                          ${!dayInfo.isCurrentMonth
                            ? 'opacity-30 bg-[#0a0a0a]'
                            : pnl > 0
                              ? 'bg-green-900/50'
                              : pnl < 0
                                ? 'bg-red-900/50'
                                : 'bg-[#1a1a1a]'
                          }
                        `}
                      >
                        <div className="flex flex-col h-full justify-between">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${isToday ? 'bg-primary text-white px-2 py-0.5' : 'studio-text'}`}>
                              {dayInfo.day}
                            </span>
                            {hasTrades && (
                              <div className={`text-xs px-1 py-0.5 ${pnl >= 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                {dayInfo.trades}
                              </div>
                            )}
                          </div>
                          {dayInfo.isCurrentMonth && pnl !== 0 && (
                            <div className={`text-sm font-bold text-center ${pnl > 0 ? 'text-green-400' : pnl < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                              {formatValue(pnl)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
