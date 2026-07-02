/**
 * Mike's Bands + Lingua Cycle backtest engine — single source of truth.
 *
 * Pure / browser-safe (no Node deps). Mirrors the trader's actual chart stack
 * (Mike's Bands template) and the Lingua Trend Cycle, per the annotated
 * execution images + lingua-cycle-mental-model:
 *
 *   Stages: Consolidation -> Breakout/Trendbreak -> Uptrend -> Extreme Deviation
 *           -> Reversion-to-mean -> (resume OR Trendbreak) -> ...
 *   Indicators (all on the working TF = primary mean reference):
 *     - 9/20 EMA cloud  = TRAIL (breakout/trendbreak trigger)
 *     - 72/89 EMA cloud = MEAN / REGIME (72>89 longs armed, 72<89 shorts armed)
 *     - Dev Band 72/89  = EXTREME band at 6.9×ATR (the "extreme dev" reset)
 *
 * SETUP SPEC (6 components, per EDGE_METHODOLOGY):
 *   1. Regime gate:  72/89 cloud -> longs armed 72>89, shorts armed 72<89
 *   2. Entry trigger: 9/20 cloud flip IN the regime dir -> fill at NEXT bar open
 *   3. Confirmation:  trigger bar closes on the regime side of the 89-mean
 *   4. Stop:          swing extreme (min-low long / max-high short) over SWING_LB bars
 *   5. Exit (cycle):  STOP > EXTREME (6.9 band) > REVERSION (tag 89-mean after +1R)
 *                     > CYCLE (opposite 9/20 flip)
 *   6. Risk:          $ per trade -> shares = risk / (entry - stop). $PnL = risk * R.
 *
 * Math matches Traderra (ema seeds at bar0; Wilder ATR uses RUNNING-SEED so bands
 * plot from bar0, per the atr-running-seed fix). Single TF in v1 (HTF overlay = v2).
 *
 * Usage:  const { trades, stats } = runMikesBandsBacktest(bars, params)
 */
export interface MBBar {
  time: number | string
  open: number
  high: number
  low: number
  close: number
}

export interface MBParams {
  trailFast?: number      // 9
  trailSlow?: number      // 20
  meanFast?: number       // 72
  meanSlow?: number       // 89
  extremeMult?: number    // 6.9 (ATR multiple on the 89-mean)
  swingLookback?: number  // 10
  riskPerTrade?: number   // 100
  useExtremeExit?: boolean
  useReversionTrail?: boolean
  useCycleExit?: boolean
}

export interface MBTrade {
  openDate: string
  exitDate: string
  exitLabel: string         // STOP | EXTREME | REVERSION | CYCLE | OPEN@END
  side: 'long' | 'short'
  entry: number
  stop: number
  exit: number
  tradeR: number
  pnl: number
}

export interface MBStats {
  bars: number
  closed: number
  open: number
  wins: number
  losses: number
  winRate: number
  avgR: number
  totR: number
  avgWinR: number
  avgLossR: number
  profitFactor: number
  maxDD: number
  labels: Record<string, number>
}

export const MB_DEFAULTS: Required<MBParams> = {
  trailFast: 9, trailSlow: 20,
  meanFast: 72, meanSlow: 89,
  extremeMult: 6.9,
  swingLookback: 10,
  riskPerTrade: 100,
  useExtremeExit: true,
  useReversionTrail: true,
  useCycleExit: true,
}

// ── indicators (match Traderra) ─────────────────────────────────────────────
function ema(vals: number[], span: number): number[] {
  const n = vals.length, out = new Array(n).fill(NaN)
  if (!n) return out
  const k = 2 / (span + 1)
  let prev = vals[0]; out[0] = prev
  for (let i = 1; i < n; i++) {
    if (isNaN(vals[i])) { out[i] = prev; continue }
    prev = vals[i] * k + prev * (1 - k); out[i] = prev
  }
  return out
}
// Wilder ATR with RUNNING-SEED (plots from bar0; converges to exact Wilder by bar `len`)
function wilderAtr(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length, out = new Array(n).fill(NaN)
  if (!n) return out
  out[0] = high[0] - low[0]                                   // bar0 = range (no prev close)
  let a = out[0]
  for (let i = 1; i < n; i++) {
    const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
    if (i <= len) a = (a * (i - 1) + tr) / i                  // running avg of TRs[1..i]
    else          a = (a * (len - 1) + tr) / len              // standard Wilder smoothing
    out[i] = a
  }
  return out
}

function barDate(bars: MBBar[], i: number): string {
  const t = bars[i].time
  if (typeof t === 'string') return t
  return new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16)
}

// ── the machine ──────────────────────────────────────────────────────────────
export function runMikesBandsBacktest(
  bars: MBBar[],
  userParams: MBParams = {},
): { trades: MBTrade[]; stats: MBStats } {
  const p = { ...MB_DEFAULTS, ...userParams }
  const close = bars.map(b => b.close), high = bars.map(b => b.high),
        low = bars.map(b => b.low), open = bars.map(b => b.open)
  const e9  = ema(close, p.trailFast),  e20 = ema(close, p.trailSlow)
  const e72 = ema(close, p.meanFast),   e89 = ema(close, p.meanSlow)
  const a89 = wilderAtr(high, low, close, p.meanSlow)
  const upX = e89.map((e, i) => e + a89[i] * p.extremeMult)
  const dnX = e89.map((e, i) => e - a89[i] * p.extremeMult)
  const n = close.length

  const swingStop = (i: number, side: 'long' | 'short') => {
    const lo = Math.max(0, i - p.swingLookback)
    let stop = side === 'long' ? Infinity : -Infinity
    for (let j = lo; j <= i; j++) {
      if (side === 'long') stop = Math.min(stop, low[j])
      else stop = Math.max(stop, high[j])
    }
    return stop
  }

  const trades: MBTrade[] = []
  let openTrade: (MBTrade & { entryI: number }) | null = null

  for (let i = 1; i < n; i++) {
    const bar = bars[i]

    // ── manage open trade ──
    if (openTrade) {
      let exitPrice: number | null = null
      let exitReason: string | null = null
      const side = openTrade.side
      // (d) STOP — intrabar worst case
      if ((side === 'long' && low[i] <= openTrade.stop) || (side === 'short' && high[i] >= openTrade.stop)) {
        exitPrice = openTrade.stop; exitReason = 'STOP'
      }
      // (a) EXTREME — reach the 6.9 band at close
      if (exitPrice === null && p.useExtremeExit) {
        if (side === 'long' && close[i] >= upX[i]) { exitPrice = close[i]; exitReason = 'EXTREME' }
        if (side === 'short' && close[i] <= dnX[i]) { exitPrice = close[i]; exitReason = 'EXTREME' }
      }
      // (b) REVERSION — after +1R, tag the 89-mean (trail)
      if (exitPrice === null && p.useReversionTrail) {
        const dir = side === 'long' ? 1 : -1
        const rNow = (dir * (close[i] - openTrade.entry)) / Math.abs(openTrade.entry - openTrade.stop)
        if (rNow >= 1) {
          if (side === 'long' && low[i] <= e89[i]) { exitPrice = e89[i]; exitReason = 'REVERSION' }
          if (side === 'short' && high[i] >= e89[i]) { exitPrice = e89[i]; exitReason = 'REVERSION' }
        }
      }
      // (c) CYCLE — opposite 9/20 flip at close
      if (exitPrice === null && p.useCycleExit) {
        const flipDown = e9[i - 1] >= e20[i - 1] && e9[i] < e20[i]
        const flipUp   = e9[i - 1] <= e20[i - 1] && e9[i] > e20[i]
        if (side === 'long' && flipDown) { exitPrice = close[i]; exitReason = 'CYCLE' }
        if (side === 'short' && flipUp)  { exitPrice = close[i]; exitReason = 'CYCLE' }
      }

      if (exitPrice !== null && exitReason !== null) {
        const dir = side === 'long' ? 1 : -1
        const r = (dir * (exitPrice - openTrade.entry)) / Math.abs(openTrade.entry - openTrade.stop)
        openTrade.exitDate = barDate(bars, i)
        openTrade.exitLabel = exitReason
        openTrade.exit = exitPrice
        openTrade.tradeR = r
        openTrade.pnl = p.riskPerTrade * r
        trades.push(openTrade); openTrade = null
      }
    }

    // ── entry when flat ──
    if (!openTrade) {
      const flipUp   = e9[i - 1] <= e20[i - 1] && e9[i] > e20[i]
      const flipDown = e9[i - 1] >= e20[i - 1] && e9[i] < e20[i]
      const upRegime = e72[i] > e89[i]
      const dnRegime = e72[i] < e89[i]
      const wantLong  = flipUp   && upRegime
      const wantShort = flipDown && dnRegime
      if ((wantLong || wantShort) && i + 1 < n) {
        const side: 'long' | 'short' = wantLong ? 'long' : 'short'
        const entry = open[i + 1]
        const stop = swingStop(i, side)
        const confOK = side === 'long' ? close[i] > e89[i] : close[i] < e89[i]
        const valid = side === 'long' ? stop < entry : stop > entry
        if (confOK && valid && !isNaN(entry) && !isNaN(stop)) {
          openTrade = {
            openDate: barDate(bars, i + 1), exitDate: '', exitLabel: '',
            side, entry, stop, exit: NaN, tradeR: 0, pnl: 0, entryI: i + 1,
          }
        }
      }
    }
  }

  // close any still-open at the end
  if (openTrade) {
    const last = n - 1
    const dir = openTrade.side === 'long' ? 1 : -1
    const r = (dir * (close[last] - openTrade.entry)) / Math.abs(openTrade.entry - openTrade.stop)
    openTrade.exitDate = barDate(bars, last)
    openTrade.exitLabel = 'OPEN@END'
    openTrade.exit = close[last]
    openTrade.tradeR = r
    openTrade.pnl = p.riskPerTrade * r
    trades.push(openTrade); openTrade = null
  }

  return { trades, stats: computeStats(trades, n) }
}

export function computeStats(trades: MBTrade[], bars = 0): MBStats {
  const closed = trades.filter(t => t.exitLabel !== 'OPEN@END')
  const open = trades.length - closed.length
  const rs = closed.map(t => t.tradeR)
  const wins = closed.filter(t => t.tradeR > 0)
  const losses = closed.filter(t => t.tradeR < 0)
  const totR = rs.reduce((a, b) => a + b, 0)
  const grossW = wins.reduce((a, b) => a + b.tradeR, 0)
  const grossL = Math.abs(losses.reduce((a, b) => a + b.tradeR, 0))
  let peak = 0, eq = 0, maxDD = 0
  for (const t of closed) { eq += t.tradeR; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq) }
  const labels: Record<string, number> = {}
  for (const t of trades) labels[t.exitLabel] = (labels[t.exitLabel] || 0) + 1
  return {
    bars, closed: closed.length, open,
    wins: wins.length, losses: losses.length,
    winRate: closed.length ? (100 * wins.length) / closed.length : 0,
    avgR: closed.length ? totR / closed.length : 0,
    totR,
    avgWinR: wins.length ? wins.reduce((a, b) => a + b.tradeR, 0) / wins.length : 0,
    avgLossR: losses.length ? losses.reduce((a, b) => a + b.tradeR, 0) / losses.length : 0,
    profitFactor: grossL ? grossW / grossL : (grossW ? Infinity : 0),
    maxDD, labels,
  }
}
