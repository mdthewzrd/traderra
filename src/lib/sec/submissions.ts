/**
 * SEC submissions.json parser + DB sync.
 *
 * Adapted from Nexus-Terminal lib/sec/submissions.ts but focused on our needs:
 * fetch the parallel-array "recent" block, upsert company + filings (idempotent
 * by accessionNo). Dilution classification (dilutionTags) is applied separately
 * in lib/dilution/classify.ts so this stays a pure data-plumbing layer.
 */
import { prisma } from '@/lib/prisma';
import { SecHttpError, secFetchJson } from '@/lib/sec/client';
import { getCikForTicker, normalizeTicker, padCik } from '@/lib/sec/cik-map';

const SUBMISSIONS_BASE = 'https://data.sec.gov/submissions';

export interface ParsedFiling {
  accessionNo: string; // SEC canonical form WITH dashes, e.g. "0000320193-26-000013"
  cik: string;
  formType: string;
  filingDate: Date;
  reportDate: Date | null;
  primaryDoc: string | null;
  primaryDesc: string | null;
  items: string[]; // 8-K items ["1.01","5.03"]
}

// The "recent" block is a set of parallel arrays (column-oriented).
interface RecentColumns {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: (string | null)[];
  form: string[];
  primaryDocument: (string | null)[];
  primaryDocDescription: (string | null)[];
  items?: (string | null)[]; // present only on event forms (8-K etc.)
}

/** Raw SEC formerNames entry. SEC uses `from`/`to` (ISO datetime); normalized feeds (e.g. cached seeds) may use startDate/endDate — parseFormerNames accepts both. */
interface FormerNameRaw {
  name: string;
  from?: string;
  to?: string;
  startDate?: string;
  endDate?: string;
}

interface SubmissionsPayload {
  cik: string;
  name?: string;
  tickers?: string[];
  exchanges?: string[];
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  formerNames?: FormerNameRaw[]; // REQ-571 Phase 1 name-chain backbone
  filings?: { recent?: RecentColumns };
}

function parseRecent(payload: SubmissionsPayload, cik: string, limit: number): ParsedFiling[] {
  const recent = payload.filings?.recent;
  if (!recent || !recent.accessionNumber) return [];
  const n = Math.min(limit, recent.accessionNumber.length);
  const out: ParsedFiling[] = [];
  for (let i = 0; i < n; i++) {
    const itemsRaw = recent.items?.[i];
    out.push({
      accessionNo: recent.accessionNumber[i],
      cik,
      formType: recent.form[i],
      filingDate: new Date(recent.filingDate[i]),
      reportDate: recent.reportDate?.[i] ? new Date(recent.reportDate[i] as string) : null,
      primaryDoc: recent.primaryDocument?.[i] ?? null,
      primaryDesc: recent.primaryDocDescription?.[i] ?? null,
      items: itemsRaw ? itemsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
  }
  return out;
}

export interface SyncFilingsResult {
  status: 'success' | 'error';
  count: number;
  cik: string | null;
  error?: string;
}

/**
 * Sync recent filings for a ticker into the DB. Idempotent by accessionNo.
 * Company is upserted first (FK-safe), then filings, in one transaction.
 */
export async function syncFilings(
  rawTicker: string,
  options?: { limit?: number },
): Promise<SyncFilingsResult> {
  const limit = options?.limit ?? 50;
  const entry = await getCikForTicker(rawTicker);
  if (!entry) {
    return { status: 'error', count: 0, cik: null, error: `No CIK found for ticker ${rawTicker}` };
  }
  const { cik, name, exchange } = entry;
  const ticker = normalizeTicker(rawTicker);

  const url = `${SUBMISSIONS_BASE}/CIK${padCik(cik)}.json`;
  let payload: SubmissionsPayload;
  try {
    payload = await secFetchJson<SubmissionsPayload>(url);
  } catch (err) {
    if (err instanceof SecHttpError && err.status === 404) {
      return { status: 'success', count: 0, cik };
    }
    const message = err instanceof Error ? err.message : 'SEC fetch failed';
    return { status: 'error', count: 0, cik, error: message };
  }

  const filings = parseRecent(payload, cik, limit);

  await prisma.$transaction([
    prisma.dilutionCompany.upsert({
      where: { cik },
      create: {
        cik,
        name: payload.name ?? name,
        tickers: payload.tickers ?? [ticker],
        exchange: exchange ?? null,
        entityType: payload.entityType ?? null,
        filingsLastSynced: new Date(),
      },
      update: {
        name: payload.name ?? name,
        tickers: payload.tickers ?? undefined,
        filingsLastSynced: new Date(),
      },
    }),
    ...filings.map((f) =>
      prisma.dilutionFiling.upsert({
        where: { accessionNo: f.accessionNo },
        create: {
          accessionNo: f.accessionNo,
          cik,
          formType: f.formType,
          filingDate: f.filingDate,
          reportDate: f.reportDate,
          primaryDoc: f.primaryDoc,
          primaryDesc: f.primaryDesc,
          items: f.items,
        },
        update: {
          formType: f.formType,
          reportDate: f.reportDate,
          primaryDesc: f.primaryDesc,
          items: f.items,
        },
      }),
    ),
  ]);

  return { status: 'success', count: filings.length, cik };
}

/** Read recent filings from DB (no SEC call). */
export async function getRecentFilings(cik: string, limit = 50) {
  return prisma.dilutionFiling.findMany({
    where: { cik },
    orderBy: { filingDate: 'desc' },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// REQ-571 Phase 1 — CIK name-chain backbone (company names + date ranges).
// This layer resolves NAMES only. The historical ticker SYMBOLS are derived by
// the ticker-chain resolver (src/lib/sec/ticker-chain.ts) from annual snapshots.
// ---------------------------------------------------------------------------

/** One resolved period: a company name with an optional [startDate, endDate]. */
export interface FormerNameEntry {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
}

/** Result of resolving a CIK's name-chain backbone from SEC submissions.json. */
export interface FormerNamesResult {
  cik: string; // 10-digit zero-padded
  currentName: string | null;
  currentTickers: string[];
  /** Earliest evidence this CIK existed as a filing entity. Downstream price-history
   *  consumers MUST discard bars predating this date (ticker-recycling hazard:
   *  Polygon silently concatenates histories of companies reusing a symbol). */
  earliestFilingDate: Date | null;
  formerNames: FormerNameEntry[]; // ordered as SEC returns them
}

/** Parse an ISO date/datetime string into a Date, or null when absent/invalid. */
function parseSecDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fetch the full submissions.json payload for a CIK.
 * Returns null on 404 (company has no submissions); other fetch errors throw.
 * Exposed so the ticker-chain resolver reuses the same UA/rate-limited fetch
 * instead of hand-rolling requests (SEC 403s generic User-Agents).
 */
export async function fetchSubmissionsPayload(cik: string): Promise<SubmissionsPayload | null> {
  const url = `${SUBMISSIONS_BASE}/CIK${padCik(cik)}.json`;
  try {
    return await secFetchJson<SubmissionsPayload>(url);
  } catch (err) {
    if (err instanceof SecHttpError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Resolve a CIK's name-chain backbone from SEC submissions.json.
 *
 * Returns the current name + tickers, the parsed formerNames (each with nullable
 * startDate/endDate — SEC sometimes omits them), and the CIK's earliest filing
 * date (recycling-hazard prune field). Yields company NAMES + date ranges only;
 * historical ticker SYMBOLS are derived elsewhere from annual snapshots.
 */
export async function parseFormerNames(cik: string): Promise<FormerNamesResult> {
  const padded = padCik(cik);
  const payload = await fetchSubmissionsPayload(padded);

  const result: FormerNamesResult = {
    cik: padded,
    currentName: payload?.name ?? null,
    currentTickers: payload?.tickers ?? [],
    earliestFilingDate: null,
    formerNames: [],
  };
  if (!payload) return result;

  const formerNames: FormerNameEntry[] = (payload.formerNames ?? []).map((f) => ({
    name: f.name,
    // Raw SEC keys are from/to; accept startDate/endDate from normalized feeds.
    startDate: parseSecDate(f.from ?? f.startDate),
    endDate: parseSecDate(f.to ?? f.endDate),
  }));

  // Earliest SEC filing date: submissions.json has no dedicated field, so derive
  // the earliest evidence this CIK existed. Use the EARLIER of the oldest recent
  // filing date and the earliest formerName start, so consumers prune maximally
  // against ticker-recycling concatenation (over-pruning recent history is not a
  // risk because the oldest recent filing is itself a filing by this CIK).
  const filingDates = payload.filings?.recent?.filingDate ?? [];
  let oldestFiling: Date | null = null;
  if (filingDates.length) {
    // 'YYYY-MM-DD' zero-padded strings sort lexicographically == chronologically.
    const minStr = filingDates.reduce<string | null>(
      (m, s) => (s && (!m || s < m) ? s : m),
      null,
    );
    oldestFiling = parseSecDate(minStr);
  }
  const nameStarts = formerNames
    .map((f) => f.startDate)
    .filter((d): d is Date => !!d);
  const earliestNameStart = nameStarts.length
    ? new Date(Math.min(...nameStarts.map((d) => d.getTime())))
    : null;
  if (oldestFiling && earliestNameStart) {
    result.earliestFilingDate =
      oldestFiling.getTime() <= earliestNameStart.getTime() ? oldestFiling : earliestNameStart;
  } else {
    result.earliestFilingDate = oldestFiling ?? earliestNameStart;
  }

  result.formerNames = formerNames;
  return result;
}
