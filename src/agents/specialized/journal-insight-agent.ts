/**
 * Journal Insight Agent
 *
 * Specialized agent for analyzing trading journal entries and extracting
 * psychological and emotional insights.
 *
 * Responsibilities:
 * - Analyze journal entries for emotional patterns
 * - Identify psychological factors affecting performance
 * - Extract recurring themes in trader's mindset
 * - Connect emotions to trading outcomes
 * - Provide mental game insights
 * - Suggest journaling practices
 * - Track psychological progress
 *
 * @module JournalInsightAgent
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult, AgentContext } from '../core/base-agent'

export interface JournalAnalysis {
  emotionalPatterns: EmotionalPattern[]
  psychologicalInsights: PsychologicalInsight[]
  recurringThemes: string[]
  mindsetAssessment: MindsetAssessment
  recommendations: string[]
  journalQuality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface EmotionalPattern {
  emotion: string
  frequency: number
  avgOutcome: number
  contexts: string[]
  impact: 'positive' | 'negative' | 'neutral'
  examples: string[]
}

export interface PsychologicalInsight {
  category: 'discipline' | 'patience' | 'confidence' | 'fear' | 'greed' | 'revenge' | 'fomo' | 'other'
  description: string
  strength: 'strong' | 'moderate' | 'weak'
  relatedEmotions: string[]
  impactOnPerformance: 'positive' | 'negative' | 'mixed'
  suggestions: string[]
}

export interface MindsetAssessment {
  overallState: 'growth' | 'stable' | 'struggling' | 'critical'
  strengths: string[]
  areasForGrowth: string[]
  emotionalRegulation: number // 0-10
  decisionQuality: number // 0-10
  consistency: number // 0-10
}

export interface JournalEntry {
  id: string
  date: string
  content: string
  emotions: string[]
  tradeIds?: string[]
  outcome?: number
}

/**
 * Journal Insight Agent Class
 *
 * Analyzes journal entries to provide psychological insights.
 */
export class JournalInsightAgent extends BaseAgent {
  private emotionKeywords: Record<string, string[]> = {
    fear: ['scared', 'afraid', 'fearful', 'nervous', 'anxious', 'worried', 'panic', 'terrified'],
    greed: ['greedy', 'want more', 'need more', 'not enough', 'chasing', 'fear of missing out'],
    confidence: ['confident', 'sure', 'certain', 'comfortable', 'calm', 'relaxed'],
    frustration: ['frustrated', 'annoyed', 'irritated', 'upset', 'angry', 'mad'],
    patience: ['patient', 'waiting', 'biding time', 'holding', 'waiting for setup'],
    revenge: ['revenge', 'get back', 'make up for', 'need to recover', 'make it back'],
    euphoria: ['excited', 'euphoric', 'amazing', 'great', 'unstoppable', 'invincible'],
    regret: ['regret', 'should have', 'wish i had', 'wrong', 'mistake', 'error'],
    discipline: ['disciplined', 'followed plan', 'stuck to rules', 'patient', 'systematic'],
    hesitation: ['hesitated', 'doubt', 'unsure', 'second guessed', 'uncertain']
  }

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      id: 'journal-insight-agent',
      name: 'Journal Insight Agent',
      version: '1.0.0',
      description: 'Analyzes journal entries for psychological and emotional insights',
      capabilities: {
        canAnalyze: true,
        canExecute: false,
        canLearn: true,
        canRecommend: true,
        requiresContext: ['journal', 'trades']
      },
      maxConcurrentTasks: 3,
      timeoutMs: 15000
    }

    super({ ...defaultConfig, ...config })
  }

  /**
   * Can handle journal analysis tasks
   */
  canHandle(taskType: string): boolean {
    return [
      'analyze_journal',
      'psychological_analysis',
      'emotional_patterns',
      'mindset_assessment',
      'journal_quality',
      'mental_game'
    ].includes(taskType)
  }

  /**
   * Perform journal analysis task
   */
  protected async performTask(task: AgentTask): Promise<JournalAnalysis> {
    const { intent, entities, context } = task.input

    console.log('[JournalInsightAgent] Analyzing journal:', intent)

    // Get journal entries from context
    const journalEntries = this.extractJournalEntries(context)
    const trades = context.trades || []

    if (journalEntries.length === 0) {
      return {
        emotionalPatterns: [],
        psychologicalInsights: [],
        recurringThemes: [],
        mindsetAssessment: this.getEmptyMindsetAssessment(),
        recommendations: [
          'Start journaling each trade with thoughts and emotions',
          'Include what you were thinking before, during, and after trades',
          'Note your emotional state and how it affected decisions'
        ],
        journalQuality: 'poor'
      }
    }

    // Analyze emotional patterns
    const emotionalPatterns = this.analyzeEmotionalPatterns(journalEntries, trades)

    // Generate psychological insights
    const psychologicalInsights = this.generatePsychologicalInsights(
      journalEntries,
      emotionalPatterns,
      trades
    )

    // Identify recurring themes
    const recurringThemes = this.identifyRecurringThemes(journalEntries)

    // Assess mindset
    const mindsetAssessment = this.assessMindset(journalEntries, emotionalPatterns, trades)

    // Assess journal quality
    const journalQuality = this.assessJournalQuality(journalEntries)

    // Generate recommendations
    const recommendations = this.generateJournalRecommendations(
      journalEntries,
      emotionalPatterns,
      psychologicalInsights,
      mindsetAssessment,
      journalQuality
    )

    return {
      emotionalPatterns,
      psychologicalInsights,
      recurringThemes,
      mindsetAssessment,
      recommendations,
      journalQuality
    }
  }

  /**
   * Extract journal entries from context
   */
  private extractJournalEntries(context: AgentContext): JournalEntry[] {
    const journal = context.journal || []
    const trades = context.trades || []

    // If journal exists in context, use it
    if (journal.length > 0) {
      return journal.map((entry: any, index: number) => ({
        id: entry.id || `journal-${index}`,
        date: entry.date || entry.Date || new Date().toISOString(),
        content: entry.content || entry.notes || entry.Notes || entry.Comments || '',
        emotions: this.extractEmotions(entry.content || entry.notes || ''),
        tradeIds: entry.tradeId ? [entry.tradeId] : [],
        outcome: entry.outcome || entry.PnL
      }))
    }

    // Otherwise, extract from trade notes
    return trades
      .filter(t => t.notes || t.Notes || t.Comments)
      .map((trade: any, index: number) => ({
        id: `trade-journal-${index}`,
        date: trade.exit_date || trade.entry_date || trade.Date || new Date().toISOString(),
        content: trade.notes || trade.Notes || trade.Comments || '',
        emotions: this.extractEmotions(trade.notes || trade.Notes || trade.Comments || ''),
        tradeIds: [trade.id],
        outcome: trade.PnL || trade['Net P&L']
      }))
  }

  /**
   * Extract emotions from text
   */
  private extractEmotions(text: string): string[] {
    if (!text) return []

    const lowerText = text.toLowerCase()
    const foundEmotions: string[] = []

    for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        foundEmotions.push(emotion)
      }
    }

    return foundEmotions
  }

  /**
   * Analyze emotional patterns
   */
  private analyzeEmotionalPatterns(entries: JournalEntry[], trades: any[]): EmotionalPattern[] {
    const emotionMap: Map<string, {
      count: number
      outcomes: number[]
      contexts: string[]
      examples: string[]
    }> = new Map()

    // Aggregate emotions across entries
    for (const entry of entries) {
      for (const emotion of entry.emotions) {
        if (!emotionMap.has(emotion)) {
          emotionMap.set(emotion, {
            count: 0,
            outcomes: [],
            contexts: [],
            examples: []
          })
        }

        const data = emotionMap.get(emotion)!
        data.count++
        data.contexts.push(entry.content.substring(0, 100))

        if (entry.outcome !== undefined) {
          data.outcomes.push(entry.outcome)
        }

        if (data.examples.length < 3) {
          data.examples.push(entry.content.substring(0, 200))
        }
      }
    }

    // Convert to patterns
    const patterns: EmotionalPattern[] = []

    for (const [emotion, data] of emotionMap.entries()) {
      const avgOutcome = data.outcomes.length > 0
        ? data.outcomes.reduce((sum, val) => sum + val, 0) / data.outcomes.length
        : 0

      patterns.push({
        emotion,
        frequency: data.count,
        avgOutcome,
        contexts: data.contexts.slice(0, 5),
        impact: avgOutcome > 0 ? 'positive' : avgOutcome < 0 ? 'negative' : 'neutral',
        examples: data.examples
      })
    }

    // Sort by frequency
    return patterns.sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Generate psychological insights
   */
  private generatePsychologicalInsights(
    entries: JournalEntry[],
    emotionalPatterns: EmotionalPattern[],
    trades: any[]
  ): PsychologicalInsight[] {
    const insights: PsychologicalInsight[] = []

    // Analyze fear patterns
    const fearPatterns = emotionalPatterns.filter(p => p.emotion === 'fear')
    if (fearPatterns.length > 0 && fearPatterns[0].frequency > 2) {
      insights.push({
        category: 'fear',
        description: 'Fear appears frequently in your journal, possibly affecting decision quality',
        strength: fearPatterns[0].frequency > 5 ? 'strong' : 'moderate',
        relatedEmotions: ['anxiety', 'nervousness'],
        impactOnPerformance: fearPatterns[0].avgOutcome < 0 ? 'negative' : 'mixed',
        suggestions: [
          'Practice mindfulness techniques before trading',
          'Start with smaller position sizes to reduce fear',
          'Create a trading checklist to follow without hesitation',
          'Journal about what specifically you\'re afraid of in each trade'
        ]
      })
    }

    // Analyze discipline
    const disciplinePatterns = emotionalPatterns.filter(p => p.emotion === 'discipline')
    if (disciplinePatterns.length > 0 && disciplinePatterns[0].frequency > 2) {
      insights.push({
        category: 'discipline',
        description: 'You show good discipline in following your trading plan',
        strength: disciplinePatterns[0].frequency > 5 ? 'strong' : 'moderate',
        relatedEmotions: ['confidence', 'patience'],
        impactOnPerformance: disciplinePatterns[0].avgOutcome >= 0 ? 'positive' : 'mixed',
        suggestions: [
          'Continue documenting your disciplined trades',
          'Share your disciplined approach with other traders',
          'Review your disciplined trades to reinforce the behavior'
        ]
      })
    }

    // Analyze revenge trading
    const revengePatterns = emotionalPatterns.filter(p => p.emotion === 'revenge')
    if (revengePatterns.length > 0) {
      insights.push({
        category: 'revenge',
        description: 'Evidence of revenge trading - trying to make up for losses',
        strength: revengePatterns[0].frequency > 2 ? 'strong' : 'moderate',
        relatedEmotions: ['frustration', 'regret'],
        impactOnPerformance: 'negative',
        suggestions: [
          'Implement a mandatory cooling-off period after losses',
          'Set daily loss limits and stop trading when hit',
          'Remember: each trade is independent, don\'t try to "get it back"',
          'Focus on process, not recovering losses'
        ]
      })
    }

    // Analyze confidence
    const confidencePatterns = emotionalPatterns.filter(p => p.emotion === 'confidence')
    if (confidencePatterns.length > 0) {
      const avgOutcome = confidencePatterns[0].avgOutcome
      insights.push({
        category: 'confidence',
        description: avgOutcome > 0
          ? 'Your confidence correlates with positive outcomes'
          : 'Confidence may be leading to overtrading or excessive risk',
        strength: 'moderate',
        relatedEmotions: ['euphoria', 'calm'],
        impactOnPerformance: avgOutcome > 0 ? 'positive' : 'negative',
        suggestions: avgOutcome > 0 ? [
          'Maintain confidence through thorough preparation',
          'Document what creates confident feelings for replication'
        ] : [
          'Check if confidence is leading to rule-breaking',
          'Scale back when feeling overly confident',
          'Review losing trades that felt confident - what was missed?'
        ]
      })
    }

    // Analyze patience
    const patiencePatterns = emotionalPatterns.filter(p => p.emotion === 'patience')
    if (patiencePatterns.length > 0 && patiencePatterns[0].frequency > 2) {
      insights.push({
        category: 'patience',
        description: 'You demonstrate patience in waiting for setups',
        strength: patiencePatterns[0].frequency > 5 ? 'strong' : 'moderate',
        relatedEmotions: ['discipline', 'confidence'],
        impactOnPerformance: patiencePatterns[0].avgOutcome >= 0 ? 'positive' : 'mixed',
        suggestions: [
          'Continue prioritizing quality over quantity',
          'Document examples where patience paid off',
          'Share your patient approach with other traders for accountability'
        ]
      })
    }

    // Analyze hesitation
    const hesitationPatterns = emotionalPatterns.filter(p => p.emotion === 'hesitation')
    if (hesitationPatterns.length > 0 && hesitationPatterns[0].avgOutcome < 0) {
      insights.push({
        category: 'fear',
        description: 'Hesitation may be causing you to miss valid opportunities or exit too early',
        strength: 'moderate',
        relatedEmotions: ['doubt', 'uncertainty'],
        impactOnPerformance: 'negative',
        suggestions: [
          'Create a trading plan with clear entry/exit rules',
          'Practice pulling the trigger on valid setups',
          'Start smaller to reduce the pressure of perfection',
          'Review hesitated trades - would following the plan have been better?'
        ]
      })
    }

    return insights
  }

  /**
   * Identify recurring themes in journal entries
   */
  private identifyRecurringThemes(entries: JournalEntry[]): string[] {
    const themes: string[] = []
    const themeKeywords: Record<string, string[]> = {
      'setup quality': ['good setup', 'bad setup', 'perfect setup', 'weak setup', 'strong setup'],
      'rule following': ['followed rules', 'broke rules', 'stuck to plan', 'deviated', 'followed plan'],
      'emotional control': ['emotional', 'calm', 'fearful', 'anxious', 'confident', 'nervous'],
      'patience': ['wait', 'patient', 'rushed', 'impulsive', 'held back'],
      'market reading': ['read the market', 'misread', 'correct read', 'wrong about direction'],
      'risk management': ['risk', 'position size', 'too big', 'too small', 'managed risk'],
      'learning': ['learned', 'lesson', 'realized', 'understand now', 'figured out']
    }

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      const matchCount = entries.filter(entry =>
        keywords.some(keyword => entry.content.toLowerCase().includes(keyword))
      ).length

      if (matchCount >= 2) {
        themes.push(theme)
      }
    }

    return themes
  }

  /**
   * Assess trader's mindset
   */
  private assessMindset(
    entries: JournalEntry[],
    emotionalPatterns: EmotionalPattern[],
    trades: any[]
  ): MindsetAssessment {
    // Calculate emotional regulation (0-10)
    const negativeEmotions = emotionalPatterns.filter(p => p.impact === 'negative')
    const positiveEmotions = emotionalPatterns.filter(p => p.impact === 'positive')

    const emotionalRegulation = negativeEmotions.length === 0
      ? 10
      : Math.max(0, 10 - (negativeEmotions.length * 2))

    // Calculate decision quality (0-10)
    const profitableEntries = entries.filter(e => e.outcome && e.outcome > 0).length
    const totalEntries = entries.filter(e => e.outcome !== undefined).length
    const decisionQuality = totalEntries > 0
      ? (profitableEntries / totalEntries) * 10
      : 5

    // Calculate consistency (0-10)
    const hasTheme = entries.some(e => e.content.length > 50)
    const regularEntries = entries.length >= 10
    const consistency = (hasTheme ? 4 : 0) + (regularEntries ? 4 : 0) + 2

    // Determine strengths
    const strengths: string[] = []
    if (emotionalRegulation >= 7) strengths.push('Good emotional control')
    if (decisionQuality >= 7) strengths.push('Strong decision making')
    if (consistency >= 7) strengths.push('Consistent journaling')
    if (emotionalPatterns.some(p => p.emotion === 'discipline' && p.frequency > 2)) {
      strengths.push('Follows trading plan')
    }

    // Determine areas for growth
    const areasForGrowth: string[] = []
    if (emotionalRegulation < 5) areasForGrowth.push('Improve emotional regulation')
    if (decisionQuality < 5) areasForGrowth.push('Work on decision quality')
    if (consistency < 5) areasForGrowth.push('Be more consistent with journaling')
    if (negativeEmotions.some(p => p.emotion === 'revenge')) {
      areasForGrowth.push('Address revenge trading tendencies')
    }

    // Determine overall state
    let overallState: MindsetAssessment['overallState']
    const avgScore = (emotionalRegulation + decisionQuality + consistency) / 3

    if (avgScore >= 8) overallState = 'growth'
    else if (avgScore >= 6) overallState = 'stable'
    else if (avgScore >= 4) overallState = 'struggling'
    else overallState = 'critical'

    return {
      overallState,
      strengths,
      areasForGrowth,
      emotionalRegulation: Math.round(emotionalRegulation),
      decisionQuality: Math.round(decisionQuality),
      consistency: Math.round(consistency)
    }
  }

  /**
   * Assess journal quality
   */
  private assessJournalQuality(entries: JournalEntry[]): 'excellent' | 'good' | 'fair' | 'poor' {
    if (entries.length === 0) return 'poor'

    // Check for detailed entries
    const detailedEntries = entries.filter(e => e.content.length > 100).length
    const detailedRatio = detailedEntries / entries.length

    // Check for emotional content
    const emotionalEntries = entries.filter(e => e.emotions.length > 0).length
    const emotionalRatio = emotionalEntries / entries.length

    // Check for consistency
    const isConsistent = entries.length >= 10

    // Calculate quality score
    let score = 0
    score += isConsistent ? 3 : 0
    score += detailedRatio >= 0.5 ? 3 : detailedRatio >= 0.25 ? 2 : detailedRatio >= 0.1 ? 1 : 0
    score += emotionalRatio >= 0.5 ? 4 : emotionalRatio >= 0.25 ? 2 : emotionalRatio >= 0.1 ? 1 : 0

    if (score >= 8) return 'excellent'
    if (score >= 6) return 'good'
    if (score >= 4) return 'fair'
    return 'poor'
  }

  /**
   * Generate journal recommendations
   */
  private generateJournalRecommendations(
    entries: JournalEntry[],
    emotionalPatterns: EmotionalPattern[],
    insights: PsychologicalInsight[],
    mindset: MindsetAssessment,
    quality: string
  ): string[] {
    const recommendations: string[] = []

    // Quality-based recommendations
    if (quality === 'poor') {
      recommendations.push('Start journaling every trade with detailed notes')
      recommendations.push('Include your thoughts, emotions, and reasoning for each trade')
    } else if (quality === 'fair') {
      recommendations.push('Add more detail to your journal entries')
      recommendations.push('Include what you were thinking and feeling during trades')
    } else if (quality === 'good') {
      recommendations.push('Great journaling! Consider adding pre-trade planning notes')
    } else {
      recommendations.push('Excellent journaling practice! Consider reviewing weekly for patterns')
    }

    // Mindset-based recommendations
    if (mindset.emotionalRegulation < 5) {
      recommendations.push('Practice emotional awareness techniques before trading')
      recommendations.push('Consider meditation or breathing exercises')
    }

    // Insight-based recommendations
    for (const insight of insights) {
      if (insight.suggestions.length > 0) {
        recommendations.push(...insight.suggestions.slice(0, 2))
      }
    }

    return recommendations
  }

  /**
   * Get empty mindset assessment
   */
  private getEmptyMindsetAssessment(): MindsetAssessment {
    return {
      overallState: 'critical',
      strengths: [],
      areasForGrowth: ['Start journaling to build self-awareness'],
      emotionalRegulation: 0,
      decisionQuality: 0,
      consistency: 0
    }
  }
}

/**
 * Create Journal Insight Agent instance
 */
export function createJournalInsightAgent(): JournalInsightAgent {
  return new JournalInsightAgent()
}
