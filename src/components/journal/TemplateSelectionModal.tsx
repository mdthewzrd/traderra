'use client'

import React, { useState } from 'react'
import {
  X,
  FileText,
  Layout,
  Target,
  TrendingUp,
  Calendar,
  BookOpen,
  Search,
  BarChart3,
  Shield,
  Globe,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: 'trading' | 'planning' | 'research' | 'general'
  icon: React.ComponentType<any>
  content: string
  variables?: TemplateVariable[]
}

export interface TemplateVariable {
  name: string
  type: 'text' | 'date' | 'number' | 'select'
  placeholder: string
  required: boolean
  options?: string[]
}

interface TemplateSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateDocument: (template?: DocumentTemplate, variables?: Record<string, any>) => void
  selectedFolderId?: string
}

const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    description: 'Daily trading review and planning template',
    category: 'trading',
    icon: Calendar,
    content: `# Daily Trading Journal - {date}

## Market Overview
- **Market sentiment:**
- **Key news/events:**
- **Sector focus:**

## Trades Today
### Trade 1: {symbol}
- **Entry:** $
- **Exit:** $
- **P&L:** $
- **Setup:**
- **Execution:**
- **Lessons:**

## Daily Review
### What went well:
- [ ] Followed my strategy
- [ ] Proper risk management
- [ ] Emotional control

### Areas for improvement:
- [ ]
- [ ]
- [ ]

## Tomorrow's Plan
- **Watchlist:**
- **Key levels to watch:**
- **Strategy focus:**`,
    variables: [
      { name: 'date', type: 'date', placeholder: 'Today\'s date', required: true },
      { name: 'symbol', type: 'text', placeholder: 'Stock symbol', required: false }
    ]
  },
  {
    id: 'strategy-log',
    name: 'Strategy Log',
    description: 'Comprehensive trading strategy documentation',
    category: 'trading',
    icon: Target,
    content: `# Trading Strategy: {strategy_name}

## Overview
- **Strategy Type:** {strategy_type}
- **Market Conditions:**
- **Time Frame:**
- **Risk/Reward Ratio:**

## Entry Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Exit Rules
### Profit Taking
- **Target 1:**
- **Target 2:**
- **Trailing stop:**

### Stop Loss
- **Initial stop:**
- **Adjustment rules:**

## Backtesting Results
| Metric | Value |
|--------|-------|
| Total Trades | |
| Win Rate | |
| Avg R/R | |
| Max Drawdown | |

## Notes & Refinements
`,
    variables: [
      { name: 'strategy_name', type: 'text', placeholder: 'Strategy name', required: true },
      {
        name: 'strategy_type',
        type: 'select',
        placeholder: 'Strategy type',
        required: true,
        options: ['Momentum', 'Mean Reversion', 'Breakout', 'Scalping', 'Swing Trading']
      }
    ]
  },
  {
    id: 'trade-entry',
    name: 'Trade Analysis',
    description: 'Individual trade analysis and review',
    category: 'trading',
    icon: TrendingUp,
    content: `# Trade Analysis: {symbol} - {date}

## Trade Details
- **Symbol:** {symbol}
- **Side:** {side}
- **Entry Price:** $` + `{entry_price}
- **Exit Price:** $` + `{exit_price}
- **Position Size:** {position_size} shares
- **P&L:** $` + `{pnl}

## Setup Analysis
### Market Context
- **Market trend:**
- **Sector performance:**
- **Volume profile:**

### Technical Setup
- **Pattern:**
- **Key levels:**
- **Indicators:**

## Execution Review
### Entry
- [ ] Entry criteria met
- [ ] Proper timing
- [ ] Correct position size

### Management
- [ ] Stop loss set
- [ ] Profit targets defined
- [ ] Risk managed

### Exit
- [ ] Exit plan followed
- [ ] Emotions controlled
- [ ] Lessons captured

## Performance Metrics
- **Risk/Reward Ratio:**
- **% Gain/Loss:**
- **Hold Time:**
- **Commission:** $

## Lessons Learned
### What worked:
-

### What didn't work:
-

### Next time:
- `,
    variables: [
      { name: 'symbol', type: 'text', placeholder: 'Stock symbol', required: true },
      { name: 'date', type: 'date', placeholder: 'Trade date', required: true },
      { name: 'side', type: 'select', placeholder: 'Trade side', required: true, options: ['Long', 'Short'] },
      { name: 'entry_price', type: 'number', placeholder: 'Entry price', required: true },
      { name: 'exit_price', type: 'number', placeholder: 'Exit price', required: false },
      { name: 'position_size', type: 'number', placeholder: 'Shares', required: true },
      { name: 'pnl', type: 'number', placeholder: 'P&L amount', required: false }
    ]
  },
  {
    id: 'goals-planning',
    name: 'Goals & Planning',
    description: 'Goal setting and progress tracking',
    category: 'planning',
    icon: Target,
    content: `# Trading Goals - {period}

## Financial Goals
### Primary Objectives
- [ ] Monthly P&L target: $
- [ ] Win rate target: %
- [ ] Maximum drawdown limit: %
- [ ] Number of trades:

### Risk Management Goals
- [ ] Never risk more than % per trade
- [ ] Maintain risk/reward ratio of :
- [ ] Stop loss discipline: 100%

## Skill Development Goals
### Technical Analysis
- [ ] Master pattern
- [ ] Learn new indicator
- [ ] Improve entry timing

### Psychology & Discipline
- [ ] Reduce emotional trading
- [ ] Stick to trading plan
- [ ] Improve patience

## Review & Progress
### Weekly Check-ins
- [ ] Week 1:
- [ ] Week 2:
- [ ] Week 3:
- [ ] Week 4:

### Monthly Assessment
- **Goals achieved:**
- **Areas for improvement:**
- **Next month's focus:**

## Action Items
- [ ]
- [ ]
- [ ] `,
    variables: [
      {
        name: 'period',
        type: 'select',
        placeholder: 'Time period',
        required: true,
        options: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'January', 'February', 'March', 'April', 'May', 'June']
      }
    ]
  },
  {
    id: 'general-review',
    name: 'Performance Review',
    description: 'Weekly/monthly performance analysis',
    category: 'planning',
    icon: BarChart3,
    content: `# Performance Review - {period}

## Overview
- **Period:** {period}
- **Total Trades:**
- **Win Rate:** %
- **Total P&L:** $
- **Best Trade:** $
- **Worst Trade:** $

## Performance Metrics
### Financial Performance
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Total P&L | $ | $ | |
| Win Rate | % | % | |
| Avg Win | $ | $ | |
| Avg Loss | $ | $ | |
| Profit Factor | | | |

### Risk Management
- **Largest loss:** $
- **Max drawdown:** %
- **Risk per trade:** %
- **Risk compliance:** %

## Trade Analysis
### Best Performing Setups
1. **Setup:**
   - **Trades:**
   - **Win rate:** %
   - **Avg P&L:** $

### Underperforming Areas
1. **Issue:**
   - **Impact:**
   - **Solution:**

## Psychological Review
### Strengths This Period
- [ ] Followed trading plan
- [ ] Managed emotions well
- [ ] Proper risk management
- [ ] Patient with setups

### Areas for Improvement
- [ ] Reduce FOMO trades
- [ ] Better position sizing
- [ ] Improve entry timing
- [ ] Enhance exit strategy

## Action Plan
### Next Period Focus
1. **Primary goal:**
2. **Secondary goal:**
3. **Skill to develop:**

### Specific Actions
- [ ]
- [ ]
- [ ]

## Notes & Observations
`,
    variables: [
      {
        name: 'period',
        type: 'select',
        placeholder: 'Review period',
        required: true,
        options: ['This Week', 'This Month', 'Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024']
      }
    ]
  },
  {
    id: 'research-paper',
    name: 'Research Analysis',
    description: 'Market research and stock analysis',
    category: 'research',
    icon: Search,
    content: `# Research Analysis: {topic}

## Executive Summary
**Thesis:**

**Key Points:**
-
-
-

## Market Context
### Sector Overview
- **Sector:**
- **Market cap:**
- **Recent performance:**

### Industry Trends
- **Growth drivers:**
- **Headwinds:**
- **Competitive landscape:**

## Company Analysis (if applicable)
### Fundamentals
- **Revenue:**
- **Earnings:**
- **P/E Ratio:**
- **Debt/Equity:**

### Technical Analysis
- **Price trend:**
- **Support levels:**
- **Resistance levels:**
- **Volume profile:**

## Investment Thesis
### Bull Case
- [ ] Factor 1
- [ ] Factor 2
- [ ] Factor 3

### Bear Case
- [ ] Risk 1
- [ ] Risk 2
- [ ] Risk 3

## Trading Implications
### Potential Setups
1. **Bullish scenario:**
   - **Entry:**
   - **Target:**
   - **Stop:**

2. **Bearish scenario:**
   - **Entry:**
   - **Target:**
   - **Stop:**

## Sources & References
-
-
-

## Conclusion
**Overall assessment:**
**Probability:** %
**Risk/Reward:** :
**Action plan:** `,
    variables: [
      { name: 'topic', type: 'text', placeholder: 'Research topic/symbol', required: true }
    ]
  },
  {
    id: 'learning-notes',
    name: 'Learning Notes',
    description: 'Educational content and insights',
    category: 'general',
    icon: BookOpen,
    content: `# Learning Notes: {topic}

## Overview
**Subject:** {topic}
**Date:** {date}
**Source:**

## Key Concepts
### Main Ideas
1. **Concept 1:**
   - Explanation:
   - Application:

2. **Concept 2:**
   - Explanation:
   - Application:

3. **Concept 3:**
   - Explanation:
   - Application:

## Trading Applications
### How This Applies to My Trading
- **Strategy impact:**
- **Entry/exit rules:**
- **Risk management:**

### Actionable Insights
- [ ] Implement in next trade
- [ ] Backtest the concept
- [ ] Create new rule
- [ ] Modify existing strategy

## Examples & Case Studies
### Example 1
- **Situation:**
- **Application:**
- **Outcome:**

### Example 2
- **Situation:**
- **Application:**
- **Outcome:**

## Summary & Next Steps
### Key Takeaways
-
-
-

### Action Items
- [ ]
- [ ]
- [ ]

### Further Research Needed
-
-
- `,
    variables: [
      { name: 'topic', type: 'text', placeholder: 'Learning topic', required: true },
      { name: 'date', type: 'date', placeholder: 'Date', required: true }
    ]
  },
  {
    id: 'risk-management',
    name: 'Risk Assessment',
    description: 'Risk management analysis and rules',
    category: 'planning',
    icon: Shield,
    content: `# Risk Management Analysis - {assessment_type}

## Current Risk Profile
### Portfolio Overview
- **Total capital:** $
- **Available margin:** $
- **Current positions:**
- **Portfolio beta:**

### Risk Metrics
- **Maximum risk per trade:** %
- **Portfolio heat:** %
- **Correlation risk:**
- **Sector concentration:** %

## Risk Assessment
### Market Risks
- [ ] Market volatility
- [ ] Economic uncertainty
- [ ] Interest rate changes
- [ ] Geopolitical events

### Trading Risks
- [ ] Overleverage
- [ ] Position sizing errors
- [ ] Emotional decisions
- [ ] Technology failures

### Portfolio Risks
- [ ] Sector concentration
- [ ] Correlation clustering
- [ ] Liquidity constraints
- [ ] Margin requirements

## Risk Management Rules
### Position Sizing
1. **Never risk more than {max_risk}% per trade**
2. **Maximum portfolio heat: {max_heat}%**
3. **Correlation limit: max {correlation_limit} correlated positions**

### Stop Loss Rules
1. **Always set stop loss before entry**
2. **Never move stop loss against position**
3. **Respect predetermined R:R ratios**

### Portfolio Management
1. **Maximum exposure per sector: {sector_limit}%**
2. **Cash reserve minimum: {cash_reserve}%**
3. **Position review frequency: {review_frequency}**

## Risk Monitoring
### Daily Checks
- [ ] Portfolio heat calculation
- [ ] Margin utilization
- [ ] Correlation analysis
- [ ] Sector exposure

### Weekly Review
- [ ] Risk rule compliance
- [ ] Maximum loss evaluation
- [ ] Stress test scenarios
- [ ] Position sizing accuracy

## Scenario Analysis
### Best Case Scenario
- **Impact:** $
- **Probability:** %
- **Action plan:**

### Worst Case Scenario
- **Impact:** $
- **Probability:** %
- **Mitigation:**

### Most Likely Scenario
- **Impact:** $
- **Probability:** %
- **Preparation:**

## Action Items
- [ ] Update position sizes
- [ ] Review stop losses
- [ ] Reduce correlation
- [ ] Increase cash reserves`,
    variables: [
      {
        name: 'assessment_type',
        type: 'select',
        placeholder: 'Assessment type',
        required: true,
        options: ['Daily Check', 'Weekly Review', 'Monthly Analysis', 'Quarterly Assessment']
      },
      { name: 'max_risk', type: 'number', placeholder: 'Max risk % per trade', required: true },
      { name: 'max_heat', type: 'number', placeholder: 'Max portfolio heat %', required: true },
      { name: 'correlation_limit', type: 'number', placeholder: 'Max correlated positions', required: true },
      { name: 'sector_limit', type: 'number', placeholder: 'Max sector exposure %', required: true },
      { name: 'cash_reserve', type: 'number', placeholder: 'Min cash reserve %', required: true },
      {
        name: 'review_frequency',
        type: 'select',
        placeholder: 'Review frequency',
        required: true,
        options: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly']
      }
    ]
  }
]

const TEMPLATE_CATEGORIES = {
  trading: { name: 'Trading', icon: TrendingUp, color: '#10B981' },
  planning: { name: 'Planning', icon: Target, color: '#F59E0B' },
  research: { name: 'Research', icon: Search, color: '#8B5CF6' },
  general: { name: 'General', icon: FileText, color: '#6B7280' }
}

export function TemplateSelectionModal({
  isOpen,
  onClose,
  onCreateDocument,
  selectedFolderId
}: TemplateSelectionModalProps) {
  const [step, setStep] = useState<'choice' | 'template' | 'variables' | 'fresh'>('choice')
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null)
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({})
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Fresh document state
  const [freshDocument, setFreshDocument] = useState({
    title: '',
    category: 'general',
    type: 'document',
    tags: [] as string[],
    tagInput: ''
  })

  if (!isOpen) return null

  const handleFreshDocument = () => {
    setStep('fresh')
  }

  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template)
    if (template.variables && template.variables.length > 0) {
      setStep('variables')
      // Initialize variables with default values
      const initialVars: Record<string, any> = {}
      template.variables.forEach(variable => {
        if (variable.type === 'date') {
          initialVars[variable.name] = new Date().toISOString().split('T')[0]
        } else {
          initialVars[variable.name] = ''
        }
      })
      setTemplateVariables(initialVars)
    } else {
      onCreateDocument(template)
      onClose()
    }
  }

  const handleVariableSubmit = () => {
    if (selectedTemplate) {
      onCreateDocument(selectedTemplate, templateVariables)
      onClose()
    }
  }

  const handleFreshDocumentSubmit = () => {
    // Create a simple fresh document with basic metadata
    onCreateDocument(undefined, {
      title: freshDocument.title || 'Untitled Document',
      category: freshDocument.category,
      type: freshDocument.type,
      tags: freshDocument.tags
    })
    onClose()
  }

  const handleAddTag = () => {
    if (freshDocument.tagInput.trim() && !freshDocument.tags.includes(freshDocument.tagInput.trim())) {
      setFreshDocument(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: ''
      }))
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFreshDocument(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleClose = () => {
    setStep('choice')
    setSelectedTemplate(null)
    setTemplateVariables({})
    setSelectedCategory(null)
    setFreshDocument({
      title: '',
      category: 'general',
      type: 'document',
      tags: [],
      tagInput: ''
    })
    onClose()
  }

  const filteredTemplates = selectedCategory
    ? DOCUMENT_TEMPLATES.filter(template => template.category === selectedCategory)
    : DOCUMENT_TEMPLATES

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />

        <div className="relative bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {step === 'choice' && 'Create New Document'}
                  {step === 'template' && 'Choose Template'}
                  {step === 'variables' && `Configure ${selectedTemplate?.name}`}
                  {step === 'fresh' && 'Create Fresh Document'}
                </h2>
                <p className="text-sm text-gray-400">
                  {step === 'choice' && 'Start fresh or use a template to speed up your workflow'}
                  {step === 'template' && 'Select a template that matches your needs'}
                  {step === 'variables' && 'Fill in the template variables'}
                  {step === 'fresh' && 'Set up your new document with title, category, and tags'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {step === 'choice' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fresh Document */}
                <button
                  onClick={handleFreshDocument}
                  className="group p-8 bg-[#111111] hover:bg-[#161616] border border-[#2a2a2a] rounded-xl transition-all duration-200 text-left"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                      <FileText className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Fresh Document</h3>
                      <p className="text-sm text-gray-400">Start with a blank document</p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Create a completely blank document and build your content from scratch with full creative freedom.
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-500">Perfect for unique content</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                </button>

                {/* Template Document */}
                <button
                  onClick={() => setStep('template')}
                  className="group p-8 bg-[#111111] hover:bg-[#161616] border border-[#2a2a2a] rounded-xl transition-all duration-200 text-left"
                >
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Layout className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Use Template</h3>
                      <p className="text-sm text-gray-400">Choose from pre-built templates</p>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">
                    Speed up your workflow with professional templates designed for trading, research, and planning.
                  </p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-500">{DOCUMENT_TEMPLATES.length} templates available</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                </button>
              </div>
            )}

            {step === 'template' && (
              <div className="space-y-6">
                {/* Category Filter */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                      selectedCategory === null
                        ? 'bg-primary text-black'
                        : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#2a2a2a]'
                    )}
                  >
                    All Templates
                  </button>
                  {Object.entries(TEMPLATE_CATEGORIES).map(([key, category]) => {
                    const Icon = category.icon
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        className={cn(
                          'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                          selectedCategory === key
                            ? 'bg-primary text-black'
                            : 'bg-[#1a1a1a] text-gray-300 hover:bg-[#2a2a2a]'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{category.name}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Template Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((template) => {
                    const Icon = template.icon
                    const category = TEMPLATE_CATEGORIES[template.category]

                    return (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className="group p-4 bg-[#111111] hover:bg-[#161616] border border-[#2a2a2a] rounded-lg transition-all duration-200 text-left"
                      >
                        <div className="flex items-start space-x-3 mb-3">
                          <div
                            className="p-2 rounded-lg"
                            style={{ backgroundColor: `${category.color}20` }}
                          >
                            <Icon
                              className="w-5 h-5"
                              style={{ color: category.color }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                              {template.name}
                            </h4>
                            <p className="text-xs text-gray-400 mt-1">
                              {template.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor: `${category.color}20`,
                              color: category.color
                            }}
                          >
                            {category.name}
                          </span>
                          {template.variables && template.variables.length > 0 && (
                            <span className="text-xs text-gray-500">
                              {template.variables.length} fields
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Back Button */}
                <div className="flex justify-start pt-4 border-t border-[#2a2a2a]">
                  <button
                    onClick={() => setStep('choice')}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ← Back to options
                  </button>
                </div>
              </div>
            )}

            {step === 'variables' && selectedTemplate && selectedTemplate.variables && (
              <div className="space-y-6">
                <div className="p-4 bg-[#111111] border border-[#2a2a2a] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <selectedTemplate.icon className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-white">{selectedTemplate.name}</h3>
                      <p className="text-sm text-gray-400">{selectedTemplate.description}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-white">Template Variables</h4>

                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable.name} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        {variable.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {variable.required && <span className="text-red-400 ml-1">*</span>}
                      </label>

                      {variable.type === 'select' ? (
                        <select
                          value={templateVariables[variable.name] || ''}
                          onChange={(e) => setTemplateVariables(prev => ({
                            ...prev,
                            [variable.name]: e.target.value
                          }))}
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                          required={variable.required}
                        >
                          <option value="">{variable.placeholder}</option>
                          {variable.options?.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={variable.type}
                          value={templateVariables[variable.name] || ''}
                          onChange={(e) => setTemplateVariables(prev => ({
                            ...prev,
                            [variable.name]: e.target.value
                          }))}
                          placeholder={variable.placeholder}
                          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                          required={variable.required}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-[#2a2a2a]">
                  <button
                    onClick={() => setStep('template')}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ← Back to templates
                  </button>

                  <div className="space-x-3">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVariableSubmit}
                      className="px-6 py-2 bg-primary hover:bg-primary/90 text-black rounded-lg font-medium transition-colors"
                    >
                      Create Document
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'fresh' && (
              <div className="space-y-6">
                <div className="p-4 bg-[#111111] border border-[#2a2a2a] rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <div>
                      <h3 className="font-semibold text-white">Fresh Document</h3>
                      <p className="text-sm text-gray-400">Create a blank document with your custom settings</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Document Title */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Document Title <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={freshDocument.title}
                      onChange={(e) => setFreshDocument(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter document title..."
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                      autoFocus
                    />
                  </div>

                  {/* Document Category */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Category
                    </label>
                    <select
                      value={freshDocument.category}
                      onChange={(e) => setFreshDocument(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="general">General</option>
                      <option value="trading">Trading</option>
                      <option value="planning">Planning</option>
                      <option value="research">Research</option>
                    </select>
                  </div>

                  {/* Document Type */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Document Type
                    </label>
                    <select
                      value={freshDocument.type}
                      onChange={(e) => setFreshDocument(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                      <option value="document">Document</option>
                      <option value="journal">Journal Entry</option>
                      <option value="analysis">Analysis</option>
                      <option value="review">Review</option>
                      <option value="plan">Plan</option>
                      <option value="notes">Notes</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Tags
                    </label>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={freshDocument.tagInput}
                          onChange={(e) => setFreshDocument(prev => ({ ...prev, tagInput: e.target.value }))}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddTag()
                            }
                          }}
                          placeholder="Add a tag..."
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        <button
                          onClick={handleAddTag}
                          disabled={!freshDocument.tagInput.trim()}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
                        >
                          Add
                        </button>
                      </div>

                      {/* Tag Display */}
                      {freshDocument.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {freshDocument.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 bg-primary/20 text-primary text-xs rounded-md"
                            >
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-1 text-primary hover:text-primary/70"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-[#2a2a2a]">
                  <button
                    onClick={() => setStep('choice')}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ← Back to options
                  </button>

                  <div className="space-x-3">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFreshDocumentSubmit}
                      disabled={!freshDocument.title.trim()}
                      className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors"
                    >
                      Create Document
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateSelectionModal