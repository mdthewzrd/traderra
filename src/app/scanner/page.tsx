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

// ─── MiniChart with zoom ────────────────────────────────
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
          bd = new Date(etMs).toISOString().slice(0, 10)
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
        if (typeof b.time === 'number') return new Date(b.time * 1000).toISOString().slice(0, 10)
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
          barDate = etDate.toISOString().slice(0, 10)
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
      if (settings.showVwap && (tf === '5m' || tf === '15m')) {
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
          const bt = bars[i].time
          const bd = typeof bt === 'string' ? bt : (typeof bt === 'number' ? new Date(bt * 1000).toISOString().slice(0, 10) : '')
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

// ─── Stats (unchanged, compact) ─────────────────────────
function StatsPanel({ signals }: { signals: Signal[] }) {
  const stats = useMemo(() => {
    if (!signals.length) return null
    const gaps = signals.map(s => s.gap_pct || 0)
    const abses = signals.map(s => s.pos_abs || 0)
    const vols = signals.map(s => s.volume || 0)
    const closes = signals.map(s => s.close)
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    const minGap = Math.min(...gaps), maxGap = Math.max(...gaps)
    const avgAbs = abses.reduce((a, b) => a + b, 0) / abses.length
    const dates = new Set(signals.map(s => s.date)).size
    const tickers = new Set(signals.map(s => s.ticker)).size
    const byDate: Record<string, number> = {}
    signals.forEach(s => { byDate[s.date] = (byDate[s.date] || 0) + 1 })
    const maxPerDay = Math.max(...Object.values(byDate))
    const avgPerDay = signals.length / dates
    const freq: Record<string, number> = {}
    signals.forEach(s => { freq[s.ticker] = (freq[s.ticker] || 0) + 1 })
    const topTickers = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const gapBuckets = { '<50': 0, '50-100': 0, '100-200': 0, '>200': 0 }
    gaps.forEach(g => { if (g < 50) gapBuckets['<50']++; else if (g < 100) gapBuckets['50-100']++; else if (g < 200) gapBuckets['100-200']++; else gapBuckets['>200']++ })
    const absBuckets = { '<0.25': 0, '0.25-0.50': 0, '0.50-0.75': 0, '>0.75': 0 }
    abses.forEach(a => { if (a < 0.25) absBuckets['<0.25']++; else if (a < 0.5) absBuckets['0.25-0.50']++; else if (a <= 0.75) absBuckets['0.50-0.75']++; else absBuckets['>0.75']++ })
    const d0Chg = signals.map(s => ((s.close - s.open) / s.open) * 100)
    const avgD0Chg = d0Chg.reduce((a, b) => a + b, 0) / d0Chg.length
    const redPct = d0Chg.filter(c => c < 0).length / d0Chg.length * 100
    const d0Range = signals.map(s => ((s.high - s.low) / s.open) * 100)
    const avgD0Range = d0Range.reduce((a, b) => a + b, 0) / d0Range.length
    const rangeVsGap = signals.map(s => (((s.high - s.low) / s.open) * 100) / (s.gap_pct || 1))
    const avgRangeVsGap = rangeVsGap.reduce((a, b) => a + b, 0) / rangeVsGap.length
    const closePosRange = signals.map(s => { const r = s.high - s.low; return r > 0 ? (s.close - s.low) / r : 0.5 })
    const avgClosePos = closePosRange.reduce((a, b) => a + b, 0) / closePosRange.length
    const reversalPct = signals.filter(s => (s.gap_pct || 0) > 0 && ((s.close - s.open) / s.open * 100) < 0).length / signals.length * 100
    const firstHourReversal = signals.filter(s => s.close < s.open).length / signals.length * 100
    return { avgGap, minGap, maxGap, avgAbs, dates, tickers, topTickers, avgPerDay, maxPerDay, gapBuckets, absBuckets, minClose: Math.min(...closes), maxClose: Math.max(...closes), totalVol: vols.reduce((a, b) => a + b, 0), avgD0Chg, redPct, avgD0Range, avgRangeVsGap, avgClosePos, reversalPct, firstHourReversal }
  }, [signals])
  if (!stats) return null
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-1">
        <StatBox label="Signals" value={signals.length.toString()} icon={<Zap className="h-3 w-3" />} />
        <StatBox label="Days" value={stats.dates.toString()} icon={<Calendar className="h-3 w-3" />} />
        <StatBox label="Tickers" value={stats.tickers.toString()} icon={<Hash className="h-3 w-3" />} />
        <StatBox label="Avg/Day" value={stats.avgPerDay.toFixed(1)} icon={<Layers className="h-3 w-3" />} color={TEAL} />
        <StatBox label="Max/Day" value={stats.maxPerDay.toString()} icon={<Activity className="h-3 w-3" />} />
        <StatBox label="Total Vol" value={`$${(stats.totalVol / 1e9).toFixed(1)}B`} icon={<DollarSign className="h-3 w-3" />} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
        <StatBox label="Avg Gap%" value={`${stats.avgGap.toFixed(1)}%`} icon={<TrendingUp className="h-3 w-3" />} color={TEAL} />
        <StatBox label="Gap Range" value={`${stats.minGap.toFixed(0)}-${stats.maxGap.toFixed(0)}%`} icon={<ArrowUpRight className="h-3 w-3" />} />
        <StatBox label="Avg ABS" value={stats.avgAbs.toFixed(3)} icon={<Target className="h-3 w-3" />} color={GOLD} />
        <StatBox label="Price" value={`$${stats.minClose.toFixed(0)}-$${stats.maxClose.toFixed(0)}`} icon={<DollarSign className="h-3 w-3" />} />
      </div>
      <div style={{ background: SURFACE, border: `1px solid ${GOLD_BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
          <TrendingDown className="h-3 w-3" style={{ color: RED }} />
          <span style={{ color: RED, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Short & Mean Reversion</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-1">
          <StatBox label="Avg D0 Chg" value={`${stats.avgD0Chg > 0 ? '+' : ''}${stats.avgD0Chg.toFixed(1)}%`} icon={<TrendingDown className="h-3 w-3" />} color={stats.avgD0Chg < 0 ? RED : TEAL} />
          <StatBox label="% Red" value={`${stats.redPct.toFixed(0)}%`} icon={<Minus className="h-3 w-3" />} color={RED} />
          <StatBox label="Range%" value={`${stats.avgD0Range.toFixed(1)}%`} icon={<Activity className="h-3 w-3" />} color={GOLD} />
          <StatBox label="Rng/Gap" value={`${stats.avgRangeVsGap.toFixed(2)}x`} icon={<BarChart3 className="h-3 w-3" />} />
          <StatBox label="Close Pos" value={stats.avgClosePos.toFixed(2)} icon={<Target className="h-3 w-3" />} color={stats.avgClosePos < 0.5 ? RED : TEAL} />
          <StatBox label="Reversal" value={`${stats.reversalPct.toFixed(0)}%`} icon={<TrendingDown className="h-3 w-3" />} color={RED} />
          <StatBox label="1H Rev" value={`${stats.firstHourReversal.toFixed(0)}%`} icon={<Clock className="h-3 w-3" />} color={GOLD} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1">
        <DistBar title="Gap Dist" buckets={stats.gapBuckets} total={signals.length} color={TEAL} />
        <DistBar title="ABS Position" buckets={stats.absBuckets} total={signals.length} color={GOLD} />
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 8 }}>
          <div style={{ color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Top Tickers</div>
          {stats.topTickers.map(([ticker, count]) => (
            <div key={ticker} className="flex items-center justify-between" style={{ marginBottom: 2 }}>
              <span style={{ color: GOLD, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>{ticker}</span>
              <span style={{ color: TEXT2, fontSize: 10 }}>{count}x</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DistBar({ title, buckets, total, color }: { title: string; buckets: Record<string, number>; total: number; color: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: 8 }}>
      <div style={{ color: MUTED, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{title}</div>
      {Object.entries(buckets).map(([label, count]) => (
        <div key={label} className="flex items-center gap-1.5" style={{ marginBottom: 3 }}>
          <span style={{ color: TEXT2, fontSize: 9, width: 40, fontFamily: 'monospace' }}>{label}</span>
          <div style={{ flex: 1, height: 10, background: SURFACE3, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(count / total) * 100}%`, background: color, borderRadius: 2, minWidth: count > 0 ? 2 : 0 }} />
          </div>
          <span style={{ color: MUTED, fontSize: 9, width: 16, textAlign: 'right' }}>{count}</span>
        </div>
      ))}
    </div>
  )
}
function StatBox({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 8px' }}>
      <div className="flex items-center gap-1" style={{ color: MUTED, fontSize: 8 }}>{icon}{label}</div>
      <div style={{ color: color || GOLD, fontSize: 13, fontWeight: 700 }}>{value}</div>
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
export default function ScanDashboardPage() {
  const [scans, setScans] = useState<ScanDef[]>([])
  const [selectedScan, setSelectedScan] = useState<string>('')
  const [signals, setSignals] = useState<Signal[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [tf, setTf] = useState<Timeframe>('D')
  const [chartMode, setChartMode] = useState<ChartMode>('single')
  const [loading, setLoading] = useState(false)
  const [showRunModal, setShowRunModal] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [selectedRun, setSelectedRun] = useState<string>('r1')
  const [showSettings, setShowSettings] = useState(false)
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    showEma9_20: true, showEma72_89: true, showDevBands: true,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: true,
  })
  const [dark, setDark] = useState(true)
  const [dayOffset, setDayOffset] = useState(0)
  const T = useThemeColors(dark)
  // Mock runs for demo
  const [runs] = useState<ScanRun[]>([
    { id: 'r1', scanId: '', dateRange: '90d', runAt: '2025-01-15 14:32', resultCount: 52 },
    { id: 'r2', scanId: '', dateRange: '30d', runAt: '2025-01-14 09:10', resultCount: 18 },
    { id: 'r3', scanId: '', dateRange: '7d', runAt: '2025-01-13 16:45', resultCount: 4 },
  ])

  useEffect(() => {
    fetch('/api/scans')
      .then(r => r.json())
      .then(data => {
        const list = (data.scans || []).filter((s: ScanDef) => s.resultCount > 0)
        setScans(list)
        if (list.length && !selectedScan) setSelectedScan(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selectedScan) return
    setLoading(true)
    fetch(`/api/scans/${selectedScan}`)
      .then(r => r.json())
      .then(data => { setSignals(data.results || []); setSelectedIdx(0); setDayOffset(0); setLoading(false) })
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
                  <span style={{ color: MUTED, fontSize: 8 }}>{scan.type}</span>
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

      {/* ── Bottom half: Saved Runs ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: GOLD, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Runs</span>
            <span style={{ color: MUTED, fontSize: 9 }}>{runs.length}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
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
                <span style={{ color: isActive ? GOLD : TEXT2, fontSize: 10, fontWeight: 600 }}>{run.dateRange}</span>
                <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: `${TEAL}20`, color: TEAL }}>{run.resultCount}</span>
              </div>
              <div style={{ color: isActive ? GOLD : MUTED, fontSize: 8, marginTop: 2 }}>{run.runAt}</div>
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
      {showRunModal && <RunModal scan={activeScan} onClose={() => setShowRunModal(false)} onRun={(range) => {
        // TODO: wire to scan API
        setTimeout(() => setShowRunModal(false), 1000)
      }} />}
    </div>
  )
}
