/**
 * Risk Management Agent
 *
 * Specialized agent for analyzing risk, position sizing, and money management.
 * Helps traders understand and control their risk exposure.
 *
 * Responsibilities:
 * - Analyze position sizing patterns
 * - Identify risk concentration issues
 * - Calculate portfolio risk metrics
 * - Suggest optimal position sizes
 * - Detect risk management rule violations
 * - Provide risk alerts and warnings
 * - Recommend risk management improvements
 *
 * @module RiskManagementAgent
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult, AgentContext } from '../core/base-agent'

export interface RiskAnalysis {
  overallRiskLevel: 'low' | 'moderate' | 'high' | 'critical'
  positionSizingAnalysis: PositionSizingAnalysis
  portfolioRisk: PortfolioRisk
  riskAlerts: RiskAlert[]
  recommendations: string[]
  riskScore: number // 0-100
}

export interface PositionSizingAnalysis {
  avgPositionSize: number
  positionSizeRange: { min: number; max: number }
  positionSizeConsistency: number // 0-1, higher = more consistent
  oversizedPositions: TradeRisk[]
  riskRewardRatio: number
  positionSizingGrade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface PortfolioRisk {
  maxDrawdown: number
  avgDrawdown: number
  var95: number // Value at Risk at 95% confidence
  riskPerTrade: number
  portfolioHeat: number // Total risk as % of capital
  correlationRisk: string
}

export interface TradeRisk {
  tradeId: string
  positionSize: number
  riskAmount: number
  riskPercent: number
  issue: string
  severity: 'low' | 'medium' | 'high'
}

export interface RiskAlert {
  type: 'position_size' | 'drawdown' | 'concentration' | 'correlation' | 'volatility'
  severity: 'info' | 'warning' | 'critical'
  message: string
  affectedTrades: string[]
  recommendation: string
}

/**
 * Risk Management Agent Class
 *
 * Analyzes and provides guidance on risk management.
 */
export class RiskManagementAgent extends BaseAgent {
  private riskHistory: Map<string, RiskAnalysis[]> = new Map()

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      id: 'risk-management-agent',
      name: 'Risk Management Agent',
      version: '1.0.0',
      description: 'Analyzes risk and provides money management guidance',
      capabilities: {
        canAnalyze: true,
        canExecute: false,
        canLearn: true,
        canRecommend: true,
        requiresContext: ['trades', 'metrics', 'userPreferences']
      },
      maxConcurrentTasks: 5,
      timeoutMs: 15000
    }

    super({ ...defaultConfig, ...config })
  }

  /**
   * Can handle risk analysis tasks
   */
  canHandle(taskType: string): boolean {
    return [
      'analyze_risk',
      'position_sizing_analysis',
      'risk_assessment',
      'portfolio_risk',
      'risk_alerts',
      'money_management'
    ].includes(taskType)
  }

  /**
   * Perform risk analysis task
   */
  protected async performTask(task: AgentTask): Promise<RiskAnalysis> {
    const { intent, entities, context } = task.input

    console.log('[RiskManagementAgent] Analyzing risk:', intent)

    // Get trades from context
    const trades = context.trades || []
    const metrics = context.metrics || {}

    if (trades.length === 0) {
      return {
        overallRiskLevel: 'low',
        positionSizingAnalysis: this.getEmptyPositionSizingAnalysis(),
        portfolioRisk: this.getEmptyPortfolioRisk(),
        riskAlerts: [],
        recommendations: ['Import trades to enable risk analysis'],
        riskScore: 0
      }
    }

    // Analyze position sizing
    const positionSizingAnalysis = this.analyzePositionSizing(trades)

    // Analyze portfolio risk
    const portfolioRisk = this.analyzePortfolioRisk(trades, metrics)

    // Generate risk alerts
    const riskAlerts = this.generateRiskAlerts(trades, positionSizingAnalysis, portfolioRisk)

    // Calculate overall risk level
    const overallRiskLevel = this.calculateOverallRiskLevel(positionSizingAnalysis, portfolioRisk, riskAlerts)

    // Calculate risk score (0-100, higher = more risky)
    const riskScore = this.calculateRiskScore(positionSizingAnalysis, portfolioRisk, riskAlerts)

    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(positionSizingAnalysis, portfolioRisk, riskAlerts)

    const analysis: RiskAnalysis = {
      overallRiskLevel,
      positionSizingAnalysis,
      portfolioRisk,
      riskAlerts,
      recommendations,
      riskScore
    }

    // Store analysis
    this.storeRiskAnalysis(context.userId, analysis)

    return analysis
  }

  /**
   * Analyze position sizing patterns
   */
  private analyzePositionSizing(trades: any[]): PositionSizingAnalysis {
    // Calculate position sizes (assuming PnL magnitude as proxy)
    const positionSizes = trades.map(t => Math.abs(t.PnL || t['Net P&L'] || 0))

    const avgPositionSize = positionSizes.reduce((sum, size) => sum + size, 0) / positionSizes.length
    const minSize = Math.min(...positionSizes)
    const maxSize = Math.max(...positionSizes)

    // Calculate consistency (inverse of coefficient of variation)
    const stdDev = Math.sqrt(positionSizes.map(size => Math.pow(size - avgPositionSize, 2)).reduce((sum, val) => sum + val, 0) / positionSizes.length)
    const positionSizeConsistency = avgPositionSize > 0 ? 1 - (stdDev / avgPositionSize) : 0

    // Find oversized positions (more than 2x average)
    const oversizedPositions: TradeRisk[] = trades
      .filter(t => {
        const size = Math.abs(t.PnL || t['Net P&L'] || 0)
        return size > avgPositionSize * 2
      })
      .map(t => ({
        tradeId: t.id || t.Date || 'unknown',
        positionSize: Math.abs(t.PnL || t['Net P&L'] || 0),
        riskAmount: Math.abs(t.PnL || t['Net P&L'] || 0),
        riskPercent: avgPositionSize > 0 ? (Math.abs(t.PnL || 0) / avgPositionSize) * 100 : 0,
        issue: `Position size ${((Math.abs(t.PnL || 0) / avgPositionSize) * 100).toFixed(0)}% of average`,
        severity: Math.abs(t.PnL || 0) > avgPositionSize * 3 ? 'high' : 'medium'
      }))

    // Calculate risk-reward ratio
    const winningTrades = trades.filter(t => (t.PnL || 0) > 0)
    const losingTrades = trades.filter(t => (t.PnL || 0) < 0)

    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.PnL || 0), 0) / winningTrades.length
      : 0

    const avgLoss = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.PnL || 0), 0)) / losingTrades.length
      : 1

    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0

    // Calculate grade
    const positionSizingGrade = this.calculatePositionSizingGrade(
      positionSizeConsistency,
      oversizedPositions.length,
      riskRewardRatio
    )

    return {
      avgPositionSize,
      positionSizeRange: { min: minSize, max: maxSize },
      positionSizeConsistency: Math.max(0, Math.min(1, positionSizeConsistency)),
      oversizedPositions,
      riskRewardRatio,
      positionSizingGrade
    }
  }

  /**
   * Calculate position sizing grade
   */
  private calculatePositionSizingGrade(
    consistency: number,
    oversizedCount: number,
    riskRewardRatio: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 0

    // Consistency score (0-40 points)
    score += consistency * 40

    // Oversized positions penalty (0-30 points)
    score += Math.max(0, 30 - oversizedCount * 10)

    // Risk-reward ratio score (0-30 points)
    if (riskRewardRatio >= 2) score += 30
    else if (riskRewardRatio >= 1.5) score += 20
    else if (riskRewardRatio >= 1) score += 10
    else if (riskRewardRatio >= 0.5) score += 5

    if (score >= 90) return 'A'
    if (score >= 75) return 'B'
    if (score >= 60) return 'C'
    if (score >= 40) return 'D'
    return 'F'
  }

  /**
   * Analyze portfolio risk
   */
  private analyzePortfolioRisk(trades: any[], metrics: Record<string, number>): PortfolioRisk {
    const pnls = trades.map(t => t.PnL || t['Net P&L'] || 0)

    // Calculate drawdowns
    const equityCurve = this.calculateEquityCurve(pnls)
    const drawdowns = this.calculateDrawdowns(equityCurve)

    const maxDrawdown = Math.min(...drawdowns)
    const avgDrawdown = drawdowns.reduce((sum, dd) => sum + dd, 0) / drawdowns.length

    // Calculate VaR at 95% confidence
    const sortedPnls = [...pnls].sort((a, b) => a - b)
    const var95Index = Math.floor(sortedPnls.length * 0.05)
    const var95 = sortedPnls[var95Index] || 0

    // Risk per trade (average loss)
    const losingTrades = trades.filter(t => (t.PnL || 0) < 0)
    const riskPerTrade = losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.PnL || 0), 0)) / losingTrades.length
      : 0

    // Portfolio heat (total capital at risk)
    const portfolioHeat = metrics.maxDrawdown || 0

    // Correlation risk (would need more data)
    const correlationRisk = 'unknown' // Could analyze consecutive losses

    return {
      maxDrawdown,
      avgDrawdown,
      var95,
      riskPerTrade,
      portfolioHeat,
      correlationRisk
    }
  }

  /**
   * Calculate equity curve
   */
  private calculateEquityCurve(pnls: number[]): number[] {
    const equityCurve: number[] = [0]
    let cumulative = 0

    for (const pnl of pnls) {
      cumulative += pnl
      equityCurve.push(cumulative)
    }

    return equityCurve
  }

  /**
   * Calculate drawdowns from equity curve
   */
  private calculateDrawdowns(equityCurve: number[]): number[] {
    const drawdowns: number[] = []
    let peak = equityCurve[0]

    for (const equity of equityCurve) {
      if (equity > peak) {
        peak = equity
      }
      drawdowns.push(equity - peak)
    }

    return drawdowns
  }

  /**
   * Generate risk alerts
   */
  private generateRiskAlerts(
    trades: any[],
    positionSizing: PositionSizingAnalysis,
    portfolioRisk: PortfolioRisk
  ): RiskAlert[] {
    const alerts: RiskAlert[] = []

    // Position size alerts
    if (positionSizing.oversizedPositions.length > 3) {
      alerts.push({
        type: 'position_size',
        severity: 'critical',
        message: `Found ${positionSizing.oversizedPositions.length} significantly oversized positions`,
        affectedTrades: positionSizing.oversizedPositions.map(t => t.tradeId),
        recommendation: 'Implement maximum position size limits immediately'
      })
    } else if (positionSizing.oversizedPositions.length > 0) {
      alerts.push({
        type: 'position_size',
        severity: 'warning',
        message: `Found ${positionSizing.oversizedPositions.length} oversized positions`,
        affectedTrades: positionSizing.oversizedPositions.map(t => t.tradeId),
        recommendation: 'Review position sizing strategy and reduce size variance'
      })
    }

    // Drawdown alerts
    if (portfolioRisk.maxDrawdown < -5000) {
      alerts.push({
        type: 'drawdown',
        severity: 'critical',
        message: `Maximum drawdown of $${Math.abs(portfolioRisk.maxDrawdown).toFixed(0)} is critical`,
        affectedTrades: [],
        recommendation: 'Halt trading and review risk management rules immediately'
      })
    } else if (portfolioRisk.maxDrawdown < -2000) {
      alerts.push({
        type: 'drawdown',
        severity: 'warning',
        message: `Maximum drawdown of $${Math.abs(portfolioRisk.maxDrawdown).toFixed(0)} requires attention`,
        affectedTrades: [],
        recommendation: 'Reduce position sizes and review risk limits'
      })
    }

    // Risk-reward alerts
    if (positionSizing.riskRewardRatio < 1) {
      alerts.push({
        type: 'position_size',
        severity: 'warning',
        message: `Risk-reward ratio of ${positionSizing.riskRewardRatio.toFixed(2)} is below 1.0`,
        affectedTrades: [],
        recommendation: 'Focus on trades with better risk-reward profiles'
      })
    }

    // Position sizing grade alerts
    if (positionSizing.positionSizingGrade === 'F' || positionSizing.positionSizingGrade === 'D') {
      alerts.push({
        type: 'position_size',
        severity: 'warning',
        message: `Position sizing grade is ${positionSizing.positionSizingGrade}`,
        affectedTrades: [],
        recommendation: 'Implement consistent position sizing rules'
      })
    }

    return alerts
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRiskLevel(
    positionSizing: PositionSizingAnalysis,
    portfolioRisk: PortfolioRisk,
    alerts: RiskAlert[]
  ): 'low' | 'moderate' | 'high' | 'critical' {
    // Check for critical alerts
    const hasCriticalAlert = alerts.some(a => a.severity === 'critical')
    if (hasCriticalAlert) return 'critical'

    // Check drawdown severity
    if (portfolioRisk.maxDrawdown < -5000) return 'critical'
    if (portfolioRisk.maxDrawdown < -2000) return 'high'

    // Check position sizing grade
    if (positionSizing.positionSizingGrade === 'F') return 'high'
    if (positionSizing.positionSizingGrade === 'D') return 'moderate'

    // Check warning alerts
    const warningCount = alerts.filter(a => a.severity === 'warning').length
    if (warningCount >= 3) return 'high'
    if (warningCount >= 1) return 'moderate'

    // Default based on position sizing consistency
    if (positionSizing.positionSizeConsistency < 0.5) return 'moderate'

    return 'low'
  }

  /**
   * Calculate risk score (0-100)
   */
  private calculateRiskScore(
    positionSizing: PositionSizingAnalysis,
    portfolioRisk: PortfolioRisk,
    alerts: RiskAlert[]
  ): number {
    let score = 50 // Base score

    // Adjust for position sizing consistency
    score += (positionSizing.positionSizeConsistency - 0.5) * 20

    // Adjust for drawdown
    score += (portfolioRisk.maxDrawdown / 1000) * 5

    // Adjust for risk-reward ratio
    score += (positionSizing.riskRewardRatio - 1) * 10

    // Adjust for alerts
    const criticalCount = alerts.filter(a => a.severity === 'critical').length
    const warningCount = alerts.filter(a => a.severity === 'warning').length

    score -= criticalCount * 20
    score -= warningCount * 5

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(
    positionSizing: PositionSizingAnalysis,
    portfolioRisk: PortfolioRisk,
    alerts: RiskAlert[]
  ): string[] {
    const recommendations: string[] = []

    // Position sizing recommendations
    if (positionSizing.positionSizingGrade === 'F' || positionSizing.positionSizingGrade === 'D') {
      recommendations.push('Implement fixed position sizing (e.g., 1-2% of capital per trade)')
      recommendations.push('Use maximum loss limits to control position sizes')
    }

    if (positionSizing.oversizedPositions.length > 0) {
      recommendations.push('Reduce position size variance - use consistent sizing rules')
    }

    if (positionSizing.riskRewardRatio < 1.5) {
      recommendations.push('Focus on setups with minimum 2:1 risk-reward ratio')
      recommendations.push('Let winners run to improve risk-reward profile')
    }

    // Drawdown recommendations
    if (portfolioRisk.maxDrawdown < -2000) {
      recommendations.push('Reduce overall position sizes to limit drawdowns')
      recommendations.push('Consider implementing a maximum loss per day/week limit')
    }

    // Alert-based recommendations
    for (const alert of alerts) {
      if (!recommendations.includes(alert.recommendation)) {
        recommendations.push(alert.recommendation)
      }
    }

    // General risk management recommendations
    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring risk metrics and maintaining discipline')
    }

    return recommendations
  }

  /**
   * Store risk analysis
   */
  private storeRiskAnalysis(userId: string, analysis: RiskAnalysis): void {
    if (!this.riskHistory.has(userId)) {
      this.riskHistory.set(userId, [])
    }

    const history = this.riskHistory.get(userId)!
    history.push(analysis)

    // Keep only last 20 analyses
    if (history.length > 20) {
      history.splice(0, history.length - 20)
    }
  }

  /**
   * Get risk analysis history
   */
  getRiskHistory(userId: string): RiskAnalysis[] {
    return this.riskHistory.get(userId) || []
  }

  /**
   * Get empty position sizing analysis
   */
  private getEmptyPositionSizingAnalysis(): PositionSizingAnalysis {
    return {
      avgPositionSize: 0,
      positionSizeRange: { min: 0, max: 0 },
      positionSizeConsistency: 0,
      oversizedPositions: [],
      riskRewardRatio: 0,
      positionSizingGrade: 'F'
    }
  }

  /**
   * Get empty portfolio risk
   */
  private getEmptyPortfolioRisk(): PortfolioRisk {
    return {
      maxDrawdown: 0,
      avgDrawdown: 0,
      var95: 0,
      riskPerTrade: 0,
      portfolioHeat: 0,
      correlationRisk: 'unknown'
    }
  }
}

/**
 * Create Risk Management Agent instance
 */
export function createRiskManagementAgent(): RiskManagementAgent {
  return new RiskManagementAgent()
}
