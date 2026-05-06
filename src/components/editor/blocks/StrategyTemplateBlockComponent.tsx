'use client'

import React, { useState, useCallback } from 'react'
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import {
  Target,
  TrendingUp,
  Shield,
  BookOpen,
  Edit3,
  Save,
  X,
  MoreVertical,
  Trash2,
  Copy,
  Plus,
  Minus,
  Award,
  Clock,
  BarChart3,
} from 'lucide-react'
import { StrategyTemplateData, STRATEGY_TEMPLATES } from '../extensions/StrategyTemplateBlock'
import { cn } from '@/lib/utils'

export function StrategyTemplateBlockComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(!node.attrs.data.name)
  const [editData, setEditData] = useState<StrategyTemplateData>(node.attrs.data)
  const [showMenu, setShowMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'risk' | 'backtest'>('overview')

  const strategyData: StrategyTemplateData = node.attrs.data

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
    setEditData(strategyData)
    setIsEditing(false)
  }, [strategyData])

  const handleDelete = useCallback(() => {
    deleteNode()
  }, [deleteNode])

  const loadTemplate = useCallback((templateKey: keyof typeof STRATEGY_TEMPLATES) => {
    const template = STRATEGY_TEMPLATES[templateKey]
    setEditData({ ...editData, ...template })
  }, [editData])

  const addRule = useCallback((type: 'entryRules' | 'exitRules') => {
    setEditData({
      ...editData,
      [type]: [...editData[type], ''],
    })
  }, [editData])

  const updateRule = useCallback((type: 'entryRules' | 'exitRules', index: number, value: string) => {
    const rules = [...editData[type]]
    rules[index] = value
    setEditData({
      ...editData,
      [type]: rules,
    })
  }, [editData])

  const removeRule = useCallback((type: 'entryRules' | 'exitRules', index: number) => {
    const rules = [...editData[type]]
    rules.splice(index, 1)
    setEditData({
      ...editData,
      [type]: rules,
    })
  }, [editData])

  if (isEditing) {
    return (
      <NodeViewWrapper className="strategy-template-block-wrapper">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Strategy Template
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

          {/* Template Loader */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Load Pre-built Template</h4>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STRATEGY_TEMPLATES).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => loadTemplate(key as keyof typeof STRATEGY_TEMPLATES)}
                  className="px-3 py-1.5 bg-background border border-border rounded-md hover:bg-accent text-sm"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 border-b border-border">
            {[
              { id: 'overview', label: 'Overview', icon: BookOpen },
              { id: 'rules', label: 'Rules', icon: Target },
              { id: 'risk', label: 'Risk Management', icon: Shield },
              { id: 'backtest', label: 'Backtest', icon: BarChart3 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
                  activeTab === id
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Strategy Name</label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      placeholder="My Trading Strategy"
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Timeframe</label>
                    <input
                      type="text"
                      value={editData.timeframe}
                      onChange={(e) => setEditData({ ...editData, timeframe: e.target.value })}
                      placeholder="4H, Daily"
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    placeholder="Describe your trading strategy..."
                    rows={3}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Markets</label>
                  <input
                    type="text"
                    value={editData.markets.join(', ')}
                    onChange={(e) => setEditData({ ...editData, markets: e.target.value.split(',').map(m => m.trim()).filter(Boolean) })}
                    placeholder="Forex, Stocks, Crypto"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Indicators</label>
                  <input
                    type="text"
                    value={editData.indicators.join(', ')}
                    onChange={(e) => setEditData({ ...editData, indicators: e.target.value.split(',').map(i => i.trim()).filter(Boolean) })}
                    placeholder="RSI, MACD, Moving Averages"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}

            {activeTab === 'rules' && (
              <div className="space-y-6">
                {/* Entry Rules */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Entry Rules</h4>
                    <button
                      onClick={() => addRule('entryRules')}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                    >
                      <Plus className="w-3 h-3" />
                      Add Rule
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editData.entryRules.map((rule, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={rule}
                          onChange={(e) => updateRule('entryRules', index, e.target.value)}
                          placeholder="Enter entry rule..."
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        />
                        <button
                          onClick={() => removeRule('entryRules', index)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exit Rules */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Exit Rules</h4>
                    <button
                      onClick={() => addRule('exitRules')}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                    >
                      <Plus className="w-3 h-3" />
                      Add Rule
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editData.exitRules.map((rule, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={rule}
                          onChange={(e) => updateRule('exitRules', index, e.target.value)}
                          placeholder="Enter exit rule..."
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        />
                        <button
                          onClick={() => removeRule('exitRules', index)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'risk' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Stop Loss</label>
                  <input
                    type="text"
                    value={editData.riskManagement.stopLoss}
                    onChange={(e) => setEditData({
                      ...editData,
                      riskManagement: { ...editData.riskManagement, stopLoss: e.target.value }
                    })}
                    placeholder="2x ATR below entry"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Take Profit</label>
                  <input
                    type="text"
                    value={editData.riskManagement.takeProfit}
                    onChange={(e) => setEditData({
                      ...editData,
                      riskManagement: { ...editData.riskManagement, takeProfit: e.target.value }
                    })}
                    placeholder="3x risk ratio"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Position Size</label>
                  <input
                    type="text"
                    value={editData.riskManagement.positionSize}
                    onChange={(e) => setEditData({
                      ...editData,
                      riskManagement: { ...editData.riskManagement, positionSize: e.target.value }
                    })}
                    placeholder="1% account risk per trade"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Max Risk</label>
                  <input
                    type="text"
                    value={editData.riskManagement.maxRisk}
                    onChange={(e) => setEditData({
                      ...editData,
                      riskManagement: { ...editData.riskManagement, maxRisk: e.target.value }
                    })}
                    placeholder="5% total portfolio risk"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}

            {activeTab === 'backtest' && (
              <div className="space-y-4">
                {editData.backtestResults ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-sm text-muted-foreground">Win Rate</div>
                      <div className="text-lg font-semibold">{editData.backtestResults.winRate}%</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-sm text-muted-foreground">Profit Factor</div>
                      <div className="text-lg font-semibold">{editData.backtestResults.profitFactor}</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-sm text-muted-foreground">Total Trades</div>
                      <div className="text-lg font-semibold">{editData.backtestResults.totalTrades}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No backtest results yet</p>
                    <p className="text-sm">Add your backtesting data to track strategy performance</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2 border-t border-border pt-4">
            <label className="text-sm font-medium text-foreground">Additional Notes</label>
            <textarea
              value={editData.notes || ''}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              placeholder="Any additional notes about this strategy..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="strategy-template-block-wrapper group">
      <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-medium">
              <Target className="w-4 h-4" />
              Strategy
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {strategyData.name || 'Strategy Template'}
            </h3>
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
                  onClick={() => { setShowMenu(false) }}
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

        {/* Strategy Info */}
        <div className="space-y-4">
          {strategyData.description && (
            <p className="text-sm text-muted-foreground">{strategyData.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategyData.timeframe && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{strategyData.timeframe}</span>
              </div>
            )}

            {strategyData.markets.length > 0 && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{strategyData.markets.join(', ')}</span>
              </div>
            )}

            {strategyData.backtestResults && (
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{strategyData.backtestResults.winRate}% Win Rate</span>
              </div>
            )}
          </div>

          {/* Rules Preview */}
          {(strategyData.entryRules.length > 0 || strategyData.exitRules.length > 0) && (
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {strategyData.entryRules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Target className="w-3 h-3" />
                      Entry Rules
                    </h4>
                    <ul className="space-y-1">
                      {strategyData.entryRules.slice(0, 3).map((rule, index) => (
                        <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="w-1 h-1 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                          {rule}
                        </li>
                      ))}
                      {strategyData.entryRules.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          +{strategyData.entryRules.length - 3} more rules
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {strategyData.exitRules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      Exit Rules
                    </h4>
                    <ul className="space-y-1">
                      {strategyData.exitRules.slice(0, 3).map((rule, index) => (
                        <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="w-1 h-1 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                          {rule}
                        </li>
                      ))}
                      {strategyData.exitRules.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          +{strategyData.exitRules.length - 3} more rules
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  )
}