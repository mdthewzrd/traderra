/**
 * Enhanced Trade Data Types for DOS Trader-Tradervue Integration
 *
 * This module defines the enhanced trade data structures that support
 * multiple execution details while preserving existing Tradervue data.
 */

// Base execution record from DOS Trader
export interface DOSExecution {
  id: string
  timestamp: string          // ISO string format: '2024-12-13T09:30:15.123Z'
  symbol: string
  side: 'Buy' | 'Sell'
  quantity: number
  price: number
  venue: string              // Exchange/venue: 'ARCA', 'NASDAQ', 'NYSE', etc.
  commission: number
  fees: number
  orderId?: string           // Original order ID if available
  executionId: string        // Unique execution identifier
  liquidity?: 'Added' | 'Removed'  // For execution quality analysis
}

// Enhanced execution with calculated metrics
export interface TradeExecution extends DOSExecution {
  // Calculated execution quality metrics
  slippage?: number          // Price difference from expected
  marketImpact?: number      // Estimated market impact
  timing?: 'Early' | 'OnTime' | 'Late'  // Relative to market events

  // Visual display properties
  arrowColor?: string        // Custom color for chart display
  arrowSize?: 'small' | 'medium' | 'large'
  label?: string             // Custom display label
}

// Original Tradervue trade interface (preserved)
export interface TraderVueTrade {
  'Open Datetime': string
  'Close Datetime': string
  'Symbol': string
  'Side': string
  'Volume': string
  'Exec Count': string
  'Entry Price': string
  'Exit Price': string
  'Gross P&L': string
  'Gross P&L (%)': string
  'Shared': string
  'Notes': string
  'Tags': string
  'Gross P&L (t)': string
  'Net P&L': string
  'Commissions': string
  'Fees': string
  'Initial Risk': string
  'P&L (R)': string
  'Position MFE': string
  'Position MAE': string
  'Price MFE': string
  'Price MAE': string
  'Position MFE Datetime': string
  'Position MAE Datetime': string
  'Price MFE Datetime': string
  'Price MAE Datetime': string
  'Best Exit P&L': string
  'Best Exit Datetime': string
}

// Enhanced trade structure combining Tradervue data with DOS executions
export interface EnhancedTrade {
  // Original Tradervue fields (preserved for backward compatibility)
  id: string
  date: string
  symbol: string
  side: 'Long' | 'Short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  pnlPercent: number
  commission: number
  duration: string
  strategy: string
  notes: string
  entryTime: string
  exitTime: string
  riskAmount?: number
  riskPercent?: number
  stopLoss?: number
  rMultiple?: number
  mfe?: number
  mae?: number

  // Enhanced execution data
  executions: {
    entries: TradeExecution[]   // All entry executions
    exits: TradeExecution[]     // All exit executions
  }

  // Calculated execution statistics
  executionStats: {
    totalExecutions: number
    averageSlippage: number
    totalCommissions: number
    totalFees: number
    vwapEntry: number          // Volume-weighted average price for entries
    vwapExit: number           // Volume-weighted average price for exits
    executionTimeSpan: number  // Total time from first to last execution (ms)
    venueDistribution: { [venue: string]: number }  // Execution count by venue
    qualityScore: number       // Overall execution quality (0-100)
  }

  // Matching metadata
  matchingInfo: {
    matched: boolean
    confidence: number         // Matching confidence score (0-1)
    tradervueTradeId?: string  // Original Tradervue trade ID if matched
    dosTradeGroup?: string     // DOS trade grouping identifier
    discrepancies?: string[]   // Any identified discrepancies
    matchingCriteria: {
      symbolMatch: boolean
      timeWindowMatch: boolean  // Within ±30 minutes
      quantityMatch: boolean
      sideMatch: boolean
    }
  }

  // Source data preservation
  sourceData: {
    tradervue?: TraderVueTrade  // Original Tradervue data
    dosRaw?: DOSExecution[]     // Raw DOS execution data
    importTimestamp: string     // When this enhanced trade was created
    version: string             // Data structure version for migrations
  }
}

// Trade matching algorithm result
export interface TradeMatchResult {
  tradervueTrade: TraderVueTrade
  dosExecutions: DOSExecution[]
  matchScore: number          // 0-1 matching confidence
  enhancedTrade: EnhancedTrade
  warnings: string[]
  errors: string[]
}

// Batch processing result for multiple trades
export interface TradeEnhancementResult {
  processed: number
  matched: number
  unmatched: number
  errors: number
  enhancedTrades: EnhancedTrade[]
  unmatchedTradervue: TraderVueTrade[]
  unmatchedDOS: DOSExecution[]
  processingStats: {
    startTime: string
    endTime: string
    duration: number           // Processing time in milliseconds
    averageMatchScore: number
    qualityDistribution: { [range: string]: number }
  }
}

// Chart visualization configuration for enhanced trades
export interface EnhancedChartConfig {
  showAllExecutions: boolean
  groupExecutionsByTime: boolean
  executionGroupingWindow: number  // Minutes to group executions
  arrowSizing: 'proportional' | 'fixed'  // Size based on quantity or fixed
  colorScheme: 'side' | 'quality' | 'venue' | 'timing'
  displayLabels: boolean
  showExecutionStats: boolean
}

// Execution quality analysis
export interface ExecutionQualityAnalysis {
  tradeId: string
  overallScore: number       // 0-100 quality score
  metrics: {
    slippageScore: number     // Lower slippage = higher score
    timingScore: number       // Better timing = higher score
    costScore: number         // Lower costs = higher score
    venueScore: number        // Venue diversification score
  }
  recommendations: string[]
  benchmarkComparisons: {
    vsMarket: number          // How this execution compares to market
    vsHistorical: number      // How this compares to user's history
  }
}

// DOS Trader CSV format (expected input structure)
export interface DOSTraderCSV {
  'Date': string
  'Time': string
  'Symbol': string
  'Side': string
  'Quantity': string
  'Price': string
  'Venue': string
  'Commission': string
  'Fees': string
  'Order ID'?: string
  'Execution ID': string
  'Liquidity'?: string
}

// Validation and error handling
export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
  suggestedFix?: string
}

export interface TradeValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  trade?: EnhancedTrade
}