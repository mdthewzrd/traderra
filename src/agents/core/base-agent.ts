/**
 * Base Agent Class
 *
 * Foundation for all specialized trading agents in Traderra.
 * Provides common functionality for agent lifecycle, messaging,
 * and interaction with the orchestrator.
 *
 * @module BaseAgent
 */

import { getArchonClient } from '@/lib/archon/archon-client'

export interface AgentMessage {
  id: string
  from: string
  to: string
  type: 'request' | 'response' | 'notification' | 'error'
  content: any
  timestamp: number
  correlationId?: string
}

export interface AgentCapabilities {
  canAnalyze: boolean
  canExecute: boolean
  canLearn: boolean
  canRecommend: boolean
  requiresContext: string[]
}

export interface AgentConfig {
  id: string
  name: string
  version: string
  description: string
  capabilities: AgentCapabilities
  maxConcurrentTasks: number
  timeoutMs: number
}

export interface AgentContext {
  userId: string
  currentPage: string
  currentDateRange: string
  displayMode: string
  trades: any[]
  metrics?: Record<string, any>
  journal?: any[]
  customData?: Record<string, any>
}

export interface AgentTask {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  input: any
  output?: any
  error?: Error
  startedAt?: number
  completedAt?: number
  timeoutAt?: number
  assignedTo: string
  dependencies?: string[]
}

export interface AgentResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  metadata?: Record<string, any>
  executionTime?: number
}

/**
 * Base Agent Class
 *
 * All specialized agents extend this class to inherit:
 * - Agent identification and configuration
 * - Task processing and execution
 * - Inter-agent messaging
 * - Context awareness
 * - Error handling and recovery
 * - Archon knowledge graph integration
 */
export abstract class BaseAgent {
  protected config: AgentConfig
  protected activeTasks: Map<string, AgentTask> = new Map()
  protected messageHandlers: Map<string, (message: AgentMessage) => Promise<void>> = new Map()
  protected archonClient = getArchonClient()

  constructor(config: AgentConfig) {
    this.config = config
    this.initializeMessageHandlers()
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config }
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapabilities {
    return { ...this.config.capabilities }
  }

  /**
   * Check if agent can handle a specific task type
   */
  canHandle(taskType: string): boolean {
    // Override in subclasses for specific task handling
    return false
  }

  /**
   * Initialize message handlers
   * Override in subclasses to register specific message handlers
   */
  protected initializeMessageHandlers(): void {
    this.registerMessageHandler('ping', this.handlePing.bind(this))
    this.registerMessageHandler('status', this.handleStatus.bind(this))
    this.registerMessageHandler('shutdown', this.handleShutdown.bind(this))
  }

  /**
   * Register a message handler
   */
  protected registerMessageHandler(
    messageType: string,
    handler: (message: AgentMessage) => Promise<void>
  ): void {
    this.messageHandlers.set(messageType, handler)
  }

  /**
   * Process incoming message
   */
  async processMessage(message: AgentMessage): Promise<AgentMessage> {
    const handler = this.messageHandlers.get(message.type)

    if (!handler) {
      return {
        id: `msg-${Date.now()}`,
        from: this.config.id,
        to: message.from,
        type: 'error',
        content: {
          error: `Unknown message type: ${message.type}`,
          originalMessage: message
        },
        timestamp: Date.now(),
        correlationId: message.id
      }
    }

    try {
      await handler(message)
    } catch (error) {
      console.error(`[${this.config.name}] Error processing message:`, error)
    }

    return {
      id: `msg-${Date.now()}`,
      from: this.config.id,
      to: message.from,
      type: 'response',
      content: { acknowledged: true },
      timestamp: Date.now(),
      correlationId: message.id
    }
  }

  /**
   * Handle ping message
   */
  protected async handlePing(message: AgentMessage): Promise<void> {
    console.log(`[${this.config.name}] Ping received from ${message.from}`)
  }

  /**
   * Handle status request
   */
  protected async handleStatus(message: AgentMessage): Promise<void> {
    const status = {
      agent: this.config.id,
      name: this.config.name,
      version: this.config.version,
      activeTasks: this.activeTasks.size,
      uptime: process.uptime?.() || 0,
      memory: process.memoryUsage?.() || {}
    }

    // Would send response back to orchestrator
    console.log(`[${this.config.name}] Status:`, status)
  }

  /**
   * Handle shutdown request
   */
  protected async handleShutdown(message: AgentMessage): Promise<void> {
    console.log(`[${this.config.name}] Shutdown requested, completing active tasks...`)

    // Complete all active tasks before shutting down
    const promises = Array.from(this.activeTasks.values()).map(task =>
      this.cancelTask(task.id)
    )

    await Promise.allSettled(promises)
  }

  /**
   * Execute a task
   */
  async executeTask(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now()

    // Check if agent can handle this task type
    if (!this.canHandle(task.type)) {
      return {
        success: false,
        error: new Error(`Agent ${this.config.name} cannot handle task type: ${task.type}`)
      }
    }

    // Check capacity
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return {
        success: false,
        error: new Error(`Agent ${this.config.name} is at maximum capacity`)
      }
    }

    // Add to active tasks
    task.status = 'in_progress'
    task.startedAt = startTime
    task.timeoutAt = startTime + this.config.timeoutMs
    this.activeTasks.set(task.id, task)

    try {
      // Execute task (implemented by subclass)
      const result = await this.performTask(task)

      // Mark as completed
      task.status = 'completed'
      task.completedAt = Date.now()
      task.output = result

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      // Mark as failed
      task.status = 'failed'
      task.completedAt = Date.now()
      task.error = error as Error

      return {
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime
      }
    } finally {
      // Remove from active tasks
      this.activeTasks.delete(task.id)
    }
  }

  /**
   * Perform the actual task (must be implemented by subclass)
   */
  protected abstract performTask(task: AgentTask): Promise<any>

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<AgentResult> {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      return {
        success: false,
        error: new Error(`Task ${taskId} not found`)
      }
    }

    task.status = 'failed'
    task.error = new Error('Task cancelled')
    task.completedAt = Date.now()

    this.activeTasks.delete(taskId)

    return {
      success: true,
      data: { taskId, cancelled: true }
    }
  }

  /**
   * Query Archon knowledge graph for relevant information
   */
  protected async queryKnowledgeGraph(
    query: string,
    options?: {
      limit?: number
      threshold?: number
      filters?: Record<string, any>
    }
  ): Promise<any[]> {
    try {
      const results = await this.archonClient.ragSearchKnowledgeBase(query, {
        limit: options?.limit || 10,
        threshold: options?.threshold || 0.6,
        filters: options?.filters
      })

      return results.map(r => r.content)
    } catch (error) {
      console.error(`[${this.config.name}] Knowledge graph query failed:`, error)
      return []
    }
  }

  /**
   * Query code examples from Archon
   */
  protected async queryCodeExamples(
    query: string,
    language?: string
  ): Promise<any[]> {
    try {
      const examples = await this.archonClient.ragSearchCodeExamples(query, language)

      return examples
    } catch (error) {
      console.error(`[${this.config.name}] Code examples query failed:`, error)
      return []
    }
  }

  /**
   * Update task status in Archon
   */
  protected async syncTaskStatus(task: AgentTask): Promise<void> {
    try {
      // Map agent task status to Archon task status
      const statusMap: Record<string, 'pending' | 'in_progress' | 'completed' | 'blocked'> = {
        pending: 'pending',
        in_progress: 'in_progress',
        completed: 'completed',
        failed: 'blocked'
      }

      const archonStatus = statusMap[task.status] || 'pending'
      await this.archonClient.updateTaskStatus(task.id, archonStatus)
    } catch (error) {
      console.error(`[${this.config.name}] Failed to sync task status:`, error)
    }
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size
  }

  /**
   * Check if agent is available for new tasks
   */
  isAvailable(): boolean {
    return this.activeTasks.size < this.config.maxConcurrentTasks
  }

  /**
   * Get agent health status
   */
  getHealthStatus(): {
    healthy: boolean
    activeTasks: number
    uptime: number
    lastError?: Error
  } {
    return {
      healthy: this.isAvailable(),
      activeTasks: this.activeTasks.size,
      uptime: process.uptime?.() || 0
    }
  }
}
