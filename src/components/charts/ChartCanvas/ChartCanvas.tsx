'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useBars, type Bar } from '@/hooks/useBars'
import { useChartStore } from '@/stores/charts/chartStore'
import { useUIStore as useUiStore } from '@/stores/charts/uiStore'
// @ts-ignore
import { C, F } from '@/lib/charts/theme'
import { fmtPrice, fmtVol, fmtTimeAxis, nyMins, getNY } from '@/lib/charts/format'

/**
 * ChartCanvas — renders OHLCV data on a canvas with pan/zoom/crosshair.
 * Pure React, no legacy JS dependencies.
 */
export function ChartCanvas({ panelIdx }: { panelIdx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  // State from stores
  const symbol = useChartStore(s => s.symbol)
  const tf = useChartStore(s => s.panels[panelIdx]?.tf || '5')
  const chartStyle = useUiStore(s => s.chartStyle)
  const theme = useUiStore(s => s.theme)

  // Local viewport state
  const [viewStart, setViewStart] = useState(0)
  const [viewBars, setViewBars] = useState(200)
  const [mouse, setMouse] = useState({ x: -1, y: -1 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, vs: 0 })
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Fetch bars
  const { bars, loading, error } = useBars(symbol, tf)

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ w: Math.floor(width), h: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Set canvas size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    canvas.style.width = size.w + 'px'
    canvas.style.height = size.h + 'px'
  }, [size])

  // Auto-fit view when bars load
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

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const W = size.w
    const H = size.h
    const PRICE_W = 70
    const TIME_H = 22
    const chartW = W - PRICE_W
    const volH = H * 0.2
    const priceH = H - volH - TIME_H

    // Visible bars
    const vs = Math.max(0, viewStart)
    const ve = Math.min(bars.length, vs + viewBars)
    const visible = bars.slice(vs, ve)
    if (visible.length === 0) return

    const barW = chartW / visible.length
    const GAP = Math.max(1, barW * 0.15)
    const candleW = barW - GAP

    // Coordinate helpers
    const xCtr = (i: number) => (i - vs) * barW + barW / 2
    const xL = (i: number) => (i - vs) * barW + GAP / 2

    // Price range
    let minP = Infinity, maxP = -Infinity
    for (const b of visible) {
      if (b.low < minP) minP = b.low
      if (b.high > maxP) maxP = b.high
    }
    const pricePad = (maxP - minP) * 0.05 || 1
    minP -= pricePad
    maxP += pricePad
    const priceRange = maxP - minP || 1
    const pToY = (v: number) => priceH - ((v - minP) / priceRange) * priceH

    // Clear
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = theme === 'light' ? '#ffffff' : C.bg
    ctx.fillRect(0, 0, W, H)

    // ── GRID ──
    drawGrid(ctx, chartW, priceH, PRICE_W, TIME_H, W, H, minP, maxP, priceRange, visible, barW, vs, tf, pToY)

    // ── VOLUME ──
    let maxVol = 0
    for (const b of visible) if (b.volume > maxVol) maxVol = b.volume
    const volBase = H - TIME_H
    for (let i = 0; i < visible.length; i++) {
      const b = visible[i]
      const x = xL(vs + i)
      const vH = maxVol > 0 ? (b.volume / maxVol) * volH : 0
      const up = b.close >= b.open
      ctx.fillStyle = up ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)'
      ctx.fillRect(x, volBase - vH, candleW, vH)
    }

    // Volume separator
    ctx.strokeStyle = '#1e2840'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, priceH)
    ctx.lineTo(chartW, priceH)
    ctx.stroke()

    // ── CANDLES ──
    for (let i = 0; i < visible.length; i++) {
      const b = visible[i]
      const x = xCtr(vs + i)
      const up = b.close >= b.open
      const color = up ? C.up : C.dn

      if (chartStyle === 'line' || chartStyle === 'area') {
        // Draw as line/area
        if (i > 0) {
          const prev = visible[i - 1]
          ctx.strokeStyle = C.up
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(xCtr(vs + i - 1), pToY(prev.close))
          ctx.lineTo(x, pToY(b.close))
          ctx.stroke()
        }
        if (chartStyle === 'area' && i === visible.length - 1) {
          ctx.fillStyle = 'rgba(38,166,154,0.08)'
          ctx.beginPath()
          ctx.moveTo(xCtr(vs), pToY(visible[0].close))
          for (let j = 0; j < visible.length; j++) {
            ctx.lineTo(xCtr(vs + j), pToY(visible[j].close))
          }
          ctx.lineTo(xCtr(vs + visible.length - 1), priceH)
          ctx.lineTo(xCtr(vs), priceH)
          ctx.closePath()
          ctx.fill()
        }
        continue
      }

      // Wick
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, pToY(b.high))
      ctx.lineTo(x, pToY(b.low))
      ctx.stroke()

      // Body
      const bodyTop = pToY(Math.max(b.open, b.close))
      const bodyBot = pToY(Math.min(b.open, b.close))
      const bodyH = Math.max(1, bodyBot - bodyTop)

      if (chartStyle === 'hollow' || chartStyle === 'ohlc') {
        ctx.strokeStyle = color
        ctx.lineWidth = chartStyle === 'ohlc' ? 2 : 1
        ctx.strokeRect(x - candleW / 2, bodyTop, candleW, bodyH)
      } else {
        ctx.fillStyle = color
        ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH)
      }
    }

    // ── LIVE PRICE LINE ──
    if (visible.length > 0) {
      const lastBar = visible[visible.length - 1]
      const lastY = pToY(lastBar.close)
      const lastUp = visible.length > 1 ? lastBar.close >= visible[visible.length - 2].close : true
      ctx.strokeStyle = lastUp ? C.up : C.dn
      ctx.lineWidth = 1
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(0, lastY)
      ctx.lineTo(chartW, lastY)
      ctx.stroke()
      ctx.setLineDash([])

      // Price label
      ctx.fillStyle = lastUp ? C.up : C.dn
      ctx.fillRect(chartW, lastY - 10, PRICE_W, 20)
      ctx.fillStyle = '#000'
      ctx.font = `bold ${F.sm}px Inter,system-ui`
      ctx.textAlign = 'center'
      ctx.fillText(fmtPrice(lastBar.close), chartW + PRICE_W / 2, lastY + 4)
    }

    // ── CROSSHAIR ──
    if (mouse.x >= 0 && mouse.x < chartW && mouse.y >= 0 && mouse.y < H - TIME_H) {
      ctx.strokeStyle = 'rgba(100,140,200,0.35)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(mouse.x, 0)
      ctx.lineTo(mouse.x, priceH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, mouse.y)
      ctx.lineTo(chartW, mouse.y)
      ctx.stroke()
      ctx.setLineDash([])

      // Price at cursor
      const cursorPrice = minP + ((priceH - mouse.y) / priceH) * priceRange
      ctx.fillStyle = '#2a3a5a'
      ctx.fillRect(chartW, mouse.y - 10, PRICE_W, 20)
      ctx.fillStyle = '#dde3f0'
      ctx.font = `${F.sm}px Inter,system-ui`
      ctx.textAlign = 'center'
      ctx.fillText(fmtPrice(cursorPrice), chartW + PRICE_W / 2, mouse.y + 4)

      // OHLC tooltip
      const barIdx = Math.floor(mouse.x / barW) + vs
      if (barIdx >= 0 && barIdx < bars.length) {
        const b = bars[barIdx]
        const chg = b.close - b.open
        const chgPct = b.open > 0 ? ((chg / b.open) * 100).toFixed(2) : '0.00'
        const chgColor = chg >= 0 ? C.up : C.dn
        ctx.font = `bold ${F.sm}px Inter,system-ui`
        ctx.textAlign = 'left'
        let tx = 8, ty = 16
        ctx.fillStyle = C.sym
        ctx.fillText(symbol, tx, ty)
        tx += ctx.measureText(symbol).width + 10
        ctx.fillStyle = '#dde3f0'
        ctx.fillText(`O ${fmtPrice(b.open)}`, tx, ty); tx += 70
        ctx.fillText(`H ${fmtPrice(b.high)}`, tx, ty); tx += 70
        ctx.fillText(`L ${fmtPrice(b.low)}`, tx, ty); tx += 70
        ctx.fillText(`C ${fmtPrice(b.close)}`, tx, ty); tx += 70
        ctx.fillStyle = chgColor
        ctx.fillText(`${chg >= 0 ? '+' : ''}${chgPct}%`, tx, ty); tx += 55
        ctx.fillStyle = '#4a6080'
        ctx.fillText(`Vol ${fmtVol(b.volume)}`, tx, ty)
      }

      // Time at cursor
      const barIdx2 = Math.floor(mouse.x / barW) + vs
      if (barIdx2 >= 0 && barIdx2 < bars.length) {
        const tStr = fmtTimeAxis(bars[barIdx2].time, tf)
        ctx.fillStyle = '#2a3a5a'
        const tw = ctx.measureText(tStr).width + 12
        ctx.fillRect(mouse.x - tw / 2, H - TIME_H, tw, TIME_H)
        ctx.fillStyle = '#dde3f0'
        ctx.textAlign = 'center'
        ctx.fillText(tStr, mouse.x, H - 6)
      }
    }

    // Price axis background
    ctx.fillStyle = theme === 'light' ? '#f0f0f0' : C.axisbg
    ctx.fillRect(chartW, 0, PRICE_W, H - TIME_H)
    // Time axis background
    ctx.fillRect(0, H - TIME_H, W, TIME_H)

    // ── LOADING OVERLAY ──
    if (loading) {
      ctx.fillStyle = 'rgba(12,14,20,0.75)'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#6a80a0'
      ctx.font = `bold 14px Inter,system-ui`
      ctx.textAlign = 'center'
      ctx.fillText('LOADING…', W / 2, H / 2)
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
    setViewBars(prev => Math.max(20, Math.min(bars.length, prev + delta)))
  }, [bars.length])

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: dragging ? 'grabbing' : 'crosshair' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
      />
      {error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#ef4444', fontSize: 13 }}>
          Error: {error}
        </div>
      )}
    </div>
  )
}

// ── GRID HELPER ──
function drawGrid(
  ctx: CanvasRenderingContext2D,
  chartW: number, priceH: number, PRICE_W: number, TIME_H: number,
  W: number, H: number,
  minP: number, maxP: number, priceRange: number,
  visible: Bar[], barW: number, vs: number, tf: string,
  pToY: (v: number) => number
) {
  // Price grid lines + axis
  const priceStep = niceStep(priceRange, 6)
  const gridMinP = Math.ceil(minP / priceStep) * priceStep
  ctx.strokeStyle = '#1a1e2e'
  ctx.lineWidth = 0.5
  ctx.fillStyle = '#4a6080'
  ctx.font = `${F.sm}px Inter,system-ui`
  ctx.textAlign = 'right'
  for (let p = gridMinP; p <= maxP; p += priceStep) {
    const y = pToY(p)
    if (y < 0 || y > priceH) continue
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(chartW, y)
    ctx.stroke()
    ctx.fillText(fmtPrice(p), W - 6, y + 4)
  }

  // Time grid lines + axis
  const timeStep = Math.max(1, Math.floor(visible.length / 8))
  ctx.textAlign = 'center'
  for (let i = 0; i < visible.length; i += timeStep) {
    const x = (i + 0.5) * barW
    const b = visible[i]
    ctx.strokeStyle = '#1a1e2e'
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, priceH)
    ctx.stroke()
    ctx.fillStyle = '#4a6080'
    ctx.fillText(fmtTimeAxis(b.time, tf), x, H - 6)
  }
}

function niceStep(range: number, targetLines: number): number {
  const rough = range / targetLines
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / mag
  if (residual <= 1) return mag
  if (residual <= 2) return 2 * mag
  if (residual <= 5) return 5 * mag
  return 10 * mag
}
