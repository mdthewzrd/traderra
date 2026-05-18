/**
 * Canvas drawing utilities for chart annotations.
 * Extracted from inline JS (lines 4563-4680).
 * Pure canvas drawing functions — no DOM or state dependencies.
 */

export function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number, col: string) {
  ctx.save()
  ctx.setLineDash([])
  ctx.fillStyle = '#10131a'
  ctx.strokeStyle = col
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

export function renderPolylinePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], closed: boolean) {
  if (!Array.isArray(pts) || !pts.length) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  if (closed && pts.length > 2) ctx.closePath()
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines
}

export function hexToRgb(col: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!col || typeof col !== 'string' || col[0] !== '#') return null
  let hex = col.slice(1)
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  if (hex.length !== 6) return null
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
}

export function colorWithAlpha(col: string, alpha: number): string {
  if (col && col.startsWith('rgba(')) return col.replace(/rgba\(([^)]+),[^,]+\)$/, 'rgba($1,' + alpha + ')')
  const rgb = hexToRgb(col || '#dde3f0')
  return rgb ? ('rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')') : (col || '#dde3f0')
}

export function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  if (!dx && !dy) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function distanceToPolyline(px: number, py: number, pts: { x: number; y: number }[], closed: boolean): number {
  if (!Array.isArray(pts) || pts.length < 2) return Infinity
  let best = Infinity
  for (let i = 1; i < pts.length; i++) best = Math.min(best, pointToSegmentDistance(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y))
  if (closed && pts.length > 2) best = Math.min(best, pointToSegmentDistance(px, py, pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y))
  return best
}

export function getRayRightPoint(x1: number, y1: number, x2: number, y2: number, targetX: number) {
  if (x2 == null || y2 == null) return { x: targetX, y: y1 }
  if (Math.abs(x2 - x1) < 0.0001) return { x: x1, y: y2 }
  const slope = (y2 - y1) / (x2 - x1)
  return { x: targetX, y: y1 + slope * (targetX - x1) }
}

export function annLineWidth(ann: any): number {
  return ann.lineWidth || 1.2
}

export function annLineDash(ann: any): number[] {
  return ann.dashed ? [6, 4] : []
}

/** Check if annotation uses point array format */
export function isPointArrayAnn(ann: any): boolean {
  return Array.isArray(ann.points) && ann.points.length >= 2
}

/** Get screen coordinates from annotation points */
export function getScreenPointsFromAnn(ann: any, annTimeToX: (t: number) => number | null, pToY: (p: number) => number): { x: number; y: number }[] {
  if (!isPointArrayAnn(ann)) {
    const x1 = annTimeToX(ann.x1), y1 = pToY(ann.y1)
    const x2 = ann.x2 != null ? annTimeToX(ann.x2) : x1, y2 = ann.y2 != null ? pToY(ann.y2) : y1
    const pts: { x: number; y: number }[] = []
    if (x1 != null) pts.push({ x: x1, y: y1 })
    if (x2 != null) pts.push({ x: x2, y: y2 })
    return pts
  }
  return ann.points.map((p: any) => {
    const x = annTimeToX(p.x)
    return { x: x ?? 0, y: pToY(p.y) }
  }).filter((p: any) => p.x != null)
}

/** Get bounding box of screen points */
export function getPointBounds(pts: { x: number; y: number }[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!pts.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
