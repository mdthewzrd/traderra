'use client'

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDateRange, type DateRangeOption } from '@/contexts/TraderraContext'
import { cn } from '@/lib/utils'
import { PnLModeToggle } from '@/components/ui/pnl-mode-toggle'

interface TraderViewDateSelectorProps {
  className?: string
}

// TraderView-style calendar component - memoized for performance
const TraderViewCalendar = memo(function TraderViewCalendar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className = ''
}: {
  startDate: Date
  endDate: Date
  onStartDateChange: (date: Date) => void
  onEndDateChange: (date: Date) => void
  className?: string
}): JSX.Element {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [isSelectingStart, setIsSelectingStart] = useState(true)
  const today = new Date()

  // Compact calendar sizing
  const daySize = "h-5 w-5 text-xs"
  const gapSize = "gap-0.5"

  useEffect(() => {
    // Set current month to today's month when component opens
    setCurrentMonth(new Date())
  }, [])

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()

  const days = []

  // Previous month's trailing days
  for (let i = 0; i < firstDayOfMonth; i++) {
    const prevDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), -firstDayOfMonth + i + 1)
    const isDisabled = prevDate > today
    days.push(
      <button
        key={`prev-${i}`}
        disabled={isDisabled}
        className={cn(
          "h-5 w-5 text-xs rounded text-center transition-colors",
          isDisabled
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-500 hover:bg-[#1a1a1a]'
        )}
        onClick={() => {
          if (!isDisabled) {
            if (isSelectingStart) {
              onStartDateChange(prevDate)
              setIsSelectingStart(false)
            } else {
              onEndDateChange(prevDate)
            }
          }
        }}
      >
        {prevDate.getDate()}
      </button>
    )
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const isStartDate = currentDate.toDateString() === startDate.toDateString()
    const isEndDate = currentDate.toDateString() === endDate.toDateString()
    const isInRange = currentDate >= startDate && currentDate <= endDate && startDate !== endDate
    const isToday = currentDate.toDateString() === today.toDateString()
    const isDisabled = currentDate > today

    days.push(
      <button
        key={day}
        disabled={isDisabled}
        className={cn(
          "h-5 w-5 text-xs rounded text-center transition-colors relative",
          isDisabled
            ? 'text-gray-600 cursor-not-allowed'
            : isStartDate || isEndDate
            ? 'bg-primary text-primary-foreground font-semibold'
            : isInRange
            ? 'bg-primary/20 text-primary'
            : isToday
            ? 'bg-[#1a1a1a] text-white font-semibold'
            : 'text-gray-300 hover:bg-[#1a1a1a]'
        )}
        onClick={() => {
          if (!isDisabled) {
            if (isSelectingStart) {
              onStartDateChange(currentDate)
              setIsSelectingStart(false)
            } else {
              onEndDateChange(currentDate)
            }
          }
        }}
      >
        {day}
      </button>
    )
  }

  // Next month's leading days
  const remainingCells = 42 - days.length
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, day)
    const isDisabled = nextDate > today
    days.push(
      <button
        key={`next-${day}`}
        disabled={isDisabled}
        className={cn(
          "h-5 w-5 text-xs rounded text-center transition-colors",
          isDisabled
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-500 hover:bg-[#1a1a1a]'
        )}
        onClick={() => {
          if (!isDisabled) {
            if (isSelectingStart) {
              onStartDateChange(nextDate)
              setIsSelectingStart(false)
            } else {
              onEndDateChange(nextDate)
            }
          }
        }}
      >
        {day}
      </button>
    )
  }

  return (
    <div className={cn("bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 shadow-2xl", className)}>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-300" />
        </button>
        <h3 className="font-semibold text-gray-200 text-xs">
          {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={`day-${index}`} className="h-5 w-5 text-xs text-gray-400 font-medium flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-2">
        {days}
      </div>

      <div className="flex justify-between items-center text-xs text-gray-400 pt-1 border-t border-[#333333]">
        <span className="text-xs">
          {isSelectingStart ? 'Start' : 'End'}
        </span>
        <button
          onClick={() => setIsSelectingStart(true)}
          className="text-primary hover:text-primary/80 transition-colors text-xs"
        >
          Reset
        </button>
      </div>
    </div>
  )
})

export function TraderViewDateSelector({ className = '' }: TraderViewDateSelectorProps) {
  const {
    selectedRange,
    customStartDate,
    customEndDate,
    currentDateRange,
    setDateRange,
    setCustomRange,
    getQuickSelectOptions,
    getDateRangeLabel
  } = useDateRange()

  const [isMounted, setIsMounted] = useState(false)
  const currentDateRangeLabel = currentDateRange?.label || ''

  // Portal popup positioning
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLDivElement>(null)

  const [showCalendar, setShowCalendar] = useState(false)
  const [tempStartDate, setTempStartDate] = useState(customStartDate || new Date())
  const [tempEndDate, setTempEndDate] = useState(customEndDate || new Date())
  const calendarRef = useRef<HTMLDivElement>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Quick range options - memoized for performance
  const quickRanges = useMemo(() => [
    { label: '7d', value: 'week' as DateRangeOption },
    { label: '30d', value: 'month' as DateRangeOption },
    { label: '90d', value: '90day' as DateRangeOption },
    { label: 'MTD', value: 'mtd' as DateRangeOption },
    { label: 'YTD', value: 'year' as DateRangeOption },
    { label: 'All', value: 'all' as DateRangeOption },
  ], [])

  // Helper function to calculate date range for a quick select option
  // This allows the popup to preview the range before applying
  const getDateRangeForOption = useCallback((option: DateRangeOption): { start: Date; end: Date } | null => {
    const now = new Date()

    switch (option) {
      case 'today':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        }
      case 'yesterday':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      case '7d':
      case 'week':
        return {
          start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        }
      case '30d':
      case 'month':
        return {
          start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        }
      case '90day':
        return {
          start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          end: now
        }
      case 'quarter':
        const currentMonth = now.getMonth()
        const quarterStart = Math.floor(currentMonth / 3) * 3
        return {
          start: new Date(now.getFullYear(), quarterStart, 1),
          end: now
        }
      case 'mtd':
        // Month to Date
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: now
        }
      case 'year':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: now
        }
      case '12months':
        return {
          start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          end: now
        }
      case 'lastMonth':
        return {
          start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          end: new Date(now.getFullYear(), now.getMonth(), 0)
        }
      case 'lastYear':
        return {
          start: new Date(now.getFullYear() - 1, 0, 1),
          end: new Date(now.getFullYear() - 1, 11, 31)
        }
      case 'all':
        return {
          start: new Date(2020, 0, 1),
          end: now
        }
      default:
        return null
    }
  }, [])

  // Helper function to check if temp dates match a quick select option
  // This ensures proper highlighting in the popup when previewing ranges
  const isTempDateRangeMatchingOption = useCallback((option: DateRangeOption): boolean => {
    const range = getDateRangeForOption(option)
    if (!range || !tempStartDate || !tempEndDate) return false

    // Normalize dates to midnight for comparison (ignore time portion)
    const normalizeDate = (date: Date) => {
      const normalized = new Date(date)
      normalized.setHours(0, 0, 0, 0)
      return normalized.getTime()
    }

    const tempStartNormalized = normalizeDate(tempStartDate)
    const tempEndNormalized = normalizeDate(tempEndDate)
    const optionStartNormalized = normalizeDate(range.start)
    const optionEndNormalized = normalizeDate(range.end)

    return tempStartNormalized === optionStartNormalized && tempEndNormalized === optionEndNormalized
  }, [tempStartDate, tempEndDate, getDateRangeForOption])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCalendar])

  const handleQuickRange = useCallback((range: DateRangeOption) => {
    // Handle G (previous) and N (next) navigation
    if ((range as string) === 'prev') {
      const currentStart = currentDateRange.start
      const currentEnd = currentDateRange.end
      const diff = currentEnd.getTime() - currentStart.getTime()
      const newStart = new Date(currentStart.getTime() - diff)
      const newEnd = new Date(currentEnd.getTime() - diff)
      setCustomRange(newStart, newEnd)
      setDateRange('custom')
      setShowCalendar(false)
      return
    }

    if ((range as string) === 'next') {
      const currentStart = currentDateRange.start
      const currentEnd = currentDateRange.end
      const diff = currentEnd.getTime() - currentStart.getTime()
      const newStart = new Date(currentStart.getTime() + diff)
      const newEnd = new Date(currentEnd.getTime() + diff)
      // Don't go past today
      const now = new Date()
      if (newStart <= now) {
        setCustomRange(
          newStart > now ? now : newStart,
          newEnd > now ? now : newEnd
        )
        setDateRange('custom')
        setShowCalendar(false)
      }
      return
    }

    // React 18 auto-batches these state updates
    setDateRange(range)
    setShowCalendar(false)
  }, [setDateRange, currentDateRange, setCustomRange])

  const handleCalendarOpen = useCallback(() => {
    // Calculate popup position based on button position
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPopupPosition({
        top: rect.bottom + 8,
        left: rect.left
      })
    }

    // Initialize temp dates with current date range (from currentDateRange)
    // This ensures the popup shows the currently selected range
    setTempStartDate(currentDateRange.start)
    setTempEndDate(currentDateRange.end)
    setShowCalendar(true)
  }, [currentDateRange])

  const handleApplyCustomRange = useCallback(() => {
    setCustomRange(tempStartDate, tempEndDate)
    setShowCalendar(false)
  }, [tempStartDate, tempEndDate, setCustomRange])

  // Enhanced hydration protection with better state awareness
  if (!isMounted) {
    // Smart placeholder that reflects the actual selectedRange state
    const placeholderRanges = [
      { label: '7d', value: 'week' },
      { label: '30d', value: 'month' },
      { label: '90d', value: '90day' },
      { label: 'MTD', value: 'mtd' },
      { label: 'YTD', value: 'year' },
      { label: 'All', value: 'all' }
    ]

    return (
      <div className={cn("relative flex items-center gap-1", className)}>
        {/* Smart placeholder buttons that show correct active state */}
        {placeholderRanges.map((range) => {
          const isActive = selectedRange === range.value
          return (
            <button
              key={range.label}
              onClick={() => handleQuickRange(range.value)}
              className={cn(
                "traderra-date-btn px-3 py-1.5 text-sm font-medium rounded transition-all duration-200",
                isActive
                  ? 'bg-[#B8860B] text-black shadow-lg'
                  : 'text-gray-400'
              )}
            >
              {range.label}
            </button>
          )
        })}
        <button
          onClick={handleCalendarOpen}
          className={cn(
            "traderra-date-btn px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 min-h-[2rem] flex items-center justify-center",
            selectedRange === 'custom' ? 'bg-[#B8860B] text-black' : 'text-gray-400'
          )}
        >
          <Calendar className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-600 mx-1"></div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleQuickRange('prev')}
            className="px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 text-gray-400"
          >G</button>
          <button
            onClick={() => handleQuickRange('next')}
            className="px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 text-gray-400"
          >N</button>
        </div>
      </div>
    )
  }

  
  // Only use the custom range display mode when user has selected an actual custom date range
  // NOT for preset ranges like Year to Date, Last 7 Days, etc.
  const isActuallyCustomRange = selectedRange === 'custom' && customStartDate && customEndDate

  // DEBUG: Log current state to help troubleshoot highlighting issue
  console.log('[DateSelector] Current state:', {
    selectedRange,
    customStartDate: customStartDate?.toISOString(),
    customEndDate: customEndDate?.toISOString(),
    isActuallyCustomRange
  })

  if (isActuallyCustomRange) {
    // Get the label for the custom range
    const customRangeLabel = getDateRangeLabel()


    return (
      <div
        className={cn("relative flex items-center gap-1 traderra-date-selector", className)}
        ref={buttonRef}
        data-testid="date-selector"
        data-component="traderview-date-selector"
      >
        {/* Custom range display as primary button */}
        <button
          key="custom-range"
          onClick={handleCalendarOpen}
          className={cn(
            "traderra-date-btn px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 bg-[#B8860B] text-black shadow-lg min-w-[120px]"
          )}
          data-range="custom"
          data-active="true"
        >
          <Calendar className="h-4 w-4 mr-2" />
          {customRangeLabel && customRangeLabel !== 'Custom Range' ? customRangeLabel : 'Custom Range'}
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-600 mx-1"></div>

        {/* P&L Mode Toggle */}
        <PnLModeToggle />

        {/* Calendar popup - rendered via Portal to document body */}
        {showCalendar && createPortal(
          <div className="fixed" style={{ zIndex: 2147483647, top: popupPosition.top, left: popupPosition.left }}>
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 shadow-2xl w-[450px]">
              {/* Current Date Range Display */}
              <div className="mb-3 text-center">
                <div className="text-xs text-gray-300 bg-[#1a1a1a] rounded px-3 py-2 border border-[#333333]">
                  {tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} - {tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                </div>
              </div>

              {/* Direct Date Input Section */}
              <div className="mb-3 p-2 bg-[#1a1a1a] rounded border border-[#333333]">
                <h4 className="text-xs font-semibold text-gray-300 mb-1">Custom Range</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Start</label>
                    <input
                      type="date"
                      value={tempStartDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value)
                        if (!isNaN(newDate.getTime())) {
                          setTempStartDate(newDate)
                          if (newDate > tempEndDate) {
                            setTempEndDate(newDate)
                          }
                        }
                      }}
                      className="w-full px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333333] rounded text-gray-200 focus:border-[#B8860B] focus:outline-none transition-colors"
                      max={new Date().toISOString().split('T')[0]}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">End</label>
                    <input
                      type="date"
                      value={tempEndDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value)
                        if (!isNaN(newDate.getTime())) {
                          setTempEndDate(newDate)
                          if (newDate < tempStartDate) {
                            setTempStartDate(newDate)
                          }
                        }
                      }}
                      className="w-full px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333333] rounded text-gray-200 focus:border-[#B8860B] focus:outline-none transition-colors"
                      max={new Date().toISOString().split('T')[0]}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick Selection - Horizontal */}
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-200 mb-2">Quick Select</h4>
                <div className="flex flex-wrap gap-2">
                  {getQuickSelectOptions().map((option) => {
                    const isOptionSelected = selectedRange === option.value || isTempDateRangeMatchingOption(option.value)
                    return (
                      <button
                        key={option.label}
                        onClick={() => {
                          const range = getDateRangeForOption(option.value)
                          if (range) {
                            setTempStartDate(range.start)
                            setTempEndDate(range.end)
                          }
                        }}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded transition-colors border",
                          isOptionSelected
                            ? "bg-[#B8860B] text-black border-[#B8860B] shadow-lg"
                            : "text-gray-300 hover:bg-[#1a1a1a] bg-[#1a1a1a] border-[#333333]"
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Calendar */}
              <TraderViewCalendar
                startDate={tempStartDate}
                endDate={tempEndDate}
                onStartDateChange={setTempStartDate}
                onEndDateChange={setTempEndDate}
                className="bg-transparent border-0 p-0 shadow-none"
              />

              {/* Action buttons */}
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[#333333]">
                <button
                  onClick={() => setShowCalendar(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustomRange}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        , document.body)}
      </div>
    )
  }

  // Normal preset range buttons

  return (
    <div
      className={cn("relative flex items-center gap-1 traderra-date-selector", className)}
      ref={buttonRef}
      data-testid="date-selector"
      data-component="traderview-date-selector"
    >
      {/* Quick range buttons */}
      {quickRanges.map((range) => {
        const isActive = selectedRange === range.value

        return (
          <button
            key={range.value}
            onClick={() => handleQuickRange(range.value)}
            className={cn(
              "traderra-date-btn px-3 py-1.5 text-sm font-medium rounded transition-all duration-200",
              isActive
                ? 'bg-[#B8860B] text-black shadow-lg'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            )}
            data-testid={`date-range-${range.value}`}
            data-range={range.value}
            data-active={isActive ? 'true' : 'false'}
          >
            {range.label}
          </button>
        )
      })}

      {/* Calendar button */}
      <button
        key="calendar"
        onClick={handleCalendarOpen}
        className={cn(
          "traderra-date-btn px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 min-h-[2rem] flex items-center justify-center",
          selectedRange === 'custom'
            ? 'bg-[#B8860B] text-black shadow-lg'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
        )}
        data-range="custom"
        data-active={selectedRange === 'custom' ? 'true' : 'false'}
      >
        <Calendar className="h-4 w-4" />
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-600 mx-1"></div>

      {/* P&L Mode Toggle */}
      <PnLModeToggle />


      {/* Calendar popup - rendered via Portal to document body */}
      {showCalendar && createPortal(
        <div className="fixed" style={{ zIndex: 2147483647, top: popupPosition.top, left: popupPosition.left }}>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2 shadow-2xl w-[450px]">
            {/* Current Date Range Display */}
            {selectedRange === 'custom' && (
              <div className="mb-3 text-center">
                <div className="text-xs text-gray-300 bg-[#1a1a1a] rounded px-3 py-2 border border-[#333333]">
                  {tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} - {tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                </div>
              </div>
            )}

            {/* Direct Date Input Section */}
            <div className="mb-3 p-2 bg-[#1a1a1a] rounded border border-[#333333]">
              <h4 className="text-xs font-semibold text-gray-300 mb-1">Custom Range</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">Start</label>
                  <input
                    type="date"
                    value={tempStartDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value)
                      if (!isNaN(newDate.getTime())) {
                        setTempStartDate(newDate)
                        if (newDate > tempEndDate) {
                          setTempEndDate(newDate)
                        }
                      }
                    }}
                    className="w-full px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333333] rounded text-gray-200 focus:border-[#B8860B] focus:outline-none transition-colors"
                    max={new Date().toISOString().split('T')[0]}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-0.5">End</label>
                  <input
                    type="date"
                    value={tempEndDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value)
                      if (!isNaN(newDate.getTime())) {
                        setTempEndDate(newDate)
                        if (newDate < tempStartDate) {
                          setTempStartDate(newDate)
                        }
                      }
                    }}
                    className="w-full px-2 py-1 text-xs bg-[#0a0a0a] border border-[#333333] rounded text-gray-200 focus:border-[#B8860B] focus:outline-none transition-colors"
                    max={new Date().toISOString().split('T')[0]}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Selection - Horizontal */}
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-200 mb-2">Quick Select</h4>
              <div className="flex flex-wrap gap-2">
                {getQuickSelectOptions().map((option) => {
                  // Check if the currently previewed temp range matches this option
                  const isOptionSelected = selectedRange === option.value || isTempDateRangeMatchingOption(option.value)
                  return (
                    <button
                      key={option.label}
                      onClick={() => {
                        // Calculate the date range for this option
                        const range = getDateRangeForOption(option.value)
                        if (range) {
                          // Update temp dates so user can preview in the popup
                          setTempStartDate(range.start)
                          setTempEndDate(range.end)
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded transition-colors border",
                        isOptionSelected
                          ? "bg-[#B8860B] text-black border-[#B8860B] shadow-lg"
                          : "text-gray-300 hover:bg-[#1a1a1a] bg-[#1a1a1a] border-[#333333]"
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Calendar */}
            <TraderViewCalendar
              startDate={tempStartDate}
              endDate={tempEndDate}
              onStartDateChange={setTempStartDate}
              onEndDateChange={setTempEndDate}
              className="bg-transparent border-0 p-0 shadow-none"
            />

            {/* Action buttons */}
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-[#333333]">
              <button
                onClick={() => setShowCalendar(false)}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCustomRange}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}