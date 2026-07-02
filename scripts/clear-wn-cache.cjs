// One-off: clear cached warrantNotes from rawPayload so the fixed parser re-runs.
// The sync idempotency gate (warrant-notes.ts:252) skips already-parsed 10-Ks;
// this invalidates that cache for a given CIK. Idempotent + safe.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const ticker = process.argv[2] || 'VWAV';
(async () => {
  const c = await p.dilutionCompany.findFirst({ where: { tickers: { has: ticker } }, select: { cik: true } });
  if (!c) { console.log('no company for', ticker); process.exit(1); }
  const filings = await p.dilutionFiling.findMany({
    where: { cik: c.cik, formType: { in: ['10-K', '10-Q'] } },
    select: { accessionNo: true, formType: true, rawPayload: true },
  });
  let cleared = 0;
  for (const f of filings) {
    const rp = f.rawPayload;
    if (rp && typeof rp === 'object' && 'warrantNotes' in rp) {
      const { warrantNotes, ...rest } = rp;
      await p.dilutionFiling.update({ where: { accessionNo: f.accessionNo }, data: { rawPayload: rest } });
      cleared++;
      console.log(`  cleared ${f.formType} ${f.accessionNo} (had ${warrantNotes?.warrants?.length || 0} warrants)`);
    }
  }
  console.log(`${ticker} (${c.cik}): cleared warrantNotes from ${cleared}/${filings.length} filings — next sync re-parses with fixed regex`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
