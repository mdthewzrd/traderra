'use client'

import { useState } from 'react'
import { X, Calendar, DollarSign, TrendingUp, TrendingDown, Clock, Target, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/contexts/TraderraContext'

interface NewTradeModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (trade: any) => void
}

export function NewTradeModal({ isOpen, onClose, onSave }: NewTradeModalProps) {
  const { isSidebarOpen: aiSidebarOpen } = useChatContext()
  const [formData, setFormData] = useState({
    symbol: '',
    side: 'Long' as 'Long' | 'Short',
    quantity: '',
    entryPrice: '',
    exitPrice: '',
    entryTime: '',
    exitTime: '',
    strategy: '',
    notes: '',
    tags: '',
    stopLoss: '',
    takeProfit: '',
    commission: '',
    riskAmount: '',
    accountSize: '50000', // Default account size
    riskPercent: '1', // Default 1% risk per trade
    riskCalculationMode: 'amount' as 'amount' | 'percent' | 'shares'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.symbol.trim()) newErrors.symbol = 'Symbol is required'
    if (!formData.quantity || Number(formData.quantity) <= 0) newErrors.quantity = 'Valid quantity is required'
    if (!formData.entryPrice || Number(formData.entryPrice) <= 0) newErrors.entryPrice = 'Valid entry price is required'
    if (!formData.exitPrice || Number(formData.exitPrice) <= 0) newErrors.exitPrice = 'Valid exit price is required'
    if (!formData.entryTime) newErrors.entryTime = 'Entry time is required'
    if (!formData.exitTime) newErrors.exitTime = 'Exit time is required'
    if (!formData.strategy.trim()) newErrors.strategy = 'Strategy is required'

    // Validate exit time is after entry time
    if (formData.entryTime && formData.exitTime && formData.exitTime <= formData.entryTime) {
      newErrors.exitTime = 'Exit time must be after entry time'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const calculateRisk = () => {
    const entryPrice = Number(formData.entryPrice) || 0
    const stopLoss = Number(formData.stopLoss) || 0
    const accountSize = Number(formData.accountSize) || 50000
    const riskPercent = Number(formData.riskPercent) || 1

    if (formData.riskCalculationMode === 'amount') {
      const riskAmount = Number(formData.riskAmount) || 0
      if (entryPrice > 0 && stopLoss > 0 && riskAmount > 0) {
        const riskPerShare = Math.abs(entryPrice - stopLoss)
        const maxShares = Math.floor(riskAmount / riskPerShare)
        return {
          calculatedShares: maxShares,
          riskAmount: riskAmount,
          riskPercent: (riskAmount / accountSize) * 100,
          riskPerShare: riskPerShare
        }
      }
    } else if (formData.riskCalculationMode === 'percent') {
      const riskAmount = (accountSize * riskPercent) / 100
      if (entryPrice > 0 && stopLoss > 0) {
        const riskPerShare = Math.abs(entryPrice - stopLoss)
        const maxShares = Math.floor(riskAmount / riskPerShare)
        return {
          calculatedShares: maxShares,
          riskAmount: riskAmount,
          riskPercent: riskPercent,
          riskPerShare: riskPerShare
        }
      }
    } else if (formData.riskCalculationMode === 'shares') {
      const quantity = Number(formData.quantity) || 0
      if (entryPrice > 0 && stopLoss > 0 && quantity > 0) {
        const riskPerShare = Math.abs(entryPrice - stopLoss)
        const totalRisk = riskPerShare * quantity
        return {
          calculatedShares: quantity,
          riskAmount: totalRisk,
          riskPercent: (totalRisk / accountSize) * 100,
          riskPerShare: riskPerShare
        }
      }
    }

    return {
      calculatedShares: 0,
      riskAmount: 0,
      riskPercent: 0,
      riskPerShare: 0
    }
  }

  const calculateMetrics = () => {
    const quantity = Number(formData.quantity) || 0
    const entryPrice = Number(formData.entryPrice) || 0
    const exitPrice = Number(formData.exitPrice) || 0
    const commission = Number(formData.commission) || 0

    const grossPnL = formData.side === 'Long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity

    const netPnL = grossPnL - commission
    const pnlPercent = entryPrice > 0 ? (grossPnL / (entryPrice * quantity)) * 100 : 0
    const positionValue = entryPrice * quantity

    const riskData = calculateRisk()
    const rMultiple = riskData.riskAmount > 0 ? netPnL / riskData.riskAmount : 0

    return {
      grossPnL,
      netPnL,
      pnlPercent,
      positionValue,
      riskData,
      rMultiple
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    const metrics = calculateMetrics()

    // Calculate duration
    const entryDateTime = new Date(formData.entryTime)
    const exitDateTime = new Date(formData.exitTime)
    const durationMs = exitDateTime.getTime() - entryDateTime.getTime()
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
    const duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`

    const newTrade = {
      id: `trade_${Date.now()}`,
      date: formData.entryTime.split('T')[0],
      symbol: formData.symbol.toUpperCase(),
      side: formData.side,
      quantity: Number(formData.quantity),
      entryPrice: Number(formData.entryPrice),
      exitPrice: Number(formData.exitPrice),
      pnl: metrics.netPnL,
      pnlPercent: metrics.pnlPercent,
      commission: Number(formData.commission) || 0,
      duration,
      strategy: formData.strategy,
      notes: formData.notes,
      stopLoss: Number(formData.stopLoss) || null,
      takeProfit: Number(formData.takeProfit) || null,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      entryTime: formData.entryTime,
      exitTime: formData.exitTime,
      createdAt: new Date().toISOString(),
      // Risk Management Data
      riskAmount: metrics.riskData.riskAmount,
      riskPercent: metrics.riskData.riskPercent,
      riskPerShare: metrics.riskData.riskPerShare,
      rMultiple: metrics.rMultiple,
      accountSize: Number(formData.accountSize),
      riskCalculationMode: formData.riskCalculationMode,
    }

    onSave(newTrade)
    onClose()

    // Reset form
    setFormData({
      symbol: '',
      side: 'Long',
      quantity: '',
      entryPrice: '',
      exitPrice: '',
      entryTime: '',
      exitTime: '',
      strategy: '',
      notes: '',
      tags: '',
      stopLoss: '',
      takeProfit: '',
      commission: '',
      riskAmount: '',
      accountSize: '50000',
      riskPercent: '1',
      riskCalculationMode: 'amount'
    })
    setErrors({})
  }

  const { grossPnL, netPnL, pnlPercent, positionValue, riskData, rMultiple } = calculateMetrics()

  const strategies = [
    'Momentum', 'Scalp', 'Reversal', 'Swing', 'Gap Fill', 'Range',
    'Breakout', 'FOMO', 'News', 'Fade', 'Support/Resistance'
  ]

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
        style={{ top: '64px', paddingRight: aiSidebarOpen ? '480px' : '0px' }}
      >
        <div className="pointer-events-auto relative w-full max-w-4xl max-h-[90vh] mx-4 studio-surface rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a1a1a]">
          <div>
            <h2 className="text-xl font-semibold studio-text">Add New Trade</h2>
            <p className="text-sm studio-muted">Enter your trade details below</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <X className="h-5 w-5 studio-muted" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="space-y-6">
            {/* Trade Basics */}
            <div>
              <h3 className="text-lg font-semibold studio-text mb-4">Trade Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Symbol *
                  </label>
                  <input
                    type="text"
                    value={formData.symbol}
                    onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary uppercase',
                      errors.symbol && 'border-red-500'
                    )}
                    placeholder="AAPL"
                  />
                  {errors.symbol && <p className="text-red-400 text-xs mt-1">{errors.symbol}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Side *
                  </label>
                  <select
                    value={formData.side}
                    onChange={(e) => handleInputChange('side', e.target.value)}
                    className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      errors.quantity && 'border-red-500'
                    )}
                    placeholder="100"
                    min="1"
                  />
                  {errors.quantity && <p className="text-red-400 text-xs mt-1">{errors.quantity}</p>}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-lg font-semibold studio-text mb-4">Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Entry Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.entryPrice}
                    onChange={(e) => handleInputChange('entryPrice', e.target.value)}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      errors.entryPrice && 'border-red-500'
                    )}
                    placeholder="150.00"
                  />
                  {errors.entryPrice && <p className="text-red-400 text-xs mt-1">{errors.entryPrice}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Exit Price *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.exitPrice}
                    onChange={(e) => handleInputChange('exitPrice', e.target.value)}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      errors.exitPrice && 'border-red-500'
                    )}
                    placeholder="155.00"
                  />
                  {errors.exitPrice && <p className="text-red-400 text-xs mt-1">{errors.exitPrice}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Stop Loss
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stopLoss}
                    onChange={(e) => handleInputChange('stopLoss', e.target.value)}
                    className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="145.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Take Profit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.takeProfit}
                    onChange={(e) => handleInputChange('takeProfit', e.target.value)}
                    className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="160.00"
                  />
                </div>
              </div>
            </div>

            {/* Risk Management */}
            <div>
              <h3 className="text-lg font-semibold studio-text mb-4">Risk Management</h3>

              {/* Risk Calculation Mode */}
              <div className="mb-4">
                <label className="block text-sm font-medium studio-text mb-2">Risk Calculation Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInputChange('riskCalculationMode', 'amount')}
                    className={cn(
                      'p-3 rounded-lg border text-sm font-medium transition-colors',
                      formData.riskCalculationMode === 'amount'
                        ? 'bg-primary text-white border-primary'
                        : 'studio-surface studio-border studio-text hover:bg-[#161616]'
                    )}
                  >
                    $ Risk Amount
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('riskCalculationMode', 'percent')}
                    className={cn(
                      'p-3 rounded-lg border text-sm font-medium transition-colors',
                      formData.riskCalculationMode === 'percent'
                        ? 'bg-primary text-white border-primary'
                        : 'studio-surface studio-border studio-text hover:bg-[#161616]'
                    )}
                  >
                    % Account Risk
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange('riskCalculationMode', 'shares')}
                    className={cn(
                      'p-3 rounded-lg border text-sm font-medium transition-colors',
                      formData.riskCalculationMode === 'shares'
                        ? 'bg-primary text-white border-primary'
                        : 'studio-surface studio-border studio-text hover:bg-[#161616]'
                    )}
                  >
                    Fixed Shares
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium studio-text mb-2">Account Size</label>
                  <input
                    type="number"
                    step="100"
                    value={formData.accountSize}
                    onChange={(e) => handleInputChange('accountSize', e.target.value)}
                    className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="50000"
                  />
                </div>

                {formData.riskCalculationMode === 'amount' && (
                  <div>
                    <label className="block text-sm font-medium studio-text mb-2">Risk Amount ($)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.riskAmount}
                      onChange={(e) => handleInputChange('riskAmount', e.target.value)}
                      className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="500"
                    />
                  </div>
                )}

                {formData.riskCalculationMode === 'percent' && (
                  <div>
                    <label className="block text-sm font-medium studio-text mb-2">Risk Percent (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={formData.riskPercent}
                      onChange={(e) => handleInputChange('riskPercent', e.target.value)}
                      className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="1.0"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    {formData.riskCalculationMode === 'shares' ? 'Share Quantity' : 'Calculated Shares'}
                  </label>
                  <input
                    type="number"
                    value={formData.riskCalculationMode === 'shares' ? formData.quantity : riskData.calculatedShares}
                    onChange={formData.riskCalculationMode === 'shares' ? (e) => handleInputChange('quantity', e.target.value) : undefined}
                    readOnly={formData.riskCalculationMode !== 'shares'}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      formData.riskCalculationMode !== 'shares' && 'bg-[#1a1a1a] text-gray-400'
                    )}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">Risk per Share</label>
                  <input
                    type="number"
                    step="0.01"
                    value={riskData.riskPerShare.toFixed(2)}
                    readOnly
                    className="w-full p-3 bg-[#1a1a1a] studio-border rounded-lg text-gray-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Risk Summary */}
              {(formData.entryPrice && formData.stopLoss && (formData.riskAmount || formData.riskPercent)) && (
                <div className="mt-4 p-4 studio-surface rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm studio-muted">Total Risk</div>
                      <div className="text-lg font-semibold text-amber-400">${riskData.riskAmount.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm studio-muted">Risk %</div>
                      <div className="text-lg font-semibold text-amber-400">{riskData.riskPercent.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div className="text-sm studio-muted">Max Shares</div>
                      <div className="text-lg font-semibold text-amber-400">{riskData.calculatedShares}</div>
                    </div>
                    <div>
                      <div className="text-sm studio-muted">Risk/Share</div>
                      <div className="text-lg font-semibold text-amber-400">${riskData.riskPerShare.toFixed(2)}</div>
                    </div>
                  </div>
                  {formData.riskCalculationMode !== 'shares' && (
                    <button
                      type="button"
                      onClick={() => handleInputChange('quantity', riskData.calculatedShares.toString())}
                      className="mt-2 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      Use calculated shares ({riskData.calculatedShares})
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Timing */}
            <div>
              <h3 className="text-lg font-semibold studio-text mb-4">Timing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Entry Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.entryTime}
                    onChange={(e) => handleInputChange('entryTime', e.target.value)}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      errors.entryTime && 'border-red-500'
                    )}
                  />
                  {errors.entryTime && <p className="text-red-400 text-xs mt-1">{errors.entryTime}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Exit Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.exitTime}
                    onChange={(e) => handleInputChange('exitTime', e.target.value)}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      errors.exitTime && 'border-red-500'
                    )}
                  />
                  {errors.exitTime && <p className="text-red-400 text-xs mt-1">{errors.exitTime}</p>}
                </div>
              </div>
            </div>

            {/* Strategy & Notes */}
            <div>
              <h3 className="text-lg font-semibold studio-text mb-4">Strategy & Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Strategy *
                  </label>
                  <select
                    value={formData.strategy}
                    onChange={(e) => handleInputChange('strategy', e.target.value)}
                    className={cn(
                      'w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary',
                      errors.strategy && 'border-red-500'
                    )}
                  >
                    <option value="">Select Strategy</option>
                    {strategies.map(strategy => (
                      <option key={strategy} value={strategy}>{strategy}</option>
                    ))}
                  </select>
                  {errors.strategy && <p className="text-red-400 text-xs mt-1">{errors.strategy}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium studio-text mb-2">
                    Commission
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.commission}
                    onChange={(e) => handleInputChange('commission', e.target.value)}
                    className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="0.50"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium studio-text mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="earnings, gap-up, momentum"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium studio-text mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                  className="w-full p-3 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  placeholder="Trade reasoning, setup details, market conditions..."
                />
              </div>
            </div>

            {/* Live Metrics Preview */}
            {(formData.quantity && formData.entryPrice && formData.exitPrice) && (
              <div className="studio-surface rounded-lg p-4">
                <h3 className="text-lg font-semibold studio-text mb-4">Trade Preview</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <div className="text-sm studio-muted">Position Value</div>
                    <div className="text-lg font-semibold studio-text">${positionValue.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Gross P&L</div>
                    <div className={cn(
                      'text-lg font-semibold',
                      grossPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    )}>
                      ${grossPnL.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Net P&L</div>
                    <div className={cn(
                      'text-lg font-semibold',
                      netPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    )}>
                      ${netPnL.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Return %</div>
                    <div className={cn(
                      'text-lg font-semibold',
                      pnlPercent >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    )}>
                      {pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm studio-muted">R-Multiple</div>
                    <div className={cn(
                      'text-lg font-semibold',
                      rMultiple >= 0 ? 'text-trading-profit' : 'text-trading-loss'
                    )}>
                      {rMultiple > 0 ? '+' : ''}{rMultiple.toFixed(2)}R
                    </div>
                  </div>
                  <div>
                    <div className="text-sm studio-muted">Risk Amount</div>
                    <div className="text-lg font-semibold text-amber-400">
                      ${riskData.riskAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
                {rMultiple !== 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="text-sm studio-text">
                      <strong>Risk Analysis:</strong> This trade risked ${riskData.riskAmount.toFixed(2)} ({riskData.riskPercent.toFixed(2)}% of account)
                      {rMultiple > 0 ? ` and made ${rMultiple.toFixed(2)} times the risk` : ` and lost ${Math.abs(rMultiple).toFixed(2)} times the risk`}.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="text-sm studio-muted">
            * Required fields
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="btn-primary"
            >
              Add Trade
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}