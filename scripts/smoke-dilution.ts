/**
 * Loop 1 smoke test — end-to-end validation of the SEC data layer.
 * Run: npx tsx --env-file=.env scripts/smoke-dilution.ts
 * Exercises: CIK map load+persist, filings sync, shares sync, DB round-trip.
 */
import { getCikForTicker } from '@/lib/sec/cik-map';
import { syncFilings, getRecentFilings } from '@/lib/sec/submissions';
import { syncSharesOutstanding } from '@/lib/sec/companyfacts';
import { prisma } from '@/lib/prisma';

async function main() {
  const ticker = process.argv[2] ?? 'AAPL';
  console.log(`\n=== Dilution data-layer smoke test: ${ticker} ===\n`);

  // 1. CIK resolution (triggers full map load + persist on first run)
  const t0 = Date.now();
  const entry = await getCikForTicker(ticker);
  console.log(`[1] CIK resolve: ${entry ? `${entry.ticker} → ${entry.cik} (${entry.name}, ${entry.exchange})` : 'NOT FOUND'} (${Date.now() - t0}ms)`);

  const cikMapCount = await prisma.secTickerCik.count();
  console.log(`    SecTickerCik rows persisted: ${cikMapCount}`);

  if (!entry) {
    console.log('No CIK — aborting.');
    return;
  }

  // 2. Filings sync
  const t1 = Date.now();
  const filingsRes = await syncFilings(ticker, { limit: 20 });
  console.log(`[2] syncFilings: status=${filingsRes.status}, count=${filingsRes.count} (${Date.now() - t1}ms)${filingsRes.error ? ' err=' + filingsRes.error : ''}`);

  // 3. Shares sync
  const t2 = Date.now();
  const factsRes = await syncSharesOutstanding(ticker, { limit: 5 });
  console.log(`[3] syncShares: status=${factsRes.status}, count=${factsRes.count} (${Date.now() - t2}ms)`);
  if (factsRes.snapshots.length) {
    console.log(`    latest: ${factsRes.snapshots[0].period} → ${factsRes.snapshots[0].outstanding.toLocaleString()} shares`);
  }

  // 4. DB round-trip — prove filings persisted + parse
  const recent = await getRecentFilings(entry.cik, 5);
  console.log(`[4] DB round-trip: ${recent.length} filings read back`);
  for (const f of recent) {
    console.log(`    ${f.filingDate.toISOString().slice(0, 10)}  ${f.formType.padEnd(8)} items=[${f.items.join(',')}]  ${f.primaryDesc ?? ''}`);
  }

  await prisma.$disconnect();
  console.log('\n✅ smoke test complete\n');
}

main().catch((err) => {
  console.error('❌ smoke test failed:', err);
  process.exit(1);
});
