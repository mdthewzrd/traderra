/**
 * Enhanced Trading Chart Component
 *
 * Extended version of the trading chart that supports multiple execution arrows
 * and enhanced visualization for DOS Trader-Tradervue integrated data.
 */

'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { isWeekend, subDays, format, addHours } from 'date-fns'
import { EnhancedTrade, TradeExecution, EnhancedChartConfig } from '@/types/enhanced-trade'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm studio-muted">Loading enhanced chart...</div>
      </div>
    </div>
  )
})

interface EnhancedTradingChartProps {
  symbol: string
  trade?: EnhancedTrade
  className?: string
  height?: number
  timeframe?: '2m' | '5m' | '15m' | '1h' | '1d'
  config?: Partial<EnhancedChartConfig>
}

interface CandlestickData {
  x: string[]
  open: number[]
  high: number[]
  low: number[]
  close: number[]
}

interface ExecutionArrow {
  id: string
  time: string
  price: number
  type: 'entry' | 'exit'
  side: 'Long' | 'Short'
  execution: TradeExecution
  size: 'small' | 'medium' | 'large'
  color: string
  label: string
  venue?: string
}

const POLYGON_API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY || '4r6MZNWLy2ucmhVI7fY8MrvXfXTSmxpy'

const DEFAULT_CHART_CONFIG: EnhancedChartConfig = {
  showAllExecutions: true,
  groupExecutionsByTime: false,
  executionGroupingWindow: 5, // 5 minutes
  arrowSizing: 'proportional',
  colorScheme: 'side',
  displayLabels: true,
  showExecutionStats: true
}

export function EnhancedTradingChart({
  symbol,
  trade,
  className,
  height = 800,
  timeframe = '15m',
  config = {}
}: EnhancedTradingChartProps) {
  const chartConfig = { ...DEFAULT_CHART_CONFIG, ...config }

  console.log(`🎯 EnhancedTradingChart rendered for ${symbol}`, {
    trade: trade ? 'YES' : 'NO',
    timeframe,
    executionCount: trade ? trade.executions.entries.length + trade.executions.exits.length : 0
  })

  const [candlestickData, setCandlestickData] = useState<CandlestickData>({
    x: [],
    open: [],
    high: [],
    low: [],
    close: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customArrows, setCustomArrows] = useState<ExecutionArrow[]>([])
  const [isAddingArrow, setIsAddingArrow] = useState(false)
  const [selectedExecution, setSelectedExecution] = useState<TradeExecution | null>(null)
  const [showExecutionPanel, setShowExecutionPanel] = useState(false)

  // Process execution arrows from enhanced trade data
  const executionArrows = useMemo(() => {
    if (!trade) return []

    const arrows: ExecutionArrow[] = []

    // Process entry executions
    trade.executions.entries.forEach((exec, index) => {
      arrows.push({
        id: `entry_${exec.executionId}`,
        time: exec.timestamp,
        price: exec.price,
        type: 'entry',
        side: trade.side,
        execution: exec,
        size: chartConfig.arrowSizing === 'proportional'
          ? exec.quantity > 1000 ? 'large' : exec.quantity > 500 ? 'medium' : 'small'
          : 'medium',
        color: getExecutionColor(exec, 'entry', chartConfig.colorScheme),
        label: `Entry: ${exec.quantity}@$${exec.price.toFixed(2)} (${exec.venue})`,
        venue: exec.venue
      })
    })

    // Process exit executions
    trade.executions.exits.forEach((exec, index) => {
      const isProfitable = trade.side === 'Long'
        ? exec.price > trade.entryPrice
        : exec.price < trade.entryPrice

      arrows.push({
        id: `exit_${exec.executionId}`,
        time: exec.timestamp,
        price: exec.price,
        type: 'exit',
        side: trade.side,
        execution: exec,
        size: chartConfig.arrowSizing === 'proportional'
          ? exec.quantity > 1000 ? 'large' : exec.quantity > 500 ? 'medium' : 'small'
          : 'medium',
        color: getExecutionColor(exec, 'exit', chartConfig.colorScheme, isProfitable),
        label: `Exit: ${exec.quantity}@$${exec.price.toFixed(2)} (${exec.venue})`,
        venue: exec.venue
      })
    })

    // Group executions if enabled
    if (chartConfig.groupExecutionsByTime) {
      return groupExecutionsByTime(arrows, chartConfig.executionGroupingWindow)
    }

    return arrows
  }, [trade, chartConfig])

  // Timeframe configuration (same as original)
  const getTimeframeConfig = (timeframe: string) => {
    const configs = {
      '2m': {
        multiplier: 2,
        timespan: 'minute',
        daysBefore: trade ? 1 : 0,
        daysAfter: trade ? 0 : 0,
        label: '2m'
      },
      '5m': {
        multiplier: 5,
        timespan: 'minute',
        daysBefore: trade ? 2 : 1,
        daysAfter: trade ? 1 : 0,
        label: '5m'
      },
      '15m': {
        multiplier: 15,
        timespan: 'minute',
        daysBefore: trade ? 5 : 5,
        daysAfter: trade ? 3 : 0,
        label: '15m'
      },
      '1h': {
        multiplier: 1,
        timespan: 'hour',
        daysBefore: trade ? 14 : 14,
        daysAfter: trade ? 5 : 0,
        label: '1h'
      },
      '1d': {
        multiplier: 1,
        timespan: 'day',
        daysBefore: trade ? 60 : 60,
        daysAfter: trade ? 14 : 0,
        label: '1d'
      }
    }
    return configs[timeframe as keyof typeof configs] || configs['15m']
  }

  // Load chart data (similar to original but with enhanced error handling)
  const loadChartData = async () => {
    if (!symbol) return

    try {
      setIsLoading(true)
      setError(null)

      const config = getTimeframeConfig(timeframe)
      let fromDate: string
      let toDate: string

      if (trade) {
        // Use trade timeframe
        const entryDate = new Date(trade.entryTime)
        const exitDate = new Date(trade.exitTime)

        fromDate = format(entryDate, 'yyyy-MM-dd')
        toDate = format(exitDate, 'yyyy-MM-dd')

        console.log(`📊 Loading enhanced chart for trade period: ${fromDate} to ${toDate}`)
      } else {
        // Default range
        const now = new Date()
        const start = subDays(now, config.daysBefore)
        fromDate = format(start, 'yyyy-MM-dd')
        toDate = format(now, 'yyyy-MM-dd')
      }

      // Fetch candlestick data (reuse existing logic)
      await fetchCandlestickData(symbol, fromDate, toDate)

    } catch (error) {
      console.error('Error loading enhanced chart data:', error)
      setError('Failed to load chart data')
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch candlestick data (similar to original)
  const fetchCandlestickData = async (symbol: string, from: string, to: string) => {
    try {
      const config = getTimeframeConfig(timeframe)
      const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${config.multiplier}/${config.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apikey=${POLYGON_API_KEY}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error('No data available')
      }

      const x: string[] = []
      const open: number[] = []
      const high: number[] = []
      const low: number[] = []
      const close: number[] = []

      data.results.forEach((bar: any) => {
        const barTime = new Date(bar.t)
        x.push(barTime.toISOString())
        open.push(bar.o)
        high.push(bar.h)
        low.push(bar.l)
        close.push(bar.c)
      })

      setCandlestickData({ x, open, high, low, close })

    } catch (error) {
      console.warn('API failed, generating mock data for enhanced chart')
      const mockData = generateMockData(symbol, from, to)
      setCandlestickData(mockData)
    }
  }

  // Generate mock data (simplified version)
  const generateMockData = (symbol: string, from: string, to: string): CandlestickData => {
    const basePrices: Record<string, number> = {
      'AAPL': 246,
      'TSLA': 434,
      'NVDA': 417,
      'QQQ': 485,
      'SPY': 425
    }

    const basePrice = basePrices[symbol] || 100
    const x: string[] = []
    const open: number[] = []
    const high: number[] = []
    const low: number[] = []
    const close: number[] = []

    const startDate = new Date(from + 'T09:30:00')
    const endDate = new Date(to + 'T16:00:00')
    const config = getTimeframeConfig(timeframe)

    let currentPrice = basePrice
    const current = new Date(startDate)

    while (current <= endDate) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        const hour = current.getHours()
        if (hour >= 9 && hour < 16) {
          const openPrice = currentPrice
          const change = (Math.random() - 0.5) * 0.005 * currentPrice
          const closePrice = openPrice + change

          x.push(current.toISOString())
          open.push(openPrice)
          high.push(Math.max(openPrice, closePrice) + Math.random() * 0.002 * currentPrice)
          low.push(Math.min(openPrice, closePrice) - Math.random() * 0.002 * currentPrice)
          close.push(closePrice)

          currentPrice = closePrice
        }
      }
      current.setMinutes(current.getMinutes() + config.multiplier)
    }

    return { x, open, high, low, close }
  }

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadChartData()
  }, [symbol, trade, timeframe])

  // Create execution annotations
  const createExecutionAnnotations = () => {
    const annotations: any[] = []

    if (!chartConfig.showAllExecutions) return annotations

    executionArrows.forEach(arrow => {
      const closestIndex = findClosestIndex(arrow.time)
      if (closestIndex >= 0 && closestIndex < candlestickData.x.length) {
        const xPos = candlestickData.x[closestIndex]
        const yPos = arrow.price

        // Create the execution arrow
        const arrowSymbol = getArrowSymbol(arrow)
        const arrowSize = getArrowSize(arrow.size)

        // Black border (shadow)
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y',
          text: arrowSymbol,
          font: {
            size: arrowSize + 4,
            color: '#000000',
            family: 'Arial Black, sans-serif'
          },
          showarrow: false,
          hovertext: arrow.label,
          clicktoshow: false,
          captureevents: true
        })

        // Colored arrow
        annotations.push({
          x: xPos,
          y: yPos,
          xref: 'x',
          yref: 'y',
          text: arrowSymbol,
          font: {
            size: arrowSize,
            color: arrow.color,
            family: 'Arial Black, sans-serif'
          },
          showarrow: false,
          hovertext: arrow.label,
          clicktoshow: false,
          captureevents: true
        })

        // Add execution label if enabled
        if (chartConfig.displayLabels) {
          annotations.push({
            x: xPos,
            y: yPos + (arrow.type === 'entry' ? -1 : 1),
            xref: 'x',
            yref: 'y',
            text: `${arrow.execution.quantity}@${arrow.execution.venue}`,
            font: {
              size: 10,
              color: arrow.color,
              family: 'monospace'
            },
            showarrow: false,
            bgcolor: 'rgba(0,0,0,0.7)',
            bordercolor: arrow.color,
            borderwidth: 1
          })
        }
      }
    })

    return annotations
  }

  // Find closest data point index
  const findClosestIndex = (targetTime: string) => {
    if (candlestickData.x.length === 0) return 0

    const targetTimestamp = new Date(targetTime).getTime()
    let closestIndex = 0
    let closestDiff = Infinity

    candlestickData.x.forEach((time, index) => {
      const timeDiff = Math.abs(new Date(time).getTime() - targetTimestamp)
      if (timeDiff < closestDiff) {
        closestDiff = timeDiff
        closestIndex = index
      }
    })

    return closestIndex
  }

  // Handle execution arrow click
  const handleExecutionClick = (execution: TradeExecution) => {
    setSelectedExecution(execution)
    setShowExecutionPanel(true)
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]', className)} style={{ height }}>
        <div className="text-center">
          <div className="text-red-400 text-sm mb-2">Enhanced Chart Error</div>
          <div className="text-xs studio-muted max-w-md">{error}</div>
          <button
            onClick={() => loadChartData()}
            className="mt-3 px-3 py-1 text-xs bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] overflow-hidden', className)}>
      {/* Enhanced Chart Header */}
      <div className="absolute top-2 left-4 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold studio-text">{symbol}</span>
          <span className="studio-muted">{getTimeframeConfig(timeframe).label}</span>
          <span className="studio-muted">•</span>
          <span className="studio-muted">Enhanced View</span>
          {trade && (
            <>
              <span className="studio-muted">•</span>
              <span className={cn(
                'font-medium',
                trade.side === 'Long' ? 'text-green-400' : 'text-red-400'
              )}>
                {trade.side} Trade
              </span>
              <span className="studio-muted">•</span>
              <span className="text-primary">
                {trade.executions.entries.length}E/{trade.executions.exits.length}X
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chart Controls */}
      <div className="absolute top-2 right-4 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setShowExecutionPanel(!showExecutionPanel)}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              showExecutionPanel
                ? 'bg-primary text-black'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            )}
          >
            Executions
          </button>
          {trade && (
            <span className="studio-muted">
              Quality: {trade.executionStats.qualityScore}/100
            </span>
          )}
        </div>
      </div>

      {/* Execution Details Panel */}
      {showExecutionPanel && trade && (
        <div className="absolute top-12 right-4 z-10 bg-[#0a0a0a]/95 backdrop-blur-sm rounded border border-[#1a1a1a] p-3 w-80">
          <div className="text-sm studio-text font-medium mb-2">Execution Details</div>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="studio-muted">Total Executions:</span>
                <span className="ml-2 text-primary">{trade.executionStats.totalExecutions}</span>
              </div>
              <div>
                <span className="studio-muted">Quality Score:</span>
                <span className="ml-2 text-primary">{trade.executionStats.qualityScore}/100</span>
              </div>
              <div>
                <span className="studio-muted">Entry VWAP:</span>
                <span className="ml-2 text-green-400">${trade.executionStats.vwapEntry.toFixed(2)}</span>
              </div>
              <div>
                <span className="studio-muted">Exit VWAP:</span>
                <span className="ml-2 text-red-400">${trade.executionStats.vwapExit.toFixed(2)}</span>
              </div>
            </div>

            {Object.keys(trade.executionStats.venueDistribution).length > 0 && (
              <div>
                <div className="studio-muted mb-1">Venue Distribution:</div>
                {Object.entries(trade.executionStats.venueDistribution).map(([venue, count]) => (
                  <div key={venue} className="flex justify-between">
                    <span>{venue}:</span>
                    <span className="text-primary">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="flex items-center space-x-2 text-sm studio-muted">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Loading enhanced {symbol} chart...</span>
          </div>
        </div>
      )}

      {/* Plotly Chart */}
      {!isLoading && candlestickData.x.length > 0 && (
        <Plot
          data={[
            {
              x: candlestickData.x,
              open: candlestickData.open,
              high: candlestickData.high,
              low: candlestickData.low,
              close: candlestickData.close,
              type: 'candlestick' as const,
              name: symbol,
              increasing: {
                line: { color: '#ffffff', width: 1 }
              },
              decreasing: {
                line: { color: '#ef4444', width: 1 }
              },
              hoverinfo: 'none',
              yaxis: 'y',
              xaxis: 'x',
            }
          ]}
          layout={{
            autosize: true,
            width: undefined,
            height: height,
            paper_bgcolor: '#0a0a0a',
            plot_bgcolor: '#000000',
            font: {
              color: '#e5e5e5',
              family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              size: 11
            },
            xaxis: {
              type: 'date',
              gridcolor: '#1a1a1a',
              gridwidth: 1,
              linecolor: '#1a1a1a',
              tickcolor: '#1a1a1a',
              tickfont: { color: '#e5e5e5', size: 10 },
              title: { text: '', font: { color: '#e5e5e5' } },
              showspikes: true,
              spikecolor: '#fcd34d',
              spikethickness: 0.5,
              spikedash: 'longdash',
              spikemode: 'across',
              spikesnap: 'cursor',
              rangeslider: { visible: false },
              rangeselector: { visible: false }
            },
            yaxis: {
              gridcolor: '#1a1a1a',
              gridwidth: 1,
              linecolor: '#1a1a1a',
              tickcolor: '#1a1a1a',
              tickfont: { color: '#e5e5e5', size: 10 },
              title: { text: 'Price ($)', font: { color: '#e5e5e5' } },
              showspikes: true,
              spikecolor: '#fcd34d',
              spikethickness: 0.5,
              spikedash: 'longdash',
              spikemode: 'across',
              spikesnap: 'cursor',
              fixedrange: false,
              autorange: true
            },
            margin: { l: 60, r: 20, t: 40, b: 40 },
            showlegend: false,
            hovermode: 'x',
            annotations: createExecutionAnnotations(),
            dragmode: 'pan'
          }}
          config={{
            displayModeBar: true,
            modeBarButtonsToRemove: [
              'autoScale2d',
              'resetScale2d',
              'toggleSpikelines',
              'hoverCompareCartesian',
              'lasso2d',
              'select2d'
            ],
            displaylogo: false,
            responsive: true,
            scrollZoom: true
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      )}

      {/* Enhanced Legend */}
      <div className="absolute bottom-2 left-4 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-2 bg-white border border-white"></div>
            <span className="studio-muted">Bullish</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-2 bg-red-400 border border-red-400"></div>
            <span className="studio-muted">Bearish</span>
          </div>
          {trade && (
            <>
              <div className="flex items-center space-x-1">
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent" style={{ borderBottomColor: '#00ff00' }}></div>
                <span className="studio-muted">Entries ({trade.executions.entries.length})</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent" style={{ borderTopColor: '#ff3300' }}></div>
                <span className="studio-muted">Exits ({trade.executions.exits.length})</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getExecutionColor(
  execution: TradeExecution,
  type: 'entry' | 'exit',
  colorScheme: string,
  isProfitable?: boolean
): string {
  switch (colorScheme) {
    case 'side':
      return type === 'entry' ? '#00ff00' : '#ff3300'

    case 'quality':
      // Color based on execution quality
      return execution.slippage && execution.slippage < 0.001 ? '#00ff00' :
             execution.slippage && execution.slippage < 0.005 ? '#fcd34d' : '#ff3300'

    case 'venue':
      // Color based on venue
      const venueColors: Record<string, string> = {
        'ARCA': '#00ff00',
        'NASDAQ': '#0099ff',
        'NYSE': '#ff6600',
        'BATS': '#9900ff'
      }
      return venueColors[execution.venue] || '#888888'

    case 'timing':
      // Color based on timing quality
      return execution.timing === 'OnTime' ? '#00ff00' :
             execution.timing === 'Early' ? '#fcd34d' : '#ff3300'

    default:
      return type === 'entry' ? '#00ff00' : (isProfitable ? '#00ff00' : '#ff3300')
  }
}

function getArrowSymbol(arrow: ExecutionArrow): string {
  if (arrow.type === 'entry') {
    return arrow.side === 'Long' ? '▲' : '▼'
  } else {
    return arrow.side === 'Long' ? '▼' : '▲'
  }
}

function getArrowSize(size: 'small' | 'medium' | 'large'): number {
  switch (size) {
    case 'small': return 18
    case 'medium': return 24
    case 'large': return 30
    default: return 24
  }
}

function groupExecutionsByTime(arrows: ExecutionArrow[], windowMinutes: number): ExecutionArrow[] {
  // Group executions within the time window
  const groups: ExecutionArrow[][] = []
  const sorted = [...arrows].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

  let currentGroup: ExecutionArrow[] = []

  for (const arrow of sorted) {
    if (currentGroup.length === 0) {
      currentGroup = [arrow]
    } else {
      const lastTime = new Date(currentGroup[currentGroup.length - 1].time).getTime()
      const currentTime = new Date(arrow.time).getTime()
      const timeDiff = (currentTime - lastTime) / (1000 * 60) // minutes

      if (timeDiff <= windowMinutes) {
        currentGroup.push(arrow)
      } else {
        groups.push(currentGroup)
        currentGroup = [arrow]
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  // Create representative arrows for each group
  return groups.map(group => {
    if (group.length === 1) return group[0]

    // Combine group into single arrow
    const totalQuantity = group.reduce((sum, arrow) => sum + arrow.execution.quantity, 0)
    const avgPrice = group.reduce((sum, arrow) => sum + arrow.execution.price, 0) / group.length
    const venues = [...new Set(group.map(arrow => arrow.venue))].join(', ')

    return {
      ...group[0],
      label: `${group.length} executions: ${totalQuantity}@$${avgPrice.toFixed(2)} (${venues})`,
      size: totalQuantity > 2000 ? 'large' : totalQuantity > 1000 ? 'medium' : 'small'
    }
  })
}

export default EnhancedTradingChart