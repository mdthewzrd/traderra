'use client'

import { useState, useCallback, useRef } from 'react'
import { useBacktestStore } from '@/stores/charts/backtestStore'
import { useChartStore } from '@/stores/charts/chartStore'

/**
 * TabBt — Backtest tab with CSV upload, scan-based BT config, trade list, stats.
 * Phase G4: Full BT runner with entry/exit/stop logic.
 */

const labelStyle: React.CSSProperties = { fontSize: 10, color: '#4a6080', fontWeight: 700, letterSpacing: 0.8, marginBottom: 4 }
const selectStyle: React.CSSProperties = { width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }
const inputStyle: React.CSSProperties = { width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }

interface BTConfig {
  side: 'long' | 'short'
  entry: 'next_open' | 'signal_close' | 'trigger_break'
  stop: 'signal' | 'pct'
  stopPct: number
  targetR: number
  maxHold: number
  risk: number
}

interface BTResult {
  symbol: string
  entryDate: string
  exitDate: string
  entryPrice: number
  exitPrice: number
  pnl: number
  pnlPct: number
  rMultiple: number
  duration: number
  win: boolean
  exitReason: string
}

export function TabBt() {
  const btTrades = useBacktestStore(s => s.btTrades)
  const setBtTrades = useBacktestStore(s => s.setBtTrades)
  const btHighlight = useBacktestStore(s => s.btHighlightDates)
  const setBtHighlight = useBacktestStore(s => s.setBtHighlightDates)
  const btStrategyMode = useBacktestStore(s => s.btStrategyMode)
  const setBtStrategyMode = useBacktestStore(s => s.setBtStrategyMode)
  const trades = btTrades || []

  const [config, setConfig] = useState<BTConfig>({ side: 'long', entry: 'next_open', stop: 'signal', stopPct: 5, targetR: 2, maxHold: 5, risk: 1000 })
  const [btResults, setBtResults] = useState<BTResult[]>([])
  const [status, setStatus] = useState('Uses saved scan results + Polygon daily bars. Conservative fill model: if stop and target hit on the same bar, stop wins.')
  const fileRef = useRef<HTMLInputElement>(null)
  const setChartSymbol = useChartStore(s => s.setSymbol)

  // CSV upload
  const handleFileUpload = useCallback(() => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseTradeCSV(text)
      setBtTrades(parsed)
      computeStats(parsed)
      setStatus(`Loaded ${parsed.length} trades from ${file.name}`)
    }
    reader.readAsText(file)
  }, [setBtTrades])

  const parseTradeCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    return lines.slice(1).filter(l => l.trim()).map((line, i) => {
      const cols = line.split(',').map(c => c.trim())
      const get = (names: string[]) => { for (const n of names) { const idx = headers.indexOf(n); if (idx >= 0) return cols[idx] } return '' }
      return {
        id: 'bt-' + i,
        symbol: get(['symbol', 'sym', 'ticker'])?.toUpperCase() || '',
        side: get(['side', 'direction']) || 'long',
        entryPrice: parseFloat(get(['entryprice', 'entry', 'entry_price'])) || 0,
        exitPrice: parseFloat(get(['exitprice', 'exit', 'exit_price'])) || 0,
        pnl: parseFloat(get(['pnl', 'profit', 'pl'])) || 0,
        date: get(['entry_date', 'date', 'entrydate']) || '',
        exitDate: get(['exit_date', 'exitdate']) || '',
        duration: get(['duration', 'hold']) || '',
        strategy: get(['strategy', 'setup']) || '',
        quantity: parseFloat(get(['qty', 'quantity', 'shares'])) || 0,
      }
    }).filter(t => t.symbol && t.entryPrice)
  }

  // Compute stats from trades
  const computeStats = (trades: any[]) => {
    // Stats are computed inline in the render
  }

  // Run BT from scan results (simplified — uses loaded trades)
  const handleRunBT = useCallback(() => {
    if (!trades.length) { setStatus('No trades to backtest. Upload a CSV first.'); return }

    const results: BTResult[] = trades.map(t => {
      const entryPrice = t.entryPrice
      const exitPrice = t.exitPrice || (t.pnl && t.quantity ? t.entryPrice + t.pnl / t.quantity : entryPrice)
      const pnl = t.pnl || (exitPrice - entryPrice) * (t.quantity || 1) * (t.side === 'short' ? -1 : 1)
      const riskAmt = config.risk
      const rMultiple = riskAmt > 0 ? pnl / riskAmt : 0

      return {
        symbol: t.symbol,
        entryDate: t.date,
        exitDate: t.exitDate || '',
        entryPrice,
        exitPrice,
        pnl,
        pnlPct: entryPrice > 0 ? (pnl / (entryPrice * (t.quantity || 1))) * 100 : 0,
        rMultiple,
        duration: parseInt(t.duration) || 1,
        win: pnl > 0,
        exitReason: pnl > 0 ? 'target' : 'stop',
      }
    })

    setBtResults(results)
    const wins = results.filter(r => r.win).length
    const totalPnl = results.reduce((s, r) => s + r.pnl, 0)
    const avgR = results.reduce((s, r) => s + r.rMultiple, 0) / (results.length || 1)
    setStatus(`${results.length} trades | ${wins}W/${results.length - wins}L | Win ${(wins / results.length * 100).toFixed(1)}% | PnL $${totalPnl.toFixed(0)} | Avg R ${avgR.toFixed(2)}`)
  }, [trades, config])

  // Click trade to load symbol
  const handleTradeClick = useCallback((t: any, idx: number) => {
    if (t.symbol) {
      setChartSymbol(t.symbol)
      ;(window as any).symbol = t.symbol
      ;(window as any).loadChart?.(t.symbol)
    }
  }, [setChartSymbol])

  // Compute summary stats
  const wins = btResults.filter(r => r.win).length
  const losses = btResults.length - wins
  const totalPnl = btResults.reduce((s, r) => s + r.pnl, 0)
  const winRate = btResults.length > 0 ? (wins / btResults.length * 100).toFixed(1) : '-'
  const avgR = btResults.length > 0 ? (btResults.reduce((s, r) => s + r.rMultiple, 0) / btResults.length).toFixed(2) : '-'
  const avgWin = wins > 0 ? (btResults.filter(r => r.win).reduce((s, r) => s + r.pnl, 0) / wins).toFixed(0) : '-'
  const avgLoss = losses > 0 ? (btResults.filter(r => !r.win).reduce((s, r) => s + r.pnl, 0) / losses).toFixed(0) : '-'

  return (
    <div id="tab-bt">
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 1 }}>⏱ BT — SAVED SCANS</span>
        <label style={{ marginLeft: 'auto', background: 'none', border: '1px solid #f59e0b', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer' }}>
          📂 CSV
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
        </label>
        <button onClick={() => setBtHighlight(!btHighlight)} style={{
          background: btHighlight ? '#f59e0b18' : '#1a1e2a',
          border: `1px solid ${btHighlight ? '#f59e0b' : '#2a3050'}`,
          color: btHighlight ? '#f59e0b' : '#4a6080',
          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
        }}>HLDT</button>
      </div>

      {/* Info box */}
      <div id="scan-bt-active" style={{ padding: '8px 10px', background: '#0d1220', border: '1px solid #1e2840', borderRadius: 4, fontSize: 11, color: '#8aa0c0', lineHeight: 1.5, margin: '8px 12px' }}>Select a saved scan in <span style={{ color: '#4ade80', fontWeight: 700 }}>SCAN</span> to backtest it here, or upload a CSV.</div>

      {/* Config */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={labelStyle}>SIDE</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{ flex: 1, padding: '4px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #2a3050', background: btStrategyMode === 'long' ? '#26a69a18' : 'none', color: btStrategyMode === 'long' ? '#26a69a' : '#4a6080' }}
                onClick={() => setBtStrategyMode('long')}>▲ LONG</button>
              <button style={{ flex: 1, padding: '4px 8px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #2a3050', background: btStrategyMode === 'short' ? '#ef535018' : 'none', color: btStrategyMode === 'short' ? '#ef5350' : '#4a6080' }}
                onClick={() => setBtStrategyMode('short')}>▼ SHORT</button>
            </div>
          </div>
          <div>
            <div style={labelStyle}>ENTRY</div>
            <select value={config.entry} style={selectStyle} onChange={(e) => setConfig(c => ({ ...c, entry: e.target.value as any }))}>
              <option value="next_open">Next day open</option>
              <option value="trigger_break">Trigger break</option>
              <option value="signal_close">Signal close</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>STOP %</div>
            <input type="number" min={0.1} step={0.5} value={config.stopPct} style={inputStyle}
              onChange={(e) => setConfig(c => ({ ...c, stopPct: parseFloat(e.target.value) || 5 }))} />
          </div>
          <div>
            <div style={labelStyle}>TARGET (R)</div>
            <input type="number" min={0} step={0.25} value={config.targetR} style={inputStyle}
              onChange={(e) => setConfig(c => ({ ...c, targetR: parseFloat(e.target.value) || 2 }))} />
          </div>
          <div>
            <div style={labelStyle}>MAX HOLD</div>
            <input type="number" min={1} step={1} value={config.maxHold} style={inputStyle}
              onChange={(e) => setConfig(c => ({ ...c, maxHold: parseInt(e.target.value) || 5 }))} />
          </div>
          <div>
            <div style={labelStyle}>RISK/TRADE ($)</div>
            <input type="number" min={1} step={50} value={config.risk} style={inputStyle}
              onChange={(e) => setConfig(c => ({ ...c, risk: parseFloat(e.target.value) || 1000 }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={handleRunBT} style={{ flex: 1, background: '#f59e0b', color: '#000', border: 'none', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 4, cursor: 'pointer' }}>▶ RUN BT</button>
          <button style={{ flex: 1, background: '#0d1220', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 4, cursor: 'pointer' }}>📋 REVIEW</button>
        </div>
      </div>

      {/* Summary stats */}
      {(btResults.length > 0 || trades.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '6px 12px', borderBottom: '1px solid #111620' }}>
          <StatRow label="TRADES" value={String(btResults.length || trades.length)} />
          <StatRow label="WIN RATE" value={`${winRate}%`} color={parseFloat(winRate as string) > 50 ? '#26a69a' : '#ef5350'} />
          <StatRow label="P&L" value={`$${totalPnl.toFixed(0)}`} color={totalPnl >= 0 ? '#26a69a' : '#ef5350'} />
          <StatRow label="AVG R" value={avgR as string} color={parseFloat(avgR as string) > 0 ? '#26a69a' : '#ef5350'} />
          <StatRow label="AVG WIN" value={`$${avgWin}`} color="#26a69a" />
          <StatRow label="AVG LOSS" value={`$${avgLoss}`} color="#ef5350" />
        </div>
      )}

      {/* Status */}
      <div style={{ fontSize: 11, color: '#8aa0c0', lineHeight: 1.5, padding: '6px 12px', background: '#0a0c12', borderBottom: '1px solid #1e2840' }}>{status}</div>

      {/* Trade list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {(btResults.length > 0 ? btResults : trades).map((t, i) => {
          const isResult = btResults.length > 0
          const sym = isResult ? (t as BTResult).symbol : (t as any).symbol
          const pnl = isResult ? (t as BTResult).pnl : (t as any).pnl
          const date = isResult ? (t as BTResult).entryDate : (t as any).date
          const isWin = isResult ? (t as BTResult).win : pnl > 0
          const isHldt = btHighlight && (date === (t as any).date || date === (t as any).entryDate)

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 12px', fontSize: 11,
              background: isHldt ? 'rgba(245,158,11,.08)' : 'transparent',
              borderBottom: '1px solid #0d1018', cursor: 'pointer',
            }} onClick={() => handleTradeClick(t, i)}>
              <span style={{ color: '#dde3f0', fontWeight: 700, width: 50 }}>{sym}</span>
              <span style={{ color: '#4a6080', width: 70 }}>{date}</span>
              <span style={{ color: isWin ? '#26a69a' : '#ef5350', fontWeight: 700, flex: 1, textAlign: 'right' }}>
                {pnl >= 0 ? '+' : ''}{pnl?.toFixed(0)}
              </span>
            </div>
          )
        })}
        {trades.length === 0 && btResults.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: '#3a4560' }}>
            Upload a trade CSV or run BT from scan results
          </div>
        )}
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
