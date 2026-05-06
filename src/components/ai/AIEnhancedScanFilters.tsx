'use client'

/**
 * AI-Enhanced Scan Filters - Natural Language Trading Filters
 * Provides intelligent filter suggestions and natural language configuration
 */

import React, { useState, useEffect } from 'react'
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core'
import {
  Filter,
  Sparkles,
  TrendingUp,
  DollarSign,
  BarChart3,
  Calendar,
  Target,
  Brain,
  Zap
} from 'lucide-react'

interface FilterParams {
  min_gap?: number
  min_volume?: number
  min_price?: number
  max_price?: number
  sector?: string
  lc_frontside_d2_extended?: boolean
  lc_frontside_d3_extended?: boolean
  risk_tolerance?: 'conservative' | 'moderate' | 'aggressive'
}

interface AIEnhancedScanFiltersProps {
  onFiltersChange: (filters: FilterParams) => void
  currentFilters: FilterParams
  isExecuting: boolean
}

export function AIEnhancedScanFilters({
  onFiltersChange,
  currentFilters,
  isExecuting
}: AIEnhancedScanFiltersProps) {
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([])
  const [currentMarketCondition, setCurrentMarketCondition] = useState('neutral')
  const [aiFilterExplanation, setAiFilterExplanation] = useState('')

  // Make current filters readable by AI
  useCopilotReadable({
    description: 'Current trading scan filter settings and parameters',
    value: {
      ...currentFilters,
      explanation: 'Current filter configuration for trading scan'
    }
  })

  // Make market context readable
  useCopilotReadable({
    description: 'Current market conditions and filter recommendations',
    value: {
      marketCondition: currentMarketCondition,
      smartSuggestions,
      timestamp: new Date().toISOString()
    }
  })

  // AI Action: Optimize filters for current market conditions
  useCopilotAction({
    name: "optimizeFiltersForMarket",
    description: "Optimize trading filters based on current market conditions and user goals",
    parameters: [
      {
        name: "marketCondition",
        type: "string",
        description: "Current market condition: 'bullish', 'bearish', 'volatile', or 'ranging'"
      },
      {
        name: "tradingGoal",
        type: "string",
        description: "Trading goal: 'scalping', 'swing', 'momentum', or 'breakout'"
      }
    ],
    handler: async ({ marketCondition, tradingGoal }) => {
      const optimizedFilters = generateOptimizedFilters(marketCondition, tradingGoal)
      onFiltersChange(optimizedFilters)
      setCurrentMarketCondition(marketCondition)

      const explanation = generateFilterExplanation(optimizedFilters, marketCondition, tradingGoal)
      setAiFilterExplanation(explanation)

      return `Optimized filters for ${marketCondition} market conditions and ${tradingGoal} trading`
    }
  })

  // AI Action: Generate filters from natural language
  useCopilotAction({
    name: "createFiltersFromDescription",
    description: "Create specific trading filters from natural language description",
    parameters: [
      {
        name: "description",
        type: "string",
        description: "Natural language filter description (e.g., 'Find large cap momentum stocks with high volume')"
      }
    ],
    handler: async ({ description }) => {
      const parsedFilters = parseNaturalLanguageFilters(description)
      onFiltersChange(parsedFilters)

      const explanation = `Created filters from: "${description}"\n\nApplied settings:\n${Object.entries(parsedFilters).map(([key, value]) => `• ${key}: ${value}`).join('\n')}`
      setAiFilterExplanation(explanation)

      return explanation
    }
  })

  // AI Action: Suggest filter improvements
  useCopilotAction({
    name: "suggestFilterImprovements",
    description: "Analyze current filters and suggest improvements for better trading results",
    parameters: [],
    handler: async () => {
      const suggestions = generateFilterSuggestions(currentFilters)
      setSmartSuggestions(suggestions)
      return suggestions
    }
  })

  // Generate optimized filters based on market conditions
  function generateOptimizedFilters(marketCondition: string, tradingGoal: string): FilterParams {
    const baseFilters: FilterParams = {}

    // Market condition adjustments
    if (marketCondition === 'bullish') {
      baseFilters.min_gap = 1.5
      baseFilters.min_volume = 5000000
      baseFilters.lc_frontside_d2_extended = true
    } else if (marketCondition === 'bearish') {
      baseFilters.min_gap = 3.0
      baseFilters.min_volume = 10000000
      baseFilters.min_price = 5.0
    } else if (marketCondition === 'volatile') {
      baseFilters.min_gap = 2.0
      baseFilters.min_volume = 15000000
      baseFilters.max_price = 50.0
    } else {
      baseFilters.min_gap = 1.0
      baseFilters.min_volume = 3000000
    }

    // Trading goal adjustments
    if (tradingGoal === 'scalping') {
      baseFilters.min_volume = Math.max(baseFilters.min_volume || 0, 20000000)
      baseFilters.min_price = 10.0
      baseFilters.max_price = 100.0
    } else if (tradingGoal === 'swing') {
      baseFilters.min_gap = Math.max(baseFilters.min_gap || 0, 2.0)
      baseFilters.lc_frontside_d2_extended = true
    } else if (tradingGoal === 'momentum') {
      baseFilters.min_gap = Math.max(baseFilters.min_gap || 0, 3.0)
      baseFilters.lc_frontside_d3_extended = true
    }

    return baseFilters
  }

  // Parse natural language into filter parameters
  function parseNaturalLanguageFilters(description: string): FilterParams {
    const filters: FilterParams = {}
    const text = description.toLowerCase()

    // Gap detection
    if (text.includes('large gap') || text.includes('big gap')) {
      filters.min_gap = 5.0
    } else if (text.includes('small gap') || text.includes('minor gap')) {
      filters.min_gap = 1.0
    } else if (text.includes('medium gap') || text.includes('moderate gap')) {
      filters.min_gap = 2.5
    }

    // Volume detection
    if (text.includes('high volume') || text.includes('heavy volume')) {
      filters.min_volume = 15000000
    } else if (text.includes('low volume') || text.includes('light volume')) {
      filters.min_volume = 1000000
    } else if (text.includes('institutional volume')) {
      filters.min_volume = 25000000
    }

    // Price detection
    if (text.includes('large cap') || text.includes('big stocks')) {
      filters.min_price = 50.0
    } else if (text.includes('small cap') || text.includes('penny')) {
      filters.max_price = 10.0
      filters.min_price = 1.0
    } else if (text.includes('mid cap')) {
      filters.min_price = 10.0
      filters.max_price = 50.0
    }

    // Pattern detection
    if (text.includes('momentum') || text.includes('breakout')) {
      filters.lc_frontside_d2_extended = true
    }
    if (text.includes('extended') || text.includes('parabolic')) {
      filters.lc_frontside_d3_extended = true
    }

    // Risk tolerance
    if (text.includes('conservative') || text.includes('safe')) {
      filters.risk_tolerance = 'conservative'
      filters.min_volume = Math.max(filters.min_volume || 0, 10000000)
      filters.min_price = Math.max(filters.min_price || 0, 5.0)
    } else if (text.includes('aggressive') || text.includes('risky')) {
      filters.risk_tolerance = 'aggressive'
    }

    return filters
  }

  // Generate filter explanation
  function generateFilterExplanation(filters: FilterParams, marketCondition: string, tradingGoal: string): string {
    let explanation = `🎯 AI Filter Optimization for ${marketCondition} market & ${tradingGoal} trading:\n\n`

    if (filters.min_gap) {
      explanation += `• Gap Filter: ${filters.min_gap}% minimum - targeting ${filters.min_gap > 3 ? 'strong momentum' : 'moderate movement'}\n`
    }
    if (filters.min_volume) {
      explanation += `• Volume Filter: ${(filters.min_volume / 1000000).toFixed(1)}M minimum - ensuring ${filters.min_volume > 15000000 ? 'institutional liquidity' : 'adequate liquidity'}\n`
    }
    if (filters.min_price || filters.max_price) {
      explanation += `• Price Range: $${filters.min_price || 0} - $${filters.max_price || '∞'} - ${filters.min_price && filters.min_price > 20 ? 'large cap focus' : 'broad market coverage'}\n`
    }
    if (filters.lc_frontside_d2_extended) {
      explanation += `• LC D2 Pattern: Active - targeting Lightspeed Continuation patterns\n`
    }

    explanation += `\n💡 This configuration is optimized for current ${marketCondition} conditions and ${tradingGoal} strategies.`

    return explanation
  }

  // Generate filter improvement suggestions
  function generateFilterSuggestions(filters: FilterParams): string[] {
    const suggestions = []

    if (!filters.min_volume || filters.min_volume < 5000000) {
      suggestions.push("Consider increasing minimum volume to 5M+ for better liquidity")
    }
    if (!filters.min_gap || filters.min_gap < 1.5) {
      suggestions.push("Add minimum gap filter (1.5%+) to focus on momentum moves")
    }
    if (!filters.lc_frontside_d2_extended) {
      suggestions.push("Enable LC D2 Extended pattern for higher probability setups")
    }
    if (!filters.min_price || filters.min_price < 2.0) {
      suggestions.push("Set minimum price filter ($2+) to avoid illiquid penny stocks")
    }
    if (filters.risk_tolerance === 'aggressive' && !filters.max_price) {
      suggestions.push("Consider max price limit for aggressive settings to manage risk")
    }

    return suggestions
  }

  // Predefined smart filter presets
  const smartPresets = [
    {
      name: "Conservative Momentum",
      icon: Target,
      description: "Safe plays with good volume",
      filters: {
        min_gap: 1.5,
        min_volume: 10000000,
        min_price: 5.0,
        max_price: 100.0,
        lc_frontside_d2_extended: true,
        risk_tolerance: 'conservative' as const
      }
    },
    {
      name: "Aggressive Breakouts",
      icon: Zap,
      description: "High-risk, high-reward setups",
      filters: {
        min_gap: 3.0,
        min_volume: 5000000,
        min_price: 1.0,
        lc_frontside_d3_extended: true,
        risk_tolerance: 'aggressive' as const
      }
    },
    {
      name: "Institutional Flow",
      icon: DollarSign,
      description: "Large volume, quality stocks",
      filters: {
        min_gap: 2.0,
        min_volume: 25000000,
        min_price: 20.0,
        lc_frontside_d2_extended: true,
        risk_tolerance: 'moderate' as const
      }
    }
  ]

  return (
    <div className="space-y-6">
      {/* AI Filter Header */}
      <div className="studio-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <Brain className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold studio-text">AI-Enhanced Scan Filters</h3>
            <p className="text-sm studio-muted">Intelligent filter optimization powered by market analysis</p>
          </div>
        </div>

        {/* Smart Presets */}
        <div>
          <h4 className="text-sm font-medium studio-text mb-3">Smart Presets</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {smartPresets.map((preset, index) => (
              <button
                key={index}
                onClick={() => onFiltersChange(preset.filters)}
                className="p-4 rounded-lg border-2 border-transparent hover:border-primary transition-all duration-200 text-left group"
                style={{ background: 'var(--studio-bg-secondary)' }}
                disabled={isExecuting}
              >
                <preset.icon className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-sm font-medium studio-text">{preset.name}</div>
                <div className="text-xs studio-muted">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Filter Settings */}
      <div className="studio-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold studio-text">Active Filters</h3>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium" style={{
            background: Object.keys(currentFilters).length > 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
            border: `1px solid ${Object.keys(currentFilters).length > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(156, 163, 175, 0.3)'}`
          }}>
            <Sparkles className="h-3 w-3" />
            {Object.keys(currentFilters).length} active
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gap Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium studio-text">
              <TrendingUp className="h-4 w-4" />
              Min Gap %
            </label>
            <input
              type="number"
              value={currentFilters.min_gap || ''}
              onChange={(e) => onFiltersChange({
                ...currentFilters,
                min_gap: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              placeholder="1.5"
              step="0.1"
              className="studio-input w-full"
              disabled={isExecuting}
            />
          </div>

          {/* Volume Filter */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium studio-text">
              <BarChart3 className="h-4 w-4" />
              Min Volume (M)
            </label>
            <input
              type="number"
              value={currentFilters.min_volume ? (currentFilters.min_volume / 1000000).toFixed(1) : ''}
              onChange={(e) => onFiltersChange({
                ...currentFilters,
                min_volume: e.target.value ? parseFloat(e.target.value) * 1000000 : undefined
              })}
              placeholder="5.0"
              step="0.1"
              className="studio-input w-full"
              disabled={isExecuting}
            />
          </div>

          {/* Price Range */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium studio-text">
              <DollarSign className="h-4 w-4" />
              Min Price
            </label>
            <input
              type="number"
              value={currentFilters.min_price || ''}
              onChange={(e) => onFiltersChange({
                ...currentFilters,
                min_price: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              placeholder="2.00"
              step="0.01"
              className="studio-input w-full"
              disabled={isExecuting}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium studio-text">
              <DollarSign className="h-4 w-4" />
              Max Price
            </label>
            <input
              type="number"
              value={currentFilters.max_price || ''}
              onChange={(e) => onFiltersChange({
                ...currentFilters,
                max_price: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              placeholder="100.00"
              step="0.01"
              className="studio-input w-full"
              disabled={isExecuting}
            />
          </div>
        </div>

        {/* Pattern Filters */}
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-medium studio-text">Pattern Filters</h4>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentFilters.lc_frontside_d2_extended || false}
                onChange={(e) => onFiltersChange({
                  ...currentFilters,
                  lc_frontside_d2_extended: e.target.checked
                })}
                disabled={isExecuting}
                className="rounded"
              />
              <span className="text-sm studio-text">LC Frontside D2 Extended</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentFilters.lc_frontside_d3_extended || false}
                onChange={(e) => onFiltersChange({
                  ...currentFilters,
                  lc_frontside_d3_extended: e.target.checked
                })}
                disabled={isExecuting}
                className="rounded"
              />
              <span className="text-sm studio-text">LC Frontside D3 Extended</span>
            </label>
          </div>
        </div>
      </div>

      {/* AI Filter Explanation */}
      {aiFilterExplanation && (
        <div className="studio-card">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold studio-text">AI Filter Analysis</h3>
          </div>
          <div className="p-4 rounded-lg" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <pre className="whitespace-pre-wrap text-sm studio-text">{aiFilterExplanation}</pre>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {smartSuggestions.length > 0 && (
        <div className="studio-card">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold studio-text">Smart Suggestions</h3>
          </div>
          <div className="space-y-2">
            {smartSuggestions.map((suggestion, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg" style={{
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)'
              }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5" style={{
                  background: 'var(--studio-gold)',
                  color: 'black'
                }}>
                  !
                </div>
                <p className="text-sm studio-text">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AIEnhancedScanFilters