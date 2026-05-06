'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  TrendingUp,
  Settings,
  Maximize2,
  Download,
  RefreshCw,
  Calendar,
  BarChart3,
  Candlestick,
  Activity,
  Edit3,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChartConfig {
  id: string
  symbol: string
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'
  chartType: 'candlestick' | 'line' | 'area' | 'bar'
  indicators: string[]
  overlays: string[]
  theme: 'dark' | 'light'
  height?: number
  showVolume?: boolean
  showGrid?: boolean
  title?: string
  caption?: string
}

interface ChartBlockProps {
  config: ChartConfig
  editable?: boolean
  onEdit?: (config: ChartConfig) => void
  onDelete?: (id: string) => void
  className?: string
}

// Mock chart data - in a real implementation, this would come from a trading API
const generateMockChartData = (symbol: string, timeframe: string) => {
  const dataPoints = 100
  const data = []
  let price = 100 + Math.random() * 50

  for (let i = 0; i < dataPoints; i++) {
    const change = (Math.random() - 0.5) * 2
    price += change

    data.push({
      time: Date.now() - (dataPoints - i) * 60000, // 1 minute intervals
      open: price,
      high: price + Math.random() * 2,
      low: price - Math.random() * 2,
      close: price + (Math.random() - 0.5),
      volume: Math.floor(Math.random() * 1000000),
    })
  }

  return data
}

export function ChartBlock({
  config,
  editable = false,
  onEdit,
  onDelete,
  className,
}: ChartBlockProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chartData, setChartData] = useState<any[]>([])
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const {
    id,
    symbol,
    timeframe,
    chartType,
    indicators,
    overlays,
    theme,
    height = 400,
    showVolume = true,
    showGrid = true,
    title,
    caption,
  } = config

  // Load chart data
  useEffect(() => {
    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      const data = generateMockChartData(symbol, timeframe)
      setChartData(data)
      setIsLoading(false)
    }, 500)
  }, [symbol, timeframe])

  // Get timeframe display label
  const getTimeframeLabel = (tf: string) => {
    const labels: Record<string, string> = {
      '1m': '1 Minute',
      '5m': '5 Minutes',
      '15m': '15 Minutes',
      '1h': '1 Hour',
      '4h': '4 Hours',
      '1d': '1 Day',
      '1w': '1 Week',
      '1M': '1 Month',
    }
    return labels[tf] || tf
  }

  // Get chart type icon
  const getChartTypeIcon = () => {
    switch (chartType) {
      case 'candlestick':
        return Candlestick
      case 'line':
        return Activity
      case 'area':
        return TrendingUp
      case 'bar':
        return BarChart3
      default:
        return Candlestick
    }
  }

  const ChartTypeIcon = getChartTypeIcon()

  // Mock chart component (in real implementation, use TradingView widget or similar)
  const MockChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading chart data...</span>
          </div>
        </div>
      )
    }

    return (
      <div className="relative h-full bg-gradient-to-br from-background/50 to-muted/30 rounded-lg border border-dashed border-border">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <ChartTypeIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <div className="text-sm font-medium text-muted-foreground">
              {symbol} - {getTimeframeLabel(timeframe)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            </div>
            {indicators.length > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                Indicators: {indicators.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Mock price action overlay */}
        <div className="absolute inset-4">
          <svg className="w-full h-full opacity-30">
            <path
              d="M 10 80 Q 50 20 100 60 T 200 40 T 300 70 T 400 30"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              className="text-primary"
            />
          </svg>
        </div>
      </div>
    )
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => {
      const data = generateMockChartData(symbol, timeframe)
      setChartData(data)
      setIsLoading(false)
    }, 500)
  }

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleDownload = () => {
    // In a real implementation, this would capture and download the chart
    console.log('Downloading chart...')
  }

  return (
    <div className={cn(
      'studio-surface border border-studio-border rounded-lg overflow-hidden',
      'transition-all duration-200 hover:shadow-studio-lg',
      isFullscreen && 'fixed inset-4 z-50',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-studio-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ChartTypeIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {title || `${symbol} Chart`}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{getTimeframeLabel(timeframe)}</span>
              <span>•</span>
              <span>{chartType.charAt(0).toUpperCase() + chartType.slice(1)}</span>
              {indicators.length > 0 && (
                <>
                  <span>•</span>
                  <span>{indicators.length} indicator{indicators.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>

          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Download chart"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleFullscreen}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {editable && (
            <>
              <button
                onClick={() => onEdit?.(config)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="Edit chart"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => onDelete?.(id)}
                className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete chart"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        style={{ height: isFullscreen ? 'calc(100vh - 200px)' : height }}
        className="relative"
      >
        <MockChart />
      </div>

      {/* Chart Info */}
      <div className="p-4 border-t border-studio-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {showVolume && (
              <div className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Volume</span>
              </div>
            )}

            {indicators.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Indicators:</span>
                <div className="flex gap-1">
                  {indicators.map((indicator, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {caption && (
          <div className="mt-3 text-sm text-muted-foreground">
            {caption}
          </div>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </div>
  )
}