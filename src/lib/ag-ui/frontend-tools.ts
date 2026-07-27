/**
 * AG-UI Frontend Tools Registry for Traderra
 *
 * These tools match the ACTUAL Traderra application structure
 */

'use client'

import { z } from 'zod'
import { useRouter } from 'next/navigation'
import type { FrontendTool, ToolResult } from './types'
import { snapshotStore, createSnapshotFromContext } from './snapshot-store'
import { compareSnapshots, getSignificantDifferences } from './comparison-engine'
import type { PageSnapshot, ComparisonResult, SnapshotSummary } from './snapshot-types'

/**
 * Factory function to create a frontend tool
 */
function createTool<TInput, TOutput>(
  name: string,
  description: string,
  schema: z.ZodSchema<TInput> | undefined,
  execute: (input: TInput) => Promise<ToolResult<TOutput>>,
  category?: string
): FrontendTool<TInput, TOutput> {
  return { name, description, schema, execute, category }
}

/**
 * Options for creating frontend tools
 */
export interface FrontendToolsOptions {
  router: ReturnType<typeof useRouter>
  setOpenUploadModal?: (open: boolean) => void
  setShowCreateProjectModal?: (open: boolean) => void
  setViewMode?: (mode: 'table' | 'chart') => void
  setDisplayMode?: (mode: 'dollar' | 'r_multiple' | 'percentage') => void
  setSortField?: (field: 'ticker' | 'date' | 'gapPercent' | 'volume' | 'score') => void
  setSortDirection?: (direction: 'asc' | 'desc') => void
  setStatsTab?: (tab: 'overview' | 'analytics' | 'performance') => void
}

/**
 * Create and return all frontend tools for Traderra
 */
export function createFrontendTools(options: FrontendToolsOptions) {
  const { router } = options

  /**
   * NAVIGATION TOOLS
   */

  const navigateToPage = createTool(
    'navigateToPage',
    'Navigate to a specific page in the application. Top Nav items: Dashboard (home), Trades, Stats, Summary, Calendar, Journal, Settings. Also available: analytics, journal-enhanced versions.',
    z.object({
      page: z.enum(['', 'dashboard', 'trades', 'journal', 'journal-enhanced', 'journal-enhanced-v2', 'analytics', 'statistics', 'calendar', 'daily-summary', 'settings', 'sign-in', 'sign-up'])
    }),
    async ({ page }) => {
      try {
        const route = page === '' ? '/' : `/${page}`
        router.push(route)
        return { success: true, message: `Navigated to ${page || 'home'}` }
      } catch (error) {
        return { success: false, error: `Failed to navigate: ${error}` }
      }
    },
    'navigation'
  )

  /**
   * DISPLAY TOOLS
   */

  const setDisplayMode = createTool(
    'setDisplayMode',
    'Set the display mode for values (dollar, r, percentage).',
    z.object({
      mode: z.enum(['dollar', 'r', 'percentage'])
    }),
    async ({ mode }) => {
      try {
        localStorage.setItem('displayMode', mode)
        window.dispatchEvent(new CustomEvent('displayModeChange', { detail: { mode } }))
        return { success: true, message: `Display mode set to ${mode}`, data: { mode } }
      } catch (error) {
        return { success: false, error: `Failed to set display mode: ${error}` }
      }
    },
    'display'
  )

  const setViewMode = createTool(
    'setViewMode',
    'Switch between table and chart views.',
    z.object({
      mode: z.enum(['table', 'chart'])
    }),
    async ({ mode }) => {
      try {
        localStorage.setItem('viewMode', mode)
        window.dispatchEvent(new CustomEvent('viewModeChange', { detail: { mode } }))
        return { success: true, message: `View mode set to ${mode}`, data: { mode } }
      } catch (error) {
        return { success: false, error: `Failed to set view mode: ${error}` }
      }
    },
    'display'
  )

  /**
   * SORT TOOLS
   */

  const setSortField = createTool(
    'setSortField',
    'Change the field to sort results by.',
    z.object({
      field: z.enum(['ticker', 'date', 'gapPercent', 'volume', 'score'])
    }),
    async ({ field }) => {
      try {
        localStorage.setItem('sortField', field)
        window.dispatchEvent(new CustomEvent('sortFieldChange', { detail: { field } }))
        return { success: true, message: `Sorting by ${field}`, data: { field } }
      } catch (error) {
        return { success: false, error: `Failed to set sort field: ${error}` }
      }
    },
    'display'
  )

  const setSortDirection = createTool(
    'setSortDirection',
    'Set sort direction (ascending or descending).',
    z.object({
      direction: z.enum(['asc', 'desc'])
    }),
    async ({ direction }) => {
      try {
        localStorage.setItem('sortDirection', direction)
        window.dispatchEvent(new CustomEvent('sortDirectionChange', { detail: { direction } }))
        return { success: true, message: `Sort direction set to ${direction === 'asc' ? 'ascending' : 'descending'}`, data: { direction } }
      } catch (error) {
        return { success: false, error: `Failed to set sort direction: ${error}` }
      }
    },
    'display'
  )

  /**
   * MODAL TOOLS
   */

  const openUploadModal = createTool(
    'openUploadModal',
    'Open the upload scanner modal.',
    z.object({}),
    async () => {
      try {
        window.dispatchEvent(new CustomEvent('openUploadModal'))
        return { success: true, message: 'Opening upload modal' }
      } catch (error) {
        return { success: false, error: `Failed to open upload modal: ${error}` }
      }
    },
    'modal'
  )

  const uploadTradeFile = createTool(
    'uploadTradeFile',
    'Upload a Tradervue CSV file to import trades. Opens the trade upload modal. Returns import summary with new/updated/duplicate counts after upload completes.',
    z.object({
      confirm: z.boolean().optional().describe('User confirmation (default: false - show preview first)')
    }),
    async ({ confirm = false }) => {
      try {
        // Open the trade upload modal
        window.dispatchEvent(new CustomEvent('openTradeUploadModal', { detail: { confirm } }))
        return {
          success: true,
          message: confirm
            ? 'Proceeding with trade import...'
            : 'Opening trade upload modal. Please select your Tradervue CSV file.',
          data: {
            action: confirm ? 'import' : 'preview',
            instructions: 'Select a CSV file exported from Tradervue. The system will detect duplicates and show you a preview before importing.'
          }
        }
      } catch (error) {
        return { success: false, error: `Failed to open trade upload: ${error}` }
      }
    },
    'trade'
  )

  const importTradesFromFile = createTool(
    'importTradesFromFile',
    'Import trades from a CSV file that was uploaded with the message. Call this when you see a file upload marker. This will parse and save the trades to the database.',
    z.object({
      fileName: z.string().describe('Name of the uploaded file'),
      csvContent: z.string().describe('Base64 encoded CSV content')
    }),
    async ({ fileName, csvContent }) => {
      try {
        console.log('[AG-UI] Importing trades from file:', fileName)

        const response = await fetch('/api/trades/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csvContent,
            fileName
          })
        })

        if (!response.ok) {
          const error = await response.text()
          return { success: false, error: `Import failed: ${error}` }
        }

        const data = await response.json()

        return {
          success: true,
          message: data.message || `Import complete!`,
          data: {
            imported: data.imported || 0,
            skipped: data.skipped || 0,
            totalTrades: data.totalTrades || 0,
            preview: data.trades || []
          }
        }
      } catch (error) {
        console.error('[AG-UI] Failed to import trades:', error)
        return { success: false, error: `Failed to import trades: ${error}` }
      }
    },
    'trade'
  )

  const createNewProject = createTool(
    'createNewProject',
    'Create a new project.',
    z.object({
      name: z.string().optional()
    }),
    async ({ name }) => {
      try {
        window.dispatchEvent(new CustomEvent('createNewProject', { detail: { name } }))
        return { success: true, message: 'Creating new project' }
      } catch (error) {
        return { success: false, error: `Failed to create project: ${error}` }
      }
    },
    'project'
  )

  const selectProject = createTool(
    'selectProject',
    'Select a project as the active project.',
    z.object({
      projectId: z.string()
    }),
    async ({ projectId }) => {
      try {
        localStorage.setItem('selectedProject', projectId)
        window.dispatchEvent(new CustomEvent('projectSelected', { detail: { projectId } }))
        return { success: true, message: `Selected project: ${projectId}`, data: { projectId } }
      } catch (error) {
        return { success: false, error: `Failed to select project: ${error}` }
      }
    },
    'project'
  )

  /**
   * DATE TOOLS
   */

  const setDateRange = createTool(
    'setDateRange',
    'Set the scan date range.',
    z.object({
      range: z.enum(['today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 'this year', 'last year', 'all', 'custom']),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }),
    async ({ range, startDate, endDate }) => {
      try {
        localStorage.setItem('dateRange', range)
        if (range === 'custom') {
          if (startDate) localStorage.setItem('startDate', startDate)
          if (endDate) localStorage.setItem('endDate', endDate)
        }
        window.dispatchEvent(new CustomEvent('dateRangeChange', { detail: { range, startDate, endDate } }))
        return { success: true, message: `Date range set to ${range}`, data: { range, startDate, endDate } }
      } catch (error) {
        return { success: false, error: `Failed to set date range: ${error}` }
      }
    },
    'date'
  )

  const navigateChartDay = createTool(
    'navigateChartDay',
    'Navigate to a specific trading day in the chart.',
    z.object({
      dayOffset: z.number()
    }),
    async ({ dayOffset }) => {
      try {
        localStorage.setItem('chartDayOffset', dayOffset.toString())
        window.dispatchEvent(new CustomEvent('chartDayNavigate', { detail: { dayOffset } }))
        return { success: true, message: `Navigated to day ${dayOffset}`, data: { dayOffset } }
      } catch (error) {
        return { success: false, error: `Failed to navigate to day: ${error}` }
      }
    },
    'navigation'
  )

  /**
   * TAB TOOLS
   */

  const setStatsTab = createTool(
    'setStatsTab',
    'Switch between tabs on the Statistics page. Available tabs: overview (summary metrics), analytics (detailed analysis), performance (performance metrics).',
    z.object({
      tab: z.enum(['overview', 'analytics', 'performance'])
    }),
    async ({ tab }) => {
      try {
        // Dispatch event for stats page to listen to
        window.dispatchEvent(new CustomEvent('statsTabChange', { detail: { tab } }))
        return { success: true, message: `Switched to ${tab} tab`, data: { tab } }
      } catch (error) {
        return { success: false, error: `Failed to switch stats tab: ${error}` }
      }
    },
    'display'
  )

  /**
   * AI TOOLS
   */

  const toggleAISidebar = createTool(
    'toggleAISidebar',
    'Toggle the Renata AI sidebar open or closed.',
    z.object({
      open: z.boolean().optional()
    }),
    async ({ open }) => {
      try {
        const currentState = localStorage.getItem('aiSidebarOpen') === 'true'
        const newState = open !== undefined ? open : !currentState
        localStorage.setItem('aiSidebarOpen', String(newState))
        window.dispatchEvent(new CustomEvent('toggleAISidebar', { detail: { open: newState } }))
        return { success: true, message: newState ? 'Opening AI sidebar' : 'Closing AI sidebar', data: { open: newState } }
      } catch (error) {
        return { success: false, error: `Failed to toggle AI sidebar: ${error}` }
      }
    },
    'ai'
  )

  /**
   * SCAN TOOLS
   */

  const runScan = createTool(
    'runScan',
    'Execute the current scanner.',
    z.object({}),
    async () => {
      try {
        window.dispatchEvent(new CustomEvent('runScan'))
        return { success: true, message: 'Starting scan execution' }
      } catch (error) {
        return { success: false, error: `Failed to run scan: ${error}` }
      }
    },
    'scan'
  )

  const saveScan = createTool(
    'saveScan',
    'Save the current scan configuration.',
    z.object({
      name: z.string().optional()
    }),
    async ({ name }) => {
      try {
        window.dispatchEvent(new CustomEvent('saveScan', { detail: { name } }))
        return { success: true, message: 'Saving scan configuration' }
      } catch (error) {
        return { success: false, error: `Failed to save scan: ${error}` }
      }
    },
    'scan'
  )

  /**
   * COMPONENT INTERACTION TOOLS (UNIFIED SYSTEM)
   * Generic tools that work with ANY component in the site
   */

  const activateComponent = createTool(
    'activateComponent',
    'Activate any UI component on the current page. This is a generic tool that works with tabs, buttons, accordions, panels, cards, and other interactive elements.',
    z.object({
      component: z.string(),
      action: z.enum(['click', 'expand', 'collapse', 'open', 'close', 'select', 'activate', 'toggle']).optional(),
      value: z.string().optional()
    }),
    async ({ component, action = 'click', value }) => {
      try {
        console.log('[AG-UI] Activating component:', { component, action, value })
        window.dispatchEvent(new CustomEvent('activateComponent', { detail: { component, action, value } }))
        return { success: true, message: `Activating ${component} with action: ${action}`, data: { component, action, value } }
      } catch (error) {
        return { success: false, error: `Failed to activate component: ${error}` }
      }
    },
    'component'
  )

  const scrollToElement = createTool(
    'scrollToElement',
    'Scroll to any specific section or component on the current page. Works with any visible element.',
    z.object({
      element: z.string(),
      behavior: z.enum(['smooth', 'instant', 'auto']).optional()
    }),
    async ({ element, behavior = 'smooth' }) => {
      try {
        console.log('[AG-UI] Scrolling to element:', { element, behavior })
        window.dispatchEvent(new CustomEvent('scrollToElement', { detail: { element, behavior } }))
        return { success: true, message: `Scrolling to ${element}`, data: { element, behavior } }
      } catch (error) {
        return { success: false, error: `Failed to scroll to element: ${error}` }
      }
    },
    'component'
  )

  const setComponentState = createTool(
    'setComponentState',
    'Change the state of any component on the current page. Works with toggles, switches, dropdowns, filters, inputs, and other stateful components.',
    z.object({
      component: z.string(),
      state: z.any(),
      property: z.string().optional()
    }),
    async ({ component, state, property }) => {
      try {
        console.log('[AG-UI] Setting component state:', { component, state, property })
        window.dispatchEvent(new CustomEvent('setComponentState', { detail: { component, state, property } }))
        return { success: true, message: `Setting ${component} state`, data: { component, state, property } }
      } catch (error) {
        return { success: false, error: `Failed to set component state: ${error}` }
      }
    },
    'component'
  )

  /**
   * STATISTICS PAGE FILTER TOOLS
   * Specialized tools for controlling filters on the Statistics page
   */

  const setStatisticsSymbolFilter = createTool(
    'setStatisticsSymbolFilter',
    'Filter trades on the Statistics page by stock symbol (e.g., AAPL, SPY, QQQ). Partial matches work (e.g., "AA" matches AAPL).',
    z.object({
      symbol: z.string()
    }),
    async ({ symbol }) => {
      try {
        console.log('[AG-UI] Setting Statistics symbol filter:', symbol)
        window.dispatchEvent(new CustomEvent('setComponentState', {
          detail: { component: 'statistics.filters.symbol', state: symbol }
        }))
        return { success: true, message: `Filtering by symbol: ${symbol}`, data: { symbol } }
      } catch (error) {
        return { success: false, error: `Failed to set symbol filter: ${error}` }
      }
    },
    'filter'
  )

  const setStatisticsStrategyFilter = createTool(
    'setStatisticsStrategyFilter',
    'Filter trades on the Statistics page by trading strategy (e.g., breakout, gap, momentum, pullback, reversal, tail).',
    z.object({
      strategy: z.string()
    }),
    async ({ strategy }) => {
      try {
        console.log('[AG-UI] Setting Statistics strategy filter:', strategy)
        window.dispatchEvent(new CustomEvent('setComponentState', {
          detail: { component: 'statistics.filters.tags', state: strategy }
        }))
        return { success: true, message: `Filtering by strategy: ${strategy}`, data: { strategy } }
      } catch (error) {
        return { success: false, error: `Failed to set strategy filter: ${error}` }
      }
    },
    'filter'
  )

  const setStatisticsSideFilter = createTool(
    'setStatisticsSideFilter',
    'Filter trades on the Statistics page by trade side (direction): Long, Short, or All (to show both).',
    z.object({
      side: z.enum(['All', 'Long', 'Short'])
    }),
    async ({ side }) => {
      try {
        console.log('[AG-UI] Setting Statistics side filter:', side)
        window.dispatchEvent(new CustomEvent('setComponentState', {
          detail: { component: 'statistics.filters.side', state: side }
        }))
        return { success: true, message: `Filtering by side: ${side}`, data: { side } }
      } catch (error) {
        return { success: false, error: `Failed to set side filter: ${error}` }
      }
    },
    'filter'
  )

  const setStatisticsDurationFilter = createTool(
    'setStatisticsDurationFilter',
    'Filter trades on the Statistics page by trade duration (e.g., 1d, 2d, 3d, 4d, 5d for multi-day trades). Use "All" to show all durations.',
    z.object({
      duration: z.string()
    }),
    async ({ duration }) => {
      try {
        console.log('[AG-UI] Setting Statistics duration filter:', duration)
        window.dispatchEvent(new CustomEvent('setComponentState', {
          detail: { component: 'statistics.filters.duration', state: duration }
        }))
        return { success: true, message: `Filtering by duration: ${duration}`, data: { duration } }
      } catch (error) {
        return { success: false, error: `Failed to set duration filter: ${error}` }
      }
    },
    'filter'
  )

  const showStatisticsFilters = createTool(
    'showStatisticsFilters',
    'Show or hide the filter panel on the Statistics page. Use "show" to open, "hide" to close, or "toggle" to switch.',
    z.object({
      action: z.enum(['show', 'hide', 'toggle'])
    }),
    async ({ action }) => {
      try {
        console.log('[AG-UI] Setting Statistics filters visibility:', action)
        window.dispatchEvent(new CustomEvent('activateComponent', {
          detail: { component: 'statistics.filters.show', action }
        }))
        return { success: true, message: `Filter panel: ${action}ed`, data: { action } }
      } catch (error) {
        return { success: false, error: `Failed to change filter panel visibility: ${error}` }
      }
    },
    'filter'
  )

  const clearStatisticsFilters = createTool(
    'clearStatisticsFilters',
    'Clear all active filters on the Statistics page and reset to show all trades.',
    z.object({}),
    async () => {
      try {
        console.log('[AG-UI] Clearing Statistics filters')
        window.dispatchEvent(new CustomEvent('activateComponent', {
          detail: { component: 'statistics.filters.clear', action: 'clear' }
        }))
        return { success: true, message: 'All filters cleared' }
      } catch (error) {
        return { success: false, error: `Failed to clear filters: ${error}` }
      }
    },
    'filter'
  )

  /**
   * SNAPSHOT & COMPARISON TOOLS
   * Enable Renata AI to capture, store, and compare page states
   */

  const createSnapshot = createTool(
    'createSnapshot',
    'Capture the current page state as a named snapshot for later comparison. Provide a descriptive name like "Long-only trades" or "Q4 2024 performance". Snapshots store filter state and all statistics.',
    z.object({
      name: z.string().min(1).max(50)
    }),
    async ({ name }) => {
      try {
        console.log('[AG-UI] Creating snapshot:', name)

        // Get current page context from global registry
        const contextEvent = new CustomEvent('getContextRequest')
        window.dispatchEvent(contextEvent)

        // Wait for context to be available (small delay for async context loading)
        await new Promise(resolve => setTimeout(resolve, 100))

        // Try to get context from localStorage event or use fallback
        const getContext = () => {
          // Try to get context from a global variable if set by context registry
          if ((window as any).__traderraContext) {
            return (window as any).__traderraContext
          }

          // Build minimal context from localStorage
          return {
            currentPage: localStorage.getItem('currentPage') || 'unknown',
            dateRange: localStorage.getItem('dateRange') || 'all',
            displayMode: localStorage.getItem('displayMode') || 'dollar',
            pnlMode: localStorage.getItem('pnlMode') || 'net'
          }
        }

        const context = getContext()

        // Create snapshot from context
        const snapshot = createSnapshotFromContext(
          name,
          context.currentPage as 'dashboard' | 'statistics',
          context,
          []
        )

        // Save snapshot
        snapshotStore.save(snapshot)

        // Notify app of new snapshot
        window.dispatchEvent(new CustomEvent('snapshotCreated', {
          detail: { snapshot }
        }))

        console.log('[AG-UI] Snapshot created:', snapshot)

        return {
          success: true,
          message: `Snapshot "${name}" saved with ${snapshot.statistics.totalTrades} trades. ` +
                   `Win rate: ${snapshot.statistics.winRate.toFixed(1)}%, ` +
                   `Total P&L: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(snapshot.statistics.totalGainLoss)}`,
          data: { snapshotId: snapshot.id, snapshot }
        }
      } catch (error) {
        console.error('[AG-UI] Failed to create snapshot:', error)
        return { success: false, error: `Failed to create snapshot: ${error}` }
      }
    },
    'snapshot'
  )

  const listSnapshots = createTool(
    'listSnapshots',
    'List all saved snapshots with their names, timestamps, and key statistics. Shows trade count, win rate, and total P&L for each snapshot.',
    z.object({}),
    async () => {
      try {
        console.log('[AG-UI] Listing snapshots')
        const summaries = snapshotStore.listSummaries()

        console.log('[AG-UI] Found snapshots:', summaries.length)

        return {
          success: true,
          message: summaries.length > 0
            ? `Found ${summaries.length} snapshot${summaries.length === 1 ? '' : 's'}`
            : 'No snapshots saved yet',
          data: {
            count: summaries.length,
            canCreateMore: snapshotStore.canCreateMore(),
            maxSnapshots: 10,
            snapshots: summaries.map(s => ({
              id: s.id,
              name: s.name,
              timestamp: s.timestamp,
              date: new Date(s.timestamp).toLocaleString(),
              page: s.page,
              tradeCount: s.tradeCount,
              winRate: `${s.winRate.toFixed(1)}%`,
              totalPnL: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(s.totalPnL)
            }))
          }
        }
      } catch (error) {
        console.error('[AG-UI] Failed to list snapshots:', error)
        return { success: false, error: `Failed to list snapshots: ${error}` }
      }
    },
    'snapshot'
  )

  const compareSnapshots = createTool(
    'compareSnapshots',
    'Compare two saved snapshots and generate insights about performance differences. Provide the names or IDs of the snapshots to compare.',
    z.object({
      snapshot1: z.string(),
      snapshot2: z.string()
    }),
    async ({ snapshot1, snapshot2 }) => {
      try {
        console.log('[AG-UI] Comparing snapshots:', snapshot1, snapshot2)

        const s1 = snapshotStore.getByNameOrId(snapshot1)
        const s2 = snapshotStore.getByNameOrId(snapshot2)

        if (!s1) {
          return { success: false, error: `First snapshot "${snapshot1}" not found` }
        }
        if (!s2) {
          return { success: false, error: `Second snapshot "${snapshot2}" not found` }
        }

        const comparison = compareSnapshots(s1, s2)

        console.log('[AG-UI] Comparison result:', comparison)

        // Notify app of comparison
        window.dispatchEvent(new CustomEvent('snapshotsCompared', {
          detail: { comparison }
        }))

        // Format differences for AI response
        const differencesText = comparison.differences.map(d => d.insight).join('\n')
        const summaryText = comparison.summary.join('\n')

        return {
          success: true,
          message: `Compared "${s1.name}" vs "${s2.name}"\n\n` +
                   `**Key Differences:**\n${differencesText}\n\n` +
                   `**Summary:**\n${summaryText}`,
          data: { comparison }
        }
      } catch (error) {
        console.error('[AG-UI] Failed to compare snapshots:', error)
        return { success: false, error: `Failed to compare snapshots: ${error}` }
      }
    },
    'snapshot'
  )

  const compareCurrentWithSnapshot = createTool(
    'compareCurrentWithSnapshot',
    'Compare the current page state with a previously saved snapshot. This captures the current state and compares it with the saved snapshot.',
    z.object({
      snapshotName: z.string()
    }),
    async ({ snapshotName }) => {
      try {
        console.log('[AG-UI] Comparing current with snapshot:', snapshotName)

        const saved = snapshotStore.getByNameOrId(snapshotName)
        if (!saved) {
          return { success: false, error: `Snapshot "${snapshotName}" not found` }
        }

        // Capture current state
        const getContext = () => {
          if ((window as any).__traderraContext) {
            return (window as any).__traderraContext
          }
          return {
            currentPage: localStorage.getItem('currentPage') || 'unknown',
            dateRange: localStorage.getItem('dateRange') || 'all',
            displayMode: localStorage.getItem('displayMode') || 'dollar',
            pnlMode: localStorage.getItem('pnlMode') || 'net'
          }
        }

        const currentContext = getContext()
        const currentSnapshot = createSnapshotFromContext(
          'Current State',
          currentContext.currentPage as 'dashboard' | 'statistics',
          currentContext,
          []
        )

        const comparison = compareSnapshots(currentSnapshot, saved)

        console.log('[AG-UI] Comparison with current:', comparison)

        // Format differences for AI response
        const differencesText = comparison.differences.map(d => d.insight).join('\n')
        const summaryText = comparison.summary.join('\n')

        return {
          success: true,
          message: `Comparing current state with "${saved.name}"\n\n` +
                   `**Key Differences:**\n${differencesText}\n\n` +
                   `**Summary:**\n${summaryText}`,
          data: { comparison }
        }
      } catch (error) {
        console.error('[AG-UI] Failed to compare current with snapshot:', error)
        return { success: false, error: `Failed to compare: ${error}` }
      }
    },
    'snapshot'
  )

  const deleteSnapshot = createTool(
    'deleteSnapshot',
    'Delete a previously saved snapshot. Provide the name or ID of the snapshot to delete.',
    z.object({
      snapshotName: z.string()
    }),
    async ({ snapshotName }) => {
      try {
        console.log('[AG-UI] Deleting snapshot:', snapshotName)

        const snapshot = snapshotStore.getByNameOrId(snapshotName)
        if (!snapshot) {
          return { success: false, error: `Snapshot "${snapshotName}" not found` }
        }

        const deleted = snapshotStore.deleteByNameOrId(snapshotName)

        if (deleted) {
          // Notify app of deletion
          window.dispatchEvent(new CustomEvent('snapshotDeleted', {
            detail: { snapshotId: snapshot.id, name: snapshot.name }
          }))

          return {
            success: true,
            message: `Deleted snapshot "${snapshot.name}"`,
            data: { deletedId: snapshot.id, name: snapshot.name }
          }
        } else {
          return { success: false, error: `Failed to delete snapshot "${snapshotName}"` }
        }
      } catch (error) {
        console.error('[AG-UI] Failed to delete snapshot:', error)
        return { success: false, error: `Failed to delete snapshot: ${error}` }
      }
    },
    'snapshot'
  )

  /**
   * Return all tools as a registry
   */
  return {
    // Navigation
    navigateToPage,
    navigateChartDay,

    // Display
    setDisplayMode,
    setViewMode,

    // Sort
    setSortField,
    setSortDirection,

    // Modals
    openUploadModal,
    uploadTradeFile,
    importTradesFromFile,

    // Projects
    createNewProject,
    selectProject,

    // Date
    setDateRange,

    // Tabs
    setStatsTab,

    // AI
    toggleAISidebar,

    // Scan
    runScan,
    saveScan,

    // Component Interaction (Unified System)
    activateComponent,
    scrollToElement,
    setComponentState,

    // Statistics Page Filters
    setStatisticsSymbolFilter,
    setStatisticsStrategyFilter,
    setStatisticsSideFilter,
    setStatisticsDurationFilter,
    showStatisticsFilters,
    clearStatisticsFilters,

    // Snapshot & Comparison
    createSnapshot,
    listSnapshots,
    compareSnapshots,
    compareCurrentWithSnapshot,
    deleteSnapshot,
  }
}

export type FrontendToolsRegistry = ReturnType<typeof createFrontendTools>
