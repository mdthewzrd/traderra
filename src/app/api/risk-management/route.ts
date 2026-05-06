import { NextRequest, NextResponse } from 'next/server'

interface RiskMetrics {
  portfolioValue: number
  totalExposure: number
  maxDrawdown: number
  currentDrawdown: number
  var95: number // Value at Risk 95%
  var99: number // Value at Risk 99%
  sharpeRatio: number
  sortinoRatio: number
  beta: number
  correlation: Record<string, number>
  concentration: Record<string, number>
  leverage: number
  liquidityRatio: number
}

interface RiskAlert {
  id: string
  type: 'warning' | 'critical' | 'info'
  category: 'exposure' | 'correlation' | 'liquidity' | 'leverage' | 'drawdown'
  title: string
  message: string
  value: number
  threshold: number
  timestamp: string
  acknowledged: boolean
}

interface Position {
  symbol: string
  quantity: number
  entryPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  weight: number
  beta: number
  sector: string
}

// Mock portfolio data for demonstration
const mockPortfolio: Position[] = [
  {
    symbol: 'AAPL',
    quantity: 100,
    entryPrice: 150.00,
    currentPrice: 165.50,
    marketValue: 16550,
    unrealizedPnL: 1550,
    weight: 0.25,
    beta: 1.2,
    sector: 'Technology'
  },
  {
    symbol: 'MSFT',
    quantity: 50,
    entryPrice: 280.00,
    currentPrice: 295.25,
    marketValue: 14762.50,
    unrealizedPnL: 762.50,
    weight: 0.22,
    beta: 0.9,
    sector: 'Technology'
  },
  {
    symbol: 'GOOGL',
    quantity: 20,
    entryPrice: 120.00,
    currentPrice: 125.75,
    marketValue: 2515,
    unrealizedPnL: 115,
    weight: 0.04,
    beta: 1.1,
    sector: 'Technology'
  },
  {
    symbol: 'SPY',
    quantity: 30,
    entryPrice: 420.00,
    currentPrice: 435.80,
    marketValue: 13074,
    unrealizedPnL: 474,
    weight: 0.20,
    beta: 1.0,
    sector: 'ETF'
  },
  {
    symbol: 'BTC',
    quantity: 0.5,
    entryPrice: 40000,
    currentPrice: 42500,
    marketValue: 21250,
    unrealizedPnL: 1250,
    weight: 0.32,
    beta: 2.5,
    sector: 'Cryptocurrency'
  }
]

const mockRiskAlerts: RiskAlert[] = [
  {
    id: '1',
    type: 'warning',
    category: 'concentration',
    title: 'High Concentration Risk',
    message: 'BTC represents 32% of portfolio value, exceeding 25% threshold',
    value: 32,
    threshold: 25,
    timestamp: '2024-12-01T15:30:00Z',
    acknowledged: false
  },
  {
    id: '2',
    type: 'info',
    category: 'correlation',
    title: 'Tech Sector Overlap',
    message: 'Technology positions represent 51% of portfolio',
    value: 51,
    threshold: 50,
    timestamp: '2024-12-01T14:15:00Z',
    acknowledged: true
  },
  {
    id: '3',
    type: 'critical',
    category: 'drawdown',
    title: 'Portfolio Drawdown Alert',
    message: 'Current drawdown exceeds 15% threshold',
    value: 16.8,
    threshold: 15,
    timestamp: '2024-12-01T13:45:00Z',
    acknowledged: false
  }
]

function calculateRiskMetrics(portfolio: Position[]): RiskMetrics {
  const portfolioValue = portfolio.reduce((sum, pos) => sum + pos.marketValue, 0)
  const totalExposure = portfolioValue * 1.1 // Including margin
  const maxDrawdown = 18.5 // Historical max
  const currentDrawdown = 3.2 // Current
  const var95 = portfolioValue * 0.02 // 2% daily VaR
  const var99 = portfolioValue * 0.03 // 3% daily VaR
  const sharpeRatio = 1.8
  const sortinoRatio = 2.1
  const beta = 1.15
  const correlation: Record<string, number> = {
    'SPY': 0.85,
    'QQQ': 0.78,
    'BTC': 0.35
  }
  const concentration: Record<string, number> = {}
  portfolio.forEach(pos => {
    concentration[pos.sector] = (concentration[pos.sector] || 0) + pos.weight
  })
  const leverage = 1.1
  const liquidityRatio = 0.75 // Proportion of liquid assets

  return {
    portfolioValue,
    totalExposure,
    maxDrawdown,
    currentDrawdown,
    var95,
    var99,
    sharpeRatio,
    sortinoRatio,
    beta,
    correlation,
    concentration,
    leverage,
    liquidityRatio
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')

    switch (endpoint) {
      case 'dashboard':
        const riskMetrics = calculateRiskMetrics(mockPortfolio)
        return NextResponse.json({
          metrics: riskMetrics,
          alerts: mockRiskAlerts,
          portfolio: mockPortfolio,
          timestamp: Date.now()
        })

      case 'positions':
        return NextResponse.json({
          positions: mockPortfolio,
          summary: {
            totalValue: mockPortfolio.reduce((sum, pos) => sum + pos.marketValue, 0),
            totalPnL: mockPortfolio.reduce((sum, pos) => sum + pos.unrealizedPnL, 0),
            riskScore: 7.2 // Scale 1-10
          }
        })

      case 'alerts':
        const acknowledged = searchParams.get('acknowledged') === 'true'
        const filteredAlerts = acknowledged
          ? mockRiskAlerts
          : mockRiskAlerts.filter(alert => !alert.acknowledged)

        return NextResponse.json({
          alerts: filteredAlerts,
          count: filteredAlerts.length,
          criticalCount: filteredAlerts.filter(a => a.type === 'critical').length
        })

      case 'scenario':
        const scenarios = {
          'market_crash': {
            description: '-20% market correction',
            impact: mockPortfolio.reduce((sum, pos) => sum + pos.marketValue * (pos.beta * -0.20), 0),
            probability: 0.05
          },
          'interest_rate_hike': {
            description: '+100bps interest rate increase',
            impact: mockPortfolio.reduce((sum, pos) => sum + pos.marketValue * -0.08, 0),
            probability: 0.15
          },
          'crypto_crash': {
            description: '-40% cryptocurrency decline',
            impact: mockPortfolio
              .filter(pos => pos.sector === 'Cryptocurrency')
              .reduce((sum, pos) => sum + pos.marketValue * -0.40, 0),
            probability: 0.10
          }
        }
        return NextResponse.json({ scenarios })

      case 'correlation':
        const correlationMatrix = {}
        const symbols = mockPortfolio.map(pos => pos.symbol)

        symbols.forEach(symbol1 => {
          correlationMatrix[symbol1] = {}
          symbols.forEach(symbol2 => {
            // Generate mock correlation matrix
            const correlation = symbol1 === symbol2 ? 1.0 :
              Math.random() * 0.8 + 0.2 // Random correlation between 0.2-1.0
            correlationMatrix[symbol1][symbol2] = correlation
          })
        })

        return NextResponse.json({
          correlationMatrix,
          symbols,
          avgCorrelation: 0.45
        })

      default:
        return NextResponse.json(
          { error: 'Invalid endpoint' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error fetching risk management data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch risk data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'acknowledge_alert':
        const { alertId } = data
        // In production, update database
        return NextResponse.json({
          success: true,
          message: `Alert ${alertId} acknowledged`
        })

      case 'risk_check':
        const { trade, portfolio } = data

        // Simulate trade risk analysis
        const tradeRisk = {
          approved: Math.random() > 0.2, // 80% approval rate
          riskScore: Math.random() * 10,
          warnings: [],
          impact: {
            portfolioExposure: (portfolio.totalExposure || 100000) + (trade.quantity * trade.price),
            concentrationChange: 0,
            correlationIncrease: 0
          }
        }

        // Add some warnings
        if (tradeRisk.riskScore > 7) {
          tradeRisk.warnings.push('High risk score detected')
        }
        if (trade.quantity * trade.price > portfolio.totalExposure * 0.1) {
          tradeRisk.warnings.push('Trade size exceeds 10% of portfolio')
        }

        return NextResponse.json({ tradeRisk })

      case 'optimize_portfolio':
        const { constraints } = data
        const optimization = {
          suggestedWeights: {
            'AAPL': 0.20,
            'MSFT': 0.20,
            'GOOGL': 0.10,
            'SPY': 0.25,
            'BTC': 0.15,
            'Cash': 0.10
          },
          expectedReturn: 0.12, // 12% annual
          expectedRisk: 0.15, // 15% volatility
          sharpeRatio: 0.8,
          constraints: constraints || {
            maxWeight: 0.25,
            minWeight: 0.05,
            maxSectorWeight: 0.40
          }
        }

        return NextResponse.json({ optimization })

      case 'stress_test':
        const { scenarios } = data
        const results = scenarios.map((scenario: any) => ({
          name: scenario.name,
          portfolioValue: 100000 * (1 + scenario.impact),
          drawdown: Math.max(0, -scenario.impact * 100),
          positionImpacts: mockPortfolio.map(pos => ({
            symbol: pos.symbol,
            currentValue: pos.marketValue,
            stressedValue: pos.marketValue * (1 + scenario.impact * pos.beta),
            loss: pos.marketValue * Math.abs(scenario.impact * pos.beta)
          }))
        }))

        return NextResponse.json({ stressTest: results })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error processing risk management request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}