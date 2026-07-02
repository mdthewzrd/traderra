/**
 * Batch re-sync utility. Reuses the production sync endpoint (all 13 parsers)
 * so logic is never duplicated. Run after any cash/warrant/shelf logic change
 * to refresh stale DB rows universe-wide.
 *
 * Usage:
 *   node scripts/resync-universe.cjs 20      # validate on 20-ticker sample
 *   node scripts/resync-universe.cjs 0       # full universe
 *
 * Logs before/after per ticker so generalization is verifiable by raw numbers.
 */
const BASE = process.env.BASE || 'http://localhost:6565';
const SAMPLE = parseInt(process.argv[2] || '0', 10);
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
// Force synchronous stdout so progress flushes live when piped/redirected
// (otherwise long runs block-buffer and lose output on timeout).
if (process.stdout._handle && process.stdout._handle.setBlocking) process.stdout._handle.setBlocking(true);

const extract = (s) => {
  const c = (s && s.cash) || {};
  return {
    cash: c.estimatedCash ?? null,
    asOf: c.asOfDate ?? null,
    reliable: c.cashReliable ?? null,
    runway: c.cashRemainingMonths ?? null,
    burn: c.monthlyCashFlow ?? null,
    accel: c.acceleratingBurn ?? null,
    auth: s && s.authorizedShares ? s.authorizedShares.authorized : null,
    warrants: (s && s.warrants || []).length,
    programs: (s && s.programs || []).length,
    offerings: (s && s.offerings || []).length,
    draws: (s && s.draws || []).length,
  };
};
const M = (v) => (v != null ? '$' + (v / 1e6).toFixed(2) + 'M' : '—');

async function snap(ticker) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${BASE}/api/dilution/snapshot?ticker=${ticker}`, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) return null;
      return extract((await r.json()).snapshot);
    } catch { await sleep(1500 * (attempt + 1)); }
  }
  return null;
}
async function syncOne(ticker) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`${BASE}/api/dilution/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, force: true }),
        signal: AbortSignal.timeout(240000),
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => ({}));
      return j.snapshot ? extract(j.snapshot) : null;
    } catch (e) {
      // transient socket / rate-limit → backoff + retry
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const comps = await p.dilutionCompany.findMany({ select: { cik: true, tickers: true } });
  let tickers = comps.map((c) => c.tickers && c.tickers[0]).filter(Boolean);
  console.log(`Universe: ${tickers.length} tickers. SAMPLE=${SAMPLE || 'ALL'}`);
  if (SAMPLE > 0 && SAMPLE < tickers.length) {
    for (let i = tickers.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tickers[i], tickers[j]] = [tickers[j], tickers[i]]; }
    tickers = tickers.slice(0, SAMPLE);
  }
  let ok = 0, fail = 0, skipped = 0;
  const rows = [];
  const t0 = Date.now();
  for (let i = 0; i < tickers.length; i++) {
    const t = tickers[i];
    const before = await snap(t);
    // RESUME: skip tickers already synced with the new draws code (have draws).
    // Avoids redoing work after a crash and re-spending SEC budget.
    // Guard behind RESUME=1 so default runs (e.g. acceleration refresh) recompute cash.
    if (process.env.RESUME && before && Array.isArray(before.draws) && before.draws.length > 0) {
      skipped++;
      if ((i + 1) % 25 === 0) console.log(`  [${i + 1}/${tickers.length}] skipped(resumed)=${skipped} ok=${ok} fail=${fail} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      continue;
    }
    const after = await syncOne(t);
    if (after) ok++; else fail++;
    rows.push({ t, before, after });
    if ((i + 1) % 5 === 0 || i + 1 === tickers.length) {
      const el = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`  [${i + 1}/${tickers.length}] ok=${ok} fail=${fail} skipped=${skipped} ${el}s  last=${t}`);
    }
    // pace: each full sync makes 20-50 SEC calls; brief gap eases rate pressure
    await sleep(500);
  }
  console.log('\n=== BEFORE -> AFTER (raw) ===');
  let cashUp = 0, cashChg = 0, authNew = 0, wUp = 0, pUp = 0, offUp = 0, accelN = 0;
  for (const r of rows) {
    const b = r.before || {}, a = r.after || {};
    const cUp = (a.cash != null && b.cash != null && a.cash > b.cash);
    if (cUp) cashUp++;
    if (a.cash != null && b.cash != null && a.cash !== b.cash) cashChg++;
    if (!b.auth && a.auth) authNew++;
    if (a.warrants > (b.warrants || 0)) wUp++;
    if (a.programs > (b.programs || 0)) pUp++;
    if (a.offerings > (b.offerings || 0)) offUp++;
    if (a.accel) accelN++;
    const burn = (v) => v != null ? '$' + Math.round(Math.abs(v) / 1000) + 'k/mo' : '-';
    console.log(`  ${r.t.padEnd(6)} cash ${M(b.cash)}->${M(a.cash)} | burn ${burn(a.burn)} | rw ${a.runway != null ? a.runway.toFixed(1) + 'mo' : '-'}${a.accel ? ' ⚠ACCEL' : ''} | wrnt ${(b.warrants||0)}->${a.warrants} | prog ${(b.programs||0)}->${a.programs} | offer ${(b.offerings||0)}->${a.offerings}`);
  }
  console.log(`\nSUMMARY ${rows.length} synced: cash-increased=${cashUp} cash-changed=${cashChg} auth-newly-populated=${authNew} warrants-up=${wUp} programs-up=${pUp} offerings-up=${offUp} | ACCELERATING-BURN=${accelN} (${rows.length ? Math.round(100*accelN/rows.length) : 0}%) | sync ok=${ok} fail=${fail} skipped=${skipped} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
