'use client'

import { TradingChart } from './trading-chart'

interface OverviewChartProps {
  symbol?: string
  className?: string
}

export function OverviewChart({ symbol = 'AAPL', className }: OverviewChartProps) {
  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold studio-text">Market Overview</h3>
        <p className="text-sm studio-muted">15-minute candlestick chart with pre/post market data</p>
      </div>
      <TradingChart
        symbol={symbol}
        height={300}
        className="w-full"
      />
    </div>
  )
}