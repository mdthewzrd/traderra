'use client'

/**
 * Agent System Initializer Component
 *
 * This component should be added to the root layout to ensure
 * the multi-agent system initializes when the app starts.
 *
 * Only initializes when user is authenticated to avoid showing
 * agent-related content on the landing page.
 *
 * Usage:
 *   <AgentSystemInitializer />
 *
 * @module components/agents/AgentSystemInitializer
 */

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { initializeAgentSystem, getAgentSystemStatus } from '@/agents/service'
import toast from 'react-hot-toast'
import { useAuth } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

export function AgentSystemInitializer() {
  const [status, setStatus] = useState<'initializing' | 'ready' | 'error'>('initializing')
  const [agentCount, setAgentCount] = useState(0)
  const { isSignedIn, isLoaded } = useAuth()
  const pathname = usePathname()

  useEffect(() => {
    // Don't initialize on landing page or if not authenticated
    const isLandingPage = pathname === '/' || pathname === ''
    if (!isLoaded || !isSignedIn || isLandingPage) {
      return
    }

    let mounted = true

    const initialize = async () => {
      try {
        console.log('[AgentSystemInitializer] Starting initialization...')

        const systemStatus = await initializeAgentSystem({
          autoInitialize: true,
          enableHealthChecks: true,
          healthCheckInterval: 60000
        })

        if (!mounted) return

        if (systemStatus.initialized && systemStatus.agentsHealthy > 0) {
          setStatus('ready')
          setAgentCount(systemStatus.agentsHealthy)

          console.log('[AgentSystemInitializer] ✓ Ready:', systemStatus)

          // Only show toast when authenticated and not on landing page
          if (isSignedIn && !isLandingPage) {
            toast.success(`Multi-agent system ready with ${systemStatus.agentsHealthy} agents`)
          }
        } else {
          setStatus('error')
          console.error('[AgentSystemInitializer] ✗ Failed:', systemStatus)
          toast.error('Failed to initialize multi-agent system')
        }
      } catch (error) {
        if (!mounted) return

        setStatus('error')
        console.error('[AgentSystemInitializer] ✗ Error:', error)
        toast.error('Agent system initialization failed')
      }
    }

    initialize()

    return () => {
      mounted = false
    }
  }, [isSignedIn, isLoaded, pathname])

  // Don't render anything - this is a silent initializer
  return null
}

/**
 * Hook to check if agent system is ready
 */
export function useAgentSystemReadyState() {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const systemStatus = await getAgentSystemStatus()
        setReady(systemStatus.ready)
        setStatus(systemStatus)
      } catch (error) {
        console.error('[useAgentSystemReadyState] Check failed:', error)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 3000)

    return () => clearInterval(interval)
  }, [])

  return { ready, status }
}

/**
 * Agent System Status Indicator Component
 *
 * Shows a small indicator of the agent system status.
 * Useful for debugging and monitoring.
 */
export function AgentSystemStatusIndicator({ showLabel = false }: { showLabel?: boolean }) {
  const { ready, status } = useAgentSystemReadyState()

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-xs text-yellow-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        {showLabel && <span>Loading agents...</span>}
      </div>
    )
  }

  if (ready) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-400">
        <CheckCircle2 className="w-3 h-3" />
        {showLabel && <span>{status.agentsRegistered} agents ready</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-red-400">
      <XCircle className="w-3 h-3" />
      {showLabel && <span>Agent system error</span>}
    </div>
  )
}
