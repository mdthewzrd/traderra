'use client'

import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { isWeekend, subDays, format, addHours } from 'date-fns'

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm studio-muted">Loading chart library...</div>
      </div>
    </div>
  )
})

interface TradingChartProps {
  symbol: string
  trade?: {
    entryTime: string
    exitTime: string
    entryPrice: number
    exitPrice: number
    side: 'Long' | 'Short'
  }
  className?: string
  height?: number
  timeframe?: '2m' | '5m' | '15m' | '1h' | '1d'
}

interface CandlestickData {
  x: string[]
  open: number[]
  high: number[]
  low: number[]
  close: number[]
}

const POLYGON_API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY || '4r6MZNWLy2ucmhVI7fY8MrvXfXTSmxpy'

// Timezone conversion utilities for EST display
const convertUTCToEST = (utcDate: Date): Date => {
  // The API data is already in EST format, no conversion needed
  // This fixes the timeline showing 5:15 AM instead of 9:15 AM
  return utcDate
}

const formatTimeForAxis = (utcTimestamp: string): string => {
  const utcDate = new Date(utcTimestamp)

  // Data is already in EST format, no conversion needed
  const estHours = utcDate.getHours()
  const utcMinutes = utcDate.getMinutes()

  // Format as 12-hour time with AM/PM
  const ampm = estHours >= 12 ? 'PM' : 'AM'
  const displayHours = estHours % 12 || 12 // Convert 0 to 12 for 12 AM

  // Only show minutes if not on the hour
  if (utcMinutes === 0) {
    return `${displayHours} ${ampm}`
  } else {
    return `${displayHours}:${utcMinutes.toString().padStart(2, '0')} ${ampm}`
  }
}

// Helper function to check if a date is a market holiday (basic US holidays)
const isMarketHoliday = (date: Date): boolean => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()

  // Basic US market holidays (simplified)
  const holidays = [
    new Date(year, 0, 1), // New Year's Day
    new Date(year, 6, 4), // Independence Day
    new Date(year, 11, 25), // Christmas
  ]

  return holidays.some(holiday =>
    holiday.getFullYear() === year &&
    holiday.getMonth() === month &&
    holiday.getDate() === day
  )
}

// Helper function to get the last trading day
const getLastTradingDay = (fromDate: Date): Date => {
  let date = new Date(fromDate)
  while (isWeekend(date) || isMarketHoliday(date)) {
    date = subDays(date, 1)
  }
  return date
}

// Helper function to get trading days for date range
const getTradingDateRange = (daysBack: number): { from: string, to: string } => {
  let endDate = getLastTradingDay(new Date())
  let startDate = new Date(endDate)
  let tradingDaysFound = 0

  while (tradingDaysFound < daysBack) {
    startDate = subDays(startDate, 1)
    if (!isWeekend(startDate) && !isMarketHoliday(startDate)) {
      tradingDaysFound++
    }
  }

  return {
    from: format(startDate, 'yyyy-MM-dd'),
    to: format(endDate, 'yyyy-MM-dd')
  }
}

interface TradeArrow {
  id: string
  time: string
  price: number
  type: 'entry' | 'exit' | 'custom'
  side: 'Long' | 'Short'
  label?: string
  color?: string
}

const TradingChartComponent = function TradingChart({ symbol, trade, className, height = 800, timeframe = '15m' }: TradingChartProps) {
  console.log(`🎯 TradingChart component rendered for ${symbol}`, { trade: trade ? 'YES' : 'NO', timeframe })

  const [candlestickData, setCandlestickData] = useState<CandlestickData>({
    x: [],
    open: [],
    high: [],
    low: [],
    close: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customArrows, setCustomArrows] = useState<TradeArrow[]>([])
  const [isAddingArrow, setIsAddingArrow] = useState(false)
  const [currentOHLC, setCurrentOHLC] = useState<{
    time: string
    open: number
    high: number
    low: number
    close: number
  } | null>(null)

  // Timeframe configuration - memoized for performance
  const getTimeframeConfig = useCallback((timeframe: string) => {
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
  }, [trade])

  // Helper function to clean fake prints from price data - memoized for performance
  const cleanFakePrints = useCallback((data: CandlestickData, symbol: string) => {
    console.log(`🧹 Cleaning fake prints for ${symbol}...`)

    if (data.x.length < 3) return data // Need at least 3 points to detect outliers

    const cleaned: CandlestickData = {
      x: [],
      open: [],
      high: [],
      low: [],
      close: []
    }

    for (let i = 0; i < data.x.length; i++) {
      const current = {
        open: data.open[i],
        high: data.high[i],
        low: data.low[i],
        close: data.close[i]
      }

      // Calculate moving average price for comparison
      let avgPrice = (current.open + current.high + current.low + current.close) / 4

      // Compare with surrounding bars to detect outliers
      let isOutlier = false

      if (i > 0 && i < data.x.length - 1) {
        const prev = (data.open[i-1] + data.high[i-1] + data.low[i-1] + data.close[i-1]) / 4
        const next = (data.open[i+1] + data.high[i+1] + data.low[i+1] + data.close[i+1]) / 4
        const expected = (prev + next) / 2

        // Flag as fake print if price deviates more than 10% from expected
        const deviation = Math.abs(avgPrice - expected) / expected
        if (deviation > 0.10) {
          console.log(`🚫 Fake print detected at ${data.x[i]}: ${avgPrice.toFixed(2)} vs expected ${expected.toFixed(2)} (${(deviation * 100).toFixed(1)}% deviation)`)
          isOutlier = true
        }

        // Also check for impossible price relationships within the bar
        if (current.high < current.low ||
            current.open > current.high || current.open < current.low ||
            current.close > current.high || current.close < current.low) {
          console.log(`🚫 Invalid OHLC relationship at ${data.x[i]}`)
          isOutlier = true
        }
      }

      if (!isOutlier) {
        cleaned.x.push(data.x[i])
        cleaned.open.push(current.open)
        cleaned.high.push(current.high)
        cleaned.low.push(current.low)
        cleaned.close.push(current.close)
      }
    }

    const removedCount = data.x.length - cleaned.x.length
    if (removedCount > 0) {
      console.log(`🧹 Removed ${removedCount} fake prints from ${symbol} data`)
    }

    return cleaned
  }, [])

  const generateMockData = (symbol: string, from: string, to: string, config: any) => {
    console.log(`📊 Generating mock data for ${symbol} from ${from} to ${to}`)

    const startDate = new Date(from + 'T04:00:00') // 4 AM ET (pre-market start)
    const endDate = new Date(to + 'T20:00:00')   // 8 PM ET (after-hours end)

    const x: string[] = []
    const open: number[] = []
    const high: number[] = []
    const low: number[] = []
    const close: number[] = []

    // Base price for the symbol
    const basePrices: Record<string, number> = {
      'AAPL': 246,
      'TSLA': 434,
      'NVDA': 417,
      'QQQ': 485,
      'SPY': 425,
      'IWM': 218,
      'GWH': 3.31, // Add GWH specifically
      'WINT': 69,
      'CMAX': 18
    }
    const basePrice = basePrices[symbol] || 100 // Default fallback
    let currentPrice = basePrice

    // Generate bars for all trading sessions (pre-market, regular, after-hours)
    const current = new Date(startDate)
    while (current <= endDate) {
      // Skip weekends
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        // Include all trading sessions: 4:00 AM - 8:00 PM ET
        const hour = current.getHours()
        const minute = current.getMinutes()
        if (hour >= 4 && hour < 20) {
          const openPrice = currentPrice
          const volatility = 0.005 // 0.5% volatility
          const change = (Math.random() - 0.5) * volatility * currentPrice
          const closePrice = openPrice + change

          const highPrice = Math.max(openPrice, closePrice) + Math.random() * 0.002 * currentPrice
          const lowPrice = Math.min(openPrice, closePrice) - Math.random() * 0.002 * currentPrice

          x.push(current.toISOString())
          open.push(openPrice)
          high.push(highPrice)
          low.push(lowPrice)
          close.push(closePrice)

          currentPrice = closePrice
        }
      }

      // Advance by timeframe interval
      current.setMinutes(current.getMinutes() + config.multiplier)
    }

    return { x, open, high, low, close }
  }

  const fetchCandlestickData = async (symbol: string, from: string, to: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const config = getTimeframeConfig(timeframe)

      console.log(`🔍 Fetching ${symbol} ${timeframe} data from ${from} to ${to}`)

      // Try API first, fallback to mock data
      try {
        // Polygon.io aggregates (bars) endpoint with dynamic timeframe
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${config.multiplier}/${config.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000&apikey=${POLYGON_API_KEY}`
        console.log(`📡 API URL: ${url}`)

        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        console.log(`📊 API Response for ${symbol} ${timeframe}:`, {
          status: data.status,
          resultsCount: data.results?.length || 0,
          queryCount: data.queryCount,
          request_id: data.request_id,
          firstBar: data.results?.[0],
          lastBar: data.results?.[data.results?.length - 1]
        })

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
          throw new Error(data.error || 'No data available for this symbol/timeframe')
        }

        // Process real API data
        const rawBars = data.results
        const x: string[] = []
        const open: number[] = []
        const high: number[] = []
        const low: number[] = []
        const close: number[] = []

        console.log(`📊 Processing ${rawBars.length} real bars from API`)

        rawBars.forEach((bar: any) => {
          const barTime = new Date(bar.t) // Polygon API returns UTC timestamps
          const isWeekend = barTime.getUTCDay() === 0 || barTime.getUTCDay() === 6

          if (!isWeekend) {
            // Use UTC timestamps directly - consistent with trade data format
            // This fixes the 4+ hour arrow positioning offset issue
            x.push(barTime.toISOString())
            open.push(bar.o)
            high.push(bar.h)
            low.push(bar.l)
            close.push(bar.c)
          }
        })

        console.log(`✅ Processed ${x.length} real data points for ${symbol} ${timeframe}`)

        // Clean fake prints from real API data
        const rawData = { x, open, high, low, close }
        const cleanedData = cleanFakePrints(rawData, symbol)
        setCandlestickData(cleanedData)

      } catch (apiError) {
        console.warn(`⚠️ API failed, using mock data:`, apiError)
        // Fallback to mock data
        const mockData = generateMockData(symbol, from, to, config)
        console.log(`📊 Generated ${mockData.x.length} mock data points for ${symbol} ${timeframe}`)

        // Clean fake prints from mock data
        const cleanedMockData = cleanFakePrints(mockData, symbol)
        setCandlestickData(cleanedMockData)
      }
    } catch (err) {
      console.error('Error fetching candlestick data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data')
    } finally {
      setIsLoading(false)
    }
  }

  const loadChartData = async () => {
    if (!symbol) return

    try {
      const config = getTimeframeConfig(timeframe)
      let fromDate: string
      let toDate: string

      if (trade) {
        // Simple: show from entry day to exit day only
        // Trade times are already in Eastern Time format (e.g., '2024-12-13T09:30:00')
        const entryDate = new Date(trade.entryTime) // Already in correct format
        const exitDate = new Date(trade.exitTime)

        // Get the date part only (no time) for entry and exit
        const entryDateStr = format(entryDate, 'yyyy-MM-dd')
        const exitDateStr = format(exitDate, 'yyyy-MM-dd')

        fromDate = entryDateStr
        toDate = exitDateStr

        console.log(`📊 Loading ${timeframe} chart data for trade period:`)
        console.log(`   Entry Eastern: ${trade.entryTime} (${entryDateStr})`)
        console.log(`   Exit Eastern: ${trade.exitTime} (${exitDateStr})`)
        console.log(`   Date range: ${fromDate} to ${toDate}`)
      } else {
        // Default based on timeframe configuration
        const { from, to } = getTradingDateRange(config.daysBefore)
        fromDate = from
        toDate = to

        console.log(`📊 Loading default ${timeframe} chart data from ${fromDate} to ${toDate}`)
      }

      // Always try to fetch data with timeout for poor connectivity
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network timeout - using mock data')), 10000) // 10 second timeout
      })

      try {
        await Promise.race([fetchCandlestickData(symbol, fromDate, toDate), timeoutPromise])
      } catch (networkError) {
        console.warn('Network issues detected, using mock data:', networkError)
        // Force mock data generation when network fails
        const config = getTimeframeConfig(timeframe)
        const mockData = generateMockData(symbol, fromDate, toDate, config)
        console.log(`📊 Generated ${mockData.x.length} mock data points for ${symbol} due to network issues`)

        // Clean fake prints from network fallback mock data
        const cleanedNetworkMockData = cleanFakePrints(mockData, symbol)
        setCandlestickData(cleanedNetworkMockData)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error loading chart data:', error)
      // Final fallback - generate mock data
      const config = getTimeframeConfig(timeframe)
      // Parse dates safely - entryTime/exitTime are already in ISO format like '2024-12-13T12:30:00'
      const fromDate = trade ? format(new Date(trade.entryTime), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
      const toDate = trade ? format(new Date(trade.exitTime), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
      const mockData = generateMockData(symbol, fromDate, toDate, config)

      // Clean fake prints from final fallback mock data
      const cleanedFinalMockData = cleanFakePrints(mockData, symbol)
      setCandlestickData(cleanedFinalMockData)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (symbol) {
      loadChartData()
    }
  }, [symbol, trade, timeframe])

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]', className)} style={{ height }}>
        <div className="text-center">
          <div className="text-red-400 text-sm mb-2">Chart Error</div>
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

  // Helper function to create session background shapes with proper market hours shading - memoized for performance
  const createSessionBackgrounds = useCallback(() => {
    if (candlestickData.x.length === 0) return []

    const shapes: any[] = []
    console.log(`📊 Creating session backgrounds for ${candlestickData.x.length} bars`)

    // Group bars by trading date and session
    let currentPreMarketStart: number | null = null
    let currentAfterHoursStart: number | null = null
    let currentRegularHoursStart: number | null = null

    for (let i = 0; i < candlestickData.x.length; i++) {
      const barTime = new Date(candlestickData.x[i])

      // Convert UTC timestamp to EST properly
      // Chart data timestamps are in UTC, we need to convert to EST for session detection
      const estDate = convertUTCToEST(barTime)
      const hour = estDate.getHours()
      const minute = estDate.getMinutes()
      const timeInMinutes = hour * 60 + minute

      // Market sessions in Eastern Time
      const preMarketStart = 4 * 60       // 4:00 AM ET
      const marketOpenET = 9 * 60 + 30    // 9:30 AM ET
      const marketCloseET = 16 * 60        // 4:00 PM ET
      const afterHoursEnd = 20 * 60        // 8:00 PM ET

      console.log(`📊 Bar ${i}: ${barTime.toISOString()} -> EST ${hour}:${minute.toString().padStart(2, '0')} (${timeInMinutes} min)`)

      // Check which trading session this bar belongs to
      if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpenET) {
        // Pre-market (4:00 AM - 9:29 AM ET) - Dark grey background
        if (currentPreMarketStart === null) {
          currentPreMarketStart = i
        }
        // End any regular hours session
        if (currentRegularHoursStart !== null) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: candlestickData.x[currentRegularHoursStart],
            x1: candlestickData.x[i - 1],
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(0, 0, 0, 0.95)', // Black background for regular hours
            line: { width: 0 },
            layer: 'below'
          })
          console.log(`📊 Regular hours session: ${candlestickData.x[currentRegularHoursStart]} to ${candlestickData.x[i - 1]}`)
          currentRegularHoursStart = null
        }
        // End any after-hours session
        if (currentAfterHoursStart !== null) {
          currentAfterHoursStart = null
        }
      } else if (timeInMinutes >= marketOpenET && timeInMinutes < marketCloseET) {
        // Regular market hours (9:30 AM - 4:00 PM ET) - Black background
        if (currentRegularHoursStart === null) {
          currentRegularHoursStart = i
        }
        // End any pre-market session
        if (currentPreMarketStart !== null) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: candlestickData.x[currentPreMarketStart],
            x1: candlestickData.x[i - 1],
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(64, 64, 64, 0.3)', // Dark gray for pre-market
            line: { width: 0 },
            layer: 'below'
          })
          console.log(`📊 Pre-market session: ${candlestickData.x[currentPreMarketStart]} to ${candlestickData.x[i - 1]}`)
          currentPreMarketStart = null
        }
        // End any after-hours session
        if (currentAfterHoursStart !== null) {
          currentAfterHoursStart = null
        }
      } else if (timeInMinutes >= marketCloseET && timeInMinutes < afterHoursEnd) {
        // After-hours (4:00 PM - 8:00 PM ET) - Dark grey background
        if (currentAfterHoursStart === null) {
          currentAfterHoursStart = i
        }
        // End any regular hours session
        if (currentRegularHoursStart !== null) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: candlestickData.x[currentRegularHoursStart],
            x1: candlestickData.x[i - 1],
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(0, 0, 0, 0.95)', // Black background for regular hours
            line: { width: 0 },
            layer: 'below'
          })
          console.log(`📊 Regular hours session: ${candlestickData.x[currentRegularHoursStart]} to ${candlestickData.x[i - 1]}`)
          currentRegularHoursStart = null
        }
        // End any pre-market session
        if (currentPreMarketStart !== null) {
          currentPreMarketStart = null
        }
      } else {
        // Outside trading hours (before 4:00 AM or after 8:00 PM)
        // Close any active sessions
        if (currentPreMarketStart !== null) {
          currentPreMarketStart = null
        }
        if (currentRegularHoursStart !== null) {
          currentRegularHoursStart = null
        }
        if (currentAfterHoursStart !== null) {
          currentAfterHoursStart = null
        }
      }
    }

    // Close any remaining sessions
    if (currentPreMarketStart !== null) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: candlestickData.x[currentPreMarketStart],
        x1: candlestickData.x[candlestickData.x.length - 1],
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(64, 64, 64, 0.3)', // Dark gray for pre-market
        line: { width: 0 },
        layer: 'below'
      })
      console.log(`📊 Final pre-market session: ${candlestickData.x[currentPreMarketStart]} to end`)
    }

    if (currentRegularHoursStart !== null) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: candlestickData.x[currentRegularHoursStart],
        x1: candlestickData.x[candlestickData.x.length - 1],
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(0, 0, 0, 0.95)', // Black background for regular hours
        line: { width: 0 },
        layer: 'below'
      })
      console.log(`📊 Final regular hours session: ${candlestickData.x[currentRegularHoursStart]} to end`)
    }

    if (currentAfterHoursStart !== null) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: candlestickData.x[currentAfterHoursStart],
        x1: candlestickData.x[candlestickData.x.length - 1],
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(64, 64, 64, 0.3)', // Dark gray for after-hours
        line: { width: 0 },
        layer: 'below'
      })
      console.log(`📊 Final after-hours session: ${candlestickData.x[currentAfterHoursStart]} to end`)
    }

    console.log(`📅 Applied ${shapes.length} session background rectangles`)
    return shapes
  }, [candlestickData.x])

  // Helper function to create arrow annotations
  const createArrowAnnotation = (arrow: TradeArrow, xPos: string, yPos: number, isEntry: boolean = false, isProfitable: boolean = false) => {
    const annotations: any[] = []

    let symbol = ''
    let color = ''

    if (arrow.type === 'entry' || (arrow.type === 'custom' && isEntry)) {
      // Entry arrows: Long=up/green (buying), Short=down/red (selling)
      symbol = arrow.side === 'Long' ? '▲' : '▼'
      color = arrow.color || (arrow.side === 'Long' ? '#00ff00' : '#ff3300')
    } else {
      // Exit arrows: Long=down (selling), Short=up (buying back)
      // For shorts: exit arrow is GREEN when profitable (bought back cheaper!)
      symbol = arrow.side === 'Long' ? '▼' : '▲'
      color = arrow.color || (isProfitable ? '#00ff00' : '#ff3300')
    }

    // Black border (larger)
    annotations.push({
      x: xPos,
      y: yPos,
      xref: 'x',
      yref: 'y',
      text: symbol,
      font: {
        size: 34,
        color: '#000000',
        family: 'Arial Black, sans-serif'
      },
      showarrow: false,
      hovertext: arrow.label || `${arrow.type}: $${yPos.toFixed(2)}`,
    })

    // Colored fill (smaller)
    annotations.push({
      x: xPos,
      y: yPos,
      xref: 'x',
      yref: 'y',
      text: symbol,
      font: {
        size: 30,
        color: color,
        family: 'Arial Black, sans-serif'
      },
      showarrow: false,
      hovertext: arrow.label || `${arrow.type}: $${yPos.toFixed(2)}`,
    })

    return annotations
  }

  // Add custom arrow functionality
  const addCustomArrow = (event: any) => {
    if (!isAddingArrow || !event.points || event.points.length === 0) return

    const point = event.points[0]
    if (point.x && point.y) {
      const newArrow: TradeArrow = {
        id: `custom_${Date.now()}`,
        time: point.x,
        price: point.y,
        type: 'custom',
        side: 'Long', // Default, can be changed
        label: `Custom Arrow: $${point.y.toFixed(2)}`,
        color: '#fcd34d' // Gold color for custom arrows
      }

      setCustomArrows(prev => [...prev, newArrow])
      setIsAddingArrow(false)
    }
  }

  // Remove custom arrow
  const removeCustomArrow = (arrowId: string) => {
    setCustomArrows(prev => prev.filter(arrow => arrow.id !== arrowId))
  }

  // Prepare trade markers with directional triangles
  const annotations: any[] = []
  // Create market hours background shading
  const shapes: any[] = []

  if (candlestickData.x.length > 0) {
    // Create background rectangles for market sessions
    let currentSessionStart = 0
    let currentSessionType = 'premarket' // Default to premarket

    for (let i = 0; i < candlestickData.x.length; i++) {
      const barTime = new Date(candlestickData.x[i])
      const hour = barTime.getHours()
      const minute = barTime.getMinutes()
      const timeInMinutes = hour * 60 + minute

      // Market sessions
      const marketOpen = 9 * 60 + 30  // 9:30 AM
      const marketClose = 16 * 60     // 4:00 PM

      let sessionType
      // The 9:30 candle should be the FIRST black candle
      if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
        sessionType = 'regular' // Black background
      } else {
        sessionType = 'extended' // Dark gray background
      }

      // If session type changed, end previous session and start new one
      if (sessionType !== currentSessionType) {
        // Add background for previous session
        if (i > currentSessionStart) {
          const color = currentSessionType === 'regular'
            ? 'rgba(0, 0, 0, 0.95)'      // Black for regular hours
            : 'rgba(64, 64, 64, 0.4)'    // Dark gray for pre/after market

          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: candlestickData.x[currentSessionStart],
            x1: candlestickData.x[i], // Go to start of current candle instead of end of previous
            y0: 0,
            y1: 1,
            fillcolor: color,
            line: { width: 0 },
            layer: 'below'
          })
        }

        currentSessionStart = i
        currentSessionType = sessionType
      }
    }

    // Add final session background
    if (candlestickData.x.length > currentSessionStart) {
      const color = currentSessionType === 'regular'
        ? 'rgba(0, 0, 0, 0.95)'      // Black for regular hours
        : 'rgba(64, 64, 64, 0.4)'    // Dark gray for pre/after market

      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: candlestickData.x[currentSessionStart],
        x1: candlestickData.x[candlestickData.x.length - 1],
        y0: 0,
        y1: 1,
        fillcolor: color,
        line: { width: 0 },
        layer: 'below'
      })
    }
  }

  // Add dynamic OHLC values at the top of the chart
  if (currentOHLC) {
    annotations.push({
      x: 0.02, // Left side of chart
      y: 0.95, // Near top (in the buffer space)
      xref: 'paper',
      yref: 'paper',
      text: `${currentOHLC.time} • O: $${currentOHLC.open.toFixed(2)} • H: $${currentOHLC.high.toFixed(2)} • L: $${currentOHLC.low.toFixed(2)} • C: $${currentOHLC.close.toFixed(2)}`,
      font: {
        size: 14,
        color: '#fcd34d', // Gold color
        family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      },
      showarrow: false,
      align: 'left',
      bgcolor: 'transparent', // No background
    })
  } else if (candlestickData.x.length > 0) {
    // Show last candle data when not hovering
    const lastIndex = candlestickData.x.length - 1
    const lastTimeEST = formatTimeForAxis(candlestickData.x[lastIndex])
    const lastDateEST = convertUTCToEST(new Date(candlestickData.x[lastIndex]))
    const lastDateStr = format(lastDateEST, 'MM/dd')
    annotations.push({
      x: 0.02,
      y: 0.95,
      xref: 'paper',
      yref: 'paper',
      text: `${lastDateStr} ${lastTimeEST} EST • O: $${candlestickData.open[lastIndex].toFixed(2)} • H: $${candlestickData.high[lastIndex].toFixed(2)} • L: $${candlestickData.low[lastIndex].toFixed(2)} • C: $${candlestickData.close[lastIndex].toFixed(2)}`,
      font: {
        size: 14,
        color: '#fcd34d',
        family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      },
      showarrow: false,
      align: 'left',
      bgcolor: 'transparent',
    })
  }

  // Helper function to find closest data point index with precise timezone handling
  const findClosestIndex = (targetTime: string) => {
    if (candlestickData.x.length === 0) return 0

    // Parse the target time (trade entry/exit time)
    const targetDate = new Date(targetTime)
    const targetTimestamp = targetDate.getTime()

    console.log(`🎯 Finding closest index for: ${targetTime}`)
    console.log(`🎯 Target timestamp: ${targetTimestamp} (${targetDate.toISOString()})`)

    let closestIndex = 0
    let closestDiff = Infinity

    // More precise matching - compare actual timestamp values
    candlestickData.x.forEach((time, index) => {
      const chartDate = new Date(time)
      const chartTimestamp = chartDate.getTime()

      // Calculate time difference in milliseconds
      const timeDiff = Math.abs(chartTimestamp - targetTimestamp)

      // Convert both to EST for logging comparison
      const targetEST = convertUTCToEST(targetDate)
      const chartEST = convertUTCToEST(chartDate)

      const targetMinutes = targetEST.getHours() * 60 + targetEST.getMinutes()
      const chartMinutes = chartEST.getHours() * 60 + chartEST.getMinutes()

      console.log(`📊 Bar ${index}: ${time} -> EST ${chartEST.getHours()}:${chartEST.getMinutes().toString().padStart(2, '0')} (${chartMinutes} min) vs target EST ${targetEST.getHours()}:${targetEST.getMinutes().toString().padStart(2, '0')} (${targetMinutes} min), diff: ${Math.round(timeDiff/1000/60)} min`)

      // Find the closest timestamp match
      if (timeDiff < closestDiff) {
        closestDiff = timeDiff
        closestIndex = index

        // Check for exact minute match in EST
        if (targetMinutes === chartMinutes) {
          console.log(`🎯 EXACT EST MINUTE MATCH found at index ${index}!`)
        }
      }
    })

    console.log(`🎯 Final match: index ${closestIndex}`)
    console.log(`🎯 Chart time: ${candlestickData.x[closestIndex]}`)
    console.log(`🎯 Time difference: ${closestDiff}ms (${Math.round(closestDiff/1000/60)} minutes)`)

    return closestIndex
  }

  // Add trade entry/exit arrows
  if (trade && candlestickData.x.length > 0) {
    console.log(`🎯 Setting up trade markers for ${trade.side} ${symbol} trade`)

    // Calculate trade profitability
    const isProfitable = trade.side === 'Long'
      ? trade.exitPrice > trade.entryPrice
      : trade.exitPrice < trade.entryPrice

    // Convert trade times and find positions
    // Trade times are already in Eastern time, no conversion needed
    const entryTime = trade.entryTime
    const exitTime = trade.exitTime

    console.log(`🎯 Trade times: Entry=${entryTime}, Exit=${exitTime}`)
    console.log(`🎯 Entry time parsed: ${new Date(entryTime).toISOString()}`)
    console.log(`🎯 Exit time parsed: ${new Date(exitTime).toISOString()}`)

    // Log first few chart timestamps for comparison
    console.log(`🎯 First 5 chart timestamps:`)
    for (let i = 0; i < Math.min(5, candlestickData.x.length); i++) {
      const chartTime = new Date(candlestickData.x[i])
      console.log(`   [${i}] ${candlestickData.x[i]} -> ${chartTime.getUTCHours()}:${chartTime.getUTCMinutes().toString().padStart(2, '0')}`)
    }

    const entryIndex = findClosestIndex(entryTime)
    const exitIndex = findClosestIndex(exitTime)

    console.log(`🎯 Final arrow positions: Entry index=${entryIndex}, Exit index=${exitIndex}`)

    // Create entry arrow
    if (entryIndex < candlestickData.x.length) {
      const entryArrow: TradeArrow = {
        id: 'trade_entry',
        time: candlestickData.x[entryIndex],
        price: trade.entryPrice,
        type: 'entry',
        side: trade.side,
        label: `${trade.side} Entry: $${trade.entryPrice.toFixed(2)}`
      }
      const entryAnnotations = createArrowAnnotation(entryArrow, candlestickData.x[entryIndex], trade.entryPrice, true, isProfitable)
      annotations.push(...entryAnnotations)
    }

    // Create exit arrow
    if (exitIndex < candlestickData.x.length) {
      const exitArrow: TradeArrow = {
        id: 'trade_exit',
        time: candlestickData.x[exitIndex],
        price: trade.exitPrice,
        type: 'exit',
        side: trade.side,
        label: `Exit: $${trade.exitPrice.toFixed(2)}`
      }
      const exitAnnotations = createArrowAnnotation(exitArrow, candlestickData.x[exitIndex], trade.exitPrice, false, isProfitable)
      annotations.push(...exitAnnotations)
    }
  }

  // Add custom arrows
  customArrows.forEach(arrow => {
    const arrowIndex = findClosestIndex(arrow.time)
    if (arrowIndex < candlestickData.x.length) {
      const arrowAnnotations = createArrowAnnotation(arrow, candlestickData.x[arrowIndex], arrow.price, false, false)
      annotations.push(...arrowAnnotations)
    }
  })

  return (
    <div className={cn('relative bg-[#0a0a0a] rounded-lg border border-[#1a1a1a] overflow-hidden', className)}>
      {/* Chart Header */}
      <div className="absolute top-2 left-4 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-semibold studio-text">{symbol}</span>
          <span className="studio-muted">{getTimeframeConfig(timeframe).label}</span>
          <span className="studio-muted">•</span>
          <span className="studio-muted">Pre/Post Market</span>
          {trade && (
            <>
              <span className="studio-muted">•</span>
              <span className={cn(
                'font-medium',
                trade.side === 'Long' ? 'text-green-400' : 'text-red-400'
              )}>
                {trade.side} Trade
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow Controls */}
      <div className="absolute top-2 right-4 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm rounded px-2 py-1">
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={() => setIsAddingArrow(!isAddingArrow)}
            className={cn(
              'px-2 py-1 rounded transition-colors',
              isAddingArrow
                ? 'bg-primary text-black font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            )}
            title="Click to add custom arrows"
          >
            {isAddingArrow ? 'Click Chart to Add Arrow' : 'Add Arrow'}
          </button>
          {customArrows.length > 0 && (
            <>
              <span className="studio-muted">•</span>
              <span className="studio-muted">{customArrows.length} Custom</span>
              <button
                onClick={() => setCustomArrows([])}
                className="text-red-400 hover:text-red-300 underline"
                title="Clear all custom arrows"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="flex items-center space-x-2 text-sm studio-muted">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Loading {symbol} chart data...</span>
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
              hoverinfo: 'none', // Disable hover tooltip since we'll show values at top
              yaxis: 'y',
              xaxis: 'x',
            }
          ]}
          layout={{
            autosize: true,
            width: undefined,
            height: height,
            paper_bgcolor: '#0a0a0a',
            plot_bgcolor: '#000000', // Default black background
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
              spikecolor: '#fcd34d', // Gold crosshair
              spikethickness: 0.5,
              spikedash: 'longdash', // Long dashes with big gaps
              spikemode: 'across',
              spikesnap: 'cursor', // Freeform crosshair - follows cursor, not data points
              rangeslider: { visible: false },
              rangeselector: { visible: false },
              showticklabels: true,
              zeroline: false,
              // Custom tick formatting for EST 12-hour display
              tickmode: 'auto',
              nticks: 8,
              tickangle: 0,
              // Format ticks to show EST time in 12-hour format
              tickformat: '', // Will be overridden by ticktext/tickvals
              ...(candlestickData.x.length > 0 && (() => {
                // Generate custom tick positions and labels for EST display
                const tickData = []
                const totalBars = candlestickData.x.length
                const tickCount = Math.min(8, Math.max(4, Math.floor(totalBars / 10)))

                for (let i = 0; i < tickCount; i++) {
                  const index = Math.floor((i * totalBars) / (tickCount - 1))
                  if (index < totalBars) {
                    const timestamp = candlestickData.x[index]
                    const utcDate = new Date(timestamp)
                    const estDate = convertUTCToEST(utcDate)

                    // Format as EST time for x-axis display
                    const hour = estDate.getHours()
                    const minute = estDate.getMinutes()
                    const ampm = hour >= 12 ? 'PM' : 'AM'
                    const displayHours = hour % 12 || 12

                    let label = ''
                    if (minute === 0) {
                      label = `${displayHours} ${ampm}`
                    } else {
                      label = `${displayHours}:${minute.toString().padStart(2, '0')} ${ampm}`
                    }

                    tickData.push({
                      position: timestamp,
                      label: label
                    })
                  }
                }

                console.log(`🕐 Generated ${tickData.length} custom EST ticks:`, tickData)

                return {
                  tickmode: 'array',
                  tickvals: tickData.map(t => t.position),
                  ticktext: tickData.map(t => t.label)
                }
              })()),
              // Initial range shows exactly entry day to exit day (4am-8pm each day)
              ...(trade && candlestickData.x.length > 0 && (() => {
                // Trade times are already in Eastern Time format
                const entryDate = new Date(trade.entryTime) // Already in correct format
                const exitDate = new Date(trade.exitTime)

                const entryDateStr = format(entryDate, 'yyyy-MM-dd')
                const exitDateStr = format(exitDate, 'yyyy-MM-dd')

                console.log(`🎯 Setting chart range for trade period: ${entryDateStr} to ${exitDateStr}`)

                // Find first bar of entry day and last bar of exit day
                let startIndex = 0
                let endIndex = candlestickData.x.length - 1

                // Find start of entry day (first bar of that day)
                for (let i = 0; i < candlestickData.x.length; i++) {
                  const barDate = new Date(candlestickData.x[i])
                  // Timestamps are already in Eastern Time
                  const barDateStr = format(barDate, 'yyyy-MM-dd')
                  if (barDateStr === entryDateStr) {
                    startIndex = i
                    break
                  }
                }

                // Find end of exit day (last bar of that day)
                for (let i = candlestickData.x.length - 1; i >= 0; i--) {
                  const barDate = new Date(candlestickData.x[i])
                  // Timestamps are already in Eastern Time
                  const barDateStr = format(barDate, 'yyyy-MM-dd')
                  if (barDateStr === exitDateStr) {
                    endIndex = i
                    break
                  }
                }

                console.log(`🎯 Chart range: bars ${startIndex} to ${endIndex}`)
                console.log(`📅 From: ${candlestickData.x[startIndex]} to ${candlestickData.x[endIndex]}`)

                return {
                  range: [
                    candlestickData.x[startIndex],
                    candlestickData.x[endIndex]
                  ]
                }
              })())
            },
            yaxis: {
              gridcolor: '#1a1a1a',
              gridwidth: 1,
              linecolor: '#1a1a1a',
              tickcolor: '#1a1a1a',
              tickfont: { color: '#e5e5e5', size: 10 },
              title: { text: 'Price ($)', font: { color: '#e5e5e5' } },
              showspikes: true,
              spikecolor: '#fcd34d', // Gold crosshair
              spikethickness: 0.5,
              spikedash: 'longdash', // Long dashes with big gaps
              spikemode: 'across',
              spikesnap: 'cursor', // Freeform crosshair - follows cursor, not data points
              fixedrange: false,
              autorange: false, // Disable auto-range to use custom range
              // Calculate range for trade day only (first ~16 hours of data for 4 AM - 8 PM)
              ...(trade && candlestickData.high.length > 0 && (() => {
                const config = getTimeframeConfig(timeframe)
                const barsPerHour = 60 / config.multiplier
                const tradeDayBars = Math.floor(16 * barsPerHour) // 16 hours (4 AM - 8 PM)
                const tradeDayEnd = Math.min(tradeDayBars, candlestickData.high.length)

                // Get high/low for trade day only
                const tradeDayHigh = Math.max(...candlestickData.high.slice(0, tradeDayEnd))
                const tradeDayLow = Math.min(...candlestickData.low.slice(0, tradeDayEnd))
                const range = tradeDayHigh - tradeDayLow
                const bottomPadding = range * 0.05 // 5% padding at bottom
                const topPadding = range * 0.15 // 15% padding at top for OHLC display

                return {
                  range: [
                    tradeDayLow - bottomPadding,
                    tradeDayHigh + topPadding
                  ]
                }
              })() || {
                // Fallback for when no trade data
                range: candlestickData.high.length > 0 ? [
                  Math.min(...candlestickData.low) * 0.995,
                  Math.max(...candlestickData.high) * 1.005
                ] : undefined
              })
            },
            margin: { l: 60, r: 20, t: 40, b: 40 },
            showlegend: false,
            hovermode: 'x', // Enable hover for crosshair but use custom handling
            annotations: annotations,
            shapes: shapes, // Combined session backgrounds and trade markers
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
          onClick={addCustomArrow}
          onHover={(data) => {
            if (data.points && data.points.length > 0) {
              const point = data.points[0]
              if (point.pointIndex !== undefined) {
                const index = point.pointIndex
                const timeEST = formatTimeForAxis(candlestickData.x[index])
                const dateEST = convertUTCToEST(new Date(candlestickData.x[index]))
                const dateStr = format(dateEST, 'MM/dd')
                setCurrentOHLC({
                  time: `${dateStr} ${timeEST} EST`,
                  open: candlestickData.open[index],
                  high: candlestickData.high[index],
                  low: candlestickData.low[index],
                  close: candlestickData.close[index]
                })
              }
            }
          }}
          onUnhover={() => {
            setCurrentOHLC(null)
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      )}

      {/* Chart legend */}
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
                <span className="studio-muted">Entry</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent" style={{ borderTopColor: '#ff3300' }}></div>
                <span className="studio-muted">Exit</span>
              </div>
            </>
          )}
          {customArrows.length > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent" style={{ borderBottomColor: '#fcd34d' }}></div>
              <span className="studio-muted">Custom ({customArrows.length})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Export memoized component for performance optimization
export const TradingChart = memo(TradingChartComponent)