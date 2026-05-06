'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDateRange } from '@/contexts/TraderraContext'
import { useDisplayMode } from '@/contexts/TraderraContext'
import { usePnLMode } from '@/contexts/TraderraContext'

/**
 * Enhanced Renata Multi-Command Processor
 *
 * Handles complex multi-command messages with sophisticated trading language understanding.
 * Supports sequential execution, context-aware interpretation, and comprehensive error handling.
 */

export interface ParsedCommand {
  type: 'navigate' | 'display_mode' | 'date_range' | 'pnl_mode' | 'analysis' | 'help'
  action: string
  parameters: Record<string, any>
  confidence: number
  original_text: string
}

export interface ProcessingResult {
  success: boolean
  commands: ParsedCommand[]
  executed: string[]
  failed: string[]
  errors: string[]
  summary: string
}

export class EnhancedRenataProcessor {
  private router: ReturnType<typeof useRouter>
  private setDateRange: ReturnType<typeof useDateRange>['setDateRange']
  private setDisplayMode: ReturnType<typeof useDisplayMode>['setDisplayMode']
  private setPnLMode: ReturnType<typeof usePnLMode>['setPnLMode']

  constructor(
    router: ReturnType<typeof useRouter>,
    dateRangeContext: ReturnType<typeof useDateRange>,
    displayModeContext: ReturnType<typeof useDisplayMode>,
    pnlModeContext: ReturnType<typeof usePnLMode>
  ) {
    this.router = router
    this.setDateRange = dateRangeContext.setDateRange
    this.setDisplayMode = displayModeContext.setDisplayMode
    this.setPnLMode = pnlModeContext.setPnLMode
  }

  /**
   * Comprehensive trading language patterns
   */
  private tradingPatterns = {
    // Navigation patterns
    navigation: {
      patterns: [
        /(?:take me to|go to|navigate to|show me|open|switch to|visit)\s+(.+)/i,
        /(.+)\s+(?:page|dashboard|view|screen|section)/i,
        /i want to see\s+(.+)/i,
        /let's check\s+(.+)/i
      ],
      keywords: {
        'dashboard': ['dashboard', 'main', 'home', 'overview', 'summary'],
        'trades': ['trades', 'positions', 'positions', 'portfolio'],
        'journal': ['journal', 'diary', 'log', 'entries', 'notes'],
        'analytics': ['analytics', 'analysis', 'insights', 'reports', 'statistics', 'stats'],
        'calendar': ['calendar', 'schedule', 'timeline', 'dates'],
        'settings': ['settings', 'preferences', 'config', 'configuration']
      }
    },

    // Display mode patterns
    displayModes: {
      dollar: [
        /(?:show|display|switch to|change to|view in)\s+dollars/i,
        /(?:show|display|switch to|change to|view in)\s+\$/i,
        /(?:use|using)\s+dollars/i,
        /(?:show|display)\s+(?:actual|real)\s+money/i
      ],
      r_multiple: [
        /(?:show|display|switch to|change to|view in)\s+r-multiples?/i,
        /(?:show|display|switch to|change to|view in)\s+r\s*multiples?/i,
        /(?:use|using)\s+r-multiples?/i,
        /(?:show|display)\s+(?:risk|reward)\s+ratio/i
      ]
    },

    // Date range patterns - extensive trading terminology
    dateRanges: {
      today: [
        /(?:show|view|filter|set to)\s+today/i,
        /(?:show|view|filter|set to)\s+today's/i,
        /(?:just|only)\s+today/i,
        /current\s+day/i
      ],
      week: [
        /(?:show|view|filter|set to)\s+(?:this\s+)?week/i,
        /(?:show|view|filter|set to)\s+last\s+7\s+days?/i,
        /(?:show|view|filter|set to)\s+7d/i,
        /(?:show|view|filter|set to)\s+one\s+week/i,
        /(?:this|current)\s+week/i
      ],
      month: [
        /(?:show|view|filter|set to)\s+(?:this\s+)?month/i,
        /(?:show|view|filter|set to)\s+last\s+30\s+days?/i,
        /(?:show|view|filter|set to)\s+30d/i,
        /(?:show|view|filter|set to)\s+one\s+month/i,
        /(?:this|current)\s+month/i,
        /(?:past|last)\s+month/i
      ],
      quarter: [
        /(?:show|view|filter|set to)\s+(?:this\s+)?quarter/i,
        /(?:show|view|filter|set to)\s+last\s+quarter/i,
        /(?:show|view|filter|set to)\s+3\s+months?/i,
        /(?:show|view|filter|set to)\s+90d/i,
        /(?:this|current)\s+quarter/i
      ],
      year: [
        /(?:show|view|filter|set to)\s+(?:this\s+)?year/i,
        /(?:show|view|filter|set to)\s+ytd/i,
        /(?:show|view|filter|set to)\s+year\s+to\s+date/i,
        /(?:show|view|filter|set to)\s+current\s+year/i,
        /(?:show|view|filter|set to)\s+12\s+months?/i,
        /ytd/i,
        /year\s+to\s+date/i
      ],
      all: [
        /(?:show|view|filter|set to)\s+all\s+(?:time|data|trades?)/i,
        /(?:show|view|filter|set to)\s+(?:entire|full)\s+(?:history|period)/i,
        /(?:show|view|filter|set to)\s+max/i,
        /(?:show|view|filter|set to)\s+(?:everything|all)/i,
        /no\s+(?:filter|date\s+limit|time\s+range)/i
      ]
    },

    // P&L mode patterns
    pnlModes: {
      absolute: [
        /(?:show|display|switch to|change to)\s+absolute\s+pn[il]/i,
        /(?:show|display)\s+(?:actual|real)\s+(?:pnl|profit\s+and\s+loss)/i,
        /(?:show|display)\s+(?:dollar|money)\s+(?:amounts?|values?)/i
      ],
      percentage: [
        /(?:show|display|switch to|change to)\s+percentage\s+pn[il]/i,
        /(?:show|display)\s+(?:returns|results)\s+in\s+percentages?/i,
        /(?:show|display)\s+%/i
      ],
      per_dollar: [
        /(?:show|display|switch to|change to)\s+per\s+dollar\s+pn[il]/i,
        /(?:show|display)\s+r\s+per\s+dollar/i,
        /(?:show|display)\s+r-multiple/i
      ]
    },

    // Analysis patterns
    analysis: {
      performance: [
        /(?:analyze|review|check)\s+(?:my\s+)?performance/i,
        /(?:how\s+)?(?:did|am)\s+i\s+(?:doing|performing)/i,
        /(?:show|tell\s+me)\s+(?:my\s+)?(?:performance|results)/i,
        /(?:what's|how\s+is)\s+(?:my\s+)?(?:performance|progress)/i
      ],
      trades: [
        /(?:analyze|review|show)\s+(?:my\s+)?trades?/i,
        /(?:how\s+)?(?:did|are)\s+my\s+trades?\s+(?:doing|performing)/i,
        /(?:show|tell\s+me)\s+about\s+my\s+trades?/i,
        /(?:review|check)\s+(?:recent|latest)\s+trades?/i
      ],
      risk: [
        /(?:analyze|review|check)\s+(?:my\s+)?risk/i,
        /(?:how's|what's)\s+(?:my\s+)?risk\s+(?:management|level)/i,
        /(?:show|tell\s+me)\s+about\s+risk/i,
        /(?:am\s+i)?\s+(?:managing|controlling)\s+risk/i
      ]
    }
  }

  /**
   * Parse user message into individual commands
   */
  public parseMessage(message: string): ParsedCommand[] {
    const commands: ParsedCommand[] = []
    const cleanedMessage = message.toLowerCase().trim()

    // Split message into command segments
    const segments = this.splitIntoCommands(cleanedMessage)

    for (const segment of segments) {
      const command = this.parseCommand(segment, message)
      if (command) {
        commands.push(command)
      }
    }

    return commands
  }

  /**
   * Split message into individual commands
   */
  private splitIntoCommands(message: string): string[] {
    // Split on common command separators
    const separators = [
      /\s+and\s+/,
      /\s+then\s+/,
      /\s+also\s+/,
      /\s+plus\s+/,
      /\s+after\s+that\s+/,
      /\s+next\s+/,
      /\s+,/,
      /;\s*/,
      /\.\s+/
    ]

    let segments = [message]

    for (const separator of separators) {
      const newSegments: string[] = []
      for (const segment of segments) {
        const split = segment.split(separator)
        newSegments.push(...split.map(s => s.trim()).filter(s => s.length > 0))
      }
      segments = newSegments
    }

    return segments
  }

  /**
   * Parse individual command
   */
  private parseCommand(segment: string, originalMessage: string): ParsedCommand | null {
    // Check navigation commands
    for (const pattern of this.tradingPatterns.navigation.patterns) {
      const match = segment.match(pattern)
      if (match) {
        const destination = match[1].trim()
        const mappedDestination = this.mapNavigationDestination(destination)
        if (mappedDestination) {
          return {
            type: 'navigate',
            action: 'navigateToPage',
            parameters: { page: mappedDestination },
            confidence: 0.9,
            original_text: originalMessage
          }
        }
      }
    }

    // Check keyword-based navigation
    for (const [page, keywords] of Object.entries(this.tradingPatterns.navigation.keywords)) {
      for (const keyword of keywords) {
        if (segment.includes(keyword)) {
          return {
            type: 'navigate',
            action: 'navigateToPage',
            parameters: { page },
            confidence: 0.8,
            original_text: originalMessage
          }
        }
      }
    }

    // Check display mode commands
    if (this.matchesPatterns(segment, this.tradingPatterns.displayModes.dollar)) {
      return {
        type: 'display_mode',
        action: 'setDisplayMode',
        parameters: { mode: 'dollar' },
        confidence: 0.9,
        original_text: originalMessage
      }
    }

    if (this.matchesPatterns(segment, this.tradingPatterns.displayModes.r_multiple)) {
      return {
        type: 'display_mode',
        action: 'setDisplayMode',
        parameters: { mode: 'r' },
        confidence: 0.9,
        original_text: originalMessage
      }
    }

    // Check date range commands
    for (const [range, patterns] of Object.entries(this.tradingPatterns.dateRanges)) {
      if (this.matchesPatterns(segment, patterns)) {
        return {
          type: 'date_range',
          action: 'setDateRange',
          parameters: { range },
          confidence: 0.9,
          original_text: originalMessage
        }
      }
    }

    // Check P&L mode commands
    for (const [mode, patterns] of Object.entries(this.tradingPatterns.pnlModes)) {
      if (this.matchesPatterns(segment, patterns)) {
        return {
          type: 'pnl_mode',
          action: 'setPnLMode',
          parameters: { mode },
          confidence: 0.9,
          original_text: originalMessage
        }
      }
    }

    // Check analysis commands
    for (const [analysisType, patterns] of Object.entries(this.tradingPatterns.analysis)) {
      if (this.matchesPatterns(segment, patterns)) {
        return {
          type: 'analysis',
          action: 'performAnalysis',
          parameters: { type: analysisType },
          confidence: 0.8,
          original_text: originalMessage
        }
      }
    }

    // Check help commands
    if (segment.match(/(?:help|what\s+can\s+you\s+do|commands|features)/i)) {
      return {
        type: 'help',
        action: 'showHelp',
        parameters: {},
        confidence: 0.95,
        original_text: originalMessage
      }
    }

    return null
  }

  /**
   * Check if text matches any pattern in the array
   */
  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text))
  }

  /**
   * Map natural language destination to page name
   */
  private mapNavigationDestination(destination: string): string | null {
    const mapping: Record<string, string> = {
      'dashboard': 'dashboard',
      'main': 'dashboard',
      'home': 'dashboard',
      'overview': 'dashboard',
      'summary': 'dashboard',

      'trades': 'trades',
      'positions': 'trades',
      'portfolio': 'trades',

      'journal': 'journal',
      'diary': 'journal',
      'log': 'journal',
      'entries': 'journal',
      'notes': 'journal',

      'analytics': 'analytics',
      'analysis': 'analytics',
      'insights': 'analytics',
      'reports': 'analytics',
      'statistics': 'analytics',
      'stats': 'statistics',

      'calendar': 'calendar',
      'schedule': 'calendar',
      'timeline': 'calendar',
      'dates': 'calendar',

      'settings': 'settings',
      'preferences': 'settings',
      'config': 'settings',
      'configuration': 'settings'
    }

    return mapping[destination.toLowerCase()] || null
  }

  /**
   * Execute parsed commands
   */
  public async executeCommands(commands: ParsedCommand[]): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: true,
      commands,
      executed: [],
      failed: [],
      errors: [],
      summary: ''
    }

    for (const command of commands) {
      try {
        const executionResult = await this.executeCommand(command)
        if (executionResult.success) {
          result.executed.push(executionResult.message)
        } else {
          result.failed.push(executionResult.message)
          result.errors.push(executionResult.error || 'Unknown error')
          result.success = false
        }
      } catch (error) {
        const errorMsg = `Failed to execute command: ${command.action}`
        result.failed.push(errorMsg)
        result.errors.push(error instanceof Error ? error.message : 'Unknown error')
        result.success = false
      }

      // Add small delay between commands for better UX
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    // Generate summary
    if (result.executed.length > 0 && result.failed.length === 0) {
      result.summary = `✅ Successfully executed ${result.executed.length} command${result.executed.length > 1 ? 's' : ''}: ${result.executed.join(', ')}`
    } else if (result.executed.length > 0 && result.failed.length > 0) {
      result.summary = `⚠️ Partially executed: ${result.executed.length} succeeded, ${result.failed.length} failed`
    } else if (result.failed.length > 0) {
      result.summary = `❌ Failed to execute all ${result.failed.length} command${result.failed.length > 1 ? 's' : ''}`
    } else {
      result.summary = "ℹ️ No commands were recognized"
    }

    return result
  }

  /**
   * Execute individual command
   */
  private async executeCommand(command: ParsedCommand): Promise<{ success: boolean; message: string; error?: string }> {
    console.log(`🚀 EXECUTING COMMAND: ${command.action}`, command.parameters)

    switch (command.action) {
      case 'navigateToPage':
        try {
          const page = command.parameters.page
          const pageMap: Record<string, string> = {
            'dashboard': '/dashboard',
            'trades': '/trades',
            'journal': '/journal',
            'analytics': '/analytics',
            'statistics': '/statistics',
            'calendar': '/calendar',
            'settings': '/settings'
          }

          const targetUrl = pageMap[page]
          if (!targetUrl) {
            return { success: false, message: '', error: `Unknown page: ${page}` }
          }

          this.router.push(targetUrl)
          return { success: true, message: `Navigated to ${page} page` }
        } catch (error) {
          return { success: false, message: '', error: `Navigation failed: ${error}` }
        }

      case 'setDisplayMode':
        try {
          const mode = command.parameters.mode
          if (mode === 'dollar' || mode === 'r') {
            this.setDisplayMode(mode)
            return { success: true, message: `Display mode changed to ${mode === 'dollar' ? 'dollars' : 'R-multiples'}` }
          } else {
            return { success: false, message: '', error: `Invalid display mode: ${mode}` }
          }
        } catch (error) {
          return { success: false, message: '', error: `Display mode change failed: ${error}` }
        }

      case 'setDateRange':
        try {
          const range = command.parameters.range
          const rangeMap: Record<string, any> = {
            'today': 'today',
            'week': 'week',
            'month': 'month',
            'quarter': 'quarter',
            'year': 'year',
            'all': 'all',
            '90d': '90day'
          }

          const contextRange = rangeMap[range] || range
          this.setDateRange(contextRange)
          return { success: true, message: `Date range set to ${range}` }
        } catch (error) {
          return { success: false, message: '', error: `Date range change failed: ${error}` }
        }

      case 'setPnLMode':
        try {
          const mode = command.parameters.mode
          const validModes = ['absolute', 'percentage', 'per_dollar']
          if (validModes.includes(mode)) {
            this.setPnLMode(mode as any)
            return { success: true, message: `P&L mode changed to ${mode}` }
          } else {
            return { success: false, message: '', error: `Invalid P&L mode: ${mode}` }
          }
        } catch (error) {
          return { success: false, message: '', error: `P&L mode change failed: ${error}` }
        }

      case 'performAnalysis':
        return { success: true, message: `Analysis request for ${command.parameters.type} - navigating to appropriate page` }

      case 'showHelp':
        const helpMessage = this.getHelpMessage()
        return { success: true, message: helpMessage }

      default:
        return { success: false, message: '', error: `Unknown command action: ${command.action}` }
    }
  }

  /**
   * Generate help message
   */
  private getHelpMessage(): string {
    return `🤖 **Renata Commands Available:**

**Navigation:**
• "Take me to dashboard/journal/analytics/trades"
• "Show me my performance"
• "Go to settings"

**Display Modes:**
• "Switch to dollars" or "Show in $"
• "Switch to R-multiples" or "Show in R"

**Date Ranges:**
• "Show me this week/month/quarter/year"
• "Filter to YTD" or "Show last 30 days"
• "Show all trades" or "No date filter"

**P&L Modes:**
• "Show absolute P&L" or "Show actual amounts"
• "Show percentage P&L" or "Show returns in %"
• "Show per dollar P&L" or "Show R-multiple"

**Multi-Command Examples:**
• "Go to dashboard and switch to R-multiples"
• "Show me last month trades in dollars"
• "Navigate to analytics and filter to YTD"

You can combine commands with "and", "then", "also", commas, or periods!`
  }

  /**
   * Get comprehensive command suggestions based on context
   */
  public getCommandSuggestions(context: string = ''): string[] {
    const suggestions = [
      "Take me to dashboard",
      "Show me this week's trades",
      "Switch to R-multiples",
      "Go to analytics and filter to YTD",
      "Show me my journal entries for last month",
      "Navigate to trades and show in dollars",
      "Analyze my performance",
      "Show all trades in percentage P&L",
      "Go to settings"
    ]

    return suggestions.slice(0, 8)
  }
}

/**
 * Hook for using the Enhanced Renata Processor
 */
export function useEnhancedRenataProcessor() {
  const router = useRouter()
  const { setDateRange } = useDateRange()
  const { setDisplayMode } = useDisplayMode()
  const { setPnLMode } = usePnLMode()

  return new EnhancedRenataProcessor(
    router,
    { setDateRange },
    { setDisplayMode },
    { setPnLMode }
  )
}