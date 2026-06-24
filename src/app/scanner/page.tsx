'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  BarChart3, TrendingUp, List, MessageSquare,
  Plus, ExternalLink, Calendar, Zap, Activity,
  ArrowUpRight, Hash, DollarSign, Target, Layers,
  Clock, TrendingDown, Minus, Send, Play, Rows3,
  LayoutGrid, X, Settings2, Save, Sun, Moon, Shield
} from 'lucide-react'

// ─── Built-in Scans (shared with SCAN tab) ─────────────
const BUILTIN_SCANS: ScanDef[] = [
  // ── MDR Swing > Scans ──
  { id: 'builtin-mdr-swing', name: 'MDR Swing', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['mdr-swing'], group: 'mdr-swing/scans', filters: ['am-push'] },
  // ── MDR Swing > Backtests ──
  { id: 'builtin-mdr-backtest', name: 'MDR Backtest', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['mdr-fixed', 'mdr-backtest'], group: 'mdr-swing/backtests', filters: ['am-push'] },
  { id: 'builtin-mdr-signals', name: 'MDR Signals', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['mdr-signals'], group: 'mdr-swing/scans', filters: ['am-push'] },
  // ── Standalone ──
  { id: 'builtin-backside-b', name: 'Backside B', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['backside-b'], group: 'standalone', filters: ['am-push'] },
  { id: 'builtin-gap-up', name: 'Gap Up', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['gap-up'], group: 'standalone' },
  { id: 'builtin-high-tight-flag', name: 'High Tight Flag', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['htf'], group: 'standalone' },
  { id: 'builtin-aparascan', name: 'Aparascan', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['aparascan'], group: 'standalone' },
  { id: 'builtin-sc-dmr', name: 'SC DMR', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['sc-dmr'], group: 'standalone' },
  { id: 'builtin-short-fbo', name: 'Short FBO', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['short-fbo'], group: 'standalone' },
  { id: 'builtin-short-fbo-2', name: 'Short FBO 2', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['short-fbo-2'], group: 'standalone' },
  { id: 'builtin-half-a', name: 'Half A', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['half-a'], group: 'standalone' },
  { id: 'builtin-half-a-other', name: 'Other Half A', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['half-a-other'], group: 'standalone' },
  // ── OG Scans ──
  { id: 'builtin-og-scans-master', name: 'Master', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-scans-master', 'lc', 'mean-reversion'], group: 'og-scans' },
  { id: 'builtin-og-lc-fbo', name: 'LC FBO', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-fbo', 'lc', 'fbo'], group: 'og-scans' },
  { id: 'builtin-og-lc-frontside-d2', name: 'Frontside D2', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-frontside-d2', 'lc', 'frontside'], group: 'og-scans' },
  { id: 'builtin-og-lc-backside-d2', name: 'Backside D2', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-backside-d2', 'lc', 'backside'], group: 'og-scans' },
  { id: 'builtin-og-lc-frontside-d3-ext1', name: 'Frontside D3 Ext1', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-frontside-d3-ext1', 'lc', 'frontside', 'd3'], group: 'og-scans' },
  { id: 'builtin-og-lc-frontside-d3-ext2', name: 'Frontside D3 Ext2', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-frontside-d3-ext2', 'lc', 'frontside', 'd3'], group: 'og-scans' },
  { id: 'builtin-og-lc-frontside-d3-uptrend', name: 'Frontside D3 Uptrend', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-frontside-d3-uptrend', 'lc', 'frontside', 'd3'], group: 'og-scans' },
  { id: 'builtin-og-lc-frontside-d4-para', name: 'Frontside D4 Para', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-frontside-d4-para', 'lc', 'frontside', 'parabolic'], group: 'og-scans' },
  { id: 'builtin-og-lc-backside-d3-ext1', name: 'Backside D3 Ext1', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-backside-d3-ext1', 'lc', 'backside', 'd3'], group: 'og-scans' },
  { id: 'builtin-og-lc-backside-d3-ext2', name: 'Backside D3 Ext2', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-backside-d3-ext2', 'lc', 'backside', 'd3'], group: 'og-scans' },
  { id: 'builtin-og-lc-backside-d3', name: 'Backside D3', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-backside-d3', 'lc', 'backside', 'd3'], group: 'og-scans' },
  { id: 'builtin-og-lc-backside-d4-para', name: 'Backside D4 Para', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-backside-d4-para', 'lc', 'backside', 'parabolic'], group: 'og-scans' },
  { id: 'builtin-og-lc-frontside-d2-uptrend', name: 'Frontside D2 Uptrend', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['og-lc-frontside-d2-uptrend', 'lc', 'frontside', 'd2'], group: 'og-scans' },
  { id: 'builtin-frd-gap', name: 'FRD Gap', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['frd-gap', 'mean-reversion'], group: 'mikes-scans/mean-reversion' },
  { id: 'builtin-frd-gap-lc', name: 'FRD Gap LC', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['frd-gap-lc', 'mean-reversion'], group: 'mikes-scans/mean-reversion' },
  { id: 'builtin-d1-gap', name: 'D1 Gap', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['d1-gap', 'parabolic', 'micro-cap'], group: 'mikes-scans/parabolic' },
]

// Tree structure: project folders with subfolder groups
const SCAN_TREE: { id: string; label: string; order: number; subfolders?: { id: string; label: string }[] }[] = [
  { id: 'mdr-swing', label: 'MDR Swing', order: 0, subfolders: [
    { id: 'scans', label: 'Scans' },
    { id: 'backtests', label: 'Backtests' },
  ]},
  { id: 'og-scans', label: 'OG Scans', order: 1 },
  { id: 'standalone', label: 'Standalone', order: 2 },
  { id: 'mikes-scans', label: "Mike's Scans", order: -1, subfolders: [
    { id: 'mean-reversion', label: 'Mean Reversion' },
    { id: 'parabolic', label: 'Parabolic' },
  ]},
]

const BUILTIN_SPEC_MAP: Record<string, string> = {
  'builtin-backside-b': 'backside-b',
  'builtin-gap-up': 'gap-up',
  'builtin-high-tight-flag': 'high-tight-flag',
  'builtin-aparascan': 'aparascan',
  'builtin-mdr-swing': 'mdr-swing',
  'builtin-mdr-backtest': 'mdr-fixed',
  'builtin-mdr-signals': 'mdr-signals',
  'builtin-sc-dmr': 'sc-dmr',
  'builtin-short-fbo': 'short-fbo',
  'builtin-short-fbo-2': 'short-fbo-2',
  'builtin-half-a': 'half-a',
  'builtin-half-a-other': 'half-a-other',
  'builtin-og-scans-master': 'og-scans-master',
  'builtin-og-lc-fbo': 'og-lc-fbo',
  'builtin-og-lc-frontside-d2': 'og-lc-frontside-d2',
  'builtin-og-lc-backside-d2': 'og-lc-backside-d2',
  'builtin-og-lc-frontside-d3-ext1': 'og-lc-frontside-d3-ext1',
  'builtin-og-lc-frontside-d3-ext2': 'og-lc-frontside-d3-ext2',
  'builtin-og-lc-frontside-d3-uptrend': 'og-lc-frontside-d3-uptrend',
  'builtin-og-lc-frontside-d4-para': 'og-lc-frontside-d4-para',
  'builtin-og-lc-backside-d3-ext1': 'og-lc-backside-d3-ext1',
  'builtin-og-lc-backside-d3-ext2': 'og-lc-backside-d3-ext2',
  'builtin-og-lc-backside-d3': 'og-lc-backside-d3',
  'builtin-og-lc-backside-d4-para': 'og-lc-backside-d4-para',
  'builtin-og-lc-frontside-d2-uptrend': 'og-lc-frontside-d2-uptrend',
  'builtin-frd-gap': 'frd-gap',
  'builtin-frd-gap-lc': 'frd-gap-lc',
  'builtin-d1-gap': 'd1-gap',
}

// ─── Types ──────────────────────────────────────────────
interface Signal {
  ticker: string
  symbol: string
  date: string
  signal: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  gap_pct?: number
  pos_abs?: number
  signals?: string[]  // multi-signal: list of signal types
  [key: string]: any
}

interface ScanDef {
  id: string
  name: string
  type: string
  resultCount: number
  createdAt: string
  tags?: string[]
  group?: string
  filters?: string[]  // available filter toggles for this scan (e.g. 'am-push')
  runs?: ScanRun[]
}

interface ScanRun {
  id: string
  scanId: string
  dateRange: string
  runAt: string
  resultCount: number
  tags?: string[]
  strategy?: string
  rawParams?: Record<string, any> | null
  rawDateRange?: { from?: string; to?: string } | null
}

type Timeframe = '5' | '15' | '60' | 'D'
type ChartMode = 'single' | 'stacked'
type PageMode = 'scanner' | 'backtest'

interface BacktestResults {
  entryType: string
  exitType: string
  totalTrades: number
  winRate: number
  profitFactor: number
  sharpe: number
  sortino: number
  calmar: number
  maxDrawdown: number
  maxDDDuration: number
  avgRMultiple: number
  medianR: number
  avgWinPct: number
  avgLossPct: number
  expectancy: number
  expectancyPct: number
  wlRatio: number
  totalPnl: number
  totalReturnPct: number
  cagr: number
  avgTradeDuration: string
  maxConsecWins: number
  maxConsecLosses: number
  bestTrade: number
  worstTrade: number
  stdDevReturns: number
  downsideDev: number
  recoveryFactor: number
  pctProfitable: number
  grossWin: number
  grossLoss: number
  tradeReturns: number[]
  cumPnlSeries: number[]
  drawdownSeries: number[]
  dayStats: { day: string; pnl: number; count: number }[]
  monthlyStats: { month: string; pnl: number; count: number }[]
}

// ─── Filter Definitions (for backtest mode) ──────────────
interface FilterDef {
  key: string
  label: string
  shortLabel: string
  description: string
  compute: (s: Signal) => boolean
}

const FILTERS: FilterDef[] = [
  { key: 'green', label: 'Green Candle', shortLabel: 'GRN', description: 'Close > Open', compute: (s) => s.close > s.open },
  { key: 'closePos50', label: 'Close > Mid', shortLabel: 'C>50', description: 'Closed above midpoint of range', compute: (s) => { const r = s.high - s.low; return r > 0 ? (s.close - s.low) / r > 0.5 : false } },
  { key: 'closePos75', label: 'Close > 75%ile', shortLabel: 'C>75', description: 'Closed in upper 25% of range', compute: (s) => { const r = s.high - s.low; return r > 0 ? (s.close - s.low) / r > 0.75 : false } },
  { key: 'gapOver100', label: 'Gap > 100%', shortLabel: 'G>1x', description: 'Gap up more than 100%', compute: (s) => (s.gap_pct || 0) > 100 },
  { key: 'gapOver50', label: 'Gap > 50%', shortLabel: 'G>50', description: 'Gap up more than 50%', compute: (s) => (s.gap_pct || 0) > 50 },
  { key: 'volOver10M', label: 'Vol > 10M', shortLabel: 'V>10M', description: 'Volume over 10M', compute: (s) => (s.volume || 0) > 10e6 },
  { key: 'rangeOver5', label: 'Range > 5%', shortLabel: 'R>5%', description: 'Intraday range > 5%', compute: (s) => { const r = s.high - s.low; return s.open > 0 ? (r / s.open) * 100 > 5 : false } },
]

type StatsTab = 'overview' | 'performance' | 'pnl' | 'robustness'

// ─── Shared UI Components (must be before BacktestStatsPanel) ──
function StatBox({ label, value, icon, color, dark: isDark = true }: { label: string; value: string; icon: React.ReactNode; color?: string; dark?: boolean }) {
  const t = isDark ? { SURFACE, BORDER, MUTED } : { SURFACE: LIGHT.SURFACE, BORDER: LIGHT.BORDER, MUTED: LIGHT.MUTED }
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
      <div className="flex items-center gap-1" style={{ color: t.MUTED, fontSize: 9 }}>{icon}{label}</div>
      <div style={{ color: color || GOLD, fontSize: 16, fontWeight: 700, marginTop: 1 }}>{value}</div>
    </div>
  )
}

function Detail({ label, value, color, dark: isDark = true }: { label: string; value: string; color?: string; dark?: boolean }) {
  const t = isDark ? { SURFACE, BORDER, MUTED, TEXT } : { SURFACE: LIGHT.SURFACE, BORDER: LIGHT.BORDER, MUTED: LIGHT.MUTED, TEXT: LIGHT.TEXT }
  return (
    <div style={{ background: t.SURFACE, border: `1px solid ${t.BORDER}`, borderRadius: 3, padding: '2px 6px' }}>
      <span style={{ color: t.MUTED, fontSize: 8, textTransform: 'uppercase' }}>{label} </span>
      <span style={{ color: color || t.TEXT, fontSize: 10, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

// ─── Backtest Stats Panel ───────────────────────────────
function BacktestStatsPanel({ signals, bt, dark }: { signals: Signal[]; bt: BacktestResults | null; dark: boolean }) {
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')
  const C = dark
    ? { SURFACE, SURFACE2, SURFACE3, BORDER, TEXT, TEXT2, MUTED, GOLD, GOLD_DIM, GOLD_BORDER, RED, TEAL }
    : { SURFACE: LIGHT.SURFACE, SURFACE2: LIGHT.SURFACE2, SURFACE3: LIGHT.SURFACE3, BORDER: LIGHT.BORDER, TEXT: LIGHT.TEXT, TEXT2: LIGHT.TEXT2, MUTED: LIGHT.MUTED, GOLD, GOLD_DIM: LIGHT.GOLD_DIM, GOLD_BORDER: LIGHT.GOLD_BORDER, RED: LIGHT.RED, TEAL: LIGHT.TEAL }

  if (!bt) return null
  const btTabs: { key: StatsTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'performance', label: 'Performance' },
    { key: 'pnl', label: 'P&L' },
    { key: 'robustness', label: 'Robustness' },
  ]

  return (
    <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4 }}>
      <div className="flex items-center gap-1" style={{ padding: '4px 6px', borderBottom: `1px solid ${C.BORDER}` }}>
        {btTabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '3px 8px', borderRadius: 2, fontSize: 9, fontWeight: 700,
            background: activeTab === t.key ? C.GOLD : 'transparent',
            color: activeTab === t.key ? '#000' : C.MUTED,
            border: 'none', cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ padding: '8px 10px' }}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 lg:grid-cols-7 gap-1">
            <StatBox label="Trades" value={String(bt.totalTrades)} icon={<List className="h-3 w-3" />} />
            <StatBox label="Win Rate" value={`${bt.winRate.toFixed(1)}%`} icon={<TrendingUp className="h-3 w-3" />} color={bt.winRate >= 50 ? C.TEAL : C.RED} />
            <StatBox label="PF" value={bt.profitFactor.toFixed(2)} icon={<BarChart3 className="h-3 w-3" />} color={bt.profitFactor >= 1.5 ? C.TEAL : C.RED} />
            <StatBox label="Sharpe" value={bt.sharpe.toFixed(2)} icon={<Activity className="h-3 w-3" />} color={bt.sharpe >= 1 ? C.TEAL : C.RED} />
            <StatBox label="Avg Win" value={`${bt.avgWinPct.toFixed(2)}%`} icon={<TrendingUp className="h-3 w-3" />} color={C.TEAL} />
            <StatBox label="Avg Loss" value={`${bt.avgLossPct.toFixed(2)}%`} icon={<TrendingDown className="h-3 w-3" />} color={C.RED} />
            <StatBox label="Max DD" value={`-${bt.maxDrawdown.toFixed(1)}%`} icon={<TrendingDown className="h-3 w-3" />} color={C.RED} />
          </div>
        )}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
            <div style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ color: C.GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Return Distribution</div>
              {(() => {
                const buckets: Record<string, number> = { '< -5%': 0, '-5 to -2%': 0, '-2 to 0%': 0, '0 to +2%': 0, '+2 to +5%': 0, '> +5%': 0 }
                bt.tradeReturns.forEach(r => { if (r < -5) buckets['< -5%']++; else if (r < -2) buckets['-5 to -2%']++; else if (r < 0) buckets['-2 to 0%']++; else if (r < 2) buckets['0 to +2%']++; else if (r < 5) buckets['+2 to +5%']++; else buckets['> +5%']++ })
                const maxB = Math.max(...Object.values(buckets), 1)
                return Object.entries(buckets).map(([label, count]) => {
                  const barCol = label.includes('-') || label.startsWith('<') ? C.RED : C.TEAL
                  return (
                    <div key={label} className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
                      <span style={{ color: C.MUTED, fontSize: 8, width: 56, fontFamily: 'monospace', textAlign: 'right' }}>{label}</span>
                      <div style={{ flex: 1, height: 12, background: C.SURFACE3, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(count / maxB) * 100}%`, background: barCol, borderRadius: 2, minWidth: count > 0 ? 2 : 0 }} />
                      </div>
                      <span style={{ color: C.TEXT2, fontSize: 8, width: 28 }}>{count}</span>
                    </div>
                  )
                })
              })()}
            </div>
            <div style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Monthly Returns</div>
              {bt.monthlyStats.map((m, i) => {
                const col = m.pnl >= 0 ? C.TEAL : C.RED
                const barW = Math.min(Math.abs(m.pnl) * 3, 100)
                return (
                  <div key={i} className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
                    <span style={{ color: C.GOLD, fontSize: 9, fontWeight: 600, width: 36, fontFamily: 'monospace' }}>{m.month.slice(5)}</span>
                    <div style={{ flex: 1, height: 14, background: C.SURFACE3, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: col, borderRadius: 2, opacity: 0.7 }} />
                    </div>
                    <span style={{ color: col, fontSize: 9, fontWeight: 700, width: 48, textAlign: 'right' }}>{m.pnl >= 0 ? '+' : ''}{m.pnl.toFixed(1)}%</span>
                    <span style={{ color: C.MUTED, fontSize: 7, width: 24 }}>{m.count}t</span>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
        {activeTab === 'pnl' && (
          <>
            <div style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px', marginBottom: 4 }}>
              <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Equity Curve</div>
              <EquityChart data={bt.cumPnlSeries} color={bt.cumPnlSeries[bt.cumPnlSeries.length - 1] >= 0 ? C.TEAL : C.RED} height={130} />
            </div>
            <div style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ color: C.RED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Drawdown</div>
              <EquityChart data={bt.drawdownSeries} color={C.RED} height={100} inverted />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1" style={{ marginTop: 4 }}>
              <StatBox label="Total Return" value={`${bt.totalReturnPct > 0 ? '+' : ''}${bt.totalReturnPct.toFixed(1)}%`} icon={<TrendingUp className="h-3 w-3" />} color={bt.totalReturnPct >= 0 ? C.TEAL : C.RED} />
              <StatBox label="Max DD" value={`-${bt.maxDrawdown.toFixed(1)}%`} icon={<TrendingDown className="h-3 w-3" />} color={C.RED} />
              <StatBox label="Recovery Factor" value={bt.recoveryFactor.toFixed(2)} icon={<Activity className="h-3 w-3" />} color={bt.recoveryFactor >= 3 ? C.TEAL : C.RED} />
              <StatBox label="Calmar" value={bt.calmar.toFixed(2)} icon={<BarChart3 className="h-3 w-3" />} color={bt.calmar >= 1 ? C.TEAL : C.RED} />
            </div>
          </>
        )}
        {activeTab === 'robustness' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
            {[
              { icon: <Shield className="h-5 w-5" style={{ color: C.MUTED, marginBottom: 4 }} />, title: 'Walk-Forward Analysis', sub: 'Anchored WFO 5-fold\nIS/OOS degradation' },
              { icon: <BarChart3 className="h-5 w-5" style={{ color: C.MUTED, marginBottom: 4 }} />, title: 'Monte Carlo Simulation', sub: '10K permutations\n95% CI bounds' },
              { icon: <TrendingUp className="h-5 w-5" style={{ color: C.MUTED, marginBottom: 4 }} />, title: 'Parameter Sensitivity', sub: '±20% param sweep\nRobustness score' },
            ].map(item => (
              <div key={item.title} style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>{item.icon}</div>
                <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{item.title}</div>
                <div style={{ color: C.TEXT2, fontSize: 20, fontWeight: 700, marginTop: 6 }}>—</div>
                <div style={{ color: C.MUTED, fontSize: 8, marginTop: 2, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{item.sub}</div>
                <div style={{ color: C.SURFACE3, fontSize: 7, marginTop: 6 }}>Not yet computed</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EquityChart({ data, color, height, inverted }: { data: number[]; color: string; height: number; inverted?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !data.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.offsetWidth, h = height
    canvas.width = w * 2; canvas.height = h * 2
    ctx.scale(2, 2)
    ctx.clearRect(0, 0, w, h)
    const min = Math.min(...data), max = Math.max(...data)
    const range = max - min || 1
    const xStep = w / (data.length - 1 || 1)
    const zeroY = h - ((0 - min) / range) * h
    ctx.strokeStyle = SURFACE3; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke(); ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(0, h - ((data[0] - min) / range) * h)
    data.forEach((v, i) => ctx.lineTo(i * xStep, h - ((v - min) / range) * h))
    ctx.lineTo((data.length - 1) * xStep, h); ctx.lineTo(0, h); ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '05')
    ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, h - ((data[0] - min) / range) * h)
    data.forEach((v, i) => ctx.lineTo(i * xStep, h - ((v - min) / range) * h))
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
  }, [data, color, height])
  return <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />
}

interface ChartSettings {
  showEma9_20: boolean
  showEma72_89: boolean
  showDevBands9_20: boolean
  showDevBands72_89: boolean
  showDevBands72_89Tight: boolean
  showVwap: boolean
  showPrevClose: boolean
  showAhPmShade: boolean
  showVolume: boolean
  showCrosshair: boolean
  showLegend: boolean
  showKeyLevels: boolean
}

interface KeyLevelsParams {
  lookLeft: number
  lookRight: number
  numPivots: number
  atrLength: number
  zoneWidth: number
  maxZonePercent: number
  extendRight: boolean
}

// ─── Color constants ────────────────────────────────────
const GOLD = '#D4AF37'
const GOLD_DIM = 'rgba(212,175,55,0.12)'

// ─── Indicator Templates ────────────────────────────────────
interface IndTemplate {
  id: string
  name: string
  settings: Partial<ChartSettings>
}
const IND_TEMPLATES: IndTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    settings: {
      showEma9_20: false, showEma72_89: false,
      showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false,
      showVwap: true, showPrevClose: false, showAhPmShade: true,
      showVolume: true, showCrosshair: true, showLegend: false,
    },
  },
  {
    id: 'mikes-bands',
    name: "Mike's Bands",
    settings: {
      showEma9_20: true, showEma72_89: true,
      showDevBands9_20: true, showDevBands72_89: true, showDevBands72_89Tight: true,
      showVwap: true, showPrevClose: false, showAhPmShade: true,
      showVolume: true, showCrosshair: true, showLegend: false, showKeyLevels: true,
    },
  },
  {
    id: 'clouds-only',
    name: 'EMA Clouds',
    settings: {
      showEma9_20: true, showEma72_89: true,
      showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false,
      showVwap: true, showPrevClose: false, showAhPmShade: true,
      showVolume: true, showCrosshair: true, showLegend: false,
    },
  },
]

const TEMPLATE_IND_KEYS: [keyof ChartSettings, string][] = [
  ['showEma9_20', 'EMA 9/20 Cloud'],
  ['showEma72_89', 'EMA 72/89 Cloud'],
  ['showDevBands9_20', 'Dev Band 9/20'],
  ['showDevBands72_89', 'Dev Band 72/89'],
  ['showDevBands72_89Tight', 'Dev Band 72/89 Tight'],
  ['showVwap', 'VWAP'],
  ['showPrevClose', 'Prev Close'],
  ['showAhPmShade', 'AH/PM Shade'],
  ['showVolume', 'Volume'],
  ['showKeyLevels', 'Key Levels'],
]
const GOLD_BORDER = 'rgba(212,175,55,0.3)'
const BG = '#08080d'
const SURFACE = '#0c0c14'
const SURFACE2 = '#10101c'
const SURFACE3 = '#141422'
const BORDER = '#1a1a2e'
const TEXT = '#e0e0e0'
const TEXT2 = '#b0b0c0'
const MUTED = '#555570'
const WHITE = '#d8d8e0'
const RED = '#ef4444'
const TEAL = '#14b8a6'
const VOL_UP = 'rgba(216,216,224,0.18)'
const VOL_DN = 'rgba(239,68,68,0.25)'

// Resizable panel widths (defaults)
const LEFT_W_DEFAULT = 280
const RIGHT_W_DEFAULT = 360
const LEFT_W_MIN = 180
const RIGHT_W_MIN = 240
const LEFT_W_MAX = 500
const RIGHT_W_MAX = 600

// ─── Light mode palette ──────────────────────────────────
const LIGHT = {
  BG: '#f8f8fa',
  SURFACE: '#ffffff',
  SURFACE2: '#f0f0f4',
  SURFACE3: '#e8e8ee',
  BORDER: '#d0d0dc',
  TEXT: '#1a1a2e',
  TEXT2: '#4a4a60',
  MUTED: '#8a8aa0',
  WHITE: '#2a2a3e',
  RED: '#dc2626',
  TEAL: '#0d9488',
  VOL_UP: 'rgba(30,30,50,0.10)',
  VOL_DN: 'rgba(220,38,38,0.15)',
  GOLD_DIM: 'rgba(212,175,55,0.10)',
  GOLD_BORDER: 'rgba(212,175,55,0.30)',
}

function useThemeColors(dark: boolean) {
  return dark ? {
    BG, SURFACE, SURFACE2, SURFACE3, BORDER, TEXT, TEXT2, MUTED, WHITE, RED, TEAL, VOL_UP, VOL_DN, GOLD_DIM, GOLD_BORDER,
  } : { ...LIGHT, GOLD, GOLD_DIM: LIGHT.GOLD_DIM, GOLD_BORDER: LIGHT.GOLD_BORDER }
}

// ─── Helpers ───────────────────────────────────────────
/** Get the ET (America/New_York) date string for a bar (YYYY-MM-DD). */
function barETDate(b: any): string {
  if (typeof b.time === 'string') return b.time.slice(0, 10)
  if (typeof b.time === 'number') {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
        .format(new Date(b.time * 1000))
    } catch {
      const d = new Date(b.time * 1000 - 5 * 3600000)
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
    }
  }
  return ''
}

// ─── MiniChart with zoom & drag ─────────────────────────
function ScanMiniChart({ symbol, tf, date, height = 580, settings, dark, dayOffset = 0, entryMarker, exitMarker, centerOnDate, legMarkers, exitEpoch, klParams }: {
  symbol: string
  tf: Timeframe
  date?: string
  height?: number
  settings: ChartSettings
  dark: boolean
  dayOffset?: number
  entryMarker?: { price: number; timeInt: string; epoch?: number }
  exitMarker?: { price: number; timeInt: string; epoch?: number }
  centerOnDate?: boolean
  legMarkers?: { entry?: { price: number; epoch?: number }; exit?: { price: number; epoch?: number } }[]
  exitEpoch?: number
  klParams?: KeyLevelsParams
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [allBars, setAllBars] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ active: boolean; startX: number; zoomStart: number; zoomEnd: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Manual zoom from wheel — null means "compute default"
  const [manualZoom, setManualZoom] = useState<{ start: number; end: number } | null>(null)

  // Fetch bars — simple date range
  useEffect(() => {
    setLoading(true)
    setAllBars([])
    const params = new URLSearchParams({ symbol, tf })
    const baseDate = date || new Date().toISOString().slice(0, 10)
    const fromDate = new Date(baseDate + 'T12:00:00')
    const toDate = new Date(baseDate + 'T12:00:00')
    // Backtest: D0-3 to D0+10 (covers multi-day holds). Scan: wider range.
    if (centerOnDate) {
      fromDate.setDate(fromDate.getDate() - 3)
      toDate.setDate(toDate.getDate() + 10)
    } else {
      toDate.setDate(toDate.getDate() + dayOffset * 2 + 10)
      if (tf === '5') fromDate.setDate(fromDate.getDate() - 10)
      else if (tf === '15') fromDate.setDate(fromDate.getDate() - 25)
      else if (tf === '60') fromDate.setDate(fromDate.getDate() - 70)
      else fromDate.setDate(fromDate.getDate() - 360)
    }
    params.set('from', fromDate.toISOString().slice(0, 10))
    params.set('to', toDate.toISOString().slice(0, 10))
    fetch(`/api/chart-data/bars?${params}`)
      .then(r => { if (!r.ok) throw new Error(`Bars API ${r.status}`); return r.json() })
      .then(data => { setAllBars((data.bars || []).filter((b: any) => b.time != null)); setLoading(false) })
      .catch(() => { setAllBars([]); setLoading(false) })
  }, [symbol, tf, date, dayOffset, centerOnDate])

  // Compute visible bars
  const visibleBars = useMemo(() => {
    if (!allBars.length) return []
    if (manualZoom) return allBars.slice(manualZoom.start, manualZoom.end)

    if (centerOnDate) {
      // Find D0 start index
      let d0Idx = -1
      for (let i = 0; i < allBars.length; i++) {
        if (barETDate(allBars[i]) === date) { d0Idx = i; break }
      }
      if (d0Idx < 0) return allBars.slice(-78)

      const d0Date = barETDate(allBars[d0Idx])

      // Find start of D-1 (one trading day before D0)
      let sliceStart = d0Idx
      for (let i = d0Idx - 1; i >= 0; i--) {
        if (barETDate(allBars[i]) !== d0Date) {
          sliceStart = i
          break
        }
      }

      // Find end: last bar of exit day (BT) or D0 (signals)
      let sliceEnd = allBars.length
      if (exitEpoch && exitEpoch > 0 && !isNaN(exitEpoch)) {
        // Backtest: find end of exit day
        const exitDateStr = barETDate({ time: exitEpoch, o: 0, h: 0, l: 0, c: 0, v: 0 } as any)
        for (let i = d0Idx + 1; i < allBars.length; i++) {
          const bd = barETDate(allBars[i])
          if (bd !== exitDateStr && barETDate(allBars[i - 1]) === exitDateStr) {
            sliceEnd = i
            break
          }
        }
      } else {
        // Signal mode: end at D0 close (first bar of D+1)
        for (let i = d0Idx + 1; i < allBars.length; i++) {
          if (barETDate(allBars[i]) !== d0Date) {
            sliceEnd = i
            break
          }
        }
      }
      return allBars.slice(sliceStart, sliceEnd)
    }

    // SCAN MODE: default window around D0
    let defaultBars = allBars.length
    if (tf === '5') defaultBars = Math.min(allBars.length, 156)
    else if (tf === '15') defaultBars = Math.min(allBars.length, 104)
    else if (tf === '60') defaultBars = Math.min(allBars.length, 98)
    else defaultBars = Math.min(allBars.length, 120)

    let d0Idx = allBars.length - 1
    if (date) {
      for (let i = allBars.length - 1; i >= 0; i--) {
        if (barETDate(allBars[i]) === date) { d0Idx = i; break }
      }
    }
    const bpd = tf === '5' ? 78 : tf === '15' ? 26 : tf === '60' ? 7 : 1
    const endIdx = Math.min(allBars.length, d0Idx + dayOffset * bpd + 1)
    const startIdx = Math.max(0, endIdx - defaultBars)
    return allBars.slice(startIdx, endIdx)
  }, [allBars, tf, dayOffset, date, manualZoom])

  const draw = useCallback(() => {
    const bars = visibleBars
    if (!bars.length || !canvasRef.current) return
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height
    const PAD_R = 54
    const PAD_B = 28
    const CHART_H = H - PAD_B
    const T = dark
      ? { bg: BG, surface: SURFACE, border: BORDER, muted: MUTED, white: WHITE, red: RED, volUp: VOL_UP, volDn: VOL_DN }
      : { bg: LIGHT.BG, surface: LIGHT.SURFACE, border: LIGHT.BORDER, muted: LIGHT.MUTED, white: LIGHT.WHITE, red: LIGHT.RED, volUp: LIGHT.VOL_UP, volDn: LIGHT.VOL_DN }
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, W, H)

    const highs = bars.map(b => b.high)
    const lows = bars.map(b => b.low)
    let minP = Math.min(...lows)
    let maxP = Math.max(...highs)
    const range = maxP - minP || 1
    minP -= range * 0.05; maxP += range * 0.05
    const pRange = maxP - minP
    const yFor = (p: number) => CHART_H - ((p - minP) / pRange) * CHART_H

    ctx.strokeStyle = T.border; ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = (CHART_H / 4) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - PAD_R, y); ctx.stroke()
      ctx.fillStyle = T.muted; ctx.font = '9px monospace'; ctx.textAlign = 'left'
      ctx.fillText((maxP - (i / 4) * pRange).toFixed(2), W - PAD_R + 6, y + 3)
    }

    const candleW = Math.max(1, (W - PAD_R) / bars.length - 1)
    const bodyW = Math.max(1, candleW * 0.7)
    const xFor = (i: number) => (i / bars.length) * (W - PAD_R) + candleW / 2
    const maxVol = Math.max(...bars.map(b => b.volume))

    if (settings.showVolume) { bars.forEach((bar, i) => {
      const x = xFor(i)
      const h = (bar.volume / maxVol) * PAD_B * 0.8
      ctx.fillStyle = bar.close >= bar.open ? T.volUp : T.volDn
      ctx.fillRect(x - bodyW / 2, H - PAD_B + PAD_B * 0.2 + (PAD_B * 0.8 - h), bodyW, h)
    }) }
    bars.forEach((bar, i) => {
      const x = xFor(i)
      const isUp = bar.close >= bar.open
      const color = isUp ? T.white : T.red
      ctx.strokeStyle = color; ctx.lineWidth = 0.7
      ctx.beginPath(); ctx.moveTo(x, yFor(bar.high)); ctx.lineTo(x, yFor(bar.low)); ctx.stroke()
      const top = yFor(Math.max(bar.open, bar.close))
      const bot = yFor(Math.min(bar.open, bar.close))
      ctx.fillStyle = color
      ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1, bot - top))
    })

    // ── Entry/Exit markers for backtest trades ──
    const drawMarker = (barIdx: number, price: number, type: 'entry' | 'exit') => {
      if (barIdx < 0 || barIdx >= bars.length) return
      const x = xFor(barIdx)
      const y = yFor(price)
      const sz = Math.max(10, candleW * 1.2)
      const outlineColor = dark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)'
      if (type === 'entry') {
        // Red down-pointing triangle (short entry) — draw outline first
        ctx.fillStyle = outlineColor; ctx.beginPath()
        ctx.moveTo(x, y + sz + 4); ctx.lineTo(x - sz / 2 - 1.5, y + 1); ctx.lineTo(x + sz / 2 + 1.5, y + 1)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#ef4444'; ctx.beginPath()
        ctx.moveTo(x, y + sz + 2); ctx.lineTo(x - sz / 2, y + 2); ctx.lineTo(x + sz / 2, y + 2)
        ctx.closePath(); ctx.fill()
      } else {
        // Green up-pointing triangle (cover/exit) — draw outline first
        ctx.fillStyle = outlineColor; ctx.beginPath()
        ctx.moveTo(x, y - sz - 4); ctx.lineTo(x - sz / 2 - 1.5, y - 1); ctx.lineTo(x + sz / 2 + 1.5, y - 1)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#22c55e'; ctx.beginPath()
        ctx.moveTo(x, y - sz - 2); ctx.lineTo(x - sz / 2, y - 2); ctx.lineTo(x + sz / 2, y - 2)
        ctx.closePath(); ctx.fill()
      }
    }
    // Find bar whose epoch is closest to target (must be within 5min)
    const findBar = (epoch: number) => {
      let bestIdx = -1, bestDist = Infinity
      for (let i = 0; i < bars.length; i++) {
        const d = Math.abs(bars[i].time - epoch)
        if (d < bestDist) { bestDist = d; bestIdx = i }
      }
      return bestDist <= 300 ? bestIdx : -1
    }
    // (marker drawing moved to end of render — after all indicators)
    const _markerQueue: { idx: number; price: number; type: 'entry' | 'exit' }[] = []
    if (entryMarker?.epoch) {
      const idx = findBar(entryMarker.epoch)
      if (idx >= 0) _markerQueue.push({ idx, price: entryMarker.price, type: 'entry' })
    }
    if (exitMarker?.epoch) {
      const idx = findBar(exitMarker.epoch)
      if (idx >= 0) _markerQueue.push({ idx, price: exitMarker.price, type: 'exit' })
    }
    // Per-leg markers — each leg gets its own red (short) and green (cover) wedge
    if (legMarkers && legMarkers.length > 0) {
      legMarkers.forEach((leg, li) => {
        if (leg.entry?.epoch) {
          const idx = findBar(leg.entry.epoch)
          if (idx >= 0) _markerQueue.push({ idx, price: leg.entry!.price, type: 'entry' })
        }
        if (leg.exit?.epoch) {
          const idx = findBar(leg.exit.epoch)
          if (idx >= 0) _markerQueue.push({ idx, price: leg.exit!.price, type: 'exit' })
        }
      })
    }

    const mouse = mouseRef.current
    if (settings.showCrosshair && mouse && mouse.x < W - PAD_R && mouse.y < CHART_H) {
      ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(0, mouse.y); ctx.lineTo(W - PAD_R, mouse.y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, CHART_H); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = GOLD; ctx.font = '9px monospace'
      ctx.fillText((maxP - (mouse.y / CHART_H) * pRange).toFixed(2), W - PAD_R + 6, mouse.y + 3)
      const barIdx = Math.floor((mouse.x / (W - PAD_R)) * bars.length)
      if (barIdx >= 0 && barIdx < bars.length) {
        const b = bars[barIdx]; const isUp = b.close >= b.open
        // Format date/time from bar
        const barTime = b.time
        let dateStr = ''
        let timeStr = ''
        if (typeof barTime === 'string') {
          // Already a date string like "2024-03-15"
          const parts = barTime.split('-')
          dateStr = parts.length === 3 ? `${parts[1]}/${parts[2]}/${parts[0]}` : barTime
        } else if (typeof barTime === 'number') {
          const d = new Date(barTime * 1000)
          const dd = String(d.getDate()).padStart(2, '0')
          const mm = String(d.getMonth() + 1).padStart(2, '0')
          const yyyy = d.getFullYear()
          dateStr = `${dd}/${mm}/${yyyy}`
          const hh = String(d.getHours()).padStart(2, '0')
          const min = String(d.getMinutes()).padStart(2, '0')
          timeStr = `${hh}:${min}`
        }
        // Build label: date time O H L C V
        const volStr = b.volume >= 1e6 ? `${(b.volume / 1e6).toFixed(1)}M` : `${(b.volume / 1e3).toFixed(0)}K`
        const parts = [dateStr]
        if (timeStr) parts.push(timeStr)
        parts.push(`O:${b.open.toFixed(2)}`, `H:${b.high.toFixed(2)}`, `L:${b.low.toFixed(2)}`, `C:${b.close.toFixed(2)}`, `V:${volStr}`)
        const label = parts.join('  ')
        ctx.fillStyle = dark ? 'rgba(12,12,20,0.92)' : 'rgba(255,255,255,0.92)'
        ctx.font = '9px monospace'
        const tw = ctx.measureText(label).width
        const tx = Math.min(mouse.x - tw / 2, W - PAD_R - tw - 4)
        const ly = CHART_H - 18
        ctx.fillRect(Math.max(2, tx), ly, tw + 10, 16)
        // Date in gold
        ctx.fillStyle = GOLD; ctx.textAlign = 'left'
        ctx.fillText(label, Math.max(6, tx + 5), ly + 12)
      }
    }

    // ── After-hours / Pre-market shading (intraday) ──
    if (settings.showAhPmShade && tf !== 'D' && bars.length > 1) {
      const getBarMinET = (b: any): number | null => {
        if (typeof b.time === 'number') {
          const d = new Date(b.time * 1000)
          const h = d.getUTCHours() - 5
          const m = d.getUTCMinutes()
          return h * 60 + m
        }
        return null
      }
      const getBarDate = (b: any): string => barETDate(b)
      const preMktStart = 4 * 60
      const mktOpen = 9 * 60 + 30
      const mktClose = 16 * 60
      const ahEnd = 20 * 60

      for (let i = 0; i < bars.length; i++) {
        const mins = getBarMinET(bars[i])
        if (mins === null) continue
        const isPre = mins >= preMktStart && mins < mktOpen
        const isAH = mins >= mktClose && mins < ahEnd
        if (isPre || isAH) {
          const x = xFor(i)
          const barDate = getBarDate(bars[i])
          // D0 pre-market gets gold-grey tint, everything else normal
          const isD0 = date && barDate === date && isPre
          ctx.fillStyle = isD0 ? 'rgba(212,175,55,0.12)' : isPre ? 'rgba(40,40,70,0.3)' : 'rgba(50,35,35,0.3)'
          ctx.fillRect(x - bodyW, 0, bodyW * 2, CHART_H)
        }
      }
    }

    // ── 7:00 AM ET vertical marker (intraday) ──
    if (tf !== 'D' && bars.length > 1) {
      const getBarMinET7 = (b: any): number | null => {
        if (typeof b.time === 'number') {
          const d = new Date(b.time * 1000)
          return (d.getUTCHours() - 5) * 60 + d.getUTCMinutes()
        }
        return null
      }
      const TARGET7 = 7 * 60 // 7:00 AM ET (chart axis uses fixed UTC-5)
      const drawn7 = new Set<string>()
      for (let i = 0; i < bars.length; i++) {
        const mins = getBarMinET7(bars[i])
        if (mins === null || mins < TARGET7) continue
        const bd = barETDate(bars[i])
        if (bd && !drawn7.has(bd)) {
          drawn7.add(bd)
          const x = xFor(i)
          ctx.strokeStyle = 'rgba(34,197,94,0.7)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CHART_H); ctx.stroke()
          ctx.setLineDash([])
          ctx.fillStyle = 'rgba(34,197,94,0.7)'
          ctx.font = '8px monospace'; ctx.textAlign = 'left'
          ctx.fillText('7:00', x + 3, 20)
        }
      }
    }

    // ── D0 marker: gold wedge below D0 daily candle (1D only) ──
    if (date && tf === 'D' && bars.length > 0) {
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i]
        if (barETDate(b) === date) {
          const x = xFor(i)
          const lowY = yFor(b.low)
          // Upward wedge ▲ below the candle
          const sz = Math.max(5, candleW * 0.6)
          ctx.fillStyle = GOLD
          ctx.beginPath()
          ctx.moveTo(x, lowY + 4)             // tip pointing up
          ctx.lineTo(x - sz, lowY + 4 + sz * 1.4)  // bottom-left
          ctx.lineTo(x + sz, lowY + 4 + sz * 1.4)  // bottom-right
          ctx.closePath()
          ctx.fill()
          // D0 label
          ctx.fillStyle = GOLD; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
          ctx.fillText('D0', x, lowY + 4 + sz * 1.4 + 9)
          break
        }
      }
    }

    // ── Indicators (bands, VWAP, prev close, legend) ──
    if (tf !== 'D' && bars.length > 89) {
      // Helper: compute EMA array
      const calcEMA = (period: number): number[] => {
        const k = 2 / (period + 1)
        const vals: number[] = [bars[0].close]
        for (let i = 1; i < bars.length; i++) {
          vals.push(bars[i].close * k + vals[i - 1] * (1 - k))
        }
        return vals
      }
      // Helper: compute ATR array (using EMA smoothing like main chart)
      const calcATR = (period: number): number[] => {
        const tr: number[] = [bars[0].high - bars[0].low]
        for (let i = 1; i < bars.length; i++) {
          tr.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)))
        }
        const k = 2 / (period + 1)
        const vals: number[] = [tr[0]]
        for (let i = 1; i < tr.length; i++) {
          vals.push(tr[i] * k + vals[i - 1] * (1 - k))
        }
        return vals
      }

      // Draw band helper
      const drawBand = (topV: number[], botV: number[], fill: string, lineColor: string) => {
        // Fill
        ctx.beginPath(); let s = false
        for (let i = 0; i < topV.length; i++) {
          const x = xFor(i), y = yFor(topV[i])
          if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
        }
        for (let i = topV.length - 1; i >= 0; i--) {
          ctx.lineTo(xFor(i), yFor(botV[i]))
        }
        ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
        // Lines
        for (const vals of [topV, botV]) {
          ctx.strokeStyle = lineColor; ctx.lineWidth = 0.5; ctx.setLineDash([]); ctx.beginPath(); s = false
          for (let i = 0; i < vals.length; i++) {
            const x = xFor(i), y = yFor(vals[i])
            if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      }

      // Draw EMA crossover band (green when fast > slow, red when slow > fast)
      const drawEMABand = (fast: number[], slow: number[], fillUp: string, fillDn: string, lineUp: string, lineDn: string) => {
        let segStart = 0, prevDir: string | null = null
        const flush = (endI: number) => {
          if (segStart >= endI) return
          const clr = prevDir === 'up' ? fillUp : fillDn
          const lc = prevDir === 'up' ? lineUp : lineDn
          const top = prevDir === 'up' ? fast : slow
          const bot = prevDir === 'up' ? slow : fast
          ctx.beginPath(); let s = false
          for (let j = segStart; j <= endI; j++) {
            const x = xFor(j), y = yFor(top[j])
            if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
          }
          for (let j = endI; j >= segStart; j--) { ctx.lineTo(xFor(j), yFor(bot[j])) }
          ctx.closePath(); ctx.fillStyle = clr; ctx.fill()
          for (const v of [top, bot]) {
            ctx.strokeStyle = lc; ctx.lineWidth = 0.6; ctx.beginPath(); s = false
            for (let j = segStart; j <= endI; j++) {
              const x = xFor(j), y = yFor(v[j])
              if (!s) { ctx.moveTo(x, y); s = true } else ctx.lineTo(x, y)
            }
            ctx.stroke()
          }
        }
        for (let i = 0; i < bars.length; i++) {
          const dir = fast[i] >= slow[i] ? 'up' : 'dn'
          if (dir !== prevDir) { flush(i - 1); segStart = i; prevDir = dir }
        }
        flush(bars.length - 1)
      }

      // ── Compute EMAs/ATRs always ──
      const ema9 = calcEMA(9)
      const ema20 = calcEMA(20)
      const ema72 = calcEMA(72)
      const ema89 = calcEMA(89)
      const atr9 = calcATR(9)
      const atr14 = calcATR(14)
      const atr20 = calcATR(20)
      const atr72 = calcATR(72)
      const atr89 = calcATR(89)

      // ── 9/20 EMA Band ──
      if (settings.showEma9_20) {
        drawEMABand(ema9, ema20, 'rgba(34,197,94,.15)', 'rgba(239,68,68,.15)', 'rgba(34,197,94,.50)', 'rgba(239,68,68,.50)')
      }

      // ── 9/20 Deviation Band ──
      if (settings.showDevBands9_20) {
        const s920_up1 = ema9.map((v, i) => v + atr9[i] * 0.5)
        const s920_up2 = ema9.map((v, i) => v + atr9[i] * 1.0)
        const s920_dn1 = ema20.map((v, i) => v - atr20[i] * 2.0)
        const s920_dn2 = ema20.map((v, i) => v - atr20[i] * 2.4)
        drawBand(s920_up1, s920_up2, 'rgba(239,68,68,.15)', 'rgba(239,68,68,.40)')
        drawBand(s920_dn1, s920_dn2, 'rgba(34,197,94,.15)', 'rgba(34,197,94,.40)')
      }

      // ── 72/89 EMA Band ──
      if (settings.showEma72_89) {
        drawEMABand(ema72, ema89, 'rgba(34,197,94,.15)', 'rgba(239,68,68,.15)', 'rgba(34,197,94,.50)', 'rgba(239,68,68,.50)')
      }

      // ── 72/89 Deviation Band (wide: 6.9/9.6) ──
      if (settings.showDevBands72_89) {
        const db7289_up1 = ema72.map((v, i) => v + atr72[i] * 6.9)
        const db7289_up2 = ema72.map((v, i) => v + atr72[i] * 9.6)
        const db7289_dn1 = ema89.map((v, i) => v - atr89[i] * 6.9)
        const db7289_dn2 = ema89.map((v, i) => v - atr89[i] * 9.6)
        drawBand(db7289_up1, db7289_up2, 'rgba(239,68,68,.15)', 'rgba(239,68,68,.40)')
        drawBand(db7289_dn1, db7289_dn2, 'rgba(34,197,94,.15)', 'rgba(34,197,94,.40)')
      }

      // ── 72/89 Deviation Band (tight: 3/3.3 up, 3.6/3.9 down) ──
      if (settings.showDevBands72_89Tight) {
        const dbt_up1 = ema72.map((v, i) => v + atr72[i] * 3.0)
        const dbt_up2 = ema72.map((v, i) => v + atr72[i] * 3.3)
        const dbt_dn1 = ema89.map((v, i) => v - atr89[i] * 3.6)
        const dbt_dn2 = ema89.map((v, i) => v - atr89[i] * 3.9)
        drawBand(dbt_up1, dbt_up2, 'rgba(239,68,68,.10)', 'rgba(239,68,68,.30)')
        drawBand(dbt_dn1, dbt_dn2, 'rgba(34,197,94,.10)', 'rgba(34,197,94,.30)')
      }

      // ── Key Levels (Bjorgum-style pivot zones) ──
      if (settings.showKeyLevels) {
        const klDef = klParams || { lookLeft: 48, lookRight: 24, numPivots: 1, atrLength: 36, zoneWidth: 0.5, maxZonePercent: 1, extendRight: true }
        const { lookLeft, lookRight, numPivots, atrLength, zoneWidth, maxZonePercent, extendRight } = klDef

        // Compute pivots on FULL history, not just visible slice
        const srcBars = allBars.length > bars.length ? allBars : bars
        const haOpen: number[] = [], haClose: number[] = []
        for (let i = 0; i < srcBars.length; i++) {
          const b = srcBars[i]
          const haC = (b.open + b.high + b.low + b.close) / 4
          const haO = i === 0 ? (b.open + b.close) / 2 : (haOpen[i - 1] + haClose[i - 1]) / 2
          haOpen.push(haO); haClose.push(haC)
        }
        const haHi = srcBars.map((_: any, i: number) => Math.max(haOpen[i], haClose[i]))
        const haLo = srcBars.map((_: any, i: number) => Math.min(haOpen[i], haClose[i]))

        const swings: { idx: number; price: number; type: 'high' | 'low' }[] = []
        for (let i = lookLeft; i < srcBars.length - lookRight; i++) {
          let isHigh = true, isLow = true
          for (let j = 1; j <= lookLeft; j++) { if (haHi[i] <= haHi[i - j]) isHigh = false }
          for (let j = 1; j <= lookRight; j++) { if (haHi[i] <= haHi[i + j]) isHigh = false }
          for (let j = 1; j <= lookLeft; j++) { if (haLo[i] >= haLo[i - j]) isLow = false }
          for (let j = 1; j <= lookRight; j++) { if (haLo[i] >= haLo[i + j]) isLow = false }
          if (isHigh) swings.push({ idx: i, price: srcBars[i].high, type: 'high' })
          if (isLow) swings.push({ idx: i, price: srcBars[i].low, type: 'low' })
        }
        // Cluster into zones
        const srcAtrData: number[] = []
        for (let i = 0; i < srcBars.length; i++) {
          if (i < atrLength) { srcAtrData.push(srcBars[i].high - srcBars[i].low); continue }
          const tr = Math.max(srcBars[i].high - srcBars[i].low, Math.abs(srcBars[i].high - srcBars[i - 1].close), Math.abs(srcBars[i].low - srcBars[i - 1].close))
          srcAtrData.push((srcAtrData[i - 1] * (atrLength - 1) + tr) / atrLength)
        }
        const atrVal = srcAtrData[srcAtrData.length - 1] || srcBars[0].close * 0.005
        const mergeDist = zoneWidth * atrVal
        const maxZoneSize = srcBars[0].close * (maxZonePercent / 100)
        const sorted = [...swings].sort((a, b) => a.price - b.price)
        const zones: { top: number; bot: number; bull: boolean; strength: number }[] = []
        let cs = 0
        for (let i = 1; i <= sorted.length; i++) {
          const gap = sorted[i] ? sorted[i].price - sorted[cs].price : Infinity
          if (i === sorted.length || gap > mergeDist) {
            const cl = sorted.slice(cs, i)
            const prices = cl.map(s => s.price)
            const zTop = Math.max(...prices)
            const zBot = Math.min(...prices)
            if (zTop - zBot <= maxZoneSize) {
              const highs = cl.filter(s => s.type === 'high').length
              const lows = cl.filter(s => s.type === 'low').length
              zones.push({ top: zTop, bot: zBot, bull: lows >= highs, strength: cl.length })
            }
            cs = i
          }
        }
        zones.sort((a, b) => b.strength - a.strength)
        zones.length = Math.min(zones.length, numPivots * 2)

        // Render zones across full visible width
        if (zones.length === 0) {
          ctx.fillStyle = 'rgba(212,175,55,0.15)'
          ctx.fillRect(0, 0, 120, 16)
          ctx.fillStyle = '#d4b44a'
          ctx.font = '9px monospace'
          ctx.fillText(`KL: ${swings.length} sw, 0 zones`, 2, 11)
        }
        for (const zone of zones) {
          const yT = yFor(zone.top)
          const yB = yFor(zone.bot)
          if (yT > CHART_H || yB < 0) continue
          const ct = Math.max(0, yT)
          const cb = Math.min(CHART_H, yB)
          const h = cb - ct
          if (h < 1) continue
          const alpha = Math.min(0.22, 0.04 + zone.strength * 0.03)
          if (zone.bull) {
            ctx.fillStyle = `rgba(34,197,94,${alpha})`
            ctx.fillRect(0, ct, W, h)
            ctx.strokeStyle = `rgba(34,197,94,${alpha + 0.08})`
            ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.moveTo(0, ct); ctx.lineTo(W, ct); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(0, cb); ctx.lineTo(W, cb); ctx.stroke()
          } else {
            ctx.fillStyle = `rgba(239,68,68,${alpha})`
            ctx.fillRect(0, ct, W, h)
            ctx.strokeStyle = `rgba(239,68,68,${alpha + 0.08})`
            ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.moveTo(0, ct); ctx.lineTo(W, ct); ctx.stroke()
            ctx.beginPath(); ctx.moveTo(0, cb); ctx.lineTo(W, cb); ctx.stroke()
          }
        }
      }

      // ── VWAP line (5m / 15m only, resets at market day boundary) ──
      if (settings.showVwap && (tf === '5' || tf === '15')) {
        let cumVP = 0, cumV = 0, lastMktDay: string | null = null
        const vwapVals: number[] = []
        for (let i = 0; i < bars.length; i++) {
          // Skip bars with invalid timestamps
          if (!bars[i].time || typeof bars[i].time !== 'number') { vwapVals.push(NaN); continue }
          // Determine market day in ET (bars after 7pm UTC belong to prev day)
          const ts = bars[i].time * 1000
          const utcH = new Date(ts).getUTCHours()
          const etDate = new Date(ts - (utcH < 5 ? 86400000 : 0))
          const mktDay = isNaN(etDate.getTime()) ? '' : etDate.toISOString().slice(0, 10)
          if (mktDay !== lastMktDay) { cumVP = 0; cumV = 0; lastMktDay = mktDay }
          const typical = (bars[i].high + bars[i].low + bars[i].close) / 3
          cumVP += typical * (bars[i].volume || 0)
          cumV += (bars[i].volume || 0)
          vwapVals.push(cumV > 0 ? cumVP / cumV : typical)
        }
        ctx.strokeStyle = 'rgba(194,114,58,.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3])
        ctx.beginPath()
        for (let i = 0; i < vwapVals.length; i++) {
          const x = xFor(i), y = yFor(vwapVals[i])
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke(); ctx.setLineDash([])
      }
      // ── Previous Close line ──
      if (settings.showPrevClose && date) {
        let prevClose: number | null = null
        for (let i = 0; i < bars.length; i++) {
          if (barETDate(bars[i]) === date) {
            // This is D0 — prev close is the close of the bar just before
            if (i > 0) prevClose = bars[i - 1].close
            break
          }
        }
        if (prevClose !== null) {
          const y = yFor(prevClose)
          ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([8, 4])
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - PAD_R, y); ctx.stroke()
          ctx.setLineDash([])
          // Label
          ctx.fillStyle = 'rgba(212,175,55,.5)'; ctx.font = '8px monospace'; ctx.textAlign = 'right'
          ctx.fillText(`Prev $${prevClose.toFixed(2)}`, W - PAD_R - 4, y - 4)
        }
      }

      // ── Legend ──
      if (settings.showLegend) {
      ctx.font = '8px monospace'; ctx.textAlign = 'left'; const lx = 6, ly = 10
      ctx.fillStyle = 'rgba(34,197,94,0.7)'; ctx.fillText('9/20', lx, ly)
      ctx.fillStyle = 'rgba(34,197,94,0.5)'; ctx.fillText('72/89', lx + 35, ly)
      ctx.fillStyle = 'rgba(239,68,68,0.5)'; ctx.fillText('DEV', lx + 70, ly)
      ctx.fillStyle = 'rgba(194,114,58,0.7)'; ctx.fillText('VWAP', lx + 100, ly)
      }
    }

    // ── Draw markers ON TOP of everything ──
    _markerQueue.forEach(m => drawMarker(m.idx, m.price, m.type))

    // Zoom indicator
    if (visibleBars.length < allBars.length) {
      ctx.fillStyle = `${GOLD}80`; ctx.font = '9px monospace'; ctx.textAlign = 'right'
      ctx.fillText(`${visibleBars.length}/${allBars.length}`, W - PAD_R - 4, 12)
    }
  }, [visibleBars, allBars.length, tf, date, settings, dark, GOLD, entryMarker, exitMarker, legMarkers])

  useEffect(() => { draw() }, [draw])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!allBars.length) return
    // Derive current visible range
    const firstBarTime = visibleBars[0]?.time
    const curS = firstBarTime != null ? Math.max(0, allBars.findIndex(b => b.time === firstBarTime)) : 0
    const curE = curS + visibleBars.length
    const visible = curE - curS
    const zoomAmount = Math.max(2, Math.round(visible * 0.1))

    let newStart: number, newEnd: number
    if (e.deltaY < 0) {
      const newVisible = Math.max(10, visible - zoomAmount)
      const rect = canvasRef.current?.getBoundingClientRect()
      const mouseX = rect ? (e.clientX - rect.left) / (rect.width - 54) : 0.5
      const center = curS + Math.round(visible * mouseX)
      const half = Math.round(newVisible / 2)
      newStart = Math.max(0, center - half)
      newEnd = Math.min(allBars.length, newStart + newVisible)
      newStart = Math.max(0, newEnd - newVisible)
    } else {
      const newVisible = Math.min(allBars.length, visible + zoomAmount)
      const center = Math.round((curS + curE) / 2)
      const half = Math.round(newVisible / 2)
      newStart = Math.max(0, center - half)
      newEnd = Math.min(allBars.length, newStart + newVisible)
    }
    setManualZoom({ start: newStart, end: newEnd })
  }, [allBars, visibleBars])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return // left click only
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const zoom = manualZoom || { start: 0, end: allBars.length }
    dragRef.current = { active: true, startX: e.clientX, zoomStart: zoom.start, zoomEnd: zoom.end }
    setIsDragging(true)
    mouseRef.current = null // hide crosshair during drag
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    // If dragging, pan the chart (no crosshair)
    if (dragRef.current?.active && allBars.length > 0) {
      const dx = e.clientX - dragRef.current.startX
      const chartW = rect.width - 54
      const barsPerPx = (dragRef.current.zoomEnd - dragRef.current.zoomStart) / chartW
      const shift = Math.round(dx * barsPerPx)
      let newStart = dragRef.current.zoomStart - shift
      let newEnd = dragRef.current.zoomEnd - shift
      if (newStart < 0) { newEnd -= newStart; newStart = 0 }
      if (newEnd > allBars.length) { newStart -= (newEnd - allBars.length); newEnd = allBars.length }
      newStart = Math.max(0, newStart)
      if (newEnd - newStart < 10) return
      setManualZoom({ start: newStart, end: newEnd })
      return
    }

    // Otherwise, show crosshair
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    draw()
  }

  const handleMouseUp = () => {
    if (dragRef.current?.active) {
      dragRef.current = null
      setIsDragging(false)
    }
  }

  const handleMouseLeave = () => {
    mouseRef.current = null
    if (dragRef.current?.active) {
      dragRef.current = null
      setIsDragging(false)
    }
    draw()
  }
  const tfLabel = tf === '5' ? '5m' : tf === '15' ? '15m' : tf === '60' ? '1H' : '1D'
  const Th = dark
    ? { bg: BG, surface: SURFACE, border: BORDER, muted: MUTED }
    : { bg: LIGHT.BG, surface: LIGHT.SURFACE, border: LIGHT.BORDER, muted: LIGHT.MUTED }

  return (
    <div style={{ background: Th.bg, borderRadius: 6, overflow: 'hidden', border: `1px solid ${Th.border}` }}>
      <div className="flex items-center justify-between px-2 py-1" style={{ background: Th.surface, borderBottom: `1px solid ${Th.border}` }}>
        <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>{tfLabel}</span>
        <span style={{ color: Th.muted, fontSize: 9 }}>{visibleBars.length}/{allBars.length} bars</span>
      </div>
      {loading ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : (
        <canvas ref={canvasRef}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ width: '100%', height, display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }} />
      )}
    </div>
  )
}

// ─── Stats (unchanged, compact) ─────────────────────────
function StatsPanel({ signals, dark }: { signals: Signal[]; dark: boolean }) {
  if (!signals.length) return null
  const C = dark
    ? { SURFACE, BORDER, TEXT2, MUTED, TEAL, RED, GOLD }
    : { SURFACE: LIGHT.SURFACE, BORDER: LIGHT.BORDER, TEXT2: LIGHT.TEXT2, MUTED: LIGHT.MUTED, TEAL: LIGHT.TEAL, RED: LIGHT.RED, GOLD }
  const dates = new Set(signals.map(s => s.date)).size
  const tickers = new Set(signals.map(s => s.ticker)).size
  const avgD0Chg = signals.reduce((s, x) => s + ((x.close - x.open) / x.open * 100), 0) / signals.length
  const avgRange = signals.reduce((s, x) => s + ((x.high - x.low) / x.open * 100), 0) / signals.length
  const wins = signals.filter(s => s.close > s.open).length
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4 }}>
      <StatPill label="Signals" value={String(signals.length)} color={C.GOLD} dark={dark} />
      <StatPill label="Days" value={String(dates)} dark={dark} />
      <StatPill label="Tickers" value={String(tickers)} dark={dark} />
      <StatPill label="Avg D0" value={`${avgD0Chg > 0 ? '+' : ''}${avgD0Chg.toFixed(1)}%`} color={avgD0Chg > 0 ? C.TEAL : C.RED} dark={dark} />
      <StatPill label="Avg Rng" value={`${avgRange.toFixed(1)}%`} dark={dark} />
      <StatPill label="Green" value={`${(wins/signals.length*100).toFixed(0)}%`} color={C.TEAL} dark={dark} />
      {signals[0]?.am_ext_atr != null && (
        <StatPill label="Avg Ext" value={`${(signals.reduce((s,x) => s + (x.am_ext_atr || 0), 0) / signals.length).toFixed(2)}x ATR`} color={C.GOLD} dark={dark} />
      )}
    </div>
  )
}

function StatPill({ label, value, color, dark }: { label: string; value: string; color?: string; dark: boolean }) {
  const C = dark ? { MUTED, TEXT2 } : { MUTED: LIGHT.MUTED, TEXT2: LIGHT.TEXT2 }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span style={{ color: C.MUTED, fontSize: 9, fontWeight: 600 }}>{label}</span>
      <span style={{ color: color || C.TEXT2, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}


// ─── Helpers ────────────────────────────────────────────
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${days[d.getDay()]} ${mm}/${dd}`
}

function dateBtnStyle(color: string = GOLD, fontSize: number = 11, borderColor: string = color) {
  return {
    background: 'transparent' as const,
    border: `1px solid ${borderColor}`,
    borderRadius: 3,
    cursor: 'pointer' as const,
    fontSize,
    fontWeight: 700,
    padding: '2px 6px',
    fontFamily: 'inherit' as const,
    color,
  }
}
// ─── Main Page ──────────────────────────────────────────
export default function ScanDashboardPage() {
  const [scans, setScans] = useState<ScanDef[]>(BUILTIN_SCANS)
  const [selectedScan, setSelectedScan] = useState<string>('')
  const [hydrated, setHydrated] = useState(false)
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tf, setTf] = useState<Timeframe>('D')
  const [chartMode, setChartMode] = useState<ChartMode>('single')
  const [loading, setLoading] = useState(false)
  const [showRunPanel, setShowRunPanel] = useState(false)
  const [runRange, setRunRange] = useState('90')
  const [runFilters, setRunFilters] = useState<string[]>([])
  const [runCustomMode, setRunCustomMode] = useState(false)
  const [runFrom, setRunFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10) })
  const [runTo, setRunTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [copied, setCopied] = useState(false)
  const [pendingRuns, setPendingRuns] = useState<{ id: string; spec: string; label: string; startedAt: string; from: string; to: string; progress?: { currentDay: string; currentIndex: number; totalDays: number; signalsSoFar: number; status: string } }[]>([])
  const knownRunIdsRef = useRef<Set<string>>(new Set())
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [selectedRun, setSelectedRun] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showIndToggles, setShowIndToggles] = useState(false)
  const [showScanParams, setShowScanParams] = useState<string | null>(null) // strategy key
  const [scanParamSpecs, setScanParamSpecs] = useState<any[]>([]) // from /api/scans/run
  const [scanParams, setScanParams] = useState<Record<string, any>>({}) // current values
  const [scanRunning, setScanRunning] = useState(false)
  const [rerunRun, setRerunRun] = useState<ScanRun | null>(null)
  const [rerunFrom, setRerunFrom] = useState('')
  const [rerunTo, setRerunTo] = useState('')
  const [rerunRunning, setRerunRunning] = useState(false)
  const [scanRange, setScanRange] = useState<'today' | '1w' | '1m' | '3m' | 'ytd' | 'custom'>('1m')
  const [scanFromDate, setScanFromDate] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10))
  const [scanToDate, setScanToDate] = useState(new Date().toISOString().slice(0, 10))
  const [activeJobs, setActiveJobs] = useState<Array<{ id: string; label: string; status: string; elapsed: number; progress?: string; signalCount?: number; error?: string; log?: string }>>([])
  const [showKLConfig, setShowKLConfig] = useState(false)
  const [klParams, setKlParams] = useState<KeyLevelsParams>({
    lookLeft: 48, lookRight: 24, numPivots: 1,
    atrLength: 36, zoneWidth: 0.5, maxZonePercent: 1, extendRight: true,
  })
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showEma9_20: false, showEma72_89: false, showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false, showKeyLevels: false,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: true,
  })
  const [dark, setDark] = useState(true)
  const [pageMode, setPageMode] = useState<PageMode>('scanner')
  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [btTab, setBtTab] = useState<string>('overview')
  const [sortCol, setSortCol] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [dayOffset, setDayOffset] = useState(0)

  // Restore persisted state after hydration
  useEffect(() => {
    // Fetch scan runner specs
    fetch('/api/scans/run').then(r => r.json()).then(d => {
      if (d.specs) {
        setScanParamSpecs(d.specs)
        // Set defaults
        const defs: Record<string, any> = {}
        for (const spec of d.specs) {
          for (const p of spec.params) {
            defs[`${spec.strategy}.${p.key}`] = p.default
          }
        }
        setScanParams(defs)
      }
    }).catch(() => {})

    // Poll active jobs on mount (pick up jobs from previous navigation)
    // Live polling handled by effect below when activeJobs change

    const savedScan = localStorage.getItem('scanner_selectedScan')
    const savedIdx = localStorage.getItem('scanner_selectedIdx')
    if (savedScan) setSelectedScan(savedScan)
    if (savedIdx) setSelectedIdx(parseInt(savedIdx, 10) || 0)
    setHydrated(true)
  }, [])

  // Poll active scan jobs
  useEffect(() => {
    if (activeJobs.length === 0) return
    const interval = setInterval(async () => {
      const updated = await Promise.all(activeJobs.map(async (job) => {
        if (job.status !== 'running') return job
        try {
          const r = await fetch(`/api/scans/run?job=${job.id}`)
          const d = await r.json()
          if (d.status === 'done') {
            // Refresh scans list + strategy map so the new run auto-loads its signals.
            // Clearing selectedRun makes the signal effect re-pick the latest run.
            refreshScans().then(() => setSelectedRun('')).catch(() => {})
          }
          return { ...job, status: d.status, elapsed: d.elapsed, progress: d.progress, signalCount: d.signalCount, error: d.error, log: d.log }
        } catch { return job }
      }))
      setActiveJobs(updated.filter(j => j.status === 'running' || (j.status === 'done' && Date.now() - 0 < Infinity)))
      // Auto-remove done/error jobs after 10s
      setTimeout(() => setActiveJobs(prev => prev.filter(j => j.status === 'running')), 10000)
    }, 3000)
    return () => clearInterval(interval)
  }, [activeJobs.length])

  useEffect(() => { if (hydrated) localStorage.setItem('scanner_selectedIdx', String(selectedIdx)) }, [selectedIdx, hydrated])
  const T = useThemeColors(dark)

  // Collapsible folder group
  const FolderGroup = ({ label, items }: { label: string; items: ScanDef[] }) => {
    const [open, setOpen] = useState(true)
    const totalSig = items.reduce((s, i) => s + (i.resultCount || 0), 0)
    const totalRuns = items.reduce((s, i) => s + (i.runs?.length || 0), 0)
    return (
      <div>
        <button onClick={() => setOpen(!open)} style={{
          display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
          padding: '7px 10px', border: 'none', cursor: 'pointer', background: 'transparent',
          borderBottom: `1px solid ${T.BORDER}`,
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: GOLD, fontSize: 10, marginRight: 6, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
          <span style={{ color: T.TEXT2, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{label}</span>
          <span style={{ color: T.MUTED, fontSize: 9, marginRight: 4 }}>{totalSig} sig</span>
          <span style={{ color: T.MUTED, fontSize: 9 }}>{totalRuns} runs</span>
        </button>
        {open && items.map(scan => {
          const isActive = scan.id === selectedScan
          return (
            <button key={scan.id} onClick={() => { setSelectedScan(scan.id); localStorage.setItem('scanner_selectedScan', scan.id) }} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 10px 6px 22px', border: 'none', cursor: 'pointer',
              background: isActive ? T.GOLD_DIM : 'transparent',
              borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
              borderBottom: `1px solid ${T.BORDER}`,
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between" style={{ width: '100%' }}>
                <span style={{ color: isActive ? GOLD : T.TEXT, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{scan.name}</span>
                {scan.type === 'builtin' && (
                  <span onClick={e => { e.stopPropagation(); setShowScanParams(showScanParams === scan.id ? null : scan.id) }}
                    style={{ cursor: 'pointer', color: showScanParams === scan.id ? GOLD : T.MUTED, fontSize: 9, fontWeight: 700, padding: '2px 6px', border: `1px solid ${showScanParams === scan.id ? GOLD : T.BORDER}`, borderRadius: 3, background: showScanParams === scan.id ? `${GOLD}15` : 'transparent', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4, flexShrink: 0 }}>
                    {showScanParams === scan.id ? '▼ Params' : '⚙ Edit'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${T.TEAL}20`, color: T.TEAL }}>{scan.resultCount} sig</span>
                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${GOLD}20`, color: GOLD }}>{(scan.runs?.length || 0)} runs</span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // Nested folder group (project > Scans / Backtests)
  const NestedFolderGroup = ({ label, subfolders, grouped, projectId }: {
    label: string
    subfolders: { id: string; label: string }[]
    grouped: Record<string, ScanDef[]>
    projectId: string
  }) => {
    const [open, setOpen] = useState(true)
    const totalSig = subfolders.reduce((s, sf) => s + (grouped[`${projectId}/${sf.id}`] || []).reduce((a: number, i: ScanDef) => a + (i.resultCount || 0), 0), 0)
    const totalRuns = subfolders.reduce((s, sf) => s + (grouped[`${projectId}/${sf.id}`] || []).reduce((a: number, i: ScanDef) => a + (i.runs?.length || 0), 0), 0)
    return (
      <div>
        <button onClick={() => setOpen(!open)} style={{
          display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
          padding: '7px 10px', border: 'none', cursor: 'pointer', background: 'transparent',
          borderBottom: `1px solid ${T.BORDER}`,
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: GOLD, fontSize: 10, marginRight: 6, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
          <span style={{ color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{label}</span>
          <span style={{ color: T.MUTED, fontSize: 9, marginRight: 4 }}>{totalSig} sig</span>
          <span style={{ color: T.MUTED, fontSize: 9 }}>{totalRuns} runs</span>
        </button>
        {open && subfolders.map(sf => {
          const items = grouped[`${projectId}/${sf.id}`] || []
          if (items.length === 0) return null
          return (
            <div key={sf.id}>
              <div style={{ padding: '4px 10px 4px 18px', color: T.MUTED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(255,255,255,0.01)', borderBottom: `1px solid ${T.BORDER}` }}>{sf.label}</div>
              {items.map(scan => {
                const isActive = scan.id === selectedScan
                return (
                  <button key={scan.id} onClick={() => { setSelectedScan(scan.id); localStorage.setItem('scanner_selectedScan', scan.id) }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 10px 6px 28px', border: 'none', cursor: 'pointer',
                    background: isActive ? T.GOLD_DIM : 'transparent',
                    borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
                    borderBottom: `1px solid ${T.BORDER}`,
                  }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div className="flex items-center justify-between" style={{ width: '100%' }}>
                      <span style={{ color: isActive ? GOLD : T.TEXT, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{scan.name}</span>
                      {scan.type === 'builtin' && (
                        <span onClick={e => { e.stopPropagation(); setShowScanParams(showScanParams === scan.id ? null : scan.id) }}
                          style={{ cursor: 'pointer', color: showScanParams === scan.id ? GOLD : T.MUTED, fontSize: 9, fontWeight: 700, padding: '2px 6px', border: `1px solid ${showScanParams === scan.id ? GOLD : T.BORDER}`, borderRadius: 3, background: showScanParams === scan.id ? `${GOLD}15` : 'transparent', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4, flexShrink: 0 }}>
                          {showScanParams === scan.id ? '▼ Params' : '⚙ Edit'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                      <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${T.TEAL}20`, color: T.TEAL }}>{scan.resultCount} sig</span>
                      <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${GOLD}20`, color: GOLD }}>{(scan.runs?.length || 0)} runs</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const activeRowRef = useRef<HTMLTableRowElement>(null)

  // DB scan records — keyed by strategy, used as runs
  const [dbScansByStrategy, setDbScansByStrategy] = useState<Record<string, ScanDef[]>>({})

  // Derive runs for the selected scan
  const activeScanDef = scans.find(s => s.id === selectedScan)
  const activeSpec = scanParamSpecs.find((s: any) => {
    const strat = BUILTIN_SPEC_MAP[activeScanDef?.id || ''] || activeScanDef?.strategy || ''
    return s.strategy === strat || s.strategy === strat.replace(/-lc$/, '')
  })
  const activeStrategy = activeScanDef ? (BUILTIN_SPEC_MAP[activeScanDef.id] || activeScanDef.name.toLowerCase().replace(/\s+/g, '-')) : ''
  const runs: ScanRun[] = (dbScansByStrategy[activeStrategy] || []).map(db => ({
    id: db.id,
    scanId: db.id,
    dateRange: db.name,
    runAt: new Date(db.createdAt).toLocaleString(),
    resultCount: db.resultCount,
    tags: db.tags ? (typeof db.tags === 'string' ? JSON.parse(db.tags) : db.tags) : [],
    strategy: db.strategy,
    rawParams: db.params ? (typeof db.params === 'string' ? JSON.parse(db.params) : db.params) : null,
    rawDateRange: db.dateRange ? (typeof db.dateRange === 'string' ? JSON.parse(db.dateRange) : db.dateRange) : null,
  }))

  // Reusable: fetch + rebuild scans list AND strategy map (mount + after job completion)
  // MUST rebuild dbScansByStrategy, not just setScans — the signal-loading effect
  // depends on it to find the latest run.
  const refreshScans = useCallback((): Promise<ScanDef[]> => {
    return fetch('/api/scans')
      .then(r => r.json())
      .then(data => {
        const dbScans: any[] = data.scans || []

        // Group DB scans by strategy
        const byStrategy: Record<string, ScanDef[]> = {}
        for (const s of dbScans) {
          const strat = s.strategy || 'custom'
          if (!byStrategy[strat]) byStrategy[strat] = []
          byStrategy[strat].push(s)
        }
        setDbScansByStrategy(byStrategy)

        // Build deduplicated scan list: built-ins (enriched with DB totals) + any DB-only scans
        const enrichedBuiltins = BUILTIN_SCANS.map(b => {
          const strat = BUILTIN_SPEC_MAP[b.id] || b.name.toLowerCase()
          const dbMatches = byStrategy[strat] || []
          const totalSig = dbMatches.reduce((sum, d) => sum + (d.resultCount || 0), 0)
          return { ...b, resultCount: totalSig, runs: dbMatches }
        })

        // Add DB-only scans that don't match any built-in
        const builtinStrats = new Set(Object.values(BUILTIN_SPEC_MAP))
        const dbOnlyScans: ScanDef[] = []
        for (const [strat, matches] of Object.entries(byStrategy)) {
          if (!builtinStrats.has(strat) && matches.length > 0) {
            const totalSig = matches.reduce((sum, d) => sum + (d.resultCount || 0), 0)
            dbOnlyScans.push({
              id: `strategy-${strat}`,
              name: strat.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              type: 'spec',
              resultCount: totalSig,
              createdAt: matches[0].createdAt,
              runs: matches,
            })
          }
        }

        const list = [...enrichedBuiltins, ...dbOnlyScans]
        setScans(list)
        // Track all known run IDs so we can detect new ones
        const allRunIds = list.flatMap(s => (s.runs || []).map((r: ScanRun) => r.id))
        knownRunIdsRef.current = new Set(allRunIds)
        return list
      })
  }, [])

  // Load scans on mount, then pick a default selectedScan
  useEffect(() => {
    refreshScans().then(list => {
      if (list.length && !selectedScan) {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('scanner_selectedScan') : null
        const savedExists = saved && list.some(s => s.id === saved)
        if (savedExists) {
          setSelectedScan(saved)
        } else {
          const withResults = list.find(s => s.resultCount > 0)
          setSelectedScan(withResults ? withResults.id : list[0].id)
        }
      }
    })
  }, [])

  // When selectedScan or selectedRun changes, load signals
  useEffect(() => {
    if (!selectedScan) return

    // If a specific run is selected, load from DB
    if (selectedRun && !selectedRun.startsWith('r')) {
      setLoading(true)
      fetch(`/api/scans/${selectedRun}`)
        .then(r => r.json())
        .then(data => { setSignals(data.results || []); setSelectedIdx(0); setDayOffset(0); setLoading(false) })
        .catch(() => setLoading(false))
      return
    }

    // Otherwise, load the latest run for this strategy
    const scanDef = scans.find(s => s.id === selectedScan)
    const strat = scanDef ? (BUILTIN_SPEC_MAP[scanDef.id] || scanDef.name.toLowerCase().replace(/\s+/g, '-')) : ''
    const dbMatches = dbScansByStrategy[strat] || []
    if (dbMatches.length > 0) {
      // Load the latest run
      const latest = dbMatches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      setSelectedRun(latest.id)
    } else {
      setSignals([])
    }
  }, [selectedScan, selectedRun, dbScansByStrategy])

  // When scan selection changes, reset run selection
  useEffect(() => {
    setSelectedRun('')
  }, [selectedScan])

  const activeScan = scans.find(s => s.id === selectedScan)

  // ── Deduplicated signals (group multi-signal by ticker+date) ──
  const dedupedSignals = useMemo(() => {
    const hasMultipleSignalTypes = new Set(signals.map(s => s.signal)).size > 1
    if (!hasMultipleSignalTypes) return signals
    // Group by ticker+date
    const groups = new Map<string, Signal>()
    const signalTypes = new Set<string>()
    for (const s of signals) {
      signalTypes.add(s.signal)
      const key = `${s.ticker}::${s.date}`
      if (!groups.has(key)) {
        groups.set(key, { ...s, signal: s.signal, signals: [s.signal] })
      } else {
        const existing = groups.get(key)!
        if (!existing.signals!.includes(s.signal)) {
          existing.signals!.push(s.signal)
        }
      }
    }
    // Add boolean columns for each signal type
    for (const [, sig] of groups) {
      for (const st of signalTypes) {
        sig[`is_${st}`] = sig.signals!.includes(st)
      }
    }
    return Array.from(groups.values())
  }, [signals])

  // ── Signal type columns for multi-signal scans ──
  const signalTypeColumns = useMemo(() => {
    const types = new Set<string>()
    for (const s of dedupedSignals) {
      if (s.signals) for (const st of s.signals) types.add(st)
    }
    return Array.from(types).sort()
  }, [dedupedSignals])

  const isMultiSignal = signalTypeColumns.length > 1

  // ── Sorted signals for table ──
  const sortedSignals = useMemo(() => {
    const sorted = [...dedupedSignals]
    sorted.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0
      switch (sortCol) {
        case 'ticker': va = a.ticker; vb = b.ticker; break
        case 'date': va = a.date; vb = b.date; break
        case 'open': va = a.open; vb = b.open; break
        case 'close': va = a.close; vb = b.close; break
        case 'gap': va = a.gap_pct || 0; vb = b.gap_pct || 0; break
        case 'd0': va = ((a.close - a.open) / a.open * 100); vb = ((b.close - b.open) / b.open * 100); break
        case 'range': va = ((a.high - a.low) / a.open * 100); vb = ((b.high - b.low) / b.open * 100); break
        case 'abs': va = a.pos_abs || 0; vb = b.pos_abs || 0; break
        case 'vol': va = a.volume || 0; vb = b.volume || 0; break
        case 'pm_high_atr': va = a.pm_high_atr ?? -99; vb = b.pm_high_atr ?? -99; break
        case 'dev69_upper': va = (a as any).dev69_upper ?? -99; vb = (b as any).dev69_upper ?? -99; break
        default: va = a.date; vb = b.date
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [signals, sortCol, sortDir])

  const sig = sortedSignals[selectedIdx] as Signal | undefined

  // Helper: convert date + time_int (HHMM) to epoch seconds in ET timezone
  const timeStrToSec = (dateStr: string, timeInt: string) => {
    try {
      const ti = timeInt.padStart(4, '0')
      const h = parseInt(ti.slice(0, 2)), m = parseInt(ti.slice(2, 4))
      // Build as ET (America/New_York = UTC-5 or UTC-4)
      const d = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00-05:00`)
      return Math.floor(d.getTime() / 1000)
    } catch { return 0 }
  }

  // Backtest detection for chart mode — markers passed as HHMM time_int, matched to bars in ScanMiniChart
  const isBT = sig && (sig as any).entry_type != null
  const chartDate = sig ? (isBT ? (sig as any).d0_date : ((sig as any).signal_date || sig.date)) : undefined
  // Build per-leg markers: each leg gets its own entry (red) and exit (green)
  const legMarkers = isBT ? (() => {
    const rawLegs = (sig as any).legs
    if (!rawLegs || !Array.isArray(rawLegs)) return undefined
    return rawLegs.map((lg: any) => ({
      entry: lg.entry_price && lg.entry_epoch ? { price: lg.entry_price, epoch: lg.entry_epoch } : undefined,
      exit: lg.exit_price && lg.exit_epoch ? { price: lg.exit_price, epoch: lg.exit_epoch } : undefined,
    })).filter((m: any) => m.entry || m.exit)
  })() : undefined
  // Top-level exit epoch — used to size the chart (show D0 through exit day)
  const tradeExitEpoch = isBT ? Number((sig as any).exit_epoch) || undefined : undefined

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

 // Reset day offset when signal changes
 // (also done inline in every setSelectedIdx call)

  // Scroll active signal row into view when selection changes
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedIdx])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!signals.length) return
      // Don't intercept arrows when user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); setDayOffset(d => Math.max(0, d - 1)) }
      if (e.key === 'ArrowRight') { e.preventDefault(); setDayOffset(d => d + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(prev => Math.max(0, prev - 1)); setDayOffset(0) }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(prev => Math.min(signals.length - 1, prev + 1)); setDayOffset(0) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [signals.length])

  // ── Filtered signals for backtest mode ──
  const filteredSignals = useMemo(() => {
    if (activeFilters.size === 0) return sortedSignals
    return sortedSignals.filter(s => {
      for (const key of activeFilters) {
        const f = FILTERS.find(ff => ff.key === key)
        if (f && !f.compute(s)) return false
      }
      return true
    })
  }, [sortedSignals, activeFilters])

  // ── Baseline backtest: buy D0 open, sell D0 close ──
  const runBaselineBacktest = useCallback((sigs?: Signal[]) => {
    const source = sigs || filteredSignals
    if (!source.length) return
    // Skip baseline for backtest trade data (no open/close/low fields)
    const isBacktest = (source[0] as any).entry_type != null
    let trades: { pnlPct: number; rMultiple: number; win: boolean; date: string }[]
    if (isBacktest) {
      trades = source.map((s: any) => {
        const pnlPct = (s.pnl_pct || 0) * 100
        const rMultiple = s.stop_price ? (s.exit_price - s.entry_price) / (s.entry_price - s.stop_price) : 0
        return { pnlPct, rMultiple, win: pnlPct > 0, date: s.signal_date || s.date }
      })
    } else {
      trades = source.map(s => {
        const pnlPct = ((s.close - s.open) / s.open) * 100
        const risk = s.open - s.low
        const rMultiple = risk > 0 ? (s.close - s.open) / risk : 0
        return { pnlPct, rMultiple, win: pnlPct > 0, date: s.date }
      })
    }
    const returns = trades.map(t => t.pnlPct)
    const wins = trades.filter(t => t.win)
    const losses = trades.filter(t => !t.win)
    const totalPnl = returns.reduce((a, r) => a + r, 0)
    const grossWin = wins.reduce((a, t) => a + t.pnlPct, 0)
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlPct, 0))
    const winRate = (wins.length / trades.length) * 100
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0
    const rMultiples = trades.map(t => t.rMultiple)
    const avgRMultiple = rMultiples.reduce((a, r) => a + r, 0) / rMultiples.length
    const sortedR = [...rMultiples].sort((a, b) => a - b)
    const medianR = sortedR.length % 2 === 0 ? (sortedR[sortedR.length / 2 - 1] + sortedR[sortedR.length / 2]) / 2 : sortedR[Math.floor(sortedR.length / 2)]
    const avgWinPct = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0
    const avgLossPct = losses.length > 0 ? losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length : 0
    const expectancyPct = (winRate / 100) * avgWinPct + ((100 - winRate) / 100) * avgLossPct
    const wlRatio = losses.length > 0 && avgLossPct !== 0 ? Math.abs(avgWinPct / avgLossPct) : 0
    let cumPnl = 0, peak = 0, maxDd = 0, ddStart = 0, maxDDDuration = 0
    const cumPnlSeries: number[] = [], drawdownSeries: number[] = []
    returns.forEach((r, i) => {
      cumPnl += r; cumPnlSeries.push(cumPnl)
      peak = Math.max(peak, cumPnl)
      const dd = peak - cumPnl; drawdownSeries.push(dd)
      if (dd > 0 && ddStart === 0) ddStart = i
      maxDd = Math.max(maxDd, dd)
      if (dd === 0 && ddStart > 0) { maxDDDuration = Math.max(maxDDDuration, i - ddStart); ddStart = 0 }
    })
    if (ddStart > 0) maxDDDuration = Math.max(maxDDDuration, returns.length - ddStart)
    const meanReturn = returns.reduce((a, r) => a + r, 0) / returns.length
    const stdDev = Math.sqrt(returns.reduce((a, r) => a + (r - meanReturn) ** 2, 0) / returns.length)
    const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0
    const downsideReturns = returns.filter(r => r < 0)
    const downsideDev = downsideReturns.length > 0 ? Math.sqrt(downsideReturns.reduce((a, r) => a + r ** 2, 0) / downsideReturns.length) : 0
    const sortino = downsideDev > 0 ? (meanReturn / downsideDev) * Math.sqrt(252) : 0
    const totalReturnPct = totalPnl
    const tradingDays = new Set(source.map(s => s.date || (s as any).signal_date)).size
    const yearsInSample = tradingDays / 252
    const cagr = yearsInSample > 0 ? (Math.pow(1 + totalReturnPct / 100, 1 / yearsInSample) - 1) * 100 : totalReturnPct
    const calmar = maxDd > 0 ? Math.abs(totalReturnPct / maxDd) : 0
    let cWins = 0, cLosses = 0, maxCWins = 0, maxCLosses = 0
    trades.forEach(t => { if (t.win) { cWins++; cLosses = 0; maxCWins = Math.max(maxCWins, cWins) } else { cLosses++; cWins = 0; maxCLosses = Math.max(maxCLosses, cLosses) } })
    const recoveryFactor = maxDd > 0 ? totalPnl / maxDd : 0
    const byMonth: Record<string, { pnls: number[] }> = {}
    source.forEach((s, i) => { const month = (s.date || (s as any).signal_date).slice(0, 7); if (!byMonth[month]) byMonth[month] = { pnls: [] }; byMonth[month].pnls.push(trades[i].pnlPct) })
    const monthlyStats = Object.entries(byMonth).map(([month, d]) => ({ month, pnl: d.pnls.reduce((a, b) => a + b, 0), count: d.pnls.length }))
    setBacktestResults({
      entryType: 'D0 Open', exitType: 'D0 Close', totalTrades: trades.length,
      winRate, pctProfitable: winRate, profitFactor, sharpe, sortino, calmar,
      maxDrawdown: maxDd, maxDDDuration, avgRMultiple, medianR,
      avgWinPct, avgLossPct, expectancy: expectancyPct, expectancyPct,
      wlRatio, totalPnl: totalPnl * 1000, totalReturnPct, cagr,
      avgTradeDuration: '1 day', maxConsecWins: maxCWins, maxConsecLosses: maxCLosses,
      bestTrade: Math.max(...returns), worstTrade: Math.min(...returns),
      stdDevReturns: stdDev, downsideDev, recoveryFactor, grossWin, grossLoss,
      tradeReturns: returns, cumPnlSeries, drawdownSeries,
      dayStats: [], monthlyStats,
    })
  }, [filteredSignals])

  // Auto-run backtest when signals or filters change
  useEffect(() => { if (filteredSignals.length > 0) runBaselineBacktest(filteredSignals) }, [filteredSignals])

  // ── Poll DB for pending run completion + progress ──
  useEffect(() => {
    if (pendingRuns.length === 0) return
    const interval = setInterval(() => {
      // Fetch progress for all pending runs
      Promise.all(pendingRuns.map(pending =>
        fetch(`/api/scans/progress?spec=${pending.spec}&from=${pending.label.split(' · ')[1]?.split(' → ')[0] || ''}&to=${pending.label.split(' → ')[1] || ''}`)
          .then(r => r.json()).catch(() => null)
      )).then(progressData => {
        setPendingRuns(prev => prev.map((p, i) => {
          const prog = progressData[i]
          return prog ? { ...p, progress: prog } : p
        }))
      })

      // Check for completed runs in DB
      fetch('/api/scans')
        .then(r => r.json())
        .then(data => {
          const dbScans: any[] = data.scans || []
          const byStrat: Record<string, any[]> = {}
          dbScans.forEach((s: any) => { (byStrat[s.strategy] = byStrat[s.strategy] || []).push(s) })

          const stillPending: typeof pendingRuns = []
          let anyChanged = false

          for (const pending of pendingRuns) {
            const matches = byStrat[pending.spec] || []
            const newRun = matches.find((m: any) => !knownRunIdsRef.current.has(m.id))
            if (newRun) {
              knownRunIdsRef.current.add(newRun.id)
              anyChanged = true
              fetch(`/api/scans/${newRun.id}`).then(r => r.json()).then(d => {
                const sigs = d.results || d.signals || []
                if (sigs.length) {
                  setSignals(sigs.map((s: any) => ({ ...s, ticker: s.ticker || s.symbol || '', symbol: s.ticker || s.symbol || '' })))
                  setSelectedIdx(0)
                  setDayOffset(0)
                }
              })
            } else {
              stillPending.push(pending)
            }
          }

          setPendingRuns(stillPending)

          if (anyChanged) {
            const freshScans = BUILTIN_SCANS.map(builtin => {
              const matches = byStrat[BUILTIN_SPEC_MAP[builtin.id]] || []
              const totalSig = matches.reduce((a: number, s: any) => a + (s.resultCount || 0), 0)
              return { ...builtin, resultCount: totalSig, runs: matches.map((m: any) => ({ id: m.id, scanId: m.id, dateRange: m.name, runAt: new Date(m.createdAt).toLocaleString(), resultCount: m.resultCount, tags: m.tags ? (typeof m.tags === 'string' ? JSON.parse(m.tags) : m.tags) : [] })) }
            })
            setScans(freshScans)
          }
        })
        .catch(() => {})
    }, 2000)
    return () => clearInterval(interval)
  }, [pendingRuns])

  const [leftW, setLeftW] = useState(LEFT_W_DEFAULT)
  const [rightW, setRightW] = useState(RIGHT_W_DEFAULT)

  // Resize handler
  const resizing = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null)
  const onResizeDown = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = { side, startX: e.clientX, startW: side === 'left' ? leftW : rightW }
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const dx = ev.clientX - resizing.current.startX
      if (resizing.current.side === 'left') {
        setLeftW(Math.max(LEFT_W_MIN, Math.min(LEFT_W_MAX, resizing.current.startW + dx)))
      } else {
        setRightW(Math.max(RIGHT_W_MIN, Math.min(RIGHT_W_MAX, resizing.current.startW - dx)))
      }
    }
    const onUp = () => { resizing.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ─── Left Sidebar: Scans (top) + Runs (bottom) ────
  const renderLeftSidebar = () => (
    <div style={{
      width: leftW, minWidth: leftW, maxWidth: leftW,
      background: T.SURFACE, borderRight: 'none',
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      {/* ── Top half: Scan tree ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: `1px solid ${T.BORDER}` }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Scans</span>
            <span style={{ color: T.MUTED, fontSize: 10 }}>{scans.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {(() => {
            // Build nested tree from SCAN_TREE
            const grouped: Record<string, typeof scans> = {}
            const ungrouped: typeof scans = []
            scans.forEach(scan => {
              const g = (scan as any).group || (scan as any).tags?.[0] || ''
              if (g && g.includes('/')) {
                // Nested: 'mdr-swing/scans' or 'mdr-swing/backtests'
                (grouped[g] = grouped[g] || []).push(scan)
              } else {
                const topFolder = SCAN_TREE.find(f => f.id === g)
                if (topFolder && !topFolder.subfolders) {
                  (grouped[g] = grouped[g] || []).push(scan)
                } else {
                  ungrouped.push(scan)
                }
              }
            })
            return <>
              {SCAN_TREE.map(project => {
                if (project.subfolders) {
                  // Project with subfolders
                  const hasContent = project.subfolders.some(sf => (grouped[`${project.id}/${sf.id}`] || []).length > 0)
                  if (!hasContent) return null
                  return <NestedFolderGroup key={project.id} label={project.label} subfolders={project.subfolders} grouped={grouped} projectId={project.id} />
                } else {
                  // Flat project folder
                  const items = grouped[project.id] || []
                  if (items.length === 0) return null
                  return <FolderGroup key={project.id} label={project.label} items={items} />
                }
              })}
              {ungrouped.length > 0 && <FolderGroup label="Other" items={ungrouped} />}
            </>
          })()}
          {scans.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <Search className="h-5 w-5 mx-auto mb-2" style={{ color: T.MUTED, opacity: 0.3 }} />
              <p style={{ color: T.MUTED, fontSize: 11 }}>No saved scans</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom half: Runs for selected scan ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: GOLD, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Runs</span>
            <span style={{ color: T.MUTED, fontSize: 10 }}>{runs.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Pending runs — shown first */}
          {pendingRuns.filter(p => activeScan ? p.spec === (BUILTIN_SPEC_MAP[activeScan.id] || '') : true).map(pending => {
            const prog = pending.progress
            const pct = prog && prog.totalDays > 0 ? Math.round((prog.currentIndex / prog.totalDays) * 100) : 0
            return (
            <div key={pending.id} style={{
              padding: '8px 10px', borderBottom: `1px solid ${T.BORDER}`,
              background: `${GOLD}08`, borderLeft: `2px solid ${GOLD}60`,
            }}>
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: GOLD, flexShrink: 0 }} />
                <span style={{ color: GOLD, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{pending.label}</span>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 6, background: T.SURFACE3, borderRadius: 2, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: GOLD, borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                <span style={{ color: GOLD, fontSize: 9, fontWeight: 700 }}>{pct}%</span>
                {prog && prog.currentDay && <span style={{ color: T.MUTED, fontSize: 9 }}>{prog.currentDay}</span>}
                {prog && prog.signalsSoFar > 0 && <span style={{ color: T.TEAL, fontSize: 9, fontWeight: 600 }}>{prog.signalsSoFar} sig</span>}
                <span style={{ color: T.MUTED, fontSize: 9, marginLeft: 'auto' }}>{pending.startedAt}</span>
              </div>
            </div>
            )
          })}
          {/* Real runs */}
          {runs.length === 0 && pendingRuns.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ color: T.MUTED, fontSize: 10 }}>No runs yet</p>
              <p style={{ color: T.MUTED, fontSize: 9, marginTop: 4 }}>Click Run ▶ to execute</p>
            </div>
          )}
          {runs.map(run => {
            const isActive = run.id === selectedRun
            return (
            <div key={run.id} onClick={() => setSelectedRun(run.id)} style={{
              padding: '6px 10px', borderBottom: `1px solid ${T.BORDER}`, cursor: 'pointer',
              background: isActive ? T.GOLD_DIM : 'transparent',
              borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: isActive ? GOLD : T.TEXT2, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.dateRange}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: `${T.TEAL}20`, color: T.TEAL }}>{run.resultCount} sig</span>
              </div>
              <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                {[...new Set(run.tags || [])].map(tag => (
                  <span key={tag} style={{ fontSize: 9, padding: '0px 4px', borderRadius: 2, background: `${GOLD}12`, color: isActive ? GOLD : 'rgba(212,175,55,0.6)', fontWeight: 600 }}>{tag}</span>
                ))}
                <button onClick={e => { e.stopPropagation(); const d = new Date(); d.setDate(d.getDate() - 30); setRerunFrom(run.rawDateRange?.from || d.toISOString().slice(0, 10)); setRerunTo(run.rawDateRange?.to || new Date().toISOString().slice(0, 10)); setRerunRun(run) }} title="Rerun with new dates" style={{ marginLeft: 'auto', fontSize: 10, padding: '0px 5px', borderRadius: 2, background: 'transparent', color: isActive ? GOLD : T.MUTED, border: `1px solid ${T.BORDER}`, cursor: 'pointer', lineHeight: 1.4, fontWeight: 700 }}>↻</button>
                <span style={{ color: isActive ? GOLD : T.MUTED, fontSize: 9 }}>{run.runAt}</span>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {/* Rerun modal */}
      {rerunRun && (() => {
        const strat = rerunRun.strategy || activeStrategy
        const isRunner = scanParamSpecs.some((s: any) => s.strategy === strat)
        const params = rerunRun.rawParams || {}
        const di = { background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 3, padding: '6px 8px', color: T.TEXT, fontSize: 11, fontFamily: 'monospace' as const, outline: 'none' as const }
        return (
          <div onClick={() => setRerunRun(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 6, padding: 16, width: 340, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ color: GOLD, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>↻ RERUN</div>
              <div style={{ color: T.TEXT, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{rerunRun.dateRange} <span style={{ color: T.MUTED, fontSize: 10 }}>({strat})</span></div>
              <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Date Range</div>
              <div className="flex gap-2" style={{ marginBottom: 12 }}>
                <input type="date" value={rerunFrom} onChange={e => setRerunFrom(e.target.value)} style={{ ...di, width: '100%' }} />
                <input type="date" value={rerunTo} onChange={e => setRerunTo(e.target.value)} style={{ ...di, width: '100%' }} />
              </div>
              {Object.keys(params).length > 0 && (
                <>
                  <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Params {!isRunner && <span style={{ color: T.MUTED }}>(spec run)</span>}</div>
                  <div style={{ background: T.SURFACE2, border: `1px solid ${T.BORDER}`, borderRadius: 4, padding: 8, maxHeight: 140, overflowY: 'auto', marginBottom: 12 }}>
                    {Object.entries(params).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between" style={{ fontSize: 10, padding: '1px 0' }}>
                        <span style={{ color: T.TEXT2 }}>{k}</span>
                        <span style={{ color: T.TEAL, fontFamily: 'monospace' }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={async () => {
                  setRerunRunning(true)
                  try {
                    const body = isRunner ? { runner: strat, params, from: rerunFrom, to: rerunTo } : { spec: strat, from: rerunFrom, to: rerunTo }
                    const resp = await fetch('/api/scans/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    const result = await resp.json()
                    if (result.ok && result.jobId) {
                      setActiveJobs(prev => [...prev, { id: result.jobId, label: rerunRun.dateRange, status: 'running', elapsed: 0 }])
                      setRerunRun(null)
                    } else { alert(`Error: ${result.error || 'unknown'}`) }
                  } catch (e: any) { alert(`Error: ${e.message}`) } finally { setRerunRunning(false) }
                }} disabled={rerunRunning} style={{ flex: 1, padding: '7px', borderRadius: 3, border: 'none', background: rerunRunning ? T.BORDER : GOLD, color: rerunRunning ? T.MUTED : '#000', fontSize: 11, fontWeight: 700, cursor: rerunRunning ? 'default' : 'pointer' }}>{rerunRunning ? 'Starting...' : '▶ Rerun'}</button>
                <button onClick={() => setRerunRun(null)} style={{ padding: '7px 12px', borderRadius: 3, border: `1px solid ${T.BORDER}`, background: 'transparent', color: T.MUTED, fontSize: 10, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Run panel */}
      <div style={{ borderTop: `1px solid ${T.BORDER}` }}>
        {showRunPanel && activeScan ? (() => {
          const specName = BUILTIN_SPEC_MAP[activeScan.id] || activeScan.name.toLowerCase().replace(/\s+/g, '-')
          const effectiveSpec = runFilters.includes('am-push') && specName === 'backside-b' ? 'backside-b-push' : specName
          const dates = runCustomMode ? { from: runFrom, to: runTo } : (() => { const d = parseInt(runRange); const t = new Date(); return { from: new Date(t.getTime() - d * 86400000).toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) } })()
          const cmd = `cd ~/.wzrd-pi-dev/projects/edge-dev/assets && PYTHONPATH=scan-engine:~/edge.dev/src ~/edge.dev/.venv/bin/python sandbox.py --spec ${effectiveSpec} --start ${dates.from} --end ${dates.to}${runFilters.length ? ' --filters ' + runFilters.join(',') : ''} --push`
          const dateInputStyle = { background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 3, padding: '6px 8px', color: T.TEXT, fontSize: 11, width: '100%', fontFamily: 'monospace', outline: 'none' as const }
          return (
            <div style={{ padding: '12px 14px', background: T.SURFACE2, borderBottom: `1px solid ${T.BORDER}` }}>
              <div style={{ color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{activeScan.name}</div>
              {/* Date range */}
              {!runCustomMode ? (
                <div className="flex gap-1 flex-wrap" style={{ marginBottom: 8 }}>
                  {['7', '14', '30', '60', '90', '180', '365'].map(d => (
                    <button key={d} onClick={() => setRunRange(d)} style={{ padding: '4px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: runRange === d ? GOLD : T.SURFACE, color: runRange === d ? '#000' : T.MUTED, border: `1px solid ${runRange === d ? GOLD : T.BORDER}` }}>{d}d</button>
                  ))}
                  <button onClick={() => setRunCustomMode(true)} style={{ padding: '4px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: T.SURFACE, color: T.MUTED, border: `1px solid ${T.BORDER}`, cursor: 'pointer' }}>Custom</button>
                </div>
              ) : (
                <div style={{ marginBottom: 8 }}>
                  <div className="flex gap-2">
                    <input type="date" value={runFrom} onChange={e => setRunFrom(e.target.value)} style={dateInputStyle} />
                    <input type="date" value={runTo} onChange={e => setRunTo(e.target.value)} style={dateInputStyle} />
                  </div>
                  <button onClick={() => setRunCustomMode(false)} style={{ padding: '2px 6px', borderRadius: 2, fontSize: 9, fontWeight: 600, background: T.SURFACE, color: T.MUTED, border: `1px solid ${T.BORDER}`, cursor: 'pointer', marginTop: 4 }}>← Quick</button>
                </div>
              )}
              {/* Filters */}
              {(activeScan.filters || []).length > 0 && (
                <div className="flex gap-1" style={{ marginBottom: 8 }}>
                  {activeScan.filters!.map(f => {
                    const isOn = runFilters.includes(f)
                    return <button key={f} onClick={() => setRunFilters(prev => isOn ? prev.filter(x => x !== f) : [...prev, f])} style={{ padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: isOn ? `${GOLD}30` : T.SURFACE, color: isOn ? GOLD : T.MUTED, border: `1px solid ${isOn ? GOLD : T.BORDER}`, cursor: 'pointer' }}>{f}</button>
                  })}
                </div>
              )}
              {/* Command preview */}
              <pre style={{ background: '#0a0a10', border: `1px solid ${T.BORDER}`, borderRadius: 4, padding: '8px 10px', fontSize: 9, fontFamily: 'monospace', color: T.TEAL, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 80, overflowY: 'auto', marginBottom: 8 }}>{cmd}</pre>
              {/* Actions */}
              <div className="flex gap-1">
                <button onClick={() => {
                  navigator.clipboard.writeText(cmd)
                  setCopied(true)
                  const spec = BUILTIN_SPEC_MAP[activeScan.id] || ''
                  const pendingId = `pending-${Date.now()}`
                  setPendingRuns(prev => [...prev, { id: pendingId, spec, label: `${activeScan.name} · ${dates.from} → ${dates.to}`, startedAt: new Date().toLocaleTimeString(), from: dates.from, to: dates.to }])
                  setTimeout(() => setCopied(false), 2000)
                  setShowRunPanel(false)
                }} style={{ flex: 1, padding: '7px', borderRadius: 3, fontSize: 11, fontWeight: 700, background: GOLD, color: '#000', border: 'none', cursor: 'pointer' }}>
                  {copied ? '✓ Copied!' : '📋 Copy & Run'}
                </button>
                <button onClick={() => setShowRunPanel(false)} style={{ padding: '7px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600, background: T.SURFACE, color: T.MUTED, border: `1px solid ${T.BORDER}`, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )
        })() : null}
        {/* Run button */}
        <div style={{ padding: 8 }}>
          <button onClick={() => { setShowRunPanel(!showRunPanel); if (!showRunPanel) setRunRange('90') }} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            width: '100%', padding: '8px', borderRadius: 4,
            background: showRunPanel ? T.SURFACE : T.GOLD_DIM, color: showRunPanel ? T.MUTED : GOLD, fontWeight: 700, fontSize: 11,
            border: `1px solid ${showRunPanel ? T.BORDER : T.GOLD_BORDER}`, cursor: 'pointer',
          }}>
            <Play className="h-3.5 w-3.5" /> {showRunPanel ? 'Cancel' : 'Run Scan'}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Right Sidebar: Signals + Chat ────────────────
  const renderRightSidebar = () => (
    <div style={{
      width: rightW, minWidth: rightW, maxWidth: rightW,
      background: T.SURFACE, borderLeft: 'none',
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="px-2 py-1.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <span style={{ color: GOLD, fontSize: 12, fontWeight: 700 }}>SIGNALS</span>
          <span style={{ color: T.MUTED, fontSize: 9 }}>{signals.length}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 10 }}>
            <thead>
              {(() => {
                const isBacktest = sortedSignals.length > 0 && (sortedSignals[0] as any).entry_type != null
                if (isBacktest) return (
                  <tr style={{ background: T.SURFACE2, position: 'sticky', top: 0, zIndex: 2 }}>
                    <th onClick={() => toggleSort('ticker')} style={{ padding: '4px 6px', textAlign: 'left', color: GOLD, fontSize: 8, fontWeight: 700, position: 'sticky', left: 0, background: T.SURFACE2, zIndex: 3, minWidth: 52, cursor: 'pointer', userSelect: 'none' }}>Tk</th>
                    <th onClick={() => toggleSort('signal_date')} style={{ padding: '4px 4px', textAlign: 'left', color: T.MUTED, fontSize: 8, fontWeight: 700, position: 'sticky', left: 52, background: T.SURFACE2, zIndex: 3, borderRight: `1px solid ${T.BORDER}`, cursor: 'pointer', userSelect: 'none', minWidth: 68 }}>Signal</th>
                    <th style={{ padding: '4px 4px', textAlign: 'left', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>Entry Type</th>
                    <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>Entry$</th>
                    <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>Stop$</th>
                    <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>Exit$</th>
                    <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>In→Out</th>
                    <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>Dur</th>
                    <th onClick={() => toggleSort('pnl_dollar')} style={{ padding: '4px 4px', textAlign: 'right', color: GOLD, fontSize: 8, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}>PnL$</th>
                    <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>%</th>
                    <th style={{ padding: '4px 4px', textAlign: 'left', color: T.MUTED, fontSize: 8, fontWeight: 700 }}>Exit Reason</th>
                  </tr>
                )
                return (
              <tr style={{ background: T.SURFACE2, position: 'sticky', top: 0, zIndex: 2 }}>
                <th onClick={() => toggleSort('ticker')} style={{ padding: '4px 6px', textAlign: 'left', color: sortCol === 'ticker' ? GOLD : GOLD, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, background: T.SURFACE2, zIndex: 3, minWidth: 56, cursor: 'pointer', userSelect: 'none' }}>Tk{sortCol === 'ticker' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('date')} style={{ padding: '4px 6px', textAlign: 'left', color: sortCol === 'date' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 56, background: T.SURFACE2, zIndex: 3, minWidth: 68, borderRight: `1px solid ${T.BORDER}`, cursor: 'pointer', userSelect: 'none' }}>Date{sortCol === 'date' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('open')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'open' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>Op{sortCol === 'open' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('close')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'close' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>Close{sortCol === 'close' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('gap')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'gap' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>Gap%{sortCol === 'gap' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('d0')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'd0' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>D0{sortCol === 'd0' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('range')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'range' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>Rng%{sortCol === 'range' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('abs')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'abs' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>ABS{sortCol === 'abs' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('vol')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'vol' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>Vol{sortCol === 'vol' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th onClick={() => toggleSort('pm_high_atr')} style={{ padding: '4px 4px', textAlign: 'right', color: sortCol === 'pm_high_atr' ? GOLD : T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}>PMΔ{sortCol === 'pm_high_atr' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th style={{ padding: '4px 4px', textAlign: 'center', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>½ATR</th>
                <th style={{ padding: '4px 4px', textAlign: 'center', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>¼ATR</th>
                <th style={{ padding: '4px 4px', textAlign: 'center', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>6.9</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>PM T</th>
                {/* Multi-signal type columns */}
                {isMultiSignal && signalTypeColumns.map(st => (
                  <th key={st} style={{ padding: '4px 3px', textAlign: 'center', color: GOLD, fontSize: 7, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{st.replace(/_/g, ' ').replace(/^d(\d)/, 'D$1')}</th>
                ))}
              </tr>
                )
              })()}
            </thead>
            <tbody>
              {/* Detect backtest vs scan mode */}
              {(() => {
                const isBacktest = sortedSignals.length > 0 && sortedSignals[0].entry_type != null
                if (isBacktest) {
                  // ── Backtest trade rows ──
                  return sortedSignals.map((s: any, i: number) => {
                    const isActive = i === selectedIdx
                    const pnlColor = s.pnl_dollar > 0 ? T.TEAL : s.pnl_dollar < 0 ? T.RED : T.MUTED
                    return (
                      <tr key={`${s.ticker}-${s.signal_date}-${s.entry_type}-${i}`} onClick={() => setSelectedIdx(i)} style={{ cursor: 'pointer', background: isActive ? T.GOLD_DIM : 'transparent' }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                      >
                        <td style={{ padding: '3px 4px', color: isActive ? GOLD : T.WHITE, fontWeight: 700, fontFamily: 'monospace', position: 'sticky', left: 0, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1, fontSize: 10 }}>{s.ticker}</td>
                        <td style={{ padding: '3px 4px', color: T.MUTED, position: 'sticky', left: 52, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1, borderRight: `1px solid ${T.BORDER}`, fontSize: 9, minWidth: 68, lineHeight: 1.3 }}>{(s.signal_date || '').slice(5)}<br/><span style={{fontSize:7,color:T.BORDER}}>D0:{(s.d0_date||'').slice(5)}</span></td>
                        <td style={{ padding: '3px 4px', color: '#a78bfa', textAlign: 'left', fontSize: 8, whiteSpace: 'nowrap' }}>{(s.entry_type||'').replace(/_/g,' ').slice(0,24)}</td>
                        <td style={{ padding: '3px 4px', color: T.TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.entry_price?.toFixed(2)}</td>
                        <td style={{ padding: '3px 4px', color: T.RED, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.stop_price?.toFixed(2)}</td>
                        <td style={{ padding: '3px 4px', color: pnlColor, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.exit_price?.toFixed(2)}</td>
                        <td style={{ padding: '3px 4px', color: T.MUTED, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>{String(s.entry_time).padStart(4,'0').replace(/^(\d{2})(\d{2})$/,'$1:$2')}→{String(s.exit_time).padStart(4,'0').replace(/^(\d{2})(\d{2})$/,'$1:$2')}</td>
                        <td style={{ padding: '3px 4px', color: T.MUTED, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>{(() => { const m = s.entry_epoch && s.exit_epoch ? Math.round((s.exit_epoch-s.entry_epoch)/60) : null; if(m==null)return '–'; return m<60?`${m}m`:`${(m/60).toFixed(1)}h` })()}</td>
                        <td style={{ padding: '3px 4px', color: pnlColor, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.pnl_dollar > 0 ? '+' : ''}{s.pnl_dollar?.toFixed(0)}</td>
                        <td style={{ padding: '3px 4px', color: pnlColor, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.pnl_pct > 0 ? '+' : ''}{((s.pnl_pct || 0) * 100).toFixed(1)}%</td>
                        <td style={{ padding: '3px 4px', color: s.exit_reason?.includes('stop') ? T.RED : s.exit_reason?.includes('target') ? T.TEAL : T.MUTED, textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontSize: 8, whiteSpace: 'nowrap' }}>{(s.exit_reason||'').replace(/_/g,' ').slice(0,26)}</td>
                      </tr>
                    )
                  })
                }
                // ── Scan signal rows (original) ──
                return sortedSignals.map((s, i) => {
                const isActive = i === selectedIdx
                const d0chg = ((s.close - s.open) / s.open * 100)
                const rng = ((s.high - s.low) / s.open * 100)
                return (
                  <tr ref={isActive ? activeRowRef : undefined} key={`${s.ticker}-${s.date}`} onClick={() => { setSelectedIdx(i); setDayOffset(0) }} style={{ cursor: 'pointer', background: isActive ? T.GOLD_DIM : 'transparent' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '3px 6px', color: isActive ? GOLD : T.WHITE, fontWeight: 700, fontFamily: 'monospace', position: 'sticky', left: 0, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1 }}>{s.ticker}</td>
                    <td style={{ padding: '3px 6px', color: isActive ? GOLD : T.MUTED, position: 'sticky', left: 56, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1, borderRight: `1px solid ${T.BORDER}` }}>{(s.date || (s as any).signal_date || '').slice(2)}</td>
                    <td style={{ padding: '3px 4px', color: T.TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${s.open?.toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: T.TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${s.close?.toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: T.TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(s.gap_pct || 0).toFixed(0)}%</td>
                    <td style={{ padding: '3px 4px', color: d0chg < 0 ? T.RED : T.TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d0chg > 0 ? '+' : ''}{d0chg.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: T.TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rng.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: GOLD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(s.pos_abs || 0).toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: T.MUTED, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{((s.volume || 0) / 1e6).toFixed(0)}M</td>
                    <td style={{ padding: '3px 4px', color: GOLD, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.pm_high_atr != null ? s.pm_high_atr.toFixed(2) : (s as any).pm_ext_atr != null ? ((s as any).pm_ext_atr as number).toFixed(2) : '–'}</td>
                    <td style={{ padding: '3px 2px', textAlign: 'center', fontSize: 9, color: (s as any).pm_hit_0_5x || (s as any)['pm_hit_0.5x'] ? GOLD : T.BORDER }}>{((s as any).pm_hit_0_5x || (s as any)['pm_hit_0.5x']) ? '✓' : '–'}</td>
                    <td style={{ padding: '3px 2px', textAlign: 'center', fontSize: 9, color: (s as any).pm_hit_0_25x || (s as any)['pm_hit_0.25x'] ? GOLD : T.BORDER }}>{((s as any).pm_hit_0_25x || (s as any)['pm_hit_0.25x']) ? '✓' : '–'}</td>
                    <td style={{ padding: '3px 2px', textAlign: 'center', fontSize: 9, color: (s as any).dev69_3hit ? GOLD : T.BORDER }}>{(s as any).dev69_3hit ? '✓' : '–'}</td>
                    <td style={{ padding: '3px 4px', color: s.pm_high_time ? T.TEXT2 : T.BORDER, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>{s.pm_high_time || '–'}</td>
                    {/* Multi-signal type checkmarks */}
                    {isMultiSignal && signalTypeColumns.map(st => (
                      <td key={st} style={{ padding: '3px 3px', textAlign: 'center', fontSize: 9 }}>
                        {s[`is_${st}`] ? <span style={{ color: GOLD, fontWeight: 700 }}>✓</span> : <span style={{ color: T.BORDER }}>·</span>}
                      </td>
                    ))}
                  </tr>
                )
              })
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chat */}
      <div style={{ height: '35%', minHeight: 140, borderTop: `1px solid ${T.BORDER}`, display: 'flex', flexDirection: 'column' }}>
        <div className="px-2 py-1.5 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <MessageSquare className="h-3 w-3" style={{ color: GOLD }} />
          <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>CHAT</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '6px 8px' }}>
          {chatMessages.length === 0 && (
            <p style={{ color: T.MUTED, fontSize: 10, fontStyle: 'italic', padding: '8px 4px' }}>Ask about signals, patterns, or scan params...</p>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1.4, background: m.role === 'user' ? T.GOLD_DIM : T.SURFACE2, color: T.TEXT, maxWidth: '90%', wordBreak: 'break-word' }}>{m.content}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '4px 6px', borderTop: `1px solid ${T.BORDER}`, display: 'flex', gap: 4 }}>
          <input value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && chatInput.trim()) {
                const msg = chatInput.trim()
                setChatMessages(prev => [...prev, { role: 'user', content: msg }])
                setChatInput('')
                setTimeout(() => { setChatMessages(prev => [...prev, { role: 'assistant', content: `Analyzing: "${msg}" — API coming soon.` }]) }, 500)
              }
            }}
            placeholder="Ask about signals..."
            style={{ flex: 1, background: T.BG, border: `1px solid ${T.BORDER}`, borderRadius: 3, padding: '5px 8px', color: T.TEXT, fontSize: 11, outline: 'none' }}
          />
          <button style={{ padding: '4px 8px', borderRadius: 3, background: GOLD, color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Center: Stats + Chart ────────────────────────
  const renderCenter = () => (
    <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {pageMode === 'scanner' ? (
        <StatsPanel signals={signals} dark={dark} />
      ) : (
        <>
          {/* Backtest mode: filter toggles + stats */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map(f => {
              const isOn = activeFilters.has(f.key)
              const count = signals.filter(s => f.compute(s)).length
              return (
                <button key={f.key} onClick={() => setActiveFilters(prev => {
                  const next = new Set(prev)
                  if (isOn) next.delete(f.key); else next.add(f.key)
                  return next
                })} title={f.description} style={{
                  padding: '2px 6px', borderRadius: 2, fontSize: 8, fontWeight: 700,
                  background: isOn ? `${GOLD}30` : T.SURFACE2, color: isOn ? GOLD : T.MUTED,
                  border: `1px solid ${isOn ? GOLD : T.BORDER}`, cursor: 'pointer',
                }}>{f.shortLabel} <span style={{ fontWeight: 400, fontSize: 7 }}>{count}</span></button>
              )
            })}
            {activeFilters.size > 0 && (
              <button onClick={() => setActiveFilters(new Set())} style={{
                padding: '2px 6px', borderRadius: 2, fontSize: 8, fontWeight: 700,
                background: `${T.RED}20`, color: T.RED, border: `1px solid ${T.RED}40`, cursor: 'pointer',
              }}>Clear</button>
            )}
            <span style={{ color: T.MUTED, fontSize: 8, marginLeft: 4 }}>{filteredSignals.length}/{signals.length}{isMultiSignal ? ` (${dedupedSignals.length} rows)` : ''} signals</span>
          </div>
          <BacktestStatsPanel signals={filteredSignals} bt={backtestResults} dark={dark} />
        </>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          <span style={{ color: T.MUTED, fontSize: 12, marginLeft: 8 }}>Loading...</span>
        </div>
      ) : sig ? (
        <>
          {/* ── Single toolbar row ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Single / Stacked */}
            <div className="flex gap-1">
              <button onClick={() => setChartMode('single')} title="Single chart" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: chartMode === 'single' ? GOLD : T.SURFACE,
                color: chartMode === 'single' ? '#000' : T.MUTED,
                border: `1px solid ${chartMode === 'single' ? GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3,
              }}><LayoutGrid className="h-3 w-3" />Single</button>
              <button onClick={() => setChartMode('stacked')} title="Stacked" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: chartMode === 'stacked' ? GOLD : T.SURFACE,
                color: chartMode === 'stacked' ? '#000' : T.MUTED,
                border: `1px solid ${chartMode === 'stacked' ? GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3,
              }}><Rows3 className="h-3 w-3" />Stacked</button>
            </div>

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* TF */}
            {chartMode === 'single' && (
              <div className="flex gap-1">
                {(['5', '15', '60', 'D'] as Timeframe[]).map(t => (
                  <button key={t} onClick={() => setTf(t)} style={{
                    padding: '2px 12px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: tf === t ? GOLD : T.SURFACE, color: tf === t ? '#000' : T.MUTED,
                    border: `1px solid ${tf === t ? GOLD : T.BORDER}`,
                  }}>{t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '1H' : '1D'}</button>
                ))}
              </div>
            )}

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* ◀ ▶ day-by-day view offset */}
            <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} style={dateBtnStyle(GOLD)} title="Back 1 day">◀</button>
            <span style={{ fontSize: 11, fontWeight: 800, color: GOLD, fontFamily: 'monospace', minWidth: 78, textAlign: 'center' }}>
              {dayOffset === 0 ? `D0 ${formatDateShort(sig.date)}` : `D+${dayOffset}`}
            </span>
            <button onClick={() => setDayOffset(d => d + 1)} style={dateBtnStyle(GOLD)} title="Forward 1 day">▶</button>
            <button onClick={() => setDayOffset(0)} style={{
              ...dateBtnStyle(GOLD, 9),
              ...(dayOffset === 0 ? { background: GOLD, color: '#000' } : {}),
            }} title="Reset to D0">D0</button>
            {[3, 7, 14].map(n => (
              <button key={n} onClick={() => setDayOffset(d => d + n)}
                style={dateBtnStyle('rgba(212,175,55,0.6)', 9, 'rgba(212,175,55,0.35)')} title={`+${n} trading days`}>+{n}d</button>
            ))}

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* Ticker */}
            <span style={{ color: GOLD, fontSize: 16, fontWeight: 800 }}>{sig.ticker}</span>
            <span style={{ color: T.MUTED, fontSize: 10 }}>{selectedIdx + 1}/{sortedSignals.length}</span>

            {/* ↑↓ signal list nav */}
            <button onClick={() => { setSelectedIdx(prev => Math.max(0, prev - 1)); setDayOffset(0) }} style={dateBtnStyle(GOLD)} title="Previous signal in list">▲</button>
            <button onClick={() => { setSelectedIdx(prev => Math.min(sortedSignals.length - 1, prev + 1)); setDayOffset(0) }} style={dateBtnStyle(GOLD)} title="Next signal in list">▼</button>

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* Settings */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSettings(v => !v)} title="Chart Settings" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: showSettings ? GOLD : T.SURFACE, color: showSettings ? '#000' : T.MUTED,
                border: `1px solid ${showSettings ? GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
              }}><Settings2 className="h-3 w-3" /></button>
              {showSettings && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                  background: T.SURFACE2, border: `1px solid ${T.GOLD_BORDER}`, borderRadius: 6,
                  padding: 12, minWidth: 220,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Chart Settings</div>
                  {([
                    ['showEma9_20', 'EMA 9/20 Cloud'],
                    ['showEma72_89', 'EMA 72/89 Cloud'],
                    ['showDevBands9_20', 'Dev Band 9/20'],
                    ['showDevBands72_89', 'Dev Band 72/89'],
                    ['showDevBands72_89Tight', 'Dev Band 72/89 Tight'],
                    ['showVwap', 'VWAP Line'],
                    ['showPrevClose', 'Prev Close Line'],
                    ['showAhPmShade', 'AH/PM Shading'],
                    ['showKeyLevels', 'Key Levels'],
                    ['showVolume', 'Volume Bars'],
                    ['showCrosshair', 'Crosshair on Hover'],
                    ['showLegend', 'Legend'],
                  ] as [keyof ChartSettings, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between" style={{ padding: '4px 0', cursor: 'pointer' }}>
                      <span style={{ color: T.TEXT2, fontSize: 11 }}>{label}</span>
                      <div onClick={() => setChartSettings(s => ({ ...s, [key]: !s[key] }))} style={{
                        width: 32, height: 16, borderRadius: 8, position: 'relative', cursor: 'pointer',
                        background: chartSettings[key] ? GOLD : T.BORDER, transition: 'background 0.15s',
                      }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: 6, background: '#fff', position: 'absolute', top: 2,
                          left: chartSettings[key] ? 18 : 2, transition: 'left 0.15s',
                        }} />
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Charts link */}

            {/* Indicator Template */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowTemplateMenu(v => !v)} title="Indicator Template" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: showTemplateMenu ? GOLD : T.SURFACE, color: showTemplateMenu ? '#000' : T.MUTED,
                border: `1px solid ${showTemplateMenu ? GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
              }}>📊 Indicators</button>
              {showTemplateMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                  background: T.SURFACE2, border: `1px solid ${T.GOLD_BORDER}`, borderRadius: 6,
                  padding: 12, minWidth: 200,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Templates</div>
                  {IND_TEMPLATES.map(tpl => (
                    <button key={tpl.id} onClick={() => {
                      setActiveTemplate(tpl.id)
                      setChartSettings(s => ({ ...s, ...tpl.settings } as ChartSettings))
                      setShowTemplateMenu(false)
                      setShowIndToggles(true)
                    }} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                      fontSize: 11, cursor: 'pointer', borderRadius: 3,
                      background: activeTemplate === tpl.id ? GOLD_DIM : 'transparent',
                      color: activeTemplate === tpl.id ? GOLD : T.TEXT, border: 'none',
                    }}>{tpl.name}</button>
                  ))}
                  <div style={{ borderTop: `1px solid ${T.BORDER}`, margin: '8px 0' }} />
                  <button onClick={() => { setActiveTemplate(null); setShowIndToggles(true) }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
                    fontSize: 11, cursor: 'pointer', borderRadius: 3,
                    background: 'transparent', color: T.MUTED, border: 'none',
                  }}>Custom (keep current)</button>
                </div>
              )}
            </div>

            {/* Active template indicator toggles */}
            {activeTemplate && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowIndToggles(v => !v)} title="Toggle Indicators" style={{
                  padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                  background: showIndToggles ? GOLD_DIM : T.SURFACE, color: GOLD,
                  border: `1px solid ${T.GOLD_BORDER}`,
                  display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
                  maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>⚙ {IND_TEMPLATES.find(t => t.id === activeTemplate)?.name}</button>
                {showIndToggles && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                    background: T.SURFACE2, border: `1px solid ${T.GOLD_BORDER}`, borderRadius: 6,
                    padding: 12, minWidth: 200,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Toggle Indicators</div>
                    {TEMPLATE_IND_KEYS.map(([key, label]) => (
                      <label key={key} className="flex items-center justify-between" style={{ padding: '4px 0', cursor: 'pointer' }}>
                        <span style={{ color: T.TEXT2, fontSize: 11 }}>{label}</span>
                        <div onClick={() => setChartSettings(s => ({ ...s, [key]: !s[key] }))} style={{
                          width: 32, height: 16, borderRadius: 8, position: 'relative', cursor: 'pointer',
                          background: chartSettings[key] ? GOLD : T.BORDER, transition: 'background 0.15s',
                        }}>
                          <div style={{
                            width: 12, height: 12, borderRadius: 6, background: '#fff', position: 'absolute', top: 2,
                            left: chartSettings[key] ? 18 : 2, transition: 'left 0.15s',
                          }} />
                        </div>
                      </label>
                    ))}
                    {chartSettings.showKeyLevels && (
                      <>
                        <div style={{ borderTop: `1px solid ${T.BORDER}`, margin: '8px 0 4px' }} />
                        <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Key Levels Settings</div>
                        {([
                          ['lookLeft', 'Look Left', 5, 50, 1],
                          ['lookRight', 'Look Right', 5, 50, 1],
                          ['numPivots', 'Num Pivots', 1, 10, 1],
                          ['atrLength', 'ATR Length', 5, 100, 1],
                          ['zoneWidth', 'Zone Width (×ATR)', 0.1, 3.0, 0.1],
                          ['maxZonePercent', 'Max Zone %', 1, 20, 0.5],
                        ] as [keyof KeyLevelsParams, string, number, number, number][]).map(([key, label, min, max, step]) => (
                          <label key={key} className="flex items-center justify-between" style={{ padding: '2px 0' }}>
                            <span style={{ color: T.TEXT2, fontSize: 10 }}>{label}</span>
                            <input type="number" value={klParams[key]} min={min} max={max} step={step}
                              onChange={e => setKlParams(p => ({ ...p, [key]: parseFloat(e.target.value) || min }))}
                              style={{
                                width: 48, textAlign: 'center', fontSize: 10, padding: '2px 4px',
                                background: T.SURFACE, color: T.TEXT, border: `1px solid ${T.BORDER}`, borderRadius: 3,
                              }}
                            />
                          </label>
                        ))}
                        <label className="flex items-center justify-between" style={{ padding: '4px 0', cursor: 'pointer' }}>
                          <span style={{ color: T.TEXT2, fontSize: 10 }}>Extend Right</span>
                          <div onClick={() => setKlParams(p => ({ ...p, extendRight: !p.extendRight }))} style={{
                            width: 32, height: 16, borderRadius: 8, position: 'relative', cursor: 'pointer',
                            background: klParams.extendRight ? GOLD : T.BORDER, transition: 'background 0.15s',
                          }}>
                            <div style={{
                              width: 12, height: 12, borderRadius: 6, background: '#fff', position: 'absolute', top: 2,
                              left: klParams.extendRight ? 18 : 2, transition: 'left 0.15s',
                            }} />
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <a href={`/charts-terminal.html?symbol=${sig.ticker}`} target="_blank" rel="noreferrer" style={{ color: GOLD, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }} className="hover:underline">
              Charts <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Chart(s) */}
          {isBT ? (
            <ScanMiniChart symbol={sig!.ticker} tf="5" date={chartDate} height={580} settings={chartSettings} dark={dark} centerOnDate legMarkers={legMarkers} exitEpoch={tradeExitEpoch} klParams={klParams} />
          ) : chartMode === 'single' ? (
            <ScanMiniChart symbol={sig!.ticker} tf={tf} date={sig!.date} height={580} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
          ) : (
            <div className="space-y-2">
              <ScanMiniChart symbol={sig!.ticker} tf="D" date={sig!.date} height={360} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <ScanMiniChart symbol={sig!.ticker} tf="60" date={sig!.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <ScanMiniChart symbol={sig!.ticker} tf="15" date={sig!.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <ScanMiniChart symbol={sig!.ticker} tf="5" date={sig!.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
            </div>
          )}

          {/* Detail pills */}
          <div className="flex flex-wrap gap-1">
            <Detail label="Open" value={`$${sig.open?.toFixed(2)}`} dark={dark} />
            <Detail label="High" value={`$${sig.high?.toFixed(2)}`} color={T.TEAL} dark={dark} />
            <Detail label="Low" value={`$${sig.low?.toFixed(2)}`} color={T.RED} dark={dark} />
            <Detail label="Close" value={`$${sig.close?.toFixed(2)}`} dark={dark} />
            <Detail label="Vol" value={`${((sig.volume || 0) / 1e6).toFixed(1)}M`} dark={dark} />
            <Detail label="Gap" value={`${(sig.gap_pct || 0).toFixed(1)}%`} color={T.TEAL} dark={dark} />
            <Detail label="ABS" value={(sig.pos_abs || 0).toFixed(3)} dark={dark} />
            <Detail label="D0 Chg" value={`${((sig.close - sig.open) / sig.open * 100).toFixed(1)}%`} color={sig.close < sig.open ? T.RED : T.TEAL} dark={dark} />
            <Detail label="Range" value={`${((sig.high - sig.low) / sig.open * 100).toFixed(1)}%`} dark={dark} />
          </div>
        </>
      ) : null}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        height: 48, background: T.SURFACE, borderBottom: `1px solid ${T.BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4" style={{ color: GOLD }} />
          <div className="flex gap-1" style={{ background: T.SURFACE2, padding: 2, borderRadius: 4, border: `1px solid ${T.BORDER}` }}>
            <button onClick={() => setPageMode('scanner')} style={{
              padding: '3px 12px', borderRadius: 3, fontSize: 10, fontWeight: 700,
              background: pageMode === 'scanner' ? GOLD : 'transparent',
              color: pageMode === 'scanner' ? '#000' : T.MUTED,
              border: 'none', cursor: 'pointer',
            }}>Scanner</button>
            <button onClick={() => setPageMode('backtest')} style={{
              padding: '3px 12px', borderRadius: 3, fontSize: 10, fontWeight: 700,
              background: pageMode === 'backtest' ? GOLD : 'transparent',
              color: pageMode === 'backtest' ? '#000' : T.MUTED,
              border: 'none', cursor: 'pointer',
            }}>Backtest</button>
          </div>
          {activeScan && <span style={{ color: T.MUTED, fontSize: 11 }}>· {activeScan.name}</span>}
        </div>
        <div className="flex items-center gap-1">
          <a href="/charts-terminal.html" target="_blank" rel="noreferrer" title="Open Charts" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.SURFACE2, color: GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
            textDecoration: 'none',
          }}>
            <BarChart3 className="h-3 w-3" /> Charts
          </a>
          <button onClick={() => setShowRunPanel(!showRunPanel)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: GOLD, color: '#000', border: 'none', cursor: 'pointer',
          }}>
            <Play className="h-3 w-3" /> Run
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.GOLD_DIM, color: GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
          }}>
            <Save className="h-3 w-3" /> Save
          </button>
          <button onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.GOLD_DIM, color: GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
          }}>
            {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {renderLeftSidebar()}
        {/* Left resize handle */}
        <div
          onMouseDown={(e) => onResizeDown('left', e)}
          style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, transition: 'background 0.15s', zIndex: 10 }}
          onMouseOver={(e) => { (e.target as HTMLDivElement).style.background = T.BORDER }}
          onMouseOut={(e) => { (e.target as HTMLDivElement).style.background = 'transparent' }}
        />
        {renderCenter()}
        {/* Right resize handle */}
        <div
          onMouseDown={(e) => onResizeDown('right', e)}
          style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, transition: 'background 0.15s', zIndex: 10 }}
          onMouseOver={(e) => { (e.target as HTMLDivElement).style.background = T.BORDER }}
          onMouseOut={(e) => { (e.target as HTMLDivElement).style.background = 'transparent' }}
        />
        {renderRightSidebar()}
      </div>

      {/* Run Modal */}

      {/* Floating scan job badges */}
      {activeJobs.length > 0 && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeJobs.map(job => (
            <div key={job.id} style={{
              background: T.SURFACE, border: `1px solid ${job.status === 'error' ? T.RED : job.status === 'done' ? T.TEAL : GOLD}`,
              borderRadius: 6, padding: '10px 14px', minWidth: 220, maxWidth: 300, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ color: job.status === 'error' ? T.RED : job.status === 'done' ? T.TEAL : GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {job.status === 'done' ? '✓ ' : job.status === 'error' ? '✗ ' : '⟳ '}{job.label}
                </span>
                <span style={{ color: T.MUTED, fontSize: 9 }}>{job.elapsed}s</span>
              </div>
              {job.status === 'running' && job.progress && (
                <div style={{ color: T.TEXT2, fontSize: 9 }}>{job.progress}</div>
              )}
              {job.status === 'done' && (
                <div style={{ color: T.TEAL, fontSize: 10, fontWeight: 700 }}>{job.signalCount ?? 0} signals pushed</div>
              )}
              {job.status === 'error' && (
                <div style={{ color: T.RED, fontSize: 9 }}>{job.error}</div>
              )}
              {job.status === 'running' && (
                <div style={{ marginTop: 4, height: 2, background: T.BORDER, borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: GOLD, animation: 'pulse 1.5s ease-in-out infinite', width: '40%' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Scan Params Panel */}
      {showScanParams && (() => {
        const scan = scans.find(s => s.id === showScanParams)
        if (!scan) return null
        const strat = BUILTIN_SPEC_MAP[scan.id] || scan.strategy || ''
        const spec = scanParamSpecs.find((sp: any) => sp.strategy === strat)
        const isRunner = !!spec
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowScanParams(null)}>
            <div style={{ background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 8, padding: 20, width: 360, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ color: GOLD, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>{scan.name} — Run Settings</div>
              {/* Date range quick-select */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Date Range</div>
                <div className="flex flex-wrap gap-1" style={{ marginBottom: 6 }}>
                  {([
                    ['today', 'Today'],
                    ['1w', '1W'],
                    ['1m', '1M'],
                    ['3m', '3M'],
                    ['ytd', 'YTD'],
                    ['custom', 'Custom'],
                  ] as const).map(([key, lbl]) => {
                    const active = scanRange === key
                    return (
                      <button key={key} onClick={() => {
                        setScanRange(key)
                        const today = new Date()
                        const todayStr = today.toISOString().slice(0, 10)
                        const ymd = (d: Date) => d.toISOString().slice(0, 10)
                        if (key === 'today') { setScanFromDate(todayStr); setScanToDate(todayStr) }
                        else if (key === '1w') { setScanFromDate(ymd(new Date(Date.now() - 7 * 864e5))); setScanToDate(todayStr) }
                        else if (key === '1m') { setScanFromDate(ymd(new Date(Date.now() - 30 * 864e5))); setScanToDate(todayStr) }
                        else if (key === '3m') { setScanFromDate(ymd(new Date(Date.now() - 90 * 864e5))); setScanToDate(todayStr) }
                        else if (key === 'ytd') { setScanFromDate(today.getFullYear() + '-01-01'); setScanToDate(todayStr) }
                      }} style={{
                        padding: '3px 8px', fontSize: 9, fontWeight: 700, borderRadius: 3, cursor: 'pointer',
                        background: active ? GOLD : 'transparent', color: active ? '#000' : T.MUTED,
                        border: `1px solid ${active ? GOLD : T.BORDER}`, textTransform: 'uppercase', letterSpacing: 0.3,
                      }}>{lbl}</button>
                    )
                  })}
                </div>
                {(scanRange === 'custom' || scanRange === 'today' || scanRange === '1w' || scanRange === '1m' || scanRange === '3m' || scanRange === 'ytd') && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={scanFromDate} onChange={e => { setScanRange('custom'); setScanFromDate(e.target.value) }} style={{ flex: 1, fontSize: 9, padding: '3px 4px', background: T.SURFACE2, color: T.TEXT, border: `1px solid ${T.BORDER}`, borderRadius: 3 }} />
                    <span style={{ color: T.MUTED, fontSize: 9 }}>→</span>
                    <input type="date" value={scanToDate} onChange={e => { setScanRange('custom'); setScanToDate(e.target.value) }} style={{ flex: 1, fontSize: 9, padding: '3px 4px', background: T.SURFACE2, color: T.TEXT, border: `1px solid ${T.BORDER}`, borderRadius: 3 }} />
                  </div>
                )}
              </div>
              <div style={{ borderTop: `1px solid ${T.BORDER}`, margin: '4px -20px 8px', paddingTop: 8, paddingLeft: 20, paddingRight: 20 }}>
                {isRunner && spec.params.length > 0 ? (
                  <>
                    <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Scan Parameters</div>
                    {spec.params.map((p: any) => (
                      <label key={p.key} className="flex items-center justify-between" style={{ padding: '4px 0' }}>
                        <span style={{ color: T.TEXT2, fontSize: 10 }}>{p.label}</span>
                        <input type="number" value={scanParams[`${strat}.${p.key}`] ?? p.default} min={p.min} max={p.max} step={p.step}
                          onChange={e => setScanParams(prev => ({ ...prev, [`${strat}.${p.key}`]: parseFloat(e.target.value) || p.default }))}
                          style={{ width: 64, textAlign: 'center', fontSize: 10, padding: '3px 4px', background: T.SURFACE2, color: T.TEXT, border: `1px solid ${T.BORDER}`, borderRadius: 3 }}
                        />
                      </label>
                    ))}
                  </>
                ) : (
                  <div style={{ color: T.MUTED, fontSize: 10, textAlign: 'center', padding: '8px 0' }}>No tunable parameters for this scan.<br/>Set a date range and run.</div>
                )}
              </div>
              <div className="flex gap-2" style={{ marginTop: 12 }}>
                <button onClick={async () => {
                  setScanRunning(true)
                  try {
                    let resp: Response
                    if (isRunner) {
                      const p: Record<string, any> = {}
                      for (const param of spec.params) {
                        p[param.key] = scanParams[`${strat}.${param.key}`] ?? param.default
                      }
                      resp = await fetch('/api/scans/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ runner: strat, params: p, from: scanFromDate, to: scanToDate }),
                      })
                    } else {
                      resp = await fetch('/api/scans/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ spec: strat, from: scanFromDate, to: scanToDate }),
                      })
                    }
                    const result = await resp.json()
                    if (result.ok && result.jobId) {
                      setShowScanParams(null)
                      setActiveJobs(prev => [...prev, { id: result.jobId, label: scan.name, status: 'running', elapsed: 0 }])
                    } else {
                      alert(`Error: ${result.error}\n${result.log || ''}`)
                    }
                  } catch (e: any) {
                    alert(`Fetch error: ${e.message}`)
                  } finally {
                    setScanRunning(false)
                  }
                }} disabled={scanRunning} style={{
                  flex: 1, padding: '6px 0', borderRadius: 4, border: 'none',
                  background: scanRunning ? T.BORDER : GOLD, color: scanRunning ? T.MUTED : '#000',
                  fontSize: 10, fontWeight: 800, cursor: scanRunning ? 'default' : 'pointer',
                }}>{scanRunning ? 'Running...' : '▶ Run Scan'}</button>
                <button onClick={() => setShowScanParams(null)} style={{
                  padding: '6px 12px', borderRadius: 4, border: `1px solid ${T.BORDER}`,
                  background: 'transparent', color: T.MUTED, fontSize: 10, cursor: 'pointer',
                }}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
