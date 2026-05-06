'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Activity, Play, Loader2, TrendingUp, TrendingDown, BarChart3, Shield } from 'lucide-react'

interface Metric { label: string; value: string; color?: string }

export default function BacktestPage() {
  const [scanner, setScanner] = useState('backside_b')
  const [entry, setEntry] = useState('d0_open')
  const [stop, setStop] = useState('d0_low')
  const [sizing, setSizing] = useState('fixed_r')
  const [riskPerTrade, setRiskPerTrade] = useState(1000)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Metric[]>([])

  const runBacktest = async () => {
    setLoading(true)
    // TODO: Wire to actual vectorbt backtest engine via API
    setTimeout(() => {
      setResults([
        { label: 'Total Trades', value: '—' },
        { label: 'Win Rate', value: '—', color: 'text-green-400' },
        { label: 'Profit Factor', value: '—' },
        { label: 'Sharpe Ratio', value: '—' },
        { label: 'Max Drawdown', value: '—', color: 'text-red-400' },
        { label: 'Avg R-Multiple', value: '—' },
        { label: 'Avg Win', value: '—', color: 'text-green-400' },
        { label: 'Avg Loss', value: '—', color: 'text-red-400' },
      ])
      setLoading(false)
    }, 1500)
  }

  return (
    <AppLayout>
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold studio-text flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Strategy Backtest
        </h1>
        <span className="text-xs studio-muted">vectorbt engine · WFO validation</span>
      </div>

      {/* Strategy Config */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Scanner</label>
          <select value={scanner} onChange={e => setScanner(e.target.value)}
            className="block mt-1 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm">
            <option value="backside_b">Backside B</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Entry</label>
          <select value={entry} onChange={e => setEntry(e.target.value)}
            className="block mt-1 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm">
            <option value="d0_open">D0 Open</option>
            <option value="d0_vwap">D0 VWAP</option>
            <option value="d1_open">D1 Open</option>
            <option value="d1_or_high">D1 OR High</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Stop</label>
          <select value={stop} onChange={e => setStop(e.target.value)}
            className="block mt-1 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm">
            <option value="d0_low">D0 Low</option>
            <option value="2x_atr">2× ATR Trail</option>
            <option value="1x_atr">1× ATR Fixed</option>
            <option value="or_low">OR Low</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Sizing</label>
          <select value={sizing} onChange={e => setSizing(e.target.value)}
            className="block mt-1 w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm">
            <option value="fixed_r">Fixed R ($)</option>
            <option value="pct_equity">% Equity</option>
            <option value="kelly">Kelly Fraction</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] studio-muted uppercase tracking-wider">Risk/Trade</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs studio-muted">$</span>
            <input type="number" value={riskPerTrade} onChange={e => setRiskPerTrade(+e.target.value)}
              step={100} className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1.5 studio-text text-sm" />
          </div>
        </div>
      </div>

      <button onClick={runBacktest} disabled={loading}
        className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-1.5 px-5 rounded text-sm flex items-center gap-2 transition-colors">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {loading ? 'Running...' : 'Run Backtest'}
      </button>

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Equity Curve */}
        <div className="lg:col-span-2 bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
          <div className="text-[10px] studio-muted uppercase tracking-wider mb-2">Equity Curve</div>
          <div className="h-40 flex items-center justify-center studio-muted text-xs">
            {loading ? (
              <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Running backtest...</div>
            ) : results.length ? (
              <span>Equity curve visualization — requires API connection</span>
            ) : (
              <span>Configure strategy and click Run Backtest</span>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {(results.length ? results : [
            { label: 'Trades', value: '—' }, { label: 'Win Rate', value: '—' },
            { label: 'Sharpe', value: '—' }, { label: 'Max DD', value: '—' },
            { label: 'PF', value: '—' }, { label: 'Avg R', value: '—' },
            { label: 'Avg Win', value: '—' }, { label: 'Avg Loss', value: '—' },
          ]).map(m => (
            <div key={m.label} className="bg-[#0a0a0a] rounded-lg p-2.5">
              <div className="text-[10px] studio-muted">{m.label}</div>
              <div className={`text-base font-bold ${m.color || 'studio-text'}`}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Shield, label: 'Walk-Forward', desc: 'Anchored WFO with 5 folds' },
          { icon: BarChart3, label: 'Monte Carlo', desc: '10,000 permutation shuffle' },
          { icon: TrendingUp, label: 'Robustness', desc: 'Parameter sensitivity grid' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 text-center">
            <Icon className="h-4 w-4 mx-auto studio-muted mb-1" />
            <div className="text-[10px] studio-muted uppercase tracking-wider">{label}</div>
            <div className="text-xl font-bold text-gray-600 mt-1">—</div>
            <div className="text-[9px] studio-muted mt-0.5">{desc}</div>
          </div>
        ))}
      </div>
    </div>
    </AppLayout>
  )
}
