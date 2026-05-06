'use client'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDateRange, useDisplayMode } from '@/contexts/TraderraContext'
import { componentRegistry } from '@/lib/ag-ui/component-registry'

interface TraderraAction {
  type: 'navigation' | 'date_range' | 'display_mode' | 'custom_date_range' | 'set_filter' | 'show_filters' | 'clear_all_filters' | 'calendar_year' | 'calendar_view_mode' | 'pnl_mode' | 'switch_stats_tab' | 'open_modal' | 'scroll' | 'set_view_mode' | 'switch_settings_section' | 'click' | 'navigate_daily_summary_date' | 'set_daily_summary_date'
  page?: string
  range?: string
  mode?: string
  startDate?: string
  endDate?: string
  filterType?: string
  filterValue?: string
  // Calendar year navigation
  year?: number
  direction?: 'next' | 'previous'
  // Calendar view mode
  viewMode?: 'year' | 'month'
  // P&L mode
  pnlMode?: 'gross' | 'net'
  // Statistics tab switching
  statsTab?: 'overview' | 'analytics' | 'performance'
  // Modal actions
  modal?: string
  // Scroll actions
  target?: string
  scrollBehavior?: ScrollBehavior
  // View mode for Journal
  journalViewMode?: 'grid' | 'list'
  // Settings section
  section?: 'profile' | 'trading' | 'integrations' | 'notifications' | 'appearance' | 'data' | 'security'
  // Daily Summary date navigation
  dateDirection?: 'prev' | 'next' | 'today'
  date?: string
}

interface TraderraCommand {
  actions: TraderraAction[]
  timestamp: string
}

export function useTraderraGlobalBridge() {
  const router = useRouter()
  const { setDateRange, setCustomRange } = useDateRange()
  const { setDisplayMode } = useDisplayMode()

  // Helper function to click date range buttons
  const clickDateRangeButton = useCallback(async (range: string): Promise<boolean> => {
    console.log('🖱️ Attempting to click date range button for:', range)

    // Use a more flexible approach - scan all buttons and look for matching text/content
    try {
      const elements = document.querySelectorAll('button, [role="button"], [class*="button"]')

      for (const element of elements) {
        const text = element.textContent?.toLowerCase() || ''
        const className = (element as HTMLElement).className?.toLowerCase() || ''
        const ariaLabel = (element as HTMLElement).getAttribute('aria-label')?.toLowerCase() || ''

        // Look for YTD variations
        if (range === 'ytd' && (
          text.includes('ytd') || text.includes('year to date') ||
          ariaLabel.includes('ytd') || ariaLabel.includes('year to date') ||
          className.includes('ytd')
        )) {
          console.log(`✅ Found YTD button: ${text || className}`)
          ;(element as HTMLElement).click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }

        // Look for Today variations
        if (range === 'today' && (
          text.includes('today') || ariaLabel.includes('today') ||
          className.includes('today')
        )) {
          console.log(`✅ Found Today button: ${text || className}`)
          ;(element as HTMLElement).click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }

        // Look for Yesterday variations
        if (range === 'yesterday' && (
          text.includes('yesterday') || ariaLabel.includes('yesterday') ||
          className.includes('yesterday')
        )) {
          console.log(`✅ Found Yesterday button: ${text || className}`)
          ;(element as HTMLElement).click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }

        // Look for 7d/7 days variations
        if (range === '7d' && (
          text.includes('7d') || text.includes('7 days') || text.includes('7 day') ||
          ariaLabel.includes('7d') || ariaLabel.includes('7 days') ||
          className.includes('7d') || className.includes('7-day')
        )) {
          console.log(`✅ Found 7d button: ${text || className}`)
          ;(element as HTMLElement).click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }

        // Look for 30d/30 days variations
        if (range === '30d' && (
          text.includes('30d') || text.includes('30 days') || text.includes('30 day') ||
          ariaLabel.includes('30d') || ariaLabel.includes('30 days') ||
          className.includes('30d') || className.includes('30-day')
        )) {
          console.log(`✅ Found 30d button: ${text || className}`)
          ;(element as HTMLElement).click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }

        // Look for All/All Time variations
        if (range === 'all' && (
          text.includes('all') || text.includes('all time') || text.includes('everything') ||
          ariaLabel.includes('all') || ariaLabel.includes('all time') ||
          className.includes('all')
        )) {
          console.log(`✅ Found All button: ${text || className}`)
          ;(element as HTMLElement).click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }
      }

      // Try to find calendar button and open it for custom date ranges
      if (range === 'custom') {
        for (const element of elements) {
          const text = element.textContent?.toLowerCase() || ''
          const className = (element as HTMLElement).className?.toLowerCase() || ''
          const ariaLabel = (element as HTMLElement).getAttribute('aria-label')?.toLowerCase() || ''

          if (text.includes('calendar') || text.includes('date') ||
              ariaLabel.includes('calendar') || ariaLabel.includes('date') ||
              className.includes('calendar') || className.includes('date')) {
            console.log(`✅ Found calendar button: ${text || className}`)
            ;(element as HTMLElement).click()
            await new Promise(resolve => setTimeout(resolve, 200))
            return true
          }
        }
      }

    } catch (e) {
      console.log('❌ Error scanning for date range buttons:', e)
    }

    console.log('❌ Could not find date range button, falling back to context update')
    return false
  }, [])

  // Helper function to click display mode buttons
  const clickDisplayModeButton = useCallback(async (mode: string): Promise<boolean> => {
    console.log('🖱️ Attempting to click display mode button for:', mode)

    // CRITICAL FIX: Use specific IDs and data-testids to avoid clicking wrong buttons
    // Priority order: ID > data-testid > data-mode > fallback
    const buttonSelectors: Record<string, string[]> = {
      'dollar': [
        '#display-mode-dollar-button',  // PRIMARY: Specific ID
        '[data-testid="display-mode-dollar"]',  // SECONDARY: data-testid
        '[data-mode-value="dollar"]',  // TERTIARY: data-mode-value
        'button[data-agui-component="display-mode-toggle"][data-agui-value="dollar"]'
      ],
      'r': [
        '#display-mode-r-button',  // PRIMARY: Specific ID for R button
        '[data-testid="display-mode-r"]',  // SECONDARY: data-testid for R button
        '[data-mode-value="r"]',  // TERTIARY: data-mode-value for R button
        'button[data-agui-component="display-mode-toggle"][data-agui-value="r"]'
      ],
      'percent': [
        '[data-testid="display-mode-percent"]',
        '[data-mode-value="percent"]',
        'button[data-agui-component="display-mode-toggle"][data-agui-value="percent"]'
      ]
    }

    const selectors = buttonSelectors[mode] || []

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector) as HTMLElement
        if (element) {
          console.log(`✅ Found ${mode} button with selector: ${selector}`)
          element.click()
          await new Promise(resolve => setTimeout(resolve, 200))
          return true
        }
      } catch (e) {
        // Try next selector
      }
    }

    // LAST RESORT: Generic text matching (only if specific selectors fail)
    console.log(`⚠️ Specific selectors failed, falling back to text matching for ${mode}`)
    const elements = document.querySelectorAll('button, [role="button"]')
    for (const element of elements) {
      const text = element.textContent?.toLowerCase() || ''
      const title = (element as HTMLElement).title?.toLowerCase() || ''
      const dataMode = (element as HTMLElement).getAttribute('data-mode')?.toLowerCase() || ''

      if (mode === 'dollar' && (text === '$' || text.includes('dollar') || title.includes('dollar') || dataMode === 'dollar')) {
        console.log(`✅ Found dollar button via fallback: ${element.textContent}`)
        ;(element as HTMLElement).click()
        await new Promise(resolve => setTimeout(resolve, 200))
        return true
      }
      if (mode === 'r' && (text === 'r' || text.includes('risk') || title.includes('r-multiple') || title.includes('risk') || dataMode === 'r')) {
        console.log(`✅ Found R button via fallback: ${element.textContent}`)
        ;(element as HTMLElement).click()
        await new Promise(resolve => setTimeout(resolve, 200))
        return true
      }
      if (mode === 'percent' && (text === '%' || text.includes('percent') || title.includes('percent') || dataMode === 'percent')) {
        console.log(`✅ Found percent button via fallback: ${element.textContent}`)
        ;(element as HTMLElement).click()
        await new Promise(resolve => setTimeout(resolve, 200))
        return true
      }
    }

    console.log('❌ Could not find display mode button, falling back to context update')
    return false
  }, [])

  // Execute individual actions
  const executeAction = useCallback(async (action: TraderraAction): Promise<boolean> => {
    console.log('🚀 Executing action:', action)

    try {
      switch (action.type) {
        case 'navigation':
          if (action.page) {
            console.log('📍 Navigating to:', action.page)
            router.push(`/${action.page}`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return true
          }
          break

        case 'date_range':
          if (action.range) {
            console.log('📅 Setting date range:', action.range)

            // First try to click the actual button
            const clicked = await clickDateRangeButton(action.range)
            if (clicked) {
              // Also update the context as fallback
              setDateRange(action.range)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              // Fallback to just setting the context
              setDateRange(action.range)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            }
          }
          break

        case 'display_mode':
          if (action.mode) {
            console.log('💰 Setting display mode:', action.mode)

            // First try to click the actual button
            const clicked = await clickDisplayModeButton(action.mode)
            if (clicked) {
              // Also update the context as fallback
              setDisplayMode(action.mode)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              // Fallback to just setting the context
              setDisplayMode(action.mode)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            }
          }
          break

        case 'custom_date_range':
          if (action.startDate && action.endDate) {
            // Convert string dates to Date objects
            const startDate = new Date(action.startDate)
            const endDate = new Date(action.endDate)

            // Validate dates
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              console.error('❌ Invalid date format for custom date range')
              return false
            }

            setCustomRange(startDate, endDate)
            await new Promise(resolve => setTimeout(resolve, 500))
            return true
          }
          break

        case 'set_filter':
          if (action.filterType && action.filterValue) {
            console.log('🔽 Setting filter:', action.filterType, 'to', action.filterValue)

            // Store filter in localStorage
            const currentFilters = JSON.parse(localStorage.getItem('traderra_filters') || '{}')
            currentFilters[action.filterType] = action.filterValue
            localStorage.setItem('traderra_filters', JSON.stringify(currentFilters))

            // Dispatch custom event for UI components to listen to
            window.dispatchEvent(new CustomEvent('traderra-filter-changed', {
              detail: {
                filterType: action.filterType,
                filterValue: action.filterValue
              }
            }))

            await new Promise(resolve => setTimeout(resolve, 500))
            return true
          }
          break

        case 'show_filters':
          console.log('👁️ Showing current filters')

          // Get current filters and display them
          const currentFilters = JSON.parse(localStorage.getItem('traderra_filters') || '{}')
          const filterKeys = Object.keys(currentFilters)

          if (filterKeys.length === 0) {
            console.log('📋 No filters currently active')
          } else {
            console.log('📋 Current filters:', currentFilters)
            // You could dispatch a toast notification here
          }

          await new Promise(resolve => setTimeout(resolve, 500))
          return true

        case 'clear_all_filters':
          console.log('🧹 Clearing all filters')

          // Clear all filters from localStorage
          localStorage.removeItem('traderra_filters')

          // Dispatch event for UI components to clear filters
          window.dispatchEvent(new CustomEvent('traderra-clear-all-filters'))

          await new Promise(resolve => setTimeout(resolve, 500))
          return true

        case 'calendar_year':
          console.log('📅 Navigating calendar year:', action.direction, action.year)

          // Use AG-UI component registry to set the calendar year
          if (action.year !== undefined) {
            // Direct year navigation
            console.log('📅 Setting calendar year to:', action.year)
            const handler = componentRegistry.get('calendar.year')
            if (handler?.setState) {
              handler.setState(action.year)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn('⚠️ calendar.year handler not found in registry')
            }
          } else if (action.direction) {
            // Directional navigation (next/previous)
            console.log('📅 Navigating calendar:', action.direction)

            // Find and click the appropriate navigation button
            const elements = document.querySelectorAll('button, [role="button"]')
            for (const element of elements) {
              const text = element.textContent?.trim().toLowerCase() || ''
              const ariaLabel = (element as HTMLElement).getAttribute('aria-label')?.toLowerCase() || ''

              if (action.direction === 'previous') {
                if (text.includes('<') || text.includes('◀') || text.includes('previous') || text.includes('last') ||
                    ariaLabel.includes('previous') || ariaLabel.includes('last year')) {
                  console.log('✅ Clicking previous year button')
                  ;(element as HTMLElement).click()
                  await new Promise(resolve => setTimeout(resolve, 500))
                  return true
                }
              } else if (action.direction === 'next') {
                if (text.includes('>') || text.includes('▶') || text.includes('next') || text.includes('forward') ||
                    ariaLabel.includes('next') || ariaLabel.includes('next year')) {
                  console.log('✅ Clicking next year button')
                  ;(element as HTMLElement).click()
                  await new Promise(resolve => setTimeout(resolve, 500))
                  return true
                }
              }
            }
          }
          return false

        case 'calendar_view_mode':
          console.log('🔲 Setting calendar view mode:', action.viewMode)

          // Use AG-UI component registry to set the view mode
          if (action.viewMode) {
            const handler = componentRegistry.get('calendar.view-mode')
            if (handler?.setState) {
              handler.setState(action.viewMode)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn('⚠️ calendar.view-mode handler not found in registry')
            }
          }
          return false

        case 'pnl_mode':
          console.log('💰 Setting P&L mode:', action.pnlMode)

          // Use AG-UI component registry to set the P&L mode
          if (action.pnlMode) {
            const handler = componentRegistry.get('pnl-mode')
            if (handler?.setState) {
              handler.setState(action.pnlMode)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn('⚠️ pnl-mode handler not found in registry')
            }
          }
          return false

        case 'switch_stats_tab':
          console.log('📊 Switching statistics tab to:', action.statsTab)

          // Use AG-UI component registry to switch the statistics tab
          if (action.statsTab) {
            const handler = componentRegistry.get(`statistics.tabs.${action.statsTab}`)
            if (handler?.activate) {
              console.log(`✅ Activating ${action.statsTab} tab`)
              handler.activate('activate')
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn(`⚠️ statistics.tabs.${action.statsTab} handler not found in registry`)
            }
          }
          return false

        case 'open_modal':
          console.log('🪟 Opening modal:', action.modal)

          // Use AG-UI component registry to open modals
          if (action.modal) {
            const handler = componentRegistry.get(action.modal)
            if (handler?.activate) {
              console.log(`✅ Opening modal: ${action.modal}`)
              handler.activate('open')
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn(`⚠️ ${action.modal} handler not found in registry`)
            }
          }
          return false

        case 'scroll':
          console.log('📜 Scrolling to:', action.target)

          // Use AG-UI component registry to scroll to elements
          if (action.target) {
            const handler = componentRegistry.get(action.target)
            if (handler?.scroll) {
              console.log(`✅ Scrolling to: ${action.target}`)
              handler.scroll(action.scrollBehavior || 'smooth')
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn(`⚠️ ${action.target} handler not found in registry`)
            }
          }
          return false

        case 'set_view_mode':
          console.log('🔲 Setting view mode:', action.journalViewMode)

          // Use AG-UI component registry to set view mode
          if (action.journalViewMode) {
            const handler = componentRegistry.get('journal.view-mode')
            if (handler?.setState) {
              console.log(`✅ Setting journal view mode to: ${action.journalViewMode}`)
              handler.setState(action.journalViewMode)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn('⚠️ journal.view-mode handler not found in registry')
            }
          }
          return false

        case 'switch_settings_section':
          console.log('⚙️ Switching settings section to:', action.section)

          // Use AG-UI component registry to switch settings section
          if (action.section) {
            const handler = componentRegistry.get('settings.section')
            if (handler?.setState) {
              console.log(`✅ Switching to settings section: ${action.section}`)
              handler.setState(action.section)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn('⚠️ settings.section handler not found in registry')
            }
          }
          return false

        case 'click':
          console.log('🖱️ Clicking:', action.target)

          // Use AG-UI component registry to click elements
          if (action.target) {
            const handler = componentRegistry.get(action.target)
            if (handler?.activate) {
              console.log(`✅ Clicking: ${action.target}`)
              handler.activate('click')
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn(`⚠️ ${action.target} handler not found in registry`)
            }
          }
          return false

        case 'navigate_daily_summary_date':
          console.log('📅 Navigating daily summary date:', action.dateDirection)

          // Use AG-UI component registry to navigate daily summary date
          if (action.dateDirection) {
            const handler = componentRegistry.get('daily-summary.date')
            if (handler?.setState) {
              // Calculate new date based on direction
              const today = new Date()
              let targetDate: Date

              if (action.dateDirection === 'prev') {
                targetDate = new Date(today)
                targetDate.setDate(targetDate.getDate() - 1)
              } else if (action.dateDirection === 'next') {
                targetDate = new Date(today)
                targetDate.setDate(targetDate.getDate() + 1)
              } else {
                targetDate = today
              }

              const dateString = targetDate.toISOString().split('T')[0]
              console.log(`✅ Setting daily summary date to: ${dateString}`)
              handler.setState(dateString)
              await new Promise(resolve => setTimeout(resolve, 500))
              return true
            } else {
              console.warn('⚠️ daily-summary.date handler not found in registry')
            }
          }
          return false

        case 'set_daily_summary_date':
          console.log('📅 Setting daily summary date to today')

          // Use AG-UI component registry to set daily summary date to today
          const todayHandler = componentRegistry.get('daily-summary.date')
          if (todayHandler?.setState) {
            const todayString = new Date().toISOString().split('T')[0]
            console.log(`✅ Setting daily summary date to: ${todayString}`)
            todayHandler.setState(todayString)
            await new Promise(resolve => setTimeout(resolve, 500))
            return true
          } else {
            console.warn('⚠️ daily-summary.date handler not found in registry')
          }
          return false

        default:
          console.warn('⚠️ Unknown action type:', action.type)
          return false
      }
    } catch (error) {
      console.error('❌ Error executing action:', error)
      return false
    }
    return false
  }, [router, setDateRange, setDisplayMode, setCustomRange])

  // Execute multiple actions in sequence
  const executeCommands = useCallback(async (command: TraderraCommand) => {
    console.log('🎯 Executing commands:', command)
    let successCount = 0
    let failureCount = 0

    // Separate navigation actions from other actions
    const navigationActions: TraderraAction[] = []
    const otherActions: TraderraAction[] = []

    command.actions.forEach(action => {
      if (action.type === 'navigation') {
        navigationActions.push(action)
      } else {
        otherActions.push(action)
      }
    })

    console.log(`📋 Found ${otherActions.length} non-navigation actions and ${navigationActions.length} navigation actions`)

    // Execute non-navigation actions first
    for (const action of otherActions) {
      console.log(`⚡ Executing non-navigation action: ${action.type}`)
      const success = await executeAction(action)
      if (success) {
        successCount++
      } else {
        failureCount++
      }
      // Delay between actions to ensure smooth transitions
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Execute navigation actions last
    for (const action of navigationActions) {
      console.log(`🧭 Executing navigation action: ${action.type} to ${action.page}`)
      const success = await executeAction(action)
      if (success) {
        successCount++
      } else {
        failureCount++
      }
      // Longer delay after navigation to allow page to load
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`📊 Command execution complete: ${successCount} succeeded, ${failureCount} failed`)
    return { successCount, failureCount, totalActions: command.actions.length }
  }, [executeAction])

  // Parse and execute commands from Renata API response
  const executeRenataResponse = useCallback(async (apiResponse: any) => {
    console.log('🤖 Processing Renata API response:', apiResponse)
    console.log('🔍 UI Action in response:', apiResponse.ui_action)
    console.log('🔍 Response text:', apiResponse.response)

    const actions: TraderraAction[] = []

    // First, process the primary ui_action from backend
    if (apiResponse.ui_action) {
      console.log('🎯 Processing UI action from backend:', apiResponse.ui_action)

      // Convert backend ui_action to frontend action format
      if (apiResponse.ui_action.action_type === 'switch_display_mode') {
        // Use the target mode from backend parameters directly
        const targetMode = apiResponse.ui_action.parameters?.target_mode || apiResponse.ui_action.target_mode || 'r'

        actions.push({
          type: 'display_mode',
          mode: targetMode
        })
        console.log(`💱 Adding display mode action: ${targetMode}`)
      }
      else if (apiResponse.ui_action.action_type === 'set_date_range' || apiResponse.ui_action.action === 'set_date_range') {
        const range = apiResponse.ui_action.parameters?.range || apiResponse.ui_action.range || 'ytd'
        actions.push({
          type: 'date_range',
          range: range
        })
        console.log(`📅 Adding date range action: ${range}`)
      }
      else if (apiResponse.ui_action.action_type === 'navigation' || apiResponse.ui_action.action === 'navigation') {
        const page = apiResponse.ui_action.parameters?.page || apiResponse.ui_action.page || 'dashboard'
        actions.push({
          type: 'navigation',
          page: page
        })
        console.log(`📍 Adding navigation action: ${page}`)
      }
      else if (apiResponse.ui_action.action_type === 'set_custom_date_range' || apiResponse.ui_action.action === 'set_custom_date_range') {
        const startDate = apiResponse.ui_action.parameters?.start_date || apiResponse.ui_action.start_date
        const endDate = apiResponse.ui_action.parameters?.end_date || apiResponse.ui_action.end_date
        if (startDate && endDate) {
          actions.push({
            type: 'custom_date_range',
            startDate: startDate,
            endDate: endDate
          })
          console.log(`📅 Adding custom date range action: ${startDate} to ${endDate}`)
        }
      }
      else if (apiResponse.ui_action.action === 'set_filter') {
        const filterType = apiResponse.ui_action.filter_type || apiResponse.ui_action.parameters?.filter_type
        const filterValue = apiResponse.ui_action.filter_value || apiResponse.ui_action.parameters?.filter_value
        if (filterType && filterValue) {
          actions.push({
            type: 'set_filter',
            filterType: filterType,
            filterValue: filterValue
          })
          console.log(`🔽 Adding filter action: ${filterType} = ${filterValue}`)
        }
      }
      else if (apiResponse.ui_action.action === 'show_filters') {
        actions.push({
          type: 'show_filters'
        })
        console.log('👁️ Adding show filters action')
      }
      else if (apiResponse.ui_action.action === 'clear_all_filters') {
        actions.push({
          type: 'clear_all_filters'
        })
        console.log('🧹 Adding clear all filters action')
      }
      // Calendar year navigation
      else if (apiResponse.ui_action.action === 'navigate_calendar_year') {
        const year = apiResponse.ui_action.year
        const direction = apiResponse.ui_action.direction

        if (year !== undefined) {
          actions.push({
            type: 'calendar_year',
            year: year
          })
          console.log(`📅 Adding calendar year action: ${year}`)
        } else if (direction) {
          actions.push({
            type: 'calendar_year',
            direction: direction
          })
          console.log(`📅 Adding calendar year direction action: ${direction}`)
        }
      }
      // Calendar view mode
      else if (apiResponse.ui_action.action === 'set_calendar_view_mode') {
        const viewMode = apiResponse.ui_action.view_mode || apiResponse.ui_action.viewMode
        if (viewMode) {
          actions.push({
            type: 'calendar_view_mode',
            viewMode: viewMode
          })
          console.log(`🔲 Adding calendar view mode action: ${viewMode}`)
        }
      }
      // P&L mode
      else if (apiResponse.ui_action.action === 'set_pnl_mode') {
        const pnlMode = apiResponse.ui_action.pnl_mode || apiResponse.ui_action.pnlMode
        if (pnlMode) {
          actions.push({
            type: 'pnl_mode',
            pnlMode: pnlMode
          })
          console.log(`💰 Adding P&L mode action: ${pnlMode}`)
        }
      }
      // Statistics tab switching
      else if (apiResponse.ui_action.action === 'switch_stats_tab') {
        const statsTab = apiResponse.ui_action.stats_tab || apiResponse.ui_action.statsTab
        if (statsTab) {
          actions.push({
            type: 'switch_stats_tab',
            statsTab: statsTab
          })
          console.log(`📊 Adding stats tab action: ${statsTab}`)
        }
      }
      // Open modal actions
      else if (apiResponse.ui_action.action === 'open_modal') {
        const modal = apiResponse.ui_action.modal || apiResponse.ui_action.parameters?.modal
        if (modal) {
          actions.push({
            type: 'open_modal',
            modal: modal
          })
          console.log(`🪟 Adding open modal action: ${modal}`)
        }
      }
      // Scroll actions
      else if (apiResponse.ui_action.action === 'scroll') {
        const target = apiResponse.ui_action.target || apiResponse.ui_action.parameters?.target
        if (target) {
          actions.push({
            type: 'scroll',
            target: target,
            scrollBehavior: apiResponse.ui_action.behavior || 'smooth'
          })
          console.log(`📜 Adding scroll action to: ${target}`)
        }
      }
      // Set view mode for Journal
      else if (apiResponse.ui_action.action === 'set_view_mode') {
        const viewMode = apiResponse.ui_action.view_mode || apiResponse.ui_action.parameters?.view_mode
        if (viewMode) {
          actions.push({
            type: 'set_view_mode',
            journalViewMode: viewMode
          })
          console.log(`🔲 Adding journal view mode action: ${viewMode}`)
        }
      }
      // Switch settings section
      else if (apiResponse.ui_action.action === 'switch_settings_section') {
        const section = apiResponse.ui_action.section || apiResponse.ui_action.parameters?.section
        if (section) {
          actions.push({
            type: 'switch_settings_section',
            section: section
          })
          console.log(`⚙️ Adding settings section action: ${section}`)
        }
      }
      // Click actions
      else if (apiResponse.ui_action.action === 'click') {
        const target = apiResponse.ui_action.target || apiResponse.ui_action.parameters?.target
        if (target) {
          actions.push({
            type: 'click',
            target: target
          })
          console.log(`🖱️ Adding click action: ${target}`)
        }
      }
      // Navigate daily summary date
      else if (apiResponse.ui_action.action === 'navigate_daily_summary_date') {
        const direction = apiResponse.ui_action.direction || apiResponse.ui_action.parameters?.direction
        if (direction) {
          actions.push({
            type: 'navigate_daily_summary_date',
            dateDirection: direction
          })
          console.log(`📅 Adding daily summary date navigation: ${direction}`)
        }
      }
      // Set daily summary date to today
      else if (apiResponse.ui_action.action === 'set_daily_summary_date') {
        actions.push({
          type: 'set_daily_summary_date'
        })
        console.log(`📅 Adding set daily summary date to today action`)
      }
    }

    // Also process navigationCommands if they exist (legacy support)
    if (apiResponse.navigationCommands && apiResponse.navigationCommands.length > 0) {
      console.log('🧭 Processing navigation commands:', apiResponse.navigationCommands)
      apiResponse.navigationCommands.forEach((cmd: any) => {
        actions.push({
          type: 'navigation',
          page: cmd.page
        })
      })
    }

    // Extract date range from NLP analysis (legacy support)
    if (apiResponse.nlpAnalysis?.dateRange) {
      actions.push({
        type: 'date_range',
        range: apiResponse.nlpAnalysis.dateRange
      })
      console.log(`📅 Adding date range from NLP: ${apiResponse.nlpAnalysis.dateRange}`)
    }

    // Execute all collected actions
    if (actions.length > 0) {
      console.log(`🚀 Executing ${actions.length} actions:`, actions)
      try {
        await executeCommands({
          actions: actions,
          timestamp: new Date().toISOString()
        })
        console.log('✅ All actions executed successfully')
      } catch (error) {
        console.error('❌ Error executing actions:', error)
      }
    } else {
      console.log('ℹ️ No actions to execute')
    }
  }, [executeAction, executeCommands])

  // Set up global event listener
  useEffect(() => {
    const handleTraderraActions = (event: CustomEvent<TraderraCommand>) => {
      console.log('🌐 Received Traderra actions event:', event.detail)
      executeCommands(event.detail)
    }

    // Listen for global Traderra action events
    window.addEventListener('traderra-actions', handleTraderraActions as EventListener)

    return () => {
      window.removeEventListener('traderra-actions', handleTraderraActions as EventListener)
    }
  }, [executeCommands])

  return {
    executeAction,
    executeCommands,
    executeRenataResponse
  }
}

// Global function for direct command execution (for debugging)
declare global {
  interface Window {
    executeTraderraAction: (action: TraderraAction) => void
    executeTraderraCommands: (commands: TraderraCommand) => void
  }
}

// Set up global access for debugging
// Note: This will be set up by the GlobalTraderraProvider component