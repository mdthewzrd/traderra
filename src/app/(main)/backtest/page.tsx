'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { calcExecSignals, type ExecSignal } from '@/lib/charts/exec-signals'
import { LinguaExecPanel } from '@/components/backtest/LinguaExecPanel'
import { AnnotationBar } from '@/components/backtest/AnnotationBar'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  BarChart3, TrendingUp, List,
  Plus, ExternalLink, Calendar, Zap, Activity,
  ArrowUpRight, Hash, DollarSign, Target, Layers,
  Clock, TrendingDown, Minus, Play, Rows3,
  LayoutGrid, X, Settings2, Save, Sun, Moon, Shield,
  MessageSquare, Send, Columns3
} from 'lucide-react'

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
  [key: string]: any
}

interface ScanDef {
  id: string
  name: string
  type: string
  strategy?: string
  resultCount: number
  createdAt: string
  tags?: string[]
  runs?: ScanRun[]
}

interface ScanRun {
  id: string
  scanId: string
  dateRange: string
  runAt: string
  resultCount: number
}

// ─── Scan tree organization (mirrors /scanner page) ──────────────
const SCAN_TREE: { id: string; label: string; order: number; subfolders?: { id: string; label: string }[] }[] = [
  { id: 'mikes-scans', label: "Mike's Scans", order: -1, subfolders: [
    { id: 'mean-reversion', label: 'Mean Reversion' },
    { id: 'parabolic', label: 'Parabolic' },
  ] },
  { id: 'mdr-swing', label: 'MDR Swing', order: 0, subfolders: [
    { id: 'scans', label: 'Scans' },
    { id: 'backtests', label: 'Backtests' },
  ] },
  { id: 'og-scans', label: 'OG Scans', order: 1 },
  { id: 'standalone', label: 'Standalone', order: 2 },
]

// DB scans carry no group field — derive folder from strategy (matches scanner builtins)
const STRATEGY_GROUP: Record<string, string> = {
  'd1-gap': 'mikes-scans/parabolic',
  'd1-gap-potential': 'mikes-scans/parabolic',
  'd1-gap-wide': 'mikes-scans/parabolic',
  'd1-gap-wide-potential': 'mikes-scans/parabolic',
  'frd-gap': 'mikes-scans/mean-reversion',
  'frd-gap-lc': 'mikes-scans/mean-reversion',
  'mdr-swing': 'mdr-swing/scans',
  'mdr-signals': 'mdr-swing/scans',
  'mdr-fixed': 'mdr-swing/backtests',
}
function folderForStrategy(strategy: string): string {
  if (STRATEGY_GROUP[strategy]) return STRATEGY_GROUP[strategy]
  if (strategy.startsWith('og-')) return 'og-scans'
  return 'standalone'
}

// ─── Collapsible folder components (module-level to avoid remount) ───
function FolderGroup({ label, items, selectedScan, onSelect }: {
  label: string
  items: ScanDef[]
  selectedScan: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const totalSig = items.reduce((s, i) => s + (i.resultCount || 0), 0)
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
        padding: '7px 10px', border: 'none', cursor: 'pointer', background: 'transparent',
        borderBottom: `1px solid ${BORDER}`,
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <span style={{ color: GOLD, fontSize: 10, marginRight: 6, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
        <span style={{ color: TEXT2, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{label}</span>
        <span style={{ color: MUTED, fontSize: 9 }}>{totalSig} sig</span>
      </button>
      {open && items.map(scan => {
        const isActive = scan.id === selectedScan
        return (
          <button key={scan.id} onClick={() => onSelect(scan.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '6px 10px 6px 24px', border: 'none', cursor: 'pointer',
            background: isActive ? GOLD_DIM : 'transparent',
            borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
            borderBottom: `1px solid ${BORDER}`,
          }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
            <div style={{ color: isActive ? GOLD : TEXT, fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.name}</div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${TEAL}20`, color: TEAL }}>{scan.resultCount} sig</span>
              {scan.type === 'builtin' && <span style={{ fontSize: 8, color: MUTED }}>{scan.type}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function NestedFolderGroup({ label, subfolders, grouped, projectId, selectedScan, onSelect }: {
  label: string
  subfolders: { id: string; label: string }[]
  grouped: Record<string, ScanDef[]>
  projectId: string
  selectedScan: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  const totalSig = subfolders.reduce((s, sf) => s + (grouped[`${projectId}/${sf.id}`]?.reduce((a, i) => a + (i.resultCount || 0), 0) || 0), 0)
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
        padding: '7px 10px', border: 'none', cursor: 'pointer', background: 'transparent',
        borderBottom: `1px solid ${BORDER}`,
      }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <span style={{ color: GOLD, fontSize: 10, marginRight: 6, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
        <span style={{ color: GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{label}</span>
        <span style={{ color: MUTED, fontSize: 9, marginRight: 4 }}>{totalSig} sig</span>
      </button>
      {open && subfolders.map(sf => {
        const items = grouped[`${projectId}/${sf.id}`] || []
        if (items.length === 0) return null
        return (
          <div key={sf.id}>
            <div style={{ padding: '4px 10px 4px 20px', color: MUTED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: 'rgba(255,255,255,0.01)', borderBottom: `1px solid ${BORDER}` }}>{sf.label}</div>
            {items.map(scan => {
              const isActive = scan.id === selectedScan
              return (
                <button key={scan.id} onClick={() => onSelect(scan.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 10px 6px 30px', border: 'none', cursor: 'pointer',
                  background: isActive ? GOLD_DIM : 'transparent',
                  borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
                  borderBottom: `1px solid ${BORDER}`,
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ color: isActive ? GOLD : TEXT, fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.name}</div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${TEAL}20`, color: TEAL }}>{scan.resultCount} sig</span>
                    {scan.type === 'builtin' && <span style={{ fontSize: 8, color: MUTED }}>{scan.type}</span>}
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

type Timeframe = '1' | '2' | '5' | '15' | '60' | 'D'
type ChartMode = 'single' | 'stacked'

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
  dayStats: { date: string; day: string; r: number; pnl: number; count: number; wins: number }[]
  monthlyStats: { month: string; pnl: number; count: number }[]
}

interface ChartSettings {
  showEma9_20: boolean
  showEma72_89: boolean
  showDevBands: boolean
  showVwap: boolean
  showPrevClose: boolean
  showAhPmShade: boolean
  showVolume: boolean
  showCrosshair: boolean
  showLegend: boolean
  showExecDots: boolean
  showExecWedges: boolean
}

// Helper: get UTC minute range for morning session given a date string
const morningUtcRange = (date: string) => {
  const month = parseInt(date.slice(5, 7))
  const offset = (month >= 4 && month <= 10) ? 4 : 5
  return { start: (7*60+30) + offset*60, end: (12*60) + offset*60 }
}

// Helper: filter bars to signal date + morning session (7:30-12:00 ET)
// Handles EST (UTC-5, Nov-Mar) and EDT (UTC-4, Mar-Nov) automatically
const morningBars = (bars: any[], date: string) => {
  const { start, end } = morningUtcRange(date)
  return bars.filter(b => {
    const d = new Date(b.time * 1000)
    if (d.toISOString().slice(0, 10) !== date) return false
    const mins = d.getUTCHours() * 60 + d.getUTCMinutes()
    return mins >= start && mins < end
  })
}

interface DataColumnDef {
  key: string
  label: string
  shortLabel: string
  description: string
  needsBars?: '15m' | '1m' | 'both'
  compute: (s: Signal, bars15m?: any[], bars1m?: any[]) => string
}

const DATA_COLUMNS: DataColumnDef[] = [
  { key: 'pushTime', label: 'Push High Time', shortLabel: 'P.TIME', needsBars: '15m',
    description: 'Time of the highest push during morning (ET)',
    compute: (s, bars15m) => {
      const mb = morningBars(bars15m || [], s.date)
      if (mb.length < 3) return '-'
      let bestBar = mb[0]
      for (const b of mb) if (b.high > bestBar.high) bestBar = b
      const d = new Date(bestBar.time * 1000)
      const month = d.getUTCMonth() + 1
      const etOff = (month >= 4 && month <= 10) ? 4 : 5
      const etH = (d.getUTCHours() - etOff + 24) % 12 || 12
      const etM = d.getUTCMinutes()
      const ampm = ((d.getUTCHours() - etOff + 24) % 24) < 12 ? 'a' : 'p'
      return `${etH}:${String(etM).padStart(2, '0')}${ampm}`
    }
  },
  { key: 'pushLevel', label: 'Push High Price', shortLabel: 'P.HI', needsBars: '15m',
    description: 'Price of the highest morning push',
    compute: (s, bars15m) => {
      const mb = morningBars(bars15m || [], s.date)
      if (mb.length < 3) return '-'
      return Math.max(...mb.map(b => b.high)).toFixed(2)
    }
  },
  { key: 'openTime', label: 'Open Direction', shortLabel: 'O.DIR', needsBars: '15m',
    description: 'First 15m bar direction (gap up = UP, gap down = DN)',
    compute: (s, bars15m) => {
      const mb = morningBars(bars15m || [], s.date)
      if (mb.length === 0) return '-'
      const first = mb[0]
      return first.close >= first.open ? 'UP' : 'DN'
    }
  },
]


interface FilterDef {
  key: string
  label: string
  shortLabel: string
  description: string
  needsBars?: '15m' | '1m' | 'both'
  compute: (s: Signal, bars15m?: any[], bars1m?: any[]) => boolean
}

const FILTERS: FilterDef[] = [
  { key: 'green', label: 'Green Candle', shortLabel: 'GRN', description: 'Close > Open (bullish day)',
    compute: (s) => s.close > s.open },
  { key: 'closePos50', label: 'Close > Mid', shortLabel: 'C>50', description: 'Closed above midpoint of range',
    compute: (s) => { const r = s.high - s.low; return r > 0 ? (s.close - s.low) / r > 0.5 : false } },
  { key: 'closePos75', label: 'Close > 75%ile', shortLabel: 'C>75', description: 'Closed in upper 25% of range',
    compute: (s) => { const r = s.high - s.low; return r > 0 ? (s.close - s.low) / r > 0.75 : false } },
  { key: 'gapOver100', label: 'Gap > 100%', shortLabel: 'G>1x', description: 'Gap up more than 100%',
    compute: (s) => (s.gap_pct || 0) > 100 },
  { key: 'gapOver50', label: 'Gap > 50%', shortLabel: 'G>50', description: 'Gap up more than 50%',
    compute: (s) => (s.gap_pct || 0) > 50 },
  { key: 'volOver10M', label: 'Vol > 10M', shortLabel: 'V>10M', description: 'Dollar volume over $10M',
    compute: (s) => (s.volume || 0) > 10e6 },
  { key: 'rangeOver5', label: 'Range > 5%', shortLabel: 'R>5%', description: 'Intraday range > 5%',
    compute: (s) => { const r = s.high - s.low; return s.open > 0 ? (r / s.open) * 100 > 5 : false } },
  // ── Intraday filters (require 15m bars, lazy loaded) ──
  { key: 'amPush', label: 'AM Push', shortLabel: 'PUSH', needsBars: '15m',
    description: 'Morning 7:30-12:00 ET push: ≥2 higher highs, EMA(9) extension ≥0.5 ATR on 15m',
    compute: (s, bars15m) => {
      if (!bars15m || bars15m.length < 10) return false
      const mb = morningBars(bars15m, s.date)
      if (mb.length < 5) return false
      // Count higher highs
      let higherHighs = 0
      for (let i = 1; i < mb.length; i++) {
        if (mb[i].high > mb[i - 1].high) higherHighs++
      }
      if (higherHighs < 2) return false
      // Compute EMA(9) on 15m closes
      const closes = mb.map(b => b.close)
      const ema: number[] = [closes[0]]
      const mult = 2 / (9 + 1)
      for (let i = 1; i < closes.length; i++) ema.push(closes[i] * mult + ema[i - 1] * (1 - mult))
      // Morning high vs last EMA value
      const morningHigh = Math.max(...mb.map(b => b.high))
      const lastEma = ema[ema.length - 1]
      const extension = lastEma > 0 ? (morningHigh - lastEma) / lastEma : 0
      // ATR approximation from daily signal (use high-low as proxy)
      const atrProxy = s.high - s.low
      const extNormalized = atrProxy > 0 ? (morningHigh - lastEma) / atrProxy : 0
      if (extNormalized < 0.5) return false
      // Reject fake prints: the bar with highest high should have closed in upper half of its range
      const pushBar = mb.find(b => b.high === morningHigh)
      if (pushBar) {
        const barRange = pushBar.high - pushBar.low
        const closePosition = barRange > 0 ? (pushBar.close - pushBar.low) / barRange : 0
        if (closePosition < 0.3) return false // closed in bottom 30% = upper wick / fake print
      }
      return true
    }
  },
  // ── Dev Band Upper 1 hit during morning ──
  { key: 'devBand1', label: 'Dev Band Upper 1', shortLabel: 'DEV1', needsBars: '15m',
    description: 'Morning high hits EMA(72)+ATR(72)*6.9 upper dev band on 15m',
    compute: (s, bars15m) => {
      if (!bars15m || bars15m.length < 90) return false
      const mb = morningBars(bars15m, s.date)
      if (mb.length < 3) return false
      // EMA(72) — same algo as chart's calcEMA: seed from first close
      const closes = bars15m.map(b => b.close)
      const ema72: number[] = [closes[0]]
      const k72 = 2 / (72 + 1)
      for (let i = 1; i < closes.length; i++) ema72.push(closes[i] * k72 + ema72[i - 1] * (1 - k72))
      // ATR(72) — same algo as chart's calcATR: True Range + Wilder's smoothing
      const period = 72
      const atrOut: (number | null)[] = [null]
      let sum = 0
      for (let i = 1; i < bars15m.length; i++) {
        const tr = Math.max(
          bars15m[i].high - bars15m[i].low,
          Math.abs(bars15m[i].high - bars15m[i - 1].close),
          Math.abs(bars15m[i].low - bars15m[i - 1].close)
        )
        sum += tr
        if (i < period) {
          atrOut.push(null)
        } else if (i === period) {
          atrOut.push(sum / period)
        } else {
          atrOut.push((atrOut[i - 1]! * (period - 1) + tr) / period)
        }
      }
      // Get the index of the first morning bar
      const firstMorningTime = mb[0].time
      const firstMorningIdx = bars15m.findIndex(b => b.time === firstMorningTime)
      if (firstMorningIdx < 0 || firstMorningIdx >= ema72.length) return false
      const atrVal = atrOut[firstMorningIdx]
      if (atrVal === null || atrVal === undefined) return false // ATR not ready yet
      // Upper band 1 = EMA(72) + ATR(72) * 6.9 — exactly as drawDevBand renders
      const bandLevel = ema72[firstMorningIdx] + atrVal * 6.9
      // Check if any morning bar high hits above the band
      const morningHigh = Math.max(...mb.map(b => b.high))
      return morningHigh >= bandLevel
    }
  },
  // ── Real Volume: tiered fake print detection ──
  // Tier 1 (sync, 1m bars): quick check for obvious fakes
  // Tier 2 (async, tick data): only fetched for suspicious signals
  { key: 'pushReal', label: 'Real Volume', shortLabel: 'REAL', needsBars: 'both',
    description: 'Real push: multiple 1m bars close near the morning high. Fake print: the high has zero bars closing near it — price printed but nobody traded there.',
    compute: (s, bars15m, bars1m) => {
      if (!bars15m || !bars1m) return false
      const morning15 = morningBars(bars15m, s.date)
      if (morning15.length < 3) return false
      const morningHigh = Math.max(...morning15.map(b => b.high))
      // Extension check (same as PUSH)
      const closes15 = morning15.map(b => b.close)
      const ema9: number[] = [closes15[0]]
      const k9 = 2 / (9 + 1)
      for (let i = 1; i < closes15.length; i++) ema9.push(closes15[i] * k9 + ema9[i - 1] * (1 - k9))
      const lastEma = ema9[ema9.length - 1]
      const atrProxy = s.high - s.low
      const extNorm = atrProxy > 0 ? (morningHigh - lastEma) / atrProxy : 0
      if (extNorm < 0.5) return false
      // ── Get 1m morning bars ──
      const morning1m = morningBars(bars1m, s.date)
      if (morning1m.length < 5) return false
      // ── THE TEST: How many 1m bars close within 1% of the morning high? ──
      // Real push: many bars close near the high (sustained buying)
      // Fake print: zero bars close near the high (price spiked but immediately reversed)
      const nearThreshold = morningHigh * 0.99
      const nearHighCount = morning1m.filter(b => b.close >= nearThreshold).length
      return nearHighCount > 0
    }
  },
]

// ─── Color constants ────────────────────────────────────
const GOLD = '#D4AF37'
const GOLD_DIM = 'rgba(212,175,55,0.12)'
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

const LEFT_W_DEFAULT = 240
const LEFT_W_MIN = 140
const LEFT_W_MAX = 420
const RIGHT_W_DEFAULT = 420
const RIGHT_W_MIN = 240
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
    BG, SURFACE, SURFACE2, SURFACE3, BORDER, TEXT, TEXT2, MUTED, WHITE, RED, TEAL, VOL_UP, VOL_DN, GOLD, GOLD_DIM, GOLD_BORDER,
  } : { ...LIGHT, GOLD, GOLD_DIM: LIGHT.GOLD_DIM, GOLD_BORDER: LIGHT.GOLD_BORDER }
}

// ─── MiniChart with zoom ────────────────────────────────
// Safe ISO date from timestamp (guards against NaN/invalid)
function safeISO(ts: number): string {
  const d = new Date(ts * 1000)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

// Convert a US/Eastern wall-clock string "YYYY-MM-DD HH:MM" → unix seconds.
// IMPORTANT: the chart DB stores bars in market-time-as-UTC (a 09:30 ET bar has
// time = Date.UTC(...,9,30)). So we return the plain UTC seconds of the ET clock
// reading with NO DST offset added — adding one puts wedges ~5h off the candle.
function etWallToUnix(s: string): number {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return NaN
  const Y = +m[1], Mo = +m[2], D = +m[3], H = +m[4], Mi = +m[5]
  // Convert ET wall-clock → UTC. Chart bars are true-UTC seconds, so we must add the
  // ET offset (US DST: 2nd Sun of Mar 02:00 → 1st Sun of Nov 02:00). EDT=UTC-4, EST=UTC-5.
  let dst = false
  if (Mo > 3 && Mo < 11) dst = true
  else if (Mo === 3 || Mo === 11) {
    const w = new Date(Date.UTC(Y, Mo - 1, 1)).getUTCDay()
    const sun = 1 + ((7 - w) % 7) + (Mo === 3 ? 7 : 0) // 2nd Sun (Mar) / 1st Sun (Nov)
    dst = Mo === 3 ? (D * 100 + H >= sun * 100 + 2) : (D * 100 + H < sun * 100 + 2)
  }
  return Math.floor(Date.UTC(Y, Mo - 1, D, H, Mi) / 1000) + (dst ? 4 : 5) * 3600
}

function MiniChart({ symbol, tf, date, height = 580, settings, dark, dayOffset = 0, btMarkers }: {
  symbol: string
  tf: Timeframe
  date?: string
  height?: number
  settings: ChartSettings
  dark: boolean
  dayOffset?: number
  btMarkers?: { time: number; price: number; kind: 'buy' | 'sell'; selected?: boolean }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [allBars, setAllBars] = useState<any[]>([])
  const [bars5m, setBars5m] = useState<any[]>([])
  const [bars15m, setBars15m] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  // Manual zoom from wheel — null means "compute default"
  const [manualZoom, setManualZoom] = useState<{ start: number; end: number } | null>(null)

  // Clear manual zoom when inputs change
  useEffect(() => { setManualZoom(null) }, [symbol, tf, date, dayOffset])

  // Fetch — load extra for zoom out
  useEffect(() => {
    const params = new URLSearchParams({ symbol, tf })
    const baseDate = date || new Date().toISOString().slice(0, 10)
    // from: always anchored before D0 so D0 bars are always visible
    // to: D0 + dayOffset (enough to see forward N trading days)
    const fromDate = new Date(baseDate + 'T12:00:00')
    const toDate = new Date(baseDate + 'T12:00:00')
    toDate.setDate(toDate.getDate() + dayOffset * 2 + 10)
    const toStr = toDate.toISOString().slice(0, 10)
    if (tf === '1') {
      fromDate.setDate(fromDate.getDate() - 2)
    } else if (tf === '2') {
      fromDate.setDate(fromDate.getDate() - 3)
    } else if (tf === '5') {
      fromDate.setDate(fromDate.getDate() - 10)
    } else if (tf === '15') {
      fromDate.setDate(fromDate.getDate() - 25)
    } else if (tf === '60') {
      fromDate.setDate(fromDate.getDate() - 70)
    } else {
      fromDate.setDate(fromDate.getDate() - 360)
    }
    params.set('from', fromDate.toISOString().slice(0, 10))
    params.set('to', toStr)
    fetch(`/api/chart-data/bars?${params}`)
      .then(r => r.json())
      .then(data => { setAllBars(data.bars || []); setLoading(false) })
      .catch(() => setLoading(false))
    // Also fetch 5m + 15m bars when on 2m TF
    if (tf === '2') {
      const p5 = new URLSearchParams({ symbol, tf: '5' })
      p5.set('from', fromDate.toISOString().slice(0, 10))
      p5.set('to', toStr)
      fetch(`/api/chart-data/bars?${p5}`)
        .then(r => r.json())
        .then(data => setBars5m(data.bars || []))
        .catch(() => setBars5m([]))
      // Fetch wider 15m range for EMA(72) warmup
      const wideFrom = new Date(fromDate)
      wideFrom.setDate(wideFrom.getDate() - 14)
      const p15 = new URLSearchParams({ symbol, tf: '15' })
      p15.set('from', wideFrom.toISOString().slice(0, 10))
      p15.set('to', toStr)
      fetch(`/api/chart-data/bars?${p15}`)
        .then(r => r.json())
        .then(data => setBars15m(data.bars || []))
        .catch(() => setBars15m([]))
    }
  }, [symbol, tf, date, dayOffset])

  // Compute visible bars — default puts D0 at right edge, manualZoom from wheel
  const visibleBars = useMemo(() => {
    if (!allBars.length) return []

    // Find D0 bar index (last bar matching signal date)
    let d0Idx = -1
    if (date) {
      for (let i = allBars.length - 1; i >= 0; i--) {
        const b = allBars[i]
        let bd = ''
        if (typeof b.time === 'number') {
          const utcMonth = new Date(b.time * 1000).getUTCMonth() + 1
          const etOff = (utcMonth >= 4 && utcMonth <= 10) ? -4 : -5
          const etMs = b.time * 1000 + etOff * 3600000
          const etD = new Date(etMs)
          bd = isNaN(etD.getTime()) ? '' : etD.toISOString().slice(0, 10)
        } else if (typeof b.time === 'string') {
          bd = b.time.slice(0, 10)
        }
        if (bd === date) { d0Idx = i; break }
      }
    }
    // Max bar to show: when dayOffset=0, clip to D0 only
    const bpd = tf === '1' ? 390 : tf === '2' ? 195 : tf === '5' ? 78 : tf === '15' ? 26 : tf === '60' ? 7 : 1
    const maxEnd = d0Idx >= 0 ? Math.min(allBars.length, d0Idx + dayOffset * bpd + 1) : allBars.length

    // If user manually zoomed, clamp to maxEnd
    if (manualZoom) {
      const clampedEnd = Math.min(manualZoom.end, maxEnd)
      const clampedStart = Math.min(manualZoom.start, clampedEnd - 10)
      return allBars.slice(Math.max(0, clampedStart), clampedEnd)
    }

    // Default window width per TF
    let defaultBars = allBars.length
    if (tf === '1') defaultBars = Math.min(allBars.length, 390)
    else if (tf === '2') defaultBars = Math.min(allBars.length, 195)
    else if (tf === '5') defaultBars = Math.min(allBars.length, 156)
    else if (tf === '15') defaultBars = Math.min(allBars.length, 104)
    else if (tf === '60') defaultBars = Math.min(allBars.length, 98)
    else defaultBars = Math.min(allBars.length, 120)

    // Use pre-computed maxEnd for default view
    const endIdx = maxEnd
    const startIdx = Math.max(0, endIdx - defaultBars)
    return allBars.slice(startIdx, endIdx)
  }, [allBars, tf, dayOffset, date, manualZoom])

  // ── Pre-compute execution signal markers (zoom-independent) ──
  const execMarkers = useMemo(() => {
    if (!allBars.length || allBars.length <= 89) return []
    const calcEMA = (period: number): number[] => {
      const k = 2 / (period + 1)
      const vals: number[] = [allBars[0].close]
      for (let i = 1; i < allBars.length; i++) vals.push(allBars[i].close * k + vals[i - 1] * (1 - k))
      return vals
    }
    const calcATR = (period: number): number[] => {
      const tr: number[] = [allBars[0].high - allBars[0].low]
      for (let i = 1; i < allBars.length; i++)
        tr.push(Math.max(allBars[i].high - allBars[i].low, Math.abs(allBars[i].high - allBars[i - 1].close), Math.abs(allBars[i].low - allBars[i - 1].close)))
      const k = 2 / (period + 1)
      const vals: number[] = [tr[0]]
      for (let i = 1; i < tr.length; i++) vals.push(tr[i] * k + vals[i - 1] * (1 - k))
      return vals
    }
    const ema9 = calcEMA(9), ema20 = calcEMA(20), atr9 = calcATR(9), atr20 = calcATR(20)
    const markers: { absIdx: number; y: number; color: string; shape: 'dot' | 'wedge-up' | 'wedge-down'; above: boolean; size?: number }[] = []
    const POP_COLORS = ['#ff5252', '#fb923c', '#c084fc']
    enum P { WAIT_TRIGGER, SCAN, POP_HIT, POP_BB, RETRACE_FILL, LOWER_HIT, COVER_CONFIRM }
    let phase: P = P.WAIT_TRIGGER, phaseIdx = 0, entryNum = 0
    let regime: '2m' | '5m' = '2m', trendDone = false, hadEntry = false

    // ── 15m trigger: EMA(72)/ATR(72) on 15m bars, upper 6.9 dev band ──
    const dayOf = (ts: number) => Math.floor((ts + 4 * 3600) / 86400)
    const triggerByDay = new Map<number, number>() // dayKey → 2m bar index
    if (bars15m.length > 89) {
      const c15 = bars15m.map(b => b.close)
      const k72 = 2 / 73
      const ema72_15: number[] = [c15[0]]
      for (let j = 1; j < c15.length; j++) ema72_15.push(c15[j] * k72 + ema72_15[j - 1] * (1 - k72))
      const tr15: number[] = [bars15m[0].high - bars15m[0].low]
      for (let j = 1; j < bars15m.length; j++) tr15.push(Math.max(bars15m[j].high - bars15m[j].low, Math.abs(bars15m[j].high - bars15m[j - 1].close), Math.abs(bars15m[j].low - bars15m[j - 1].close)))
      const atr72_15: number[] = [tr15[0]]
      for (let j = 1; j < tr15.length; j++) atr72_15.push(tr15[j] * k72 + atr72_15[j - 1] * (1 - k72))
      const seenDays = new Set<number>()
      for (let j = 0; j < bars15m.length; j++) {
        const utcHour = (bars15m[j].time % 86400) / 3600
        if (utcHour < 11.5 || utcHour >= 16) continue
        if (ema72_15[j] == null || atr72_15[j] == null) continue
        const dk = dayOf(bars15m[j].time)
        if (seenDays.has(dk)) continue
        if (bars15m[j].high >= ema72_15[j] + atr72_15[j] * 6.9) {
          seenDays.add(dk)
          // Map to 2m bar index
          for (let k = 0; k < allBars.length; k++) {
            if (allBars[k].time >= bars15m[j].time) { triggerByDay.set(dk, k); break }
          }
        }
      }
    }
    let ema9_5m: number[] = [], atr9_5m: number[] = [], ema20_5m: number[] = [], atr20_5m: number[] = []
    if (bars5m.length > 20) {
      const k9 = 2 / 10, k20 = 2 / 21
      ema9_5m = [bars5m[0].close]
      for (let j = 1; j < bars5m.length; j++) ema9_5m.push(bars5m[j].close * k9 + ema9_5m[j - 1] * (1 - k9))
      ema20_5m = [bars5m[0].close]
      for (let j = 1; j < bars5m.length; j++) ema20_5m.push(bars5m[j].close * k20 + ema20_5m[j - 1] * (1 - k20))
      const tr5: number[] = [bars5m[0].high - bars5m[0].low]
      for (let j = 1; j < bars5m.length; j++) tr5.push(Math.max(bars5m[j].high - bars5m[j].low, Math.abs(bars5m[j].high - bars5m[j - 1].close), Math.abs(bars5m[j].low - bars5m[j - 1].close)))
      atr9_5m = [tr5[0]]
      for (let j = 1; j < tr5.length; j++) atr9_5m.push(tr5[j] * k9 + atr9_5m[j - 1] * (1 - k9))
      atr20_5m = [tr5[0]]
      for (let j = 1; j < tr5.length; j++) atr20_5m.push(tr5[j] * k20 + atr20_5m[j - 1] * (1 - k20))
    }
    const get5mIdx = (ts: number): number => {
      for (let j = bars5m.length - 1; j >= 0; j--) { if (bars5m[j].time <= ts) return j }
      return -1
    }
    // Reset phase state at each new trading day so each day gets independent signal detection
    let lastDay = -1
    for (let i = 1; i < allBars.length; i++) {
      const day = dayOf(allBars[i].time || 0)
      if (day !== lastDay) {
        lastDay = day
        phase = P.WAIT_TRIGGER; phaseIdx = i; entryNum = 0; regime = '2m'
        trendDone = false; hadEntry = false
      }
      const utcHour = ((allBars[i].time || 0) % 86400) / 3600
      if (utcHour < 11.5 || utcHour >= 16) continue
      if (ema9[i] == null || atr9[i] == null || ema20[i] == null || atr20[i] == null) continue
      if (phase === P.WAIT_TRIGGER) {
        const trigIdx = triggerByDay.get(day)
        if (trigIdx != null && i >= trigIdx) {
          markers.push({ absIdx: i, y: allBars[i].high, color: '#ff0', shape: 'dot', above: true, size: 5 })
          phase = P.SCAN; phaseIdx = i
        }
        continue
      }
      const upper05_2m = ema9[i]! + atr9[i]! * 0.5
      const lower20_2m = ema20[i]! - atr20[i]! * 2.0
      const retr42_2m = ema9[i]! + atr9[i]! * 0.42
      const j5 = get5mIdx(allBars[i].time || 0)
      let upper05_5m = Infinity, lower20_5m = -Infinity, lower10_5m = -Infinity
      if (j5 >= 0 && ema9_5m[j5] != null && atr9_5m[j5] != null) {
        upper05_5m = ema9_5m[j5] + atr9_5m[j5] * 0.5
        lower20_5m = ema20_5m[j5] - atr20_5m[j5] * 2.0
        lower10_5m = ema20_5m[j5] - atr20_5m[j5] * 1.0
      }
      if (hadEntry && lower10_5m > -Infinity && allBars[i].low <= lower10_5m && !trendDone) {
        trendDone = true
        markers.push({ absIdx: i, y: allBars[i].low, color: '#f87171', shape: 'dot', above: false })
      }
      if (trendDone) continue
      const upper05 = regime === '5m' ? upper05_5m : upper05_2m
      const lower20 = lower20_2m
      const retr42 = regime === '5m' ? (j5 >= 0 && ema9_5m[j5] != null ? ema9_5m[j5] + atr9_5m[j5] * 0.42 : retr42_2m) : retr42_2m
      if (phase === P.SCAN) {
        if (allBars[i].high >= upper05) {
          const c = regime === '5m' ? '#ff79c6' : POP_COLORS[0]
          markers.push({ absIdx: i, y: allBars[i].high, color: c, shape: 'dot', above: true })
          phase = P.POP_HIT; phaseIdx = i; entryNum = 0
        }
      }
      else if (phase === P.POP_HIT) {
        if (allBars[i].low < allBars[i - 1].low) {
          markers.push({ absIdx: i, y: allBars[i].low, color: '#ffffff', shape: 'dot', above: false })
          phase = P.POP_BB; phaseIdx = i
        }
        else if (allBars[i].high >= upper05) { phaseIdx = i }
        else if (i - phaseIdx > 15) { phase = P.SCAN; entryNum = 0 }
      }
      else if (phase === P.POP_BB) {
        if (allBars[i].high >= retr42) {
          markers.push({ absIdx: i, y: allBars[i].high, color: '#fbbf24', shape: 'dot', above: true })
          markers.push({ absIdx: i, y: retr42, color: '#ff3333', shape: 'wedge-down', above: true })
          phase = P.RETRACE_FILL; phaseIdx = i; hadEntry = true
        }
        else if (i - phaseIdx > 20) { phase = P.SCAN; entryNum = 0 }
      }
      else if (phase === P.RETRACE_FILL) {
        if (allBars[i].low <= lower20) {
          markers.push({ absIdx: i, y: allBars[i].low, color: '#4ade80', shape: 'dot', above: false })
          phase = P.LOWER_HIT; phaseIdx = i
        }
        else if (lower20_5m > -Infinity && allBars[i].low <= lower20_5m * 1.02) {
          markers.push({ absIdx: i, y: allBars[i].low, color: '#60a5fa', shape: 'dot', above: false })
          phase = P.SCAN; entryNum = 0; regime = '5m'
        }
        else if (entryNum < 2 && allBars[i].high >= upper05) {
          entryNum++
          const c = POP_COLORS[entryNum]
          markers.push({ absIdx: i, y: allBars[i].high, color: c, shape: 'dot', above: true })
          phase = P.POP_HIT; phaseIdx = i
        }
        else if (i - phaseIdx > 20) { phase = P.SCAN; entryNum = 0 }
      }
      else if (phase === P.LOWER_HIT) {
        if (allBars[i].high >= upper05) {
          entryNum = 0; regime = '5m'
          markers.push({ absIdx: i, y: allBars[i].high, color: '#ff79c6', shape: 'dot', above: true })
          phase = P.POP_HIT; phaseIdx = i
        }
        else if (allBars[i].high > allBars[i - 1].high) {
          markers.push({ absIdx: i, y: allBars[i].low, color: '#00e676', shape: 'wedge-up', above: false })
          phase = P.SCAN; entryNum = 0
        }
        else if (i - phaseIdx > 40) { phase = P.SCAN; entryNum = 0 }
      }
    }
    return markers
  }, [allBars, bars5m, bars15m])

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
          // Convert UTC → ET (DST-aware)
          const utcMonth = d.getUTCMonth() + 1 // 1-12
          const etOffset = (utcMonth >= 4 && utcMonth <= 10) ? -4 : -5 // EDT Apr-Oct, EST Nov-Mar
          const etMs = d.getTime() + etOffset * 3600000
          const etD = new Date(etMs)
          const dd = String(etD.getUTCDate()).padStart(2, '0')
          const mm = String(etD.getUTCMonth() + 1).padStart(2, '0')
          const yyyy = etD.getUTCFullYear()
          dateStr = `${dd}/${mm}/${yyyy}`
          const hh = String(etD.getUTCHours()).padStart(2, '0')
          const min = String(etD.getUTCMinutes()).padStart(2, '0')
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
          const month = d.getUTCMonth() + 1
          const etOff = (month >= 4 && month <= 10) ? 4 : 5
          const h = d.getUTCHours() - etOff
          const m = d.getUTCMinutes()
          return h * 60 + m
        }
        return null
      }
      const getBarDate = (b: any): string => {
        if (typeof b.time === 'string') return b.time.slice(0, 10)
        if (typeof b.time === 'number') { const d = new Date(b.time * 1000); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10) }
        return ''
      }
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

    // ── D0 marker: gold wedge below D0 daily candle (1D only) ──
    if (date && tf === 'D' && bars.length > 0) {
      for (let i = 0; i < bars.length; i++) {
        const b = bars[i]
        let barDate = ''
        if (typeof b.time === 'number') {
          const d = new Date(b.time * 1000)
          const utcMonth = d.getUTCMonth() + 1
          const etOff = (utcMonth >= 4 && utcMonth <= 10) ? -4 : -5
          const etDate = new Date(d.getTime() + etOff * 3600000)
          barDate = isNaN(etDate.getTime()) ? '' : etDate.toISOString().slice(0, 10)
        } else if (typeof b.time === 'string') {
          barDate = b.time.slice(0, 10)
        }
        if (barDate === date) {
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
      const atr20 = calcATR(20)
      const atr72 = calcATR(72)
      const atr89 = calcATR(89)

      // ── 9/20 EMA Band ──
      if (settings.showEma9_20) {
        drawEMABand(ema9, ema20, 'rgba(34,197,94,.15)', 'rgba(239,68,68,.15)', 'rgba(34,197,94,.50)', 'rgba(239,68,68,.50)')
      }

      // ── 9/20 Deviation Band ──
      if (settings.showDevBands) {
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

      // ── 72/89 Deviation Band ──
      if (settings.showDevBands) {
        const db7289_up1 = ema72.map((v, i) => v + atr72[i] * 6.9)
        const db7289_up2 = ema72.map((v, i) => v + atr72[i] * 9.6)
        const db7289_dn1 = ema89.map((v, i) => v - atr89[i] * 6.9)
        const db7289_dn2 = ema89.map((v, i) => v - atr89[i] * 9.6)
        drawBand(db7289_up1, db7289_up2, 'rgba(239,68,68,.15)', 'rgba(239,68,68,.40)')
        drawBand(db7289_dn1, db7289_dn2, 'rgba(34,197,94,.15)', 'rgba(34,197,94,.40)')
      }

      // ── VWAP line (5m / 15m only, resets at market day boundary) ──
      if (settings.showVwap && (tf === '5' || tf === '15')) {
        let cumVP = 0, cumV = 0, lastMktDay: string | null = null
        const vwapVals: number[] = []
        for (let i = 0; i < bars.length; i++) {
          // Determine market day in ET (bars after 7pm UTC belong to prev day)
          const ts = (bars[i].time || 0) * 1000
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
          const bt = bars[i].time
          const bd = typeof bt === 'string' ? bt : (typeof bt === 'number' ? (() => { const d = new Date(bt * 1000); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10) })() : '')
          if (bd === date) {
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
      // ── Execution signals (render pre-computed markers) ──
      if (execMarkers.length) {
        const startAbsIdx = allBars.findIndex(b => b.time === bars[0]?.time)
        for (const m of execMarkers) {
          const relIdx = m.absIdx - startAbsIdx
          if (relIdx < 0 || relIdx >= bars.length) continue
          const x = xFor(relIdx)
          const y = yFor(m.y)
          if (m.shape === 'dot' && settings.showExecDots) {
            ctx.beginPath()
            ctx.arc(x, m.above ? y - 6 : y + 6, m.size || 3.5, 0, Math.PI * 2)
            ctx.fillStyle = m.color
            ctx.fill()
          } else if (m.shape === 'wedge-up' && settings.showExecWedges) {
            const sz = 6
            ctx.beginPath()
            ctx.moveTo(x, y - sz - 2); ctx.lineTo(x - sz, y + sz - 2); ctx.lineTo(x + sz, y + sz - 2)
            ctx.closePath(); ctx.fillStyle = m.color; ctx.fill()
          } else if (m.shape === 'wedge-down' && settings.showExecWedges) {
            const sz = 6
            ctx.beginPath()
            ctx.moveTo(x, y + sz + 2); ctx.lineTo(x - sz, y - sz + 2); ctx.lineTo(x + sz, y - sz + 2)
            ctx.closePath(); ctx.fillStyle = m.color; ctx.fill()
          }
        }
      }

      // ── Backtest trade wedges plotted at the ACTUAL FILL PRICE ──
      // green ▲ = BUY (long entry / short cover); red ▼ = SELL (short entry / long exit).
      // The arrow tip sits exactly on the fill-price line so you can read the real execution.
      if (btMarkers && btMarkers.length && settings.showExecWedges) {
        const sAbs = allBars.findIndex(b => b.time === bars[0]?.time)
        const tfSec = tf === '1' ? 60 : tf === '2' ? 120 : tf === '5' ? 300 : tf === '15' ? 900 : tf === '60' ? 3600 : 86400
        const tIdx = new Map<number, number>()
        for (let i = 0; i < allBars.length; i++) { const k = allBars[i].time - (allBars[i].time % tfSec); if (!tIdx.has(k)) tIdx.set(k, i) }
        for (const m of btMarkers) {
          const ai = tIdx.get(m.time - (m.time % tfSec))
          if (ai == null) continue
          const ri = ai - sAbs
          if (ri < 0 || ri >= bars.length) continue
          const x = xFor(ri), y = yFor(m.price), big = m.selected, sz = big ? 8 : 5
          ctx.beginPath()
          if (m.kind === 'buy') { ctx.moveTo(x, y); ctx.lineTo(x - sz, y + sz * 2); ctx.lineTo(x + sz, y + sz * 2) }
          else { ctx.moveTo(x, y); ctx.lineTo(x - sz, y - sz * 2); ctx.lineTo(x + sz, y - sz * 2) }
          ctx.closePath()
          ctx.fillStyle = m.kind === 'buy' ? (big ? '#2dd4bf' : 'rgba(45,212,191,0.9)') : (big ? '#f87171' : 'rgba(248,113,113,0.9)')
          ctx.fill()
          if (big) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke() }
        }
      }

      if (settings.showLegend) {
      ctx.font = '8px monospace'; ctx.textAlign = 'left'; const lx = 6, ly = 10
      ctx.fillStyle = 'rgba(34,197,94,0.7)'; ctx.fillText('9/20', lx, ly)
      ctx.fillStyle = 'rgba(34,197,94,0.5)'; ctx.fillText('72/89', lx + 35, ly)
      ctx.fillStyle = 'rgba(239,68,68,0.5)'; ctx.fillText('DEV', lx + 70, ly)
      ctx.fillStyle = 'rgba(194,114,58,0.7)'; ctx.fillText('VWAP', lx + 100, ly)
      }
      // Build stamp (top-right) — confirms a fresh deploy (BT-v8 = wedges AT fill price, tip on the line)
      ctx.font = '9px monospace'; ctx.textAlign = 'right'
      ctx.fillStyle = GOLD
      ctx.fillText('BT-v8', W - PAD_R - 30, 12)
    }

    // Zoom indicator
    if (visibleBars.length < allBars.length) {
      ctx.fillStyle = `${GOLD}80`; ctx.font = '9px monospace'; ctx.textAlign = 'right'
      ctx.fillText(`${visibleBars.length}/${allBars.length}`, W - PAD_R - 4, 12)
    }
  }, [visibleBars, allBars.length, tf, date, settings, dark, GOLD, execMarkers, btMarkers])

  useEffect(() => { draw() }, [draw])

  // Wheel zoom
  // ── Drag-to-pan state ──
  const dragRef = useRef<{ startX: number; startIdx: number } | null>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    // If dragging, pan the chart
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX
      const barsPerPx = visibleBars.length / (rect.width - 54)
      const shift = Math.round(dx * barsPerPx)
      const firstBarTime = visibleBars[0]?.time
      const curS = firstBarTime != null ? Math.max(0, allBars.findIndex(b => b.time === firstBarTime)) : 0
      const vis = visibleBars.length
      let newStart = Math.max(0, Math.min(allBars.length - vis, dragRef.current.startIdx - shift))
      // Clamp to not go past D0 if dayOffset=0
      if (dayOffset === 0 && date) {
        let d0End = -1
        for (let i = allBars.length - 1; i >= 0; i--) {
          const b = allBars[i]
          let bd = typeof b.time === "number" ? (() => { const d = new Date(b.time * 1000); const m = d.getUTCMonth()+1; const off = (m>=4&&m<=10)?-4:-5; const ed = new Date(b.time*1000+off*3600000); return isNaN(ed.getTime())?"":ed.toISOString().slice(0,10) })() : typeof b.time === "string" ? b.time.slice(0,10) : ""
          if (bd === date) { d0End = i + 1; break }
        }
        if (d0End > 0 && newStart + vis > d0End) newStart = Math.max(0, d0End - vis)
      }
      setManualZoom({ start: newStart, end: newStart + vis })
      return
    }
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }; draw()
  }
  const handleMouseLeave = () => { mouseRef.current = null; dragRef.current = null; draw() }

  // ── Non-passive wheel listener + mouse handlers via ref ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (!allBars.length) return
      const firstBarTime = visibleBars[0]?.time
      const curS = firstBarTime != null ? Math.max(0, allBars.findIndex(b => b.time === firstBarTime)) : 0
      const curE = curS + visibleBars.length
      const visible = curE - curS
      const zoomAmount = Math.max(2, Math.round(visible * 0.1))
      let newStart: number, newEnd: number
      if (e.deltaY < 0) {
        const newVisible = Math.max(10, visible - zoomAmount)
        const rect = canvas.getBoundingClientRect()
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
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const firstBarTime = visibleBars[0]?.time
      const curS = firstBarTime != null ? Math.max(0, allBars.findIndex(b => b.time === firstBarTime)) : 0
      dragRef.current = { startX: e.clientX, startIdx: curS }
      canvas.style.cursor = 'grabbing'
    }
    const onMouseUp = () => {
      dragRef.current = null
      if (canvas) canvas.style.cursor = 'crosshair'
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [allBars, visibleBars])
  const tfLabel = tf === '1' ? '1m' : tf === '2' ? '2m' : tf === '5' ? '5m' : tf === '15' ? '15m' : tf === '60' ? '1H' : '1D'
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
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
          style={{ width: '100%', height, display: 'block', cursor: 'crosshair' }} />
      )}
    </div>
  )
}

// ── Notional capital model for backtest stats (REQ-321) ─────────────────────
// Mike's backtest RUN trades carry an R-multiple (trades[].r) AND a realized
// dollar P&L (trades[].pnl = r × run.meta.params.riskPerTrade). Earlier code
// conflated the two: totalReturnPct was the R-sum mislabeled "%", CAGR was
// stubbed to that same R-sum, and Total P&L multiplied the sum by a 1000 fudge.
// This helper maps every run onto ONE fixed notional account so $, % and CAGR
// stay internally consistent while R remains the primary performance lens:
//   NOTIONAL     = $10,000 baseline account
//   riskPerTrade = run.meta.params.riskPerTrade (default $100 ⇒ 1% risk/trade)
//   Total P&L $  = Σ trades[].pnl            (real dollars — NO fudge factor)
//   Total Return = Total P&L / NOTIONAL        (linear on the fixed notional)
//   CAGR         = (1+TotalReturn)^(1/years)−1, years = (meta.to−meta.from)/365.25
//   Sharpe/Sortino annualize by trades-per-year (intraday), NOT √252
//   Calmar       = CAGR / maxDD   (both fractional), NOT totalReturn/maxDD
const BT_NOTIONAL = 10000

function btNotionalStats(o: { pnlDollars: number[]; years: number; notional?: number }) {
  const notional = o.notional ?? BT_NOTIONAL
  const N = o.pnlDollars.length
  const totalPnl = o.pnlDollars.reduce((a, b) => a + b, 0)          // real $
  const totalReturnFrac = totalPnl / notional
  const totalReturnPct = totalReturnFrac * 100
  const years = o.years > 0 ? o.years : 1
  const cagrFrac = Math.pow(1 + totalReturnFrac, 1 / years) - 1
  const cagr = cagrFrac * 100
  const tradesPerYear = N / years
  const sqrtTpy = Math.sqrt(tradesPerYear)
  // per-trade fractional returns on the notional account
  const fr = o.pnlDollars.map(p => p / notional)
  const mean = N ? fr.reduce((a, b) => a + b, 0) / N : 0
  const stdFrac = N ? Math.sqrt(fr.reduce((a, b) => a + (b - mean) ** 2, 0) / N) : 0
  const ddevFrac = N ? Math.sqrt(fr.reduce((a, b) => a + Math.min(0, b) ** 2, 0) / N) : 0
  const sharpe = stdFrac > 0 ? (mean / stdFrac) * sqrtTpy : 0
  const sortino = ddevFrac > 0 ? (mean / ddevFrac) * sqrtTpy : 0
  // $ equity curve + drawdown (fraction of peak)
  let eq = notional, peak = notional, maxDdFrac = 0, maxDd$ = 0
  const cumPnlSeries: number[] = [], drawdownSeries: number[] = []
  o.pnlDollars.forEach(p => {
    eq += p
    cumPnlSeries.push(eq - notional)                              // cumulative $ P&L from 0
    peak = Math.max(peak, eq)
    const dd$ = peak - eq
    drawdownSeries.push(dd$)
    const ddFrac = peak > 0 ? dd$ / peak : 0
    if (ddFrac > maxDdFrac) { maxDdFrac = ddFrac; maxDd$ = dd$ }
  })
  const maxDrawdown = maxDdFrac * 100
  const calmar = maxDdFrac > 0 ? cagrFrac / maxDdFrac : 0
  const recoveryFactor = maxDd$ > 0 ? totalPnl / maxDd$ : 0
  return { totalPnl, totalReturnPct, cagr, sharpe, sortino, calmar, maxDrawdown,
    recoveryFactor, stdDevReturns: stdFrac * 100, downsideDev: ddevFrac * 100,
    cumPnlSeries, drawdownSeries }
}

// Roll a sorted-by-date day series up to ISO calendar weeks (for >40-day runs).
function groupDaysToWeeks(days: { date: string; day: string; r: number; pnl: number; count: number; wins: number }[]) {
  const keyOf = (iso: string) => {
    const d = new Date(iso + 'T12:00:00Z')
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    const dn = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - dn)
    const yStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    const wk = Math.ceil((((t.getTime() - yStart.getTime()) / 86400000) + 1) / 7)
    return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`
  }
  const m = new Map<string, { date: string; day: string; r: number; pnl: number; count: number; wins: number }>()
  for (const d of days) {
    const k = keyOf(d.date)
    const e = m.get(k) || { date: d.date, day: k.slice(5), r: 0, pnl: 0, count: 0, wins: 0 }
    e.r += d.r; e.pnl += d.pnl; e.count += d.count; e.wins += d.wins
    m.set(k, e)
  }
  return Array.from(m.values())
}

// Per-day (or per-week) breakdown with R / $ / g(green%) / N(count) segmented
// toggle (mirrors the journal dashboard). >40 periods defaults to weekly rollup.
type DayMetric = 'R' | '$' | 'g' | 'N'
function DailyBreakdown({ days, dark, isRun }: { days: { date: string; day: string; r: number; pnl: number; count: number; wins: number }[]; dark: boolean; isRun: boolean }) {
  const C = dark
    ? { BG, SURFACE, SURFACE2, SURFACE3, BORDER, TEXT, TEXT2, MUTED, WHITE, RED, TEAL, GOLD, VOL_UP, VOL_DN, GOLD_DIM, GOLD_BORDER }
    : { ...LIGHT, GOLD, GOLD_DIM: LIGHT.GOLD_DIM, GOLD_BORDER: LIGHT.GOLD_BORDER }
  const [metric, setMetric] = useState<DayMetric>('R')
  const weeklyDefault = days.length > 40
  const [rollup, setRollup] = useState<'day' | 'week'>(weeklyDefault ? 'week' : 'day')
  const rows = useMemo(() => (rollup === 'week' ? groupDaysToWeeks(days) : days), [days, rollup])
  if (!rows.length) return null
  const valOf = (d: { r: number; pnl: number; count: number; wins: number }) => {
    if (metric === 'R') return { v: d.r, s: `${d.r >= 0 ? '+' : ''}${d.r.toFixed(1)}R`, col: d.r >= 0 ? C.TEAL : C.RED }
    if (metric === '$') return { v: d.pnl, s: `${d.pnl >= 0 ? '+' : ''}$${Math.round(d.pnl)}`, col: d.pnl >= 0 ? C.TEAL : C.RED }
    if (metric === 'g') { const g = d.count ? (d.wins / d.count) * 100 : 0; return { v: g, s: `${g.toFixed(0)}%`, col: g >= 50 ? C.TEAL : C.RED } }
    return { v: d.count, s: `${d.count}`, col: C.GOLD }
  }
  const vals = rows.map(valOf)
  const maxAbs = Math.max(...vals.map(x => Math.abs(x.v)), 1)
  const segs: { key: DayMetric; title: string }[] = [
    { key: 'R', title: 'R-multiple per period' },
    { key: '$', title: 'Dollar P&L per period' },
    { key: 'g', title: 'Green % (win rate) per period' },
    { key: 'N', title: 'Trade count per period' },
  ]
  return (
    <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 6, flexWrap: 'wrap' }}>
        <Clock className="h-3 w-3" style={{ color: C.GOLD }} />
        <span style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{rollup === 'week' ? 'Weekly' : 'Daily'} Breakdown</span>
        <div className="flex items-center" style={{ marginLeft: 4, background: C.SURFACE2, borderRadius: 3, padding: 1 }}>
          {segs.map(s => (
            <button key={s.key} onClick={() => setMetric(s.key)} title={s.title} style={{
              padding: '2px 8px', fontSize: 10, fontWeight: metric === s.key ? 800 : 500,
              color: metric === s.key ? '#000' : C.MUTED, background: metric === s.key ? C.TEAL : 'transparent',
              border: 'none', borderRadius: 2, cursor: 'pointer',
            }}>{s.key}</button>
          ))}
        </div>
        {weeklyDefault && (
          <div className="flex items-center" style={{ marginLeft: 'auto', background: C.SURFACE2, borderRadius: 3, padding: 1 }}>
            {(['week', 'day'] as const).map(r => (
              <button key={r} onClick={() => setRollup(r)} style={{
                padding: '2px 8px', fontSize: 9, fontWeight: rollup === r ? 800 : 500,
                color: rollup === r ? '#000' : C.MUTED, background: rollup === r ? C.GOLD : 'transparent',
                border: 'none', borderRadius: 2, cursor: 'pointer', textTransform: 'capitalize',
              }}>{r}</button>
            ))}
          </div>
        )}
      </div>
      {/* bar chart overlay (selected metric) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 44, padding: '2px 0 4px' }}>
        {vals.map((x, i) => (
          <div key={i} title={`${rows[i].day || rows[i].date}: ${x.s}`} style={{
            flex: 1, minWidth: 2, height: `${Math.max((Math.abs(x.v) / maxAbs) * 100, 4)}%`,
            background: x.col, borderRadius: '1px 1px 0 0', opacity: 0.85,
          }} />
        ))}
      </div>
      {/* per-period list */}
      <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }}>
        {rows.map((d, i) => {
          const x = vals[i]
          return (
            <div key={i} style={{ minWidth: 46, padding: '3px 5px', background: C.SURFACE2, borderRadius: 3, textAlign: 'center' }}>
              <div style={{ color: C.MUTED, fontSize: 7, fontWeight: 600 }}>{d.day || d.date}</div>
              <div style={{ color: x.col, fontSize: 11, fontWeight: 700 }}>{x.s}</div>
              <div style={{ color: C.MUTED, fontSize: 6 }}>{d.count}t</div>
            </div>
          )
        })}
      </div>
      {!isRun && metric === '$' && (
        <div style={{ color: C.MUTED, fontSize: 7, marginTop: 4 }}>$ = R × $100 risk on the $10k notional model (baseline D0 has no native $ P&L)</div>
      )}
    </div>
  )
}

// ─── Backtest Stats Panel — Multi-Tab ────────────────
type StatsTab = 'overview' | 'performance' | 'pnl' | 'robustness'

function BacktestStatsPanel({ signals, backtestResults, dark, isBacktestRun }: { signals: Signal[]; backtestResults: BacktestResults | null; dark: boolean; isBacktestRun?: boolean }) {
  const C = dark
    ? { BG, SURFACE, SURFACE2, SURFACE3, BORDER, TEXT, TEXT2, MUTED, WHITE, RED, TEAL, GOLD, VOL_UP, VOL_DN, GOLD_DIM, GOLD_BORDER }
    : { ...LIGHT, GOLD, GOLD_DIM: LIGHT.GOLD_DIM, GOLD_BORDER: LIGHT.GOLD_BORDER }
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')

  const sigStats = useMemo(() => {
    if (!signals.length) return null
    const gaps = signals.map(s => s.gap_pct || 0)
    const abses = signals.map(s => s.pos_abs || 0)
    const dates = new Set(signals.map(s => s.date)).size
    const tickers = new Set(signals.map(s => s.ticker)).size
    const d0Chg = signals.map(s => ((s.close - s.open) / s.open) * 100)
    const avgD0Chg = d0Chg.reduce((a, b) => a + b, 0) / d0Chg.length
    const redPct = d0Chg.filter(c => c < 0).length / d0Chg.length * 100
    const closePosRange = signals.map(s => { const r = s.high - s.low; return r > 0 ? (s.close - s.low) / r : 0.5 })
    const avgClosePos = closePosRange.reduce((a, b) => a + b, 0) / closePosRange.length
    const vols = signals.map(s => s.volume || 0)
    const avgVol = vols.reduce((a, b) => a + b, 0) / vols.length
    const minClose = Math.min(...signals.map(s => s.close))
    const maxClose = Math.max(...signals.map(s => s.close))
    const freq: Record<string, number> = {}
    signals.forEach(s => { freq[s.ticker] = (freq[s.ticker] || 0) + 1 })
    const topTickers = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { dates, tickers, avgD0Chg, redPct, avgClosePos, avgGap: gaps.reduce((a, b) => a + b, 0) / gaps.length, avgAbs: abses.reduce((a, b) => a + b, 0) / abses.length, avgVol, minClose, maxClose, topTickers }
  }, [signals])

  // During a backtest RUN there are no scan "signals" — don't let a null sigStats
  // hide the whole panel (the run's stats live in backtestResults).
  if (!sigStats && !backtestResults) return null
  const bt = backtestResults
  const tabs: { key: StatsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Zap className="h-3 w-3" /> },
    { key: 'performance', label: 'Performance', icon: <Activity className="h-3 w-3" /> },
    { key: 'pnl', label: 'P&L / Drawdown', icon: <TrendingUp className="h-3 w-3" /> },
    { key: 'robustness', label: 'Robustness', icon: <Shield className="h-3 w-3" /> },
  ]

  return (
    <div className="space-y-2">
      {/* ── Signal Overview Row — HIDDEN during a backtest RUN (no scan signals;
          kills the zero-leak from Avg Gap%/ABS/D0 Chg/%Red/Close Pos). ── */}
      {sigStats && !isBacktestRun && (
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-1.5">
        <StatBox label="Signals" value={signals.length.toString()} icon={<Zap className="h-3 w-3" />} />
        <StatBox label="Days" value={sigStats.dates.toString()} icon={<Calendar className="h-3 w-3" />} />
        <StatBox label="Tickers" value={sigStats.tickers.toString()} icon={<Hash className="h-3 w-3" />} />
        <StatBox label="Avg Gap%" value={`${sigStats.avgGap.toFixed(1)}%`} icon={<TrendingUp className="h-3 w-3" />} color={C.TEAL} />
        <StatBox label="Avg ABS" value={sigStats.avgAbs.toFixed(3)} icon={<Target className="h-3 w-3" />} color={C.GOLD} />
        <StatBox label="Avg D0 Chg" value={`${sigStats.avgD0Chg > 0 ? '+' : ''}${sigStats.avgD0Chg.toFixed(1)}%`} icon={<TrendingDown className="h-3 w-3" />} color={sigStats.avgD0Chg < 0 ? C.RED : C.TEAL} />
        <StatBox label="% Red" value={`${sigStats.redPct.toFixed(0)}%`} icon={<Minus className="h-3 w-3" />} color={C.RED} />
        <StatBox label="Close Pos" value={sigStats.avgClosePos.toFixed(2)} icon={<Target className="h-3 w-3" />} color={sigStats.avgClosePos < 0.5 ? C.RED : C.TEAL} />
      </div>
      )}

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1" style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '4px 8px' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 3, fontSize: 11, fontWeight: activeTab === t.key ? 700 : 500,
            background: activeTab === t.key ? C.TEAL : 'transparent',
            color: activeTab === t.key ? '#000' : C.MUTED,
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>{t.icon}{t.label}</button>
        ))}
        {bt && <span style={{ color: C.MUTED, fontSize: 9, marginLeft: 'auto' }}>{bt.entryType} → {bt.exitType} · {bt.totalTrades} trades</span>}
      </div>

      {/* ── Tab Content ── */}
      {!bt ? (
        <div style={{ background: C.SURFACE, border: `1px dashed ${C.BORDER}`, borderRadius: 4, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Activity className="h-4 w-4" style={{ color: C.MUTED, opacity: 0.4 }} />
          <span style={{ color: C.MUTED, fontSize: 11 }}>Run a baseline backtest to see full stats — click <strong style={{ color: C.TEAL }}>Baseline</strong> above</span>
        </div>
      ) : activeTab === 'overview' ? (
        <>
          {/* ── OVERVIEW TAB: Key metrics grid ── */}
          <div style={{ background: C.SURFACE, border: `1px solid ${C.TEAL}40`, borderRadius: 4, padding: '12px 14px' }}>
            <div style={{ color: C.MUTED, fontSize: 8, marginBottom: 6, letterSpacing: 0.3, lineHeight: 1.4 }}>
              {isBacktestRun
                ? 'Notional $10,000 · 1% risk/trade · $ P&L = Σ trades[].pnl · CAGR over (to−from) · Sharpe/Sortino annualized ×√(trades/yr)'
                : 'Baseline D0 open→close · R = (close−open)/(open−low) · $ mapped at $100 risk/trade on $10k notional'}
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-2">
              <MetricRow label="Total Return" value={`${bt.totalReturnPct > 0 ? '+' : ''}${bt.totalReturnPct.toFixed(1)}%`} color={bt.totalReturnPct >= 0 ? C.TEAL : C.RED} />
              <MetricRow label="CAGR" value={`${bt.cagr > 0 ? '+' : ''}${bt.cagr.toFixed(1)}%`} color={bt.cagr >= 0 ? C.TEAL : C.RED} />
              <MetricRow label="Total P&L" value={`$${bt.totalPnl > 0 ? '+' : ''}${(bt.totalPnl / 1000).toFixed(1)}k`} color={bt.totalPnl >= 0 ? C.TEAL : C.RED} />
              <MetricRow label="Total Trades" value={bt.totalTrades.toString()} />
              <MetricRow label="Win Rate" value={`${bt.winRate.toFixed(1)}%`} color={bt.winRate >= 50 ? C.TEAL : C.RED} />
              <MetricRow label="Profit Factor" value={bt.profitFactor.toFixed(2)} color={bt.profitFactor >= 1.5 ? C.TEAL : C.RED} />
              <MetricRow label="Avg R-Multiple" value={`${bt.avgRMultiple > 0 ? '+' : ''}${bt.avgRMultiple.toFixed(2)}R`} color={bt.avgRMultiple >= 0 ? C.TEAL : C.RED} />
              <MetricRow label="Median R" value={`${bt.medianR > 0 ? '+' : ''}${bt.medianR.toFixed(2)}R`} color={bt.medianR >= 0 ? C.TEAL : C.RED} />
              <MetricRow label="Expectancy" value={`${bt.expectancyPct > 0 ? '+' : ''}${bt.expectancyPct.toFixed(2)}%`} color={bt.expectancyPct >= 0 ? C.TEAL : C.RED} />
              <MetricRow label="Sharpe Ratio" value={bt.sharpe.toFixed(2)} color={bt.sharpe >= 1.0 ? C.TEAL : C.RED} />
              <MetricRow label="Sortino Ratio" value={bt.sortino.toFixed(2)} color={bt.sortino >= 1.5 ? C.TEAL : C.RED} />
              <MetricRow label="Calmar Ratio" value={bt.calmar.toFixed(2)} color={bt.calmar >= 1.0 ? C.TEAL : C.RED} />
              <MetricRow label="Max Drawdown" value={`-${bt.maxDrawdown.toFixed(1)}%`} color={C.RED} />
              <MetricRow label="Max DD Duration" value={`${bt.maxDDDuration} bars`} />
              <MetricRow label="Recovery Factor" value={bt.recoveryFactor.toFixed(2)} color={bt.recoveryFactor >= 3 ? C.TEAL : C.RED} />
              <MetricRow label="Avg Win" value={`+${bt.avgWinPct.toFixed(2)}%`} color={C.TEAL} />
              <MetricRow label="Avg Loss" value={`${bt.avgLossPct.toFixed(2)}%`} color={C.RED} />
              <MetricRow label="Win/Loss Ratio" value={`${bt.wlRatio.toFixed(2)}x`} />
              <MetricRow label="Best Trade" value={isBacktestRun ? `+${bt.bestTrade.toFixed(2)}R` : `+${bt.bestTrade.toFixed(2)}%`} color={C.TEAL} />
              <MetricRow label="Worst Trade" value={isBacktestRun ? `${bt.worstTrade.toFixed(2)}R` : `${bt.worstTrade.toFixed(2)}%`} color={C.RED} />
              <MetricRow label="Std Dev Returns" value={`${bt.stdDevReturns.toFixed(2)}%`} />
              <MetricRow label="Max Consec Wins" value={bt.maxConsecWins.toString()} color={C.TEAL} />
              <MetricRow label="Max Consec Loss" value={bt.maxConsecLosses.toString()} color={C.RED} />
              <MetricRow label="Gross Win" value={`+${bt.grossWin.toFixed(1)}%`} color={C.TEAL} />
              <MetricRow label="Gross Loss" value={`${bt.grossLoss.toFixed(1)}%`} color={C.RED} />
            </div>
          </div>

          {/* Day-by-day — R / $ / g(green%) / N(count) toggle + weekly rollup */}
          {bt.dayStats.length > 0 && (
            <DailyBreakdown days={bt.dayStats} dark={dark} isRun={!!isBacktestRun} />
          )}
        </>
      ) : activeTab === 'performance' ? (
        <>
          {/* ── PERFORMANCE TAB: Distribution + Monthly ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
            {/* Return Distribution */}
            <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ color: C.GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Return Distribution</div>
              {(() => {
                const buckets = { '< -5%': 0, '-5 to -2%': 0, '-2 to 0%': 0, '0 to +2%': 0, '+2 to +5%': 0, '> +5%': 0 }
                bt.tradeReturns.forEach(r => {
                  if (r < -5) buckets['< -5%']++
                  else if (r < -2) buckets['-5 to -2%']++
                  else if (r < 0) buckets['-2 to 0%']++
                  else if (r < 2) buckets['0 to +2%']++
                  else if (r < 5) buckets['+2 to +5%']++
                  else buckets['> +5%']++
                })
                const maxB = Math.max(...Object.values(buckets), 1)
                return Object.entries(buckets).map(([label, count]) => {
                  const pct = (count / bt.totalTrades) * 100
                  const barCol = label.startsWith('-') || label.startsWith('<') ? C.RED : C.TEAL
                  return (
                    <div key={label} className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
                      <span style={{ color: C.MUTED, fontSize: 8, width: 56, fontFamily: 'monospace', textAlign: 'right' }}>{label}</span>
                      <div style={{ flex: 1, height: 12, background: C.SURFACE3, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(count / maxB) * 100}%`, background: barCol, borderRadius: 2, minWidth: count > 0 ? 2 : 0 }} />
                      </div>
                      <span style={{ color: C.TEXT2, fontSize: 8, width: 28 }}>{count}</span>
                      <span style={{ color: C.MUTED, fontSize: 7, width: 30 }}>{pct.toFixed(0)}%</span>
                    </div>
                  )
                })
              })()}
            </div>

            {/* Monthly Breakdown */}
            <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Monthly Returns</div>
              {bt.monthlyStats.map((m, i) => {
                const col = m.pnl >= 0 ? C.TEAL : C.RED
                const barW = Math.min(Math.abs(m.pnl) * 3, 100)
                return (
                  <div key={i} className="flex items-center gap-1.5" style={{ marginBottom: 4 }}>
                    <span style={{ color: C.GOLD, fontSize: 9, fontWeight: 600, width: 36, fontFamily: 'monospace' }}>{m.month.slice(5)}</span>
                    <div style={{ flex: 1, height: 14, background: C.SURFACE3, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: col, borderRadius: 2, opacity: 0.7 }} />
                    </div>
                    <span style={{ color: col, fontSize: 9, fontWeight: 700, width: 48, textAlign: 'right' }}>{m.pnl >= 0 ? '+' : ''}{m.pnl.toFixed(1)}%</span>
                    <span style={{ color: C.MUTED, fontSize: 7, width: 24 }}>{m.count}t</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trade Details Table */}
          <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
            <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>R-Multiple Distribution</div>
            {(() => {
              const rBuckets = { '< -2R': 0, '-2 to -1R': 0, '-1 to 0R': 0, '0 to +1R': 0, '+1 to +2R': 0, '> +2R': 0 }
              bt.tradeReturns.forEach((_, i) => {
                const r = bt.tradeReturns[i] // simplified: using return as proxy
                // We can't get exact R here without original risk, show return dist instead
              })
              const rMults = bt.tradeReturns.map(r => r / Math.abs(bt.avgLossPct || 1)) // normalized
              rMults.forEach(r => {
                if (r < -2) rBuckets['< -2R']++
                else if (r < -1) rBuckets['-2 to -1R']++
                else if (r < 0) rBuckets['-1 to 0R']++
                else if (r < 1) rBuckets['0 to +1R']++
                else if (r < 2) rBuckets['+1 to +2R']++
                else rBuckets['> +2R']++
              })
              const maxR = Math.max(...Object.values(rBuckets), 1)
              return Object.entries(rBuckets).map(([label, count]) => {
                const col = label.includes('-') ? C.RED : C.TEAL
                return (
                  <div key={label} className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
                    <span style={{ color: C.MUTED, fontSize: 8, width: 52, fontFamily: 'monospace', textAlign: 'right' }}>{label}</span>
                    <div style={{ flex: 1, height: 12, background: C.SURFACE3, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / maxR) * 100}%`, background: col, borderRadius: 2, minWidth: count > 0 ? 2 : 0 }} />
                    </div>
                    <span style={{ color: C.TEXT2, fontSize: 8, width: 20 }}>{count}</span>
                  </div>
                )
              })
            })()}
          </div>
        </>
      ) : activeTab === 'pnl' ? (
        <>
          {/* ── P&L / DRAWDOWN TAB: Equity curve + DD chart (canvas) ── */}
          <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Equity Curve (Cumulative P&L)</div>
            <EquityChart data={bt.cumPnlSeries} color={bt.cumPnlSeries[bt.cumPnlSeries.length - 1] >= 0 ? C.TEAL : C.RED} height={130} />
          </div>
          <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ color: C.RED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Drawdown</div>
            <EquityChart data={bt.drawdownSeries} color={C.RED} height={100} inverted />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
            <StatBox label="Total Return" value={`${bt.totalReturnPct > 0 ? '+' : ''}${bt.totalReturnPct.toFixed(1)}%`} icon={<TrendingUp className="h-3 w-3" />} color={bt.totalReturnPct >= 0 ? C.TEAL : C.RED} />
            <StatBox label="Max DD" value={`-${bt.maxDrawdown.toFixed(1)}%`} icon={<TrendingDown className="h-3 w-3" />} color={C.RED} />
            <StatBox label="Recovery Factor" value={bt.recoveryFactor.toFixed(2)} icon={<Activity className="h-3 w-3" />} color={bt.recoveryFactor >= 3 ? C.TEAL : C.RED} />
            <StatBox label="Calmar" value={bt.calmar.toFixed(2)} icon={<BarChart3 className="h-3 w-3" />} color={bt.calmar >= 1 ? C.TEAL : C.RED} />
          </div>
        </>
      ) : activeTab === 'robustness' ? (
        <>
          {/* ── ROBUSTNESS TAB: Validation placeholders ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
            <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '12px 10px', textAlign: 'center' }}>
              <Shield className="h-5 w-5 mx-auto" style={{ color: C.MUTED, marginBottom: 4 }} />
              <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Walk-Forward Analysis</div>
              <div style={{ color: C.TEXT2, fontSize: 20, fontWeight: 700, marginTop: 6 }}>—</div>
              <div style={{ color: C.MUTED, fontSize: 8, marginTop: 2, lineHeight: 1.4 }}>Anchored WFO 5-fold\nIS/OOS degradation</div>
              <div style={{ color: C.SURFACE3, fontSize: 7, marginTop: 6 }}>Not yet computed</div>
            </div>
            <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '12px 10px', textAlign: 'center' }}>
              <BarChart3 className="h-5 w-5 mx-auto" style={{ color: C.MUTED, marginBottom: 4 }} />
              <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Monte Carlo Simulation</div>
              <div style={{ color: C.TEXT2, fontSize: 20, fontWeight: 700, marginTop: 6 }}>—</div>
              <div style={{ color: C.MUTED, fontSize: 8, marginTop: 2, lineHeight: 1.4 }}>10K permutations\n95% CI bounds</div>
              <div style={{ color: C.SURFACE3, fontSize: 7, marginTop: 6 }}>Not yet computed</div>
            </div>
            <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '12px 10px', textAlign: 'center' }}>
              <TrendingUp className="h-5 w-5 mx-auto" style={{ color: C.MUTED, marginBottom: 4 }} />
              <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Parameter Sensitivity</div>
              <div style={{ color: C.TEXT2, fontSize: 20, fontWeight: 700, marginTop: 6 }}>—</div>
              <div style={{ color: C.MUTED, fontSize: 8, marginTop: 2, lineHeight: 1.4 }}>±20% param sweep\nRobustness score</div>
              <div style={{ color: C.SURFACE3, fontSize: 7, marginTop: 6 }}>Not yet computed</div>
            </div>
          </div>
          <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
            <div style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Current Strategy Parameters</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <div><span style={{ color: C.MUTED, fontSize: 8 }}>Entry</span><div style={{ color: TEXT, fontSize: 11, fontWeight: 600 }}>{bt.entryType}</div></div>
              <div><span style={{ color: C.MUTED, fontSize: 8 }}>Exit</span><div style={{ color: TEXT, fontSize: 11, fontWeight: 600 }}>{bt.exitType}</div></div>
              <div><span style={{ color: C.MUTED, fontSize: 8 }}>Stop</span><div style={{ color: TEXT, fontSize: 11, fontWeight: 600 }}>D0 Low (baseline)</div></div>
              <div><span style={{ color: C.MUTED, fontSize: 8 }}>Duration</span><div style={{ color: TEXT, fontSize: 11, fontWeight: 600 }}>{bt.avgTradeDuration}</div></div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

// ─── Helper components for stats ──
function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '4px 0', borderBottom: `1px solid ${SURFACE3}` }}>
      <span style={{ color: MUTED, fontSize: 11 }}>{label}</span>
      <span style={{ color: color || TEXT, fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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
    // Zero line
    const zeroY = h - ((0 - min) / range) * h
    ctx.strokeStyle = `${SURFACE3}`; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke(); ctx.setLineDash([])
    // Fill
    ctx.beginPath()
    ctx.moveTo(0, h - ((data[0] - min) / range) * h)
    data.forEach((v, i) => ctx.lineTo(i * xStep, h - ((v - min) / range) * h))
    ctx.lineTo((data.length - 1) * xStep, h); ctx.lineTo(0, h); ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '05')
    ctx.fillStyle = grad; ctx.fill()
    // Line
    ctx.beginPath()
    ctx.moveTo(0, h - ((data[0] - min) / range) * h)
    data.forEach((v, i) => ctx.lineTo(i * xStep, h - ((v - min) / range) * h))
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
  }, [data, color, height])
  return <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />
}

// DistBar removed — not needed for backtest page
function StatBox({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
      <div className="flex items-center gap-1" style={{ color: MUTED, fontSize: 9 }}>{icon}{label}</div>
      <div style={{ color: color || GOLD, fontSize: 16, fontWeight: 700, marginTop: 1 }}>{value}</div>
    </div>
  )
}
function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '2px 6px' }}>
      <span style={{ color: MUTED, fontSize: 8, textTransform: 'uppercase' }}>{label} </span>
      <span style={{ color: color || TEXT, fontSize: 10, fontWeight: 600 }}>{value}</span>
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

// ─── Run Modal ──────────────────────────────────────────
function RunModal({ scan, onClose, onRun }: { scan: ScanDef | undefined; onClose: () => void; onRun: (range: string) => void }) {
  const [range, setRange] = useState('90')
  const [running, setRunning] = useState(false)
  if (!scan) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ background: SURFACE2, border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: 24, width: 360, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <h3 style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>Run Scan</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED }}><X className="h-4 w-4" /></button>
        </div>
        <div style={{ color: TEXT, fontSize: 12, marginBottom: 16 }}>{scan.name}</div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Date Range</label>
          <div className="flex gap-1">
            {['7', '14', '30', '60', '90', '180', '365'].map(d => (
              <button key={d} onClick={() => setRange(d)} style={{
                padding: '4px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: range === d ? GOLD : SURFACE, color: range === d ? '#000' : MUTED,
                border: `1px solid ${range === d ? GOLD : BORDER}`,
              }}>{d}d</button>
            ))}
          </div>
        </div>
        <button disabled={running} onClick={() => { setRunning(true); onRun(range) }} style={{
          width: '100%', padding: '10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
          background: running ? MUTED : GOLD, color: running ? TEXT : '#000',
          border: 'none', cursor: running ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running...' : 'Run Scan'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────
export default function BacktestPage() {
  const [scans, setScans] = useState<ScanDef[]>([])
  const [selectedScan, setSelectedScan] = useState<string>('')
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tf, setTf] = useState<Timeframe>('D')
  const [chartMode, setChartMode] = useState<ChartMode>('single')
  const [viewMode, setViewMode] = useState<'stat' | 'chart'>('stat')
  const [loading, setLoading] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)
  const [showExec, setShowExec] = useState(false)
  const [activeExec, setActiveExec] = useState<string>('pop-short')
  const [showExecDots, setShowExecDots] = useState(true)
  const [showExecWedges, setShowExecWedges] = useState(true)
  const [selectedRun, setSelectedRun] = useState<string>('r1')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showEma9_20: true, showEma72_89: true, showDevBands: true,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: true,
    showExecDots: true, showExecWedges: true,
  })
  const [dark, setDark] = useState(true)
  const [dayOffset, setDayOffset] = useState(0)
  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null)
  // ── Backtest runs (peers to scans; selectable in the left sidebar) ──
  const [btRuns, setBtRuns] = useState<{ id: string; name: string; engine: string; meta: any; summary: any }[]>([])
  const [selectedBtRun, setSelectedBtRun] = useState<string | null>(null)
  const [btTrades, setBtTrades] = useState<{ id: string; side: 'long' | 'short'; openDate: string; exitDate: string; entry: number; stop: number; exit: number; exitLabel: string; r: number; pnl: number; ticker?: string; rsDate?: string }[]>([])
  const [selectedTradeIdx, setSelectedTradeIdx] = useState<number>(0)
  // ── Persisted state: init empty, hydrate from localStorage in useEffect ──
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [bars15mCache, setBars15mCache] = useState<Record<string, any[]>>({})
  const [bars15mLoading, setBars15mLoading] = useState(false)
  const [bars1mCache, setBars1mCache] = useState<Record<string, any[]>>({})
  const [bars1mLoading, setBars1mLoading] = useState(false)
  const [tickResults, setTickResults] = useState<Record<string, boolean>>({})
  const [visibleFilters, setVisibleFilters] = useState<Set<string>>(new Set())
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [hideFilters, setHideFilters] = useState<Set<string>>(new Set())
  const [leftW, setLeftW] = useState(LEFT_W_DEFAULT)
  const [rightW, setRightW] = useState(RIGHT_W_DEFAULT)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set())
  const [routeStarts, setRouteStarts] = useState<Set<string>>(new Set())
  const DEFAULT_WIDTHS: Record<string, number> = { ticker: 56, date: 68, rs: 44, grade: 32, gap: 44, d0: 40, abs: 40 }
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS)

  // ── Hydrate from localStorage on mount ──
  useEffect(() => {
    const load = <T,>(key: string, fallback: T): T => {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
    }
    setActiveFilters(new Set(load<string[]>('backtest-af', [])))
    setVisibleFilters(new Set(load<string[]>('backtest-vf', [])))
    setHideFilters(new Set(load<string[]>('backtest-hf', [])))
    setVisibleColumns(new Set(load<string[]>('backtest-vc', [])))
    setRouteStarts(new Set(load<string[]>('backtest-rs', [])))
    const cw = load<Record<string, number>>('backtest-cw', DEFAULT_WIDTHS)
    if (cw && Object.keys(cw).length > 0) setColWidths(cw)
    try { const g = localStorage.getItem('backtest-grades'); if (g) setGrades(JSON.parse(g)) } catch {}
  }, [])
  const toggleRS = (key: string) => {
    setRouteStarts(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem('backtest-rs', JSON.stringify([...next])) } catch {}
      fetch('/api/backtest/rs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marks: [...next] }) }).catch(() => {})
      return next
    })
  }
  // ── Sync marks + grades to server after hydration ──
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const marks = JSON.parse(localStorage.getItem('backtest-rs') || '[]')
        const gradesData = JSON.parse(localStorage.getItem('backtest-grades') || '{}')
        if (marks.length > 0 || Object.keys(gradesData).length > 0) {
          fetch('/api/backtest/rs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marks, grades: gradesData }) }).catch(() => {})
        }
      } catch {}
    }, 1000)
    return () => clearTimeout(timer)
  }, [])
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const GRADES = ['A+', 'A', 'B', 'C'] as const
  const [grades, setGrades] = useState<Record<string, string>>({})
  const [gradeFilter, setGradeFilter] = useState<string>('')  // '', 'A+', 'A', 'B', 'C'
  // ── Tag filter (organization across the scan's annotated signals) ──
  const [tagFilter, setTagFilter] = useState<string>('')
  const [scanAnnotations, setScanAnnotations] = useState<{ ticker: string; signalDate: string; tags: string[] }[]>([])
  const refreshAnnotations = useCallback(() => {
    if (!selectedScan) return
    fetch(`/api/backtest/annotation?scanId=${encodeURIComponent(selectedScan)}&list=1`)
      .then(r => r.json())
      .then(d => setScanAnnotations(d.annotations || []))
      .catch(() => {})
  }, [selectedScan])
  useEffect(() => { refreshAnnotations() }, [selectedScan, refreshAnnotations])
  // tag → count map for the filter row
  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of scanAnnotations) for (const t of a.tags) m[t] = (m[t] || 0) + 1
    return m
  }, [scanAnnotations])
  // set of ticker|date keys that carry the active tag
  const tagMatchKeys = useMemo(() => {
    if (!tagFilter) return null
    const s = new Set<string>()
    for (const a of scanAnnotations) if (a.tags.includes(tagFilter)) s.add(`${a.ticker}|${a.signalDate}`)
    return s
  }, [tagFilter, scanAnnotations])
  const toggleGrade = (key: string) => {
    setGrades(prev => {
      const current = prev[key] || ''
      const idx = GRADES.indexOf(current as any)
      const nextGrade = idx >= GRADES.length - 1 ? '' : GRADES[idx + 1]
      const next = { ...prev }
      nextGrade ? (next[key] = nextGrade) : delete next[key]
      try { localStorage.setItem('backtest-grades', JSON.stringify(next)) } catch {}
      fetch('/api/backtest/rs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marks: [...routeStarts], grades: next }) }).catch(() => {})
      return next
    })
  }
  const T = useThemeColors(dark)

  // ── Persist state changes ──
  const saveLS = (key: string, val: any) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }
  useEffect(() => { saveLS('backtest-af', [...activeFilters]) }, [activeFilters])
  useEffect(() => { saveLS('backtest-vf', [...visibleFilters]) }, [visibleFilters])
  useEffect(() => { saveLS('backtest-hf', [...hideFilters]) }, [hideFilters])
  useEffect(() => { saveLS('backtest-vc', [...visibleColumns]) }, [visibleColumns])

  // ── Column resize ──
  const resizingRef = useRef<{ colId: string; startX: number; startW: number } | null>(null)
  const onResizeStart = (colId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const startW = colWidths[colId] || 38
    resizingRef.current = { colId, startX: e.clientX, startW }
    const onMove = (ev: MouseEvent) => {
      const ref = resizingRef.current
      if (!ref) return
      const dx = ev.clientX - ref.startX
      const newW = Math.max(24, ref.startW + dx)
      setColWidths(prev => prev ? { ...prev, [ref.colId]: newW } : { [ref.colId]: newW })
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizingRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  useEffect(() => { saveLS('backtest-cw', colWidths) }, [colWidths])

  // Resize handle component for th cells
  const ResizeHandle = ({ colId }: { colId: string }) => (
    <div
      onMouseDown={e => onResizeStart(colId, e)}
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', background: 'transparent', zIndex: 5 }}
      onMouseOver={e => (e.currentTarget.style.background = `${T.TEAL}40`)}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
    />
  )

  // ── Data column values ──
  const dataColumnResults = useMemo(() => {
    const results: Record<string, string[]> = {}
    DATA_COLUMNS.forEach(col => {
      results[col.key] = signals.map(s => {
        const ck = `${s.ticker}-${s.date}`
        if (col.needsBars === '15m') return col.compute(s, bars15mCache[ck])
        if (col.needsBars === '1m') return col.compute(s, undefined, bars1mCache[ck])
        if (col.needsBars === 'both') return col.compute(s, bars15mCache[ck], bars1mCache[ck])
        return col.compute(s)
      })
    })
    return results
  }, [signals, bars15mCache, bars1mCache])

  // ── Compute filter results for all signals (instant for daily, lazy for intraday) ──
  const filterResults = useMemo(() => {
    const results: Record<string, boolean[]> = {}
    FILTERS.forEach(f => {
      results[f.key] = signals.map((s, i) => {
        const cacheKey = `${s.ticker}-${s.date}`
        let result
        if (f.needsBars === '15m') result = f.compute(s, bars15mCache[cacheKey])
        else if (f.needsBars === '1m') result = f.compute(s, undefined, bars1mCache[cacheKey])
        else if (f.needsBars === 'both') result = f.compute(s, bars15mCache[cacheKey], bars1mCache[cacheKey])
        else result = f.compute(s)
        // Tier 2 override: tick data can override pushReal for suspicious signals
        if (f.key === 'pushReal' && tickResults[cacheKey] !== undefined) {
          result = tickResults[cacheKey]
        }
        return result
      })
    })
    return results
  }, [signals, bars15mCache, bars1mCache, tickResults])

  // ── Lazy-load 15m bars when any filter needs them ──
  useEffect(() => {
    const allKeys = new Set([...activeFilters, ...visibleFilters])
    const needs15m = Array.from(allKeys).some(k => {
      const f = FILTERS.find(x => x.key === k)
      return f?.needsBars === '15m' || f?.needsBars === 'both'
    }) || Array.from(visibleColumns).some(k => {
      const c = DATA_COLUMNS.find(x => x.key === k)
      return c?.needsBars === '15m' || c?.needsBars === 'both'
    })
    if (!needs15m || !signals.length) return
    const toFetch = signals.filter(s => !bars15mCache[`${s.ticker}-${s.date}`])
    if (toFetch.length === 0) return

    setBars15mLoading(true)
    const newCache: Record<string, any[]> = { ...bars15mCache }
    let fetched = 0
    const total = toFetch.length
    toFetch.forEach(s => {
      const date = s.date
      const fromDate = new Date(date + 'T12:00:00')
      fromDate.setDate(fromDate.getDate() - 25)
      const nextDay = new Date(date + 'T12:00:00'); nextDay.setDate(nextDay.getDate() + 1)
      const fromStr = fromDate.toISOString().slice(0, 10)
      const toStr = nextDay.toISOString().slice(0, 10)
      fetch(`/api/chart-data/bars?symbol=${encodeURIComponent(s.ticker)}&tf=15&from=${fromStr}&to=${toStr}`)
        .then(r => r.json())
        .then(data => {
          newCache[`${s.ticker}-${date}`] = data.bars || []
          fetched++
          if (fetched === total) { setBars15mCache(newCache); setBars15mLoading(false) }
        })
        .catch(() => {
          newCache[`${s.ticker}-${date}`] = []
          fetched++
          if (fetched === total) { setBars15mCache(newCache); setBars15mLoading(false) }
        })
    })
  }, [activeFilters, visibleFilters, signals])

  // ── Lazy-load 1m bars when REAL filter is visible/active ──
  useEffect(() => {
    const allKeys = new Set([...activeFilters, ...visibleFilters])
    const needs1m = Array.from(allKeys).some(k => {
      const f = FILTERS.find(x => x.key === k)
      return f?.needsBars === '1m' || f?.needsBars === 'both'
    }) || Array.from(visibleColumns).some(k => {
      const c = DATA_COLUMNS.find(x => x.key === k)
      return c?.needsBars === '1m' || c?.needsBars === 'both'
    })
    if (!needs1m || !signals.length) return
    const toFetch = signals.filter(s => !bars1mCache[`${s.ticker}-${s.date}`])
    if (toFetch.length === 0) return

    setBars1mLoading(true)
    const newCache: Record<string, any[]> = { ...bars1mCache }
    let fetched = 0
    const total = toFetch.length
    toFetch.forEach(s => {
      const date = s.date
      const nextDay = new Date(date + 'T12:00:00'); nextDay.setDate(nextDay.getDate() + 1)
      const toStr = nextDay.toISOString().slice(0, 10)
      fetch(`/api/chart-data/bars?symbol=${encodeURIComponent(s.ticker)}&tf=1&from=${date}&to=${toStr}`)
        .then(r => r.json())
        .then(data => {
          newCache[`${s.ticker}-${date}`] = data.bars || []
          fetched++
          if (fetched === total) { setBars1mCache(newCache); setBars1mLoading(false) }
        })
        .catch(() => {
          newCache[`${s.ticker}-${date}`] = []
          fetched++
          if (fetched === total) { setBars1mCache(newCache); setBars1mLoading(false) }
        })
    })
  }, [activeFilters, visibleFilters, signals])

  // ── Filtered signals (based on active filters) ──
  // ── Tier 2: Tick validation for suspicious signals ──
  // Only fetches tick data for signals where 1m analysis is in the suspicious zone
  useEffect(() => {
    if (!visibleFilters.has('pushReal') && !activeFilters.has('pushReal')) return
    if (Object.keys(bars1mCache).length === 0) return // wait for 1m bars to load first

    // Find signals where 1m result is suspicious (not clearly pass or clearly fail)
    const suspicious: number[] = []
    signals.forEach((s, i) => {
      const key = `${s.ticker}-${s.date}`
      if (tickResults[key] !== undefined) return // already validated
      const result = filterResults['pushReal']?.[i]
      if (result === undefined || result === null) return // no data yet
      // We want to validate the ones that PASSED 1m (they might be fake)
      // Skip the ones that already failed (they're already rejected)
      if (!result) return
      // Check if it's in the suspicious zone (close score 0.3-0.5, body 0.25-0.4)
      const bars1m = bars1mCache[key]
      const bars15m = bars15mCache[key]
      if (!bars1m || !bars15m) return
      const morning1m = morningBars(bars1m, s.date).sort((a: any, b: any) => a.time - b.time)
      if (morning1m.length < 5) return
      const morningHigh = Math.max(...morningBars(bars15m, s.date).map((b: any) => b.high))
      const tolerance = morningHigh * 0.002
      const barsAtPush = morning1m.filter((b: any) => b.high >= morningHigh - tolerance)
      if (barsAtPush.length === 0) return
      const avgClose = barsAtPush.reduce((sum: number, b: any) => {
        const range = b.high - b.low
        return sum + (range > 0 ? (b.close - b.low) / range : 0.5)
      }, 0) / barsAtPush.length
      const avgBody = barsAtPush.reduce((sum: number, b: any) => {
        const range = b.high - b.low
        return sum + (range > 0 ? Math.abs(b.close - b.open) / range : 0)
      }, 0) / barsAtPush.length
      const avgBarRange = morning1m.reduce((sum: number, b: any) => sum + (b.high - b.low), 0) / morning1m.length
      const maxPushRange = Math.max(...barsAtPush.map((b: any) => b.high - b.low))
      const rangeRatio = avgBarRange > 0 ? maxPushRange / avgBarRange : 1
      // Suspicious: passed 1m but has wide range bars at push, or marginal body
      if (rangeRatio >= 3 || avgBody < 0.4) suspicious.push(i)
    })

    if (suspicious.length === 0) return

    // Fetch tick data for suspicious signals
    const newResults = { ...tickResults }
    let pending = suspicious.length
    suspicious.forEach(i => {
      const s = signals[i]
      const key = `${s.ticker}-${s.date}`
      // Convert date to nanosecond timestamp range for the morning session
      // 7:30 ET = 12:30 UTC
      const dateObj = new Date(s.date + 'T12:30:00Z')
      const fromNs = dateObj.getTime() * 1_000_000
      dateObj.setUTCHours(17) // noon ET = 17:00 UTC
      const toNs = dateObj.getTime() * 1_000_000

      fetch(`/api/chart-data/trades?symbol=${encodeURIComponent(s.ticker)}&from=${fromNs}&to=${toNs}&limit=50000`)
        .then(r => r.json())
        .then(data => {
          const trades = data.trades || []
          if (trades.length === 0) {
            newResults[key] = false // no trades at all = fake
          } else {
            // Find push level again
            const bars15m = bars15mCache[key]
            const signalDate = key.substring(key.indexOf('-') + 1)
            const morningHigh = Math.max(...morningBars(bars15m, signalDate).map((b: any) => b.high))
            const pushTolerance = morningHigh * 0.002
            // Check: are there real trades near the push high?
            // Ignore trades with condition codes that indicate odd lots or out-of-sequence
            const realTradesAtPush = trades.filter((t: any) => {
              if (t.price < morningHigh - pushTolerance) return false
              // Filter out condition codes: @ = odd lot, I = odd lot, Z = out of sequence
              const conds = t.condition || []
              if (conds.includes('@') || conds.includes('I') || conds.includes('Z')) return false
              return t.size > 0 // must have actual shares
            })
            // Real if: at least 5 trades or 100 shares traded near the push high
            const totalShares = realTradesAtPush.reduce((sum: number, t: any) => sum + t.size, 0)
            newResults[key] = realTradesAtPush.length >= 5 || totalShares >= 100
          }
          pending--
          if (pending === 0) setTickResults(newResults)
        })
        .catch(() => {
          newResults[key] = true // on error, trust the 1m result
          pending--
          if (pending === 0) setTickResults(newResults)
        })
    })
  }, [filterResults, bars1mCache, bars15mCache, visibleFilters, activeFilters, signals])

  const filteredSignals = useMemo(() => {
    if (activeFilters.size === 0 && hideFilters.size === 0 && !gradeFilter && !tagMatchKeys) return signals
    let result = signals
    // Tag filter (organization)
    if (tagMatchKeys) result = result.filter(s => tagMatchKeys.has(`${s.ticker}|${s.date}`))
    // Grade filter
    if (gradeFilter) result = result.filter(s => grades[`${s.ticker}-${s.date}`] === gradeFilter)
    if (activeFilters.size === 0 && hideFilters.size === 0) return result
    // Filter by grade, then by active/hide filters
    return result.filter((s, i) => {
      // Find original index in signals array for filterResults lookup
      const origIdx = signals.indexOf(s)
      // Check active filters (dim mode)
      for (const key of activeFilters) {
        if (!filterResults[key]?.[origIdx]) return false
      }
      // Check hide filters (remove from table + stats)
      for (const key of hideFilters) {
        if (!filterResults[key]?.[origIdx]) return false
      }
      return true
    })
  }, [signals, activeFilters, hideFilters, filterResults, gradeFilter, grades])

  // ── Filter counts (for toggle badges) ──
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    FILTERS.forEach(f => {
      counts[f.key] = filterResults[f.key]?.filter(Boolean).length || 0
    })
    return counts
  }, [filterResults])

  // ── Baseline backtest: buy D0 open, sell D0 close ──
  const runBaselineBacktest = useCallback((sigs?: Signal[]) => {
    const source = sigs || filteredSignals
    if (!source.length) return
    const trades = source.map(s => {
      const pnlPct = ((s.close - s.open) / s.open) * 100
      const range = s.high - s.low
      const stop = s.low
      const risk = s.open - stop
      const rMultiple = risk > 0 ? (s.close - s.open) / risk : 0
      return { pnlPct, rMultiple, win: pnlPct > 0, date: s.date }
    })
    const returns = trades.map(t => t.pnlPct)
    const wins = trades.filter(t => t.win)
    const losses = trades.filter(t => !t.win)
    const grossWin = wins.reduce((a, t) => a + t.pnlPct, 0)
    const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlPct, 0))
    const winRate = (wins.length / trades.length) * 100
    const pctProfitable = winRate
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0
    const rMultiples = trades.map(t => t.rMultiple)
    const avgRMultiple = rMultiples.reduce((a, r) => a + r, 0) / rMultiples.length
    const sortedR = [...rMultiples].sort((a, b) => a - b)
    const medianR = sortedR.length % 2 === 0 ? (sortedR[sortedR.length / 2 - 1] + sortedR[sortedR.length / 2]) / 2 : sortedR[Math.floor(sortedR.length / 2)]
    const avgWinPct = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0
    const avgLossPct = losses.length > 0 ? losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length : 0
    const expectancyPct = (winRate / 100) * avgWinPct + ((100 - winRate) / 100) * avgLossPct
    const wlRatio = losses.length > 0 && avgLossPct !== 0 ? Math.abs(avgWinPct / avgLossPct) : 0

    // ── Notional capital model (REQ-321): map each baseline signal onto a
    //    $100-risk trade on a $10k account. R = (close−open)/(open−low); the
    //    raw % move stays as `returns` for the return-distribution visuals. ──
    const tradingDays = new Set(source.map(s => s.date)).size
    const years = tradingDays / 252
    const pnlDollars = trades.map(t => t.rMultiple * 100)   // $100 risk per signal
    const nm = btNotionalStats({ pnlDollars, years })
    let curDdDur = 0, maxDdDur = 0
    nm.drawdownSeries.forEach(dd => { if (dd > 0) { curDdDur++; maxDdDur = Math.max(maxDdDur, curDdDur) } else curDdDur = 0 })

    // Consecutive wins/losses
    let cWins = 0, cLosses = 0, maxCWins = 0, maxCLosses = 0
    trades.forEach(t => {
      if (t.win) { cWins++; cLosses = 0; maxCWins = Math.max(maxCWins, cWins) }
      else { cLosses++; cWins = 0; maxCLosses = Math.max(maxCLosses, cLosses) }
    })

    const bestTrade = Math.max(...returns)
    const worstTrade = Math.min(...returns)

    // Day-by-day breakdown (R / $ / g / N ready; full date key)
    const byDate: Record<string, { r: number; pnl: number; count: number; wins: number }> = {}
    source.forEach((s, i) => {
      const e = byDate[s.date] || (byDate[s.date] = { r: 0, pnl: 0, count: 0, wins: 0 })
      e.r += trades[i].rMultiple; e.pnl += trades[i].rMultiple * 100; e.count++
      if (trades[i].rMultiple > 0) e.wins++
    })
    const dayStats = Object.entries(byDate).sort(([a], [b]) => a < b ? -1 : 1).map(([date, e]) => ({ date, day: date.slice(5), r: e.r, pnl: e.pnl, count: e.count, wins: e.wins }))

    // Monthly breakdown
    const byMonth: Record<string, { pnls: number[] }> = {}
    source.forEach((s, i) => {
      const month = s.date.slice(0, 7)
      if (!byMonth[month]) byMonth[month] = { pnls: [] }
      byMonth[month].pnls.push(trades[i].pnlPct)
    })
    const monthlyStats = Object.entries(byMonth).map(([month, d]) => ({
      month, pnl: d.pnls.reduce((a, b) => a + b, 0), count: d.pnls.length,
    }))

    setBacktestResults({
      entryType: 'D0 Open', exitType: 'D0 Close', totalTrades: trades.length,
      winRate, pctProfitable, profitFactor, sharpe: nm.sharpe, sortino: nm.sortino, calmar: nm.calmar,
      maxDrawdown: nm.maxDrawdown, maxDDDuration: maxDdDur, avgRMultiple, medianR,
      avgWinPct, avgLossPct, expectancy: expectancyPct, expectancyPct,
      wlRatio, totalPnl: nm.totalPnl, totalReturnPct: nm.totalReturnPct, cagr: nm.cagr,
      avgTradeDuration: '1 day', maxConsecWins: maxCWins, maxConsecLosses: maxCLosses,
      bestTrade, worstTrade, stdDevReturns: nm.stdDevReturns, downsideDev: nm.downsideDev, recoveryFactor: nm.recoveryFactor,
      grossWin, grossLoss,
      tradeReturns: returns, cumPnlSeries: nm.cumPnlSeries, drawdownSeries: nm.drawdownSeries,
      dayStats, monthlyStats,
    })
  }, [signals])


  // Auto-run baseline when signals load
  useEffect(() => {
    if (signals.length > 0 && !backtestResults && !selectedBtRun) runBaselineBacktest()
  }, [signals])

  // Re-run baseline when filters change (only when viewing a scan, not a backtest run)
  useEffect(() => {
    if (selectedBtRun || filteredSignals.length === 0) return
    runBaselineBacktest(filteredSignals)
  }, [activeFilters])

  // Load the list of backtest runs on mount (peers to scans)
  useEffect(() => {
    fetch('/api/backtest/runs').then(r => r.json()).then(d => setBtRuns(d.runs || [])).catch(() => {})
  }, [])

  // Selecting a backtest run loads its trades into the rows + populates stats
  const selectBacktestRun = useCallback(async (id: string | null) => {
    setSelectedBtRun(id)
    if (!id) { setBtTrades([]); return }
    try {
      const r = await fetch(`/api/backtest/runs?id=${id}`)
      const d = await r.json()
      const trs = d.trades || []
      setBtTrades(trs)
      setSelectedTradeIdx(trs.length ? trs.length - 1 : 0)
      if (d.meta?.tf) setTf(d.meta.tf as Timeframe)
      // populate the SAME BacktestResults shape from the run's trades
      const trades = (d.trades || []) as { r: number; pnl: number; side: string; exitLabel: string }[]
      const returns = trades.map((t: any) => t.r)
      const pnlDollars = (d.trades || []).map((t: any) => Number(t.pnl) || 0)   // real $ P&L per trade
      const wins = trades.filter((t: any) => t.r > 0), losses = trades.filter((t: any) => t.r < 0)
      const totR = returns.reduce((a: number, b: number) => a + b, 0)
      const grossWin = wins.reduce((a: number, t: any) => a + t.r, 0)
      const grossLoss = Math.abs(losses.reduce((a: number, t: any) => a + t.r, 0))
      const winRate = trades.length ? (100 * wins.length) / trades.length : 0
      const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0
      const avgR = returns.length ? totR / returns.length : 0
      const avgWinR = wins.length ? wins.reduce((a: number, t: any) => a + t.r, 0) / wins.length : 0
      const avgLossR = losses.length ? losses.reduce((a: number, t: any) => a + t.r, 0) / losses.length : 0
      const sortedR = [...returns].sort((a: number, b: number) => a - b)
      const medianR = sortedR.length ? (sortedR.length % 2 ? sortedR[(sortedR.length - 1) / 2] : (sortedR[sortedR.length / 2 - 1] + sortedR[sortedR.length / 2]) / 2) : 0
      // ── Notional capital model (REQ-321): $ / % / CAGR from real $ pnl ──
      const meta = d.meta || {}
      const fromMs = meta.from ? new Date(meta.from + 'T12:00:00Z').getTime() : NaN
      const toMs = meta.to ? new Date(meta.to + 'T12:00:00Z').getTime() : NaN
      const years = (fromMs && toMs && toMs > fromMs)
        ? (toMs - fromMs) / (365.25 * 24 * 3600 * 1000)
        : (new Set((d.trades || []).map((t: any) => (t.openDate || t.rsDate || '').slice(0, 10))).size || 1) / 252
      const nm = btNotionalStats({ pnlDollars, years })
      // DD duration (in trades) on the $ drawdown series
      let curDdDur = 0, maxDdDur = 0
      nm.drawdownSeries.forEach(dd => { if (dd > 0) { curDdDur++; maxDdDur = Math.max(maxDdDur, curDdDur) } else curDdDur = 0 })
      // win/loss streaks
      let cw = 0, cl = 0, maxCW = 0, maxCL = 0
      returns.forEach(rv => { if (rv > 0) { cw++; cl = 0; maxCW = Math.max(maxCW, cw) } else { cl++; cw = 0; maxCL = Math.max(maxCL, cl) } })
      // per-day series — FULL date key (fixes the old MM-DD year collision on multi-year runs)
      const byDate: Record<string, { r: number; pnl: number; count: number; wins: number }> = {}
      const byMonth: Record<string, number[]> = {}
      ;(d.trades || []).forEach((t: any, i: number) => {
        const full = (t.openDate || t.rsDate || '').slice(0, 10)
        if (full) { const e = byDate[full] || (byDate[full] = { r: 0, pnl: 0, count: 0, wins: 0 }); e.r += returns[i]; e.pnl += pnlDollars[i]; e.count++; if (returns[i] > 0) e.wins++ }
        const mo = full.slice(0, 7); if (mo) (byMonth[mo] = byMonth[mo] || []).push(returns[i])
      })
      const dayStats = Object.entries(byDate).sort(([a], [b]) => a < b ? -1 : 1).map(([date, e]) => ({ date, day: date.slice(5), r: e.r, pnl: e.pnl, count: e.count, wins: e.wins }))
      const monthlyStats = Object.entries(byMonth).sort(([a], [b]) => a < b ? -1 : 1).map(([month, rs]) => ({ month, pnl: rs.reduce((a, b) => a + b, 0), count: rs.length }))
      setBacktestResults({
        entryType: d.meta ? `${d.meta.engine || 'engine'}` : 'engine', exitType: 'see trade reason',
        totalTrades: trades.length, winRate, pctProfitable: winRate, profitFactor,
        sharpe: nm.sharpe, sortino: nm.sortino, calmar: nm.calmar,
        maxDrawdown: nm.maxDrawdown, maxDDDuration: maxDdDur, avgRMultiple: avgR, medianR, avgWinPct: avgWinR, avgLossPct: avgLossR,
        expectancy: avgR, expectancyPct: avgR, wlRatio: avgLossR ? Math.abs(avgWinR / avgLossR) : 0,
        totalPnl: nm.totalPnl, totalReturnPct: nm.totalReturnPct, cagr: nm.cagr, avgTradeDuration: '—',
        maxConsecWins: maxCW, maxConsecLosses: maxCL, bestTrade: returns.length ? Math.max(...returns) : 0,
        worstTrade: returns.length ? Math.min(...returns) : 0, stdDevReturns: nm.stdDevReturns, downsideDev: nm.downsideDev,
        recoveryFactor: nm.recoveryFactor, grossWin, grossLoss, tradeReturns: returns, cumPnlSeries: nm.cumPnlSeries, drawdownSeries: nm.drawdownSeries,
        dayStats, monthlyStats,
      })
    } catch {}
  }, [])

  // Keep ALL scans; tree dedupes per strategy, runs panel shows every run for the selected strategy
  useEffect(() => {
    fetch('/api/scans')
      .then(r => r.json())
      .then(data => {
        const all = ((data.scans || []) as ScanDef[])
          .filter(s => s.resultCount > 0)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setScans(all)
        // Auto-select the most recent D1 Gap run (Mike's primary scan)
        const d1 = all.find(s => s.strategy === 'd1-gap') || all[0]
        if (d1) setSelectedScan(d1.id)
      })
  }, [])

  useEffect(() => {
    if (!selectedScan) return
    setLoading(true)
    fetch(`/api/scans/${selectedScan}`)
      .then(r => r.json())
      .then(data => {
        const sigs = data.results || []
        setSignals(sigs); setSelectedIdx(0); setDayOffset(0); setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedScan])

  // Group every DB scan by strategy → for the tree (dedupe) + runs panel (all runs)
  const byStrategy = useMemo(() => {
    const m: Record<string, ScanDef[]> = {}
    for (const s of scans) { const k = s.strategy || s.name; (m[k] = m[k] || []).push(s) }
    return m
  }, [scans])
  // One representative per strategy (best resultCount) for the tree leaves
  const treeScans = useMemo(
    () => Object.values(byStrategy).map(arr =>
      arr.reduce((best, s) => s.resultCount > best.resultCount ? s : best, arr[0])),
    [byStrategy]
  )
  const activeStrategy = scans.find(s => s.id === selectedScan)?.strategy || ''
  // Runs for the selected strategy, most recent first
  const activeRuns: ScanDef[] = (byStrategy[activeStrategy] || []).slice()

  const sig = signals[selectedIdx] as Signal | undefined
  const activeScan = scans.find(s => s.id === selectedScan)
  // When a backtest run is selected, the center chart shows the run's instrument + tf (15m default for Mike's Bands)
  const selectedBtRunObj = selectedBtRun ? btRuns.find(r => r.id === selectedBtRun) : null
  const chartSymbol = (selectedBtRun && btTrades[selectedTradeIdx]?.ticker) || (selectedBtRunObj?.meta?.symbol as string) || sig?.ticker || 'SPY'
  const chartTf = tf
  const chartDate = selectedBtRunObj ? (selectedBtRunObj.meta?.intraday
    ? (btTrades[selectedTradeIdx]?.openDate?.slice(0, 10) || btTrades[selectedTradeIdx]?.rsDate || btTrades[0]?.openDate?.slice(0, 10) || (selectedBtRunObj.meta?.from as string))
    : (btTrades[selectedTradeIdx]?.rsDate || btTrades[selectedTradeIdx]?.openDate?.slice(0, 10) || btTrades[0]?.openDate?.slice(0, 10) || (selectedBtRunObj.meta?.from as string))) : sig?.date
  // Entry + exit wedges for the selected backtest run.
  // Convention: green ▲ = BUY action (long entry / short cover); red ▼ = SELL action (short entry / long exit).
  const btMarkers = useMemo(() => {
    if (!selectedBtRun || !btTrades.length) return []
    const selTicker = btTrades[selectedTradeIdx]?.ticker
    const out: { time: number; price: number; kind: 'buy' | 'sell'; selected: boolean }[] = []
    for (let i = 0; i < btTrades.length; i++) {
      const t = btTrades[i]
      if (selTicker && t.ticker && t.ticker !== selTicker) continue
      const sel = i === selectedTradeIdx
      out.push({ time: etWallToUnix(t.openDate), price: t.entry, kind: t.side === 'long' ? 'buy' : 'sell', selected: sel })
      const etT = etWallToUnix(t.exitDate)
      if (!isNaN(etT)) out.push({ time: etT, price: t.exit, kind: t.side === 'long' ? 'sell' : 'buy', selected: sel })
    }
    return out
  }, [selectedBtRun, btTrades, selectedTradeIdx])

  // Backside-pop (and any push_time-emitting scan) pop markers for the current ticker.
  // Green ▲ at the pop high; the renderer snaps it to the timeframe bar. '1H is trend,
  // 15m for pushes' — on the hourly these arrows mark where the backside pop fired.
  const signalMarkers = useMemo(() => {
    if (!signals.length || !chartSymbol) return []
    const out: { time: number; price: number; kind: 'buy'; selected: boolean }[] = []
    for (const s of signals) {
      if (s.ticker !== chartSymbol || !s.push_time) continue
      const t = etWallToUnix(`${s.date} ${s.push_time}`)
      if (isNaN(t) || s.high == null) continue
      out.push({ time: t, price: s.high, kind: 'buy', selected: s.date === sig?.date })
    }
    return out
  }, [signals, chartSymbol, sig])
  const chartMarkers = useMemo(() => [...btMarkers, ...signalMarkers], [btMarkers, signalMarkers])

  // For multi-ticker bt runs (e.g. R/S Pump), show a wide forward window from the
  // R/S date so the full post-split landscape is visible — the pump we're hunting
  // can come weeks after the split. Minimum 60 calendar days; extend further if a
  // trade is still open past that.
  const btDayOffset = useMemo(() => {
    if (!selectedBtRun || !btTrades.length || !btTrades[selectedTradeIdx]) return 0
    const t = btTrades[selectedTradeIdx]
    if (!t.ticker || !t.rsDate) return 0
    const tickerTrades = btTrades.filter((tr: any) => tr.ticker === t.ticker)
    const maxExit = tickerTrades.reduce((mx: string, tr: any) => (tr.exitDate > mx ? tr.exitDate : mx), '')
    const splitMs = new Date(t.rsDate + 'T12:00:00').getTime()
    const exitDays = maxExit ? Math.ceil((new Date(maxExit.slice(0, 10) + 'T12:00:00').getTime() - splitMs) / 86400000) : 0
    // Intraday runs (e.g. G&C gap-entry): D0 IS the trade day — keep it at the right
    // edge, no 60-day forward window (that floor is for R/S-pump swing runs where the
    // pump can land weeks after the split).
    if (selectedBtRunObj?.meta?.intraday) return Math.max(0, exitDays)
    return Math.max(60, exitDays + 5)
  }, [selectedBtRun, btTrades, selectedTradeIdx, selectedBtRunObj])

 // Reset day offset when signal changes
 // (also done inline in every setSelectedIdx call)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!signals.length) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); setDayOffset(d => Math.max(0, d - 1)) }
      if (e.key === 'ArrowRight') { e.preventDefault(); setDayOffset(d => d + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(Math.max(0, selectedIdx - 1)); setDayOffset(0) }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(Math.min(signals.length - 1, selectedIdx + 1)); setDayOffset(0) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIdx, signals.length])

  // ── Panel resize ──
  const panelResizingRef = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null)
  const onResizeDown = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault()
    panelResizingRef.current = { side, startX: e.clientX, startW: side === 'left' ? leftW : rightW }
    const onMove = (ev: MouseEvent) => {
      if (!panelResizingRef.current) return
      const dx = ev.clientX - panelResizingRef.current.startX
      if (panelResizingRef.current.side === 'left') {
        setLeftW(Math.max(LEFT_W_MIN, Math.min(LEFT_W_MAX, panelResizingRef.current.startW + dx)))
      } else {
        setRightW(Math.max(RIGHT_W_MIN, Math.min(RIGHT_W_MAX, panelResizingRef.current.startW - dx)))
      }
    }
    const onUp = () => { panelResizingRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ─── Left Sidebar: Scans (top) + Runs (bottom) ────
  const renderLeftSidebar = () => (
    <div style={{
      width: leftW, minWidth: leftW, maxWidth: leftW,
      background: T.SURFACE, borderRight: `1px solid ${T.BORDER}`,
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      {/* ── Top half: Scan tree ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: `1px solid ${T.BORDER}` }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: T.GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Scans</span>
            <span style={{ color: T.MUTED, fontSize: 9 }}>{scans.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {(() => {
            // Build nested tree from SCAN_TREE (dedupe by strategy, assign folder by strategy)
            const grouped: Record<string, ScanDef[]> = {}
            const ungrouped: ScanDef[] = []
            treeScans.forEach(scan => {
              const g = folderForStrategy(scan.strategy || scan.name)
              if (g && g.includes('/')) {
                (grouped[g] = grouped[g] || []).push(scan)
              } else {
                const top = SCAN_TREE.find(f => f.id === g)
                if (top && !top.subfolders) (grouped[g] = grouped[g] || []).push(scan)
                else ungrouped.push(scan)
              }
            })
            return <>
              {SCAN_TREE.map(project => {
                if (project.subfolders) {
                  const hasContent = project.subfolders.some(sf => (grouped[`${project.id}/${sf.id}`] || []).length > 0)
                  if (!hasContent) return null
                  return <NestedFolderGroup key={project.id} label={project.label} subfolders={project.subfolders} grouped={grouped} projectId={project.id} selectedScan={selectedScan} onSelect={setSelectedScan} />
                }
                const items = grouped[project.id] || []
                if (items.length === 0) return null
                return <FolderGroup key={project.id} label={project.label} items={items} selectedScan={selectedScan} onSelect={setSelectedScan} />
              })}
              {ungrouped.length > 0 && <FolderGroup label="Other" items={ungrouped} selectedScan={selectedScan} onSelect={setSelectedScan} />}
            </>
          })()}
          {/* ── Backtest runs (peers to scans; selecting one loads its trades into the rows + stats) ── */}
          <div style={{ borderTop: `1px solid ${T.BORDER}`, marginTop: 2 }}>
            <div style={{ padding: '7px 10px', borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity className="h-3 w-3" style={{ color: T.TEAL }} />
              <span style={{ color: T.TEAL, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Backtest</span>
              <span style={{ marginLeft: 'auto', fontSize: 8, color: T.MUTED }}>{btRuns.length} runs</span>
            </div>
            {btRuns.length === 0 && <div style={{ padding: '6px 10px 6px 22px', fontSize: 9, color: T.MUTED }}>No saved runs</div>}
            {btRuns.map(run => {
              const isActive = selectedBtRun === run.id
              const s = run.summary || {}
              return (
                <div key={run.id}>
                <button onClick={() => selectBacktestRun(isActive ? null : run.id)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 10px 6px 22px', border: 'none', cursor: 'pointer',
                  background: isActive ? `${T.TEAL}18` : 'transparent',
                  borderLeft: isActive ? `2px solid ${T.TEAL}` : '2px solid transparent',
                  borderBottom: `1px solid ${T.BORDER}`,
                }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ color: isActive ? T.TEAL : T.TEXT, fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{run.name}</div>
                  <div style={{ fontSize: 8, color: T.MUTED, display: 'flex', gap: 8 }}>
                    <span>{s.trades ?? 0} trades</span>
                    <span style={{ color: (s.totR ?? 0) >= 0 ? T.TEAL : T.RED }}>{(s.totR ?? 0) >= 0 ? '+' : ''}{(s.totR ?? 0).toFixed(1)}R</span>
                    <span>{(s.winRate ?? 0).toFixed(0)}% win</span>
                    {(s.greenPct ?? null) != null && <span style={{ color: (s.greenPct ?? 0) >= 60 ? T.TEAL : T.MUTED }}>{(s.greenPct ?? 0).toFixed(0)}% green</span>}
                  </div>
                </button>
                {isActive && (
                  <a href={`/backtest/run/${run.id}`} style={{ display: 'block', padding: '4px 10px 4px 22px', fontSize: 9, fontWeight: 700, color: T.GOLD || '#D4AF37', background: 'rgba(212,175,55,0.06)', borderBottom: `1px solid ${T.BORDER}`, textDecoration: 'none' }}>
                    → full detail · calendar · day stats
                  </a>
                )}
                </div>
              )
            })}
          </div>

          {scans.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <Search className="h-5 w-5 mx-auto mb-2" style={{ color: T.MUTED, opacity: 0.3 }} />
              <p style={{ color: T.MUTED, fontSize: 10 }}>No saved scans</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom half: Saved Runs (all DB runs for the selected strategy) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: selectedBtRun ? T.TEAL : T.GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{selectedBtRun ? 'Backtest Run' : 'Runs'}</span>
            <span style={{ color: T.MUTED, fontSize: 9 }}>{selectedBtRun ? btTrades.length : activeRuns.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selectedBtRun ? (
            <div style={{ padding: '8px 10px' }}>
              <div style={{ color: T.TEAL, fontSize: 10, fontWeight: 700 }}>{selectedBtRunObj?.name || 'Backtest'}</div>
              <div style={{ fontSize: 8, color: T.MUTED, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{selectedBtRunObj?.summary?.trades ?? btTrades.length} trades</span>
                <span style={{ color: (selectedBtRunObj?.summary?.totR ?? 0) >= 0 ? T.TEAL : T.RED }}>{(selectedBtRunObj?.summary?.totR ?? 0) >= 0 ? '+' : ''}{(selectedBtRunObj?.summary?.totR ?? 0).toFixed(1)}R</span>
                <span>{(selectedBtRunObj?.summary?.winRate ?? 0).toFixed(0)}% win</span>
                <span style={{ color: T.MUTED }}>{selectedBtRunObj?.meta?.symbol} {selectedBtRunObj?.meta?.tf}m</span>
              </div>
              <div style={{ marginTop: 8, padding: '6px 8px', background: T.SURFACE2, borderRadius: 3, fontSize: 8, color: T.MUTED, lineHeight: 1.5 }}>
                <div>Trade {Math.min(selectedTradeIdx + 1, btTrades.length)} / {btTrades.length} selected</div>
                <div style={{ opacity: 0.7 }}>Click any row on the right to step through trades →</div>
              </div>
            </div>
          ) : (
          <>{activeRuns.map(run => {
            const isActive = run.id === selectedScan
            return (
            <div key={run.id} onClick={() => setSelectedScan(run.id)} style={{
              padding: '6px 10px', borderBottom: `1px solid ${T.BORDER}`, cursor: 'pointer',
              background: isActive ? T.GOLD_DIM : 'transparent',
              borderLeft: isActive ? `2px solid ${T.GOLD}` : '2px solid transparent',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: isActive ? T.GOLD : T.TEXT2, fontSize: 10, fontWeight: 600 }}>{run.name}</span>
                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${T.TEAL}20`, color: T.TEAL }}>{run.resultCount}</span>
              </div>
              <div style={{ color: isActive ? T.GOLD : T.MUTED, fontSize: 8, marginTop: 2 }}>{new Date(run.createdAt).toLocaleDateString()}</div>
            </div>
            )
          })}
          {activeRuns.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: T.MUTED, fontSize: 9 }}>Select a scan to see runs</div>
          )}
          </>)}
        </div>
      </div>

      {/* New Scan button */}
      <div style={{ padding: 6, borderTop: `1px solid ${T.BORDER}` }}>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          width: '100%', padding: '6px', borderRadius: 4,
          background: T.GOLD_DIM, color: T.GOLD, fontWeight: 600, fontSize: 10,
          border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
        }}>
          <Plus className="h-3 w-3" /> New Scan
        </button>
      </div>
    </div>
  )

  // ─── Right Sidebar: Signals only ─────────────────
  // ── Visible filter columns (separate from active filter toggles) ──
  const renderRightSidebar = () => {
    const activeFilterDefs = FILTERS.filter(f => visibleFilters.has(f.key))
    return (
    <div style={{
      width: rightW, minWidth: rightW, maxWidth: rightW,
      background: T.SURFACE, borderLeft: `1px solid ${T.BORDER}`,
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {sig && (
          <AnnotationBar scanId={selectedScan} strategy={activeStrategy} ticker={sig.ticker} date={sig.date} dark={dark} T={T} onChanged={refreshAnnotations} />
        )}
        {Object.keys(tagCounts).length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: '5px 8px', borderBottom: `1px solid ${T.BORDER}`, background: dark ? 'rgba(212,175,55,0.03)' : 'rgba(212,175,55,0.05)' }}>
            <span style={{ color: T.GOLD, fontSize: 8, fontWeight: 800, letterSpacing: 0.5, marginRight: 2 }}>TAGS</span>
            {Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => {
              const active = tagFilter === t
              const tc = /HELD|LONG/i.test(t) ? T.TEAL : /CRAP|FAIL|SHORT/i.test(t) ? T.RED : /WATCH/i.test(t) ? T.GOLD : T.TEXT2
              return <button key={t} onClick={() => setTagFilter(active ? '' : t)} title={`filter signals tagged ${t}`}
                style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, cursor: 'pointer',
                  border: `1px solid ${active ? tc : T.BORDER}`, background: active ? tc : 'transparent',
                  color: active ? '#000' : tc, opacity: active ? 1 : 0.7 }}>
                {t} <span style={{ opacity: 0.7 }}>{n}</span>
              </button>
            })}
            {tagFilter && <button onClick={() => setTagFilter('')} style={{ fontSize: 8, color: T.MUTED, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 2 }}>✕ clear</button>}
          </div>
        )}
        {/* ── Signal Header + Filter Button ── */}
        <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <span style={{ color: T.GOLD, fontSize: 10, fontWeight: 700 }}>SIGNALS</span>
          <div className="flex items-center gap-2">
            <span style={{ color: T.MUTED, fontSize: 9 }}>{filteredSignals.length}/{signals.length}</span>
            {/* Grade filter */}
            <div style={{ display: 'flex', gap: 1 }}>
              {['All', 'A+', 'A', 'B', 'C'].map(g => {
                const active = gradeFilter === (g === 'All' ? '' : g)
                const gc = g === 'A+' ? T.TEAL : g === 'A' ? '#6ee7b7' : g === 'B' ? T.GOLD : g === 'C' ? T.RED : T.MUTED
                return <button key={g} onClick={() => setGradeFilter(g === 'All' ? '' : g)} style={{
                  padding: '1px 4px', borderRadius: 2, fontSize: 8, fontWeight: 700, cursor: 'pointer',
                  border: `1px solid ${active ? gc : T.BORDER}`,
                  background: active ? gc : 'transparent',
                  color: active ? '#000' : gc,
                  opacity: active ? 1 : 0.4,
                }}>{g}</button>
              })}
            </div>
            {/* Add Column dropdown */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowColumnMenu(!showColumnMenu); setShowFilterMenu(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                background: showColumnMenu ? T.GOLD : T.SURFACE,
                color: showColumnMenu ? '#000' : T.MUTED,
                border: `1px solid ${showColumnMenu ? T.GOLD : T.BORDER}`,
                cursor: 'pointer',
              }}>
                <Columns3 className="h-3 w-3" />+ Col
              </button>
              {showColumnMenu && <div onClick={() => setShowColumnMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
              {showColumnMenu && (() => {
                return (
                <div style={{
                  position: 'fixed', right: 100, top: 48, zIndex: 100,
                  width: 260, background: T.SURFACE, border: `1px solid ${T.BORDER}`,
                  borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  maxHeight: 320, overflowY: 'auto',
                }}>
                  <div style={{ padding: '6px 8px', borderBottom: `1px solid ${T.BORDER}` }}>
                    <span style={{ color: T.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Data Columns</span>
                  </div>
                  {DATA_COLUMNS.map(col => {
                    const vis = visibleColumns.has(col.key)
                    return (
                      <button key={col.key} onClick={() => {
                        const next = new Set(visibleColumns)
                        vis ? next.delete(col.key) : next.add(col.key)
                        setVisibleColumns(next)
                        setShowColumnMenu(false)
                      }} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '6px 10px', border: 'none', cursor: 'pointer',
                        background: vis ? `${T.GOLD}15` : 'transparent',
                        borderBottom: `1px solid ${T.BORDER}`, textAlign: 'left',
                      }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${vis ? T.GOLD : T.BORDER}`, background: vis ? T.GOLD : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {vis && <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>\u2713</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: vis ? T.TEXT : T.MUTED, fontSize: 10, fontWeight: 600 }}>{col.shortLabel} \u2014 {col.label}</div>
                          <div style={{ color: T.MUTED, fontSize: 8 }}>{col.description}</div>
                        </div>
                      </button>
                    )
                  })}
                  <div style={{ padding: '6px 8px', color: T.MUTED, fontSize: 7, borderTop: `1px solid ${T.BORDER}` }}>Click column header to remove</div>
                </div>
                )
              })()}
            </div>
            {/* Add Filter dropdown */}
            <div style={{ position: 'relative' }}>
              <button data-filter-btn onClick={() => { setShowFilterMenu(!showFilterMenu); setShowColumnMenu(false) }} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                background: showFilterMenu ? T.TEAL : T.SURFACE,
                color: showFilterMenu ? '#000' : T.MUTED,
                border: `1px solid ${showFilterMenu ? T.TEAL : T.BORDER}`,
                cursor: 'pointer',
              }}>
                <Settings2 className="h-3 w-3" />+ Filter
              </button>
              {/* Click-away backdrop */}
              {showFilterMenu && <div onClick={() => setShowFilterMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
              {/* Dropdown — fixed position to escape overflow clipping */}
              {showFilterMenu && (() => {
                const btn = document.querySelector('[data-filter-btn]') as HTMLElement
                const rect = btn?.getBoundingClientRect()
                return (
                <div style={{
                  position: 'fixed', right: 8, top: (rect?.bottom || 60) + 2, zIndex: 100,
                  width: 280, background: T.SURFACE, border: `1px solid ${T.BORDER}`,
                  borderRadius: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  maxHeight: 400, overflowY: 'auto',
                }}>
                  <div style={{ padding: '6px 8px', borderBottom: `1px solid ${T.BORDER}` }}>
                    <span style={{ color: T.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Add Filter Columns</span>
                  </div>
                  {FILTERS.map(f => {
                    const visible = visibleFilters.has(f.key)
                    const count = filterCounts[f.key] || 0
                    const isLoading = visible && ((f.needsBars === '15m' || f.needsBars === 'both') && bars15mLoading || (f.needsBars === '1m' || f.needsBars === 'both') && bars1mLoading)
                    return (
                      <button key={f.key} onClick={() => {
                        const next = new Set(visibleFilters)
                        visible ? next.delete(f.key) : next.add(f.key)
                        setVisibleFilters(next)
                        if (visible) {
                          const nextActive = new Set(activeFilters)
                          nextActive.delete(f.key)
                          setActiveFilters(nextActive)
                        }
                        setShowFilterMenu(false)
                      }} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '6px 10px', border: 'none', cursor: 'pointer',
                        background: visible ? `${T.TEAL}15` : 'transparent',
                        borderBottom: `1px solid ${T.BORDER}`,
                        textAlign: 'left',
                      }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${visible ? T.TEAL : T.BORDER}`, background: visible ? T.TEAL : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {visible && <span style={{ color: '#000', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: visible ? T.TEXT : T.MUTED, fontSize: 10, fontWeight: 600 }}>{f.shortLabel} — {f.label}</div>
                          <div style={{ color: T.MUTED, fontSize: 8 }}>{f.description}</div>
                        </div>
                        <span style={{ color: isLoading ? '#f59e0b' : T.MUTED, fontSize: 8, fontWeight: 600 }}>{isLoading ? '⏳' : `${count}/${signals.length}`}</span>
                      </button>
                    )
                  })}
                  <div style={{ padding: '6px 8px', color: T.MUTED, fontSize: 7, borderTop: `1px solid ${T.BORDER}` }}>{'Column header: show \u2192 filter \u2192 remove'}</div>
                </div>
                )
              })()}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {selectedBtRun ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ background: T.SURFACE2, position: 'sticky', top: 0, zIndex: 2 }}>
                  {['OPEN', 'S', 'TKR', selectedBtRunObj?.meta?.intraday ? 'D0' : 'R/S', 'ENTRY', 'STOP', 'EXIT', 'R', '$PNL', 'REASON'].map(h => (
                    <th key={h} style={{ padding: '4px 6px', textAlign: (h === 'OPEN' || h === 'TKR' || h === 'D0' || h === 'R/S') ? 'left' : 'right', color: T.GOLD, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', borderLeft: `1px solid ${T.BORDER}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {btTrades.slice().reverse().map((t, i) => {
                  const realIdx = btTrades.length - 1 - i
                  const isTA = realIdx === selectedTradeIdx
                  const EC: Record<string,string> = { EXTREME: T.TEAL, REVERSION: T.TEAL, CYCLE: T.MUTED, STOP: T.RED, 'OPEN@END': T.GOLD }
                  return (
                    <tr key={t.id || i} onClick={() => setSelectedTradeIdx(realIdx)} style={{ borderBottom: `1px solid ${T.BORDER}`, cursor: 'pointer', background: isTA ? `${T.TEAL}18` : 'transparent', borderLeft: isTA ? `2px solid ${T.TEAL}` : '2px solid transparent' }}
                      onMouseEnter={e => { if (!isTA) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if (!isTA) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '3px 6px', color: T.MUTED, textAlign: 'left' }}>{t.openDate}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: t.side === 'long' ? T.TEAL : T.RED, fontWeight: 700 }}>{t.side === 'long' ? 'L' : 'S'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'left', color: T.WHITE, fontWeight: 600 }}>{t.ticker || '-'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'left', color: T.MUTED }}>{t.rsDate || '-'}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: T.WHITE }}>{t.entry.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: T.GOLD }}>{t.stop.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: T.WHITE }}>{t.exit.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: t.r >= 0 ? T.TEAL : T.RED, fontWeight: 700 }}>{t.r.toFixed(2)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: t.pnl >= 0 ? T.TEAL : T.RED }}>{t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(0)}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: EC[t.exitLabel] || T.MUTED, fontSize: 8 }}>{t.exitLabel}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: 10 }}>
            <thead>
              <tr style={{ background: T.SURFACE2, position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: T.GOLD, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, background: T.SURFACE2, zIndex: 3, width: colWidths.ticker, minWidth: 24 }}>Ticker<ResizeHandle colId="ticker" /></th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: colWidths.ticker, background: T.SURFACE2, zIndex: 3, width: colWidths.date, minWidth: 24, borderRight: `1px solid ${T.BORDER}` }}>Date<ResizeHandle colId="date" /></th>
                <th style={{ padding: '4px 4px', textAlign: 'center', color: T.TEAL, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', background: `${T.TEAL}15`, width: colWidths.rs, minWidth: 24, borderLeft: `1px solid ${T.BORDER}`, position: 'relative' }} title="Route Start — click cells to mark valid entries">
                  <div>RS</div>
                  <div style={{ fontSize: 7, fontWeight: 400, opacity: 0.7 }}>{routeStarts.size}/{signals.length}</div>
                  <ResizeHandle colId="rs" />
                </th>
                <th onClick={() => { const seq = ['', 'A+', 'A', 'B', 'C']; const idx = seq.indexOf(gradeFilter); setGradeFilter(seq[(idx + 1) % seq.length]) }} style={{ padding: '4px 3px', textAlign: 'center', cursor: 'pointer', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', background: gradeFilter ? (gradeFilter === 'A+' ? `${T.TEAL}30` : gradeFilter === 'A' ? '#6ee7b720' : gradeFilter === 'B' ? `${T.GOLD}30` : `${T.RED}30`) : `${T.GOLD}10`, color: gradeFilter ? (gradeFilter === 'A+' ? T.TEAL : gradeFilter === 'A' ? '#6ee7b7' : gradeFilter === 'B' ? T.GOLD : T.RED) : T.GOLD, width: colWidths.grade, minWidth: 24, position: 'relative' }} title="Click to filter: All → A+ → A → B → C">Gr<ResizeHandle colId="grade" /></th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', width: colWidths.gap, minWidth: 24, position: 'relative' }}>Gap%<ResizeHandle colId="gap" /></th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', width: colWidths.d0, minWidth: 24, position: 'relative' }}>D0<ResizeHandle colId="d0" /></th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', width: colWidths.abs, minWidth: 24, position: 'relative' }}>ABS<ResizeHandle colId="abs" /></th>
                {/* ── Dynamic filter columns: 3-state header click ── */}
                {activeFilterDefs.map(f => {
                  const isFiltering = activeFilters.has(f.key)
                  const isHiding = hideFilters.has(f.key)
                  const count = filterCounts[f.key] || 0
                  // 3 states: show (teal outline) → filter/dim (solid teal) → hide (red-orange, rows removed)
                  let bg: string, fg: string
                  if (isHiding) {
                    bg = T.RED; fg = '#000'
                  } else if (isFiltering) {
                    bg = T.TEAL; fg = '#000'
                  } else {
                    bg = `${T.TEAL}25`; fg = T.TEAL
                  }
                  return (
                    <th key={f.key} title={`${f.description}\n${count}/${signals.length} pass\n\nClick: show \u2192 filter (dim) \u2192 hide (remove)`}
                      onClick={() => {
                        if (!isFiltering && !isHiding) {
                          // SHOW → FILTER (dim)
                          setActiveFilters(new Set([...activeFilters, f.key]))
                        } else if (isFiltering) {
                          // FILTER → HIDE (remove rows)
                          setActiveFilters(new Set([...activeFilters].filter(k => k !== f.key)))
                          setHideFilters(new Set([...hideFilters, f.key]))
                        } else {
                          // HIDE → SHOW (just checks)
                          setHideFilters(new Set([...hideFilters].filter(k => k !== f.key)))
                        }
                      }}
                      style={{ padding: '4px 4px', textAlign: 'center', cursor: 'pointer', color: fg, fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: bg, borderLeft: `1px solid ${T.BORDER}`, minWidth: 30 }}>
                      <div>{f.shortLabel}</div>
                      <div style={{ fontSize: 7, fontWeight: 400, opacity: 0.7 }}>{count}</div>
                    </th>
                  )
                })}
                {/* ── Data columns ── */}
                {DATA_COLUMNS.filter(c => visibleColumns.has(c.key)).map(col => (
                  <th key={col.key} title={`${col.description}\nClick to remove`} onClick={() => {
                    const next = new Set(visibleColumns); next.delete(col.key); setVisibleColumns(next)
                  }} style={{ padding: '4px 4px', textAlign: 'center', cursor: 'pointer', color: T.GOLD, fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, background: `${T.GOLD}15`, borderLeft: `1px solid ${T.BORDER}`, minWidth: 38 }}>
                    {col.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => {
                const isActive = i === selectedIdx
                const d0chg = s.open ? ((s.close - s.open) / s.open * 100) : 0
                const passesAllFilters = activeFilters.size === 0 || Array.from(activeFilters).every(k => filterResults[k]?.[i])
                // 3 states: show all checks, dim non-passing, or hide non-passing
                // Hide row if grade filter doesn't match, or ANY hiding filter fails it
                const gradeKey = `${s.ticker}-${s.date}`
                const hideByGrade = gradeFilter && grades[gradeKey] !== gradeFilter
                const hideByFilter = [...hideFilters].some(k => !filterResults[k]?.[i])
                const hideRow = hideByGrade || hideByFilter
                if (hideRow) return null
                const dimmed = activeFilters.size > 0 && !passesAllFilters
                return (
                  <tr key={`${s.ticker}-${s.date}`} onClick={() => { setSelectedIdx(i); setDayOffset(0) }} style={{ cursor: 'pointer', background: isActive ? T.GOLD_DIM : 'transparent', opacity: dimmed ? 0.25 : 1 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '3px 6px', color: isActive ? T.GOLD : T.WHITE, fontWeight: 700, fontFamily: 'monospace', position: 'sticky', left: 0, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1, width: colWidths.ticker }}>{s.ticker}</td>
                    <td style={{ padding: '3px 6px', color: isActive ? T.GOLD : T.MUTED, position: 'sticky', left: colWidths.ticker, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1, borderRight: `1px solid ${T.BORDER}`, width: colWidths.date }}>{s.date.slice(5)}</td>
                    <td onClick={(e) => { e.stopPropagation(); toggleRS(`${s.ticker}-${s.date}`) }} style={{ padding: '3px 4px', textAlign: 'center', borderLeft: `1px solid ${T.BORDER}`, cursor: 'pointer', color: routeStarts.has(`${s.ticker}-${s.date}`) ? T.TEAL : T.BORDER, fontSize: 12, fontWeight: 700, userSelect: 'none', background: routeStarts.has(`${s.ticker}-${s.date}`) ? `${T.TEAL}15` : 'transparent', width: colWidths.rs }}>{routeStarts.has(`${s.ticker}-${s.date}`) ? '✓' : ''}</td>
                    <td onClick={(e) => { e.stopPropagation(); toggleGrade(`${s.ticker}-${s.date}`) }} style={{ padding: '3px 2px', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: colWidths.grade, fontSize: 10, fontWeight: 700, color: grades[`${s.ticker}-${s.date}`] === 'A+' ? T.TEAL : grades[`${s.ticker}-${s.date}`] === 'A' ? '#6ee7b7' : grades[`${s.ticker}-${s.date}`] === 'B' ? T.GOLD : grades[`${s.ticker}-${s.date}`] === 'C' ? T.RED : T.BORDER, background: grades[`${s.ticker}-${s.date}`] ? `${grades[`${s.ticker}-${s.date}`] === 'C' ? T.RED : grades[`${s.ticker}-${s.date}`] === 'B' ? T.GOLD : T.TEAL}10` : 'transparent' }}>{grades[`${s.ticker}-${s.date}`] || ''}</td>
                    <td style={{ padding: '3px 4px', color: T.TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: colWidths.gap }}>{(s.gap_pct || 0).toFixed(0)}%</td>
                    <td style={{ padding: '3px 4px', color: d0chg < 0 ? T.RED : T.TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: colWidths.d0 }}>{d0chg > 0 ? '+' : ''}{isNaN(d0chg) ? '0.0' : d0chg.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: T.GOLD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', width: colWidths.abs }}>{(s.pos_abs || 0).toFixed(2)}</td>
                    {/* Filter column cells */}
                    {activeFilterDefs.map(f => {
                      const passes = filterResults[f.key]?.[i]
                      return (
                        <td key={f.key} title={passes ? 'Passes ' + f.label : 'Fails ' + f.label} style={{
                          padding: '3px 4px', textAlign: 'center',
                          borderLeft: `1px solid ${T.BORDER}`,
                          color: passes ? T.TEAL : T.RED,
                          fontSize: 10, fontWeight: 700,
                        }}>{passes ? '\u2713' : ''}</td>
                      )
                    })}
                    {/* Data column cells */}
                    {DATA_COLUMNS.filter(c => visibleColumns.has(c.key)).map(col => (
                      <td key={col.key} style={{
                        padding: '3px 4px', textAlign: 'center',
                        borderLeft: `1px solid ${T.BORDER}`,
                        color: T.GOLD, fontSize: 9, fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}>{dataColumnResults[col.key]?.[i] || '-'}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, minHeight: 200, borderTop: `1px solid ${T.BORDER}`, display: 'flex', flexDirection: 'column' }}>
        <div className="px-2 py-1.5 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <MessageSquare className="h-3 w-3" style={{ color: T.GOLD }} />
          <span style={{ color: T.GOLD, fontSize: 10, fontWeight: 700 }}>CHAT</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '6px 8px' }}>
          {chatMessages.length === 0 && (
            <p style={{ color: T.MUTED, fontSize: 10, fontStyle: 'italic', padding: '8px 4px' }}>Ask about backtest results, entry systems, or signal patterns...</p>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1.4, background: m.role === 'user' ? T.GOLD_DIM : T.SURFACE2, color: TEXT, maxWidth: '90%', wordBreak: 'break-word' }}>{m.content}</div>
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
            placeholder="Ask about backtest..."
            style={{ flex: 1, background: T.BG, border: `1px solid ${T.BORDER}`, borderRadius: 3, padding: '5px 8px', color: TEXT, fontSize: 11, outline: 'none' }}
          />
          <button style={{ padding: '4px 8px', borderRadius: 3, background: T.GOLD, color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Send className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
    )
  }

  const renderCenter = () => (
    <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── View toggle ── */}
      <div className="flex gap-1">
        <button onClick={() => setViewMode('stat')} style={{
          padding: '4px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700,
          background: viewMode === 'stat' ? T.GOLD : T.SURFACE,
          color: viewMode === 'stat' ? '#000' : T.MUTED,
          border: `1px solid ${viewMode === 'stat' ? T.GOLD : T.BORDER}`,
        }}>Stat View</button>
        <button onClick={() => setViewMode('chart')} style={{
          padding: '4px 12px', borderRadius: 3, fontSize: 11, fontWeight: 700,
          background: viewMode === 'chart' ? T.TEAL : T.SURFACE,
          color: viewMode === 'chart' ? '#000' : T.MUTED,
          border: `1px solid ${viewMode === 'chart' ? T.TEAL : T.BORDER}`,
        }}>Chart View</button>
      </div>
      {viewMode === 'stat' ? (
        <>
          <BacktestStatsPanel signals={filteredSignals} backtestResults={backtestResults} dark={dark} isBacktestRun={!!selectedBtRun} />
          {renderChartSection()}
        </>
      ) : (
        <>
          {renderChartSection()}
          <BacktestStatsPanel signals={filteredSignals} backtestResults={backtestResults} dark={dark} isBacktestRun={!!selectedBtRun} />
        </>
      )}
    </div>
  )

  const renderChartSection = () => (
    <>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.GOLD }} />
          <span style={{ color: T.MUTED, fontSize: 12, marginLeft: 8 }}>Loading...</span>
        </div>
      ) : sig ? (
        <>
          {/* ── Single toolbar row ── */}
          <div className="flex items-center gap-2 flex-wrap" style={{ position: 'sticky', top: 0, zIndex: 10, background: T.SURFACE, padding: '4px 0' }}>
            {/* Single / Stacked */}
            <div className="flex gap-1">
              <button onClick={() => setChartMode('single')} title="Single chart" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: chartMode === 'single' ? T.GOLD : T.SURFACE,
                color: chartMode === 'single' ? '#000' : T.MUTED,
                border: `1px solid ${chartMode === 'single' ? T.GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3,
              }}><LayoutGrid className="h-3 w-3" />Single</button>
              <button onClick={() => setChartMode('stacked')} title="Stacked" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: chartMode === 'stacked' ? T.GOLD : T.SURFACE,
                color: chartMode === 'stacked' ? '#000' : T.MUTED,
                border: `1px solid ${chartMode === 'stacked' ? T.GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3,
              }}><Rows3 className="h-3 w-3" />Stacked</button>
            </div>

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* TF */}
            {chartMode === 'single' && (
              <div className="flex gap-1">
                {(['1', '2', '5', '15', '60', 'D'] as Timeframe[]).map(t => (
                  <button key={t} onClick={() => setTf(t)} style={{
                    padding: '2px 12px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: tf === t ? T.GOLD : T.SURFACE, color: tf === t ? '#000' : T.MUTED,
                    border: `1px solid ${tf === t ? T.GOLD : T.BORDER}`,
                  }}>{t === '1' ? '1m' : t === '2' ? '2m' : t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '1H' : '1D'}</button>
                ))}
              </div>
            )}

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* ◀ ▶ day-by-day view offset */}
            <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} style={dateBtnStyle(T.GOLD)} title="Back 1 day">◀</button>
            <span style={{ fontSize: 11, fontWeight: 800, color: T.GOLD, fontFamily: 'monospace', minWidth: 78, textAlign: 'center' }}>
              {dayOffset === 0 ? `D0 ${formatDateShort(sig.date)}` : `D+${dayOffset}`}
            </span>
            <button onClick={() => setDayOffset(d => d + 1)} style={dateBtnStyle(T.GOLD)} title="Forward 1 day">▶</button>
            <button onClick={() => setDayOffset(0)} style={{
              ...dateBtnStyle(T.GOLD, 9),
              ...(dayOffset === 0 ? { background: T.GOLD, color: '#000' } : {}),
            }} title="Reset to D0">D0</button>
            {[3, 7, 14].map(n => (
              <button key={n} onClick={() => setDayOffset(d => d + n)}
                style={dateBtnStyle('rgba(212,175,55,0.6)', 9, 'rgba(212,175,55,0.35)')} title={`+${n} trading days`}>+{n}d</button>
            ))}

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* Ticker */}
            <span style={{ color: T.GOLD, fontSize: 16, fontWeight: 800 }}>{sig.ticker}</span>
            <span style={{ color: T.MUTED, fontSize: 10 }}>{selectedIdx + 1}/{signals.length}</span>

            {/* ↑↓ signal list nav */}
            <button onClick={() => { setSelectedIdx(Math.max(0, selectedIdx - 1)); setDayOffset(0) }} style={dateBtnStyle(T.GOLD)} title="Previous signal in list">▲</button>
            <button onClick={() => { setSelectedIdx(Math.min(signals.length - 1, selectedIdx + 1)); setDayOffset(0) }} style={dateBtnStyle(T.GOLD)} title="Next signal in list">▼</button>

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* Exec toggles */}
            <button onClick={() => setChartSettings(s => ({ ...s, showExecDots: !s.showExecDots }))} title="Exec Dots" style={{
              padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
              background: chartSettings.showExecDots ? '#4ade80' : T.SURFACE, color: chartSettings.showExecDots ? '#000' : T.MUTED,
              border: `1px solid ${chartSettings.showExecDots ? '#4ade80' : T.BORDER}`,
              display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
            }}>Dots</button>
            <button onClick={() => setChartSettings(s => ({ ...s, showExecWedges: !s.showExecWedges }))} title="Exec Wedges" style={{
              padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
              background: chartSettings.showExecWedges ? '#f87171' : T.SURFACE, color: chartSettings.showExecWedges ? '#000' : T.MUTED,
              border: `1px solid ${chartSettings.showExecWedges ? '#f87171' : T.BORDER}`,
              display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
            }}>Wedges</button>

            <div style={{ width: 1, height: 18, background: T.BORDER }} />

            {/* Settings */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSettings(v => !v)} title="Chart Settings" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: showSettings ? T.GOLD : T.SURFACE, color: showSettings ? '#000' : T.MUTED,
                border: `1px solid ${showSettings ? T.GOLD : T.BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
              }}><Settings2 className="h-3 w-3" /></button>
              {showSettings && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                  background: T.SURFACE2, border: `1px solid ${T.GOLD_BORDER}`, borderRadius: 6,
                  padding: 12, minWidth: 220,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ color: T.GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Chart Settings</div>
                  {([
                    ['showEma9_20', 'EMA 9/20 Bands'],
                    ['showEma72_89', 'EMA 72/89 Bands'],
                    ['showDevBands', 'Deviation Bands'],
                    ['showVwap', 'VWAP Line'],
                    ['showPrevClose', 'Prev Close Line'],
                    ['showAhPmShade', 'AH/PM Shading'],
                    ['showVolume', 'Volume Bars'],
                    ['showCrosshair', 'Crosshair on Hover'],
                    ['showLegend', 'Legend'],
                    ['showExecDots', 'Exec Dots'],
                    ['showExecWedges', 'Exec Wedges'],
                  ] as [keyof ChartSettings, string][]).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between" style={{ padding: '4px 0', cursor: 'pointer' }}>
                      <span style={{ color: T.TEXT2, fontSize: 11 }}>{label}</span>
                      <div onClick={() => setChartSettings(s => ({ ...s, [key]: !s[key] }))} style={{
                        width: 32, height: 16, borderRadius: 8, position: 'relative', cursor: 'pointer',
                        background: chartSettings[key] ? T.GOLD : T.BORDER, transition: 'background 0.15s',
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
            <a href={`/charts?symbol=${chartSymbol}`} target="_blank" rel="noreferrer" style={{ color: T.GOLD, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }} className="hover:underline">
              Charts <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Chart(s) — when a backtest run is selected, charts switch to its symbol/tf (SPY 15m) */}
          {chartMode === 'single' ? (
            <MiniChart symbol={chartSymbol} tf={chartTf} date={chartDate} height={580} settings={chartSettings} dark={dark} dayOffset={selectedBtRun ? btDayOffset : dayOffset} btMarkers={chartMarkers} />
          ) : (
            <div className="space-y-2">
              <MiniChart symbol={chartSymbol} tf="D" date={chartDate} height={360} settings={chartSettings} dark={dark} dayOffset={selectedBtRun ? btDayOffset : dayOffset} btMarkers={chartMarkers} />
              <MiniChart symbol={chartSymbol} tf="60" date={chartDate} height={280} settings={chartSettings} dark={dark} dayOffset={selectedBtRun ? btDayOffset : dayOffset} btMarkers={chartMarkers} />
              <MiniChart symbol={chartSymbol} tf="15" date={chartDate} height={280} settings={chartSettings} dark={dark} dayOffset={selectedBtRun ? btDayOffset : dayOffset} btMarkers={chartMarkers} />
              <MiniChart symbol={chartSymbol} tf="5" date={chartDate} height={280} settings={chartSettings} dark={dark} dayOffset={selectedBtRun ? btDayOffset : dayOffset} btMarkers={chartMarkers} />
            </div>
          )}

          {/* Detail pills — scan OHLC only meaningful for scan signals; hide when a backtest run is active */}
          {!selectedBtRun && (<div className="flex flex-wrap gap-1">
            <Detail label="Open" value={`$${sig.open?.toFixed(2)}`} />
            <Detail label="High" value={`$${sig.high?.toFixed(2)}`} color={T.TEAL} />
            <Detail label="Low" value={`$${sig.low?.toFixed(2)}`} color={T.RED} />
            <Detail label="Close" value={`$${sig.close?.toFixed(2)}`} />
            <Detail label="Vol" value={`${((sig.volume || 0) / 1e6).toFixed(1)}M`} />
            <Detail label="Gap" value={`${(sig.gap_pct || 0).toFixed(1)}%`} color={T.TEAL} />
            <Detail label="ABS" value={(sig.pos_abs || 0).toFixed(3)} />
            <Detail label="D0 Chg" value={`${((sig.close - sig.open) / sig.open * 100).toFixed(1)}%`} color={sig.close < sig.open ? T.RED : T.TEAL} />
            <Detail label="Range" value={`${((sig.high - sig.low) / sig.open * 100).toFixed(1)}%`} />
          </div>)}
          {selectedBtRun && btTrades[selectedTradeIdx] && (() => { const tt = btTrades[selectedTradeIdx]
            return (<div className="flex flex-wrap gap-1">
              <Detail label="Side" value={tt.side === 'long' ? 'LONG' : 'SHORT'} color={tt.side === 'long' ? T.TEAL : T.RED} />
              <Detail label="Opened" value={tt.openDate} />
              <Detail label="Entry" value={`$${tt.entry.toFixed(2)}`} />
              <Detail label="Stop" value={`$${tt.stop.toFixed(2)}`} color={T.GOLD} />
              <Detail label="Exit" value={`$${tt.exit.toFixed(2)}`} />
              <Detail label="R" value={`${tt.r >= 0 ? '+' : ''}${tt.r.toFixed(2)}`} color={tt.r >= 0 ? T.TEAL : T.RED} />
              <Detail label="$PNL" value={`${tt.pnl >= 0 ? '+' : ''}$${tt.pnl.toFixed(0)}`} color={tt.pnl >= 0 ? T.TEAL : T.RED} />
              <Detail label="Reason" value={tt.exitLabel} color={tt.exitLabel === 'STOP' ? T.RED : (tt.exitLabel === 'EXTREME' || tt.exitLabel === 'REVERSION') ? T.TEAL : T.MUTED} />
            </div>) })}
        </>
      ) : null}
    </>
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
          <Activity className="h-4 w-4" style={{ color: T.GOLD }} />
          <span style={{ color: T.GOLD, fontSize: 14, fontWeight: 800 }}>Backtest Workshop</span>
          {activeScan && <span style={{ color: T.MUTED, fontSize: 11 }}>· {activeScan.name}</span>}
        </div>
        <div className="flex items-center gap-1">
          <a href="/scanner" title="Scanner" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.SURFACE2, color: T.GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
            textDecoration: 'none',
          }}>
            <Search className="h-3 w-3" /> Scanner
          </a>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowExec(!showExec)} title="Exec Strategies" style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
              background: showExec ? '#4ade80' : T.SURFACE2, color: showExec ? '#000' : T.TEAL, border: `1px solid ${showExec ? '#4ade80' : T.TEAL}40`, cursor: 'pointer',
            }}>
              <Activity className="h-3 w-3" /> Exec
            </button>
            {showExec && (
              <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 4, padding: 4, minWidth: 160 }}>
                {[
                  { key: 'pop-short', label: 'Pop Short (2m 9/20)', desc: 'Short pops into upper dev band' },
                  { key: 'lingua-exec', label: 'Lingua Exec (50/89 Pullback)', desc: 'Long pullback-to-mean engine' },
                ].map(ex => (
                  <button key={ex.key} onClick={() => { setActiveExec(ex.key); setShowExec(false) }} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 3, fontSize: 10,
                    background: activeExec === ex.key ? `${T.TEAL}20` : 'transparent',
                    color: activeExec === ex.key ? T.TEAL : T.MUTED, border: 'none', cursor: 'pointer',
                  }}>
                    <div style={{ fontWeight: 600 }}>{ex.label}</div>
                    <div style={{ fontSize: 8, opacity: 0.6 }}>{ex.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <a href="/charts" target="_blank" rel="noreferrer" title="Open Charts" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.SURFACE2, color: T.GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
            textDecoration: 'none',
          }}>
            <BarChart3 className="h-3 w-3" /> Charts
          </a>
          <button onClick={() => setShowRunModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.GOLD, color: '#000', border: 'none', cursor: 'pointer',
          }}>
            <Play className="h-3 w-3" /> Run Scan
          </button>
          <button onClick={() => { selectBacktestRun(null); runBaselineBacktest() }} title="Baseline: D0 open → close over the scan signals" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: selectedBtRun ? T.SURFACE2 : '#14b8a6',
            color: selectedBtRun ? T.MUTED : '#000',
            border: selectedBtRun ? `1px solid ${T.BORDER}` : 'none', cursor: 'pointer',
          }}>
            <Activity className="h-3 w-3" /> Baseline
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.GOLD_DIM, color: T.GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
          }}>
            <Save className="h-3 w-3" /> Save
          </button>
          <button onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: T.GOLD_DIM, color: T.GOLD, border: `1px solid ${T.GOLD_BORDER}`, cursor: 'pointer',
          }}>
            {dark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Exec engine view (replaces body when selected) */}
      {activeExec === 'lingua-exec' ? <LinguaExecPanel dark={dark} signals={filteredSignals} selectedSignal={sig} /> : (<>
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
      </>) }

      {/* Run Modal */}
      {showRunModal && <RunModal scan={activeScan} onClose={() => setShowRunModal(false)} onRun={(range) => {
        // TODO: wire to scan API
        setTimeout(() => setShowRunModal(false), 1000)
      }} />}
    </div>
  )
}
