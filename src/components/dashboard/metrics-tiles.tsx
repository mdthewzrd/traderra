'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercent, formatRMultiple, getPnLColor } from '@/lib/utils'
import { api, type PerformanceMetrics } from '@/lib/api'

// Default metrics for fallback
const defaultMetrics: PerformanceMetrics = {
  totalPnL: 2847.50,
  winRate: 0.524,
  expectancy: 0.82,
  profitFactor: 1.47,
  maxDrawdown: -0.15,
  totalTrades: 67,
  avgWinner: 180.25,
  avgLoser: -95.50,
}

export function MetricsTiles() {
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics>(defaultMetrics)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Load performance data on mount
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setIsLoading(true)
        const metrics = await api.getMetrics()
        setPerformanceData(metrics)
        setLastUpdated(new Date())
      } catch (error) {
        console.warn('Failed to load performance metrics:', error)
        // Keep using default metrics as fallback
      } finally {
        setIsLoading(false)
      }
    }

    loadMetrics()

    // Set up periodic refresh every 5 minutes
    const interval = setInterval(loadMetrics, 300000)
    return () => clearInterval(interval)
  }, [])

  const metrics = [
    {
      label: 'Total P&L',
      value: formatCurrency(performanceData.totalPnL),
      change: '+12.5%', // TODO: Calculate actual change from historical data
      changeType: performanceData.totalPnL >= 0 ? 'positive' as const : 'negative' as const,
      icon: DollarSign,
    },
    {
      label: 'Win Rate',
      value: formatPercent(performanceData.winRate),
      change: '+2.1%', // TODO: Calculate actual change from historical data
      changeType: 'positive' as const,
      icon: Target,
    },
    {
      label: 'Expectancy',
      value: formatRMultiple(performanceData.expectancy),
      change: '-0.08R', // TODO: Calculate actual change from historical data
      changeType: performanceData.expectancy >= 0 ? 'positive' as const : 'negative' as const,
      icon: TrendingUp,
    },
    {
      label: 'Profit Factor',
      value: performanceData.profitFactor === Infinity ? '∞' : performanceData.profitFactor.toFixed(2),
      change: '+0.12', // TODO: Calculate actual change from historical data
      changeType: performanceData.profitFactor >= 1 ? 'positive' as const : 'negative' as const,
      icon: TrendingUp,
    },
    {
      label: 'Max Drawdown',
      value: formatPercent(Math.abs(performanceData.maxDrawdown)),
      change: '+3.2%', // TODO: Calculate actual change from historical data
      changeType: 'negative' as const,
      icon: AlertTriangle,
    },
    {
      label: 'Total Trades',
      value: performanceData.totalTrades.toString(),
      change: '+8 trades', // TODO: Calculate actual change from historical data
      changeType: 'neutral' as const,
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold studio-text">Performance Metrics</h3>
        <div className="flex items-center space-x-2 text-xs studio-muted">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
          <span>
            {isLoading ? 'Updating...' : `Updated ${lastUpdated.toLocaleTimeString()}`}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <div key={metric.label} className={`metric-tile ${isLoading ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="metric-tile-label">{metric.label}</p>
                <p className="metric-tile-value studio-text">{metric.value}</p>
                <div className="flex items-center mt-1">
                  {metric.changeType === 'positive' && (
                    <TrendingUp className="h-3 w-3 text-trading-profit mr-1" />
                  )}
                  {metric.changeType === 'negative' && (
                    <TrendingDown className="h-3 w-3 text-trading-loss mr-1" />
                  )}
                  <span
                    className={`text-xs ${
                      metric.changeType === 'positive'
                        ? 'text-trading-profit'
                        : metric.changeType === 'negative'
                        ? 'text-trading-loss'
                        : 'studio-muted'
                    }`}
                  >
                    {metric.change}
                  </span>
                </div>
              </div>
              <metric.icon className="h-5 w-5 studio-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}