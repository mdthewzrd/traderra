/**
 * Clone AskEdgar's `estimated_cash` adjustment.
 * Methodology: diff CITED cash (from AE report prose) vs OUR raw cash (XBRL)
 * for the same ticker+date → the adjustment AE applies.
 *
 * Steps:
 *  1. Load /tmp/ae_extracted.jsonl (cited_cash, cited_burn, cited_runway per report)
 *  2. For synced tickers, pull our raw cash + OCF burn from DilutionFact
 *  3. Compute our raw runway; diff vs cited
 *  4. Look for what explains the gap: post-period offerings (DilutionFiling
 *     between financial period-end and report date)
 *  5. Report the adjustment pattern
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

// cash + burn concepts as STORED in DilutionFact (see financials.ts).
// CashAndCashEquivalentsAtCarryingValue = raw cash; MonthlyCashFlow = derived monthly burn.
const CASH_FACTS = ['CashAndCashEquivalentsAtCarryingValue'];
const BURN_FACT = 'MonthlyCashFlow'; // monthly rate (negative = burning)

interface ExtractedRow {
  ticker: string;
  report_date: string;
  cashBurnRisk: string | null;
  cited_cash: number | null;
  cited_burn: number | null;
  cited_runway: number | null;
}

// resolve ticker → cik once, cache
const cikCache = new Map<string, string | null>();
async function cikFor(ticker: string): Promise<string | null> {
  if (cikCache.has(ticker)) return cikCache.get(ticker)!;
  const row = await prisma.secTickerCik.findUnique({ where: { ticker } });
  cikCache.set(ticker, row?.cik ?? null);
  return row?.cik ?? null;
}

async function ourRawCash(cik: string, asOf: string) {
  // latest cash fact with period <= asOf. period is "YYYY-MM-DD" string.
  const facts = await prisma.dilutionFact.findMany({
    where: { cik, fact: { in: CASH_FACTS }, period: { lte: asOf } },
    orderBy: { period: 'desc' },
  });
  // prefer the highest-priority concept among the latest few
  for (const c of CASH_FACTS) {
    const hit = facts.find((f) => f.fact === c);
    if (hit) return { val: Number(hit.val), period: hit.period, fact: hit.fact };
  }
  return null;
}

async function ourRawBurn(cik: string, asOf: string) {
  const facts = await prisma.dilutionFact.findMany({
    where: { cik, fact: BURN_FACT, period: { lte: asOf } },
    orderBy: { period: 'desc' },
  });
  const hit = facts[0];
  return hit ? { val: Number(hit.val), period: hit.period } : null;
}

async function postPeriodOfferings(cik: string, fromPeriod: string, reportDate: string) {
  // offerings filed between the financial period-end and the report date
  const filings = await prisma.dilutionFiling.findMany({
    where: {
      cik,
      filingDate: { gt: new Date(fromPeriod), lte: new Date(reportDate) },
      formType: { in: ['424B5', '424B3', 'S-3', 'S-3ASR', 'F-3', 'F-3ASR', '8-K'] },
    },
    select: { formType: true, filingDate: true, primaryDesc: true },
  });
  return filings;
}

async function main() {
  const rows: ExtractedRow[] = fs
    .readFileSync('/tmp/ae_extracted.jsonl', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  console.log(`loaded ${rows.length} extracted reports`);

  // only analyze rows where AE cited cash + runway (the cleanest signal)
  const withCited = rows.filter(
    (r) => r.cited_cash !== null && r.cited_runway !== null,
  );
  console.log(`with cited_cash + cited_runway: ${withCited.length}`);

  const diffs: Array<{
    ticker: string;
    reportDate: string;
    citedCash: number;
    citedRunway: number;
    citedBurn: number | null;
    ourCash: number | null;
    ourRunway: number | null;
    cashGap: number | null; // cited - our
    runwayGap: number | null; // cited - our
    cashFact: string | null;
    cashPeriod: string | null;
    postOfferings: number;
  }> = [];

  let synced = 0;
  for (const r of withCited) {
    const cik = await cikFor(r.ticker);
    if (!cik) continue;
    const reportDate = r.report_date;
    const cash = await ourRawCash(cik, reportDate);
    const burn = await ourRawBurn(cik, reportDate);
    if (!cash) continue;
    synced++;
    // ourRunway = cash / |monthly burn|  (= cash/quarterly_burn*3, since MonthlyCashFlow is monthly)
    const ourRunway = burn && burn.val !== 0 ? cash.val / Math.abs(burn.val) : null;
    const postOff = cash.period ? await postPeriodOfferings(cik, cash.period, reportDate) : [];
    diffs.push({
      ticker: r.ticker,
      reportDate: r.report_date,
      citedCash: r.cited_cash!,
      citedRunway: r.cited_runway!,
      citedBurn: r.cited_burn,
      ourCash: cash.val,
      ourRunway,
      cashGap: r.cited_cash! - cash.val,
      runwayGap: ourRunway !== null ? r.cited_runway! - ourRunway : null,
      cashFact: cash.fact,
      cashPeriod: cash.period,
      postOfferings: postOff.length,
    });
  }

  console.log(`\n===== DIFF ANALYSIS (synced with cited: ${synced}) =====`);

  // bucket: how often is cited > our (AE adds cash) vs cited < our (AE subtracts)?
  const adds = diffs.filter((d) => d.cashGap !== null && d.cashGap > 0);
  const subs = diffs.filter((d) => d.cashGap !== null && d.cashGap < 0);
  const exact = diffs.filter((d) => d.cashGap !== null && Math.abs(d.cashGap) < 1000);
  console.log(`  cited_cash > our_cash (AE ADJUSTS UP): ${adds.length}`);
  console.log(`  cited_cash < our_cash (AE ADJUSTS DOWN): ${subs.length}`);
  console.log(`  cited_cash ≈ our_cash (no adjustment): ${exact.length}`);

  // median cash gap
  const gaps = diffs.filter((d) => d.cashGap !== null).map((d) => d.cashGap!);
  if (gaps.length) {
    gaps.sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    console.log(`  median cash gap (cited - our): $${(med / 1e6).toFixed(2)}M`);
  }

  // correlation: post-period offerings vs upward adjustment
  const withPost = diffs.filter((d) => d.postOfferings > 0);
  const withPostUp = withPost.filter((d) => d.cashGap !== null && d.cashGap > 0);
  console.log(
    `\n===== POST-PERIOD OFFERING HYPOTHESIS =====`,
  );
  console.log(`  reports with post-period offering filings: ${withPost.length}`);
  console.log(`  of those, AE adjusted cash UP: ${withPostUp.length} (${(withPost.length ? (100 * withPostUp.length) / withPost.length : 0).toFixed(0)}%)`);
  const noPost = diffs.filter((d) => d.postOfferings === 0);
  const noPostUp = noPost.filter((d) => d.cashGap !== null && d.cashGap > 0);
  console.log(`  reports with NO post-period offering: ${noPost.length}`);
  console.log(`  of those, AE STILL adjusted cash UP: ${noPostUp.length} (${(noPost.length ? (100 * noPostUp.length) / noPost.length : 0).toFixed(0)}%)`);

  // sample rows — show the adjustment magnitudes
  console.log(`\n===== SAMPLE (largest upward adjustments) =====`);
  const top = [...diffs].filter((d) => d.cashGap !== null).sort((a, b) => b.cashGap! - a.cashGap!).slice(0, 12);
  for (const d of top) {
    console.log(
      `  ${d.ticker.padEnd(6)} ${d.reportDate} cited $${(d.citedCash / 1e6).toFixed(2)}M/${d.citedRunway.toFixed(0)}mo | our $${d.ourCash !== null ? (d.ourCash / 1e6).toFixed(2) : '?'}M/${d.ourRunway !== null ? d.ourRunway.toFixed(0) : '?'}mo | gap $${(d.cashGap! / 1e6).toFixed(2)}M | post-off ${d.postOfferings} | fact ${d.cashFact?.slice(-20)}`,
    );
  }
  console.log(`\n===== SAMPLE (largest DOWNWARD adjustments) =====`);
  const bot = [...diffs].filter((d) => d.cashGap !== null).sort((a, b) => a.cashGap! - b.cashGap!).slice(0, 8);
  for (const d of bot) {
    console.log(
      `  ${d.ticker.padEnd(6)} ${d.reportDate} cited $${(d.citedCash / 1e6).toFixed(2)}M/${d.citedRunway.toFixed(0)}mo | our $${d.ourCash !== null ? (d.ourCash / 1e6).toFixed(2) : '?'}M/${d.ourRunway !== null ? d.ourRunway.toFixed(0) : '?'}mo | gap $${(d.cashGap! / 1e6).toFixed(2)}M | post-off ${d.postOfferings}`,
    );
  }

  // dump full diff for deeper inspection
  fs.writeFileSync('/tmp/ae_adjustment_diff.jsonl', diffs.map((d) => JSON.stringify(d)).join('\n'));
  console.log(`\nfull diff → /tmp/ae_adjustment_diff.jsonl (${diffs.length} rows)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
