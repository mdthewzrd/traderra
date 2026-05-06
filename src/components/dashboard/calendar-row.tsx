'use client'

import { ChevronLeft, ChevronRight, Calendar, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDateRange } from '@/contexts/TraderraContext'
import { useDisplayMode } from '@/contexts/TraderraContext'
import { TraderViewDateSelector } from '@/components/ui/traderview-date-selector'
import { usePnLMode } from '@/contexts/TraderraContext'
import { getPnLValue } from '@/utils/trade-statistics'
import { useQuery } from '@tanstack/react-query'
import { TraderraTrade } from '@/utils/csv-parser'
import { DisplayModeToggle } from '@/components/ui/display-mode-toggle'


// Generate week data
const getStartOfWeek = (date: Date): Date => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = start.getDate() - day
  start.setDate(diff)
  start.setHours(0, 0, 0, 0)
  return start
}

const generateWeekData = (weekStart: Date, trades: TraderraTrade[], mode: 'gross' | 'net') => {
  const weekData = []
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  // Start from Monday (day 1) instead of Sunday (day 0)
  const mondayStart = new Date(weekStart)
  const dayOfWeek = mondayStart.getDay()
  if (dayOfWeek === 0) {
    // If weekStart is Sunday, move to Monday
    mondayStart.setDate(mondayStart.getDate() + 1)
  } else if (dayOfWeek !== 1) {
    // If weekStart is not Monday, find the previous Monday
    mondayStart.setDate(mondayStart.getDate() - (dayOfWeek - 1))
  }

  // Only show Monday through Friday (5 trading days)
  for (let i = 0; i < 5; i++) {
    const currentDate = new Date(mondayStart)
    currentDate.setDate(mondayStart.getDate() + i)
    const dateStr = currentDate.toISOString().split('T')[0]

    // Filter trades for this specific date
    const dayTrades = trades.filter(trade => trade.date === dateStr)
    const dayPnL = dayTrades.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0)
    const dayTradeCount = dayTrades.length

    weekData.push({
      date: currentDate.getDate(),
      day: dayNames[i],
      pnl: dayPnL,
      trades: dayTradeCount,
      fullDate: currentDate
    })
  }

  return weekData
}

interface CalendarDayProps {
  date: number
  day: string
  pnl: number
  trades: number
  isToday?: boolean
}

function CalendarDay({ date, day, pnl, trades, isToday }: CalendarDayProps) {
  const hasActivity = trades > 0
  const isPositive = pnl > 0
  const isNegative = pnl < 0

  return (
    <div className={cn(
      'flex-1 p-1.5 sm:p-2 text-center cursor-pointer transition-all duration-200',
      'shadow-studio-subtle hover:shadow-studio hover:bg-[#0f0f0f] hover:-translate-y-0.5',
      isToday && 'bg-primary/5 border border-primary/20 rounded-lg shadow-studio'
    )}>
      <div className="text-[10px] sm:text-xs studio-muted mb-0.5 sm:mb-1">{day}</div>
      <div className={cn(
        'text-base sm:text-lg font-semibold mb-0.5 sm:mb-1',
        isToday ? 'text-primary' : 'studio-text'
      )}>
        {date}
      </div>

      {hasActivity ? (
        <>
          <div className={cn(
            'text-xs sm:text-sm font-semibold mb-0.5 sm:mb-1',
            isPositive && 'text-green-400',
            isNegative && 'text-red-400'
          )}>
            {pnl > 0 ? '+' : ''}${Math.abs(pnl).toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-xs studio-muted">
            {trades} trade{trades !== 1 ? 's' : ''}
          </div>
        </>
      ) : (
        <div className="text-[10px] sm:text-xs text-[#999999] mt-1 sm:mt-2 bg-[#2a2a2a] rounded px-1.5 sm:px-2 py-0.5 sm:py-1">No trades</div>
      )}
    </div>
  )
}

interface CalendarRowProps {
  aiSidebarOpen?: boolean
}

export function CalendarRow({ aiSidebarOpen = false }: CalendarRowProps) {
  const { dateRange, setDateRange, currentWeekStart, setCurrentWeekStart, getCalendarLabel } = useDateRange()
  const { displayMode, setDisplayMode } = useDisplayMode()
  const { mode } = usePnLMode()

  // Fetch real trade data
  const { data: tradesData } = useQuery({
    queryKey: ['trades'],
    queryFn: async () => {
      const response = await fetch('/api/trades')
      if (!response.ok) {
        throw new Error('Failed to fetch trades')
      }
      const data = await response.json()
      return data.trades as TraderraTrade[]
    }
  })

  // Generate week data based on real trade data and current context
  const weekData = generateWeekData(currentWeekStart, tradesData || [], mode)
  const totalWeekPnL = weekData.reduce((sum, day) => sum + day.pnl, 0)
  const totalWeekTrades = weekData.reduce((sum, day) => sum + day.trades, 0)

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Navigation functions
  const handlePreviousWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() - 7)
    setCurrentWeekStart(newWeekStart)
  }

  const handleNextWeek = () => {
    const newWeekStart = new Date(currentWeekStart)
    newWeekStart.setDate(newWeekStart.getDate() + 7)
    setCurrentWeekStart(newWeekStart)
  }

  const canNavigateForward = () => {
    const nextWeekStart = new Date(currentWeekStart)
    nextWeekStart.setDate(nextWeekStart.getDate() + 7)
    return nextWeekStart <= new Date()
  }

  // Today for highlighting
  const today = new Date()
  const todayDateStr = today.toISOString().split('T')[0]

  return (
    <div className="studio-surface border-b border-[#1a1a1a] py-2 sm:py-3">
      <div className={`px-2 sm:px-3 transition-all duration-300 ${aiSidebarOpen ? 'max-w-[calc(100vw-480px)]' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1 sm:mb-2">
        <div className="flex items-center space-x-1">
          <h2 className="text-base sm:text-lg font-semibold studio-text">{getCalendarLabel()}</h2>
          <div className="flex items-center space-x-1 text-sm studio-muted">
            <span>Total:</span>
            <span className={cn(
              'font-semibold',
              totalWeekPnL >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {totalWeekPnL >= 0 ? '+' : ''}${totalWeekPnL.toLocaleString()}
            </span>
            <span>•</span>
            <span>{totalWeekTrades} trades</span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {/* Display Mode Toggle - $ % R buttons */}
          <DisplayModeToggle variant="flat" size="md" />

          {/* TraderView Date Selector with G/N toggle */}
          <TraderViewDateSelector />

          {/* Quick Import Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('openTradeUploadModal'))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md transition-colors text-sm font-medium"
            title="Import Trades from CSV"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>

          {/* Week Navigation - always available */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePreviousWeek}
              className="p-0.5 rounded transition-colors hover:bg-[#1a1a1a] studio-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm studio-muted px-2">
              {formatDateForDisplay(currentWeekStart)} - {formatDateForDisplay(new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000))}
            </span>
            <button
              onClick={handleNextWeek}
              disabled={!canNavigateForward()}
              className={cn(
                "p-0.5 rounded transition-colors",
                canNavigateForward()
                  ? "hover:bg-[#1a1a1a] studio-muted"
                  : "opacity-30 cursor-not-allowed studio-muted"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Row - always show individual days for current week */}
      <div className="flex space-x-0.5">
        {weekData.map((day, index) => {
          const dayDateStr = day.fullDate.toISOString().split('T')[0]
          return (
            <CalendarDay
              key={index}
              date={day.date}
              day={day.day}
              pnl={day.pnl}
              trades={day.trades}
              isToday={dayDateStr === todayDateStr}
            />
          )
        })}
      </div>
      </div>
    </div>
  )
}