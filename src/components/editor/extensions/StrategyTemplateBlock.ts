'use client'

import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { StrategyTemplateBlockComponent } from '../blocks/StrategyTemplateBlockComponent'

export interface StrategyTemplateData {
  name: string
  description: string
  timeframe: string
  markets: string[]
  entryRules: string[]
  exitRules: string[]
  riskManagement: {
    stopLoss: string
    takeProfit: string
    positionSize: string
    maxRisk: string
  }
  indicators: string[]
  backtestResults?: {
    winRate: number
    profitFactor: number
    avgWin: number
    avgLoss: number
    maxDrawdown: number
    totalTrades: number
  }
  notes?: string
  tags?: string[]
}

export const StrategyTemplateBlock = Node.create({
  name: 'strategyTemplate',

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
        parseHTML: element => element.getAttribute('data-strategy-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-strategy-id': attributes.id,
          }
        },
      },
      data: {
        default: {
          name: '',
          description: '',
          timeframe: '',
          markets: [],
          entryRules: [],
          exitRules: [],
          riskManagement: {
            stopLoss: '',
            takeProfit: '',
            positionSize: '',
            maxRisk: '',
          },
          indicators: [],
          notes: '',
          tags: [],
        },
        parseHTML: element => {
          const data = element.getAttribute('data-strategy-data')
          return data ? JSON.parse(data) : {}
        },
        renderHTML: attributes => {
          if (!attributes.data) {
            return {}
          }
          return {
            'data-strategy-data': JSON.stringify(attributes.data),
          }
        },
      },
      metadata: {
        default: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        parseHTML: element => {
          const metadata = element.getAttribute('data-strategy-metadata')
          return metadata ? JSON.parse(metadata) : {}
        },
        renderHTML: attributes => {
          if (!attributes.metadata) {
            return {}
          }
          return {
            'data-strategy-metadata': JSON.stringify(attributes.metadata),
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="strategy-template"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'strategy-template',
        class: 'strategy-template-block',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(StrategyTemplateBlockComponent)
  },

  addCommands() {
    return {
      insertStrategyTemplate: (data: Partial<StrategyTemplateData> = {}) => ({ commands }) => {
        const strategyData: StrategyTemplateData = {
          name: '',
          description: '',
          timeframe: '',
          markets: [],
          entryRules: [],
          exitRules: [],
          riskManagement: {
            stopLoss: '',
            takeProfit: '',
            positionSize: '',
            maxRisk: '',
          },
          indicators: [],
          notes: '',
          tags: [],
          ...data,
        }

        return commands.insertContent({
          type: this.name,
          attrs: {
            id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: strategyData,
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        })
      },

      updateStrategyTemplate: (id: string, data: Partial<StrategyTemplateData>) => ({ state, commands }) => {
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

// Predefined strategy templates
export const STRATEGY_TEMPLATES = {
  breakout: {
    name: 'Breakout Strategy',
    description: 'Trade breakouts from key support/resistance levels with volume confirmation',
    timeframe: '4H, Daily',
    markets: ['Forex', 'Stocks', 'Crypto'],
    entryRules: [
      'Price breaks above/below key resistance/support level',
      'Volume increase on breakout (>1.5x average)',
      'Retest of broken level holds as new support/resistance',
    ],
    exitRules: [
      'Price reaches target (2-3x risk)',
      'Trailing stop triggered',
      'Failed retest of breakout level',
    ],
    riskManagement: {
      stopLoss: 'Below/above breakout level',
      takeProfit: '2-3x risk ratio',
      positionSize: '1-2% account risk per trade',
      maxRisk: '6% total portfolio risk',
    },
    indicators: ['Volume', 'Support/Resistance', 'Moving Averages'],
  },
  meanReversion: {
    name: 'Mean Reversion Strategy',
    description: 'Trade oversold/overbought conditions expecting price to return to mean',
    timeframe: '1H, 4H',
    markets: ['Forex', 'Stocks'],
    entryRules: [
      'RSI < 30 (oversold) or RSI > 70 (overbought)',
      'Price at 2+ standard deviations from moving average',
      'Divergence between price and momentum indicator',
    ],
    exitRules: [
      'Price returns to moving average',
      'RSI returns to neutral zone (30-70)',
      'Opposite signal triggered',
    ],
    riskManagement: {
      stopLoss: '2x average true range',
      takeProfit: 'Return to moving average',
      positionSize: '1% account risk per trade',
      maxRisk: '5% total portfolio risk',
    },
    indicators: ['RSI', 'Bollinger Bands', 'Moving Averages', 'MACD'],
  },
  momentum: {
    name: 'Momentum Strategy',
    description: 'Trade in direction of strong momentum with trend confirmation',
    timeframe: '15M, 1H, 4H',
    markets: ['Crypto', 'Forex', 'Stocks'],
    entryRules: [
      'Strong trend confirmed by multiple timeframes',
      'Momentum indicator shows strength (MACD, RSI)',
      'Price above/below key moving averages',
    ],
    exitRules: [
      'Momentum divergence appears',
      'Trend structure breaks',
      'Target reached (1.5-2x risk)',
    ],
    riskManagement: {
      stopLoss: 'Below/above recent swing point',
      takeProfit: '1.5-2x risk ratio',
      positionSize: '1-2% account risk per trade',
      maxRisk: '8% total portfolio risk',
    },
    indicators: ['MACD', 'RSI', 'Moving Averages', 'ADX'],
  },
}