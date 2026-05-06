'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TraderraTrade } from '@/utils/csv-parser'

interface CustomCalendarProps {
  date: Date
  onDateChange: (date: Date) => void
  className?: string
  maxDate?: Date
  trades?: TraderraTrade[]
}

export function CustomCalendar({
  date,
  onDateChange,
  className = '',
  maxDate,
  trades = []
}: CustomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(date.getFullYear(), date.getMonth()))
  const today = new Date()
  const max = maxDate || today

  // Helper function to get trades for a specific date
  const getTradesForDate = (targetDate: Date) => {
    const dateStr = targetDate.toISOString().split('T')[0]
    return trades.filter(trade => trade.date === dateStr)
  }

  // Helper function to get daily P&L for a date
  const getDailyPnL = (targetDate: Date) => {
    const dayTrades = getTradesForDate(targetDate)
    return dayTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  }

  // Helper function to check if a date has trades
  const hasTradesOnDate = (targetDate: Date) => {
    return getTradesForDate(targetDate).length > 0
  }

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()

  const days = []

  // Previous month's trailing days
  for (let i = 0; i < firstDayOfMonth; i++) {
    const prevDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -firstDayOfMonth + i + 1)
    const isDisabled = prevDate > max
    days.push(
      <button
        key={`prev-${i}`}
        disabled={isDisabled}
        className={`h-12 w-12 text-sm rounded text-center transition-colors ${
          isDisabled
            ? 'text-gray-400 cursor-not-allowed'
            : 'studio-muted hover:bg-accent'
        }`}
        onClick={() => !isDisabled && onDateChange(prevDate)}
      >
        {prevDate.getDate()}
      </button>
    )
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const isSelected = currentDate.toDateString() === date.toDateString()
    const isToday = currentDate.toDateString() === today.toDateString()
    const isDisabled = currentDate > max
    const hasTrades = hasTradesOnDate(currentDate)
    const dailyPnL = getDailyPnL(currentDate)

    days.push(
      <button
        key={day}
        disabled={isDisabled}
        className={`relative h-12 w-12 text-sm rounded text-center transition-colors ${
          isDisabled
            ? 'text-gray-400 cursor-not-allowed'
            : isSelected
            ? 'bg-primary text-primary-foreground font-semibold'
            : isToday
            ? 'bg-accent text-accent-foreground font-semibold'
            : hasTrades
            ? dailyPnL >= 0
              ? 'studio-text hover:bg-accent border-2 border-trading-profit'
              : 'studio-text hover:bg-accent border-2 border-trading-loss'
            : 'studio-text hover:bg-accent'
        }`}
        onClick={() => !isDisabled && onDateChange(currentDate)}
      >
        {day}
        {hasTrades && (
          <div className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
            dailyPnL >= 0 ? 'bg-trading-profit' : 'bg-trading-loss'
          }`} />
        )}
      </button>
    )
  }

  // Next month's leading days
  const remainingCells = 42 - days.length
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day)
    const isDisabled = nextDate > max
    days.push(
      <button
        key={`next-${day}`}
        disabled={isDisabled}
        className={`h-12 w-12 text-sm rounded text-center transition-colors ${
          isDisabled
            ? 'text-gray-400 cursor-not-allowed'
            : 'studio-muted hover:bg-accent'
        }`}
        onClick={() => !isDisabled && onDateChange(nextDate)}
      >
        {day}
      </button>
    )
  }

  return (
    <div className={`studio-surface studio-border rounded-lg p-6 shadow-lg min-w-[320px] w-max ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-2 hover:bg-accent rounded transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="font-semibold studio-text text-lg">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-2 hover:bg-accent rounded transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-4">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="h-12 w-12 text-sm studio-muted font-medium flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days}
      </div>
    </div>
  )
}