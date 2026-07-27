import { TraderraTrade } from '@/utils/csv-parser'

// Helper functions for P&L calculations
export function calculateNetPnL(trade: TraderraTrade): number {
  return isFinite(trade.pnl) ? trade.pnl : 0
}

export function calculateGrossPnL(trade: TraderraTrade): number {
  // If we have grossPnl from TraderVue, use it
  if (trade.grossPnl !== undefined && isFinite(trade.grossPnL)) {
    return trade.grossPnl
  }
  // Otherwise, calculate from net P&L + commission
  const netPnL = calculateNetPnL(trade)
  const commission = isFinite(trade.commission) ? trade.commission : 0
  return netPnL + commission
}

export function getPnLValue(trade: TraderraTrade, mode: 'gross' | 'net'): number {
  return mode === 'gross' ? calculateGrossPnL(trade) : calculateNetPnL(trade)
}

// Helper function for mode-aware R-multiple calculations
export function getRMultipleValue(trade: TraderraTrade, mode: 'gross' | 'net'): number {
  // Calculate R from: R = P&L / Initial Risk
  const riskAmount = trade.riskAmount

  // If we have riskAmount from the import, calculate R from it
  if (riskAmount && riskAmount > 0) {
    if (mode === 'gross') {
      const grossPnL = calculateGrossPnL(trade)
      return grossPnL / riskAmount
    } else {
      const netPnL = calculateNetPnL(trade)
      return netPnL / riskAmount
    }
  }

  // Fallback: use imported rMultiple if available
  const importedRMultiple = isFinite(trade.rMultiple) ? trade.rMultiple : 0
  if (importedRMultiple !== 0) {
    return importedRMultiple
  }

  // Last resort: return 0
  return 0
}

export interface TradeStatistics {
  totalGainLoss: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  averageWin: number
  averageLoss: number
  averageGainLoss: number
  largestGain: number
  largestLoss: number
  totalCommissions: number
  totalFees: number
  profitFactor: number
  expectancy: number
  maxConsecutiveWins: number
  maxConsecutiveLosses: number
  totalVolume: number
  averageDailyPnL: number
  maxDrawdown: number
  sharpeRatio: number
  averageHoldTime: number
  averageHoldTimeWinner: number
  averageHoldTimeLoser: number
  scratchTrades: number
  pnlStandardDeviation: number
  kellyPercentage: number
  systemQualityNumber: number
  kRatio: number
  averageMAE: number
  averageMFE: number
  // R-multiple statistics
  totalRMultiple: number
  largestGainR: number
  largestLossR: number
  expectancyR: number
  averageWinR: number
  averageLossR: number
  maxDrawdownR: number
}

export interface ChartDataPoint {
  label: string
  value: number
}

export function calculateTradeStatistics(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): TradeStatistics {
  if (trades.length === 0) {
    return {
      totalGainLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      averageGainLoss: 0,
      largestGain: 0,
      largestLoss: 0,
      totalCommissions: 0,
      totalFees: 0,
      profitFactor: 0,
      expectancy: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      totalVolume: 0,
      averageDailyPnL: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      averageHoldTime: 0,
      averageHoldTimeWinner: 0,
      averageHoldTimeLoser: 0,
      scratchTrades: 0,
      pnlStandardDeviation: 0,
      kellyPercentage: 0,
      systemQualityNumber: 0,
      kRatio: 0,
      averageMAE: 0,
      averageMFE: 0,
      // R-multiple statistics
      totalRMultiple: 0,
      largestGainR: 0,
      largestLossR: 0,
      expectancyR: 0,
      averageWinR: 0,
      averageLossR: 0,
      maxDrawdownR: 0
    }
  }

  // Calculate totals with enhanced precision matching TradervUE methodology
  const totalGainLoss = trades.reduce((sum, trade) => {
    const pnl = getPnLValue(trade, mode)
    return sum + pnl
  }, 0)

  const totalCommissions = trades.reduce((sum, trade) => {
    const commission = isFinite(trade.commission) ? trade.commission : 0
    return sum + commission
  }, 0)

  const totalVolume = trades.reduce((sum, trade) => {
    const quantity = isFinite(trade.quantity) ? trade.quantity : 0
    return sum + quantity
  }, 0)

  const winningTrades = trades.filter(trade => getPnLValue(trade, mode) > 0)
  const losingTrades = trades.filter(trade => getPnLValue(trade, mode) < 0)
  const scratchTrades = trades.filter(trade => getPnLValue(trade, mode) === 0)

  const winRate = (winningTrades.length / trades.length) * 100
  const averageWin = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0) / winningTrades.length : 0
  const averageLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0) / losingTrades.length : 0
  const averageGainLoss = totalGainLoss / trades.length

  const largestGain = winningTrades.length > 0 ? Math.max(...winningTrades.map(trade => getPnLValue(trade, mode))) : 0
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(trade => getPnLValue(trade, mode))) : 0

  // Calculate R-multiple statistics using mode-aware rMultiple values from trades
  const totalRMultiple = trades.reduce((sum, trade) => {
    const rMultiple = getRMultipleValue(trade, mode)
    return sum + rMultiple
  }, 0)

  const largestGainR = winningTrades.length > 0 ? Math.max(...winningTrades.map(trade =>
    getRMultipleValue(trade, mode)
  )) : 0

  const largestLossR = losingTrades.length > 0 ? Math.min(...losingTrades.map(trade =>
    getRMultipleValue(trade, mode)
  )) : 0

  const expectancyR = trades.length > 0 ? totalRMultiple / trades.length : 0

  // Calculate average R-multiples for winners and losers
  const averageWinR = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => {
    const rMultiple = getRMultipleValue(trade, mode)
    return sum + rMultiple
  }, 0) / winningTrades.length : 0

  const averageLossR = losingTrades.length > 0 ? losingTrades.reduce((sum, trade) => {
    const rMultiple = getRMultipleValue(trade, mode)
    return sum + rMultiple
  }, 0) / losingTrades.length : 0

  const grossWins = winningTrades.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0)
  const grossLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0))
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : (grossWins > 0 ? Infinity : 0)

  const expectancy = averageGainLoss

  // Calculate consecutive wins/losses
  let currentWinStreak = 0
  let currentLossStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0

  trades.forEach(trade => {
    const pnl = getPnLValue(trade, mode)
    if (pnl > 0) {
      currentWinStreak++
      currentLossStreak = 0
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
    } else if (pnl < 0) {
      currentLossStreak++
      currentWinStreak = 0
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
    }
  })

  // Calculate P&L standard deviation
  const pnlVariance = trades.reduce((sum, trade) => {
    const pnl = getPnLValue(trade, mode)
    const diff = pnl - averageGainLoss
    return sum + diff * diff
  }, 0) / trades.length
  const pnlStandardDeviation = Math.sqrt(pnlVariance)

  // Calculate daily P&L for Sharpe ratio and average daily P&L
  const dailyPnLMap = new Map<string, number>()
  trades.forEach(trade => {
    const date = trade.date
    const currentPnL = dailyPnLMap.get(date) || 0
    const pnl = getPnLValue(trade, mode)
    dailyPnLMap.set(date, currentPnL + pnl)
  })

  const dailyPnLs = Array.from(dailyPnLMap.values())
  const averageDailyPnL = dailyPnLs.reduce((sum, pnl) => sum + pnl, 0) / dailyPnLs.length

  const dailyPnLVariance = dailyPnLs.reduce((sum, pnl) => {
    const diff = pnl - averageDailyPnL
    return sum + diff * diff
  }, 0) / dailyPnLs.length
  const dailyPnLStdDev = Math.sqrt(dailyPnLVariance)
  const sharpeRatio = dailyPnLStdDev > 0 ? averageDailyPnL / dailyPnLStdDev : 0

  // Calculate max drawdown (both dollar and R-multiple)
  // Sort trades by date to ensure chronological order for proper drawdown calculation
  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = new Date(a.entryTime || a.date || '').getTime()
    const dateB = new Date(b.entryTime || b.date || '').getTime()
    return dateA - dateB
  })

  let peak = 0
  let peakR = 0
  let maxDrawdown = 0
  let maxDrawdownR = 0
  let runningPnL = 0
  let runningRMultiple = 0

  sortedTrades.forEach(trade => {
    const pnl = getPnLValue(trade, mode)
    const rMultiple = getRMultipleValue(trade, mode)

    runningPnL += pnl
    runningRMultiple += rMultiple

    // Update peaks when we reach new highs
    if (runningPnL > peak) {
      peak = runningPnL
    }
    if (runningRMultiple > peakR) {
      peakR = runningRMultiple
    }

    // Calculate current drawdown from peak
    const currentDrawdown = peak - runningPnL
    const currentDrawdownR = peakR - runningRMultiple

    // Update max drawdown if current is larger
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown
    }
    if (currentDrawdownR > maxDrawdownR) {
      maxDrawdownR = currentDrawdownR
    }
  })

  // Calculate average hold time (enhanced with fallback calculation)
  const averageHoldTime = trades.reduce((sum, trade) => {
    // First try to parse duration string
    let duration = parseDurationToHours(trade.duration)

    // If duration parsing fails or returns 0, calculate from entry/exit times
    if (duration === 0 && trade.entryTime && trade.exitTime) {
      try {
        // Parse entry and exit times to calculate duration
        const entryDate = new Date(trade.entryTime)
        const exitDate = new Date(trade.exitTime)

        if (!isNaN(entryDate.getTime()) && !isNaN(exitDate.getTime())) {
          // Calculate duration in hours
          duration = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60)
        }
      } catch (error) {
        // If time parsing fails, use 0
        duration = 0
      }
    }

    return sum + duration
  }, 0) / trades.length

  // Calculate average hold time for winners and losers separately
  const averageHoldTimeWinner = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => {
    let duration = parseDurationToHours(trade.duration)

    if (duration === 0 && trade.entryTime && trade.exitTime) {
      try {
        const entryDate = new Date(trade.entryTime)
        const exitDate = new Date(trade.exitTime)
        if (!isNaN(entryDate.getTime()) && !isNaN(exitDate.getTime())) {
          duration = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60)
        }
      } catch (error) {
        duration = 0
      }
    }

    return sum + duration
  }, 0) / winningTrades.length : 0

  const averageHoldTimeLoser = losingTrades.length > 0 ? losingTrades.reduce((sum, trade) => {
    let duration = parseDurationToHours(trade.duration)

    if (duration === 0 && trade.entryTime && trade.exitTime) {
      try {
        const entryDate = new Date(trade.entryTime)
        const exitDate = new Date(trade.exitTime)
        if (!isNaN(entryDate.getTime()) && !isNaN(exitDate.getTime())) {
          duration = (exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60)
        }
      } catch (error) {
        duration = 0
      }
    }

    return sum + duration
  }, 0) / losingTrades.length : 0

  // Kelly percentage (simplified calculation)
  const kellyPercentage = winRate > 0 && Math.abs(averageLoss) > 0 ?
    (winRate / 100 * averageWin / Math.abs(averageLoss) - (1 - winRate / 100)) / (averageWin / Math.abs(averageLoss)) * 100 : 0

  // System Quality Number (simplified)
  const systemQualityNumber = pnlStandardDeviation > 0 ? (Math.sqrt(trades.length) * averageGainLoss) / pnlStandardDeviation : 0

  // K-Ratio (simplified)
  const kRatio = sharpeRatio * Math.sqrt(252) // Annualized Sharpe approximation

  // Average MAE and MFE
  const averageMAE = trades.reduce((sum, trade) => sum + (trade.mae || 0), 0) / trades.length
  const averageMFE = trades.reduce((sum, trade) => sum + (trade.mfe || 0), 0) / trades.length

  return {
    totalGainLoss,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    averageWin,
    averageLoss,
    averageGainLoss,
    largestGain,
    largestLoss,
    totalCommissions,
    totalFees: 0, // Not available in current data structure
    profitFactor,
    expectancy,
    maxConsecutiveWins: maxWinStreak,
    maxConsecutiveLosses: maxLossStreak,
    totalVolume,
    averageDailyPnL,
    maxDrawdown,
    sharpeRatio,
    averageHoldTime,
    averageHoldTimeWinner,
    averageHoldTimeLoser,
    scratchTrades: scratchTrades.length,
    pnlStandardDeviation,
    kellyPercentage,
    systemQualityNumber,
    kRatio,
    averageMAE,
    averageMFE,
    // R-multiple statistics
    totalRMultiple,
    largestGainR,
    largestLossR,
    expectancyR,
    averageWinR,
    averageLossR,
    maxDrawdownR
  }
}

function parseDurationToHours(duration: string): number {
  // Parse duration strings like "2h 30m", "1d 5h", "45m"
  let hours = 0

  const dayMatch = duration.match(/(\d+)d/)
  if (dayMatch) {
    hours += parseInt(dayMatch[1]) * 24
  }

  const hourMatch = duration.match(/(\d+)h/)
  if (hourMatch) {
    hours += parseInt(hourMatch[1])
  }

  const minuteMatch = duration.match(/(\d+)m/)
  if (minuteMatch) {
    hours += parseInt(minuteMatch[1]) / 60
  }

  return hours
}

export function getPerformanceByDay(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const dayMap = new Map<string, number>()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  trades.forEach(trade => {
    const date = new Date(trade.date)
    const dayName = dayNames[date.getDay()]
    const currentPnL = dayMap.get(dayName) || 0
    const pnl = getPnLValue(trade, mode)
    dayMap.set(dayName, currentPnL + pnl)
  })

  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => ({
    label: day.slice(0, 3), // Mon, Tue, etc.
    value: dayMap.get(day) || 0
  }))
}

export function getDistributionByDay(trades: TraderraTrade[]): ChartDataPoint[] {
  const dayMap = new Map<string, number>()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  trades.forEach(trade => {
    const date = new Date(trade.date)
    const dayName = dayNames[date.getDay()]
    const currentCount = dayMap.get(dayName) || 0
    dayMap.set(dayName, currentCount + 1)
  })

  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => ({
    label: day.slice(0, 3),
    value: dayMap.get(day) || 0
  }))
}

export function getPerformanceByMonth(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const monthMap = new Map<string, number>()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  trades.forEach(trade => {
    const date = new Date(trade.date)
    const monthName = monthNames[date.getMonth()]
    const currentPnL = monthMap.get(monthName) || 0
    const pnl = getPnLValue(trade, mode)
    monthMap.set(monthName, currentPnL + pnl)
  })

  return monthNames.map(month => ({
    label: month,
    value: monthMap.get(month) || 0
  }))
}

export function getDistributionByMonth(trades: TraderraTrade[]): ChartDataPoint[] {
  const monthMap = new Map<string, number>()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  trades.forEach(trade => {
    const date = new Date(trade.date)
    const monthName = monthNames[date.getMonth()]
    const currentCount = monthMap.get(monthName) || 0
    monthMap.set(monthName, currentCount + 1)
  })

  return monthNames.map(month => ({
    label: month,
    value: monthMap.get(month) || 0
  }))
}

export function getPerformanceByHour(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const hourMap = new Map<string, number>()

  trades.forEach(trade => {
    const entryTime = trade.entryTime
    if (entryTime) {
      // Extract hour from various time formats with more robust parsing
      let hour: number | undefined

      try {
        // Handle different time formats
        if (entryTime.includes('T')) {
          // ISO datetime format: "2024-01-01T14:30:00Z" or "2024-01-01T14:30:00"
          const timePart = entryTime.split('T')[1].replace('Z', '')
          hour = parseInt(timePart.split(':')[0], 10)
        } else if (entryTime.includes(' ')) {
          // Format with space: "2024-01-01 14:30:00" or "14:30:00"
          const parts = entryTime.split(' ')
          const timePart = parts[parts.length - 1] // Get the last part (time)
          hour = parseInt(timePart.split(':')[0], 10)
        } else if (entryTime.includes(':')) {
          // Simple time format: "14:30" or "14:30:00"
          hour = parseInt(entryTime.split(':')[0], 10)
        } else {
          // Try to parse as just hour number
          const parsed = parseInt(entryTime, 10)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
            hour = parsed
          }
        }

        // Ensure hour is valid (0-23)
        if (hour !== undefined && hour >= 0 && hour <= 23) {
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`
          const currentPnL = hourMap.get(hourLabel) || 0
          const pnl = getPnLValue(trade, mode)
          hourMap.set(hourLabel, currentPnL + pnl)
        }
      } catch (error) {
        console.warn('Failed to parse entry time for performance:', entryTime, error)
      }
    }
  })

  // Extended market hours 4:00 AM to 8:00 PM (covering pre-market, regular hours, and after-hours)
  const marketHours = ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

  return marketHours.map(hour => ({
    label: hour,
    value: hourMap.get(hour) || 0
  }))
}

export function getDistributionByHour(trades: TraderraTrade[]): ChartDataPoint[] {
  const hourMap = new Map<string, number>()

  // DEBUG: Log sample entryTime values to identify the format issue
  console.group('🐛 DEBUG: getDistributionByHour - Entry Time Analysis')
  console.log('Total trades:', trades.length)
  if (trades.length > 0) {
    console.log('Sample entryTime values from first 10 trades:')
    trades.slice(0, 10).forEach((trade, i) => {
      console.log(`  Trade ${i + 1}: "${trade.entryTime}" (Symbol: ${trade.symbol})`)
    })
  }

  trades.forEach((trade, index) => {
    const entryTime = trade.entryTime
    if (entryTime) {
      // Extract hour from various time formats with more robust parsing
      let hour: number | undefined

      try {
        // Handle different time formats
        if (entryTime.includes('T')) {
          // ISO datetime format: "2024-01-01T14:30:00Z" or "2024-01-01T14:30:00"
          const timePart = entryTime.split('T')[1].replace('Z', '').split('.')[0] // Remove timezone and milliseconds
          const hourStr = timePart.split(':')[0]
          hour = parseInt(hourStr, 10)
        } else if (entryTime.includes(' ')) {
          // Check if it's 12-hour format with AM/PM: "11:52 AM" or "1:57 PM"
          const upperTime = entryTime.toUpperCase()
          if (upperTime.includes('AM') || upperTime.includes('PM')) {
            const isPM = upperTime.includes('PM')
            // Extract the time part before AM/PM
            const timeMatch = entryTime.match(/(\d+):(\d+)/)
            if (timeMatch) {
              hour = parseInt(timeMatch[1], 10)
              // Convert 12-hour to 24-hour format
              if (isPM && hour !== 12) hour += 12
              else if (!isPM && hour === 12) hour = 0
            }
          } else {
            // Format with space: "2024-01-01 14:30:00" or "14:30:00"
            const parts = entryTime.split(' ')
            const timePart = parts[parts.length - 1] // Get the last part (time)
            hour = parseInt(timePart.split(':')[0], 10)
          }
        } else if (entryTime.includes(':')) {
          // Simple time format: "14:30" or "14:30:00"
          hour = parseInt(entryTime.split(':')[0], 10)
        } else {
          // Try to parse as just hour number
          const parsed = parseInt(entryTime, 10)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
            hour = parsed
          }
        }

        // Validate hour is valid number
        if (hour !== undefined && (isNaN(hour) || hour < 0 || hour > 23)) {
          console.error(`❌ Invalid hour extracted: ${hour} from entryTime: "${entryTime}"`)
          hour = undefined
        }

        // Convert to 12-hour format for display but keep 24-hour for internal processing
        // Ensure hour is valid (0-23)
        if (hour !== undefined && hour >= 0 && hour <= 23) {
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`
          const currentCount = hourMap.get(hourLabel) || 0
          hourMap.set(hourLabel, currentCount + 1)

          // DEBUG: Log a few examples of parsing
          if (index < 5) {
            console.log(`  Parsed "${entryTime}" → Hour: ${hour} → Label: ${hourLabel}`)
          }
        } else {
          // DEBUG: Log failed parsing attempts
          if (index < 5) {
            console.log(`  ❌ Failed to extract valid hour from "${entryTime}" → Got: ${hour}`)
          }
        }
      } catch (error) {
        console.warn('Failed to parse entry time:', entryTime, error)
      }
    }
  })

  // DEBUG: Show final hour distribution
  console.log('📊 Final hour distribution:')
  const nonZeroHours = []
  for (const [hour, count] of hourMap) {
    if (count > 0) {
      nonZeroHours.push(`${hour}: ${count} trades`)
    }
  }
  console.log('  Non-zero hours:', nonZeroHours.join(', '))

  const totalParsedTrades = Array.from(hourMap.values()).reduce((sum, count) => sum + count, 0)
  console.log(`  Total trades successfully parsed: ${totalParsedTrades} / ${trades.length}`)
  console.groupEnd()

  // Extended market hours 4:00 AM to 8:00 PM (covering pre-market, regular hours, and after-hours)
  const marketHours = ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

  return marketHours.map(hour => ({
    label: hour,
    value: hourMap.get(hour) || 0
  }))
}

export function getCumulativePnLData(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): Array<{month: string, value: string, gain: string, x: number, y: number}> {
  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let cumulativePnL = 0
  const monthlyData = new Map<string, {total: number, gain: number}>()

  sortedTrades.forEach(trade => {
    const pnl = getPnLValue(trade, mode)
    cumulativePnL += pnl
    const date = new Date(trade.date)
    const monthKey = `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`

    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, {total: cumulativePnL, gain: pnl})
    } else {
      const existing = monthlyData.get(monthKey)!
      existing.total = cumulativePnL
      existing.gain += pnl
    }
  })

  const dataPoints = Array.from(monthlyData.entries()).map(([month, data], index) => ({
    month,
    value: `$${data.total.toLocaleString()}`,
    gain: `${data.gain >= 0 ? '+' : ''}$${data.gain.toLocaleString()}`,
    x: (index / (monthlyData.size - 1)) * 1000,
    y: Math.max(20, 150 - (data.total / Math.max(...Array.from(monthlyData.values()).map(d => d.total))) * 130)
  }))

  return dataPoints
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0.0%'
  return `${value.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return value.toLocaleString()
}

export function generatePriceDistribution(trades: TraderraTrade[]): ChartDataPoint[] {
  const pnlRanges = [
    { label: '0-99', min: 0, max: 99 },
    { label: '100-249', min: 100, max: 249 },
    { label: '250-499', min: 250, max: 499 },
    { label: '500-999', min: 500, max: 999 },
    { label: '1k-4.9k', min: 1000, max: 4999 },
    { label: '5k-9.9k', min: 5000, max: 9999 },
    { label: '10k-24.9k', min: 10000, max: 24999 },
    { label: '25k-49.9k', min: 25000, max: 49999 },
    { label: '50k+', min: 50000, max: Infinity },
  ]

  const distribution = pnlRanges.map(range => {
    const count = trades.filter(trade => {
      const pnl = Math.abs(calculateNetPnL(trade))
      return pnl >= range.min && pnl <= range.max
    }).length
    return { label: range.label, value: count }
  })

  return distribution
}

export function generatePricePerformance(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const pnlRanges = [
    { label: '0-99', min: 0, max: 99 },
    { label: '100-249', min: 100, max: 249 },
    { label: '250-499', min: 250, max: 499 },
    { label: '500-999', min: 500, max: 999 },
    { label: '1k-4.9k', min: 1000, max: 4999 },
    { label: '5k-9.9k', min: 5000, max: 9999 },
    { label: '10k-24.9k', min: 10000, max: 24999 },
    { label: '25k-49.9k', min: 25000, max: 49999 },
    { label: '50k+', min: 50000, max: Infinity },
  ]

  const performance = pnlRanges.map(range => {
    const tradesInRange = trades.filter(trade => {
      const pnl = Math.abs(getPnLValue(trade, mode))
      return pnl >= range.min && pnl <= range.max
    })
    const totalPnL = tradesInRange.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0)
    return { label: range.label, value: totalPnL }
  })

  return performance
}

// R-Multiple specific chart data functions
export function getPerformanceByHourR(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const hourMap = new Map<string, number>()

  trades.forEach(trade => {
    const entryTime = trade.entryTime
    if (entryTime) {
      // Extract hour from various time formats with more robust parsing
      let hour: number | undefined

      try {
        // Handle different time formats
        if (entryTime.includes('T')) {
          // ISO datetime format: "2024-01-01T14:30:00Z" or "2024-01-01T14:30:00"
          const timePart = entryTime.split('T')[1].replace('Z', '').split('.')[0] // Remove timezone and milliseconds
          const hourStr = timePart.split(':')[0]
          hour = parseInt(hourStr, 10)
        } else if (entryTime.includes(' ')) {
          // Check if it's 12-hour format with AM/PM: "11:52 AM" or "1:57 PM"
          const upperTime = entryTime.toUpperCase()
          if (upperTime.includes('AM') || upperTime.includes('PM')) {
            const isPM = upperTime.includes('PM')
            // Extract the time part before AM/PM
            const timeMatch = entryTime.match(/(\d+):(\d+)/)
            if (timeMatch) {
              hour = parseInt(timeMatch[1], 10)
              // Convert 12-hour to 24-hour format
              if (isPM && hour !== 12) hour += 12
              else if (!isPM && hour === 12) hour = 0
            }
          } else {
            // Format with space: "2024-01-01 14:30:00" or "14:30:00"
            const parts = entryTime.split(' ')
            const timePart = parts[parts.length - 1] // Get the last part (time)
            hour = parseInt(timePart.split(':')[0], 10)
          }
        } else if (entryTime.includes(':')) {
          // Simple time format: "14:30" or "14:30:00"
          hour = parseInt(entryTime.split(':')[0], 10)
        } else {
          // Try to parse as just hour number
          const parsed = parseInt(entryTime, 10)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 23) {
            hour = parsed
          }
        }

        // Validate hour is valid number
        if (hour !== undefined && (isNaN(hour) || hour < 0 || hour > 23)) {
          console.error(`❌ Invalid hour extracted: ${hour} from entryTime: "${entryTime}"`)
          hour = undefined
        }

        // Ensure hour is valid (0-23)
        if (hour !== undefined && hour >= 0 && hour <= 23) {
          const hourLabel = `${hour.toString().padStart(2, '0')}:00`
          const currentR = hourMap.get(hourLabel) || 0
          const rMultiple = getRMultipleValue(trade, mode)
          hourMap.set(hourLabel, currentR + rMultiple)
        }
      } catch (error) {
        console.warn('Failed to parse entry time for R-multiple performance:', entryTime, error)
      }
    }
  })

  // Extended market hours 4:00 AM to 8:00 PM (covering pre-market, regular hours, and after-hours)
  const marketHours = ['04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']

  return marketHours.map(hour => ({
    label: hour,
    value: hourMap.get(hour) || 0
  }))
}

export function getPerformanceByDayR(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const dayMap = new Map<string, number>()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  trades.forEach(trade => {
    const date = new Date(trade.date)
    const dayName = dayNames[date.getDay()]
    const currentR = dayMap.get(dayName) || 0
    const rMultiple = getRMultipleValue(trade, mode)
    dayMap.set(dayName, currentR + rMultiple)
  })

  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => ({
    label: day.slice(0, 3), // Mon, Tue, etc.
    value: dayMap.get(day) || 0
  }))
}

export function getPerformanceByMonthR(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  const monthMap = new Map<string, number>()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  trades.forEach(trade => {
    const date = new Date(trade.date)
    const monthName = monthNames[date.getMonth()]
    const currentR = monthMap.get(monthName) || 0
    const rMultiple = getRMultipleValue(trade, mode)
    monthMap.set(monthName, currentR + rMultiple)
  })

  return monthNames.map(month => ({
    label: month,
    value: monthMap.get(month) || 0
  }))
}

// Profit Factor Over Time Analysis (Monthly)
export function getProfitFactorOverTime(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): ChartDataPoint[] {
  if (trades.length === 0) return []

  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Group trades by month
  const monthlyData = new Map<string, { profits: number, losses: number }>()

  sortedTrades.forEach(trade => {
    const date = new Date(trade.date)
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`

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

  // Convert to array and calculate profit factors
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return Array.from(monthlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-')
      const monthName = monthNames[parseInt(month) - 1]
      const label = `${monthName} ${year}`

      // Calculate profit factor for the month
      const profitFactor = data.losses > 0 ? data.profits / data.losses : (data.profits > 0 ? 99 : 0)

      return {
        label,
        value: Number(profitFactor.toFixed(2))
      }
    })
}

// Win/Loss Day Analysis Interfaces
export interface WinLossDayComparison {
  winningDays: {
    count: number
    totalPnL: number
    averagePnL: number
    averageTrades: number
    averageVolume: number
    averageRiskAmount?: number
    bestDay: number
    bestDayRMultiple?: number
    bestStreak: number
    averageHoldTime: number
  }
  losingDays: {
    count: number
    totalPnL: number
    averagePnL: number
    averageTrades: number
    averageVolume: number
    averageRiskAmount?: number
    worstDay: number
    worstDayRMultiple?: number
    worstStreak: number
    averageHoldTime: number
  }
  scratchDays: {
    count: number
  }
  overallMetrics: {
    totalTradingDays: number
    winDayRate: number
    avgDayVolume: number
    profitableDayFactor: number
  }
}

export interface DailyTradingData {
  date: string
  dailyPnL: number
  tradeCount: number
  totalVolume: number
  averageHoldTime: number
  totalRiskAmount: number
  dailyRMultiple: number
  trades: TraderraTrade[]
}

// Win/Loss Day Comparative Analysis
export function getWinLossDayComparison(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): WinLossDayComparison {
  if (trades.length === 0) {
    return {
      winningDays: {
        count: 0, totalPnL: 0, averagePnL: 0, averageTrades: 0, averageVolume: 0,
        bestDay: 0, bestStreak: 0, averageHoldTime: 0
      },
      losingDays: {
        count: 0, totalPnL: 0, averagePnL: 0, averageTrades: 0, averageVolume: 0,
        worstDay: 0, worstStreak: 0, averageHoldTime: 0
      },
      scratchDays: { count: 0 },
      overallMetrics: {
        totalTradingDays: 0, winDayRate: 0, avgDayVolume: 0, profitableDayFactor: 0
      }
    }
  }

  // Group trades by date to get daily performance
  const dailyData = new Map<string, DailyTradingData>()

  trades.forEach(trade => {
    const date = trade.date
    const pnl = getPnLValue(trade, mode)
    const volume = trade.quantity || 0
    const holdTime = parseDurationToHours(trade.duration || '0h')

    if (!dailyData.has(date)) {
      dailyData.set(date, {
        date,
        dailyPnL: 0,
        tradeCount: 0,
        totalVolume: 0,
        averageHoldTime: 0,
        totalRiskAmount: 0,
        dailyRMultiple: 0,
        trades: []
      })
    }

    const dayData = dailyData.get(date)!
    dayData.dailyPnL += pnl
    dayData.tradeCount += 1
    dayData.totalVolume += volume
    dayData.averageHoldTime += holdTime
    dayData.totalRiskAmount += (trade.riskAmount || 0)
    dayData.trades.push(trade)
  })

  // Calculate average hold time and daily R-multiple for each day
  dailyData.forEach(dayData => {
    dayData.averageHoldTime = dayData.tradeCount > 0 ? dayData.averageHoldTime / dayData.tradeCount : 0
    // Calculate daily R-multiple by summing individual trade R-multiples
    dayData.dailyRMultiple = dayData.trades.reduce((sum, trade) => {
      return sum + getRMultipleValue(trade, mode)
    }, 0)
  })

  // Categorize days by performance
  const winningDays: DailyTradingData[] = []
  const losingDays: DailyTradingData[] = []
  const scratchDays: DailyTradingData[] = []

  Array.from(dailyData.values()).forEach(dayData => {
    if (dayData.dailyPnL > 0) {
      winningDays.push(dayData)
    } else if (dayData.dailyPnL < 0) {
      losingDays.push(dayData)
    } else {
      scratchDays.push(dayData)
    }
  })

  // Calculate winning day metrics
  const winningDayMetrics = {
    count: winningDays.length,
    totalPnL: winningDays.reduce((sum, day) => sum + day.dailyPnL, 0),
    averagePnL: winningDays.length > 0 ?
      winningDays.reduce((sum, day) => sum + day.dailyPnL, 0) / winningDays.length : 0,
    averageTrades: winningDays.length > 0 ?
      winningDays.reduce((sum, day) => sum + day.tradeCount, 0) / winningDays.length : 0,
    averageVolume: winningDays.length > 0 ?
      winningDays.reduce((sum, day) => sum + day.totalVolume, 0) / winningDays.length : 0,
    averageRiskAmount: winningDays.length > 0 ?
      winningDays.reduce((sum, day) => sum + day.totalRiskAmount, 0) / winningDays.length : 0,
    bestDay: winningDays.length > 0 ? Math.max(...winningDays.map(day => day.dailyPnL)) : 0,
    bestDayRiskAmount: winningDays.length > 0 ?
      winningDays.find(day => day.dailyPnL === Math.max(...winningDays.map(d => d.dailyPnL)))?.totalRiskAmount || 0 : 0,
    bestDayRMultiple: winningDays.length > 0 ?
      winningDays.find(day => day.dailyPnL === Math.max(...winningDays.map(d => d.dailyPnL)))?.dailyRMultiple || 0 : 0,
    bestStreak: calculateWinStreak(winningDays, dailyData),
    averageHoldTime: winningDays.length > 0 ?
      winningDays.reduce((sum, day) => sum + day.averageHoldTime, 0) / winningDays.length : 0
  }

  // Calculate losing day metrics
  const losingDayMetrics = {
    count: losingDays.length,
    totalPnL: losingDays.reduce((sum, day) => sum + day.dailyPnL, 0),
    averagePnL: losingDays.length > 0 ?
      losingDays.reduce((sum, day) => sum + day.dailyPnL, 0) / losingDays.length : 0,
    averageTrades: losingDays.length > 0 ?
      losingDays.reduce((sum, day) => sum + day.tradeCount, 0) / losingDays.length : 0,
    averageVolume: losingDays.length > 0 ?
      losingDays.reduce((sum, day) => sum + day.totalVolume, 0) / losingDays.length : 0,
    averageRiskAmount: losingDays.length > 0 ?
      losingDays.reduce((sum, day) => sum + day.totalRiskAmount, 0) / losingDays.length : 0,
    worstDay: losingDays.length > 0 ? Math.min(...losingDays.map(day => day.dailyPnL)) : 0,
    worstDayRiskAmount: losingDays.length > 0 ?
      losingDays.find(day => day.dailyPnL === Math.min(...losingDays.map(d => d.dailyPnL)))?.totalRiskAmount || 0 : 0,
    worstDayRMultiple: losingDays.length > 0 ?
      losingDays.find(day => day.dailyPnL === Math.min(...losingDays.map(d => d.dailyPnL)))?.dailyRMultiple || 0 : 0,
    worstStreak: calculateLossStreak(losingDays, dailyData),
    averageHoldTime: losingDays.length > 0 ?
      losingDays.reduce((sum, day) => sum + day.averageHoldTime, 0) / losingDays.length : 0
  }

  // Calculate overall metrics
  const totalTradingDays = dailyData.size
  const winDayRate = totalTradingDays > 0 ? (winningDays.length / totalTradingDays) * 100 : 0
  const avgDayVolume = totalTradingDays > 0 ?
    Array.from(dailyData.values()).reduce((sum, day) => sum + day.totalVolume, 0) / totalTradingDays : 0
  const profitableDayFactor = Math.abs(losingDayMetrics.totalPnL) > 0 ?
    winningDayMetrics.totalPnL / Math.abs(losingDayMetrics.totalPnL) :
    (winningDayMetrics.totalPnL > 0 ? 99 : 0)

  return {
    winningDays: winningDayMetrics,
    losingDays: losingDayMetrics,
    scratchDays: { count: scratchDays.length },
    overallMetrics: {
      totalTradingDays,
      winDayRate,
      avgDayVolume,
      profitableDayFactor
    }
  }
}

// Helper function to calculate winning day streaks
function calculateWinStreak(winningDays: DailyTradingData[], allDailyData: Map<string, DailyTradingData>): number {
  const sortedDates = Array.from(allDailyData.keys()).sort()
  let maxStreak = 0
  let currentStreak = 0

  sortedDates.forEach(date => {
    const dayData = allDailyData.get(date)!
    if (dayData.dailyPnL > 0) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  })

  return maxStreak
}

// Helper function to calculate losing day streaks
function calculateLossStreak(losingDays: DailyTradingData[], allDailyData: Map<string, DailyTradingData>): number {
  const sortedDates = Array.from(allDailyData.keys()).sort()
  let maxStreak = 0
  let currentStreak = 0

  sortedDates.forEach(date => {
    const dayData = allDailyData.get(date)!
    if (dayData.dailyPnL < 0) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  })

  return maxStreak
}

// Time-based Performance Pattern Analysis
export interface TimePatternAnalysis {
  dayOfWeekPatterns: {
    label: string
    winRate: number
    avgPnL: number
    tradeCount: number
    avgTradesPerDay: number
  }[]
  hourlyPatterns: {
    hour: number
    winRate: number
    avgPnL: number
    tradeCount: number
    description: string
  }[]
  monthlySeasonality: {
    month: string
    winRate: number
    avgPnL: number
    tradeCount: number
    volatility: number
  }[]
}

export function getTimePatternAnalysis(trades: TraderraTrade[], mode: 'gross' | 'net' = 'net'): TimePatternAnalysis {
  if (trades.length === 0) {
    return {
      dayOfWeekPatterns: [],
      hourlyPatterns: [],
      monthlySeasonality: []
    }
  }

  // Day of week analysis
  const dayOfWeekData = new Map<string, { wins: number, total: number, pnl: number }>()
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Initialize all days
  dayNames.forEach(day => {
    dayOfWeekData.set(day, { wins: 0, total: 0, pnl: 0 })
  })

  // Hourly analysis
  const hourlyData = new Map<number, { wins: number, total: number, pnl: number }>()
  for (let hour = 0; hour < 24; hour++) {
    hourlyData.set(hour, { wins: 0, total: 0, pnl: 0 })
  }

  // Monthly analysis
  const monthlyData = new Map<string, { wins: number, total: number, pnl: number, pnlValues: number[] }>()
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  monthNames.forEach(month => {
    monthlyData.set(month, { wins: 0, total: 0, pnl: 0, pnlValues: [] })
  })

  trades.forEach(trade => {
    const pnl = getPnLValue(trade, mode)
    const isWin = pnl > 0

    // Day of week analysis
    const date = new Date(trade.date)
    const dayName = dayNames[date.getDay()]
    const dayData = dayOfWeekData.get(dayName)!
    dayData.total += 1
    dayData.pnl += pnl
    if (isWin) dayData.wins += 1

    // Hourly analysis (if entry time is available)
    if (trade.entryTime) {
      const entryDate = new Date(trade.entryTime)
      const hour = entryDate.getHours()
      const hourData = hourlyData.get(hour)!
      hourData.total += 1
      hourData.pnl += pnl
      if (isWin) hourData.wins += 1
    }

    // Monthly analysis
    const monthName = monthNames[date.getMonth()]
    const monthData = monthlyData.get(monthName)!
    monthData.total += 1
    monthData.pnl += pnl
    monthData.pnlValues.push(pnl)
    if (isWin) monthData.wins += 1
  })

  // Format results
  const dayOfWeekPatterns = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
    const data = dayOfWeekData.get(day)!
    return {
      label: day.slice(0, 3),
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      avgPnL: data.total > 0 ? data.pnl / data.total : 0,
      tradeCount: data.total,
      avgTradesPerDay: data.total > 0 ? data.total / 52 : 0 // Assuming year of data
    }
  })

  const hourlyPatterns = Array.from(hourlyData.entries())
    .filter(([_, data]) => data.total > 0)
    .map(([hour, data]) => ({
      hour,
      winRate: (data.wins / data.total) * 100,
      avgPnL: data.pnl / data.total,
      tradeCount: data.total,
      description: getHourDescription(hour)
    }))

  const monthlySeasonality = monthNames.map(month => {
    const data = monthlyData.get(month)!
    const volatility = data.pnlValues.length > 1 ?
      Math.sqrt(data.pnlValues.reduce((sum, val) => sum + Math.pow(val - (data.pnl / data.total), 2), 0) / data.pnlValues.length) : 0

    return {
      month,
      winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
      avgPnL: data.total > 0 ? data.pnl / data.total : 0,
      tradeCount: data.total,
      volatility
    }
  })

  return {
    dayOfWeekPatterns,
    hourlyPatterns,
    monthlySeasonality
  }
}

function getHourDescription(hour: number): string {
  if (hour >= 4 && hour < 9) return 'Pre-Market'
  if (hour >= 9 && hour < 12) return 'Morning Session'
  if (hour >= 12 && hour < 14) return 'Lunch Period'
  if (hour >= 14 && hour < 16) return 'Afternoon Session'
  if (hour >= 16 && hour < 20) return 'After Hours'
  return 'Overnight'
}

