/**
 * Data Enhancement Pipeline
 *
 * This module provides a comprehensive pipeline for processing and enhancing
 * trade data by combining Tradervue and DOS execution data with quality
 * validation and error handling.
 */

import {
  TraderVueTrade,
  DOSExecution,
  DOSTraderCSV,
  EnhancedTrade,
  TradeEnhancementResult,
  ExecutionQualityAnalysis,
  ValidationError,
  TradeValidationResult
} from '../types/enhanced-trade'
import { TradeMatchingEngine } from './trade-matcher'
import { parseCSV, convertTraderVueToTraderra } from './csv-parser'

interface PipelineConfig {
  validateInputData: boolean
  enableQualityAnalysis: boolean
  preserveOriginalData: boolean
  batchSize: number
  timeoutMs: number
  retryAttempts: number
}

interface PipelineResult {
  success: boolean
  enhancementResult?: TradeEnhancementResult
  errors: ValidationError[]
  warnings: string[]
  processingMetrics: {
    totalTime: number
    dataValidationTime: number
    matchingTime: number
    enhancementTime: number
    qualityAnalysisTime: number
  }
}

const DEFAULT_CONFIG: PipelineConfig = {
  validateInputData: true,
  enableQualityAnalysis: true,
  preserveOriginalData: true,
  batchSize: 100,
  timeoutMs: 300000, // 5 minutes
  retryAttempts: 3
}

/**
 * Main data enhancement pipeline class
 */
export class DataEnhancementPipeline {
  private config: PipelineConfig
  private matchingEngine: TradeMatchingEngine

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.matchingEngine = new TradeMatchingEngine()
  }

  /**
   * Process complete dataset enhancement
   */
  public async enhanceTradeData(
    tradervueCSV: string,
    dosCSV: string
  ): Promise<PipelineResult> {
    const startTime = Date.now()
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let processingMetrics = {
      totalTime: 0,
      dataValidationTime: 0,
      matchingTime: 0,
      enhancementTime: 0,
      qualityAnalysisTime: 0
    }

    try {
      // Step 1: Parse and validate input data
      console.log('🔍 Starting data validation phase...')
      const validationStart = Date.now()

      const tradervueTrades = this.parseTradervueCSV(tradervueCSV)
      const dosExecutions = this.parseDOSCSV(dosCSV)

      if (this.config.validateInputData) {
        const validationResults = await this.validateInputData(tradervueTrades, dosExecutions)
        errors.push(...validationResults.errors)
        warnings.push(...validationResults.warnings)

        if (validationResults.criticalErrors > 0) {
          return {
            success: false,
            errors,
            warnings: [...warnings, `${validationResults.criticalErrors} critical validation errors found`],
            processingMetrics
          }
        }
      }

      processingMetrics.dataValidationTime = Date.now() - validationStart

      // Step 2: Execute trade matching
      console.log('🎯 Starting trade matching phase...')
      const matchingStart = Date.now()

      const enhancementResult = await this.matchingEngine.processTradesBatch(
        tradervueTrades,
        dosExecutions
      )

      processingMetrics.matchingTime = Date.now() - matchingStart

      // Step 3: Enhance trades with additional data
      console.log('⚡ Starting data enhancement phase...')
      const enhancementStart = Date.now()

      const enhancedTrades = await this.enhanceTradeDetails(enhancementResult.enhancedTrades)
      enhancementResult.enhancedTrades = enhancedTrades

      processingMetrics.enhancementTime = Date.now() - enhancementStart

      // Step 4: Quality analysis (optional)
      if (this.config.enableQualityAnalysis) {
        console.log('📊 Starting quality analysis phase...')
        const qualityStart = Date.now()

        await this.performQualityAnalysis(enhancedTrades)
        processingMetrics.qualityAnalysisTime = Date.now() - qualityStart
      }

      processingMetrics.totalTime = Date.now() - startTime

      console.log('✅ Data enhancement pipeline completed successfully')
      console.log(`📈 Processed ${enhancementResult.processed} trades, matched ${enhancementResult.matched}`)

      return {
        success: true,
        enhancementResult,
        errors,
        warnings,
        processingMetrics
      }

    } catch (error) {
      console.error('❌ Pipeline error:', error)
      processingMetrics.totalTime = Date.now() - startTime

      return {
        success: false,
        errors: [{
          field: 'pipeline',
          message: `Pipeline execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error'
        }],
        warnings,
        processingMetrics
      }
    }
  }

  /**
   * Parse Tradervue CSV data
   */
  private parseTradervueCSV(csvText: string): TraderVueTrade[] {
    try {
      return parseCSV(csvText)
    } catch (error) {
      throw new Error(`Failed to parse Tradervue CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse DOS Trader CSV data
   */
  private parseDOSCSV(csvText: string): DOSExecution[] {
    try {
      const lines = csvText.trim().split('\n')
      if (lines.length === 0) return []

      // Clean headers
      let headerLine = lines[0]
      if (headerLine.charCodeAt(0) === 0xFEFF) {
        headerLine = headerLine.slice(1) // Remove BOM
      }

      const headers = this.parseCSVLine(headerLine).map(h => h.trim())
      const executions: DOSExecution[] = []

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i])

          if (values.length > 0) {
            const row: any = {}
            headers.forEach((header, index) => {
              row[header] = index < values.length ? values[index].trim() : ''
            })

            // Convert to DOSExecution format
            const execution = this.convertDOSRowToExecution(row)
            if (execution) {
              executions.push(execution)
            }
          }
        } catch (error) {
          console.warn(`Error parsing DOS CSV row ${i + 1}:`, error)
        }
      }

      return executions
    } catch (error) {
      throw new Error(`Failed to parse DOS CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse a single CSV line handling quotes and commas
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"'
          i += 2
          continue
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
      i++
    }

    result.push(current.trim())
    return result
  }

  /**
   * Convert DOS CSV row to DOSExecution object
   */
  private convertDOSRowToExecution(row: any): DOSExecution | null {
    try {
      // Expected DOS CSV format
      const date = row['Date'] || row['date'] || ''
      const time = row['Time'] || row['time'] || ''
      const symbol = row['Symbol'] || row['symbol'] || ''
      const side = row['Side'] || row['side'] || ''
      const quantity = row['Quantity'] || row['quantity'] || '0'
      const price = row['Price'] || row['price'] || '0'
      const venue = row['Venue'] || row['venue'] || 'Unknown'
      const commission = row['Commission'] || row['commission'] || '0'
      const fees = row['Fees'] || row['fees'] || '0'
      const orderId = row['Order ID'] || row['order_id'] || ''
      const executionId = row['Execution ID'] || row['execution_id'] || `exec_${Date.now()}_${Math.random()}`
      const liquidity = row['Liquidity'] || row['liquidity'] || ''

      if (!symbol || !side || !quantity || !price) {
        console.warn('Missing required fields in DOS execution:', row)
        return null
      }

      // Combine date and time for timestamp
      const timestampStr = date && time ? `${date} ${time}` : date || new Date().toISOString()
      const timestamp = new Date(timestampStr).toISOString()

      return {
        id: `dos_${executionId}`,
        timestamp,
        symbol: symbol.trim().toUpperCase(),
        side: side.trim(),
        quantity: parseFloat(quantity) || 0,
        price: parseFloat(price) || 0,
        venue: venue.trim(),
        commission: parseFloat(commission) || 0,
        fees: parseFloat(fees) || 0,
        orderId: orderId || undefined,
        executionId,
        liquidity: liquidity === 'Added' || liquidity === 'Removed' ? liquidity as 'Added' | 'Removed' : undefined
      }
    } catch (error) {
      console.error('Error converting DOS row to execution:', error, row)
      return null
    }
  }

  /**
   * Validate input data quality
   */
  private async validateInputData(
    tradervueTrades: TraderVueTrade[],
    dosExecutions: DOSExecution[]
  ): Promise<{
    errors: ValidationError[]
    warnings: string[]
    criticalErrors: number
  }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let criticalErrors = 0

    // Validate Tradervue data
    if (tradervueTrades.length === 0) {
      errors.push({
        field: 'tradervue_data',
        message: 'No valid Tradervue trades found',
        severity: 'error'
      })
      criticalErrors++
    }

    // Validate DOS execution data
    if (dosExecutions.length === 0) {
      warnings.push('No DOS execution data found - trades will not have detailed execution information')
    }

    // Check for common data quality issues
    const symbolMismatchCount = this.checkSymbolConsistency(tradervueTrades, dosExecutions)
    if (symbolMismatchCount > 0) {
      warnings.push(`${symbolMismatchCount} symbol mismatches detected between Tradervue and DOS data`)
    }

    // Validate date ranges
    const dateRangeIssues = this.validateDateRanges(tradervueTrades, dosExecutions)
    if (dateRangeIssues.length > 0) {
      warnings.push(...dateRangeIssues)
    }

    // Check for duplicate executions
    const duplicateCount = this.checkForDuplicateExecutions(dosExecutions)
    if (duplicateCount > 0) {
      warnings.push(`${duplicateCount} potential duplicate executions found`)
    }

    return { errors, warnings, criticalErrors }
  }

  /**
   * Enhance trades with additional calculated data
   */
  private async enhanceTradeDetails(trades: EnhancedTrade[]): Promise<EnhancedTrade[]> {
    const enhanced: EnhancedTrade[] = []

    for (const trade of trades) {
      const enhancedTrade = { ...trade }

      // Calculate enhanced execution statistics
      enhancedTrade.executionStats = this.calculateAdvancedExecutionStats(trade)

      // Add execution quality analysis
      if (this.config.enableQualityAnalysis) {
        const qualityAnalysis = this.analyzeExecutionQuality(trade)
        enhancedTrade.executionStats.qualityScore = qualityAnalysis.overallScore
      }

      // Calculate duration with proper handling
      enhancedTrade.duration = this.calculateTradeDuration(trade)

      // Add chart display optimizations
      enhancedTrade.executions.entries = this.optimizeExecutionsForChart(trade.executions.entries)
      enhancedTrade.executions.exits = this.optimizeExecutionsForChart(trade.executions.exits)

      enhanced.push(enhancedTrade)
    }

    return enhanced
  }

  /**
   * Calculate advanced execution statistics
   */
  private calculateAdvancedExecutionStats(trade: EnhancedTrade) {
    const allExecutions = [...trade.executions.entries, ...trade.executions.exits]

    if (allExecutions.length === 0) {
      return trade.executionStats // Return existing stats if no executions
    }

    // Enhanced VWAP calculations
    const entryVWAP = this.calculateVWAP(trade.executions.entries)
    const exitVWAP = this.calculateVWAP(trade.executions.exits)

    // Calculate slippage (would need market data for proper calculation)
    const averageSlippage = this.estimateSlippage(allExecutions)

    // Enhanced venue distribution
    const venueDistribution = this.calculateVenueDistribution(allExecutions)

    // Calculate execution efficiency score
    const qualityScore = this.calculateExecutionQualityScore(trade)

    return {
      ...trade.executionStats,
      vwapEntry: entryVWAP,
      vwapExit: exitVWAP,
      averageSlippage,
      venueDistribution,
      qualityScore
    }
  }

  /**
   * Perform quality analysis on enhanced trades
   */
  private async performQualityAnalysis(trades: EnhancedTrade[]): Promise<void> {
    for (const trade of trades) {
      const analysis = this.analyzeExecutionQuality(trade)

      // Store analysis results in the trade object (could extend interface)
      console.log(`Quality analysis for ${trade.symbol}: Score ${analysis.overallScore}/100`)

      if (analysis.recommendations.length > 0) {
        console.log('Recommendations:', analysis.recommendations)
      }
    }
  }

  /**
   * Analyze execution quality for a single trade
   */
  private analyzeExecutionQuality(trade: EnhancedTrade): ExecutionQualityAnalysis {
    const allExecutions = [...trade.executions.entries, ...trade.executions.exits]

    // Calculate component scores
    const slippageScore = this.calculateSlippageScore(allExecutions)
    const timingScore = this.calculateTimingScore(allExecutions, trade)
    const costScore = this.calculateCostScore(allExecutions, trade)
    const venueScore = this.calculateVenueScore(allExecutions)

    // Weight the scores
    const overallScore = Math.round(
      slippageScore * 0.3 +
      timingScore * 0.25 +
      costScore * 0.25 +
      venueScore * 0.2
    )

    const recommendations: string[] = []

    if (slippageScore < 70) {
      recommendations.push('Consider using limit orders to reduce slippage')
    }

    if (timingScore < 70) {
      recommendations.push('Review execution timing relative to market conditions')
    }

    if (costScore < 70) {
      recommendations.push('Evaluate commission structure and execution venues')
    }

    return {
      tradeId: trade.id,
      overallScore,
      metrics: {
        slippageScore,
        timingScore,
        costScore,
        venueScore
      },
      recommendations,
      benchmarkComparisons: {
        vsMarket: 0, // Would need market data
        vsHistorical: 0 // Would need historical user data
      }
    }
  }

  /**
   * Helper methods for calculations
   */
  private calculateVWAP(executions: any[]): number {
    if (executions.length === 0) return 0

    const totalVolume = executions.reduce((sum, exec) => sum + exec.quantity, 0)
    const weightedPrice = executions.reduce((sum, exec) => sum + (exec.price * exec.quantity), 0)

    return totalVolume > 0 ? weightedPrice / totalVolume : 0
  }

  private estimateSlippage(executions: any[]): number {
    // Simplified slippage calculation - would need market data for accuracy
    return 0.02 // 2 basis points placeholder
  }

  private calculateVenueDistribution(executions: any[]): { [venue: string]: number } {
    const distribution: { [venue: string]: number } = {}

    executions.forEach(exec => {
      distribution[exec.venue] = (distribution[exec.venue] || 0) + 1
    })

    return distribution
  }

  private calculateExecutionQualityScore(trade: EnhancedTrade): number {
    // Simplified quality score - would use more sophisticated metrics in production
    const baseScore = 85
    const executionCount = trade.executions.entries.length + trade.executions.exits.length
    const executionBonus = Math.min(10, executionCount * 2) // Bonus for more detailed executions

    return Math.min(100, baseScore + executionBonus)
  }

  private calculateTradeDuration(trade: EnhancedTrade): string {
    try {
      const entryTime = new Date(trade.entryTime)
      const exitTime = new Date(trade.exitTime)
      const durationMs = exitTime.getTime() - entryTime.getTime()

      if (durationMs <= 0) return '00:00:00'

      const hours = Math.floor(durationMs / (1000 * 60 * 60))
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } catch (error) {
      console.warn('Error calculating trade duration:', error)
      return '00:00:00'
    }
  }

  private optimizeExecutionsForChart(executions: any[]): any[] {
    return executions.map((exec, index) => ({
      ...exec,
      arrowSize: executions.length > 5 ? 'small' : executions.length > 2 ? 'medium' : 'large',
      label: `${exec.side} ${exec.quantity}@${exec.price.toFixed(2)}`
    }))
  }

  private checkSymbolConsistency(tradervueTrades: TraderVueTrade[], dosExecutions: DOSExecution[]): number {
    const tradervueSymbols = new Set(tradervueTrades.map(t => t['Symbol']?.toUpperCase()))
    const dosSymbols = new Set(dosExecutions.map(e => e.symbol.toUpperCase()))

    let mismatches = 0
    for (const symbol of tradervueSymbols) {
      if (!dosSymbols.has(symbol)) {
        mismatches++
      }
    }

    return mismatches
  }

  private validateDateRanges(tradervueTrades: TraderVueTrade[], dosExecutions: DOSExecution[]): string[] {
    const warnings: string[] = []

    if (tradervueTrades.length === 0 || dosExecutions.length === 0) {
      return warnings
    }

    // Find date ranges
    const tradervueDates = tradervueTrades
      .map(t => new Date(t['Open Datetime']))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    const dosDates = dosExecutions
      .map(e => new Date(e.timestamp))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (tradervueDates.length > 0 && dosDates.length > 0) {
      const tradervueRange = {
        start: tradervueDates[0],
        end: tradervueDates[tradervueDates.length - 1]
      }

      const dosRange = {
        start: dosDates[0],
        end: dosDates[dosDates.length - 1]
      }

      // Check for significant date range gaps
      if (dosRange.end < tradervueRange.start || dosRange.start > tradervueRange.end) {
        warnings.push('No date overlap between Tradervue and DOS data')
      }
    }

    return warnings
  }

  private checkForDuplicateExecutions(executions: DOSExecution[]): number {
    const seen = new Set<string>()
    let duplicates = 0

    for (const exec of executions) {
      const key = `${exec.symbol}_${exec.timestamp}_${exec.quantity}_${exec.price}`
      if (seen.has(key)) {
        duplicates++
      } else {
        seen.add(key)
      }
    }

    return duplicates
  }

  private calculateSlippageScore(executions: any[]): number {
    // Placeholder - would calculate based on market data
    return 85
  }

  private calculateTimingScore(executions: any[], trade: EnhancedTrade): number {
    // Placeholder - would analyze execution timing
    return 80
  }

  private calculateCostScore(executions: any[], trade: EnhancedTrade): number {
    // Calculate based on total costs vs trade value
    const totalCosts = executions.reduce((sum, exec) => sum + exec.commission + exec.fees, 0)
    const tradeValue = Math.abs(trade.pnl)

    if (tradeValue === 0) return 50

    const costRatio = totalCosts / tradeValue
    return Math.max(0, Math.min(100, 100 - (costRatio * 100 * 10))) // 10x multiplier for visibility
  }

  private calculateVenueScore(executions: any[]): number {
    // Score based on venue diversification
    const venues = new Set(executions.map(exec => exec.venue))
    const diversityScore = Math.min(100, venues.size * 25) // Max score at 4+ venues

    return diversityScore
  }
}

// Export default pipeline instance
export const dataEnhancementPipeline = new DataEnhancementPipeline()

// Export utility functions
export function createEnhancementPipeline(config?: Partial<PipelineConfig>): DataEnhancementPipeline {
  return new DataEnhancementPipeline(config)
}

export function validateEnhancedTrade(trade: EnhancedTrade): TradeValidationResult {
  const errors: ValidationError[] = []

  // Basic validation
  if (!trade.symbol) {
    errors.push({
      field: 'symbol',
      message: 'Symbol is required',
      severity: 'error'
    })
  }

  if (trade.quantity <= 0) {
    errors.push({
      field: 'quantity',
      message: 'Quantity must be positive',
      severity: 'error'
    })
  }

  if (!trade.entryTime || !trade.exitTime) {
    errors.push({
      field: 'timing',
      message: 'Entry and exit times are required',
      severity: 'error'
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
    trade: errors.length === 0 ? trade : undefined
  }
}