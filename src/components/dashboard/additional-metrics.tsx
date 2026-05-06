'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from 'recharts'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { TraderraTrade } from '@/utils/csv-parser'
import { useDateRange } from '@/contexts/TraderraContext'
import { useDisplayMode } from '@/contexts/TraderraContext'
import { usePnLMode } from '@/contexts/TraderraContext'
import { getPnLValue, getRMultipleValue } from '@/utils/trade-statistics'

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="studio-surface studio-border rounded-lg p-3 shadow-studio">
        <p className="text-sm studio-muted">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="ml-1">
              {entry.value}
            </span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Performance by Day of Week - Fixed logic
export function DayOfWeekChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  const dayOfWeekData = useMemo(() => {
    const filteredTrades = getFilteredData(trades)

    const dayStats = {
      'Monday': { pnl: 0, rMultiple: 0, trades: 0 },
      'Tuesday': { pnl: 0, rMultiple: 0, trades: 0 },
      'Wednesday': { pnl: 0, rMultiple: 0, trades: 0 },
      'Thursday': { pnl: 0, rMultiple: 0, trades: 0 },
      'Friday': { pnl: 0, rMultiple: 0, trades: 0 }
    }

    filteredTrades.forEach(trade => {
      // Parse the date correctly - handle ISO date strings without timezone conversion
      // If trade.date is in format "2025-10-11", parse it as local date
      let dayOfWeek: number
      let dayName: string

      if (trade.date.includes('T')) {
        // Full datetime string
        const date = new Date(trade.date)
        dayOfWeek = date.getDay()
      } else {
        // Date-only string like "2025-10-11" - parse as local date to avoid timezone shifts
        const dateParts = trade.date.split('-')
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0])
          const month = parseInt(dateParts[1]) - 1 // Month is 0-indexed
          const day = parseInt(dateParts[2])
          const localDate = new Date(year, month, day)
          dayOfWeek = localDate.getDay()
        } else {
          // Fallback to regular Date parsing
          const date = new Date(trade.date)
          dayOfWeek = date.getDay()
        }
      }

      // Only include weekdays (Monday-Friday)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      dayName = dayNames[dayOfWeek]

      // Debug logging for all trades to see what's happening
      if (trade.date.includes('2025-10') || trade.date.includes('2024-10')) {
        console.log('Processing trade:', {
          date: trade.date,
          dayOfWeek,
          dayName,
          symbol: trade.symbol,
          pnl: trade.pnl
        })
      }

      // Only process trading days (Mon-Fri)
      if (dayName && dayStats[dayName as keyof typeof dayStats]) {
        const pnl = getPnLValue(trade, mode)
        const rMultiple = getRMultipleValue(trade, mode)

        dayStats[dayName as keyof typeof dayStats].pnl += pnl
        dayStats[dayName as keyof typeof dayStats].rMultiple += rMultiple
        dayStats[dayName as keyof typeof dayStats].trades += 1
      }
    })

    // Debug logging to show final day stats
    console.log('Final day stats:', dayStats)

    // Ensure all weekdays are always shown in the correct order
    const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    return orderedDays.map(day => ({
      day: day.slice(0, 3), // Mon, Tue, etc.
      value: displayMode === 'r' ? dayStats[day].rMultiple : dayStats[day].pnl,
      formattedValue: displayMode === 'r'
        ? `${dayStats[day].rMultiple.toFixed(2)}R`
        : `$${dayStats[day].pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      trades: dayStats[day].trades
    }))
  }, [trades, getFilteredData, displayMode, mode])

  const formatValue = (value: number) => {
    if (displayMode === 'r') {
      return `${value.toFixed(2)}R`
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="w-full h-[300px]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold studio-text">Performance by Day of Week</h3>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dayOfWeekData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="day"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#2a2a2a' }}
            axisLine={{ stroke: '#2a2a2a' }}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#2a2a2a' }}
            axisLine={{ stroke: '#2a2a2a' }}
            tickFormatter={formatValue}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 shadow-lg">
                    <p className="text-sm studio-muted">{label}</p>
                    <p className="text-sm">
                      <span className="font-medium text-white">Value: </span>
                      <span>{data.formattedValue}</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-white">Trades: </span>
                      <span>{data.trades}</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {dayOfWeekData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Performance by Month - Very valuable for tracking long-term trends
export function MonthlyPerformanceChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  const monthlyData = useMemo(() => {
    // Work directly with trades instead of using date range filtering
    if (!trades || trades.length === 0) {
      return []
    }

    const monthStats: { [key: string]: { pnl: number, rMultiple: number, trades: number } } = {}

    // Process only actual trades, no empty months
    trades.forEach(trade => {
      const date = new Date(trade.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthStats[monthKey]) {
        monthStats[monthKey] = { pnl: 0, rMultiple: 0, trades: 0 }
      }

      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)

      monthStats[monthKey].pnl += pnl
      monthStats[monthKey].rMultiple += rMultiple
      monthStats[monthKey].trades += 1
    })

    // Convert to array and sort by chronological order
    return Object.entries(monthStats)
      .map(([monthKey, stats]) => {
        const [year, month] = monthKey.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1, 1)
        const monthLabel = date.toLocaleDateString('en-US', { year: '2-digit', month: 'short' })

        return {
          month: monthLabel,
          value: displayMode === 'r' ? stats.rMultiple : stats.pnl,
          formattedValue: displayMode === 'r'
            ? `${stats.rMultiple.toFixed(2)}R`
            : `$${stats.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          trades: stats.trades,
          sortKey: monthKey
        }
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [trades, displayMode, mode])

  return (
    <div className="w-full h-[300px]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold studio-text">Monthly Performance</h3>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <XAxis
            dataKey="month"
            tick={{ fill: '#666666', fontSize: 10 }}
            tickLine={{ stroke: '#2a2a2a' }}
            axisLine={{ stroke: '#2a2a2a' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#2a2a2a' }}
            axisLine={{ stroke: '#2a2a2a' }}
            tickFormatter={(value) => displayMode === 'r' ? `${value}R` : `$${value.toLocaleString()}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 shadow-lg">
                    <p className="text-sm studio-muted">{label}</p>
                    <p className="text-sm">
                      <span className="font-medium text-white">P&L: </span>
                      <span>{data.formattedValue}</span>
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-white">Trades: </span>
                      <span>{data.trades}</span>
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {monthlyData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#22c55e' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Performance by Stock Price - Like TraderVue's price buckets
export function PerformanceByPriceChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  const priceData = useMemo(() => {
    const filteredTrades = getFilteredData(trades)

    const priceBuckets = {
      '< $2.00': { pnl: 0, rMultiple: 0, trades: 0 },
      '$2 - $4.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$5 - $9.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$10 - $19.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$20 - $49.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$50 - $99.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$100 - $149.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$150 - $199.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$200 - $249.99': { pnl: 0, rMultiple: 0, trades: 0 },
      '$250+': { pnl: 0, rMultiple: 0, trades: 0 }
    }

    filteredTrades.forEach(trade => {
      const price = trade.entryPrice
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)

      let bucket: keyof typeof priceBuckets
      if (price < 2) bucket = '< $2.00'
      else if (price < 5) bucket = '$2 - $4.99'
      else if (price < 10) bucket = '$5 - $9.99'
      else if (price < 20) bucket = '$10 - $19.99'
      else if (price < 50) bucket = '$20 - $49.99'
      else if (price < 100) bucket = '$50 - $99.99'
      else if (price < 150) bucket = '$100 - $149.99'
      else if (price < 200) bucket = '$150 - $199.99'
      else if (price < 250) bucket = '$200 - $249.99'
      else bucket = '$250+'

      priceBuckets[bucket].pnl += pnl
      priceBuckets[bucket].rMultiple += rMultiple
      priceBuckets[bucket].trades += 1
    })

    return Object.entries(priceBuckets)
      .map(([bucket, stats]) => ({
        bucket,
        value: displayMode === 'r' ? stats.rMultiple : stats.pnl,
        formattedValue: displayMode === 'r'
          ? `${stats.rMultiple.toFixed(2)}R`
          : `$${stats.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        trades: stats.trades
      }))
  }, [trades, getFilteredData, displayMode, mode])

  const maxAbsValue = Math.max(...priceData.map(d => Math.abs(d.value)))

  return (
    <div className="w-full h-[300px]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold studio-text">Performance by Stock Price</h3>
      </div>
      {priceData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-center">
          <div className="studio-muted">
            <p>No price data available for the selected date range</p>
            <p className="text-xs mt-2">Try expanding your date range to see more data</p>
          </div>
        </div>
      ) : (
        <div className="h-64 overflow-y-auto space-y-2 hover:scrollbar-thin hover:scrollbar-track-[#1a1a1a] hover:scrollbar-thumb-[#333333]">
          {priceData.map((entry, index) => {
            const isPositive = entry.value > 0
            const barWidth = maxAbsValue > 0 ? Math.abs(entry.value) / maxAbsValue * 100 : 0

            return (
              <div key={entry.bucket} className="flex items-center">
                <div className="w-32 text-xs studio-text text-right mr-3">
                  {entry.bucket}
                </div>
                <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                  <div
                    className={`h-full rounded-xs transition-all duration-300 ${
                      isPositive ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="ml-3 text-xs studio-text min-w-[80px] text-right">
                  {entry.formattedValue}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Average Trade P&L by Position Size - TraderVue inspired metric
export function PerformanceByPositionSizeChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  const positionSizeData = useMemo(() => {
    const filteredTrades = getFilteredData(trades)

    const sizeBuckets = {
      '0 - 49': { pnl: 0, rMultiple: 0, trades: 0 },
      '50 - 149': { pnl: 0, rMultiple: 0, trades: 0 },
      '150 - 299': { pnl: 0, rMultiple: 0, trades: 0 },
      '300 - 1K': { pnl: 0, rMultiple: 0, trades: 0 },
      '1K - 3K': { pnl: 0, rMultiple: 0, trades: 0 },
      '3K - 7K': { pnl: 0, rMultiple: 0, trades: 0 },
      '7K - 15K': { pnl: 0, rMultiple: 0, trades: 0 },
      '15K - 50K': { pnl: 0, rMultiple: 0, trades: 0 },
      '50K - 100K': { pnl: 0, rMultiple: 0, trades: 0 },
      '100K+': { pnl: 0, rMultiple: 0, trades: 0 }
    }

    filteredTrades.forEach(trade => {
      // Use volume divided by 2 to get maximum position size
      // Volume represents total shares traded (in + out), so max position = volume / 2
      const shareQuantity = Math.floor((trade.volume || Math.abs(trade.quantity || 0)) / 2)
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)

      let bucket: keyof typeof sizeBuckets
      if (shareQuantity < 50) bucket = '0 - 49'
      else if (shareQuantity < 150) bucket = '50 - 149'
      else if (shareQuantity < 300) bucket = '150 - 299'
      else if (shareQuantity < 1000) bucket = '300 - 1K'
      else if (shareQuantity < 3000) bucket = '1K - 3K'
      else if (shareQuantity < 7000) bucket = '3K - 7K'
      else if (shareQuantity < 15000) bucket = '7K - 15K'
      else if (shareQuantity < 50000) bucket = '15K - 50K'
      else if (shareQuantity < 100000) bucket = '50K - 100K'
      else bucket = '100K+'

      sizeBuckets[bucket].pnl += pnl
      sizeBuckets[bucket].rMultiple += rMultiple
      sizeBuckets[bucket].trades += 1
    })

    const result = Object.entries(sizeBuckets)
      .filter(([_, stats]) => stats.trades > 0)
      .map(([bucket, stats]) => {
        return {
          bucket,
          totalValue: displayMode === 'r' ? stats.rMultiple : stats.pnl,
          formattedValue: displayMode === 'r'
            ? `${stats.rMultiple.toFixed(2)}R`
            : `$${stats.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          trades: stats.trades,
          totalPnl: stats.pnl,
          totalR: stats.rMultiple
        }
      })

    return result
  }, [trades, getFilteredData, displayMode, mode])

  const maxAbsValue = Math.max(...positionSizeData.map(d => Math.abs(d.totalValue)))

  return (
    <div className="w-full h-[300px]">
      <div className="mb-4">
        <h3 className="text-lg font-semibold studio-text">Total P&L by Share Quantity</h3>
      </div>
      {positionSizeData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-center">
          <div className="studio-muted">
            <p>No position size data available for the selected date range</p>
            <p className="text-xs mt-2">Try expanding your date range to see more data</p>
          </div>
        </div>
      ) : (
        <div className="h-64 overflow-y-auto space-y-2 hover:scrollbar-thin hover:scrollbar-track-[#1a1a1a] hover:scrollbar-thumb-[#333333]">
          {positionSizeData.map((entry, index) => {
            const isPositive = entry.totalValue > 0
            const barWidth = maxAbsValue > 0 ? Math.abs(entry.totalValue) / maxAbsValue * 100 : 0

            return (
              <div key={entry.bucket} className="flex items-center">
                <div className="w-32 text-xs studio-text text-right mr-3">
                  {entry.bucket}
                </div>
                <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                  <div
                    className={`h-full rounded-xs transition-all duration-300 ${
                      isPositive ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="ml-3 text-xs studio-text min-w-[80px] text-right">
                  {entry.formattedValue}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Performance by Tag - Shows which strategies/setups are most profitable
export function WinRateAnalysisChart({ trades }: { trades: TraderraTrade[] }) {
  const { getFilteredData } = useDateRange()
  const { displayMode } = useDisplayMode()
  const { mode } = usePnLMode()
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc') // desc = highest first, asc = lowest first

  const tagData = useMemo(() => {
    const filteredTrades = getFilteredData(trades)

    // Aggregate performance by tags/strategies
    const tagStats: { [key: string]: { pnl: number, rMultiple: number, trades: number, wins: number } } = {}

    filteredTrades.forEach(trade => {
      const pnl = getPnLValue(trade, mode)
      const rMultiple = getRMultipleValue(trade, mode)

      // Extract tags from trade (assuming they're in notes, strategy, or tags field)
      let tags: string[] = []

      // Check for tags in various fields (split by commas)
      if (trade.strategy && trade.strategy.trim()) {
        const strategyTags = trade.strategy.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        tags.push(...strategyTags)
      }

      // Parse tags from notes if they exist (look for hashtags or comma-separated values)
      if (trade.notes) {
        // Look for hashtags
        const hashtagMatches = trade.notes.match(/#[\w-]+/g)
        if (hashtagMatches) {
          tags.push(...hashtagMatches.map(tag => tag.replace('#', '')))
        }

        // Also look for comma-separated tags in notes
        if (trade.notes.includes(',')) {
          const commaTags = trade.notes.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
          // Only add if they don't look like hashtags (which we already processed)
          const nonHashtagTags = commaTags.filter(tag => !tag.startsWith('#'))
          if (nonHashtagTags.length > 0) {
            tags.push(...nonHashtagTags)
          }
        }
      }

      // If no tags found, categorize as "Untagged"
      if (tags.length === 0) {
        tags = ['Untagged']
      }

      // Aggregate stats for each tag
      tags.forEach(tag => {
        if (!tagStats[tag]) {
          tagStats[tag] = { pnl: 0, rMultiple: 0, trades: 0, wins: 0 }
        }

        tagStats[tag].pnl += pnl
        tagStats[tag].rMultiple += rMultiple
        tagStats[tag].trades += 1
        if (pnl > 0) tagStats[tag].wins += 1
      })
    })

    // Convert to array and sort by total P&L (descending)
    return Object.entries(tagStats)
      .filter(([_, stats]) => stats.trades > 0)
      .map(([tag, stats]) => ({
        tag,
        totalValue: displayMode === 'r' ? stats.rMultiple : stats.pnl,
        formattedValue: displayMode === 'r'
          ? `${stats.rMultiple.toFixed(2)}R`
          : `$${stats.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        trades: stats.trades,
        winRate: (stats.wins / stats.trades) * 100,
        totalPnl: stats.pnl,
        totalR: stats.rMultiple
      }))
      .sort((a, b) => {
        // Sort by actual value (not absolute) to properly show winners/losers
        return sortDirection === 'desc'
          ? b.totalValue - a.totalValue  // Highest first (biggest winners first)
          : a.totalValue - b.totalValue  // Lowest first (biggest losers first)
      })
  }, [trades, getFilteredData, displayMode, mode, sortDirection])

  const maxAbsValue = Math.max(...tagData.map(d => Math.abs(d.totalValue)))

  return (
    <div className="w-full h-[300px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold studio-text">Performance by Tag</h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setSortDirection('desc')}
            className={`p-1 rounded hover:bg-[#1a1a1a] transition-colors ${
              sortDirection === 'desc' ? 'text-[#B8860B]' : 'text-gray-400'
            }`}
            title="Highest to Lowest (Best Performers First)"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => setSortDirection('asc')}
            className={`p-1 rounded hover:bg-[#1a1a1a] transition-colors ${
              sortDirection === 'asc' ? 'text-[#B8860B]' : 'text-gray-400'
            }`}
            title="Lowest to Highest (Worst Performers First)"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      {tagData.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center text-center">
          <div className="studio-muted">
            <p>No tag data available for the selected date range</p>
            <p className="text-xs mt-2">Add tags to your trades to see strategy performance</p>
          </div>
        </div>
      ) : (
        <div className="h-[400px] overflow-y-auto space-y-2 hover:scrollbar-thin hover:scrollbar-track-[#1a1a1a] hover:scrollbar-thumb-[#333333]">
          {tagData.map((entry, index) => {
            const isPositive = entry.totalValue > 0
            const barWidth = maxAbsValue > 0 ? Math.abs(entry.totalValue) / maxAbsValue * 100 : 0

            return (
              <div key={entry.tag} className="flex items-center">
                <div className="w-32 text-xs studio-text text-right mr-3 truncate">
                  {entry.tag}
                </div>
                <div className="flex-1 relative h-4 bg-[#1a1a1a] rounded-xs overflow-hidden">
                  <div
                    className={`h-full rounded-xs transition-all duration-300 ${
                      isPositive ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="ml-3 text-xs studio-text min-w-[80px] text-right">
                  {entry.formattedValue}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}