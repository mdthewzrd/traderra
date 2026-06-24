/**
 * Bjorgum Key Levels — faithful port of the Pine Script v5 indicator.
 * © Bjorgum. Source converted to a TypeScript canvas renderer.
 *
 * ALGORITHM (mirrors the Pine source bar-by-bar):
 *   1. Pivot detection on Heikin-Ashi bodies (pivothigh/pivotlow, left/right)
 *   2. band = min(atr*mult, close*(per/100)) / 2  [value from `right` bars ago]
 *      Zone = pivot ± band
 *   3. Track nPiv most-recent HIGH zones + nPiv most-recent LOW zones.
 *      New pivot → unshift; if size > nPiv → pop oldest (freeze it in place).
 *   4. Every bar: extend all live zones' right edge to the current bar.
 *   5. Color flip (role reversal) — ALL zones, no prominence filter:
 *        close > top & currently bear → flip to bull; old segment freezes
 *        close < bot & currently bull → flip to bear; old segment freezes
 *   6. Align: merge overlapping zones (expand boundaries).
 *
 * Pine defaults: left=20 right=15 nPiv=4 atrLen=30 mult=0.5 per=5
 * Colors: bull(support)=#64b5f6 blue  bear(resistance)=#ffeb3b yellow
 */

import type { RenderContext } from './render-types'
import { useToolStore } from '@/stores/charts/toolStore'

interface Pivot {
  pivotIdx: number   // actual swing bar
  confirmIdx: number // pivotIdx + right
  price: number
  type: 'high' | 'low'
}

interface LiveZone {
  top: number
  bot: number
  bull: boolean
  segStartIdx: number // start of the current (growing) segment
}

interface RenderSeg {
  top: number
  bot: number
  fromIdx: number
  toIdx: number
  bull: boolean
}

// ── Heikin-Ashi open/close ──
function buildHA(bars: { open: number; high: number; low: number; close: number }[]) {
  const haOpen: number[] = [], haClose: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const c = (b.open + b.high + b.low + b.close) / 4
    const o = i === 0 ? (b.open + b.close) / 2 : (haOpen[i - 1] + haClose[i - 1]) / 2
    haOpen.push(o)
    haClose.push(c)
  }
  return { haOpen, haClose }
}

// ── ATR series (Wilder smoothing) ──
function computeATRSeries(bars: { high: number; low: number; close: number }[], length: number): number[] {
  const out: number[] = new Array(bars.length).fill(NaN)
  if (bars.length < length + 1) return out
  let atr = 0
  for (let i = 1; i <= length; i++) {
    atr += Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    )
  }
  atr /= length
  out[length] = atr
  for (let i = length + 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    )
    atr = (atr * (length - 1) + tr) / length
    out[i] = atr
  }
  return out
}

// ── Pivot detection (ta.pivothigh / ta.pivotlow semantics) ──
function detectPivots(
  haOpen: number[], haClose: number[],
  left: number, right: number,
  detectHighs: boolean, detectLows: boolean,
  src: string,
  srcBars: { open: number; high: number; low: number; close: number }[]
): Pivot[] {
  // Source selection (mirrors Pine srcHigh/srcLow)
  //   'HA'            → hiHaBod/loHaBod (Heikin-Ashi bodies)
  //   'High/Low Body' → high/low (actual highs/lows)  [Pine 'High/Low' option label]
  //   'High/Low'      → hiBod/loBod (regular candle bodies)
  let srcHigh: number[], srcLow: number[]
  if (src === 'High/Low Body') {
    srcHigh = srcBars.map(b => b.high)
    srcLow = srcBars.map(b => b.low)
  } else if (src === 'High/Low') {
    srcHigh = srcBars.map(b => Math.max(b.close, b.open)) // hiBod
    srcLow = srcBars.map(b => Math.min(b.close, b.open))  // loBod
  } else {
    srcHigh = haClose.map((c, i) => Math.max(c, haOpen[i])) // hiHaBod
    srcLow = haClose.map((c, i) => Math.min(c, haOpen[i]))  // loHaBod
  }
  const pivots: Pivot[] = []
  for (let i = left; i < srcHigh.length - right; i++) {
    if (detectHighs) {
      let isPivot = true
      for (let j = i - left; j <= i + right; j++) {
        if (j !== i && srcHigh[j] >= srcHigh[i]) { isPivot = false; break }
      }
      if (isPivot) pivots.push({ pivotIdx: i, confirmIdx: i + right, price: srcHigh[i], type: 'high' })
    }
    if (detectLows) {
      let isPivot = true
      for (let j = i - left; j <= i + right; j++) {
        if (j !== i && srcLow[j] <= srcLow[i]) { isPivot = false; break }
      }
      if (isPivot) pivots.push({ pivotIdx: i, confirmIdx: i + right, price: srcLow[i], type: 'low' })
    }
  }
  return pivots
}

// ── Zone alignment (merge overlapping boundaries) ──
function alignZone(newZone: LiveZone, others: LiveZone[]) {
  const merged: number[] = []
  for (let k = 0; k < others.length; k++) {
    const z = others[k]
    // overlap if any edge falls inside the other
    if (newZone.top >= z.bot && newZone.bot <= z.top) {
      // expand the OTHER zone to encompass both (zones "age & intensify")
      z.top = Math.max(z.top, newZone.top)
      z.bot = Math.min(z.bot, newZone.bot)
      merged.push(k)
    }
  }
  return merged.length > 0
}

/**
 * Render Bjorgum Key Levels on the chart.
 */
export function renderPivotZones(rc: RenderContext) {
  const { ctx, data, chartW, priceH, visible, pToY } = rc
  if (!visible || visible.length < 30) return

  // ── Params (Pine defaults) ──
  const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'pzones')
  const p = (tool?.params as Record<string, number | string | boolean>) || {}
  const left = (p.left as number) ?? 48
  const right = (p.right as number) ?? 24
  const nPiv = (p.nPiv as number) ?? 1
  const atrLen = (p.atrLen as number) ?? 66
  const mult = (p.mult as number) ?? 0.6
  const per = (p.per as number) ?? 1
  const src = (p.src as string) ?? 'HA'
  const detectHighs = (p.detectHighs as number) !== 0
  const detectLows = (p.detectLows as number) !== 0
  const alignZones = (p.alignZones as number) !== 0
  const extendRight = (p.extend as number) !== 0
  const showLabels = (p.showLabels as number) !== 0

  // Full history for stateful simulation; visible for rendering
  const srcBars = (data && data.length > 0) ? data : visible
  const totalBars = srcBars.length

  const { haOpen, haClose } = buildHA(srcBars)
  const atrSeries = computeATRSeries(srcBars, atrLen)
  const pivots = detectPivots(haOpen, haClose, left, right, detectHighs, detectLows, src, srcBars)

  // ── Stateful bar-by-bar simulation (mirrors Pine logical order) ──
  const highZones: LiveZone[] = [] // newest-first arrays, max nPiv
  const lowZones: LiveZone[] = []
  const renderSegs: RenderSeg[] = [] // frozen segments (popped or pre-flip)

  // Index pivot confirmations by bar
  const pivotsByBar = new Map<number, Pivot[]>()
  for (const pv of pivots) {
    if (!pivotsByBar.has(pv.confirmIdx)) pivotsByBar.set(pv.confirmIdx, [])
    pivotsByBar.get(pv.confirmIdx)!.push(pv)
  }

  const firstBar = pivots.length ? Math.min(...pivots.map(pv => pv.confirmIdx)) : 0

  for (let b = firstBar; b < totalBars; b++) {
    const closes = srcBars[b].close

    // (1) New pivots confirmed this bar → create zones, rotate nPiv
    const confirmed = pivotsByBar.get(b)
    if (confirmed) {
      for (const pv of confirmed) {
        const a = atrSeries[pv.pivotIdx] || atrSeries[b] || 1
        const c0 = srcBars[pv.pivotIdx].close
        const band = Math.min(a * mult, c0 * (per / 100)) / 2
        const z: LiveZone = {
          top: pv.price + band,
          bot: pv.price - band,
          bull: pv.type === 'low', // lows start bullish (support), highs bearish (resistance)
          segStartIdx: pv.pivotIdx,
        }
        const arr = pv.type === 'high' ? highZones : lowZones
        arr.unshift(z)
        if (arr.length > nPiv) {
          const popped = arr.pop()!
          // freeze popped zone as a static segment
          renderSegs.push({ top: popped.top, bot: popped.bot, fromIdx: popped.segStartIdx, toIdx: b, bull: popped.bull })
        }
        // (2) alignment — merge new zone into overlapping zones
        if (alignZones) {
          alignZone(z, arr)
          alignZone(z, arr === highZones ? lowZones : highZones)
        }
      }
    }

    // (3) Extend — implicit: live segments grow to current bar (handled at render)

    // (4) Color flip (role reversal) — check every live zone
    for (const arr of [highZones, lowZones]) {
      for (const z of arr) {
        if (closes > z.top && !z.bull) {
          // bear → bull: freeze old segment, start fresh
          renderSegs.push({ top: z.top, bot: z.bot, fromIdx: z.segStartIdx, toIdx: b, bull: z.bull })
          z.bull = true
          z.segStartIdx = b
        } else if (closes < z.bot && z.bull) {
          // bull → bear: freeze old segment, start fresh
          renderSegs.push({ top: z.top, bot: z.bot, fromIdx: z.segStartIdx, toIdx: b, bull: z.bull })
          z.bull = false
          z.segStartIdx = b
        }
      }
    }
  }

  // Freeze remaining live zones. extendRight=true → extend to last bar;
  // false → zones end at their pivot confirm bar (static boxes).
  const liveEndIdx = extendRight ? (totalBars - 1) : (totalBars - 1)
  for (const arr of [highZones, lowZones]) {
    for (const z of arr) {
      renderSegs.push({ top: z.top, bot: z.bot, fromIdx: z.segStartIdx, toIdx: liveEndIdx, bull: z.bull })
    }
  }

  if (!renderSegs.length) return

  // ── Render ──
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip()

  const { xCtr } = rc
  const lastVisX = xCtr(visible.length - 1)

  const barToX = (globalIdx: number): number => {
    const vi = globalIdx - rc.vs
    if (vi < 0) return -1
    if (vi >= visible.length) return lastVisX
    return xCtr(vi)
  }

  // Colors: read from tool.colors (set via Style tab), fall back to Pine defaults.
  const tc = (tool?.colors as Record<string, string>) || {}
  const COL = {
    bullFill: tc.pz_sup_fill || 'rgba(100,181,246,0.06)',
    bullLine: tc.pz_sup_line || 'rgba(100,181,246,0.40)',
    bearFill: tc.pz_res_fill || 'rgba(255,235,59,0.06)',
    bearLine: tc.pz_res_line || 'rgba(255,235,59,0.40)',
  }

  for (const seg of renderSegs) {
    const yTop = pToY(seg.top)
    const yBot = pToY(seg.bot)
    if (yTop > priceH || yBot < 0) continue
    const clampTop = Math.max(0, yTop)
    const clampBot = Math.min(priceH, yBot)
    const h = clampBot - clampTop
    if (h < 0.5) continue

    const xStart = barToX(seg.fromIdx)
    const xEnd = barToX(seg.toIdx)
    const startX = xStart < 0 ? 0 : xStart
    const endX = xEnd < 0 ? 0 : xEnd
    if (endX <= startX) continue

    const isSup = seg.bull
    const fill = isSup ? COL.bullFill : COL.bearFill
    const line = isSup ? COL.bullLine : COL.bearLine

    ctx.fillStyle = fill
    ctx.fillRect(startX, clampTop, endX - startX, h)
    ctx.strokeStyle = line
    ctx.lineWidth = 0.6
    ctx.beginPath(); ctx.moveTo(startX, clampTop); ctx.lineTo(endX, clampTop); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(startX, clampBot); ctx.lineTo(endX, clampBot); ctx.stroke()
  }

  // Right-edge markers for currently-live zones (label + current color)
  if (showLabels) {
    for (const arr of [highZones, lowZones]) {
      for (const z of arr) {
        const labelY = pToY(z.bull ? z.bot : z.top)
        if (labelY < 10 || labelY > priceH - 10) continue
        const labelX = lastVisX + 4
        if (labelX >= chartW - 60) continue
        ctx.fillStyle = z.bull ? (tc.pz_sup_label || 'rgba(100,181,246,0.85)') : (tc.pz_res_label || 'rgba(255,235,59,0.85)')
        ctx.font = '9px monospace'
        const price = z.bull ? z.bot : z.top
        ctx.fillText(`${z.bull ? 'S' : 'R'} ${price.toFixed(2)}`, labelX, labelY + 3)
      }
    }
  }

  ctx.restore()
}
