'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Brain, Send, Sparkles, RotateCcw, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDateRange, useDisplayMode, useChatContext } from '@/contexts/TraderraContext'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useGlobalTraderra } from '@/components/global/GlobalTraderraProvider'
import { useFrontendTools } from '@/hooks/useAGUITools'
import { createAGUIChatHandler } from '@/lib/ag-ui/agui-chat-service'
import { getRegisteredContext } from '@/hooks/useCopilotReadableWithContext'
import { ChatFileUpload } from './chat-file-upload'
import { useUserContext } from '@/components/providers/ClerkCopilotProvider'

const WELCOME_MESSAGE = "Hi! I'm Renata, your AI assistant. I'm here to help with trading insights, strategy discussions, market analysis, or just chat about your trading journey. What's on your mind?"

/**
 * Generate unique message ID to prevent collisions
 * Uses timestamp + random component for uniqueness
 */
const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Renata Chat Component - Refactored for State Consistency
 *
 * Key improvements:
 * - Single source of truth: uses context messages only
 * - Proper unique ID generation to prevent collisions
 * - Simplified initialization without race conditions
 * - Conversation history sent to backend
 */
export function StandaloneRenataChat({ className }: { className?: string }) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentMode, setCurrentMode] = useState<'analyst' | 'coach' | 'mentor' | 'renata'>('renata')
  const [useAGUI, setUseAGUI] = useState(true) // Enable AG-UI by default
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [fileData, setFileData] = useState<{ name: string; content: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Log state changes for debugging
  useEffect(() => {
    console.log('📦 State updated:', {
      hasAttachedFile: !!attachedFile,
      attachedFileName: attachedFile?.name,
      hasFileData: !!fileData,
      fileDataName: fileData?.name,
      fileDataContentSize: fileData?.content?.length
    })
  }, [attachedFile, fileData])
  const { userId } = useUserContext()

  // AG-UI tools
  const { executeTool } = useFrontendTools()
  const aguiHandler = useRef(createAGUIChatHandler(executeTool))

  const { setDateRange, currentDateRange } = useDateRange()
  const { setDisplayMode, displayMode } = useChatContext()
  const {
    addMessage: saveMessageToContext,
    currentConversation,
    conversations,
    createNewConversation,
    switchToConversation,
    chatLoaded
  } = useChatContext()

  const router = useRouter()
  const { executeRenataResponse } = useGlobalTraderra()

  // Collect enhanced context from all useCopilotReadable hooks (using simple registry)
  const getFlattenedContext = getRegisteredContext

  // Get messages from context - single source of truth
  const messages = currentConversation?.messages || []

  // Track initialization to prevent duplicate calls
  const [initialized, setInitialized] = useState(false)

  // Initialize conversation on mount and when conversations load
  useEffect(() => {
    // Wait for chatLoaded to be true before initializing
    // This prevents race condition where component initializes before localStorage loads
    if (!chatLoaded) {
      console.log('⏳ Waiting for chat state to load from localStorage...')
      return
    }

    // Wait for conversations to be loaded from localStorage
    if (initialized) return

    console.log('🔄 Renata Chat initialization check')
    console.log('  - chatLoaded:', chatLoaded)
    console.log('  - conversations.length:', conversations.length)
    console.log('  - currentConversation:', !!currentConversation)
    console.log('  - currentConversationId:', currentConversation?.id)

    // Only initialize if we have no conversations at all
    if (conversations.length === 0) {
      console.log('🆕 Creating initial Renata conversation')
      createNewConversation('Renata Chat')

      // Add welcome message after a short delay to ensure context is ready
      setTimeout(() => {
        saveMessageToContext({
          type: 'assistant',
          content: WELCOME_MESSAGE
        })
      }, 200)

      setInitialized(true)
    } else if (conversations.length > 0 && !currentConversation) {
      // If we have conversations but none selected, select the most recent
      console.log('📂 Selecting most recent conversation')
      switchToConversation(conversations[0].id)
      setInitialized(true)
    } else if (currentConversation) {
      // Already have a conversation selected
      console.log('✅ Already have conversation loaded:', currentConversation.id, 'with', currentConversation.messages.length, 'messages')
      setInitialized(true)
    }
  }, [chatLoaded, conversations, currentConversation, initialized, createNewConversation, switchToConversation, saveMessageToContext])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /**
   * Process Renata API response and execute any state changes
   *
   * IMPORTANT: Navigation must complete BEFORE state changes are applied
   * to ensure the new page receives the correct state.
   */
  const processResponse = async (response: string, fullApiData: any = null): Promise<string> => {
    console.log('🎯 Processing Renata response with full data:', fullApiData)

    // Handle AG-UI tool_calls
    if (fullApiData?.tool_calls && Array.isArray(fullApiData.tool_calls) && fullApiData.tool_calls.length > 0) {
      console.log('🔧 Processing AG-UI tool calls:', fullApiData.tool_calls)

      try {
        // Separate navigation calls from other tool calls
        const navigationCalls = fullApiData.tool_calls.filter((tc: any) => tc.tool === 'navigateToPage')
        const stateChangeCalls = fullApiData.tool_calls.filter((tc: any) => tc.tool !== 'navigateToPage')

        // Execute navigation FIRST
        for (const toolCall of navigationCalls) {
          const { tool, args } = toolCall
          console.log(`[AG-UI] 🧭 Executing navigation FIRST: ${tool}`, args)

          const result = await executeTool(tool, args)
          if (result.success) {
            console.log(`[AG-UI] ✅ ${tool} succeeded:`, result.message)
            toast.success(result.message || 'Navigating...')
          } else {
            console.error(`[AG-UI] ❌ ${tool} failed:`, result.error)
            toast.error(result.error || 'Navigation failed')
          }

          // Wait for navigation to complete before proceeding
          // Next.js router.push() needs time to complete
          await new Promise(resolve => setTimeout(resolve, 500))
        }

        // THEN execute state changes
        for (const toolCall of stateChangeCalls) {
          const { tool, args } = toolCall
          console.log(`[AG-UI] 🎛️ Executing state change: ${tool}`, args)

          const result = await executeTool(tool, args)
          if (result.success) {
            console.log(`[AG-UI] ✅ ${tool} succeeded:`, result.message)
            toast.success(result.message || 'Action completed')
          } else {
            console.error(`[AG-UI] ❌ ${tool} failed:`, result.error)
            toast.error(result.error || 'Action failed')
          }
        }
      } catch (error) {
        console.error('[AG-UI] Error executing tool calls:', error)
        toast.error('Some actions failed: ' + (error as Error).message)
      }
    }

    // Handle legacy ui_action (for backwards compatibility)
    if (fullApiData?.ui_action) {
      try {
        console.log('🚀 Executing commands via global bridge...')
        const result = await executeRenataResponse(fullApiData)
        console.log('✅ Commands executed via global bridge, result:', result)

        // Show success feedback based on action type
        const actions = fullApiData.ui_action
        const actionType = actions.action_type || actions.action

        if (actionType === 'navigation') {
          toast.success('Navigating to requested page...')
        } else if (actionType === 'set_date_range' || actionType === 'set_custom_date_range') {
          toast.success('Date range updated successfully')
        } else if (actionType === 'switch_display_mode') {
          toast.success('Display mode changed successfully')
        } else if (actionType) {
          toast.success('State changes applied successfully')
        }
      } catch (error) {
        console.error('❌ Global bridge execution error:', error)
        toast.error('Some commands failed to execute: ' + (error as Error).message)
      }
    }

    return response
  }

  /**
   * Send message to Renata API
   */
  const sendMessage = async () => {
    // DEBUG: Log current state before anything
    console.log('=== SEND MESSAGE START ===')
    console.log('1. Current state:', {
      inputLength: input.trim().length,
      hasAttachedFile: !!attachedFile,
      attachedFileName: attachedFile?.name,
      hasFileData: !!fileData,
      fileDataName: fileData?.name,
      fileDataContentSize: fileData?.content?.length,
      isLoading
    })

    if ((!input.trim() && !fileData) || isLoading) {
      console.log('❌ BLOCKED - No input and no file data, or already loading')
      return
    }

    console.log('✅ Passed validation check')

    const userContent = input.trim()
    setInput('')
    setIsLoading(true)

    // CRITICAL: Store file data BEFORE clearing state
    const fileToSend = fileData
    console.log('2. Stored fileToSend:', fileToSend ? {
      name: fileToSend.name,
      contentLength: fileToSend.content?.length
    } : null)

    // Clear state after storing
    setAttachedFile(null)
    setFileData(null)

    console.log('3. State cleared, fileToSend still has:', fileToSend ? 'YES' : 'NO')

    if (fileToSend) {
      console.log('✅ FILE READY TO SEND:', {
        name: fileToSend.name,
        contentSize: fileToSend.content.length
      })
    } else {
      console.log('❌ NO FILE - fileToSend is null/undefined')
    }

    // Save user message to context immediately (persists across navigation)
    console.log('💾 Saving user message to context:', userContent)
    saveMessageToContext({
      type: 'user',
      content: userContent,
      attachedFile: fileToSend ? {
        name: fileToSend.name,
        size: fileToSend.content.length
      } : undefined
    })

    // Show loading toast
    const loadingToast = toast.loading('Renata is thinking...', {
      duration: 30000
    })

    try {
      console.log('🔍 Sending message to API:', userContent)
      console.log('🎯 Current mode:', currentMode)
      console.log('🔧 Using AG-UI:', useAGUI)
      console.log('📚 Conversation history:', messages.length, 'messages')
      console.log('📎 File attached?', !!fileToSend, fileToSend ? { name: fileToSend.name, hasContent: !!fileToSend.content } : null)

      let response: Response
      let data: any

      // Use AG-UI endpoint if enabled
      if (useAGUI) {
        console.log('[AG-UI] Using AG-UI chat endpoint')

        // Collect enhanced context from all components
        const enhancedContext = getFlattenedContext()
        console.log('[AG-UI] Enhanced context collected:', Object.keys(enhancedContext).length, 'context items')

        // Merge with basic AG-UI context
        const currentPage = 'dashboard' // TODO: Get from current route
        const mergedContext = {
          currentPage,
          currentDateRange,
          displayMode: displayMode || 'dollar',
          // Add all the enhanced context from useCopilotReadable hooks
          ...enhancedContext
        }

        console.log('[AG-UI] Sending context to API:', {
          basic: { currentPage, currentDateRange, displayMode },
          enhancedKeys: Object.keys(enhancedContext)
        })

        // Debug log for file attachment
        console.log('📤 [AG-UI] Request payload:', {
          messageLength: userContent.length,
          hasAttachedFile: !!fileToSend,
          attachedFileName: fileToSend?.name,
          attachedFileContentSize: fileToSend?.content?.length
        })

        const requestBody = {
          message: userContent,
          context: mergedContext,
          // Also send the enhanced context separately for processing
          copilotContext: enhancedContext,
          // Send conversation history for context
          conversationHistory: messages.map(m => ({
            role: m.type,
            content: m.content
          })),
          // Include file data if attached
          attachedFile: fileToSend ? {
            name: fileToSend.name,
            content: fileToSend.content
          } : undefined,
          // Include user ID for file uploads
          userId: userId || 'anonymous',
          // Request concise responses by default
          concise: true,
          systemInstructions: 'Keep responses brief and concise (1-2 sentences max) unless user explicitly asks for more detail. Focus on actionable insights.'
        }

        console.log('4. Request body constructed:', {
          messageLength: requestBody.message.length,
          hasAttachedFile: !!requestBody.attachedFile,
          attachedFileName: requestBody.attachedFile?.name,
          hasContent: !!requestBody.attachedFile?.content,
          contentLength: requestBody.attachedFile?.content?.length
        })

        console.log('5. About to fetch /api/agui...')

        response = await fetch('/api/agui', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })
      } else {
        // Use legacy Renata endpoint
        console.log('[Legacy] Using Renata chat endpoint')

        // Prepare conversation history for backend
        const conversationHistory = messages.map(msg => ({
          role: msg.type,
          content: msg.content
        }))

        response = await fetch('/api/renata/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userContent,
            mode: currentMode,
            messages: conversationHistory,
            context: {
              currentDateRange,
              displayMode: displayMode || 'dollar',
              page: 'dashboard'
            },
            // Include file data if attached
            attachedFile: fileToSend ? {
              name: fileToSend.name,
              content: fileToSend.content
            } : undefined,
            // Include user ID for file uploads
            userId: userId || 'anonymous',
            // Request concise responses by default
            concise: true,
            systemInstructions: 'Keep responses brief and concise (1-2 sentences max) unless user explicitly asks for more detail. Focus on actionable insights.'
          })
        })
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      data = await response.json()
      console.log('✅ API Response:', data)

      // Process any state changes from the response
      const processedResponse = await processResponse(data.response || data.message || 'Sorry, I encountered an error.', data)

      // Dismiss loading toast
      toast.dismiss(loadingToast)
      toast.success('Command processed successfully!')

      // Save assistant response to context
      console.log('💾 Saving assistant message to context:', processedResponse.substring(0, 50) + '...')
      saveMessageToContext({
        type: 'assistant',
        content: processedResponse
      })

    } catch (error) {
      console.error('Chat API error:', error)

      toast.dismiss(loadingToast)
      toast.error('Failed to process request. Please try again.')

      // Save error message to context
      saveMessageToContext({
        type: 'error',
        content: 'Sorry, I encountered an error while processing your request. Please try again.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  /**
   * Reset chat - create new conversation with welcome message
   */
  const resetChat = () => {
    createNewConversation('Renata Chat')

    // Add welcome message after a short delay to ensure context is ready
    setTimeout(() => {
      saveMessageToContext({
        type: 'assistant',
        content: WELCOME_MESSAGE
      })
    }, 100)

    setInput('')
    toast.success('Chat reset successfully')
  }

  return (
    <div className={cn('flex flex-col h-full bg-studio-surface border border-border rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-medium text-studio-text">Renata AI</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Selector */}
          <select
            value={currentMode}
            onChange={(e) => setCurrentMode(e.target.value as 'analyst' | 'coach' | 'mentor' | 'renata')}
            className="text-xs bg-studio-surface border border-border rounded px-2 py-1 text-studio-text focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="renata">Renata</option>
            <option value="analyst">Analyst</option>
            <option value="coach">Coach</option>
            <option value="mentor">Mentor</option>
          </select>

          {/* AG-UI Toggle */}
          <button
            onClick={() => setUseAGUI(!useAGUI)}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors',
              useAGUI
                ? 'bg-green-900/30 border-green-700 text-green-400'
                : 'bg-studio-surface border-border text-studio-muted'
            )}
            title={useAGUI ? 'AG-UI enabled (new)' : 'AG-UI disabled (legacy mode)'}
          >
            {useAGUI ? '🔧 AG-UI' : 'Legacy'}
          </button>

          <button
            onClick={resetChat}
            className="p-1 rounded-md hover:bg-studio-accent/50 text-studio-muted hover:text-studio-text transition-colors"
            title="Reset chat"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <Sparkles className="w-4 h-4 text-yellow-400" />
        </div>
      </div>

      {/* Messages - directly from context */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          // Skip messages with invalid role
          if (message.type !== 'user' && message.type !== 'assistant' && message.type !== 'error') {
            console.warn('Invalid message type:', message.type, message)
            return null
          }

          const isUser = message.type === 'user'

          return (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] p-3 rounded-lg',
                  isUser
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : message.type === 'error'
                      ? 'bg-red-900/30 text-red-400 border border-red-800'
                      : 'bg-studio-accent/50 text-studio-text border border-border'
                )}
              >
                {/* Show file attachment if present */}
                {message.attachedFile && (
                  <div className="mb-2 px-2 py-1 bg-white/10 rounded-md flex items-center gap-2">
                    <span className="text-xs">📎 {message.attachedFile.name}</span>
                    <span className="text-xs opacity-70">({message.attachedFile.size.toLocaleString()} bytes)</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs text-studio-muted mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
              {isUser && (
                <div className="w-8 h-8 rounded-full bg-studio-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-studio-text">You</span>
                </div>
              )}
            </div>
          )
        })}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="bg-studio-accent/50 text-studio-text border border-border p-3 rounded-lg max-w-[80%]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-studio-text rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-studio-text rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-studio-text rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        {/* Show attached file indicator */}
        {attachedFile && (
          <div className="mb-2 px-3 py-2 bg-green-900/30 border border-green-700/50 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm">📎 {attachedFile.name}</span>
              <span className="text-green-400/70 text-xs">({fileData?.content?.length || 0} bytes encoded)</span>
            </div>
            <button
              onClick={() => {
                setAttachedFile(null)
                setFileData(null)
              }}
              className="text-green-400 hover:text-green-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <ChatFileUpload
            onFileSelect={(file, data) => {
              console.log('📎 onFileSelect called in parent:', {
                file: file ? { name: file.name, size: file.size } : null,
                data: data ? { name: data.name, hasContent: !!data.content } : null
              })
              setAttachedFile(file)
              setFileData(data)
            }}
            disabled={isLoading}
          />
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={attachedFile ? `Include message with ${attachedFile.name}...` : "Chat with Renata..."}
              className="w-full px-3 py-2 bg-studio-surface border border-border rounded-md text-studio-text placeholder-studio-muted focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && !attachedFile) || isLoading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-xs text-studio-muted">
          <p>💡 Ask me about trading strategies, market analysis, or upload a CSV file to import trades</p>
        </div>
      </div>
    </div>
  )
}
