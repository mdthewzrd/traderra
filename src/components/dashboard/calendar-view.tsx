'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Calendar data for October 2025 (matching TraderVue style)
const calendarData = [
  // Week 1
  { date: 29, isCurrentMonth: false, pnl: 0, trades: 0, day: 'Tue' },
  { date: 30, isCurrentMonth: false, pnl: 0, trades: 0, day: 'Wed' },
  { date: 1, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Thu' },
  { date: 2, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Fri' },
  { date: 3, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sat' },
  { date: 4, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sun' },
  { date: 5, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Mon' },

  // Week 2
  { date: 6, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Tue' },
  { date: 7, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Wed' },
  { date: 8, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Thu' },
  { date: 9, isCurrentMonth: true, pnl: 2047.11, trades: 1, day: 'Fri' },
  { date: 10, isCurrentMonth: true, pnl: 567.43, trades: 1, day: 'Sat' },
  { date: 11, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sun' },
  { date: 12, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Mon' },

  // Week 3
  { date: 13, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Tue' },
  { date: 14, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Wed' },
  { date: 15, isCurrentMonth: true, pnl: 485.20, trades: 2, day: 'Thu' },
  { date: 16, isCurrentMonth: true, pnl: -125.80, trades: 1, day: 'Fri' },
  { date: 17, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sat' },
  { date: 18, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sun' },
  { date: 19, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Mon' },

  // Week 4
  { date: 20, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Tue' },
  { date: 21, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Wed' },
  { date: 22, isCurrentMonth: true, pnl: 825.45, trades: 3, day: 'Thu' },
  { date: 23, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Fri' },
  { date: 24, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sat' },
  { date: 25, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sun' },
  { date: 26, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Mon' },

  // Week 5
  { date: 27, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Tue' },
  { date: 28, isCurrentMonth: true, pnl: 1485.75, trades: 4, day: 'Wed' },
  { date: 29, isCurrentMonth: true, pnl: -85.20, trades: 1, day: 'Thu' },
  { date: 30, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Fri' },
  { date: 31, isCurrentMonth: true, pnl: 0, trades: 0, day: 'Sat' },
  { date: 1, isCurrentMonth: false, pnl: 0, trades: 0, day: 'Sun' },
  { date: 2, isCurrentMonth: false, pnl: 0, trades: 0, day: 'Mon' },
]

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarDayProps {
  date: number
  isCurrentMonth: boolean
  pnl: number
  trades: number
  day: string
}

function CalendarDay({ date, isCurrentMonth, pnl, trades, day }: CalendarDayProps) {
  const hasActivity = trades > 0
  const isPositive = pnl > 0
  const isNegative = pnl < 0

  return (
    <div className={cn(
      'aspect-square min-h-[180px] p-4 border border-gray-600 hover:bg-[#0f0f0f] transition-colors flex flex-col',
      !isCurrentMonth && 'opacity-30'
    )}>
      {/* Date Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn(
          'text-sm font-medium',
          isCurrentMonth ? 'studio-text' : 'studio-muted'
        )}>
          {date}
        </span>
        <span className="text-xs studio-muted">{day}</span>
      </div>

      {/* Trading Activity */}
      <div className="flex-1 flex flex-col justify-center">
        {hasActivity ? (
          <div className="space-y-2">
            {/* P&L */}
            <div className={cn(
              'text-base font-bold text-center py-2 px-2 rounded',
              isPositive && 'text-trading-profit bg-green-900/20',
              isNegative && 'text-trading-loss bg-red-900/20'
            )}>
              {pnl > 0 ? '+' : ''}${pnl.toLocaleString()}
            </div>

            {/* Trade Count */}
            <div className="text-center">
              <span className="text-xs studio-muted">
                {trades} trade{trades !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center bg-[#2a2a2a] rounded p-2">
            <span className="text-xs text-[#999999]">No trades</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function TradingCalendar() {
  const totalPnL = calendarData
    .filter(day => day.isCurrentMonth)
    .reduce((sum, day) => sum + day.pnl, 0)

  const totalTrades = calendarData
    .filter(day => day.isCurrentMonth)
    .reduce((sum, day) => sum + day.trades, 0)

  return (
    <div className="studio-surface rounded-lg p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold studio-text">October 2025</h3>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm studio-muted">
            Total: <span className={cn(
              'font-bold ',
              totalPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'
            )}>
              ${totalPnL.toLocaleString()}
            </span>
          </div>
          <div className="text-sm studio-muted">
            {totalTrades} trades
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1 hover:bg-[#1a1a1a] rounded">
              <ChevronLeft className="h-4 w-4 studio-muted" />
            </button>
            <button className="p-1 hover:bg-[#1a1a1a] rounded">
              <ChevronRight className="h-4 w-4 studio-muted" />
            </button>
          </div>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-2">
        {daysOfWeek.map(day => (
          <div key={day} className="p-2 text-center">
            <span className="text-sm font-medium studio-muted">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0 bg-black border border-gray-600 rounded-lg overflow-hidden">
        {calendarData.map((day, index) => (
          <CalendarDay
            key={index}
            date={day.date}
            isCurrentMonth={day.isCurrentMonth}
            pnl={day.pnl}
            trades={day.trades}
            day={day.day}
          />
        ))}
      </div>

      {/* Calendar Summary */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#1a1a1a]">
        <div className="text-center">
          <div className="text-sm studio-muted mb-1">Trading Days</div>
          <div className="text-lg font-bold studio-text">
            {calendarData.filter(day => day.isCurrentMonth && day.trades > 0).length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm studio-muted mb-1">Winning Days</div>
          <div className="text-lg font-bold text-trading-profit">
            {calendarData.filter(day => day.isCurrentMonth && day.pnl > 0).length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm studio-muted mb-1">Losing Days</div>
          <div className="text-lg font-bold text-trading-loss">
            {calendarData.filter(day => day.isCurrentMonth && day.pnl < 0).length}
          </div>
        </div>
      </div>
    </div>
  )
}