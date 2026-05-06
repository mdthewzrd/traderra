'use client'

/**
 * AGUI Trading Dashboard - AI-Generated User Interface for Trading
 * Integrates CopilotKit for natural language interactions with trading data
 */

import React, { useState, useEffect } from 'react'
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import { CopilotTextarea } from '@copilotkit/react-textarea'
import { Brain, TrendingUp, MessageSquare, Sparkles, Target, Zap } from 'lucide-react'

interface ScanResult {
  ticker: string
  gapPercent: number
  volume: number
  rMultiple: number
  date?: string
}

interface AGUITradingDashboardProps {
  scanResults: ScanResult[]
  onScanExecute: (params: any) => Promise<void>
  onTickerSelect: (ticker: string) => void
  selectedTicker?: string
  isExecuting: boolean
}

export function AGUITradingDashboard({
  scanResults,
  onScanExecute,
  onTickerSelect,
  selectedTicker,
  isExecuting
}: AGUITradingDashboardProps) {
  const [aiInsights, setAiInsights] = useState<string>('')
  const [naturalLanguageQuery, setNaturalLanguageQuery] = useState('')
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  // Make scan results readable by AI
  useCopilotReadable({
    description: 'Current trading scan results with gap percentages, volume, and R-multiples',
    value: scanResults.map(result => ({
      ticker: result.ticker,
      gapPercent: result.gapPercent,
      volume: result.volume,
      rMultiple: result.rMultiple,
      performance: result.gapPercent > 50 ? 'high performer' : 'moderate performer'
    }))
  })

  // Make current market context readable
  useCopilotReadable({
    description: 'Current trading dashboard context and user selection',
    value: {
      selectedTicker,
      totalResults: scanResults.length,
      avgGap: scanResults.length > 0 ?
        (scanResults.reduce((sum, r) => sum + r.gapPercent, 0) / scanResults.length).toFixed(1) : '0',
      topPerformer: scanResults.length > 0 ?
        scanResults.reduce((max, r) => r.gapPercent > max.gapPercent ? r : max, scanResults[0]) : null
    }
  })

  // AI Action: Analyze scan results
  useCopilotAction({
    name: "analyzeScanResults",
    description: "Analyze trading scan results and provide insights about patterns, opportunities, and risks",
    parameters: [
      {
        name: "analysisType",
        type: "string",
        description: "Type of analysis: 'opportunities', 'risks', 'patterns', or 'summary'"
      }
    ],
    handler: async ({ analysisType }) => {
      const insights = generateAIInsights(scanResults, analysisType)
      setAiInsights(insights)
      return insights
    }
  })

  // AI Action: Generate scan parameters from natural language
  useCopilotAction({
    name: "createScanFromDescription",
    description: "Create trading scan parameters from natural language description",
    parameters: [
      {
        name: "description",
        type: "string",
        description: "Natural language description of desired scan (e.g., 'Find momentum breakouts in biotech stocks')"
      }
    ],
    handler: async ({ description }) => {
      const scanParams = parseNaturalLanguageToScan(description)
      await onScanExecute(scanParams)
      return `Created scan based on: "${description}"`
    }
  })

  // AI Action: Suggest trading strategies
  useCopilotAction({
    name: "suggestTradingStrategies",
    description: "Suggest trading strategies based on current scan results and market conditions",
    parameters: [
      {
        name: "riskTolerance",
        type: "string",
        description: "Risk tolerance: 'conservative', 'moderate', or 'aggressive'"
      }
    ],
    handler: async ({ riskTolerance }) => {
      const suggestions = generateTradingStrategies(scanResults, riskTolerance)
      setAiSuggestions(suggestions)
      return suggestions
    }
  })

  // Generate AI insights based on scan results
  function generateAIInsights(results: ScanResult[], analysisType: string): string {
    if (results.length === 0) return "No scan results to analyze. Run a scan to get AI insights."

    const topPerformers = results.filter(r => r.gapPercent > 100)
    const highVolume = results.filter(r => r.volume > 10000000)
    const avgGap = results.reduce((sum, r) => sum + r.gapPercent, 0) / results.length

    switch (analysisType) {
      case 'opportunities':
        return `🎯 Key Opportunities Identified:

• ${topPerformers.length} stocks showing exceptional gaps >100%
• ${highVolume.length} stocks with institutional-level volume (>10M)
• Average gap of ${avgGap.toFixed(1)}% suggests strong momentum day

Top picks: ${results.slice(0, 3).map(r => `${r.ticker} (${r.gapPercent.toFixed(1)}%)`).join(', ')}

Consider focusing on stocks with both high gaps AND high volume for better liquidity.`

      case 'risks':
        return `⚠️ Risk Assessment:

• Extreme gaps (>200%) may indicate unsustainable moves
• Low volume stocks pose liquidity risks for position sizing
• High R-multiples suggest extended moves - watch for reversals

Risk management: Set tight stops, position size appropriately, and monitor for fade patterns.`

      case 'patterns':
        return `📊 Pattern Analysis:

• Gap distribution: ${results.filter(r => r.gapPercent < 50).length} small, ${results.filter(r => r.gapPercent >= 50 && r.gapPercent < 200).length} medium, ${results.filter(r => r.gapPercent >= 200).length} large gaps
• Volume profile suggests ${highVolume.length > results.length / 2 ? 'institutional' : 'retail'} driven moves
• R-multiple patterns indicate ${results.some(r => r.rMultiple > 10) ? 'parabolic' : 'controlled'} momentum`

      default:
        return `📈 Scan Summary:

Found ${results.length} opportunities with average gap of ${avgGap.toFixed(1)}%
Strong momentum indicated by ${topPerformers.length} exceptional performers
${highVolume.length} stocks showing institutional interest

Ready to dive deeper into specific opportunities!`
    }
  }

  // Parse natural language into scan parameters
  function parseNaturalLanguageToScan(description: string): any {
    const params: any = {
      filters: {},
      natural_language_query: description
    }

    // Basic pattern matching for common requests
    if (description.toLowerCase().includes('biotech') || description.toLowerCase().includes('pharma')) {
      params.filters.sector = 'healthcare'
    }
    if (description.toLowerCase().includes('momentum')) {
      params.filters.min_gap = 2.0
      params.filters.min_volume = 5000000
    }
    if (description.toLowerCase().includes('breakout')) {
      params.filters.lc_frontside_d2_extended = true
    }
    if (description.toLowerCase().includes('high volume')) {
      params.filters.min_volume = 10000000
    }

    return params
  }

  // Generate trading strategy suggestions
  function generateTradingStrategies(results: ScanResult[], riskTolerance: string): string[] {
    const strategies = []

    if (riskTolerance === 'conservative') {
      strategies.push("Focus on stocks with gaps 20-50% and volume >10M for safer entry points")
      strategies.push("Use tight 2-3% stops and take profits at 1:2 risk-reward ratios")
      strategies.push("Avoid parabolic moves (R-multiple >5) to reduce reversal risk")
    } else if (riskTolerance === 'aggressive') {
      strategies.push("Target highest gap stocks (>200%) for maximum profit potential")
      strategies.push("Use wider stops (5-8%) to allow for volatility")
      strategies.push("Scale into positions on any pullbacks after initial gap")
    } else {
      strategies.push("Balance between gap size and volume - target 50-150% gaps with 5M+ volume")
      strategies.push("Use dynamic stops based on ATR for optimal risk management")
      strategies.push("Consider partial profits at 2R and let runners capture extended moves")
    }

    return strategies
  }

  return (
    <div className="space-y-6">
      {/* AI-Enhanced Header */}
      <div className="studio-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, var(--studio-gold) 0%, rgba(212, 175, 55, 0.8) 100%)',
              boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
            }}>
              <Brain className="h-5 w-5 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold studio-text">AI-Enhanced Trading Analysis</h2>
              <p className="text-sm studio-muted">Natural language trading intelligence powered by Renata AI</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <Sparkles className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">AI Active</span>
          </div>
        </div>

        {/* Natural Language Query Interface */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 studio-text">
              <MessageSquare className="inline h-4 w-4 mr-2" />
              Ask AI About Your Trading Strategy
            </label>
            <CopilotTextarea
              className="studio-input w-full min-h-[80px] resize-none"
              placeholder="Ask me anything about your scan results, trading strategies, or market analysis. For example:
• 'Analyze these results for opportunities'
• 'Create a scan for momentum breakouts in biotech'
• 'Suggest conservative trading strategies'
• 'What are the risks with these gaps?'"
              value={naturalLanguageQuery}
              onValueChange={setNaturalLanguageQuery}
              autosuggestionsConfig={{
                textareaPurpose: "Trading strategy analysis and market insights",
                chatApiConfigs: {
                  suggestionsApiConfig: {
                    forwardedParams: {
                      max_tokens: 20,
                      stop: [".", "?", "!"]
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      {aiInsights && (
        <div className="studio-card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold studio-text">AI Analysis</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <pre className="whitespace-pre-wrap text-sm studio-text">{aiInsights}</pre>
            </div>
          </div>
        </div>
      )}

      {/* AI Strategy Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="studio-card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold studio-text">AI Strategy Suggestions</h3>
          </div>
          <div className="space-y-3">
            {aiSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg" style={{
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)'
              }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                  background: 'var(--studio-gold)',
                  color: 'black'
                }}>
                  {index + 1}
                </div>
                <p className="text-sm studio-text flex-1">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick AI Actions */}
      <div className="studio-card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold studio-text">Quick AI Actions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => generateAIInsights(scanResults, 'opportunities')}
            className="p-4 rounded-lg border-2 border-transparent hover:border-primary transition-all duration-200 text-left group"
            style={{ background: 'var(--studio-bg-secondary)' }}
          >
            <TrendingUp className="h-5 w-5 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-medium studio-text">Find Opportunities</div>
            <div className="text-xs studio-muted">AI-powered opportunity analysis</div>
          </button>

          <button
            onClick={() => generateAIInsights(scanResults, 'risks')}
            className="p-4 rounded-lg border-2 border-transparent hover:border-primary transition-all duration-200 text-left group"
            style={{ background: 'var(--studio-bg-secondary)' }}
          >
            <Target className="h-5 w-5 text-red-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-medium studio-text">Assess Risks</div>
            <div className="text-xs studio-muted">Identify potential risks</div>
          </button>

          <button
            onClick={() => generateAIInsights(scanResults, 'patterns')}
            className="p-4 rounded-lg border-2 border-transparent hover:border-primary transition-all duration-200 text-left group"
            style={{ background: 'var(--studio-bg-secondary)' }}
          >
            <Brain className="h-5 w-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-medium studio-text">Pattern Analysis</div>
            <div className="text-xs studio-muted">Detect market patterns</div>
          </button>

          <button
            onClick={() => generateTradingStrategies(scanResults, 'moderate')}
            className="p-4 rounded-lg border-2 border-transparent hover:border-primary transition-all duration-200 text-left group"
            style={{ background: 'var(--studio-bg-secondary)' }}
          >
            <Zap className="h-5 w-5 text-yellow-400 mb-2 group-hover:scale-110 transition-transform" />
            <div className="text-sm font-medium studio-text">Get Strategies</div>
            <div className="text-xs studio-muted">AI trading strategies</div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default AGUITradingDashboard