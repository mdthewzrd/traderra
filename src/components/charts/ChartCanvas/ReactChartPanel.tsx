'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
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

// Read live indicator state from legacy engine panels[0].inds
// Falls back to Mike's preset defaults if engine hasn't loaded yet
function getLiveInds(): Record<string, boolean> {
  const p = (window as any).panels?.[0]
  if (p?.inds) return { ...p.inds }
  // Mike preset fallback (intraday)
  return {
    ema9: false, ema20: false, ema50: false, ema200: false,
    db_upper: false, db_low1: false, db_low2: false,
    vol: true, vwap: true,
    ema40_60: false, ema150: false,
    band_9_20: true, band_72_89: true,
    dev_s_9_20: true, dev_l_9_20: false,
    db_72_89: true, pzones: true,
    bollinger: false, sma: false, sma_vol: false,
  }
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

  // Live indicator state from legacy engine (read each render, store for JSX)
  const liveIndsRef = useRef(getLiveInds())
  useEffect(() => {
    const interval = setInterval(() => {
      liveIndsRef.current = getLiveInds()
    }, 500)
    return () => clearInterval(interval)
  }, [])
  const [liveInds, setLiveInds] = useState(getLiveInds())
  useEffect(() => {
    const interval = setInterval(() => setLiveInds(getLiveInds()), 500)
    return () => clearInterval(interval)
  }, [])

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
      ;(window as any).globalCrossTime = 0
      ;(window as any).globalCrossPrice = 0

      // Compute all indicators for this frame
      const ic = computeIndicators(bars, inds, tf)

      // ── Grid + Axes ──
      const { niceStep, gridMinP } = renderGrid(rc)
      renderPriceAxis(rc, niceStep, gridMinP)
      renderTimeAxis(rc)

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

      // EMA 9/20 band
      if (inds.band_9_20 && ic.ema[9] && ic.ema[20]) {
        drawEMABand(rc, ic.ema[9], ic.ema[20],
          'rgba(100,180,255,0.08)', 'rgba(255,100,100,0.08)',
          'rgba(100,180,255,0.4)', 'rgba(255,100,100,0.4)')
      }

      // EMA 72/89 band
      if (inds.band_72_89 && ic.ema[72] && ic.ema[89]) {
        drawEMABand(rc, ic.ema[72], ic.ema[89],
          'rgba(160,120,255,0.06)', 'rgba(255,160,60,0.06)',
          'rgba(160,120,255,0.35)', 'rgba(255,160,60,0.35)')
      }

      // Deviation band short (9/20)
      if (inds.dev_s_9_20 && ic.ema[9] && ic.atr[9] && ic.ema[20] && ic.atr[20]) {
        const d = MIKE_DEV.s_9_20
        drawDevBand(rc,
          ic.ema[d.fast], ic.atr[d.fast],
          ic.ema[d.slow], ic.atr[d.slow],
          d.up, d.dn,
          C.db_upper_fill, C.db_upper_line,
          C.db_low1_fill, C.db_low1_line,
        )
      }

      // Deviation band 72/89
      if (inds.db_72_89 && ic.ema[72] && ic.atr[72] && ic.ema[89] && ic.atr[89]) {
        const d = MIKE_DEV.db_72_89
        drawDevBand(rc,
          ic.ema[d.fast], ic.atr[d.fast],
          ic.ema[d.slow], ic.atr[d.slow],
          d.up, d.dn,
          C.db_upper_fill, C.db_upper_line,
          C.db_low1_fill, C.db_low1_line,
        )
      }

      // Bollinger Bands
      if (inds.bollinger && ic.bollinger) {
        drawBandFill(rc, ic.bollinger.upper, ic.bollinger.lower, C.bb_fill)
        drawBandLines(rc, ic.bollinger.upper, ic.bollinger.lower, C.bb_upper)
        drawLine(rc, ic.bollinger.middle, C.bb_upper, 1)
      }

      // DB upper (EMA9 + ATR9 band above price)
      if (inds.db_upper && ic.ema[9] && ic.atr[9]) {
        const upper = ic.ema[9].map((v, i) => v != null && ic.atr[9]![i] != null ? v + ic.atr[9]![i]! * 2.4 : null)
        const lower = ic.ema[9].map((v, i) => v != null && ic.atr[9]![i] != null ? v - ic.atr[9]![i]! * 0.5 : null)
        drawBandFill(rc, upper, lower, C.db_upper_fill)
        drawBandLines(rc, upper, lower, C.db_upper_line)
      }

      // DB low1 (EMA20 + ATR20)
      if (inds.db_low1 && ic.ema[20] && ic.atr[20]) {
        const upper = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v + ic.atr[20]![i]! * 1 : null)
        const lower = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v - ic.atr[20]![i]! * 2 : null)
        drawBandFill(rc, upper, lower, C.db_low1_fill)
        drawBandLines(rc, upper, lower, C.db_low1_line)
      }

      // DB low2 (EMA20 + ATR20 wider)
      if (inds.db_low2 && ic.ema[20] && ic.atr[20]) {
        const upper = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v + ic.atr[20]![i]! * 2.4 : null)
        const lower = ic.ema[20].map((v, i) => v != null && ic.atr[20]![i] != null ? v - ic.atr[20]![i]! * 2.4 : null)
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
  }, [bars, viewStart, viewBars, mouse, size, chartStyle, tf, symbol, loading])

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
