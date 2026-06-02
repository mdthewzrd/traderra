/**
 * Session shading, BT date highlights, and Prior Day Close (PDC) lines.
 * Extracted from renderPanel() lines 3170-3320.
 */

import type { RenderContext } from './render-types'
import { C } from './theme'
import { getNY, nyMins, isIntraday } from './format'

// Session time boundaries (NY minutes)
const PRE_START = (typeof window !== 'undefined' && (window as any).PRE_START) || 4 * 60      // 4:00 AM
const MKTOPEN = (typeof window !== 'undefined' && (window as any).MKTOPEN) || 9 * 60 + 30     // 9:30 AM
const MKTCLOSE = (typeof window !== 'undefined' && (window as any).MKTCLOSE) || 16 * 60       // 4:00 PM
const POST_END = (typeof window !== 'undefined' && (window as any).POST_END) || 20 * 60       // 8:00 PM

function getSession(ts: number): 'pre' | 'regular' | 'after' | null {
  const m = nyMins(ts)
  if (m >= PRE_START && m < MKTOPEN) return 'pre'
  if (m >= MKTOPEN && m < MKTCLOSE) return 'regular'
  if (m >= MKTCLOSE && m < POST_END) return 'after'
  return null
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Backtest date highlight shading */
export function renderBtHighlights(rc: RenderContext) {
  const btHighlightDates = (window as any).btHighlightDates
  const btSelected = (window as any).btSelected
  if (!btHighlightDates || !btSelected) return

  const { ctx, data, chartW, priceH, volH, visible, vs, barW, xL, tf } = rc
  const tradeDates = new Set([btSelected.date])

  ctx.save()
  const hlCol = 'rgba(245,158,11,0.10)'

  if (isIntraday(tf)) {
    let segStart = -1, segDate: string | null = null
    const flushSeg = (endX: number) => {
      if (segDate && tradeDates.has(segDate)) {
        ctx.fillStyle = hlCol
        ctx.fillRect(segStart, 0, endX - segStart, priceH + volH)
      }
    }
    for (let i = 0; i < visible.length; i++) {
      const ny = getNY(visible[i].time)
      const dk = `${ny.year}-${String(ny.month).padStart(2, '0')}-${String(ny.day).padStart(2, '0')}`
      if (dk !== segDate) {
        if (segDate !== null) flushSeg(xL(i))
        segStart = xL(i); segDate = dk
      }
    }
    if (segDate !== null) flushSeg(xL(visible.length - 1) + barW)
  } else {
    for (let i = 0; i < visible.length; i++) {
      const dk = typeof visible[i].time === 'string' ? visible[i].time : fmtDate(new Date(visible[i].time * 1000))
      if (tradeDates.has(dk)) {
        ctx.fillStyle = hlCol
        ctx.fillRect(xL(i), 0, barW, priceH + volH)
      }
    }
  }
  ctx.restore()
}

/** Pre/post market session shading + day boundary lines + PDC lines */
export function renderSessionShading(rc: RenderContext) {
  const { ctx, data, chartW, priceH, volH, visible, vs, barW, xL, pToY, tf } = rc
  if (!isIntraday(tf)) return

  const p = (rc as any)

  // ── Shade pre/post market sessions ──
  let spanStart = -1, spanSess: string | null = null
  const flushSpan = (endX: number) => {
    if (spanSess === 'pre') { ctx.fillStyle = C.pre; ctx.fillRect(spanStart, 0, endX - spanStart, priceH + volH) }
    if (spanSess === 'after') { ctx.fillStyle = C.after; ctx.fillRect(spanStart, 0, endX - spanStart, priceH + volH) }
  }

  for (let i = 0; i < visible.length; i++) {
    const sess = getSession(visible[i].time)
    const bL = xL(i)

    if (sess === 'pre' || sess === 'after') {
      if (spanSess !== sess) {
        if (spanSess) flushSpan(bL)
        spanStart = bL; spanSess = sess
      }
    } else {
      if (spanSess) flushSpan(bL)
      spanStart = -1; spanSess = null
    }
  }
  if (spanSess) flushSpan(xL(visible.length - 1) + barW)

  // ── Precompute PDC map ──
  if (!p._pdcMap || p._pdcMapLen !== data.length) {
    const m: Record<string, number> = {}
    for (let i = 0; i < data.length; i++) {
      if (getSession(data[i].time) === 'regular') {
        const ny = getNY(data[i].time)
        const dk = `${ny.year}-${ny.month}-${ny.day}`
        m[dk] = data[i].close
      }
    }
    p._pdcMap = m; p._pdcMapLen = data.length
  }
  const pdcMap = p._pdcMap

  // ── Session boundary lines ──
  let prevSess = visible[0] ? getSession(visible[0].time) : null
  let prevDay = visible[0] ? getNY(visible[0].time) : { day: -1, month: -1, year: -1 }
  const pdcSegs: { x: number; endX: number; price: number; dayKey?: string }[] = []

  for (let i = 1; i < visible.length; i++) {
    const b = visible[i]
    const sess = getSession(b.time)
    const ny = getNY(b.time)
    const bL = xL(i)
    const dayChanged = ny.day !== prevDay.day || ny.month !== prevDay.month

    if (dayChanged) {
      const pd = prevDay
      const dk = `${pd.year}-${pd.month}-${pd.day}`
      const pdcPrice = pdcMap[dk] ?? null
      if (pdcPrice !== null) {
        let endX = chartW
        pdcSegs.push({ x: bL, endX, price: pdcPrice, dayKey: dk })
        if (pdcSegs.length > 1) pdcSegs[pdcSegs.length - 2].endX = bL
      }
      ctx.strokeStyle = 'rgba(80,100,150,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(bL, 0); ctx.lineTo(bL, priceH + volH); ctx.stroke()
    } else if (sess !== prevSess && (prevSess === 'pre' || sess === 'regular')) {
      ctx.strokeStyle = 'rgba(100,140,200,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(bL, 0); ctx.lineTo(bL, priceH + volH); ctx.stroke()
      ctx.setLineDash([])
    }
    prevSess = sess; prevDay = ny
  }

  // PDC for first visible day
  if (visible.length > 0 && pdcSegs.length === 0) {
    const ny0 = getNY(visible[0].time)
    let priorClose: number | null = null
    for (let i = vs - 1; i >= 0; i--) {
      if (getSession(data[i].time) === 'regular') {
        const ny = getNY(data[i].time)
        if (ny.day !== ny0.day || ny.month !== ny0.month) { priorClose = data[i].close; break }
      }
    }
    if (priorClose !== null) pdcSegs.push({ x: 0, endX: chartW, price: priorClose })
  }

  // Handle mid-chart first boundary
  if (visible.length > 0 && pdcSegs.length > 0 && pdcSegs[0].x > 0) {
    const ny0 = getNY(visible[0].time)
    let priorClose: number | null = null
    for (let i = vs - 1; i >= 0; i--) {
      if (getSession(data[i].time) === 'regular') {
        const ny = getNY(data[i].time)
        if (ny.day !== ny0.day || ny.month !== ny0.month) { priorClose = data[i].close; break }
      }
    }
    if (priorClose !== null) pdcSegs.unshift({ x: 0, endX: pdcSegs[0].x, price: priorClose })
  }

  // ── Draw PDC lines ──
  if (p.showPDC) {
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip()
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
    for (const seg of pdcSegs) {
      const y = pToY(seg.price)
      if (y < 0 || y > priceH) continue
      ctx.strokeStyle = 'rgba(190,200,220,0.70)'
      ctx.beginPath(); ctx.moveTo(seg.x, y); ctx.lineTo(seg.endX, y); ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.restore()
  }
}
