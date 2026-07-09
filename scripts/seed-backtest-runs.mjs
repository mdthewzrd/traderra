#!/usr/bin/env node
/**
 * seed-backtest-runs.mjs — normalize the preexisting backtest result files into
 * a registry + per-run JSON files under traderra/data/backtest-runs/, so the
 * /backtest page can list & load them like scan runs.
 *
 * Run once: node scripts/seed-backtest-runs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const SRC = '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/assets/backtest'
const OUT = '/home/mdwzrd/traderra/data/backtest-runs'
mkdirSync(OUT, { recursive: true })

// normalize any result's `trades` array to a common trade shape
function norm(tr, src) {
  return {
    id: `${src.side}-${src.entryT || src.openDate}`.replace(/\s|:/g, ''),
    side: src.side || tr.side,
    openDate: src.entryT || src.openDate,
    exitDate: src.exitT || src.exitDate || src.entryT,
    entry: +(src.entry ?? src.open ?? 0),
    stop: +(src.stop ?? 0),
    exit: +(src.exit ?? src.close ?? 0),
    exitLabel: src.exitLabel || src.reason || src.exitReason || '—',
    r: +(src.r ?? src.tradeR ?? 0),
    pnl: +(src.pnl ?? 0),
  }
}

const RUNS = [
  { id: 'mb-spy-2024-2026', file: `${SRC}/mikes-bands-cycle-result.json`, name: "Mike's Bands · SPY 15m", engine: 'mikes-bands',
    meta: { symbol: 'SPY', tf: '15', from: '2024-01-01', to: '2026-06-27' } },
  { id: 'spy-1631-920', file: `${SRC}/spy-1631-920-result.json`, name: '16/31 + 9/20 · SPY', engine: '16-31-920',
    meta: { symbol: 'SPY', tf: '15', from: '2024-01-01', to: '2026-06-27' } },
  { id: 'lingua-exec', file: `${SRC}/exec-backtest-result.json`, name: 'Lingua Exec · SPY 1H', engine: 'lingua-exec',
    meta: { symbol: 'SPY', tf: '60', from: '2024-03-27', to: '2024-06-27' } },
  { id: 'scalp-920-spy', file: `${SRC}/scalp-920-result.json`, name: '9/20 Scalp · SPY 15m', engine: 'scalp-920',
    meta: { symbol: 'SPY', tf: '15', from: '2024-01-01', to: '2026-06-27' } },
  { id: 'lingua-mtf-5m', file: `${SRC}/lingua-mtf-scalp-result-5m.json`, name: 'Lingua MTF · SPY 15m→5m', engine: 'lingua-mtf',
    meta: { symbol: 'SPY', tf: '5', from: '2024-01-01', to: '2026-06-27' } },
  { id: 'lingua-mtf-spy2022', file: `${SRC}/lingua-mtf-scalp-result-5m-spy2022.json`, name: 'Lingua MTF · SPY 2022 BEAR', engine: 'lingua-mtf',
    meta: { symbol: 'SPY', tf: '5', from: '2022-01-01', to: '2022-12-31' } },
  { id: 'lingua-mtf-qqq', file: `${SRC}/lingua-mtf-scalp-result-5m-qqq.json`, name: 'Lingua MTF · QQQ 15m→5m', engine: 'lingua-mtf',
    meta: { symbol: 'QQQ', tf: '5', from: '2024-01-01', to: '2026-06-27' } },
  { id: 'lingua-mtf-2m', file: `${SRC}/lingua-mtf-scalp-result-2m.json`, name: 'Lingua MTF · SPY 15m→2m', engine: 'lingua-mtf',
    meta: { symbol: 'SPY', tf: '2', from: '2024-01-01', to: '2026-06-27' } },
  { id: 'lingua-route-snipe', file: `${SRC}/lingua-route-snipe-result.json`, name: 'Lingua Route-Snipe · 15m→5m', engine: 'lingua-route',
    meta: { symbol: 'SPY', tf: '5', from: '2024-01-01', to: '2026-06-27' } },
]

const registry = []
for (const run of RUNS) {
  const raw = JSON.parse(readFileSync(run.file, 'utf8'))
  const srcTrades = raw.trades || []
  const trades = srcTrades.map(s => norm(run, s)).filter(t => t.entry && t.exit)
  // ── per-day aggregation (for calendar + daily stats subpage) ──
  // prefer the engine's byDay R totals when present; else derive from trades
  const byDay = raw.byDay || {}
  const dayStats = {}
  for (const t of trades) {
    const d = t.openDate?.slice(0, 10) || (t.day || '')
    if (!d) continue
    if (!dayStats[d]) dayStats[d] = { r: 0, trades: 0, wins: 0, losses: 0, pnl: 0 }
    dayStats[d].trades++
    dayStats[d].r += t.r
    dayStats[d].pnl += t.pnl || 0
    if (t.r > 0) dayStats[d].wins++; else if (t.r < 0) dayStats[d].losses++
  }
  // reconcile R: if engine byDay exists use its authoritative totals; keep our counts
  if (Object.keys(byDay).length) {
    for (const d of Object.keys(byDay)) {
      if (!dayStats[d]) dayStats[d] = { r: 0, trades: 0, wins: 0, losses: 0, pnl: 0 }
      dayStats[d].r = byDay[d]
    }
  }
  for (const d of Object.keys(dayStats)) dayStats[d].r = +(dayStats[d].r).toFixed(2)

  // ── summary stats (rich) ──
  const closed = trades.filter(t => t.exitLabel !== 'OPEN@END' && t.exitLabel !== '—')
  const wins = closed.filter(t => t.r > 0)
  const losses = closed.filter(t => t.r < 0)
  const totR = trades.reduce((a, t) => a + t.r, 0)
  const grossW = wins.reduce((a, t) => a + t.r, 0)
  const grossL = Math.abs(losses.reduce((a, t) => a + t.r, 0))
  // calendar-day metrics
  const days = Object.keys(dayStats).sort()
  const greenDays = days.filter(d => dayStats[d].r > 0).length
  const dayRs = days.map(d => dayStats[d].r)
  const bestDay = days.length ? days.reduce((b, d) => dayStats[d].r > dayStats[b].r ? d : b, days[0]) : null
  const worstDay = days.length ? days.reduce((b, d) => dayStats[d].r < dayStats[b].r ? d : b, days[0]) : null
  // max drawdown on cumulative daily R
  let peak = -Infinity, maxDD = 0, cum = 0
  for (const d of days) { cum += dayStats[d].r; if (cum > peak) peak = cum; maxDD = Math.max(maxDD, peak - cum) }
  const avgDayR = days.length ? totR / days.length : 0
  const summary = {
    trades: trades.length, wins: wins.length, winRate: +(100 * wins.length / (closed.length || 1)).toFixed(1),
    totR: +totR.toFixed(2), profitFactor: grossL ? +(grossW / grossL).toFixed(3) : 0,
    longs: trades.filter(t => t.side === 'long').length, shorts: trades.filter(t => t.side === 'short').length,
    avgR: closed.length ? +(totR / closed.length).toFixed(3) : 0,
    greenDays, greenPct: days.length ? +(100 * greenDays / days.length).toFixed(1) : 0,
    tradingDays: days.length, perDay: days.length ? +(trades.length / days.length).toFixed(2) : 0,
    maxDD: +maxDD.toFixed(1), avgDayR: +avgDayR.toFixed(2),
    bestDay: bestDay ? { date: bestDay, r: dayStats[bestDay].r } : null,
    worstDay: worstDay ? { date: worstDay, r: dayStats[worstDay].r } : null,
  }
  const payload = { ...run, summary, trades, byDay: dayStats }
  writeFileSync(`${OUT}/${run.id}.json`, JSON.stringify(payload, null, 2))
  registry.push({ id: run.id, name: run.name, engine: run.engine, meta: run.meta, summary, createdAt: new Date().toISOString() })
  console.log(`✓ ${run.id}: ${trades.length} trades, ${summary.winRate}% win, ${summary.totR}R`)
}
writeFileSync(`${OUT}/registry.json`, JSON.stringify(registry, null, 2))
console.log(`\nwrote ${registry.length} runs + registry to ${OUT}/`)
