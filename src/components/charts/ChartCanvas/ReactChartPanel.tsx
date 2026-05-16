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
import { renderPivotZones } from '@/lib/charts/render-pzones'
import { isIntraday } from '@/lib/charts/format'
import { C } from '@/lib/charts/theme'
import { useIndicatorStore } from '@/stores/charts/indicatorStore'
import { useDrawingStore } from '@/stores/charts/drawingStore'
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
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, vs: 0 })
  const drawingDragRef = useRef<{ startX: number; startTime: number; startPrice: number } | null>(null)

  // Fetch bars (with live polling when liveMode is on)
  const { bars, loading } = useLiveBars(symbol, tf)

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

  // ResizeObserver — watch the canvas wrapper, not the outer container
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Set canvas pixel size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
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
      ;(window as any).showPriceLine = true
      ;(window as any).globalCrossTime = useChartStore.getState().globalCrossTime
      ;(window as any).globalCrossPrice = useChartStore.getState().globalCrossPrice

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

      // Compute all indicators for this frame
      const ic = computeIndicators(bars, inds, tf)

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
        drawLine(rc, ic.volSma, C.vol_sma_color, 1.5)
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
      if (inds.ema9 && ic.ema[9])   drawLine(rc, ic.ema[9],  C.ema9, 1.4)
      if (inds.ema20 && ic.ema[20]) drawLine(rc, ic.ema[20], C.ema20, 1.4)
      if (inds.ema50 && ic.ema[50]) drawLine(rc, ic.ema[50], C.ema50, 1.4)
      if (inds.ema150 && ic.ema[150]) drawLine(rc, ic.ema[150], C.ema150, 1.0)
      if (inds.ema200 && ic.ema[200]) drawLine(rc, ic.ema[200], C.ema200, 1.0)

      // VWAP
      if (inds.vwap && ic.vwap) {
        drawLine(rc, ic.vwap, C.vwap, 1.6)
      }

      // SMA
      if (inds.sma && ic.sma[20]) {
        drawLine(rc, ic.sma[20], C.sma_color, 1.4)
      }

      // ── Pivot Zones (pzones) ──
      if (inds.pzones) renderPivotZones(rc)

      // ── Candles ──
      renderCandles(rc)

      // ── Annotations (drawings) ──
      renderAnnotations(rc)

      // ── Backtest markers ──
      renderBtMarkers(rc)

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
        ds.addAnnotation({
          id: ds.getNextId(),
          type: ds.activeTool,
          x1: time, y1: price,
          color: ds.drawDefaults.color,
          lineWidth: ds.drawDefaults.lineWidth,
          opacity: ds.drawDefaults.opacity,
          text: ds.activeTool.startsWith('text_') ? 'Text' : '',
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
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    mouseRef.current = { x: mx, y: my }
    setMouse({ x: mx, y: my })

    if (dragging) {
      const dx = e.clientX - dragStart.current.x
      const barW = size.w > 0 ? (size.w - 70) / viewBars : 10
      const barsMoved = Math.round(dx / barW)
      const newVs = dragStart.current.vs - barsMoved
      setViewStart(Math.max(0, Math.min(bars.length - viewBars, newVs)))
    }

    // Crosshair sync: update global crosshair position for other panels
    if (!dragging && rcRef.current && my >= 0 && my <= rcRef.current.priceH) {
      const rc = rcRef.current
      const price = rc.minP + rc.priceRange * (1 - my / rc.priceH)
      const bi = Math.max(0, Math.min(rc.visible.length - 1, Math.round(mx / rc.barW - 0.5)))
      const time = rc.visible[bi]?.time
      if (time != null) useChartStore.getState().setCrosshair(time, price)
    }
  }, [dragging, viewBars, bars.length, size.w])

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
    const delta = e.deltaY > 0 ? 15 : -15
    setViewBars(prev => Math.max(20, Math.min(bars.length || 500, prev + delta)))
  }, [bars.length])

  // TF label
  const tfLabel = tf === 'D' ? 'Daily' : tf === 'W' ? 'Weekly' : tf + 'm'

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
      {/* Panel header */}
      <div style={{
        background: '#080a0e',
        borderBottom: '1px solid #111620',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        color: '#dde3f0',
        fontWeight: 700,
        flexShrink: 0,
        minHeight: 30,
      }}>
        <span style={{ color: '#dde3f0' }}>{symbol}</span>
        <span style={{ color: '#4a6080' }}>|</span>
        {/* TF Buttons */}
        {['1','5','15','60','D','W'].map(t => (
          <button
            key={t}
            onClick={() => useChartStore.getState().setPanelTf(panelIdx, t)}
            style={{
              background: tf === t ? '#1a2a4a' : 'none',
              border: tf === t ? '1px solid #3a5a8a' : '1px solid transparent',
              color: tf === t ? '#dde3f0' : '#4a6080',
              fontSize: 9,
              fontWeight: tf === t ? 800 : 600,
              padding: '1px 4px',
              borderRadius: 2,
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >{t === '1' ? '1m' : t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '60m' : t}</button>
        ))}
        <span style={{ color: '#4a6080' }}>|</span>
        {/* Preset buttons */}
        <button
          onClick={() => {
            const { useIndicatorStore } = require('@/stores/charts/indicatorStore')
            useIndicatorStore.getState().setInds({ ema9: true, ema20: true, ema50: true, ema200: true, sma_vol: true, vwap: true, vol: true })
          }}
          style={{ background: '#1a2a4a', border: '1px solid #3a5a8a', color: '#8aa0c0', fontSize: 8, fontWeight: 800, padding: '1px 3px', borderRadius: 2, cursor: 'pointer' }}
          title="SAM preset: EMA 9/20/50/200 + VWAP + Vol SMA"
        >SAM</button>
        <button
          onClick={() => {
            const { useIndicatorStore } = require('@/stores/charts/indicatorStore')
            useIndicatorStore.getState().setInds({ band_9_20: true, band_72_89: true, dev_s_9_20: true, db_72_89: true, vwap: true, sma_vol: true, vol: true })
          }}
          style={{ background: '#2a1a2a', border: '1px solid #5a3a6a', color: '#a080c0', fontSize: 8, fontWeight: 800, padding: '1px 3px', borderRadius: 2, cursor: 'pointer' }}
          title="MIKE preset: Bands 9/20, 72/89, Dev bands, VWAP"
        >MIKE</button>
        <span style={{ color: '#4a6080' }}>|</span>
        {/* Active indicator dots */}
        <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
          {liveInds.ema9 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema9 }} title="EMA 9" />}
          {liveInds.ema20 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema20 }} title="EMA 20" />}
          {liveInds.ema50 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema50 }} title="EMA 50" />}
          {liveInds.ema200 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema200 }} title="EMA 200" />}
          {liveInds.vwap && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.vwap }} title="VWAP" />}
          {liveInds.band_9_20 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ab4ff' }} title="Band 9/20" />}
          {liveInds.band_72_89 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a078ff' }} title="Band 72/89" />}
          {liveInds.dev_s_9_20 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc8c1e' }} title="Dev S 9/20" />}
          {liveInds.db_72_89 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c87a14' }} title="DB 72/89" />}
          {liveInds.pzones && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} title="Pivot Zones" />}
        </div>
        <span id={`ohlc-${panelIdx}`} style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: '#8aa0c0', letterSpacing: 0.5 }} />
        <span style={{ color: '#26a69a', fontSize: 10, fontWeight: 800, letterSpacing: 1, marginLeft: 8 }}>⚛ REACT</span>
        {activeTool && (
          <span style={{
            background: '#D4AF37', color: '#000', fontSize: 9, fontWeight: 800,
            padding: '1px 6px', borderRadius: 3, marginLeft: 4,
            animation: 'pulse 1.5s infinite',
          }} title="Click chart to draw. Escape to cancel.">✏ {activeTool.replace('_', ' ').toUpperCase()}</span>
        )}
        <span style={{ color: '#4a6080', fontSize: 9, marginLeft: 8 }}>{bars.length} bars | {viewBars} vis</span>
        {/* Date range inputs */}
        <input
          type="date"
          style={{ width: 90, background: '#0a0c14', border: '1px solid #1e2535', color: '#8aa0c0', fontSize: 9, padding: '0 3px', borderRadius: 2, height: 18, marginLeft: 4 }}
          onChange={(e) => {
            const from = e.target.value
            if (from) {
              const idx = bars.findIndex(b => {
                const d = typeof b.time === 'string' ? b.time : new Date(b.time * 1000).toISOString().split('T')[0]
                return d >= from
              })
              if (idx >= 0) setViewStart(idx)
            }
          }}
          title="From date"
        />
        <span style={{ color: '#3a4560', fontSize: 9 }}>→</span>
        <input
          type="date"
          style={{ width: 90, background: '#0a0c14', border: '1px solid #1e2535', color: '#8aa0c0', fontSize: 9, padding: '0 3px', borderRadius: 2, height: 18 }}
          onChange={(e) => {
            const to = e.target.value
            if (to) {
              const idx = bars.findIndex(b => {
                const d = typeof b.time === 'string' ? b.time : new Date(b.time * 1000).toISOString().split('T')[0]
                return d > to
              })
              if (idx >= 0) setViewStart(Math.max(0, idx - viewBars))
            }
          }}
          title="To date"
        />
        <button
          onClick={() => useUIStore.getState().setFullscreenPanel(fullscreenPanel === panelIdx ? null : panelIdx)}
          style={{ background: 'none', border: 'none', color: '#4a6080', cursor: 'pointer', fontSize: 10, padding: '0 2px', marginLeft: 4 }}
          title="Fullscreen"
        >⛶</button>
      </div>

      {/* Canvas */}
      <div ref={canvasWrapRef} style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            cursor: dragging ? 'grabbing' : activeTool ? 'cell' : 'crosshair',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onWheel={onWheel}
        />
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
