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
import { getReverseSplits, type ReverseSplit } from '@/lib/sec/reverse-splits';
import { splitAdjustment } from '@/lib/dilution/split-adjust';
import { getDraws, type DrawEvent } from '@/lib/sec/draws';

/**
 * Classify recent filings for a company and persist tags. Idempotent — safe to
 * run after every sync. Only writes when tags actually change.
 */
export async function backfillTags(cik: string, limit = 100): Promise<number> {
  const filings = await prisma.dilutionFiling.findMany({
    where: { cik },
    orderBy: { filingDate: 'desc' },
    take: limit,
    select: { accessionNo: true, formType: true, items: true, primaryDesc: true, dilutionTags: true, rawPayload: true },
  });

  let changed = 0;
  for (const f of filings) {
    const tags = classifyFiling({
      formType: f.formType,
      items: f.items,
      primaryDesc: f.primaryDesc,
    });
    // Preserve scanner-promoted 'reverse-split'. classifyFiling is metadata-only
    // (tags reverse-split for 8-Ks), so proxy/10-K splits detected by the body
    // scanner (stored in rawPayload.reverseSplit) would otherwise be wiped on
    // every re-classify. The scanner is authoritative for this tag on those forms.
    if ((f.rawPayload as { reverseSplit?: unknown } | null)?.reverseSplit) {
      tags.push('reverse-split');
    }
    const current = [...f.dilutionTags].sort().join(',');
    const next = [...new Set(tags)].sort().join(',');
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
async function fetchLatestPrice(ticker: string): Promise<{ price: number; asOf: string; volume: number | null } | null> {
  try {
    const r = await fetch(
      `${POLY_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${POLY_KEY}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      status?: string;
      ticker?: {
        lastTrade?: { p?: number };
        lastQuote?: { P?: number };
        day?: { c?: number; v?: number };
        prevDay?: { c?: number };
      };
    };
    if (j.status !== 'OK' || !j.ticker) return null;
    // During market hours day.c is unset; fall back to last trade → last quote →
    // prev close so price (and warrant moneyness) works intraday, not just post-close.
    // Use || not ??: pre-market returns day.c=0 which is never a valid price.
    const price = j.ticker.day?.c || j.ticker.lastTrade?.p || j.ticker.lastQuote?.P || j.ticker.prevDay?.c || null;
    const volume = j.ticker.day?.v ?? null;
    if (price == null || price <= 0) return null;
    return { price, asOf: new Date().toISOString().slice(0, 10), volume: typeof volume === 'number' ? volume : null };
  } catch {
    return null;
  }
}

/** Market cap via Polygon ticker-details (separate endpoint). Returns null on
 *  any failure so a missing cap never blocks the price display. */
async function fetchMarketCap(ticker: string): Promise<number | null> {
  try {
    const r = await fetch(
      `${POLY_BASE}/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${POLY_KEY}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { results?: { market_cap?: number } };
    const mc = j.results?.market_cap;
    return typeof mc === 'number' && mc > 0 ? mc : null;
  } catch {
    return null;
  }
}

/** Combined market data: price + volume (snapshot) + marketCap (details),
 *  fetched in parallel. */
async function fetchMarketData(ticker: string): Promise<{ price: number; asOf: string; volume: number | null; marketCap: number | null } | null> {
  const [px, mc] = await Promise.all([fetchLatestPrice(ticker), fetchMarketCap(ticker)]);
  if (!px) return null;
  return { price: px.price, asOf: px.asOf, volume: px.volume, marketCap: mc };
}

/** 8-K item codes → readable catalyst label. High-signal for short-bias:
 *  dilution (3.02), debt (2.03), delisting (3.01), earnings (2.02), deals
 *  (1.01), control/charter changes (5.01/5.03), Reg FD (7.01), other (8.01).
 *  9.01 is boilerplate (exhibits) — excluded from the catalyst title. */
const EIGHT_K_ITEMS: Record<string, string> = {
  '1.01': 'Material Definitive Agreement',
  '1.02': 'Agreement Terminated',
  '1.03': 'Bankruptcy / Receivership',
  '2.01': 'Acquisition Completed',
  '2.02': 'Results of Operations (earnings)',
  '2.03': 'New Financial Obligation (debt)',
  '2.04': 'Triggering Event',
  '2.05': 'Exit / Disposal Costs',
  '2.06': 'Material Impairment',
  '3.01': 'Delisting / Listing-Standard Failure',
  '3.02': 'Unregistered Equity Sale',
  '3.03': 'Rights / Charter Modification',
  '4.01': 'Auditor Change',
  '4.02': 'Non-Reliance on Prior Financials',
  '5.01': 'Change in Control',
  '5.02': 'Officer / Director Change',
  '5.03': 'Charter / Bylaws Amendment',
  '5.07': 'Shareholder Vote Results',
  '7.01': 'Reg FD Disclosure',
  '8.01': 'Other Events',
};

export interface NewsItem {
  source: 'sec-8k' | 'news';
  date: string; // YYYY-MM-DD
  title: string;
  catalyst?: string; // dominant 8-K item label
  items?: string[]; // raw 8-K item codes
  url?: string;
}

/** Polygon press-release / news feed (beyond SEC filings). Top-tier key returns
 *  real headlines with publish timestamps. Returns [] on any failure so the
 *  page degrades to SEC-only. */
async function fetchTickerNews(ticker: string): Promise<NewsItem[]> {
  if (!ticker) return [];
  try {
    const url = `${POLY_BASE}/v2/reference/news?ticker=${encodeURIComponent(ticker)}&limit=10&apiKey=${POLY_KEY}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'traderra-research mikedurante13@gmail.com' } });
    if (!res.ok) return [];
    const j = (await res.json()) as { results?: Array<{ published_utc?: string; published?: string; title?: string; article_url?: string }> };
    return (j.results ?? []).map((a) => ({
      source: 'news' as const,
      date: (a.published_utc || a.published || '').slice(0, 10),
      title: a.title || 'Press release',
      url: a.article_url,
    }));
  } catch {
    return [];
  }
}

/** Merge 8-K material events (item-code catalysts) + Polygon press releases into
 *  one recency-sorted feed. 8-Ks get a human-readable catalyst title derived
 *  from their item codes; press releases come in verbatim. */
function buildNewsFeed(
  filings: Array<{ formType: string; filingDate: Date; items: string[] | null; primaryDesc: string | null }>,
  tickerNews: NewsItem[],
): NewsItem[] {
  const sec: NewsItem[] = filings
    .filter((f) => /^8-K/.test(f.formType))
    .map((f) => {
      const codes = (f.items ?? []).filter((c) => c !== '9.01');
      const labels = codes.map((c) => EIGHT_K_ITEMS[c]).filter(Boolean);
      return {
        source: 'sec-8k' as const,
        date: f.filingDate.toISOString().slice(0, 10),
        title: labels.length ? labels.join(' · ') : (f.primaryDesc || 'Material event'),
        catalyst: labels[0],
        items: codes,
      };
    });
  return [...sec, ...tickerNews]
    .filter((n) => n.date)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 15);
}

export interface InTheMoneyInstrument {
  strike: number;
  itm: boolean; // price > strike → economically rational to exercise/convert
  intrinsicPct: number | null; // (price - strike) / strike * 100
}

export interface InTheMoney {
  price: number | null; // null if price fetch failed
  asOf: string | null;
  volume: number | null; // day volume from Polygon snapshot
  marketCap: number | null; // from Polygon ticker-details
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
  // Always fetch market data when we have a ticker — price/marketCap/volume
  // surface in the header regardless of whether overhang/ITM scoring applies.
  if (!ticker) return null;
  const mkt = await fetchMarketData(ticker);
  if (!mkt) {
    return { price: null, asOf: null, volume: null, marketCap: null, warrant: null, convertible: null, imminentShares: 0, imminentPct: null };
  }
  // No overhang → no ITM scoring, but still return the market data.
  if (!overhang || (!overhang.warrant && !overhang.convertible)) {
    return { price: mkt.price, asOf: mkt.asOf, volume: mkt.volume, marketCap: mkt.marketCap, warrant: null, convertible: null, imminentShares: 0, imminentPct: null };
  }
  const px = mkt;
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
  return { price: px.price, asOf: px.asOf, volume: px.volume, marketCap: px.marketCap, warrant, convertible, imminentShares, imminentPct };
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
    // Non-null when warrant/convertible strike+shares were retroactively
    // adjusted for a stock split effective AFTER the reported period (Gap 4).
    splitNote: string | null;
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
  // Authorized share capital (XBRL) + headroom for future dilution. The core
  // 'how much can they print without a vote' number.
  authorizedShares: { authorized: number; outstanding: number; available: number; asOf: string } | null;
  // SEC public float (10-K cover non-affiliate value + optional derived shares).
  // Authoritative but sparse (~18% coverage) + annual — see computedFloat for
  // the high-coverage derived fallback.
  publicFloat: { value: number; shares: number | null; asOf: string } | null;
  // Computed float = shares outstanding − aggregate insider holdings (latest
  // afterShares per Form-4 reporter). Fills the ~82% of names with no SEC cover
  // float. Honest: transaction-derived, excludes non-filing institutions, only
  // covers insiders who have transacted. Marked so the UI never confuses it
  // with the authoritative SEC cover figure.
  computedFloat: { shares: number; insiderShares: number; outstanding: number } | null;
  // Reverse-split history (8-K Item 3.03 + proxy). High-value short-bias signal —
  // reverse splits precede/accompany toxic financing.
  reverseSplits: ReverseSplit[];
  // Catalyst news feed: 8-K item-code events (dilution/debt/earnings/delisting)
  // + Polygon press releases beyond SEC, merged + sorted recency-desc. Lets the
  // trader see the actual news driving movement, not just terse filing labels.
  news: NewsItem[];
  // Unified warrant table spanning three sources so the trader sees EVERY
  // outstanding tranche, not just the single aggregate XBRL overhang (which
  // can grab a $0.01 pre-funded unit and hide the real $9/$11.5 strikes).
  warrants: {
    source: 'XBRL' | '424B5' | '10-K notes';
    shares: number | null;
    strike: number | null;
    expiry: string | null;
    exercisable: string | null;
    description: string;
    filingDate: string;
    // Lifecycle status from clause text + dates: 'pre-funded' (already paid,
    // exercise near-certain — most dilutive), 'active' (outstanding &
    // exercisable now), 'pending' (exercisable date in future), 'expired'.
    status: string;
  }[];
  // Actual cash-raising events under dilution facilities (SEPA/equity-line
  // share sales, convertible/promissory note advances, ATM sales), parsed
  // from 10-Q/10-K bodies. Each = one draw with $ raised, shares, facility,
  // and the raw clause. Deduped across quarterly restatements.
  draws: DrawEvent[];
  fromCache: boolean; // true = served from DB only (no SEC call this request)
}

/** Build the dilution snapshot entirely from the DB (no SEC call). */
export async function getSnapshot(cik: string): Promise<DilutionSnapshot> {
  const [company, factRows, filings, form4Rows, offeringFilings, registrationFilings, cash, authorizedFactRow, publicFloatRow, publicFloatSharesRow, reverseSplits] = await Promise.all([
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
    prisma.dilutionFact.findFirst({ where: { cik, fact: 'AuthorizedShares' }, orderBy: { period: 'desc' } }),
    prisma.dilutionFact.findFirst({ where: { cik, fact: 'PublicFloat' }, orderBy: { period: 'desc' } }),
    prisma.dilutionFact.findFirst({ where: { cik, fact: 'PublicFloatShares' }, orderBy: { period: 'desc' } }),
    getReverseSplits(cik),
  ]);

  const sharesHistory = factRows.map((r) => ({ period: r.period, outstanding: r.val }));
  const sharesLatestOutstanding = sharesHistory[0]?.outstanding ?? null;
  // Authorized headroom: XBRL authorized − latest outstanding. Null when the
  // filer doesn't tag authorized shares (common for smaller filers).
  const authorizedFact = authorizedFactRow;
  const authorizedShares =
    authorizedFact && sharesLatestOutstanding && sharesLatestOutstanding > 0
      ? { authorized: authorizedFact.val, outstanding: sharesLatestOutstanding, available: authorizedFact.val - sharesLatestOutstanding, asOf: authorizedFact.period }
      : null;
  // Public float — SEC-derived (10-K cover 'non-affiliate float' via
  // dei:EntityPublicFloat). `value` is the SEC market-value figure (always
  // present when concept exists); `shares` is value ÷ cover-date close,
  // available only when Polygon had history for that date (micro-caps often
  // don't — value still stands, shares null). asOf = cover date (staleness is
  // visible, never hidden; it's annual).
  const publicFloat =
    publicFloatRow && publicFloatRow.val > 0
      ? {
          value: publicFloatRow.val,
          shares: publicFloatSharesRow ? publicFloatSharesRow.val : null,
          asOf: publicFloatRow.period,
        }
      : null;
  // Computed public float — outstanding minus aggregate insider holdings.
  // Latest afterShares per Form-4 reporter (a reporter's most-recent txn
  // reflects their current direct holding). Mirrors the Ownership-tab
  // aggregation but server-side so scans + snapshot share one figure.
  const insiderHoldings = (() => {
    const map = new Map<string, { shares: number; latest: string }>();
    for (const t of form4Rows) {
      if (t.afterShares == null || t.afterShares <= 0) continue;
      const d = t.txnDate.toISOString().slice(0, 10);
      const ex = map.get(t.reporter);
      if (!ex || Date.parse(d) > Date.parse(ex.latest)) map.set(t.reporter, { shares: t.afterShares, latest: d });
    }
    let total = 0;
    for (const v of map.values()) total += v.shares;
    return total;
  })();
  const computedFloat = sharesLatestOutstanding != null
    ? { shares: Math.max(0, sharesLatestOutstanding - insiderHoldings), insiderShares: insiderHoldings, outstanding: sharesLatestOutstanding }
    : null;
  const warrantNotes = await getWarrantNotes(cik);
  const rawOverhang = await computeOverhangFromDb(cik, sharesLatestOutstanding);
  // Fallback: when XBRL has no warrant aggregate (common for micro-caps),
  // build one from 424B5 prospectus warrant tranches so overhang % and
  // ITM scoring work for ALL issuers, not just those with clean XBRL.
  // This is the RKTO fix: 3 clean 424B5 tranches exist but overhang=null
  // because dilutionSecurity table is empty.
  const fallbackWarrant = (() => {
    if (rawOverhang.warrant) return null; // XBRL is authoritative when present
    const tranches: { shares: number; strike: number | null }[] = [];
    for (const f of offeringFilings) {
      const p = (f.rawPayload ?? null) as { warrantTranches?: Array<{ shares: number | null; strike: number | null }> } | null;
      if (!p?.warrantTranches) continue;
      for (const t of p.warrantTranches) {
        if (t.shares != null && t.shares > 0) tranches.push({ shares: t.shares, strike: t.strike });
      }
    }
    // Fall back to 10-K note warrants ONLY when no 424B5 tranches with shares
    // exist. Using both double-counts the same warrants (10-K notes restate
    // warrants issued in prior 424B5 offerings — RKTO 4.5M → 11M if summed).
    if (!tranches.length && warrantNotes?.warrants) {
      for (const w of warrantNotes.warrants) {
        if (w.shares != null && w.shares > 0) tranches.push({ shares: w.shares, strike: w.exercisePrice });
      }
    }
    if (!tranches.length) return null;
    const totalShares = tranches.reduce((s, t) => s + t.shares, 0);
    const strikes = tranches.map(t => t.strike).filter((s): s is number => s != null && s > 0).sort((a, b) => a - b);
    const medianStrike = strikes.length > 0 ? strikes[Math.floor(strikes.length / 2)] : null;
    return { shares: totalShares, strike: medianStrike, period: '' };
  })();
  const warrantSrc = rawOverhang.warrant ?? fallbackWarrant;
  // Split-adjust stale warrant/convertible data: when the latest reported
  // period predates a stock split, the raw strike/shares are pre-split. Apply
  // the cumulative ratio (shares × num/den, strike × den/num) so overhang % and
  // in-the-money scoring compare against the post-split price/outstanding.
  const wAdj = warrantSrc ? splitAdjustment(warrantSrc.period, reverseSplits) : null;
  const cAdj = rawOverhang.convertible ? splitAdjustment(rawOverhang.convertible.period, reverseSplits) : null;
  const warrant = warrantSrc && wAdj?.applied
    ? { ...warrantSrc, shares: warrantSrc.shares * wAdj.shareFactor, strike: warrantSrc.strike != null ? warrantSrc.strike * wAdj.priceFactor : null }
    : warrantSrc;
  const convertible = rawOverhang.convertible && cAdj?.applied
    ? { ...rawOverhang.convertible, shares: rawOverhang.convertible.shares * cAdj.shareFactor, strike: rawOverhang.convertible.strike != null ? rawOverhang.convertible.strike * cAdj.priceFactor : null }
    : rawOverhang.convertible;
  const _adjustedTotal = (warrant?.shares ?? 0) + (convertible?.shares ?? 0);
  const splitNote = [...new Set([wAdj?.note, cAdj?.note].filter(Boolean))].join(' · ') || null;
  const overhang = {
    warrant,
    convertible,
    overhangPct: sharesLatestOutstanding && sharesLatestOutstanding > 0
      ? (_adjustedTotal / sharesLatestOutstanding) * 100
      : rawOverhang.overhangPct,
    suspect: rawOverhang.suspect,
    splitNote,
  };
  const inTheMoney = await computeInTheMoney(overhang, company?.tickers?.[0], sharesLatestOutstanding);
  const compliance = await computeCompliance(cik, company?.tickers?.[0], company?.exchange ?? null);
  const tickerNews = await fetchTickerNews(company?.tickers?.[0] ?? '');
  const news = buildNewsFeed(filings, tickerNews);
  // Shelf remaining: registration.ts + prospectus.ts already parse these to
  // rawPayload (aggregateOffering / grossProceeds). Sum to answer "how much can
  // they STILL dilute under the existing shelf."
  const shelfRemaining = (() => {
    const regs = registrationFilings
      .map((f) => ({
        amount: ((f.rawPayload ?? {}) as { aggregateOffering?: number | null }).aggregateOffering ?? null,
        date: f.filingDate,
      }))
      .filter((r): r is { amount: number; date: Date } => typeof r.amount === 'number' && r.amount > 0);
    if (!regs.length) return null;
    // Headline shelf = LARGEST registration. Summing expired+replaced shelves
    // overstates capacity; the max is the binding constraint and matches
    // Nexus's single-shelf display ("Total Registered: $50M").
    const headline = regs.reduce((m, r) => (r.amount > m.amount ? r : m));
    const registered = headline.amount;
    // Raised = gross proceeds from offerings filed ON/AFTER the headline shelf.
    // We CANNOT reliably match an offering to a specific shelf without tracing
    // 333-XXXXXX registration numbers across the prospectus — so offerings
    // BEFORE this shelf drew on prior, now-replaced capacity and are excluded.
    // Honest proxy, not exact attribution.
    const raised = offeringFilings
      .filter((f) => f.filingDate >= headline.date)
      .map((f) => ((f.rawPayload ?? {}) as { grossProceeds?: number | null }).grossProceeds ?? null)
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .reduce((s, v) => s + v, 0);
    // Floor at 0: a shelf cannot be over-drawn. Excess offerings (raised >
    // registered) came from other sources (SEPA, ATM, PIPE) — surface "fully
    // utilized" rather than a nonsensical negative.
    const remaining = Math.max(0, registered - raised);
    return { registered, raised, remaining, remainingPct: (remaining / registered) * 100 };
  })();
  const programs = await getPrograms(cik);
  const draws = await getDraws(cik);
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

  // Unified warrant table — merge prospectus (424B5) tranches + 10-K note
  // rows + the XBRL aggregate overhang. Surfaces every tranche the parsers
  // found, so the $9/$11.5 strikes are visible alongside the $0.01 unit.
  // Warrant lifecycle status from clause text + dates. 'pre-funded' is the
  // key dilution signal: the holder already paid, exercise is near-certain.
  const warrantStatus = (description: string, expiry: string | null, exercisable: string | null, strike: number | null): string => {
    const t = (description || '').toLowerCase();
    if (/pre-?funded/.test(t) || strike === 0) return 'pre-funded';
    if (expiry) { const d = new Date(expiry); if (!isNaN(d.getTime()) && d.getTime() < Date.now()) return 'expired'; }
    if (exercisable) { const d = new Date(exercisable); if (!isNaN(d.getTime()) && d.getTime() > Date.now()) return 'pending'; }
    return 'active';
  };
  const warrants = (() => {
    const rows: {
      source: 'XBRL' | '424B5' | '10-K notes';
      shares: number | null; strike: number | null; expiry: string | null;
      exercisable: string | null; description: string; filingDate: string; status: string;
    }[] = [];
    for (const f of offeringFilings) {
      const p = (f.rawPayload ?? null) as {
        warrantTranches?: Array<{ shares: number | null; strike: number | null; expiry: string | null; exercisable: string | null; description: string }>
      } | null;
      if (!p?.warrantTranches) continue;
      for (const t of p.warrantTranches) {
        rows.push({
          source: '424B5', shares: t.shares, strike: t.strike, expiry: t.expiry,
          exercisable: t.exercisable, description: t.description ?? '',
          filingDate: f.filingDate.toISOString().slice(0, 10),
          status: warrantStatus(t.description ?? '', t.expiry, t.exercisable, t.strike),
        });
      }
    }
    if (warrantNotes?.warrants) {
      const wnDate = warrantNotes.parsedAt ? warrantNotes.parsedAt.slice(0, 10) : '';
      for (const w of warrantNotes.warrants) {
        rows.push({
          source: '10-K notes', shares: w.shares, strike: w.exercisePrice,
          expiry: w.expiry, exercisable: w.exercisableDate, description: w.description, filingDate: wnDate,
          status: warrantStatus(w.description, w.expiry, w.exercisableDate, w.exercisePrice),
        });
      }
    }
    if (overhang?.warrant) {
      rows.push({
        source: 'XBRL', shares: overhang.warrant.shares, strike: overhang.warrant.strike,
        expiry: null, exercisable: null,
        description: `Aggregate XBRL overhang (period ${overhang.warrant.period})${overhang.splitNote ? ` · split-adj (${overhang.splitNote})` : ''}`,
        filingDate: overhang.warrant.period,
        status: warrantStatus(`overhang ${overhang.warrant.period}`, null, null, overhang.warrant.strike),
      });
    }
    // Drop XBRL aggregate when per-tranche 10-K detail exists — the aggregate
    // overlaps the breakdown and double-counts the same warrants.
    if (rows.some(r => r.source === '10-K notes')) {
      return rows.filter(r => r.source !== 'XBRL');
    }
    return rows;
  })();

  // Post-report capital raises: add back offering proceeds dated AFTER the
  // cash report date. Without this, a company that just raised $20M looks
  // destitute because linear burn from the stale report date wipes it out.
  // Uses offering grossProceeds (the authoritative 'money raised' signal).
  // Excludes registrations (S-3/S-1) which register capacity, not sales.
  const cashAsOf = cash.asOfDate;
  let postReportRaises = 0;
  if (cashAsOf && cash.cashReliable) {
    for (const f of offeringFilings) {
      const p = (f.rawPayload ?? null) as { offeringParsed?: boolean; grossProceeds?: number | null; offeringType?: string } | null;
      if (!p?.offeringParsed) continue;
      const fdate = f.filingDate.toISOString().slice(0, 10);
      if (fdate <= cashAsOf) continue;
      if (/^S-[13]/.test(p.offeringType ?? '')) continue;
      if (p.grossProceeds && p.grossProceeds > 0) postReportRaises += p.grossProceeds;
    }
  }
  const adjCash = postReportRaises > 0 && cash.cashReliable
    ? {
        ...cash,
        projectedCash: (cash.projectedCash ?? cash.estimatedCash ?? 0) + postReportRaises,
        cashRemainingMonths: cash.monthlyCashFlow != null && cash.monthlyCashFlow < 0
          ? ((cash.projectedCash ?? cash.estimatedCash ?? 0) + postReportRaises) / Math.abs(cash.monthlyCashFlow)
          : cash.cashRemainingMonths,
        postReportRaises,
      }
    : { ...cash, postReportRaises: 0 };

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
    cash: adjCash,
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
    warrants,
    draws,
    programs,
    programTypes,
    authorizedShares,
    publicFloat,
    computedFloat,
    reverseSplits,
    news,
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
  const drawSince = new Date(Date.now() - 180 * 86_400_000); // 180d for active-draw sums
  const [companies, cashFacts, flowFacts, shareFacts, securities, regFilings, offFilings, tenKFacts, drawFilings] = await Promise.all([
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
    // Recent quarterlies carrying parsed draws (10-Q/10-K w/ drawsParsed).
    prisma.dilutionFiling.findMany({ where: { formType: { in: ['10-Q', '10-K'] }, filingDate: { gte: drawSince }, rawPayload: { path: ['drawsParsed'], equals: true } }, select: { cik: true, filingDate: true, rawPayload: true } }),
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
  // Active dilution draws per cik — dedup by (amount + facilityType) across the
  // 180d quarterlies (same draw restated in successive filings), mirroring
  // getDraws(). Counts distinct draws + sums $ raised in the window.
  const drawCountByCik = new Map<string, number>();
  const drawAmtByCik = new Map<string, number>();
  const drawSeen = new Map<string, Set<string>>();
  for (const f of drawFilings) {
    const ds = ((f.rawPayload ?? {}) as { draws?: { amount?: number | null; facilityType?: string }[] }).draws ?? [];
    if (!drawSeen.has(f.cik)) drawSeen.set(f.cik, new Set());
    const seen = drawSeen.get(f.cik)!;
    for (const d of ds) {
      const amt = typeof d.amount === 'number' ? d.amount : 0;
      const key = `${Math.round(amt)}|${d.facilityType ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      drawCountByCik.set(f.cik, (drawCountByCik.get(f.cik) ?? 0) + 1);
      drawAmtByCik.set(f.cik, (drawAmtByCik.get(f.cik) ?? 0) + amt);
    }
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
      drawCount: drawCountByCik.get(c.cik) ?? 0,
      recentDrawAmount: drawAmtByCik.get(c.cik) ?? 0,
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
