'use client'

/**
 * Enhanced Renata Chat with Multi-Agent System
 *
 * This component integrates with the new multi-agent architecture,
 * providing access to Renata and all specialized agents.
 *
 * Features:
 * - Agent selection dropdown
 * - System status indicator
 * - Message history with agent attribution
 * - Loading states and error handling
 * - Real-time agent status display
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Brain, Send, Sparkles, RotateCcw, Activity, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/contexts/TraderraContext'
import toast from 'react-hot-toast'
import { sendAgentMessage, getAgentSystemStatus } from '@/services/agentService'
import { useAgentSystemReady } from '@/hooks/useMultiAgent'

const WELCOME_MESSAGE = "Hi! I'm Renata, your AI trading assistant. I'm here to help with trading insights, strategy discussions, performance analysis, risk management, or just chat about your trading journey. What's on your mind?"

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agent?: string
  agentsInvolved?: string[]
  timestamp: number
  metadata?: any
}

interface AgentSystemStatus {
  initialized: boolean
  agentsRegistered: number
  agentsHealthy: number
  ready: boolean
}

interface AgentOption {
  id: string
  name: string
  description: string
  icon: string
}

const AGENTS: AgentOption[] = [
  { id: 'renata', name: 'Renata', description: 'General assistance & orchestration', icon: '🤖' },
  { id: 'analyst', name: 'Analyst', description: 'Data-driven analysis', icon: '📊' },
  { id: 'coach', name: 'Coach', description: 'Performance coaching', icon: '🎯' },
  { id: 'mentor', name: 'Mentor', description: 'Trading wisdom & guidance', icon: '🧠' },
  { id: 'trading-pattern-agent', name: 'Pattern Analyzer', description: 'Trading patterns', icon: '🔍' },
  { id: 'performance-coach-agent', name: 'Performance Coach', description: 'Improvement feedback', icon: '📈' },
  { id: 'risk-management-agent', name: 'Risk Manager', description: 'Risk analysis', icon: '⚠️' },
  { id: 'journal-insight-agent', name: 'Journal Insight', description: 'Psychological analysis', icon: '📔' }
]

export function EnhancedRenataChat({ className }: { className?: string }) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('renata')
  const [systemStatus, setSystemStatus] = useState<AgentSystemStatus>({
    initialized: false,
    agentsRegistered: 0,
    agentsHealthy: 0,
    ready: false
  })
  const [showSystemStatus, setShowSystemStatus] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { currentDateRange, displayMode } = useChatContext()
  const isAgentReady = useAgentSystemReady()

  // Initialize conversation
  useEffect(() => {
    if (messages.length === 0 && isAgentReady) {
      addWelcomeMessage()
    }
  }, [messages.length, isAgentReady])

  // Check system status periodically
  useEffect(() => {
    const checkStatus = async () => {
      const status = await getAgentSystemStatus()
      setSystemStatus(status)
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)

    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: WELCOME_MESSAGE,
      agent: 'renata',
      timestamp: Date.now(),
      metadata: { systemGreeting: true }
    }
    setMessages([welcomeMessage])
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userContent = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userContent,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])

    try {
      console.log('[EnhancedRenata] Sending message:', {
        content: userContent.substring(0, 100),
        agent: selectedAgent,
        ready: isAgentReady
      })

      // Send to agent service
      const response = await sendAgentMessage(userContent, {
        mode: selectedAgent as any,
        agent: selectedAgent !== 'renata' ? selectedAgent : undefined
      })

      // Add assistant response
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        agent: response.agentUsed,
        agentsInvolved: response.agentsInvolved,
        timestamp: Date.now(),
        metadata: {
          executionTime: response.executionTime,
          mode: response.mode
        }
      }

      setMessages(prev => [...prev, assistantMessage])

      // Show which agents were involved
      if (response.agentsInvolved.length > 1) {
        toast.success(`Analysis by ${response.agentsInvolved.join(', ')}`, {
          duration: 3000
        })
      }
    } catch (error) {
      console.error('[EnhancedRenata] Send error:', error)

      // Add error message
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: Date.now(),
        metadata: { error: (error as Error).message }
      }

      setMessages(prev => [...prev, errorMessage])
      toast.error('Failed to process request')
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

  const resetChat = () => {
    setMessages([])
    addWelcomeMessage()
    setInput('')
    toast.success('Chat reset successfully')
  }

  const getAgentInfo = (agentId: string) => {
    return AGENTS.find(a => a.id === agentId) || AGENTS[0]
  }

  return (
    <div className={cn('flex flex-col h-full bg-studio-surface border border-border rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-purple-400" />
          <div>
            <span className="font-medium text-studio-text">Renata AI</span>
            <div className="flex items-center gap-2 mt-1">
              {systemStatus.ready ? (
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{systemStatus.agentsHealthy} agents ready</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-yellow-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Initializing...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent Selector */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="text-xs bg-studio-surface border border-border rounded px-2 py-1 text-studio-text focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {AGENTS.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.icon} {agent.name}
              </option>
            ))}
          </select>

          {/* System Status Button */}
          <button
            onClick={() => setShowSystemStatus(!showSystemStatus)}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors',
              systemStatus.ready
                ? 'bg-green-900/30 border-green-700 text-green-400'
                : 'bg-yellow-900/30 border-yellow-700 text-yellow-400'
            )}
            title="Show system status"
          >
            {systemStatus.ready ? '● Ready' : '○ Loading'}
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

      {/* System Status Panel */}
      {showSystemStatus && (
        <div className="p-3 border-b border-border bg-studio-bg">
          <div className="text-xs font-medium text-studio-text mb-2">Agent System Status</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-studio-surface p-2 rounded">
              <div className="text-studio-muted">Registered</div>
              <div className="text-studio-text font-medium">{systemStatus.agentsRegistered} agents</div>
            </div>
            <div className="bg-studio-surface p-2 rounded">
              <div className="text-studio-muted">Healthy</div>
              <div className="text-studio-text font-medium">{systemStatus.agentsHealthy} agents</div>
            </div>
            <div className="bg-studio-surface p-2 rounded">
              <div className="text-studio-muted">Status</div>
              <div className={cn(
                'font-medium',
                systemStatus.ready ? 'text-green-400' : 'text-yellow-400'
              )}>
                {systemStatus.ready ? 'Ready' : 'Loading'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          const isSystem = message.role === 'system'
          const agentInfo = message.agent ? getAgentInfo(message.agent) : null

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
                  {agentInfo ? (
                    <span className="text-sm">{agentInfo.icon}</span>
                  ) : (
                    <Brain className="w-4 h-4 text-white" />
                  )}
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] p-3 rounded-lg',
                  isUser
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : isSystem
                      ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                      : 'bg-studio-accent/50 text-studio-text border border-border'
                )}
              >
                {!isUser && agentInfo && (
                  <div className="text-xs text-studio-muted mb-1">
                    {agentInfo.icon} {agentInfo.name}
                    {message.agentsInvolved && message.agentsInvolved.length > 1 && (
                      <span className="ml-1 text-purple-400">
                        (+{message.agentsInvolved.length - 1} more)
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs text-studio-muted mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                  {message.metadata?.executionTime && (
                    <span className="ml-2">
                      ({message.metadata.executionTime}ms)
                    </span>
                  )}
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
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {selectedAgent === 'renata' ? 'Renata is thinking...' : 'Processing...'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={selectedAgent === 'renata' ? 'Chat with Renata...' : `Ask ${getAgentInfo(selectedAgent).name}...`}
            className="flex-1 px-3 py-2 bg-studio-surface border border-border rounded-md text-studio-text placeholder-studio-muted focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading || !systemStatus.ready}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !systemStatus.ready}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-xs text-studio-muted">
          <p>💡 {getAgentInfo(selectedAgent).description}</p>
        </div>
      </div>
    </div>
  )
}
