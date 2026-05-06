'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

interface ChatContextType {
  // Current conversation
  currentConversation: Conversation | null
  messages: ChatMessage[]

  // Conversation management
  conversations: Conversation[]
  createNewConversation: (title?: string) => void
  loadConversation: (conversationId: string) => void
  updateConversationTitle: (conversationId: string, title: string) => void
  deleteConversation: (conversationId: string) => void

  // Message management
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  clearAllData: () => void

  // UI state
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Sidebar state
  isSidebarOpen: boolean
  setIsSidebarOpen: (open: boolean) => void

  // Status tracking
  connectionStatus: ConnectionStatus
  setConnectionStatus: (status: ConnectionStatus) => void
  activityStatus: ActivityStatus
  setActivityStatus: (status: ActivityStatus) => void
  lastAction: string
  setLastAction: (action: string) => void

  // Current input
  currentInput: string
  setCurrentInput: (input: string) => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Sidebar and status state with localStorage persistence
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traderra-sidebar-open')
      return saved ? JSON.parse(saved) : true
    }
    return true
  })

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traderra-connection-status')
      return saved ? JSON.parse(saved) : 'connected'
    }
    return 'connected'
  })

  const [activityStatus, setActivityStatus] = useState<ActivityStatus>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traderra-activity-status')
      return saved ? JSON.parse(saved) : 'idle'
    }
    return 'idle'
  })

  const [lastAction, setLastAction] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('traderra-last-action')
      return saved || 'Ready'
    }
    return 'Ready'
  })

  const [currentInput, setCurrentInput] = useState('')

  // Load conversations from sessionStorage on mount (tab-based memory)
  useEffect(() => {
    const savedConversations = sessionStorage.getItem('traderra-conversations')
    const savedCurrentId = sessionStorage.getItem('traderra-current-conversation')

    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations).map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
        setConversations(parsed)

        // Restore current conversation
        if (savedCurrentId) {
          const current = parsed.find((conv: Conversation) => conv.id === savedCurrentId)
          if (current) {
            setCurrentConversation(current)
          }
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
      }
    }
    // If no saved data, we start with a fresh state (no conversations)
  }, [])

  // Save conversations to sessionStorage whenever they change (tab-based memory)
  useEffect(() => {
    if (conversations.length > 0) {
      sessionStorage.setItem('traderra-conversations', JSON.stringify(conversations))
    } else {
      // Clear session when no conversations
      sessionStorage.removeItem('traderra-conversations')
    }
  }, [conversations])

  // Save current conversation ID to sessionStorage
  useEffect(() => {
    if (currentConversation) {
      sessionStorage.setItem('traderra-current-conversation', currentConversation.id)
    } else {
      sessionStorage.removeItem('traderra-current-conversation')
    }
  }, [currentConversation])

  // Persist sidebar and status state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('traderra-sidebar-open', JSON.stringify(isSidebarOpen))
    }
  }, [isSidebarOpen])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('traderra-connection-status', JSON.stringify(connectionStatus))
    }
  }, [connectionStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('traderra-activity-status', JSON.stringify(activityStatus))
    }
  }, [activityStatus])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('traderra-last-action', lastAction)
    }
  }, [lastAction])

  const generateTitle = (firstMessage: string): string => {
    const cleaned = firstMessage.toLowerCase().trim()

    // Generate smart titles based on content
    if (cleaned.includes('stats') || cleaned.includes('statistics')) {
      return '📊 Statistics Analysis'
    } else if (cleaned.includes('journal') || cleaned.includes('trades')) {
      return '📝 Trading Journal'
    } else if (cleaned.includes('performance') || cleaned.includes('analysis')) {
      return '📈 Performance Review'
    } else if (cleaned.includes('help') || cleaned.includes('how')) {
      return '❓ Trading Help'
    } else if (cleaned.length > 30) {
      return firstMessage.substring(0, 30) + '...'
    } else {
      return firstMessage || 'New Chat'
    }
  }

  const createNewConversation = (title?: string) => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    setConversations(prev => [newConversation, ...prev])
    setCurrentConversation(newConversation)
  }

  const loadConversation = (conversationId: string) => {
    const conversation = conversations.find(conv => conv.id === conversationId)
    if (conversation) {
      setCurrentConversation(conversation)
    }
  }

  const updateConversationTitle = (conversationId: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, title: newTitle, updatedAt: new Date() }
          : conv
      )
    )

    if (currentConversation?.id === conversationId) {
      setCurrentConversation(prev => prev ? { ...prev, title: newTitle } : null)
    }
  }

  const deleteConversation = (conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId))

    if (currentConversation?.id === conversationId) {
      const remaining = conversations.filter(conv => conv.id !== conversationId)
      setCurrentConversation(remaining.length > 0 ? remaining[0] : null)
    }
  }

  const addMessage = (messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    console.log('🔥 ChatContext: addMessage called with:', messageData)
    const newMessage: ChatMessage = {
      ...messageData,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    console.log('🔥 ChatContext: Created new message:', newMessage)

    // Use functional updates to ensure we work with the latest state
    setCurrentConversation(current => {
      setConversations(prevConversations => {
        // Create new conversation if none exists
        if (!current) {
          console.log('🔥 ChatContext: No current conversation, creating new one')
          const title = messageData.type === 'user' ? generateTitle(messageData.content) : 'New Chat'
          const newConversation: Conversation = {
            id: Date.now().toString(),
            title,
            messages: [newMessage],
            createdAt: new Date(),
            updatedAt: new Date()
          }
          console.log('🔥 ChatContext: Created new conversation:', newConversation)

          return [newConversation, ...prevConversations]
        } else {
          // Update existing conversation
          console.log('🔥 ChatContext: Updating existing conversation:', current.id)
          const updatedConversation = {
            ...current,
            messages: [...current.messages, newMessage],
            updatedAt: new Date()
          }

          // Auto-generate title from first user message if still "New Chat"
          if (updatedConversation.title === 'New Chat' && messageData.type === 'user') {
            updatedConversation.title = generateTitle(messageData.content)
          }

          console.log('🔥 ChatContext: Updated conversation:', updatedConversation)

          return prevConversations.map(conv =>
            conv.id === current.id ? updatedConversation : conv
          )
        }
      })

      // Return the updated conversation for setCurrentConversation
      if (!current) {
        const title = messageData.type === 'user' ? generateTitle(messageData.content) : 'New Chat'
        return {
          id: Date.now().toString(),
          title,
          messages: [newMessage],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } else {
        const updatedConversation = {
          ...current,
          messages: [...current.messages, newMessage],
          updatedAt: new Date()
        }

        if (updatedConversation.title === 'New Chat' && messageData.type === 'user') {
          updatedConversation.title = generateTitle(messageData.content)
        }

        return updatedConversation
      }
    })
  }

  const clearMessages = () => {
    if (currentConversation) {
      const clearedConversation = {
        ...currentConversation,
        messages: [],
        updatedAt: new Date()
      }

      setConversations(prev =>
        prev.map(conv =>
          conv.id === currentConversation.id ? clearedConversation : conv
        )
      )
      setCurrentConversation(clearedConversation)
    }
  }

  const clearAllData = () => {
    // Clear all in-memory state
    setConversations([])
    setCurrentConversation(null)
    setIsLoading(false)

    // Clear all sessionStorage data
    sessionStorage.removeItem('traderra-conversations')
    sessionStorage.removeItem('traderra-current-conversation')

    console.log('✅ All chat data cleared from memory and storage')
  }

  const value = {
    currentConversation,
    messages: currentConversation?.messages || [],
    conversations,
    createNewConversation,
    loadConversation,
    updateConversationTitle,
    deleteConversation,
    addMessage,
    clearMessages,
    clearAllData,
    isLoading,
    setIsLoading,
    isSidebarOpen,
    setIsSidebarOpen,
    connectionStatus,
    setConnectionStatus,
    activityStatus,
    setActivityStatus,
    lastAction,
    setLastAction,
    currentInput,
    setCurrentInput
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  )
}