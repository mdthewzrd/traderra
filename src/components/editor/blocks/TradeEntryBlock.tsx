'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  Target,
  Activity,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface TradeData {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  entryPrice: number
  exitPrice?: number
  quantity: number
  entryDate: string
  exitDate?: string
  pnl?: number
  pnlPercentage?: number
  stopLoss?: number
  takeProfit?: number
  strategy?: string
  notes?: string
  tags?: string[]
  status: 'open' | 'closed' | 'planned'
  risk?: number
  reward?: number
  commission?: number
}

interface TradeEntryBlockProps {
  tradeData: TradeData
  editable?: boolean
  onEdit?: (data: TradeData) => void
  onDelete?: (id: string) => void
  onDuplicate?: (data: TradeData) => void
  className?: string
}

export function TradeEntryBlock({
  tradeData,
  editable = false,
  onEdit,
  onDelete,
  onDuplicate,
  className,
}: TradeEntryBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const {
    id,
    symbol,
    side,
    entryPrice,
    exitPrice,
    quantity,
    entryDate,
    exitDate,
    pnl,
    pnlPercentage,
    stopLoss,
    takeProfit,
    strategy,
    notes,
    tags,
    status,
    risk,
    reward,
    commission,
  } = tradeData

  // Calculate values
  const currentValue = exitPrice || entryPrice
  const isProfit = pnl && pnl > 0
  const isLoss = pnl && pnl < 0
  const riskRewardRatio = risk && reward ? reward / risk : undefined

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'open':
        return 'text-blue-500 bg-blue-500/10'
      case 'closed':
        return isProfit ? 'text-green-500 bg-green-500/10' : isLoss ? 'text-red-500 bg-red-500/10' : 'text-gray-500 bg-gray-500/10'
      case 'planned':
        return 'text-yellow-500 bg-yellow-500/10'
      default:
        return 'text-gray-500 bg-gray-500/10'
    }
  }

  // Get side color and icon
  const getSideDisplay = () => {
    const isLong = side === 'Long'
    return {
      color: isLong ? 'text-green-500' : 'text-red-500',
      icon: isLong ? TrendingUp : TrendingDown,
      bg: isLong ? 'bg-green-500/10' : 'bg-red-500/10',
    }
  }

  const sideDisplay = getSideDisplay()

  return (
    <div className={cn(
      'studio-surface border border-studio-border rounded-lg overflow-hidden',
      'transition-all duration-200 hover:shadow-studio-lg',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-studio-border">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', sideDisplay.bg)}>
            <sideDisplay.icon className={cn('w-5 h-5', sideDisplay.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{symbol}</h3>
              <span className={cn('px-2 py-1 rounded-full text-xs font-medium', sideDisplay.bg, sideDisplay.color)}>
                {side}
              </span>
              <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor())}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {quantity} shares @ {formatCurrency(entryPrice)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pnl !== undefined && (
            <div className={cn(
              'text-right',
              isProfit ? 'text-green-500' : isLoss ? 'text-red-500' : 'text-muted-foreground'
            )}>
              <div className="font-semibold">
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
              </div>
              {pnlPercentage !== undefined && (
                <div className="text-sm">
                  {formatPercentage(pnlPercentage)}
                </div>
              )}
            </div>
          )}

          {editable && (
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Toggle details"
              >
                <Activity className="w-4 h-4" />
              </button>
              <button
                onClick={() => onEdit?.(tradeData)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Edit trade"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDuplicate?.(tradeData)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Duplicate trade"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete?.(id)}
                className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete trade"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Entry</div>
            <div className="text-sm font-medium">
              {format(new Date(entryDate), 'MMM dd')}
            </div>
          </div>
        </div>

        {exitDate && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Exit</div>
              <div className="text-sm font-medium">
                {format(new Date(exitDate), 'MMM dd')}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">Value</div>
            <div className="text-sm font-medium">
              {formatCurrency(quantity * currentValue)}
            </div>
          </div>
        </div>

        {riskRewardRatio && (
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">R:R</div>
              <div className="text-sm font-medium">
                1:{riskRewardRatio.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-studio-border p-4 space-y-4">
          {/* Price Levels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="studio-surface rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Entry Price</div>
              <div className="text-lg font-semibold">{formatCurrency(entryPrice)}</div>
            </div>

            {exitPrice && (
              <div className="studio-surface rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Exit Price</div>
                <div className="text-lg font-semibold">{formatCurrency(exitPrice)}</div>
              </div>
            )}

            {stopLoss && (
              <div className="studio-surface rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Stop Loss</div>
                <div className="text-lg font-semibold text-red-500">{formatCurrency(stopLoss)}</div>
              </div>
            )}

            {takeProfit && (
              <div className="studio-surface rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Take Profit</div>
                <div className="text-lg font-semibold text-green-500">{formatCurrency(takeProfit)}</div>
              </div>
            )}
          </div>

          {/* Strategy & Notes */}
          {strategy && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Strategy</div>
              <div className="px-3 py-2 bg-muted/30 rounded-lg text-sm">
                {strategy}
              </div>
            </div>
          )}

          {notes && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Notes</div>
              <div className="px-3 py-2 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
                {notes}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Tags</div>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-studio-border">
            {risk && (
              <div>
                <div className="text-xs text-muted-foreground">Risk</div>
                <div className="text-sm font-medium text-red-500">
                  {formatCurrency(risk)}
                </div>
              </div>
            )}

            {reward && (
              <div>
                <div className="text-xs text-muted-foreground">Reward</div>
                <div className="text-sm font-medium text-green-500">
                  {formatCurrency(reward)}
                </div>
              </div>
            )}

            {commission && (
              <div>
                <div className="text-xs text-muted-foreground">Commission</div>
                <div className="text-sm font-medium">
                  {formatCurrency(commission)}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground">Quantity</div>
              <div className="text-sm font-medium">
                {quantity.toLocaleString()} shares
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}