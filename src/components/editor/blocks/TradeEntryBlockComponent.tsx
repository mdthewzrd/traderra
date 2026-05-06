'use client'

import React, { useState, useCallback } from 'react'
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  Target,
  Shield,
  Edit3,
  Save,
  X,
  MoreVertical,
  Trash2,
  Copy,
} from 'lucide-react'
import { TradeEntryData, calculatePnL, calculateReturnPercentage, getTradeStatus } from '../extensions/TradeEntryBlock'
import { cn } from '@/lib/utils'

export function TradeEntryBlockComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(!node.attrs.data.symbol)
  const [editData, setEditData] = useState<TradeEntryData>(node.attrs.data)
  const [showMenu, setShowMenu] = useState(false)

  const tradeData: TradeEntryData = node.attrs.data
  const pnl = calculatePnL(tradeData)
  const returnPercentage = calculateReturnPercentage(tradeData)
  const status = getTradeStatus(tradeData)

  const handleSave = useCallback(() => {
    updateAttributes({
      data: editData,
      metadata: {
        ...node.attrs.metadata,
        updatedAt: new Date().toISOString(),
      },
    })
    setIsEditing(false)
  }, [editData, updateAttributes, node.attrs.metadata])

  const handleCancel = useCallback(() => {
    setEditData(tradeData)
    setIsEditing(false)
  }, [tradeData])

  const handleDelete = useCallback(() => {
    deleteNode()
  }, [deleteNode])

  const handleDuplicate = useCallback(() => {
    // This would need to be implemented at the editor level
    console.log('Duplicate block')
  }, [])

  if (isEditing) {
    return (
      <NodeViewWrapper className="trade-entry-block-wrapper">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Trade Entry
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1.5 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 text-sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Basic Trade Info */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Symbol</label>
              <input
                type="text"
                value={editData.symbol}
                onChange={(e) => setEditData({ ...editData, symbol: e.target.value.toUpperCase() })}
                placeholder="AAPL, EURUSD, BTC..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Side</label>
              <select
                value={editData.side}
                onChange={(e) => setEditData({ ...editData, side: e.target.value as 'long' | 'short' })}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Quantity</label>
              <input
                type="number"
                value={editData.quantity}
                onChange={(e) => setEditData({ ...editData, quantity: Number(e.target.value) })}
                placeholder="100"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Price Info */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Entry Price</label>
              <input
                type="number"
                step="0.0001"
                value={editData.entryPrice}
                onChange={(e) => setEditData({ ...editData, entryPrice: Number(e.target.value) })}
                placeholder="150.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Exit Price</label>
              <input
                type="number"
                step="0.0001"
                value={editData.exitPrice || ''}
                onChange={(e) => setEditData({ ...editData, exitPrice: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="155.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Commission</label>
              <input
                type="number"
                step="0.01"
                value={editData.commission || ''}
                onChange={(e) => setEditData({ ...editData, commission: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="5.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Entry Date</label>
              <input
                type="date"
                value={editData.entryDate}
                onChange={(e) => setEditData({ ...editData, entryDate: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Exit Date</label>
              <input
                type="date"
                value={editData.exitDate || ''}
                onChange={(e) => setEditData({ ...editData, exitDate: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Risk Management */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Stop Loss</label>
              <input
                type="number"
                step="0.0001"
                value={editData.stopLoss || ''}
                onChange={(e) => setEditData({ ...editData, stopLoss: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="145.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Take Profit</label>
              <input
                type="number"
                step="0.0001"
                value={editData.takeProfit || ''}
                onChange={(e) => setEditData({ ...editData, takeProfit: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="160.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Setup Analysis</label>
              <textarea
                value={editData.setup || ''}
                onChange={(e) => setEditData({ ...editData, setup: e.target.value })}
                placeholder="Describe the setup that led to this trade..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Outcome & Notes</label>
              <textarea
                value={editData.outcome || ''}
                onChange={(e) => setEditData({ ...editData, outcome: e.target.value })}
                placeholder="What happened? What did you learn?"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="trade-entry-block-wrapper group">
      <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
              tradeData.side === 'long'
                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
            )}>
              {tradeData.side === 'long' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {tradeData.side.toUpperCase()}
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {tradeData.symbol || 'New Trade'}
            </h3>
            <div className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              status === 'closed' ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
              status === 'open' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
            )}>
              {status.toUpperCase()}
            </div>
          </div>

          {/* Menu */}
          <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-accent"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-popover border border-border rounded-md shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={() => { setIsEditing(true); setShowMenu(false) }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={() => { handleDuplicate(); setShowMenu(false) }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" />
                  Duplicate
                </button>
                <button
                  onClick={() => { handleDelete(); setShowMenu(false) }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-destructive flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Trade Details Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Quantity</div>
            <div className="font-medium">{tradeData.quantity.toLocaleString()}</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Entry Price</div>
            <div className="font-medium">${tradeData.entryPrice.toFixed(4)}</div>
          </div>

          {tradeData.exitPrice && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Exit Price</div>
              <div className="font-medium">${tradeData.exitPrice.toFixed(4)}</div>
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Entry Date</div>
            <div className="font-medium text-sm">
              {new Date(tradeData.entryDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* P&L Section */}
        {tradeData.exitPrice && (
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">P&L</div>
                <div className={cn(
                  "text-lg font-bold",
                  pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  ${pnl.toFixed(2)}
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Return</div>
                <div className={cn(
                  "text-lg font-bold",
                  returnPercentage >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {returnPercentage.toFixed(2)}%
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Duration</div>
                <div className="text-lg font-bold">
                  {tradeData.exitDate
                    ? Math.abs(new Date(tradeData.exitDate).getTime() - new Date(tradeData.entryDate).getTime()) / (1000 * 60 * 60 * 24)
                    : Math.abs(new Date().getTime() - new Date(tradeData.entryDate).getTime()) / (1000 * 60 * 60 * 24)
                  } days
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {(tradeData.setup || tradeData.outcome) && (
          <div className="border-t border-border pt-4 mt-4 space-y-3">
            {tradeData.setup && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Setup</div>
                <div className="text-sm text-foreground">{tradeData.setup}</div>
              </div>
            )}
            {tradeData.outcome && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Outcome</div>
                <div className="text-sm text-foreground">{tradeData.outcome}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}