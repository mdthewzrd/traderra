/**
 * AG-UI Frontend Tools Type Definitions
 *
 * This file defines the type system for AG-UI frontend tools.
 * Frontend tools are functions that the AI agent can call directly
 * to control the UI, eliminating the need for brittle DOM scraping.
 */

import { z } from 'zod'

/**
 * Scroll behavior options
 */
export type ScrollBehavior = 'smooth' | 'instant' | 'auto'

/**
 * Result of a frontend tool execution
 */
export interface ToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Definition of a frontend tool
 */
export interface FrontendTool<TInput = any, TOutput = any> {
  /** Unique identifier for the tool */
  name: string

  /** Human-readable description for the AI agent */
  description: string

  /** Zod schema for input validation */
  schema?: z.ZodSchema<TInput>

  /** Function to execute the tool */
  execute: (input: TInput) => Promise<ToolResult<TOutput>>

  /** Optional category for grouping tools */
  category?: ToolCategory
}

/**
 * Tool categories for organization
 */
export type ToolCategory =
  | 'navigation'      // Page navigation
  | 'display'         // Display settings (modes, filters)
  | 'data'            // Data operations (import, export)
  | 'journal'         // Journal operations
  | 'trades'          // Trade management
  | 'analytics'       // Analytics and statistics
  | 'account'         // Account settings
  | 'component'       // Generic component interactions
  | 'filter'          // Filter controls
  | 'modal'           // Modal controls
  | 'project'         // Project management
  | 'date'            // Date and time controls
  | 'scan'            // Scanner operations
  | 'ai'              // AI and chat features

/**
 * Core frontend tools registry
 * All tools that the AI agent can call will be registered here
 */
export interface FrontendToolsRegistry {
  // Navigation tools
  navigateToPage: FrontendTool<{ page: string }, void>
  navigateChartDay: FrontendTool<{ dayOffset: number }, void>

  // Display tools
  setDisplayMode: FrontendTool<{ mode: DisplayMode }, void>
  setViewMode: FrontendTool<{ mode: 'table' | 'chart' }, void>

  // Sort tools
  setSortField: FrontendTool<{ field: 'ticker' | 'date' | 'gapPercent' | 'volume' | 'score' }, void>
  setSortDirection: FrontendTool<{ direction: 'asc' | 'desc' }, void>

  // Modal tools
  openUploadModal: FrontendTool<{}, void>

  // Project tools
  createNewProject: FrontendTool<{ name?: string }, void>
  selectProject: FrontendTool<{ projectId: string }, void>

  // Date tools
  setDateRange: FrontendTool<{ range: DateRange; startDate?: string; endDate?: string }, void>

  // Tab tools
  setStatsTab: FrontendTool<{ tab: 'overview' | 'analytics' | 'performance' }, void>

  // AI tools
  toggleAISidebar: FrontendTool<{ open?: boolean }, void>

  // Scan tools
  runScan: FrontendTool<{}, void>
  saveScan: FrontendTool<{ name?: string }, void>

  // Component interaction tools (generic)
  activateComponent: FrontendTool<{ component: string; action?: string; value?: string }, void>
  scrollToElement: FrontendTool<{ element: string; behavior?: ScrollBehavior }, void>
  setComponentState: FrontendTool<{ component: string; state: any; property?: string }, void>

  // Statistics page filter tools
  setStatisticsSymbolFilter: FrontendTool<{ symbol: string }, void>
  setStatisticsStrategyFilter: FrontendTool<{ strategy: string }, void>
  setStatisticsSideFilter: FrontendTool<{ side: 'All' | 'Long' | 'Short' }, void>
  setStatisticsDurationFilter: FrontendTool<{ duration: string }, void>
  showStatisticsFilters: FrontendTool<{ action: 'show' | 'hide' | 'toggle' }, void>
  clearStatisticsFilters: FrontendTool<{}, void>

  // Legacy tools (for backwards compatibility)
  setPnLMode?: FrontendTool<{ mode: PnLMode }, void>
  setChartType?: FrontendTool<{ type: ChartType }, void>
  setAccountSize?: FrontendTool<{ size: number }, void>
  createJournalEntry?: FrontendTool<JournalEntryInput, { id: string }>
  updateJournalEntry?: FrontendTool<{ id: string; updates: Partial<JournalEntryInput> }, void>
  deleteJournalEntry?: FrontendTool<{ id: string }, void>
  importTrades?: FrontendTool<{ trades: ImportTrade[] }, { imported: number; errors: number }>
  updateTrade?: FrontendTool<{ id: string; updates: Partial<ImportTrade> }, void>
  deleteTrade?: FrontendTool<{ id: string }, void>
  setTradeFilter?: FrontendTool<{ filter: TradeFilter }, void>
  setSearchQuery?: FrontendTool<{ query: string }, void>
}

/**
 * Date range options
 */
export type DateRange =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'ytd'
  | '1y'
  | 'all'
  | 'custom'

/**
 * Display mode options
 */
export type DisplayMode =
  | 'dollar'        // Show dollar values
  | 'percent'       // Show percentage changes
  | 'r-multiple'    // Show R-multiple values

/**
 * P&L mode options
 */
export type PnLMode =
  | 'net'           // Net P&L (after fees)
  | 'gross'         // Gross P&L (before fees)

/**
 * Chart type options
 */
export type ChartType =
  | 'line'
  | 'bar'
  | 'area'
  | 'candlestick'
  | 'equity_curve'
  | 'drawdown'

/**
 * Journal entry input
 */
export interface JournalEntryInput {
  date: string
  title: string
  content: string
  tags?: string[]
  mood?: 'positive' | 'neutral' | 'negative'
  attachments?: string[]
}

/**
 * Import trade format
 */
export interface ImportTrade {
  date: string
  symbol: string
  side: 'Long' | 'Short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl?: number
  rMultiple?: number
  strategy?: string
  notes?: string
}

/**
 * Trade filter options
 */
export interface TradeFilter {
  symbols?: string[]
  strategies?: string[]
  side?: 'Long' | 'Short' | 'both'
  pnlRange?: { min?: number; max?: number }
  dateRange?: DateRange
  customDateRange?: { startDate: string; endDate: string }
}

/**
 * Tool execution context passed to tools
 */
export interface ToolContext {
  /** Current page */
  currentPage: string

  /** Current URL parameters */
  params: Record<string, string>

  /** Current UI state */
  uiState: {
    dateRange: DateRange
    displayMode: DisplayMode
    pnlMode: PnLMode
    accountSize: number
  }
}

/**
 * AG-UI event types for streaming
 */
export type AGUIEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; tool: string; args: any; result?: ToolResult }
  | { type: 'error'; error: string }
  | { type: 'done' }
  | { type: 'state_update'; state: Record<string, any> }
