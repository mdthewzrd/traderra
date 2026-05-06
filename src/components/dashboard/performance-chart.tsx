'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Mock equity curve data
const mockEquityData = [
  { date: '2024-01-01', equity: 10000, dailyPnL: 0 },
  { date: '2024-01-02', equity: 10125, dailyPnL: 125 },
  { date: '2024-01-03', equity: 10080, dailyPnL: -45 },
  { date: '2024-01-04', equity: 10210, dailyPnL: 130 },
  { date: '2024-01-05', equity: 10195, dailyPnL: -15 },
  { date: '2024-01-08', equity: 10340, dailyPnL: 145 },
  { date: '2024-01-09', equity: 10285, dailyPnL: -55 },
  { date: '2024-01-10', equity: 10420, dailyPnL: 135 },
  { date: '2024-01-11', equity: 10380, dailyPnL: -40 },
  { date: '2024-01-12', equity: 10525, dailyPnL: 145 },
  { date: '2024-01-15', equity: 10490, dailyPnL: -35 },
  { date: '2024-01-16', equity: 10615, dailyPnL: 125 },
  { date: '2024-01-17', equity: 10580, dailyPnL: -35 },
  { date: '2024-01-18', equity: 10720, dailyPnL: 140 },
  { date: '2024-01-19', equity: 10685, dailyPnL: -35 },
  { date: '2024-01-22', equity: 10825, dailyPnL: 140 },
  { date: '2024-01-23', equity: 10780, dailyPnL: -45 },
  { date: '2024-01-24', equity: 10920, dailyPnL: 140 },
  { date: '2024-01-25', equity: 10875, dailyPnL: -45 },
  { date: '2024-01-26', equity: 11015, dailyPnL: 140 },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="studio-surface studio-border rounded-lg p-3 shadow-studio">
        <p className="text-sm studio-muted">{new Date(label).toLocaleDateString()}</p>
        <p className="text-sm studio-text">
          Equity: <span>${data.equity.toLocaleString()}</span>
        </p>
        <p className="text-sm">
          Daily P&L:
          <span className={`ml-1 ${
            data.dailyPnL >= 0 ? 'text-trading-profit' : 'text-trading-loss'
          }`}>
            {data.dailyPnL >= 0 ? '+' : ''}${data.dailyPnL}
          </span>
        </p>
      </div>
    )
  }
  return null
}

export function PerformanceChart() {
  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold studio-text">Equity Curve</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-0.5 bg-primary"></div>
            <span className="studio-muted">Equity</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={mockEquityData}
          margin={{ top: 5, right: 30, left: 20, bottom: 35 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1a1a1a"
            horizontal={true}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: '#666666', fontSize: 12 }}
            tickLine={{ stroke: '#1a1a1a' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
            dataKey="equity"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}