'use client'

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Target, Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// Comprehensive trading statistics data
const tradingMetrics = {
  overview: {
    totalTrades: 298,
    winningTrades: 204,
    losingTrades: 94,
    winRate: 68.4,
    profitFactor: 1.85,
    avgWinningTrade: 145.20,
    avgLosingTrade: -78.50,
    largestWin: 1636.60,
    largestLoss: -94.90,
    totalPnL: 6825.00,
    totalCommission: 95.50,
    netPnL: 6729.50
  },
  timeAnalysis: {
    avgHoldTime: '1h 23m',
    shortestHold: '11s',
    longestHold: '3h 51m',
    bestTradingHour: '9:00 AM',
    worstTradingHour: '4:00 PM',
    bestTradingDay: 'Wednesday',
    worstTradingDay: 'Monday'
  },
  riskMetrics: {
    maxDrawdown: -285.50,
    maxDrawdownPercent: -2.8,
    sharpeRatio: 1.45,
    sortino: 1.78,
    calmarRatio: 4.2,
    recoveryFactor: 23.9,
    profitToDrawdownRatio: 23.9
  }
}

// Monthly P&L breakdown
const monthlyPnLData = [
  { month: 'Jan', pnl: 825, drawdown: -125, trades: 45 },
  { month: 'Feb', pnl: 1360, drawdown: -85, trades: 52 },
  { month: 'Mar', pnl: 950, drawdown: 0, trades: 38 },
  { month: 'Apr', pnl: 1125, drawdown: 0, trades: 41 },
  { month: 'May', pnl: 750, drawdown: -125, trades: 35 },
  { month: 'Jun', pnl: -280, drawdown: -280, trades: 28 },
  { month: 'Jul', pnl: 825, drawdown: 0, trades: 33 },
  { month: 'Aug', pnl: 375, drawdown: 0, trades: 15 },
  { month: 'Sep', pnl: 85, drawdown: -95, trades: 8 },
  { month: 'Oct', pnl: 30, drawdown: -45, trades: 3 },
]

// Trade size distribution
const tradeSizeData = [
  { range: '$0-500', count: 42, percentage: 14.1 },
  { range: '$500-1K', count: 68, percentage: 22.8 },
  { range: '$1K-2.5K', count: 89, percentage: 29.9 },
  { range: '$2.5K-5K', count: 54, percentage: 18.1 },
  { range: '$5K-10K', count: 32, percentage: 10.7 },
  { range: '$10K+', count: 13, percentage: 4.4 },
]

// Strategy performance breakdown
const strategyData = [
  { name: 'Momentum', trades: 89, winRate: 71.9, avgPnL: 27.85, totalPnL: 2479, color: '#22c55e' },
  { name: 'Breakout', trades: 67, winRate: 64.2, avgPnL: 23.45, totalPnL: 1571, color: '#3b82f6' },
  { name: 'Reversal', trades: 45, winRate: 55.6, avgPnL: 15.20, totalPnL: 684, color: '#a855f7' },
  { name: 'Scalp', trades: 52, winRate: 59.6, avgPnL: 12.85, totalPnL: 668, color: '#f59e0b' },
  { name: 'Swing', trades: 28, winRate: 75.0, avgPnL: 45.20, totalPnL: 1266, color: '#ef4444' },
  { name: 'News', trades: 17, winRate: 82.4, avgPnL: 35.50, totalPnL: 604, color: '#06b6d4' },
]

// Risk distribution
const riskDistributionData = [
  { range: '0-0.5%', count: 125, percentage: 41.9 },
  { range: '0.5-1%', count: 89, percentage: 29.9 },
  { range: '1-1.5%', count: 54, percentage: 18.1 },
  { range: '1.5-2%', count: 23, percentage: 7.7 },
  { range: '2%+', count: 7, percentage: 2.3 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="studio-surface studio-border rounded-lg p-3 shadow-studio">
        <p className="text-sm studio-muted mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className=" ml-1">
              {entry.name.includes('P&L') || entry.name.includes('pnl')
                ? `$${entry.value.toLocaleString()}`
                : entry.value.toLocaleString()
              }
            </span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function TradingOverviewStats() {
  const { overview } = tradingMetrics

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0.5">
      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Total Trades</div>
          <Target className="h-4 w-4 studio-muted" />
        </div>
        <div className="text-2xl font-bold studio-text">{overview.totalTrades}</div>
        <div className="text-xs text-trading-profit">+15 this month</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Win Rate</div>
          <TrendingUp className="h-4 w-4 text-trading-profit" />
        </div>
        <div className="text-2xl font-bold studio-text">{overview.winRate}%</div>
        <div className="text-xs text-trading-profit">+2.3% from last month</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Total P&L</div>
          <DollarSign className="h-4 w-4 text-trading-profit" />
        </div>
        <div className="text-2xl font-bold text-trading-profit ">
          ${overview.totalPnL.toLocaleString()}
        </div>
        <div className="text-xs text-trading-profit">+${overview.netPnL.toLocaleString()} net</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Profit Factor</div>
          <TrendingUp className="h-4 w-4 text-trading-profit" />
        </div>
        <div className="text-2xl font-bold studio-text">{overview.profitFactor}</div>
        <div className="text-xs studio-muted">Above 1.5 target</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Avg Winner</div>
          <TrendingUp className="h-4 w-4 text-trading-profit" />
        </div>
        <div className="text-2xl font-bold text-trading-profit ">
          ${overview.avgWinningTrade}
        </div>
        <div className="text-xs studio-muted">{overview.winningTrades} winning trades</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Avg Loser</div>
          <TrendingDown className="h-4 w-4 text-trading-loss" />
        </div>
        <div className="text-2xl font-bold text-trading-loss ">
          ${overview.avgLosingTrade}
        </div>
        <div className="text-xs studio-muted">{overview.losingTrades} losing trades</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Largest Win</div>
          <TrendingUp className="h-4 w-4 text-trading-profit" />
        </div>
        <div className="text-2xl font-bold text-trading-profit ">
          ${overview.largestWin}
        </div>
        <div className="text-xs studio-muted">Best single trade</div>
      </div>

      <div className="studio-surface rounded-lg p-2 sm:p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm studio-muted">Max Drawdown</div>
          <TrendingDown className="h-4 w-4 text-trading-loss" />
        </div>
        <div className="text-2xl font-bold text-trading-loss ">
          ${tradingMetrics.riskMetrics.maxDrawdown}
        </div>
        <div className="text-xs studio-muted">{tradingMetrics.riskMetrics.maxDrawdownPercent}% of equity</div>
      </div>
    </div>
  )
}

export function MonthlyPnLBreakdown() {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Monthly P&L Breakdown</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-green-400"></div>
            <span className="studio-muted">Profit</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-red-400"></div>
            <span className="studio-muted">Drawdown</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthlyPnLData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="pnl" fill="#22c55e" radius={[2, 2, 0, 0]} />
          <Bar dataKey="drawdown" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StrategyPerformanceBreakdown() {
  return (
    <div className="studio-surface rounded-lg p-6">
      <h3 className="text-lg font-semibold studio-text mb-4">Strategy Performance</h3>
      <div className="space-y-4">
        {strategyData.map((strategy, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
            <div className="flex items-center space-x-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: strategy.color }}
              />
              <div>
                <div className="text-sm font-medium studio-text">{strategy.name}</div>
                <div className="text-xs studio-muted">{strategy.trades} trades</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-trading-profit ">
                ${strategy.totalPnL}
              </div>
              <div className="text-xs studio-muted">
                {strategy.winRate}% win rate
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm  studio-text">
                ${strategy.avgPnL}
              </div>
              <div className="text-xs studio-muted">avg P&L</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TradeSizeDistribution() {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Trade Size Distribution</h3>
        <div className="text-sm studio-muted">298 total trades</div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={tradeSizeData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="range"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function RiskMetrics() {
  const { riskMetrics, timeAnalysis } = tradingMetrics

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Risk Metrics */}
      <div className="studio-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold studio-text mb-4">Risk Metrics</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Sharpe Ratio</span>
            <span className="text-sm font-bold studio-text">{riskMetrics.sharpeRatio}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Sortino Ratio</span>
            <span className="text-sm font-bold studio-text">{riskMetrics.sortino}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Calmar Ratio</span>
            <span className="text-sm font-bold studio-text">{riskMetrics.calmarRatio}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Recovery Factor</span>
            <span className="text-sm font-bold studio-text">{riskMetrics.recoveryFactor}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">P&L to Drawdown</span>
            <span className="text-sm font-bold studio-text">{riskMetrics.profitToDrawdownRatio}</span>
          </div>
        </div>
      </div>

      {/* Time Analysis */}
      <div className="studio-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold studio-text mb-4">Time Analysis</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Average Hold Time</span>
            <span className="text-sm font-bold studio-text">{timeAnalysis.avgHoldTime}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Shortest Hold</span>
            <span className="text-sm font-bold studio-text">{timeAnalysis.shortestHold}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Longest Hold</span>
            <span className="text-sm font-bold studio-text">{timeAnalysis.longestHold}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Best Trading Hour</span>
            <span className="text-sm font-bold text-trading-profit">{timeAnalysis.bestTradingHour}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm studio-muted">Best Trading Day</span>
            <span className="text-sm font-bold text-trading-profit">{timeAnalysis.bestTradingDay}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RiskDistribution() {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Risk per Trade Distribution</h3>
        <div className="text-sm studio-muted">% of portfolio risked</div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={riskDistributionData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            dataKey="count"
            label={({ range, percentage }) => `${range}: ${percentage}%`}
          >
            {riskDistributionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'][index]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: any) => [`${value} trades`, 'Count']}
            contentStyle={{
              backgroundColor: '#111111',
              border: '1px solid #1a1a1a',
              borderRadius: '8px',
              color: '#e5e5e5'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}