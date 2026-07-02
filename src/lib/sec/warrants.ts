/**
 * SEC warrant + convertible overhang → DilutionSecurity.
 *
 * Source: companyfacts.json XBRL. Extracts the LATEST reported share counts +
 * strike prices for warrants and convertibles, persisting a per-cik-per-type
 * aggregate. This is the price-dependent offeringRisk engine's data source.
 *
 * Concepts (verified across CEI/WATT/SOUN/IBRX/MULN/FFIE/SDOT — strong coverage):
 *   WARRANT shares : ClassOfWarrantOrRightOutstanding            [shares]
 *   WARRANT strike : ClassOfWarrantOrRightExercisePriceOfWarrantsOrRights1 [USD/shares]
 *   CONVERT shares : PreferredStockConvertibleSharesIssuable     [shares]
 *   CONVERT strike : PreferredStockConvertibleConversionPrice    [USD/shares]
 *
 * Multiple entries at the same period = multiple instrument classes → SUM the
 * share counts, take the volume-weighted (by shares) strike. Latest period wins.
 *
 * In-the-money scoring (current price vs strike) is layered on later once a
 * price feed is wired; the overhang % alone beats the filing-count proxy.
 */
import { prisma } from '@/lib/prisma';
import { SecHttpError, secFetchJson } from '@/lib/sec/client';
import { getCikForTicker, padCik } from '@/lib/sec/cik-map';

interface XbrlEntry {
  end: string;
  val: number;
  accn?: string;
  form?: string;
}

interface CompanyFacts {
  facts: {
    'us-gaap'?: Record<string, { units: Record<string, XbrlEntry[]> }>;
  };
}

const WARRANT_SHARES = 'ClassOfWarrantOrRightOutstanding';
const WARRANT_STRIKE = 'ClassOfWarrantOrRightExercisePriceOfWarrantsOrRights1';
const CONVERT_SHARES = 'PreferredStockConvertibleSharesIssuable';
const CONVERT_STRIKE = 'PreferredStockConvertibleConversionPrice';
const PREFUNDED_SHARES = 'WarrantsAndRightsOutstanding'; // pre-funded variants sometimes here

/** Read all entries for a concept across any unit (shares | USD/shares). */
function entriesOf(gaap: CompanyFacts['facts']['us-gaap'], concept: string): XbrlEntry[] {
  const units = gaap?.[concept]?.units;
  if (!units) return [];
  // flatten all units for this concept (shares, USD/shares, etc.)
  return Object.values(units).flat().filter(
    (e) => typeof e.val === 'number' && isFinite(e.val) && e.val !== 0,
  );
}

/** Latest period aggregate: sum shares across entries at the newest end-date.
 *  Returns { shares, strike(median of plausible), period, accn } or null.
 *
 *  Strike accuracy (C23): the warrant-strike concept carries MULTIPLE classes at
 *  the same period (different exercise prices), AND filers occasionally mistag
 *  an aggregate value as a per-share USD/shares figure (e.g. ATOS reported
 *  $1,189,167/share — impossible). So:
 *    1. filter to a plausible per-share range ($0.0001–$10,000)
 *    2. take the MEDIAN of the plausible classes (robust representative — a
 *       single weighted strike can't be computed without per-class share
 *       linkage, which the dimensional frames don't expose reliably)
 *  Shares remain a straight sum (total warrant shares, all classes). */
function latestAggregate(shareEntries: XbrlEntry[], strikeEntries: XbrlEntry[]) {
  if (!shareEntries.length) return null;
  // newest period with a share count
  const latestPeriod = shareEntries
    .map((e) => e.end)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))[0];
  const sharesAtLatest = shareEntries.filter((e) => e.end === latestPeriod);
  const shares = sharesAtLatest.reduce((s, e) => s + Math.abs(e.val), 0);
  const accn = sharesAtLatest[0]?.accn ?? null;
  // strike: plausible per-share filter, then median across classes.
  const PLAUS_MIN = 0.0001;
  const PLAUS_MAX = 10_000;
  const plausible = (v: number) => v >= PLAUS_MIN && v <= PLAUS_MAX;
  const atPeriod = strikeEntries.filter((e) => e.end === latestPeriod && plausible(Math.abs(e.val)));
  const pool = atPeriod.length
    ? atPeriod
    : strikeEntries
        .filter((e) => plausible(Math.abs(e.val)))
        .sort((a, b) => (a.end < b.end ? 1 : -1));
  let strike: number | null = null;
  if (pool.length === 1) {
    strike = Math.abs(pool[0].val);
  } else if (pool.length > 1) {
    const vals = pool.map((e) => Math.abs(e.val)).sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    strike = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
  }
  return { shares, strike, period: latestPeriod, accn };
}

export interface WarrantOverhang {
  shares: number;
  strike: number | null;
  period: string;
}

export interface SecuritiesOverhang {
  warrant: WarrantOverhang | null;
  convertible: WarrantOverhang | null;
  /** total dilutive shares from warrants+convertibles / shares outstanding */
  overhangPct: number | null;
  /** C19 sanity flag: warrant/convertible shares exceed 50× shares outstanding —
   *  almost always a unit mis-tag or contingent/authorized class captured raw
   *  (e.g. MOBX 2.6B warrants vs 2.78M shares). In-the-money scoring already
   *  neutralizes these (deeply OTM → dormant), but the raw overhangPct is
   *  misleading in sorts. Surface a warning; don't silently drop the data. */
  suspect: boolean;
}

export async function computeOverhangFromDb(
  cik: string,
  sharesOutstanding: number | null,
): Promise<SecuritiesOverhang> {
  const rows = await prisma.dilutionSecurity.findMany({ where: { cik } });
  const warrant = rows.find((r) => r.type === 'warrant') ?? null;
  const convertible = rows.find((r) => r.type === 'convertible') ?? null;
  // C23 read-time guard: a stored strike outside $0.0001–$10,000/share is a
  // filer error (aggregate mistagged as per-share) or unit corruption — never a
  // real exercise price. Null it so it doesn't surface as $1.19M in the UI.
  // (Sync-time latestAggregate applies the same filter + median for new syncs.)
  const PLAUS_MIN = 0.0001;
  const PLAUS_MAX = 10_000;
  const cleanStrike = (s: number | null) =>
    s != null && s >= PLAUS_MIN && s <= PLAUS_MAX ? s : null;
  const totalShares =
    (warrant?.shares ?? 0) + (convertible?.shares ?? 0);
  const overhangPct =
    sharesOutstanding && sharesOutstanding > 0 ? (totalShares / sharesOutstanding) * 100 : null;
  // C19 sanity guard: flag implausible overhangs. Raw XBRL occasionally
  // captures contingent/authorized classes or mis-scales units, producing share
  // counts dwarfing float (MOBX: 2.6B vs 2.78M out). Keep the data — the user
  // verifies — but flag so the number isn't blindly trusted in sorts.
  const RATIO_CAP = 50; // × shares outstanding
  const suspect = !!(sharesOutstanding && sharesOutstanding > 0) && (
    (warrant != null && warrant.shares > RATIO_CAP * sharesOutstanding) ||
    (convertible != null && convertible.shares > RATIO_CAP * sharesOutstanding)
  );
  return {
    warrant: warrant && warrant.shares != null
      ? { shares: warrant.shares, strike: cleanStrike(warrant.strike), period: warrant.period ?? '' }
      : null,
    convertible: convertible && convertible.shares != null
      ? { shares: convertible.shares, strike: cleanStrike(convertible.strike), period: convertible.period ?? '' }
      : null,
    overhangPct,
    suspect,
  };
}

export interface SyncSecuritiesResult {
  status: 'success' | 'error';
  warrant: WarrantOverhang | null;
  convertible: WarrantOverhang | null;
  error?: string;
}

export async function syncSecurities(rawTicker: string): Promise<SyncSecuritiesResult> {
  const empty: SyncSecuritiesResult = { status: 'success', warrant: null, convertible: null };
  const entry = await getCikForTicker(rawTicker);
  if (!entry) return { ...empty, status: 'error', error: `No CIK for ${rawTicker}` };
  const { cik } = entry;

  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
  let payload: CompanyFacts;
  try {
    payload = await secFetchJson<CompanyFacts>(url);
  } catch (err) {
    if (err instanceof SecHttpError && err.status === 404) return empty;
    return { ...empty, status: 'error', error: err instanceof Error ? err.message : 'fetch failed' };
  }

  const gaap = payload.facts?.['us-gaap'];
  if (!gaap) return empty;

  const warrantAgg = latestAggregate(
    entriesOf(gaap, WARRANT_SHARES),
    entriesOf(gaap, WARRANT_STRIKE),
  );
  const convertAgg = latestAggregate(
    entriesOf(gaap, CONVERT_SHARES),
    entriesOf(gaap, CONVERT_STRIKE),
  );

  const writes: Promise<unknown>[] = [];
  if (warrantAgg) {
    writes.push(
      prisma.dilutionSecurity.upsert({
        where: { cik_type: { cik, type: 'warrant' } },
        create: { cik, type: 'warrant', strike: warrantAgg.strike, shares: warrantAgg.shares, period: warrantAgg.period, accn: warrantAgg.accn },
        update: { strike: warrantAgg.strike, shares: warrantAgg.shares, period: warrantAgg.period, accn: warrantAgg.accn, syncedAt: new Date() },
      }),
    );
  } else {
    writes.push(prisma.dilutionSecurity.deleteMany({ where: { cik, type: 'warrant' } }));
  }
  if (convertAgg) {
    writes.push(
      prisma.dilutionSecurity.upsert({
        where: { cik_type: { cik, type: 'convertible' } },
        create: { cik, type: 'convertible', strike: convertAgg.strike, shares: convertAgg.shares, period: convertAgg.period, accn: convertAgg.accn },
        update: { strike: convertAgg.strike, shares: convertAgg.shares, period: convertAgg.period, accn: convertAgg.accn, syncedAt: new Date() },
      }),
    );
  } else {
    writes.push(prisma.dilutionSecurity.deleteMany({ where: { cik, type: 'convertible' } }));
  }
  await Promise.all(writes);

  return {
    status: 'success',
    warrant: warrantAgg ? { shares: warrantAgg.shares, strike: warrantAgg.strike, period: warrantAgg.period } : null,
    convertible: convertAgg ? { shares: convertAgg.shares, strike: convertAgg.strike, period: convertAgg.period } : null,
  };
}
