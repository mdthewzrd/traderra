/**
 * ADVANCED DATE PARSER FOR RENATA CALENDAR INTERACTION
 * Enables natural language date parsing for thousands of calendar commands
 * Production-ready implementation with trading-specific patterns
 */

import { startOfYear, endOfYear, startOfQuarter, endOfQuarter, startOfMonth, endOfMonth } from 'date-fns'
import { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns'
import { format, parse, isValid, isSameDay, startOfWeek, endOfWeek } from 'date-fns'

export interface DateRange {
  start: Date
  end: Date
  label: string
  type: 'absolute' | 'relative' | 'trading-pattern'
}

export interface TradingEvent {
  date: Date
  title: string
  type: 'earnings' | 'options' | 'fed' | 'holiday'
}

/**
 * TRADING CALENDAR UTILITIES
 * Handles trading-specific date calculations
 */
export class TradingCalendar {

  /**
   * Get quarterly earnings seasons for a given year
   */
  getEarningsSeasons(year: number): DateRange[] {
    return [
      {
        start: new Date(year, 0, 1),   // Q1: Jan 1
        end: new Date(year, 2, 31),    // Mar 31
        label: `Q1 ${year} Earnings Season`,
        type: 'trading-pattern' as const
      },
      {
        start: new Date(year, 3, 1),   // Q2: Apr 1
        end: new Date(year, 5, 30),    // Jun 30
        label: `Q2 ${year} Earnings Season`,
        type: 'trading-pattern' as const
      },
      {
        start: new Date(year, 6, 1),   // Q3: Jul 1
        end: new Date(year, 8, 30),    // Sep 30
        label: `Q3 ${year} Earnings Season`,
        type: 'trading-pattern' as const
      },
      {
        start: new Date(year, 9, 1),   // Q4: Oct 1
        end: new Date(year, 11, 31),   // Dec 31
        label: `Q4 ${year} Earnings Season`,
        type: 'trading-pattern' as const
      }
    ]
  }

  /**
   * Get third Friday of month (options expiration)
   */
  getThirdFriday(year: number, month: number): Date {
    const firstDay = new Date(year, month, 1)
    const firstDayOfWeek = firstDay.getDay()
    const firstFriday = firstDayOfWeek <= 5 ? 6 - firstDayOfWeek : 13 - firstDayOfWeek
    return new Date(year, month, firstFriday + 14)
  }

  /**
   * Get all options expiration dates for a year
   */
  getOptionsExpirationDates(year: number): Date[] {
    const dates: Date[] = []
    for (let month = 0; month < 12; month++) {
      dates.push(this.getThirdFriday(year, month))
    }
    return dates
  }

  /**
   * Get FOMC meeting dates (approximate - 8 meetings per year)
   */
  getFOMCMeetingDates(year: number): Date[] {
    // Standard FOMC schedule (approximate dates)
    return [
      new Date(year, 0, 31),   // End of January
      new Date(year, 2, 20),   // Mid March
      new Date(year, 4, 2),    // Early May
      new Date(year, 5, 12),   // Mid June
      new Date(year, 6, 26),   // End of July
      new Date(year, 8, 18),   // Mid September
      new Date(year, 10, 7),   // Early November
      new Date(year, 11, 13)   // Mid December
    ]
  }

  /**
   * Get market holidays for a year
   */
  getMarketHolidays(year: number): Date[] {
    // Major US market holidays
    return [
      new Date(year, 0, 1),      // New Year's Day
      this.getMLKDay(year),      // Martin Luther King Jr. Day
      this.getPresidentsDay(year), // Presidents' Day
      this.getGoodFriday(year),  // Good Friday
      this.getMemorialDay(year), // Memorial Day
      new Date(year, 6, 4),      // Independence Day
      this.getLaborDay(year),    // Labor Day
      this.getThanksgiving(year), // Thanksgiving
      new Date(year, 11, 25)     // Christmas Day
    ]
  }

  private getMLKDay(year: number): Date {
    // Third Monday in January
    const firstDay = new Date(year, 0, 1)
    const firstMonday = firstDay.getDay() === 1 ? 1 : (8 - firstDay.getDay()) % 7 + 1
    return new Date(year, 0, firstMonday + 14)
  }

  private getPresidentsDay(year: number): Date {
    // Third Monday in February
    const firstDay = new Date(year, 1, 1)
    const firstMonday = firstDay.getDay() === 1 ? 1 : (8 - firstDay.getDay()) % 7 + 1
    return new Date(year, 1, firstMonday + 14)
  }

  private getGoodFriday(year: number): Date {
    // Complex Easter calculation - simplified approximation
    // Using a lookup table for accuracy
    const easterDates: Record<number, [number, number]> = {
      2024: [2, 29], // March 29
      2025: [3, 18], // April 18
      2026: [3, 3],  // April 3
    }
    const [month, day] = easterDates[year] || [3, 15] // Default mid-April
    return subDays(new Date(year, month, day), 2) // Good Friday is 2 days before Easter
  }

  private getMemorialDay(year: number): Date {
    // Last Monday in May
    const lastDay = new Date(year, 4, 31)
    const lastMonday = lastDay.getDate() - ((lastDay.getDay() + 6) % 7)
    return new Date(year, 4, lastMonday)
  }

  private getLaborDay(year: number): Date {
    // First Monday in September
    const firstDay = new Date(year, 8, 1)
    const firstMonday = firstDay.getDay() === 1 ? 1 : (8 - firstDay.getDay()) % 7 + 1
    return new Date(year, 8, firstMonday)
  }

  private getThanksgiving(year: number): Date {
    // Fourth Thursday in November
    const firstDay = new Date(year, 10, 1)
    const firstThursday = firstDay.getDay() <= 4 ? 5 - firstDay.getDay() : 12 - firstDay.getDay()
    return new Date(year, 10, firstThursday + 21)
  }
}

/**
 * ADVANCED DATE PARSER
 * Core class for parsing natural language date expressions
 */
export class AdvancedDateParser {
  private tradingCalendar: TradingCalendar

  constructor() {
    this.tradingCalendar = new TradingCalendar()
  }

  /**
   * Main parsing entry point
   */
  parse(input: string): DateRange | null {
    const normalized = this.normalizeInput(input)
    console.log(`🗓️ Parsing date expression: "${input}" → "${normalized}"`)

    // Try pattern matching in order of specificity
    return this.tryAbsolutePatterns(normalized) ||
           this.tryRelativePatterns(normalized) ||
           this.tryTradingPatterns(normalized) ||
           this.tryComplexRanges(normalized) ||
           this.tryFuzzyMatching(normalized) ||
           null
  }

  /**
   * Parse navigation targets (for calendar navigation)
   */
  parseNavigation(input: string): { year: number; month: number; date?: Date; displayName: string } | null {
    const normalized = this.normalizeInput(input)

    // Year only
    const yearMatch = normalized.match(/^(\d{4})$/)
    if (yearMatch) {
      const year = parseInt(yearMatch[1])
      return {
        year,
        month: 0, // January
        displayName: `${year}`
      }
    }

    // Month Year
    const monthYearMatch = normalized.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})/)
    if (monthYearMatch) {
      const month = this.getMonthNumber(monthYearMatch[1])
      const year = parseInt(monthYearMatch[2])
      return {
        year,
        month,
        displayName: `${monthYearMatch[1]} ${year}`
      }
    }

    // Relative navigation
    if (normalized.includes('next month')) {
      const nextMonth = addMonths(new Date(), 1)
      return {
        year: nextMonth.getFullYear(),
        month: nextMonth.getMonth(),
        displayName: 'Next Month'
      }
    }

    if (normalized.includes('last month') || normalized.includes('previous month')) {
      const prevMonth = subMonths(new Date(), 1)
      return {
        year: prevMonth.getFullYear(),
        month: prevMonth.getMonth(),
        displayName: 'Previous Month'
      }
    }

    return null
  }

  /**
   * Normalize input for consistent processing
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim()
  }

  /**
   * Try absolute date patterns (quarters, months, years)
   */
  private tryAbsolutePatterns(input: string): DateRange | null {
    // Quarter patterns
    const quarterMatch = input.match(/q([1-4])\s*(\d{4})/)
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]) as 1 | 2 | 3 | 4
      const year = parseInt(quarterMatch[2])
      return this.getQuarterRange(quarter, year)
    }

    // Month year patterns
    const monthYearMatch = input.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})/)
    if (monthYearMatch) {
      const month = monthYearMatch[1]
      const year = parseInt(monthYearMatch[2])
      return this.getMonthRange(month, year)
    }

    // Year only
    const yearMatch = input.match(/^(\d{4})$/)
    if (yearMatch) {
      const year = parseInt(yearMatch[1])
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31),
        label: `All of ${year}`,
        type: 'absolute'
      }
    }

    // Current year variations
    if (input.includes('this year') || input.includes('current year')) {
      const year = new Date().getFullYear()
      return {
        start: startOfYear(new Date()),
        end: new Date(), // YTD
        label: 'Year to Date',
        type: 'relative'
      }
    }

    return null
  }

  /**
   * Try relative date patterns (last N days/weeks/months)
   */
  private tryRelativePatterns(input: string): DateRange | null {
    // "Last N" patterns
    const lastNMatch = input.match(/last\s*(\d+)\s*(days?|weeks?|months?)/)
    if (lastNMatch) {
      const count = parseInt(lastNMatch[1])
      const unit = lastNMatch[2].replace(/s$/, '') as 'day' | 'week' | 'month'
      return this.getLastNRange(count, unit)
    }

    // "Past N" patterns
    const pastNMatch = input.match(/past\s*(\d+)\s*(days?|weeks?|months?)/)
    if (pastNMatch) {
      const count = parseInt(pastNMatch[1])
      const unit = pastNMatch[2].replace(/s$/, '') as 'day' | 'week' | 'month'
      return this.getLastNRange(count, unit)
    }

    // Specific relative terms
    if (input.includes('yesterday')) {
      const yesterday = subDays(new Date(), 1)
      return {
        start: yesterday,
        end: yesterday,
        label: 'Yesterday',
        type: 'relative'
      }
    }

    if (input.includes('last week')) {
      const lastWeekStart = startOfWeek(subWeeks(new Date(), 1))
      const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1))
      return {
        start: lastWeekStart,
        end: lastWeekEnd,
        label: 'Last Week',
        type: 'relative'
      }
    }

    if (input.includes('last month')) {
      const lastMonth = subMonths(new Date(), 1)
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
        label: 'Last Month',
        type: 'relative'
      }
    }

    return null
  }

  /**
   * Try trading-specific patterns
   */
  private tryTradingPatterns(input: string): DateRange | null {
    const currentYear = new Date().getFullYear()

    // Earnings season patterns
    if (input.includes('earnings season') || input.includes('earnings')) {
      const quarterMatch = input.match(/q([1-4])/)
      if (quarterMatch) {
        const quarter = parseInt(quarterMatch[1]) as 1 | 2 | 3 | 4
        const earnings = this.tradingCalendar.getEarningsSeasons(currentYear)
        return earnings[quarter - 1]
      }

      // Current earnings season
      const currentQuarter = Math.floor((new Date().getMonth() / 3)) + 1
      const earnings = this.tradingCalendar.getEarningsSeasons(currentYear)
      return earnings[currentQuarter - 1]
    }

    // Options expiration
    if (input.includes('options expiration') || input.includes('options exp')) {
      const dates = this.tradingCalendar.getOptionsExpirationDates(currentYear)
      return {
        start: dates[0],
        end: dates[dates.length - 1],
        label: `${currentYear} Options Expiration Dates`,
        type: 'trading-pattern'
      }
    }

    // FOMC meetings
    if (input.includes('fomc') || input.includes('fed meeting') || input.includes('federal reserve')) {
      const dates = this.tradingCalendar.getFOMCMeetingDates(currentYear)
      return {
        start: dates[0],
        end: dates[dates.length - 1],
        label: `${currentYear} FOMC Meeting Dates`,
        type: 'trading-pattern'
      }
    }

    return null
  }

  /**
   * Try complex range patterns (from X to Y)
   */
  private tryComplexRanges(input: string): DateRange | null {
    // "From X to Y" patterns
    const rangeMatch = input.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s*to\s*(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*(\d{4}))?/)
    if (rangeMatch) {
      const startMonth = rangeMatch[1]
      const endMonth = rangeMatch[2]
      const year = rangeMatch[3] ? parseInt(rangeMatch[3]) : new Date().getFullYear()

      const startDate = new Date(year, this.getMonthNumber(startMonth), 1)
      const endDate = endOfMonth(new Date(year, this.getMonthNumber(endMonth), 1))

      return {
        start: startDate,
        end: endDate,
        label: `${startMonth} to ${endMonth} ${year}`,
        type: 'absolute'
      }
    }

    return null
  }

  /**
   * Try fuzzy matching for partial matches
   */
  private tryFuzzyMatching(input: string): DateRange | null {
    // Quarter patterns without year
    const quarterMatch = input.match(/q([1-4])/)
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]) as 1 | 2 | 3 | 4
      const year = new Date().getFullYear()
      return this.getQuarterRange(quarter, year)
    }

    // Month without year
    const monthMatch = input.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)$/)
    if (monthMatch) {
      const month = monthMatch[1]
      const year = new Date().getFullYear()
      return this.getMonthRange(month, year)
    }

    return null
  }

  /**
   * Helper methods
   */
  private getQuarterRange(quarter: 1 | 2 | 3 | 4, year: number): DateRange {
    const date = new Date(year, (quarter - 1) * 3, 1)
    return {
      start: startOfQuarter(date),
      end: endOfQuarter(date),
      label: `Q${quarter} ${year}`,
      type: 'absolute'
    }
  }

  private getMonthRange(month: string, year: number): DateRange {
    const monthNum = this.getMonthNumber(month)
    const date = new Date(year, monthNum, 1)
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
      label: `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`,
      type: 'absolute'
    }
  }

  private getLastNRange(count: number, unit: 'day' | 'week' | 'month'): DateRange {
    const end = new Date()
    let start: Date

    switch (unit) {
      case 'day':
        start = subDays(end, count)
        break
      case 'week':
        start = subWeeks(end, count)
        break
      case 'month':
        start = subMonths(end, count)
        break
    }

    return {
      start,
      end,
      label: `Last ${count} ${unit}${count > 1 ? 's' : ''}`,
      type: 'relative'
    }
  }

  private getMonthNumber(month: string): number {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ]
    return months.indexOf(month.toLowerCase())
  }
}

/**
 * UTILITY FUNCTIONS
 */

/**
 * Format date range for display
 */
export function formatDateRangeSummary(range: DateRange): string {
  const isSameDate = isSameDay(range.start, range.end)

  if (isSameDate) {
    return format(range.start, 'MMM d, yyyy')
  }

  const isSameYear = range.start.getFullYear() === range.end.getFullYear()

  if (isSameYear) {
    return `${format(range.start, 'MMM d')} - ${format(range.end, 'MMM d, yyyy')}`
  }

  return `${format(range.start, 'MMM d, yyyy')} - ${format(range.end, 'MMM d, yyyy')}`
}

/**
 * Check if date range is valid
 */
export function isValidDateRange(range: DateRange): boolean {
  return isValid(range.start) &&
         isValid(range.end) &&
         range.start <= range.end
}

/**
 * Get date range type label
 */
export function getDateRangeTypeLabel(type: DateRange['type']): string {
  switch (type) {
    case 'absolute':
      return 'Specific Date Range'
    case 'relative':
      return 'Relative Date Range'
    case 'trading-pattern':
      return 'Trading Pattern'
    default:
      return 'Custom Range'
  }
}

// Export singleton instance
export const advancedDateParser = new AdvancedDateParser()
export const tradingCalendar = new TradingCalendar()