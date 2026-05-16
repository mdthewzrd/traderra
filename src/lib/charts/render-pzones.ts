/**
 * Pivot Zones (pzones) — support/resistance bands from swing highs/lows.
 * Detects swing points, clusters them into zones, renders colored bands.
 */

import type { RenderContext } from './render-types'

interface SwingPoint {
  idx: number
  price: number
  type: 'high' | 'low'
}

interface Zone {
  priceTop: number
  priceBot: number
  type: 'support' | 'resistance'
  strength: number
}

/**
 * Detect swing highs and lows.
 * A swing high = bar.high higher than N bars on each side.
 */
function detectSwings(bars: any[], lookback: number = 5): SwingPoint[] {
  const swings: SwingPoint[] = []
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true
    let isLow = true
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false
    }
    if (isHigh) swings.push({ idx: i, price: bars[i].high, type: 'high' })
    if (isLow) swings.push({ idx: i, price: bars[i].low, type: 'low' })
  }
  return swings
}

/**
 * Cluster swing points into zones (merge nearby levels).
 */
function clusterZones(swings: SwingPoint[], atr: number | null, mergeFactor: number = 0.5): Zone[] {
  if (!swings.length) return []

  // Sort by price
  const sorted = [...swings].sort((a, b) => a.price - b.price)
  const zones: Zone[] = []

  let clusterStart = 0
  for (let i = 1; i <= sorted.length; i++) {
    const endOfCluster = i === sorted.length || (sorted[i].price - sorted[clusterStart].price) > (mergeFactor * (atr || sorted[clusterStart].price * 0.005))
    if (endOfCluster) {
      const cluster = sorted.slice(clusterStart, i)
      const prices = cluster.map(s => s.price)
      const highs = cluster.filter(s => s.type === 'high')
      const lows = cluster.filter(s => s.type === 'low')
      const top = Math.max(...prices)
      const bot = Math.min(...prices)

      if (highs.length >= lows.length) {
        zones.push({ priceTop: top, priceBot: bot, type: 'resistance', strength: cluster.length })
      } else {
        zones.push({ priceTop: top, priceBot: bot, type: 'support', strength: cluster.length })
      }
      clusterStart = i
    }
  }

  return zones
}

/**
 * Render pivot zones on the chart.
 */
export function renderPivotZones(rc: RenderContext) {
  const { ctx, data, chartW, priceH, visible, pToY } = rc

  if (visible.length < 20) return

  // Simple ATR estimate for merge distance
  let atrSum = 0
  const atrLen = Math.min(14, visible.length - 1)
  for (let i = visible.length - atrLen; i < visible.length; i++) {
    const b = visible[i]
    atrSum += b.high - b.low
  }
  const atr = atrSum / atrLen

  // Detect swings from full visible dataset
  const swings = detectSwings(visible, 3)
  const zones = clusterZones(swings, atr)

  // Render zones
  ctx.save()
  ctx.beginPath(); ctx.rect(0, 0, chartW, priceH); ctx.clip()

  for (const zone of zones) {
    const yTop = pToY(zone.priceTop)
    const yBot = pToY(zone.priceBot)
    if (yTop > priceH || yBot < 0) continue
    const clampTop = Math.max(0, yTop)
    const clampBot = Math.min(priceH, yBot)
    const h = clampBot - clampTop
    if (h < 1) continue

    const alpha = Math.min(0.25, 0.05 + zone.strength * 0.03)

    if (zone.type === 'support') {
      ctx.fillStyle = `rgba(34,197,94,${alpha})`
      ctx.fillRect(0, clampTop, chartW, h)
      ctx.strokeStyle = `rgba(34,197,94,${alpha + 0.1})`
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, clampTop); ctx.lineTo(chartW, clampTop); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, clampBot); ctx.lineTo(chartW, clampBot); ctx.stroke()
    } else {
      ctx.fillStyle = `rgba(239,68,68,${alpha})`
      ctx.fillRect(0, clampTop, chartW, h)
      ctx.strokeStyle = `rgba(239,68,68,${alpha + 0.1})`
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(0, clampTop); ctx.lineTo(chartW, clampTop); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, clampBot); ctx.lineTo(chartW, clampBot); ctx.stroke()
    }
  }

  ctx.restore()
}
