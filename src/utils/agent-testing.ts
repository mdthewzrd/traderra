/**
 * Comprehensive Agent Testing Framework
 * Tests all variations of commands to ensure bulletproof functionality
 */

export interface TestCase {
  id: string
  description: string
  input: string
  expectedActions: string[]
  category: 'display' | 'navigation' | 'dateRange' | 'compound' | 'tabs' | 'scrolling' | 'edge' | 'trade' | 'form' | 'modal' | 'filter' | 'sorting' | 'journal' | 'export' | 'pagination' | 'system' | 'chart' | 'settings'
  priority: 'high' | 'medium' | 'low'
}

export const COMPREHENSIVE_TEST_CASES: TestCase[] = [
  // DISPLAY MODE TESTS - HIGH PRIORITY
  {
    id: 'display_001',
    description: 'Switch to R-multiple - direct',
    input: 'switch to R',
    expectedActions: ['📊 Switched to R-multiple view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_002',
    description: 'Switch to R-multiple - contextual',
    input: 'can you change it to R multiple please',
    expectedActions: ['📊 Switched to R-multiple view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_003',
    description: 'Switch to R-multiple - standalone R',
    input: 'show me the data in R',
    expectedActions: ['📊 Switched to R-multiple view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_004',
    description: 'Switch to dollars - direct',
    input: 'switch to dollars',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_005',
    description: 'Switch to dollars - contextual',
    input: 'now can you switch it to dollars',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_006',
    description: 'Switch to dollars - money variant',
    input: 'change to money view',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_007',
    description: 'Switch to dollars - cash variant',
    input: 'show cash amounts',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'display_008',
    description: 'Switch to dollars - PnL variant',
    input: 'display profit and loss',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'display',
    priority: 'high'
  },

  // NAVIGATION TESTS - HIGH PRIORITY
  {
    id: 'nav_001',
    description: 'Go to statistics - direct',
    input: 'go to statistics',
    expectedActions: ['📊 Navigated to Statistics page'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_002',
    description: 'Go to statistics - stats variant',
    input: 'show me stats',
    expectedActions: ['📊 Navigated to Statistics page'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_003',
    description: 'Go to statistics - performance variant',
    input: 'take me to performance data',
    expectedActions: ['📊 Navigated to Statistics page'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_004',
    description: 'Go to journal - direct',
    input: 'open journal',
    expectedActions: ['📝 Opened Trading Journal'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_005',
    description: 'Go to journal - notes variant',
    input: 'show trading notes',
    expectedActions: ['📝 Opened Trading Journal'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_006',
    description: 'Go to trades - direct',
    input: 'navigate to trades',
    expectedActions: ['📈 Opened Trades page'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_007',
    description: 'Go to analytics - analysis variant',
    input: 'let me see the analysis',
    expectedActions: ['⚡ Opened Analytics page'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_008',
    description: 'Go to calendar - timeline variant',
    input: 'show me the timeline',
    expectedActions: ['📅 Opened Calendar view'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_009',
    description: 'Go to dashboard - home variant',
    input: 'take me back home',
    expectedActions: ['🏠 Returned to Dashboard'],
    category: 'navigation',
    priority: 'high'
  },
  {
    id: 'nav_010',
    description: 'Go to settings - preferences variant',
    input: 'open preferences',
    expectedActions: ['⚙️ Opened Settings page'],
    category: 'navigation',
    priority: 'high'
  },

  // DATE RANGE TESTS - HIGH PRIORITY
  {
    id: 'date_001',
    description: 'Set all time - direct',
    input: 'show all time data',
    expectedActions: ['📈 Set to All Time data'],
    category: 'dateRange',
    priority: 'high'
  },
  {
    id: 'date_002',
    description: 'Set all time - everything variant',
    input: 'display everything',
    expectedActions: ['📈 Set to All Time data'],
    category: 'dateRange',
    priority: 'high'
  },
  {
    id: 'date_003',
    description: 'Set today - direct',
    input: 'filter to today',
    expectedActions: ['📅 Set to Today\'s data'],
    category: 'dateRange',
    priority: 'high'
  },
  {
    id: 'date_004',
    description: 'Set this week - direct',
    input: 'show this week',
    expectedActions: ['📅 Set to This Week'],
    category: 'dateRange',
    priority: 'high'
  },
  {
    id: 'date_005',
    description: 'Set last month - direct',
    input: 'look at last month',
    expectedActions: ['📅 Set to Last Month'],
    category: 'dateRange',
    priority: 'high'
  },
  {
    id: 'date_006',
    description: 'Set 90 days - three months variant',
    input: 'show three months of data',
    expectedActions: ['📅 Set to Last 90 Days'],
    category: 'dateRange',
    priority: 'high'
  },

  // COMPOUND COMMAND TESTS - CRITICAL
  {
    id: 'compound_001',
    description: 'Triple compound - stats, all time, R',
    input: 'show stats all time in R',
    expectedActions: [
      '📊 Navigated to Statistics page',
      '📈 Set to All Time data',
      '📊 Switched to R-multiple view'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_002',
    description: 'Journal with date and mode',
    input: 'go to journal this week in dollars',
    expectedActions: [
      '📝 Opened Trading Journal',
      '📅 Set to This Week',
      '💰 Switched to dollar view'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_003',
    description: 'Analytics with last month R',
    input: 'open analytics last month R multiple',
    expectedActions: [
      '⚡ Opened Analytics page',
      '📅 Set to Last Month',
      '📊 Switched to R-multiple view'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_004',
    description: 'Dashboard with today dollars',
    input: 'back to dashboard show today in money',
    expectedActions: [
      '🏠 Returned to Dashboard',
      '📅 Set to Today\'s data',
      '💰 Switched to dollar view'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_005',
    description: 'Trades 90 days cash',
    input: 'let me see trades for 90 days in cash',
    expectedActions: [
      '📈 Opened Trades page',
      '📅 Set to Last 90 Days',
      '💰 Switched to dollar view'
    ],
    category: 'compound',
    priority: 'high'
  },

  // SCROLLING TESTS - MEDIUM PRIORITY
  {
    id: 'scroll_001',
    description: 'Scroll to journal section',
    input: 'scroll down to trading journal section',
    expectedActions: ['📜 Scrolled to Trading Journal section'],
    category: 'scrolling',
    priority: 'medium'
  },
  {
    id: 'scroll_002',
    description: 'Show journal section',
    input: 'show journal section',
    expectedActions: ['📜 Scrolled to Trading Journal section'],
    category: 'scrolling',
    priority: 'medium'
  },
  {
    id: 'scroll_003',
    description: 'Scroll to metrics',
    input: 'scroll to performance metrics',
    expectedActions: ['📊 Scrolled to Performance Metrics section'],
    category: 'scrolling',
    priority: 'medium'
  },
  {
    id: 'scroll_004',
    description: 'Back to top',
    input: 'scroll back to top',
    expectedActions: ['⬆️ Scrolled to top of page'],
    category: 'scrolling',
    priority: 'medium'
  },

  // TAB SWITCHING TESTS - HIGH PRIORITY
  {
    id: 'tab_001',
    description: 'Statistics overview tab',
    input: 'switch to overview tab',
    expectedActions: ['📊 Switched to Overview tab'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_002',
    description: 'Statistics analytics tab',
    input: 'show me analytics tab',
    expectedActions: ['🔬 Switched to Analytics tab'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_003',
    description: 'Statistics performance tab',
    input: 'go to performance tab',
    expectedActions: ['📈 Switched to Performance tab'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_004',
    description: 'Dashboard day of week analysis',
    input: 'show day of week analysis',
    expectedActions: ['📅 Switched to Day of Week Analysis'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_005',
    description: 'Dashboard symbols analysis',
    input: 'switch to symbols tab',
    expectedActions: ['🔤 Switched to Symbols Analysis'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_006',
    description: 'Dashboard tags analysis',
    input: 'show tags analysis',
    expectedActions: ['🏷️ Switched to Tags Analysis'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_007',
    description: 'Dashboard setups analysis',
    input: 'go to setups tab',
    expectedActions: ['⚡ Switched to Setups Analysis'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'tab_008',
    description: 'Dashboard time analysis',
    input: 'show time analysis',
    expectedActions: ['⏰ Switched to Time Analysis'],
    category: 'tabs',
    priority: 'high'
  },

  // ENHANCED SCROLLING TESTS - HIGH PRIORITY
  {
    id: 'scroll_005',
    description: 'Scroll to charts section',
    input: 'scroll to charts',
    expectedActions: ['📈 Scrolled to Charts section'],
    category: 'scrolling',
    priority: 'high'
  },
  {
    id: 'scroll_006',
    description: 'Scroll to advanced analytics section',
    input: 'show advanced analytics section',
    expectedActions: ['🔬 Scrolled to Advanced Analytics section'],
    category: 'scrolling',
    priority: 'high'
  },
  {
    id: 'scroll_007',
    description: 'Scroll to bottom',
    input: 'scroll to bottom',
    expectedActions: ['⬇️ Scrolled to bottom of page'],
    category: 'scrolling',
    priority: 'high'
  },
  {
    id: 'scroll_008',
    description: 'Trades table scroll',
    input: 'show me the trades table',
    expectedActions: ['📈 Scrolled to Trades table'],
    category: 'scrolling',
    priority: 'medium'
  },
  {
    id: 'scroll_009',
    description: 'Calendar view scroll',
    input: 'scroll to calendar',
    expectedActions: ['📅 Scrolled to Calendar view'],
    category: 'scrolling',
    priority: 'medium'
  },

  // COMPREHENSIVE COMPOUND COMMANDS - HIGH PRIORITY
  {
    id: 'compound_006',
    description: 'Navigation with tab and display mode',
    input: 'go to stats performance tab in dollars',
    expectedActions: [
      '📊 Navigated to Statistics page',
      '📈 Switched to Performance tab',
      '💰 Switched to dollar view'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_007',
    description: 'Tab switching with date range',
    input: 'show analytics tab for this month',
    expectedActions: [
      '🔬 Switched to Analytics tab',
      '📅 Set to This Month'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_008',
    description: 'Dashboard scroll with display mode',
    input: 'scroll to journal section and switch to R',
    expectedActions: [
      '📜 Scrolled to Trading Journal section',
      '📊 Switched to R-multiple view'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_009',
    description: 'Multiple tab switches',
    input: 'go to stats and show overview then performance tab',
    expectedActions: [
      '📊 Navigated to Statistics page',
      '📈 Switched to Performance tab'
    ],
    category: 'compound',
    priority: 'high'
  },
  {
    id: 'compound_010',
    description: 'Navigation with scroll and settings',
    input: 'go to dashboard scroll to metrics in dollar view',
    expectedActions: [
      '🏠 Returned to Dashboard',
      '📊 Scrolled to Performance Metrics section',
      '💰 Switched to dollar view'
    ],
    category: 'compound',
    priority: 'high'
  },

  // ADVANCED TRADE CREATION - CRITICAL PRIORITY
  {
    id: 'trade_001',
    description: 'Compound trade creation - full format',
    input: 'new trade: AAPL, long, 100 shares, entry 150, exit 155',
    expectedActions: ['🚀 Creating AAPL long trade (100 shares) @ $150'],
    category: 'trade',
    priority: 'high'
  },
  {
    id: 'trade_002',
    description: 'Simple trade creation with symbol and side',
    input: 'create trade TSLA short',
    expectedActions: ['🚀 Creating TSLA short trade'],
    category: 'trade',
    priority: 'high'
  },
  {
    id: 'trade_003',
    description: 'Trade creation with quantity only',
    input: 'add trade: NVDA, 50 shares',
    expectedActions: ['🚀 Creating NVDA trade (50 shares)'],
    category: 'trade',
    priority: 'high'
  },

  // ADVANCED FORM FIELD COMMANDS - HIGH PRIORITY
  {
    id: 'form_001',
    description: 'Set symbol field',
    input: 'set symbol to MSFT',
    expectedActions: ['📈 Set symbol to MSFT'],
    category: 'form',
    priority: 'high'
  },
  {
    id: 'form_002',
    description: 'Set entry price',
    input: 'entry price 142.50',
    expectedActions: ['💰 Set entry price to $142.50'],
    category: 'form',
    priority: 'high'
  },
  {
    id: 'form_003',
    description: 'Set quantity',
    input: 'quantity 75 shares',
    expectedActions: ['📊 Set quantity to 75 shares'],
    category: 'form',
    priority: 'high'
  },
  {
    id: 'form_004',
    description: 'Set side to long',
    input: 'set side to long',
    expectedActions: ['📈 Set side to Long'],
    category: 'form',
    priority: 'high'
  },
  {
    id: 'form_005',
    description: 'Set side to short',
    input: 'make it short',
    expectedActions: ['📉 Set side to Short'],
    category: 'form',
    priority: 'high'
  },

  // PNL MODE SWITCHING - HIGH PRIORITY
  {
    id: 'pnl_001',
    description: 'Switch to gross PnL',
    input: 'switch to gross pnl',
    expectedActions: ['📊 Switched to Gross P&L'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'pnl_002',
    description: 'Switch to net PnL',
    input: 'show net profit',
    expectedActions: ['📊 Switched to Net P&L'],
    category: 'display',
    priority: 'high'
  },

  // MODAL OPERATIONS - HIGH PRIORITY
  {
    id: 'modal_001',
    description: 'Open new trade modal',
    input: 'new trade',
    expectedActions: ['📝 Opened New Trade Modal'],
    category: 'modal',
    priority: 'high'
  },
  {
    id: 'modal_002',
    description: 'Open import dialog',
    input: 'import trades',
    expectedActions: ['📁 Opened Import Trades Dialog'],
    category: 'modal',
    priority: 'high'
  },
  {
    id: 'modal_003',
    description: 'Open new journal entry',
    input: 'new journal entry',
    expectedActions: ['📔 Opened New Journal Entry'],
    category: 'modal',
    priority: 'high'
  },

  // ADVANCED FILTERING - HIGH PRIORITY
  {
    id: 'filter_001',
    description: 'Filter by symbol',
    input: 'filter by symbol AAPL',
    expectedActions: ['🔍 Filtered by symbol: AAPL'],
    category: 'filter',
    priority: 'high'
  },
  {
    id: 'filter_002',
    description: 'Filter by strategy',
    input: 'show momentum strategy',
    expectedActions: ['🎯 Filtered by strategy: momentum'],
    category: 'filter',
    priority: 'high'
  },
  {
    id: 'filter_003',
    description: 'Filter by rating',
    input: 'filter by rating 5',
    expectedActions: ['⭐ Filtered by rating: 5 stars'],
    category: 'filter',
    priority: 'high'
  },
  {
    id: 'filter_004',
    description: 'Clear all filters',
    input: 'clear filters',
    expectedActions: ['🧹 Cleared all filters'],
    category: 'filter',
    priority: 'high'
  },
  {
    id: 'filter_005',
    description: 'Filter winning trades',
    input: 'show only winning trades',
    expectedActions: ['🎯 Filtered to Winning Trades'],
    category: 'filter',
    priority: 'high'
  },

  // TABLE SORTING - MEDIUM PRIORITY
  {
    id: 'sort_001',
    description: 'Sort by profit descending',
    input: 'sort by profit descending',
    expectedActions: ['📊 Sorted by profit (descending)'],
    category: 'sorting',
    priority: 'medium'
  },
  {
    id: 'sort_002',
    description: 'Sort by date',
    input: 'sort by date',
    expectedActions: ['📊 Sorted by date'],
    category: 'sorting',
    priority: 'medium'
  },
  {
    id: 'sort_003',
    description: 'Sort by symbol ascending',
    input: 'sort by symbol asc',
    expectedActions: ['📊 Sorted by symbol (asc)'],
    category: 'sorting',
    priority: 'medium'
  },

  // JOURNAL OPERATIONS - HIGH PRIORITY
  {
    id: 'journal_001',
    description: 'Search journal entries',
    input: 'search journal for TSLA',
    expectedActions: ['🔍 Searched journal for "TSLA"'],
    category: 'journal',
    priority: 'high'
  },
  {
    id: 'journal_002',
    description: 'Open folder',
    input: 'open daily trades folder',
    expectedActions: ['📁 Opened folder: daily trades'],
    category: 'journal',
    priority: 'high'
  },

  // EXPORT/IMPORT OPERATIONS - MEDIUM PRIORITY
  {
    id: 'export_001',
    description: 'Export data',
    input: 'export data',
    expectedActions: ['📤 Initiated Data Export'],
    category: 'export',
    priority: 'medium'
  },
  {
    id: 'export_002',
    description: 'Export trades',
    input: 'export trades',
    expectedActions: ['📤 Initiated Data Export'],
    category: 'export',
    priority: 'medium'
  },

  // PAGINATION COMMANDS - MEDIUM PRIORITY
  {
    id: 'page_001',
    description: 'Next page',
    input: 'next page',
    expectedActions: ['➡️ Next page'],
    category: 'pagination',
    priority: 'medium'
  },
  {
    id: 'page_002',
    description: 'Previous page',
    input: 'previous page',
    expectedActions: ['⬅️ Previous page'],
    category: 'pagination',
    priority: 'medium'
  },
  {
    id: 'page_003',
    description: 'Go to specific page',
    input: 'go to page 3',
    expectedActions: ['📄 Went to page 3'],
    category: 'pagination',
    priority: 'medium'
  },

  // SYSTEM OPERATIONS - MEDIUM PRIORITY
  {
    id: 'system_001',
    description: 'Copy data to clipboard',
    input: 'copy data',
    expectedActions: ['📋 Copied data to clipboard'],
    category: 'system',
    priority: 'medium'
  },
  {
    id: 'system_002',
    description: 'Refresh data',
    input: 'refresh data',
    expectedActions: ['🔄 Refreshed data'],
    category: 'system',
    priority: 'medium'
  },

  // CHART MANIPULATION - MEDIUM PRIORITY
  {
    id: 'chart_001',
    description: 'Zoom in on chart',
    input: 'zoom in on chart',
    expectedActions: ['🔍 Zoomed in on chart'],
    category: 'chart',
    priority: 'medium'
  },
  {
    id: 'chart_002',
    description: 'Reset chart zoom',
    input: 'reset zoom',
    expectedActions: ['📏 Reset chart zoom'],
    category: 'chart',
    priority: 'medium'
  },

  // SETTINGS COMMANDS - MEDIUM PRIORITY
  {
    id: 'settings_001',
    description: 'Enable dark mode',
    input: 'enable dark mode',
    expectedActions: ['🌙 Enabled Dark Mode'],
    category: 'settings',
    priority: 'medium'
  },
  {
    id: 'settings_002',
    description: 'Toggle notifications',
    input: 'toggle notifications',
    expectedActions: ['🔔 Toggled Notifications'],
    category: 'settings',
    priority: 'medium'
  },

  // ENHANCED NATURAL LANGUAGE VARIATIONS - HIGH PRIORITY
  {
    id: 'natural_004',
    description: 'Contextual dollar switching',
    input: 'now can you switch it to dollars',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'display',
    priority: 'high'
  },
  {
    id: 'natural_005',
    description: 'Contextual tab switching',
    input: 'let me see the performance data',
    expectedActions: ['📈 Switched to Performance tab'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'natural_006',
    description: 'Natural scrolling request',
    input: 'can you show me the trading journal area',
    expectedActions: ['📜 Scrolled to Trading Journal section'],
    category: 'scrolling',
    priority: 'high'
  },
  {
    id: 'natural_007',
    description: 'Advanced analytics request',
    input: 'I want to see deeper stats',
    expectedActions: ['🔬 Switched to Analytics tab'],
    category: 'tabs',
    priority: 'high'
  },
  {
    id: 'natural_008',
    description: 'Complex natural request',
    input: 'take me to stats and show cumulative performance',
    expectedActions: [
      '📊 Navigated to Statistics page',
      '📈 Switched to Performance tab'
    ],
    category: 'compound',
    priority: 'high'
  },

  // EDGE CASES - MEDIUM PRIORITY
  {
    id: 'edge_001',
    description: 'Conflicting modes - should use last mentioned',
    input: 'show R and then switch to dollars',
    expectedActions: ['💰 Switched to dollar view'],
    category: 'edge',
    priority: 'medium'
  },
  {
    id: 'edge_002',
    description: 'Multiple navigation - should use last',
    input: 'go to journal then stats',
    expectedActions: ['📊 Navigated to Statistics page'],
    category: 'edge',
    priority: 'medium'
  },
  {
    id: 'edge_003',
    description: 'Natural conversation with commands',
    input: 'hey can you please switch it to dollars and show me yesterday',
    expectedActions: [
      '💰 Switched to dollar view',
      '📅 Set to Yesterday\'s data'
    ],
    category: 'edge',
    priority: 'medium'
  },
  {
    id: 'edge_004',
    description: 'Polite request with multiple actions',
    input: 'would you mind going to analytics and setting it to this month please',
    expectedActions: [
      '⚡ Opened Analytics page',
      '📅 Set to This Month'
    ],
    category: 'edge',
    priority: 'medium'
  },
  {
    id: 'edge_005',
    description: 'Multiple tab references',
    input: 'show overview and then analytics tab',
    expectedActions: ['🔬 Switched to Analytics tab'],
    category: 'edge',
    priority: 'medium'
  },
  {
    id: 'edge_006',
    description: 'Scroll direction conflicts',
    input: 'scroll to top and then bottom',
    expectedActions: ['⬇️ Scrolled to bottom of page'],
    category: 'edge',
    priority: 'medium'
  },

  // NATURAL LANGUAGE VARIATIONS - LOW PRIORITY
  {
    id: 'natural_001',
    description: 'Casual request',
    input: 'let\'s check out the stats page',
    expectedActions: ['📊 Navigated to Statistics page'],
    category: 'navigation',
    priority: 'low'
  },
  {
    id: 'natural_002',
    description: 'Question format',
    input: 'can we look at all time data?',
    expectedActions: ['📈 Set to All Time data'],
    category: 'dateRange',
    priority: 'low'
  },
  {
    id: 'natural_003',
    description: 'Imperative format',
    input: 'change to R view now',
    expectedActions: ['📊 Switched to R-multiple view'],
    category: 'display',
    priority: 'low'
  }
]

export class AgentTester {
  private results: { [testId: string]: { passed: boolean; actualActions: string[]; error?: string } } = {}

  async runTest(testCase: TestCase, processActionsFunction: (input: string) => Promise<string>): Promise<boolean> {
    try {
      console.log(`🧪 Running test: ${testCase.id} - ${testCase.description}`)
      console.log(`📝 Input: "${testCase.input}"`)

      const response = await processActionsFunction(testCase.input)

      // Extract actions from response (this would need to be adapted based on actual implementation)
      const actualActions = this.extractActionsFromResponse(response)

      const passed = this.compareActions(testCase.expectedActions, actualActions)

      this.results[testCase.id] = {
        passed,
        actualActions
      }

      console.log(`${passed ? '✅' : '❌'} Test ${testCase.id}: ${passed ? 'PASSED' : 'FAILED'}`)
      if (!passed) {
        console.log(`   Expected: ${testCase.expectedActions.join(', ')}`)
        console.log(`   Actual: ${actualActions.join(', ')}`)
      }

      return passed
    } catch (error) {
      console.error(`💥 Test ${testCase.id} failed with error:`, error)
      this.results[testCase.id] = {
        passed: false,
        actualActions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      return false
    }
  }

  private extractActionsFromResponse(response: string): string[] {
    // Extract actions from the response format
    const lines = response.split('\n')
    return lines
      .filter(line => line.includes('📊') || line.includes('💰') || line.includes('📝') ||
                     line.includes('📈') || line.includes('⚡') || line.includes('📅') ||
                     line.includes('🏠') || line.includes('⚙️') || line.includes('📜') ||
                     line.includes('⬆️') || line.includes('⬇️') || line.includes('🔬') ||
                     line.includes('🔤') || line.includes('🏷️') || line.includes('⏰'))
      .map(line => line.trim())
  }

  private compareActions(expected: string[], actual: string[]): boolean {
    if (expected.length !== actual.length) return false

    return expected.every((expectedAction, index) => {
      // Remove all emojis and compare just the text content
      const cleanExpected = expectedAction.replace(/📊|💰|📝|📈|⚡|📅|🏠|⚙️|📜|⬆️|⬇️|🔬|🔤|🏷️|⏰/g, '').trim()
      const cleanActual = actual[index]?.replace(/📊|💰|📝|📈|⚡|📅|🏠|⚙️|📜|⬆️|⬇️|🔬|🔤|🏷️|⏰/g, '').trim()

      // Check if the core action text matches (case insensitive)
      return cleanActual?.toLowerCase().includes(cleanExpected.toLowerCase()) || false
    })
  }

  getTestResults() {
    const total = Object.keys(this.results).length
    const passed = Object.values(this.results).filter(r => r.passed).length
    const failed = total - passed

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      results: this.results
    }
  }

  generateReport(): string {
    const { total, passed, failed, passRate } = this.getTestResults()

    let report = `\n🧪 AGENT TESTING REPORT\n`
    report += `========================\n`
    report += `Total Tests: ${total}\n`
    report += `Passed: ${passed}\n`
    report += `Failed: ${failed}\n`
    report += `Pass Rate: ${passRate.toFixed(1)}%\n\n`

    // Group results by category
    const categories = ['display', 'navigation', 'dateRange', 'compound', 'tabs', 'scrolling', 'edge']

    categories.forEach(category => {
      const categoryTests = COMPREHENSIVE_TEST_CASES.filter(t => t.category === category)
      const categoryResults = categoryTests.map(t => this.results[t.id]).filter(Boolean)
      const categoryPassed = categoryResults.filter(r => r.passed).length

      if (categoryResults.length > 0) {
        report += `${category.toUpperCase()}: ${categoryPassed}/${categoryResults.length} passed\n`
      }
    })

    // List failed tests
    const failedTests = Object.entries(this.results)
      .filter(([_, result]) => !result.passed)
      .map(([testId, _]) => testId)

    if (failedTests.length > 0) {
      report += `\n❌ FAILED TESTS:\n`
      failedTests.forEach(testId => {
        const test = COMPREHENSIVE_TEST_CASES.find(t => t.id === testId)
        if (test) {
          report += `- ${testId}: ${test.description}\n`
        }
      })
    }

    return report
  }
}

export function runBulletproofTests(processActionsFunction: (input: string) => Promise<string>) {
  const tester = new AgentTester()

  // Run high priority tests first
  const highPriorityTests = COMPREHENSIVE_TEST_CASES.filter(t => t.priority === 'high')

  console.log('🚀 Starting bulletproof testing...')

  return Promise.all(
    highPriorityTests.map(test => tester.runTest(test, processActionsFunction))
  ).then(() => {
    console.log(tester.generateReport())
    return tester.getTestResults()
  })
}