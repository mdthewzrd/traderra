'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDateRange, type DateRangeOption } from '@/contexts/TraderraContext'

interface DateRangeSelectorProps {
  className?: string
  showLabel?: boolean
}

const PRESET_RANGES = [
  { label: 'Today', value: 'today' as DateRangeOption },
  { label: 'This Week', value: 'week' as DateRangeOption },
  { label: 'This Month', value: 'month' as DateRangeOption },
  { label: 'This Quarter', value: 'quarter' as DateRangeOption },
  { label: 'This Year', value: 'year' as DateRangeOption },
  { label: '90 Days', value: '90day' as DateRangeOption },
  { label: 'All Time', value: 'all' as DateRangeOption },
  { label: 'Custom Range', value: 'custom' as DateRangeOption },
]

// Enhanced calendar component with professional styling

function Calendar2({ date, onDateChange, className = '', maxDate }: {
  date: Date,
  onDateChange: (date: Date) => void,
  className?: string,
  maxDate?: Date
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date(date.getFullYear(), date.getMonth()))
  const today = new Date()
  const max = maxDate || today

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
        className={`h-8 w-8 text-xs rounded text-center transition-colors ${
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

    days.push(
      <button
        key={day}
        disabled={isDisabled}
        className={`h-8 w-8 text-xs rounded text-center transition-colors ${
          isDisabled
            ? 'text-gray-400 cursor-not-allowed'
            : isSelected
            ? 'bg-primary text-primary-foreground'
            : isToday
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'studio-text hover:bg-accent'
        }`}
        onClick={() => !isDisabled && onDateChange(currentDate)}
      >
        {day}
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
        className={`h-8 w-8 text-xs rounded text-center transition-colors ${
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
    <div className={`studio-surface studio-border rounded-lg p-4 shadow-studio ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="font-semibold studio-text">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="h-8 w-8 text-xs studio-muted font-medium flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days}
      </div>
    </div>
  )
}

export function DateRangeSelector({ className = '', showLabel = true }: DateRangeSelectorProps) {
  const {
    selectedRange,
    currentDateRange,
    customStartDate,
    customEndDate,
    setDateRange,
    setCustomRange,
    getDateRangeLabel
  } = useDateRange()

  // CRITICAL: Debug logging to check if component receives context updates
  useEffect(() => {
    console.log('🎯 DateRangeSelector: Component re-rendered with context:', {
      selectedRange,
      currentDateRangeLabel: currentDateRange.label,
      getDateRangeLabel: getDateRangeLabel()
    })
  }, [selectedRange, currentDateRange, getDateRangeLabel])

  const [isOpen, setIsOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [tempCustomStart, setTempCustomStart] = useState(customStartDate || new Date())
  const [tempCustomEnd, setTempCustomEnd] = useState(customEndDate || new Date())
  const [highlightedRange, setHighlightedRange] = useState<DateRangeOption | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCustom(false)
        setHighlightedRange(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handlePresetSelect = (preset: DateRangeOption) => {
    if (preset === 'custom') {
      setShowCustom(true)
      setHighlightedRange('custom')
      // Initialize temp dates if they're not set
      if (!customStartDate || !customEndDate) {
        const today = new Date()
        const lastMonth = new Date(today)
        lastMonth.setMonth(today.getMonth() - 1)
        setTempCustomStart(lastMonth)
        setTempCustomEnd(today)
      }
    } else {
      setHighlightedRange(preset)
      setDateRange(preset)
      // Small delay to allow the highlight to update before closing
      setTimeout(() => {
        setIsOpen(false)
        setShowCustom(false)
        setHighlightedRange(null)
      }, 50)
    }
  }

  const handleCustomApply = () => {
    setCustomRange(tempCustomStart, tempCustomEnd)
    setIsOpen(false)
    setShowCustom(false)
    setHighlightedRange(null)
  }

  const handleCustomCancel = () => {
    setShowCustom(false)
    setHighlightedRange(null)
    // Reset temp dates to current custom dates
    setTempCustomStart(customStartDate || new Date())
    setTempCustomEnd(customEndDate || new Date())
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        data-testid="date-range-selector"
        onClick={() => {
          setIsOpen(!isOpen)
          setHighlightedRange(null)
        }}
        className="flex items-center space-x-2 px-4 py-2 studio-surface studio-border rounded-lg hover:bg-accent transition-colors min-w-[200px]"
      >
        <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
        {showLabel && (
          <span className="studio-text font-medium truncate">
            {getDateRangeLabel()}
          </span>
        )}
        <ChevronDown className="h-4 w-4 studio-muted flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 studio-surface studio-border rounded-lg shadow-studio-lg z-50 min-w-[400px]">
          {!showCustom ? (
            <div className="p-4">
              <div className="space-y-1">
                {PRESET_RANGES.map(range => (
                  <button
                    key={range.value}
                    data-testid={`date-range-${range.value}`}
                    onClick={() => handlePresetSelect(range.value)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      highlightedRange === range.value || selectedRange === range.value
                        ? 'bg-accent text-accent-foreground'
                        : 'studio-text hover:bg-accent'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold studio-text">Custom Range</h3>
                <button
                  onClick={handleCustomCancel}
                  className="text-sm studio-muted hover:studio-text transition-colors"
                >
                  Back
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm studio-muted mb-2">Start Date</label>
                  <Calendar2
                    date={tempCustomStart}
                    onDateChange={setTempCustomStart}
                    maxDate={tempCustomEnd}
                  />
                </div>
                <div>
                  <label className="block text-sm studio-muted mb-2">End Date</label>
                  <Calendar2
                    date={tempCustomEnd}
                    onDateChange={setTempCustomEnd}
                    maxDate={new Date()}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-4 pt-4 border-t studio-border">
                <button
                  onClick={handleCustomCancel}
                  className="px-4 py-2 text-sm studio-muted hover:studio-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomApply}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  disabled={tempCustomStart > tempCustomEnd}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}