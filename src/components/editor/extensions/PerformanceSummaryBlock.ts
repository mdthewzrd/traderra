'use client'

import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { PerformanceSummaryBlockComponent } from '../blocks/PerformanceSummaryBlockComponent'

export interface PerformanceSummaryData {
  period: {
    startDate: string
    endDate: string
    name?: string // e.g., "Q4 2024", "Weekly Review"
  }
  metrics: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    winRate: number
    totalPnL: number
    grossProfit: number
    grossLoss: number
    profitFactor: number
    avgWin: number
    avgLoss: number
    avgReturn: number
    maxWin: number
    maxLoss: number
    consecutiveWins: number
    consecutiveLosses: number
    maxDrawdown: number
    sharpeRatio?: number
    returnOnAccount?: number
  }
  breakdown: {
    byStrategy?: Record<string, {
      trades: number
      pnl: number
      winRate: number
    }>
    bySymbol?: Record<string, {
      trades: number
      pnl: number
      winRate: number
    }>
    byTimeframe?: Record<string, {
      trades: number
      pnl: number
      winRate: number
    }>
  }
  goals?: {
    target?: string
    achieved?: boolean
    notes?: string
  }
  insights?: string[]
  improvements?: string[]
  notes?: string
}

export const PerformanceSummaryBlock = Node.create({
  name: 'performanceSummary',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-performance-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-performance-id': attributes.id,
          }
        },
      },
      data: {
        default: {
          period: {
            startDate: '',
            endDate: '',
            name: '',
          },
          metrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnL: 0,
            grossProfit: 0,
            grossLoss: 0,
            profitFactor: 0,
            avgWin: 0,
            avgLoss: 0,
            avgReturn: 0,
            maxWin: 0,
            maxLoss: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            maxDrawdown: 0,
          },
          breakdown: {},
          insights: [],
          improvements: [],
          notes: '',
        },
        parseHTML: element => {
          const data = element.getAttribute('data-performance-data')
          return data ? JSON.parse(data) : {}
        },
        renderHTML: attributes => {
          if (!attributes.data) {
            return {}
          }
          return {
            'data-performance-data': JSON.stringify(attributes.data),
          }
        },
      },
      metadata: {
        default: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        parseHTML: element => {
          const metadata = element.getAttribute('data-performance-metadata')
          return metadata ? JSON.parse(metadata) : {}
        },
        renderHTML: attributes => {
          if (!attributes.metadata) {
            return {}
          }
          return {
            'data-performance-metadata': JSON.stringify(attributes.metadata),
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="performance-summary"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'performance-summary',
        class: 'performance-summary-block',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PerformanceSummaryBlockComponent)
  },

  addCommands() {
    return {
      insertPerformanceSummary: (data: Partial<PerformanceSummaryData> = {}) => ({ commands }) => {
        const performanceData: PerformanceSummaryData = {
          period: {
            startDate: '',
            endDate: '',
            name: '',
          },
          metrics: {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnL: 0,
            grossProfit: 0,
            grossLoss: 0,
            profitFactor: 0,
            avgWin: 0,
            avgLoss: 0,
            avgReturn: 0,
            maxWin: 0,
            maxLoss: 0,
            consecutiveWins: 0,
            consecutiveLosses: 0,
            maxDrawdown: 0,
          },
          breakdown: {},
          insights: [],
          improvements: [],
          notes: '',
          ...data,
        }

        return commands.insertContent({
          type: this.name,
          attrs: {
            id: `performance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: performanceData,
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        })
      },

      updatePerformanceSummary: (id: string, data: Partial<PerformanceSummaryData>) => ({ state, commands }) => {
        const { doc } = state
        let blockPos: number | null = null

        doc.descendants((node, pos) => {
          if (node.type.name === this.name && node.attrs.id === id) {
            blockPos = pos
            return false
          }
        })

        if (blockPos !== null) {
          const currentNode = doc.nodeAt(blockPos)
          if (currentNode) {
            return commands.setNodeMarkup(blockPos, undefined, {
              ...currentNode.attrs,
              data: { ...currentNode.attrs.data, ...data },
              metadata: {
                ...currentNode.attrs.metadata,
                updatedAt: new Date().toISOString(),
              },
            })
          }
        }

        return false
      },
    }
  },
})

// Utility functions for performance calculations
export function calculateMetrics(trades: any[]): PerformanceSummaryData['metrics'] {
  if (!trades.length) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgReturn: 0,
      maxWin: 0,
      maxLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      maxDrawdown: 0,
    }
  }

  const winningTrades = trades.filter(t => t.pnl > 0)
  const losingTrades = trades.filter(t => t.pnl < 0)

  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0)
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0)
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0))

  const winRate = (winningTrades.length / trades.length) * 100
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0
  const avgReturn = totalPnL / trades.length

  const maxWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0
  const maxLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0

  // Calculate consecutive streaks
  let maxConsecutiveWins = 0
  let maxConsecutiveLosses = 0
  let currentWinStreak = 0
  let currentLossStreak = 0

  trades.forEach(trade => {
    if (trade.pnl > 0) {
      currentWinStreak++
      currentLossStreak = 0
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWinStreak)
    } else if (trade.pnl < 0) {
      currentLossStreak++
      currentWinStreak = 0
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLossStreak)
    }
  })

  // Calculate maximum drawdown
  let peak = 0
  let maxDrawdown = 0
  let runningTotal = 0

  trades.forEach(trade => {
    runningTotal += trade.pnl
    if (runningTotal > peak) {
      peak = runningTotal
    }
    const drawdown = peak - runningTotal
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  })

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: Math.round(winRate * 100) / 100,
    totalPnL: Math.round(totalPnL * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    avgReturn: Math.round(avgReturn * 100) / 100,
    maxWin: Math.round(maxWin * 100) / 100,
    maxLoss: Math.round(maxLoss * 100) / 100,
    consecutiveWins: maxConsecutiveWins,
    consecutiveLosses: maxConsecutiveLosses,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
  }
}

export function generateInsights(metrics: PerformanceSummaryData['metrics']): string[] {
  const insights: string[] = []

  if (metrics.winRate > 60) {
    insights.push(`Strong win rate of ${metrics.winRate}% indicates good trade selection`)
  } else if (metrics.winRate < 40) {
    insights.push(`Low win rate of ${metrics.winRate}% suggests need for better entry criteria`)
  }

  if (metrics.profitFactor > 1.5) {
    insights.push(`Excellent profit factor of ${metrics.profitFactor} shows strong profitability`)
  } else if (metrics.profitFactor < 1) {
    insights.push(`Profit factor below 1.0 indicates net losses - review strategy`)
  }

  if (metrics.avgWin / Math.abs(metrics.avgLoss) > 2) {
    insights.push(`Strong risk-reward ratio with winners averaging ${metrics.avgWin.toFixed(2)} vs losses ${metrics.avgLoss.toFixed(2)}`)
  }

  if (metrics.maxDrawdown > metrics.totalPnL * 0.2) {
    insights.push(`High maximum drawdown suggests need for better risk management`)
  }

  if (metrics.consecutiveLosses > 5) {
    insights.push(`Maximum consecutive losses of ${metrics.consecutiveLosses} indicates need for loss limits`)
  }

  return insights
}