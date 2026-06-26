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

interface SubmissionsPayload {
  cik: string;
  name?: string;
  tickers?: string[];
  exchanges?: string[];
  entityType?: string;
  sic?: string;
  sicDescription?: string;
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
