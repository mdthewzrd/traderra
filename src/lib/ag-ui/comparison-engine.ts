/**
 * Comparison Engine - Analyze differences between snapshots
 *
 * Compares two snapshots and generates human-readable insights about
 * performance differences across metrics.
 */

import type {
  PageSnapshot,
  ComparisonResult,
  MetricDifference,
  SnapshotStatistics
} from './snapshot-types'

/**
 * Format a number as currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Format a number as percentage
 */
function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format a number with R-multiple notation
 */
function formatRMultiple(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}R`
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100
  return ((to - from) / Math.abs(from)) * 100
}

/**
 * Determine if a change is significant (>10% or absolute threshold)
 */
function isSignificant(percentChange: number | null, absoluteThreshold: number = 100): boolean {
  if (percentChange === null) return false
  return Math.abs(percentChange) > 10 || Math.abs(absoluteThreshold) > 100
}

/**
 * Generate insight for a metric difference
 */
function generateInsight(
  metric: string,
  value1: number,
  value2: number,
  percentChange: number | null,
  formatter?: (v: number) => string
): string {
  const formattedValue1 = formatter ? formatter(value1) : value1.toString()
  const formattedValue2 = formatter ? formatter(value2) : value2.toString()

  if (percentChange === null) {
    return `${metric}: ${formattedValue1} → ${formattedValue2}`
  }

  const direction = value2 > value1 ? 'increased' : value2 < value1 ? 'decreased' : 'remained the same'
  const changeFormatted = formatPercent(Math.abs(percentChange))

  if (value2 === value1) {
    return `${metric}: ${formattedValue1} (no change)`
  }

  const changeDesc = value2 > value1 ? `+${changeFormatted}` : `-${changeFormatted}`

  if (metric.toLowerCase().includes('rate') || metric.toLowerCase().includes('percentage')) {
    // For percentage metrics, show point difference
    const pointDiff = value2 - value1
    return `${metric}: ${formattedValue1} → ${formattedValue2} (${pointDiff >= 0 ? '+' : ''}${pointDiff.toFixed(1)} points)`
  }

  return `${metric}: ${formattedValue1} → ${formattedValue2} (${changeDesc})`
}

/**
 * Compare a single metric between two snapshots
 */
function compareMetric(
  name: string,
  stat1: number | undefined,
  stat2: number | undefined,
  formatter?: (v: number) => string
): MetricDifference | null {
  const value1 = stat1 ?? 0
  const value2 = stat2 ?? 0

  const absoluteChange = value2 - value1
  const percentChange = value1 !== 0 ? calculatePercentChange(value1, value2) : null

  const insight = generateInsight(name, value1, value2, percentChange, formatter)

  return {
    metric: name,
    value1: formatter ? formatter(value1) : value1,
    value2: formatter ? formatter(value2) : value2,
    absoluteChange,
    percentChange,
    insight
  }
}

/**
 * Compare two snapshots and generate comprehensive comparison result
 */
export function compareSnapshots(snapshot1: PageSnapshot, snapshot2: PageSnapshot): ComparisonResult {
  const s1 = snapshot1.statistics
  const s2 = snapshot2.statistics

  const differences: MetricDifference[] = []

  // Primary metrics
  if (s1.totalTrades !== undefined || s2.totalTrades !== undefined) {
    differences.push(compareMetric('Total Trades', s1.totalTrades, s2.totalTrades, v => v.toString())!)
  }

  if (s1.winRate !== undefined || s2.winRate !== undefined) {
    differences.push(compareMetric('Win Rate', s1.winRate, s2.winRate, v => formatPercent(v))!)
  }

  if (s1.totalGainLoss !== undefined || s2.totalGainLoss !== undefined) {
    differences.push(compareMetric('Total P&L', s1.totalGainLoss, s2.totalGainLoss, formatCurrency)!)
  }

  if (s1.totalRMultiple !== undefined || s2.totalRMultiple !== undefined) {
    differences.push(compareMetric('Total R-Multiple', s1.totalRMultiple, s2.totalRMultiple, formatRMultiple)!)
  }

  if (s1.profitFactor !== undefined || s2.profitFactor !== undefined) {
    differences.push(compareMetric('Profit Factor', s1.profitFactor, s2.profitFactor, v => v.toFixed(2))!)
  }

  if (s1.expectancy !== undefined || s2.expectancy !== undefined) {
    differences.push(compareMetric('Expectancy ($)', s1.expectancy, s2.expectancy, formatCurrency)!)
  }

  if (s1.expectancyR !== undefined || s2.expectancyR !== undefined) {
    differences.push(compareMetric('Expectancy (R)', s1.expectancyR, s2.expectancyR, formatRMultiple)!)
  }

  // Win/Loss analysis
  if (s1.avgWin !== undefined || s2.avgWin !== undefined) {
    differences.push(compareMetric('Average Winner', s1.avgWin, s2.avgWin, formatCurrency)!)
  }

  if (s1.avgLoss !== undefined || s2.avgLoss !== undefined) {
    differences.push(compareMetric('Average Loser', s1.avgLoss, s2.avgLoss, formatCurrency)!)
  }

  if (s1.winningTrades !== undefined || s2.winningTrades !== undefined) {
    differences.push(compareMetric('Winning Trades', s1.winningTrades, s2.winningTrades, v => v.toString())!)
  }

  if (s1.losingTrades !== undefined || s2.losingTrades !== undefined) {
    differences.push(compareMetric('Losing Trades', s1.losingTrades, s2.losingTrades, v => v.toString())!)
  }

  // Risk metrics
  if (s1.maxDrawdown !== undefined || s2.maxDrawdown !== undefined) {
    differences.push(compareMetric('Max Drawdown', s1.maxDrawdown, s2.maxDrawdown, formatCurrency)!)
  }

  if (s1.largestWin !== undefined || s2.largestWin !== undefined) {
    differences.push(compareMetric('Largest Win', s1.largestWin, s2.largestWin, formatCurrency)!)
  }

  if (s1.largestLoss !== undefined || s2.largestLoss !== undefined) {
    differences.push(compareMetric('Largest Loss', s1.largestLoss, s2.largestLoss, formatCurrency)!)
  }

  // Advanced metrics (if available)
  if (s1.sharpeRatio !== undefined || s2.sharpeRatio !== undefined) {
    differences.push(compareMetric('Sharpe Ratio', s1.sharpeRatio, s2.sharpeRatio, v => v.toFixed(2))!)
  }

  // Generate summary insights
  const summary = generateSummary(snapshot1, snapshot2, differences)

  return {
    snapshot1: {
      name: snapshot1.name,
      timestamp: snapshot1.timestamp
    },
    snapshot2: {
      name: snapshot2.name,
      timestamp: snapshot2.timestamp
    },
    differences,
    summary
  }
}

/**
 * Generate human-readable summary insights
 */
function generateSummary(
  snapshot1: PageSnapshot,
  snapshot2: PageSnapshot,
  differences: MetricDifference[]
): string[] {
  const insights: string[] = []
  const s1 = snapshot1.statistics
  const s2 = snapshot2.statistics

  // Trade count comparison
  const tradeDiff = (s2.totalTrades || 0) - (s1.totalTrades || 0)
  if (tradeDiff !== 0) {
    const tradePercent = s1.totalTrades ? calculatePercentChange(s1.totalTrades, s2.totalTrades) : null
    if (tradePercent && Math.abs(tradePercent) > 10) {
      insights.push(`Trade count ${tradeDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(tradeDiff)} (${formatPercent(Math.abs(tradePercent))})`)
    }
  }

  // Win rate comparison
  const winRateDiff = (s2.winRate || 0) - (s1.winRate || 0)
  if (Math.abs(winRateDiff) > 5) {
    insights.push(`Win rate ${winRateDiff > 0 ? 'improved' : 'declined'} by ${formatPercent(Math.abs(winRateDiff))} (${formatPercent(s1.winRate || 0)} → ${formatPercent(s2.winRate || 0)})`)
  }

  // Profitability comparison
  const pnlDiff = (s2.totalGainLoss || 0) - (s1.totalGainLoss || 0)
  if (Math.abs(pnlDiff) > 1000) {
    const pnlPercent = s1.totalGainLoss ? calculatePercentChange(s1.totalGainLoss, s2.totalGainLoss) : null
    const pnlChangeText = pnlPercent ? ` (${formatPercent(pnlPercent)})` : ''
    insights.push(`Total P&L ${pnlDiff > 0 ? 'increased' : 'decreased'} by ${formatCurrency(Math.abs(pnlDiff))}${pnlChangeText}`)
  }

  // Profit factor comparison
  const pfDiff = (s2.profitFactor || 0) - (s1.profitFactor || 0)
  if (Math.abs(pfDiff) > 0.2 && (s1.profitFactor || 0) > 0) {
    insights.push(`Profit factor ${pfDiff > 0 ? 'improved' : 'declined'} from ${(s1.profitFactor || 0).toFixed(2)} to ${(s2.profitFactor || 0).toFixed(2)}`)
  }

  // Expectancy comparison
  const expDiff = (s2.expectancy || 0) - (s1.expectancy || 0)
  if (Math.abs(expDiff) > 50) {
    insights.push(`Expectancy per trade ${expDiff > 0 ? 'increased' : 'decreased'} from ${formatCurrency(s1.expectancy || 0)} to ${formatCurrency(s2.expectancy || 0)}`)
  }

  // Risk analysis
  if (s1.maxDrawdown && s2.maxDrawdown) {
    const ddDiff = s2.maxDrawdown - s1.maxDrawdown
    if (Math.abs(ddDiff) > 500) {
      insights.push(`Max drawdown ${ddDiff > 0 ? 'increased' : 'decreased'} from ${formatCurrency(Math.abs(s1.maxDrawdown))} to ${formatCurrency(Math.abs(s2.maxDrawdown))}`)
    }
  }

  // Overall performance assessment
  const s1Profitable = (s1.totalGainLoss || 0) > 0
  const s2Profitable = (s2.totalGainLoss || 0) > 0

  if (s1Profitable && !s2Profitable) {
    insights.push(`⚠️ Performance shifted from profitable (${formatCurrency(s1.totalGainLoss || 0)}) to unprofitable (${formatCurrency(s2.totalGainLoss || 0)})`)
  } else if (!s1Profitable && s2Profitable) {
    insights.push(`✅ Performance improved from unprofitable (${formatCurrency(s1.totalGainLoss || 0)}) to profitable (${formatCurrency(s2.totalGainLoss || 0)})`)
  }

  return insights
}

/**
 * Get significant differences (changes >10% or >$100)
 */
export function getSignificantDifferences(result: ComparisonResult): MetricDifference[] {
  return result.differences.filter(d => isSignificant(d.percentChange, Math.abs(d.absoluteChange)))
}
