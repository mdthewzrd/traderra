'use client'

import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { TradeEntryBlockComponent } from '../blocks/TradeEntryBlockComponent'

export interface TradeEntryData {
  symbol: string
  side: 'long' | 'short'
  entryPrice: number
  exitPrice?: number
  quantity: number
  entryDate: string
  exitDate?: string
  stopLoss?: number
  takeProfit?: number
  notes?: string
  setup?: string
  outcome?: string
  pnl?: number
  commission?: number
  tags?: string[]
}

export const TradeEntryBlock = Node.create({
  name: 'tradeEntry',

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
        parseHTML: element => element.getAttribute('data-trade-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }
          return {
            'data-trade-id': attributes.id,
          }
        },
      },
      data: {
        default: {
          symbol: '',
          side: 'long',
          entryPrice: 0,
          quantity: 0,
          entryDate: new Date().toISOString().split('T')[0],
          notes: '',
          setup: '',
          outcome: '',
        },
        parseHTML: element => {
          const data = element.getAttribute('data-trade-data')
          return data ? JSON.parse(data) : {}
        },
        renderHTML: attributes => {
          if (!attributes.data) {
            return {}
          }
          return {
            'data-trade-data': JSON.stringify(attributes.data),
          }
        },
      },
      metadata: {
        default: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        parseHTML: element => {
          const metadata = element.getAttribute('data-trade-metadata')
          return metadata ? JSON.parse(metadata) : {}
        },
        renderHTML: attributes => {
          if (!attributes.metadata) {
            return {}
          }
          return {
            'data-trade-metadata': JSON.stringify(attributes.metadata),
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="trade-entry"]',
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'trade-entry',
        class: 'trade-entry-block',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TradeEntryBlockComponent)
  },

  addCommands() {
    return {
      insertTradeEntry: (data: Partial<TradeEntryData> = {}) => ({ commands }) => {
        const tradeData: TradeEntryData = {
          symbol: '',
          side: 'long',
          entryPrice: 0,
          quantity: 0,
          entryDate: new Date().toISOString().split('T')[0],
          notes: '',
          setup: '',
          outcome: '',
          ...data,
        }

        return commands.insertContent({
          type: this.name,
          attrs: {
            id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: tradeData,
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        })
      },

      updateTradeEntry: (id: string, data: Partial<TradeEntryData>) => ({ state, commands }) => {
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

// Calculate P&L for a trade
export function calculatePnL(trade: TradeEntryData): number {
  if (!trade.exitPrice) return 0

  const priceChange = trade.side === 'long'
    ? trade.exitPrice - trade.entryPrice
    : trade.entryPrice - trade.exitPrice

  const grossPnL = priceChange * trade.quantity
  const commission = trade.commission || 0

  return grossPnL - commission
}

// Calculate return percentage
export function calculateReturnPercentage(trade: TradeEntryData): number {
  if (!trade.exitPrice) return 0

  const costBasis = trade.entryPrice * trade.quantity
  const pnl = calculatePnL(trade)

  return (pnl / costBasis) * 100
}

// Get trade status
export function getTradeStatus(trade: TradeEntryData): 'open' | 'closed' | 'pending' {
  if (trade.exitPrice && trade.exitDate) return 'closed'
  if (trade.entryPrice > 0 && trade.entryDate) return 'open'
  return 'pending'
}