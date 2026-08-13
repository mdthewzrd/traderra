/**
 * REQ-571 Phase 1 — SEED SecFormerName name backbone from the measurement corpus.
 *
 * Run:  DATABASE_URL=<local> npx tsx scripts/seed-sec-former-names.ts
 *
 * Reads /tmp/req571-universe/unified_formernames.json (691 CIKs, parsed formerNames)
 * and persists the NAME backbone into the SecFormerName table so the API can serve
 * precomputed data. Symbols are NOT seeded here — the resolver derives them from
 * bundled snapshots at query time (by design).
 *
 * - Idempotent: truncates SecFormerName first, upserts DilutionCompany stubs.
 * - Handles BOTH formerNames shapes SEC/measurement feeds emit:
 *     rich : { name, from, to }            (day-exact)
 *     sparse: [null, "Company Name"]        (name only, null dates)
 * - Batched createMany (≤100 rows).
 * - ADDITIVE: only touches SecFormerName + inserts stub DilutionCompany rows for
 *   CIKs not yet present (never modifies existing DilutionCompany columns).
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const SOURCE_FILE = '/tmp/req571-universe/unified_formernames.json';
const BATCH = 100;

type Rich = { name: string; from?: string; to?: string; startDate?: string; endDate?: string };
type Sparse = [null | string, string]; // [maybeDate|null, name]
type RawFormer = Rich | Sparse | (Record<string, unknown> & { name?: string });

function asDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeFormer(el: RawFormer): { name: string; startDate: Date | null; endDate: Date | null } | null {
  // Sparse form: [null, "Name"]
  if (Array.isArray(el)) {
    const name = typeof el[1] === 'string' ? el[1] : null;
    if (!name) return null;
    return { name, startDate: asDate(el[0]), endDate: null };
  }
  // Rich form: object with name + optional from/to | startDate/endDate
  if (el && typeof el === 'object' && typeof el.name === 'string') {
    const r = el as Rich;
    return { name: r.name, startDate: asDate(r.from ?? r.startDate), endDate: asDate(r.to ?? r.endDate) };
  }
  return null;
}

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    const corpus: Record<string, {
      name?: string;
      tickers?: string[];
      exchange?: string;
      entityType?: string;
      formerNames?: RawFormer[];
    }> = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));

    const ciks = Object.keys(corpus).map((k) => k.padStart(10, '0'));
    console.log(`[seed] ${ciks.length} CIKs in corpus`);

    // 1) Upsert DilutionCompany stubs (ADDITIVE — sets only the 3 required fields
    //    for missing CIKs; existing rows untouched via update:{} no-op guard).
    let stubbed = 0;
    for (const cik of ciks) {
      const v = corpus[cik] ?? {};
      const tickers = Array.isArray(v.tickers) ? v.tickers.map((t) => String(t)) : [];
      const name = v.name ?? tickers[0] ?? cik;
      const exists = await prisma.dilutionCompany.findUnique({ where: { cik }, select: { cik: true } });
      if (!exists) {
        await prisma.dilutionCompany.create({ data: { cik, tickers, name, entityType: v.entityType } });
        stubbed++;
      }
    }
    console.log(`[seed] upserted ${stubbed} DilutionCompany stubs (${ciks.length - stubbed} already present)`);

    // 2) Truncate + batch-insert SecFormerName rows (idempotent re-runs).
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "SecFormerName";');
    const rows: { cik: string; name: string; startDate: Date | null; endDate: Date | null; source: string }[] = [];
    let skipped = 0;
    for (const cik of ciks) {
      const fns = corpus[cik]?.formerNames;
      if (!Array.isArray(fns)) continue;
      for (const el of fns) {
        const n = normalizeFormer(el);
        if (!n) { skipped++; continue; }
        rows.push({ cik, name: n.name, startDate: n.startDate, endDate: n.endDate, source: 'sec-submissions' });
      }
    }
    console.log(`[seed] parsed ${rows.length} formerName rows (skipped ${skipped} unparseable)`);

    let written = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const r = await prisma.secFormerName.createMany({ data: slice });
      written += r.count;
    }
    console.log(`[seed] wrote ${written} SecFormerName rows in ${Math.ceil(rows.length / BATCH)} batches`);

    // Sanity: counts + a couple known cases.
    const total = await prisma.secFormerName.count();
    const distinctCiks = await prisma.$queryRawUnsafe<[{ n: number }]>(
      `SELECT count(DISTINCT cik)::int AS n FROM "SecFormerName";`);
    console.log(`[seed] SecFormerName total rows: ${total} across ${distinctCiks[0].n} distinct CIKs`);
    const cik18926 = await prisma.secFormerName.findMany({ where: { cik: '0000018926' }, orderBy: { startDate: 'asc' } });
    console.log(`[seed] 0000018926 (CTL/LUMN):`, cik18926.map((r) => `${r.name} [${r.startDate?.toISOString().slice(0,10)}..${r.endDate?.toISOString().slice(0,10) ?? 'open'}]`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error('[seed] FATAL:', e); process.exit(1); });
