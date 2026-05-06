/**
 * AI-Powered Trade Matching Algorithm
 *
 * This module implements sophisticated algorithms to match trades between
 * Tradervue and DOS execution data using multiple criteria and fuzzy matching.
 */

import {
  TraderVueTrade,
  DOSExecution,
  EnhancedTrade,
  TradeMatchResult,
  TradeEnhancementResult,
  ValidationError,
  ExecutionQualityAnalysis
} from '../types/enhanced-trade'

interface MatchingCriteria {
  symbolWeight: number        // Weight for symbol matching
  timeWeight: number          // Weight for time window matching
  quantityWeight: number      // Weight for quantity matching
  sideWeight: number          // Weight for side matching
  priceWeight: number         // Weight for price proximity
}

interface MatchingConfig {
  timeWindowMinutes: number   // ±30 minutes default
  quantityTolerance: number   // 5% default tolerance
  priceTolerance: number      // 2% default tolerance
  minMatchScore: number       // Minimum score to consider a match
  criteria: MatchingCriteria
}

// Default matching configuration
const DEFAULT_CONFIG: MatchingConfig = {
  timeWindowMinutes: 30,
  quantityTolerance: 0.05,  // 5%
  priceTolerance: 0.02,     // 2%
  minMatchScore: 0.7,       // 70% minimum confidence
  criteria: {
    symbolWeight: 0.3,      // 30% - Symbol must match exactly
    timeWeight: 0.25,       // 25% - Time window importance
    quantityWeight: 0.25,   // 25% - Quantity matching
    sideWeight: 0.15,       // 15% - Side matching
    priceWeight: 0.05       // 5% - Price proximity (less critical due to market moves)
  }
}

/**
 * Main trade matching class implementing multi-criteria fuzzy matching
 */
export class TradeMatchingEngine {
  private config: MatchingConfig

  constructor(config: Partial<MatchingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Match a single Tradervue trade against DOS executions
   */
  public matchTrade(
    tradervueTrade: TraderVueTrade,
    dosExecutions: DOSExecution[]
  ): TradeMatchResult {
    const candidates = this.findCandidateExecutions(tradervueTrade, dosExecutions)
    const bestMatch = this.selectBestMatch(tradervueTrade, candidates)

    if (bestMatch.score >= this.config.minMatchScore) {
      const enhancedTrade = this.createEnhancedTrade(tradervueTrade, bestMatch.executions)
      return {
        tradervueTrade,
        dosExecutions: bestMatch.executions,
        matchScore: bestMatch.score,
        enhancedTrade,
        warnings: bestMatch.warnings,
        errors: bestMatch.errors
      }
    }

    return {
      tradervueTrade,
      dosExecutions: [],
      matchScore: 0,
      enhancedTrade: this.createEnhancedTrade(tradervueTrade, []),
      warnings: ['No suitable DOS execution match found'],
      errors: []
    }
  }

  /**
   * Process multiple trades in batch
   */
  public async processTradesBatch(
    tradervueTrades: TraderVueTrade[],
    dosExecutions: DOSExecution[]
  ): Promise<TradeEnhancementResult> {
    const startTime = new Date().toISOString()
    const results: TradeMatchResult[] = []
    const unmatchedTradervue: TraderVueTrade[] = []
    let usedExecutions = new Set<string>()

    // Process each Tradervue trade
    for (const trade of tradervueTrades) {
      const availableExecutions = dosExecutions.filter(exec =>
        !usedExecutions.has(exec.executionId)
      )

      const result = this.matchTrade(trade, availableExecutions)
      results.push(result)

      if (result.matchScore >= this.config.minMatchScore) {
        // Mark these executions as used
        result.dosExecutions.forEach(exec =>
          usedExecutions.add(exec.executionId)
        )
      } else {
        unmatchedTradervue.push(trade)
      }
    }

    // Find unmatched DOS executions
    const unmatchedDOS = dosExecutions.filter(exec =>
      !usedExecutions.has(exec.executionId)
    )

    const endTime = new Date().toISOString()
    const enhancedTrades = results
      .filter(r => r.matchScore >= this.config.minMatchScore)
      .map(r => r.enhancedTrade)

    return {
      processed: tradervueTrades.length,
      matched: enhancedTrades.length,
      unmatched: unmatchedTradervue.length,
      errors: results.reduce((sum, r) => sum + r.errors.length, 0),
      enhancedTrades,
      unmatchedTradervue,
      unmatchedDOS,
      processingStats: {
        startTime,
        endTime,
        duration: new Date(endTime).getTime() - new Date(startTime).getTime(),
        averageMatchScore: this.calculateAverageScore(results),
        qualityDistribution: this.calculateQualityDistribution(enhancedTrades)
      }
    }
  }

  /**
   * Find candidate DOS executions for a Tradervue trade
   */
  private findCandidateExecutions(
    trade: TraderVueTrade,
    executions: DOSExecution[]
  ): DOSExecution[] {
    const symbol = trade['Symbol']?.trim().toUpperCase()
    const openTime = new Date(trade['Open Datetime'])
    const closeTime = new Date(trade['Close Datetime'])

    return executions.filter(exec => {
      // Symbol must match exactly
      if (exec.symbol.trim().toUpperCase() !== symbol) return false

      // Must be within trade time window with buffer
      const execTime = new Date(exec.timestamp)
      const windowStart = new Date(openTime.getTime() - this.config.timeWindowMinutes * 60000)
      const windowEnd = new Date(closeTime.getTime() + this.config.timeWindowMinutes * 60000)

      return execTime >= windowStart && execTime <= windowEnd
    })
  }

  /**
   * Select the best matching execution group using weighted scoring
   */
  private selectBestMatch(
    trade: TraderVueTrade,
    candidates: DOSExecution[]
  ): { executions: DOSExecution[]; score: number; warnings: string[]; errors: string[] } {
    if (candidates.length === 0) {
      return { executions: [], score: 0, warnings: ['No candidate executions found'], errors: [] }
    }

    // Group candidates by potential trade groups (similar timestamps and direction)
    const groups = this.groupExecutionsByTrade(candidates, trade)
    let bestGroup: DOSExecution[] = []
    let bestScore = 0
    const warnings: string[] = []
    const errors: string[] = []

    for (const group of groups) {
      const score = this.calculateMatchScore(trade, group)
      if (score > bestScore) {
        bestScore = score
        bestGroup = group
      }
    }

    // Validate the best match
    if (bestGroup.length > 0) {
      const validation = this.validateMatch(trade, bestGroup)
      warnings.push(...validation.warnings)
      errors.push(...validation.errors)
    }

    return { executions: bestGroup, score: bestScore, warnings, errors }
  }

  /**
   * Group executions that likely belong to the same trade
   */
  private groupExecutionsByTrade(
    executions: DOSExecution[],
    trade: TraderVueTrade
  ): DOSExecution[][] {
    if (executions.length === 0) return []

    // Sort by timestamp
    const sorted = [...executions].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const groups: DOSExecution[][] = []
    const tradeVolume = parseInt(trade['Volume']) || 0
    const tradeSide = trade['Side'] === 'L' ? 'Long' : 'Short'

    // Group consecutive executions that could form a complete trade
    let currentGroup: DOSExecution[] = []
    let groupVolume = 0
    let entryComplete = false

    for (const exec of sorted) {
      const execSide = this.mapDOSSideToTradeDirection(exec.side, tradeSide)
      const isEntry = (tradeSide === 'Long' && execSide === 'entry') ||
                     (tradeSide === 'Short' && execSide === 'entry')

      if (isEntry && !entryComplete) {
        // Adding to entry position
        currentGroup.push(exec)
        groupVolume += exec.quantity

        // Check if entry is complete (volume matches or close enough)
        if (Math.abs(groupVolume - tradeVolume) <= tradeVolume * this.config.quantityTolerance) {
          entryComplete = true
        }
      } else if (!isEntry && entryComplete) {
        // Exit execution
        currentGroup.push(exec)

        // Check if this completes the trade
        const exitVolume = currentGroup
          .filter(e => !this.isEntryExecution(e, tradeSide))
          .reduce((sum, e) => sum + e.quantity, 0)

        if (Math.abs(exitVolume - tradeVolume) <= tradeVolume * this.config.quantityTolerance) {
          groups.push([...currentGroup])
          // Start new group
          currentGroup = []
          groupVolume = 0
          entryComplete = false
        }
      } else if (currentGroup.length === 0) {
        // Start new group
        currentGroup = [exec]
        groupVolume = exec.quantity
        entryComplete = !isEntry
      }
    }

    // Add any remaining group
    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    // If no complete groups found, return the best partial group
    if (groups.length === 0 && sorted.length > 0) {
      groups.push(sorted)
    }

    return groups
  }

  /**
   * Calculate weighted match score for a trade and execution group
   */
  private calculateMatchScore(trade: TraderVueTrade, executions: DOSExecution[]): number {
    if (executions.length === 0) return 0

    const scores = {
      symbol: this.scoreSymbolMatch(trade, executions),
      time: this.scoreTimeMatch(trade, executions),
      quantity: this.scoreQuantityMatch(trade, executions),
      side: this.scoreSideMatch(trade, executions),
      price: this.scorePriceMatch(trade, executions)
    }

    const weightedScore =
      scores.symbol * this.config.criteria.symbolWeight +
      scores.time * this.config.criteria.timeWeight +
      scores.quantity * this.config.criteria.quantityWeight +
      scores.side * this.config.criteria.sideWeight +
      scores.price * this.config.criteria.priceWeight

    return Math.min(1, Math.max(0, weightedScore))
  }

  /**
   * Individual scoring functions
   */
  private scoreSymbolMatch(trade: TraderVueTrade, executions: DOSExecution[]): number {
    const tradeSymbol = trade['Symbol']?.trim().toUpperCase()
    return executions.every(exec => exec.symbol.trim().toUpperCase() === tradeSymbol) ? 1 : 0
  }

  private scoreTimeMatch(trade: TraderVueTrade, executions: DOSExecution[]): number {
    const openTime = new Date(trade['Open Datetime']).getTime()
    const closeTime = new Date(trade['Close Datetime']).getTime()
    const windowMs = this.config.timeWindowMinutes * 60000

    const scores = executions.map(exec => {
      const execTime = new Date(exec.timestamp).getTime()

      if (execTime >= openTime && execTime <= closeTime) return 1 // Perfect

      const distanceFromWindow = Math.min(
        Math.abs(execTime - openTime),
        Math.abs(execTime - closeTime)
      )

      return Math.max(0, 1 - (distanceFromWindow / windowMs))
    })

    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  private scoreQuantityMatch(trade: TraderVueTrade, executions: DOSExecution[]): number {
    const tradeVolume = parseInt(trade['Volume']) || 0
    const totalExecVolume = executions.reduce((sum, exec) => sum + exec.quantity, 0)

    if (tradeVolume === 0) return 0

    const difference = Math.abs(totalExecVolume - tradeVolume) / tradeVolume
    return Math.max(0, 1 - (difference / this.config.quantityTolerance))
  }

  private scoreSideMatch(trade: TraderVueTrade, executions: DOSExecution[]): number {
    const tradeSide = trade['Side'] === 'L' ? 'Long' : 'Short'
    const expectedPattern = this.getExpectedExecutionPattern(tradeSide)

    const actualPattern = executions.map(exec =>
      this.mapDOSSideToTradeDirection(exec.side, tradeSide)
    )

    // Score based on how well the pattern matches expected entry/exit sequence
    return this.scoreExecutionPattern(expectedPattern, actualPattern)
  }

  private scorePriceMatch(trade: TraderVueTrade, executions: DOSExecution[]): number {
    const entryPrice = parseFloat(trade['Entry Price']) || 0
    const exitPrice = parseFloat(trade['Exit Price']) || 0

    if (entryPrice === 0 || exitPrice === 0) return 0.5 // Neutral if no price data

    const entryExecs = executions.filter(exec =>
      this.isEntryExecution(exec, trade['Side'] === 'L' ? 'Long' : 'Short')
    )
    const exitExecs = executions.filter(exec =>
      !this.isEntryExecution(exec, trade['Side'] === 'L' ? 'Long' : 'Short')
    )

    let score = 0
    let count = 0

    if (entryExecs.length > 0) {
      const avgEntryPrice = entryExecs.reduce((sum, exec) => sum + exec.price, 0) / entryExecs.length
      const entryDiff = Math.abs(avgEntryPrice - entryPrice) / entryPrice
      score += Math.max(0, 1 - (entryDiff / this.config.priceTolerance))
      count++
    }

    if (exitExecs.length > 0) {
      const avgExitPrice = exitExecs.reduce((sum, exec) => sum + exec.price, 0) / exitExecs.length
      const exitDiff = Math.abs(avgExitPrice - exitPrice) / exitPrice
      score += Math.max(0, 1 - (exitDiff / this.config.priceTolerance))
      count++
    }

    return count > 0 ? score / count : 0.5
  }

  /**
   * Helper methods
   */
  private mapDOSSideToTradeDirection(dosSide: string, tradeSide: string): 'entry' | 'exit' {
    const side = dosSide.toLowerCase()
    if (tradeSide === 'Long') {
      return side === 'buy' ? 'entry' : 'exit'
    } else {
      return side === 'sell' ? 'entry' : 'exit'
    }
  }

  private isEntryExecution(exec: DOSExecution, tradeSide: string): boolean {
    return this.mapDOSSideToTradeDirection(exec.side, tradeSide) === 'entry'
  }

  private getExpectedExecutionPattern(tradeSide: string): string[] {
    // For long trades: buy entries, then sell exits
    // For short trades: sell entries, then buy exits
    return tradeSide === 'Long' ? ['entry', 'exit'] : ['entry', 'exit']
  }

  private scoreExecutionPattern(expected: string[], actual: string[]): number {
    if (actual.length === 0) return 0

    // Check if we have both entry and exit executions
    const hasEntry = actual.includes('entry')
    const hasExit = actual.includes('exit')

    if (hasEntry && hasExit) return 1
    if (hasEntry || hasExit) return 0.7 // Partial trade
    return 0
  }

  private validateMatch(
    trade: TraderVueTrade,
    executions: DOSExecution[]
  ): { warnings: string[]; errors: string[] } {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for volume discrepancies
    const tradeVolume = parseInt(trade['Volume']) || 0
    const totalExecVolume = executions.reduce((sum, exec) => sum + exec.quantity, 0)
    const volumeDiff = Math.abs(totalExecVolume - tradeVolume)

    if (volumeDiff > tradeVolume * 0.1) { // 10% threshold
      warnings.push(`Volume discrepancy: Trade ${tradeVolume} vs Executions ${totalExecVolume}`)
    }

    // Check for time gaps
    const sortedExecs = [...executions].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    for (let i = 1; i < sortedExecs.length; i++) {
      const timeDiff = new Date(sortedExecs[i].timestamp).getTime() -
                      new Date(sortedExecs[i-1].timestamp).getTime()

      if (timeDiff > 60000 * 60) { // 1 hour gap
        warnings.push(`Large time gap between executions: ${timeDiff / 60000} minutes`)
      }
    }

    return { warnings, errors }
  }

  private createEnhancedTrade(
    tradervueTrade: TraderVueTrade,
    dosExecutions: DOSExecution[]
  ): EnhancedTrade {
    // Convert Tradervue trade using existing converter
    const baseId = `enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const tradeSide = tradervueTrade['Side'] === 'L' ? 'Long' : 'Short'

    // Separate entry and exit executions
    const entries = dosExecutions.filter(exec =>
      this.isEntryExecution(exec, tradeSide)
    )
    const exits = dosExecutions.filter(exec =>
      !this.isEntryExecution(exec, tradeSide)
    )

    // Calculate execution statistics
    const executionStats = this.calculateExecutionStats(dosExecutions)

    // Create enhanced trade structure
    const enhancedTrade: EnhancedTrade = {
      id: baseId,
      date: tradervueTrade['Open Datetime']?.split(' ')[0] || new Date().toISOString().split('T')[0],
      symbol: tradervueTrade['Symbol'] || '',
      side: tradeSide,
      quantity: parseInt(tradervueTrade['Volume']) || 0,
      entryPrice: parseFloat(tradervueTrade['Entry Price']) || 0,
      exitPrice: parseFloat(tradervueTrade['Exit Price']) || 0,
      pnl: parseFloat(tradervueTrade['Net P&L']) || 0,
      pnlPercent: parseFloat(tradervueTrade['Gross P&L (%)']) || 0,
      commission: parseFloat(tradervueTrade['Commissions']) || 0,
      duration: '00:00:00', // Will be calculated
      strategy: tradervueTrade['Tags'] || 'Untagged',
      notes: tradervueTrade['Notes'] || '',
      entryTime: tradervueTrade['Open Datetime'] || new Date().toISOString(),
      exitTime: tradervueTrade['Close Datetime'] || new Date().toISOString(),
      riskAmount: parseFloat(tradervueTrade['Initial Risk']) || undefined,
      rMultiple: parseFloat(tradervueTrade['P&L (R)']?.replace('R', '')) || undefined,
      mfe: parseFloat(tradervueTrade['Position MFE']) || undefined,
      mae: parseFloat(tradervueTrade['Position MAE']) || undefined,

      executions: {
        entries: entries.map(exec => ({ ...exec, arrowColor: '#00ff00', arrowSize: 'medium' as const })),
        exits: exits.map(exec => ({ ...exec, arrowColor: '#ff3300', arrowSize: 'medium' as const }))
      },

      executionStats,

      matchingInfo: {
        matched: dosExecutions.length > 0,
        confidence: dosExecutions.length > 0 ? this.calculateMatchScore(tradervueTrade, dosExecutions) : 0,
        tradervueTradeId: `tv_${tradervueTrade['Symbol']}_${tradervueTrade['Open Datetime']}`,
        dosTradeGroup: dosExecutions.length > 0 ? `dos_${dosExecutions[0].symbol}_${dosExecutions[0].timestamp}` : undefined,
        discrepancies: [],
        matchingCriteria: {
          symbolMatch: true,
          timeWindowMatch: true,
          quantityMatch: true,
          sideMatch: true
        }
      },

      sourceData: {
        tradervue: tradervueTrade,
        dosRaw: dosExecutions,
        importTimestamp: new Date().toISOString(),
        version: '1.0'
      }
    }

    return enhancedTrade
  }

  private calculateExecutionStats(executions: DOSExecution[]) {
    if (executions.length === 0) {
      return {
        totalExecutions: 0,
        averageSlippage: 0,
        totalCommissions: 0,
        totalFees: 0,
        vwapEntry: 0,
        vwapExit: 0,
        executionTimeSpan: 0,
        venueDistribution: {},
        qualityScore: 0
      }
    }

    const sortedExecs = [...executions].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const totalCommissions = executions.reduce((sum, exec) => sum + exec.commission, 0)
    const totalFees = executions.reduce((sum, exec) => sum + exec.fees, 0)

    // Calculate VWAP (simplified - would need market data for proper calculation)
    const totalVolume = executions.reduce((sum, exec) => sum + exec.quantity, 0)
    const weightedPrice = executions.reduce((sum, exec) => sum + (exec.price * exec.quantity), 0)
    const vwap = totalVolume > 0 ? weightedPrice / totalVolume : 0

    // Venue distribution
    const venueDistribution: { [venue: string]: number } = {}
    executions.forEach(exec => {
      venueDistribution[exec.venue] = (venueDistribution[exec.venue] || 0) + 1
    })

    // Time span
    const timeSpan = sortedExecs.length > 1 ?
      new Date(sortedExecs[sortedExecs.length - 1].timestamp).getTime() -
      new Date(sortedExecs[0].timestamp).getTime() : 0

    return {
      totalExecutions: executions.length,
      averageSlippage: 0, // Would need market data to calculate
      totalCommissions,
      totalFees,
      vwapEntry: vwap,
      vwapExit: vwap,
      executionTimeSpan: timeSpan,
      venueDistribution,
      qualityScore: 85 // Placeholder score
    }
  }

  private calculateAverageScore(results: TradeMatchResult[]): number {
    if (results.length === 0) return 0
    return results.reduce((sum, r) => sum + r.matchScore, 0) / results.length
  }

  private calculateQualityDistribution(trades: EnhancedTrade[]): { [range: string]: number } {
    const distribution: { [range: string]: number } = {
      'Excellent (90-100)': 0,
      'Good (70-89)': 0,
      'Fair (50-69)': 0,
      'Poor (0-49)': 0
    }

    trades.forEach(trade => {
      const score = trade.executionStats.qualityScore
      if (score >= 90) distribution['Excellent (90-100)']++
      else if (score >= 70) distribution['Good (70-89)']++
      else if (score >= 50) distribution['Fair (50-69)']++
      else distribution['Poor (0-49)']++
    })

    return distribution
  }
}

// Export utility functions
export function parseCSVToExecutions(csvText: string): DOSExecution[] {
  // Implementation would parse DOS CSV format
  // This is a placeholder - actual implementation would handle CSV parsing
  return []
}

export function validateExecutionData(execution: DOSExecution): ValidationError[] {
  const errors: ValidationError[] = []

  if (!execution.symbol) {
    errors.push({
      field: 'symbol',
      message: 'Symbol is required',
      severity: 'error'
    })
  }

  if (!execution.timestamp) {
    errors.push({
      field: 'timestamp',
      message: 'Timestamp is required',
      severity: 'error'
    })
  }

  if (execution.quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: 'Quantity must be positive',
      severity: 'error'
    })
  }

  if (execution.price <= 0) {
    errors.push({
      field: 'price',
      message: 'Price must be positive',
      severity: 'error'
    })
  }

  return errors
}

// Export the default engine instance
export const tradeMatchingEngine = new TradeMatchingEngine()