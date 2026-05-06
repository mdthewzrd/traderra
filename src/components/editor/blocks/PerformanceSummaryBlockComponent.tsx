'use client'

import React, { useState, useCallback } from 'react'
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Award,
  AlertTriangle,
  Edit3,
  Save,
  X,
  MoreVertical,
  Trash2,
  Copy,
  Calendar,
  Lightbulb,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { PerformanceSummaryData } from '../extensions/PerformanceSummaryBlock'
import { cn } from '@/lib/utils'

export function PerformanceSummaryBlockComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(!node.attrs.data.period.name)
  const [editData, setEditData] = useState<PerformanceSummaryData>(node.attrs.data)
  const [showMenu, setShowMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'insights'>('overview')

  const performanceData: PerformanceSummaryData = node.attrs.data

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
    setEditData(performanceData)
    setIsEditing(false)
  }, [performanceData])

  const handleDelete = useCallback(() => {
    deleteNode()
  }, [deleteNode])

  const addInsight = useCallback(() => {
    setEditData({
      ...editData,
      insights: [...(editData.insights || []), ''],
    })
  }, [editData])

  const updateInsight = useCallback((index: number, value: string) => {
    const insights = [...(editData.insights || [])]
    insights[index] = value
    setEditData({ ...editData, insights })
  }, [editData])

  const removeInsight = useCallback((index: number) => {
    const insights = [...(editData.insights || [])]
    insights.splice(index, 1)
    setEditData({ ...editData, insights })
  }, [editData])

  const addImprovement = useCallback(() => {
    setEditData({
      ...editData,
      improvements: [...(editData.improvements || []), ''],
    })
  }, [editData])

  const updateImprovement = useCallback((index: number, value: string) => {
    const improvements = [...(editData.improvements || [])]
    improvements[index] = value
    setEditData({ ...editData, improvements })
  }, [editData])

  const removeImprovement = useCallback((index: number) => {
    const improvements = [...(editData.improvements || [])]
    improvements.splice(index, 1)
    setEditData({ ...editData, improvements })
  }, [editData])

  if (isEditing) {
    return (
      <NodeViewWrapper className="performance-summary-block-wrapper">
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Performance Summary
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

          {/* Tabs */}
          <div className="flex space-x-1 border-b border-border">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'breakdown', label: 'Breakdown', icon: Target },
              { id: 'insights', label: 'Insights', icon: Lightbulb },
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
              <div className="space-y-6">
                {/* Period */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Period Name</label>
                    <input
                      type="text"
                      value={editData.period.name || ''}
                      onChange={(e) => setEditData({
                        ...editData,
                        period: { ...editData.period, name: e.target.value }
                      })}
                      placeholder="Q4 2024, Weekly Review..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Start Date</label>
                    <input
                      type="date"
                      value={editData.period.startDate}
                      onChange={(e) => setEditData({
                        ...editData,
                        period: { ...editData.period, startDate: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">End Date</label>
                    <input
                      type="date"
                      value={editData.period.endDate}
                      onChange={(e) => setEditData({
                        ...editData,
                        period: { ...editData.period, endDate: e.target.value }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Core Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Total Trades</label>
                    <input
                      type="number"
                      value={editData.metrics.totalTrades}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, totalTrades: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Winning Trades</label>
                    <input
                      type="number"
                      value={editData.metrics.winningTrades}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, winningTrades: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Win Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.winRate}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, winRate: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Total P&L</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.totalPnL}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, totalPnL: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Profit Factor</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.profitFactor}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, profitFactor: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Average Win</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.avgWin}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, avgWin: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Average Loss</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.avgLoss}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, avgLoss: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Max Drawdown</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.maxDrawdown}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, maxDrawdown: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Max Win</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.maxWin}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, maxWin: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Max Loss</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editData.metrics.maxLoss}
                      onChange={(e) => setEditData({
                        ...editData,
                        metrics: { ...editData.metrics, maxLoss: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'breakdown' && (
              <div className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Breakdown functionality coming soon</p>
                  <p className="text-sm">Performance breakdown by strategy, symbol, and timeframe</p>
                </div>
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-6">
                {/* Insights */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Key Insights</h4>
                    <button
                      onClick={addInsight}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                    >
                      <Lightbulb className="w-3 h-3" />
                      Add Insight
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editData.insights || []).map((insight, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={insight}
                          onChange={(e) => updateInsight(index, e.target.value)}
                          placeholder="Enter key insight..."
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        />
                        <button
                          onClick={() => removeInsight(index)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Improvements */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Areas for Improvement</h4>
                    <button
                      onClick={addImprovement}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                    >
                      <ArrowUp className="w-3 h-3" />
                      Add Improvement
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editData.improvements || []).map((improvement, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={improvement}
                          onChange={(e) => updateImprovement(index, e.target.value)}
                          placeholder="Enter improvement area..."
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                        />
                        <button
                          onClick={() => removeImprovement(index)}
                          className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Additional Notes</label>
                  <textarea
                    value={editData.notes || ''}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    placeholder="Any additional notes about this performance period..."
                    rows={4}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="performance-summary-block-wrapper group">
      <div className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-sm font-medium">
              <BarChart3 className="w-4 h-4" />
              Performance
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {performanceData.period.name || 'Performance Summary'}
              </h3>
              {(performanceData.period.startDate || performanceData.period.endDate) && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {performanceData.period.startDate && new Date(performanceData.period.startDate).toLocaleDateString()}
                  {performanceData.period.startDate && performanceData.period.endDate && ' - '}
                  {performanceData.period.endDate && new Date(performanceData.period.endDate).toLocaleDateString()}
                </div>
              )}
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

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Total Trades</div>
            <div className="text-lg font-semibold">{performanceData.metrics.totalTrades}</div>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
            <div className={cn(
              "text-lg font-semibold",
              performanceData.metrics.winRate >= 50 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {performanceData.metrics.winRate}%
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
            <div className={cn(
              "text-lg font-semibold",
              performanceData.metrics.totalPnL >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              ${performanceData.metrics.totalPnL.toFixed(2)}
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Profit Factor</div>
            <div className={cn(
              "text-lg font-semibold",
              performanceData.metrics.profitFactor >= 1 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {performanceData.metrics.profitFactor.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Avg Win</div>
            <div className="font-medium text-green-600 dark:text-green-400">
              ${performanceData.metrics.avgWin.toFixed(2)}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Avg Loss</div>
            <div className="font-medium text-red-600 dark:text-red-400">
              ${Math.abs(performanceData.metrics.avgLoss).toFixed(2)}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Max Drawdown</div>
            <div className="font-medium text-red-600 dark:text-red-400">
              ${performanceData.metrics.maxDrawdown.toFixed(2)}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Best Trade</div>
            <div className="font-medium text-green-600 dark:text-green-400">
              ${performanceData.metrics.maxWin.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Insights & Improvements */}
        {((performanceData.insights && performanceData.insights.length > 0) ||
          (performanceData.improvements && performanceData.improvements.length > 0)) && (
          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {performanceData.insights && performanceData.insights.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Lightbulb className="w-3 h-3" />
                    Key Insights
                  </h4>
                  <ul className="space-y-1">
                    {performanceData.insights.slice(0, 3).map((insight, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="w-1 h-1 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                        {insight}
                      </li>
                    ))}
                    {performanceData.insights.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{performanceData.insights.length - 3} more insights
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {performanceData.improvements && performanceData.improvements.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <ArrowUp className="w-3 h-3" />
                    Improvements
                  </h4>
                  <ul className="space-y-1">
                    {performanceData.improvements.slice(0, 3).map((improvement, index) => (
                      <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="w-1 h-1 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></span>
                        {improvement}
                      </li>
                    ))}
                    {performanceData.improvements.length > 3 && (
                      <li className="text-xs text-muted-foreground">
                        +{performanceData.improvements.length - 3} more areas
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}