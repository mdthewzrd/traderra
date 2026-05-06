/**
 * Validation and Audit Tools
 *
 * Comprehensive validation and auditing system for DOS Trader-Tradervue
 * integration, ensuring data quality and providing detailed audit trails.
 */

import {
  TraderVueTrade,
  DOSExecution,
  EnhancedTrade,
  ValidationError,
  TradeValidationResult,
  TradeEnhancementResult
} from '../types/enhanced-trade'

interface AuditResult {
  id: string
  timestamp: string
  auditType: 'validation' | 'quality' | 'discrepancy' | 'performance'
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  details: any
  affectedRecords: string[]
  suggestedActions: string[]
}

interface ComplianceCheck {
  name: string
  description: string
  category: 'regulatory' | 'data_quality' | 'business_rules'
  validator: (trade: EnhancedTrade) => ValidationError[]
}

interface AuditReport {
  reportId: string
  generatedAt: string
  scope: 'full' | 'incremental' | 'targeted'
  summary: {
    totalRecords: number
    validRecords: number
    warningRecords: number
    errorRecords: number
    criticalRecords: number
  }
  auditResults: AuditResult[]
  complianceResults: { [checkName: string]: ComplianceResult }
  recommendations: string[]
  dataIntegrityScore: number // 0-100
}

interface ComplianceResult {
  checkName: string
  passed: boolean
  affectedCount: number
  details: ValidationError[]
}

interface DiscrepancyAnalysis {
  tradeId: string
  discrepancyType: 'volume' | 'price' | 'timing' | 'venue' | 'commission'
  severity: 'minor' | 'moderate' | 'major' | 'critical'
  tradervueValue: any
  dosValue: any
  difference: number | string
  impactAssessment: string
  resolutionStrategy: string
}

/**
 * Main validation and audit engine
 */
export class ValidationAuditEngine {
  private complianceChecks: ComplianceCheck[] = []
  private auditHistory: AuditResult[] = []
  private validationRules: ValidationRule[] = []

  constructor() {
    this.initializeComplianceChecks()
    this.initializeValidationRules()
  }

  /**
   * Run comprehensive audit on enhanced trade data
   */
  public async runFullAudit(
    enhancementResult: TradeEnhancementResult,
    includeDiscrepancyAnalysis: boolean = true
  ): Promise<AuditReport> {
    const reportId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const generatedAt = new Date().toISOString()

    console.log(`🔍 Starting comprehensive audit (ID: ${reportId})`)

    const auditResults: AuditResult[] = []
    const complianceResults: { [checkName: string]: ComplianceResult } = {}

    // 1. Data Quality Validation
    console.log('📊 Running data quality validation...')
    const qualityResults = await this.validateDataQuality(enhancementResult.enhancedTrades)
    auditResults.push(...qualityResults)

    // 2. Compliance Checks
    console.log('⚖️ Running compliance checks...')
    const complianceAuditResults = await this.runComplianceChecks(enhancementResult.enhancedTrades)
    auditResults.push(...complianceAuditResults.auditResults)
    Object.assign(complianceResults, complianceAuditResults.complianceResults)

    // 3. Discrepancy Analysis
    if (includeDiscrepancyAnalysis) {
      console.log('🔍 Running discrepancy analysis...')
      const discrepancyResults = await this.analyzeDiscrepancies(enhancementResult.enhancedTrades)
      auditResults.push(...discrepancyResults)
    }

    // 4. Performance Analysis
    console.log('⚡ Running performance analysis...')
    const performanceResults = await this.analyzePerformance(enhancementResult)
    auditResults.push(...performanceResults)

    // Calculate summary statistics
    const summary = this.calculateAuditSummary(enhancementResult.enhancedTrades, auditResults)

    // Generate recommendations
    const recommendations = this.generateRecommendations(auditResults, complianceResults)

    // Calculate data integrity score
    const dataIntegrityScore = this.calculateDataIntegrityScore(summary, auditResults)

    console.log(`✅ Audit completed - Integrity Score: ${dataIntegrityScore}/100`)

    return {
      reportId,
      generatedAt,
      scope: 'full',
      summary,
      auditResults,
      complianceResults,
      recommendations,
      dataIntegrityScore
    }
  }

  /**
   * Validate individual enhanced trade
   */
  public validateEnhancedTrade(trade: EnhancedTrade): TradeValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // Run all validation rules
    for (const rule of this.validationRules) {
      try {
        const ruleResults = rule.validator(trade)
        errors.push(...ruleResults.filter(r => r.severity === 'error'))
        warnings.push(...ruleResults.filter(r => r.severity === 'warning'))
      } catch (error) {
        console.error(`Validation rule '${rule.name}' failed:`, error)
        errors.push({
          field: 'validation_engine',
          message: `Validation rule '${rule.name}' encountered an error`,
          severity: 'error'
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      trade: errors.length === 0 ? trade : undefined
    }
  }

  /**
   * Analyze discrepancies between Tradervue and DOS data
   */
  public async analyzeTradeDiscrepancies(trade: EnhancedTrade): Promise<DiscrepancyAnalysis[]> {
    const discrepancies: DiscrepancyAnalysis[] = []

    if (!trade.sourceData.tradervue || !trade.sourceData.dosRaw) {
      return discrepancies
    }

    const tradervueTrade = trade.sourceData.tradervue
    const dosExecutions = trade.sourceData.dosRaw

    // Volume discrepancy
    const tradervueVolume = parseInt(tradervueTrade['Volume']) || 0
    const dosVolume = dosExecutions.reduce((sum, exec) => sum + exec.quantity, 0)
    const volumeDiff = Math.abs(tradervueVolume - dosVolume)

    if (volumeDiff > 0) {
      discrepancies.push({
        tradeId: trade.id,
        discrepancyType: 'volume',
        severity: volumeDiff > tradervueVolume * 0.05 ? 'major' : 'minor',
        tradervueValue: tradervueVolume,
        dosValue: dosVolume,
        difference: volumeDiff,
        impactAssessment: `Volume difference of ${volumeDiff} shares (${((volumeDiff / tradervueVolume) * 100).toFixed(2)}%)`,
        resolutionStrategy: volumeDiff > tradervueVolume * 0.1
          ? 'Manual review required - significant volume discrepancy'
          : 'Minor discrepancy - may be due to partial fills or timing differences'
      })
    }

    // Price discrepancy
    const tradervueEntryPrice = parseFloat(tradervueTrade['Entry Price']) || 0
    const dosEntryPrice = this.calculateDOSEntryPrice(dosExecutions, trade.side)
    const priceDiff = Math.abs(tradervueEntryPrice - dosEntryPrice)

    if (priceDiff > tradervueEntryPrice * 0.01) { // 1% threshold
      discrepancies.push({
        tradeId: trade.id,
        discrepancyType: 'price',
        severity: priceDiff > tradervueEntryPrice * 0.05 ? 'critical' : 'moderate',
        tradervueValue: tradervueEntryPrice,
        dosValue: dosEntryPrice,
        difference: priceDiff,
        impactAssessment: `Entry price difference of $${priceDiff.toFixed(4)} (${((priceDiff / tradervueEntryPrice) * 100).toFixed(2)}%)`,
        resolutionStrategy: 'Review execution timing and market conditions'
      })
    }

    // Commission discrepancy
    const tradervueCommission = parseFloat(tradervueTrade['Commissions']) || 0
    const dosCommission = dosExecutions.reduce((sum, exec) => sum + exec.commission + exec.fees, 0)
    const commissionDiff = Math.abs(tradervueCommission - dosCommission)

    if (commissionDiff > 0.01) { // $0.01 threshold
      discrepancies.push({
        tradeId: trade.id,
        discrepancyType: 'commission',
        severity: commissionDiff > 10 ? 'major' : 'minor',
        tradervueValue: tradervueCommission,
        dosValue: dosCommission,
        difference: commissionDiff,
        impactAssessment: `Commission difference of $${commissionDiff.toFixed(2)}`,
        resolutionStrategy: 'Verify commission calculation methodology'
      })
    }

    return discrepancies
  }

  /**
   * Generate data quality report
   */
  public generateDataQualityReport(trades: EnhancedTrade[]): any {
    const report = {
      timestamp: new Date().toISOString(),
      totalTrades: trades.length,
      qualityMetrics: {
        completeness: this.calculateCompleteness(trades),
        accuracy: this.calculateAccuracy(trades),
        consistency: this.calculateConsistency(trades),
        timeliness: this.calculateTimeliness(trades)
      },
      issuesSummary: {
        missingData: 0,
        inconsistentData: 0,
        outliers: 0,
        duplicates: 0
      },
      recommendations: [] as string[]
    }

    // Analyze data issues
    trades.forEach(trade => {
      // Check for missing critical data
      if (!trade.symbol || !trade.entryTime || !trade.exitTime) {
        report.issuesSummary.missingData++
      }

      // Check for inconsistent data
      if (trade.quantity <= 0 || trade.entryPrice <= 0 || trade.exitPrice <= 0) {
        report.issuesSummary.inconsistentData++
      }

      // Check for outliers
      if (Math.abs(trade.pnlPercent) > 100) { // >100% gain/loss
        report.issuesSummary.outliers++
      }
    })

    // Generate recommendations
    if (report.issuesSummary.missingData > 0) {
      report.recommendations.push(`${report.issuesSummary.missingData} trades have missing critical data`)
    }

    if (report.qualityMetrics.completeness < 0.95) {
      report.recommendations.push('Data completeness below 95% threshold')
    }

    if (report.qualityMetrics.accuracy < 0.9) {
      report.recommendations.push('Data accuracy below 90% threshold')
    }

    return report
  }

  /**
   * Private helper methods
   */
  private initializeComplianceChecks() {
    this.complianceChecks = [
      {
        name: 'required_fields',
        description: 'Verify all required fields are present',
        category: 'data_quality',
        validator: (trade: EnhancedTrade) => {
          const errors: ValidationError[] = []

          if (!trade.symbol) {
            errors.push({
              field: 'symbol',
              message: 'Symbol is required',
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

          if (trade.quantity <= 0) {
            errors.push({
              field: 'quantity',
              message: 'Quantity must be positive',
              severity: 'error'
            })
          }

          return errors
        }
      },

      {
        name: 'price_validation',
        description: 'Validate price data consistency',
        category: 'data_quality',
        validator: (trade: EnhancedTrade) => {
          const errors: ValidationError[] = []

          if (trade.entryPrice <= 0 || trade.exitPrice <= 0) {
            errors.push({
              field: 'prices',
              message: 'Entry and exit prices must be positive',
              severity: 'error'
            })
          }

          // Check for unrealistic price movements (>50% in single trade)
          const priceMove = Math.abs(trade.exitPrice - trade.entryPrice) / trade.entryPrice
          if (priceMove > 0.5) {
            errors.push({
              field: 'price_movement',
              message: `Unusual price movement: ${(priceMove * 100).toFixed(1)}%`,
              severity: 'warning',
              suggestedFix: 'Review trade data for accuracy'
            })
          }

          return errors
        }
      },

      {
        name: 'execution_consistency',
        description: 'Validate execution data consistency',
        category: 'business_rules',
        validator: (trade: EnhancedTrade) => {
          const errors: ValidationError[] = []

          const totalEntryQuantity = trade.executions.entries.reduce((sum, exec) => sum + exec.quantity, 0)
          const totalExitQuantity = trade.executions.exits.reduce((sum, exec) => sum + exec.quantity, 0)

          // Allow for small discrepancies (5%)
          const quantityDiff = Math.abs(totalEntryQuantity - totalExitQuantity)
          if (quantityDiff > trade.quantity * 0.05) {
            errors.push({
              field: 'execution_quantities',
              message: `Entry/exit quantity mismatch: ${totalEntryQuantity} vs ${totalExitQuantity}`,
              severity: 'warning'
            })
          }

          // Check for missing executions
          if (trade.executions.entries.length === 0) {
            errors.push({
              field: 'entries',
              message: 'No entry executions found',
              severity: 'error'
            })
          }

          if (trade.executions.exits.length === 0) {
            errors.push({
              field: 'exits',
              message: 'No exit executions found',
              severity: 'warning'
            })
          }

          return errors
        }
      },

      {
        name: 'timing_validation',
        description: 'Validate trade timing logic',
        category: 'business_rules',
        validator: (trade: EnhancedTrade) => {
          const errors: ValidationError[] = []

          const entryTime = new Date(trade.entryTime)
          const exitTime = new Date(trade.exitTime)

          if (exitTime <= entryTime) {
            errors.push({
              field: 'timing',
              message: 'Exit time must be after entry time',
              severity: 'error'
            })
          }

          // Check for unreasonably long trades (>30 days)
          const tradeDuration = exitTime.getTime() - entryTime.getTime()
          const daysDuration = tradeDuration / (1000 * 60 * 60 * 24)

          if (daysDuration > 30) {
            errors.push({
              field: 'duration',
              message: `Trade duration exceeds 30 days: ${daysDuration.toFixed(1)} days`,
              severity: 'warning'
            })
          }

          return errors
        }
      }
    ]
  }

  private initializeValidationRules() {
    this.validationRules = [
      {
        name: 'basic_data_integrity',
        description: 'Basic data integrity checks',
        validator: (trade: EnhancedTrade) => {
          const errors: ValidationError[] = []

          // Check for null/undefined critical fields
          const criticalFields = ['id', 'symbol', 'side', 'quantity', 'entryPrice', 'exitPrice']

          for (const field of criticalFields) {
            if (trade[field as keyof EnhancedTrade] == null) {
              errors.push({
                field,
                message: `Critical field '${field}' is null or undefined`,
                severity: 'error'
              })
            }
          }

          return errors
        }
      },

      {
        name: 'financial_validation',
        description: 'Financial data validation',
        validator: (trade: EnhancedTrade) => {
          const errors: ValidationError[] = []

          // Validate P&L calculation
          const expectedPnL = trade.side === 'Long'
            ? (trade.exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - trade.exitPrice) * trade.quantity

          const pnlDiff = Math.abs(trade.pnl - expectedPnL)
          if (pnlDiff > Math.abs(expectedPnL) * 0.1) { // 10% tolerance
            errors.push({
              field: 'pnl',
              message: `P&L calculation discrepancy: Expected ${expectedPnL.toFixed(2)}, got ${trade.pnl.toFixed(2)}`,
              severity: 'warning'
            })
          }

          return errors
        }
      }
    ]
  }

  private async validateDataQuality(trades: EnhancedTrade[]): Promise<AuditResult[]> {
    const results: AuditResult[] = []

    // Overall data quality metrics
    const completenessScore = this.calculateCompleteness(trades)
    const accuracyScore = this.calculateAccuracy(trades)

    if (completenessScore < 0.95) {
      results.push({
        id: `quality_${Date.now()}`,
        timestamp: new Date().toISOString(),
        auditType: 'quality',
        severity: 'warning',
        message: 'Data completeness below threshold',
        details: { score: completenessScore, threshold: 0.95 },
        affectedRecords: [],
        suggestedActions: ['Review data import process', 'Identify missing data sources']
      })
    }

    if (accuracyScore < 0.9) {
      results.push({
        id: `quality_${Date.now() + 1}`,
        timestamp: new Date().toISOString(),
        auditType: 'quality',
        severity: 'error',
        message: 'Data accuracy below threshold',
        details: { score: accuracyScore, threshold: 0.9 },
        affectedRecords: [],
        suggestedActions: ['Review data validation rules', 'Implement stricter quality controls']
      })
    }

    return results
  }

  private async runComplianceChecks(trades: EnhancedTrade[]): Promise<{
    auditResults: AuditResult[]
    complianceResults: { [checkName: string]: ComplianceResult }
  }> {
    const auditResults: AuditResult[] = []
    const complianceResults: { [checkName: string]: ComplianceResult } = {}

    for (const check of this.complianceChecks) {
      const checkResults: ValidationError[] = []
      let affectedCount = 0

      for (const trade of trades) {
        const errors = check.validator(trade)
        if (errors.length > 0) {
          checkResults.push(...errors)
          affectedCount++
        }
      }

      const passed = affectedCount === 0

      complianceResults[check.name] = {
        checkName: check.name,
        passed,
        affectedCount,
        details: checkResults
      }

      if (!passed) {
        auditResults.push({
          id: `compliance_${check.name}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          auditType: 'validation',
          severity: affectedCount > trades.length * 0.1 ? 'error' : 'warning',
          message: `Compliance check '${check.name}' failed`,
          details: { description: check.description, affectedCount, errors: checkResults },
          affectedRecords: [],
          suggestedActions: ['Review affected records', 'Update data quality procedures']
        })
      }
    }

    return { auditResults, complianceResults }
  }

  private async analyzeDiscrepancies(trades: EnhancedTrade[]): Promise<AuditResult[]> {
    const results: AuditResult[] = []

    for (const trade of trades) {
      const discrepancies = await this.analyzeTradeDiscrepancies(trade)

      if (discrepancies.length > 0) {
        results.push({
          id: `discrepancy_${trade.id}`,
          timestamp: new Date().toISOString(),
          auditType: 'discrepancy',
          severity: discrepancies.some(d => d.severity === 'critical') ? 'critical' : 'warning',
          message: `${discrepancies.length} discrepancies found in trade ${trade.symbol}`,
          details: { discrepancies },
          affectedRecords: [trade.id],
          suggestedActions: discrepancies.map(d => d.resolutionStrategy)
        })
      }
    }

    return results
  }

  private async analyzePerformance(result: TradeEnhancementResult): Promise<AuditResult[]> {
    const results: AuditResult[] = []

    // Check processing performance
    if (result.processingStats.duration > 60000) { // 1 minute
      results.push({
        id: `performance_${Date.now()}`,
        timestamp: new Date().toISOString(),
        auditType: 'performance',
        severity: 'warning',
        message: 'Processing time exceeded threshold',
        details: {
          duration: result.processingStats.duration,
          threshold: 60000,
          recordsPerSecond: result.processed / (result.processingStats.duration / 1000)
        },
        affectedRecords: [],
        suggestedActions: ['Optimize processing algorithms', 'Consider batch size reduction']
      })
    }

    // Check match rate
    const matchRate = result.matched / result.processed
    if (matchRate < 0.8) { // 80% threshold
      results.push({
        id: `match_rate_${Date.now()}`,
        timestamp: new Date().toISOString(),
        auditType: 'performance',
        severity: 'error',
        message: 'Trade matching rate below threshold',
        details: {
          matchRate,
          threshold: 0.8,
          matched: result.matched,
          total: result.processed
        },
        affectedRecords: [],
        suggestedActions: [
          'Review matching criteria',
          'Check data quality',
          'Investigate unmatched records'
        ]
      })
    }

    return results
  }

  private calculateCompleteness(trades: EnhancedTrade[]): number {
    if (trades.length === 0) return 1

    const requiredFields = ['symbol', 'entryTime', 'exitTime', 'quantity', 'entryPrice', 'exitPrice']
    let totalFields = trades.length * requiredFields.length
    let completeFields = 0

    trades.forEach(trade => {
      requiredFields.forEach(field => {
        if (trade[field as keyof EnhancedTrade] != null) {
          completeFields++
        }
      })
    })

    return completeFields / totalFields
  }

  private calculateAccuracy(trades: EnhancedTrade[]): number {
    if (trades.length === 0) return 1

    let accurateRecords = 0

    trades.forEach(trade => {
      const validation = this.validateEnhancedTrade(trade)
      if (validation.valid) {
        accurateRecords++
      }
    })

    return accurateRecords / trades.length
  }

  private calculateConsistency(trades: EnhancedTrade[]): number {
    // Simplified consistency calculation
    // In practice, this would check for data consistency across related records
    return 0.95 // Placeholder
  }

  private calculateTimeliness(trades: EnhancedTrade[]): number {
    // Check if data is up-to-date
    // In practice, this would compare import timestamps with trade dates
    return 0.98 // Placeholder
  }

  private calculateDOSEntryPrice(executions: DOSExecution[], side: string): number {
    const entries = executions.filter(exec =>
      (side === 'Long' && exec.side.toLowerCase() === 'buy') ||
      (side === 'Short' && exec.side.toLowerCase() === 'sell')
    )

    if (entries.length === 0) return 0

    const totalVolume = entries.reduce((sum, exec) => sum + exec.quantity, 0)
    const weightedPrice = entries.reduce((sum, exec) => sum + (exec.price * exec.quantity), 0)

    return totalVolume > 0 ? weightedPrice / totalVolume : 0
  }

  private calculateAuditSummary(trades: EnhancedTrade[], auditResults: AuditResult[]) {
    const criticalCount = auditResults.filter(r => r.severity === 'critical').length
    const errorCount = auditResults.filter(r => r.severity === 'error').length
    const warningCount = auditResults.filter(r => r.severity === 'warning').length

    return {
      totalRecords: trades.length,
      validRecords: trades.length - errorCount - criticalCount,
      warningRecords: warningCount,
      errorRecords: errorCount,
      criticalRecords: criticalCount
    }
  }

  private generateRecommendations(
    auditResults: AuditResult[],
    complianceResults: { [checkName: string]: ComplianceResult }
  ): string[] {
    const recommendations: string[] = []

    // High-priority recommendations based on critical issues
    const criticalIssues = auditResults.filter(r => r.severity === 'critical')
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical data integrity issues immediately')
    }

    // Failed compliance checks
    const failedChecks = Object.values(complianceResults).filter(r => !r.passed)
    if (failedChecks.length > 0) {
      recommendations.push('Review and update data validation procedures')
    }

    // Performance recommendations
    const performanceIssues = auditResults.filter(r => r.auditType === 'performance')
    if (performanceIssues.length > 0) {
      recommendations.push('Optimize data processing performance')
    }

    return recommendations
  }

  private calculateDataIntegrityScore(
    summary: any,
    auditResults: AuditResult[]
  ): number {
    let score = 100

    // Deduct for critical issues
    const criticalPenalty = summary.criticalRecords * 20
    const errorPenalty = summary.errorRecords * 10
    const warningPenalty = summary.warningRecords * 5

    score -= (criticalPenalty + errorPenalty + warningPenalty)

    return Math.max(0, Math.min(100, score))
  }
}

interface ValidationRule {
  name: string
  description: string
  validator: (trade: EnhancedTrade) => ValidationError[]
}

// Export default engine instance
export const validationAuditEngine = new ValidationAuditEngine()

// Export utility functions
export function createValidationEngine(): ValidationAuditEngine {
  return new ValidationAuditEngine()
}

export function validateTradeData(trades: EnhancedTrade[]): ValidationError[] {
  const engine = new ValidationAuditEngine()
  const errors: ValidationError[] = []

  trades.forEach(trade => {
    const result = engine.validateEnhancedTrade(trade)
    errors.push(...result.errors)
  })

  return errors
}

export function generateAuditSummary(auditReport: AuditReport): string {
  return `
Audit Report Summary (${auditReport.reportId})
Generated: ${auditReport.generatedAt}

Data Integrity Score: ${auditReport.dataIntegrityScore}/100

Records Summary:
- Total: ${auditReport.summary.totalRecords}
- Valid: ${auditReport.summary.validRecords}
- Warnings: ${auditReport.summary.warningRecords}
- Errors: ${auditReport.summary.errorRecords}
- Critical: ${auditReport.summary.criticalRecords}

Key Recommendations:
${auditReport.recommendations.map(r => `- ${r}`).join('\n')}
  `.trim()
}