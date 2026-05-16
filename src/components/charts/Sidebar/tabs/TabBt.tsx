'use client'

/**
 * TabBt — Backtest controls for saved scans: side, entry, stop, target, risk.
 * Also supports CSV upload of manual trade logs.
 */

import { useState, useCallback } from 'react'
import { useBacktestStore } from '@/stores/charts/backtestStore'
import { useChartStore } from '@/stores/charts/chartStore'
import { useUIStore } from '@/stores/charts/uiStore'

interface BTStat {
  trades: number
  pnl: number
  winRate: number
  avgWin: number
  avgLoss: number
  best: number
  worst: number
}

function parseCSV(text: string): any[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const trades: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim())
    if (vals.length < 2) continue
    const row: any = {}
    headers.forEach((h, j) => { row[h] = vals[j] || '' })
    // Normalize fields
    row.date = row.date || row.entry_date || row.d || ''
    row.symbol = row.symbol || row.ticker || row.sym || row.s || ''
    row.side = row.side || row.direction || 'long'
    row.entryPrice = parseFloat(row.entry_price || row.entry || row.ep || row.entryprice || '0')
    row.exitPrice = parseFloat(row.exit_price || row.exit || row.xp || row.exitprice || '0')
    row.pnl = parseFloat(row.pnl || row.profit || row.r || row.result || '0')
    row.quantity = parseFloat(row.quantity || row.qty || row.shares || row.q || '0')
    if (row.date) trades.push(row)
  }
  return trades
}

function calcStats(trades: any[]): BTStat {
  if (!trades.length) return { trades: 0, pnl: 0, winRate: 0, avgWin: 0, avgLoss: 0, best: 0, worst: 0 }
  const wins = trades.filter(t => t.pnl > 0)
  const losses = trades.filter(t => t.pnl < 0)
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  return {
    trades: trades.length,
    pnl: totalPnl,
    winRate: (wins.length / trades.length) * 100,
    avgWin: wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0,
    avgLoss: losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0,
    best: trades.length ? Math.max(...trades.map(t => t.pnl || 0)) : 0,
    worst: trades.length ? Math.min(...trades.map(t => t.pnl || 0)) : 0,
  }
}

const fmtD = (v: number) => v >= 0 ? `+$${v.toFixed(2)}` : `-$${Math.abs(v).toFixed(2)}`
const fmtPct = (v: number) => v.toFixed(1) + '%'

export function TabBt() {
  const [trades, setTrades] = useState<any[]>([])
  const [stats, setStats] = useState<BTStat>({ trades: 0, pnl: 0, winRate: 0, avgWin: 0, avgLoss: 0, best: 0, worst: 0 })
  const [selectedTrade, setSelectedTrade] = useState<number | null>(null)

  const btStrategyMode = useUIStore(s => s.btStrategyMode)
  const setBtStrategyMode = useUIStore(s => s.setBtStrategyMode)
  const setBtTrades = useBacktestStore(s => s.setBtTrades)
  const setBtMarkers = useBacktestStore(s => s.setBtMarkers)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      setTrades(parsed)
      setStats(calcStats(parsed))
      setBtTrades(parsed)

      // Create BT markers for chart highlighting
      const markers = parsed.map(t => ({
        type: t.side?.toLowerCase() === 'short' ? 'exit' : 'entry',
        price: t.entryPrice || 0,
        date: t.date || '',
        time: t.date || '',
        label: t.symbol || '',
      }))
      setBtMarkers(markers)
      ;(window as any).btMarkers = markers
      ;(window as any).btStrategyMode = btStrategyMode
    }
    reader.readAsText(file)
  }, [setBtTrades, setBtMarkers, btStrategyMode])

  const handleTradeClick = useCallback((trade: any, idx: number) => {
    setSelectedTrade(idx)
    // Highlight trade date range on chart
    ;(window as any).btHighlightDates = true
    ;(window as any).btSelected = { date: trade.date, symbol: trade.symbol }
  }, [])

  const handleHighlightToggle = useCallback(() => {
    const current = useUIStore.getState().btHighlightDates
    useUIStore.getState().setBtHighlightDates(!current)
  }, [])

  const selectStyle: React.CSSProperties = { width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }
  const inputStyle: React.CSSProperties = { width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 10, color: '#4a6080', fontWeight: 700, letterSpacing: 0.8, marginBottom: 4 }

  return (
    <div id="tab-bt">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 1 }}>⏱ BACKTEST</span>
        <button
          style={{
            background: useUIStore.getState().btHighlightDates ? '#f59e0b' : '#1a1e2a',
            border: '1px solid #f59e0b',
            color: useUIStore.getState().btHighlightDates ? '#000' : '#f59e0b',
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
          }}
          onClick={handleHighlightToggle}
        >HLDT</button>
      </div>

      {/* CSV Upload */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620' }}>
        <div style={{ ...labelStyle, marginBottom: 6 }}>UPLOAD TRADES CSV</div>
        <input
          type="file"
          accept=".csv"
          style={{ width: '100%', fontSize: 11, color: '#8aa0c0', cursor: 'pointer' }}
          onChange={handleFileUpload}
        />
        <div style={{ fontSize: 9, color: '#3a4560', marginTop: 4 }}>
          Columns: date, symbol, side, entry_price, exit_price, pnl, quantity
        </div>
      </div>

      {/* Stats */}
      {stats.trades > 0 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11 }}>
            <StatRow label="TRADES" value={String(stats.trades)} />
            <StatRow label="TOTAL PNL" value={fmtD(stats.pnl)} color={stats.pnl >= 0 ? '#26a69a' : '#ef5350'} />
            <StatRow label="WIN RATE" value={fmtPct(stats.winRate)} color={stats.winRate >= 50 ? '#26a69a' : '#ef5350'} />
            <StatRow label="AVG WIN" value={fmtD(stats.avgWin)} color="#26a69a" />
            <StatRow label="AVG LOSS" value={fmtD(stats.avgLoss)} color="#ef5350" />
            <StatRow label="BEST" value={fmtD(stats.best)} color="#26a69a" />
            <StatRow label="WORST" value={fmtD(stats.worst)} color="#ef5350" />
          </div>
        </div>
      )}

      {/* Strategy Mode */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #111620' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={{
              flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: btStrategyMode === 'long' ? '1px solid #26a69a' : '1px solid #2a3050',
              background: btStrategyMode === 'long' ? '#26a69a18' : 'none',
              color: btStrategyMode === 'long' ? '#26a69a' : '#4a5580',
            }}
            onClick={() => { setBtStrategyMode('long'); (window as any).btStrategyMode = 'long' }}
          >▲ LONG</button>
          <button
            style={{
              flex: 1, padding: '3px 0', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: btStrategyMode === 'short' ? '1px solid #ef5350' : '1px solid #2a3050',
              background: btStrategyMode === 'short' ? '#ef535018' : 'none',
              color: btStrategyMode === 'short' ? '#ef5350' : '#4a5580',
            }}
            onClick={() => { setBtStrategyMode('short'); (window as any).btStrategyMode = 'short' }}
          >▼ SHORT</button>
        </div>
      </div>

      {/* Trade List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {trades.map((t, i) => (
          <div
            key={i}
            onClick={() => handleTradeClick(t, i)}
            style={{
              padding: '4px 12px',
              display: 'grid',
              gridTemplateColumns: '70px 45px 1fr 1fr 60px',
              gap: 6,
              fontSize: 10,
              alignItems: 'center',
              background: selectedTrade === i ? '#1a2040' : (i % 2 === 0 ? 'transparent' : '#0a0c12'),
              cursor: 'pointer',
              borderBottom: '1px solid #0a0c14',
            }}
          >
            <span style={{ color: '#8aa0c0' }}>{t.date?.slice(0, 10)}</span>
            <span style={{ color: '#dde3f0', fontWeight: 700, fontSize: 9 }}>{t.symbol}</span>
            <span style={{ color: t.entryPrice ? '#dde3f0' : '#4a6080' }}>{t.entryPrice?.toFixed(2) || '—'}</span>
            <span style={{ color: t.exitPrice ? '#dde3f0' : '#4a6080' }}>{t.exitPrice?.toFixed(2) || '—'}</span>
            <span style={{ color: t.pnl >= 0 ? '#26a69a' : '#ef5350', fontWeight: 700, textAlign: 'right' }}>
              {t.pnl >= 0 ? '+' : ''}{(t.pnl || 0).toFixed(2)}
            </span>
          </div>
        ))}
        {trades.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: '#3a4560' }}>
            Upload a CSV file to see trades here
          </div>
        )}
      </div>

      {/* Scan BT Config (kept for scan-based backtesting) */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #111620', display: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={labelStyle}>ENTRY</div>
            <select id="scan-bt-entry" style={selectStyle}>
              <option value="next_open">Next day open</option>
              <option value="trigger_break">Trigger break</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>STOP</div>
            <select id="scan-bt-stop" style={selectStyle}>
              <option value="signal">Setup bar</option>
              <option value="pct">Fixed % stop</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <>
      <span style={{ color: '#4a6080', fontSize: 10, fontWeight: 600 }}>{label}</span>
      <span style={{ color: color || '#dde3f0', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </>
  )
}
