/**
 * ENHANCED MULTI-COMMAND PARSER FOR BULLETPROOF AI AGENT
 * Parses complex commands with multiple actions INCLUDING advanced calendar support
 */

import { advancedDateParser } from './advanced-date-parser'

export interface ParsedCommand {
  navigation?: {
    target: 'dashboard' | 'stats' | 'trades' | 'journal' | 'calendar' | 'settings'
  }
  dateRange?: {
    value: string // Enhanced to support any date expression
    description: string
    type: 'preset' | 'natural_language' | 'calendar_widget'
    dateObject?: {
      start: Date
      end: Date
      label: string
    }
  }
  displayMode?: {
    value: '$' | 'R'
    description: string
  }
  aiMode?: {
    value: 'analyst' | 'coach' | 'mentor' | 'renata'
    description: string
  }
  calendarInteraction?: {
    type: 'navigation' | 'date_selection' | 'trading_pattern' | 'quarter_selection' | 'component_generation'
    value: string
    description: string
    naturalLanguage: string
  }
  aguiGeneration?: {
    componentTypes: string[]
    focusArea: string
    calendarSpecific: boolean
  }
  originalText: string
  detectedActions: string[]
}

export function parseMultiCommand(userInput: string): ParsedCommand {
  const input = userInput.toLowerCase()
  const result: ParsedCommand = {
    originalText: userInput,
    detectedActions: []
  }

  // Navigation parsing
  if (input.includes('dashboard')) {
    result.navigation = { target: 'dashboard' }
    result.detectedActions.push('Navigate to dashboard')
  } else if (input.includes('stats') || input.includes('statistics')) {
    result.navigation = { target: 'stats' }
    result.detectedActions.push('Navigate to statistics')
  } else if (input.includes('trades') || input.includes('trading')) {
    result.navigation = { target: 'trades' }
    result.detectedActions.push('Navigate to trades')
  } else if (input.includes('journal')) {
    result.navigation = { target: 'journal' }
    result.detectedActions.push('Navigate to journal')
  }

  // ENHANCED CALENDAR DATE RANGE PARSING
  // Uses advanced date parser for natural language expressions
  const datePatterns = [
    // Trading-specific patterns
    /earnings\s+season|options\s+expir|fed\s+meeting|fomc/i,
    // Quarter patterns
    /q[1-4]\s+\d{4}|quarter|quarterly/i,
    // Year patterns
    /ytd|year\s+to\s+date|this\s+year|last\s+year|\d{4}/i,
    // Month patterns
    /january|february|march|april|may|june|july|august|september|october|november|december|this\s+month|last\s+month/i,
    // Relative patterns
    /last\s+\d+\s+(days?|weeks?|months?)|past\s+\d+\s+(days?|weeks?|months?)|since|from.*to/i,
    // Preset patterns (backwards compatibility)
    /7d|7\s+days?|30d|30\s+days?|90d|90\s+days?|all\s+time/i
  ]

  // Check if input contains date-related patterns
  const hasDatePattern = datePatterns.some(pattern => pattern.test(input))

  if (hasDatePattern) {
    try {
      // First try advanced date parser
      const parsedDate = advancedDateParser.parse(userInput)

      if (parsedDate) {
        result.dateRange = {
          value: parsedDate.label,
          description: `${parsedDate.label} (${parsedDate.start.toLocaleDateString()} - ${parsedDate.end.toLocaleDateString()})`,
          type: 'natural_language',
          dateObject: {
            start: parsedDate.start,
            end: parsedDate.end,
            label: parsedDate.label
          }
        }
        result.detectedActions.push(`Set date range to ${parsedDate.label}`)

        // Add calendar interaction for complex expressions
        if ((parsedDate.type as string) === 'trading' || (parsedDate.type as string) === 'quarters') {
          result.calendarInteraction = {
            type: 'trading_pattern',
            value: parsedDate.label,
            description: `Apply ${parsedDate.type} pattern: ${parsedDate.label}`,
            naturalLanguage: userInput
          }
          result.detectedActions.push(`Apply trading pattern: ${parsedDate.label}`)
        }
      } else {
        // Fallback to legacy parsing for basic presets
        if (input.includes('7d') || input.includes('7 day') || input.includes('week')) {
          result.dateRange = { value: '7d', description: '7 day period', type: 'preset' }
          result.detectedActions.push('Set date range to 7 days')
        } else if (input.includes('30d') || input.includes('30 day') || input.includes('month')) {
          result.dateRange = { value: '30d', description: '30 day period', type: 'preset' }
          result.detectedActions.push('Set date range to 30 days')
        } else if (input.includes('90d') || input.includes('90 day') || input.includes('quarter')) {
          result.dateRange = { value: '90d', description: '90 day period', type: 'preset' }
          result.detectedActions.push('Set date range to 90 days')
        } else if (input.includes('all time') || input.includes('everything')) {
          result.dateRange = { value: 'All', description: 'All time data', type: 'preset' }
          result.detectedActions.push('Set date range to All time')
        }
      }
    } catch (error) {
      console.warn('Advanced date parsing failed, using fallback:', error)

      // Basic fallback parsing
      if (input.includes('ytd') || input.includes('year to date')) {
        result.dateRange = { value: 'calendar_ytd', description: 'Year to date (YTD)', type: 'calendar_widget' }
        result.detectedActions.push('Set date range to Year to Date (YTD)')
      }
    }
  }

  // CALENDAR INTERACTION DETECTION
  // Detect requests for calendar component generation
  if (input.includes('calendar') && (input.includes('show') || input.includes('generate') || input.includes('create'))) {
    result.calendarInteraction = {
      type: 'component_generation',
      value: 'calendar_widget',
      description: 'Generate interactive calendar component',
      naturalLanguage: userInput
    }
    result.detectedActions.push('Generate calendar component')

    // Set AGUI generation for calendar components
    result.aguiGeneration = {
      componentTypes: ['calendar', 'date-picker', 'trading-calendar'],
      focusArea: 'calendar',
      calendarSpecific: true
    }
    result.detectedActions.push('Generate calendar AGUI components')
  }

  // Quarter navigation detection
  if (/q[1-4]|quarter/i.test(input)) {
    result.calendarInteraction = {
      type: 'quarter_selection',
      value: input.match(/q[1-4]/i)?.[0] || 'quarter',
      description: 'Navigate to quarter view',
      naturalLanguage: userInput
    }
    result.detectedActions.push('Navigate to quarter selection')
  }

  // Display mode parsing
  if (input.includes(' r ') || input.includes(' r?') || input.includes(' r.') || input.includes(' r,') ||
      input.includes('risk') || input.includes('r-multiple') || input.includes('r multiple')) {
    result.displayMode = { value: 'R', description: 'R-multiple display' }
    result.detectedActions.push('Set display mode to R-multiples')
  } else if (input.includes('dollar') || input.includes('$') || input.includes('money') || input.includes('cash')) {
    result.displayMode = { value: '$', description: 'Dollar display' }
    result.detectedActions.push('Set display mode to dollars')
  }

  // AI mode parsing
  if (input.includes('analyst') || input.includes('analysis') || input.includes('analyze')) {
    result.aiMode = { value: 'analyst', description: 'Analyst mode' }
    result.detectedActions.push('Switch to Analyst mode')
  } else if (input.includes('coach') || input.includes('coaching') || input.includes('guidance')) {
    result.aiMode = { value: 'coach', description: 'Coach mode' }
    result.detectedActions.push('Switch to Coach mode')
  } else if (input.includes('mentor') || input.includes('mentoring') || input.includes('wisdom')) {
    result.aiMode = { value: 'mentor', description: 'Mentor mode' }
    result.detectedActions.push('Switch to Mentor mode')
  } else if (input.includes('renata')) {
    result.aiMode = { value: 'renata', description: 'Renata mode' }
    result.detectedActions.push('Switch to Renata mode')
  }

  console.log('🎯 COMMAND PARSER:', {
    input: userInput,
    parsed: result,
    actionCount: result.detectedActions.length
  })

  return result
}

export function generateExecutionPlan(parsed: ParsedCommand): string[] {
  const plan: string[] = []

  if (parsed.navigation) {
    plan.push(`Navigate to ${parsed.navigation.target} page`)
  }

  if (parsed.dateRange) {
    plan.push(`Set date range to ${parsed.dateRange.value} (${parsed.dateRange.description})`)
  }

  if (parsed.calendarInteraction) {
    switch (parsed.calendarInteraction.type) {
      case 'trading_pattern':
        plan.push(`Apply trading pattern: ${parsed.calendarInteraction.value}`)
        break
      case 'quarter_selection':
        plan.push(`Navigate to quarter selection: ${parsed.calendarInteraction.value}`)
        break
      case 'component_generation':
        plan.push(`Generate calendar component: ${parsed.calendarInteraction.description}`)
        break
      default:
        plan.push(`Calendar interaction: ${parsed.calendarInteraction.description}`)
    }
  }

  if (parsed.aguiGeneration) {
    plan.push(`Generate AGUI components: ${parsed.aguiGeneration.componentTypes.join(', ')}`)
  }

  if (parsed.displayMode) {
    plan.push(`Switch to ${parsed.displayMode.value} display mode (${parsed.displayMode.description})`)
  }

  if (parsed.aiMode) {
    plan.push(`Switch to ${parsed.aiMode.value} AI mode (${parsed.aiMode.description})`)
  }

  return plan
}

export function validateCommandCompletion(parsed: ParsedCommand, executedActions: string[]): {
  isComplete: boolean
  missedActions: string[]
  successfulActions: string[]
} {
  const expectedActions = parsed.detectedActions
  const missed = expectedActions.filter(action =>
    !executedActions.some(executed => executed.toLowerCase().includes(action.toLowerCase()))
  )

  return {
    isComplete: missed.length === 0,
    missedActions: missed,
    successfulActions: executedActions
  }
}