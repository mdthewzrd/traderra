'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useLiveBars } from '@/hooks/useLiveBars'
import { useChartStore } from '@/stores/charts/chartStore'
import { useUIStore } from '@/stores/charts/uiStore'
import { renderPanelSetup } from '@/lib/charts/render-panel'
import { renderGrid, renderPriceAxis, renderTimeAxis } from '@/lib/charts/render-grid'
import { renderVolume } from '@/lib/charts/render-volume'
import { renderCandles } from '@/lib/charts/render-candles'
import { renderLivePriceLine } from '@/lib/charts/render-price-line'
import { renderCrosshair } from '@/lib/charts/render-crosshair'
import { drawLine, drawBandFill, drawBandLines, drawEMABand, drawDevBand } from '@/lib/charts/render-indicators'
import { computeIndicators } from '@/lib/charts/indicators'
import { renderSessionShading } from '@/lib/charts/render-session'
import { renderAnnotations } from '@/lib/charts/render-annotations'
import { renderAnnotationPreview } from '@/lib/charts/render-preview'
import { renderBtMarkers } from '@/lib/charts/render-bt-markers'
import { calcExecSignals, type ExecSignal } from '@/lib/charts/exec-signals'
import { renderPivotZones } from '@/lib/charts/render-pzones'
import { isIntraday } from '@/lib/charts/format'
import { C } from '@/lib/charts/theme'
import { useIndicatorStore } from '@/stores/charts/indicatorStore'
import { useDrawingStore } from '@/stores/charts/drawingStore'
import { useToolStore } from '@/stores/charts/toolStore'
import type { RenderContext } from '@/lib/charts/render-types'

// Read indicator state from Zustand store
function getLiveInds(): Record<string, boolean> {
  return { ...useIndicatorStore.getState().inds }
}

// Mike's deviation band parameters
const MIKE_DEV = {
  s_9_20: { fast: 9, slow: 20, up: [0.5, 1], dn: [2, 2.4] },
  db_72_89: { fast: 72, slow: 89, up: [6.9, 9.6], dn: [6.9, 9.6] },
}

/**
 * ReactChartPanel — pure React canvas panel replacing charts-engine.js.
 *
 * Renders: grid, axes, candles, volume, indicators (EMA/SMA/VWAP/BB/bands),
 * live price line, crosshair with OHLCV tooltip.
 * Pan by dragging, zoom with scroll wheel.
 */
export function ReactChartPanel({ panelIdx }: { panelIdx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const rcRef = useRef<RenderContext | null>(null)

  // Store state
  const symbol = useChartStore(s => s.symbol)
  const panel = useChartStore(s => s.panels[panelIdx])
  const tf = panel?.tf || 'D'
  const chartStyle = useUIStore(s => s.chartStyle)
  const liveMode = useUIStore(s => s.liveMode)
  const fullscreenPanel = useUIStore(s => s.fullscreenPanel)

  // Drawing state (subscribed for render bridge)
  const annotations = useDrawingStore(s => s.annotations)
  const activeTool = useDrawingStore(s => s.activeTool)
  const toolStep = useDrawingStore(s => s.toolStep)
  const toolAnchor = useDrawingStore(s => s.toolAnchor)
  const selectedAnn = useDrawingStore(s => s.selectedAnn)
  const hideAll = useDrawingStore(s => s.hideAll)

  // Viewport state
  const [viewStart, setViewStart] = useState(0)
  const [viewBars, setViewBars] = useState(200)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Mouse state
  const mouseRef = useRef({ x: -1, y: -1 })
  const [mouse, setMouse] = useState({ x: -1, y: -1 })
  const [ohlcvTip, setOhlcvTip] = useState<{ x: number; y: number; bar: any } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, vs: 0 })
  const drawingDragRef = useRef<{ startX: number; startTime: number; startPrice: number } | null>(null)

  // Fetch bars (with live polling when liveMode is on)
  const focusDate = useChartStore(s => s.focusDate)
  const { bars, loading } = useLiveBars(symbol, tf, focusDate)

  // Fetch 2m bars for trail stop overlay when on higher TFs
  const trailStopOn = useToolStore(s => s.tools.find((t: any) => t.indKey === 'trail_stop')?.on ?? false)
  const { bars: bars2m } = useLiveBars(
    (tf !== '2' && trailStopOn) ? symbol : null,
    '2',
    focusDate
  )
  const trail2mRef = useRef<(number | null)[] | null>(null)

  // Canvas screenshot utility
  const screenshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${symbol}-${tf}-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  }, [symbol, tf])

  // Expose screenshot globally for TopBar
  useEffect(() => {
    ;(window as any).chartScreenshot = screenshot
    return () => { delete (window as any).chartScreenshot }
  }, [screenshot])

  // Load annotations when symbol changes
  useEffect(() => {
    if (symbol) useDrawingStore.getState().loadAnnotations(symbol)
  }, [symbol])

  // Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y redo, Escape cancel drawing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const ds = useDrawingStore.getState()
        if (ds.activeTool) {
          ds.setActiveTool(null)
        } else if (ds.selectedAnn) {
          ds.setSelectedAnn(null)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useDrawingStore.getState().undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useDrawingStore.getState().redo()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ds = useDrawingStore.getState()
        if (ds.selectedAnn) {
          ds.removeAnnotation(ds.selectedAnn.id)
          ds.setSelectedAnn(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Live indicator state from Zustand store (polled for header dots)
  const liveIndsRef = useRef(getLiveInds())
  useEffect(() => {
    const interval = setInterval(() => {
      liveIndsRef.current = getLiveInds()
    }, 200)
    return () => clearInterval(interval)
  }, [])
  const liveInds = useIndicatorStore((s) => s.inds)

  // ResizeObserver — contentRect gives unzoomed CSS pixels for canvas sizing
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        setSize({ w: Math.floor(width), h: Math.floor(height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Set canvas pixel buffer + CSS size (must match exactly)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    const pw = Math.floor(size.w * dpr)
    const ph = Math.floor(size.h * dpr)
    canvas.width = pw
    canvas.height = ph
    canvas.style.width = size.w + 'px'
    canvas.style.height = size.h + 'px'
  }, [size])

  // Auto-fit to latest bars
  useEffect(() => {
    if (bars.length > 0) {
      setViewStart(Math.max(0, bars.length - viewBars))
    }
  }, [bars])

  // ── RENDER ──
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0 || bars.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    try {
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Read live indicator state from legacy engine
      const inds = liveIndsRef.current

      const rc = renderPanelSetup({
        canvas, ctx,
        data: bars,
        W: size.w,
        H: size.h,
        PRICE_W: 70,
        TIME_H: 22,
        viewStart,
        viewBars,
        cx: mouse.x,
        cy: mouse.y,
        tf,
        inds,
        volFrac: 0.20,
        priceScale: 1,
      })

      if (!rc) return

      // Bridge globals
      ;(window as any)._chartStyle = chartStyle
      ;(window as any).showPriceLine = useUIStore.getState().showPriceLine
      ;(window as any)._barsVisible = useUIStore.getState().barsVisible
      ;(window as any).globalCrossTime = useChartStore.getState().globalCrossTime
      ;(window as any).globalCrossPrice = useChartStore.getState().globalCrossPrice

      // Update ticker info in TopBar
      if (panelIdx === 0 && rc.visible.length > 0) {
        const last = rc.visible[rc.visible.length - 1]
        if (last) {
          const symEl = document.getElementById('ti-sym')
          const priceEl = document.getElementById('ti-price')
          const chgEl = document.getElementById('ti-chg')
          if (symEl) symEl.textContent = symbol
          if (priceEl) priceEl.textContent = `$${last.close.toFixed(2)}`
          if (chgEl && rc.visible.length > 1) {
            const prev = rc.visible[rc.visible.length - 2]
            const chg = last.close - prev.close
            const pct = prev.close > 0 ? ((chg / prev.close) * 100).toFixed(2) : '0.00'
            const col = chg >= 0 ? '#26a69a' : '#ef5350'
            chgEl.innerHTML = `<span style="color:${col}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)} (${pct}%)</span>`
          }
        }
      }

      // Bridge drawing state for annotation renderer
      ;(window as any).annotations = annotations
      ;(window as any).activeTool = activeTool
      ;(window as any).selectedAnn = selectedAnn
      ;(window as any)._hideAll = hideAll
      ;(window as any).toolAnchor = toolAnchor ? { time: toolAnchor.x, price: toolAnchor.y, panelIdx } : null
      ;(window as any).toolStep = toolStep === 1 ? 'second' : 'idle'

      // Panel display toggles
      ;(rc as any).showPDC = useUIStore.getState().showPDC
      ;(rc as any).showTL = true
      ;(rc as any).showAnn = true
      ;(rc as any).showExec = true
      ;(rc as any).showOtherAnn = true
      ;(rc as any).showBtExec = true
      ;(rc as any).idx = panelIdx

      // Store rc for mouse handler coordinate conversion
      rcRef.current = rc

      // Compute all indicators for this frame — pass tool overrides for param control
      const activeTools = useToolStore.getState().tools.filter((t: any) => t.on)
      const toolOverrides = activeTools.map((t: any) => ({ indKey: t.indKey, params: t.params, colors: t.colors }))
      const ic = computeIndicators(bars, inds, tf, toolOverrides)

      // Compute 2m trail stop overlay when on higher TF
      if (tf !== '2' && inds.trail_stop && bars2m.length > 0) {
        const tsTool = toolOverrides.find((t: any) => t.indKey === 'trail_stop')
        const fastP = tsTool?.params?.fast ?? 9
        const slowP = tsTool?.params?.slow ?? 20
        const bandMult = tsTool?.params?.band_mult ?? 1.0
        const lookback = tsTool?.params?.lookback ?? 5
        const ic2m = computeIndicators(bars2m, inds, '2', toolOverrides)
        // Map 2m trail values onto current chart bars
        // For each chart bar, find the last 2m bar within its candle
        const mapped: (number | null)[] = []
        for (let i = 0; i < bars.length; i++) {
          const barEnd = bars[i].time * 1000
          let best: number | null = null
          for (let j = 0; j < bars2m.length; j++) {
            if (bars2m[j].time * 1000 > barEnd) break
            if (ic2m.trailStop && ic2m.trailStop[j] != null) best = ic2m.trailStop[j]
          }
          mapped.push(best)
        }
        trail2mRef.current = mapped
      } else if (tf === '2') {
        trail2mRef.current = null // 2m chart uses native trail stop
      }

      // Helper: get tool color override or fall back to theme default
      const toolColor = (indKey: string, colorKey: string, fallback: string): string => {
        const tool = activeTools.find((t: any) => t.indKey === indKey)
        return tool?.colors?.[colorKey] || fallback
      }

      // ── Grid + Axes ──
      const { niceStep, gridMinP } = renderGrid(rc)
      renderPriceAxis(rc, niceStep, gridMinP)
      renderTimeAxis(rc)

      // ── Session shading (intraday only) ──
      if (isIntraday(tf)) renderSessionShading(rc)

      // ── Target line (vertical dashed line at target date) ──
      const showTarget = useUIStore.getState().showTarget
      const targetDate = useUIStore.getState().targetDate
      if (showTarget && targetDate && rc.visible.length > 0) {
        const targetTs = isIntraday(tf)
          ? Math.floor(new Date(targetDate + 'T09:30:00-05:00').getTime() / 1000)
          : null
        if (targetTs != null) {
          const tx = rc.annTimeToX(targetTs)
          if (tx != null && tx >= 0 && tx <= rc.chartW) {
            ctx.strokeStyle = 'rgba(251,191,36,0.6)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([6, 4])
            ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx, rc.priceH); ctx.stroke()
            ctx.setLineDash([])
            // Label
            ctx.font = 'bold 9px Inter'
            ctx.fillStyle = '#fbbf24'
            ctx.textAlign = 'center'
            ctx.fillText('TARGET', tx, 10)
            ctx.textAlign = 'left'
          }
        }
      }

      // ── Volume ──
      renderVolume(rc)

      // ── Volume SMA ──
      if (inds.sma_vol && ic.volSma) {
        drawLine(rc, ic.volSma, toolColor('sma_vol', 'color', C.vol_sma_color), 1.5)
      }

      // ── Indicators (bands first, then lines, so lines draw on top) ──

      // EMA 40/60 band
      if (inds.ema40_60 && ic.ema[40] && ic.ema[60]) {
        drawEMABand(rc, ic.ema[40], ic.ema[60],
          C.ema40_60_fill, C.ema40_60_fill, C.ema40_60_line, C.ema40_60_line)
      }

      // EMA 9/20 band — green bull / red bear
      if (inds.band_9_20 && ic.ema[9] && ic.ema[20]) {
        drawEMABand(rc, ic.ema[9], ic.ema[20],
          'rgba(34,197,94,.15)', 'rgba(239,68,68,.15)',
          'rgba(34,197,94,.50)', 'rgba(239,68,68,.50)')
      }

      // EMA 72/89 band — green bull / red bear
      if (inds.band_72_89 && ic.ema[72] && ic.ema[89]) {
        drawEMABand(rc, ic.ema[72], ic.ema[89],
          'rgba(34,197,94,.15)', 'rgba(239,68,68,.15)',
          'rgba(34,197,94,.50)', 'rgba(239,68,68,.50)')
      }

      // Deviation band short (9/20) — red upper, green lower
      if (inds.dev_s_9_20 && ic.ema[9] && ic.atr[9] && ic.ema[20] && ic.atr[20]) {
        const d = MIKE_DEV.s_9_20
        drawDevBand(rc,
          ic.ema[d.fast], ic.atr[d.fast],
          ic.ema[d.slow], ic.atr[d.slow],
          d.up, d.dn,
          'rgba(239,68,68,.15)', 'rgba(239,68,68,.40)',
          'rgba(34,197,94,.15)', 'rgba(34,197,94,.40)',
        )
      }

      // Deviation band 72/89 — red upper, green lower
      if (inds.db_72_89 && ic.ema[72] && ic.atr[72] && ic.ema[89] && ic.atr[89]) {
        const d = MIKE_DEV.db_72_89
        drawDevBand(rc,
          ic.ema[d.fast], ic.atr[d.fast],
          ic.ema[d.slow], ic.atr[d.slow],
          d.up, d.dn,
          'rgba(239,68,68,.15)', 'rgba(239,68,68,.40)',
          'rgba(34,197,94,.15)', 'rgba(34,197,94,.40)',
        )
      }

      // Trail Stop — swing-structure + dev band (solid green)
      if (panelIdx === 0 && inds.trail_stop) {
        const tsTool = activeTools.find((t: any) => t.indKey === 'trail_stop')
        const trailColor = tsTool?.colors?.color || '#4ade80'
        // Use 2m overlay when on higher TF, native when on 2m
        const trailData = tf === '2' ? ic.trailStop : trail2mRef.current
        if (trailData) drawLine(rc, trailData, trailColor, 1.6, false)
      }

      // Bollinger Bands
      if (inds.bollinger && ic.bollinger) {
        drawBandFill(rc, ic.bollinger.upper, ic.bollinger.lower, C.bb_fill)
        drawBandLines(rc, ic.bollinger.upper, ic.bollinger.lower, C.bb_upper)
        drawLine(rc, ic.bollinger.middle, C.bb_upper, 1)
      }

      // DB upper (EMA9 + ATR9 band above price) — orange
      if (inds.db_upper && ic.ema[9] && ic.atr[9]) {
        const upper = ic.ema[9].map((v, i) => v != null && ic.atr[9]![i] != null ? v + (ic.atr[9]![i] || 0) : null)
        const lower = ic.ema[9].map((v, i) => v != null && ic.atr[9]![i] != null ? v + (ic.atr[9]![i] || 0) * 0.5 : null)
        drawBandFill(rc, upper, lower, C.db_upper_fill)
        drawBandLines(rc, upper, lower, C.db_upper_line)
      }

      // DB low1 (EMA20 + ATR20) — yellow
      if (inds.db_low1 && ic.ema[20] && ic.atr[20]) {
        const upper = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v - (ic.atr[20]![i] || 0) * 0.5 : null)
        const lower = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v - (ic.atr[20]![i] || 0) : null)
        drawBandFill(rc, upper, lower, C.db_low1_fill)
        drawBandLines(rc, upper, lower, C.db_low1_line)
      }

      // DB low2 (EMA20 + ATR20 wider) — blue
      if (inds.db_low2 && ic.ema[20] && ic.atr[20]) {
        const upper = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v - (ic.atr[20]![i] || 0) * 2 : null)
        const lower = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v - (ic.atr[20]![i] || 0) * 2.5 : null)
        drawBandFill(rc, upper, lower, C.db_low2_fill)
        drawBandLines(rc, upper, lower, C.db_low2_line)
      }

      // ── Indicator lines (on top of bands) ──

      // EMA lines
      if (inds.ema9 && ic.ema[9])   drawLine(rc, ic.ema[9],  toolColor('ema9', 'color', C.ema9), 1.4)
      if (inds.ema20 && ic.ema[20]) drawLine(rc, ic.ema[20], toolColor('ema20', 'color', C.ema20), 1.4)
      if (inds.ema50 && ic.ema[50]) drawLine(rc, ic.ema[50], toolColor('ema50', 'color', C.ema50), 1.4)
      if (inds.ema150 && ic.ema[150]) drawLine(rc, ic.ema[150], toolColor('ema150', 'color', C.ema150), 1.0)
      if (inds.ema200 && ic.ema[200]) drawLine(rc, ic.ema[200], toolColor('ema200', 'color', C.ema200), 1.0)

      // VWAP
      if (inds.vwap && ic.vwap) {
        drawLine(rc, ic.vwap, toolColor('vwap', 'color', C.vwap), 1.6)
      }

      // SMA
      if (inds.sma && ic.sma[20]) {
        drawLine(rc, ic.sma[20], toolColor('sma', 'color', C.sma_color), 1.4)
      }

      // ── Pivot Zones (pzones) ──
      if (inds.pzones) renderPivotZones(rc)

      // ── Candles ──
      renderCandles(rc)

      // ── Annotations (drawings) ──
      renderAnnotations(rc)

      // ── Backtest markers ──
      renderBtMarkers(rc)
      // ── Exec signals (entry/cover/stop markers) ──
      if (panelIdx === 0 && tf === '2' && inds.trail_stop && ic.ema[9] && ic.ema[20] && ic.atr[9]) {
        const execSigs = calcExecSignals(bars, ic.ema[9], ic.ema[20], ic.atr[9])
        const { ctx, barW, pToY, visible } = rc
        ctx.save()
        ctx.beginPath(); ctx.rect(0, 0, (rc as any).chartW, (rc as any).priceH); ctx.clip()
        for (const sig of execSigs) {
          const visIdx = sig.barIdx - rc.viewStart
          if (visIdx < 0 || visIdx >= visible.length) continue
          const x = (visIdx + 0.5) * barW
          const y = pToY(sig.price)
          const size = 7
          if (sig.type === 'entry') {
            // ▼ Short wedge (red)
            ctx.beginPath()
            ctx.moveTo(x, y - size - 2); ctx.lineTo(x + size, y + 2); ctx.lineTo(x - size, y + 2)
            ctx.closePath(); ctx.fillStyle = '#ff5252'; ctx.fill()
            // Stop line above
            if (sig.stopPrice) {
              const sy = pToY(sig.stopPrice)
              const halfW = Math.max(14, barW * 2.5)
              ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2])
              ctx.beginPath(); ctx.moveTo(x - halfW, sy); ctx.lineTo(x + halfW, sy); ctx.stroke()
              ctx.setLineDash([])
            }
          } else if (sig.type === 'cover-recycle' || sig.type === 'cover-full') {
            // ▲ Cover wedge (green)
            ctx.beginPath()
            ctx.moveTo(x, y + size + 2); ctx.lineTo(x + size, y - 2); ctx.lineTo(x - size, y - 2)
            ctx.closePath()
            ctx.fillStyle = sig.type === 'cover-recycle' ? '#4ade80' : '#00e676'
            ctx.fill()
          } else if (sig.type === 'stop') {
            // ■ Stop hit (yellow dash)
            const halfW = Math.max(14, barW * 2.5)
            ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.setLineDash([])
            ctx.beginPath(); ctx.moveTo(x - halfW, y); ctx.lineTo(x + halfW, y); ctx.stroke()
          }
        }
        ctx.restore()
      }

      // ── Live Price Line ──
      renderLivePriceLine(rc)

      // ── Annotation preview (while drawing) ──
      if (activeTool && toolStep > 0) renderAnnotationPreview(rc)

      // ── Highlight drag preview ──
      const dd = drawingDragRef.current
      if (dd && activeTool && rc.cx >= 0 && rc.cy >= 0 && rc.cy <= rc.priceH) {
        const toolColorMap: Record<string, string> = {
          hl_cyan: '#22d3ee', hl_magenta: '#e879f9', hl_green: '#4ade80', hl_white: '#cbd5e1',
        }
        const col = toolColorMap[activeTool]
        if (col) {
          const ax = rc.annTimeToX(dd.startTime)
          const ay = rc.pToY(dd.startPrice)
          if (ax != null) {
            const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16)
            ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
            ctx.fillRect(Math.min(ax, rc.cx), Math.min(ay, rc.cy), Math.abs(rc.cx - ax), Math.abs(rc.cy - ay))
            ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`
            ctx.lineWidth = 1
            ctx.setLineDash([4, 3])
            ctx.strokeRect(Math.min(ax, rc.cx), Math.min(ay, rc.cy), Math.abs(rc.cx - ax), Math.abs(rc.cy - ay))
            ctx.setLineDash([])
          }
        }
      }

      // ── Crosshair ──
      renderCrosshair(rc)

      // ── Loading overlay ──
      if (loading) {
        ctx.fillStyle = 'rgba(12,14,20,0.75)'
        ctx.fillRect(0, 0, size.w, size.h)
        ctx.fillStyle = '#6a80a0'
        ctx.font = 'bold 14px Inter,system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('LOADING…', size.w / 2, size.h / 2)
      }
    } catch (err: any) {
      cancelAnimationFrame(animRef.current)
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0c0e14'
      ctx.fillRect(0, 0, size.w, size.h)
      ctx.fillStyle = '#ef5350'
      ctx.font = '13px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('React Panel Error:', 10, 30)
      ctx.fillStyle = '#dde3f0'
      const msg = err?.message || String(err)
      ctx.fillText(msg.substring(0, 80), 10, 50)
      if (err?.stack) {
        const line = err.stack.split('\n').find((l: string) => l.includes('render-') || l.includes('indicators'))
        if (line) ctx.fillText(line.trim().substring(0, 100), 10, 70)
      }
      console.error('[ReactChartPanel] render error:', err)
    }
  }, [bars, viewStart, viewBars, mouse, size, chartStyle, tf, symbol, loading, annotations, activeTool, toolStep, toolAnchor, selectedAnn, hideAll])

  // Animation loop
  useEffect(() => {
    const loop = () => {
      render()
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [render])

  // ── MOUSE EVENTS ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const ds = useDrawingStore.getState()

    // Drawing mode — capture clicks for annotation placement
    if (ds.activeTool && rcRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const rc = rcRef.current
      if (my > rc.priceH) return // ignore clicks on volume area

      const price = rc.minP + rc.priceRange * (1 - my / rc.priceH)
      const bi = Math.max(0, Math.min(rc.visible.length - 1, Math.round(mx / rc.barW - 0.5)))
      const time = rc.visible[bi]?.time
      if (time == null) return

      const TWO_CLICK = ['trendline','ray','hray','parallel','disjoint','xline','fib_ret','box_orange','box_yellow','long_pos','short_pos','circle','ellipse','triangle','callout']
      const DRAG_TOOLS = ['hl_cyan','hl_magenta','hl_green','hl_white','brush','path']
      const isTwoClick = TWO_CLICK.includes(ds.activeTool)
      const isDragTool = DRAG_TOOLS.includes(ds.activeTool)

      // Drag-based tools (highlights, brush) — start drag
      if (isDragTool) {
        drawingDragRef.current = { startX: mx, startTime: time, startPrice: price }
        return
      }

      if (isTwoClick && ds.toolStep === 0) {
        ds.setToolAnchor({ x: time, y: price })
        ds.setToolStep(1)
        return
      }

      if (isTwoClick && ds.toolStep === 1 && ds.toolAnchor) {
        ds.addAnnotation({
          id: ds.getNextId(),
          type: ds.activeTool,
          x1: ds.toolAnchor.x, y1: ds.toolAnchor.y,
          x2: time, y2: price,
          color: ds.drawDefaults.color,
          lineWidth: ds.drawDefaults.lineWidth,
          opacity: ds.drawDefaults.opacity,
          panelIdx,
          locked: false, visible: true, hidden: false,
          points: [{ x: ds.toolAnchor.x, y: ds.toolAnchor.y }, { x: time, y: price }],
          text: '',
          lineStyle: ds.drawDefaults.dashed ? 'dashed' : 'solid',
        } as any)
        if (!ds.stayDraw) ds.setActiveTool(null)
        else { ds.setToolStep(0); ds.setToolAnchor(null) }
        return
      }

      // Single-click tools (text, arrow, hline, vline, stop_line, trail_stop, etc.)
      if (!isTwoClick && !isDragTool) {
        let text = ''
        if (ds.activeTool.startsWith('text_')) {
          text = prompt('Annotation text:') || 'Text'
        }
        ds.addAnnotation({
          id: ds.getNextId(),
          type: ds.activeTool,
          x1: time, y1: price,
          color: ds.drawDefaults.color,
          lineWidth: ds.drawDefaults.lineWidth,
          opacity: ds.drawDefaults.opacity,
          text: ds.activeTool.startsWith('text_') ? text : '',
          panelIdx,
          locked: false, visible: true, hidden: false,
          points: [{ x: time, y: price }],
          lineStyle: ds.drawDefaults.dashed ? 'dashed' : 'solid',
        } as any)
        if (!ds.stayDraw) ds.setActiveTool(null)
        return
      }
      return
    }

    // Pan mode
    setDragging(true)
    dragStart.current = { x: e.clientX, vs: viewStart }
  }, [viewStart, panelIdx])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!canvas || !rect) return
    // canvas.style.width is set from contentRect (unzoomed CSS px).
    // getBoundingClientRect returns zoomed CSS px.
    // The ratio tells us the effective zoom so we can map mouse -> canvas coords.
    const cssW = parseFloat(canvas.style.width) || rect.width
    const cssH = parseFloat(canvas.style.height) || rect.height
    const scaleX = cssW / rect.width
    const scaleY = cssH / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY
    mouseRef.current = { x: mx, y: my } as any
    setMouse({ x: mx, y: my })

    // OHLCV tooltip on right-button hold
    if (e.buttons === 2 && rcRef.current && bars.length) {
      const rc = rcRef.current
      const bi = Math.max(0, Math.min(rc.visible.length - 1, Math.round(mx / rc.barW - 0.5)))
      const bar = rc.visible[bi]
      if (bar) setOhlcvTip({ x: e.clientX + 12, y: e.clientY - 10, bar })
    } else {
      if (ohlcvTip) setOhlcvTip(null)
    }

    if (dragging) {
      const dx = e.clientX - dragStart.current.x
      const barW = size.w > 0 ? (size.w - 70) / viewBars : 10
      const barsMoved = Math.round(dx / barW)
      const newVs = dragStart.current.vs - barsMoved
      setViewStart(Math.max(0, Math.min(bars.length - viewBars, newVs)))
    }

    // Crosshair sync
    if (!dragging && rcRef.current && my >= 0 && my <= rcRef.current.priceH) {
      const rc = rcRef.current
      const price = rc.minP + rc.priceRange * (1 - my / rc.priceH)
      const bi = Math.max(0, Math.min(rc.visible.length - 1, Math.round(mx / rc.barW - 0.5)))
      const time = rc.visible[bi]?.time
      if (time != null) useChartStore.getState().setCrosshair(time, price)
    }
  }, [dragging, viewBars, bars.length, size.w, ohlcvTip])

  const onMouseUp = useCallback(() => {
    // Finalize drag-based annotation (highlights)
    if (drawingDragRef.current && activeTool && rcRef.current) {
      const rc = rcRef.current
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      if (my >= 0 && my <= rc.priceH) {
        const endPrice = rc.minP + rc.priceRange * (1 - my / rc.priceH)
        const bi = Math.max(0, Math.min(rc.visible.length - 1, Math.round(mx / rc.barW - 0.5)))
        const endTime = rc.visible[bi]?.time
        const drag = drawingDragRef.current
        if (endTime != null && drag) {
          const ds = useDrawingStore.getState()
          // Get the color from theme
          const toolColorMap: Record<string, string> = {
            hl_cyan: '#22d3ee', hl_magenta: '#e879f9', hl_green: '#4ade80', hl_white: '#cbd5e1',
            brush: '#94a3b8', path: '#94a3b8',
          }
          ds.addAnnotation({
            id: ds.getNextId(),
            type: ds.activeTool,
            x1: drag.startTime, y1: drag.startPrice,
            x2: endTime, y2: endPrice,
            color: toolColorMap[ds.activeTool] || ds.drawDefaults.color,
            lineWidth: ds.drawDefaults.lineWidth,
            opacity: 0.15,
            panelIdx,
            locked: false, visible: true, hidden: false,
            points: [{ x: drag.startTime, y: drag.startPrice }, { x: endTime, y: endPrice }],
            lineStyle: 'solid',
          } as any)
          if (!ds.stayDraw) ds.setActiveTool(null)
        }
      }
      drawingDragRef.current = null
      return
    }
    setDragging(false)
  }, [activeTool, panelIdx])

  const onMouseLeave = useCallback(() => {
    setDragging(false)
    setMouse({ x: -1, y: -1 })
    mouseRef.current = { x: -1, y: -1 }
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const zoomSens = useUIStore.getState().zoomSens
    const delta = e.deltaY > 0 ? Math.round(15 * zoomSens / 0.15) : -Math.round(15 * zoomSens / 0.15)
    setViewBars(prev => Math.max(20, Math.min(bars.length || 500, prev + delta)))
  }, [bars.length])

  // TF label
  const tfLabel = tf === 'D' ? 'Daily' : tf === 'W' ? 'Weekly' : tf + 'm'

  // Apply date range handler
  const handleApplyDateRange = useCallback((pIdx: number, allPanels = false) => {
    const fromEl = document.getElementById(`from-${pIdx}`) as HTMLInputElement
    const toEl = document.getElementById(`to-${pIdx}`) as HTMLInputElement
    const backEl = document.getElementById(`back-${pIdx}`) as HTMLInputElement
    const fwdEl = document.getElementById(`fwd-${pIdx}`) as HTMLInputElement
    const tgtEl = document.getElementById(`tgt-${pIdx}`) as HTMLInputElement
    if (!fromEl && !toEl) return

    const fromDate = fromEl?.value
    const toDate = toEl?.value
    const backDays = backEl?.value ? parseInt(backEl.value) : 0
    const fwdDays = fwdEl?.value ? parseInt(fwdEl.value) : 0
    const targetDate = tgtEl?.value

    // Target line
    if (targetDate) {
      useUIStore.getState().setTargetDate(targetDate)
      useUIStore.getState().setShowTarget(true)
    }

    // Compute the effective date range
    const barToDateStr = (b: any) => typeof b.time === 'string' ? b.time : new Date(b.time * 1000).toISOString().split('T')[0]

    const applyToPanel = (panelBars: any[], setVS: (v: number) => void, vb: number) => {
      if (!panelBars.length) return
      let startIdx = 0
      let endIdx = panelBars.length

      if (fromDate) {
        const idx = panelBars.findIndex(b => barToDateStr(b) >= fromDate)
        if (idx >= 0) startIdx = idx
      }
      if (toDate) {
        const idx = panelBars.findIndex(b => barToDateStr(b) > toDate)
        if (idx >= 0) endIdx = idx
      }

      // Expand by BACK days
      if (backDays > 0 && startIdx > 0) {
        const fromDateMs = new Date(fromDate || barToDateStr(panelBars[startIdx])).getTime()
        const backMs = backDays * 86400000
        const targetMs = fromDateMs - backMs
        const backIdx = panelBars.findIndex(b => new Date(barToDateStr(b)).getTime() >= targetMs)
        if (backIdx >= 0) startIdx = backIdx
      }

      // Expand by FWD days
      if (fwdDays > 0 && endIdx < panelBars.length) {
        const toDateMs = new Date(toDate || barToDateStr(panelBars[endIdx - 1])).getTime()
        const fwdMs = fwdDays * 86400000
        const targetMs = toDateMs + fwdMs
        const fwdIdx = panelBars.findIndex(b => new Date(barToDateStr(b)).getTime() > targetMs)
        endIdx = fwdIdx >= 0 ? fwdIdx : panelBars.length
      }

      // If target date, center on it
      if (targetDate) {
        const tIdx = panelBars.findIndex(b => barToDateStr(b) >= targetDate)
        if (tIdx >= 0) {
          startIdx = Math.max(0, tIdx - Math.floor(vb / 2))
        }
      }

      setVS(startIdx)
    }

    applyToPanel(bars, setViewStart, viewBars)

    // APPLY ALL — for now, just apply to current panel since each has its own bar data
    // In a full implementation, this would iterate all panels
    if (allPanels) {
      // Each panel has its own bars, so apply the same logic
      applyToPanel(bars, setViewStart, viewBars)
    }
  }, [bars, viewBars, setViewStart])

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        borderRadius: 5,
        border: '1px solid #1e2535',
      }}
    >
      {/* ph — Panel header row */}
      <div className="ph">
        <span className="ph-sym">{symbol}</span>
        <div className="tf-wrap">
          {['1','2','5','15','60','D','W'].map(t => (
            <button
              key={t}
              className={`tf-btn${tf === t ? ' active' : ''}`}
              onClick={() => useChartStore.getState().setPanelTf(panelIdx, t)}
            >{t === '1' ? '1m' : t === '2' ? '2m' : t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '60m' : t}</button>
          ))}
        </div>
        <span className="ph-ohlc" id={`ohlc-${panelIdx}`} />
        <div className="panel-btns">
          {activeTool && (
            <span style={{
              background: '#D4AF37', color: '#000', fontSize: 9, fontWeight: 800,
              padding: '1px 6px', borderRadius: 3,
            }} title="Click chart to draw. Escape to cancel.">✏ {activeTool.replace(/_/g, ' ').toUpperCase()}</span>
          )}
          <button
            className="pnl-btn expand-btn"
            onClick={() => useUIStore.getState().setFullscreenPanel(fullscreenPanel === panelIdx ? null : panelIdx)}
            title="Fullscreen"
          >⛶</button>
        </div>
      </div>

      {/* ind-row — Indicator preset row */}
      <div className="ind-row" id={`indrow-${panelIdx}`}>
        <span style={{ fontSize: 11, color: '#2a3050', letterSpacing: 1, marginRight: 2 }}>IND</span>
        <button className="preset-btn" onClick={() => {
          const ts = require('@/stores/charts/toolStore').useToolStore.getState()
          const samkeys = ['ema9','ema20','ema50','ema200','sma_vol','vwap']
          const tools = ts.tools.map(t => ({ ...t, on: samkeys.includes(t.indKey) }))
          ts.setTools(tools)
          require('@/stores/charts/indicatorStore').useIndicatorStore.getState().setInds({ ema9: true, ema20: true, ema50: true, ema200: true, sma_vol: true, vwap: true, vol: true })
        }}>SAM</button>
        <button className="preset-btn" onClick={() => {
          const ts = require('@/stores/charts/toolStore').useToolStore.getState()
          const mikeys = ['vwap','band_9_20','band_72_89','dev_s_9_20','trail_stop','db_72_89','sma_vol']
          const tools = ts.tools.map(t => ({ ...t, on: mikeys.includes(t.indKey) }))
          ts.setTools(tools)
          require('@/stores/charts/indicatorStore').useIndicatorStore.getState().setInds({ band_9_20: true, band_72_89: true, dev_s_9_20: true, trail_stop: true, db_72_89: true, vwap: true, sma_vol: true, vol: true })
        }}>MIKE</button>
        <span style={{ width: 1, height: 10, background: '#2a3050', margin: '0 2px' }} />
        {/* Per-panel hot tool toggle buttons */}
        <div id={`ind-hot-${panelIdx}`} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <PanelHotButtons panelIdx={panelIdx} />
        </div>
      </div>

      {/* pdr — Date range row */}
      <div className="pdr" id={`pdr-${panelIdx}`}>
        <label>FROM</label><input type="date" id={`from-${panelIdx}`} autoComplete="off" onChange={(e) => {
          const from = e.target.value
          if (from) {
            const idx = bars.findIndex(b => { const d = typeof b.time === 'string' ? b.time : new Date(b.time * 1000).toISOString().split('T')[0]; return d >= from })
            if (idx >= 0) setViewStart(idx)
          }
        }} />
        <label>TO</label><input type="date" id={`to-${panelIdx}`} autoComplete="off" onChange={(e) => {
          const to = e.target.value
          if (to) {
            const idx = bars.findIndex(b => { const d = typeof b.time === 'string' ? b.time : new Date(b.time * 1000).toISOString().split('T')[0]; return d > to })
            if (idx >= 0) setViewStart(Math.max(0, idx - viewBars))
          }
        }} />
        <div className="pdr-sep" />
        <label>TARGET</label><input type="date" id={`tgt-${panelIdx}`} autoComplete="off" onChange={(e) => {
          useUIStore.getState().setTargetDate(e.target.value)
          useUIStore.getState().setShowTarget(!!e.target.value)
        }} />
        <label>BACK</label><input type="number" id={`back-${panelIdx}`} min={1} max={9999} placeholder="days" style={{ width: 52 }} />
        <label>FWD</label><input type="number" id={`fwd-${panelIdx}`} min={0} max={9999} placeholder="days" style={{ width: 52 }} />
        <button className="appl" id={`apply-${panelIdx}`} onClick={() => handleApplyDateRange(panelIdx)}>APPLY</button>
        <button className="appl" id={`applyall-${panelIdx}`} style={{ borderColor: '#D4AF37', color: '#D4AF37' }} onClick={() => handleApplyDateRange(panelIdx, true)}>APPLY ALL</button>
      </div>

      {/* Canvas */}
      <div ref={canvasWrapRef} style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: dragging ? 'grabbing' : activeTool ? 'cell' : 'crosshair',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onWheel={onWheel}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* Floating OHLCV tooltip on right-click-hold */}
        {ohlcvTip && ohlcvTip.bar && (
          <div style={{
            position: 'fixed', left: ohlcvTip.x, top: ohlcvTip.y,
            background: 'rgba(16,19,26,.92)', border: '1px solid #2a3050',
            borderRadius: 4, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace',
            color: '#dde3f0', pointerEvents: 'none', zIndex: 800, whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,.5)',
          }}>
            <div>O {ohlcvTip.bar.open?.toFixed(2)} H {ohlcvTip.bar.high?.toFixed(2)}</div>
            <div>L {ohlcvTip.bar.low?.toFixed(2)} C {ohlcvTip.bar.close?.toFixed(2)}</div>
            {ohlcvTip.bar.volume != null && <div style={{ color: '#8aa0c0' }}>Vol {(ohlcvTip.bar.volume / 1e6).toFixed(2)}M</div>}
          </div>
        )}
      </div>

      {/* Scrollbar + Scroll Arrows */}
      <div style={{
        height: 18,
        background: '#080a0e',
        borderTop: '1px solid #111620',
        display: 'flex',
        alignItems: 'center',
        padding: '0 2px',
        flexShrink: 0,
      }}>
        {/* Left arrow */}
        <button
          onClick={() => setViewStart(vs => Math.max(0, vs - 1))}
          style={{
            background: 'none',
            border: 'none',
            color: '#6a80a0',
            cursor: 'pointer',
            fontSize: 10,
            padding: '0 4px',
            lineHeight: '18px',
          }}
        >◀</button>

        {/* Scrollbar track */}
        <div
          style={{
            flex: 1,
            height: 8,
            background: '#111620',
            borderRadius: 4,
            position: 'relative',
            cursor: 'pointer',
            margin: '0 4px',
          }}
          onClick={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            const frac = (e.clientX - rect.left) / rect.width
            const newStart = Math.max(0, Math.min(bars.length - viewBars, Math.round(frac * bars.length - viewBars / 2)))
            setViewStart(newStart)
          }}
        >
          {/* Thumb */}
          {bars.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: `${(viewStart / bars.length) * 100}%`,
                width: `${Math.max(2, (viewBars / bars.length) * 100)}%`,
                height: '100%',
                background: '#2a3a55',
                borderRadius: 4,
                cursor: 'grab',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                const startX = e.clientX
                const startVS = viewStart
                const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
                const trackW = rect.width
                const onMove = (me: MouseEvent) => {
                  const dx = me.clientX - startX
                  const dBars = Math.round((dx / trackW) * bars.length)
                  setViewStart(Math.max(0, Math.min(bars.length - viewBars, startVS + dBars)))
                }
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            />
          )}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => setViewStart(vs => Math.max(0, Math.min(bars.length - viewBars, vs + 1)))}
          style={{
            background: 'none',
            border: 'none',
            color: '#6a80a0',
            cursor: 'pointer',
            fontSize: 10,
            padding: '0 4px',
            lineHeight: '18px',
          }}
        >▶</button>
      </div>
    </div>
  )
}

/** Per-panel hot tool toggle buttons */
function PanelHotButtons({ panelIdx }: { panelIdx: number }) {
  const tools = useToolStore(s => s.tools)
  const toggleTool = useToolStore(s => s.toggleTool)
  const selectTool = useToolStore(s => s.selectTool)
  const hotTools = tools.filter(t => t.hot)

  if (!hotTools.length) return null
  return <>{hotTools.map(tool => {
    const color = tool.hotColor || '#D4AF37'
    const name = (tool.hotLabel || tool.name).toUpperCase().slice(0, 10)
    return (
      <button
        key={tool.id}
        className={`ptog${tool.on ? ' on' : ''}`}
        style={{
          borderColor: tool.on ? color : '#3a4a68',
          color: tool.on ? color : '#3a4a68',
          background: '#0a0c12',
          opacity: tool.on ? 1 : 0.5,
        }}
        onClick={(e) => { e.stopPropagation(); toggleTool(tool.id) }}
        onContextMenu={(e) => { e.preventDefault(); selectTool(tool.id); useUIStore.getState().setSidebarTab('tools') }}
        title={`${tool.name} (right-click → settings)`}
      >{name}</button>
    )
  })}</>
}
