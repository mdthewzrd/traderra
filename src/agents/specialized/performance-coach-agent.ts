/**
 * Performance Coach Agent
 *
 * Specialized agent for providing coaching feedback and helping traders
 * improve their performance through constructive guidance.
 *
 * Responsibilities:
 * - Provide personalized coaching feedback
 * - Identify areas for improvement
 * - Suggest specific action items
 * - Track progress over time
 * - Celebrate wins and provide encouragement
 * - Offer constructive criticism when needed
 * - Create development plans
 *
 * @module PerformanceCoachAgent
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult, AgentContext } from '../core/base-agent'

export interface CoachingSession {
  userId: string
  focusAreas: FocusArea[]
  strengths: string[]
  improvements: string[]
  actionItems: ActionItem[]
  encouragement: string[]
  overallAssessment: string
  priorityLevel: 'low' | 'medium' | 'high'
}

export interface FocusArea {
  area: string
  currentLevel: number // 1-10
  targetLevel: number
  gap: number
  priority: 'low' | 'medium' | 'high'
  specificIssues: string[]
  recommendations: string[]
}

export interface ActionItem {
  id: string
  task: string
  category: 'immediate' | 'short_term' | 'long_term'
  estimatedImpact: 'low' | 'medium' | 'high'
  difficulty: 'easy' | 'moderate' | 'challenging'
  status: 'pending' | 'in_progress' | 'completed'
}

export interface PerformanceMetrics {
  currentMetrics: Record<string, number>
  trend: 'improving' | 'stable' | 'declining'
  trends: Record<string, 'improving' | 'stable' | 'declining'>
  comparison: {
    vsLastPeriod: number
    vsGoal: number
  }
}

/**
 * Performance Coach Agent Class
 *
 * Provides coaching and guidance to help traders improve.
 */
export class PerformanceCoachAgent extends BaseAgent {
  private coachingHistory: Map<string, CoachingSession[]> = new Map()
  private actionItemTracker: Map<string, ActionItem[]> = new Map()

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      id: 'performance-coach-agent',
      name: 'Performance Coach Agent',
      version: '1.0.0',
      description: 'Provides coaching feedback and guidance for trading improvement',
      capabilities: {
        canAnalyze: true,
        canExecute: false,
        canLearn: true,
        canRecommend: true,
        requiresContext: ['trades', 'metrics', 'journal']
      },
      maxConcurrentTasks: 5,
      timeoutMs: 15000
    }

    super({ ...defaultConfig, ...config })
  }

  /**
   * Can handle coaching tasks
   */
  canHandle(taskType: string): boolean {
    return [
      'provide_coaching',
      'performance_review',
      'improvement_suggestions',
      'progress_assessment',
      'create_development_plan',
      'feedback_session'
    ].includes(taskType)
  }

  /**
   * Perform coaching task
   */
  protected async performTask(task: AgentTask): Promise<CoachingSession> {
    const { intent, entities, context } = task.input

    console.log('[PerformanceCoachAgent] Providing coaching:', intent)

    // Analyze current performance
    const performance = this.analyzePerformance(context)

    // Identify focus areas
    const focusAreas = this.identifyFocusAreas(performance, context)

    // Determine strengths
    const strengths = this.identifyStrengths(performance, context)

    // Determine improvements needed
    const improvements = this.identifyImprovements(focusAreas)

    // Generate action items
    const actionItems = this.generateActionItems(focusAreas, context)

    // Generate encouragement
    const encouragement = this.generateEncouragement(performance, context)

    // Create overall assessment
    const overallAssessment = this.createOverallAssessment(performance, focusAreas, context)

    const session: CoachingSession = {
      userId: context.userId,
      focusAreas,
      strengths,
      improvements,
      actionItems,
      encouragement,
      overallAssessment,
      priorityLevel: this.calculatePriorityLevel(focusAreas)
    }

    // Store session
    this.storeCoachingSession(context.userId, session)

    return session
  }

  /**
   * Analyze current performance
   */
  private analyzePerformance(context: AgentContext): PerformanceMetrics {
    const metrics = context.metrics || {}
    const trades = context.trades || []

    // Calculate current metrics
    const currentMetrics: Record<string, number> = {
      winRate: metrics.winRate || 0,
      expectancy: metrics.expectancy || 0,
      profitFactor: metrics.profitFactor || 0,
      sharpeRatio: metrics.sharpeRatio || 0,
      maxDrawdown: metrics.maxDrawdown || 0,
      avgWin: metrics.averageWin || 0,
      avgLoss: metrics.averageLoss || 0
    }

    // Determine trends (would compare with historical data)
    const trends: Record<string, 'improving' | 'stable' | 'declining'> = {
      winRate: this.calculateTrend(trades, 'winRate'),
      profitability: this.calculateTrend(trades, 'profitability'),
      consistency: this.calculateTrend(trades, 'consistency')
    }

    // Overall trend
    const trendValues = Object.values(trends)
    const improvingCount = trendValues.filter(t => t === 'improving').length
    const decliningCount = trendValues.filter(t => t === 'declining').length

    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (improvingCount > decliningCount) trend = 'improving'
    if (decliningCount > improvingCount) trend = 'declining'

    return {
      currentMetrics,
      trend,
      trends,
      comparison: {
        vsLastPeriod: 0, // Would calculate vs previous period
        vsGoal: 0 // Would calculate vs goals
      }
    }
  }

  /**
   * Calculate trend for a metric
   */
  private calculateTrend(trades: any[], metricType: string): 'improving' | 'stable' | 'declining' {
    if (trades.length < 10) return 'stable'

    // Split into first half and second half
    const midpoint = Math.floor(trades.length / 2)
    const firstHalf = trades.slice(0, midpoint)
    const secondHalf = trades.slice(midpoint)

    let firstHalfValue: number
    let secondHalfValue: number

    switch (metricType) {
      case 'winRate':
        firstHalfValue = firstHalf.filter(t => (t.PnL || 0) > 0).length / firstHalf.length
        secondHalfValue = secondHalf.filter(t => (t.PnL || 0) > 0).length / secondHalf.length
        break

      case 'profitability':
        firstHalfValue = firstHalf.reduce((sum, t) => sum + (t.PnL || 0), 0)
        secondHalfValue = secondHalf.reduce((sum, t) => sum + (t.PnL || 0), 0)
        break

      case 'consistency':
        const firstHalfStd = this.calculateStdDev(firstHalf.map(t => t.PnL || 0))
        const secondHalfStd = this.calculateStdDev(secondHalf.map(t => t.PnL || 0))
        // Lower std dev = more consistent = improving
        firstHalfValue = -firstHalfStd
        secondHalfValue = -secondHalfStd
        break

      default:
        return 'stable'
    }

    const change = (secondHalfValue - firstHalfValue) / Math.abs(firstHalfValue || 1)

    if (change > 0.05) return 'improving'
    if (change < -0.05) return 'declining'
    return 'stable'
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length)
  }

  /**
   * Identify focus areas for improvement
   */
  private identifyFocusAreas(performance: PerformanceMetrics, context: AgentContext): FocusArea[] {
    const focusAreas: FocusArea[] = []
    const metrics = performance.currentMetrics

    // Win rate focus
    if (metrics.winRate < 0.4) {
      focusAreas.push({
        area: 'Win Rate',
        currentLevel: Math.round(metrics.winRate * 10),
        targetLevel: 6,
        gap: 6 - Math.round(metrics.winRate * 10),
        priority: 'high',
        specificIssues: [
          'Win rate below 40% indicates entry/exit issues',
          'Consider reviewing trade selection criteria',
          'Evaluate if you\'re exiting winners too early'
        ],
        recommendations: [
          'Focus on higher-quality setups',
          'Let winners run to full target',
          'Reduce frequency of trades, increase selectivity'
        ]
      })
    } else if (metrics.winRate < 0.5) {
      focusAreas.push({
        area: 'Win Rate',
        currentLevel: Math.round(metrics.winRate * 10),
        targetLevel: 6,
        gap: 6 - Math.round(metrics.winRate * 10),
        priority: 'medium',
        specificIssues: [
          'Win rate could be improved',
          'Small improvements in setup selection could help'
        ],
        recommendations: [
          'Review recent winning trades for common characteristics',
          'Focus on your best performing patterns'
        ]
      })
    }

    // Risk management focus
    if (metrics.maxDrawdown < -2000) {
      focusAreas.push({
        area: 'Risk Management',
        currentLevel: 3,
        targetLevel: 7,
        gap: 4,
        priority: 'high',
        specificIssues: [
          `Maximum drawdown of $${Math.abs(metrics.maxDrawdown).toFixed(0)} is concerning`,
          'Large drawdowns suggest position sizing issues'
        ],
        recommendations: [
          'Reduce position sizes immediately',
          'Implement maximum loss per trade limits',
          'Consider scaling in rather than full entries'
        ]
      })
    }

    // Expectancy focus
    if (metrics.expectancy < 0) {
      focusAreas.push({
        area: 'Expectancy',
        currentLevel: 2,
        targetLevel: 7,
        gap: 5,
        priority: 'high',
        specificIssues: [
          'Negative expectancy means losing money over time',
          'Current approach is not mathematically sound'
        ],
        recommendations: [
          'Stop trading live until expectancy turns positive',
          'Review and revise trading strategy',
          'Paper trade to test improvements'
        ]
      })
    } else if (metrics.expectancy < 100) {
      focusAreas.push({
        area: 'Expectancy',
        currentLevel: 4,
        targetLevel: 7,
        gap: 3,
        priority: 'medium',
        specificIssues: [
          'Low but positive expectancy',
          'Room for improvement in trade selection'
        ],
        recommendations: [
          'Focus on higher-probability setups',
          'Improve risk-reward ratios'
        ]
      })
    }

    // Profit factor focus
    if (metrics.profitFactor < 1.5) {
      focusAreas.push({
        area: 'Profit Factor',
        currentLevel: Math.round(metrics.profitFactor * 2),
        targetLevel: 6,
        gap: 6 - Math.round(metrics.profitFactor * 2),
        priority: 'medium',
        specificIssues: [
          'Profit factor below 1.5 suggests winners aren\'t covering losers',
          'Need larger wins or more frequent wins'
        ],
        recommendations: [
          'Let winners run longer',
          'Cut losses more quickly',
          'Improve win rate through better setup selection'
        ]
      })
    }

    return focusAreas
  }

  /**
   * Identify strengths
   */
  private identifyStrengths(performance: PerformanceMetrics, context: AgentContext): string[] {
    const strengths: string[] = []
    const metrics = performance.currentMetrics

    if (metrics.winRate >= 0.5) {
      strengths.push(`Solid win rate of ${(metrics.winRate * 100).toFixed(1)}%`)
    }

    if (metrics.expectancy >= 200) {
      strengths.push(`Excellent expectancy of $${metrics.expectancy.toFixed(0)} per trade`)
    } else if (metrics.expectancy >= 100) {
      strengths.push(`Good expectancy of $${metrics.expectancy.toFixed(0)} per trade`)
    }

    if (metrics.profitFactor >= 2.0) {
      strengths.push(`Strong profit factor of ${metrics.profitFactor.toFixed(2)}`)
    }

    if (metrics.avgWin > Math.abs(metrics.avgLoss || 1) * 2) {
      strengths.push('Good risk-reward ratio with winners averaging more than 2x losers')
    }

    if (performance.trend === 'improving') {
      strengths.push('Performance trending in the right direction')
    }

    if (strengths.length === 0) {
      strengths.push('Consistent trading activity - building experience')
    }

    return strengths
  }

  /**
   * Identify improvement areas
   */
  private identifyImprovements(focusAreas: FocusArea[]): string[] {
    return focusAreas.map(area =>
      `Work on ${area.area}: ${area.recommendations.slice(0, 2).join(', ')}`
    )
  }

  /**
   * Generate action items
   */
  private generateActionItems(focusAreas: FocusArea[], context: AgentContext): ActionItem[] {
    const actionItems: ActionItem[] = []

    for (const area of focusAreas) {
      if (area.priority === 'high') {
        for (const rec of area.recommendations.slice(0, 2)) {
          actionItems.push({
            id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            task: `${area.area}: ${rec}`,
            category: 'immediate',
            estimatedImpact: area.priority === 'high' ? 'high' : 'medium',
            difficulty: 'moderate',
            status: 'pending'
          })
        }
      }
    }

    // Add general improvement action items
    actionItems.push({
      id: `action-${Date.now()}-review`,
      task: 'Review and journal every trade for the next week',
      category: 'short_term',
      estimatedImpact: 'medium',
      difficulty: 'easy',
      status: 'pending'
    })

    actionItems.push({
      id: `action-${Date.now()}-analyze`,
      task: 'Analyze last 20 trades for patterns',
      category: 'immediate',
      estimatedImpact: 'high',
      difficulty: 'moderate',
      status: 'pending'
    })

    return actionItems
  }

  /**
   * Generate encouragement
   */
  private generateEncouragement(performance: PerformanceMetrics, context: AgentContext): string[] {
    const encouragement: string[] = []

    if (performance.trend === 'improving') {
      encouragement.push("You're making progress - keep building on this momentum!")
      encouragement.push('Your hard work is showing in your results.')
    } else if (performance.trend === 'declining') {
      encouragement.push("Every trader goes through rough patches. This is temporary.")
      encouragement.push("Focus on process, not outcomes. You'll turn this around.")
    }

    if (context.trades && context.trades.length > 0) {
      encouragement.push(`You've executed ${context.trades.length} trades - experience is building.`)
    }

    encouragement.push('Trading is a marathon, not a sprint. Stay patient and disciplined.')

    return encouragement
  }

  /**
   * Create overall assessment
   */
  private createOverallAssessment(
    performance: PerformanceMetrics,
    focusAreas: FocusArea[],
    context: AgentContext
  ): string {
    const highPriorityIssues = focusAreas.filter(a => a.priority === 'high').length

    if (highPriorityIssues > 0) {
      return `You have ${highPriorityIssues} critical area(s) requiring immediate attention. I recommend focusing on these before adding complexity. Once these are addressed, you'll see significant improvement in your overall performance.`
    }

    if (focusAreas.length > 0) {
      return `You're doing well, but there are ${focusAreas.length} area(s) where focused effort could yield better results. Pick one to work on at a time rather than trying to fix everything at once.`
    }

    if (performance.trend === 'improving') {
      return `You're on the right track! Continue doing what's working and stay disciplined. Consider pushing into new areas cautiously.`
    }

    return `You're building experience. Focus on consistency and following your plan. Results will come with time and practice.`
  }

  /**
   * Calculate priority level of session
   */
  private calculatePriorityLevel(focusAreas: FocusArea[]): 'low' | 'medium' | 'high' {
    const highPriorityCount = focusAreas.filter(a => a.priority === 'high').length
    const mediumPriorityCount = focusAreas.filter(a => a.priority === 'medium').length

    if (highPriorityCount > 0) return 'high'
    if (mediumPriorityCount > 0) return 'medium'
    return 'low'
  }

  /**
   * Store coaching session
   */
  private storeCoachingSession(userId: string, session: CoachingSession): void {
    if (!this.coachingHistory.has(userId)) {
      this.coachingHistory.set(userId, [])
    }

    const history = this.coachingHistory.get(userId)!
    history.push(session)

    // Keep only last 10 sessions
    if (history.length > 10) {
      history.splice(0, history.length - 10)
    }
  }

  /**
   * Get coaching history for user
   */
  getCoachingHistory(userId: string): CoachingSession[] {
    return this.coachingHistory.get(userId) || []
  }

  /**
   * Get action items for user
   */
  getActionItems(userId: string): ActionItem[] {
    const history = this.getCoachingHistory(userId)
    const latest = history[history.length - 1]
    return latest?.actionItems || []
  }

  /**
   * Update action item status
   */
  updateActionItemStatus(userId: string, actionItemId: string, status: ActionItem['status']): void {
    const history = this.getCoachingHistory(userId)
    const latest = history[history.length - 1]

    if (latest) {
      const actionItem = latest.actionItems.find(a => a.id === actionItemId)
      if (actionItem) {
        actionItem.status = status
      }
    }
  }
}

/**
 * Create Performance Coach Agent instance
 */
export function createPerformanceCoachAgent(): PerformanceCoachAgent {
  return new PerformanceCoachAgent()
}
