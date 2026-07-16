'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { initializeComponentInteractionListeners } from '@/lib/ag-ui/component-registry'

// ========================================
// UNIFIED TYPE DEFINITIONS
// ========================================

/**
 * Generate unique message ID to prevent collisions
 * Uses timestamp + random component for uniqueness
 */
const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Display Mode Types
export type DisplayMode = 'dollar' | 'r'

// Date Range Types
export type DateRangeOption = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'mtd' | '7d' | '30d' | '90day' | '12months' | 'lastMonth' | 'lastYear' | 'last_quarter' | 'all' | 'custom'
export type LegacyDateRange = '7d' | '30d' | '90d'

export interface DateRange {
  start: Date
  end: Date
  label: string
}

export interface QuickSelectOption {
  label: string
  value: DateRangeOption
  description?: string
}

// P&L Mode Types
export type PnLMode = 'gross' | 'net'

// Chat Types
export interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'error'
  content: string
  timestamp: Date
  mode?: 'renata' | 'analyst' | 'coach' | 'mentor'
  metadata?: {
    stage?: 'planning' | 'execution' | 'completion'
    plan?: any
    result?: any
    timestamp?: number
  }
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

export type ActivityStatus = 'idle' | 'thinking' | 'processing' | 'responding'
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting'

// ========================================
// UNIFIED CONTEXT INTERFACE
// ========================================

export interface TraderraContextType {
  // Display Mode Management
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
  toggleDisplayMode: () => void
  getDisplayModeLabel: (mode?: DisplayMode) => string

  // P&L Mode Management
  pnlMode: PnLMode
  setPnLMode: (mode: PnLMode) => void
  isGrossPnL: boolean
  isNetPnL: boolean

  // Date Range Management
  selectedRange: DateRangeOption | LegacyDateRange
  customStartDate: Date | null
  customEndDate: Date | null
  currentDateRange: DateRange
  setDateRange: (range: DateRangeOption | LegacyDateRange) => void
  setCustomRange: (start: Date, end: Date) => void
  getDateRangeLabel: () => string
  getFilteredData: <T extends { date?: Date | string; timestamp?: Date | string; createdAt?: Date | string }>(data: T[]) => T[]
  isDateInRange: (date: Date) => boolean
  getQuickSelectOptions: () => QuickSelectOption[]
  currentWeekStart: Date
  setCurrentWeekStart: (date: Date) => void
  getCalendarLabel: () => string

  // Chat Management
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void
  conversations: Conversation[]
  currentConversation: Conversation | null
  chatLoaded: boolean // Track when localStorage loading is complete
  activityStatus: ActivityStatus
  connectionStatus: ConnectionStatus
  createNewConversation: (title?: string) => void
  switchToConversation: (id: string) => void
  deleteConversation: (id: string) => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setActivityStatus: (status: ActivityStatus) => void
  setConnectionStatus: (status: ConnectionStatus) => void

  // Development User (for testing bypass)
  devUser: {
    id: string
    email: string
    firstName: string
    lastName: string
    username: string
  } | null

  // Global State Helpers
  resetAllStates: () => void
  exportUserPreferences: () => string
  importUserPreferences: (preferences: string) => void
}

interface TraderraProviderProps {
  children: ReactNode
}

// ========================================
// STORAGE CONSTANTS
// ========================================

const STORAGE_KEYS = {
  DISPLAY_MODE: 'traderra_display_mode',
  PNL_MODE: 'traderra-pnl-mode',
  DATE_RANGE: 'traderra_date_range',
  CUSTOM_DATE_RANGE: 'traderra_custom_date_range',
  CHAT_PREFERENCES: 'traderra_chat_preferences',
  CONVERSATIONS: 'traderra_conversations',
  CURRENT_CONVERSATION_ID: 'traderra_current_conversation_id'
} as const

// ========================================
// UNIFIED CONTEXT IMPLEMENTATION
// ========================================

const TraderraContext = createContext<TraderraContextType | undefined>(undefined)

export function useTraderraContext() {
  const context = useContext(TraderraContext)
  if (!context) {
    throw new Error('useTraderraContext must be used within a TraderraProvider')
  }
  return context
}

// ========================================
// DATE RANGE UTILITIES
// ========================================

const dateRangeCache = new Map<string, DateRange>()

function cacheAndReturn(cacheKey: string, dateRange: DateRange): DateRange {
  dateRangeCache.set(cacheKey, { ...dateRange })
  return dateRange
}

function getDateRange(range: DateRangeOption | LegacyDateRange, customStart?: Date | null, customEnd?: Date | null): DateRange {
  const now = new Date()
  const cacheKey = `${range}-${customStart?.toISOString()}-${customEnd?.toISOString()}`
  console.log('[GET DATE RANGE] Called with:', {
    range,
    rangeType: typeof range,
    customStart,
    customEnd,
    cacheKey,
    cacheSize: dateRangeCache.size,
    now: now.toISOString()
  })

  if (dateRangeCache.has(cacheKey)) {
    const cached = dateRangeCache.get(cacheKey)!
    console.log('[GET DATE RANGE] Returning CACHED value:', cached)
    return { ...cached }
  }

  console.log('[GET DATE RANGE] Cache miss - computing fresh value for range:', range)

  let start: Date
  let end: Date
  let label: string

  console.log('[GET DATE RANGE] About to switch on range:', range, 'Type:', typeof range)

  switch (range) {
    case 'yesterday':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      label = 'Yesterday'
      break

    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      label = 'Today'
      break

    case '7d':
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      end = now
      label = 'Last 7 Days'
      break

    case '30d':
    case 'month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      end = now
      label = 'Last 30 Days'
      break

    case '90day':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      end = now
      label = 'Last 90 Days'
      break

    case 'quarter':
      // Current quarter (year to date if we're in Q1, otherwise from quarter start)
      const currentMonth = now.getMonth()
      const quarterStart = Math.floor(currentMonth / 3) * 3
      start = new Date(now.getFullYear(), quarterStart, 1)
      end = now
      label = 'This Quarter'
      break

    case 'last_quarter':
      // Last quarter (previous 3 months)
      const lastQuarterMonth = Math.floor(now.getMonth() / 3) * 3 - 3
      const lastQuarterYear = lastQuarterMonth < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const lastQuarterStartMonth = lastQuarterMonth < 0 ? lastQuarterMonth + 12 : lastQuarterMonth
      start = new Date(lastQuarterYear, lastQuarterStartMonth, 1)
      const quarterEndMonth = (lastQuarterStartMonth + 3) % 12
      const quarterEndYear = lastQuarterStartMonth + 3 >= 12 ? lastQuarterYear + 1 : lastQuarterYear
      end = new Date(quarterEndYear, quarterEndMonth, 0)
      label = 'Last Quarter'
      break

    case 'year':
      console.log('[YEAR CASE] Calculating Year to Date:', {
        now: now,
        year: now.getFullYear(),
        calculatedStart: new Date(now.getFullYear(), 0, 1),
        range: range
      })
      start = new Date(now.getFullYear(), 0, 1)
      end = now
      label = 'Year to Date'
      break

    case 'mtd':
      // Month to Date - from start of current month to today
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = now
      label = 'Month to Date'
      break

    case '12months':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      end = now
      label = 'Last 12 Months'
      break

    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end = new Date(now.getFullYear(), now.getMonth(), 0)
      label = 'Last Month'
      break

    case 'lastYear':
      start = new Date(now.getFullYear() - 1, 0, 1)
      end = new Date(now.getFullYear() - 1, 11, 31)
      label = 'Last Year'
      break

    case 'all':
      start = new Date(2020, 0, 1) // Reasonable start date
      end = now
      label = 'All Time'
      break

    case 'custom':
      if (!customStart || !customEnd) {
        // Fallback to last 30 days
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        end = now
        label = 'Last 30 Days'
      } else {
        start = customStart
        end = customEnd
        label = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
      }
      break

    default:
      console.log('[GET DATE RANGE] DEFAULT CASE HIT - range:', range, 'not matched in switch!')
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      end = now
      label = 'Last 30 Days'
  }

  const result = { start, end, label }
  console.log('[GET DATE RANGE] Computed and returning:', {
    start: start.toISOString(),
    end: end.toISOString(),
    startDate: start.toLocaleDateString(),
    endDate: end.toLocaleDateString(),
    label,
    range
  })
  return cacheAndReturn(cacheKey, result)
}

function parseDate(dateInput: Date | string): Date {
  if (dateInput instanceof Date) {
    return dateInput
  }
  const parsed = new Date(dateInput)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

// ========================================
// DEVELOPMENT SESSION HANDLING
// ========================================

// Check for development session
const checkDevSession = () => {
  if (typeof window === 'undefined') return null

  try {
    const devSession = localStorage.getItem('clerk-dev-session')
    const activeUser = localStorage.getItem('clerk-active-user')

    if (devSession && activeUser) {
      const session = JSON.parse(devSession)
      console.log('🔐 Development session detected:', session.user.primaryEmailAddress.emailAddress)
      return session.user
    }
  } catch (error) {
    console.warn('Failed to check development session:', error)
  }

  return null
}

// Global development user (only for testing)
const globalDevUser = checkDevSession()

// ========================================
// MAIN PROVIDER COMPONENT
// ========================================

export function TraderraProvider({ children }: TraderraProviderProps) {
  // ========================================
  // DISPLAY MODE STATE
  // ========================================
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('dollar')

  // ========================================
  // P&L MODE STATE
  // ========================================
  const [pnlMode, setPnLModeState] = useState<PnLMode>('gross')

  // ========================================
  // DATE RANGE STATE
  // ========================================
  const [selectedRange, setSelectedRange] = useState<DateRangeOption | LegacyDateRange>('90day')
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
  const [currentWeekStart, setCurrentWeekStartState] = useState<Date>(
    new Date(new Date().setDate(new Date().getDate() - new Date().getDay()))
  )

  // ========================================
  // CHAT STATE
  // ========================================
  // Sidebar permanently removed (2026-07-15). Force false — no 480px gutter.
  const [isSidebarOpen, setIsSidebarOpenState] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [chatLoaded, setChatLoaded] = useState(false) // Track when localStorage loading completes
  const [activityStatus, setActivityStatusState] = useState<ActivityStatus>('idle')
  const [connectionStatus, setConnectionStatusState] = useState<ConnectionStatus>('connected')

  // ========================================
  // COMPUTED VALUES
  // ========================================
  const currentDateRange = useMemo(() =>
    getDateRange(selectedRange, customStartDate, customEndDate),
    [selectedRange, customStartDate, customEndDate]
  )

  const currentConversation = useMemo(() =>
    conversations.find(conv => conv.id === currentConversationId) || null,
    [conversations, currentConversationId]
  )

  const isGrossPnL = useMemo(() => pnlMode === 'gross', [pnlMode])
  const isNetPnL = useMemo(() => pnlMode === 'net', [pnlMode])

  // ========================================
  // DISPLAY MODE ACTIONS
  // ========================================
  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setDisplayModeState(mode)
    try {
      localStorage.setItem(STORAGE_KEYS.DISPLAY_MODE, mode)
    } catch (error) {
      console.warn('Failed to save display mode to localStorage:', error)
    }
  }, [])

  const toggleDisplayMode = useCallback(() => {
    setDisplayMode(displayMode === 'dollar' ? 'r' : 'dollar')
  }, [displayMode])

  const getDisplayModeLabel = useCallback((mode?: DisplayMode): string => {
    const currentMode = mode || displayMode
    return currentMode === 'dollar' ? '$' : 'R'
  }, [displayMode])

  // ========================================
  // P&L MODE ACTIONS
  // ========================================
  const setPnLMode = useCallback((mode: PnLMode) => {
    setPnLModeState(mode)
    try {
      localStorage.setItem(STORAGE_KEYS.PNL_MODE, mode)
    } catch (error) {
      console.warn('Failed to save P&L mode to localStorage:', error)
    }
  }, [])

  // ========================================
  // DATE RANGE ACTIONS
  // ========================================
  const setDateRange = useCallback((range: DateRangeOption | LegacyDateRange) => {
    console.log('[SET DATE RANGE] Setting range to:', range)
    // Clear cache when changing date range to ensure fresh calculations
    dateRangeCache.clear()
    setSelectedRange(range)
    try {
      localStorage.setItem(STORAGE_KEYS.DATE_RANGE, range)
    } catch (error) {
      console.warn('Failed to save date range to localStorage:', error)
    }
  }, [])

  const setCustomRange = useCallback((start: Date, end: Date) => {
    setCustomStartDate(start)
    setCustomEndDate(end)
    setSelectedRange('custom')
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_DATE_RANGE, JSON.stringify({
        start: start.toISOString(),
        end: end.toISOString()
      }))
    } catch (error) {
      console.warn('Failed to save custom date range to localStorage:', error)
    }
  }, [])

  const setCurrentWeekStart = useCallback((date: Date) => {
    setCurrentWeekStartState(date)
  }, [])

  const getDateRangeLabel = useCallback((): string => {
    return currentDateRange.label
  }, [currentDateRange])

  const getCalendarLabel = useCallback((): string => {
    return currentDateRange.label
  }, [currentDateRange])

  const isDateInRange = useCallback((date: Date): boolean => {
    const checkDate = parseDate(date)
    return checkDate >= currentDateRange.start && checkDate <= currentDateRange.end
  }, [currentDateRange])

  const getFilteredData = useCallback(<T extends { date?: Date | string; timestamp?: Date | string; createdAt?: Date | string }>(data: T[]): T[] => {
    if (!data || data.length === 0) return []

    return data.filter(item => {
      let itemDate: Date | undefined

      if (item.date) {
        itemDate = parseDate(item.date)
      } else if (item.timestamp) {
        itemDate = parseDate(item.timestamp)
      } else if (item.createdAt) {
        itemDate = parseDate(item.createdAt)
      }

      return itemDate ? isDateInRange(itemDate) : true
    })
  }, [isDateInRange])

  const getQuickSelectOptions = useCallback((): QuickSelectOption[] => {
    return [
      { label: 'Today', value: 'today', description: "Today's trades only" },
      { label: 'Last 7 Days', value: 'week', description: 'Past week' },
      { label: 'Last 30 Days', value: 'month', description: 'Past month' },
      { label: 'Last Quarter', value: 'quarter', description: 'Past 3 months' },
      { label: 'Last 90 Days', value: '90day', description: 'Past 3 months' },
      { label: 'Month to Date', value: 'mtd', description: 'From 1st of month to today' },
      { label: 'Year to Date', value: 'year', description: 'From Jan 1 to today' },
      { label: 'Last 12 Months', value: '12months', description: 'Past year' },
      { label: 'Last Month', value: 'lastMonth', description: 'Previous calendar month' },
      { label: 'Last Year', value: 'lastYear', description: 'Previous calendar year' },
      { label: 'All Time', value: 'all', description: 'All historical data' },
      { label: 'Custom Range', value: 'custom', description: 'Choose specific dates' }
    ]
  }, [])

  // ========================================
  // CHAT ACTIONS
  // ========================================
  const setIsSidebarOpen = useCallback((open: boolean) => {
    setIsSidebarOpenState(open)
  }, [])

  const createNewConversation = useCallback((title?: string) => {
    const newConversation: Conversation = {
      id: generateMessageId(),
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    setConversations(prev => [newConversation, ...prev])
    setCurrentConversationId(newConversation.id)
    setIsSidebarOpen(true)
  }, [])

  const switchToConversation = useCallback((id: string) => {
    const conversation = conversations.find(conv => conv.id === id)
    if (conversation) {
      setCurrentConversationId(id)
    }
  }, [conversations])

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== id))
    if (currentConversationId === id) {
      setCurrentConversationId(null)
    }
  }, [currentConversationId])

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const fullMessage: ChatMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: new Date()
    }

    if (currentConversationId) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === currentConversationId) {
          return {
            ...conv,
            messages: [...conv.messages, fullMessage],
            updatedAt: new Date()
          }
        }
        return conv
      }))
    } else {
      // Create new conversation if none exists
      const newConversation: Conversation = {
        id: generateMessageId(),
        title: message.content.slice(0, 50) + '...',
        messages: [fullMessage],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      setConversations(prev => [newConversation, ...prev])
      setCurrentConversationId(newConversation.id)
    }
  }, [currentConversationId])

  const setActivityStatus = useCallback((status: ActivityStatus) => {
    setActivityStatusState(status)
  }, [])

  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatusState(status)
  }, [])

  // ========================================
  // GLOBAL STATE HELPERS
  // ========================================
  const resetAllStates = useCallback(() => {
    setDisplayMode('dollar')
    setPnLMode('gross')
    setDateRange('90day')
    setCustomStartDate(null)
    setCustomEndDate(null)
    setIsSidebarOpen(false)
    setConversations([])
    setCurrentConversationId(null)
    setActivityStatus('idle')
    setConnectionStatus('connected')

    // Clear localStorage
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  }, [])

  const exportUserPreferences = useCallback((): string => {
    const preferences = {
      displayMode,
      pnlMode,
      selectedRange,
      customStartDate: customStartDate?.toISOString(),
      customEndDate: customEndDate?.toISOString(),
      chatPreferences: {
        isSidebarOpen
      }
    }
    return JSON.stringify(preferences, null, 2)
  }, [displayMode, pnlMode, selectedRange, customStartDate, customEndDate, isSidebarOpen])

  const importUserPreferences = useCallback((preferences: string) => {
    try {
      const parsed = JSON.parse(preferences)
      if (parsed.displayMode) setDisplayMode(parsed.displayMode)
      if (parsed.pnlMode) setPnLMode(parsed.pnlMode)
      if (parsed.selectedRange) setDateRange(parsed.selectedRange)
      if (parsed.customStartDate && parsed.customEndDate) {
        setCustomRange(new Date(parsed.customStartDate), new Date(parsed.customEndDate))
      }
      if (parsed.chatPreferences?.isSidebarOpen !== undefined) {
        setIsSidebarOpen(parsed.chatPreferences.isSidebarOpen)
      }
    } catch (error) {
      console.error('Failed to import user preferences:', error)
    }
  }, [setDisplayMode, setPnLMode, setDateRange, setCustomRange, setIsSidebarOpen])

  // ========================================
  // INITIALIZATION EFFECTS
  // ========================================
  useEffect(() => {
    // Initialize AG-UI component interaction listeners
    initializeComponentInteractionListeners()
  }, [])

  useEffect(() => {
    // Load display mode from localStorage
    try {
      const savedDisplayMode = localStorage.getItem(STORAGE_KEYS.DISPLAY_MODE) as DisplayMode
      if (savedDisplayMode === 'dollar' || savedDisplayMode === 'r') {
        setDisplayModeState(savedDisplayMode)
      }
    } catch (error) {
      console.warn('Failed to load display mode from localStorage:', error)
    }

    // Load P&L mode from localStorage
    try {
      const savedPnLMode = localStorage.getItem(STORAGE_KEYS.PNL_MODE) as PnLMode
      if (savedPnLMode === 'gross' || savedPnLMode === 'net') {
        setPnLModeState(savedPnLMode)
      }
    } catch (error) {
      console.warn('Failed to load P&L mode from localStorage:', error)
    }

    // Load date range from localStorage
    try {
      const savedDateRange = localStorage.getItem(STORAGE_KEYS.DATE_RANGE) as DateRangeOption | LegacyDateRange
      const savedCustomRange = localStorage.getItem(STORAGE_KEYS.CUSTOM_DATE_RANGE)

      // If there's a custom date range, load that first and set range to 'custom'
      if (savedCustomRange) {
        const parsed = JSON.parse(savedCustomRange)
        setCustomStartDate(new Date(parsed.start))
        setCustomEndDate(new Date(parsed.end))
        setSelectedRange('custom') // Important: Set to 'custom' when there's a custom range
      } else if (savedDateRange) {
        // Only set the saved date range if there's no custom range
        setSelectedRange(savedDateRange)
      }
    } catch (error) {
      console.warn('Failed to load date range from localStorage:', error)
    }

    // Load conversations from localStorage
    try {
      const savedConversations = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS)
      if (savedConversations) {
        const parsed = JSON.parse(savedConversations)
        const conversationsWithDates = parsed.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
        setConversations(conversationsWithDates)
      }
    } catch (error) {
      console.warn('Failed to load conversations from localStorage:', error)
    }

    // Load current conversation ID from localStorage
    try {
      const savedConversationId = localStorage.getItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID)
      if (savedConversationId) {
        setCurrentConversationId(savedConversationId)
        console.log('📂 Restored current conversation ID:', savedConversationId)
      }
    } catch (error) {
      console.warn('Failed to load current conversation ID from localStorage:', error)
    }

    // Load chat preferences from localStorage
    try {
      const savedChatPreferences = localStorage.getItem(STORAGE_KEYS.CHAT_PREFERENCES)
      if (savedChatPreferences) {
        const parsed = JSON.parse(savedChatPreferences)
        if (parsed.isSidebarOpen !== undefined) {
          setIsSidebarOpenState(parsed.isSidebarOpen)
        }
      }
    } catch (error) {
      console.warn('Failed to load chat preferences from localStorage:', error)
    }

    // Mark chat as loaded after all localStorage operations complete
    setChatLoaded(true)
    console.log('✅ Chat state loaded from localStorage, chatLoaded = true')

  }, [])

  // ========================================
  // AUTO-SAVE EFFECTS
  // ========================================
  useEffect(() => {
    // Save sidebar state to localStorage
    try {
      const preferences = {
        isSidebarOpen
      }
      localStorage.setItem(STORAGE_KEYS.CHAT_PREFERENCES, JSON.stringify(preferences))
    } catch (error) {
      console.warn('Failed to save sidebar state to localStorage:', error)
    }
  }, [isSidebarOpen])

  // ========================================
  // AG UI EVENT LISTENERS
  // ========================================
  useEffect(() => {
    // Listen for display mode changes from AG UI
    const handleDisplayModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode: DisplayMode }>
      console.log('[AG-UI] Display mode change event:', customEvent.detail)
      setDisplayModeState(customEvent.detail.mode)
    }

    // Listen for date range changes from AG UI
    const handleDateRangeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{
        range: DateRangeOption | LegacyDateRange
        startDate?: string
        endDate?: string
      }>
      console.log('[AG-UI] Date range change event:', customEvent.detail)

      const { range, startDate, endDate } = customEvent.detail

      if (range === 'custom' && startDate && endDate) {
        // Parse dates and set custom range
        const start = new Date(startDate)
        const end = new Date(endDate)
        setCustomStartDate(start)
        setCustomEndDate(end)
        setSelectedRange('custom')

        // Also save to proper storage location
        try {
          localStorage.setItem(STORAGE_KEYS.CUSTOM_DATE_RANGE, JSON.stringify({
            start: start.toISOString(),
            end: end.toISOString()
          }))
        } catch (error) {
          console.warn('Failed to save custom date range:', error)
        }
      } else {
        // Set preset range
        setSelectedRange(range)
        try {
          localStorage.setItem(STORAGE_KEYS.DATE_RANGE, range)
        } catch (error) {
          console.warn('Failed to save date range:', error)
        }
      }
    }

    // Listen for view mode changes from AG UI
    const handleViewModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode: 'table' | 'chart' }>
      console.log('[AG-UI] View mode change event:', customEvent.detail)
      // View mode is handled by components directly via localStorage
    }

    // Listen for sort field changes from AG UI
    const handleSortFieldChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ field: string }>
      console.log('[AG-UI] Sort field change event:', customEvent.detail)
      // Sort is handled by components directly via localStorage
    }

    // Listen for sort direction changes from AG UI
    const handleSortDirectionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ direction: string }>
      console.log('[AG-UI] Sort direction change event:', customEvent.detail)
      // Sort is handled by components directly via localStorage
    }

    // Listen for AI sidebar toggle from AG UI
    const handleToggleAISidebar = (event: Event) => {
      const customEvent = event as CustomEvent<{ open: boolean }>
      console.log('[AG-UI] Toggle AI sidebar event:', customEvent.detail)
      setIsSidebarOpenState(customEvent.detail.open)
    }

    // Register event listeners
    window.addEventListener('displayModeChange', handleDisplayModeChange)
    window.addEventListener('dateRangeChange', handleDateRangeChange)
    window.addEventListener('viewModeChange', handleViewModeChange)
    window.addEventListener('sortFieldChange', handleSortFieldChange)
    window.addEventListener('sortDirectionChange', handleSortDirectionChange)
    window.addEventListener('toggleAISidebar', handleToggleAISidebar)

    // Cleanup
    return () => {
      window.removeEventListener('displayModeChange', handleDisplayModeChange)
      window.removeEventListener('dateRangeChange', handleDateRangeChange)
      window.removeEventListener('viewModeChange', handleViewModeChange)
      window.removeEventListener('sortFieldChange', handleSortFieldChange)
      window.removeEventListener('sortDirectionChange', handleSortDirectionChange)
      window.removeEventListener('toggleAISidebar', handleToggleAISidebar)
    }
  }, [])

  useEffect(() => {
    // Save conversations to localStorage
    try {
      if (conversations.length > 0) {
        localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations))
      }
    } catch (error) {
      console.warn('Failed to save conversations to localStorage:', error)
    }
  }, [conversations])

  useEffect(() => {
    // Save current conversation ID to localStorage
    try {
      if (currentConversationId) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID, currentConversationId)
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_CONVERSATION_ID)
      }
    } catch (error) {
      console.warn('Failed to save current conversation ID to localStorage:', error)
    }
  }, [currentConversationId])

  // ========================================
  // CONTEXT VALUE
  // ========================================
  const value: TraderraContextType = {
    // Display Mode
    displayMode,
    setDisplayMode,
    toggleDisplayMode,
    getDisplayModeLabel,

    // P&L Mode
    pnlMode,
    setPnLMode,
    isGrossPnL,
    isNetPnL,

    // Date Range
    selectedRange,
    customStartDate,
    customEndDate,
    currentDateRange,
    setDateRange,
    setCustomRange,
    getDateRangeLabel,
    getFilteredData,
    isDateInRange,
    getQuickSelectOptions,
    currentWeekStart,
    setCurrentWeekStart,
    getCalendarLabel,

    // Chat
    isSidebarOpen,
    setIsSidebarOpen,
    conversations,
    currentConversation,
    chatLoaded,
    activityStatus,
    connectionStatus,
    createNewConversation,
    switchToConversation,
    deleteConversation,
    addMessage,
    setActivityStatus,
    setConnectionStatus,

    // Development User (for testing bypass)
    devUser: globalDevUser,

    // Global Helpers
    resetAllStates,
    exportUserPreferences,
    importUserPreferences
  }

  return (
    <TraderraContext.Provider value={value}>
      {children}
    </TraderraContext.Provider>
  )
}

// ========================================
// CONVENIENCE HOOKS
// ========================================

export function useDisplayMode() {
  const { displayMode, setDisplayMode, toggleDisplayMode, getDisplayModeLabel } = useTraderraContext()
  return { displayMode, setDisplayMode, toggleDisplayMode, getDisplayModeLabel }
}

export function usePnLMode() {
  const { pnlMode, setPnLMode, isGrossPnL, isNetPnL } = useTraderraContext()
  return { pnlMode, mode: pnlMode, setPnLMode, isGrossPnL, isNetPnL }
}

// Legacy compatibility exports for renamed providers
export const DisplayModeProvider = TraderraProvider
export const PnLModeProvider = TraderraProvider
export const DateRangeProvider = TraderraProvider

export function useDateRange() {
  const {
    selectedRange,
    customStartDate,
    customEndDate,
    currentDateRange,
    setDateRange,
    setCustomRange,
    getDateRangeLabel,
    getFilteredData,
    isDateInRange,
    getQuickSelectOptions,
    currentWeekStart,
    setCurrentWeekStart,
    getCalendarLabel
  } = useTraderraContext()

  return {
    dateRange: selectedRange, // Legacy compatibility
    selectedRange,
    customStartDate,
    customEndDate,
    currentDateRange,
    setDateRange,
    setCustomRange,
    getDateRangeLabel,
    getFilteredData,
    isDateInRange,
    getQuickSelectOptions,
    currentWeekStart,
    setCurrentWeekStart,
    getCalendarLabel
  }
}

export function useChatContext() {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    conversations,
    currentConversation,
    chatLoaded,
    activityStatus,
    connectionStatus,
    createNewConversation,
    switchToConversation,
    deleteConversation,
    addMessage,
    setActivityStatus,
    setConnectionStatus
  } = useTraderraContext()

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    conversations,
    currentConversation,
    chatLoaded,
    activityStatus,
    connectionStatus,
    createNewConversation,
    switchToConversation,
    deleteConversation,
    addMessage,
    setActivityStatus,
    setConnectionStatus
  }
}