import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatRMultiple(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`
}

export function getPnLColor(value: number): string {
  if (value > 0) return 'text-trading-profit'
  if (value < 0) return 'text-trading-loss'
  return 'text-trading-neutral'
}

export function getPnLBgColor(value: number): string {
  if (value > 0) return 'bg-trading-profit/10'
  if (value < 0) return 'bg-trading-loss/10'
  return 'bg-trading-neutral/10'
}

export function formatDate(date: Date | string, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0
  return wins / total
}

export function calculateProfitFactor(grossProfit: number, grossLoss: number): number | null {
  if (grossLoss === 0) return grossProfit > 0 ? null : 0 // undefined when no losses
  return grossProfit / Math.abs(grossLoss)
}

export function calculateExpectancy(avgWin: number, winRate: number, avgLoss: number): number {
  // Basic expectancy: (WinRate × AvgWin) - (LossRate × AvgLoss)
  // Returns dollar expectancy per trade
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)
  return expectancy
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}