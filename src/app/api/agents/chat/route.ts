/**
 * Multi-Agent API Endpoint
 *
 * Next.js API route that bridges the frontend with the multi-agent system.
 * Processes user requests through the orchestrator and returns unified responses.
 *
 * POST /api/agents/chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAgentSystemReady, getAgentSystemStatus, initializeAgentSystem } from '@/agents/service'
import { getAgentRegistry } from '@/agents/core/agent-registry'

// Track initialization state to avoid multiple concurrent initializations
let initializationPromise: Promise<any> | null = null

async function ensureAgentSystemInitialized() {
  // If already ready, return immediately
  if (isAgentSystemReady()) {
    return getAgentSystemStatus()
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    return initializationPromise
  }

  // Start initialization
  initializationPromise = (async () => {
    console.log('[Multi-Agent API] Initializing agent system...')
    try {
      const status = await initializeAgentSystem({
        autoInitialize: true,
        enableHealthChecks: true,
        healthCheckInterval: 60000
      })
      console.log('[Multi-Agent API] ✓ Agent system initialized:', status)
      return status
    } catch (error) {
      console.error('[Multi-Agent API] ✗ Initialization failed:', error)
      initializationPromise = null // Allow retry on failure
      throw error
    }
  })()

  return initializationPromise
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, context, mode, agent } = body

    console.log('🤖 [Multi-Agent API] Received request:', {
      message: message.substring(0, 100),
      mode: mode || 'renata',
      agent: agent || 'auto'
    })

    // Ensure agent system is initialized
    await ensureAgentSystemInitialized()

    // Check if agent system is ready after initialization attempt
    if (!isAgentSystemReady()) {
      const status = getAgentSystemStatus()

      console.warn('[Multi-Agent API] System not ready after initialization:', status)

      return NextResponse.json({
        success: false,
        message: 'Agent system is initializing. Please wait a moment and try again.',
        error: 'system_not_ready',
        status,
        retryAfter: 2000
      }, { status: 503 })
    }

    // Build agent context
    const agentContext = {
      userId: context.userId || 'anonymous',
      currentPage: context.currentPage || context.page || 'dashboard',
      currentDateRange: context.currentDateRange || context.dateRange || 'default',
      displayMode: context.displayMode || 'dollar',
      trades: context.trades || [],
      metrics: context.metrics || {},
      journal: context.journal || [],
      customData: context.customData || {}
    }

    // Get orchestrator
    const registry = getAgentRegistry()
    const orchestrator = registry.getAgent('orchestrator')

    if (!orchestrator) {
      console.error('[Multi-Agent API] Orchestrator not found')

      return NextResponse.json({
        success: false,
        message: 'Orchestrator agent not available. Please try again.',
        error: 'orchestrator_not_found'
      }, { status: 503 })
    }

    const startTime = Date.now()

    // Process through orchestrator
    const result = await (orchestrator as any).processUserMessage(
      message,
      agentContext
    )

    const executionTime = Date.now() - startTime

    console.log('✅ [Multi-Agent API] Request processed:', {
      success: result.success,
      agentsInvolved: result.agentsInvolved,
      executionTime
    })

    // Return successful response
    return NextResponse.json({
      success: true,
      response: result.response,
      data: result.data,
      agentUsed: result.agentsInvolved[0] || 'renata',
      agentsInvolved: result.agentsInvolved,
      mode: mode || 'renata',
      executionTime,
      metadata: result.metadata,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [Multi-Agent API] Error:', error)

    return NextResponse.json({
      success: false,
      message: 'I apologize, but I encountered an error processing your request.',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check system status
 * Also initializes the agent system if not already done
 */
export async function GET(req: NextRequest) {
  try {
    // Trigger initialization if needed
    await ensureAgentSystemInitialized()

    const status = getAgentSystemStatus()

    return NextResponse.json({
      status,
      ready: isAgentSystemReady(),
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ [Multi-Agent API] Status check failed:', error)

    return NextResponse.json({
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
