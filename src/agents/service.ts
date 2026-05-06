/**
 * Multi-Agent System Initialization
 *
 * Initializes and registers all trading agents for Traderra.
 * This service should be called during app startup to ensure
 * all agents are ready before user interactions.
 *
 * @module agents/service
 */

import { getAgentRegistry } from './core/agent-registry'
import { OrchestratorAgent, createOrchestrator } from './orchestrator/orchestrator-agent'
import { RenataAgent, createRenataAgent } from './specialized/renata-agent'
import { TradingPatternAgent, createTradingPatternAgent } from './specialized/trading-pattern-agent'
import { PerformanceCoachAgent, createPerformanceCoachAgent } from './specialized/performance-coach-agent'
import { RiskManagementAgent, createRiskManagementAgent } from './specialized/risk-management-agent'
import { JournalInsightAgent, createJournalInsightAgent } from './specialized/journal-insight-agent'

export interface AgentSystemConfig {
  autoInitialize: boolean
  enableHealthChecks: boolean
  healthCheckInterval: number
  enableMetrics: boolean
}

export interface AgentSystemStatus {
  initialized: boolean
  ready: boolean
  agentsRegistered: number
  agentsHealthy: number
  orchestratorReady: boolean
  lastHealthCheck: number
}

/**
 * Agent System Service
 *
 * Manages the lifecycle of all trading agents in Traderra.
 */
class AgentSystemService {
  private static instance: AgentSystemService
  private initialized: boolean = false
  private config: AgentSystemConfig
  private healthCheckTimer: NodeJS.Timeout | null = null

  private constructor(config: Partial<AgentSystemConfig> = {}) {
    this.config = {
      autoInitialize: true,
      enableHealthChecks: true,
      healthCheckInterval: 60000, // 1 minute
      enableMetrics: true,
      ...config
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<AgentSystemConfig>): AgentSystemService {
    if (!AgentSystemService.instance) {
      AgentSystemService.instance = new AgentSystemService(config)
    }
    return AgentSystemService.instance
  }

  /**
   * Initialize the multi-agent system
   */
  async initialize(): Promise<AgentSystemStatus> {
    if (this.initialized) {
      return this.getStatus()
    }

    console.log('[AgentSystem] Initializing multi-agent system...')

    try {
      // Get the registry
      const registry = getAgentRegistry()

      // 1. Create and register Orchestrator
      console.log('[AgentSystem] Registering Orchestrator Agent...')
      const orchestrator = createOrchestrator()
      console.log('[AgentSystem] ✓ Orchestrator Agent registered')

      // 2. Create and register Renata Agent
      console.log('[AgentSystem] Registering Renata Agent...')
      const renata = createRenataAgent()
      registry.register(renata)
      console.log('[AgentSystem] ✓ Renata Agent registered')

      // 3. Create and register Trading Pattern Agent
      console.log('[AgentSystem] Registering Trading Pattern Agent...')
      const tradingPattern = createTradingPatternAgent()
      registry.register(tradingPattern)
      console.log('[AgentSystem] ✓ Trading Pattern Agent registered')

      // 4. Create and register Performance Coach Agent
      console.log('[AgentSystem] Registering Performance Coach Agent...')
      const performanceCoach = createPerformanceCoachAgent()
      registry.register(performanceCoach)
      console.log('[AgentSystem] ✓ Performance Coach Agent registered')

      // 5. Create and register Risk Management Agent
      console.log('[AgentSystem] Registering Risk Management Agent...')
      const riskManagement = createRiskManagementAgent()
      registry.register(riskManagement)
      console.log('[AgentSystem] ✓ Risk Management Agent registered')

      // 6. Create and register Journal Insight Agent
      console.log('[AgentSystem] Registering Journal Insight Agent...')
      const journalInsight = createJournalInsightAgent()
      registry.register(journalInsight)
      console.log('[AgentSystem] ✓ Journal Insight Agent registered')

      // Start health checks if enabled
      if (this.config.enableHealthChecks) {
        this.startHealthChecks()
      }

      this.initialized = true

      const status = this.getStatus()
      console.log('[AgentSystem] ✓ Multi-agent system initialized:', status)

      return status
    } catch (error) {
      console.error('[AgentSystem] ✗ Initialization failed:', error)
      throw error
    }
  }

  /**
   * Get current system status
   */
  getStatus(): AgentSystemStatus {
    const registry = getAgentRegistry()
    const stats = registry.getRegistryStats()

    return {
      initialized: this.initialized,
      ready: this.isReady(),
      agentsRegistered: stats.totalAgents,
      agentsHealthy: stats.healthyAgents,
      orchestratorReady: stats.totalAgents > 0,
      lastHealthCheck: Date.now()
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.config.healthCheckInterval)

    console.log('[AgentSystem] Health checks started (interval:', this.config.healthCheckInterval, 'ms)')
  }

  /**
   * Perform health check on all agents
   */
  private performHealthCheck(): void {
    try {
      const registry = getAgentRegistry()
      const stats = registry.getRegistryStats()

      console.log('[AgentSystem] Health check:', {
        total: stats.totalAgents,
        healthy: stats.healthyAgents,
        degraded: stats.degradedAgents,
        unhealthy: stats.unhealthyAgents
      })

      // Alert if any agents are unhealthy
      if (stats.unhealthyAgents > 0) {
        console.warn(`[AgentSystem] ⚠️ ${stats.unhealthyAgents} agent(s) unhealthy`)
      }
    } catch (error) {
      console.error('[AgentSystem] Health check failed:', error)
    }
  }

  /**
   * Shutdown the multi-agent system
   */
  async shutdown(): Promise<void> {
    console.log('[AgentSystem] Shutting down multi-agent system...')

    // Stop health checks
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    // Shutdown registry
    const registry = getAgentRegistry()
    await registry.shutdown()

    this.initialized = false

    console.log('[AgentSystem] ✓ Shutdown complete')
  }

  /**
   * Check if system is ready
   */
  isReady(): boolean {
    if (!this.initialized) {
      return false
    }

    try {
      const registry = getAgentRegistry()
      const stats = registry.getRegistryStats()
      return stats.healthyAgents > 0
    } catch {
      return false
    }
  }
}

// Global instance
let agentSystemService: AgentSystemService | null = null

/**
 * Initialize the multi-agent system
 */
export async function initializeAgentSystem(
  config?: Partial<AgentSystemConfig>
): Promise<AgentSystemStatus> {
  if (!agentSystemService) {
    agentSystemService = AgentSystemService.getInstance(config)
  }

  return await agentSystemService.initialize()
}

/**
 * Get agent system service instance
 */
export function getAgentSystemService(): AgentSystemService | null {
  return agentSystemService
}

/**
 * Check if agent system is ready
 */
export function isAgentSystemReady(): boolean {
  return agentSystemService?.isReady() || false
}

/**
 * Get agent system status
 */
export function getAgentSystemStatus(): AgentSystemStatus {
  if (!agentSystemService) {
    return {
      initialized: false,
      ready: false,
      agentsRegistered: 0,
      agentsHealthy: 0,
      orchestratorReady: false,
      lastHealthCheck: 0
    }
  }

  return agentSystemService.getStatus()
}
