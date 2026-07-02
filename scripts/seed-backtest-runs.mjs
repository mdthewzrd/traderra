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
]

const registry = []
for (const run of RUNS) {
  const raw = JSON.parse(readFileSync(run.file, 'utf8'))
  const srcTrades = raw.trades || []
  const trades = srcTrades.map(s => norm(run, s)).filter(t => t.entry && t.exit)
  // summary stats
  const closed = trades.filter(t => t.exitLabel !== 'OPEN@END' && t.exitLabel !== '—')
  const wins = closed.filter(t => t.r > 0)
  const totR = trades.reduce((a, t) => a + t.r, 0)
  const grossW = wins.reduce((a, t) => a + t.r, 0)
  const grossL = Math.abs(closed.filter(t => t.r < 0).reduce((a, t) => a + t.r, 0))
  const summary = {
    trades: trades.length, wins: wins.length, winRate: +(100 * wins.length / (closed.length || 1)).toFixed(1),
    totR: +totR.toFixed(2), profitFactor: grossL ? +(grossW / grossL).toFixed(3) : 0,
    longs: trades.filter(t => t.side === 'long').length, shorts: trades.filter(t => t.side === 'short').length,
  }
  const payload = { ...run, summary, trades }
  writeFileSync(`${OUT}/${run.id}.json`, JSON.stringify(payload, null, 2))
  registry.push({ id: run.id, name: run.name, engine: run.engine, meta: run.meta, summary, createdAt: new Date().toISOString() })
  console.log(`✓ ${run.id}: ${trades.length} trades, ${summary.winRate}% win, ${summary.totR}R`)
}
writeFileSync(`${OUT}/registry.json`, JSON.stringify(registry, null, 2))
console.log(`\nwrote ${registry.length} runs + registry to ${OUT}/`)
