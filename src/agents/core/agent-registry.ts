/**
 * Agent Registry
 *
 * Central registry for all trading agents in Traderra.
 * Provides agent discovery, capability matching, and lifecycle management.
 *
 * @module AgentRegistry
 */

import { BaseAgent, AgentConfig, AgentTask, AgentResult } from './base-agent'

export interface AgentRegistration {
  agent: BaseAgent
  config: AgentConfig
  registeredAt: number
  lastHealthCheck: number
  healthStatus: 'healthy' | 'degraded' | 'unhealthy'
  taskSuccessRate: number
  totalTasksProcessed: number
  activeTasks: number
}

export interface AgentQuery {
  taskType?: string
  capability?: 'canAnalyze' | 'canExecute' | 'canLearn' | 'canRecommend' | 'requiresContext'
  minAvailability?: number
  healthStatus?: AgentRegistration['healthStatus']
}

/**
 * Agent Registry Class
 *
 * Responsibilities:
 * - Register and unregister agents
 * - Discover agents by capability or task type
 * - Match tasks to appropriate agents
 * - Monitor agent health
 * - Load balance across available agents
 * - Maintain agent lifecycle
 */
export class AgentRegistry {
  private static instance: AgentRegistry
  private agents: Map<string, AgentRegistration> = new Map()
  private taskAssignments: Map<string, string> = new Map() // taskId -> agentId
  private healthCheckInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.startHealthChecks()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry()
    }
    return AgentRegistry.instance
  }

  /**
   * Register an agent
   */
  register(agent: BaseAgent): void {
    const config = agent.getConfig()

    if (this.agents.has(config.id)) {
      throw new Error(`Agent ${config.id} is already registered`)
    }

    const registration: AgentRegistration = {
      agent,
      config,
      registeredAt: Date.now(),
      lastHealthCheck: Date.now(),
      healthStatus: 'healthy',
      taskSuccessRate: 1.0,
      totalTasksProcessed: 0,
      activeTasks: 0
    }

    this.agents.set(config.id, registration)
    console.log(`[AgentRegistry] Registered agent: ${config.name} (${config.id})`)
  }

  /**
   * Unregister an agent
   */
  async unregister(agentId: string): Promise<void> {
    const registration = this.agents.get(agentId)

    if (!registration) {
      throw new Error(`Agent ${agentId} is not registered`)
    }

    // Cancel all active tasks for this agent
    const activeTasks = Array.from(this.taskAssignments.entries())
      .filter(([_, agent]) => agent === agentId)
      .map(([taskId]) => taskId)

    await Promise.all(
      activeTasks.map(taskId => this.cancelTask(taskId))
    )

    this.agents.delete(agentId)
    console.log(`[AgentRegistry] Unregistered agent: ${agentId}`)
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId)?.agent
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values()).map(reg => reg.agent)
  }

  /**
   * Find agents matching query
   */
  findAgents(query: AgentQuery): BaseAgent[] {
    const results: BaseAgent[] = []

    for (const registration of this.agents.values()) {
      // Filter by health status
      if (query.healthStatus && registration.healthStatus !== query.healthStatus) {
        continue
      }

      // Filter by availability
      if (query.minAvailability !== undefined) {
        const availableCapacity = registration.config.maxConcurrentTasks -
          registration.agent.getActiveTaskCount()

        if (availableCapacity < query.minAvailability) {
          continue
        }
      }

      // Filter by capability
      if (query.capability) {
        const capabilities = registration.agent.getCapabilities()
        if (!capabilities[query.capability]) {
          continue
        }
      }

      // Filter by task type
      if (query.taskType && !registration.agent.canHandle(query.taskType)) {
        continue
      }

      results.push(registration.agent)
    }

    return results
  }

  /**
   * Find best agent for a task
   */
  findBestAgent(taskType: string): BaseAgent | undefined {
    const capableAgents = this.findAgents({ taskType, healthStatus: 'healthy' })

    if (capableAgents.length === 0) {
      return undefined
    }

    // Sort by availability and success rate
    const sorted = capableAgents.sort((a, b) => {
      const aReg = this.agents.get(a.getConfig().id)!
      const bReg = this.agents.get(b.getConfig().id)!

      // Prefer agents with higher success rate
      if (aReg.taskSuccessRate !== bReg.taskSuccessRate) {
        return bReg.taskSuccessRate - aReg.taskSuccessRate
      }

      // Then prefer agents with more availability
      const aAvailability = aReg.config.maxConcurrentTasks - a.getActiveTaskCount()
      const bAvailability = bReg.config.maxConcurrentTasks - b.getActiveTaskCount()

      return bAvailability - aAvailability
    })

    return sorted[0]
  }

  /**
   * Assign task to best available agent
   */
  async assignTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.findBestAgent(task.type)

    if (!agent) {
      return {
        success: false,
        error: new Error(`No available agent found for task type: ${task.type}`)
      }
    }

    const agentId = agent.getConfig().id
    this.taskAssignments.set(task.id, agentId)

    console.log(`[AgentRegistry] Assigned task ${task.id} to agent ${agentId}`)

    try {
      const result = await agent.executeTask(task)

      // Update agent statistics
      const registration = this.agents.get(agentId)!
      registration.totalTasksProcessed++

      if (result.success) {
        // Update success rate with exponential moving average
        registration.taskSuccessRate =
          (registration.taskSuccessRate * 0.9) + (1.0 * 0.1)
      } else {
        registration.taskSuccessRate =
          (registration.taskSuccessRate * 0.9) + (0.0 * 0.1)
      }

      return result
    } finally {
      this.taskAssignments.delete(task.id)
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<AgentResult> {
    const agentId = this.taskAssignments.get(taskId)

    if (!agentId) {
      return {
        success: false,
        error: new Error(`Task ${taskId} not found or already completed`)
      }
    }

    const agent = this.getAgent(agentId)

    if (!agent) {
      return {
        success: false,
        error: new Error(`Agent ${agentId} not found`)
      }
    }

    return await agent.cancelTask(taskId)
  }

  /**
   * Get agent statistics
   */
  getAgentStats(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalAgents: number
    healthyAgents: number
    degradedAgents: number
    unhealthyAgents: number
    totalTasksProcessed: number
    activeTasks: number
  } {
    const stats = {
      totalAgents: this.agents.size,
      healthyAgents: 0,
      degradedAgents: 0,
      unhealthyAgents: 0,
      totalTasksProcessed: 0,
      activeTasks: 0
    }

    for (const reg of this.agents.values()) {
      switch (reg.healthStatus) {
        case 'healthy':
          stats.healthyAgents++
          break
        case 'degraded':
          stats.degradedAgents++
          break
        case 'unhealthy':
          stats.unhealthyAgents++
          break
      }

      stats.totalTasksProcessed += reg.totalTasksProcessed
      stats.activeTasks += reg.agent.getActiveTaskCount()
    }

    return stats
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, 30000) // Every 30 seconds
  }

  /**
   * Perform health checks on all agents
   */
  private performHealthChecks(): void {
    const now = Date.now()

    for (const [agentId, registration] of this.agents.entries()) {
      try {
        const health = registration.agent.getHealthStatus()

        registration.lastHealthCheck = now

        // Update health status based on availability
        if (health.healthy && registration.activeTasks < registration.config.maxConcurrentTasks) {
          registration.healthStatus = 'healthy'
        } else if (health.healthy) {
          registration.healthStatus = 'degraded'
        } else {
          registration.healthStatus = 'unhealthy'
        }
      } catch (error) {
        console.error(`[AgentRegistry] Health check failed for ${agentId}:`, error)
        registration.healthStatus = 'unhealthy'
      }
    }
  }

  /**
   * Shutdown registry and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    // Shutdown all agents
    const shutdownPromises = Array.from(this.agents.values()).map(reg =>
      reg.agent.cancelTask('all') // Cancel all tasks
    )

    await Promise.allSettled(shutdownPromises)
    this.agents.clear()
    this.taskAssignments.clear()

    console.log('[AgentRegistry] Shutdown complete')
  }
}

/**
 * Get agent registry instance
 */
export function getAgentRegistry(): AgentRegistry {
  return AgentRegistry.getInstance()
}

/**
 * Register an agent with the registry
 */
export function registerAgent(agent: BaseAgent): void {
  getAgentRegistry().register(agent)
}

/**
 * Find best agent for a task
 */
export function findAgentForTask(taskType: string): BaseAgent | undefined {
  return getAgentRegistry().findBestAgent(taskType)
}

/**
 * Assign task to best available agent
 */
export async function assignTaskToAgent(task: AgentTask): Promise<AgentResult> {
  return getAgentRegistry().assignTask(task)
}
