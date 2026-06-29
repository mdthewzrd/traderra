/**
 * Dilution DB store — persistence + read helpers built on the pure classifier.
 * Keeps classify.ts side-effect-free and gives both API routes a single source
 * of truth for snapshot shape.
 */
import { prisma } from '@/lib/prisma';
import { classifyFiling, type DilutionTag } from '@/lib/dilution/classify';
import type { CashPosition } from '@/lib/sec/financials';
import { computeCashFromDb, project } from '@/lib/sec/financials';
import { computeOverhangFromDb } from '@/lib/sec/warrants';
import { OFFERING_FORMS } from '@/lib/sec/prospectus';
import { REGISTRATION_FORMS } from '@/lib/sec/registration';
import { DILUTIVE_TXN_CODES } from '@/lib/sec/form4';
import { computeCompliance, type ComplianceResult } from '@/lib/dilution/compliance';
import { getWarrantNotes, type ParsedWarrantNotes } from '@/lib/sec/warrant-notes';
import { getPrograms, type CompanyProgram, type ProgramType } from '@/lib/sec/filings8k';

/**
 * Classify recent filings for a company and persist tags. Idempotent — safe to
 * run after every sync. Only writes when tags actually change.
 */
export async function backfillTags(cik: string, limit = 100): Promise<number> {
  const filings = await prisma.dilutionFiling.findMany({
    where: { cik },
    orderBy: { filingDate: 'desc' },
    take: limit,
    select: { accessionNo: true, formType: true, items: true, primaryDesc: true, dilutionTags: true },
  });

  let changed = 0;
  for (const f of filings) {
    const tags = classifyFiling({
      formType: f.formType,
      items: f.items,
      primaryDesc: f.primaryDesc,
    });
    const current = [...f.dilutionTags].sort().join(',');
    const next = [...tags].sort().join(',');
    if (current !== next) {
      await prisma.dilutionFiling.update({
        where: { accessionNo: f.accessionNo },
        data: { dilutionTags: tags },
      });
      changed++;
    }
  }
  return changed;
}

// Polygon price feed (same key as chart-data routes). Scores warrant/convertible
// strikes against the current price → in-the-money status.
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r';
const POLY_BASE = 'https://api.polygon.io';

/** Latest price (last close) for a ticker. Returns null on any failure
 *  (delisted, illiquid, rate-limited) so the page degrades gracefully. */
async function fetchLatestPrice(ticker: string): Promise<{ price: number; asOf: string } | null> {
  try {
    const r = await fetch(
      `${POLY_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${POLY_KEY}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      status?: string;
      ticker?: { day?: { c?: number }; last?: { price?: number } };
    };
    if (j.status !== 'OK' || !j.ticker) return null;
    const price = j.ticker.last?.price ?? j.ticker.day?.c ?? null;
    if (price == null || price <= 0) return null;
    return { price, asOf: new Date().toISOString().slice(0, 10) };
  } catch {
    return null;
  }
}

export interface InTheMoneyInstrument {
  strike: number;
  itm: boolean; // price > strike → economically rational to exercise/convert
  intrinsicPct: number | null; // (price - strike) / strike * 100
}

export interface InTheMoney {
  price: number | null; // null if price fetch failed
  asOf: string | null;
  warrant: InTheMoneyInstrument | null; // null if no instrument or no strike
  convertible: InTheMoneyInstrument | null;
  imminentShares: number; // ITM warrant + convert shares — dilutable right now
  imminentPct: number | null; // imminentShares / sharesOut * 100
}

/** Compare warrant/convertible strikes to the live price → in-the-money status.
 *  "Imminent dilution" = shares whose holders can profitably exercise/convert
 *  RIGHT NOW. The difference between possible dilution (overhang) and dilution
 *  that is about to happen. */
async function computeInTheMoney(
  overhang:
    | { warrant: { shares: number; strike: number | null } | null; convertible: { shares: number; strike: number | null } | null }
    | null,
  ticker: string | undefined,
  sharesOutstanding: number | null,
): Promise<InTheMoney | null> {
  if (!overhang || (!overhang.warrant && !overhang.convertible)) return null;
  if (!ticker) return null;
  const px = await fetchLatestPrice(ticker);
  if (!px) {
    return { price: null, asOf: null, warrant: null, convertible: null, imminentShares: 0, imminentPct: null };
  }
  const score = (inst: { shares: number; strike: number | null } | null): InTheMoneyInstrument | null => {
    if (!inst || inst.strike == null || inst.strike <= 0) return null;
    return {
      strike: inst.strike,
      itm: px.price > inst.strike,
      intrinsicPct: ((px.price - inst.strike) / inst.strike) * 100,
    };
  };
  const warrant = score(overhang.warrant);
  const convertible = score(overhang.convertible);
  const imminentShares =
    (warrant?.itm ? overhang.warrant!.shares : 0) +
    (convertible?.itm ? overhang.convertible!.shares : 0);
  const imminentPct =
    sharesOutstanding && sharesOutstanding > 0 ? (imminentShares / sharesOutstanding) * 100 : null;
  return { price: px.price, asOf: px.asOf, warrant, convertible, imminentShares, imminentPct };
}

export interface DilutionSnapshot {
  company: {
    cik: string;
    name: string;
    tickers: string[];
    exchange: string | null;
    sicCode: string | null;
    filingsLastSynced: string | null;
    factsLastSynced: string | null;
  } | null;
  sharesLatest: { period: string; outstanding: number } | null;
  sharesHistory: { period: string; outstanding: number }[];
  cash: CashPosition;
  filings: {
    accessionNo: string;
    formType: string;
    filingDate: string;
    primaryDesc: string | null;
    items: string[];
    dilutionTags: DilutionTag[];
    url: string;
  }[];
  tagSummary: Record<string, number>;
  form4Txns: {
    reporter: string;
    isOfficer: boolean;
    txnCode: string;
    securities: number;
    price: number | null;
    afterShares: number | null;
    txnDate: string;
    dilutive: boolean;
  }[];
  offerings: {
    accessionNo: string;
    formType: string;
    filingDate: string;
    sharesOffered: number | null;
    pricePerShare: number | null;
    grossProceeds: number | null;
    offeringType: string;
    underwriter: string | null;
    warrantTranches: { shares: number | null; strike: number | null; expiry: string | null; exercisable: string | null; description: string }[];
  }[];
  registrations: {
    accessionNo: string;
    formType: string;
    filingDate: string;
    aggregateOffering: number | null;
    shelfType: string;
    salesChannel: string | null;
    agent: string | null;
    securitiesTypes: string[];
  }[];
  insiderDilutiveShares90d: number;
  overhang: {
    warrant: { shares: number; strike: number | null; period: string } | null;
    convertible: { shares: number; strike: number | null; period: string } | null;
    overhangPct: number | null;
    suspect: boolean;
  };
  inTheMoney: InTheMoney | null;
  compliance: ComplianceResult | null;
  // Shelf remaining (Loop 3): registered capacity − gross proceeds drawn so far.
  shelfRemaining: { registered: number; raised: number; remaining: number; remainingPct: number } | null;
  // Per-instrument warrant/convertible detail from the latest 10-K notes (Loop 4):
  // expiry, exercisable date, convertible principal + maturity. Partial recall;
  // null when nothing parseable. Raw clause text included for user verification.
  warrantNotes: ParsedWarrantNotes | null;
  // Dilution programs parsed from 8-K material-agreement bodies (Item 1.01):
  // ATM, equity-line/SEPA, convertible, promissory-note, warrant-offering.
  // Each row carries extracted terms (max $, pricing, cap, maturity) + raw text.
  programs: CompanyProgram[];
  // Type filter helper exposed for UI grouping.
  programTypes: ProgramType[];
  fromCache: boolean; // true = served from DB only (no SEC call this request)
}

/** Build the dilution snapshot entirely from the DB (no SEC call). */
export async function getSnapshot(cik: string): Promise<DilutionSnapshot> {
  const [company, factRows, filings, form4Rows, offeringFilings, registrationFilings, cash] = await Promise.all([
    prisma.dilutionCompany.findUnique({ where: { cik } }),
    prisma.dilutionFact.findMany({
      where: { cik, fact: 'EntityCommonStockSharesOutstanding' },
      orderBy: { period: 'desc' },
      take: 40,
    }),
    prisma.dilutionFiling.findMany({
      where: { cik },
      orderBy: { filingDate: 'desc' },
      take: 50,
    }),
    prisma.dilutionForm4Txn.findMany({
      where: { cik },
      orderBy: { txnDate: 'desc' },
      take: 50,
    }),
    prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: OFFERING_FORMS } },
      orderBy: { filingDate: 'desc' },
      take: 20,
      select: { accessionNo: true, formType: true, filingDate: true, primaryDesc: true, rawPayload: true, primaryDoc: true },
    }),
    prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: REGISTRATION_FORMS } },
      orderBy: { filingDate: 'desc' },
      take: 15,
      select: { accessionNo: true, formType: true, filingDate: true, primaryDesc: true, rawPayload: true },
    }),
    computeCashFromDb(cik),
  ]);

  const sharesHistory = factRows.map((r) => ({ period: r.period, outstanding: r.val }));
  const sharesLatestOutstanding = sharesHistory[0]?.outstanding ?? null;
  const overhang = await computeOverhangFromDb(cik, sharesLatestOutstanding);
  const inTheMoney = await computeInTheMoney(overhang, company?.tickers?.[0], sharesLatestOutstanding);
  const compliance = await computeCompliance(cik, company?.tickers?.[0], company?.exchange ?? null);
  // Shelf remaining: registration.ts + prospectus.ts already parse these to
  // rawPayload (aggregateOffering / grossProceeds). Sum to answer "how much can
  // they STILL dilute under the existing shelf."
  const shelfRemaining = (() => {
    const registered = registrationFilings
      .map((f) => ((f.rawPayload ?? {}) as { aggregateOffering?: number | null }).aggregateOffering ?? null)
      .filter((v): v is number => typeof v === 'number')
      .reduce((s, v) => s + v, 0);
    const raised = offeringFilings
      .map((f) => ((f.rawPayload ?? {}) as { grossProceeds?: number | null }).grossProceeds ?? null)
      .filter((v): v is number => typeof v === 'number')
      .reduce((s, v) => s + v, 0);
    if (registered <= 0) return null;
    const remaining = registered - raised;
    return { registered, raised, remaining, remainingPct: (remaining / registered) * 100 };
  })();
  const warrantNotes = await getWarrantNotes(cik);
  const programs = await getPrograms(cik);
  const programTypes = [...new Set(programs.map((p) => p.programType))];

  // Accurate 90-day dilutive-share sum from the FULL DB (not the display-capped
  // form4Rows) — heavy diluters file dozens of Form 4s inside 90 days.
  const dilutiveShares90d =
    (
      await prisma.dilutionForm4Txn.aggregate({
        where: {
          cik,
          txnDate: { gte: new Date(Date.now() - 90 * 86_400_000) },
          txnCode: { in: [...DILUTIVE_TXN_CODES] },
        },
        _sum: { securities: true },
      })
    )._sum.securities ?? 0;

  const tagSummary: Record<string, number> = {};
  for (const f of filings) {
    for (const t of f.dilutionTags) tagSummary[t] = (tagSummary[t] ?? 0) + 1;
  }

  return {
    company: company
      ? {
          cik: company.cik,
          name: company.name,
          tickers: company.tickers,
          exchange: company.exchange,
          sicCode: company.sicCode,
          filingsLastSynced: company.filingsLastSynced?.toISOString() ?? null,
          factsLastSynced: company.factsLastSynced?.toISOString() ?? null,
        }
      : null,
    sharesLatest: sharesHistory[0] ?? null,
    sharesHistory,
    cash,
    filings: filings.map((f) => ({
      accessionNo: f.accessionNo,
      formType: f.formType,
      filingDate: f.filingDate.toISOString().slice(0, 10),
      primaryDesc: f.primaryDesc,
      items: f.items,
      dilutionTags: f.dilutionTags as DilutionTag[],
      url: filingUrl(f.cik, f.accessionNo, f.primaryDoc),
    })),
    tagSummary,
    form4Txns: form4Rows.map((t) => ({
      reporter: t.reporter,
      isOfficer: t.isOfficer,
      txnCode: t.txnCode,
      securities: t.securities,
      price: t.price,
      afterShares: t.afterShares,
      txnDate: t.txnDate.toISOString().slice(0, 10),
      dilutive: DILUTIVE_TXN_CODES.has(t.txnCode),
    })),
    offerings: offeringFilings
      .filter((f) => {
        const p = (f.rawPayload ?? null) as { offeringParsed?: boolean } | null;
        return !!p?.offeringParsed;
      })
      .map((f) => {
        const p = (f.rawPayload ?? {}) as Record<string, unknown>;
        return {
          accessionNo: f.accessionNo,
          formType: f.formType,
          filingDate: f.filingDate.toISOString().slice(0, 10),
          sharesOffered: (p.sharesOffered as number | null) ?? null,
          pricePerShare: (p.pricePerShare as number | null) ?? null,
          grossProceeds: (p.grossProceeds as number | null) ?? null,
          offeringType: (p.offeringType as string) ?? 'unknown',
          underwriter: (p.underwriter as string | null) ?? null,
          warrantTranches: (p.warrantTranches as Array<{ shares: number | null; strike: number | null; expiry: string | null; exercisable: string | null; description: string }> | null) ?? [],
        };
      }),
    registrations: registrationFilings
      .filter((f) => {
        const p = (f.rawPayload ?? null) as { registrationParsed?: boolean } | null;
        return !!p?.registrationParsed;
      })
      .map((f) => {
        const p = (f.rawPayload ?? {}) as Record<string, unknown>;
        return {
          accessionNo: f.accessionNo,
          formType: f.formType,
          filingDate: f.filingDate.toISOString().slice(0, 10),
          aggregateOffering: (p.aggregateOffering as number | null) ?? null,
          shelfType: (p.shelfType as string) ?? 'unknown',
          salesChannel: (p.salesChannel as string | null) ?? null,
          agent: (p.agent as string | null) ?? null,
          securitiesTypes: (p.securitiesTypes as string[] | null) ?? [],
        };
      }),
    insiderDilutiveShares90d: dilutiveShares90d,
    overhang,
    inTheMoney,
    compliance,
    shelfRemaining,
    warrantNotes,
    programs,
    programTypes,
    fromCache: true,
  };
}

export interface ScanRow {
  cik: string;
  ticker: string;
  name: string;
  exchange: string | null;
  sicCode: string | null;
  cash: number | null;
  monthlyCashFlow: number | null; // neg = burning
  runwayMonths: number | null; // projected (can be NEGATIVE)
  overhangShares: number | null;
  overhangPct: number | null;
  overhangSuspect: boolean; // XBRL shares > 50× outstanding — corrupt, excluded from sort but still shown
  shelfRemaining: number | null; // $ capacity still loaded
  goingConcern: boolean;
  lastSynced: string | null;
}

/**
 * Batched screening rows for ALL synced companies. Uses `distinct` per-cik to
 * grab the latest fact of each kind in a single round-trip, then folds in
 * securities (overhang) + recent registrations/offerings (shelf) + 10-K
 * going-concern flag. Computes projected runway via the same project() used by
 * the per-ticker snapshot so numbers MATCH the detail page.
 *
 * O(tickers) JS reduction over O(1) batched Prisma calls — designed for a
 * table that can render hundreds of rows client-side. Does NOT compute the
 * full rating (needs per-ticker aggregate queries); sort by the raw signals
 * (runway, overhang, shelf) instead.
 */
export async function getScanRows(): Promise<ScanRow[]> {
  const since = new Date(Date.now() - 3 * 365 * 86_400_000); // 3y window for shelf sums
  const [companies, cashFacts, flowFacts, shareFacts, securities, regFilings, offFilings, tenKFacts] = await Promise.all([
    prisma.dilutionCompany.findMany({
      select: { cik: true, tickers: true, name: true, exchange: true, sicCode: true, filingsLastSynced: true },
    }),
    prisma.dilutionFact.findMany({ where: { fact: 'CashAndCashEquivalentsAtCarryingValue' }, distinct: ['cik'], orderBy: { period: 'desc' }, select: { cik: true, val: true, period: true } }),
    prisma.dilutionFact.findMany({ where: { fact: 'MonthlyCashFlow' }, distinct: ['cik'], orderBy: { period: 'desc' }, select: { cik: true, val: true, period: true } }),
    prisma.dilutionFact.findMany({ where: { fact: 'EntityCommonStockSharesOutstanding' }, distinct: ['cik'], orderBy: { period: 'desc' }, select: { cik: true, val: true } }),
    prisma.dilutionSecurity.findMany({ select: { cik: true, type: true, shares: true } }),
    prisma.dilutionFiling.findMany({ where: { formType: { in: REGISTRATION_FORMS }, filingDate: { gte: since } }, select: { cik: true, rawPayload: true } }),
    prisma.dilutionFiling.findMany({ where: { formType: { in: OFFERING_FORMS }, filingDate: { gte: since } }, select: { cik: true, rawPayload: true } }),
    prisma.dilutionFiling.findMany({ where: { formType: '10-K' }, distinct: ['cik'], orderBy: { filingDate: 'desc' }, select: { cik: true, rawPayload: true } }),
  ]);

  const cashByCik = new Map(cashFacts.map((r) => [r.cik, { val: r.val, period: r.period }]));
  const flowByCik = new Map(flowFacts.map((r) => [r.cik, { val: r.val, period: r.period }]));
  const sharesByCik = new Map(shareFacts.map((r) => [r.cik, r.val]));
  // overhang shares per cik (warrant + convertible + prefunded)
  const overhangByCik = new Map<string, number>();
  for (const s of securities) {
    if (typeof s.shares !== 'number') continue;
    overhangByCik.set(s.cik, (overhangByCik.get(s.cik) ?? 0) + s.shares);
  }
  // shelf remaining per cik
  const shelfByCik = new Map<string, number>();
  const shelfAdd = (cik: string, v: number) => shelfByCik.set(cik, (shelfByCik.get(cik) ?? 0) + v);
  for (const f of regFilings) {
    const v = ((f.rawPayload ?? {}) as { aggregateOffering?: number | null }).aggregateOffering;
    if (typeof v === 'number') shelfAdd(f.cik, v);
  }
  for (const f of offFilings) {
    const v = ((f.rawPayload ?? {}) as { grossProceeds?: number | null }).grossProceeds;
    if (typeof v === 'number') shelfAdd(f.cik, -v); // raised reduces remaining
  }
  // going concern per cik (from latest 10-K warrantNotes payload)
  const gcByCik = new Map<string, boolean>();
  for (const f of tenKFacts) {
    const wn = ((f.rawPayload ?? {}) as { warrantNotes?: { goingConcern?: { present?: boolean } } }).warrantNotes;
    if (wn?.goingConcern?.present) gcByCik.set(f.cik, true);
  }

  const rows: ScanRow[] = [];
  for (const c of companies) {
    // Skip filers with no current ticker — defunct/delisted, not tradeable, so
    // they're noise in a short-bias screen (would dominate 'lowest runway' with
    // stale/meaningless projections). ~5% of the synced universe.
    if (c.tickers.length === 0) continue;
    const cash = cashByCik.get(c.cik) ?? null;
    const flow = flowByCik.get(c.cik) ?? null;
    const proj = project(cash?.val ?? null, cash?.period ?? null, flow?.val ?? null, flow?.period ?? null);
    const sharesOut = sharesByCik.get(c.cik) ?? null;
    const ohShares = overhangByCik.get(c.cik) ?? null;
    const ohPct = ohShares != null && sharesOut && sharesOut > 0 ? (ohShares / sharesOut) * 100 : null;
    // 50× rule matches the detail-page C19 suspect guard: XBRL warrant/convert
    // shares that exceed outstanding by >50× are reporting corruption, not real
    // overhang. Kept for display (trader sees the raw number + ⚠) but nulled for
    // the sort so corrupt rows can't dominate a 'most overhang' ranking.
    const overhangSuspect = ohPct !== null && ohPct > 5000;
    const shelf = shelfByCik.get(c.cik) ?? null;
    rows.push({
      cik: c.cik,
      ticker: c.tickers[0] ?? c.cik,
      name: c.name,
      exchange: c.exchange,
      sicCode: c.sicCode,
      cash: cash?.val ?? null,
      monthlyCashFlow: flow?.val ?? null,
      runwayMonths: proj.cashRemainingMonths ?? proj.reportedRunwayMonths,
      overhangShares: ohShares,
      overhangPct: ohPct,
      overhangSuspect,
      shelfRemaining: shelf != null && shelf > 0 ? shelf : null,
      goingConcern: gcByCik.get(c.cik) ?? false,
      lastSynced: c.filingsLastSynced?.toISOString().slice(0, 10) ?? null,
    });
  }
  return rows;
}

// accessionNo in submissions.json uses dashes (0000320193-26-000013); the
// archive folder strips them. Standard SEC archives URL:
function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  const doc = primaryDoc ?? '';
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${doc}`;
}
