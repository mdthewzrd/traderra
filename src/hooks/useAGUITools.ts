/**
 * AG-UI Tools Hook
 *
 * This hook provides access to all frontend tools for edge-dev
 */

'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createFrontendTools, type FrontendToolsRegistry } from '@/lib/ag-ui/frontend-tools'

export function useAGUITools() {
  const router = useRouter()
  const toolsRef = useRef<FrontendToolsRegistry | null>(null)

  // Initialize tools on mount
  useEffect(() => {
    toolsRef.current = createFrontendTools({ router })
    console.log('✅ AG-UI Tools initialized for edge-dev')
  }, [router])

  // Execute a tool by name
  const executeTool = async (toolName: string, args: any) => {
    if (!toolsRef.current) {
      console.error('❌ AG-UI Tools not initialized')
      return { success: false, error: 'Tools not initialized' }
    }

    const tool = toolsRef.current[toolName as keyof FrontendToolsRegistry]
    if (!tool) {
      console.error(`❌ Tool not found: ${toolName}`)
      return { success: false, error: `Tool not found: ${toolName}` }
    }

    console.log(`🔧 Executing tool: ${toolName}`, args)

    try {
      const result = await tool.execute(args)
      console.log(`✅ Tool ${toolName} executed:`, result)
      return result
    } catch (error) {
      console.error(`❌ Tool ${toolName} failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    tools: toolsRef.current,
    executeTool,
  }
}

/**
 * React hook to use AG-UI tools with convenience methods
 */
export function useFrontendTools() {
  const tools = useAGUITools()

  // Convenience methods for common tools
  return {
    ...tools,

    // Navigation
    navigate: (page: string) => tools.executeTool('navigateToPage', { page }),
    goToChartDay: (dayOffset: number) => tools.executeTool('navigateChartDay', { dayOffset }),

    // Display settings
    setDisplayMode: (mode: 'dollar' | 'r' | 'percentage') =>
      tools.executeTool('setDisplayMode', { mode }),
    setViewMode: (mode: 'table' | 'chart') =>
      tools.executeTool('setViewMode', { mode }),

    // Sort
    setSortField: (field: 'ticker' | 'date' | 'gapPercent' | 'volume' | 'score') =>
      tools.executeTool('setSortField', { field }),
    setSortDirection: (direction: 'asc' | 'desc') =>
      tools.executeTool('setSortDirection', { direction }),

    // Modals
    openUploadModal: () => tools.executeTool('openUploadModal', {}),

    // Projects
    createProject: (name?: string) => tools.executeTool('createNewProject', { name }),
    selectProject: (projectId: string) => tools.executeTool('selectProject', { projectId }),

    // Date
    setDateRange: (range: string, startDate?: string, endDate?: string) =>
      tools.executeTool('setDateRange', { range, startDate, endDate }),

    // AI
    toggleAISidebar: (open?: boolean) => tools.executeTool('toggleAISidebar', { open }),

    // Scan
    runScan: () => tools.executeTool('runScan', {}),
    saveScan: (name?: string) => tools.executeTool('saveScan', { name }),
  }
}
