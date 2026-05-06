/**
 * Renata Agent - Main Conversational & Orchestration Agent
 *
 * Renata is the primary AI assistant that users interact with in Traderra.
 * She handles general conversations, answers trading questions, and orchestrates
 * specialized agents when needed.
 *
 * Responsibilities:
 * - General conversational AI about trading
 * - Answer questions about user's trading performance
 * - Explain metrics and statistics in simple terms
 * - Provide trading guidance and education
 * - Orchestrate specialized agents for complex requests
 * - Maintain friendly, empathetic personality
 * - Adapt response style based on user's current mode
 *
 * @module RenataAgent
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult, AgentContext } from '../core/base-agent'
import { getMessageBus } from '../../communication/message-bus'

export interface RenataResponse {
  message: string
  mode: 'renata' | 'analyst' | 'coach' | 'mentor'
  requiresSpecializedAgents?: boolean
  suggestedAgents?: string[]
  metadata?: {
    tone: 'friendly' | 'professional' | 'encouraging' | 'empathetic'
    contextUsed: string[]
    followUpQuestions?: string[]
  }
}

export interface ConversationState {
  userId: string
  messageCount: number
  lastTopic: string
  userMood: 'positive' | 'neutral' | 'negative' | 'frustrated'
  recentThemes: string[]
}

/**
 * Renata Agent Class
 *
 * The main AI assistant that users interact with.
 * Combines conversational AI with specialized agent orchestration.
 */
export class RenataAgent extends BaseAgent {
  private conversationStates: Map<string, ConversationState> = new Map()
  private personalityProfiles: Map<string, any> = new Map()

  constructor(config?: Partial<AgentConfig>) {
    const defaultConfig: AgentConfig = {
      id: 'renata',
      name: 'Renata',
      version: '2.0.0',
      description: 'Main AI assistant for Traderra trading journal',
      capabilities: {
        canAnalyze: true,
        canExecute: true,
        canLearn: true,
        canRecommend: true,
        requiresContext: ['trades', 'metrics', 'journal', 'userPreferences']
      },
      maxConcurrentTasks: 20,
      timeoutMs: 15000
    }

    super({ ...defaultConfig, ...config })

    // Subscribe to message bus for inter-agent communication
    this.setupMessageSubscriptions()
  }

  /**
   * Renata can handle any conversational or orchestration task
   */
  canHandle(taskType: string): boolean {
    return true // Renata is the generalist - handles everything
  }

  /**
   * Process user message and generate response
   */
  async processUserMessage(
    message: string,
    context: AgentContext,
    mode: 'renata' | 'analyst' | 'coach' | 'mentor' = 'renata'
  ): Promise<RenataResponse> {
    console.log(`[Renata] Processing message in ${mode} mode:`, message.substring(0, 100))

    try {
      // Update conversation state
      const conversationState = this.getOrUpdateConversationState(context.userId, message)

      // Analyze message content and intent
      const analysis = this.analyzeMessage(message, context, conversationState)

      // Check if specialized agents are needed
      if (analysis.requiresSpecializedAgents) {
        return await this.orchestrateSpecializedAgents(message, context, mode, analysis)
      }

      // Generate response based on mode
      const response = await this.generateModeResponse(message, context, mode, analysis)

      return response
    } catch (error) {
      console.error('[Renata] Error processing message:', error)

      return {
        message: this.getFallbackResponse(),
        mode,
        metadata: {
          tone: 'friendly',
          contextUsed: []
        }
      }
    }
  }

  /**
   * Analyze message to determine intent and whether specialized agents are needed
   */
  private analyzeMessage(
    message: string,
    context: AgentContext,
    conversationState: ConversationState
  ): {
    intent: string
    requiresSpecializedAgents: boolean
    suggestedAgents: string[]
    topics: string[]
    sentiment: 'positive' | 'neutral' | 'negative'
  } {
    const lowerMessage = message.toLowerCase()

    // Deep analysis requests
    const deepAnalysisKeywords = [
      'deep dive', 'analyze pattern', 'performance breakdown',
      'risk analysis', 'journal insights', 'psychology',
      'what are my patterns', 'explain my losses'
    ]

    const requiresDeepAnalysis = deepAnalysisKeywords.some(kw => lowerMessage.includes(kw))

    // Statistical/analytical queries
    const analyticalKeywords = [
      'statistics', 'analyze', 'breakdown', 'performance metrics',
      'win rate by', 'expectancy', 'sharpe ratio'
    ]

    const requiresAnalytics = analyticalKeywords.some(kw => lowerMessage.includes(kw))

    // Coaching requests
    const coachingKeywords = [
      'improve', 'feedback', 'how can i get better',
      'what should i work on', 'help me improve'
    ]

    const requiresCoaching = coachingKeywords.some(kw => lowerMessage.includes(kw))

    // Risk-specific queries
    const riskKeywords = [
      'risk', 'position sizing', 'money management',
      'drawdown', 'portfolio risk'
    ]

    const requiresRiskAnalysis = riskKeywords.some(kw => lowerMessage.includes(kw))

    // Journal/psychology queries
    const journalKeywords = [
      'journal', 'emotional', 'psychology', 'mindset',
      'feelings', 'mental game'
    ]

    const requiresJournalAnalysis = journalKeywords.some(kw => lowerMessage.includes(kw))

    // Determine suggested agents
    const suggestedAgents: string[] = []

    if (requiresDeepAnalysis || requiresAnalytics) {
      suggestedAgents.push('TradingPatternAgent')
    }

    if (requiresCoaching) {
      suggestedAgents.push('PerformanceCoachAgent')
    }

    if (requiresRiskAnalysis) {
      suggestedAgents.push('RiskManagementAgent')
    }

    if (requiresJournalAnalysis) {
      suggestedAgents.push('JournalInsightAgent')
    }

    // Extract topics
    const topics = this.extractTopics(message)

    // Analyze sentiment
    const sentiment = this.analyzeSentiment(message, conversationState)

    // Determine primary intent
    let intent = 'general_conversation'

    if (suggestedAgents.length > 0) {
      intent = 'specialized_analysis'
    } else if (lowerMessage.includes('how') || lowerMessage.includes('why') || lowerMessage.includes('explain')) {
      intent = 'educational'
    } else if (lowerMessage.includes('show') || lowerMessage.includes('what') || lowerMessage.includes('tell me')) {
      intent = 'informational'
    }

    return {
      intent,
      requiresSpecializedAgents: suggestedAgents.length > 0 && requiresDeepAnalysis,
      suggestedAgents,
      topics,
      sentiment
    }
  }

  /**
   * Extract topics from message
   */
  private extractTopics(message: string): string[] {
    const topics: string[] = []
    const lowerMessage = message.toLowerCase()

    const topicKeywords = {
      'entries': ['entry', 'getting in', 'setup', 'trade setup'],
      'exits': ['exit', 'getting out', 'selling', 'covering'],
      'winning': ['winning', 'winner', 'profitable', 'green'],
      'losing': ['losing', 'loser', 'loss', 'red', 'bad trade'],
      'risk': ['risk', 'position size', 'sizing'],
      'psychology': ['emotional', 'feel', 'mindset', 'psychology', 'mental'],
      'metrics': ['win rate', 'expectancy', 'sharpe', 'performance'],
      'patterns': ['pattern', 'tendency', 'habit', 'consistency']
    }

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        topics.push(topic)
      }
    }

    return topics
  }

  /**
   * Analyze sentiment of message
   */
  private analyzeSentiment(message: string, conversationState: ConversationState): 'positive' | 'neutral' | 'negative' {
    const lowerMessage = message.toLowerCase()

    const positiveWords = ['good', 'great', 'awesome', 'happy', 'excited', 'winning', 'profitable']
    const negativeWords = ['bad', 'terrible', 'frustrated', 'angry', 'losing', 'hate', 'struggling']

    const positiveCount = positiveWords.filter(w => lowerMessage.includes(w)).length
    const negativeCount = negativeWords.filter(w => lowerMessage.includes(w)).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  /**
   * Orchestrate specialized agents for complex requests
   */
  private async orchestrateSpecializedAgents(
    message: string,
    context: AgentContext,
    mode: string,
    analysis: any
  ): Promise<RenataResponse> {
    console.log('[Renata] Orchestrating specialized agents:', analysis.suggestedAgents)

    // Send request to orchestrator which will coordinate specialized agents
    const messageBus = getMessageBus()

    await messageBus.publish('orchestrator.requests', {
      id: `req-${Date.now()}`,
      from: 'renata',
      to: 'orchestrator',
      type: 'request',
      content: {
        message,
        context,
        requiredAgents: analysis.suggestedAgents,
        taskType: 'multi_agent_analysis'
      },
      timestamp: Date.now()
    })

    // For now, return a placeholder response
    // In production, this would wait for orchestrator response
    return {
      message: `I'm analyzing that across multiple dimensions. This will involve ${analysis.suggestedAgents.join(', ')}. One moment while I gather comprehensive insights for you.`,
      mode: mode as any,
      requiresSpecializedAgents: true,
      suggestedAgents: analysis.suggestedAgents,
      metadata: {
        tone: 'professional',
        contextUsed: ['trades', 'metrics', 'journal'],
        followUpQuestions: [
          'Would you like me to dive deeper into any specific aspect?',
          'What patterns are you most curious about?'
        ]
      }
    }
  }

  /**
   * Generate response based on current mode
   */
  private async generateModeResponse(
    message: string,
    context: AgentContext,
    mode: string,
    analysis: any
  ): Promise<RenataResponse> {
    switch (mode) {
      case 'analyst':
        return this.generateAnalystResponse(message, context, analysis)

      case 'coach':
        return this.generateCoachResponse(message, context, analysis)

      case 'mentor':
        return this.generateMentorResponse(message, context, analysis)

      case 'renata':
      default:
        return this.generateRenataResponse(message, context, analysis)
    }
  }

  /**
   * Generate Renata mode response (conversational, friendly)
   */
  private generateRenataResponse(
    message: string,
    context: AgentContext,
    analysis: any
  ): RenataResponse {
    const lowerMessage = message.toLowerCase()

    // Handle greetings
    if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon)/)) {
      return {
        message: `Hi there! I'm Renata, your AI trading assistant. I'm here to help you understand your trading better, whether that's analyzing patterns, discussing performance, or just chatting about your trading journey. What's on your mind today?`,
        mode: 'renata',
        metadata: {
          tone: 'friendly',
          contextUsed: []
        }
      }
    }

    // Handle emotional/conversational messages
    if (analysis.sentiment === 'negative' || lowerMessage.includes('frustrated')) {
      return {
        message: `I hear you, and trading can definitely be frustrating sometimes. Would you like to talk about what's been challenging? Sometimes just getting it out helps, or I can look for patterns that might explain what's happening.`,
        mode: 'renata',
        metadata: {
          tone: 'empathetic',
          contextUsed: ['trades'],
          followUpQuestions: [
            'What specific aspect feels most challenging right now?',
            'Would you like me to analyze your recent trades for patterns?'
          ]
        }
      }
    }

    if (analysis.sentiment === 'positive' || lowerMessage.includes('great') || lowerMessage.includes('awesome')) {
      return {
        message: `That's wonderful! It sounds like things are going well. I love hearing about positive trading experiences. What's working especially well for you lately?`,
        mode: 'renata',
        metadata: {
          tone: 'encouraging',
          contextUsed: [],
          followUpQuestions: [
            'Would you like me to help you identify what\'s driving this success?',
            'Should we look at how to maintain this momentum?'
          ]
        }
      }
    }

    // Handle general questions
    if (lowerMessage.includes('how are you')) {
      return {
        message: `I'm doing great, thanks for asking! I'm excited to help you with your trading today. What would you like to explore or work on?`,
        mode: 'renata',
        metadata: {
          tone: 'friendly',
          contextUsed: []
        }
      }
    }

    // Handle general trading questions
    if (lowerMessage.includes('help') || lowerMessage.includes('can you')) {
      return {
        message: `Absolutely! I'd be happy to help. I can assist with:\n\n• Analyzing your trading patterns and performance\n• Discussing risk management strategies\n• Reviewing your journal entries for insights\n• Providing coaching on your trading\n• Answering questions about your metrics\n\nWhat would be most helpful for you right now?`,
        mode: 'renata',
        metadata: {
          tone: 'friendly',
          contextUsed: []
        }
      }
    }

    // Default conversational response with context awareness
    const hasTrades = context.trades && context.trades.length > 0
    const hasMetrics = context.metrics && Object.keys(context.metrics).length > 0

    if (hasTrades && hasMetrics) {
      return {
        message: `I'd be happy to help with that! I can see your trading data and metrics. Is there something specific you'd like me to analyze or explain? I can look at patterns, performance, risk, or whatever would be most useful for you.`,
        mode: 'renata',
        metadata: {
          tone: 'friendly',
          contextUsed: ['trades', 'metrics']
        }
      }
    }

    return {
      message: `I'm here to help with your trading journey! Whether you want to analyze your performance, discuss strategies, or just chat about trading, I'm ready. What would you like to explore?`,
      mode: 'renata',
      metadata: {
        tone: 'friendly',
        contextUsed: []
      }
    }
  }

  /**
   * Generate Analyst mode response (data-driven, statistical)
   */
  private generateAnalystResponse(
    message: string,
    context: AgentContext,
    analysis: any
  ): RenataResponse {
    const metrics = context.metrics || {}

    return {
      message: `Looking at your data:\n\n• Total P&L: ${this.formatMetric(metrics.totalPnL)}\n• Win Rate: ${this.formatMetric(metrics.winRate)}\n• Expectancy: ${this.formatMetric(metrics.expectancy)}\n• Profit Factor: ${this.formatMetric(metrics.profitFactor)}\n\nWould you like me to dive deeper into any of these metrics or analyze specific aspects of your performance?`,
      mode: 'analyst',
      metadata: {
        tone: 'professional',
        contextUsed: ['metrics'],
        followUpQuestions: [
          'Should I break this down by timeframe or market conditions?',
          'Would you like to see performance by trade type?'
        ]
      }
    }
  }

  /**
   * Generate Coach mode response (constructive, improvement-focused)
   */
  private generateCoachResponse(
    message: string,
    context: AgentContext,
    analysis: any
  ): RenataResponse {
    return {
      message: `I'd love to help you improve! Let me look at what the data shows about your trading patterns and where there might be opportunities for growth.\n\nFrom what I can see, focusing on your process and consistency will be key. What specific areas of your trading are you looking to improve?`,
      mode: 'coach',
      metadata: {
        tone: 'encouraging',
        contextUsed: ['trades', 'metrics'],
        followUpQuestions: [
          'Are you more interested in improving your entries, exits, or overall trade management?',
          'Would you like me to analyze your best and worst trades to find patterns?'
        ]
      }
    }
  }

  /**
   * Generate Mentor mode response (wisdom, long-term perspective)
   */
  private generateMentorResponse(
    message: string,
    context: AgentContext,
    analysis: any
  ): RenataResponse {
    return {
      message: `Great question. Trading is a journey of continuous learning and growth. The most successful traders I've studied focus not just on outcomes, but on process improvement and emotional discipline.\n\nWhat aspect of your trading journey would you like guidance on? I'm here to share insights and help you develop as a trader.`,
      mode: 'mentor',
      metadata: {
        tone: 'professional',
        contextUsed: [],
        followUpQuestions: [
          'Are you looking to build a specific skill or work through a challenge?',
          'Would you like to discuss long-term trading goals and strategies?'
        ]
      }
    }
  }

  /**
   * Format metric for display
   */
  private formatMetric(value: any): string {
    if (typeof value === 'number') {
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`
      } else if (value >= 1) {
        return value.toFixed(2)
      } else {
        return `${(value * 100).toFixed(1)}%`
      }
    }
    return String(value)
  }

  /**
   * Get or update conversation state for user
   */
  private getOrUpdateConversationState(userId: string, message: string): ConversationState {
    if (!this.conversationStates.has(userId)) {
      this.conversationStates.set(userId, {
        userId,
        messageCount: 0,
        lastTopic: '',
        userMood: 'neutral',
        recentThemes: []
      })
    }

    const state = this.conversationStates.get(userId)!
    state.messageCount++

    return state
  }

  /**
   * Setup message subscriptions
   */
  private setupMessageSubscriptions(): void {
    const messageBus = getMessageBus()

    // Subscribe to specialized agent responses
    messageBus.subscribe('renata', 'agent.responses', async (message) => {
      console.log('[Renata] Received agent response:', message.from)
      // Handle responses from specialized agents
    })
  }

  /**
   * Get fallback response
   */
  private getFallbackResponse(): string {
    return "I'm having trouble processing that right now. Could you try rephrasing, or let me know what specific aspect of your trading you'd like to discuss?"
  }

  /**
   * Perform task (implemented for BaseAgent interface)
   */
  protected async performTask(task: AgentTask): Promise<any> {
    const { message, context, mode } = task.input

    return await this.processUserMessage(
      message,
      context,
      mode || 'renata'
    )
  }
}

/**
 * Create Renata agent instance
 */
export function createRenataAgent(): RenataAgent {
  const config: Partial<AgentConfig> = {
    id: 'renata',
    name: 'Renata',
    version: '2.0.0'
  }

  return new RenataAgent(config)
}

/**
 * Get Renata agent instance from registry
 */
export function getRenataAgent(): RenataAgent | undefined {
  // This will be implemented when we wire up the agent registry
  return undefined // Will return actual agent after registration
}
