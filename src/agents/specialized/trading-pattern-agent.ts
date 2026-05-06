/**
 * Trading Pattern Agent
 *
 * Specialized agent for analyzing trading patterns and identifying
 * recurring behaviors in winning and losing trades.
 *
 * Responsibilities:
 * - Identify patterns in winning trades (what works)
 * - Identify patterns in losing trades (what doesn't work)
 * - Detect recurring setups and their outcomes
 * - Analyze entry/exit timing patterns
 * - Find correlations between trade attributes and performance
 * - Suggest pattern-based improvements
 *
 * @module TradingPatternAgent
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult, AgentContext } from '../core/base-agent'

export interface PatternAnalysis {
  winningPatterns: Pattern[]
  losingPatterns: Pattern[]
  keyFindings: string[]
  recommendations: string[]
  confidence: number
}

export interface Pattern {
  type: 'setup' | 'timing' | 'market_condition' | 'emotion' | 'position_sizing'
  description: string
  frequency: number
  winRate: number
  avgProfit: number
  avgLoss: number
  examples: any[]
  strength: 'strong' | 'moderate' | 'weak'
}

export interface TradeWithMetadata {
  trade: any
  timestamp: number
  dayOfWeek: string
  hourOfDay: number
  marketCondition?: string
  emotion?: string
  setupType?: string
}

/**
 * Trading Pattern Agent Class
 *
 * Analyzes trades to discover patterns that lead to success or failure.
 */
export class TradingPatternAgent extends BaseAgent {
  private patternCache: Map<string, PatternAnalysis> = new Map()

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      id: 'trading-pattern-agent',
      name: 'Trading Pattern Agent',
      version: '1.0.0',
      description: 'Analyzes trading patterns to identify winning and losing behaviors',
      capabilities: {
        canAnalyze: true,
        canExecute: false,
        canLearn: true,
        canRecommend: true,
        requiresContext: ['trades', 'metrics']
      },
      maxConcurrentTasks: 5,
      timeoutMs: 20000
    }

    super({ ...defaultConfig, ...config })
  }

  /**
   * Can handle pattern analysis tasks
   */
  canHandle(taskType: string): boolean {
    return [
      'analyze_trading_pattern',
      'analyze_winning_patterns',
      'analyze_losing_patterns',
      'pattern_recognition',
      'trade_behavior_analysis'
    ].includes(taskType)
  }

  /**
   * Perform pattern analysis task
   */
  protected async performTask(task: AgentTask): Promise<PatternAnalysis> {
    const { intent, entities, context } = task.input

    console.log('[TradingPatternAgent] Analyzing patterns:', intent)

    // Check cache first
    const cacheKey = `${context.userId}-${intent}`
    const cached = this.patternCache.get(cacheKey)
    if (cached && (Date.now() - (task as any).cacheTime) < 300000) { // 5 min cache
      return cached
    }

    // Get trades from context
    const trades = context.trades || []

    if (trades.length === 0) {
      return {
        winningPatterns: [],
        losingPatterns: [],
        keyFindings: ['No trade data available for pattern analysis'],
        recommendations: ['Import trades to enable pattern analysis'],
        confidence: 0
      }
    }

    // Enrich trades with metadata
    const enrichedTrades = this.enrichTrades(trades)

    // Analyze patterns based on intent
    let analysis: PatternAnalysis

    switch (intent) {
      case 'analyze_winning_patterns':
        analysis = this.analyzeWinningPatterns(enrichedTrades, context)
        break

      case 'analyze_losing_patterns':
        analysis = this.analyzeLosingPatterns(enrichedTrades, context)
        break

      default:
        analysis = this.analyzeAllPatterns(enrichedTrades, context)
    }

    // Cache results
    this.patternCache.set(cacheKey, analysis)

    return analysis
  }

  /**
   * Enrich trades with metadata for pattern analysis
   */
  private enrichTrades(trades: any[]): TradeWithMetadata[] {
    return trades.map(trade => {
      const date = new Date(trade.exit_date || trade.entry_date || trade.Date)
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
      const hourOfDay = date.getHours()

      return {
        trade,
        timestamp: date.getTime(),
        dayOfWeek,
        hourOfDay,
        marketCondition: this.inferMarketCondition(trade),
        emotion: this.inferEmotion(trade),
        setupType: this.inferSetupType(trade)
      }
    })
  }

  /**
   * Infer market condition from trade
   */
  private inferMarketCondition(trade: any): string {
    // This would ideally come from market data, but we can infer from trade
    const pnl = trade.PnL || trade['Net P&L'] || trade.profit_loss || 0

    if (pnl > 0) return 'favorable'
    if (pnl < 0) return 'challenging'
    return 'neutral'
  }

  /**
   * Infer emotion from trade
   */
  private inferEmotion(trade: any): string {
    const pnl = trade.PnL || trade['Net P&L'] || trade.profit_loss || 0
    const notes = (trade.notes || trade.Notes || trade.Comments || '').toLowerCase()

    // Check notes for emotional keywords
    if (notes.includes('frustrat') || notes.includes('annoying')) return 'frustrated'
    if (notes.includes('happy') || notes.includes('great')) return 'happy'
    if (notes.includes('nervous') || notes.includes('scared')) return 'anxious'

    // Infer from P&L size
    if (Math.abs(pnl) > 1000) return pnl > 0 ? 'excited' : 'disappointed'

    return 'neutral'
  }

  /**
   * Infer setup type from trade
   */
  private inferSetupType(trade: any): string {
    const notes = (trade.notes || trade.Notes || trade.Comments || '').toLowerCase()

    if (notes.includes('breakout') || notes.includes('break out')) return 'breakout'
    if (notes.includes('pullback') || notes.includes('dip')) return 'pullback'
    if (notes.includes('reversal') || notes.includes('reverse')) return 'reversal'
    if (notes.includes('momentum')) return 'momentum'
    if (notes.includes('gap')) return 'gap'

    return 'other'
  }

  /**
   * Analyze all patterns (winning and losing)
   */
  private analyzeAllPatterns(trades: TradeWithMetadata[], context: AgentContext): PatternAnalysis {
    const winningPatterns = this.findWinningPatterns(trades)
    const losingPatterns = this.findLosingPatterns(trades)
    const keyFindings = this.generateKeyFindings(winningPatterns, losingPatterns, trades)
    const recommendations = this.generateRecommendations(winningPatterns, losingPatterns)

    return {
      winningPatterns,
      losingPatterns,
      keyFindings,
      recommendations,
      confidence: this.calculateConfidence(trades.length)
    }
  }

  /**
   * Analyze winning patterns specifically
   */
  private analyzeWinningPatterns(trades: TradeWithMetadata[], context: AgentContext): PatternAnalysis {
    const winningPatterns = this.findWinningPatterns(trades)

    return {
      winningPatterns,
      losingPatterns: [],
      keyFindings: winningPatterns.map(p => `Strong ${p.type} pattern: ${p.description}`),
      recommendations: this.generateWinningRecommendations(winningPatterns),
      confidence: this.calculateConfidence(trades.filter(t => (t.trade.PnL || 0) > 0).length)
    }
  }

  /**
   * Analyze losing patterns specifically
   */
  private analyzeLosingPatterns(trades: TradeWithMetadata[], context: AgentContext): PatternAnalysis {
    const losingPatterns = this.findLosingPatterns(trades)

    return {
      winningPatterns: [],
      losingPatterns,
      keyFindings: losingPatterns.map(p => `Problematic ${p.type} pattern: ${p.description}`),
      recommendations: this.generateLosingRecommendations(losingPatterns),
      confidence: this.calculateConfidence(trades.filter(t => (t.trade.PnL || 0) < 0).length)
    }
  }

  /**
   * Find patterns in winning trades
   */
  private findWinningPatterns(trades: TradeWithMetadata[]): Pattern[] {
    const winningTrades = trades.filter(t => (t.trade.PnL || t.trade['Net P&L'] || 0) > 0)
    const patterns: Pattern[] = []

    // Day of week pattern
    const dayWinRates = this.calculateWinRateByDay(winningTrades)
    const bestDay = Object.entries(dayWinRates).sort((a, b) => b[1].winRate - a[1].winRate)[0]
    if (bestDay && bestDay[1].winRate > 0.6) {
      patterns.push({
        type: 'timing',
        description: `Trading on ${bestDay[0]}s shows strong performance (${(bestDay[1].winRate * 100).toFixed(0)}% win rate)`,
        frequency: bestDay[1].count,
        winRate: bestDay[1].winRate,
        avgProfit: bestDay[1].avgProfit,
        avgLoss: 0,
        examples: winningTrades.filter(t => t.dayOfWeek === bestDay[0]).slice(0, 3).map(t => t.trade),
        strength: bestDay[1].winRate > 0.7 ? 'strong' : 'moderate'
      })
    }

    // Time of day pattern
    const hourWinRates = this.calculateWinRateByHour(winningTrades)
    const bestHour = Object.entries(hourWinRates).sort((a, b) => b[1].winRate - a[1].winRate)[0]
    if (bestHour && bestHour[1].winRate > 0.6) {
      patterns.push({
        type: 'timing',
        description: `Trading during ${this.formatHour(parseInt(bestHour[0]))} shows strong performance (${(bestHour[1].winRate * 100).toFixed(0)}% win rate)`,
        frequency: bestHour[1].count,
        winRate: bestHour[1].winRate,
        avgProfit: bestHour[1].avgProfit,
        avgLoss: 0,
        examples: winningTrades.filter(t => t.hourOfDay === parseInt(bestHour[0])).slice(0, 3).map(t => t.trade),
        strength: bestHour[1].winRate > 0.7 ? 'strong' : 'moderate'
      })
    }

    // Setup type pattern
    const setupWinRates = this.calculateWinRateBySetup(winningTrades)
    const bestSetup = Object.entries(setupWinRates).sort((a, b) => b[1].winRate - a[1].winRate)[0]
    if (bestSetup && bestSetup[1].winRate > 0.6 && bestSetup[0] !== 'other') {
      patterns.push({
        type: 'setup',
        description: `${bestSetup[0].charAt(0).toUpperCase() + bestSetup[0].slice(1)} setups perform well (${(bestSetup[1].winRate * 100).toFixed(0)}% win rate, avg profit: $${bestSetup[1].avgProfit.toFixed(0)})`,
        frequency: bestSetup[1].count,
        winRate: bestSetup[1].winRate,
        avgProfit: bestSetup[1].avgProfit,
        avgLoss: 0,
        examples: winningTrades.filter(t => t.setupType === bestSetup[0]).slice(0, 3).map(t => t.trade),
        strength: bestSetup[1].winRate > 0.75 ? 'strong' : 'moderate'
      })
    }

    return patterns
  }

  /**
   * Find patterns in losing trades
   */
  private findLosingPatterns(trades: TradeWithMetadata[]): Pattern[] {
    const losingTrades = trades.filter(t => (t.trade.PnL || t.trade['Net P&L'] || 0) < 0)
    const patterns: Pattern[] = []

    // Day of week pattern
    const dayWinRates = this.calculateWinRateByDay(losingTrades)
    const worstDay = Object.entries(dayWinRates).sort((a, b) => a[1].winRate - b[1].winRate)[0]
    if (worstDay && worstDay[1].winRate < 0.4) {
      patterns.push({
        type: 'timing',
        description: `Trading on ${worstDay[0]}s shows poor performance (${(worstDay[1].winRate * 100).toFixed(0)}% win rate)`,
        frequency: worstDay[1].count,
        winRate: worstDay[1].winRate,
        avgProfit: 0,
        avgLoss: Math.abs(worstDay[1].avgLoss),
        examples: losingTrades.filter(t => t.dayOfWeek === worstDay[0]).slice(0, 3).map(t => t.trade),
        strength: worstDay[1].winRate < 0.3 ? 'strong' : 'moderate'
      })
    }

    // Setup type pattern
    const setupWinRates = this.calculateWinRateBySetup(losingTrades)
    const worstSetup = Object.entries(setupWinRates).sort((a, b) => a[1].winRate - b[1].winRate)[0]
    if (worstSetup && worstSetup[1].winRate < 0.4 && worstSetup[0] !== 'other') {
      patterns.push({
        type: 'setup',
        description: `${worstSetup[0].charAt(0).toUpperCase() + worstSetup[0].slice(1)} setups underperform (${(worstSetup[1].winRate * 100).toFixed(0)}% win rate, avg loss: $${Math.abs(worstSetup[1].avgLoss).toFixed(0)})`,
        frequency: worstSetup[1].count,
        winRate: worstSetup[1].winRate,
        avgProfit: 0,
        avgLoss: worstSetup[1].avgLoss,
        examples: losingTrades.filter(t => t.setupType === worstSetup[0]).slice(0, 3).map(t => t.trade),
        strength: worstSetup[1].winRate < 0.25 ? 'strong' : 'moderate'
      })
    }

    // Large loss pattern
    const largeLosses = losingTrades.filter(t => Math.abs(t.trade.PnL || t.trade['Net P&L'] || 0) > 500)
    if (largeLosses.length > 0) {
      patterns.push({
        type: 'position_sizing',
        description: `Large losses (>$500) occur ${largeLosses.length} times, suggesting position sizing or risk management issues`,
        frequency: largeLosses.length,
        winRate: 0,
        avgProfit: 0,
        avgLoss: largeLosses.reduce((sum, t) => sum + Math.abs(t.trade.PnL || t.trade['Net P&L'] || 0), 0) / largeLosses.length,
        examples: largeLosses.slice(0, 3).map(t => t.trade),
        strength: largeLosses.length > 5 ? 'strong' : 'moderate'
      })
    }

    return patterns
  }

  /**
   * Calculate win rate by day of week
   */
  private calculateWinRateByDay(trades: TradeWithMetadata[]): Record<string, { count: number; winRate: number; avgProfit: number; avgLoss: number }> {
    const byDay: Record<string, { wins: number; losses: number; totalProfit: number; totalLoss: number }> = {}

    for (const trade of trades) {
      if (!byDay[trade.dayOfWeek]) {
        byDay[trade.dayOfWeek] = { wins: 0, losses: 0, totalProfit: 0, totalLoss: 0 }
      }

      const pnl = trade.trade.PnL || trade.trade['Net P&L'] || 0

      if (pnl > 0) {
        byDay[trade.dayOfWeek].wins++
        byDay[trade.dayOfWeek].totalProfit += pnl
      } else {
        byDay[trade.dayOfWeek].losses++
        byDay[trade.dayOfWeek].totalLoss += Math.abs(pnl)
      }
    }

    const result: Record<string, { count: number; winRate: number; avgProfit: number; avgLoss: number }> = {}

    for (const [day, stats] of Object.entries(byDay)) {
      const total = stats.wins + stats.losses
      result[day] = {
        count: total,
        winRate: stats.wins / total,
        avgProfit: stats.wins > 0 ? stats.totalProfit / stats.wins : 0,
        avgLoss: stats.losses > 0 ? stats.totalLoss / stats.losses : 0
      }
    }

    return result
  }

  /**
   * Calculate win rate by hour of day
   */
  private calculateWinRateByHour(trades: TradeWithMetadata[]): Record<string, { count: number; winRate: number; avgProfit: number; avgLoss: number }> {
    const byHour: Record<string, { wins: number; losses: number; totalProfit: number; totalLoss: number }> = {}

    for (const trade of trades) {
      const hour = trade.hourOfDay.toString()
      if (!byHour[hour]) {
        byHour[hour] = { wins: 0, losses: 0, totalProfit: 0, totalLoss: 0 }
      }

      const pnl = trade.trade.PnL || trade.trade['Net P&L'] || 0

      if (pnl > 0) {
        byHour[hour].wins++
        byHour[hour].totalProfit += pnl
      } else {
        byHour[hour].losses++
        byHour[hour].totalLoss += Math.abs(pnl)
      }
    }

    const result: Record<string, { count: number; winRate: number; avgProfit: number; avgLoss: number }> = {}

    for (const [hour, stats] of Object.entries(byHour)) {
      const total = stats.wins + stats.losses
      result[hour] = {
        count: total,
        winRate: stats.wins / total,
        avgProfit: stats.wins > 0 ? stats.totalProfit / stats.wins : 0,
        avgLoss: stats.losses > 0 ? stats.totalLoss / stats.losses : 0
      }
    }

    return result
  }

  /**
   * Calculate win rate by setup type
   */
  private calculateWinRateBySetup(trades: TradeWithMetadata[]): Record<string, { count: number; winRate: number; avgProfit: number; avgLoss: number }> {
    const bySetup: Record<string, { wins: number; losses: number; totalProfit: number; totalLoss: number }> = {}

    for (const trade of trades) {
      const setup = trade.setupType || 'other'
      if (!bySetup[setup]) {
        bySetup[setup] = { wins: 0, losses: 0, totalProfit: 0, totalLoss: 0 }
      }

      const pnl = trade.trade.PnL || trade.trade['Net P&L'] || 0

      if (pnl > 0) {
        bySetup[setup].wins++
        bySetup[setup].totalProfit += pnl
      } else {
        bySetup[setup].losses++
        bySetup[setup].totalLoss += Math.abs(pnl)
      }
    }

    const result: Record<string, { count: number; winRate: number; avgProfit: number; avgLoss: number }> = {}

    for (const [setup, stats] of Object.entries(bySetup)) {
      const total = stats.wins + stats.losses
      result[setup] = {
        count: total,
        winRate: stats.wins / total,
        avgProfit: stats.wins > 0 ? stats.totalProfit / stats.wins : 0,
        avgLoss: stats.losses > 0 ? stats.totalLoss / stats.losses : 0
      }
    }

    return result
  }

  /**
   * Format hour for display
   */
  private formatHour(hour: number): string {
    if (hour < 12) return `${hour}:00 AM - ${hour + 1}:00 AM`
    if (hour === 12) return `12:00 PM - 1:00 PM`
    return `${hour - 12}:00 PM - ${hour - 11}:00 PM`
  }

  /**
   * Generate key findings from patterns
   */
  private generateKeyFindings(winningPatterns: Pattern[], losingPatterns: Pattern[], trades: TradeWithMetadata[]): string[] {
    const findings: string[] = []

    if (winningPatterns.length > 0) {
      findings.push(`Identified ${winningPatterns.length} strong pattern(s) in your winning trades`)
    }

    if (losingPatterns.length > 0) {
      findings.push(`Identified ${losingPatterns.length} problematic pattern(s) in your losing trades`)
    }

    const winRate = trades.filter(t => (t.trade.PnL || 0) > 0).length / trades.length
    findings.push(`Overall win rate is ${(winRate * 100).toFixed(1)}%`)

    return findings
  }

  /**
   * Generate recommendations from patterns
   */
  private generateRecommendations(winningPatterns: Pattern[], losingPatterns: Pattern[]): string[] {
    const recommendations: string[] = []

    // Recommend focusing on winning patterns
    if (winningPatterns.length > 0) {
      const strongWinners = winningPatterns.filter(p => p.strength === 'strong')
      if (strongWinners.length > 0) {
        recommendations.push(`Focus more on your strong patterns: ${strongWinners.map(p => p.description).join(', ')}`)
      }
    }

    // Recommend avoiding losing patterns
    if (losingPatterns.length > 0) {
      const strongLosers = losingPatterns.filter(p => p.strength === 'strong')
      if (strongLosers.length > 0) {
        recommendations.push(`Consider reducing exposure to: ${strongLosers.map(p => p.description).join(', ')}`)
      }
    }

    return recommendations
  }

  /**
   * Generate recommendations for winning patterns
   */
  private generateWinningRecommendations(winningPatterns: Pattern[]): string[] {
    return winningPatterns.map(p => `Continue leveraging ${p.type}: ${p.description}`)
  }

  /**
   * Generate recommendations for losing patterns
   */
  private generateLosingRecommendations(losingPatterns: Pattern[]): string[] {
    return losingPatterns.map(p => `Review and adjust ${p.type}: ${p.description}`)
  }

  /**
   * Calculate confidence in analysis
   */
  private calculateConfidence(sampleSize: number): number {
    // More trades = higher confidence
    if (sampleSize < 10) return 0.3
    if (sampleSize < 30) return 0.5
    if (sampleSize < 50) return 0.7
    return 0.9
  }
}

/**
 * Create Trading Pattern Agent instance
 */
export function createTradingPatternAgent(): TradingPatternAgent {
  return new TradingPatternAgent()
}
