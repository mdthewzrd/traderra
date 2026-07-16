'use client'

import { useState, useMemo, lazy, Suspense } from 'react'
import { AppLayout } from '../layout/app-layout'
import { CalendarRow } from './calendar-row'
import { TraderraSubNav } from '@/components/layout/traderra-sub-nav'
import { MetricsWithToggles } from './metric-toggles'
import { useChatContext } from '@/contexts/TraderraContext'
import { useComponentRegistry, type ScrollBehavior } from '@/lib/ag-ui/component-registry'
import { useAuth } from '@/lib/auth-client'
import { useGuestMode } from '@/contexts/GuestModeContext'
import { TabbedWidget } from './tabbed-widget'
import { StandaloneRenataChat } from '@/components/chat/standalone-renata-chat'
import { BarChart3, Clock, Calendar, TrendingUp, Target, Activity } from 'lucide-react'
import { useTrades } from '@/hooks/useTrades'
import { useDateRange, getDateRange } from '@/contexts/TraderraContext'

// PERFORMANCE: Dynamic imports for heavy chart components to reduce initial bundle size
// These load only when the dashboard is rendered, not on initial page load
const AdvancedEquityChart = lazy(() => import('./advanced-charts').then(m => ({ default: m.AdvancedEquityChart })))
const PerformanceDistributionChart = lazy(() => import('./advanced-charts').then(m => ({ default: m.PerformanceDistributionChart })))
const SymbolPerformanceChart = lazy(() => import('./advanced-charts').then(m => ({ default: m.SymbolPerformanceChart })))
const BiggestTradesChart = lazy(() => import('./advanced-charts').then(m => ({ default: m.BiggestTradesChart })))

const DayOfWeekChart = lazy(() => import('./additional-metrics').then(m => ({ default: m.DayOfWeekChart })))
const MonthlyPerformanceChart = lazy(() => import('./additional-metrics').then(m => ({ default: m.MonthlyPerformanceChart })))
const WinRateAnalysisChart = lazy(() => import('./additional-metrics').then(m => ({ default: m.WinRateAnalysisChart })))
const PerformanceByPositionSizeChart = lazy(() => import('./additional-metrics').then(m => ({ default: m.PerformanceByPositionSizeChart })))
const PerformanceByPriceChart = lazy(() => import('./additional-metrics').then(m => ({ default: m.PerformanceByPriceChart })))

// PERFORMANCE: Loading fallback component for lazy-loaded charts
const ChartSkeleton = () => (
  <div className="studio-surface rounded-lg p-6 min-h-[400px] flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-sm studio-muted">Loading chart...</p>
    </div>
  </div>
)

// PERFORMANCE: Wrap lazy chart components in Suspense
const LazyAdvancedEquityChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <AdvancedEquityChart {...props} />
  </Suspense>
)

const LazyPerformanceDistributionChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <PerformanceDistributionChart {...props} />
  </Suspense>
)

const LazySymbolPerformanceChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <SymbolPerformanceChart {...props} />
  </Suspense>
)

const LazyBiggestTradesChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <BiggestTradesChart {...props} />
  </Suspense>
)

const LazyDayOfWeekChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <DayOfWeekChart {...props} />
  </Suspense>
)

const LazyMonthlyPerformanceChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <MonthlyPerformanceChart {...props} />
  </Suspense>
)

const LazyWinRateAnalysisChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <WinRateAnalysisChart {...props} />
  </Suspense>
)

const LazyPerformanceByPositionSizeChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <PerformanceByPositionSizeChart {...props} />
  </Suspense>
)

const LazyPerformanceByPriceChart = (props: any) => (
  <Suspense fallback={<ChartSkeleton />}>
    <PerformanceByPriceChart {...props} />
  </Suspense>
)

export function MainDashboard() {
  // Use chat context for persistent sidebar state
  const { isSidebarOpen: aiSidebarOpen, setIsSidebarOpen: setAiSidebarOpen } = useChatContext()

  // Get authentication and guest mode state
  const { isSignedIn } = useAuth()
  const { isGuestMode, setGuestMode } = useGuestMode()

  // Register dashboard components with AG-UI registry
  useComponentRegistry('dashboard.metrics', {
    scroll: (behavior) => {
      const element = document.getElementById('metrics-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  useComponentRegistry('dashboard.charts', {
    scroll: (behavior) => {
      const element = document.getElementById('charts-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  useComponentRegistry('dashboard.summary', {
    scroll: (behavior) => {
      const element = document.getElementById('summary-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  useComponentRegistry('dashboard.journal', {
    scroll: (behavior) => {
      const element = document.getElementById('journal-section')
      element?.scrollIntoView({ behavior: behavior as ScrollBehavior })
    }
  })

  // Load trade data and apply date filtering
  const { trades, isLoading: tradesLoading, error: tradesError } = useTrades()
  const { selectedRange, customStartDate, customEndDate } = useDateRange()
  // Single-source filtering: derive the range from the primitive selectedRange so the
  // filtered set updates the instant a date button is clicked (no object-identity chain).
  const filteredTrades = useMemo(() => {
    if (!trades?.length) return []
    const { start, end } = getDateRange(selectedRange, customStartDate, customEndDate)
    return (trades as any[]).filter(t => {
      const d = new Date(t.date ?? t.timestamp ?? t.createdAt)
      if (isNaN(d.getTime())) return true
      return d >= start && d <= end
    })
  }, [trades, selectedRange, customStartDate, customEndDate])

  // CopilotKit action hooks removed - calendar actions now handled directly via simplified chat API

  return (
    <AppLayout
      pageClassName="min-h-screen"
      showPageHeader={true}
      pageHeaderContent={<TraderraSubNav />}
    >
      <div className="px-6 pb-6">
        <div className="mx-auto max-w-[1800px] space-y-8">
          {/* Weekly calendar view + date range controls (in content flow so it never overlaps stats) */}
          <CalendarRow aiSidebarOpen={aiSidebarOpen} />

          {/* Performance Metrics */}
          <MetricsWithToggles trades={filteredTrades} />

          {/* Loading/Error States */}
          {tradesLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="studio-muted">Loading trade data...</p>
              </div>
            </div>
          ) : tradesError ? (
            <div className="studio-surface rounded-lg p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold studio-text mb-2">Error Loading Data</h3>
                <p className="studio-muted mb-4">{tradesError}</p>
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
                <h3 className="text-lg font-semibold studio-text mb-2">No Trade Data</h3>
                <p className="studio-muted mb-4">
                  {!isSignedIn ? "Sign in to access your trading data or explore as a guest." : "Import your trades to see dashboard analytics."}
                </p>
                <div className="flex gap-3 justify-center">
                  {!isSignedIn && !isGuestMode && (
                    <button
                      onClick={() => setGuestMode(true)}
                      className="btn-secondary"
                    >
                      View as Guest
                    </button>
                  )}
                  <button
                    onClick={() => window.location.href = '/trades'}
                    className="btn-primary"
                  >
                    {isSignedIn ? 'Import Trades' : 'Sign In'}
                  </button>
                </div>
                {!isSignedIn && !isGuestMode && (
                  <p className="text-sm studio-muted mt-4">
                    Guest mode loads sample data to explore Renata AI features
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 2 Main Visual Assets */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Main Equity Chart */}
                <div className="studio-surface rounded-lg p-6 min-h-[400px]">
                  <LazyAdvancedEquityChart trades={filteredTrades} />
                </div>

                {/* Performance Distribution */}
                <div className="studio-surface rounded-lg p-6 min-h-[400px]">
                  <LazyPerformanceDistributionChart trades={filteredTrades} />
                </div>
              </div>

              {/* Mini Stats Section - Metrics with Toggles (already shown above) */}

              {/* Enhanced Analytics with Tabbed Widgets */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Time-Based Analysis Widget */}
                <div className="studio-surface rounded-lg p-6 min-h-[400px]">
                  <TabbedWidget
                    variant="minimal"
                    tabs={[
                      {
                        id: 'dayofweek',
                        label: 'Day of Week',
                        icon: Calendar,
                        component: LazyDayOfWeekChart,
                        props: { trades: filteredTrades }
                      },
                      {
                        id: 'monthly',
                        label: 'Monthly',
                        icon: Calendar,
                        component: LazyMonthlyPerformanceChart,
                        props: { trades: filteredTrades }
                      },
                    ]}
                    defaultTab="dayofweek"
                  />
                </div>

                {/* Trading Performance Widget */}
                <div className="studio-surface rounded-lg p-6 min-h-[400px]">
                  <TabbedWidget
                    variant="minimal"
                    tabs={[
                      {
                        id: 'symbols',
                        label: 'Symbols',
                        icon: BarChart3,
                        component: LazySymbolPerformanceChart,
                        props: { trades: filteredTrades }
                      },
                      {
                        id: 'besttrades',
                        label: 'Best Trades',
                        icon: TrendingUp,
                        component: LazyBiggestTradesChart,
                        props: { trades: filteredTrades }
                      },
                    ]}
                    defaultTab="symbols"
                  />
                </div>
              </div>

              {/* Journal Section */}
              <div className="studio-surface rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold studio-text">Trading Journal</h2>
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
                        <span className="text-sm studio-muted">Oct 12, 2024</span>
                        <span className="text-sm text-green-400">+$485.20</span>
                      </div>
                      <p className="text-sm studio-text">
                        Excellent entry on TSLA swing trade. Followed the technical setup perfectly with strong volume confirmation.
                      </p>
                    </div>

                    <div className="studio-surface rounded-lg p-4 border border-[#1a1a1a]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm studio-muted">Oct 11, 2024</span>
                        <span className="text-sm text-green-400">+$1,485.75</span>
                      </div>
                      <p className="text-sm studio-text">
                        Great day with multiple small wins. Stuck to the plan and managed risk well. Market conditions favorable.
                      </p>
                    </div>

                    <div className="studio-surface rounded-lg p-4 border border-[#1a1a1a]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm studio-muted">Oct 10, 2024</span>
                        <span className="text-sm text-red-400">-$125.80</span>
                      </div>
                      <p className="text-sm studio-text">
                        Small loss on AAPL position. Should have waited for better confirmation. Lesson learned about patience.
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
            </>
          )}
        </div>
      </div>

      </AppLayout>
  )
}