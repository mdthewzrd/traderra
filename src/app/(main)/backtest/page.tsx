'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  BarChart3, TrendingUp, List,
  Plus, ExternalLink, Calendar, Zap, Activity,
  ArrowUpRight, Hash, DollarSign, Target, Layers,
  Clock, TrendingDown, Minus, Play, Rows3,
  LayoutGrid, X, Settings2, Save, Sun, Moon, Shield,
  MessageSquare, Send
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
  resultCount: number
  createdAt: string
  runs?: ScanRun[]
}

interface ScanRun {
  id: string
  scanId: string
  dateRange: string
  runAt: string
  resultCount: number
}

type Timeframe = '5' | '15' | '60' | 'D'
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
  dayStats: { day: string; pnl: number; count: number }[]
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
}

// ─── Filter Definitions ──────────────────────────
interface FilterDef {
  key: string
  label: string
  shortLabel: string
  description: string
  needsBars?: '15m' // if set, this filter requires intraday bars (lazy loaded)
  compute: (s: Signal, bars15m?: any[]) => boolean
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
      // Filter to 7:30-12:00 ET (11:30-16:00 UTC)
      const morningBars = bars15m.filter(b => {
        const h = new Date(b.time * 1000).getUTCHours()
        const m = new Date(b.time * 1000).getUTCMinutes()
        const minutesSinceMidnight = h * 60 + m
        return minutesSinceMidnight >= 690 && minutesSinceMidnight < 960 // 11:30-16:00 UTC = 7:30-12:00 ET
      })
      if (morningBars.length < 5) return false
      // Count higher highs
      let higherHighs = 0
      for (let i = 1; i < morningBars.length; i++) {
        if (morningBars[i].high > morningBars[i - 1].high) higherHighs++
      }
      if (higherHighs < 2) return false
      // Compute EMA(9) on 15m closes
      const closes = morningBars.map(b => b.close)
      const ema: number[] = [closes[0]]
      const mult = 2 / (9 + 1)
      for (let i = 1; i < closes.length; i++) ema.push(closes[i] * mult + ema[i - 1] * (1 - mult))
      // Morning high vs last EMA value
      const morningHigh = Math.max(...morningBars.map(b => b.high))
      const lastEma = ema[ema.length - 1]
      const extension = lastEma > 0 ? (morningHigh - lastEma) / lastEma : 0
      // ATR approximation from daily signal (use high-low as proxy)
      const atrProxy = s.high - s.low
      const extNormalized = atrProxy > 0 ? (morningHigh - lastEma) / atrProxy : 0
      return extNormalized >= 0.5
    }
  },
  // ── Dev Band Upper 1 hit during morning ──
  { key: 'devBand1', label: 'Dev Band Upper 1', shortLabel: 'DEV1', needsBars: '15m',
    description: 'Morning high hits EMA(72)+ATR(72)*6.9 upper dev band on 15m',
    compute: (s, bars15m) => {
      if (!bars15m || bars15m.length < 90) return false
      // Filter to 7:30-12:00 ET (11:30-16:00 UTC)
      const morningBars = bars15m.filter(b => {
        const h = new Date(b.time * 1000).getUTCHours()
        const m = new Date(b.time * 1000).getUTCMinutes()
        const mins = h * 60 + m
        return mins >= 690 && mins < 960
      })
      if (morningBars.length < 3) return false
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
      const firstMorningTime = morningBars[0].time
      const firstMorningIdx = bars15m.findIndex(b => b.time === firstMorningTime)
      if (firstMorningIdx < 0 || firstMorningIdx >= ema72.length) return false
      const atrVal = atrOut[firstMorningIdx]
      if (atrVal === null || atrVal === undefined) return false // ATR not ready yet
      // Upper band 1 = EMA(72) + ATR(72) * 6.9 — exactly as drawDevBand renders
      const bandLevel = ema72[firstMorningIdx] + atrVal * 6.9
      // Check if any morning bar high hits above the band
      const morningHigh = Math.max(...morningBars.map(b => b.high))
      return morningHigh >= bandLevel
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

const LEFT_W = 240
const RIGHT_W = 420

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

// ─── MiniChart with zoom ────────────────────────────────
// Safe ISO date from timestamp (guards against NaN/invalid)
function safeISO(ts: number): string {
  const d = new Date(ts * 1000)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function MiniChart({ symbol, tf, date, height = 580, settings, dark, dayOffset = 0 }: {
  symbol: string
  tf: Timeframe
  date?: string
  height?: number
  settings: ChartSettings
  dark: boolean
  dayOffset?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [allBars, setAllBars] = useState<any[]>([])
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
    if (tf === '5') {
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
  }, [symbol, tf, date, dayOffset])

  // Compute visible bars — default puts D0 at right edge, manualZoom from wheel
  const visibleBars = useMemo(() => {
    if (!allBars.length) return []

    // If user manually zoomed, use that
    if (manualZoom) return allBars.slice(manualZoom.start, manualZoom.end)

    // Default window width per TF
    let defaultBars = allBars.length
    if (tf === '5') defaultBars = Math.min(allBars.length, 156)
    else if (tf === '15') defaultBars = Math.min(allBars.length, 104)
    else if (tf === '60') defaultBars = Math.min(allBars.length, 98)
    else defaultBars = Math.min(allBars.length, 120)

    // Find D0 — the last bar matching signal date
    let d0Idx = allBars.length - 1
    if (date) {
      for (let i = allBars.length - 1; i >= 0; i--) {
        const b = allBars[i]
        let bd = ''
        if (typeof b.time === 'number') {
          // Convert to ET date
          const etMs = b.time * 1000 - 4 * 3600000
          const etD = new Date(etMs)
          bd = isNaN(etD.getTime()) ? '' : etD.toISOString().slice(0, 10)
        } else if (typeof b.time === 'string') {
          bd = b.time.slice(0, 10)
        }
        if (bd === date) { d0Idx = i; break }
      }
    }

    // Extend past D0 by dayOffset
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
          const etDate = new Date(d.getTime() - 4 * 3600000)
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
      if (settings.showLegend) {
      ctx.font = '8px monospace'; ctx.textAlign = 'left'; const lx = 6, ly = 10
      ctx.fillStyle = 'rgba(34,197,94,0.7)'; ctx.fillText('9/20', lx, ly)
      ctx.fillStyle = 'rgba(34,197,94,0.5)'; ctx.fillText('72/89', lx + 35, ly)
      ctx.fillStyle = 'rgba(239,68,68,0.5)'; ctx.fillText('DEV', lx + 70, ly)
      ctx.fillStyle = 'rgba(194,114,58,0.7)'; ctx.fillText('VWAP', lx + 100, ly)
      }
    }

    // Zoom indicator
    if (visibleBars.length < allBars.length) {
      ctx.fillStyle = `${GOLD}80`; ctx.font = '9px monospace'; ctx.textAlign = 'right'
      ctx.fillText(`${visibleBars.length}/${allBars.length}`, W - PAD_R - 4, 12)
    }
  }, [visibleBars, allBars.length, tf, date, settings, dark, GOLD])

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }; draw()
  }
  const handleMouseLeave = () => { mouseRef.current = null; draw() }
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
        <canvas ref={canvasRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ width: '100%', height, display: 'block', cursor: 'crosshair' }} />
      )}
    </div>
  )
}

// ─── Backtest Stats Panel — Multi-Tab ────────────────
type StatsTab = 'overview' | 'performance' | 'pnl' | 'robustness'

function BacktestStatsPanel({ signals, backtestResults, dark }: { signals: Signal[]; backtestResults: BacktestResults | null; dark: boolean }) {
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

  if (!sigStats) return null
  const bt = backtestResults
  const tabs: { key: StatsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Zap className="h-3 w-3" /> },
    { key: 'performance', label: 'Performance', icon: <Activity className="h-3 w-3" /> },
    { key: 'pnl', label: 'P&L / Drawdown', icon: <TrendingUp className="h-3 w-3" /> },
    { key: 'robustness', label: 'Robustness', icon: <Shield className="h-3 w-3" /> },
  ]

  return (
    <div className="space-y-2">
      {/* ── Signal Overview Row (always visible) ── */}
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
              <MetricRow label="Best Trade" value={`+${bt.bestTrade.toFixed(2)}%`} color={C.TEAL} />
              <MetricRow label="Worst Trade" value={`${bt.worstTrade.toFixed(2)}%`} color={C.RED} />
              <MetricRow label="Std Dev Returns" value={`${bt.stdDevReturns.toFixed(2)}%`} />
              <MetricRow label="Max Consec Wins" value={bt.maxConsecWins.toString()} color={C.TEAL} />
              <MetricRow label="Max Consec Loss" value={bt.maxConsecLosses.toString()} color={C.RED} />
              <MetricRow label="Gross Win" value={`+${bt.grossWin.toFixed(1)}%`} color={C.TEAL} />
              <MetricRow label="Gross Loss" value={`${bt.grossLoss.toFixed(1)}%`} color={C.RED} />
            </div>
          </div>

          {/* Day-by-day */}
          {bt.dayStats.length > 0 && (
            <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                <Clock className="h-3 w-3" style={{ color: C.GOLD }} />
                <span style={{ color: C.GOLD, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Daily Breakdown</span>
              </div>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
                {bt.dayStats.map((d, i) => {
                  const col = d.pnl >= 0 ? C.TEAL : C.RED
                  return (
                    <div key={i} style={{ minWidth: 54, padding: '4px 6px', background: C.SURFACE2, borderRadius: 3, textAlign: 'center' }}>
                      <div style={{ color: C.MUTED, fontSize: 8, fontWeight: 600 }}>{d.day}</div>
                      <div style={{ color: col, fontSize: 12, fontWeight: 700 }}>{d.pnl >= 0 ? '+' : ''}{d.pnl.toFixed(1)}%</div>
                      <div style={{ color: C.MUTED, fontSize: 7 }}>{d.count}t</div>
                    </div>
                  )
                })}
              </div>
            </div>
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
  const [loading, setLoading] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)
  const [selectedRun, setSelectedRun] = useState<string>('r1')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showEma9_20: true, showEma72_89: true, showDevBands: true,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: true,
  })
  const [dark, setDark] = useState(true)
  const [dayOffset, setDayOffset] = useState(0)
  const [backtestResults, setBacktestResults] = useState<BacktestResults | null>(null)
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [bars15mCache, setBars15mCache] = useState<Record<string, any[]>>({})
  const [bars15mLoading, setBars15mLoading] = useState(false)
  const [visibleFilters, setVisibleFilters] = useState<Set<string>>(new Set())
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const T = useThemeColors(dark)

  // ── Compute filter results for all signals (instant for daily, lazy for intraday) ──
  const filterResults = useMemo(() => {
    const results: Record<string, boolean[]> = {}
    FILTERS.forEach(f => {
      if (f.needsBars === '15m') {
        // Only compute if bars are loaded
        results[f.key] = signals.map((s, i) => {
          const cacheKey = `${s.ticker}-${s.date}`
          const bars = bars15mCache[cacheKey]
          return f.compute(s, bars)
        })
      } else {
        results[f.key] = signals.map(s => f.compute(s))
      }
    })
    return results
  }, [signals, bars15mCache])

  // ── Lazy-load 15m bars when any intraday filter is visible OR active ──
  useEffect(() => {
    const allIntraKeys = new Set([...activeFilters, ...visibleFilters])
    const needsBars = Array.from(allIntraKeys).some(k => FILTERS.find(f => f.key === k)?.needsBars === '15m')
    if (!needsBars || !signals.length) return
    // Find signals we haven't fetched yet
    const toFetch = signals.filter(s => {
      const key = `${s.ticker}-${s.date}`
      return !bars15mCache[key]
    })
    if (toFetch.length === 0) return

    setBars15mLoading(true)
    const newCache: Record<string, any[]> = { ...bars15mCache }
    let fetched = 0
    const total = toFetch.length
    toFetch.forEach(s => {
      const date = s.date
      // Fetch 15 trading days before for EMA(72) warmup on 15m (72 bars ≈ 3 trading days, use 15 for safety)
      const fromDate = new Date(date + 'T12:00:00')
      fromDate.setDate(fromDate.getDate() - 25) // ~15-18 trading days back
      const nextDay = new Date(date + 'T12:00:00'); nextDay.setDate(nextDay.getDate() + 1)
      const fromStr = fromDate.toISOString().slice(0, 10)
      const toStr = nextDay.toISOString().slice(0, 10)
      const url = `/api/chart-data/bars?symbol=${encodeURIComponent(s.ticker)}&tf=15&from=${fromStr}&to=${toStr}`
      fetch(url)
        .then(r => r.json())
        .then(data => {
          newCache[`${s.ticker}-${date}`] = data.bars || []
          fetched++
          if (fetched === total) {
            setBars15mCache(newCache)
            setBars15mLoading(false)
          }
        })
        .catch(() => {
          newCache[`${s.ticker}-${date}`] = []
          fetched++
          if (fetched === total) {
            setBars15mCache(newCache)
            setBars15mLoading(false)
          }
        })
    })
  }, [activeFilters, visibleFilters, signals])

  // ── Filtered signals (based on active filters) ──
  const filteredSignals = useMemo(() => {
    if (activeFilters.size === 0) return signals
    return signals.filter((s, i) => {
      for (const key of activeFilters) {
        if (!filterResults[key]?.[i]) return false
      }
      return true
    })
  }, [signals, activeFilters, filterResults])

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
    const totalPnl = returns.reduce((a, r) => a + r, 0)
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

    // Cumulative P&L series
    let cumPnl = 0
    const cumPnlSeries: number[] = []
    const drawdownSeries: number[] = []
    let peak = 0, maxDd = 0, ddStart = 0, maxDDDuration = 0
    returns.forEach((r, i) => {
      cumPnl += r; cumPnlSeries.push(cumPnl)
      peak = Math.max(peak, cumPnl)
      const dd = peak - cumPnl
      drawdownSeries.push(dd)
      if (dd > 0 && ddStart === 0) ddStart = i
      maxDd = Math.max(maxDd, dd)
      if (dd === 0 && ddStart > 0) { maxDDDuration = Math.max(maxDDDuration, i - ddStart); ddStart = 0 }
    })
    if (ddStart > 0) maxDDDuration = Math.max(maxDDDuration, returns.length - ddStart)

    // Sharpe ratio (annualized, assume ~252 trading days)
    const meanReturn = returns.reduce((a, r) => a + r, 0) / returns.length
    const stdDev = Math.sqrt(returns.reduce((a, r) => a + (r - meanReturn) ** 2, 0) / returns.length)
    const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0

    // Sortino (downside deviation only)
    const downsideReturns = returns.filter(r => r < 0)
    const downsideDev = downsideReturns.length > 0 ? Math.sqrt(downsideReturns.reduce((a, r) => a + r ** 2, 0) / downsideReturns.length) : 0
    const sortino = downsideDev > 0 ? (meanReturn / downsideDev) * Math.sqrt(252) : 0

    // Calmar = CAGR / MaxDD
    const totalReturnPct = totalPnl
    const tradingDays = new Set(source.map(s => s.date)).size
    const yearsInSample = tradingDays / 252
    const cagr = yearsInSample > 0 ? (Math.pow(1 + totalReturnPct / 100, 1 / yearsInSample) - 1) * 100 : totalReturnPct
    const calmar = maxDd > 0 ? Math.abs(totalReturnPct / maxDd) : 0

    // Consecutive wins/losses
    let cWins = 0, cLosses = 0, maxCWins = 0, maxCLosses = 0
    trades.forEach(t => {
      if (t.win) { cWins++; cLosses = 0; maxCWins = Math.max(maxCWins, cWins) }
      else { cLosses++; cWins = 0; maxCLosses = Math.max(maxCLosses, cLosses) }
    })

    const bestTrade = Math.max(...returns)
    const worstTrade = Math.min(...returns)
    const recoveryFactor = maxDd > 0 ? totalPnl / maxDd : 0

    // Day-by-day breakdown
    const byDate: Record<string, { pnls: number[] }> = {}
    source.forEach((s, i) => {
      if (!byDate[s.date]) byDate[s.date] = { pnls: [] }
      byDate[s.date].pnls.push(trades[i].pnlPct)
    })
    const dayStats = Object.entries(byDate).map(([date, d]) => ({
      day: date.slice(5), pnl: d.pnls.reduce((a, b) => a + b, 0), count: d.pnls.length,
    }))

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
      winRate, pctProfitable, profitFactor, sharpe, sortino, calmar,
      maxDrawdown: maxDd, maxDDDuration, avgRMultiple, medianR,
      avgWinPct, avgLossPct, expectancy: expectancyPct, expectancyPct,
      wlRatio, totalPnl: totalPnl * 1000, totalReturnPct, cagr,
      avgTradeDuration: '1 day', maxConsecWins: maxCWins, maxConsecLosses: maxCLosses,
      bestTrade, worstTrade, stdDevReturns: stdDev, downsideDev, recoveryFactor,
      grossWin, grossLoss,
      tradeReturns: returns, cumPnlSeries, drawdownSeries,
      dayStats, monthlyStats,
    })
  }, [signals])

  // Auto-run baseline when signals load
  useEffect(() => {
    if (signals.length > 0 && !backtestResults) runBaselineBacktest()
  }, [signals])

  // Re-run when filters change
  useEffect(() => {
    if (filteredSignals.length > 0) runBaselineBacktest(filteredSignals)
  }, [activeFilters])

  // Runs derived from loaded scans (no mock data)
  const [runs, setRuns] = useState<ScanRun[]>([])

  useEffect(() => {
    fetch('/api/scans')
      .then(r => r.json())
      .then(data => {
        const list = (data.scans || []).filter((s: ScanDef) => s.resultCount > 0)
        setScans(list)
        // Auto-select Backside B if found
        const backside = list.find((s: ScanDef) => s.name.toLowerCase().includes('backside'))
        if (backside) setSelectedScan(backside.id)
        else if (list.length && !selectedScan) setSelectedScan(list[0].id)
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
        // Create a run from this scan's data
        if (sigs.length && selectedScan) {
          const scan = scans.find(s => s.id === selectedScan)
          setRuns([{
            id: selectedScan + '-r1',
            scanId: selectedScan,
            dateRange: sigs.length > 1 ? `${sigs[sigs.length-1]?.date?.slice(5)} → ${sigs[0]?.date?.slice(5)}` : '1d',
            runAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            resultCount: sigs.length,
          }])
        }
      })
      .catch(() => setLoading(false))
  }, [selectedScan])

  const sig = signals[selectedIdx] as Signal | undefined
  const activeScan = scans.find(s => s.id === selectedScan)

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

  // ─── Left Sidebar: Scans (top) + Runs (bottom) ────
  const renderLeftSidebar = () => (
    <div style={{
      width: LEFT_W, minWidth: LEFT_W, maxWidth: LEFT_W,
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
          {scans.map(scan => {
            const isActive = scan.id === selectedScan
            return (
              <button key={scan.id} onClick={() => setSelectedScan(scan.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', border: 'none', cursor: 'pointer',
                background: isActive ? T.GOLD_DIM : 'transparent',
                borderLeft: isActive ? `2px solid ${T.GOLD}` : '2px solid transparent',
                borderBottom: `1px solid ${T.BORDER}`,
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ color: isActive ? T.GOLD : TEXT, fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scan.name}
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${T.TEAL}20`, color: T.TEAL }}>{scan.resultCount} sig</span>
                  <span style={{ color: T.MUTED, fontSize: 8 }}>{scan.type}</span>
                </div>
              </button>
            )
          })}
          {scans.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <Search className="h-5 w-5 mx-auto mb-2" style={{ color: T.MUTED, opacity: 0.3 }} />
              <p style={{ color: T.MUTED, fontSize: 10 }}>No saved scans</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom half: Saved Runs ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: T.GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Runs</span>
            <span style={{ color: T.MUTED, fontSize: 9 }}>{runs.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {runs.map(run => {
            const isActive = run.id === selectedRun
            return (
            <div key={run.id} onClick={() => setSelectedRun(run.id)} style={{
              padding: '6px 10px', borderBottom: `1px solid ${T.BORDER}`, cursor: 'pointer',
              background: isActive ? T.GOLD_DIM : 'transparent',
              borderLeft: isActive ? `2px solid ${T.GOLD}` : '2px solid transparent',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: isActive ? T.GOLD : T.TEXT2, fontSize: 10, fontWeight: 600 }}>{run.dateRange}</span>
                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${T.TEAL}20`, color: T.TEAL }}>{run.resultCount}</span>
              </div>
              <div style={{ color: isActive ? T.GOLD : T.MUTED, fontSize: 8, marginTop: 2 }}>{run.runAt}</div>
            </div>
            )
          })}
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
      width: RIGHT_W, minWidth: RIGHT_W, maxWidth: RIGHT_W,
      background: T.SURFACE, borderLeft: `1px solid ${T.BORDER}`,
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* ── Signal Header + Filter Button ── */}
        <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: `1px solid ${T.BORDER}`, background: T.SURFACE2 }}>
          <span style={{ color: T.GOLD, fontSize: 10, fontWeight: 700 }}>SIGNALS</span>
          <div className="flex items-center gap-2">
            <span style={{ color: T.MUTED, fontSize: 9 }}>{filteredSignals.length}/{signals.length}</span>
            {/* Add Filter dropdown */}
            <div style={{ position: 'relative' }}>
              <button data-filter-btn onClick={() => setShowFilterMenu(!showFilterMenu)} style={{
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
                    const isLoading = f.needsBars === '15m' && visible && bars15mLoading
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
          <table style={{ minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 10 }}>
            <thead>
              <tr style={{ background: T.SURFACE2, position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: T.GOLD, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, background: T.SURFACE2, zIndex: 3, minWidth: 56 }}>Ticker</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 56, background: T.SURFACE2, zIndex: 3, minWidth: 68, borderRight: `1px solid ${T.BORDER}` }}>Date</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Gap%</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>D0</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: T.MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>ABS</th>
                {/* ── Dynamic filter columns: 3-state header click ── */}
                {activeFilterDefs.map(f => {
                  const isFiltering = activeFilters.has(f.key)
                  // State: show ✓ only (teal outline) → filtering (teal solid) → click removes column
                  const count = filterCounts[f.key] || 0
                  // Color: gray if just showing, teal solid if filtering
                  const bg = isFiltering ? T.TEAL : `${T.TEAL}25`
                  const fg = isFiltering ? '#000' : T.TEAL
                  return (
                    <th key={f.key} title={`${f.description}\n${count}/${signals.length} pass\n\nClick: show → filter → remove`}
                      onClick={() => {
                        if (!isFiltering) {
                          // SHOW → FILTER: activate the filter
                          setActiveFilters(new Set([...activeFilters, f.key]))
                        } else {
                          // FILTER → OFF: remove column entirely
                          const nv = new Set(visibleFilters); nv.delete(f.key); setVisibleFilters(nv)
                          const na = new Set(activeFilters); na.delete(f.key); setActiveFilters(na)
                        }
                      }}
                      style={{
                        padding: '4px 4px', textAlign: 'center', cursor: 'pointer',
                        color: fg, fontSize: 7, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: bg,
                        borderLeft: `1px solid ${T.BORDER}`,
                        minWidth: 30,
                      }}>
                      <div>{f.shortLabel}</div>
                      <div style={{ fontSize: 7, fontWeight: 400, opacity: 0.7 }}>{count}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => {
                const isActive = i === selectedIdx
                const d0chg = ((s.close - s.open) / s.open * 100)
                const passesAllFilters = activeFilters.size === 0 || Array.from(activeFilters).every(k => filterResults[k]?.[i])
                const dimmed = activeFilters.size > 0 && !passesAllFilters
                return (
                  <tr key={`${s.ticker}-${s.date}`} onClick={() => { setSelectedIdx(i); setDayOffset(0) }} style={{ cursor: 'pointer', background: isActive ? T.GOLD_DIM : 'transparent', opacity: dimmed ? 0.25 : 1 }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '3px 6px', color: isActive ? T.GOLD : T.WHITE, fontWeight: 700, fontFamily: 'monospace', position: 'sticky', left: 0, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1 }}>{s.ticker}</td>
                    <td style={{ padding: '3px 6px', color: isActive ? T.GOLD : T.MUTED, position: 'sticky', left: 56, background: isActive ? T.GOLD_DIM : T.SURFACE, zIndex: 1, borderRight: `1px solid ${T.BORDER}` }}>{s.date.slice(5)}</td>
                    <td style={{ padding: '3px 4px', color: T.TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(s.gap_pct || 0).toFixed(0)}%</td>
                    <td style={{ padding: '3px 4px', color: d0chg < 0 ? T.RED : T.TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d0chg > 0 ? '+' : ''}{d0chg.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: T.GOLD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(s.pos_abs || 0).toFixed(2)}</td>
                    {/* Filter column cells */}
                    {activeFilterDefs.map(f => {
                      const passes = filterResults[f.key]?.[i]
                      return (
                        <td key={f.key} title={passes ? 'Passes ' + f.label : 'Fails ' + f.label} style={{
                          padding: '3px 4px', textAlign: 'center',
                          borderLeft: `1px solid ${T.BORDER}`,
                          color: passes ? T.TEAL : T.RED,
                          fontSize: 10, fontWeight: 700,
                        }}>{passes ? '✓' : ''}</td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
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
      <BacktestStatsPanel signals={filteredSignals} backtestResults={backtestResults} dark={dark} />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.GOLD }} />
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
                {(['5', '15', '60', 'D'] as Timeframe[]).map(t => (
                  <button key={t} onClick={() => setTf(t)} style={{
                    padding: '2px 12px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: tf === t ? T.GOLD : T.SURFACE, color: tf === t ? '#000' : T.MUTED,
                    border: `1px solid ${tf === t ? T.GOLD : T.BORDER}`,
                  }}>{t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '1H' : '1D'}</button>
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
            <a href={`/charts-terminal.html?symbol=${sig.ticker}`} target="_blank" rel="noreferrer" style={{ color: T.GOLD, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }} className="hover:underline">
              Charts <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Chart(s) */}
          {chartMode === 'single' ? (
            <MiniChart symbol={sig.ticker} tf={tf} date={sig.date} height={580} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
          ) : (
            <div className="space-y-2">
              <MiniChart symbol={sig.ticker} tf="D" date={sig.date} height={360} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <MiniChart symbol={sig.ticker} tf="60" date={sig.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <MiniChart symbol={sig.ticker} tf="15" date={sig.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <MiniChart symbol={sig.ticker} tf="5" date={sig.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
            </div>
          )}

          {/* Detail pills */}
          <div className="flex flex-wrap gap-1">
            <Detail label="Open" value={`$${sig.open?.toFixed(2)}`} />
            <Detail label="High" value={`$${sig.high?.toFixed(2)}`} color={T.TEAL} />
            <Detail label="Low" value={`$${sig.low?.toFixed(2)}`} color={T.RED} />
            <Detail label="Close" value={`$${sig.close?.toFixed(2)}`} />
            <Detail label="Vol" value={`${((sig.volume || 0) / 1e6).toFixed(1)}M`} />
            <Detail label="Gap" value={`${(sig.gap_pct || 0).toFixed(1)}%`} color={T.TEAL} />
            <Detail label="ABS" value={(sig.pos_abs || 0).toFixed(3)} />
            <Detail label="D0 Chg" value={`${((sig.close - sig.open) / sig.open * 100).toFixed(1)}%`} color={sig.close < sig.open ? T.RED : T.TEAL} />
            <Detail label="Range" value={`${((sig.high - sig.low) / sig.open * 100).toFixed(1)}%`} />
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
          <a href="/charts-terminal.html" target="_blank" rel="noreferrer" title="Open Charts" style={{
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
          <button onClick={() => runBaselineBacktest()} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: '#14b8a6', color: '#000', border: 'none', cursor: 'pointer',
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

      {/* Body */}
      <div style={{ display: 'flex', flex: 1 }}>
        {renderLeftSidebar()}
        {renderCenter()}
        {renderRightSidebar()}
      </div>

      {/* Run Modal */}
      {showRunModal && <RunModal scan={activeScan} onClose={() => setShowRunModal(false)} onRun={(range) => {
        // TODO: wire to scan API
        setTimeout(() => setShowRunModal(false), 1000)
      }} />}
    </div>
  )
}
