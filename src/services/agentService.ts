/**
 * Multi-Agent Service
 *
 * Client-side service for interacting with the multi-agent API.
 * Provides a simple interface for sending messages and receiving responses.
 *
 * @module services/agentService
 */

import { getRegisteredContext } from '@/hooks/useCopilotReadableWithContext'
import { useDateRange, useDisplayMode } from '@/contexts/TraderraContext'
import { useTrades } from '@/hooks/useTrades'

export interface AgentServiceRequest {
  message: string
  mode?: 'renata' | 'analyst' | 'coach' | 'mentor'
  agent?: string
}

export interface AgentServiceResponse {
  success: boolean
  response: string
  data?: any
  agentUsed: string
  agentsInvolved: string[]
  mode: string
  executionTime: number
  metadata?: any
}

export interface AgentServiceStatus {
  status: {
    initialized: boolean
    agentsRegistered: number
    agentsHealthy: number
  }
  ready: boolean
  timestamp: string
}

/**
 * Send message to multi-agent system
 */
export async function sendAgentMessage(
  request: AgentServiceRequest
): Promise<AgentServiceResponse> {
  try {
    // Collect enhanced context from all registered hooks
    const enhancedContext = getRegisteredContext()

    // Get trades data
    // Note: In a real implementation, you'd get this from context or props
    const context = {
      userId: 'user-' + Math.random().toString(36).substr(2, 9), // Would come from Clerk
      currentPage: enhancedContext.currentPage || 'dashboard',
      currentDateRange: enhancedContext.currentDateRange || 'default',
      displayMode: enhancedContext.displayMode || 'dollar',
      trades: enhancedContext.trades || [],
      metrics: enhancedContext.metrics,
      journal: enhancedContext.journal,
      customData: enhancedContext
    }

    console.log('[AgentService] Sending request:', {
      message: request.message.substring(0, 100),
      mode: request.mode,
      agent: request.agent
    })

    const response = await fetch('/api/agents/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: request.message,
        context,
        mode: request.mode,
        agent: request.agent
      })
    })

    if (!response.ok) {
      throw new Error(`Agent API error: ${response.status}`)
    }

    const data = await response.json()

    console.log('[AgentService] Received response:', {
      success: data.success,
      agentUsed: data.agentUsed,
      agentsInvolved: data.agentsInvolved,
      executionTime: data.executionTime
    })

    return {
      success: data.success,
      response: data.response,
      data: data.data,
      agentUsed: data.agentUsed,
      agentsInvolved: data.agentsInvolved,
      mode: data.mode,
      executionTime: data.executionTime,
      metadata: data.metadata
    }
  } catch (error) {
    console.error('[AgentService] Request failed:', error)

    return {
      success: false,
      response: 'Sorry, I encountered an error processing your request. Please try again.',
      agentUsed: 'system',
      agentsInvolved: [],
      mode: 'renata',
      executionTime: 0,
      metadata: { error: (error as Error).message }
    }
  }
}

/**
 * Check multi-agent system status
 */
export async function getAgentSystemStatus(): Promise<AgentServiceStatus> {
  try {
    const response = await fetch('/api/agents/chat')

    if (!response.ok) {
      throw new Error(`Status check error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[AgentService] Status check failed:', error)

    return {
      status: {
        initialized: false,
        agentsRegistered: 0,
        agentsHealthy: 0
      },
      ready: false,
      timestamp: new Date().toISOString()
    }
  }
}

/**
 * React Hook for Multi-Agent Service
 *
 * Provides easy access to agent messaging from components.
 */
export function useAgentService() {
  /**
   * Send message with current context
   */
  const sendMessage = async (
    message: string,
    options: {
      mode?: 'renata' | 'analyst' | 'coach' | 'mentor'
      agent?: string
    } = {}
  ): Promise<AgentServiceResponse> => {
    return sendAgentMessage({
      message,
      mode: options.mode,
      agent: options.agent
    })
  }

  return {
    sendMessage
  }
}
