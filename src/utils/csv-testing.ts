import { TraderVueTrade, TraderraTrade, parseCSV, convertTraderVueToTraderra, ValidationResult, validateTraderVueCSV } from './csv-parser'
import { createDataDiagnostic, DiagnosticReport } from './data-diagnostics'
import { calculateTradeStatistics } from './trade-statistics'

export interface ComprehensiveTestResult {
  success: boolean
  validation: ValidationResult
  diagnostic: DiagnosticReport | null
  performance: {
    parseTime: number
    convertTime: number
    totalTime: number
    memoryUsed: number
  }
  summary: {
    totalTradesProcessed: number
    successfulConversions: number
    conversionRate: number
    totalPnLOriginal: number
    totalPnLConverted: number
    pnlAccuracy: number
    totalCommissionsOriginal: number
    totalCommissionsConverted: number
    commissionAccuracy: number
  }
  errors: string[]
  warnings: string[]
  recommendations: string[]
}

/**
 * Comprehensive test for TradervUE CSV processing
 * Designed to handle large files (like 1,787 row files) with performance monitoring
 */
export async function testTradervUECSVProcessing(csvText: string): Promise<ComprehensiveTestResult> {
  const startTime = Date.now()
  const startMemory = getMemoryUsage()

  const errors: string[] = []
  const warnings: string[] = []
  const recommendations: string[] = []

  try {
    // Phase 1: Validation
    console.log('🔍 Phase 1: Validating CSV format...')
    const validation = validateTraderVueCSV(csvText)

    if (!validation.valid) {
      return {
        success: false,
        validation,
        diagnostic: null,
        performance: {
          parseTime: 0,
          convertTime: 0,
          totalTime: Date.now() - startTime,
          memoryUsed: getMemoryUsage() - startMemory
        },
        summary: {
          totalTradesProcessed: 0,
          successfulConversions: 0,
          conversionRate: 0,
          totalPnLOriginal: 0,
          totalPnLConverted: 0,
          pnlAccuracy: 0,
          totalCommissionsOriginal: 0,
          totalCommissionsConverted: 0,
          commissionAccuracy: 0
        },
        errors: [validation.error || 'Validation failed'],
        warnings,
        recommendations
      }
    }

    if (validation.warnings) {
      warnings.push(...validation.warnings)
    }

    // Phase 2: Parsing
    console.log('📊 Phase 2: Parsing TradervUE data...')
    const parseStartTime = Date.now()
    const traderVueTrades = parseCSV(csvText)
    const parseTime = Date.now() - parseStartTime

    if (traderVueTrades.length === 0) {
      errors.push('No trades were successfully parsed')
      return createFailureResult(startTime, errors, warnings, recommendations)
    }

    console.log(`✅ Parsed ${traderVueTrades.length} trades in ${parseTime}ms`)

    // Phase 3: Conversion
    console.log('🔄 Phase 3: Converting to Traderra format...')
    const convertStartTime = Date.now()
    const traderraTrades = convertTraderVueToTraderra(traderVueTrades)
    const convertTime = Date.now() - convertStartTime

    console.log(`✅ Converted ${traderraTrades.length} trades in ${convertTime}ms`)

    // Phase 4: Diagnostic Analysis
    console.log('🔬 Phase 4: Running diagnostic analysis...')
    const diagnostic = createDataDiagnostic(traderVueTrades, traderraTrades)

    // Phase 5: Calculate Statistics and Accuracy
    console.log('📈 Phase 5: Calculating accuracy metrics...')
    const totalPnLOriginal = calculateTotal(traderVueTrades, 'Net P&L')
    const totalPnLConverted = traderraTrades.reduce((sum, trade) => sum + trade.pnl, 0)
    const pnlAccuracy = totalPnLOriginal !== 0 ? (1 - Math.abs(totalPnLOriginal - totalPnLConverted) / Math.abs(totalPnLOriginal)) * 100 : 100

    const totalCommissionsOriginal = calculateCommissions(traderVueTrades)
    const totalCommissionsConverted = traderraTrades.reduce((sum, trade) => sum + trade.commission, 0)
    const commissionAccuracy = totalCommissionsOriginal !== 0 ? (1 - Math.abs(totalCommissionsOriginal - totalCommissionsConverted) / Math.abs(totalCommissionsOriginal)) * 100 : 100

    const conversionRate = (traderraTrades.length / traderVueTrades.length) * 100

    // Phase 6: Generate Recommendations
    console.log('💡 Phase 6: Generating recommendations...')

    if (conversionRate < 100) {
      recommendations.push(`Conversion rate is ${conversionRate.toFixed(1)}% - ${traderVueTrades.length - traderraTrades.length} trades were lost during conversion`)
    }

    if (pnlAccuracy < 99.9) {
      recommendations.push(`P&L accuracy is ${pnlAccuracy.toFixed(2)}% - investigate discrepancy of $${Math.abs(totalPnLOriginal - totalPnLConverted).toFixed(2)}`)
    }

    if (commissionAccuracy < 99.9) {
      recommendations.push(`Commission accuracy is ${commissionAccuracy.toFixed(2)}% - investigate discrepancy of $${Math.abs(totalCommissionsOriginal - totalCommissionsConverted).toFixed(2)}`)
    }

    if (validation.statistics?.optionsTrades && validation.statistics.optionsTrades > 0) {
      recommendations.push(`Found ${validation.statistics.optionsTrades} options trades - verify all options symbols are correctly handled`)
    }

    if (validation.statistics?.infiniteValues && validation.statistics.infiniteValues > 0) {
      recommendations.push(`Found ${validation.statistics.infiniteValues} infinite values - these were converted to 0, verify this is acceptable`)
    }

    const totalTime = Date.now() - startTime
    const memoryUsed = getMemoryUsage() - startMemory

    console.log(`🎉 Test completed in ${totalTime}ms using ${memoryUsed}MB additional memory`)

    return {
      success: true,
      validation,
      diagnostic,
      performance: {
        parseTime,
        convertTime,
        totalTime,
        memoryUsed
      },
      summary: {
        totalTradesProcessed: traderVueTrades.length,
        successfulConversions: traderraTrades.length,
        conversionRate,
        totalPnLOriginal,
        totalPnLConverted,
        pnlAccuracy,
        totalCommissionsOriginal,
        totalCommissionsConverted,
        commissionAccuracy
      },
      errors,
      warnings,
      recommendations: [...recommendations, ...diagnostic.recommendations]
    }

  } catch (error) {
    errors.push(`Unexpected error during testing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return createFailureResult(startTime, errors, warnings, recommendations)
  }
}

/**
 * Quick validation for real-time feedback during file upload
 */
export function quickValidateCSV(csvText: string): { valid: boolean; message: string; details?: any } {
  try {
    if (!csvText || csvText.trim().length === 0) {
      return { valid: false, message: 'CSV file is empty' }
    }

    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return { valid: false, message: 'CSV file must have at least a header and one data row' }
    }

    // Quick header check
    const headerLine = lines[0].charCodeAt(0) === 0xFEFF ? lines[0].slice(1) : lines[0]
    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''))

    const requiredHeaders = ['Symbol', 'Net P&L', 'Open Datetime', 'Close Datetime']
    const missingHeaders = requiredHeaders.filter(required =>
      !headers.some(header => header.includes(required))
    )

    if (missingHeaders.length > 0) {
      return {
        valid: false,
        message: `Missing required columns: ${missingHeaders.join(', ')}`,
        details: { found: headers.slice(0, 10), missing: missingHeaders }
      }
    }

    return {
      valid: true,
      message: `Valid TradervUE format detected (${lines.length - 1} trades)`,
      details: { tradeCount: lines.length - 1, columns: headers.length }
    }

  } catch (error) {
    return {
      valid: false,
      message: `Error validating CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Helper functions

function createFailureResult(
  startTime: number,
  errors: string[],
  warnings: string[],
  recommendations: string[]
): ComprehensiveTestResult {
  return {
    success: false,
    validation: { valid: false, error: errors[0] },
    diagnostic: null,
    performance: {
      parseTime: 0,
      convertTime: 0,
      totalTime: Date.now() - startTime,
      memoryUsed: 0
    },
    summary: {
      totalTradesProcessed: 0,
      successfulConversions: 0,
      conversionRate: 0,
      totalPnLOriginal: 0,
      totalPnLConverted: 0,
      pnlAccuracy: 0,
      totalCommissionsOriginal: 0,
      totalCommissionsConverted: 0,
      commissionAccuracy: 0
    },
    errors,
    warnings,
    recommendations
  }
}

function calculateTotal(trades: TraderVueTrade[], field: keyof TraderVueTrade): number {
  return trades.reduce((sum, trade) => {
    const value = trade[field] as string
    const parsed = parseFloat(value?.replace(/[$,%]/g, '') || '0')
    return sum + (isFinite(parsed) ? parsed : 0)
  }, 0)
}

function calculateCommissions(trades: TraderVueTrade[]): number {
  return trades.reduce((sum, trade) => {
    const commission = parseFloat(trade['Commissions']?.replace(/[$,%]/g, '') || '0')
    const fees = parseFloat(trade['Fees']?.replace(/[$,%]/g, '') || '0')
    return sum + (isFinite(commission) ? commission : 0) + (isFinite(fees) ? fees : 0)
  }, 0)
}

function getMemoryUsage(): number {
  // In browser environment, we can't get exact memory usage
  // Return approximate based on performance.memory if available
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window.performance as any)) {
    return Math.round((window.performance as any).memory.usedJSHeapSize / 1024 / 1024)
  }
  return 0
}

/**
 * Export utilities for testing and debugging
 */
export const testingUtils = {
  quickValidateCSV,
  testTradervUECSVProcessing,
  getMemoryUsage,
  calculateTotal,
  calculateCommissions
}