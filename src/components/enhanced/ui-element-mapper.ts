'use client'

/**
 * Comprehensive UI Element Mapper for Renata AI Agent
 *
 * This module provides detailed knowledge of all UI elements, components,
 * and interactive elements across all pages in the Traderra application.
 * It enables the AI to understand and interact with specific UI elements
 * beyond basic navigation and settings.
 */

export interface UIElement {
  id: string
  type: 'tab' | 'button' | 'dropdown' | 'filter' | 'chart' | 'table' | 'modal' | 'input' | 'toggle' | 'scrollable' | 'link' | 'section'
  name: string
  description: string
  location: {
    page: string
    section?: string
    parent?: string
  }
  selector: string[]
  attributes: {
    testId?: string
    ariaLabel?: string
    text?: string
    className?: string
    role?: string
  }
  interactions: string[]
  state?: {
    active?: boolean
    visible?: boolean
    enabled?: boolean
  }
  dependencies?: string[] // Elements that should be interacted with before this one
  alternatives?: string[] // Alternative elements if this one is not found
}

export interface PageStructure {
  page: string
  url: string
  sections: string[]
  tabs?: Record<string, TabInfo>
  elements: UIElement[]
  navigation: {
    breadcrumbs?: string[]
    relatedPages?: string[]
  }
}

export interface TabInfo {
  id: string
  label: string
  icon?: string
  description: string
  elements: UIElement[]
}

/**
 * Complete UI Element Database for Traderra Application
 */
export const UI_ELEMENT_DATABASE: Record<string, PageStructure> = {
  // Dashboard Page
  dashboard: {
    page: 'dashboard',
    url: '/dashboard',
    sections: [
      'header', 'overview-metrics', 'performance-charts', 'trading-journal',
      'day-of-week-analysis', 'symbols-analysis', 'tags-analysis', 'setups-analysis', 'time-analysis'
    ],
    elements: [
      // Header Controls
      {
        id: 'date-selector',
        type: 'dropdown',
        name: 'Date Range Selector',
        description: 'Dropdown to select time range for dashboard data',
        location: { page: 'dashboard', section: 'header' },
        selector: ['[data-testid="date-selector"]', '.date-selector', 'select[aria-label*="date range"]'],
        attributes: { testId: 'date-selector', role: 'combobox', ariaLabel: 'Select date range' },
        interactions: ['click', 'select-option', 'filter-data'],
        alternatives: ['date-range-buttons', 'custom-date-range']
      },
      {
        id: 'display-mode-toggle',
        type: 'toggle',
        name: 'Display Mode Toggle',
        description: 'Toggle between dollar ($) and R-multiple (R) display modes',
        location: { page: 'dashboard', section: 'header' },
        selector: [
          '[data-testid="display-mode-dollar"]',
          '[data-testid="display-mode-r"]',
          '.display-mode-toggle',
          'button[aria-label*="display mode"]'
        ],
        attributes: {
          testId: 'display-mode-dollar',
          role: 'switch',
          text: '$'
        },
        interactions: ['click', 'toggle-mode', 'change-display'],
        alternatives: ['display-settings', 'view-options']
      },
      {
        id: 'pnl-mode-toggle',
        type: 'toggle',
        name: 'P&L Mode Toggle',
        description: 'Toggle between gross and net P&L display',
        location: { page: 'dashboard', section: 'header' },
        selector: ['.pnl-mode-toggle', 'button[aria-label*="pnl mode"]', '[data-testid="pnl-mode"]'],
        attributes: { testId: 'pnl-mode', role: 'switch' },
        interactions: ['click', 'toggle-pnl'],
        alternatives: ['pnl-settings']
      },

      // Overview Metrics Section
      {
        id: 'overview-metrics',
        type: 'section',
        name: 'Overview Metrics Cards',
        description: 'Summary cards showing total P&L, win rate, number of trades, etc.',
        location: { page: 'dashboard', section: 'overview-metrics' },
        selector: ['.overview-metrics', '.metrics-grid', '.stats-cards'],
        attributes: { role: 'region', ariaLabel: 'Performance overview' },
        interactions: ['view', 'scan-metrics'],
        alternatives: ['performance-summary', 'stats-section']
      },
      {
        id: 'total-pnl-card',
        type: 'chart',
        name: 'Total P&L Card',
        description: 'Card showing total profit and loss',
        location: { page: 'dashboard', section: 'overview-metrics' },
        selector: ['.metric-card[data-metric="total-pnl"]', '.total-pnl'],
        attributes: { text: 'Total', className: 'metric-card' },
        interactions: ['view', 'hover'],
        alternatives: ['pnl-summary', 'profit-loss-card']
      },

      // Performance Charts
      {
        id: 'performance-chart',
        type: 'chart',
        name: 'Performance Chart',
        description: 'Main performance chart showing P&L over time',
        location: { page: 'dashboard', section: 'performance-charts' },
        selector: ['.performance-chart', '.main-chart', '[data-testid="performance-chart"]'],
        attributes: { testId: 'performance-chart', role: 'img', ariaLabel: 'Performance chart' },
        interactions: ['view', 'zoom', 'hover', 'filter'],
        alternatives: ['main-chart', 'pnl-chart']
      },
      {
        id: 'chart-zoom-controls',
        type: 'button',
        name: 'Chart Zoom Controls',
        description: 'Buttons to zoom in/out and reset chart view',
        location: { page: 'dashboard', section: 'performance-charts' },
        selector: ['.chart-controls', '.zoom-controls', 'button[aria-label*="zoom"]'],
        attributes: { role: 'group', ariaLabel: 'Chart controls' },
        interactions: ['click', 'zoom-in', 'zoom-out', 'reset'],
        alternatives: ['chart-toolbar']
      },

      // Trading Journal Section
      {
        id: 'trading-journal-section',
        type: 'scrollable',
        name: 'Trading Journal Section',
        description: 'Scrollable section showing recent journal entries',
        location: { page: 'dashboard', section: 'trading-journal' },
        selector: ['.trading-journal', '.journal-section', '[data-testid="trading-journal"]'],
        attributes: { testId: 'trading-journal', role: 'region' },
        interactions: ['scroll', 'view-entries', 'click-entry'],
        alternatives: ['journal-feed', 'recent-entries']
      },
      {
        id: 'journal-entry',
        type: 'link',
        name: 'Journal Entry',
        description: 'Individual journal entry in the feed',
        location: { page: 'dashboard', section: 'trading-journal' },
        selector: ['.journal-entry', '.entry-card', '[data-testid="journal-entry"]'],
        attributes: { className: 'journal-entry' },
        interactions: ['click', 'view-details'],
        alternatives: ['entry-item', 'journal-item']
      },

      // Analysis Tabs
      {
        id: 'day-of-week-tab',
        type: 'tab',
        name: 'Day of Week Analysis Tab',
        description: 'Tab showing performance analysis by day of week',
        location: { page: 'dashboard', section: 'day-of-week-analysis' },
        selector: [
          'button[data-tab="day-of-week"]',
          'button[aria-label*="day of week"]',
          '.tab[data-tab="day-of-week"]'
        ],
        attributes: { testId: 'day-of-week-tab', role: 'tab', text: 'Day of Week' },
        interactions: ['click', 'activate', 'view-analysis'],
        alternatives: ['weekly-analysis', 'day-analysis']
      },
      {
        id: 'symbols-analysis-tab',
        type: 'tab',
        name: 'Symbols Analysis Tab',
        description: 'Tab showing performance analysis by trading symbols',
        location: { page: 'dashboard', section: 'symbols-analysis' },
        selector: [
          'button[data-tab="symbols"]',
          'button[aria-label*="symbols"]',
          '.tab[data-tab="symbols"]'
        ],
        attributes: { testId: 'symbols-tab', role: 'tab', text: 'Symbols' },
        interactions: ['click', 'activate', 'view-analysis'],
        alternatives: ['symbol-performance', 'instrument-analysis']
      },
      {
        id: 'tags-analysis-tab',
        type: 'tab',
        name: 'Tags Analysis Tab',
        description: 'Tab showing performance analysis by trade tags',
        location: { page: 'dashboard', section: 'tags-analysis' },
        selector: [
          'button[data-tab="tags"]',
          'button[aria-label*="tags"]',
          '.tab[data-tab="tags"]'
        ],
        attributes: { testId: 'tags-tab', role: 'tab', text: 'Tags' },
        interactions: ['click', 'activate', 'view-analysis'],
        alternatives: ['tag-performance', 'label-analysis']
      },
      {
        id: 'setups-analysis-tab',
        type: 'tab',
        name: 'Setups Analysis Tab',
        description: 'Tab showing performance analysis by trade setups',
        location: { page: 'dashboard', section: 'setups-analysis' },
        selector: [
          'button[data-tab="setups"]',
          'button[aria-label*="setups"]',
          '.tab[data-tab="setups"]'
        ],
        attributes: { testId: 'setups-tab', role: 'tab', text: 'Setups' },
        interactions: ['click', 'activate', 'view-analysis'],
        alternatives: ['setup-performance', 'strategy-analysis']
      },
      {
        id: 'time-analysis-tab',
        type: 'tab',
        name: 'Time Analysis Tab',
        description: 'Tab showing performance analysis by time periods',
        location: { page: 'dashboard', section: 'time-analysis' },
        selector: [
          'button[data-tab="time"]',
          'button[aria-label*="time"]',
          '.tab[data-tab="time"]'
        ],
        attributes: { testId: 'time-tab', role: 'tab', text: 'Time' },
        interactions: ['click', 'activate', 'view-analysis'],
        alternatives: ['time-performance', 'hourly-analysis']
      }
    ],
    navigation: {
      relatedPages: ['statistics', 'analytics', 'trades', 'journal']
    }
  },

  // Statistics Page
  statistics: {
    page: 'statistics',
    url: '/statistics',
    sections: ['header', 'tabs', 'tab-content', 'charts', 'tables'],
    tabs: {
      overview: {
        id: 'overview',
        label: 'Overview',
        description: 'General trading statistics and performance overview',
        elements: [
          {
            id: 'overview-stats-grid',
            type: 'section',
            name: 'Overview Statistics Grid',
            description: 'Grid showing key trading statistics',
            location: { page: 'statistics', section: 'tab-content', parent: 'overview' },
            selector: ['.overview-stats', '.stats-grid', '[data-tab-content="overview"]'],
            attributes: { testId: 'overview-stats', role: 'region' },
            interactions: ['view', 'scan-stats'],
            alternatives: ['general-stats', 'summary-stats']
          }
        ]
      },
      performance: {
        id: 'performance',
        label: 'Performance',
        description: 'Detailed performance metrics and analysis',
        elements: [
          {
            id: 'performance-metrics',
            type: 'table',
            name: 'Performance Metrics Table',
            description: 'Detailed table showing performance metrics',
            location: { page: 'statistics', section: 'tab-content', parent: 'performance' },
            selector: [
              '.performance-metrics',
              '.metrics-table',
              '[data-tab-content="performance"]'
            ],
            attributes: { testId: 'performance-metrics', role: 'table' },
            interactions: ['view', 'sort', 'filter'],
            alternatives: ['performance-table', 'detailed-metrics']
          },
          {
            id: 'cumulative-performance-chart',
            type: 'chart',
            name: 'Cumulative Performance Chart',
            description: 'Chart showing cumulative performance over time',
            location: { page: 'statistics', section: 'tab-content', parent: 'performance' },
            selector: [
              '.cumulative-chart',
              '.performance-chart',
              '[data-chart="cumulative"]'
            ],
            attributes: { testId: 'cumulative-chart', role: 'img' },
            interactions: ['view', 'zoom', 'hover'],
            alternatives: ['cumulative-pnl-chart']
          }
        ]
      },
      analytics: {
        id: 'analytics',
        label: 'Analytics',
        description: 'Advanced analytics and insights',
        elements: [
          {
            id: 'advanced-analytics',
            type: 'section',
            name: 'Advanced Analytics Section',
            description: 'Advanced analytics and insights',
            location: { page: 'statistics', section: 'tab-content', parent: 'analytics' },
            selector: [
              '.advanced-analytics',
              '.analytics-content',
              '[data-tab-content="analytics"]'
            ],
            attributes: { testId: 'advanced-analytics', role: 'region' },
            interactions: ['view', 'analyze'],
            alternatives: ['insights-section', 'analysis-content']
          }
        ]
      }
    },
    elements: [
      // Tab Navigation
      {
        id: 'overview-tab',
        type: 'tab',
        name: 'Overview Tab',
        description: 'Tab showing general statistics overview',
        location: { page: 'statistics', section: 'tabs' },
        selector: [
          'button[data-tab="overview"]',
          'button[aria-label*="overview"]',
          '.tab:first-child'
        ],
        attributes: { testId: 'overview-tab', role: 'tab', text: 'Overview' },
        interactions: ['click', 'activate'],
        alternatives: ['summary-tab', 'general-tab']
      },
      {
        id: 'performance-tab',
        type: 'tab',
        name: 'Performance Tab',
        description: 'Tab showing detailed performance metrics',
        location: { page: 'statistics', section: 'tabs' },
        selector: [
          'button[data-tab="performance"]',
          'button[aria-label*="performance"]',
          '.tab:nth-child(2)'
        ],
        attributes: { testId: 'performance-tab', role: 'tab', text: 'Performance' },
        interactions: ['click', 'activate'],
        alternatives: ['detailed-performance', 'metrics-tab']
      },
      {
        id: 'analytics-tab',
        type: 'tab',
        name: 'Analytics Tab',
        description: 'Tab showing advanced analytics',
        location: { page: 'statistics', section: 'tabs' },
        selector: [
          'button[data-tab="analytics"]',
          'button[aria-label*="analytics"]',
          '.tab:nth-child(3)'
        ],
        attributes: { testId: 'analytics-tab', role: 'tab', text: 'Analytics' },
        interactions: ['click', 'activate'],
        alternatives: ['advanced-tab', 'insights-tab']
      },

      // Export and Filter Controls
      {
        id: 'export-button',
        type: 'button',
        name: 'Export Data Button',
        description: 'Button to export statistics data',
        location: { page: 'statistics', section: 'header' },
        selector: [
          '.export-button',
          'button[aria-label*="export"]',
          '[data-testid="export-button"]'
        ],
        attributes: { testId: 'export-button', ariaLabel: 'Export data' },
        interactions: ['click', 'export'],
        alternatives: ['download-button', 'save-data']
      },
      {
        id: 'filter-controls',
        type: 'filter',
        name: 'Statistics Filter Controls',
        description: 'Controls to filter statistics data',
        location: { page: 'statistics', section: 'header' },
        selector: [
          '.filter-controls',
          '.stats-filters',
          '[data-testid="stats-filters"]'
        ],
        attributes: { testId: 'stats-filters', role: 'group' },
        interactions: ['click', 'select', 'apply-filter'],
        alternatives: ['data-filters', 'filter-options']
      }
    ],
    navigation: {
      relatedPages: ['dashboard', 'analytics', 'trades']
    }
  },

  // Trades Page
  trades: {
    page: 'trades',
    url: '/trades',
    sections: ['header', 'toolbar', 'trades-table', 'pagination', 'modals'],
    elements: [
      // Toolbar Controls
      {
        id: 'new-trade-button',
        type: 'button',
        name: 'New Trade Button',
        description: 'Button to create a new trade entry',
        location: { page: 'trades', section: 'toolbar' },
        selector: [
          '.new-trade-button',
          'button[aria-label*="new trade"]',
          '[data-testid="new-trade-btn"]'
        ],
        attributes: { testId: 'new-trade-btn', ariaLabel: 'Create new trade' },
        interactions: ['click', 'open-modal'],
        alternatives: ['add-trade', 'create-trade']
      },
      {
        id: 'import-trades-button',
        type: 'button',
        name: 'Import Trades Button',
        description: 'Button to import trades from file',
        location: { page: 'trades', section: 'toolbar' },
        selector: [
          '.import-trades-button',
          'button[aria-label*="import"]',
          '[data-testid="import-trades-btn"]'
        ],
        attributes: { testId: 'import-trades-btn', ariaLabel: 'Import trades' },
        interactions: ['click', 'open-import-dialog'],
        alternatives: ['upload-trades', 'bulk-import']
      },
      {
        id: 'filter-dropdown',
        type: 'dropdown',
        name: 'Trade Filter Dropdown',
        description: 'Dropdown to filter trades by various criteria',
        location: { page: 'trades', section: 'toolbar' },
        selector: [
          '.trade-filters',
          '.filter-dropdown',
          '[data-testid="trade-filters"]'
        ],
        attributes: { testId: 'trade-filters', role: 'combobox' },
        interactions: ['click', 'select-filter', 'apply-filter'],
        alternatives: ['filter-options', 'trade-filtering']
      },

      // Trades Table
      {
        id: 'trades-table',
        type: 'table',
        name: 'Trades Table',
        description: 'Main table showing all trades',
        location: { page: 'trades', section: 'trades-table' },
        selector: [
          '.trades-table',
          'table[data-testid="trades-table"]',
          '.trade-list'
        ],
        attributes: { testId: 'trades-table', role: 'table' },
        interactions: ['view', 'sort', 'filter', 'click-row'],
        alternatives: ['trade-list', 'positions-table']
      },
      {
        id: 'trade-row',
        type: 'link',
        name: 'Trade Row',
        description: 'Individual trade row in the trades table',
        location: { page: 'trades', section: 'trades-table' },
        selector: [
          '.trade-row',
          'tr[data-trade-id]',
          '[data-testid="trade-row"]'
        ],
        attributes: { className: 'trade-row' },
        interactions: ['click', 'view-details'],
        alternatives: ['trade-item', 'position-row']
      },
      {
        id: 'sort-columns',
        type: 'button',
        name: 'Table Column Sort Headers',
        description: 'Clickable column headers to sort the trades table',
        location: { page: 'trades', section: 'trades-table' },
        selector: [
          '.sortable-header',
          'th[data-sortable]',
          '.column-sort'
        ],
        attributes: { role: 'columnheader' },
        interactions: ['click', 'sort'],
        alternatives: ['column-headers', 'table-sorters']
      },

      // Pagination
      {
        id: 'pagination-controls',
        type: 'button',
        name: 'Pagination Controls',
        description: 'Controls to navigate through pages of trades',
        location: { page: 'trades', section: 'pagination' },
        selector: [
          '.pagination',
          '.page-controls',
          '[data-testid="pagination"]'
        ],
        attributes: { testId: 'pagination', role: 'navigation' },
        interactions: ['click', 'next-page', 'prev-page', 'go-to-page'],
        alternatives: ['page-navigation', 'table-pagination']
      }
    ],
    navigation: {
      relatedPages: ['dashboard', 'journal', 'analytics']
    }
  },

  // Journal Page
  journal: {
    page: 'journal',
    url: '/journal',
    sections: ['header', 'toolbar', 'journal-editor', 'entries-list', 'folder-tree'],
    elements: [
      // Toolbar
      {
        id: 'new-entry-button',
        type: 'button',
        name: 'New Journal Entry Button',
        description: 'Button to create a new journal entry',
        location: { page: 'journal', section: 'toolbar' },
        selector: [
          '.new-entry-button',
          'button[aria-label*="new entry"]',
          '[data-testid="new-entry-btn"]'
        ],
        attributes: { testId: 'new-entry-btn', ariaLabel: 'Create new journal entry' },
        interactions: ['click', 'open-editor'],
        alternatives: ['add-entry', 'create-journal']
      },
      {
        id: 'search-journal',
        type: 'input',
        name: 'Journal Search Input',
        description: 'Search input to find journal entries',
        location: { page: 'journal', section: 'toolbar' },
        selector: [
          '.journal-search',
          'input[placeholder*="search"]',
          '[data-testid="journal-search"]'
        ],
        attributes: { testId: 'journal-search', role: 'searchbox' },
        interactions: ['type', 'search', 'filter'],
        alternatives: ['search-bar', 'entry-search']
      },

      // Editor
      {
        id: 'journal-editor',
        type: 'input',
        name: 'Journal Editor',
        description: 'Rich text editor for creating/editing journal entries',
        location: { page: 'journal', section: 'journal-editor' },
        selector: [
          '.journal-editor',
          '.rich-editor',
          '[data-testid="journal-editor"]'
        ],
        attributes: {
          testId: 'journal-editor',
          role: 'textbox',
          ariaLabel: 'Journal content editor'
        },
        interactions: ['type', 'format', 'save'],
        alternatives: ['entry-editor', 'text-editor']
      },
      {
        id: 'save-entry-button',
        type: 'button',
        name: 'Save Entry Button',
        description: 'Button to save journal entry',
        location: { page: 'journal', section: 'journal-editor' },
        selector: [
          '.save-entry-button',
          'button[aria-label*="save"]',
          '[data-testid="save-entry-btn"]'
        ],
        attributes: { testId: 'save-entry-btn', ariaLabel: 'Save journal entry' },
        interactions: ['click', 'save'],
        alternatives: ['save-btn', 'submit-entry']
      },

      // Folder Tree
      {
        id: 'folder-tree',
        type: 'scrollable',
        name: 'Journal Folder Tree',
        description: 'Hierarchical tree view of journal folders',
        location: { page: 'journal', section: 'folder-tree' },
        selector: [
          '.folder-tree',
          '.journal-folders',
          '[data-testid="folder-tree"]'
        ],
        attributes: { testId: 'folder-tree', role: 'tree' },
        interactions: ['click', 'expand', 'collapse', 'navigate'],
        alternatives: ['folder-navigation', 'journal-tree']
      },
      {
        id: 'folder-item',
        type: 'link',
        name: 'Journal Folder Item',
        description: 'Individual folder in the journal folder tree',
        location: { page: 'journal', section: 'folder-tree' },
        selector: [
          '.folder-item',
          'li[data-folder]',
          '[data-testid="folder-item"]'
        ],
        attributes: { className: 'folder-item' },
        interactions: ['click', 'expand', 'collapse'],
        alternatives: ['folder-node', 'tree-item']
      },

      // Entries List
      {
        id: 'entries-list',
        type: 'scrollable',
        name: 'Journal Entries List',
        description: 'List of journal entries',
        location: { page: 'journal', section: 'entries-list' },
        selector: [
          '.entries-list',
          '.journal-entries',
          '[data-testid="entries-list"]'
        ],
        attributes: { testId: 'entries-list', role: 'list' },
        interactions: ['scroll', 'view', 'click-entry'],
        alternatives: ['entry-list', 'journal-feed']
      }
    ],
    navigation: {
      relatedPages: ['dashboard', 'trades', 'analytics']
    }
  },

  // Analytics Page
  analytics: {
    page: 'analytics',
    url: '/analytics',
    sections: ['header', 'chart-controls', 'charts', 'reports', 'export-options'],
    elements: [
      // Chart Controls
      {
        id: 'chart-type-selector',
        type: 'dropdown',
        name: 'Chart Type Selector',
        description: 'Selector to choose different chart types',
        location: { page: 'analytics', section: 'chart-controls' },
        selector: [
          '.chart-type-selector',
          'select[aria-label*="chart type"]',
          '[data-testid="chart-type"]'
        ],
        attributes: { testId: 'chart-type', role: 'combobox' },
        interactions: ['click', 'select-chart'],
        alternatives: ['chart-options', 'visualization-type']
      },
      {
        id: 'time-range-selector',
        type: 'dropdown',
        name: 'Analytics Time Range Selector',
        description: 'Selector for time range in analytics',
        location: { page: 'analytics', section: 'chart-controls' },
        selector: [
          '.time-range-selector',
          'select[aria-label*="time range"]',
          '[data-testid="analytics-time-range"]'
        ],
        attributes: { testId: 'analytics-time-range', role: 'combobox' },
        interactions: ['click', 'select-range'],
        alternatives: ['period-selector', 'analytics-range']
      },

      // Charts
      {
        id: 'performance-chart-analytics',
        type: 'chart',
        name: 'Analytics Performance Chart',
        description: 'Main performance chart in analytics page',
        location: { page: 'analytics', section: 'charts' },
        selector: [
          '.analytics-chart',
          '.performance-chart-analytics',
          '[data-testid="analytics-chart"]'
        ],
        attributes: { testId: 'analytics-chart', role: 'img' },
        interactions: ['view', 'zoom', 'hover', 'filter'],
        alternatives: ['main-analytics-chart', 'analytics-viz']
      },
      {
        id: 'distribution-chart',
        type: 'chart',
        name: 'Distribution Chart',
        description: 'Chart showing trade distribution',
        location: { page: 'analytics', section: 'charts' },
        selector: [
          '.distribution-chart',
          '[data-chart="distribution"]',
          '[data-testid="distribution-chart"]'
        ],
        attributes: { testId: 'distribution-chart', role: 'img' },
        interactions: ['view', 'hover'],
        alternatives: ['histogram', 'distribution-viz']
      },

      // Reports
      {
        id: 'generate-report-button',
        type: 'button',
        name: 'Generate Report Button',
        description: 'Button to generate analytics report',
        location: { page: 'analytics', section: 'reports' },
        selector: [
          '.generate-report-button',
          'button[aria-label*="generate report"]',
          '[data-testid="generate-report"]'
        ],
        attributes: { testId: 'generate-report', ariaLabel: 'Generate analytics report' },
        interactions: ['click', 'generate', 'download'],
        alternatives: ['create-report', 'report-btn']
      },

      // Export Options
      {
        id: 'export-analytics-button',
        type: 'button',
        name: 'Export Analytics Button',
        description: 'Button to export analytics data',
        location: { page: 'analytics', section: 'export-options' },
        selector: [
          '.export-analytics-button',
          'button[aria-label*="export analytics"]',
          '[data-testid="export-analytics"]'
        ],
        attributes: { testId: 'export-analytics', ariaLabel: 'Export analytics data' },
        interactions: ['click', 'export'],
        alternatives: ['download-analytics', 'export-data']
      }
    ],
    navigation: {
      relatedPages: ['statistics', 'dashboard', 'trades']
    }
  },

  // Calendar Page
  calendar: {
    page: 'calendar',
    url: '/calendar',
    sections: ['header', 'calendar-view', 'legend', 'filters'],
    elements: [
      // Calendar View
      {
        id: 'calendar-grid',
        type: 'scrollable',
        name: 'Calendar Grid',
        description: 'Main calendar grid showing trading days',
        location: { page: 'calendar', section: 'calendar-view' },
        selector: [
          '.calendar-grid',
          '.calendar-view',
          '[data-testid="calendar-grid"]'
        ],
        attributes: { testId: 'calendar-grid', role: 'grid' },
        interactions: ['view', 'navigate', 'click-date'],
        alternatives: ['calendar', 'date-grid']
      },
      {
        id: 'calendar-day',
        type: 'link',
        name: 'Calendar Day',
        description: 'Individual day cell in the calendar',
        location: { page: 'calendar', section: 'calendar-view' },
        selector: [
          '.calendar-day',
          '[data-date]',
          '[data-testid="calendar-day"]'
        ],
        attributes: { className: 'calendar-day' },
        interactions: ['click', 'view-details'],
        alternatives: ['date-cell', 'day-cell']
      },

      // Navigation Controls
      {
        id: 'month-navigation',
        type: 'button',
        name: 'Month Navigation',
        description: 'Buttons to navigate between months',
        location: { page: 'calendar', section: 'header' },
        selector: [
          '.month-nav',
          '.calendar-navigation',
          '[data-testid="month-nav"]'
        ],
        attributes: { testId: 'month-nav', role: 'group' },
        interactions: ['click', 'next-month', 'prev-month'],
        alternatives: ['calendar-nav', 'month-controls']
      },

      // Legend and Filters
      {
        id: 'calendar-legend',
        type: 'section',
        name: 'Calendar Legend',
        description: 'Legend showing color coding for calendar days',
        location: { page: 'calendar', section: 'legend' },
        selector: [
          '.calendar-legend',
          '.legend',
          '[data-testid="calendar-legend"]'
        ],
        attributes: { testId: 'calendar-legend', role: 'legend' },
        interactions: ['view'],
        alternatives: ['color-legend', 'day-legend']
      },
      {
        id: 'calendar-filters',
        type: 'filter',
        name: 'Calendar Filters',
        description: 'Filters to control what is shown on calendar',
        location: { page: 'calendar', section: 'filters' },
        selector: [
          '.calendar-filters',
          '.filters',
          '[data-testid="calendar-filters"]'
        ],
        attributes: { testId: 'calendar-filters', role: 'group' },
        interactions: ['click', 'toggle-filter'],
        alternatives: ['calendar-controls', 'display-options']
      }
    ],
    navigation: {
      relatedPages: ['dashboard', 'trades', 'journal']
    }
  },

  // Settings Page
  settings: {
    page: 'settings',
    url: '/settings',
    sections: ['header', 'navigation', 'settings-sections'],
    elements: [
      // Settings Navigation
      {
        id: 'settings-nav',
        type: 'tab',
        name: 'Settings Navigation',
        description: 'Navigation between different settings sections',
        location: { page: 'settings', section: 'navigation' },
        selector: [
          '.settings-nav',
          '.settings-menu',
          '[data-testid="settings-nav"]'
        ],
        attributes: { testId: 'settings-nav', role: 'navigation' },
        interactions: ['click', 'navigate'],
        alternatives: ['settings-menu', 'preferences-nav']
      },

      // Common Settings Elements
      {
        id: 'save-settings-button',
        type: 'button',
        name: 'Save Settings Button',
        description: 'Button to save settings changes',
        location: { page: 'settings', section: 'settings-sections' },
        selector: [
          '.save-settings',
          'button[aria-label*="save settings"]',
          '[data-testid="save-settings"]'
        ],
        attributes: { testId: 'save-settings', ariaLabel: 'Save settings' },
        interactions: ['click', 'save'],
        alternatives: ['apply-settings', 'save-btn']
      },
      {
        id: 'reset-settings-button',
        type: 'button',
        name: 'Reset Settings Button',
        description: 'Button to reset settings to defaults',
        location: { page: 'settings', section: 'settings-sections' },
        selector: [
          '.reset-settings',
          'button[aria-label*="reset settings"]',
          '[data-testid="reset-settings"]'
        ],
        attributes: { testId: 'reset-settings', ariaLabel: 'Reset settings' },
        interactions: ['click', 'reset'],
        alternatives: ['default-settings', 'restore-defaults']
      }
    ],
    navigation: {
      relatedPages: ['dashboard', 'profile', 'account']
    }
  }
}

/**
 * UI Element Finder and Interaction Helper
 */
export class UIElementFinder {
  private elementDatabase: Record<string, PageStructure>

  constructor() {
    this.elementDatabase = UI_ELEMENT_DATABASE
  }

  /**
   * Find UI elements by natural language query
   */
  public findElements(query: string, currentPage?: string): UIElement[] {
    const lowerQuery = query.toLowerCase()
    const results: UIElement[] = []

    // Search in current page first, then all pages
    const pagesToSearch = currentPage
      ? [currentPage, ...Object.keys(this.elementDatabase).filter(p => p !== currentPage)]
      : Object.keys(this.elementDatabase)

    for (const pageKey of pagesToSearch) {
      const page = this.elementDatabase[pageKey]

      // Check if page name matches
      if (pageKey.includes(lowerQuery) || lowerQuery.includes(pageKey)) {
        results.push(...page.elements)
        continue
      }

      // Search through elements
      for (const element of page.elements) {
        const searchText = `${element.name} ${element.description} ${element.id}`.toLowerCase()

        // Check various match criteria
        if (
          searchText.includes(lowerQuery) ||
          element.attributes.text?.toLowerCase().includes(lowerQuery) ||
          element.attributes.ariaLabel?.toLowerCase().includes(lowerQuery) ||
          element.type.toLowerCase().includes(lowerQuery)
        ) {
          results.push(element)
        }
      }
    }

    return results
  }

  /**
   * Find a specific element by ID
   */
  public findElementById(id: string): UIElement | null {
    for (const page of Object.values(this.elementDatabase)) {
      const element = page.elements.find(el => el.id === id)
      if (element) return element
    }
    return null
  }

  /**
   * Get all elements for a specific page
   */
  public getPageElements(pageKey: string): UIElement[] {
    const page = this.elementDatabase[pageKey]
    return page ? page.elements : []
  }

  /**
   * Get element selector with fallbacks
   */
  public getElementSelector(element: UIElement): string[] {
    return element.selector
  }

  /**
   * Check if an element exists on the current page
   */
  public elementExists(element: UIElement): boolean {
    for (const selector of element.selector) {
      try {
        const found = document.querySelector(selector)
        if (found) return true
      } catch (error) {
        console.warn(`Invalid selector: ${selector}`, error)
      }
    }
    return false
  }

  /**
   * Get interactable elements (buttons, links, inputs, etc.)
   */
  public getInteractableElements(pageKey?: string): UIElement[] {
    const elements = pageKey ? this.getPageElements(pageKey) : Object.values(this.elementDatabase).flatMap(p => p.elements)
    return elements.filter(el => ['button', 'link', 'input', 'dropdown', 'toggle', 'tab'].includes(el.type))
  }

  /**
   * Get scrollable elements
   */
  public getScrollableElements(pageKey?: string): UIElement[] {
    const elements = pageKey ? this.getPageElements(pageKey) : Object.values(this.elementDatabase).flatMap(p => p.elements)
    return elements.filter(el => el.type === 'scrollable')
  }

  /**
   * Get all tabs for a page
   */
  public getPageTabs(pageKey: string): UIElement[] {
    const elements = this.getPageElements(pageKey)
    return elements.filter(el => el.type === 'tab')
  }
}

/**
 * Export singleton instance
 */
export const uiElementFinder = new UIElementFinder()

/**
 * Helper functions for common UI element queries
 */
export const UI_HELPERS = {
  /**
   * Find performance tab on any page
   */
  findPerformanceTab: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('performance tab', currentPage)
  },

  /**
   * Find overview tab on any page
   */
  findOverviewTab: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('overview tab', currentPage)
  },

  /**
   * Find analytics tab on any page
   */
  findAnalyticsTab: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('analytics tab', currentPage)
  },

  /**
   * Find charts on current page
   */
  findCharts: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('chart', currentPage)
  },

  /**
   * Find tables on current page
   */
  findTables: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('table', currentPage)
  },

  /**
   * Find scrollable sections
   */
  findScrollableSections: (currentPage?: string): UIElement[] => {
    const scrollables = uiElementFinder.getScrollableElements(currentPage)
    if (currentPage) {
      return scrollables.filter(el => el.location.page === currentPage)
    }
    return scrollables
  },

  /**
   * Find export buttons
   */
  findExportButtons: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('export', currentPage).filter(el => el.type === 'button')
  },

  /**
   * Find filter controls
   */
  findFilterControls: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('filter', currentPage)
  },

  /**
   * Find date range selectors
   */
  findDateRangeSelectors: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('date range selector', currentPage)
  },

  /**
   * Find display mode toggles
   */
  findDisplayModeToggles: (currentPage?: string): UIElement[] => {
    return uiElementFinder.findElements('display mode', currentPage)
  }
}