import { NextRequest, NextResponse } from 'next/server'

// Simulated real-time market data
const marketDataCache = new Map()

const generateMockPriceData = (symbol: string) => {
  const basePrice = Math.random() * 500 + 50
  const data = []
  let currentPrice = basePrice

  for (let i = 0; i < 100; i++) {
    const change = (Math.random() - 0.5) * basePrice * 0.02
    currentPrice = Math.max(currentPrice + change, basePrice * 0.8)

    data.push({
      timestamp: Date.now() - (99 - i) * 60000, // Last 100 minutes
      open: currentPrice,
      high: currentPrice * (1 + Math.random() * 0.01),
      low: currentPrice * (1 - Math.random() * 0.01),
      close: currentPrice,
      volume: Math.floor(Math.random() * 1000000) + 100000
    })
  }

  return data
}

const calculateTechnicalIndicators = (data: any[]) => {
  const prices = data.map(d => d.close)
  const volumes = data.map(d => d.volume)

  // Simple Moving Average (20-period)
  const sma20 = prices.slice(20).map((_, i) => {
    const slice = prices.slice(i, i + 20)
    return slice.reduce((a, b) => a + b) / 20
  })

  // Relative Strength Index (14-period)
  const calculateRSI = (prices: number[], period: number = 14) => {
    const gains = []
    const losses = []

    for (let i = 1; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1]
      gains.push(diff > 0 ? diff : 0)
      losses.push(diff < 0 ? Math.abs(diff) : 0)
    }

    const rsi = []
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period
      const rs = avgGain / (avgLoss || 0.001)
      rsi.push(100 - (100 / (1 + rs)))
    }

    return rsi
  }

  // MACD
  const calculateEMA = (prices: number[], period: number) => {
    const multiplier = 2 / (period + 1)
    let ema = prices[0]
    const emaArray = [ema]

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema
      emaArray.push(ema)
    }

    return emaArray
  }

  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  const macdLine = ema12.slice(26).map((_, i) => ema12[i + 26] - ema26[i + 26])
  const signalLine = calculateEMA(macdLine, 9)

  return {
    sma20: [...Array(20).fill(null), ...sma20],
    rsi14: [...Array(15).fill(null), ...calculateRSI(prices)],
    macd: {
      line: [...Array(35).fill(null), ...macdLine],
      signal: [...Array(44).fill(null), ...signalLine],
      histogram: [...Array(44).fill(null), ...macdLine.slice(9).map((v, i) => v - signalLine[i])]
    },
    volume: volumes
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol') || 'SPY'
    const timeframe = searchParams.get('timeframe') || '1D'
    const indicators = searchParams.get('indicators')?.split(',') || ['price']

    // Check cache first (1-minute cache for real-time feel)
    const cacheKey = `${symbol}-${timeframe}`
    const cached = marketDataCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 60000) {
      return NextResponse.json(cached.data)
    }

    // Generate or fetch data
    let priceData = generateMockPriceData(symbol)
    const technicalData = calculateTechnicalIndicators(priceData)

    const response = {
      symbol,
      timeframe,
      timestamp: Date.now(),
      price: priceData[priceData.length - 1], // Current price
      data: priceData,
      indicators: {
        price: priceData.map(d => ({
          timestamp: d.timestamp,
          value: d.close
        })),
        ...(indicators.includes('sma') && { sma: technicalData.sma20.map((v, i) => ({ timestamp: priceData[i]?.timestamp, value: v })).filter(v => v.value) }),
        ...(indicators.includes('rsi') && { rsi: technicalData.rsi14.map((v, i) => ({ timestamp: priceData[i]?.timestamp, value: v })).filter(v => v.value) }),
        ...(indicators.includes('macd') && {
          macd: technicalData.macd.line.map((v, i) => ({ timestamp: priceData[i]?.timestamp, value: v })).filter(v => v.value),
          signal: technicalData.macd.signal.map((v, i) => ({ timestamp: priceData[i]?.timestamp, value: v })).filter(v => v.value)
        }),
        ...(indicators.includes('volume') && { volume: technicalData.volume.map((v, i) => ({ timestamp: priceData[i]?.timestamp, value: v })) })
      },
      summary: {
        current: priceData[priceData.length - 1].close,
        change: priceData[priceData.length - 1].close - priceData[priceData.length - 2].close,
        changePercent: ((priceData[priceData.length - 1].close - priceData[priceData.length - 2].close) / priceData[priceData.length - 2].close) * 100,
        high: Math.max(...priceData.map(d => d.high)),
        low: Math.min(...priceData.map(d => d.low)),
        volume: priceData[priceData.length - 1].volume
      }
    }

    // Cache the response
    marketDataCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching market data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, symbols, timeframe } = body

    switch (action) {
      case 'batch':
        if (!symbols || !Array.isArray(symbols)) {
          return NextResponse.json(
            { error: 'Symbols array is required' },
            { status: 400 }
          )
        }

        const batchData = {}
        for (const symbol of symbols) {
          batchData[symbol] = generateMockPriceData(symbol)
        }

        return NextResponse.json({
          data: batchData,
          timestamp: Date.now()
        })

      case 'scan':
        const { criteria } = body
        const universe = symbols || ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT']

        const scanResults = universe.map(symbol => {
          const data = generateMockPriceData(symbol)
          const latest = data[data.length - 1]
          const previous = data[data.length - 2]
          const change = (latest.close - previous.close) / previous.close * 100

          // Apply simple scan criteria
          const matches = []
          if (criteria?.minChange && Math.abs(change) >= criteria.minChange) {
            matches.push(`Change: ${change.toFixed(2)}%`)
          }
          if (criteria?.minVolume && latest.volume >= criteria.minVolume) {
            matches.push(`Volume: ${(latest.volume / 1000000).toFixed(1)}M`)
          }
          if (criteria?.priceRange && latest.close >= criteria.priceRange.min && latest.close <= criteria.priceRange.max) {
            matches.push(`Price: $${latest.close.toFixed(2)}`)
          }

          return {
            symbol,
            price: latest.close,
            change: change,
            volume: latest.volume,
            matches: matches.length > 0 ? matches : null
          }
        }).filter(result => result.matches)

        return NextResponse.json({
          results: scanResults,
          criteria,
          timestamp: Date.now()
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing market data request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}