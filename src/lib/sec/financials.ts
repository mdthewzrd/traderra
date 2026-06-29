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
  flowEnd: string | null = null,
): Pick<CashPosition, 'reportedRunwayMonths' | 'projectedCash' | 'cashRemainingMonths' | 'projectedAsOf'> {
  // Period-mismatch guard: runway is only meaningful when cash and burn
  // describe the same reporting era. If the cash fact and the operating-flow
  // fact are >1yr apart (UPC: 2022 cash vs a stale 2025 flow from old code),
  // the pairing is invalid — don't compute runway. Surfaces as '—' not '0'.
  if (asOfDate && flowEnd && monthlyFlow != null) {
    const gapDays = Math.abs(new Date(asOfDate).getTime() - new Date(flowEnd).getTime()) / MS_PER_DAY;
    if (gapDays > 450) {
      return { reportedRunwayMonths: null, projectedCash: null, cashRemainingMonths: null, projectedAsOf: null };
    }
  }
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

// Nasdaq quantitative listing standards need balance-sheet + income-statement
// facts: Stockholders Equity rule (≥$2.5M Capital / ≥$10M Global), net-income
// alternative (≥$750K, last FY or 2 of last 3), revenue alternative (≥$50M).
// Same companyfacts payload as cash — no extra SEC fetch.
export const SE_CANDIDATES = [
  'StockholdersEquity',
  'LiabilitiesAndStockholdersEquity',
];
export const NI_CANDIDATES = [
  'NetIncomeLoss',
  'ProfitLoss',
];
export const REVENUE_CANDIDATES = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet',
];

// Annual-duration entries (≈330–370 day span) for multi-year rules (2-of-3yr net
// income, revenue). pickConceptEntries already sorts newest-end first.
function annualEntries(entries: FactEntry[]): FactEntry[] {
  return entries
    .filter((e) => {
      if (!e.start) return false;
      const d = (new Date(e.end).getTime() - new Date(e.start).getTime()) / MS_PER_DAY;
      return d >= 300 && d <= 370;
    })
    .slice(0, 3);
}

// Select the candidate concept whose LATEST entry is newest. The priority list
// expresses a preference (broadest > narrow), but companies stop reporting
// concepts over time (e.g. IBRX stopped the restricted-inclusive concept in
// 2018). Picking by recency auto-falls-back to a narrower-but-current concept.
// On a tie (same latest end-date) the FIRST concept in priority order wins (via
// strict >), so the broadest preference is preserved when it's current.
// Foreign filers (20-F) often tag the same concept at two unit scales: a real
// value AND a ×1000 mis-scaled copy (native currency in thousands under a USD
// unit). Real entries cluster near the MEDIAN magnitude; a ×1000 entry sits
// >100× above it. Divide those down so the series is internally consistent.
// Handles same-date sibling corruption (UPC 2024: $29.5M + $29.5B) AND lone
// corruption (UPC 2025: only the ×1000 copy exists). No effect on clean series.
function normalizeScale(entries: FactEntry[]): FactEntry[] {
  if (entries.length < 2) return entries;
  const out = entries.map((e) => ({ ...e }));
  for (let pass = 0; pass < 3; pass++) {
    const vals = out.map((e) => Math.abs(e.val)).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    if (median <= 0) break;
    let changed = false;
    for (const e of out) {
      if (Math.abs(e.val) > median * 100) {
        e.val = e.val / 1000;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

function pickConceptEntries(facts: FinancialsPayload['facts'], concepts: string[]): FactEntry[] {
  if (!facts) return [];
  const usgaap = facts['us-gaap'];
  if (!usgaap) return [];
  let best: FactEntry[] = [];
  let bestLatestEnd = '';
  for (const c of concepts) {
    const arr = usgaap[c]?.units?.USD;
    if (!Array.isArray(arr) || !arr.length) continue;
    const sorted = normalizeScale(
      arr
        .filter((e) => typeof e.val === 'number' && isFinite(e.val))
        .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0)),
    );
    if (!sorted.length) continue;
    const latestEnd = sorted[0].end;
    if (latestEnd > bestLatestEnd) {
      bestLatestEnd = latestEnd;
      best = sorted;
    }
  }
  return best;
}

function pickCashEntries(facts: FinancialsPayload['facts']): FactEntry[] {
  if (!facts) return [];
  const usgaap = facts['us-gaap'];
  if (!usgaap) return [];
  // Gather each candidate concept's newest-first entries + latest end/val.
  const per: { concept: string; entries: FactEntry[]; latestEnd: string; latestVal: number }[] = [];
  for (const c of CASH_CANDIDATES) {
    const arr = usgaap[c]?.units?.USD;
    if (!Array.isArray(arr) || !arr.length) continue;
    const sorted = normalizeScale(
      arr
        .filter((e) => typeof e.val === 'number' && isFinite(e.val))
        .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0)),
    );
    if (!sorted.length) continue;
    per.push({ concept: c, entries: sorted, latestEnd: sorted[0].end, latestVal: sorted[0].val });
  }
  if (!per.length) return [];
  // Scale sanity guard (C14): a foreign filer may tag its native-currency value
  // (e.g. RMB in thousands) under a USD unit, producing absurd figures
  // (UPC: broadest $33.5B vs narrow CashAndCashEquivalentsAtCarryingValue
  // $14.2M). If a concept's latest value is >50× the narrow concept's, treat it
  // as mis-scaled and drop it. Restricted cash is never 50× unrestricted.
  const narrow = per.find((p) => p.concept === 'CashAndCashEquivalentsAtCarryingValue');
  const filtered = narrow && narrow.latestVal !== 0
    ? per.filter((p) => Math.abs(p.latestVal) <= Math.abs(narrow.latestVal) * 50)
    : per;
  const pool = filtered.length ? filtered : per;
  // Among survivors, pick newest latest-end; tie → priority order (broadest first).
  const order = new Map(CASH_CANDIDATES.map((c, i) => [c, i]));
  pool.sort((a, b) => {
    if (a.latestEnd !== b.latestEnd) return a.latestEnd < b.latestEnd ? 1 : -1;
    return (order.get(a.concept) ?? 99) - (order.get(b.concept) ?? 99);
  });
  return pool[0].entries;
}

function pickOperatingEntries(facts: FinancialsPayload['facts']): FactEntry[] {
  return pickConceptEntries(facts, OP_CANDIDATES);
}

// Trailing-twelve-month operating burn — matches AskEdgar/Nexus methodology.
// Build-up: TTM = most-recent-FY − prior-year matching stub + current stub.
// A single quarter's stub is noisy (DCOY Q1 ran 2.4× the TTM rate → we showed
// 7mo vs Nexus 15). TTM smooths that. Falls back to latest-FY/12, then to
// stub-normalized (old behavior) only when nothing better exists.
function ttmMonthlyBurn(entries: FactEntry[]): { monthly: number; end: string } | null {
  if (!entries.length) return null;
  const span = (e: FactEntry) =>
    e.start ? (new Date(e.end).getTime() - new Date(e.start).getTime()) / MS_PER_DAY : 0;
  const isAnnual = (e: FactEntry) => {
    const d = span(e);
    return d >= 300 && d <= 370;
  };
  const isStub = (e: FactEntry) => {
    const d = span(e);
    return d >= 60 && d < 300; // Q1(90) / Q2(180) / Q3(270) cumulative
  };
  const annuals = entries.filter(isAnnual);
  const stubs = entries.filter(isStub).sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));

  // Build-up only when a stub is at least as current as the latest annual —
  // i.e. a fresh quarter past the last 10-K/20-F. If the annual is newer (an
  // annual report was just filed), annual/12 below is the more current figure;
  // building from an older stub would regress the as-of date (UPC: newest stub
  // 2024-03 vs newest annual 2025-09 → annual must win).
  if (stubs.length && (!annuals.length || stubs[0].end >= annuals[0].end)) {
    const pivot = stubs[0];
    // FY covering the fiscal year just completed before the pivot stub.
    const fy = annuals.find(
      (a) =>
        new Date(a.end) <= new Date(pivot.end) &&
        new Date(pivot.end).getTime() - new Date(a.end).getTime() <= 400 * MS_PER_DAY,
    );
    // Prior-year matching stub: same stub length, end ≈ pivot.end minus 1yr.
    const py = stubs.find((s) => {
      if (s === pivot) return false;
      if (Math.abs(span(s) - span(pivot)) > 20) return false;
      const yearAgo = new Date(pivot.end).getTime() - 365 * MS_PER_DAY;
      return Math.abs(new Date(s.end).getTime() - yearAgo) <= 50 * MS_PER_DAY;
    });
    if (fy && py) {
      const ttm = fy.val - py.val + pivot.val;
      return { monthly: ttm / 12, end: pivot.end };
    }
  }
  // Fallback 1: latest annual / 12 (stable full-year).
  if (annuals.length) return { monthly: annuals[0].val / 12, end: annuals[0].end };
  // Fallback 2: latest stub normalized by its own span (old behavior).
  const newest = entries[0];
  if (newest && span(newest) > 0) return { monthly: monthlyRate(newest), end: newest.end };
  return null;
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
  const ttm = ttmMonthlyBurn(opEntries);
  const seLatest = (() => { const a = pickConceptEntries(facts, SE_CANDIDATES); return a.length ? a[0] : null; })();
  const niAnnuals = annualEntries(pickConceptEntries(facts, NI_CANDIDATES));
  const revAnnuals = annualEntries(pickConceptEntries(facts, REVENUE_CANDIDATES));

  // Ensure company row
  await prisma.dilutionCompany.upsert({
    where: { cik },
    create: { cik, name, tickers: [ticker], exchange, factsLastSynced: new Date() },
    update: { factsLastSynced: new Date() },
  });

  // On force, clear any previously-persisted cash/burn facts. Earlier (buggy)
  // selections may have written a mis-scaled or stale concept under these fact
  // names with a NEWER period than the corrected pick; computeCashFromDb reads
  // newest-period, so stale wrong rows would shadow the corrected value.
  if (options?.force) {
    await prisma.dilutionFact.deleteMany({
      where: { cik, fact: { in: ['CashAndCashEquivalentsAtCarryingValue', 'MonthlyCashFlow', 'StockholdersEquity', 'NetIncomeLoss', 'Revenues'] } },
    });
  }

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
  if (ttm) {
    writes.push(
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: 'MonthlyCashFlow', period: ttm.end } },
        create: { cik, fact: 'MonthlyCashFlow', period: ttm.end, unit: 'USD', val: ttm.monthly },
        update: { val: ttm.monthly },
      }),
    );
  }
  // Persist balance-sheet + income-statement facts (Nasdaq compliance inputs).
  const persistFact = (fact: string, e: FactEntry) => writes.push(
    prisma.dilutionFact.upsert({
      where: { cik_fact_period: { cik, fact, period: e.end } },
      create: { cik, fact, period: e.end, unit: 'USD', val: e.val, filed: e.filed ? new Date(e.filed) : null, accn: e.accn ?? null },
      update: { val: e.val, filed: e.filed ? new Date(e.filed) : null, accn: e.accn ?? null },
    }),
  );
  if (seLatest) persistFact('StockholdersEquity', seLatest);
  for (const e of niAnnuals) persistFact('NetIncomeLoss', e);
  for (const e of revAnnuals) persistFact('Revenues', e);
  if (writes.length) await Promise.all(writes);

  return { status: 'success', cash: computeFromValues(latestCash, ttm) };
}

function computeFromValues(latestCash: FactEntry | null, ttm: { monthly: number; end: string } | null): CashPosition {
  const estimatedCash = latestCash ? latestCash.val : null;
  const monthlyCashFlow = ttm ? ttm.monthly : null;
  const asOfDate = latestCash?.end ?? null;
  const asOfOperatingEnd = ttm?.end ?? null;
  return {
    estimatedCash,
    asOfDate,
    monthlyCashFlow,
    asOfOperatingEnd,
    ...project(estimatedCash, asOfDate, monthlyCashFlow, asOfOperatingEnd),
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
    ...project(estimatedCash, asOfDate, monthlyCashFlow, asOfOperatingEnd),
  };
}
