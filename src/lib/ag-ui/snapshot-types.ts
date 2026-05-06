/**
 * Snapshot & Comparison System Type Definitions
 *
 * Enables Renata AI to capture page states, compare different filter configurations,
 * and reference these comparisons in chat conversations.
 */

/**
 * Complete page snapshot containing filter state, computed statistics, and metadata
 */
export interface PageSnapshot {
  /** Unique identifier (UUID or timestamp-based) */
  id: string

  /** User-provided descriptive name */
  name: string

  /** Unix timestamp when snapshot was created */
  timestamp: number

  /** Page where snapshot was captured */
  page: 'dashboard' | 'statistics'

  /** Filter state at time of snapshot */
  filters: SnapshotFilters

  /** Computed statistics for the filtered data */
  statistics: SnapshotStatistics

  /** IDs of trades included in this snapshot (for reference) */
  tradeIds: string[]
}

/**
 * Filter state captured in snapshot
 */
export interface SnapshotFilters {
  /** Date range filter applied */
  dateRange: string

  /** Symbol filter (null if none applied) */
  symbol: string | null

  /** Side filter (Long/Short/null for all) */
  side: string | null

  /** Duration filter (null if none applied) */
  duration: string | null

  /** Strategy filter (null if none applied) */
  strategy: string | null

  /** Display mode (dollar/r_multiple/percentage) */
  displayMode: string

  /** P&L mode (net/gross) */
  pnlMode?: string
}

/**
 * Statistics captured in snapshot
 */
export interface SnapshotStatistics {
  /** Total number of trades */
  totalTrades: number

  /** Number of winning trades */
  winningTrades: number

  /** Number of losing trades */
  losingTrades: number

  /** Win rate as percentage (0-100) */
  winRate: number

  /** Total gain/loss in dollars */
  totalGainLoss: number

  /** Total gain/loss in R-multiples */
  totalRMultiple: number

  /** Profit factor ratio */
  profitFactor: number

  /** Expectancy per trade in dollars */
  expectancy: number

  /** Expectancy per trade in R-multiples */
  expectancyR: number

  /** Average winning trade in dollars */
  avgWin: number

  /** Average winning trade in R-multiples */
  avgWinR: number

  /** Average losing trade in dollars */
  avgLoss: number

  /** Average losing trade in R-multiples */
  avgLossR: number

  /** Largest winning trade in dollars */
  largestWin: number

  /** Largest winning trade in R-multiples */
  largestWinR: number

  /** Largest losing trade in dollars */
  largestLoss: number

  /** Largest losing trade in R-multiples */
  largestLossR: number

  /** Maximum drawdown in dollars */
  maxDrawdown: number

  /** Maximum drawdown in R-multiples */
  maxDrawdownR: number

  /** Sharpe ratio */
  sharpeRatio?: number

  /** Kelly percentage */
  kellyPercentage?: number

  /** K-Ratio */
  kRatio?: number

  /** System Quality Number (SQN) */
  systemQualityNumber?: number

  /** Maximum consecutive wins */
  maxConsecutiveWins?: number

  /** Maximum consecutive losses */
  maxConsecutiveLosses?: number

  /** Average hold time for winners (milliseconds) */
  avgHoldTimeWinner?: number

  /** Average hold time for losers (milliseconds) */
  avgHoldTimeLoser?: number

  /** Total commissions paid */
  totalCommissions?: number

  /** Total fees paid */
  totalFees?: number
}

/**
 * Result of comparing two snapshots
 */
export interface ComparisonResult {
  /** First snapshot being compared */
  snapshot1: {
    name: string
    timestamp: number
  }

  /** Second snapshot being compared */
  snapshot2: {
    name: string
    timestamp: number
  }

  /** Individual metric differences */
  differences: MetricDifference[]

  /** Human-readable summary insights */
  summary: string[]
}

/**
 * Difference between a single metric across two snapshots
 */
export interface MetricDifference {
  /** Metric name being compared */
  metric: string

  /** Value from first snapshot */
  value1: number | string

  /** Value from second snapshot */
  value2: number | string

  /** Absolute change (value2 - value1) */
  absoluteChange: number

  /** Percentage change (null for non-numeric metrics) */
  percentChange: number | null

  /** Human-readable description of the difference */
  insight: string
}

/**
 * Snapshot summary for display (lighter than full snapshot)
 */
export interface SnapshotSummary {
  id: string
  name: string
  timestamp: number
  page: string
  tradeCount: number
  winRate: number
  totalPnL: number
}

/**
 * Snapshot collection from localStorage
 */
export interface SnapshotCollection {
  snapshots: PageSnapshot[]
  lastUpdated: number
}
