/**
 * Execution signal calculator — Lingua pop-short logic.
 *
 * 1. ENTRY: 2m high pops into/at EMA(9)+ATR(9)×0.5 (upper 0.5 dev band)
 *    → bar break confirms → short
 * 2. RECYCLE: 2m price hits EMA(20)-ATR(20)×2.0 (lower 2 dev band) → cover 30%
 * 3. COVER: 5m price hits EMA(20)-ATR(20)×2.0 (lower 2 dev band on 5m) → cover all
 * 4. STOP: swing high above entry
 */

export interface ExecSignal {
  barIdx: number
  type: 'entry' | 'cover-recycle' | 'cover-full' | 'stop'
  price: number
  stopPrice?: number
  label: string
}

function swingHigh(data: { high: number }[], i: number, lookback = 10): number {
  let sh = data[i].high
  for (let j = Math.max(0, i - lookback); j <= i; j++) sh = Math.max(sh, data[j].high)
  return sh
}

/**
 * Compute exec signals on 2m bars.
 * @param lowerBand5m  EMA(20)-ATR(20)×2.0 computed on 5m data, mapped to 2m bar indices
 */
export function calcExecSignals(
  bars: { time: number; open: number; high: number; low: number; close: number }[],
  ema9: (number | null)[],
  ema20: (number | null)[],
  atr9: (number | null)[],
  atr20: (number | null)[],
  lowerBand5m?: (number | null)[],
): ExecSignal[] {
  const signals: ExecSignal[] = []
  const n = bars.length

  enum S { WAIT, TREND, POPPED, POSITION_2M, POSITION_5M }
  let state: S = S.WAIT
  let trendStart = 0
  let popIdx = -1
  let entryCount = 0

  for (let i = 1; i < n; i++) {
    if (ema9[i] == null || ema20[i] == null || atr9[i] == null || atr20[i] == null) continue

    const e9 = ema9[i]!
    const e20 = ema20[i]!
    const a9 = atr9[i]!
    const a20 = atr20[i]!

    // Band levels on 2m
    const upper05 = e9 + a9 * 0.5   // upper 0.5 dev band
    const lower20 = e20 - a20 * 2.0 // lower 2 dev band

    // Crossover detection
    const pf = ema9[i - 1], ps = ema20[i - 1]
    const bearCross = pf != null && ps != null && pf >= ps && e9 < e20
    const bullCross = pf != null && ps != null && pf <= ps && e9 > e20

    if (bullCross) { state = S.WAIT; entryCount = 0; popIdx = -1; continue }
    if (bearCross) { state = S.TREND; trendStart = i; entryCount = 0; popIdx = -1; continue }

    // ── WAIT ──
    if (state === S.WAIT) continue

    // ── TREND: look for pop into upper 0.5 dev band ──
    if (state === S.TREND) {
      // Price high reaches into or at the 0.5 dev band
      if (bars[i].high >= upper05 - a9 * 0.05) {
        state = S.POPPED
        popIdx = i
      }
      continue
    }

    // ── POPPED: wait for bar break to confirm entry ──
    if (state === S.POPPED) {
      if (i > popIdx && bars[i].low < bars[i - 1].low) {
        // Bar break confirmed → entry
        const stop = swingHigh(bars, i, 10)
        signals.push({
          barIdx: i, type: 'entry',
          price: bars[i].low,
          stopPrice: stop,
          label: entryCount === 0 ? 'SHORT' : 'ADD',
        })
        state = S.POSITION_2M
        entryCount++
      }
      // Price pushes higher → update pop level
      else if (bars[i].high >= upper05 - a9 * 0.05) {
        popIdx = i
      }
      // Timeout — too many bars without confirmation
      else if (i - popIdx > 20) {
        state = S.TREND
        popIdx = -1
      }
      continue
    }

    // ── POSITION_2M: in position, monitoring 2m lower 2 dev band ──
    if (state === S.POSITION_2M) {
      // Check if 2m lower band hit
      if (bars[i].low <= lower20) {
        signals.push({
          barIdx: i, type: 'cover-recycle',
          price: bars[i].close,
          label: 'COVER 30%',
        })
        state = S.POSITION_5M
        continue
      }
      // Stop: price breaks above recent swing high
      const sl = swingHigh(bars, i - 1, 10)
      if (bars[i].high > sl && i > trendStart + 3) {
        signals.push({ barIdx: i, type: 'stop', price: sl, label: 'STOP' })
        state = S.TREND; entryCount = 0; popIdx = -1
      }
      continue
    }

    // ── POSITION_5M: monitoring 5m lower 2 dev band for full cover ──
    if (state === S.POSITION_5M) {
      const lb5 = lowerBand5m ? lowerBand5m[i] : null
      if (lb5 != null && bars[i].low <= lb5) {
        signals.push({
          barIdx: i, type: 'cover-full',
          price: bars[i].close,
          label: 'COVER ALL',
        })
        state = S.TREND; entryCount = 0; popIdx = -1
        continue
      }
      // Stop
      const sl = swingHigh(bars, i - 1, 10)
      if (bars[i].high > sl && i > trendStart + 3) {
        signals.push({ barIdx: i, type: 'stop', price: sl, label: 'STOP' })
        state = S.TREND; entryCount = 0; popIdx = -1
      }
    }
  }

  return signals
}
