/**
 * ENHANCED MULTI-COMMAND EXECUTION SYSTEM WITH FULL CALENDAR SUPPORT
 * Bridges the gap between planning layer and execution layer
 * Executes complete command sequences including advanced calendar interactions
 */

import { parseMultiCommand, generateExecutionPlan, type ParsedCommand } from './command-parser'
import { precisionClick, selectAIMode } from './precision-selectors'
import { advancedDateParser, type DateRange } from './advanced-date-parser'

export interface ExecutionResult {
  action: string
  success: boolean
  details: string
  timestamp: Date
}

export interface MultiCommandResult {
  totalActions: number
  successfulActions: number
  executionResults: ExecutionResult[]
  overallSuccess: boolean
  executionPlan: string[]
  failedActions: ExecutionResult[]
}

/**
 * NAVIGATION EXECUTOR
 * Handles page navigation with multiple fallback methods
 */
async function executeNavigation(target: string): Promise<ExecutionResult> {
  const startTime = Date.now()

  try {
    console.log(`🧭 MULTI-COMMAND: Executing navigation to ${target}`)

    // Navigation mapping
    const navigationMap: Record<string, string> = {
      'dashboard': '/dashboard',
      'stats': '/stats',
      'statistics': '/stats',
      'trades': '/trades',
      'trading': '/trades',
      'journal': '/journal',
      'calendar': '/calendar',
      'settings': '/settings'
    }

    const targetPath = navigationMap[target.toLowerCase()]
    if (!targetPath) {
      return {
        action: 'navigation',
        success: false,
        details: `Unknown navigation target: ${target}`,
        timestamp: new Date()
      }
    }

    // Multiple navigation strategies
    const strategies = [
      // Strategy 1: Direct link navigation
      async () => {
        const link = document.querySelector(`a[href="${targetPath}"]`)
        if (link) {
          (link as HTMLElement).click()
          return true
        }
        return false
      },

      // Strategy 2: Next.js router (if available)
      async () => {
        const router = (window as any).next?.router
        if (router) {
          router.push(targetPath)
          return true
        }
        return false
      },

      // Strategy 3: Direct window navigation
      async () => {
        if (typeof window !== 'undefined') {
          window.location.href = targetPath
          return true
        }
        return false
      },

      // Strategy 4: Button-based navigation
      async () => {
        const navButton = document.querySelector(`button:has-text("${target}"), [data-nav-target="${target}"]`)
        if (navButton) {
          (navButton as HTMLElement).click()
          return true
        }
        return false
      }
    ]

    // Try each strategy
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`   Trying navigation strategy ${i + 1}...`)
        const success = await strategies[i]()
        if (success) {
          console.log(`   ✅ Navigation strategy ${i + 1} succeeded`)

          // Wait for navigation to complete
          await new Promise(resolve => setTimeout(resolve, 1500))

          return {
            action: 'navigation',
            success: true,
            details: `Successfully navigated to ${target} using strategy ${i + 1}`,
            timestamp: new Date()
          }
        }
      } catch (error) {
        console.log(`   ❌ Navigation strategy ${i + 1} failed: ${error}`)
      }
    }

    return {
      action: 'navigation',
      success: false,
      details: `All navigation strategies failed for target: ${target}`,
      timestamp: new Date()
    }

  } catch (error) {
    return {
      action: 'navigation',
      success: false,
      details: `Navigation error: ${error}`,
      timestamp: new Date()
    }
  }
}

/**
 * ENHANCED DATE RANGE EXECUTOR
 * Handles both legacy presets and advanced natural language date ranges
 */
async function executeDateRange(parsed: ParsedCommand): Promise<ExecutionResult> {
  try {
    const dateRange = parsed.dateRange!
    console.log(`📅 MULTI-COMMAND: Executing advanced date range change`, {
      value: dateRange.value,
      type: dateRange.type,
      description: dateRange.description
    })

    let success = false

    switch (dateRange.type) {
      case 'preset':
        // Use legacy precision selectors for basic presets
        success = await precisionClick('dateRange', dateRange.value)
        break

      case 'natural_language':
      case 'calendar_widget':
        // Use advanced calendar integration
        if (dateRange.dateObject) {
          success = await executeAdvancedDateSelection(dateRange.dateObject)
        } else {
          // Fallback to precision selector if no date object
          success = await precisionClick('dateRange', dateRange.value)
        }
        break

      default:
        // Fallback to precision selector
        success = await precisionClick('dateRange', dateRange.value)
    }

    if (success) {
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 800))

      return {
        action: 'dateRange',
        success: true,
        details: `Date range set to ${dateRange.value} (${dateRange.description})`,
        timestamp: new Date()
      }
    } else {
      return {
        action: 'dateRange',
        success: false,
        details: `Failed to set date range to ${dateRange.value} - no selector found`,
        timestamp: new Date()
      }
    }
  } catch (error) {
    return {
      action: 'dateRange',
      success: false,
      details: `Date range error: ${error}`,
      timestamp: new Date()
    }
  }
}

/**
 * ADVANCED DATE SELECTION EXECUTOR
 * Handles natural language date selection using DateRangeContext
 */
async function executeAdvancedDateSelection(dateObject: { start: Date; end: Date; label: string }): Promise<boolean> {
  try {
    console.log(`📅 ADVANCED DATE SELECTION: Setting custom range`, dateObject)

    // Try to access the DateRangeContext directly
    const dateRangeContext = (window as any).dateRangeContext

    if (dateRangeContext && dateRangeContext.setCustomRange) {
      await dateRangeContext.setCustomRange(dateObject.start, dateObject.end)
      return true
    }

    // Fallback: dispatch a custom event that the context can listen for
    const event = new CustomEvent('calendar-date-range-change', {
      detail: {
        start: dateObject.start,
        end: dateObject.end,
        label: dateObject.label,
        source: 'advanced-calendar-executor'
      }
    })

    window.dispatchEvent(event)

    // Wait a bit for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 500))

    return true
  } catch (error) {
    console.warn('Advanced date selection failed:', error)
    return false
  }
}

/**
 * CALENDAR INTERACTION EXECUTOR
 * Handles calendar-specific interactions and pattern applications
 */
async function executeCalendarInteraction(interaction: NonNullable<ParsedCommand['calendarInteraction']>): Promise<ExecutionResult> {
  try {
    console.log(`🗓️ CALENDAR INTERACTION: ${interaction.type}`, {
      value: interaction.value,
      description: interaction.description
    })

    let success = false

    switch (interaction.type) {
      case 'trading_pattern':
        success = await executeTradingPattern(interaction.value)
        break

      case 'quarter_selection':
        success = await executeQuarterSelection(interaction.value)
        break

      case 'component_generation':
        success = await executeCalendarComponentGeneration()
        break

      case 'date_selection':
        // Parse the natural language and apply
        const parsedDate = advancedDateParser.parse(interaction.naturalLanguage)
        if (parsedDate) {
          success = await executeAdvancedDateSelection(parsedDate)
        }
        break

      default:
        console.warn(`Unknown calendar interaction type: ${interaction.type}`)
        success = false
    }

    return {
      action: 'calendarInteraction',
      success,
      details: success
        ? `Successfully executed ${interaction.description}`
        : `Failed to execute ${interaction.description}`,
      timestamp: new Date()
    }
  } catch (error) {
    return {
      action: 'calendarInteraction',
      success: false,
      details: `Calendar interaction error: ${error}`,
      timestamp: new Date()
    }
  }
}

/**
 * TRADING PATTERN EXECUTOR
 * Applies trading-specific date patterns (earnings, options, Fed meetings)
 */
async function executeTradingPattern(pattern: string): Promise<boolean> {
  try {
    console.log(`📊 TRADING PATTERN: Applying ${pattern}`)

    // Use the advanced date parser to get the pattern's date range
    const dateRange = advancedDateParser.parse(pattern)

    if (dateRange) {
      return await executeAdvancedDateSelection(dateRange)
    } else {
      console.warn(`Could not parse trading pattern: ${pattern}`)
      return false
    }
  } catch (error) {
    console.error('Trading pattern execution failed:', error)
    return false
  }
}

/**
 * QUARTER SELECTION EXECUTOR
 * Handles quarter navigation (Q1, Q2, Q3, Q4)
 */
async function executeQuarterSelection(quarter: string): Promise<boolean> {
  try {
    console.log(`📊 QUARTER SELECTION: ${quarter}`)

    // Parse quarter with current year
    const currentYear = new Date().getFullYear()
    const quarterExpression = quarter.toUpperCase().startsWith('Q') ? `${quarter} ${currentYear}` : quarter

    const dateRange = advancedDateParser.parse(quarterExpression)

    if (dateRange) {
      return await executeAdvancedDateSelection(dateRange)
    } else {
      console.warn(`Could not parse quarter: ${quarter}`)
      return false
    }
  } catch (error) {
    console.error('Quarter selection failed:', error)
    return false
  }
}

/**
 * CALENDAR COMPONENT GENERATION EXECUTOR
 * Triggers AGUI calendar component generation
 */
async function executeCalendarComponentGeneration(): Promise<boolean> {
  try {
    console.log(`🎨 CALENDAR COMPONENT: Generating interactive calendar components`)

    // Dispatch event to trigger AGUI calendar component generation
    const event = new CustomEvent('generate-calendar-agui-components', {
      detail: {
        componentTypes: ['calendar', 'date-picker', 'trading-calendar'],
        focusArea: 'calendar',
        source: 'multi-command-executor'
      }
    })

    window.dispatchEvent(event)
    return true
  } catch (error) {
    console.error('Calendar component generation failed:', error)
    return false
  }
}

/**
 * AGUI GENERATION EXECUTOR
 * Handles AGUI component generation requests
 */
async function executeAguiGeneration(aguiConfig: NonNullable<ParsedCommand['aguiGeneration']>): Promise<ExecutionResult> {
  try {
    console.log(`🎨 AGUI GENERATION: Generating components`, aguiConfig)

    // Dispatch event to trigger AGUI component generation
    const event = new CustomEvent('generate-agui-components', {
      detail: {
        componentTypes: aguiConfig.componentTypes,
        focusArea: aguiConfig.focusArea,
        calendarSpecific: aguiConfig.calendarSpecific,
        source: 'multi-command-executor'
      }
    })

    window.dispatchEvent(event)

    return {
      action: 'aguiGeneration',
      success: true,
      details: `Generated AGUI components: ${aguiConfig.componentTypes.join(', ')}`,
      timestamp: new Date()
    }
  } catch (error) {
    return {
      action: 'aguiGeneration',
      success: false,
      details: `AGUI generation error: ${error}`,
      timestamp: new Date()
    }
  }
}

/**
 * DISPLAY MODE EXECUTOR
 * Handles display mode changes using precision selectors
 */
async function executeDisplayMode(value: string): Promise<ExecutionResult> {
  try {
    console.log(`💰 MULTI-COMMAND: Executing display mode change to ${value}`)

    const success = await precisionClick('displayMode', value)

    if (success) {
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 500))

      return {
        action: 'displayMode',
        success: true,
        details: `Display mode set to ${value}`,
        timestamp: new Date()
      }
    } else {
      return {
        action: 'displayMode',
        success: false,
        details: `Failed to set display mode to ${value} - no selector found`,
        timestamp: new Date()
      }
    }
  } catch (error) {
    return {
      action: 'displayMode',
      success: false,
      details: `Display mode error: ${error}`,
      timestamp: new Date()
    }
  }
}

/**
 * AI MODE EXECUTOR
 * Handles AI mode changes using AI mode selectors
 */
async function executeAIMode(value: string): Promise<ExecutionResult> {
  try {
    console.log(`🤖 MULTI-COMMAND: Executing AI mode change to ${value}`)

    const success = await selectAIMode(value)

    if (success) {
      // Wait for mode change
      await new Promise(resolve => setTimeout(resolve, 300))

      return {
        action: 'aiMode',
        success: true,
        details: `AI mode set to ${value}`,
        timestamp: new Date()
      }
    } else {
      return {
        action: 'aiMode',
        success: false,
        details: `Failed to set AI mode to ${value} - no selector found`,
        timestamp: new Date()
      }
    }
  } catch (error) {
    return {
      action: 'aiMode',
      success: false,
      details: `AI mode error: ${error}`,
      timestamp: new Date()
    }
  }
}

/**
 * MAIN MULTI-COMMAND EXECUTOR
 * This is the bridge between planning and execution!
 */
export async function executeMultiCommand(userInput: string): Promise<MultiCommandResult> {
  console.log(`🎯 MULTI-COMMAND EXECUTOR: Processing "${userInput}"`)

  // STEP 1: Use the intelligent planning layer
  const parsed = parseMultiCommand(userInput)
  const executionPlan = generateExecutionPlan(parsed)

  console.log(`📋 EXECUTION PLAN:`, executionPlan)
  console.log(`🎯 DETECTED ACTIONS:`, parsed.detectedActions)

  // STEP 2: Execute ALL actions in the correct order
  const results: ExecutionResult[] = []

  // NAVIGATION FIRST (if detected)
  if (parsed.navigation) {
    console.log(`\n🧭 STEP 1: Navigation to ${parsed.navigation.target}`)
    const navResult = await executeNavigation(parsed.navigation.target)
    results.push(navResult)

    if (!navResult.success) {
      console.log(`⚠️ Navigation failed but continuing with remaining actions...`)
    }
  }

  // DATE RANGE SECOND (if detected) - Enhanced with advanced calendar support
  if (parsed.dateRange) {
    console.log(`\n📅 STEP 2: Enhanced date range to ${parsed.dateRange.value} (${parsed.dateRange.type})`)
    const dateResult = await executeDateRange(parsed)
    results.push(dateResult)
  }

  // CALENDAR INTERACTIONS THIRD (if detected) - New calendar-specific functionality
  if (parsed.calendarInteraction) {
    console.log(`\n🗓️ STEP 3: Calendar interaction - ${parsed.calendarInteraction.type}`)
    const calendarResult = await executeCalendarInteraction(parsed.calendarInteraction)
    results.push(calendarResult)
  }

  // AGUI GENERATION FOURTH (if detected) - Dynamic component generation
  if (parsed.aguiGeneration) {
    console.log(`\n🎨 STEP 4: AGUI generation - ${parsed.aguiGeneration.componentTypes.join(', ')}`)
    const aguiResult = await executeAguiGeneration(parsed.aguiGeneration)
    results.push(aguiResult)
  }

  // DISPLAY MODE FIFTH (if detected)
  if (parsed.displayMode) {
    console.log(`\n💰 STEP 5: Display mode to ${parsed.displayMode.value}`)
    const displayResult = await executeDisplayMode(parsed.displayMode.value)
    results.push(displayResult)
  }

  // AI MODE SIXTH (if detected)
  if (parsed.aiMode) {
    console.log(`\n🤖 STEP 6: AI mode to ${parsed.aiMode.value}`)
    const aiResult = await executeAIMode(parsed.aiMode.value)
    results.push(aiResult)
  }

  // STEP 3: Analyze results
  const successfulActions = results.filter(r => r.success).length
  const totalActions = results.length
  const failedActions = results.filter(r => !r.success)

  const result: MultiCommandResult = {
    totalActions,
    successfulActions,
    executionResults: results,
    overallSuccess: successfulActions === totalActions && totalActions > 0,
    executionPlan,
    failedActions
  }

  console.log(`\n📊 MULTI-COMMAND EXECUTION COMPLETE:`)
  console.log(`   Total Actions: ${totalActions}`)
  console.log(`   Successful: ${successfulActions}`)
  console.log(`   Success Rate: ${totalActions > 0 ? Math.round((successfulActions / totalActions) * 100) : 0}%`)
  console.log(`   Overall Success: ${result.overallSuccess}`)

  // Log individual results
  results.forEach((r, index) => {
    const status = r.success ? '✅' : '❌'
    console.log(`   ${index + 1}. ${status} ${r.action}: ${r.details}`)
  })

  return result
}

/**
 * CONVENIENCE FUNCTION FOR AI AGENT INTEGRATION
 * Executes multi-command and returns a user-friendly summary
 */
export async function executeAndSummarize(userInput: string): Promise<string> {
  const result = await executeMultiCommand(userInput)

  if (result.totalActions === 0) {
    return "No executable actions detected in the command."
  }

  if (result.overallSuccess) {
    const actionsList = result.executionResults.map(r => r.action).join(', ')
    return `✅ Successfully executed all ${result.totalActions} actions: ${actionsList}`
  } else {
    const successful = result.executionResults.filter(r => r.success)
    const failed = result.failedActions

    let summary = `⚠️ Partial execution: ${result.successfulActions}/${result.totalActions} actions completed.\n`

    if (successful.length > 0) {
      summary += `✅ Completed: ${successful.map(r => r.action).join(', ')}\n`
    }

    if (failed.length > 0) {
      summary += `❌ Failed: ${failed.map(r => `${r.action} (${r.details})`).join(', ')}`
    }

    return summary
  }
}

// Export the execution result interface for type checking
export type { ParsedCommand }