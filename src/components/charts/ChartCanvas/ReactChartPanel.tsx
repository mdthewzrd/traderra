'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useBars } from '@/hooks/useBars'
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
import { C } from '@/lib/charts/theme'
import type { RenderContext } from '@/lib/charts/render-types'

// Default indicator config matching Mike's preset
const DEFAULT_INDS = {
  ema9: true, ema20: true, ema50: true, ema200: true,
  vol: true, vwap: true,
  ema40_60: false, ema150: false,
  band_9_20: false, band_72_89: false,
  dev_s_9_20: false, dev_l_9_20: false,
  db_upper: false, db_low1: false, db_low2: false,
  bollinger: false, sma: false, sma_vol: false,
  pzones: false,
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

  // Store state
  const symbol = useChartStore(s => s.symbol)
  const panel = useChartStore(s => s.panels[panelIdx])
  const tf = panel?.tf || 'D'
  const chartStyle = useUIStore(s => s.chartStyle)

  // Viewport state
  const [viewStart, setViewStart] = useState(0)
  const [viewBars, setViewBars] = useState(200)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Mouse state
  const mouseRef = useRef({ x: -1, y: -1 })
  const [mouse, setMouse] = useState({ x: -1, y: -1 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, vs: 0 })

  // Fetch bars
  const { bars, loading } = useBars(symbol, tf)

  // Compute indicators when bars change
  const indCache = useMemo(
    () => computeIndicators(bars, DEFAULT_INDS, tf),
    [bars, tf]
  )

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
        inds: { vol: true },
        volFrac: 0.20,
        priceScale: 1,
      })

      if (!rc) return

      // Bridge globals
      ;(window as any)._chartStyle = chartStyle
      ;(window as any).showPriceLine = true
      ;(window as any).globalCrossTime = 0
      ;(window as any).globalCrossPrice = 0

      // ── Grid + Axes ──
      const { niceStep, gridMinP } = renderGrid(rc)
      renderPriceAxis(rc, niceStep, gridMinP)
      renderTimeAxis(rc)

      // ── Volume ──
      renderVolume(rc)

      // ── Volume SMA ──
      if (indCache.volSma) {
        drawLine(rc, indCache.volSma, C.vol_sma_color, 1.5)
      }

      // ── Indicators (before candles so bands are behind) ──

      // EMA lines
      if (indCache.ema[9])  drawLine(rc, indCache.ema[9],  C.ema9, 1.4)
      if (indCache.ema[20]) drawLine(rc, indCache.ema[20], C.ema20, 1.4)
      if (indCache.ema[50]) drawLine(rc, indCache.ema[50], C.ema50, 1.4)
      if (indCache.ema[150]) drawLine(rc, indCache.ema[150], C.ema150, 1.0)
      if (indCache.ema[200]) drawLine(rc, indCache.ema[200], C.ema200, 1.0)

      // EMA 40/60 band
      if (indCache.ema[40] && indCache.ema[60]) {
        drawEMABand(rc,
          indCache.ema[40], indCache.ema[60],
          C.ema40_60_fill, C.ema40_60_fill,
          C.ema40_60_line, C.ema40_60_line,
        )
      }

      // VWAP
      if (indCache.vwap) {
        drawLine(rc, indCache.vwap, C.vwap, 1.6)
      }

      // Bollinger Bands
      if (indCache.bollinger) {
        drawBandFill(rc, indCache.bollinger.upper, indCache.bollinger.lower, C.bb_fill)
        drawBandLines(rc, indCache.bollinger.upper, indCache.bollinger.lower, C.bb_upper)
        drawLine(rc, indCache.bollinger.middle, C.bb_upper, 1)
      }

      // SMA
      if (indCache.sma[20]) {
        drawLine(rc, indCache.sma[20], C.sma_color, 1.4)
      }

      // EMA 9/20 band
      if (indCache.ema[9] && indCache.ema[20]) {
        drawBandFill(rc, indCache.ema[9], indCache.ema[20], 'rgba(100,140,220,0.04)')
      }

      // ── Candles ──
      renderCandles(rc)

      // ── Live Price Line ──
      renderLivePriceLine(rc)

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
  }, [bars, viewStart, viewBars, mouse, size, chartStyle, tf, symbol, loading, indCache])

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
    setDragging(true)
    dragStart.current = { x: e.clientX, vs: viewStart }
  }, [viewStart])

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
  }, [dragging, viewBars, bars.length, size.w])

  const onMouseUp = useCallback(() => setDragging(false), [])

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
        <span style={{ color: '#8aa0c0' }}>{tfLabel}</span>
        {/* Active indicator dots */}
        <div style={{ display: 'flex', gap: 3, marginLeft: 8 }}>
          {indCache.ema[9] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema9 }} title="EMA 9" />}
          {indCache.ema[20] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema20 }} title="EMA 20" />}
          {indCache.ema[50] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema50 }} title="EMA 50" />}
          {indCache.ema[200] && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.ema200 }} title="EMA 200" />}
          {indCache.vwap && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.vwap }} title="VWAP" />}
        </div>
        <span style={{ marginLeft: 'auto', color: '#26a69a', fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>⚛ REACT</span>
        <span style={{ color: '#4a6080', fontSize: 9, marginLeft: 8 }}>{bars.length} bars | {viewBars} vis</span>
      </div>

      {/* Canvas */}
      <div ref={canvasWrapRef} style={{ flex: 1, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            cursor: dragging ? 'grabbing' : 'crosshair',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onWheel={onWheel}
        />
      </div>
    </div>
  )
}
