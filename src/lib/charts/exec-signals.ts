/**
 * Execution signal calculator — Lingua entry/cover/stop logic.
 *
 * Short side execution loop:
 * 1. ENTRY: 2m 9/20 bearish cross → pop near upper 0.5x ATR band → 2m bar break → short
 * 2. COVER 30% RECYCLE: 2m lower dev band tagged → 2m bar break of lower highs → cover 30%
 * 3. COVER FULL: 5m lower dev band inner line (0.5x ATR) tagged → 2m bar break → close rest
 * 4. STOP: mini line at recent swing high or bar break of lower highs
 */

export interface ExecSignal {
  barIdx: number
  type: 'entry' | 'cover-recycle' | 'cover-full' | 'stop'
  price: number
  stopPrice?: number
  label: string
}

/**
 * Detect bar break: current bar's low breaks below prior bar's low.
 */
function barBreak(data: { low: number }[], i: number): boolean {
  if (i < 1) return false
  return data[i].low < data[i - 1].low
}

/**
 * Detect bar break of lower highs: current bar low breaks below
 * the low of the most recent bar that made a lower high.
 */
function lowerHighBreak(data: { high: number; low: number }[], i: number, lookback: number = 10): boolean {
  if (i < 2) return false
  // Find recent bars where high < prior bar's high (lower high)
  for (let j = i - 1; j >= Math.max(1, i - lookback); j--) {
    if (data[j].high < data[j - 1].high) {
      // Current bar breaks below that lower-high bar's low
      if (data[i].low < data[j].low) return true
    }
  }
  return false
}

/**
 * Find the stop level: recent swing high within lookback bars.
 */
function swingHighLevel(data: { high: number }[], i: number, lookback: number = 10): number {
  let sh = data[i].high
  for (let j = Math.max(0, i - lookback); j <= i; j++) {
    sh = Math.max(sh, data[j].high)
  }
  return sh
}

/**
 * Compute execution signals on 2m bars.
 *
 * Needs pre-computed EMA(9), EMA(20), ATR(9) on the 2m data,
 * and optionally 5m lower dev band values mapped to 2m timestamps.
 */
export function calcExecSignals(
  data2m: { time: number; open: number; high: number; low: number; close: number; volume: number }[],
  ema9: (number | null)[],
  ema20: (number | null)[],
  atr9: (number | null)[],
  lowerBand5m?: (number | null)[],  // 5m lower dev band inner (0.5x), mapped to 2m timestamps
): ExecSignal[] {
  const signals: ExecSignal[] = []
  const n = data2m.length

  // State machine
  enum State { WAITING, TRENDING, IN_POSITION }
  let state: State = State.WAITING
  let trendStartIdx = 0
  let entryCount = 0  // how many entries in current trend

  // Band levels
  const upperBand = (i: number) => ema9[i] != null && atr9[i] != null
    ? ema9[i]! + atr9[i]! * 0.5
    : null
  const lowerBand = (i: number) => ema9[i] != null && atr9[i] != null
    ? ema9[i]! - atr9[i]! * 2.0
    : null

  for (let i = 1; i < n; i++) {
    if (ema9[i] == null || ema20[i] == null) continue

    const fast = ema9[i]!
    const slow = ema20[i]!
    const pf = ema9[i - 1]
    const ps = ema20[i - 1]

    // Detect bearish crossover
    const bearCross = pf != null && ps != null && pf >= ps && fast < slow
    // Detect bullish crossover (trend over)
    const bullCross = pf != null && ps != null && pf <= ps && fast > slow

    // State transitions
    if (bearCross) {
      state = State.TRENDING
      trendStartIdx = i
      entryCount = 0
    }

    if (bullCross) {
      state = State.WAITING
      entryCount = 0
      continue
    }

    if (state !== State.TRENDING) continue

    const ub = upperBand(i)
    const lb = lowerBand(i)
    const lb5 = lowerBand5m ? lowerBand5m[i] : null

    // Check for pop into upper dev band
    const popHit = ub != null && data2m[i].high >= ub - (atr9[i] ?? 0) * 0.1  // within 10% of ATR of the band

    // ── ENTRY SIGNAL ──
    // Price pops near upper band + bar break confirms
    if (popHit && barBreak(data2m, i)) {
      const stop = swingHighLevel(data2m, i, 10)
      signals.push({
        barIdx: i,
        type: 'entry',
        price: data2m[i].low,  // entry at bar break level
        stopPrice: stop,
        label: entryCount === 0 ? 'SHORT' : 'ADD',
      })
      state = State.IN_POSITION
      entryCount++
      continue
    }

    if (state !== State.IN_POSITION) continue

    // ── COVER 30% RECYCLE ──
    // 2m lower dev band tagged + bar break of lower highs
    if (lb != null && data2m[i].low <= lb && lowerHighBreak(data2m, i)) {
      signals.push({
        barIdx: i,
        type: 'cover-recycle',
        price: data2m[i].close,
        label: 'COVER 30%',
      })
      // Stay in position with remaining 70%, but note we hit 2m target
      continue
    }

    // ── COVER FULL ──
    // 5m lower dev band tagged + bar break confirms
    if (lb5 != null && data2m[i].low <= lb5 && lowerHighBreak(data2m, i)) {
      signals.push({
        barIdx: i,
        type: 'cover-full',
        price: data2m[i].close,
        label: 'COVER ALL',
      })
      state = State.TRENDING  // reset, look for next pop
      entryCount = 0
      continue
    }

    // ── STOP ──
    // If price breaks above recent swing high, stop out
    const stopLevel = swingHighLevel(data2m, i - 1, 10)
    if (data2m[i].high > stopLevel && i > trendStartIdx + 2) {
      signals.push({
        barIdx: i,
        type: 'stop',
        price: stopLevel,
        label: stopLevel.toFixed(2),
      })
      state = State.TRENDING  // look for next pop
      entryCount = 0
    }
  }

  return signals
}
