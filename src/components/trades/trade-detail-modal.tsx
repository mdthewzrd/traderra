'use client'

import React, { useState } from 'react'
import { X, Calendar, Clock, DollarSign, TrendingUp, TrendingDown, Target, BarChart3, FileText, Star, Tag, Pencil, Save, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TradingChart } from '@/components/charts/trading-chart'
import { useChatContext } from '@/contexts/TraderraContext'

interface TradeDetailModalProps {
  trade: {
    id: string
    date: string
    symbol: string
    side: 'Long' | 'Short'
    quantity: number
    entryPrice: number
    exitPrice: number
    pnl: number
    pnlPercent: number
    commission: number
    duration: string
    strategy: string
    notes: string
    entryTime?: string
    exitTime?: string
    riskAmount?: number
    riskPercent?: number
    stopLoss?: number
    tags?: string[]
    dailyReviewId?: string
  }
  isOpen: boolean
  onClose: () => void
  initialEditMode?: boolean
  onSaved?: () => void
}

export function TradeDetailModal({ trade, isOpen, onClose, initialEditMode, onSaved }: TradeDetailModalProps) {
  const { isSidebarOpen: aiSidebarOpen } = useChatContext()
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedTrade, setEditedTrade] = useState(trade)
  const [isSaving, setIsSaving] = useState(false)
  const [tags, setTags] = useState<string[]>(trade.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [isSavingTags, setIsSavingTags] = useState(false)

  // Reset edit mode and edited trade when modal opens with new trade.
  // MUST be before the early return — hooks can't be conditional.
  React.useEffect(() => {
    setIsEditMode(!!initialEditMode)
    setEditedTrade(trade)
    setTags(trade.tags ?? [])
    setTagInput('')
  }, [trade.id, initialEditMode])

  if (!isOpen) return null

  const handleEditToggle = () => {
    if (isEditMode) {
      // If canceling edit, reset to original trade data
      setEditedTrade(trade)
    }
    setIsEditMode(!isEditMode)
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      // Send only editable fields to avoid overwriting system fields (id, createdAt, etc.)
      const payload = {
        entryPrice: editedTrade.entryPrice,
        exitPrice: editedTrade.exitPrice,
        quantity: editedTrade.quantity,
        pnl: editedTrade.pnl,
        pnlPercent: editedTrade.pnlPercent,
        commission: editedTrade.commission,
        riskAmount: editedTrade.riskAmount ?? null,
        riskPercent: editedTrade.riskPercent ?? null,
        stopLoss: editedTrade.stopLoss ?? null,
        strategy: editedTrade.strategy,
        notes: editedTrade.notes,
        entryTime: editedTrade.entryTime,
        exitTime: editedTrade.exitTime,
        tags,
      }
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Save failed (${res.status})`)
      }
      setIsEditMode(false)
      onSaved?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save trade')
    } finally {
      setIsSaving(false)
    }
  }

  // Persist user tags immediately via a targeted PATCH (works in view + edit mode).
  const persistTags = async (nextTags: string[]) => {
    setIsSavingTags(true)
    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Save failed (${res.status})`)
      }
      onSaved?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save tags')
      // Revert to last known good on failure.
      setTags(trade.tags ?? [])
    } finally {
      setIsSavingTags(false)
    }
  }

  const handleAddTag = () => {
    const value = tagInput.trim()
    if (!value || tags.includes(value)) {
      setTagInput('')
      return
    }
    const nextTags = [...tags, value]
    setTags(nextTags)
    setTagInput('')
    persistTags(nextTags)
  }

  const handleRemoveTag = (tag: string) => {
    const nextTags = tags.filter(t => t !== tag)
    setTags(nextTags)
    persistTags(nextTags)
  }

  const handleFieldChange = (field: string, value: any) => {
    setEditedTrade(prev => {
      const updated = {
        ...prev,
        [field]: value
      }

      // Recalculate P&L and percentage when prices or quantity change
      if (field === 'entryPrice' || field === 'exitPrice' || field === 'quantity') {
        const entryPrice = field === 'entryPrice' ? value : updated.entryPrice
        const exitPrice = field === 'exitPrice' ? value : updated.exitPrice
        const quantity = field === 'quantity' ? value : updated.quantity

        if (entryPrice > 0 && exitPrice > 0 && quantity > 0) {
          const priceDiff = exitPrice - entryPrice
          const newPnL = priceDiff * quantity
          const newPnLPercent = (priceDiff / entryPrice) * 100

          updated.pnl = newPnL
          updated.pnlPercent = newPnLPercent
        }
      }

      // Recalculate risk metrics when risk fields change
      if (field === 'riskAmount' || field === 'riskPercent' || field === 'stopLoss') {
        // Force re-render by updating the timestamp
        updated.lastUpdated = Date.now()
      }

      // Recalculate duration when entry or exit times change
      if ((field === 'entryTime' || field === 'exitTime') && updated.entryTime && updated.exitTime) {
        const entryDate = new Date(updated.entryTime)
        const exitDate = new Date(updated.exitTime)
        const durationMs = exitDate.getTime() - entryDate.getTime()

        if (durationMs > 0) {
          const hours = Math.floor(durationMs / (1000 * 60 * 60))
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
          const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)

          updated.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }
      }

      return updated
    })
  }

  // Use edited trade for calculations when in edit mode
  const currentTrade = isEditMode ? editedTrade : trade

  // Calculate additional metrics using current trade
  const grossPnL = currentTrade.pnl + currentTrade.commission
  const netPnL = currentTrade.pnl
  const entryValue = currentTrade.quantity * currentTrade.entryPrice
  const exitValue = currentTrade.quantity * currentTrade.exitPrice

  // Use editable risk values with fallbacks
  const riskAmount = currentTrade.riskAmount ?? (currentTrade.quantity * currentTrade.entryPrice * 0.02)
  const riskPercent = currentTrade.riskPercent ?? 2.0
  const stopLoss = currentTrade.stopLoss ?? (currentTrade.entryPrice * 0.98)
  const rMultiple = riskAmount > 0 ? netPnL / riskAmount : 0

  // Prepare trade data for chart
  const tradeData = currentTrade.entryTime && currentTrade.exitTime ? {
    entryTime: currentTrade.entryTime,
    exitTime: currentTrade.exitTime,
    entryPrice: currentTrade.entryPrice,
    exitPrice: currentTrade.exitPrice,
    side: currentTrade.side
  } : undefined

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm"
        style={{ top: '64px' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none"
        style={{ top: '64px' }}
      >
        <div className="pointer-events-auto relative w-full max-w-7xl max-h-[95vh] mx-4 studio-surface rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center space-x-4">
            <div>
              <h2 className="text-xl font-semibold studio-text">{currentTrade.symbol} Trade Details</h2>
              <p className="text-sm studio-muted">
                {currentTrade.date} • {currentTrade.strategy} Strategy
              </p>
            </div>
            <div className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              currentTrade.side === 'Long'
                ? 'bg-green-900/50 text-green-300 border border-green-700/50'
                : 'bg-red-900/50 text-red-300 border border-red-700/50'
            )}>
              {currentTrade.side}
            </div>
          </div>
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={handleEditToggle}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg studio-surface studio-border text-sm studio-text hover:opacity-80 disabled:opacity-50 transition-opacity"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleEditToggle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg studio-surface studio-border text-sm studio-text hover:opacity-80 transition-opacity"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 studio-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="space-y-8">
            {/* Real Trading Chart */}
            <div className="studio-surface rounded-lg p-6">
              <h3 className="text-lg font-semibold studio-text mb-4">
                Intraday Chart - {trade.symbol}
              </h3>
              <TradingChart
                symbol={trade.symbol}
                trade={tradeData}
                className="w-full"
              />
            </div>

            {/* Overview Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold studio-text">Overview</h2>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="studio-surface rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="h-4 w-4 studio-muted" />
                    <span className="text-sm studio-muted">Net P&L</span>
                  </div>
                  <div className={cn(
                    'text-2xl font-bold',
                    netPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                  )}>
                    ${netPnL.toFixed(2)}
                  </div>
                  <div className="text-sm studio-muted">
                    {trade.pnlPercent > 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                  </div>
                </div>

                <div className="studio-surface rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 studio-muted" />
                    <span className="text-sm studio-muted">R-Multiple</span>
                  </div>
                  <div className={cn(
                    'text-2xl font-bold',
                    rMultiple >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                  )}>
                    {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(2)}R
                  </div>
                  <div className="text-sm studio-muted">
                    Risk: ${riskAmount.toFixed(2)}
                  </div>
                </div>

                <div className="studio-surface rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 studio-muted" />
                    <span className="text-sm studio-muted">Duration</span>
                  </div>
                  <div className="text-2xl font-bold studio-text">
                    {trade.duration}
                  </div>
                  <div className="text-sm studio-muted">
                    Hold time
                  </div>
                </div>

                <div className="studio-surface rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="h-4 w-4 studio-muted" />
                    <span className="text-sm studio-muted">Commission</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    ${trade.commission.toFixed(2)}
                  </div>
                  <div className="text-sm studio-muted">
                    Fees paid
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold studio-text">Execution</h2>
              </div>

              {/* Execution Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Entry Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Entry Price:</span>
                      {isEditMode ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTrade.entryPrice}
                          onChange={(e) => handleFieldChange('entryPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary text-right"
                        />
                      ) : (
                        <span className="studio-text">${currentTrade.entryPrice.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Quantity:</span>
                      {isEditMode ? (
                        <input
                          type="number"
                          value={currentTrade.quantity}
                          onChange={(e) => handleFieldChange('quantity', parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary text-right"
                        />
                      ) : (
                        <span className="studio-text">{currentTrade.quantity.toLocaleString()} shares</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="studio-muted">Entry Value:</span>
                      <span className="studio-text">${entryValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Strategy:</span>
                      {isEditMode ? (
                        <select
                          value={currentTrade.strategy}
                          onChange={(e) => handleFieldChange('strategy', e.target.value)}
                          className="w-32 px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary"
                        >
                          <option value="Momentum">Momentum</option>
                          <option value="Scalp">Scalp</option>
                          <option value="Reversal">Reversal</option>
                          <option value="Swing">Swing</option>
                          <option value="Gap Fill">Gap Fill</option>
                          <option value="Range">Range</option>
                          <option value="Breakout">Breakout</option>
                          <option value="FOMO">FOMO</option>
                          <option value="News">News</option>
                          <option value="Fade">Fade</option>
                        </select>
                      ) : (
                        <span className="studio-text">{currentTrade.strategy}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Entry Time:</span>
                      {isEditMode ? (
                        <input
                          type="datetime-local"
                          value={currentTrade.entryTime ? currentTrade.entryTime.slice(0, 16) : ''}
                          onChange={(e) => handleFieldChange('entryTime', e.target.value)}
                          className="w-[214px] px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      ) : (
                        <span className="studio-text">
                          {currentTrade.entryTime ? new Date(currentTrade.entryTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Exit Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Exit Price:</span>
                      {isEditMode ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTrade.exitPrice}
                          onChange={(e) => handleFieldChange('exitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary text-right"
                        />
                      ) : (
                        <span className="studio-text">${currentTrade.exitPrice.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="studio-muted">Quantity:</span>
                      <span className="studio-text">{currentTrade.quantity.toLocaleString()} shares</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="studio-muted">Exit Value:</span>
                      <span className="studio-text">${exitValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Commission:</span>
                      {isEditMode ? (
                        <input
                          type="number"
                          step="0.01"
                          value={currentTrade.commission}
                          onChange={(e) => handleFieldChange('commission', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary text-right"
                        />
                      ) : (
                        <span className="studio-text">${currentTrade.commission.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="studio-muted">Exit Time:</span>
                      {isEditMode ? (
                        <input
                          type="datetime-local"
                          value={currentTrade.exitTime ? currentTrade.exitTime.slice(0, 16) : ''}
                          onChange={(e) => handleFieldChange('exitTime', e.target.value)}
                          className="w-[214px] px-2 py-1 text-sm studio-text bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                      ) : (
                        <span className="studio-text">
                          {currentTrade.exitTime ? new Date(currentTrade.exitTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          }) : 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk Management */}
              <div className="studio-surface rounded-lg p-6">
                <h3 className="text-lg font-semibold studio-text mb-4">Risk Management</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm studio-muted">Position Size</div>
                    <div className="text-lg font-semibold studio-text">${entryValue.toLocaleString()}</div>
                    <div className="text-xs studio-muted mt-1">Auto-calculated</div>
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Risk Amount</div>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={currentTrade.riskAmount?.toFixed(2) ?? riskAmount.toFixed(2)}
                        onChange={(e) => handleFieldChange('riskAmount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-lg font-semibold bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary text-red-400"
                      />
                    ) : (
                      <div className="text-lg font-semibold text-red-400">${riskAmount.toFixed(2)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Risk %</div>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.1"
                        value={currentTrade.riskPercent?.toFixed(1) ?? riskPercent.toFixed(1)}
                        onChange={(e) => handleFieldChange('riskPercent', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-lg font-semibold bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary studio-text"
                      />
                    ) : (
                      <div className="text-lg font-semibold studio-text">{riskPercent.toFixed(1)}%</div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Stop Loss</div>
                    {isEditMode ? (
                      <input
                        type="number"
                        step="0.01"
                        value={currentTrade.stopLoss?.toFixed(2) ?? stopLoss.toFixed(2)}
                        onChange={(e) => handleFieldChange('stopLoss', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-lg font-semibold bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary studio-text"
                      />
                    ) : (
                      <div className="text-lg font-semibold studio-text">${stopLoss.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold studio-text">Analysis</h2>
              </div>

              {/* Performance Analysis */}
              <div className="studio-surface rounded-lg p-6">
                <h3 className="text-lg font-semibold studio-text mb-4">Performance Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm studio-muted mb-2">Profit/Loss Breakdown</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Gross P&L:</span>
                        <span className={cn(grossPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss')}>
                          ${grossPnL.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Commission:</span>
                        <span className="text-red-400">-${trade.commission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between border-t border-[#1a1a1a] pt-2">
                        <span className="text-sm font-medium">Net P&L:</span>
                        <span className={cn('font-medium', netPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss')}>
                          ${netPnL.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm studio-muted mb-2">Strategy Metrics</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Win Rate Impact:</span>
                        <span className={cn(netPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss')}>
                          {netPnL >= 0 ? '+1 Win' : '+1 Loss'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Strategy:</span>
                        <span className="studio-text">{trade.strategy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Efficiency:</span>
                        <span className="studio-text">
                          {(Math.abs(netPnL) / parseFloat(trade.duration.split(':')[0]) * 60).toFixed(0)}$/hr
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm studio-muted mb-2">Risk Assessment</div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">R-Multiple:</span>
                        <span className={cn(rMultiple >= 0 ? 'text-trading-profit' : 'text-trading-loss')}>
                          {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(2)}R
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Risk Reward:</span>
                        <span className="studio-text">1:{Math.abs(rMultiple).toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Position Size:</span>
                        <span className="studio-text">Optimal</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Notes & Review Section */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold studio-text">Notes & Review</h2>
              </div>

              {/* Trade Notes */}
              <div className="studio-surface rounded-lg p-6">
                <h3 className="text-lg font-semibold studio-text mb-4">Trade Notes</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm studio-muted">Trade Notes</label>
                    {isEditMode ? (
                      <textarea
                        value={currentTrade.notes}
                        onChange={(e) => handleFieldChange('notes', e.target.value)}
                        className="mt-2 w-full h-24 p-4 bg-[#0a0a0a] studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm studio-text"
                        placeholder="Enter trade notes..."
                      />
                    ) : (
                      <div className="mt-2 p-4 bg-[#0a0a0a] rounded-lg">
                        <p className="text-sm studio-text">{currentTrade.notes}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm studio-muted">Post-Trade Review</label>
                    <textarea
                      className="mt-2 w-full h-32 p-4 bg-[#0a0a0a] studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                      placeholder="Add your post-trade analysis, lessons learned, and insights..."
                      defaultValue={`Execution was clean with good timing on the ${trade.strategy.toLowerCase()} setup. ${netPnL >= 0 ? 'Exit was well-timed at resistance.' : 'Should have cut losses quicker.'} Market conditions were favorable for this type of trade.`}
                    />
                  </div>

                  <div>
                    <label className="text-sm studio-muted">Daily Review Link</label>
                    <div className="mt-2 flex items-center space-x-3">
                      {isEditMode ? (
                        <input
                          type="text"
                          value={currentTrade.dailyReviewId || ''}
                          onChange={(e) => handleFieldChange('dailyReviewId', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#0a0a0a] studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm studio-text"
                          placeholder="Enter daily review ID or link..."
                        />
                      ) : (
                        <>
                          {currentTrade.dailyReviewId ? (
                            <div className="flex items-center space-x-2">
                              <span className="px-3 py-2 bg-blue-900/50 text-blue-300 border border-blue-700/50 rounded-lg text-sm">
                                📝 {currentTrade.dailyReviewId}
                              </span>
                              <button className="text-blue-400 hover:text-blue-300 text-sm underline">
                                View Review
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm studio-muted italic">No daily review linked</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tags and Ratings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Trade Tags</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50">
                        <Tag className="h-3 w-3 mr-1" />
                        {trade.strategy}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-900/50 text-purple-300 border border-purple-700/50">
                        <Tag className="h-3 w-3 mr-1" />
                        {trade.side === 'Long' ? 'Bull-Setup' : 'Bear-Setup'}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-300 border border-green-700/50">
                        <Tag className="h-3 w-3 mr-1" />
                        {netPnL >= 0 ? 'Winner' : 'Loser'}
                      </span>
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-[#1a1a1a] studio-text border studio-border"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            disabled={isSavingTags}
                            className="ml-1 hover:text-red-400 disabled:opacity-50"
                            aria-label={`Remove tag ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddTag()
                          }
                        }}
                        placeholder="Add new tag..."
                        className="flex-1 p-2 bg-[#0a0a0a] studio-border rounded focus:ring-2 focus:ring-primary focus:border-primary text-sm studio-text"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        disabled={isSavingTags || !tagInput.trim()}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded bg-primary text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex-shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create
                      </button>
                    </div>
                  </div>
                </div>

                <div className="studio-surface rounded-lg p-6">
                  <h3 className="text-lg font-semibold studio-text mb-4">Trade Rating</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm studio-muted">Execution Quality</label>
                      <div className="flex items-center space-x-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-5 w-5 text-yellow-400 fill-current" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm studio-muted">Setup Quality</label>
                      <div className="flex items-center space-x-1 mt-2">
                        {[1, 2, 3, 4].map((star) => (
                          <Star key={star} className="h-5 w-5 text-yellow-400 fill-current" />
                        ))}
                        <Star className="h-5 w-5 text-gray-600" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm studio-muted">Risk Management</label>
                      <div className="flex items-center space-x-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-5 w-5 text-yellow-400 fill-current" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Round-trip breakdown for grouped (parent) trades */}
            {!isEditMode && (currentTrade as any).children?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold studio-text mb-3">
                  Round Trips ({(currentTrade as any).children.length})
                </h3>
                <div className="rounded-lg border border-[#1a1a1a] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#0a0a0a]">
                      <tr className="text-left studio-muted">
                        <th className="px-3 py-2 text-xs font-medium">Side</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">Qty</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">Entry</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">Exit</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">P&L</th>
                        <th className="px-3 py-2 text-xs font-medium text-right">Dur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#141414]">
                      {(currentTrade as any).children.map((c: any) => {
                        const t = c.entryTime?.split('T')[1]?.slice(0, 5) || ''
                        return (
                          <tr key={c.id} className="hover:bg-[#0f0f0f]">
                            <td className="px-3 py-2">
                              <span className={cn('inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                                c.side === 'Long' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400')}>{c.side}</span>
                              {t && <span className="ml-1.5 text-[10px] studio-muted">{t}</span>}
                            </td>
                            <td className="px-3 py-2 text-right studio-text">{c.quantity}</td>
                            <td className="px-3 py-2 text-right studio-text">${c.entryPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right studio-text">${c.exitPrice.toFixed(2)}</td>
                            <td className={cn('px-3 py-2 text-right font-medium', c.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>
                              {c.pnl >= 0 ? '+' : ''}${c.pnl.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right studio-muted text-xs">{c.duration || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="flex items-center space-x-4 text-sm studio-muted">
            <span>Trade ID: {currentTrade.id}</span>
            <span>•</span>
            <span>Last updated: Just now</span>
            {isEditMode && (
              <>
                <span>•</span>
                <span className="text-yellow-400">Editing Mode</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {!isEditMode ? (
              <button onClick={handleEditToggle} className="btn-ghost">
                Edit Trade
              </button>
            ) : (
              <>
                <button onClick={handleEditToggle} className="btn-ghost">
                  Cancel
                </button>
                <button onClick={handleSaveChanges} className="btn-primary">
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  )
}