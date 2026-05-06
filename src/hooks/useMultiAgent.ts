/**
 * useMultiAgent React Hook
 *
 * Provides easy access to the multi-agent system from React components.
 * Handles agent initialization, message sending, and response processing.
 *
 * @module hooks/useMultiAgent
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { initializeAgentSystem, isAgentSystemReady, getAgentSystemService } from '@/agents/service'
import { getAgentRegistry } from '@/agents/core/agent-registry'
import { getMessageBus } from '@/communication/message-bus'

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent?: string
  timestamp: number
  metadata?: any
}

export interface AgentRequest {
  message: string
  context: {
    userId: string
    currentPage: string
    currentDateRange: string
    displayMode: string
    trades: any[]
    metrics?: Record<string, any>
    journal?: any[]
  }
  mode?: 'renata' | 'analyst' | 'coach' | 'mentor'
  agent?: string // Specific agent to use
}

export interface AgentResponse {
  success: boolean
  message: string
  data?: any
  agentUsed: string
  agentsInvolved: string[]
  executionTime: number
  metadata?: any
}

export interface UseMultiAgentOptions {
  autoInitialize?: boolean
  onError?: (error: Error) => void
  onMessage?: (message: AgentMessage) => void
}

export interface UseMultiAgentReturn {
  // State
  isReady: boolean
  isLoading: boolean
  isInitializing: boolean
  messages: AgentMessage[]
  currentAgent: string
  systemStatus: {
    initialized: boolean
    agentsRegistered: number
    agentsHealthy: number
  }

  // Actions
  sendMessage: (request: AgentRequest) => Promise<AgentResponse>
  setAgent: (agent: string) => void
  clearMessages: () => void
  initialize: () => Promise<void>

  // Agent info
  availableAgents: string[]
  getAgentStatus: (agentId: string) => any
}

/**
 * useMultiAgent Hook
 *
 * Main hook for interacting with the multi-agent system.
 */
export function useMultiAgent(options: UseMultiAgentOptions = {}): UseMultiAgentReturn {
  const { autoInitialize = true, onError, onMessage } = options

  // State
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [currentAgent, setCurrentAgent] = useState<string>('renata')
  const [systemStatus, setSystemStatus] = useState({
    initialized: false,
    agentsRegistered: 0,
    agentsHealthy: 0
  })

  // Track if initialization has been attempted
  const initializationAttempted = useRef(false)

  /**
   * Initialize the agent system
   */
  const initialize = useCallback(async () => {
    if (initializationAttempted.current) {
      return
    }

    initializationAttempted.current = true
    setIsInitializing(true)

    try {
      console.log('[useMultiAgent] Initializing agent system...')

      const status = await initializeAgentSystem({
        autoInitialize: true,
        enableHealthChecks: true,
        healthCheckInterval: 60000
      })

      setSystemStatus({
        initialized: status.initialized,
        agentsRegistered: status.agentsRegistered,
        agentsHealthy: status.agentsHealthy
      })

      setIsReady(true)
      setIsInitializing(false)

      console.log('[useMultiAgent] ✓ Agent system ready:', status)
    } catch (error) {
      console.error('[useMultiAgent] ✗ Initialization failed:', error)
      setIsInitializing(false)
      onError?.(error as Error)
    }
  }, [onError])

  /**
   * Auto-initialize on mount if enabled
   */
  useEffect(() => {
    if (autoInitialize && !isReady && !isInitializing) {
      initialize()
    }
  }, [autoInitialize, isReady, isInitializing, initialize])

  /**
   * Send message to agent system
   */
  const sendMessage = useCallback(async (request: AgentRequest): Promise<AgentResponse> => {
    if (!isReady) {
      throw new Error('Agent system not ready. Please wait for initialization.')
    }

    setIsLoading(true)

    // Add user message to history
    const userMessage: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: request.message,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    onMessage?.(userMessage)

    try {
      const startTime = Date.now()

      // Get the orchestrator
      const registry = getAgentRegistry()
      const orchestrator = registry.getAgent('orchestrator')

      if (!orchestrator) {
        throw new Error('Orchestrator agent not found')
      }

      // Process through orchestrator
      const result = await (orchestrator as any).processUserMessage(
        request.message,
        request.context
      )

      const executionTime = Date.now() - startTime

      // Add assistant message to history
      const assistantMessage: AgentMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        agent: result.agentsInvolved[0] || 'renata',
        timestamp: Date.now(),
        metadata: {
          agentsInvolved: result.agentsInvolved,
          executionTime,
          mode: request.mode || 'renata'
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      onMessage?.(assistantMessage)

      setIsLoading(false)

      return {
        success: true,
        message: result.response,
        data: result.data,
        agentUsed: result.agentsInvolved[0] || 'renata',
        agentsInvolved: result.agentsInvolved,
        executionTime,
        metadata: result.metadata
      }
    } catch (error) {
      console.error('[useMultiAgent] Message processing failed:', error)

      // Add error message
      const errorMessage: AgentMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now(),
        metadata: { error: (error as Error).message }
      }

      setMessages(prev => [...prev, errorMessage])
      onMessage?.(errorMessage)

      setIsLoading(false)

      onError?.(error as Error)

      return {
        success: false,
        message: errorMessage.content,
        agentUsed: 'system',
        agentsInvolved: [],
        executionTime: 0,
        metadata: { error: (error as Error).message }
      }
    }
  }, [isReady, onMessage, onError])

  /**
   * Set current agent
   */
  const setAgent = useCallback((agent: string) => {
    setCurrentAgent(agent)
    console.log('[useMultiAgent] Current agent set to:', agent)
  }, [])

  /**
   * Clear message history
   */
  const clearMessages = useCallback(() => {
    setMessages([])
    console.log('[useMultiAgent] Message history cleared')
  }, [])

  /**
   * Get available agents
   */
  const availableAgents = [
    'renata',
    'trading-pattern-agent',
    'performance-coach-agent',
    'risk-management-agent',
    'journal-insight-agent'
  ]

  /**
   * Get agent status
   */
  const getAgentStatus = useCallback((agentId: string) => {
    const registry = getAgentRegistry()
    const agent = registry.getAgent(agentId)

    if (!agent) {
      return { registered: false }
    }

    return {
      registered: true,
      healthy: agent.isAvailable(),
      activeTasks: agent.getActiveTaskCount(),
      health: agent.getHealthStatus()
    }
  }, [])

  return {
    // State
    isReady,
    isLoading,
    isInitializing,
    messages,
    currentAgent,
    systemStatus,

    // Actions
    sendMessage,
    setAgent,
    clearMessages,
    initialize,

    // Agent info
    availableAgents,
    getAgentStatus
  }
}

/**
 * Convenience hook to check if agent system is ready
 */
export function useAgentSystemReady(): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const checkReady = () => {
      setIsReady(isAgentSystemReady())
    }

    checkReady()

    // Poll every second until ready
    const interval = setInterval(checkReady, 1000)

    return () => clearInterval(interval)
  }, [])

  return isReady
}
