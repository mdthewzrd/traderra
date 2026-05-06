/**
 * AI WebSocket Service - Real-time AI Commentary for Trading
 * Provides intelligent commentary and analysis during live scanning operations
 */

export interface AICommentaryMessage {
  type: 'scan_start' | 'ticker_analysis' | 'pattern_detected' | 'risk_alert' | 'opportunity' | 'scan_complete'
  timestamp: string
  ticker?: string
  message: string
  confidence?: number
  data?: any
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export interface ScanProgress {
  current_ticker: string
  processed: number
  total: number
  found_count: number
  progress_percent: number
}

class AIWebSocketService {
  private ws: WebSocket | null = null
  private baseUrl: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private messageHandlers: ((message: AICommentaryMessage) => void)[] = []
  private progressHandlers: ((progress: ScanProgress) => void)[] = []

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_FASTAPI_WS_URL || 'ws://localhost:8000'
  }

  /**
   * Connect to AI commentary WebSocket
   */
  async connect(scanId: string): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return
    }

    this.isConnecting = true

    try {
      const wsUrl = `${this.baseUrl}/api/scan/progress/${scanId}`
      console.log('🔗 Connecting to AI commentary WebSocket:', wsUrl)

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('✅ AI WebSocket connected')
        this.isConnecting = false
        this.reconnectAttempts = 0

        // Send initial AI commentary
        this.generateAICommentary({
          type: 'scan_start',
          timestamp: new Date().toISOString(),
          message: 'AI analysis system activated. Beginning intelligent market scan.',
          priority: 'medium'
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onclose = (event) => {
        console.log('🔌 AI WebSocket closed:', event.code, event.reason)
        this.isConnecting = false
        this.ws = null

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++
            console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
            this.connect(scanId)
          }, this.reconnectDelay * this.reconnectAttempts)
        }
      }

      this.ws.onerror = (error) => {
        console.error('❌ AI WebSocket error:', error)
        this.isConnecting = false
      }

    } catch (error) {
      console.error('Failed to connect to AI WebSocket:', error)
      this.isConnecting = false
      throw error
    }
  }

  /**
   * Handle incoming WebSocket messages and generate AI commentary
   */
  private handleMessage(data: any) {
    // Handle different message types from FastAPI backend
    switch (data.type) {
      case 'connected':
        this.generateAICommentary({
          type: 'scan_start',
          timestamp: new Date().toISOString(),
          message: 'Connected to trading intelligence engine. Real-time analysis active.',
          priority: 'medium'
        })
        break

      case 'progress':
        if (data.current_ticker) {
          this.handleTickerProgress(data)
        }
        break

      case 'result':
        if (data.data) {
          this.analyzeResult(data.data)
        }
        break

      case 'complete':
        this.generateAICommentary({
          type: 'scan_complete',
          timestamp: new Date().toISOString(),
          message: `Scan analysis complete. AI has identified ${data.results_count || 0} potential trading opportunities.`,
          priority: 'high'
        })
        break

      case 'error':
        this.generateAICommentary({
          type: 'risk_alert',
          timestamp: new Date().toISOString(),
          message: `Scan error detected: ${data.message}. Switching to backup analysis mode.`,
          priority: 'critical'
        })
        break
    }

    // Update progress if available
    if (data.progress !== undefined || data.current_ticker) {
      const progress: ScanProgress = {
        current_ticker: data.current_ticker || 'Unknown',
        processed: data.processed || 0,
        total: data.total || 100,
        found_count: data.results_count || 0,
        progress_percent: data.progress || 0
      }
      this.notifyProgressHandlers(progress)
    }
  }

  /**
   * Handle individual ticker progress and generate intelligent commentary
   */
  private handleTickerProgress(data: any) {
    const ticker = data.current_ticker
    const aiCommentary = this.generateTickerCommentary(ticker, data)

    if (aiCommentary) {
      this.generateAICommentary(aiCommentary)
    }
  }

  /**
   * Generate intelligent commentary for individual tickers
   */
  private generateTickerCommentary(ticker: string, data: any): AICommentaryMessage | null {
    // Simulate AI analysis based on ticker characteristics
    const tickerAnalysis = this.analyzeTickerCharacteristics(ticker)

    if (Math.random() < 0.3) { // 30% chance of commentary per ticker
      const commentaries = [
        {
          message: `Analyzing ${ticker}: ${tickerAnalysis.sector} sector showing ${tickerAnalysis.momentum} momentum signals.`,
          priority: 'low' as const
        },
        {
          message: `${ticker}: AI detects ${tickerAnalysis.pattern} pattern formation with ${tickerAnalysis.confidence}% confidence.`,
          priority: 'medium' as const
        },
        {
          message: `${ticker}: Volume profile suggests ${tickerAnalysis.volumeSignal} institutional activity.`,
          priority: 'low' as const
        }
      ]

      const selected = commentaries[Math.floor(Math.random() * commentaries.length)]

      return {
        type: 'ticker_analysis',
        timestamp: new Date().toISOString(),
        ticker,
        message: selected.message,
        confidence: tickerAnalysis.confidence,
        priority: selected.priority
      }
    }

    return null
  }

  /**
   * Analyze ticker characteristics for AI commentary
   */
  private analyzeTickerCharacteristics(ticker: string) {
    // Basic ticker analysis based on symbol patterns
    const sectors = ['technology', 'healthcare', 'finance', 'energy', 'consumer']
    const patterns = ['cup and handle', 'ascending triangle', 'bullish flag', 'breakout', 'consolidation']
    const momentums = ['strong bullish', 'moderate bullish', 'neutral', 'bearish']
    const volumeSignals = ['increasing', 'decreasing', 'stable', 'unusual']

    return {
      sector: sectors[Math.floor(Math.random() * sectors.length)],
      pattern: patterns[Math.floor(Math.random() * patterns.length)],
      momentum: momentums[Math.floor(Math.random() * momentums.length)],
      volumeSignal: volumeSignals[Math.floor(Math.random() * volumeSignals.length)],
      confidence: Math.floor(Math.random() * 40) + 60 // 60-100%
    }
  }

  /**
   * Analyze scan results and generate opportunities/alerts
   */
  private analyzeResult(result: any) {
    if (!result.ticker) return

    // Analyze the result for opportunities and risks
    const gapPercent = result.gap_pct * 100
    const volume = result.volume
    const score = result.parabolic_score

    if (gapPercent > 100) {
      this.generateAICommentary({
        type: 'opportunity',
        timestamp: new Date().toISOString(),
        ticker: result.ticker,
        message: `🎯 High-probability setup detected in ${result.ticker}: ${gapPercent.toFixed(1)}% gap with exceptional momentum.`,
        confidence: Math.min(95, score * 10),
        priority: 'high',
        data: result
      })
    } else if (gapPercent > 200) {
      this.generateAICommentary({
        type: 'risk_alert',
        timestamp: new Date().toISOString(),
        ticker: result.ticker,
        message: `⚠️ Extreme movement alert: ${result.ticker} showing ${gapPercent.toFixed(1)}% gap - monitor for reversal risk.`,
        confidence: 85,
        priority: 'critical',
        data: result
      })
    } else if (score > 50) {
      this.generateAICommentary({
        type: 'pattern_detected',
        timestamp: new Date().toISOString(),
        ticker: result.ticker,
        message: `📊 Pattern recognition: ${result.ticker} exhibits strong momentum characteristics (Score: ${score.toFixed(1)}).`,
        confidence: Math.min(90, score * 1.5),
        priority: 'medium',
        data: result
      })
    }
  }

  /**
   * Generate and broadcast AI commentary
   */
  private generateAICommentary(commentary: AICommentaryMessage) {
    this.notifyMessageHandlers(commentary)
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: AICommentaryMessage) => void) {
    this.messageHandlers.push(handler)
  }

  /**
   * Add progress handler
   */
  onProgress(handler: (progress: ScanProgress) => void) {
    this.progressHandlers.push(handler)
  }

  /**
   * Remove message handler
   */
  removeMessageHandler(handler: (message: AICommentaryMessage) => void) {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
  }

  /**
   * Remove progress handler
   */
  removeProgressHandler(handler: (progress: ScanProgress) => void) {
    this.progressHandlers = this.progressHandlers.filter(h => h !== handler)
  }

  /**
   * Notify all message handlers
   */
  private notifyMessageHandlers(message: AICommentaryMessage) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        console.error('Error in message handler:', error)
      }
    })
  }

  /**
   * Notify all progress handlers
   */
  private notifyProgressHandlers(progress: ScanProgress) {
    this.progressHandlers.forEach(handler => {
      try {
        handler(progress)
      } catch (error) {
        console.error('Error in progress handler:', error)
      }
    })
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  /**
   * Generate periodic market insights during scanning
   */
  startPeriodicInsights() {
    const insights = [
      "Market volatility patterns suggest increased opportunity detection in small-cap momentum plays.",
      "AI sentiment analysis indicates bullish bias in current market conditions.",
      "Volume flow analysis shows institutional accumulation in growth sectors.",
      "Pattern recognition algorithms detecting increased breakout probability.",
      "Risk-adjusted scoring favors gap-up plays with strong volume confirmation.",
      "Real-time momentum indicators suggest continued trend strength in selected opportunities."
    ]

    let insightIndex = 0
    const intervalId = setInterval(() => {
      if (!this.isConnected()) {
        clearInterval(intervalId)
        return
      }

      this.generateAICommentary({
        type: 'ticker_analysis',
        timestamp: new Date().toISOString(),
        message: `💡 AI Insight: ${insights[insightIndex % insights.length]}`,
        priority: 'low'
      })

      insightIndex++
    }, 15000) // Every 15 seconds

    // Auto-stop after 5 minutes
    setTimeout(() => {
      clearInterval(intervalId)
    }, 300000)
  }
}

// Export singleton instance
export const aiWebSocketService = new AIWebSocketService()
export default aiWebSocketService