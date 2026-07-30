/**
 * ingest-gc-backtest.mjs — re-runnable ingest for the Johnny G&C dilution-gap
 * fade-short backtest (REQ-314) into the /backtest run system (REQ-315).
 *
 * Reads:   edge-dev/uploads/gc_entry_backtest_pnl.csv
 * Writes:  traderra/data/backtest-runs/gc-gap-entry.json
 * Upserts: traderra/data/backtest-runs/registry.json  (id = 'gc-gap-entry')
 *
 * Run schema mirrors data/backtest-runs/rs-pump-long-v3.json exactly.
 *
 * CRITICAL MAPPING (verified — do not re-derive):
 *   CSV cols: ticker,d0_date,status,path,devAtr,entryT,exitT,entry,risk,exit,rd,heldBars,exitReason,r,pnl
 *   - col 9 'risk' = STOP PRICE (short stop above entry), NOT a dollar amount.
 *     Verified: CELZ entry 3.7 / stop[risk] 3.77 / exit 3.3761 → r = (entry-exit)/(stop-entry) = 4.627 ✓
 *   - filter status === 'TRADED' (54 rows; drops NO_FAILED_POP).
 *   - side='short', openDate=exitDate=rsDate=d0_date (intraday, same session).
 *   - exitLabel=exitReason; id=`short-{ticker}-{d0_date no dashes}`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRADERRA = join(__dirname, '..');
const RUNS_DIR = join(TRADERRA, 'data', 'backtest-runs');
const CSV = '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads/gc_entry_backtest_pnl.csv';

const RUN_ID = 'gc-gap-entry';
const RUN_FILE = join(RUNS_DIR, `${RUN_ID}.json`);
const REGISTRY = join(RUNS_DIR, 'registry.json');

const RUN_NAME = 'G&C Gap Entry · Dilution Fade Short · Intraday';

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// --- CSV parse (simple: no embedded commas in these fields) ---
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const o = {};
    header.forEach((h, i) => (o[h] = cols[i] ?? ''));
    return o;
  });
}

const rows = parseCSV(readFileSync(CSV, 'utf8'));
const traded = rows.filter((r) => r.status === 'TRADED');

if (traded.length !== 54) {
  console.warn(`⚠ expected 54 TRADED rows, got ${traded.length} — proceeding anyway`);
}

// --- normalize trades (mirror rs-pump-long-v3.json trade shape) ---
const trades = traded.map((r) => {
  const ticker = r.ticker;
  const d0 = r.d0_date; // YYYY-MM-DD
  const dateCompact = d0.replace(/-/g, '');
  return {
    id: `short-${ticker}-${dateCompact}`,
    side: 'short',
    ticker,
    rsDate: d0, // gap day doubles as signal date (no R/S in this strategy)
    openDate: d0,
    exitDate: d0,
    entry: parseFloat(r.entry),
    stop: parseFloat(r.risk), // col 9 = STOP PRICE
    exit: parseFloat(r.exit),
    exitLabel: r.exitReason,
    r: round(parseFloat(r.r), 3),
    pnl: round(parseFloat(r.pnl), 2),
  };
});

// --- aggregate by day (by d0_date) → byDay object (shape mirrors rs-pump-long-v3.json: {r,trades,pnl}) ---
// byDay is consumed by /backtest/run/[id] for the calendar heatmap, daily equity
// curve, and monthly breakdown. Omitting it makes those sections render empty.
const byDayAgg = new Map(); // date → { r, trades, pnl }
for (const t of trades) {
  const d = byDayAgg.get(t.openDate) ?? { r: 0, trades: 0, pnl: 0 };
  d.r = round(d.r + t.r, 3);
  d.trades += 1;
  d.pnl = round(d.pnl + t.pnl, 2);
  byDayAgg.set(t.openDate, d);
}
const days = [...byDayAgg.entries()]
  .map(([date, d]) => ({ date, r: d.r }))
  .sort((a, b) => (a.date < b.date ? -1 : 1));

// --- summary (precisions mirror rs-pump-long-v3.json) ---
const tradeR = trades.map((t) => t.r);
const wins = tradeR.filter((x) => x > 0).length;
const totR = round(tradeR.reduce((a, b) => a + b, 0), 2);
const grossWin = round(tradeR.filter((x) => x > 0).reduce((a, b) => a + b, 0), 2);
const grossLoss = Math.abs(round(tradeR.filter((x) => x < 0).reduce((a, b) => a + b, 0), 2));
const profitFactor = round(grossWin / grossLoss, 3);
const tradingDays = days.length;
const greenDays = days.filter((d) => d.r > 0).length;

// maxDD: peak-to-trough on cumulative daily R
let peak = 0, cum = 0, maxDD = 0;
for (const d of days) {
  cum += d.r;
  if (cum > peak) peak = cum;
  const dd = peak - cum;
  if (dd > maxDD) maxDD = dd;
}

const bestDay = days.reduce((a, b) => (b.r > a.r ? b : a));
const worstDay = days.reduce((a, b) => (b.r < a.r ? b : a));

const summary = {
  trades: trades.length,
  wins,
  winRate: round((wins / trades.length) * 100, 1),
  totR,
  profitFactor,
  longs: 0,
  shorts: trades.length,
  avgR: round(totR / trades.length, 3),
  greenDays,
  greenPct: round((greenDays / tradingDays) * 100, 1),
  tradingDays,
  perDay: round(trades.length / tradingDays, 2),
  maxDD: round(maxDD, 1),
  avgDayR: round(totR / tradingDays, 2),
  bestDay: { date: bestDay.date, r: round(bestDay.r, 2) },
  worstDay: { date: worstDay.date, r: round(worstDay.r, 2) },
};

const meta = {
  symbol: 'Dilution Universe',
  tf: '5',
  from: days[0].date,
  to: days[days.length - 1].date,
  strategy: 'dilution gap-up-that-fades → 5m/1m 20-SMA breakdown short (Johnny Trades NYC §3a/§3b)',
  universe: 'rs-offering-master (98 dilution names); 4 tight criteria',
  windowDays: '1y',
  params: {
    gap_min_pct: 5,
    gap_min_atr: 0.5,
    ema8_ext_min_atr: 1.5,
    failed_gap_lookback: 20,
    failed_gap_min: 1,
    devThresh_atr: 0.5,
    sizeFactor5m: 0.5,
    minRisk: '$0.05 [ASSUMPTION]',
    riskPerTrade: 100,
  },
  note: 'EXPLORATORY (not playbook). All params are [ASSUMPTION] proxies — Johnny states none. R-magnitude inflated by tight 1m-path stops; conservative ex-tight-stops: avgR +1.39, PF 3.47. Gap-skip slippage NOT modeled. See edge-dev/docs/research/gc-scan-backtest-findings.md.',
};

// byDay object keyed by date (mirrors rs-pump-long-v3.json top-level 'byDay')
const byDay = {};
for (const [date, d] of byDayAgg.entries()) byDay[date] = { r: d.r, trades: d.trades, pnl: d.pnl };

const run = { id: RUN_ID, file: '', name: RUN_NAME, engine: RUN_ID, meta, summary, byDay, trades };

writeFileSync(RUN_FILE, JSON.stringify(run, null, 2) + '\n');

// --- registry upsert (slim shape: id/name/engine/meta{symbol,tf,from,to}/summary/createdAt) ---
const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const slimMeta = { symbol: meta.symbol, tf: meta.tf, from: meta.from, to: meta.to };
const idx = reg.findIndex((e) => e.id === RUN_ID);
const slimEntry = {
  id: RUN_ID,
  name: RUN_NAME,
  engine: RUN_ID,
  meta: slimMeta,
  summary,
  createdAt: idx >= 0 ? reg[idx].createdAt : new Date().toISOString(),
};
if (idx >= 0) reg[idx] = slimEntry;
else reg.push(slimEntry);
writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');

console.log(`✓ wrote ${RUN_FILE} (${trades.length} trades)`);
console.log(`✓ upserted '${RUN_ID}' in registry.json (${idx >= 0 ? 'updated' : 'added'})`);
console.log('SUMMARY:', JSON.stringify(summary, null, 2));
