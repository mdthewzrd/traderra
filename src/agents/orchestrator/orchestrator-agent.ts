/**
 * Orchestrator Agent
 *
 * Central coordination agent for all trading agents in Traderra.
 * Receives user requests and delegates to appropriate specialized agents.
 *
 * Responsibilities:
 * - Parse and classify user requests
 * - Route tasks to specialized agents
 * - Aggregate multi-agent responses
 * - Handle agent failures and fallbacks
 * - Maintain conversation context
 * - Provide unified response interface
 *
 * @module OrchestratorAgent
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult, AgentContext, AgentMessage } from '../core/base-agent'
import { getAgentRegistry, assignTaskToAgent } from '../core/agent-registry'

export interface OrchestratorConfig extends AgentConfig {
  maxParallelTasks: number
  fallbackTimeout: number
  retryAttempts: number
}

export interface ParsedRequest {
  intent: string
  entities: Record<string, any>
  taskType: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  requiresAgents: string[]
  context: AgentContext
}

export interface OrchestratorResult {
  success: boolean
  response: string
  data?: any
  agentsInvolved: string[]
  executionTime: number
  metadata?: Record<string, any>
}

/**
 * Orchestrator Agent Class
 *
 * Main entry point for all AI agent interactions in Traderra.
 * Coordinates between specialized agents to provide comprehensive responses.
 */
export class OrchestratorAgent extends BaseAgent {
  private conversationHistory: Map<string, AgentMessage[]> = new Map()
  private orchestratorConfig: OrchestratorConfig

  constructor(config: OrchestratorConfig) {
    super(config)
    this.orchestratorConfig = config
  }

  /**
   * Check if orchestrator can handle a task (always true - it's the coordinator)
   */
  canHandle(taskType: string): boolean {
    return true // Orchestrator can handle any task by delegating
  }

  /**
   * Process user message through orchestrator
   */
  async processUserMessage(
    message: string,
    context: AgentContext
  ): Promise<OrchestratorResult> {
    const startTime = Date.now()

    try {
      console.log('[Orchestrator] Processing user message:', message.substring(0, 100))

      // Step 1: Parse and classify the request
      const parsedRequest = await this.parseRequest(message, context)

      console.log('[Orchestrator] Parsed request:', {
        intent: parsedRequest.intent,
        taskType: parsedRequest.taskType,
        agents: parsedRequest.requiresAgents
      })

      // Step 2: Create tasks for required agents
      const tasks = this.createTasksForRequest(parsedRequest)

      // Step 3: Execute tasks (parallel or sequential based on dependencies)
      const results = await this.executeTasks(tasks)

      // Step 4: Aggregate results into unified response
      const response = await this.aggregateResults(results, parsedRequest)

      // Step 5: Update conversation history
      this.updateConversationHistory(context.userId, {
        role: 'user',
        content: message
      })

      this.updateConversationHistory(context.userId, {
        role: 'assistant',
        content: response.response
      })

      return {
        success: true,
        response: response.response,
        data: response.data,
        agentsInvolved: response.agentsInvolved,
        executionTime: Date.now() - startTime,
        metadata: {
          intent: parsedRequest.intent,
          taskType: parsedRequest.taskType
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Error processing message:', error)

      return {
        success: false,
        response: this.getFallbackResponse(error),
        agentsInvolved: [],
        executionTime: Date.now() - startTime
      }
    }
  }

  /**
   * Parse user request to determine intent and required agents
   */
  private async parseRequest(message: string, context: AgentContext): Promise<ParsedRequest> {
    const lowerMessage = message.toLowerCase()

    // Analyze intent based on keywords and context
    let intent = 'general'
    let taskType = 'general_query'
    const requiredAgents: string[] = []

    // Trading Pattern Analysis
    if (this.matchesAny(lowerMessage, [
      'pattern', 'setup', 'strategy', 'entry', 'exit',
      'winning trade', 'losing trade', 'trade setup'
    ])) {
      intent = 'pattern_analysis'
      taskType = 'analyze_trading_pattern'
      requiredAgents.push('TradingPatternAgent')
    }

    // Performance Coaching
    if (this.matchesAny(lowerMessage, [
      'improve', 'better', 'coaching', 'feedback', 'advice',
      'how can i', 'what should i', 'help me'
    ])) {
      intent = 'performance_coaching'
      taskType = 'provide_coaching'
      requiredAgents.push('PerformanceCoachAgent')
    }

    // Risk Management
    if (this.matchesAny(lowerMessage, [
      'risk', 'position size', 'drawdown', 'money management',
      'portfolio risk', 'risk per trade'
    ])) {
      intent = 'risk_management'
      taskType = 'analyze_risk'
      requiredAgents.push('RiskManagementAgent')
    }

    // Journal Insights
    if (this.matchesAny(lowerMessage, [
      'journal', 'note', 'emotional', 'psychology', 'mindset',
      'trading psychology', 'feelings'
    ])) {
      intent = 'journal_insight'
      taskType = 'analyze_journal'
      requiredAgents.push('JournalInsightAgent')
    }

    // Market Context
    if (this.matchesAny(lowerMessage, [
      'market', 'volatility', 'conditions', 'environment',
      'market state', 'regime'
    ])) {
      intent = 'market_context'
      taskType = 'analyze_market_context'
      requiredAgents.push('MarketContextAgent')
    }

    // Complex requests requiring multiple agents
    if (requiredAgents.length === 0) {
      // Default to general conversation with Renata
      intent = 'general'
      taskType = 'general_conversation'
    }

    // Determine priority
    let priority: ParsedRequest['priority'] = 'medium'
    if (lowerMessage.includes('urgent') || lowerMessage.includes('immediately')) {
      priority = 'urgent'
    } else if (lowerMessage.includes('important') || lowerMessage.includes('asap')) {
      priority = 'high'
    } else if (lowerMessage.includes('when you can') || lowerMessage.includes('no rush')) {
      priority = 'low'
    }

    return {
      intent,
      entities: {
        message,
        context,
        timestamp: Date.now()
      },
      taskType,
      priority,
      requiresAgents: requiredAgents.length > 0 ? requiredAgents : ['RenataAgent'],
      context
    }
  }

  /**
   * Check if message matches any keywords
   */
  private matchesAny(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword))
  }

  /**
   * Create tasks for required agents
   */
  private createTasksForRequest(request: ParsedRequest): AgentTask[] {
    const tasks: AgentTask[] = []

    for (const agentId of request.requiresAgents) {
      const task: AgentTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: request.taskType,
        priority: request.priority,
        status: 'pending',
        input: {
          intent: request.intent,
          entities: request.entities,
          context: request.context
        },
        assignedTo: agentId,
        dependencies: [] // Could add dependencies if tasks need to run sequentially
      }

      tasks.push(task)
    }

    return tasks
  }

  /**
   * Execute tasks (parallel or sequential based on dependencies)
   */
  private async executeTasks(tasks: AgentTask[]): Promise<AgentResult[]> {
    if (tasks.length === 0) {
      return []
    }

    // Check if tasks have dependencies
    const hasDependencies = tasks.some(task =>
      task.dependencies && task.dependencies.length > 0
    )

    if (hasDependencies) {
      // Execute sequentially based on dependencies
      const results: AgentResult[] = []

      for (const task of tasks) {
        const result = await this.executeTaskWithRetry(task)
        results.push(result)

        // If critical task failed, stop execution
        if (!result.success && task.priority === 'urgent') {
          console.error('[Orchestrator] Critical task failed, stopping execution')
          break
        }
      }

      return results
    } else {
      // Execute all tasks in parallel
      const promises = tasks.map(task => this.executeTaskWithRetry(task))
      return await Promise.all(promises)
    }
  }

  /**
   * Execute task with retry logic
   */
  private async executeTaskWithRetry(task: AgentTask): Promise<AgentResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.orchestratorConfig.retryAttempts; attempt++) {
      try {
        console.log(`[Orchestrator] Executing task ${task.id} (attempt ${attempt})`)

        const result = await assignTaskToAgent(task)

        if (result.success) {
          return result
        }

        lastError = result.error || new Error('Task failed')
      } catch (error) {
        lastError = error as Error
        console.error(`[Orchestrator] Task execution error (attempt ${attempt}):`, error)
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.orchestratorConfig.retryAttempts) {
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
        )
      }
    }

    return {
      success: false,
      error: lastError || new Error('Task failed after retries')
    }
  }

  /**
   * Aggregate results from multiple agents into unified response
   */
  private async aggregateResults(
    results: AgentResult[],
    request: ParsedRequest
  ): Promise<{
    response: string
    data?: any
    agentsInvolved: string[]
  }> {
    const successfulResults = results.filter(r => r.success)
    const agentsInvolved = successfulResults.map((r, i) =>
      request.requiresAgents[i] || 'unknown'
    )

    if (successfulResults.length === 0) {
      return {
        response: this.getFallbackResponse(new Error('All agents failed')),
        agentsInvolved: []
      }
    }

    // If only one agent, return its response directly
    if (successfulResults.length === 1) {
      return {
        response: successfulResults[0].data?.response || 'Processing complete.',
        data: successfulResults[0].data,
        agentsInvolved
      }
    }

    // Multiple agents - synthesize responses
    const synthesizedResponse = this.synthesizeMultiAgentResponse(successfulResults, request)

    return {
      response: synthesizedResponse,
      data: {
        agentResults: successfulResults.map(r => r.data)
      },
      agentsInvolved
    }
  }

  /**
   * Synthesize response from multiple agent results
   */
  private synthesizeMultiAgentResponse(
    results: AgentResult[],
    request: ParsedRequest
  ): string {
    // Combine insights from multiple agents
    const responses = results
      .map(r => r.data?.response || '')
      .filter(Boolean)
      .join('\n\n')

    return responses || 'Your request has been processed by multiple agents.'
  }

  /**
   * Update conversation history for a user
   */
  private updateConversationHistory(
    userId: string,
    message: { role: string; content: string }
  ): void {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, [])
    }

    const history = this.conversationHistory.get(userId)!
    history.push({
      id: `msg-${Date.now()}`,
      from: userId,
      to: this.config.id,
      type: 'request',
      content: message,
      timestamp: Date.now()
    })

    // Keep only last 50 messages
    if (history.length > 50) {
      history.splice(0, history.length - 50)
    }
  }

  /**
   * Get conversation history for a user
   */
  getConversationHistory(userId: string): AgentMessage[] {
    return this.conversationHistory.get(userId) || []
  }

  /**
   * Get fallback response when all agents fail
   */
  private getFallbackResponse(error: Error): string {
    return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment. If the issue persists, please contact support."
  }

  /**
   * Perform task (orchestrator delegates to specialized agents)
   */
  protected async performTask(task: AgentTask): Promise<any> {
    // This shouldn't be called directly on orchestrator
    // Use processUserMessage instead
    return {
      response: 'Orchestrator does not perform tasks directly. Use processUserMessage() instead.'
    }
  }
}

/**
 * Create and register orchestrator instance
 */
export function createOrchestrator(): OrchestratorAgent {
  const config: OrchestratorConfig = {
    id: 'orchestrator',
    name: 'Orchestrator Agent',
    version: '1.0.0',
    description: 'Central coordinator for all Traderra trading agents',
    capabilities: {
      canAnalyze: true,
      canExecute: true,
      canLearn: true,
      canRecommend: true,
      requiresContext: ['trades', 'metrics', 'journal', 'userPreferences']
    },
    maxConcurrentTasks: 10,
    timeoutMs: 30000,
    maxParallelTasks: 5,
    fallbackTimeout: 5000,
    retryAttempts: 3
  }

  const orchestrator = new OrchestratorAgent(config)
  getAgentRegistry().register(orchestrator)

  return orchestrator
}

/**
 * Get orchestrator instance
 */
export function getOrchestrator(): OrchestratorAgent | undefined {
  return getAgentRegistry().getAgent('orchestrator') as OrchestratorAgent
}
