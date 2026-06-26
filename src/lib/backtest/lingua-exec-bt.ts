/**
 * Lingua Exec backtest engine — single source of truth for the trade machine.
 *
 * Pure / browser-safe (no Node deps). Faithful replica of the machine in
 *   src/lib/charts/render-lingua-exec.ts  (EMA/Wilder-ATR, 6-state regime with
 *   2-bar hysteresis, long-only exec). If the chart logic changes, re-sync here
 *   and in exec-backtest.mjs.
 *
 * Usage:  const { trades, stats } = runLinguaExecBacktest(bars, params)
 */

export interface LEBBar {
  time: number | string
  open: number
  high: number
  low: number
  close: number
}

export interface LinguaExecParams {
  fast?: number
  slow?: number
  regimeHold?: number
  tightDn?: number      // ADD stop ATR mult (3.6)
  entryMultDn?: number  // E1 stop ATR mult (3.9)
  addFreedMin?: number  // add freed-risk fraction (0.2)
  recycleMult?: number  // near-extreme zone (6.0)
}

export interface LEBFill {
  date: string
  price: number
  stop: number
  kind: 'E1' | 'ADD1' | 'ADD'
}

export interface LEBUnit {
  r: number        // R-multiple realized
  date: string
  fill: number
  exit: number
}

export interface LEBTrade {
  openDate: string
  exitDate: string
  exitLabel: string          // BRK+9/20 | RC+39/61 | 39/61 | SL | REGIME | OPEN@END
  openAtEnd?: boolean
  fills: LEBFill[]
  unitsClosed: LEBUnit[]
  tradeR: number             // sum of unit R
}

export interface LEBStats {
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

export const LE_DEFAULTS: Required<LinguaExecParams> = {
  fast: 50, slow: 89, regimeHold: 2,
  tightDn: 3.6, entryMultDn: 3.9, addFreedMin: 0.2, recycleMult: 6.0,
}

// ── indicators (exact copies from render-lingua-exec.ts) ─────────────────────
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
function wilderAtr(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length, out = new Array(n).fill(NaN)
  if (n < len + 1) return out
  let a = 0
  for (let i = 1; i <= len; i++)
    a += Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  a /= len; out[len] = a
  for (let i = len + 1; i < n; i++) {
    const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
    a = (a * (len - 1) + tr) / len; out[i] = a
  }
  return out
}

// ── regime (exact: 2-bar hysteresis + 6-state) ───────────────────────────────
function computeRegimes(close, high, low, eFast, eSlow, e72, a72, e89, a89, hold) {
  const n = close.length
  const bullH = new Array(n).fill(false)
  let macro = -1, oppRun = 0
  for (let i = 89; i < n; i++) {
    if (isNaN(eFast[i]) || isNaN(eSlow[i])) continue
    const wantBull = eFast[i] >= eSlow[i]
    if (macro === -1) { macro = wantBull ? 0 : 1; oppRun = 0 }
    else {
      const opp = macro === 0 ? !wantBull : wantBull
      if (opp) { if (++oppRun >= hold) { macro = wantBull ? 0 : 1; oppRun = 0 } }
      else oppRun = 0
    }
    bullH[i] = macro === 0
  }
  const regimes = new Array(n).fill(-1)
  let st = -1
  for (let i = 89; i < n; i++) {
    if (isNaN(eFast[i]) || isNaN(eSlow[i]) || isNaN(a72[i]) || isNaN(a89[i])) continue
    const upBand = e72[i] + a72[i] * 6.9, dnBand = e89[i] - a89[i] * 6.9
    const bull = bullH[i]
    const exUp = high[i] >= upBand, exDn = low[i] <= dnBand
    const tagDown = low[i] <= eFast[i], tagUp = high[i] >= eFast[i]
    if (st === -1) st = bull ? 0 : 3
    if (bull && st >= 3) st = 0
    else if (!bull && st <= 2) st = 3
    if (st === 0) { if (exUp) st = 1 }
    else if (st === 1) { if (!exUp) st = 2 }
    else if (st === 2) { if (tagDown) st = 0; else if (exUp) st = 1 }
    else if (st === 3) { if (exDn) st = 4 }
    else if (st === 4) { if (!exDn) st = 5 }
    else if (st === 5) { if (tagUp) st = 3; else if (exDn) st = 4 }
    regimes[i] = st
  }
  return regimes
}

function barDate(bars: LEBBar[], i: number): string {
  const t = bars[i].time
  if (typeof t === 'string') return t
  return new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 16)
}

// ── the machine ──────────────────────────────────────────────────────────────
export function runLinguaExecBacktest(
  bars: LEBBar[],
  userParams: LinguaExecParams = {},
): { trades: LEBTrade[]; stats: LEBStats } {
  const p = { ...LE_DEFAULTS, ...userParams }
  const close = bars.map(b => b.close), high = bars.map(b => b.high),
        low = bars.map(b => b.low), open = bars.map(b => b.open)
  const eFast = ema(close, p.fast), eSlow = ema(close, p.slow)
  const e72 = ema(close, 72), e89 = ema(close, p.slow)
  const a72 = wilderAtr(high, low, close, 72), a89 = wilderAtr(high, low, close, 89)
  const e9 = ema(close, 9), e20 = ema(close, 20), e39 = ema(close, 39), e61 = ema(close, 61)
  const regimes = computeRegimes(close, high, low, eFast, eSlow, e72, a72, e89, a89, p.regimeHold)
  const n = close.length

  const trades: LEBTrade[] = []
  let position: { price: number; stop: number; date: string }[] = []
  let curTrade: LEBTrade | null = null

  const closeHalf = (units, price) => {
    const half = Math.max(1, Math.ceil(units.length / 2))
    return units.splice(0, half).map(u => ({ r: (price - u.price) / (u.price - u.stop), date: u.date, fill: u.price, exit: price }))
  }
  const closeAll = (units, price) =>
    units.splice(0, units.length).map(u => ({ r: (price - u.price) / (u.price - u.stop), date: u.date, fill: u.price, exit: price }))
  const finalize = (exitDate, exitLabel) => {
    if (!curTrade) return
    curTrade.exitDate = exitDate; curTrade.exitLabel = exitLabel
    curTrade.tradeR = curTrade.unitsClosed.reduce((s, u) => s + u.r, 0)
    trades.push(curTrade); curTrade = null; position = []
  }

  let phase = 0, pbLow = NaN, activeStop = NaN, lastFill = NaN
  let coverArmed = false, ex1 = false, ex2 = false, recycleArmed = false, recycled = false, sold = false
  let pendingEntry = false, add1Done = false, addedThisPullback = false

  for (let i = 90; i < n; i++) {
    if (regimes[i] < 0) continue
    const bullLeg = regimes[i] <= 2
    if (phase === 0) { pendingEntry = false; addedThisPullback = false; add1Done = false; sold = false; recycleArmed = false; recycled = false; lastFill = NaN }
    if (phase !== 0 && !bullLeg) {
      if (curTrade) { curTrade.unitsClosed.push(...closeAll(position, close[i])); finalize(barDate(bars, i), 'REGIME') }
      phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
    }
    if (phase === 0) {
      if (bullLeg && e39[i] > e61[i] && low[i] <= eFast[i]) {
        phase = 1; pbLow = low[i]; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
      }
      continue
    }
    if (phase === 1) {
      pbLow = Math.min(pbLow, low[i])
      if (pendingEntry) {
        activeStop = e89[i] - a89[i] * p.entryMultDn
        curTrade = { openDate: barDate(bars, i), exitDate: '', exitLabel: '', fills: [], unitsClosed: [], tradeR: 0 }
        position.push({ price: open[i], stop: activeStop, date: barDate(bars, i) })
        curTrade.fills.push({ date: barDate(bars, i), price: open[i], stop: activeStop, kind: 'E1' })
        lastFill = open[i]; pendingEntry = false; phase = 2
        activeStop = e89[i] - a89[i] * p.tightDn
        position.push({ price: open[i], stop: activeStop, date: barDate(bars, i) })
        curTrade.fills.push({ date: barDate(bars, i), price: open[i], stop: activeStop, kind: 'ADD1' })
        lastFill = open[i]; add1Done = true
      } else {
        if (close[i] > high[i - 1]) pendingEntry = true
        continue
      }
    }
    if (low[i] <= activeStop) {
      curTrade!.unitsClosed.push(...closeAll(position, activeStop))
      finalize(barDate(bars, i), 'SL')
      phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
      continue
    }
    if (regimes[i] === 1) coverArmed = true
    if (high[i] >= e72[i] + a72[i] * p.recycleMult) recycleArmed = true
    if (coverArmed) {
      if (!ex1 && low[i] < low[i - 1]) {
        curTrade!.unitsClosed.push(...closeHalf(position, low[i])); ex1 = true; sold = true
      }
      if (!ex2 && e9[i] < e20[i] && e9[i - 1] >= e20[i - 1]) {
        curTrade!.unitsClosed.push(...closeAll(position, close[i])); ex2 = true; sold = true
      }
      if (ex1 && ex2) { finalize(barDate(bars, i), 'BRK+9/20'); phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false; continue }
    } else {
      if (recycleArmed && !recycled && !sold && e9[i] < e20[i] && e9[i - 1] >= e20[i - 1]) {
        curTrade!.unitsClosed.push(...closeHalf(position, close[i])); recycled = true; sold = true
      }
      if (e39[i] < e61[i]) {
        curTrade!.unitsClosed.push(...closeAll(position, close[i]))
        finalize(barDate(bars, i), recycled ? 'RC+39/61' : '39/61')
        phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
        continue
      }
    }
    if (!sold && add1Done) {
      if (low[i] <= eFast[i] && !addedThisPullback) {
        const newStop = e89[i] - a89[i] * p.tightDn
        const freed = newStop - activeStop, curRisk = lastFill - activeStop
        if (curRisk > 0 && freed >= p.addFreedMin * curRisk) {
          activeStop = newStop
          position.push({ price: eFast[i], stop: activeStop, date: barDate(bars, i) })
          curTrade!.fills.push({ date: barDate(bars, i), price: eFast[i], stop: activeStop, kind: 'ADD' })
          lastFill = eFast[i]; addedThisPullback = true
        }
      }
      if (low[i] > eFast[i]) addedThisPullback = false
    }
  }
  if (curTrade && position.length) {
    curTrade.unitsClosed.push(...closeAll(position, close[n - 1]))
    curTrade.exitDate = barDate(bars, n - 1); curTrade.exitLabel = 'OPEN@END'
    curTrade.openAtEnd = true; curTrade.tradeR = curTrade.unitsClosed.reduce((s, u) => s + u.r, 0)
    trades.push(curTrade)
  }

  const stats = computeStats(trades)
  return { trades, stats }
}

export function computeStats(trades: LEBTrade[]): LEBStats {
  const closed = trades.filter(t => !t.openAtEnd)
  const tradeRs = closed.map(t => t.tradeR)
  const wins = tradeRs.filter(r => r > 0), losses = tradeRs.filter(r => r <= 0)
  const sumW = wins.reduce((s, r) => s + r, 0), sumL = Math.abs(losses.reduce((s, r) => s + r, 0))
  const totR = tradeRs.reduce((s, r) => s + r, 0)
  let peak = 0, eq = 0, maxDD = 0
  for (const r of tradeRs) { eq += r; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq) }
  const labels: Record<string, number> = {}
  for (const t of closed) labels[t.exitLabel] = (labels[t.exitLabel] || 0) + 1
  return {
    bars: trades.length, closed: closed.length, open: trades.filter(t => t.openAtEnd).length,
    wins: wins.length, losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length * 100) : 0,
    avgR: closed.length ? totR / closed.length : 0, totR,
    avgWinR: wins.length ? sumW / wins.length : 0,
    avgLossR: losses.length ? -sumL / losses.length : 0,
    profitFactor: sumL ? sumW / sumL : Infinity, maxDD,
    labels,
  }
}
