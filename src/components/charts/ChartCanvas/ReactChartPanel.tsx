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
import { C, F } from '@/lib/charts/theme'
import { fmtPrice } from '@/lib/charts/format'
import type { RenderContext } from '@/lib/charts/render-types'

/**
 * ReactChartPanel — pure React canvas panel replacing charts-engine.js panel rendering.
 * 
 * Uses:
 * - useBars() hook for OHLCV data
 * - Zustand stores for symbol, timeframe, chart style, theme
 * - Existing TS render modules for canvas drawing
 * - React event handlers for mouse/wheel interactions
 */
export function ReactChartPanel({ panelIdx }: { panelIdx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  // Store state
  const symbol = useChartStore(s => s.symbol)
  const panel = useChartStore(s => s.panels[panelIdx])
  const tf = panel?.tf || 'D'
  const chartStyle = useUIStore(s => s.chartStyle)
  const theme = useUIStore(s => s.theme)

  // Viewport state
  const [viewStart, setViewStart] = useState(0)
  const [viewBars, setViewBars] = useState(200)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Mouse state
  const [mouse, setMouse] = useState({ x: -1, y: -1 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, vs: 0 })

  // Fetch bars
  const { bars, loading } = useBars(symbol, tf)

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current
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

      // Build RenderContext using existing render-panel setup
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
        inds: {},
        volFrac: 0.20,
        priceScale: 1,
      })

      if (!rc) return

      // Bridge Zustand state to window globals that render modules read
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

      // ── Candles ──
      renderCandles(rc)

      // ── Live Price Line ──
      renderLivePriceLine(rc)

      // ── Crosshair + OHLC tooltip ──
      renderCrosshair(rc)

      // ── Loading overlay ──
      if (loading) {
        ctx.fillStyle = 'rgba(12,14,20,0.75)'
        ctx.fillRect(0, 0, size.w, size.h)
        ctx.fillStyle = '#6a80a0'
        ctx.font = `bold 14px Inter,system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('LOADING…', size.w / 2, size.h / 2)
      }
    } catch (err: any) {
      // Render error to canvas instead of crashing
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
      ctx.fillText(msg, 10, 50)
      if (err?.stack) {
        const line = err.stack.split('\n').find((l: string) => l.includes('render-'))
        if (line) ctx.fillText(line.trim(), 10, 70)
      }
      console.error('[ReactChartPanel] render error:', err)
    }
  }, [bars, viewStart, viewBars, mouse, size, chartStyle, theme, tf, symbol, loading])

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
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top })

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
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 15 : -15
    setViewBars(prev => Math.max(20, Math.min(bars.length || 500, prev + delta)))
  }, [bars.length])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
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
        <span style={{ color: '#8aa0c0' }}>{tf === 'D' ? 'Daily' : tf + 'm'}</span>
        <span style={{ marginLeft: 'auto', color: '#4a6080', fontSize: 10 }}>React Panel</span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
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
