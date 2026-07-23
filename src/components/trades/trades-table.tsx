'use client'

import { useState, useEffect, useMemo, useCallback, memo, Fragment } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Filter,
  Download,
  Search,
  Calendar,
  ArrowUpDown,
  Eye,
  Edit,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TradeDetailModal } from './trade-detail-modal'
import { useDateRange } from '@/contexts/TraderraContext'
import { usePnLMode } from '@/contexts/TraderraContext'
import { useDisplayMode } from '@/contexts/TraderraContext'
import { useComponentRegistry } from '@/lib/ag-ui/component-registry'
import { getPnLValue, getRMultipleValue } from '@/utils/trade-statistics'
import { formatDisplayValue, getValueColorClass } from '@/utils/display-formatting'
import { useDebounce } from '@/hooks/useDebounce'

// Mock trade data with real historical prices from actual trading days
// Updated to use 2026 dates for visibility with date range filters
const mockTrades = [
  {
    id: '001',
    date: '2026-01-28',
    symbol: 'AAPL',
    side: 'Long',
    quantity: 100,
    entryPrice: 246.60,
    exitPrice: 248.10,
    pnl: 150.00,
    grossPnl: 150.55,
    pnlPercent: 0.61,
    commission: 0.55,
    duration: '06:18:00',
    strategy: 'Momentum',
    notes: 'Early morning entry at 9:42 AM - precision arrow test',
    entryTime: '2026-01-28T09:42:00',
    exitTime: '2026-01-28T16:00:00',
    riskAmount: 200.00,
    riskPercent: 2.0,
    stopLoss: 245.00,
    rMultiple: 0.75,
    mfe: 2.0,
    mae: -0.5
  },
  {
    id: '002',
    date: '2026-01-27',
    symbol: 'TSLA',
    side: 'Long',
    quantity: 50,
    entryPrice: 434.27,
    exitPrice: 436.58,
    pnl: 115.50,
    grossPnl: 115.77,
    pnlPercent: 0.53,
    commission: 0.27,
    duration: '06:30:00',
    strategy: 'Scalp',
    notes: 'Full day hold from open to close - strong uptrend',
    entryTime: '2026-01-27T09:30:00',
    exitTime: '2026-01-27T16:00:00',
    riskAmount: 150.00,
    riskPercent: 1.5,
    stopLoss: 432.00,
    rMultiple: 0.77,
    mfe: 3.0,
    mae: -0.3
  },
  {
    id: '003',
    date: '2026-01-24',
    symbol: 'NVDA',
    side: 'Long',
    quantity: 25,
    entryPrice: 140.25,
    exitPrice: 142.10,
    pnl: 46.25,
    grossPnl: 46.63,
    pnlPercent: 1.32,
    commission: 0.38,
    duration: '01:45:20',
    strategy: 'Reversal',
    notes: 'Successful bounce off support level',
    entryTime: '2026-01-24T11:15:00',
    exitTime: '2026-01-24T13:00:20',
    riskAmount: 75.00,
    riskPercent: 1.0,
    stopLoss: 139.00,
    rMultiple: 0.62,
    mfe: 2.0,
    mae: -0.4
  },
  {
    id: '004',
    date: '2026-01-23',
    symbol: 'MSFT',
    side: 'Long',
    quantity: 80,
    entryPrice: 415.50,
    exitPrice: 419.75,
    pnl: 340.00,
    pnlPercent: 1.02,
    commission: 1.27,
    duration: '03:20:15',
    strategy: 'Swing',
    notes: 'Perfect entry at support level with strong follow-through',
    entryTime: '2026-01-23T10:15:00',
    exitTime: '2026-01-23T13:35:15'
  },
  {
    id: '005',
    date: '2026-01-22',
    symbol: 'SPY',
    side: 'Short',
    quantity: 200,
    entryPrice: 592.80,
    exitPrice: 590.25,
    pnl: 510.00,
    pnlPercent: 0.43,
    commission: 0.60,
    duration: '00:25:00',
    strategy: 'Gap Fill',
    notes: 'Gap fill after strong overnight move',
    entryTime: '2026-01-22T09:45:00',
    exitTime: '2026-01-22T10:10:00'
  },
  {
    id: '006',
    date: '2026-01-15',
    symbol: 'QQQ',
    side: 'Long',
    quantity: 150,
    entryPrice: 485.20,
    exitPrice: 487.65,
    pnl: 367.50,
    pnlPercent: 0.50,
    commission: 0.43,
    duration: '01:35:30',
    strategy: 'Range',
    notes: 'Range bounce off key support level',
    entryTime: '2026-01-15T11:00:00',
    exitTime: '2026-01-15T12:35:30'
  },
  {
    id: '007',
    date: '2026-01-25',
    symbol: 'IWM',
    side: 'Long',
    quantity: 300,
    entryPrice: 218.45,
    exitPrice: 220.12,
    pnl: 501.00,
    pnlPercent: 0.76,
    commission: 0.30,
    duration: '02:15:45',
    strategy: 'Breakout',
    notes: 'Small-cap breakout with strong volume',
    entryTime: '2026-01-25T10:30:00',
    exitTime: '2026-01-25T12:45:45'
  },
  {
    id: '008',
    date: '2026-01-26',
    symbol: 'WINT',
    side: 'Long',
    quantity: 130,
    entryPrice: 69.85,
    exitPrice: 69.12,
    pnl: -94.90,
    pnlPercent: -1.04,
    commission: 0.46,
    duration: '00:10:34',
    strategy: 'FOMO',
    notes: 'Chased the move, lesson learned',
    entryTime: '2026-01-26T15:45:00',
    exitTime: '2026-01-26T15:55:34'
  },
  {
    id: '009',
    date: '2026-01-25',
    symbol: 'CMAX',
    side: 'Long',
    quantity: 210,
    entryPrice: 17.70,
    exitPrice: 18.42,
    pnl: 151.20,
    pnlPercent: 4.07,
    commission: 0.11,
    duration: '00:04:37',
    strategy: 'News',
    notes: 'Quick news play execution',
    entryTime: '2026-01-25T09:30:00',
    exitTime: '2026-01-25T09:34:37'
  },
  {
    id: '010',
    date: '2026-01-28',
    symbol: 'CMAX',
    side: 'Short',
    quantity: 40,
    entryPrice: 18.55,
    exitPrice: 18.38,
    pnl: 6.80,
    pnlPercent: 0.92,
    commission: 0.17,
    duration: '00:01:30',
    strategy: 'Fade',
    notes: 'Quick fade after spike',
    entryTime: '2026-01-28T13:45:00',
    exitTime: '2026-01-28T13:46:30'
  }
]

interface TradeTableProps {
  compact?: boolean
  importedTrades?: any[]
  isLoading?: boolean
  selectedTradeId?: string
  onDeleteTrade?: (tradeId: string) => Promise<void>
}

// PERFORMANCE: Memoized TradeRow component to prevent re-render of all rows when only one changes
interface TradeRowProps {
  trade: any
  compact: boolean
  displayMode: string
  mode: 'gross' | 'net'
  selectedTrades: Set<string>
  onToggleSelection: (tradeId: string) => void
  onTradeClick: (trade: any) => void
  onViewTrade: (trade: any, e: React.MouseEvent) => void
  onEditTrade: (trade: any, e: React.MouseEvent) => void
  onDeleteTrade: (trade: any, e: React.MouseEvent) => void
  hasChildren?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
  childCount?: number
}

const TradeRow = memo(({ trade, compact, displayMode, mode, selectedTrades, onToggleSelection, onTradeClick, onViewTrade, onEditTrade, onDeleteTrade, hasChildren, isExpanded, onToggleExpand, childCount }: TradeRowProps) => {
  return (
    <tr
      key={trade.id}
      className={cn('hover:bg-[#0f0f0f] transition-colors cursor-pointer', hasChildren && 'bg-[#0c0c0c]')}
      onClick={() => onTradeClick(trade)}
    >
      {!compact && (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleExpand?.() }} className="flex items-center justify-center w-5 h-5 hover:bg-[#222] rounded transition-colors">
              {isExpanded ? <ChevronDown className="h-4 w-4 studio-muted" /> : <ChevronRight className="h-4 w-4 studio-muted" />}
            </button>
          ) : (
            <input
              type="checkbox"
              className="rounded border-[#333] bg-[#111] text-primary focus:ring-primary"
              checked={selectedTrades.has(trade.id)}
              onChange={() => onToggleSelection(trade.id)}
            />
          )}
        </td>
      )}
      <td className="px-4 py-3 text-sm studio-text">
        {trade.date}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-primary">{trade.symbol}</span>
        {hasChildren && (
          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
            {childCount} RT
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
          trade.side === 'Long'
            ? 'bg-green-900/50 text-green-300 border border-green-700/50'
            : 'bg-red-900/50 text-red-300 border border-red-700/50'
        )}>
          {trade.side}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm  studio-text">
        {trade.quantity.toLocaleString()}
      </td>
      <td className="px-4 py-3 text-right text-sm  studio-text">
        ${trade.entryPrice.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right text-sm  studio-text">
        ${trade.exitPrice.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-medium">
        <span className={getValueColorClass(displayMode === 'r' ? getRMultipleValue(trade, mode) : getPnLValue(trade, mode))}>
          {displayMode === 'r'
            ? formatDisplayValue(getRMultipleValue(trade, mode), 'r', 'currency', {}, getRMultipleValue(trade, mode))
            : formatDisplayValue(getPnLValue(trade, mode), displayMode, 'currency')
          }
        </span>
      </td>
      <td className="px-4 py-3 text-right text-sm ">
        <span className={trade.pnlPercent >= 0 ? 'text-trading-profit' : 'text-trading-loss'}>
          {trade.pnlPercent > 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
        </span>
      </td>
      {!compact && (
        <>
          <td className="px-4 py-3 text-right text-sm studio-text">
            {trade.riskAmount ? `$${trade.riskAmount.toLocaleString()}` : '-'}
          </td>
          <td className="px-4 py-3 text-right text-sm font-medium">
            <span className={cn(
              trade.rMultiple && trade.rMultiple >= 0 ? 'text-trading-profit' : 'text-trading-loss'
            )}>
              {trade.rMultiple !== null && trade.rMultiple !== undefined ? `${trade.rMultiple.toFixed(2)}R` : '-'}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700/50">
              {trade.strategy}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={(e) => onViewTrade(trade, e)}
                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
                title="View Details"
              >
                <Eye className="h-4 w-4 studio-muted hover:studio-text" />
              </button>
              <button
                onClick={(e) => onEditTrade(trade, e)}
                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
                title="Edit Trade"
              >
                <Edit className="h-4 w-4 studio-muted hover:studio-text" />
              </button>
              <button
                onClick={(e) => onDeleteTrade(trade, e)}
                className="p-1 hover:bg-[#1a1a1a] rounded transition-colors"
                title="Delete Trade"
              >
                <Trash2 className="h-4 w-4 studio-muted hover:text-red-400" />
              </button>
            </div>
          </td>
        </>
      )}
    </tr>
  )
})

TradeRow.displayName = 'TradeRow'

export function TradesTable({ compact = false, importedTrades = [], isLoading = false, selectedTradeId, onDeleteTrade }: TradeTableProps) {
  // Use imported trades if available, otherwise fall back to mock data
  const tradesData = importedTrades.length > 0 ? importedTrades : mockTrades

  // Get date range filtering from context
  const { getFilteredData } = useDateRange()

  // Get P&L mode from context
  const { mode } = usePnLMode()

  // Get display mode from context
  const { displayMode } = useDisplayMode()

  const [sortField, setSortField] = useState<string>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedTrades, setSelectedTrades] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  // PERFORMANCE: Debounce search query to filter only after user stops typing
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [filterStrategy, setFilterStrategy] = useState('all')
  const [selectedTrade, setSelectedTrade] = useState<typeof tradesData[0] | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Register filter state handlers with AG-UI registry for AI control
  useComponentRegistry('trades.filters.strategy', {
    setState: (state) => {
      if (typeof state === 'string') {
        setFilterStrategy(state.toLowerCase())
      }
    }
  })

  useComponentRegistry('trades.search', {
    setState: (state) => {
      if (typeof state === 'string') {
        setSearchQuery(state)
      }
    }
  })

  useComponentRegistry('trades.export', {
    activate: (action) => {
      if (action === 'export' || action === 'click') {
        handleExport()
      }
    }
  })

  useComponentRegistry('trades.sort', {
    setState: (state) => {
      if (typeof state === 'string') {
        handleSort(state)
      }
    }
  })

  // Handle auto-opening trade modal from URL parameter
  useEffect(() => {
    if (selectedTradeId && tradesData.length > 0) {
      const trade = tradesData.find(t => t.id === selectedTradeId)
      if (trade) {
        setSelectedTrade(trade)
        setIsDetailModalOpen(true)
      }
    }
  }, [selectedTradeId, tradesData])

  // PERFORMANCE: Memoize handlers with useCallback to prevent re-creation on every render
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])

  const toggleTradeSelection = useCallback((tradeId: string) => {
    setSelectedTrades(prev => {
      const newSelection = new Set(prev)
      if (newSelection.has(tradeId)) {
        newSelection.delete(tradeId)
      } else {
        newSelection.add(tradeId)
      }
      return newSelection
    })
  }, [])

  const selectAllTrades = useCallback(() => {
    setSelectedTrades(prev => {
      if (prev.size === tradesData.length) {
        return new Set()
      } else {
        return new Set(tradesData.map(t => t.id))
      }
    })
  }, [tradesData])

  const handleTradeClick = useCallback((trade: typeof tradesData[0]) => {
    setSelectedTrade(trade)
    setIsDetailModalOpen(true)
  }, [])

  const handleViewTrade = useCallback((trade: typeof tradesData[0], e: React.MouseEvent) => {
    e.stopPropagation()
    handleTradeClick(trade)
  }, [handleTradeClick])

  const handleEditTrade = useCallback((trade: typeof tradesData[0], e: React.MouseEvent) => {
    e.stopPropagation()
    // TODO: Implement edit functionality
    console.log('Edit trade:', trade.id)
  }, [])

  const handleDeleteTrade = useCallback(async (trade: typeof tradesData[0], e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this trade?')) {
      if (onDeleteTrade) {
        try {
          await onDeleteTrade(trade.id)
          console.log('Trade deleted successfully:', trade.id)
        } catch (error) {
          console.error('Failed to delete trade:', error)
          alert('Failed to delete trade. Please try again.')
        }
      } else {
        console.warn('Delete trade not available - no onDeleteTrade callback provided')
      }
    }
  }, [onDeleteTrade])

  const handleExport = () => {
    // Export filtered trades to CSV
    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Entry Price', 'Exit Price', 'P&L', 'P&L %', 'Initial Risk', 'R-Multiple', 'Strategy', 'Notes']
    const csvData = filteredAndSortedTrades.map(trade => [
      trade.date,
      trade.symbol,
      trade.side,
      trade.quantity,
      trade.entryPrice,
      trade.exitPrice,
      trade.pnl,
      trade.pnlPercent,
      trade.riskAmount || '',
      trade.rMultiple || '',
      trade.strategy,
      trade.notes
    ])

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `trades_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleAdvancedFilter = () => {
    // TODO: Implement advanced filter modal
    console.log('Opening advanced filters')
  }

  // PERFORMANCE: Memoize date-filtered trades
  const dateFilteredTrades = useMemo(() => getFilteredData(tradesData), [tradesData])

  // PERFORMANCE: Memoize debounced search query lowercase for faster string comparisons
  const debouncedSearchQueryLower = useMemo(() => debouncedSearchQuery.toLowerCase(), [debouncedSearchQuery])

  // PERFORMANCE: Memoize filtered and sorted trades - only recalculate when dependencies change
  const filteredAndSortedTrades = useMemo(() => {
    return dateFilteredTrades
      .filter(trade => {
        const matchesSearch = !debouncedSearchQueryLower || (
          trade.symbol.toLowerCase().includes(debouncedSearchQueryLower) ||
          trade.strategy.toLowerCase().includes(debouncedSearchQueryLower)
        )
        const matchesFilter = filterStrategy === 'all' || trade.strategy.toLowerCase() === filterStrategy.toLowerCase()
        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        let aValue = a[sortField as keyof typeof a]
        let bValue = b[sortField as keyof typeof b]

        // Use the correct P&L value when sorting by pnl
        if (sortField === 'pnl') {
          aValue = getPnLValue(a, mode)
          bValue = getPnLValue(b, mode)
        }

        const direction = sortDirection === 'asc' ? 1 : -1

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return aValue.localeCompare(bValue) * direction
        }

        return (Number(aValue) - Number(bValue)) * direction
      })
  }, [dateFilteredTrades, debouncedSearchQueryLower, filterStrategy, sortField, sortDirection, mode])

  // PERFORMANCE: Memoize stats calculations - only recalculate when filtered trades change
  const statsData = useMemo(() => {
    const totalPnL = filteredAndSortedTrades.reduce((sum, trade) => sum + getPnLValue(trade, mode), 0)
    const totalTrades = filteredAndSortedTrades.length
    const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0
    const totalRMultiple = filteredAndSortedTrades.reduce((sum, trade) => sum + getRMultipleValue(trade, mode), 0)
    const avgRMultiple = totalTrades > 0 ? totalRMultiple / totalTrades : 0
    return { totalPnL, totalTrades, avgPnL, totalRMultiple, avgRMultiple }
  }, [filteredAndSortedTrades, mode])

  // Expandable parent rows (trades with children)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const toggleRowExpand = (tradeId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(tradeId)) next.delete(tradeId)
      else next.add(tradeId)
      return next
    })
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-sm studio-muted">Loading your trades...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with filters and actions */}
      {!compact && (
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 studio-muted" />
              <input
                type="text"
                placeholder="Search trades..."
                className="pl-10 pr-4 py-2 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="px-4 py-2 studio-surface studio-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              value={filterStrategy}
              onChange={(e) => setFilterStrategy(e.target.value)}
            >
              <option value="all">All Strategies</option>
              <option value="momentum">Momentum</option>
              <option value="scalp">Scalp</option>
              <option value="reversal">Reversal</option>
              <option value="swing">Swing</option>
              <option value="breakout">Breakout</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={handleExport} className="btn-ghost flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            <button onClick={handleAdvancedFilter} className="btn-ghost flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {!compact && (
        <div className="space-y-4">
          {/* Statistics Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold studio-text">Statistics</h3>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="studio-surface rounded-lg p-4">
              <div className="text-sm studio-muted">{displayMode === 'r' ? 'Total R' : 'Total P&L'}</div>
              <div className={cn('text-xl font-bold', getValueColorClass(displayMode === 'r' ? statsData.totalRMultiple : statsData.totalPnL))}>
                {displayMode === 'r'
                  ? `${statsData.totalRMultiple >= 0 ? '' : '-'}${Math.abs(statsData.totalRMultiple).toFixed(2)}R`
                  : formatDisplayValue(statsData.totalPnL, displayMode, 'currency')
                }
              </div>
            </div>
            <div className="studio-surface rounded-lg p-4">
              <div className="text-sm studio-muted">Total Trades</div>
              <div className="text-xl font-bold studio-text">{statsData.totalTrades}</div>
            </div>
            <div className="studio-surface rounded-lg p-4">
              <div className="text-sm studio-muted">{displayMode === 'r' ? 'Average R' : 'Average P&L'}</div>
              <div className={cn('text-xl font-bold', getValueColorClass(displayMode === 'r' ? statsData.avgRMultiple : statsData.avgPnL))}>
                {displayMode === 'r'
                  ? `${statsData.avgRMultiple >= 0 ? '' : '-'}${Math.abs(statsData.avgRMultiple).toFixed(2)}R`
                  : formatDisplayValue(statsData.avgPnL, displayMode, 'currency')
                }
              </div>
            </div>
          </div>

          {/* Diagnostic info - shows if trades are being filtered */}
          {tradesData.length !== filteredAndSortedTrades.length && (
            <div className="text-xs studio-muted bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
              Showing {statsData.totalTrades} of {tradesData.length} total trades (date range filter applied)
            </div>
          )}
        </div>
      )}

      {/* Trades table */}
      <div className="studio-surface rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0a0a0a] border-b border-[#1a1a1a]">
              <tr>
                {!compact && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-[#333] bg-[#111] text-primary focus:ring-primary"
                      checked={selectedTrades.size === tradesData.length}
                      onChange={selectAllTrades}
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left">
                  <button
                    className="flex items-center space-x-1 text-sm font-medium studio-text hover:text-primary"
                    onClick={() => handleSort('date')}
                  >
                    <span>Date</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    className="flex items-center space-x-1 text-sm font-medium studio-text hover:text-primary"
                    onClick={() => handleSort('symbol')}
                  >
                    <span>Symbol</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium studio-text">Side</th>
                <th className="px-4 py-3 text-right text-sm font-medium studio-text">Qty</th>
                <th className="px-4 py-3 text-right text-sm font-medium studio-text">Entry</th>
                <th className="px-4 py-3 text-right text-sm font-medium studio-text">Exit</th>
                <th className="px-4 py-3 text-right">
                  <button
                    className="flex items-center space-x-1 text-sm font-medium studio-text hover:text-primary"
                    onClick={() => handleSort('pnl')}
                  >
                    <span>P&L</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium studio-text">%</th>
                {!compact && (
                  <>
                    <th className="px-4 py-3 text-right text-sm font-medium studio-text">Initial Risk</th>
                    <th className="px-4 py-3 text-right text-sm font-medium studio-text">R</th>
                    <th className="px-4 py-3 text-left text-sm font-medium studio-text">Strategy</th>
                    <th className="px-4 py-3 text-center text-sm font-medium studio-text">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {filteredAndSortedTrades.map((trade) => (
                <Fragment key={trade.id}>
                  <TradeRow
                    trade={trade}
                    compact={compact}
                    displayMode={displayMode}
                    mode={mode}
                    selectedTrades={selectedTrades}
                    onToggleSelection={toggleTradeSelection}
                    onTradeClick={handleTradeClick}
                    onViewTrade={handleViewTrade}
                    onEditTrade={handleEditTrade}
                    onDeleteTrade={handleDeleteTrade}
                    hasChildren={!!trade.children?.length}
                    isExpanded={expandedRows.has(trade.id)}
                    onToggleExpand={() => toggleRowExpand(trade.id)}
                    childCount={trade.children?.length || 0}
                  />
                  {trade.children?.length > 0 && expandedRows.has(trade.id) && (
                    trade.children.map((child: any) => (
                      <tr key={child.id} className="bg-[#080808] hover:bg-[#0c0c0c] transition-colors cursor-pointer border-l-2 border-primary/30" onClick={() => handleTradeClick(child)}>
                        {!compact && <td className="px-4 py-2"></td>}
                        <td className="px-4 py-2 pl-8 text-xs studio-muted">↳ {child.entryTime?.split('T')[1]?.split('.')[0] || child.date}</td>
                        <td className="px-4 py-2"><span className="text-xs studio-muted">{child.symbol}</span></td>
                        <td className="px-4 py-2">
                          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                            child.side === 'Long' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400')}>{child.side}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-xs studio-text">{child.quantity}</td>
                        <td className="px-4 py-2 text-right text-xs studio-text">${child.entryPrice.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-xs studio-text">${child.exitPrice.toFixed(2)}</td>
                        <td className={cn('px-4 py-2 text-right text-xs font-medium', getPnLValue(child, mode) >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {formatDisplayValue(getPnLValue(child, mode), displayMode, 'currency')}
                        </td>
                        <td className="px-4 py-2 text-right text-xs studio-muted">{child.pnlPercent?.toFixed(1)}%</td>
                        {!compact && <><td className="px-4 py-2"></td><td></td><td className="px-4 py-2 text-xs studio-muted">{child.duration}</td><td></td></>}
                      </tr>
                    ))
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false)
            setSelectedTrade(null)
          }}
        />
      )}
    </div>
  )
}