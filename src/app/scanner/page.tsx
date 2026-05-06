'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Search, Play, Settings2, Loader2, ExternalLink } from 'lucide-react'

interface Signal {
  ticker: string
  date: string
  close: number
  open: number
  high: number
  low: number
  volume: number
  gap_pct: number
  pos_abs: number
  slope5d: number
  entry_price: number
  stop_price: number
  atr: number
  adv20_usd: number
  [key: string]: unknown
}

export default function ScannerPage() {
  const [scanner] = useState('backside_b')
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('2024-12-31')
  const [loading, setLoading] = useState(false)
  const [signals, setSignals] = useState<Signal[]>([])
  const [error, setError] = useState('')
  const [showParams, setShowParams] = useState(false)
  const [params, setParams] = useState({
    price_min: 5.0,
    adv20_min_usd: 10000000,
    gap_div_atr_min: 0.5,
    pos_abs_max: 0.75,
    slope5d_min: 1.5,
  })

  const runScan = async () => {
    setLoading(true)
    setError('')
    setSignals([])
    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanner, start: startDate, end: endDate, params }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Scan failed'); return }
      const sigs = data.signals?.signals || data.signals || []
      setSignals(Array.isArray(sigs) ? sigs : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold studio-text flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          V31 Equity Scanner
        </h1>
        {signals.length > 0 && (
          <span className="text-sm studio-muted">{signals.length} signals · {startDate} → {endDate}</span>
        )}
      </div>

      {/* Config */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Scanner</label>
          <select className="block mt-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm w-48">
            <option>Backside B — Parabolic Breakdown</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Start</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="block mt-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm" />
        </div>
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">End</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="block mt-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm" />
        </div>
        <button onClick={runScan} disabled={loading}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-1.5 px-5 rounded text-sm flex items-center gap-2 transition-colors">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {loading ? 'Scanning...' : 'Run Scan'}
        </button>
        <button onClick={() => setShowParams(!showParams)}
          className="flex items-center gap-1.5 text-xs studio-muted hover:studio-text transition-colors px-2 py-1.5 rounded hover:bg-[#111]">
          <Settings2 className="h-3.5 w-3.5" />
          Params {showParams ? '▲' : '▼'}
        </button>
      </div>

      {/* Params */}
      {showParams && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(params).map(([key, val]) => (
            <div key={key}>
              <label className="text-[10px] studio-muted">{key.replace(/_/g, ' ')}</label>
              <input type="number" value={val as number}
                step={key.includes('usd') ? 5000000 : 0.1}
                onChange={e => setParams({ ...params, [key]: parseFloat(e.target.value) || 0 })}
                className="w-full mt-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1 studio-text text-sm" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Results */}
      {signals.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-[#1a1a1a]">
          <table className="w-full text-sm">
            <thead className="bg-[#111]">
              <tr className="border-b border-[#1a1a1a]">
                <th className="text-left p-3 studio-muted text-[10px] uppercase tracking-wider">Ticker</th>
                <th className="text-left p-3 studio-muted text-[10px] uppercase tracking-wider">Date</th>
                <th className="text-right p-3 studio-muted text-[10px] uppercase tracking-wider">Close</th>
                <th className="text-right p-3 studio-muted text-[10px] uppercase tracking-wider">Gap%</th>
                <th className="text-right p-3 studio-muted text-[10px] uppercase tracking-wider">ABS</th>
                <th className="text-right p-3 studio-muted text-[10px] uppercase tracking-wider">Slope</th>
                <th className="text-right p-3 studio-muted text-[10px] uppercase tracking-wider">Volume</th>
                <th className="text-center p-3 studio-muted text-[10px] uppercase tracking-wider">Chart</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={i} className="border-b border-[#1a1a1a]/50 hover:bg-[#161616] transition-colors">
                  <td className="p-3 font-bold text-primary">{s.ticker}</td>
                  <td className="p-3 studio-text text-xs">{String(s.date).split('T')[0]}</td>
                  <td className="p-3 studio-text text-right">${s.close?.toFixed(2)}</td>
                  <td className="p-3 text-right text-green-400 font-medium">{s.gap_pct?.toFixed(1)}%</td>
                  <td className="p-3 studio-text text-right text-xs">{s.pos_abs?.toFixed(3)}</td>
                  <td className="p-3 studio-text text-right">{s.slope5d?.toFixed(1)}</td>
                  <td className="p-3 studio-muted text-right text-xs">{s.volume ? (s.volume / 1e6).toFixed(1) + 'M' : '—'}</td>
                  <td className="p-3 text-center">
                    <a href={`/charts-terminal.html?symbol=${s.ticker}`} className="text-primary hover:text-primary/80 transition-colors inline-flex">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && !error ? (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-8 text-center">
          <Search className="h-10 w-10 mx-auto studio-muted opacity-30 mb-3" />
          <p className="studio-text font-medium text-sm">Configure and run a scan</p>
          <p className="studio-muted text-xs mt-1">Scans 16,000+ US equities via Polygon.io grouped daily</p>
        </div>
      ) : null}
    </div>
    </AppLayout>
  )
}
