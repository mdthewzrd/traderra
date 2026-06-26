/**
 * SEC financials → cash position + runway.
 *
 * The "cash & months" AskEdgar/Nexus show (cashRemainingMonths, cashBurn,
 * estimatedCash) is NOT magic — Nexus's own ae-buildout.md admits it's
 * "inputs from XBRL plus filings." We compute it directly from the free XBRL
 * facts in companyfacts.json:
 *   - us-gaap:CashAndCashEquivalentsAtCarryingValue  → cash on hand
 *   - us-gaap:NetCashProvidedByUsedInOperatingActivities → operating cash flow
 *
 * Derivation: take the latest operating-cash-flow entry, normalize its span to a
 * monthly rate using its start/end dates, runway = cash / |monthly burn|.
 *
 * Persisted to DilutionFact (reuses the generic model — no schema change):
 *   - fact='CashAndCashEquivalentsAtCarryingValue' (raw, USD)
 *   - fact='MonthlyCashFlow' (derived, signed USD/month; negative = burning)
 */
import { prisma } from '@/lib/prisma';
import { SecHttpError, secFetchJson } from '@/lib/sec/client';
import { getCikForTicker, padCik } from '@/lib/sec/cik-map';

const MS_PER_DAY = 86_400_000;
const MS_PER_MONTH = MS_PER_DAY * 30.44; // SEC periods are ~30.44-day months

export interface CashPosition {
  estimatedCash: number | null; // last REPORTED cash (USD)
  asOfDate: string | null; // period end of the cash fact
  monthlyCashFlow: number | null; // signed monthly burn (USD/mo; neg = burning)
  asOfOperatingEnd: string | null; // period end of the operating CF fact
  reportedRunwayMonths: number | null; // reportedCash / |burn| (always ≥0; the as-reported number)
  projectedCash: number | null; // forward-projected to TODAY (can be NEGATIVE) — matches AskEdgar/Nexus/DilutionTracker
  cashRemainingMonths: number | null; // projectedCash / |burn| (can be NEGATIVE) — the headline runway
  projectedAsOf: string | null; // today's date (ISO) the projection is valid for
}

// Forward-project last-reported cash to today assuming burn continues at the
// same monthly rate. This is the AskEdgar/Nexus/DilutionTracker methodology:
// a company that has burned past its last SEC report goes NEGATIVE ("already
// out of money on a no-new-financing basis"). The as-reported number stays
// available separately as reportedRunwayMonths.
function project(
  reportedCash: number | null,
  asOfDate: string | null,
  monthlyFlow: number | null,
): Pick<CashPosition, 'reportedRunwayMonths' | 'projectedCash' | 'cashRemainingMonths' | 'projectedAsOf'> {
  const reportedRunwayMonths =
    reportedCash !== null && monthlyFlow !== null && monthlyFlow < 0
      ? reportedCash / Math.abs(monthlyFlow)
      : null;
  // Missing inputs → can't project; fall back to reported only.
  if (reportedCash === null || asOfDate === null || monthlyFlow === null) {
    return { reportedRunwayMonths, projectedCash: null, cashRemainingMonths: reportedRunwayMonths, projectedAsOf: null };
  }
  // Cash-flow-positive (generating, not burning) → no runway concept.
  if (monthlyFlow >= 0) {
    return { reportedRunwayMonths, projectedCash: reportedCash, cashRemainingMonths: null, projectedAsOf: null };
  }
  const monthsElapsed = Math.max(0, (Date.now() - new Date(asOfDate).getTime()) / MS_PER_MONTH);
  const projectedCash = reportedCash + monthlyFlow * monthsElapsed; // flow neg → cash declines
  const cashRemainingMonths = projectedCash / Math.abs(monthlyFlow); // can be NEGATIVE
  return {
    reportedRunwayMonths,
    projectedCash,
    cashRemainingMonths,
    projectedAsOf: new Date().toISOString().slice(0, 10),
  };
}

interface FactEntry {
  start?: string;
  end: string;
  val: number;
  filed?: string;
  accn?: string;
  form?: string;
}

interface FinancialsPayload {
  facts: {
    // companyfacts has hundreds of us-gaap concepts; index signature keeps the
    // picker generic so it works across issuers (e.g. SDOT reports under `Cash`).
    'us-gaap'?: Record<string, { units?: { USD?: FactEntry[] } } | undefined>;
  };
}

// Cash concept priority — BROADEST first. AskEdgar/Nexus use TOTAL liquidity
// (cash + restricted cash + equivalents), not narrow unrestricted cash. The
// canonical ILLR case: CashAndCashEquivalentsAtCarryingValue=$2.19M vs the
// restricted-inclusive concept=$12.1M. Picking narrow understates runway ~5x.
// We pick the FIRST concept in this priority list that has data (broadest
// available), then take its latest entry — we do NOT mix concepts (mixing would
// double-count restricted + unrestricted at the same date).
const CASH_CANDIDATES = [
  'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents',
  'CashAndCashEquivalentsAtCarryingValue',
  'CashAndCashEquivalents',
  'Cash',
];
const OP_CANDIDATES = [
  'NetCashProvidedByUsedInOperatingActivities',
  'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
];

// Pick the FIRST concept (by priority) that has data, return ITS entries
// newest-first. Single-concept selection avoids mixing restricted +
// unrestricted cash from different concepts at the same date.
function pickConceptEntries(facts: FinancialsPayload['facts'], concepts: string[]): FactEntry[] {
  const usgaap = facts['us-gaap'];
  if (!usgaap) return [];
  for (const c of concepts) {
    const arr = usgaap[c]?.units?.USD;
    if (Array.isArray(arr) && arr.length) {
      return arr
        .filter((e) => typeof e.val === 'number' && isFinite(e.val))
        .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
    }
  }
  return [];
}

function pickCashEntries(facts: FinancialsPayload['facts']): FactEntry[] {
  return pickConceptEntries(facts, CASH_CANDIDATES);
}

function pickOperatingEntries(facts: FinancialsPayload['facts']): FactEntry[] {
  return pickConceptEntries(facts, OP_CANDIDATES);
}

// latest by end-date, that looks like a quarter or a year (80–370 day span)
function latestCleanOperating(entries: FactEntry[]): FactEntry | null {
  const spanDays = (e: FactEntry) =>
    e.start ? (new Date(e.end).getTime() - new Date(e.start).getTime()) / MS_PER_DAY : 90;
  const valid = entries
    .filter((e) => typeof e.val === 'number' && isFinite(e.val))
    .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
  return valid.find((e) => {
    const d = spanDays(e);
    return d >= 80 && d <= 370;
  }) ?? valid[0] ?? null;
}

function monthlyRate(e: FactEntry): number {
  const spanDays = e.start
    ? (new Date(e.end).getTime() - new Date(e.start).getTime()) / MS_PER_DAY
    : 90;
  const months = Math.max(1, spanDays / 30.44);
  return e.val / months; // signed
}

export interface SyncFinancialsResult {
  status: 'success' | 'error';
  cash: CashPosition;
  error?: string;
}

export async function syncFinancials(
  rawTicker: string,
  options?: { force?: boolean },
): Promise<SyncFinancialsResult> {
  const empty: CashPosition = {
    estimatedCash: null, asOfDate: null, monthlyCashFlow: null, asOfOperatingEnd: null,
    reportedRunwayMonths: null, projectedCash: null, cashRemainingMonths: null, projectedAsOf: null,
  };
  const entry = await getCikForTicker(rawTicker);
  if (!entry) return { status: 'error', cash: empty, error: `No CIK for ${rawTicker}` };
  const { cik, name, ticker, exchange } = entry;

  // Repeatability: serve from DB if financials were ever synced, unless forced.
  // Gated on the financials-specific fact (MonthlyCashFlow), NOT the shared
  // company.factsLastSynced — that field races with syncSharesOutstanding when
  // both run in parallel and caused financials to bail with no data.
  if (!options?.force) {
    const existing = await prisma.dilutionFact.findFirst({
      where: { cik, fact: 'MonthlyCashFlow' },
      orderBy: { period: 'desc' },
    });
    if (existing) {
      return { status: 'success', cash: await computeCashFromDb(cik) };
    }
  }

  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
  let payload: FinancialsPayload;
  try {
    payload = await secFetchJson<FinancialsPayload>(url);
  } catch (err) {
    if (err instanceof SecHttpError && err.status === 404) return { status: 'success', cash: empty };
    // fall back to whatever is in the DB
    const fromDb = await computeCashFromDb(cik);
    if (fromDb.estimatedCash !== null) return { status: 'success', cash: fromDb };
    return { status: 'error', cash: empty, error: err instanceof Error ? err.message : 'fetch failed' };
  }

  const facts = payload.facts;
  const cashEntries = pickCashEntries(facts);
  const opEntries = pickOperatingEntries(facts);
  const latestCash = cashEntries.length ? cashEntries[0] : null;
  const latestOp = latestCleanOperating(opEntries);

  // Ensure company row
  await prisma.dilutionCompany.upsert({
    where: { cik },
    create: { cik, name, tickers: [ticker], exchange, factsLastSynced: new Date() },
    update: { factsLastSynced: new Date() },
  });

  const writes: Promise<unknown>[] = [];
  if (latestCash) {
    writes.push(
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: 'CashAndCashEquivalentsAtCarryingValue', period: latestCash.end } },
        create: { cik, fact: 'CashAndCashEquivalentsAtCarryingValue', period: latestCash.end, unit: 'USD', val: latestCash.val, filed: latestCash.filed ? new Date(latestCash.filed) : null, accn: latestCash.accn ?? null },
        update: { val: latestCash.val, filed: latestCash.filed ? new Date(latestCash.filed) : null, accn: latestCash.accn ?? null },
      }),
    );
  }
  if (latestOp) {
    const mf = monthlyRate(latestOp);
    writes.push(
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: 'MonthlyCashFlow', period: latestOp.end } },
        create: { cik, fact: 'MonthlyCashFlow', period: latestOp.end, unit: 'USD', val: mf, filed: latestOp.filed ? new Date(latestOp.filed) : null, accn: latestOp.accn ?? null },
        update: { val: mf, filed: latestOp.filed ? new Date(latestOp.filed) : null, accn: latestOp.accn ?? null },
      }),
    );
  }
  if (writes.length) await Promise.all(writes);

  return { status: 'success', cash: computeFromValues(latestCash, latestOp) };
}

function computeFromValues(latestCash: FactEntry | null, latestOp: FactEntry | null): CashPosition {
  const estimatedCash = latestCash ? latestCash.val : null;
  const monthlyCashFlow = latestOp ? monthlyRate(latestOp) : null;
  const asOfDate = latestCash?.end ?? null;
  const asOfOperatingEnd = latestOp?.end ?? null;
  return {
    estimatedCash,
    asOfDate,
    monthlyCashFlow,
    asOfOperatingEnd,
    ...project(estimatedCash, asOfDate, monthlyCashFlow),
  };
}

export async function computeCashFromDb(cik: string): Promise<CashPosition> {
  // The persisted MonthlyCashFlow fact is ALREADY a monthly rate — do not pass it
  // back through monthlyRate() (which would re-normalize by a default 90-day
  // span and corrupt the burn). Use the stored values directly.
  const [cashRows, flowRows] = await Promise.all([
    prisma.dilutionFact.findMany({ where: { cik, fact: 'CashAndCashEquivalentsAtCarryingValue' }, orderBy: { period: 'desc' }, take: 1 }),
    prisma.dilutionFact.findMany({ where: { cik, fact: 'MonthlyCashFlow' }, orderBy: { period: 'desc' }, take: 1 }),
  ]);
  const estimatedCash = cashRows[0]?.val ?? null;
  const monthlyCashFlow = flowRows[0]?.val ?? null;
  const asOfDate = cashRows[0]?.period ?? null;
  const asOfOperatingEnd = flowRows[0]?.period ?? null;
  return {
    estimatedCash,
    asOfDate,
    monthlyCashFlow,
    asOfOperatingEnd,
    ...project(estimatedCash, asOfDate, monthlyCashFlow),
  };
}
