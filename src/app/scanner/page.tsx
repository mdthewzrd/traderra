'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Search, Loader2, ChevronLeft, ChevronRight,
  BarChart3, TrendingUp, List, MessageSquare,
  Plus, ExternalLink, Calendar, Zap, Activity,
  ArrowUpRight, Hash, DollarSign, Target, Layers,
  Clock, TrendingDown, Minus, Send, Play, Rows3,
  LayoutGrid, X, Settings2, Save, Sun, Moon
} from 'lucide-react'

// ─── Built-in Scans (shared with SCAN tab) ─────────────
const BUILTIN_SCANS: ScanDef[] = [
  { id: 'builtin-backside-b', name: 'Backside B', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['backside-b'], filters: ['am-push'] },
  { id: 'builtin-gap-up', name: 'Gap Up', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['gap-up'] },
  { id: 'builtin-high-tight-flag', name: 'High Tight Flag', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['htf'] },
  { id: 'builtin-aparascan', name: 'Aparascan', type: 'builtin', resultCount: 0, createdAt: new Date().toISOString(), tags: ['aparascan'] },
]

const BUILTIN_SPEC_MAP: Record<string, string> = {
  'builtin-backside-b': 'backside-b',
  'builtin-gap-up': 'gap-up',
  'builtin-high-tight-flag': 'high-tight-flag',
  'builtin-aparascan': 'aparascan',
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
  [key: string]: any
}

interface ScanDef {
  id: string
  name: string
  type: string
  resultCount: number
  createdAt: string
  tags?: string[]
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
}

type Timeframe = '5' | '15' | '60' | 'D'
type ChartMode = 'single' | 'stacked'

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

// ─── Helpers ───────────────────────────────────────────
/** Get the ET (America/New_York) date string for a bar (YYYY-MM-DD). */
function barETDate(b: any): string {
  if (typeof b.time === 'string') return b.time.slice(0, 10)
  if (typeof b.time === 'number') {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })
        .format(new Date(b.time * 1000))
    } catch {
      return new Date(b.time * 1000 - 5 * 3600000).toISOString().slice(0, 10)
    }
  }
  return ''
}

// ─── MiniChart with zoom & drag ─────────────────────────
function ScanMiniChart({ symbol, tf, date, height = 580, settings, dark, dayOffset = 0 }: {
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
  const dragRef = useRef<{ active: boolean; startX: number; zoomStart: number; zoomEnd: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
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

    // Find D0 — the last bar whose ET date matches the signal date
    let d0Idx = allBars.length - 1
    if (date) {
      for (let i = allBars.length - 1; i >= 0; i--) {
        if (barETDate(allBars[i]) === date) { d0Idx = i; break }
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
          const mktDay = etDate.toISOString().slice(0, 10)
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
function StatsPanel({ signals }: { signals: Signal[] }) {
  if (!signals.length) return null
  const dates = new Set(signals.map(s => s.date)).size
  const tickers = new Set(signals.map(s => s.ticker)).size
  const avgD0Chg = signals.reduce((s, x) => s + ((x.close - x.open) / x.open * 100), 0) / signals.length
  const avgRange = signals.reduce((s, x) => s + ((x.high - x.low) / x.open * 100), 0) / signals.length
  const wins = signals.filter(s => s.close > s.open).length
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4 }}>
      <StatPill label="Signals" value={String(signals.length)} color={GOLD} />
      <StatPill label="Days" value={String(dates)} />
      <StatPill label="Tickers" value={String(tickers)} />
      <StatPill label="Avg D0" value={`${avgD0Chg > 0 ? '+' : ''}${avgD0Chg.toFixed(1)}%`} color={avgD0Chg > 0 ? TEAL : RED} />
      <StatPill label="Avg Rng" value={`${avgRange.toFixed(1)}%`} />
      <StatPill label="Green" value={`${(wins/signals.length*100).toFixed(0)}%`} color={TEAL} />
      {signals[0]?.am_ext_atr != null && (
        <StatPill label="Avg Ext" value={`${(signals.reduce((s,x) => s + (x.am_ext_atr || 0), 0) / signals.length).toFixed(2)}x ATR`} color={GOLD} />
      )}
    </div>
  )
}

function StatPill({ label, value, color = TEXT2 }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span style={{ color: MUTED, fontSize: 9, fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
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
function RunModal({ scan, onClose, onRun }: { scan: ScanDef | undefined; onClose: () => void; onRun: (range: string, filters: string[]) => void }) {
  const [range, setRange] = useState('90')
  const [running, setRunning] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  if (!scan) return null
  const availableFilters = scan.filters || []
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
        {/* Filter toggles */}
        {availableFilters.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: MUTED, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Filters</label>
            <div className="flex gap-1 flex-wrap">
              {availableFilters.map(f => {
                const isOn = activeFilters.includes(f)
                return (
                  <button key={f} onClick={() => setActiveFilters(prev => isOn ? prev.filter(x => x !== f) : [...prev, f])} style={{
                    padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                    background: isOn ? `${GOLD}30` : SURFACE, color: isOn ? GOLD : MUTED,
                    border: `1px solid ${isOn ? GOLD : BORDER}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>{f}</button>
                )
              })}
            </div>
          </div>
        )}
        <button disabled={running} onClick={() => { setRunning(true); onRun(range, activeFilters) }} style={{
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
export default function ScanDashboardPage() {
  const [scans, setScans] = useState<ScanDef[]>(BUILTIN_SCANS)
  const [selectedScan, setSelectedScan] = useState<string>('')
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tf, setTf] = useState<Timeframe>('D')
  const [chartMode, setChartMode] = useState<ChartMode>('single')
  const [loading, setLoading] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [selectedRun, setSelectedRun] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showEma9_20: true, showEma72_89: true, showDevBands: true,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: true,
  })
  const [dark, setDark] = useState(true)
  const [dayOffset, setDayOffset] = useState(0)
  const T = useThemeColors(dark)

  // DB scan records — keyed by strategy, used as runs
  const [dbScansByStrategy, setDbScansByStrategy] = useState<Record<string, ScanDef[]>>({})

  // Derive runs for the selected scan
  const activeScanDef = scans.find(s => s.id === selectedScan)
  const activeStrategy = activeScanDef ? (BUILTIN_SPEC_MAP[activeScanDef.id] || activeScanDef.name.toLowerCase().replace(/\s+/g, '-')) : ''
  const runs: ScanRun[] = (dbScansByStrategy[activeStrategy] || []).map(db => ({
    id: db.id,
    scanId: db.id,
    dateRange: db.name,
    runAt: new Date(db.createdAt).toLocaleString(),
    resultCount: db.resultCount,
    tags: db.tags ? (typeof db.tags === 'string' ? JSON.parse(db.tags) : db.tags) : [],
  }))

  useEffect(() => {
    fetch('/api/scans')
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
        if (list.length && !selectedScan) {
          const withResults = list.find(s => s.resultCount > 0)
          setSelectedScan(withResults ? withResults.id : list[0].id)
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
  }, [selectedScan, selectedRun])

  // When scan selection changes, reset run selection
  useEffect(() => {
    setSelectedRun('')
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
      background: SURFACE, borderRight: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      {/* ── Top half: Scan tree ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Scans</span>
            <span style={{ color: MUTED, fontSize: 9 }}>{scans.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {scans.map(scan => {
            const isActive = scan.id === selectedScan
            return (
              <button key={scan.id} onClick={() => setSelectedScan(scan.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', border: 'none', cursor: 'pointer',
                background: isActive ? GOLD_DIM : 'transparent',
                borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
                borderBottom: `1px solid ${BORDER}`,
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ color: isActive ? GOLD : TEXT, fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {scan.name}
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${TEAL}20`, color: TEAL }}>{scan.resultCount} sig</span>
                  <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${GOLD}20`, color: GOLD }}>{(scan.runs?.length || 0)} runs</span>
                  <span style={{ color: MUTED, fontSize: 8 }}>{scan.type}</span>
                  {(scan.tags || []).map(tag => (
                    <span key={tag} style={{ fontSize: 7, padding: '1px 3px', borderRadius: 2, background: `${GOLD}15`, color: GOLD, fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
              </button>
            )
          })}
          {scans.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <Search className="h-5 w-5 mx-auto mb-2" style={{ color: MUTED, opacity: 0.3 }} />
              <p style={{ color: MUTED, fontSize: 10 }}>No saved scans</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom half: Runs for selected scan ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Runs</span>
            <span style={{ color: MUTED, fontSize: 9 }}>{runs.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {runs.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ color: MUTED, fontSize: 10 }}>No runs yet</p>
              <p style={{ color: MUTED, fontSize: 9, marginTop: 4 }}>Click Run ▶ to execute</p>
            </div>
          )}
          {runs.map(run => {
            const isActive = run.id === selectedRun
            return (
            <div key={run.id} onClick={() => setSelectedRun(run.id)} style={{
              padding: '6px 10px', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer',
              background: isActive ? GOLD_DIM : 'transparent',
              borderLeft: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: isActive ? GOLD : TEXT2, fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.dateRange}</span>
                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${TEAL}20`, color: TEAL }}>{run.resultCount} sig</span>
              </div>
              <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                {(run.tags || []).map(tag => (
                  <span key={tag} style={{ fontSize: 7, padding: '0px 3px', borderRadius: 2, background: `${GOLD}12`, color: isActive ? GOLD : 'rgba(212,175,55,0.6)', fontWeight: 600 }}>{tag}</span>
                ))}
                <span style={{ color: isActive ? GOLD : MUTED, fontSize: 7, marginLeft: 'auto' }}>{run.runAt}</span>
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {/* New Scan button */}
      <div style={{ padding: 6, borderTop: `1px solid ${BORDER}` }}>
        <button style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          width: '100%', padding: '6px', borderRadius: 4,
          background: GOLD_DIM, color: GOLD, fontWeight: 600, fontSize: 10,
          border: `1px solid ${GOLD_BORDER}`, cursor: 'pointer',
        }}>
          <Plus className="h-3 w-3" /> New Scan
        </button>
      </div>
    </div>
  )

  // ─── Right Sidebar: Signals + Chat ────────────────
  const renderRightSidebar = () => (
    <div style={{
      width: RIGHT_W, minWidth: RIGHT_W, maxWidth: RIGHT_W,
      background: SURFACE, borderLeft: `1px solid ${BORDER}`,
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)',
      position: 'sticky', top: 48,
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="px-2 py-1.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
          <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>SIGNALS</span>
          <span style={{ color: MUTED, fontSize: 9 }}>{signals.length}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 10 }}>
            <thead>
              <tr style={{ background: SURFACE2, position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: GOLD, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 0, background: SURFACE2, zIndex: 3, minWidth: 56 }}>Ticker</th>
                <th style={{ padding: '4px 6px', textAlign: 'left', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', position: 'sticky', left: 56, background: SURFACE2, zIndex: 3, minWidth: 68, borderRight: `1px solid ${BORDER}` }}>Date</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Open</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Close</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Gap%</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>D0</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Rng%</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>ABS</th>
                <th style={{ padding: '4px 4px', textAlign: 'right', color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase' }}>Vol</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => {
                const isActive = i === selectedIdx
                const d0chg = ((s.close - s.open) / s.open * 100)
                const rng = ((s.high - s.low) / s.open * 100)
                return (
                  <tr key={`${s.ticker}-${s.date}`} onClick={() => { setSelectedIdx(i); setDayOffset(0) }} style={{ cursor: 'pointer', background: isActive ? GOLD_DIM : 'transparent' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '3px 6px', color: isActive ? GOLD : WHITE, fontWeight: 700, fontFamily: 'monospace', position: 'sticky', left: 0, background: isActive ? GOLD_DIM : SURFACE, zIndex: 1 }}>{s.ticker}</td>
                    <td style={{ padding: '3px 6px', color: isActive ? GOLD : MUTED, position: 'sticky', left: 56, background: isActive ? GOLD_DIM : SURFACE, zIndex: 1, borderRight: `1px solid ${BORDER}` }}>{s.date.slice(5)}</td>
                    <td style={{ padding: '3px 4px', color: TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${s.open?.toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${s.close?.toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(s.gap_pct || 0).toFixed(0)}%</td>
                    <td style={{ padding: '3px 4px', color: d0chg < 0 ? RED : TEAL, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{d0chg > 0 ? '+' : ''}{d0chg.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: TEXT2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rng.toFixed(1)}%</td>
                    <td style={{ padding: '3px 4px', color: GOLD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(s.pos_abs || 0).toFixed(2)}</td>
                    <td style={{ padding: '3px 4px', color: MUTED, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{((s.volume || 0) / 1e6).toFixed(0)}M</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chat */}
      <div style={{ height: '35%', minHeight: 140, borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column' }}>
        <div className="px-2 py-1.5 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
          <MessageSquare className="h-3 w-3" style={{ color: GOLD }} />
          <span style={{ color: GOLD, fontSize: 10, fontWeight: 700 }}>CHAT</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: '6px 8px' }}>
          {chatMessages.length === 0 && (
            <p style={{ color: MUTED, fontSize: 10, fontStyle: 'italic', padding: '8px 4px' }}>Ask about signals, patterns, or scan params...</p>
          )}
          {chatMessages.map((m, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1.4, background: m.role === 'user' ? GOLD_DIM : SURFACE2, color: TEXT, maxWidth: '90%', wordBreak: 'break-word' }}>{m.content}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '4px 6px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 4 }}>
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
            style={{ flex: 1, background: BG, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '5px 8px', color: TEXT, fontSize: 11, outline: 'none' }}
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
      <StatsPanel signals={signals} />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
          <span style={{ color: MUTED, fontSize: 12, marginLeft: 8 }}>Loading...</span>
        </div>
      ) : sig ? (
        <>
          {/* ── Single toolbar row ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Single / Stacked */}
            <div className="flex gap-1">
              <button onClick={() => setChartMode('single')} title="Single chart" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: chartMode === 'single' ? GOLD : SURFACE,
                color: chartMode === 'single' ? '#000' : MUTED,
                border: `1px solid ${chartMode === 'single' ? GOLD : BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3,
              }}><LayoutGrid className="h-3 w-3" />Single</button>
              <button onClick={() => setChartMode('stacked')} title="Stacked" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: chartMode === 'stacked' ? GOLD : SURFACE,
                color: chartMode === 'stacked' ? '#000' : MUTED,
                border: `1px solid ${chartMode === 'stacked' ? GOLD : BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3,
              }}><Rows3 className="h-3 w-3" />Stacked</button>
            </div>

            <div style={{ width: 1, height: 18, background: BORDER }} />

            {/* TF */}
            {chartMode === 'single' && (
              <div className="flex gap-1">
                {(['5', '15', '60', 'D'] as Timeframe[]).map(t => (
                  <button key={t} onClick={() => setTf(t)} style={{
                    padding: '2px 12px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                    background: tf === t ? GOLD : SURFACE, color: tf === t ? '#000' : MUTED,
                    border: `1px solid ${tf === t ? GOLD : BORDER}`,
                  }}>{t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '1H' : '1D'}</button>
                ))}
              </div>
            )}

            <div style={{ width: 1, height: 18, background: BORDER }} />

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

            <div style={{ width: 1, height: 18, background: BORDER }} />

            {/* Ticker */}
            <span style={{ color: GOLD, fontSize: 16, fontWeight: 800 }}>{sig.ticker}</span>
            <span style={{ color: MUTED, fontSize: 10 }}>{selectedIdx + 1}/{signals.length}</span>

            {/* ↑↓ signal list nav */}
            <button onClick={() => { setSelectedIdx(Math.max(0, selectedIdx - 1)); setDayOffset(0) }} style={dateBtnStyle(GOLD)} title="Previous signal in list">▲</button>
            <button onClick={() => { setSelectedIdx(Math.min(signals.length - 1, selectedIdx + 1)); setDayOffset(0) }} style={dateBtnStyle(GOLD)} title="Next signal in list">▼</button>

            <div style={{ width: 1, height: 18, background: BORDER }} />

            {/* Settings */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSettings(v => !v)} title="Chart Settings" style={{
                padding: '3px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                background: showSettings ? GOLD : SURFACE, color: showSettings ? '#000' : MUTED,
                border: `1px solid ${showSettings ? GOLD : BORDER}`,
                display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer',
              }}><Settings2 className="h-3 w-3" /></button>
              {showSettings && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                  background: SURFACE2, border: `1px solid ${GOLD_BORDER}`, borderRadius: 6,
                  padding: 12, minWidth: 220,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ color: GOLD, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Chart Settings</div>
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
                      <span style={{ color: TEXT2, fontSize: 11 }}>{label}</span>
                      <div onClick={() => setChartSettings(s => ({ ...s, [key]: !s[key] }))} style={{
                        width: 32, height: 16, borderRadius: 8, position: 'relative', cursor: 'pointer',
                        background: chartSettings[key] ? GOLD : BORDER, transition: 'background 0.15s',
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
            <a href={`/charts-terminal.html?symbol=${sig.ticker}`} target="_blank" rel="noreferrer" style={{ color: GOLD, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }} className="hover:underline">
              Charts <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Chart(s) */}
          {chartMode === 'single' ? (
            <ScanMiniChart symbol={sig.ticker} tf={tf} date={sig.date} height={580} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
          ) : (
            <div className="space-y-2">
              <ScanMiniChart symbol={sig.ticker} tf="D" date={sig.date} height={360} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <ScanMiniChart symbol={sig.ticker} tf="60" date={sig.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <ScanMiniChart symbol={sig.ticker} tf="15" date={sig.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
              <ScanMiniChart symbol={sig.ticker} tf="5" date={sig.date} height={280} settings={chartSettings} dark={dark} dayOffset={dayOffset} />
            </div>
          )}

          {/* Detail pills */}
          <div className="flex flex-wrap gap-1">
            <Detail label="Open" value={`$${sig.open?.toFixed(2)}`} />
            <Detail label="High" value={`$${sig.high?.toFixed(2)}`} color={TEAL} />
            <Detail label="Low" value={`$${sig.low?.toFixed(2)}`} color={RED} />
            <Detail label="Close" value={`$${sig.close?.toFixed(2)}`} />
            <Detail label="Vol" value={`${((sig.volume || 0) / 1e6).toFixed(1)}M`} />
            <Detail label="Gap" value={`${(sig.gap_pct || 0).toFixed(1)}%`} color={TEAL} />
            <Detail label="ABS" value={(sig.pos_abs || 0).toFixed(3)} />
            <Detail label="D0 Chg" value={`${((sig.close - sig.open) / sig.open * 100).toFixed(1)}%`} color={sig.close < sig.open ? RED : TEAL} />
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
        height: 48, background: SURFACE, borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4" style={{ color: GOLD }} />
          <span style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>Scan Dashboard</span>
          {activeScan && <span style={{ color: MUTED, fontSize: 11 }}>· {activeScan.name}</span>}
        </div>
        <div className="flex items-center gap-1">
          <a href="/charts-terminal.html" target="_blank" rel="noreferrer" title="Open Charts" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: SURFACE2, color: GOLD, border: `1px solid ${GOLD_BORDER}`, cursor: 'pointer',
            textDecoration: 'none',
          }}>
            <BarChart3 className="h-3 w-3" /> Charts
          </a>
          <button onClick={() => setShowRunModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: GOLD, color: '#000', border: 'none', cursor: 'pointer',
          }}>
            <Play className="h-3 w-3" /> Run
          </button>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}`, cursor: 'pointer',
          }}>
            <Save className="h-3 w-3" /> Save
          </button>
          <button onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: GOLD_DIM, color: GOLD, border: `1px solid ${GOLD_BORDER}`, cursor: 'pointer',
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
      {showRunModal && <RunModal scan={activeScan} onClose={() => setShowRunModal(false)} onRun={async (range, filters) => {
        if (!activeScan) return
        const days = parseInt(range)
        const to = new Date()
        const from = new Date(to.getTime() - days * 86400000)
        // Base spec name
        let specName = BUILTIN_SPEC_MAP[activeScan.id] || activeScan.name.toLowerCase().replace(/\s+/g, '-')
        // If AM Push filter is active, use the push variant
        if (filters.includes('am-push') && specName === 'backside-b') {
          specName = 'backside-b-push'
        }
        const runTags = filters.length > 0 ? [...filters] : ['plain']
        try {
          const res = await fetch('/api/scans/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              spec: specName,
              from: from.toISOString().slice(0, 10),
              to: to.toISOString().slice(0, 10),
            }),
          })
          const data = await res.json()
          if (data.error) {
            alert(`Error: ${data.error}`)
          } else {
            const newSignals = (data.signals || []).map((s: any) => ({
              ...s,
              ticker: s.ticker || s.symbol || '',
              symbol: s.ticker || s.symbol || '',
            }))
            setSignals(newSignals)
            setSelectedIdx(0)
            setDayOffset(0)
            // Save run to DB with tags
            try {
              await fetch('/api/scans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: `${activeScan.name} ${from.toISOString().slice(0, 10)} — ${to.toISOString().slice(0, 10)}`,
                  strategy: BUILTIN_SPEC_MAP[activeScan.id] || activeScan.name.toLowerCase().replace(/\s+/g, '-'),  // always the base strategy so runs group under the parent scan
                  type: 'builtin',
                  tags: runTags,
                  results: newSignals,
                  dateRange: JSON.stringify({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }),
                }),
              })
            } catch {}
            // Refresh scans from DB to pick up the new run
            setScans(prev => prev.map(s => s.id === activeScan.id ? { ...s, resultCount: newSignals.length } : s))
          }
        } catch (err: any) {
          alert(`Failed: ${err.message}`)
        }
        setShowRunModal(false)
      }} />}
    </div>
  )
}
