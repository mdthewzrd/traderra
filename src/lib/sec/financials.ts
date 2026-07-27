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
import { fxToUsd } from '@/lib/sec/fx';

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
  // C20 honesty guard: cash facts internally inconsistent with the burn
  // trajectory (flat across periods under nonzero burn, or near-zero
  // placeholders) are flagged. When false, the projection is suppressed — a
  // -3mo headline off a stale XBRL value is worse than no number.
  cashReliable: boolean;
  reliabilityNote: string | null;
  // Reporting currency of the source facts. 'USD' for domestic issuers; the
  // native ISO code (ILS/CAD/EUR…) for Foreign Private Issuers whose facts were
  // FX-converted to USD. UI flags when ≠ USD; runway is currency-neutral.
  currency: string;
  // C-acceleration guard: true when the most recent half-year+ stub burns >1.3x
  // the smoothed TTM rate. Headline monthlyCashFlow already switches to the
  // recent run-rate in that case; this flag lets the UI say "accelerating".
  acceleratingBurn: boolean;
  // Gross proceeds from offerings dated AFTER asOfDate, added back to the
  // projection. The UI shows this as 'includes $X raised since [date]' so the
  // trader understands why projected cash ≠ reportedCash − burn.
  postReportRaises?: number;
}

// Forward-project last-reported cash to today assuming burn continues at the
// same monthly rate. This is the AskEdgar/Nexus/DilutionTracker methodology:
// a company that has burned past its last SEC report goes NEGATIVE ("already
// out of money on a no-new-financing basis"). The as-reported number stays
// available separately as reportedRunwayMonths.
export function project(
  reportedCash: number | null,
  asOfDate: string | null,
  monthlyFlow: number | null,
  flowEnd: string | null = null,
  postReportRaises: number | null = null,
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
  // Add back capital raised SINCE the report date (ATM draws, SPA proceeds,
  // equity sales). Without this, a company that just raised $20M looks
  // destitute because the linear burn from the stale report date wipes it
  // out (RKTO: $4M reported − 3mo burn = $0.6M projected, but they raised
  // ~$20M since → real cash is ~$14M). This matches Nexus's methodology.
  const raises = postReportRaises ?? 0;
  const projectedCash = reportedCash + monthlyFlow * monthsElapsed + raises;
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
  unit?: string; // ISO currency of the source fact (USD, ILS, CAD…); USD unless FX-converted
}

interface FinancialsPayload {
  facts: {
    // companyfacts has hundreds of us-gaap concepts; index signature keeps the
    // picker generic so it works across issuers (e.g. SDOT reports under `Cash`).
    // companyfacts has hundreds of concepts across us-gaap (domestic, USD) and
    // ifrs-full (Foreign Private Issuers / 20-F, often a native currency).
    'us-gaap'?: Record<string, { units?: Record<string, FactEntry[]> } | undefined>;
    'ifrs-full'?: Record<string, { units?: Record<string, FactEntry[]> } | undefined>;
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
// IFRS concept equivalents for Foreign Private Issuers (20-F filers reporting
// under ifrs-full, often in a native currency). Maps each us-gaap candidate to
// its ifrs-full counterpart so pickConceptEntries/pickCashEntries can fall back
// to the IFRS namespace + FX-convert to USD.
// Each us-gaap candidate → its ifrs-full equivalent(s). Arrays handle taxonomy
// variants across filers (operating CF alone has 3 valid IFRS tag names).
// Grounded in actual 20-F companyfacts (SVRE CIK 1894693): the canonical IFRS
// operating-CF tag is CashFlowsFromUsedInOperatingActivities (note the "From").
const IFRS_EQUIV: Record<string, string[]> = {
  StockholdersEquity: ['Equity', 'EquityAttributableToOwnersOfParent'],
  LiabilitiesAndStockholdersEquity: ['Equity'],
  NetIncomeLoss: ['ProfitLoss', 'ComprehensiveIncome'],
  ProfitLoss: ['ProfitLoss', 'ComprehensiveIncome'],
  Revenues: ['Revenue', 'RevenueFromContractsWithCustomers'],
  RevenueFromContractWithCustomerExcludingAssessedTax: ['Revenue', 'RevenueFromContractsWithCustomers'],
  SalesRevenueNet: ['Revenue', 'RevenueFromContractsWithCustomers'],
  NetCashProvidedByUsedInOperatingActivities: ['CashFlowsFromUsedInOperatingActivities', 'CashFlowsUsedInOperatingActivities', 'CashFlowsFromOperatingActivities'],
  NetCashProvidedByUsedInOperatingActivitiesContinuingOperations: ['CashFlowsFromUsedInOperatingActivities', 'CashFlowsUsedInOperatingActivities', 'CashFlowsFromOperatingActivities'],
};
const IFRS_CASH = ['CashAndCashEquivalents', 'Cash'];

// Authorized share capital — the ceiling for future dilution before a
// shareholder vote is required. sharesAvailable = authorized − outstanding is
// the core 'how much can they print' number. CommonStockSharesAuthorized is the
// dominant us-gaap tag; some filers use the dei AuthorizedShares element.
export const AUTHORIZED_CANDIDATES = [
  'CommonStockSharesAuthorized',
  'AuthorizedShares',
  'OtherStockholdersEquityInformation', // rare fallback
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
  // ×1000 mis-scaling (foreign filers / 20-F) appears as TWO entries at the
  // SAME period end differing by ~1000× (e.g. UPC: $29.5M + $29.5B). Divide the
  // outlier down WITHIN each date group. We deliberately do NOT use a global
  // median: a transformed company (de-SPAC, reverse merger) legitimately spans
  // scales over time (VWAV: $885 shell cash → $14.2M post-deal), and a global
  // median mis-fires ÷1000 on the real latest value.
  const byEnd = new Map<string, FactEntry[]>();
  for (const e of out) {
    const g = byEnd.get(e.end) ?? [];
    g.push(e);
    byEnd.set(e.end, g);
  }
  for (const g of byEnd.values()) {
    if (g.length < 2) continue;
    const vals = g.map((e) => Math.abs(e.val)).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    if (median <= 0) continue;
    for (const e of g) {
      if (Math.abs(e.val) > median * 100) e.val = e.val / 1000;
    }
  }
  return out;
}

async function pickConceptEntries(facts: FinancialsPayload['facts'], concepts: string[]): Promise<FactEntry[]> {
  if (!facts) return [];
  const desc = (a: FactEntry, b: FactEntry) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0);
  // --- us-gaap (domestic issuers, USD) ---
  const usgaap = facts['us-gaap'];
  if (usgaap) {
    let best: FactEntry[] = [];
    let bestLatestEnd = '';
    for (const c of concepts) {
      const arr = usgaap[c]?.units?.USD;
      if (!Array.isArray(arr) || !arr.length) continue;
      const sorted = normalizeScale(arr.filter((e) => typeof e.val === 'number' && isFinite(e.val)).sort(desc));
      if (!sorted.length) continue;
      if (sorted[0].end > bestLatestEnd) { bestLatestEnd = sorted[0].end; best = sorted; }
    }
    if (best.length) return best;
  }
  // --- ifrs-full fallback (Foreign Private Issuers / 20-F) ---
  // IFRS tags differ; map each us-gaap candidate to its ifrs-full equivalent.
  // Non-USD units (ILS/CAD/EUR…) are FX-converted to USD so downstream numbers
  // (runway, burn, compliance) stay comparable. Runway is currency-neutral
  // regardless; conversion serves the USD headline + cross-company sort.
  const ifrs = facts['ifrs-full'];
  if (ifrs) {
    let best: FactEntry[] = [];
    let bestLatestEnd = '';
    for (const c of concepts) {
      const variants = IFRS_EQUIV[c];
      if (!variants?.length) continue;
      for (const ic of variants) {
        const unitsObj = ifrs[ic]?.units;
        if (!unitsObj) continue;
        const collected: FactEntry[] = [];
        for (const [unit, arr] of Object.entries(unitsObj)) {
          if (!Array.isArray(arr)) continue;
          for (const e of arr) {
            if (typeof e.val !== 'number' || !isFinite(e.val)) continue;
            if (unit === 'USD') collected.push({ ...e, unit: 'USD' });
            else {
              const usd = await fxToUsd(e.val, unit, e.end);
              if (usd == null) continue;
              collected.push({ ...e, val: usd, unit });
            }
          }
        }
        if (!collected.length) continue;
        // normalize per-variant (NOT merged) to avoid the same-date division
        // guard halving values when two variants report the same period.
        const sorted = normalizeScale(collected.sort(desc));
        if (sorted.length && sorted[0].end > bestLatestEnd) { bestLatestEnd = sorted[0].end; best = sorted; }
      }
    }
    if (best.length) return best;
  }
  return [];
}

async function pickCashEntries(facts: FinancialsPayload['facts']): Promise<{ entries: FactEntry[]; currency: string }> {
  if (!facts) return { entries: [], currency: 'USD' };
  const desc = (a: FactEntry, b: FactEntry) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0);
  // --- us-gaap path (domestic, USD) — existing C14 scale guard + priority ---
  const usgaap = facts['us-gaap'];
  if (usgaap) {
    const per: { concept: string; entries: FactEntry[]; latestEnd: string; latestVal: number }[] = [];
    for (const c of CASH_CANDIDATES) {
      const arr = usgaap[c]?.units?.USD;
      if (!Array.isArray(arr) || !arr.length) continue;
      const sorted = normalizeScale(arr.filter((e) => typeof e.val === 'number' && isFinite(e.val)).sort(desc));
      if (!sorted.length) continue;
      per.push({ concept: c, entries: sorted, latestEnd: sorted[0].end, latestVal: sorted[0].val });
    }
    if (per.length) {
      const narrow = per.find((p) => p.concept === 'CashAndCashEquivalentsAtCarryingValue');
      const filtered = narrow && narrow.latestVal !== 0
        ? per.filter((p) => Math.abs(p.latestVal) <= Math.abs(narrow.latestVal) * 1000)
        : per;
      const pool = filtered.length ? filtered : per;
      const order = new Map(CASH_CANDIDATES.map((c, i) => [c, i]));
      pool.sort((a, b) => (a.latestEnd !== b.latestEnd ? (a.latestEnd < b.latestEnd ? 1 : -1) : (order.get(a.concept) ?? 99) - (order.get(b.concept) ?? 99)));
      return { entries: pool[0].entries, currency: 'USD' };
    }
  }
  // --- ifrs-full path (FPI / 20-F) — FX-convert non-USD to USD ---
  const ifrs = facts['ifrs-full'];
  if (ifrs) {
    for (const c of IFRS_CASH) {
      const unitsObj = ifrs[c]?.units;
      if (!unitsObj) continue;
      const collected: FactEntry[] = [];
      let cur = 'USD';
      for (const [unit, arr] of Object.entries(unitsObj)) {
        if (!Array.isArray(arr)) continue;
        for (const e of arr) {
          if (typeof e.val !== 'number' || !isFinite(e.val)) continue;
          if (unit === 'USD') collected.push({ ...e, unit: 'USD' });
          else {
            const usd = await fxToUsd(e.val, unit, e.end);
            if (usd == null) continue;
            collected.push({ ...e, val: usd, unit });
            cur = unit;
          }
        }
      }
      if (!collected.length) continue;
      const sorted = normalizeScale(collected.sort(desc));
      if (sorted.length) return { entries: sorted, currency: cur };
    }
  }
  return { entries: [], currency: 'USD' };
}

async function pickOperatingEntries(facts: FinancialsPayload['facts']): Promise<FactEntry[]> {
  return pickConceptEntries(facts, OP_CANDIDATES);
}

// Trailing-twelve-month operating burn — matches AskEdgar/Nexus methodology.
// Build-up: TTM = most-recent-FY − prior-year matching stub + current stub.
// A single quarter's stub is noisy (DCOY Q1 ran 2.4× the TTM rate → we showed
// 7mo vs Nexus 15). TTM smooths that. Falls back to latest-FY/12, then to
// stub-normalized (old behavior) only when nothing better exists.
function ttmMonthlyBurn(entries: FactEntry[]): { monthly: number; end: string; accelerating?: boolean } | null {
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
      const ttmVal = fy.val - py.val + pivot.val;
      const ttmMonthly = ttmVal / 12;
      // Recent run-rate = the pivot stub normalized by its own span. We take the
      // WORSE-OF (recent vs TTM) as the headline whenever the stub is >=60d and
      // recent is meaningfully worse (>=1.1x the smoothed TTM rate). Deliberately
      // conservative for dilution DD: a short-bias trader would rather assume the
      // worse run-rate than miss an acceleration. The old 150d gate false-negatived
      // quarterly filers (SVRA: 89d Q1 stub burning 1.34x TTM, genuinely
      // accelerating, was NOT flagged — 0/16 in the generalization sample).
      // Lowering to 60d catches Q1/Q2/Q3 stubs. The 1.1x floor avoids flagging on
      // sub-10% quarterly rounding noise (was 1.3x + 150d). We accept that a
      // noisy quarter (DCOY: 2.4x) now flags conservatively — for dilution timing,
      // assuming the higher burn is the safer, actionable call.
      const recentMonthly = monthlyRate(pivot);
      const accelerating =
        recentMonthly < 0 && ttmMonthly < 0 &&
        Math.abs(recentMonthly) >= Math.abs(ttmMonthly) * 1.1 &&
        span(pivot) >= 60;
      return { monthly: accelerating ? recentMonthly : ttmMonthly, end: pivot.end, accelerating };
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
    cashReliable: true, reliabilityNote: null,
    currency: 'USD',
    acceleratingBurn: false,
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
  const cashPick = await pickCashEntries(facts);
  const cashEntries = cashPick.entries;
  const reportingCurrency = cashPick.currency;
  const opEntries = await pickOperatingEntries(facts);
  const latestCash = cashEntries[0] ?? null;
  const ttm = ttmMonthlyBurn(opEntries);
  const seLatest = (await pickConceptEntries(facts, SE_CANDIDATES))[0] ?? null;
  const niAnnuals = annualEntries(await pickConceptEntries(facts, NI_CANDIDATES));
  const revAnnuals = annualEntries(await pickConceptEntries(facts, REVENUE_CANDIDATES));
  // Authorized shares live under units.shares (not USD like the financials).
  const authLatest = (() => {
    if (!facts) return null;
    const usgaap = facts['us-gaap'];
    if (!usgaap) return null;
    for (const c of AUTHORIZED_CANDIDATES) {
      const arr = usgaap[c]?.units?.shares;
      if (!Array.isArray(arr) || !arr.length) continue;
      const sorted = arr.filter((e) => typeof e.val === 'number' && isFinite(e.val)).sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
      if (sorted.length) return sorted[0];
    }
    return null;
  })();

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
      where: { cik, fact: { in: ['CashAndCashEquivalentsAtCarryingValue', 'MonthlyCashFlow', 'StockholdersEquity', 'NetIncomeLoss', 'Revenues', 'AuthorizedShares', 'ReportingCurrency'] } },
    });
  }

  const writes: Promise<unknown>[] = [];
  // Persist the latest few periods of the chosen cash series so the snapshot
  // (computeCashFromDb) reads FRESH values on cache hits and the C20 reliability
  // guard has ≥2 periods to compare. (Previously only the single latest entry
  // was persisted, leaving a stale relic when scale logic changed.)
  for (const e of cashEntries.slice(0, 4)) {
    writes.push(
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: 'CashAndCashEquivalentsAtCarryingValue', period: e.end } },
        create: { cik, fact: 'CashAndCashEquivalentsAtCarryingValue', period: e.end, unit: 'USD', val: e.val, filed: e.filed ? new Date(e.filed) : null, accn: e.accn ?? null },
        update: { val: e.val, filed: e.filed ? new Date(e.filed) : null, accn: e.accn ?? null },
      }),
    );
  }
  // Persist reporting currency so the DB-only snapshot path (computeCashFromDb)
  // can flag FX-converted foreign issuers. unit holds the ISO code (e.g. 'ILS').
  if (latestCash) {
    writes.push(
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: 'ReportingCurrency', period: latestCash.end } },
        create: { cik, fact: 'ReportingCurrency', period: latestCash.end, unit: reportingCurrency, val: 0 },
        update: { unit: reportingCurrency },
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
    // Acceleration flag (0/1) so the DB-only snapshot path can surface the
    // "burn accelerating" badge without recomputing from raw operating CF.
    writes.push(
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: 'BurnAcceleratingFlag', period: ttm.end } },
        create: { cik, fact: 'BurnAcceleratingFlag', period: ttm.end, unit: 'flag', val: ttm.accelerating ? 1 : 0 },
        update: { val: ttm.accelerating ? 1 : 0 },
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
  if (authLatest) persistFact('AuthorizedShares', authLatest);
  for (const e of niAnnuals) persistFact('NetIncomeLoss', e);
  for (const e of revAnnuals) persistFact('Revenues', e);
  if (writes.length) await Promise.all(writes);

  return { status: 'success', cash: computeFromValues(latestCash, ttm, cashEntries, reportingCurrency) };
}

// C20 honesty guard — detect cash facts that can't be trusted for runway.
// Proven failure (VWAV): XBRL reports 15,723 flat across 12/31->3/31 while the
// company burns ~$965K/mo. A real company cannot hold identical cash two
// periods running under nonzero burn — the signature of a stale, placeholder,
// or mis-scaled XBRL fact. Flag it and suppress the fabricated projection;
// real cash under burn MUST move.
function assessCashReliability(
  latestTwo: Array<{ val: number; end: string }>,
  burn: number | null,
): { reliable: boolean; note: string | null } {
  if (!latestTwo.length) return { reliable: true, note: null };
  const latest = latestTwo[0];
  if (
    latestTwo.length >= 2 &&
    latestTwo[0].val === latestTwo[1].val &&
    burn !== null &&
    Math.abs(burn) > 1
  ) {
    return {
      reliable: false,
      note: 'Cash unchanged across consecutive reports while burning — XBRL value looks stale or mis-scaled.',
    };
  }
  if (Math.abs(latest.val) < 1000) {
    return { reliable: false, note: 'Cash under $1,000 — likely a placeholder XBRL value.' };
  }
  // Cash below one month of operating burn is COMMON for distressed microcaps
  // (the core use case of this terminal) and is NOT a reliable mis-scale signal
  // after normalizeScale runs upstream — e.g. CLRO: $756K cash vs $1.05M/mo burn
  // is a genuine 0.7-mo runway, the most actionable signal we have. Suppressing
  // here would blank the projection for exactly the names that need it most.
  // Show the projection (reliable: true) and surface a verify-note instead.
  if (burn !== null && Math.abs(burn) > 0 && Math.abs(latest.val) < Math.abs(burn)) {
    return { reliable: true, note: 'Cash below one month of operating burn — verify against the filing (genuinely depleted or mis-scaled).' };
  }
  return { reliable: true, note: null };
}

function computeFromValues(
  latestCash: { val: number; end: string } | null,
  ttm: { monthly: number; end: string; accelerating?: boolean } | null,
  cashEntries: Array<{ val: number; end: string }> = [],
  currency: string = 'USD',
): CashPosition {
  const estimatedCash = latestCash ? latestCash.val : null;
  const monthlyCashFlow = ttm ? ttm.monthly : null;
  const asOfDate = latestCash?.end ?? null;
  const asOfOperatingEnd = ttm?.end ?? null;
  const proj = project(estimatedCash, asOfDate, monthlyCashFlow, asOfOperatingEnd);
  const { reliable, note } = assessCashReliability(cashEntries.slice(0, 2), monthlyCashFlow);
  return {
    estimatedCash,
    asOfDate,
    monthlyCashFlow,
    asOfOperatingEnd,
    reportedRunwayMonths: proj.reportedRunwayMonths,
    // Suppress the fabricated projection when the underlying fact is unreliable
    // — keep raw estimatedCash so the trader still sees the reported number.
    projectedCash: reliable ? proj.projectedCash : null,
    cashRemainingMonths: reliable ? proj.cashRemainingMonths : null,
    projectedAsOf: reliable ? proj.projectedAsOf : null,
    cashReliable: reliable,
    reliabilityNote: note,
    currency,
    acceleratingBurn: ttm?.accelerating ?? false,
  };
}

export async function computeCashFromDb(cik: string): Promise<CashPosition> {
  // The persisted MonthlyCashFlow fact is ALREADY a monthly rate — do not pass it
  // back through monthlyRate() (which would re-normalize by a default 90-day
  // span and corrupt the burn). Use the stored values directly. take:2 on cash
  // so the C20 reliability guard can compare the two latest periods.
  const [cashRows, flowRows, curRow, accelRow] = await Promise.all([
    prisma.dilutionFact.findMany({ where: { cik, fact: 'CashAndCashEquivalentsAtCarryingValue' }, orderBy: { period: 'desc' }, take: 2 }),
    prisma.dilutionFact.findMany({ where: { cik, fact: 'MonthlyCashFlow' }, orderBy: { period: 'desc' }, take: 1 }),
    prisma.dilutionFact.findFirst({ where: { cik, fact: 'ReportingCurrency' }, orderBy: { period: 'desc' } }),
    prisma.dilutionFact.findFirst({ where: { cik, fact: 'BurnAcceleratingFlag' }, orderBy: { period: 'desc' } }),
  ]);
  const currency = curRow?.unit || 'USD';
  const cashEntries = cashRows
    .map((r) => ({ val: r.val, end: r.period }))
    .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
  const latestCash = cashEntries[0] ?? null;
  const ttm = flowRows[0] ? { monthly: flowRows[0].val, end: flowRows[0].period, accelerating: accelRow?.val === 1 } : null;
  return computeFromValues(latestCash, ttm, cashEntries, currency);
}
