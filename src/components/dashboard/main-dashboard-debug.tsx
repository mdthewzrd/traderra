'use client'

import { useState, useEffect } from 'react'
import { TopNavigation } from '../layout/top-nav'
import { CalendarRow } from './calendar-row'
import { MetricsWithToggles } from './metric-toggles'
import { StandaloneRenataChat } from '../chat/standalone-renata-chat'
import {
  AdvancedEquityChart,
  PerformanceDistributionChart,
  SymbolPerformanceChart,
  BiggestTradesChart
} from './advanced-charts'
import { TraderraTrade } from '@/utils/csv-parser'
import { useDateRange } from '@/contexts/TraderraContext'

// Mock data for testing - matches API format exactly
const MOCK_TRADES: TraderraTrade[] = [
  {
    id: 'test-1',
    date: '2024-10-20',
    symbol: 'AAPL',
    side: 'Long',
    quantity: 100,
    entryPrice: 150.00,
    exitPrice: 155.00,
    pnl: 500.00,
    pnlPercent: 3.33,
    commission: 2.00,
    duration: '2 hours',
    strategy: 'Day Trade',
    notes: 'Good momentum play',
    entryTime: '09:30:00',
    exitTime: '11:30:00',
    riskAmount: 200,
    riskPercent: 1.5,
    stopLoss: 148.00,
    rMultiple: 2.5,
    mfe: 156.00,
    mae: 149.50
  },
  {
    id: 'test-2',
    date: '2024-10-20',
    symbol: 'TSLA',
    side: 'Short',
    quantity: 50,
    entryPrice: 250.00,
    exitPrice: 245.00,
    pnl: 250.00,
    pnlPercent: 2.00,
    commission: 1.50,
    duration: '1 hour',
    strategy: 'Scalp',
    notes: 'Quick reversal trade',
    entryTime: '10:00:00',
    exitTime: '11:00:00',
    riskAmount: 150,
    riskPercent: 1.0,
    stopLoss: 252.00,
    rMultiple: 1.67,
    mfe: 244.00,
    mae: 251.50
  },
  {
    id: 'test-3',
    date: '2024-10-19',
    symbol: 'NVDA',
    side: 'Long',
    quantity: 25,
    entryPrice: 400.00,
    exitPrice: 385.00,
    pnl: -375.00,
    pnlPercent: -3.75,
    commission: 1.00,
    duration: '4 hours',
    strategy: 'Swing Trade',
    notes: 'Stopped out on news',
    entryTime: '09:30:00',
    exitTime: '13:30:00',
    riskAmount: 300,
    riskPercent: 2.0,
    stopLoss: 388.00,
    rMultiple: -1.25,
    mfe: 405.00,
    mae: 385.00
  }
]

export function MainDashboardDebug() {
  const [aiSidebarOpen, setAiSidebarOpen] = useState(true)
  const [trades, setTrades] = useState<TraderraTrade[]>(MOCK_TRADES) // Start with mock data
  const [isLoading, setIsLoading] = useState(false) // Start with data loaded
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string>('Mock data loaded')
  const [dataSource, setDataSource] = useState<'mock' | 'api'>('mock')

  const { getFilteredData } = useDateRange()

  // Load debug trades directly in component
  useEffect(() => {
    let mounted = true

    const loadDebugTrades = async () => {
      try {
        console.log('🔄 Starting debug trades loading...')
        setDebugInfo('Loading started')
        if (!mounted) return

        setIsLoading(true)
        setError(null)

        // Add AbortController for cleanup
        const controller = new AbortController()

        const response = await fetch('/api/trades-debug', {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        })

        console.log('🌐 Debug trades response status:', response.status)
        console.log('🌐 Response ok:', response.ok)
        setDebugInfo(`Response received: ${response.status}`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('📊 Debug trades data received:', data)
        console.log('📊 Data type:', typeof data)
        console.log('📊 Data keys:', Object.keys(data || {}))
        setDebugInfo(`Data parsed: ${data?.trades?.length || 0} trades`)

        if (!mounted) return

        const loadedTrades = data?.trades || []
        console.log('✅ Setting trades:', loadedTrades.length, 'items')
        console.log('✅ First trade:', loadedTrades[0])

        // Force a synchronous state update with batch
        setTrades(prevTrades => {
          console.log('🔄 setTrades callback executed, prev:', prevTrades.length, 'new:', loadedTrades.length)
          return loadedTrades
        })
        setDebugInfo(`Trades set: ${loadedTrades.length} items`)
        console.log('🎯 State updated - calling setTrades complete')

        // Verify state was set by checking it in next tick
        setTimeout(() => {
          console.log('🔍 Verification check - trades should be set now')
        }, 100)

      } catch (err) {
        console.error('❌ Error loading debug trades:', err)
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load debug trades')
        setDebugInfo(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        if (mounted) {
          console.log('🏁 Setting loading to false')
          setIsLoading(false)
        }
      }
    }

    loadDebugTrades()

    // Cleanup function
    return () => {
      mounted = false
    }
  }, [])

  // Use the same data source as MetricsWithToggles for consistency
  const filteredTrades = getFilteredData(trades || [])

  // TEST: Also create unfiltered version to test if filtering is the issue
  const unfilteredTrades = trades || []

  // Debug logging
  console.log('🔍 Component render - trades loaded:', trades?.length || 0)
  console.log('🔍 Component render - loading state:', isLoading)
  console.log('🔍 Component render - error:', error)
  console.log('🔍 Component render - trades data:', trades)
  console.log('🔍 Component render - filtered trades:', filteredTrades?.length || 0)

  return (
    <div className="min-h-screen studio-bg">
      {/* Fixed header section */}
      <div className="sticky top-0 z-50">
        {/* Top Navigation */}
        <TopNavigation onAiToggle={() => setAiSidebarOpen(!aiSidebarOpen)} aiOpen={aiSidebarOpen} />

        {/* Calendar Row */}
        <CalendarRow aiSidebarOpen={aiSidebarOpen} />
      </div>

      {/* Main layout container */}
      <div className="flex min-h-[calc(100vh-128px)]">
        {/* Dashboard content - flexible width based on AI sidebar state */}
        <main className={`flex-1 overflow-auto p-6 transition-all duration-300 ${aiSidebarOpen ? 'mr-[480px]' : ''}`}>
          <div className="mx-auto max-w-7xl space-y-8">


            {/* Always show MetricsWithToggles for UI testing */}
            <MetricsWithToggles trades={filteredTrades} />

            {/* Loading/Error States */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="studio-muted">Loading debug trade data...</p>
                </div>
              </div>
            ) : error ? (
              <div className="studio-surface rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold studio-text mb-2">Error Loading Debug Data</h3>
                  <p className="studio-muted mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-primary"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div className="studio-surface rounded-lg p-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold studio-text mb-2">No Debug Trade Data</h3>
                  <p className="studio-muted mb-4">Debug endpoint should provide mock data.</p>
                </div>
              </div>
            ) : (
              <>
                {/* 2 Main Visual Assets */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Main Equity Chart */}
                  <div className="studio-surface rounded-lg p-6 min-h-[400px]">
                    <AdvancedEquityChart trades={filteredTrades} />
                  </div>

                  {/* Performance Distribution */}
                  <div className="studio-surface rounded-lg p-6 min-h-[400px]">
                    <PerformanceDistributionChart trades={filteredTrades} />
                  </div>
                </div>

                {/* Mini Stats Section - Metrics with Toggles (already shown above) */}

                {/* Winners/Losers Interactive Dashboard */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Symbol Performance - Horizontal Bar Chart */}
                  <div className="studio-surface rounded-lg p-6 min-h-[350px]">
                    <SymbolPerformanceChart trades={filteredTrades} />
                  </div>

                  {/* Biggest/Best Trades with W|L Toggle */}
                  <div className="studio-surface rounded-lg p-6 min-h-[350px]">
                    <BiggestTradesChart trades={filteredTrades} />
                  </div>
                </div>
              </>
            )}

            {/* Journal Section */}
            <div className="studio-surface rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold studio-text">Trading Journal (Debug)</h2>
                <button
                  className="btn-primary"
                  onClick={() => window.location.href = '/journal'}
                >
                  Add Entry
                </button>
              </div>

              <div className="space-y-4">
                {/* Recent journal entries */}
                <div className="grid gap-2">
                  <div className="studio-surface rounded-lg p-4 border border-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm studio-muted">Oct 20, 2024</span>
                      <span className="text-sm text-green-400">+$500.00</span>
                    </div>
                    <p className="text-sm studio-text">
                      Debug entry: AAPL momentum trade worked perfectly. Tested $ % R buttons functionality.
                    </p>
                  </div>

                  <div className="studio-surface rounded-lg p-4 border border-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm studio-muted">Oct 20, 2024</span>
                      <span className="text-sm text-green-400">+$250.00</span>
                    </div>
                    <p className="text-sm studio-text">
                      Debug entry: TSLA scalp trade. Quick reversal worked well.
                    </p>
                  </div>

                  <div className="studio-surface rounded-lg p-4 border border-[#1a1a1a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm studio-muted">Oct 19, 2024</span>
                      <span className="text-sm text-red-400">-$375.00</span>
                    </div>
                    <p className="text-sm studio-text">
                      Debug entry: NVDA stopped out on news. Risk management worked as planned.
                    </p>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <button
                    className="btn-secondary"
                    onClick={() => window.location.href = '/journal'}
                  >
                    View All Entries
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* AI Sidebar - Renata Chat - Fixed position */}
        {aiSidebarOpen && (
          <div className="fixed right-0 top-16 bottom-0 w-[480px] studio-surface border-l border-[#1a1a1a] z-[55]">
            <StandaloneRenataChat />
          </div>
        )}
      </div>
    </div>
  )
}