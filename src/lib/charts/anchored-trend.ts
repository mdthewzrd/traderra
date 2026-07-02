/**
 * Anchored Trendline — standalone, decoupled, point-in-time-stable.
 *
 * Verbatim port of the pure compute core from render-lingua.ts
 * (fractalPivots + confirmPivot + atrDisp + computeAnchoredTrendline).
 * No store / render-context deps → safe to import into the scanner and
 * other single-timeframe canvas renderers.
 *
 * A trendline connects two consecutive SAME-TYPE confirmed pivots A→B.
 * Look Left (left) + Look Right (right) define the confirmation window.
 * The slope is FROZEN once the last pivot clears its look-right (setBar).
 *   confirmed[A.idx→setBar] = solid established history
 *   proj[setBar→break]      = dotted forward projection
 * Break = first close through the line. MAIN lines use a bigger look-right
 * (more significant pivots) and persist until a new one forms.
 *
 * LIGHT set:  left=15, right=5   (the "15/5")
 * MAIN set:   left=25, right=10  (the "25/10")
 */

/** fractalPivots — local extrema. findHigh=true → peaks, false → troughs. */
export function fractalPivots(src: number[], left: number, right: number, findHigh: boolean): { idx: number; price: number }[] {
  const n = src.length
  const out: { idx: number; price: number }[] = []
  for (let i = left; i < n - right; i++) {
    const v = src[i]
    if (isNaN(v)) continue
    let ok = true
    for (let k = 1; k <= left && ok; k++) { const x = src[i - k]; if (isNaN(x) || (findHigh ? x > v : x < v)) ok = false }
    for (let k = 1; k <= right && ok; k++) { const x = src[i + k]; if (isNaN(x) || (findHigh ? x > v : x < v)) ok = false }
    if (ok) out.push({ idx: i, price: v })
  }
  return out
}

/** confirmPivot — second look-window confirmation (drops weak pattern pivots). */
export function confirmPivot(
  cands: { idx: number; price: number }[], src: number[], findHigh: boolean,
  left: number, right: number,
): { idx: number; price: number }[] {
  return cands.filter(p => {
    for (let k = p.idx - left; k <= p.idx + right; k++) {
      if (k === p.idx || k < 0 || k >= src.length) continue
      if (isNaN(src[k])) continue
      if (findHigh ? src[k] > p.price : src[k] < p.price) return false
    }
    return true
  })
}

/** atrDisp — Wilder's RMA of True Range over displayed arrays (min-size filter). */
export function atrDisp(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length
  const tr = new Array(n).fill(NaN)
  for (let i = 1; i < n; i++) {
    if (isNaN(high[i]) || isNaN(low[i]) || isNaN(close[i - 1])) continue
    const pc = close[i - 1]
    tr[i] = Math.max(high[i] - low[i], Math.abs(high[i] - pc), Math.abs(low[i] - pc))
  }
  const out = new Array(n).fill(NaN)
  const k = 1 / Math.max(1, len)
  let prev = NaN
  for (let i = 0; i < n; i++) {
    if (isNaN(tr[i])) continue
    prev = isNaN(prev) ? tr[i] : tr[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export type AnchoredSeg = {
  dir: 1 | -1                  // 1 = support (lows), -1 = resistance (highs)
  setBar: number               // bar where the line is "set" (last pivot idx + look-right)
  breakBar: number            // -1 if unbroken, else first close through the line
  main: boolean               // main line (bigger look-right, persistent)
  confirmed: number[]         // A.idx → setBar (solid, established history)
  proj: number[]              // setBar → endBar (dotted, the "set" forward projection)
}

/**
 * computeAnchoredTrendline — NON-REPAINTING trendlines.
 * Returns light segments (left/right) + main segments (mainLeft/mainRight).
 * bothSides=0 → winning side only (support=rising lows, resistance=falling highs).
 */
export function computeAnchoredTrendline(
  high: number[], low: number[], close: number[],
  tlOn: number, left: number, right: number, pattern: number,
  mainLeft: number, mainRight: number, mainPattern: number,
  minSize: number, bothSides: number,
): { segments: AnchoredSeg[] } {
  const empty: { segments: AnchoredSeg[] } = { segments: [] }
  if (!tlOn) return empty
  const n = close.length
  const pat = Math.max(1, Math.round(pattern))
  const mainPat = Math.max(1, Math.round(mainPattern))
  if (n < left + Math.max(right, mainRight) + 5) return empty
  const atrArr = minSize > 0 ? atrDisp(high, low, close, 14) : []

  const build = (isHigh: boolean, L: number, R: number, patN: number, main: boolean): AnchoredSeg[] => {
    const src = isHigh ? high : low
    const pv = confirmPivot(fractalPivots(src, patN, patN, isHigh), src, isHigh, L, R)
    const out: AnchoredSeg[] = []
    for (let i = 0; i < pv.length - 1; i++) {
      const A = pv[i], B = pv[i + 1]
      const slope = (B.price - A.price) / (B.idx - A.idx)
      if (minSize > 0) {
        const a = atrArr[A.idx]
        if (!isNaN(a) && a > 0 && Math.abs(B.price - A.price) < minSize * a) continue
      }
      if (!bothSides) {
        const rising = slope > 0
        if (!isHigh && !rising) continue      // support = rising lows
        if (isHigh && rising) continue        // resistance = falling highs
      }
      const setBar = Math.min(n - 1, B.idx + R)
      let rawBreak = -1
      for (let k = setBar; k < n; k++) {
        const lv = A.price + slope * (k - A.idx)
        const cl = close[k]
        if (isNaN(cl)) continue
        if (isHigh ? cl > lv : cl < lv) { rawBreak = k; break }
      }
      const endBar = rawBreak >= 0 ? rawBreak : n - 1
      const confirmed = new Array(n).fill(NaN), proj = new Array(n).fill(NaN)
      for (let k = A.idx; k <= setBar && k <= endBar; k++) confirmed[k] = A.price + slope * (k - A.idx)
      for (let k = setBar; k <= endBar; k++) proj[k] = A.price + slope * (k - A.idx)
      out.push({ dir: isHigh ? -1 : 1, setBar, breakBar: rawBreak, main, confirmed, proj })
    }
    return out
  }

  const segments: AnchoredSeg[] = [
    ...build(false, left, right, pat, false),           // light support (lows)
    ...build(true, left, right, pat, false),            // light resistance (highs)
    ...build(false, mainLeft, mainRight, mainPat, true), // main support
    ...build(true, mainLeft, mainRight, mainPat, true),  // main resistance
  ]
  return { segments }
}
