'use client'

/**
 * AI Commentary Panel - Real-time AI insights during scanning
 * Provides live commentary and analysis with intelligent prioritization
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import {
  Brain,
  MessageSquare,
  Activity,
  Target,
  AlertTriangle,
  TrendingUp,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Trash2,
  Filter
} from 'lucide-react'
import { aiWebSocketService, AICommentaryMessage, ScanProgress } from '@/services/aiWebSocketService'

interface AICommentaryPanelProps {
  scanId?: string
  isActive: boolean
  className?: string
}

export function AICommentaryPanel({ scanId, isActive, className = '' }: AICommentaryPanelProps) {
  const [messages, setMessages] = useState<AICommentaryMessage[]>([])
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Make commentary data readable by AI
  useCopilotReadable({
    description: 'Real-time AI commentary messages and analysis insights',
    value: {
      messages: messages.slice(-10), // Last 10 messages
      isConnected,
      scanProgress: progress,
      messageStats: {
        total: messages.length,
        critical: messages.filter(m => m.priority === 'critical').length,
        high: messages.filter(m => m.priority === 'high').length,
        opportunities: messages.filter(m => m.type === 'opportunity').length
      }
    }
  })

  // AI Action: Analyze commentary patterns
  useCopilotAction({
    name: "analyzeCommentaryPatterns",
    description: "Analyze AI commentary patterns to identify market insights and trading themes",
    parameters: [],
    handler: async () => {
      const patterns = analyzeMessagePatterns(messages)
      return `Commentary Analysis:\n\n${patterns}`
    }
  })

  // AI Action: Generate market summary
  useCopilotAction({
    name: "generateMarketSummary",
    description: "Generate a market summary based on AI commentary and scan progress",
    parameters: [],
    handler: async () => {
      const summary = generateMarketSummary(messages, progress)
      return summary
    }
  })

  // Helper function to analyze message patterns
  const analyzeMessagePatterns = useCallback((msgs: AICommentaryMessage[]) => {
    if (msgs.length === 0) return "No commentary data available for analysis"

    const patterns = {
      sectorMentions: {} as Record<string, number>,
      patternTypes: {} as Record<string, number>,
      riskLevels: {} as Record<string, number>,
      timeDistribution: {} as Record<string, number>
    }

    msgs.forEach(msg => {
      // Count sector mentions
      const sectors = ['technology', 'healthcare', 'finance', 'energy', 'biotech']
      sectors.forEach(sector => {
        if (msg.message.toLowerCase().includes(sector)) {
          patterns.sectorMentions[sector] = (patterns.sectorMentions[sector] || 0) + 1
        }
      })

      // Count pattern types
      const patternKeywords = ['breakout', 'momentum', 'consolidation', 'gap', 'volume']
      patternKeywords.forEach(pattern => {
        if (msg.message.toLowerCase().includes(pattern)) {
          patterns.patternTypes[pattern] = (patterns.patternTypes[pattern] || 0) + 1
        }
      })

      // Count risk levels
      patterns.riskLevels[msg.priority] = (patterns.riskLevels[msg.priority] || 0) + 1

      // Time distribution
      const hour = new Date(msg.timestamp).getHours()
      const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
      patterns.timeDistribution[timeSlot] = (patterns.timeDistribution[timeSlot] || 0) + 1
    })

    let analysis = "📊 Commentary Pattern Analysis:\n\n"

    if (Object.keys(patterns.sectorMentions).length > 0) {
      analysis += "🏢 Top Sectors Mentioned:\n"
      Object.entries(patterns.sectorMentions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .forEach(([sector, count]) => {
          analysis += `• ${sector}: ${count} mentions\n`
        })
      analysis += "\n"
    }

    if (Object.keys(patterns.patternTypes).length > 0) {
      analysis += "📈 Pattern Focus Areas:\n"
      Object.entries(patterns.patternTypes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([pattern, count]) => {
          analysis += `• ${pattern}: ${count} references\n`
        })
      analysis += "\n"
    }

    analysis += "⚠️ Risk Distribution:\n"
    Object.entries(patterns.riskLevels).forEach(([risk, count]) => {
      analysis += `• ${risk}: ${count} alerts\n`
    })

    return analysis
  }, [])

  // Helper function to generate market summary
  const generateMarketSummary = useCallback((msgs: AICommentaryMessage[], prog: ScanProgress | null) => {
    if (msgs.length === 0) return "No data available for market summary"

    const critical = msgs.filter(m => m.priority === 'critical').length
    const opportunities = msgs.filter(m => m.type === 'opportunity').length
    const riskAlerts = msgs.filter(m => m.type === 'risk_alert').length

    let summary = "📈 Market Summary Report:\n\n"

    if (prog) {
      summary += `🔍 Scan Progress: ${prog.progress_percent.toFixed(1)}% complete\n`
      summary += `📊 Processed: ${prog.processed} / ${prog.total} tickers\n`
      summary += `🎯 Opportunities Found: ${prog.found_count}\n\n`
    }

    summary += "🚨 Alert Summary:\n"
    summary += `• Critical Alerts: ${critical}\n`
    summary += `• Opportunities: ${opportunities}\n`
    summary += `• Risk Warnings: ${riskAlerts}\n\n`

    if (opportunities > 0) {
      summary += "💡 Key Insights:\n"
      if (opportunities > 5) {
        summary += "• High opportunity environment detected\n"
      }
      if (critical > 2) {
        summary += "• Multiple critical situations require attention\n"
      }
      if (riskAlerts > opportunities) {
        summary += "• Risk-heavy market conditions observed\n"
      } else {
        summary += "• Favorable risk-reward conditions\n"
      }
    }

    summary += "\n📋 Recommendation: Monitor high-priority alerts and validate opportunities with additional analysis."

    return summary
  }, [])

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Handle new messages
  const handleMessage = useCallback((message: AICommentaryMessage) => {
    if (isPaused) return

    setMessages(prev => {
      const newMessages = [...prev, message].slice(-50) // Keep last 50 messages
      return newMessages
    })

    // Play sound for high priority messages
    if (soundEnabled && (message.priority === 'high' || message.priority === 'critical')) {
      playNotificationSound(message.priority)
    }

    // Auto-scroll after message added
    setTimeout(scrollToBottom, 100)
  }, [isPaused, soundEnabled, scrollToBottom])

  // Handle progress updates
  const handleProgress = useCallback((progressData: ScanProgress) => {
    setProgress(progressData)
  }, [])

  // Connect to AI WebSocket when scan starts
  useEffect(() => {
    if (isActive && scanId) {
      console.log('🚀 Starting AI commentary for scan:', scanId)

      aiWebSocketService.onMessage(handleMessage)
      aiWebSocketService.onProgress(handleProgress)

      aiWebSocketService.connect(scanId)
        .then(() => {
          setIsConnected(true)
          aiWebSocketService.startPeriodicInsights()
        })
        .catch(error => {
          console.error('Failed to connect AI commentary:', error)
          setIsConnected(false)
        })

      return () => {
        aiWebSocketService.removeMessageHandler(handleMessage)
        aiWebSocketService.removeProgressHandler(handleProgress)
        aiWebSocketService.disconnect()
        setIsConnected(false)
      }
    }
  }, [isActive, scanId, handleMessage, handleProgress])

  // Play notification sounds
  const playNotificationSound = (priority: string) => {
    try {
      // Create audio context for notification sounds
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Different tones for different priorities
      if (priority === 'critical') {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      } else if (priority === 'high') {
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.2)
      }
    } catch (error) {
      console.warn('Audio notification failed:', error)
    }
  }

  // Clear messages
  const clearMessages = () => {
    setMessages([])
  }

  // Filter messages by priority
  const filteredMessages = messages.filter(message => {
    if (filterPriority === 'all') return true
    return message.priority === filterPriority
  })

  // Get priority icon and color
  const getPriorityIndicator = (priority: string) => {
    switch (priority) {
      case 'critical':
        return { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' }
      case 'high':
        return { icon: Target, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' }
      case 'medium':
        return { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' }
      case 'low':
        return { icon: Brain, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' }
      default:
        return { icon: MessageSquare, color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' }
    }
  }

  // Get message type icon
  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'scan_start':
        return Brain
      case 'ticker_analysis':
        return Activity
      case 'pattern_detected':
        return Target
      case 'risk_alert':
        return AlertTriangle
      case 'opportunity':
        return TrendingUp
      case 'scan_complete':
        return Brain
      default:
        return MessageSquare
    }
  }

  if (!isActive) {
    return (
      <div className={`studio-card ${className}`}>
        <div className="flex items-center justify-center h-48 text-center">
          <div>
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <div className="text-lg font-medium studio-text">AI Commentary Inactive</div>
            <div className="text-sm studio-muted mt-2">Start a scan to activate real-time AI analysis</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`studio-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold studio-text">AI Commentary</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-xs studio-muted">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="text-xs px-2 py-1 rounded studio-input"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
          >
            {soundEnabled ?
              <Volume2 className="h-4 w-4 text-primary" /> :
              <VolumeX className="h-4 w-4 text-gray-400" />
            }
          </button>

          {/* Pause/Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
          >
            {isPaused ?
              <Play className="h-4 w-4 text-green-400" /> :
              <Pause className="h-4 w-4 text-yellow-400" />
            }
          </button>

          {/* Clear */}
          <button
            onClick={clearMessages}
            className="p-1 rounded hover:bg-gray-700 transition-colors"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="studio-text">Analyzing: {progress.current_ticker}</span>
            <span className="studio-muted">{progress.processed} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress_percent}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-xs mt-1 studio-muted">
            <span>{progress.progress_percent.toFixed(1)}% complete</span>
            <span>{progress.found_count} opportunities found</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="h-80 overflow-y-auto studio-scrollbar space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <div className="text-sm studio-muted">
                {messages.length === 0 ? 'Waiting for AI analysis...' : 'No messages match current filter'}
              </div>
            </div>
          </div>
        ) : (
          filteredMessages.map((message, index) => {
            const priorityIndicator = getPriorityIndicator(message.priority)
            const MessageTypeIcon = getMessageTypeIcon(message.type)

            return (
              <div
                key={index}
                className={`p-3 rounded-lg border transition-all duration-300 ${priorityIndicator.bg} ${priorityIndicator.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${priorityIndicator.bg}`}>
                    <MessageTypeIcon className={`h-4 w-4 ${priorityIndicator.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {message.ticker && (
                        <span className="text-xs font-mono bg-gray-700 px-2 py-1 rounded">
                          {message.ticker}
                        </span>
                      )}
                      <span className="text-xs studio-muted">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      {message.confidence && (
                        <span className={`text-xs font-medium ${priorityIndicator.color}`}>
                          {message.confidence}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-sm studio-text leading-relaxed">
                      {message.message}
                    </p>
                  </div>
                  <priorityIndicator.icon className={`h-4 w-4 ${priorityIndicator.color} flex-shrink-0`} />
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t studio-border">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs studio-muted">Total</div>
            <div className="text-sm font-medium studio-text">{messages.length}</div>
          </div>
          <div>
            <div className="text-xs studio-muted">Critical</div>
            <div className="text-sm font-medium text-red-400">
              {messages.filter(m => m.priority === 'critical').length}
            </div>
          </div>
          <div>
            <div className="text-xs studio-muted">High</div>
            <div className="text-sm font-medium text-yellow-400">
              {messages.filter(m => m.priority === 'high').length}
            </div>
          </div>
          <div>
            <div className="text-xs studio-muted">Opportunities</div>
            <div className="text-sm font-medium text-green-400">
              {messages.filter(m => m.type === 'opportunity').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AICommentaryPanel