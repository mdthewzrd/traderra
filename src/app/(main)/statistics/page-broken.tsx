'use client'

import { useState, useMemo } from 'react'
import { Download, RefreshCw, Calendar, FileText, AlertTriangle, BarChart3, Settings, X, Filter, Target, TrendingUp } from 'lucide-react'
import { AppLayout } from '@/components/layout/app-layout'
import { TraderViewDateSelector } from '@/components/ui/traderview-date-selector'
import { DisplayModeToggle } from '@/components/ui/display-mode-toggle'
import { useDateRange, usePnLMode, useDisplayMode, useChatContext } from '@/contexts/TraderraContext'
import { useTrades } from '@/hooks/useTrades'
import {
  calculateTradeStatistics,
  getPerformanceByDay,
  getDistributionByDay,
  getPerformanceByMonth,
  getDistributionByMonth,
  getPerformanceByHour,
  getDistributionByHour,
  getPerformanceByDayR,
  getPerformanceByMonthR,
  getPerformanceByHourR,
  getCumulativePnLData,
  generatePriceDistribution,
  generatePricePerformance,
  formatCurrency,
  formatPercentage,
  formatNumber,
  getPnLValue,
  getRMultipleValue,
  getProfitFactorOverTime,
  getWinLossDayComparison
} from '@/utils/trade-statistics'
import { formatDisplayValue, getValueColorClass } from '@/utils/display-formatting'
import { cn } from '@/lib/utils'
import { TraderraTrade } from '@/utils/csv-parser'
import {
  WinRateAnalysisChart,
  PerformanceByPositionSizeChart,
  PerformanceByPriceChart
} from '@/components/dashboard/additional-metrics'
import { TabbedWidget } from '@/components/dashboard/tabbed-widget'


// Detailed stats component with clean table format
function TraderVueDetailedStats({ stats, displayMode, trades, mode }: { stats: any, displayMode: any, trades: any[], mode: 'gross' | 'net' }) {
  const scratchPercentage = stats.totalTrades > 0 ? (stats.scratchTrades / stats.totalTrades * 100).toFixed(1) : '0.0'
  const winPercentage = stats.winRate.toFixed(1)
  const lossPercentage = (100 - stats.winRate).toFixed(1)
  const averageDailyVolume = stats.totalTrades > 0 ? Math.round(stats.totalVolume / stats.totalTrades) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border border-studio-border rounded-lg overflow-hidden">
      {/* Left Column */}
      <div className="p-6 md:border-r border-studio-border">
        <div className="space-y-0">
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Total Gain/Loss:</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(displayMode === 'r' ? stats.totalRMultiple : stats.totalGainLoss))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.totalRMultiple, 'r', 'currency', {}, stats.totalRMultiple)
                : formatDisplayValue(stats.totalGainLoss, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Daily Gain/Loss</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(stats.averageDailyPnL))}>
              {formatDisplayValue(stats.averageDailyPnL, displayMode, 'currency')}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Trade Gain/Loss</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(displayMode === 'r' ? stats.expectancyR : stats.averageGainLoss))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.expectancyR, 'r', 'currency', {}, stats.expectancyR)
                : formatDisplayValue(stats.averageGainLoss, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Total Number of Trades</span>
            <span className="text-sm studio-text font-semibold">{formatNumber(stats.totalTrades)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Hold Time (winners)</span>
            <span className="text-sm studio-text">{stats.averageHoldTimeWinner.toFixed(1)} hours</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Number of Scratch Trades</span>
            <span className="text-sm studio-text">{stats.scratchTrades} ({scratchPercentage}%)</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Trade P&L Standard Deviation</span>
            <span className="text-sm studio-text font-semibold">
              {displayMode === 'r'
                ? formatDisplayValue(stats.pnlStandardDeviation / 200, 'r', 'currency', {}, stats.pnlStandardDeviation / 200)
                : formatDisplayValue(stats.pnlStandardDeviation, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Kelly Percentage</span>
            <span className="text-sm studio-text font-semibold">{formatPercentage(stats.kellyPercentage)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Total Commissions</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(-stats.totalCommissions, false))}>
              {formatDisplayValue(stats.totalCommissions, 'dollar', 'currency')}
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-sm studio-muted">Average position MAE</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(-stats.averageMAE, false))}>
              {formatDisplayValue(stats.averageMAE, displayMode, 'currency')}
            </span>
          </div>
        </div>
      </div>

      {/* Center Column */}
      <div className="p-6 md:border-r lg:border-r border-studio-border">
        <div className="space-y-0">
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Largest Gain</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(displayMode === 'r' ? stats.largestGainR : stats.largestGain))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.largestGainR, 'r', 'currency', {}, stats.largestGainR)
                : formatDisplayValue(stats.largestGain, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Daily Volume</span>
            <span className="text-sm studio-text font-semibold">{formatNumber(averageDailyVolume)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Winning Trade</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(displayMode === 'r' ? stats.averageWinR : stats.averageWin))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.averageWinR, 'r', 'currency', {}, stats.averageWinR)
                : formatDisplayValue(stats.averageWin, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Number of Winning Trades</span>
            <span className="text-sm studio-text font-semibold">{stats.winningTrades} ({winPercentage}%)</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Hold Time (losers)</span>
            <span className="text-sm studio-text">{stats.averageHoldTimeLoser.toFixed(1)} hours</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Max Consecutive Wins</span>
            <span className="text-sm studio-text font-semibold">{stats.maxConsecutiveWins}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">System Quality Number (SQN)</span>
            <span className="text-sm studio-text font-semibold">{stats.systemQualityNumber.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">K-Ratio</span>
            <span className="text-sm studio-text font-semibold">{stats.kRatio.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Total Fees</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(-stats.totalFees, false))}>
              {formatDisplayValue(stats.totalFees, displayMode, 'currency')}
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-sm studio-muted">Average Position MFE</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(stats.averageMFE))}>
              {formatDisplayValue(stats.averageMFE, displayMode, 'currency')}
            </span>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="p-6">
        <div className="space-y-0">
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Largest Loss</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(displayMode === 'r' ? stats.largestLossR : stats.largestLoss))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.largestLossR, 'r', 'currency', {}, stats.largestLossR)
                : formatDisplayValue(stats.largestLoss, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Per-share Gain/Loss</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(stats.totalVolume > 0 ? stats.totalGainLoss / stats.totalVolume : 0))}>
              {formatDisplayValue(stats.totalVolume > 0 ? stats.totalGainLoss / stats.totalVolume : 0, displayMode, 'currency')}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Average Losing Trade</span>
            <span className={cn("text-sm font-semibold", getValueColorClass(displayMode === 'r' ? stats.averageLossR : stats.averageLoss))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.averageLossR, 'r', 'currency', {}, stats.averageLossR)
                : formatDisplayValue(stats.averageLoss, displayMode, 'currency')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Number of Losing Trades</span>
            <span className="text-sm studio-text font-semibold">{stats.losingTrades} ({lossPercentage}%)</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Expectancy</span>
            <span className={cn("text-sm", getValueColorClass(displayMode === 'r' ? stats.expectancyR : stats.expectancy))}>
              {displayMode === 'r'
                ? formatDisplayValue(stats.expectancyR, 'r', 'expectancy', {}, stats.expectancyR)
                : formatDisplayValue(stats.expectancy, displayMode, 'expectancy')
              }
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Max Consecutive Losses</span>
            <span className="text-sm studio-text font-semibold">{stats.maxConsecutiveLosses}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Profit factor</span>
            <span className="text-sm studio-text font-semibold">
              {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">Sharpe Ratio</span>
            <span className="text-sm studio-text font-semibold">{stats.sharpeRatio.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-studio-border">
            <span className="text-sm studio-muted">% Chance of 1R Winner</span>
            <span className="text-sm font-semibold text-green-400">
              {stats.totalTrades > 0
                ? ((trades.filter(trade => getRMultipleValue(trade, mode) >= 1).length / stats.totalTrades) * 100).toFixed(1)
                : '0.0'}%
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-sm studio-muted">% Chance of 1R Loser</span>
            <span className="text-sm font-semibold text-red-400">
              {stats.totalTrades > 0
                ? ((trades.filter(trade => getRMultipleValue(trade, mode) <= -1).length / stats.totalTrades) * 100).toFixed(1)
                : '0.0'}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Cumulative P&L chart component with hover functionality
function CumulativePLChart({ tradesData, mode, displayMode, stats }: { tradesData: TraderraTrade[], mode: 'gross' | 'net', displayMode: any, stats?: any }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ month: string, value: string, gain: string, x: number, y: number } | null>(null)

  // Generate cumulative P&L data from real trades
  const pnlData = useMemo(() => {
    if (!tradesData || tradesData.length === 0) {
      return []
    }

    // Sort trades by date to ensure chronological order
    const sortedTrades = [...tradesData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate cumulative P&L by month-end
    const monthlyPnL: Array<{ month: string, cumulativePnL: number, monthlyGain: number, date: Date }> = []
    let runningTotal = 0
    let currentMonth = ''
    let monthlyGain = 0

    sortedTrades.forEach((trade, index) => {
      const tradeDate = new Date(trade.date)
      const monthKey = tradeDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      // Use the correct value based on display mode: R-multiple for 'r' mode, dollar value for others
      const tradePnL = displayMode === 'r' ? getRMultipleValue(trade, mode) : getPnLValue(trade, mode)

      runningTotal += tradePnL

      // Check if this is a new month or the last trade
      const isNewMonth = monthKey !== currentMonth
      const isLastTrade = index === sortedTrades.length - 1

      if (isNewMonth && currentMonth !== '') {
        // Save the previous month's data
        monthlyPnL.push({
          month: currentMonth,
          cumulativePnL: runningTotal - tradePnL, // Cumulative up to end of previous month
          monthlyGain,
          date: new Date(sortedTrades[index - 1].date)
        })
        monthlyGain = tradePnL // Start new month with current trade
      } else {
        monthlyGain += tradePnL // Add to current month
      }

      // Update current month
      currentMonth = monthKey

      // If this is the last trade, add the final month
      if (isLastTrade) {
        monthlyPnL.push({
          month: monthKey,
          cumulativePnL: runningTotal,
          monthlyGain,
          date: tradeDate
        })
      }
    })

    // Ensure we have at least one data point
    if (monthlyPnL.length === 0 && sortedTrades.length > 0) {
      const firstTrade = sortedTrades[0]
      const monthKey = new Date(firstTrade.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      monthlyPnL.push({
        month: monthKey,
        cumulativePnL: runningTotal,
        monthlyGain: runningTotal,
        date: new Date(firstTrade.date)
      })
    }

    // Fill in missing months to ensure continuous plot
    if (monthlyPnL.length > 1) {
      const firstDate = monthlyPnL[0].date
      const lastDate = monthlyPnL[monthlyPnL.length - 1].date
      const filledMonthlyPnL: Array<{ month: string, cumulativePnL: number, monthlyGain: number, date: Date }> = []

      let currentDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
      const endDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1)

      while (currentDate <= endDate) {
        const monthKey = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })

        // Find existing data for this month
        const existingData = monthlyPnL.find(data => data.month === monthKey)

        if (existingData) {
          filledMonthlyPnL.push(existingData)
        } else {
          // Find the cumulative P&L up to this month (carry forward last known value)
          const lastKnownData = filledMonthlyPnL[filledMonthlyPnL.length - 1]
          const cumulativePnL = lastKnownData ? lastKnownData.cumulativePnL : 0

          filledMonthlyPnL.push({
            month: monthKey,
            cumulativePnL,
            monthlyGain: 0, // No trades in this month
            date: new Date(currentDate)
          })
        }

        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1)
      }

      // Use the filled data
      monthlyPnL.length = 0
      monthlyPnL.push(...filledMonthlyPnL)
    }

    // Correct the final value to match authoritative stats if available
    if (displayMode === 'r' && stats?.totalRMultiple !== undefined && monthlyPnL.length > 0) {
      const correction = stats.totalRMultiple - runningTotal
      if (Math.abs(correction) > 0.01) { // Only correct if there's a meaningful difference
        console.log(`Correcting cumulative P&L: calculated ${runningTotal}R, authoritative ${stats.totalRMultiple}R`)
        // Apply correction to the final month
        monthlyPnL[monthlyPnL.length - 1].cumulativePnL = stats.totalRMultiple
      }
    }

    // Convert to chart data format
    const allValues = monthlyPnL.map(d => d.cumulativePnL)
    const maxValue = Math.max(...allValues, 0)
    const minValue = Math.min(0, ...allValues)
    const range = Math.max(Math.abs(maxValue - minValue), 1)

    const chartData = monthlyPnL.map((data, index) => {
      const normalizedY = 180 - ((data.cumulativePnL - minValue) / range) * 160
      const divisor = Math.max(monthlyPnL.length - 1, 1)

      return {
        month: data.month,
        value: formatDisplayValue(data.cumulativePnL, displayMode, 'currency'),
        gain: formatDisplayValue(data.monthlyGain, displayMode, 'currency'),
        x: (index / divisor) * 1000,
        y: Math.max(20, Math.min(180, normalizedY))
      }
    })

    return chartData
  }, [tradesData, mode, displayMode, stats])

  // Use the authoritative total from stats when available
  const totalPnL = useMemo(() => {
    if (displayMode === 'r' && stats?.totalRMultiple !== undefined) {
      return formatDisplayValue(stats.totalRMultiple, 'r', 'currency', {}, stats.totalRMultiple)
    }
    return pnlData.length > 0 ? pnlData[pnlData.length - 1]?.value || '$0.00' : '$0.00'
  }, [pnlData, displayMode, stats])

  return (
    <div className="studio-surface rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Cumulative P&L</h3>
        <div className="text-lg font-semibold text-trading-profit">{totalPnL}</div>
      </div>
      <div
        className="h-64 bg-[#1a1a1a] rounded relative overflow-hidden"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <svg className="w-full h-full" viewBox="0 0 1000 200">
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="100" height="40" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 40" fill="none" stroke="#333" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Area fill under the curve */}
          <defs>
            <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05"/>
            </linearGradient>
          </defs>

          {/* P&L curve with area fill */}
          {pnlData.length > 0 && (
            <path
              d={`M${pnlData.map(point => `${point.x},${point.y}`).join(' L')} L${pnlData[pnlData.length - 1]?.x || 1000},200 L0,200 Z`}
              fill="url(#pnlGradient)"
            />
          )}

          {/* P&L line */}
          {pnlData.length > 0 && (
            <path
              d={`M${pnlData.map(point => `${point.x},${point.y}`).join(' L')}`}
              stroke="#22c55e"
              strokeWidth="3"
              fill="none"
            />
          )}

          {/* Data points */}
          {pnlData.map((point, index) => (
            <circle
              key={`point-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#22c55e"
              stroke="#1a1a1a"
              strokeWidth="2"
            />
          ))}

          {/* Invisible hover areas for interaction */}
          {pnlData.map((point, index) => (
            <rect
              key={index}
              x={point.x - 50}
              y="0"
              width="100"
              height="200"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={(e) => {
                setHoveredPoint({
                  ...point,
                  x: point.x,
                  y: point.y
                })
              }}
            />
          ))}
        </svg>

        {/* Enhanced hover tooltip */}
        {hoveredPoint && (
          <div
            className="absolute bg-gray-900/95 backdrop-blur-sm text-white text-xs px-4 py-3 rounded-lg shadow-2xl border border-gray-700/50 pointer-events-none z-20 transition-all duration-200 scale-100"
            style={{
              left: `${(hoveredPoint.x / 1000) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
          >
            <div className="font-semibold text-gray-200 mb-1">{hoveredPoint.month}</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-trading-profit rounded-full"></div>
              <span className="text-gray-300">Total:</span>
              <span className="font-semibold text-trading-profit">{hoveredPoint.value}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-300">Gain:</span>
              <span className="font-semibold text-blue-400">{hoveredPoint.gain}</span>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900/95 border-r border-b border-gray-700/50 rotate-45"></div>
          </div>
        )}


        {/* Y-axis labels - improved visibility */}
        <div className="absolute left-2 top-2 text-xs text-gray-300 font-medium">$400K</div>
        <div className="absolute left-2 top-12 text-xs text-gray-300 font-medium">$350K</div>
        <div className="absolute left-2 top-20 text-xs text-gray-300 font-medium">$300K</div>
        <div className="absolute left-2 top-28 text-xs text-gray-300 font-medium">$250K</div>
        <div className="absolute left-2 top-36 text-xs text-gray-300 font-medium">$200K</div>
        <div className="absolute left-2 top-44 text-xs text-gray-300 font-medium">$150K</div>
        <div className="absolute left-2 top-52 text-xs text-gray-300 font-medium">$100K</div>
        <div className="absolute left-2 top-60 text-xs text-gray-300 font-medium">$50K</div>
        <div className="absolute left-2 bottom-8 text-xs text-gray-300 font-medium">$0</div>

        {/* X-axis labels - dynamic based on actual data */}
        {pnlData.length > 0 && (() => {
          const labelPositions = [0, 0.25, 0.5, 0.75, 1]
          const dataPointsPerLabel = Math.max(1, Math.floor((pnlData.length - 1) / 4))

          return labelPositions.map((position, index) => {
            const dataIndex = index === 4 ? pnlData.length - 1 : Math.min(index * dataPointsPerLabel, pnlData.length - 1)
            const label = pnlData[dataIndex]?.month || ''
            const leftPosition = position === 0 ? 'left-4' :
                                position === 0.25 ? 'left-1/4' :
                                position === 0.5 ? 'left-1/2' :
                                position === 0.75 ? 'left-3/4' : 'right-4'

            return (
              <div key={index} className={`absolute bottom-2 ${leftPosition} text-xs text-gray-300 font-medium`}>
                {label}
              </div>
            )
          })
        })()}

        {/* Axis lines */}
        <div className="absolute left-8 top-0 w-px h-full bg-studio-border opacity-50"></div>
        <div className="absolute bottom-8 left-0 w-full h-px bg-studio-border opacity-50"></div>
      </div>
    </div>
  )
}

// Drawdown chart component with hover functionality
function DrawdownChart({ tradesData, mode, displayMode, stats }: { tradesData: TraderraTrade[], mode: 'gross' | 'net', displayMode: any, stats?: any }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ month: string, drawdown: string, portfolio: string, x: number, y: number } | null>(null)

  // Generate drawdown data from real trades
  const { drawdownData, maxDrawdown } = useMemo(() => {
    if (!tradesData || tradesData.length === 0) {
      return { drawdownData: [], maxDrawdown: 0 }
    }

    // Sort trades by date to ensure chronological order
    const sortedTrades = [...tradesData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate running P&L and drawdown by week/month
    let runningPnL = 0
    let peak = 0
    let maxDrawdownValue = 0
    const weeklyData: Array<{ date: Date, pnL: number, drawdown: number, drawdownAmount: number, peak: number }> = []

    // Process trades to calculate weekly drawdown snapshots
    let currentWeek = ''
    let weeklyPnL = 0

    sortedTrades.forEach((trade, index) => {
      const tradeDate = new Date(trade.date)
      const weekKey = `${tradeDate.getFullYear()}-W${Math.ceil((tradeDate.getDate()) / 7)}-${tradeDate.getMonth()}`
      // Use the correct value based on display mode: R-multiple for 'r' mode, dollar value for others
      const tradePnL = displayMode === 'r' ? getRMultipleValue(trade, mode) : getPnLValue(trade, mode)

      runningPnL += tradePnL

      // Update peak if we're at a new high
      if (runningPnL > peak) {
        peak = runningPnL
      }

      // Calculate drawdown as percentage from peak (absolute value since drawdown is always negative or zero)
      const currentDrawdown = peak > 0 ? Math.min(0, ((runningPnL - peak) / Math.abs(peak)) * 100) : 0
      // Calculate actual R drawdown amount that corresponds to the percentage
      // If drawdown is -20%, then drawdownAmount = peak * 0.20 (positive value representing the loss)
      const currentDrawdownAmount = peak > 0 ? Math.abs(currentDrawdown / 100) * Math.abs(peak) : 0

      // Track maximum drawdown (most negative value)
      if (currentDrawdown < maxDrawdownValue) {
        maxDrawdownValue = currentDrawdown
      }

      // Check if this is a new week or the last trade
      const isNewWeek = weekKey !== currentWeek
      const isLastTrade = index === sortedTrades.length - 1

      if (isNewWeek && currentWeek !== '') {
        // Save the previous week's data
        const prevWeekPnL = runningPnL - tradePnL
        const prevWeekDrawdownPercent = peak > 0 ? Math.min(0, ((prevWeekPnL - peak) / Math.abs(peak)) * 100) : 0
        const prevWeekDrawdownAmount = peak > 0 ? Math.abs(prevWeekDrawdownPercent / 100) * Math.abs(peak) : 0
        weeklyData.push({
          date: new Date(sortedTrades[index - 1].date),
          pnL: prevWeekPnL,
          drawdown: prevWeekDrawdownPercent,
          drawdownAmount: prevWeekDrawdownAmount,
          peak
        })
      }

      currentWeek = weekKey

      // If this is the last trade, add the final week
      if (isLastTrade) {
        weeklyData.push({
          date: tradeDate,
          pnL: runningPnL,
          drawdown: currentDrawdown,
          drawdownAmount: currentDrawdownAmount,
          peak
        })
      }
    })

    // Ensure we have at least one data point
    if (weeklyData.length === 0 && sortedTrades.length > 0) {
      const finalTrade = sortedTrades[sortedTrades.length - 1]
      const finalDrawdownPercent = peak > 0 ? Math.min(0, ((runningPnL - peak) / Math.abs(peak)) * 100) : 0
      const finalDrawdownAmount = peak > 0 ? Math.abs(finalDrawdownPercent / 100) * Math.abs(peak) : 0
      weeklyData.push({
        date: new Date(finalTrade.date),
        pnL: runningPnL,
        drawdown: finalDrawdownPercent,
        drawdownAmount: finalDrawdownAmount,
        peak
      })
    }

    // Convert to chart data format
    const allDrawdowns = weeklyData.map(d => Math.abs(d.drawdown))
    const maxAbsDrawdown = Math.max(...allDrawdowns, 1)

    const chartData = weeklyData.map((data, index) => {
      const month = data.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const normalizedY = 20 + (Math.abs(data.drawdown) / maxAbsDrawdown) * 140
      const divisor = Math.max(weeklyData.length - 1, 1)

      return {
        month,
        drawdown: `${Math.abs(data.drawdown).toFixed(1)}%`,
        portfolio: formatDisplayValue(data.drawdownAmount, displayMode, 'currency'),
        x: (index / divisor) * 1000,
        y: Math.min(180, Math.max(20, normalizedY))
      }
    })

    // Use authoritative max drawdown from stats when available
    let authoritativeMaxDrawdown = Math.abs(maxDrawdownValue)
    if (stats) {
      if (displayMode === 'r' && stats.maxDrawdownR !== undefined) {
        authoritativeMaxDrawdown = Math.abs(stats.maxDrawdownR)
      } else if (displayMode !== 'r' && stats.maxDrawdown !== undefined) {
        authoritativeMaxDrawdown = Math.abs(stats.maxDrawdown)
      }
    }

    return { drawdownData: chartData, maxDrawdown: authoritativeMaxDrawdown }
  }, [tradesData, mode, displayMode, stats])

  const maxDrawdownPoint = drawdownData.find(d => d.y === Math.max(...drawdownData.map(p => p.y)))

  return (
    <div className="studio-surface rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold studio-text">Cumulative Drawdown</h2>
        <div className="text-lg font-semibold text-trading-loss">{maxDrawdown.toFixed(1)}%</div>
      </div>
      <div
        className="h-64 bg-[#1a1a1a] rounded relative overflow-hidden"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <svg className="w-full h-full" viewBox="0 0 1000 200">
          {/* Drawdown area fill */}
          <defs>
            <linearGradient id="drawdownGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1"/>
            </linearGradient>
          </defs>

          {/* Zero line */}
          <line x1="0" y1="20" x2="1000" y2="20" stroke="#666" strokeWidth="1" strokeDasharray="3,3"/>

          {/* Drawdown path - more vertical scaling */}
          {drawdownData.length > 0 && (
            <>
              <path
                d={`M${drawdownData.map(point => `${point.x},${point.y}`).join(' L')} L${drawdownData[drawdownData.length - 1]?.x || 1000},20 L0,20 Z`}
                fill="url(#drawdownGradient)"
              />
              <path
                d={`M${drawdownData.map(point => `${point.x},${point.y}`).join(' L')}`}
                stroke="#ef4444"
                strokeWidth="2"
                fill="none"
              />
            </>
          )}

          {/* Maximum drawdown point only */}
          {maxDrawdownPoint && (
            <circle
              cx={maxDrawdownPoint.x}
              cy={maxDrawdownPoint.y}
              r="4"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="2"
            />
          )}

          {/* Invisible hover areas for interaction */}
          {drawdownData.map((point, index) => (
            <rect
              key={index}
              x={point.x - 25}
              y="0"
              width="50"
              height="200"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                setHoveredPoint({
                  ...point,
                  x: rect.left + 25,
                  y: rect.top
                })
              }}
            />
          ))}
        </svg>

        {/* Enhanced hover tooltip for drawdown */}
        {hoveredPoint && (
          <div
            className="absolute bg-gray-900/95 backdrop-blur-sm text-white text-xs px-4 py-3 rounded-lg shadow-2xl border border-gray-700/50 pointer-events-none z-20 transition-all duration-200 scale-100"
            style={{
              left: `${(hoveredPoint.x / 1000) * 100}%`,
              top: '10px',
              transform: 'translateX(-50%)',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
          >
            <div className="font-semibold text-gray-200 mb-1">{hoveredPoint.month}</div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-trading-loss rounded-full"></div>
              <span className="text-gray-300">Drawdown:</span>
              <span className="font-semibold text-trading-loss">{hoveredPoint.drawdown}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-300">Portfolio:</span>
              <span className="font-semibold text-yellow-400">{hoveredPoint.portfolio}</span>
            </div>
            {/* Tooltip arrow */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900/95 border-r border-b border-gray-700/50 rotate-45"></div>
          </div>
        )}


        {/* Y-axis labels - improved visibility with drawdown data */}
        <div className="absolute left-2 top-4 text-xs text-gray-300 font-medium">0%</div>
        <div className="absolute left-2 top-12 text-xs text-gray-300 font-medium">-1%</div>
        <div className="absolute left-2 top-20 text-xs text-gray-300 font-medium">-2%</div>
        <div className="absolute left-2 top-28 text-xs text-gray-300 font-medium">-3%</div>
        <div className="absolute left-2 top-36 text-xs text-gray-300 font-medium">-4%</div>
        <div className="absolute left-2 top-44 text-xs text-gray-300 font-medium">-5%</div>
        <div className="absolute left-2 top-52 text-xs text-gray-300 font-medium">-6%</div>
        <div className="absolute left-2 top-60 text-xs text-gray-300 font-medium">-7%</div>
        <div className="absolute left-2 top-68 text-xs text-gray-300 font-medium">-8%</div>
        <div className="absolute left-2 top-76 text-xs text-gray-300 font-medium">-9%</div>
        <div className="absolute left-2 bottom-16 text-xs text-gray-300 font-medium">-10%</div>

        {/* X-axis labels - dynamic based on actual data */}
        {drawdownData.length > 0 && (() => {
          const labelPositions = [0, 0.25, 0.5, 0.75, 1]
          const dataPointsPerLabel = Math.max(1, Math.floor((drawdownData.length - 1) / 4))

          return labelPositions.map((position, index) => {
            const dataIndex = index === 4 ? drawdownData.length - 1 : Math.min(index * dataPointsPerLabel, drawdownData.length - 1)
            const label = drawdownData[dataIndex]?.month || ''
            const leftPosition = position === 0 ? 'left-4' :
                                position === 0.25 ? 'left-1/4' :
                                position === 0.5 ? 'left-1/2' :
                                position === 0.75 ? 'left-3/4' : 'right-4'

            return (
              <div key={index} className={`absolute bottom-2 ${leftPosition} text-xs text-gray-300 font-medium`}>
                {label}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}

// Profit Factor chart component with hover functionality
function ProfitFactorChart({ tradesData, mode }: { tradesData: TraderraTrade[], mode: 'gross' | 'net' }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ month: string, profitFactor: string, x: number, y: number } | null>(null)

  // Generate profit factor data from real trades
  const profitFactorData = useMemo(() => {
    if (!tradesData || tradesData.length === 0) {
      return { data: [], referenceLineY: 90 }
    }

    const sortedTrades = [...tradesData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const monthlyData = new Map<string, { profits: number, losses: number }>()

    sortedTrades.forEach(trade => {
      const date = new Date(trade.date)
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { profits: 0, losses: 0 })
      }

      const pnl = getPnLValue(trade, mode)
      const monthData = monthlyData.get(monthKey)!

      if (pnl > 0) {
        monthData.profits += pnl
      } else if (pnl < 0) {
        monthData.losses += Math.abs(pnl)
      }
    })

    // Convert to chart data format
    const chartData = Array.from(monthlyData.entries()).map(([month, data], index) => {
      const isInfinite = data.losses === 0 && data.profits > 0
      const profitFactor = data.losses > 0 ? data.profits / data.losses : (data.profits > 0 ? Infinity : 0)

      return {
        month,
        profitFactor,
        isInfinite,
        profits: data.profits,
        losses: data.losses
      }
    })

    // Calculate positions for the line chart (exclude infinite values from scaling)
    const finiteValues = chartData.filter(d => !d.isInfinite).map(d => d.profitFactor)
    const maxValue = finiteValues.length > 0 ? Math.max(...finiteValues, 2) : 2
    const minValue = Math.min(0, finiteValues.length > 0 ? Math.min(...finiteValues) : 0)
    const range = Math.max(maxValue - minValue, 1)

    // Calculate the Y position for the 1.0 reference line using the same scale
    const referenceLineY = 180 - ((1 - minValue) / range) * 160

    return {
      data: chartData.map((data, index) => {
        // For infinite values, position them slightly above the max finite value
        const plotValue = data.isInfinite ? maxValue * 1.1 : data.profitFactor
        const normalizedY = 180 - ((plotValue - minValue) / range) * 160
        const divisor = Math.max(chartData.length - 1, 1)

        return {
          month: data.month,
          profitFactor: data.isInfinite ? '∞' : data.profitFactor.toFixed(2),
          isInfinite: data.isInfinite,
          x: (index / divisor) * 1000,
          y: Math.max(20, Math.min(180, normalizedY))
        }
      }),
      referenceLineY: Math.max(20, Math.min(180, referenceLineY))
    }
  }, [tradesData, mode])

  return (
    <div className="studio-surface rounded-lg p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold studio-text">Profit Factor Over Time</h3>
      </div>

      <div className="relative h-72 bg-[#0a0a0a] rounded-lg overflow-hidden">
        {profitFactorData.data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            No data available
          </div>
        ) : (
          <svg
            viewBox="0 0 1000 200"
            className="w-full h-full"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            {/* Grid lines */}
            <defs>
              <pattern id="profitFactorGrid" width="50" height="40" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#profitFactorGrid)" />

            {/* Profit factor = 1.0 reference line */}
            <line x1="0" y1={profitFactorData.referenceLineY} x2="1000" y2={profitFactorData.referenceLineY} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeDasharray="6,4"/>
            <text x="10" y={profitFactorData.referenceLineY + 18} fill="rgba(255,255,255,0.8)" fontSize="16" fontWeight="600">1.0</text>

            {/* Line path */}
            {profitFactorData.data.length > 1 && (
              <polyline
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={profitFactorData.data.map(point => `${point.x},${point.y}`).join(' ')}
              />
            )}

            {/* Invisible hover areas for full column detection */}
            {profitFactorData.data.map((point, index) => {
              const totalPoints = profitFactorData.data.length
              const sectionWidth = 1000 / totalPoints
              const startX = index * sectionWidth

              return (
                <rect
                  key={`hover-${index}`}
                  x={startX}
                  y="0"
                  width={sectionWidth}
                  height="200"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
                    setHoveredPoint({
                      month: point.month,
                      profitFactor: point.profitFactor,
                      x: (point.x / 1000) * rect.width,
                      y: (point.y / 200) * rect.height
                    })
                  }}
                  onMouseLeave={() => {
                    // Don't clear immediately, let the SVG onMouseLeave handle it
                  }}
                />
              )
            })}

            {/* Data points */}
            {profitFactorData.data.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={hoveredPoint?.month === point.month ? "8" : "6"}
                fill={point.isInfinite || parseFloat(point.profitFactor) >= 1 ? "#10B981" : "#EF4444"}
                className="transition-all duration-200 pointer-events-none"
              />
            ))}
          </svg>
        )}

        {/* Hover tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-10 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg pointer-events-none"
            style={{
              left: Math.min(hoveredPoint.x + 15, 240),
              top: Math.max(Math.min(hoveredPoint.y - 40, 180), 10)
            }}
          >
            <div className="text-sm font-medium text-white">{hoveredPoint.month}</div>
            <div className="text-xs text-gray-300">
              Profit Factor: <span className={cn("font-semibold", hoveredPoint.profitFactor === '∞' || parseFloat(hoveredPoint.profitFactor) >= 1 ? "text-trading-profit" : "text-trading-loss")}>
                {hoveredPoint.profitFactor}
              </span>
            </div>
          </div>
        )}

        {/* Month labels at bottom */}
        <div className="absolute bottom-2 left-4 text-xs text-gray-300 font-medium">
          {profitFactorData.data[0]?.month}
        </div>
        <div className="absolute bottom-2 right-4 text-xs text-gray-300 font-medium">
          {profitFactorData.data[profitFactorData.data.length - 1]?.month}
        </div>

      </div>
    </div>
  )
}

// Combined chart component with improved toggle styling and scrolling
function CombinedChart({ title, distributionData, performanceData, type ="bar", displayMode }: {
  title: string
  distributionData: any[]
  performanceData: any[]
  type?:"bar" |"horizontal" |"line"
  displayMode: any
}) {
  const [view, setView] = useState<'performance' | 'distribution'>('performance')

  const currentData = view === 'performance' ? performanceData : distributionData

  return (
    <div className="studio-surface rounded-lg p-6">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-base font-semibold studio-text truncate flex-1 min-w-0">{title}</h3>
        <div className="flex bg-gray-800/60 rounded p-0.5 w-fit border border-gray-700/50 flex-shrink-0">
          <button
            onClick={() => setView('performance')}
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded transition-all duration-300 min-w-0 whitespace-nowrap',
              view === 'performance'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
            )}
          >
            Results
          </button>
          <button
            onClick={() => setView('distribution')}
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded transition-all duration-300 min-w-0 whitespace-nowrap',
              view === 'distribution'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
            )}
          >
            Total
          </button>
        </div>
      </div>

      <div className={cn(
     "h-72 scrollbar-thin scrollbar-track-studio-bg scrollbar-thumb-studio-border",
        type ==="horizontal" ?"overflow-y-auto overflow-x-hidden" : type === "line" ? "overflow-x-auto overflow-y-hidden" : "overflow-x-auto overflow-y-hidden",
        "rounded-md"
      )}>
        {type === "line" ? (
          <div className="relative h-full p-4">
            {currentData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                No data available
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Simple line chart with connecting points */}
                <div className="flex-1 relative">
                  <div className="absolute inset-0 flex items-end justify-between pb-8">
                    {currentData.map((item, index) => {
                      const maxValue = Math.max(...currentData.map(d => d.value))
                      const minValue = Math.min(0, Math.min(...currentData.map(d => d.value)))
                      const range = Math.max(0.1, maxValue - minValue)
                      const heightPercent = Math.max(5, ((item.value - minValue) / range) * 85)

                      return (
                        <div key={index} className="relative flex flex-col items-center flex-1">
                          {/* Value label */}
                          <div className="absolute -top-6 text-xs font-medium text-white whitespace-nowrap">
                            {item.value.toFixed(2)}
                          </div>

                          {/* Data point */}
                          <div
                            className={cn(
                              "w-3 h-3 rounded-full border-2 border-white relative",
                              item.value >= 1 ? "bg-trading-profit" : "bg-trading-loss"
                            )}
                            style={{
                              marginBottom: `${heightPercent}%`,
                              transform: 'translateY(50%)'
                            }}
                          >
                            {/* Line to next point */}
                            {index < currentData.length - 1 && (
                              <div
                                className={cn(
                                  "absolute top-1/2 left-full h-0.5 origin-left",
                                  item.value >= 1 ? "bg-trading-profit" : "bg-trading-loss"
                                )}
                                style={{
                                  width: `calc(100% + ${100 / currentData.length}%)`,
                                  transform: 'translateY(-50%)'
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Profit factor = 1.0 reference line */}
                  <div className="absolute inset-x-0 border-t border-dashed border-gray-400/50"
                       style={{
                         bottom: `${Math.max(5, ((1 - Math.min(0, Math.min(...currentData.map(d => d.value)))) / Math.max(0.1, Math.max(...currentData.map(d => d.value)) - Math.min(0, Math.min(...currentData.map(d => d.value))))) * 85) + 8}%`
                       }}>
                    <span className="absolute left-2 -top-3 text-xs text-gray-400">1.0</span>
                  </div>
                </div>

                {/* Month labels */}
                <div className="flex justify-between pt-2">
                  {currentData.map((item, index) => (
                    <div key={index} className="text-xs text-gray-400 text-center flex-1">
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : type ==="horizontal" ? (
          <div className="space-y-4 py-3">
            {currentData.map((item, index) => (
              <div key={index} className="group flex items-center gap-4 hover:bg-studio-border/20 rounded-md transition-colors duration-200 px-0 py-2">
                <div className="w-28 text-xs text-gray-300 text-right flex-shrink-0 font-medium">
                  {item.label}
                </div>
                <div className="flex-1 bg-[#0f0f0f] rounded-md h-9 relative border border-studio-border/30 mr-20">
                  <div
                    className={cn(
                   "h-full rounded-md transition-all duration-500 ease-out relative overflow-hidden",
                      view === 'performance'
                        ? item.value >= 0 ?"bg-gradient-to-r from-green-600 to-green-500 shadow-sm" :"bg-gradient-to-r from-red-600 to-red-500 shadow-sm"
                        :"bg-gradient-to-r from-gray-300 to-gray-200 shadow-sm"
                    )}
                    style={{
                      width: `${Math.max(5, Math.abs(item.value) / Math.max(...currentData.map(d => Math.abs(d.value))) * 75)}%`
                    }}
                  >
                    {/* Subtle animation overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out"></div>
                  </div>
                  {/* Value positioned at the end of the bar with fixed spacing */}
                  <div
                    className="absolute top-1/2 transform -translate-y-1/2 text-xs font-semibold text-white pointer-events-none whitespace-nowrap"
                    style={{
                      left: `${Math.max(5, Math.abs(item.value) / Math.max(...currentData.map(d => Math.abs(d.value))) * 75) + 2}%`
                    }}
                  >
                    {view === 'performance'
                      ? formatDisplayValue(item.value, displayMode, 'currency', {}, displayMode === 'r' ? item.value : undefined)
                      : item.value.toLocaleString()
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(
         "flex items-end h-full gap-2 px-2 pb-8",
            currentData.length > 8 ?"min-w-[800px]" :""
          )}>
            {currentData.map((item, index) => (
              <div key={index} className={cn(
             "flex flex-col items-center relative",
                currentData.length > 8 ?"min-w-[65px] flex-shrink-0" :"flex-1"
              )}>
                <div className="absolute -top-6 text-xs studio-text font-medium whitespace-nowrap">
                  {view === 'performance'
                    ? formatDisplayValue(item.value, displayMode, 'currency', {}, displayMode === 'r' ? item.value : undefined)
                    : item.value}
                </div>
                <div
                  className={cn(
                 "w-full rounded-t transition-all duration-300",
                    view === 'performance'
                      ? item.value >= 0 ?"bg-trading-profit" :"bg-trading-loss"
                      :"bg-gray-300"
                  )}
                  style={{
                    height: `${Math.max(3, Math.abs(item.value) / Math.max(...currentData.map(d => Math.abs(d.value))) * 85)}%`
                  }}
                />
                <div className="text-xs studio-muted mt-2 text-center w-full whitespace-nowrap">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatisticsPageContent() {
  // Use chat context for persistent sidebar state
  const { isSidebarOpen: aiSidebarOpen, setIsSidebarOpen: setAiSidebarOpen } = useChatContext()
  const [reportType, setReportType] = useState('comprehensive')
  const [activeTab, setActiveTab] = useState('overview')

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    symbol: '',
    tags: '',
    side: 'All',
    duration: 'All'
  })

  // Tag analysis state
  const [selectedTag, setSelectedTag] = useState('all')

  // Load trade data and date filtering
  const { trades, isLoading: tradesLoading, error: tradesError } = useTrades()

  const { getFilteredData } = useDateRange()
  const { mode } = usePnLMode()
  const { displayMode } = useDisplayMode()

  // Apply date filtering to trades
  const filteredTrades = getFilteredData(trades || [])

  // Helper function to filter trades by selected tag
  const getTagFilteredTrades = (trades: TraderraTrade[], selectedTag: string) => {
    if (selectedTag === 'all') return trades;

    return trades.filter(trade => {
      if (trade.strategy && typeof trade.strategy === 'string' && trade.strategy !== 'Untagged') {
        const tradeTags = trade.strategy.split(',').map(tag => tag.trim());
        return tradeTags.includes(selectedTag);
      }
      return false;
    });
  }

  // Get trades filtered by selected tag for tag analysis
  const tagFilteredTrades = getTagFilteredTrades(filteredTrades, selectedTag)

  // Calculate statistics from filtered trade data
  const stats = calculateTradeStatistics(filteredTrades, mode)

  // Calculate win rate by day data - moved from JSX for proper hook usage
  const winRateByDayData = useMemo(() => {
    // Calculate win rate by day of week (Monday-Friday only) - Performance optimized
    const dayStats = {
      'Monday': { totalTrades: 0, winners: 0, totalR: 0 },
      'Tuesday': { totalTrades: 0, winners: 0, totalR: 0 },
      'Wednesday': { totalTrades: 0, winners: 0, totalR: 0 },
      'Thursday': { totalTrades: 0, winners: 0, totalR: 0 },
      'Friday': { totalTrades: 0, winners: 0, totalR: 0 }
    };

    // Cache day names array for performance
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    filteredTrades.forEach(trade => {
      // Optimized date parsing
      let dayOfWeek: number;

      if (trade.date.includes('T')) {
        // Full datetime string
        dayOfWeek = new Date(trade.date).getDay();
      } else {
        // Date-only string - optimized parsing
        const [year, month, day] = trade.date.split('-').map(Number);
        if (year && month && day) {
          dayOfWeek = new Date(year, month - 1, day).getDay();
        } else {
          dayOfWeek = new Date(trade.date).getDay();
        }
      }

      const dayName = dayNames[dayOfWeek];

      // Only process weekday trades for accuracy
      if (dayStats[dayName]) {
        const stats = dayStats[dayName];
        stats.totalTrades++;

        const pnl = getPnLValue(trade, mode);
        const rValue = getRMultipleValue(trade, mode);

        // Ensure finite values for accuracy
        if (isFinite(rValue)) {
          stats.totalR += rValue;
        }

        if (pnl > 0) stats.winners++;
      }
    });

    return Object.keys(dayStats).map(day => {
      const stats = dayStats[day];
      const winRate = stats.totalTrades > 0 ? Math.round((stats.winners / stats.totalTrades) * 100) : 0;

      // Enhanced color coding with more nuanced thresholds
      const getColorClasses = (rate: number) => {
        if (rate >= 65) return { bg: 'bg-emerald-500', text: 'text-emerald-400' };
        if (rate >= 55) return { bg: 'bg-trading-profit', text: 'text-trading-profit' };
        if (rate >= 45) return { bg: 'bg-yellow-500', text: 'text-yellow-400' };
        if (rate >= 35) return { bg: 'bg-orange-500', text: 'text-orange-400' };
        return { bg: 'bg-trading-loss', text: 'text-trading-loss' };
      };

      const colors = getColorClasses(winRate);

      return {
        day,
        winRate,
        colors,
        totalR: stats.totalR
      };
    });
  }, [filteredTrades, mode])

  // Calculate average winner size by day data - moved from JSX for proper hook usage
  const averageWinnerByDayData = useMemo(() => {
    // Calculate average winner size by day of week (Monday-Friday only) - Performance optimized
    const dayStats = {
      'Monday': { winners: 0, totalWinnerR: 0, totalR: 0 },
      'Tuesday': { winners: 0, totalWinnerR: 0, totalR: 0 },
      'Wednesday': { winners: 0, totalWinnerR: 0, totalR: 0 },
      'Thursday': { winners: 0, totalWinnerR: 0, totalR: 0 },
      'Friday': { winners: 0, totalWinnerR: 0, totalR: 0 }
    };

    // Cache day names array for performance
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    filteredTrades.forEach(trade => {
      // Optimized date parsing
      let dayOfWeek: number;

      if (trade.date.includes('T')) {
        // Full datetime string
        dayOfWeek = new Date(trade.date).getDay();
      } else {
        // Date-only string - optimized parsing
        const [year, month, day] = trade.date.split('-').map(Number);
        if (year && month && day) {
          dayOfWeek = new Date(year, month - 1, day).getDay();
        } else {
          dayOfWeek = new Date(trade.date).getDay();
        }
      }

      const dayName = dayNames[dayOfWeek];

      // Only process weekday trades for accuracy
      if (dayStats[dayName]) {
        const stats = dayStats[dayName];
        const pnl = getPnLValue(trade, mode);
        const rValue = getRMultipleValue(trade, mode);

        // Ensure finite values for accuracy
        if (isFinite(rValue)) {
          stats.totalR += rValue;
          if (pnl > 0) {
            stats.winners++;
            stats.totalWinnerR += rValue;
          }
        }
      }
    });

    // Calculate max average winner for scaling
    const avgWinners = Object.keys(dayStats).map(day => {
      const stats = dayStats[day];
      return stats.winners > 0 ? stats.totalWinnerR / stats.winners : 0;
    });
    const maxAvgWinner = Math.max(...avgWinners, 0.1); // Prevent division by zero

    return Object.keys(dayStats).map(day => {
      const stats = dayStats[day];
      const avgWinner = stats.winners > 0 ? stats.totalWinnerR / stats.winners : 0;
      const percentage = maxAvgWinner > 0 ? (avgWinner / maxAvgWinner) * 100 : 0;

      // Enhanced color coding based on R-multiple thresholds
      const getColorClasses = (rValue: number) => {
        if (rValue >= 2.0) return { bg: 'bg-emerald-500', text: 'text-emerald-400' };
        if (rValue >= 1.5) return { bg: 'bg-trading-profit', text: 'text-trading-profit' };
        if (rValue >= 1.0) return { bg: 'bg-lime-500', text: 'text-lime-400' };
        if (rValue >= 0.5) return { bg: 'bg-yellow-500', text: 'text-yellow-400' };
        if (rValue >= 0.25) return { bg: 'bg-orange-500', text: 'text-orange-400' };
        return { bg: 'bg-trading-loss', text: 'text-trading-loss' };
      };

      const colors = getColorClasses(avgWinner);

      return {
        day,
        avgWinner,
        percentage,
        colors,
        totalR: stats.totalR,
        totalTrades: stats.winners
      };
    });
  }, [filteredTrades, mode])

  // Extract unique values from trade data for dynamic filter options
  const getUniqueFilterOptions = () => {
    if (!filteredTrades || filteredTrades.length === 0) {
      return { symbols: [], tags: [], sides: [], durations: [] }
    }

    const symbols = [...new Set(filteredTrades.map(trade => trade.symbol))].sort()

    // Extract unique tags (strategy field)
    const tags = [...new Set(filteredTrades.map(trade => trade.strategy).filter(Boolean))].sort()

    // Extract unique sides
    const sides = [...new Set(filteredTrades.map(trade => trade.side))].sort()

    // Extract unique durations
    const durations = [...new Set(filteredTrades.map(trade => trade.duration).filter(Boolean))].sort()

    return { symbols, tags, sides, durations }
  }

  const filterOptions = getUniqueFilterOptions()

  // TraderVue main navigation tabs
  const mainTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'performance', label: 'Performance' },
  ]


  const handleRefreshData = () => {
    console.log('Refreshing data...')
  }

  // Generate chart data from real trade data
  const dayDistributionData = getDistributionByDay(filteredTrades)
  const dayPerformanceData = displayMode === 'r' ? getPerformanceByDayR(filteredTrades, mode) : getPerformanceByDay(filteredTrades, mode)
  const monthDistributionData = getDistributionByMonth(filteredTrades)
  const monthPerformanceData = displayMode === 'r' ? getPerformanceByMonthR(filteredTrades, mode) : getPerformanceByMonth(filteredTrades, mode)
  const hourDistributionData = getDistributionByHour(filteredTrades)
  const hourPerformanceData = displayMode === 'r' ? getPerformanceByHourR(filteredTrades, mode) : getPerformanceByHour(filteredTrades, mode)


  // Generate price-based distribution data
  const priceDistributionData = generatePriceDistribution(filteredTrades)
  const pricePerformanceData = generatePricePerformance(filteredTrades, mode)

  // Function to render content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Header Stats Section */}
            <div className="studio-surface rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold studio-text">Stats</h2>
              </div>
              <TraderVueDetailedStats stats={stats} displayMode={displayMode} trades={filteredTrades} mode={mode} />
            </div>

            {/* Time-based Charts */}
            <div className="space-y-8">
              {/* Top Row - Day and Month Analysis */}
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 min-w-0">
                  <CombinedChart
                    title="Trade Distribution by Day of Week"
                    distributionData={dayDistributionData}
                    performanceData={dayPerformanceData}
                    type="horizontal"
                    displayMode={displayMode}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <CombinedChart
                    title="Performance by Month of Year"
                    distributionData={monthDistributionData}
                    performanceData={monthPerformanceData}
                    type="horizontal"
                    displayMode={displayMode}
                  />
                </div>
              </div>

              {/* Hour Distribution and Duration Analysis - Side by Side */}
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 min-w-0">
                  <CombinedChart
                    title="Trade Distribution by Hour of Day"
                    distributionData={hourDistributionData}
                    performanceData={hourPerformanceData}
                    type="horizontal"
                    displayMode={displayMode}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <ProfitFactorChart tradesData={filteredTrades} mode={mode} />
                </div>
              </div>
            </div>
          </div>
        )

      case 'analytics':
        return (
          <div className="space-y-8">
            {/* Win/Loss Day Comparative Analysis */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold studio-text mb-2">Win vs. Lost Days</h2>
                <p className="text-sm studio-muted">Comparative analysis of winning vs losing trading days</p>
              </div>

              {(() => {
                const winLossComparison = getWinLossDayComparison(filteredTrades, mode)

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Winning Days Card */}
                    <div className="studio-surface rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-trading-profit">Winning Days</h3>
                        <div className="text-2xl font-bold text-trading-profit">
                          {winLossComparison.winningDays.count}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="studio-muted">Win Day Rate:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.overallMetrics.winDayRate.toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Avg P&L:</span>
                          <span className="studio-text font-medium">
                            {displayMode === 'r'
                              ? `+${(winLossComparison.winningDays.averagePnL / (winLossComparison.winningDays.averageRiskAmount || 100)).toFixed(2)}R`
                              : `+$${winLossComparison.winningDays.averagePnL.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Avg Trades:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.winningDays.averageTrades.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Best Day:</span>
                          <span className="studio-text font-medium">
                            {displayMode === 'r'
                              ? `+${winLossComparison.winningDays.bestDayRMultiple.toFixed(2)}R`
                              : `+$${winLossComparison.winningDays.bestDay.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Best Streak:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.winningDays.bestStreak} days
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Avg Volume:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.winningDays.averageVolume.toLocaleString()} shares
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Losing Days Card */}
                    <div className="studio-surface rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-trading-loss">Losing Days</h3>
                        <div className="text-2xl font-bold text-trading-loss">
                          {winLossComparison.losingDays.count}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="studio-muted">Loss Day Rate:</span>
                          <span className="studio-text font-medium">
                            {(100 - winLossComparison.overallMetrics.winDayRate).toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Avg P&L:</span>
                          <span className="studio-text font-medium">
                            {displayMode === 'r'
                              ? `${(winLossComparison.losingDays.averagePnL / (winLossComparison.losingDays.averageRiskAmount || 100)).toFixed(2)}R`
                              : `-$${Math.abs(winLossComparison.losingDays.averagePnL).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Avg Trades:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.losingDays.averageTrades.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Worst Day:</span>
                          <span className="studio-text font-medium">
                            {displayMode === 'r'
                              ? `${winLossComparison.losingDays.worstDayRMultiple.toFixed(2)}R`
                              : `-$${Math.abs(winLossComparison.losingDays.worstDay).toLocaleString(undefined, {minimumFractionDigits: 2})}`
                            }
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Worst Streak:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.losingDays.worstStreak} days
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="studio-muted">Avg Volume:</span>
                          <span className="studio-text font-medium">
                            {winLossComparison.losingDays.averageVolume.toLocaleString()} shares
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Overall Metrics Summary */}
              {(() => {
                const winLossComparison = getWinLossDayComparison(filteredTrades, mode)

                return (
                  <div className="studio-surface rounded-lg p-6">
                    <h3 className="text-lg font-semibold studio-text mb-4">Overall Day Analysis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold studio-text">
                          {winLossComparison.overallMetrics.totalTradingDays}
                        </div>
                        <div className="text-sm studio-muted">Total Trading Days</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold text-trading-profit">
                          {winLossComparison.overallMetrics.winDayRate.toFixed(1)}%
                        </div>
                        <div className="text-sm studio-muted">Profitable Day Rate</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold studio-text">
                          {winLossComparison.overallMetrics.profitableDayFactor.toFixed(2)}
                        </div>
                        <div className="text-sm studio-muted">Profitable Day Factor</div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl font-bold studio-text">
                          {winLossComparison.overallMetrics.avgDayVolume.toLocaleString()}
                        </div>
                        <div className="text-sm studio-muted">Avg Daily Volume</div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Unique Trading Analytics */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold studio-text mb-2">Trading Behavior Analysis</h2>
                <p className="text-sm studio-muted">Advanced patterns and insights unique to your trading style</p>
              </div>

              {/* Hourly Performance Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Win Rate by Hour Chart */}
                <div className="studio-surface rounded-lg p-6 bg-[#1a1a1a] border border-gray-700/50">
                  <h3 className="text-lg font-semibold studio-text mb-4">Win Rate by Entry Hour</h3>
                  <div className="h-64 overflow-y-auto pr-4">
                    {/* Table Headers */}
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-studio-border text-xs studio-muted">
                      <span>Time</span>
                      <div className="text-right w-24">
                        <span>W % (Total R)</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      {[
                        { hour: '4:00 AM', winRate: 45, trades: 8 },
                        { hour: '5:00 AM', winRate: 52, trades: 12 },
                        { hour: '6:00 AM', winRate: 58, trades: 18 },
                        { hour: '7:00 AM', winRate: 61, trades: 25 },
                        { hour: '8:00 AM', winRate: 65, trades: 32 },
                        { hour: '9:00 AM', winRate: 69, trades: 41 },
                        { hour: '10:00 AM', winRate: 72, trades: 38 },
                        { hour: '11:00 AM', winRate: 52, trades: 33 },
                        { hour: '12:00 PM', winRate: 41, trades: 18 },
                        { hour: '1:00 PM', winRate: 38, trades: 15 },
                        { hour: '2:00 PM', winRate: 45, trades: 28 },
                        { hour: '3:00 PM', winRate: 31, trades: 19 },
                        { hour: '4:00 PM', winRate: 24, trades: 9 }
                      ].map((data, index) => (
                        <div key={data.hour} className="flex items-center py-1 space-x-3">
                          <div className="w-16 text-xs studio-text text-right">{data.hour}</div>
                          <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                            <div
                              className={`h-full rounded-xs transition-all duration-300 ${
                                data.winRate >= 60 ? 'bg-trading-profit' :
                                data.winRate >= 45 ? 'bg-yellow-500' : 'bg-trading-loss'
                              }`}
                              style={{ width: `${data.winRate}%` }}
                            ></div>
                          </div>
                          <div className="text-right w-24">
                            <span className={`font-medium text-xs ${
                              data.winRate >= 60 ? 'text-trading-profit' :
                              data.winRate >= 45 ? 'text-yellow-400' : 'text-trading-loss'
                            }`}>{data.winRate}%</span>
                            <span className="text-xs studio-muted ml-1">({data.trades})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Average Winner Size by Hour Chart */}
                <div className="studio-surface rounded-lg p-6 bg-[#1a1a1a] border border-gray-700/50">
                  <h3 className="text-lg font-semibold studio-text mb-4">Avg Winner Size by Entry Hour</h3>
                  <div className="h-64 overflow-y-auto pr-4">
                    {/* Table Headers */}
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-studio-border text-xs studio-muted">
                      <span>Time</span>
                      <div className="text-right w-24">
                        <span>Avg W (Total)</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      {[
                        { hour: '4:00 AM', avgWinner: 280, totalWinners: 5 },
                        { hour: '5:00 AM', avgWinner: 325, totalWinners: 8 },
                        { hour: '6:00 AM', avgWinner: 385, totalWinners: 12 },
                        { hour: '7:00 AM', avgWinner: 410, totalWinners: 16 },
                        { hour: '8:00 AM', avgWinner: 445, totalWinners: 22 },
                        { hour: '9:00 AM', avgWinner: 475, totalWinners: 29 },
                        { hour: '10:00 AM', avgWinner: 485, totalWinners: 27 },
                        { hour: '11:00 AM', avgWinner: 375, totalWinners: 18 },
                        { hour: '12:00 PM', avgWinner: 180, totalWinners: 7 },
                        { hour: '1:00 PM', avgWinner: 205, totalWinners: 6 },
                        { hour: '2:00 PM', avgWinner: 290, totalWinners: 13 },
                        { hour: '3:00 PM', avgWinner: 160, totalWinners: 6 },
                        { hour: '4:00 PM', avgWinner: 95, totalWinners: 2 }
                      ].map((data, index) => (
                        <div key={data.hour} className="flex items-center py-1 space-x-3">
                          <div className="w-16 text-xs studio-text text-right">{data.hour}</div>
                          <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                            <div
                              className="bg-trading-profit h-full rounded-xs transition-all duration-300"
                              style={{ width: `${Math.min((data.avgWinner / 600) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <div className="text-right w-24">
                            <span className="font-medium text-xs text-trading-profit">
                              {displayMode === 'r' ? `${(data.avgWinner / 100).toFixed(1)}R` : `$${data.avgWinner}`}
                            </span>
                            <span className="text-xs studio-muted ml-1">({data.totalWinners})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Win Rate Analysis Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Win Rate by Day of Week Chart - Enhanced */}
                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Win Rate by Day</h3>
                  <div className="h-64 overflow-y-auto">
                    {/* Table Headers */}
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-studio-border text-xs studio-muted">
                      <span>Day</span>
                      <div className="text-right w-24">
                        <span>W % (Total R)</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                    {winRateByDayData.map(({ day, winRate, colors, totalR }) => (
                      <div key={day} className="flex items-center py-1 space-x-3">
                        <div className="w-16 text-xs studio-text text-right">{day.substring(0, 3)}</div>
                        <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                          <div
                            className={`h-full rounded-xs transition-all duration-300 ${colors.bg.replace('bg-', 'bg-').replace('-400', '-500')}`}
                            style={{ width: `${Math.min(winRate, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-right w-24">
                          <span className={`font-medium text-xs ${colors.text}`}>
                            {winRate}%
                          </span>
                          <span className="text-xs studio-muted ml-1">
                            ({totalR.toFixed(1)}R)
                          </span>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>

                {/* Average Winner Size by Day of Week Chart - Enhanced */}
                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Average Winner Size by Day</h3>
                  <div className="h-64 overflow-y-auto">
                    {/* Table Headers */}
                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-studio-border text-xs studio-muted">
                      <span>Day</span>
                      <div className="text-right w-24">
                        <span>Avg W (Total Trades)</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                    {averageWinnerByDayData.map(({ day, avgWinner, percentage, colors, totalR, totalTrades }) => (
                      <div key={day} className="flex items-center py-1 space-x-3">
                        <div className="w-16 text-xs studio-text text-right">{day.substring(0, 3)}</div>
                        <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                          <div
                            className={`h-full rounded-xs transition-all duration-300 ${colors.bg.replace('bg-', 'bg-').replace('-400', '-500')}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-right w-24">
                          <span className={`font-medium text-xs ${colors.text}`}>
                            {displayMode === 'r' ? `${avgWinner.toFixed(2)}R` : `$${(avgWinner * 100).toLocaleString()}`}
                          </span>
                          <span className="text-xs studio-muted ml-1">
                            ({totalTrades})
                          </span>
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Analytics - Enhanced Tabbed Widget */}
              <div className="studio-surface rounded-lg p-6 min-h-[600px]">
                <div className="mb-4">
                  <h2 className="text-xl font-bold studio-text mb-2">Advanced Analytics</h2>
                  <p className="text-sm studio-muted">Detailed performance analysis across different dimensions</p>
                </div>
                <TabbedWidget
                  variant="minimal"
                  tabs={[
                    {
                      id: 'tags',
                      label: 'Tag Analysis',
                      icon: BarChart3,
                      component: WinRateAnalysisChart,
                      props: { trades: filteredTrades }
                    },
                    {
                      id: 'position',
                      label: 'Position Size',
                      icon: Target,
                      component: PerformanceByPositionSizeChart,
                      props: { trades: filteredTrades }
                    },
                    {
                      id: 'price',
                      label: 'Price Buckets',
                      icon: TrendingUp,
                      component: PerformanceByPriceChart,
                      props: { trades: filteredTrades }
                    }
                  ]}
                  defaultTab="tags"
                />
              </div>
            </div>
          </div>
        )

      case 'performance':
        return (
          <div className="space-y-8">
            {/* Win/Loss and Expectation Row */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Win/Loss Ratio */}
              <div className="flex-1 min-w-0">
                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Win/Loss Ratio</h3>
                  <div className="flex items-center justify-center h-64">
                    <div className="relative w-48 h-48">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#ef4444"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray="151 100"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#22c55e"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray="100 151"
                          strokeDashoffset="-151"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-sm studio-muted">Win Rate</div>
                          <div className="text-lg font-semibold text-trading-profit">{formatPercentage(stats.winRate)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center space-x-4 text-sm mt-4">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-trading-profit rounded mr-2"></div>
                      <span className="">Wins: {formatPercentage(stats.winRate)}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-trading-loss rounded mr-2"></div>
                      <span className="">Losses: {formatPercentage(100 - stats.winRate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trade Expectation */}
              <div className="flex-1 min-w-0">
                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Trade Expectation</h3>
                  <div className="h-64 flex items-end">
                    <div className="w-full bg-trading-profit rounded flex items-center justify-center" style={{ height: '80%' }}>
                      <div className="text-center text-white font-semibold text-xl">
                        {displayMode === 'r'
                          ? formatDisplayValue(stats.expectancyR, 'r', 'expectancy', {}, stats.expectancyR)
                          : formatDisplayValue(stats.expectancy, displayMode, 'expectancy')
                        }
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-4 text-sm studio-muted">
                    Expected value per trade
                  </div>
                </div>
              </div>
            </div>

            {/* Cumulative P&L - Full Width */}
            <div className="w-full">
              <CumulativePLChart tradesData={filteredTrades} mode={mode} displayMode={displayMode} stats={stats} />
            </div>

            {/* Cumulative Drawdown */}
            <div className="w-full">
              <DrawdownChart tradesData={filteredTrades} mode={mode} displayMode={displayMode} stats={stats} />
            </div>
          </div>
        )

      default:
        return (
          <div className="studio-surface rounded-lg p-6">
            <h2 className="text-xl font-semibold studio-text">Tab Content</h2>
            <p className="studio-muted mt-2">Content for {activeTab} tab</p>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen studio-bg">
      {/* Main content container with top navigation */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Navigation */}
        <TopNavigation onAiToggle={() => setAiSidebarOpen(!aiSidebarOpen)} aiOpen={aiSidebarOpen} />

        {/* Page Header */}
        <div className="studio-surface border-b border-[#1a1a1a] px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold studio-text">Trading Statistics</h1>
            <div className="flex items-center space-x-4">
              <DisplayModeToggle size="sm" variant="flat" />
              <TraderViewDateSelector />
              <button
                className="btn-ghost flex items-center space-x-2"
                onClick={handleRefreshData}
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
              <div className="relative">
                <button
                  className="btn-ghost flex items-center space-x-2"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filter</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TraderVue-style Tab Navigation */}
        <div className="studio-surface border-b border-[#1a1a1a] px-6">
          <div className="flex space-x-6">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent studio-muted hover:text-studio-text hover:border-[#333]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Dropdown */}
        {showFilters && (
          <div className="studio-surface border-b border-[#1a1a1a] px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Symbol Filter */}
              <div>
                <label className="block text-sm font-medium studio-text mb-2">Symbol</label>
                <input
                  type="text"
                  placeholder="Symbol"
                  value={filters.symbol}
                  onChange={(e) => setFilters(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm studio-text placeholder-gray-500 focus:border-primary focus:outline-none"
                />
              </div>

              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium studio-text mb-2">Tags</label>
                <select
                  value={filters.tags}
                  onChange={(e) => setFilters(prev => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm studio-text focus:border-primary focus:outline-none"
                >
                  <option value="">Select</option>
                  {filterOptions.tags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>

              {/* Side Filter */}
              <div>
                <label className="block text-sm font-medium studio-text mb-2">Side</label>
                <select
                  value={filters.side}
                  onChange={(e) => setFilters(prev => ({ ...prev, side: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm studio-text focus:border-primary focus:outline-none"
                >
                  <option value="All">All</option>
                  {filterOptions.sides.map(side => (
                    <option key={side} value={side}>{side}</option>
                  ))}
                </select>
              </div>

              {/* Duration Filter */}
              <div>
                <label className="block text-sm font-medium studio-text mb-2">Duration</label>
                <select
                  value={filters.duration}
                  onChange={(e) => setFilters(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded text-sm studio-text focus:border-primary focus:outline-none"
                >
                  <option value="All">All</option>
                  {filterOptions.durations.map(duration => (
                    <option key={duration} value={duration}>{duration}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-end mt-4 pt-4 border-t border-[#1a1a1a]">
              <div className="flex space-x-2">
                <button
                  onClick={() => setFilters({ symbol: '', tags: '', side: 'All', duration: 'All' })}
                  className="px-4 py-2 text-sm studio-muted hover:studio-text transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
          <div className="w-full">
            {tradesLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="studio-muted">Loading trade data...</p>
                </div>
              </div>
            ) : tradesError ? (
              <div className="studio-surface rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold studio-text mb-2">Error Loading Data</h3>
                  <p className="studio-muted">{tradesError}</p>
                </div>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div className="studio-surface rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold studio-text mb-2">No Trade Data</h3>
                  <p className="studio-muted">Import your trades to see statistics and analytics.</p>
                </div>
              </div>
            ) : (
              renderTabContent()
            )}

            {/* Export Section */}
            <div className="mt-8 pt-6 border-t border-[#1a1a1a]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold studio-text mb-1">Export Report</h3>
                  <p className="text-sm studio-muted">Download your trading statistics and analysis</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => console.log('Export PDF...')}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export PDF</span>
                  </button>
                  <button
                    onClick={() => console.log('Export CSV...')}
                    className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors text-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => console.log('Export Excel...')}
                    className="flex items-center space-x-2 px-4 py-2 border border-[#1a1a1a] studio-text rounded hover:bg-[#1a1a1a] transition-colors text-sm"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Excel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* AI Sidebar - Renata Chat */}
      {aiSidebarOpen && (
        <div className="w-[400px] lg:w-[500px] xl:w-[480px] studio-surface border-l border-[#1a1a1a] z-40 flex-shrink-0">
          <StandaloneRenataChat />
        </div>
      )}
    </div>
  )
}


export default function StatisticsPage() {
  return <StatisticsPageContent />
}