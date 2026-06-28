/**
 * AskEdgar full-classifier clone (Build 1d).
 *
 * For the 609 tickers we have BOTH AskEdgar labels (from CSV) AND synced SEC
 * data, compute OUR structured features and fit thresholds that reproduce
 * AskEdgar's low/medium/high for all 3 classifiers:
 *   cashBurnRisk  ← our computed runway (months)
 *   dilutionRisk  ← our YoY share growth (%)
 *   offeringRisk  ← our offering-filing count (last 2yr)
 *
 * Output: best thresholds + accuracy + confusion per classifier.
 * Run: npx tsx scripts/askedgar-clone.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const MS_DAY = 86_400_000;
const MS_MONTH = MS_DAY * 30.44;

// 1. load labels — PRESERVE all rows. A ticker can have multiple reports at
//    different dates; each row is a separate training example whose report_date
//    time-aligns the SEC features (featuresAsOf). The old Map<ticker> dedup
//    discarded ~1,029 rows and ignored the temporal dimension.
interface LabelRow { ticker: string; reportDate: string; cashBurnRisk?: string; dilutionRisk?: string; offeringRisk?: string }
const labeled: LabelRow[] = [];
for (const line of fs.readFileSync('/tmp/ae_extracted.jsonl', 'utf8').split('\n').filter(Boolean)) {
  const j = JSON.parse(line);
  if ((j.cashBurnRisk || j.dilutionRisk || j.offeringRisk) && j.report_date)
    labeled.push({
      ticker: j.ticker.toUpperCase(),
      reportDate: j.report_date,
      cashBurnRisk: j.cashBurnRisk, dilutionRisk: j.dilutionRisk, offeringRisk: j.offeringRisk,
    });
}

interface TickerData {
  shares: { period: string; val: number }[];
  cash: { period: string; val: number }[];
  ocf: { period: string; val: number }[];
  offerings: { filingDate: string }[];
}

/** Load all time-stamped facts/offerings for a cik ONCE; featuresAsOf filters
 *  in-memory by report date. Avoids N×4 queries across 1,758 label rows. */
async function loadTickerData(cik: string): Promise<TickerData> {
  const [shares, cash, ocf, offerings] = await Promise.all([
    prisma.dilutionFact.findMany({
      where: { cik, fact: { contains: 'Outstanding', mode: 'insensitive' } },
      orderBy: { period: 'desc' }, select: { period: true, val: true },
    }),
    prisma.dilutionFact.findMany({
      where: { cik, fact: { contains: 'Cash', mode: 'insensitive' } },
      orderBy: { period: 'desc' }, select: { period: true, val: true },
    }),
    prisma.dilutionFact.findMany({
      where: { cik, fact: { equals: 'MonthlyCashFlow' } },
      orderBy: { period: 'desc' }, select: { period: true, val: true },
    }),
    prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: ['424B1', '424B3', '424B4', '424B5', '424B7', '424B8'] } },
      select: { filingDate: true },
    }),
  ]);
  return { shares, cash, ocf, offerings };
}

/** Compute features AS-OF reportDate (facts/offerings filtered to ≤ reportDate).
 *  Fixes the temporal misalignment that capped single-feature fits at ~50%:
 *  AE labels are dated, so features must use the same point in time.
 *  (Build 2 lesson #1: filter by input-data recency FIRST.) */
function featuresAsOf(data: TickerData, reportDateIso: string) {
  const reportMs = new Date(reportDateIso).getTime();
  // YoY share growth: latest period ≤ reportDate, vs ~1yr prior.
  const sh = data.shares.filter((f) => new Date(f.period).getTime() <= reportMs);
  let yoyGrowth: number | null = null;
  if (sh.length >= 2) {
    const latest = sh[0];
    const yearAgo = sh.find((f) => {
      const d = new Date(latest.period).getTime() - new Date(f.period).getTime();
      return d > 300 * MS_DAY && d < 400 * MS_DAY;
    }) ?? sh[sh.length - 1];
    if (yearAgo && yearAgo.val > 0) yoyGrowth = ((latest.val - yearAgo.val) / yearAgo.val) * 100;
  }
  // Offering filings in the 2yr window ENDING at reportDate (not Date.now()).
  const startMs = reportMs - 730 * MS_DAY;
  const offeringCount = data.offerings.filter((o) => {
    const t = new Date(o.filingDate).getTime();
    return t >= startMs && t <= reportMs;
  }).length;
  // Runway: latest cash + latest OCF, both ≤ reportDate.
  const cash = data.cash.find((f) => new Date(f.period).getTime() <= reportMs);
  const ocf = data.ocf.find((f) => new Date(f.period).getTime() <= reportMs);
  let runway: number | null = null;
  if (cash && ocf && ocf.val < 0) runway = cash.val / Math.abs(ocf.val);
  return { yoyGrowth, offeringCount, runway };
}

function fit(data: { feat: number | null; label: string }[], inverse: boolean) {
  const d = data.filter((x) => x.feat !== null && x.label) as { feat: number; label: string }[];
  if (d.length < 20) return { n: d.length, acc: 0, detail: 'too few' };
  const cands = [...new Set(d.map((x) => x.feat))].sort((a, b) => a - b);
  if (cands.length < 3) return { n: d.length, acc: 0, detail: `only ${cands.length} distinct values (${cands.join(',')})` };
  let best: { acc: number; lo: number; hi: number } | null = null;
  for (let i = 1; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const lo = cands[i], hi = cands[j];
      let correct = 0;
      const cm: Record<string, Record<string, number>> = {};
      for (const { feat, label } of d) {
        const pred = inverse
          ? (feat <= lo ? 'high' : feat <= hi ? 'medium' : 'low')
          : (feat <= lo ? 'low' : feat <= hi ? 'medium' : 'high');
        if (pred === label) correct++;
        cm[label] = cm[label] || { low: 0, medium: 0, high: 0 };
        cm[label][pred]++;
      }
      const acc = correct / d.length;
      if (!best || acc > best.acc) best = { acc, lo, hi };
    }
  }
  return { n: d.length, acc: best!.acc, lo: best!.lo, hi: best!.hi };
}

async function main() {
  const tickers = await prisma.secTickerCik.findMany({ select: { ticker: true, cik: true } });
  const have = new Map(tickers.map((t) => [t.ticker.toUpperCase(), t.cik]));

  // Group label rows by ticker so each cik's facts load ONCE.
  const byTicker = new Map<string, LabelRow[]>();
  for (const l of labeled) {
    if (!have.has(l.ticker)) continue;
    if (!byTicker.has(l.ticker)) byTicker.set(l.ticker, []);
    byTicker.get(l.ticker)!.push(l);
  }
  console.log(`label rows: ${labeled.length} | matched tickers: ${byTicker.size}`);

  const cashRows: { feat: number | null; label: string }[] = [];
  const dilRows: { feat: number | null; label: string }[] = [];
  const offRows: { feat: number | null; label: string }[] = [];
  let withShares = 0, withCash = 0, withOfferings = 0;

  for (const [ticker, rows] of byTicker) {
    const cik = have.get(ticker)!;
    let data: TickerData;
    try { data = await loadTickerData(cik); } catch { continue; }
    for (const lbl of rows) {
      let f;
      try { f = featuresAsOf(data, lbl.reportDate); } catch { continue; }
      if (f.yoyGrowth !== null) { withShares++; if (lbl.dilutionRisk) dilRows.push({ feat: f.yoyGrowth, label: lbl.dilutionRisk }); }
      if (f.runway !== null) { withCash++; if (lbl.cashBurnRisk) cashRows.push({ feat: f.runway, label: lbl.cashBurnRisk }); }
      if (f.offeringCount !== null) { withOfferings++; if (lbl.offeringRisk) offRows.push({ feat: f.offeringCount, label: lbl.offeringRisk }); }
    }
  }
  console.log(`feature coverage: shares ${withShares} | cash/runway ${withCash} | offerings ${withOfferings}\n`);

  for (const [name, rows, inverse] of [
    ['cashBurnRisk ← runway', cashRows, true],
    ['dilutionRisk ← YoY share growth %', dilRows, false],
    ['offeringRisk ← offering-filing count (2yr)', offRows, false],
  ] as const) {
    const r = fit([...rows], inverse);
    if (typeof r.detail === 'string') { console.log(`===== ${name}: ${r.detail} (n=${r.n}) =====\n`); continue; }
    console.log(`===== ${name} (n=${r.n}) =====`);
    console.log(`  thresholds: ≤${r.lo!.toFixed(1)} / ≤${r.hi!.toFixed(1)} | accuracy ${(r.acc! * 100).toFixed(1)}%`);
    // confusion at best
    const lo = r.lo!, hi = r.hi!;
    const cm: Record<string, Record<string, number>> = { low: { low: 0, medium: 0, high: 0 }, medium: { low: 0, medium: 0, high: 0 }, high: { low: 0, medium: 0, high: 0 } };
    for (const { feat, label } of rows) {
      if (feat === null) continue;
      const pred = inverse ? (feat <= lo ? 'high' : feat <= hi ? 'medium' : 'low') : (feat <= lo ? 'low' : feat <= hi ? 'medium' : 'high');
      cm[label][pred]++;
    }
    console.log(`  true\\pred   low    med    high`);
    for (const tl of ['low', 'medium', 'high'])
      console.log(`  ${tl.padEnd(9)} ${String(cm[tl].low).padStart(5)} ${String(cm[tl].medium).padStart(6)} ${String(cm[tl].high).padStart(6)}`);
    console.log();
  }
  await prisma.$disconnect();
}
main();
