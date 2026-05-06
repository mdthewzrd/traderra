'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { TraderraTrade } from '@/lib/types'
import { getPnLValue } from '@/lib/utils/pnl'

// Trade distribution by hour of day
const hourlyTradeData = [
  { hour: '6:00', trades: 0, pnl: 0 },
  { hour: '7:00', trades: 8, pnl: 245 },
  { hour: '8:00', trades: 15, pnl: 380 },
  { hour: '9:00', trades: 45, pnl: 1250 },
  { hour: '10:00', trades: 25, pnl: 675 },
  { hour: '11:00', trades: 18, pnl: 420 },
  { hour: '12:00', trades: 5, pnl: 125 },
  { hour: '13:00', trades: 8, pnl: 180 },
  { hour: '14:00', trades: 12, pnl: 285 },
  { hour: '15:00', trades: 22, pnl: 510 },
  { hour: '16:00', trades: 3, pnl: -85 },
  { hour: '17:00', trades: 1, pnl: -25 },
  { hour: '18:00', trades: 0, pnl: 0 },
  { hour: '19:00', trades: 0, pnl: 0 },
  { hour: '20:00', trades: 0, pnl: 0 },
]

// Performance by hour of day
const hourlyPerformanceData = [
  { hour: '6:00', pnl: 0, avgPnl: 0 },
  { hour: '7:00', pnl: 245, avgPnl: 30.6 },
  { hour: '8:00', pnl: 380, avgPnl: 25.3 },
  { hour: '9:00', pnl: 1250, avgPnl: 27.8 },
  { hour: '10:00', pnl: 675, avgPnl: 27.0 },
  { hour: '11:00', pnl: 420, avgPnl: 23.3 },
  { hour: '12:00', pnl: 125, avgPnl: 25.0 },
  { hour: '13:00', pnl: 180, avgPnl: 22.5 },
  { hour: '14:00', pnl: 285, avgPnl: 23.8 },
  { hour: '15:00', pnl: 510, avgPnl: 23.2 },
  { hour: '16:00', pnl: -85, avgPnl: -28.3 },
  { hour: '17:00', pnl: -25, avgPnl: -25.0 },
]

// Trade distribution by month
const monthlyTradeData = [
  { month: 'Jan', trades: 45, pnl: 1250 },
  { month: 'Feb', trades: 52, pnl: 1680 },
  { month: 'Mar', trades: 38, pnl: 950 },
  { month: 'Apr', trades: 41, pnl: 1125 },
  { month: 'May', trades: 35, pnl: 875 },
  { month: 'Jun', trades: 28, pnl: 720 },
  { month: 'Jul', trades: 33, pnl: 825 },
  { month: 'Aug', trades: 15, pnl: 375 },
  { month: 'Sep', trades: 8, pnl: 180 },
  { month: 'Oct', trades: 3, pnl: 75 },
  { month: 'Nov', trades: 0, pnl: 0 },
  { month: 'Dec', trades: 0, pnl: 0 },
]

// Performance by month
const monthlyPerformanceData = [
  { month: 'Jan', pnl: 1250, lossPnl: -425 },
  { month: 'Feb', pnl: 1680, lossPnl: -320 },
  { month: 'Mar', pnl: 950, lossPnl: 0 },
  { month: 'Apr', pnl: 1125, lossPnl: 0 },
  { month: 'May', pnl: 875, lossPnl: -125 },
  { month: 'Jun', pnl: 0, lossPnl: -280 },
  { month: 'Jul', pnl: 825, lossPnl: 0 },
  { month: 'Aug', pnl: 375, lossPnl: 0 },
  { month: 'Sep', pnl: 180, lossPnl: -95 },
  { month: 'Oct', pnl: 75, lossPnl: -45 },
]

// Cumulative P&L comparison data
const cumulativePnLData = [
  { date: '2024-01', winLoss: 0, expectation: 0, liquidity: 0 },
  { date: '2024-02', winLoss: 825, expectation: 750, liquidity: 690 },
  { date: '2024-03', winLoss: 1680, expectation: 1500, liquidity: 1380 },
  { date: '2024-04', winLoss: 2630, expectation: 2250, liquidity: 2070 },
  { date: '2024-05', winLoss: 3755, expectation: 3000, liquidity: 2760 },
  { date: '2024-06', winLoss: 4630, expectation: 3750, liquidity: 3450 },
  { date: '2024-07', winLoss: 5350, expectation: 4500, liquidity: 4140 },
  { date: '2024-08', winLoss: 6180, expectation: 5250, liquidity: 4830 },
  { date: '2024-09', winLoss: 6505, expectation: 6000, liquidity: 5520 },
  { date: '2024-10', winLoss: 6825, expectation: 6750, liquidity: 6210 },
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
            <span className="ml-1">
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

interface HourlyTradeDistributionProps {
  tradesData?: TraderraTrade[]
  mode: 'gross' | 'net'
}

export function HourlyTradeDistribution({ tradesData, mode }: HourlyTradeDistributionProps) {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Trade Distribution by Hour of Day</h3>
        <div className="text-sm studio-muted">Total: 162 trades</div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={hourlyTradeData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="trades" fill="#22c55e" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface HourlyPerformanceChartProps {
  tradesData?: TraderraTrade[]
  mode: 'gross' | 'net'
}

export function HourlyPerformanceChart({ tradesData, mode }: HourlyPerformanceChartProps) {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Performance by Hour of Day</h3>
        <div className="text-sm studio-muted">Average P&L per trade</div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={hourlyPerformanceData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="hour"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="pnl"
            fill="#22c55e"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface MonthlyTradeDistributionProps {
  tradesData?: TraderraTrade[]
  mode: 'gross' | 'net'
}

export function MonthlyTradeDistribution({ tradesData, mode }: MonthlyTradeDistributionProps) {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Trade Distribution by Month of Year</h3>
        <div className="text-sm studio-muted">2024</div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={monthlyTradeData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="trades" fill="#22c55e" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface MonthlyPerformanceChartProps {
  tradesData?: TraderraTrade[]
  mode: 'gross' | 'net'
}

export function MonthlyPerformanceChart({ tradesData, mode }: MonthlyPerformanceChartProps) {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Performance by Month of Year</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-green-400"></div>
            <span className="studio-muted">Wins</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-red-400"></div>
            <span className="studio-muted">Losses</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={monthlyPerformanceData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="pnl" fill="#22c55e" radius={[2, 2, 0, 0]} />
          <Bar dataKey="lossPnl" fill="#ef4444" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CumulativePnLComparisonProps {
  tradesData?: TraderraTrade[]
  mode: 'gross' | 'net'
}

export function CumulativePnLComparison({ tradesData, mode }: CumulativePnLComparisonProps) {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">P&L Comparison</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-green-400"></div>
            <span className="studio-muted">Win/Loss</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-blue-400"></div>
            <span className="studio-muted">Expectation</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-purple-400"></div>
            <span className="studio-muted">Liquidity</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={cumulativePnLData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
            height={60}
          />
          <YAxis
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="winLoss"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#22c55e' }}
          />
          <Line
            type="monotone"
            dataKey="expectation"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />
          <Line
            type="monotone"
            dataKey="liquidity"
            stroke="#a855f7"
            strokeWidth={2}
            dot={false}
            strokeDasharray="3 3"
            activeDot={{ r: 4, fill: '#a855f7' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}