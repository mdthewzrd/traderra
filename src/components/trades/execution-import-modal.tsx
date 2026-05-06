'use client'

import { useState } from 'react'
import { Upload, X, FileText, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Execution {
  date: string
  time: string
  symbol: string
  quantity: number
  price: number
  side: 'B' | 'S' | 'Buy' | 'Sell' | 'Long' | 'Short'
  commission: number
  ecnFee?: number
}

interface GroupedTrade {
  symbol: string
  side: 'Long' | 'Short'
  date: string
  executions: Execution[]
  totalQuantity: number
  vwapPrice: number
  totalCommission: number
  exitPrice?: number
  exitDate?: string
}

interface ExecutionImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (trades: any[]) => void
}

export function ExecutionImportModal({ isOpen, onClose, onImport }: ExecutionImportModalProps) {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<GroupedTrade[]>([])
  const [error, setError] = useState('')

  if (!isOpen) return null

  const parseExecutions = (text: string): Execution[] => {
    const lines = text.trim().split('\n')
    const executions: Execution[] = []

    // Skip header row if it exists
    const startIndex = lines[0].toLowerCase().includes('date') ? 1 : 0

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Handle both tab and comma separation
      const parts = line.includes('\t') ? line.split('\t') : line.split(',').map(p => p.trim())

      if (parts.length < 7) continue

      const date = parts[0]
      const time = parts[1]
      const symbol = parts[2]
      const quantity = parseFloat(parts[3])
      const price = parseFloat(parts[4])
      const side = parts[5] as 'B' | 'S' | 'Buy' | 'Sell'
      const commission = parseFloat(parts[6]) || 0
      const ecnFee = parseFloat(parts[7]) || 0

      if (symbol && quantity > 0 && price > 0) {
        executions.push({
          date: normalizeDate(date),
          time: time.trim(),
          symbol: symbol.toUpperCase().trim(),
          quantity,
          price,
          side,
          commission: commission + ecnFee
        })
      }
    }

    return executions
  }

  const normalizeDate = (dateStr: string): string => {
    // Convert "2/6/2026" to "2026-02-06"
    const parts = dateStr.split('/')
    if (parts.length === 3) {
      const [month, day, year] = parts
      // Pad with zeros if needed
      const paddedMonth = month.padStart(2, '0')
      const paddedDay = day.padStart(2, '0')
      return `${year}-${paddedMonth}-${paddedDay}`
    }
    return dateStr
  }

  const groupExecutionsIntoTrades = (executions: Execution[]): GroupedTrade[] => {
    const groups = new Map<string, Execution[]>()

    // Group by symbol, side, and date
    executions.forEach(exec => {
      const normalizedSide = (exec.side === 'B' || exec.side === 'Buy' || exec.side === 'Long') ? 'Long' : 'Short'
      const key = `${exec.symbol}|${normalizedSide}|${exec.date}`

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(exec)
    })

    // Calculate VWAP and create grouped trades
    const groupedTrades: GroupedTrade[] = []

    groups.forEach((execs, key) => {
      const totalQuantity = execs.reduce((sum, e) => sum + e.quantity, 0)
      const totalValue = execs.reduce((sum, e) => sum + (e.quantity * e.price), 0)
      const vwapPrice = totalValue / totalQuantity
      const totalCommission = execs.reduce((sum, e) => sum + e.commission, 0)

      const [symbol, side, date] = key.split('|')

      // Check if there's a matching exit (opposite side on same or later date)
      // For now, we'll just create the opening trades

      groupedTrades.push({
        symbol,
        side: side as 'Long' | 'Short',
        date,
        executions: execs,
        totalQuantity,
        vwapPrice,
        totalCommission
      })
    })

    return groupedTrades.sort((a, b) => a.symbol.localeCompare(b.symbol))
  }

  const handlePreview = () => {
    try {
      setError('')
      const executions = parseExecutions(csvText)

      if (executions.length === 0) {
        setError('No valid executions found. Please check your CSV format.')
        return
      }

      const grouped = groupExecutionsIntoTrades(executions)
      setPreview(grouped)
    } catch (err) {
      setError(`Error parsing CSV: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleImport = () => {
    // Convert grouped executions to trade format
    const trades = preview.map(grouped => {
      // Calculate P&L (would need exit price - for now mark as 0)
      const pnl = 0

      return {
        id: crypto.randomUUID(),
        date: grouped.date,
        symbol: grouped.symbol,
        side: grouped.side,
        quantity: grouped.totalQuantity,
        entryPrice: grouped.vwapPrice,
        exitPrice: grouped.vwapPrice, // Same as entry until exit is recorded
        pnl,
        pnlPercent: 0,
        commission: grouped.totalCommission,
        duration: '',
        strategy: 'Manual Import',
        notes: `${grouped.executions.length} execution(s)`,
        entryTime: `${grouped.date} ${grouped.executions[0].time}`,
        exitTime: '',
        riskAmount: null,
        rMultiple: null,
        // Store execution details for later reference
        _executions: grouped.executions
      }
    })

    onImport(trades)
    onClose()
    setCsvText('')
    setPreview([])
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm"
        style={{ top: '64px' }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none"
        style={{ top: '64px', paddingRight: '0px' }}
      >
        <div className="pointer-events-auto bg-[#1a1a2e] rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2a2a3e]">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-white">Import Executions</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#2a2a3e] rounded transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Instructions */}
            <div className="p-3 bg-[#0f0f1a] rounded-lg border border-[#2a2a3e]">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gray-300 space-y-1">
                  <p className="font-medium">Paste your broker execution data below (CSV format)</p>
                  <p className="text-xs text-gray-400">Expected columns: Date, Time, Symbol, Quantity, Price, Side (B/S), Commission, ECNFee</p>
                  <p className="text-xs text-gray-400">Executions will be grouped by symbol, side, and date to create trades.</p>
                </div>
              </div>
            </div>

            {/* CSV Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Execution Data (CSV)
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="2/6/2026&#10;10:26:15&#10;LIMN&#10;555&#10;2.45&#10;B&#10;18&#10;1.94&#10;2/6/2026&#10;10:26:15&#10;LIMN&#10;354&#10;2.45&#10;B&#10;10&#10;1.24&#10;..."
                className="w-full h-40 px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                style={{ resize: 'none' }}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-300">Preview ({preview.length} grouped trades)</h3>
                <div className="border border-[#2a2a3e] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#0f0f1a]">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Symbol</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Side</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-400">Date</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Executions</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Total Qty</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">VWAP Price</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-400">Commission</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a3e]">
                        {preview.map((trade, idx) => (
                          <tr key={idx} className="hover:bg-[#0f0f1a]">
                            <td className="px-3 py-2 font-medium text-white">{trade.symbol}</td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                trade.side === 'Long'
                                  ? 'bg-green-900/50 text-green-300'
                                  : 'bg-red-900/50 text-red-300'
                              )}>
                                {trade.side}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-300">{trade.date}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{trade.executions.length}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{trade.totalQuantity.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-gray-300">${trade.vwapPrice.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right text-gray-300">${trade.totalCommission.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[#2a2a3e]">
            <button
              onClick={() => {
                setCsvText('')
                setPreview([])
                setError('')
              }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
            <div className="flex space-x-3">
              <button
                onClick={handlePreview}
                disabled={!csvText.trim()}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Preview
              </button>
              <button
                onClick={handleImport}
                disabled={preview.length === 0}
                className="px-4 py-2 text-sm bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import {preview.length > 0 && `(${preview.length} Trades)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
