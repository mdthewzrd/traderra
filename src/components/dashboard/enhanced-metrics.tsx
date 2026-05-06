'use client'

import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  DollarSign,
  Calendar,
  Zap,
  Activity,
  BarChart3,
  Percent
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Enhanced trading metrics
const tradingMetrics = {
  // Core Performance
  totalPnL: 2847.50,
  winRate: 68.4,
  profitFactor: 1.85,
  expectancy: 0.82,
  maxDrawdown: -285.50,
  totalTrades: 67,

  // Advanced Metrics
  avgWinningTrade: 145.20,
  avgLosingTrade: -78.50,
  largestWin: 1636.60,
  largestLoss: -94.90,
  maxConsecutiveWins: 8,
  maxConsecutiveLosses: 3,

  // Time-based
  avgTradeDuration: '1h 23m',
  bestTradingDay: 'Wednesday',
  bestTradingHour: '9:00 AM',

  // Risk Metrics
  sharpeRatio: 1.45,
  calmarRatio: 4.2,
  recoveryFactor: 23.9,

  // Volume & Position
  avgPositionSize: 8425,
  totalVolume: 562800,
  commissionsPaid: 95.50,
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: number
  icon: React.ComponentType<any>
  positive?: boolean
  format?: 'currency' | 'percentage' | 'number' | 'text'
  size?: 'small' | 'medium' | 'large'
}

function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  positive = true,
  format = 'number',
  size = 'medium'
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val

    switch (format) {
      case 'currency':
        return `$${val.toLocaleString()}`
      case 'percentage':
        return `${val}%`
      default:
        return val.toLocaleString()
    }
  }

  return (
    <div className={cn(
      'studio-surface rounded-lg p-2 sm:p-3 hover:bg-[#0f0f0f] transition-colors',
      size === 'large' && 'col-span-2'
    )}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm studio-muted">{title}</div>
        <Icon className={cn(
          'h-4 w-4',
          positive ? 'text-trading-profit' : 'text-trading-loss'
        )} />
      </div>
      <div className={cn(
        'font-bold mb-1',
        size === 'large' ? 'text-3xl' : 'text-xl',
        positive ? 'text-trading-profit' : format === 'currency' && Number(value) < 0 ? 'text-trading-loss' : 'studio-text'
      )}>
        {formatValue(value)}
      </div>
      {subtitle && (
        <div className="text-xs studio-muted">{subtitle}</div>
      )}
      {trend && (
        <div className={cn(
          'text-xs mt-1 flex items-center',
          trend > 0 ? 'text-trading-profit' : 'text-trading-loss'
        )}>
          {trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
        </div>
      )}
    </div>
  )
}

export function EnhancedMetricsTiles() {
  return (
    <div className="space-y-6">
      {/* Primary Performance Metrics */}
      <div>
        <h2 className="text-lg font-semibold studio-text mb-4">Performance Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-0.5">
          <MetricCard
            title="Total P&L"
            value={tradingMetrics.totalPnL}
            format="currency"
            icon={DollarSign}
            positive={tradingMetrics.totalPnL > 0}
            trend={12.5}
            size="large"
          />
          <MetricCard
            title="Win Rate"
            value={tradingMetrics.winRate}
            format="percentage"
            icon={Target}
            trend={2.3}
          />
          <MetricCard
            title="Profit Factor"
            value={tradingMetrics.profitFactor}
            icon={BarChart3}
            subtitle="Above 1.5 target"
          />
          <MetricCard
            title="Expectancy"
            value={tradingMetrics.expectancy}
            format="currency"
            icon={TrendingUp}
            trend={5.2}
          />
          <MetricCard
            title="Max Drawdown"
            value={tradingMetrics.maxDrawdown}
            format="currency"
            icon={TrendingDown}
            positive={false}
            subtitle="2.8% of equity"
          />
          <MetricCard
            title="Total Trades"
            value={tradingMetrics.totalTrades}
            icon={Activity}
            subtitle="+8 this month"
          />
        </div>
      </div>

      {/* Trading Analysis */}
      <div>
        <h2 className="text-lg font-semibold studio-text mb-4">Trading Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0.5">
          <MetricCard
            title="Avg Winner"
            value={tradingMetrics.avgWinningTrade}
            format="currency"
            icon={TrendingUp}
            subtitle="46 winning trades"
          />
          <MetricCard
            title="Avg Loser"
            value={tradingMetrics.avgLosingTrade}
            format="currency"
            icon={TrendingDown}
            positive={false}
            subtitle="21 losing trades"
          />
          <MetricCard
            title="Largest Win"
            value={tradingMetrics.largestWin}
            format="currency"
            icon={Zap}
            subtitle="Best single trade"
          />
          <MetricCard
            title="Largest Loss"
            value={tradingMetrics.largestLoss}
            format="currency"
            icon={TrendingDown}
            positive={false}
            subtitle="Worst single trade"
          />
          <MetricCard
            title="Win Streak"
            value={tradingMetrics.maxConsecutiveWins}
            icon={Target}
            subtitle="Max consecutive wins"
          />
          <MetricCard
            title="Loss Streak"
            value={tradingMetrics.maxConsecutiveLosses}
            icon={Activity}
            positive={false}
            subtitle="Max consecutive losses"
          />
        </div>
      </div>

      {/* Time & Risk Analysis */}
      <div>
        <h2 className="text-lg font-semibold studio-text mb-4">Time & Risk Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-0.5">
          <MetricCard
            title="Avg Duration"
            value={tradingMetrics.avgTradeDuration}
            format="text"
            icon={Clock}
            subtitle="Hold time per trade"
          />
          <MetricCard
            title="Best Day"
            value={tradingMetrics.bestTradingDay}
            format="text"
            icon={Calendar}
            subtitle="Most profitable day"
          />
          <MetricCard
            title="Best Hour"
            value={tradingMetrics.bestTradingHour}
            format="text"
            icon={Clock}
            subtitle="Most profitable hour"
          />
          <MetricCard
            title="Sharpe Ratio"
            value={tradingMetrics.sharpeRatio}
            icon={BarChart3}
            subtitle="Risk-adjusted return"
          />
          <MetricCard
            title="Recovery Factor"
            value={tradingMetrics.recoveryFactor}
            icon={TrendingUp}
            subtitle="Profit/max drawdown"
          />
        </div>
      </div>

      {/* Position & Volume Analysis */}
      <div>
        <h2 className="text-lg font-semibold studio-text mb-4">Position & Volume</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0.5">
          <MetricCard
            title="Avg Position Size"
            value={tradingMetrics.avgPositionSize}
            format="currency"
            icon={DollarSign}
            subtitle="Per trade"
          />
          <MetricCard
            title="Total Volume"
            value={tradingMetrics.totalVolume}
            format="currency"
            icon={BarChart3}
            subtitle="Traded value"
          />
          <MetricCard
            title="Commissions"
            value={tradingMetrics.commissionsPaid}
            format="currency"
            icon={Percent}
            positive={false}
            subtitle="Total fees paid"
          />
          <MetricCard
            title="Net P&L"
            value={tradingMetrics.totalPnL - tradingMetrics.commissionsPaid}
            format="currency"
            icon={DollarSign}
            positive={true}
            subtitle="After commissions"
          />
        </div>
      </div>
    </div>
  )
}