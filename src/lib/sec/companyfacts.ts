/**
 * SEC companyfacts.json (XBRL) → DilutionFact time series.
 *
 * Adapted from Nexus-Terminal lib/sec/companyfacts.ts. Key difference: we persist
 * per-period rows into DilutionFact (queryable time series) instead of Nexus's
 * opaque JSON blob — so the dilution-velocity curve and QoQ growth are trivial.
 *
 * Preserves Nexus's critical `dedupeByEnd` rule: prefer frame-defined entries,
 * then latest filed, then greatest accn — NEVER max val (that breaks reverse
 * splits and silent restatements).
 */
import { prisma } from '@/lib/prisma';
import { SecHttpError, secFetchJson } from '@/lib/sec/client';
import { getCikForTicker, padCik } from '@/lib/sec/cik-map';

const FACTS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SHARES_FACT = 'EntityCommonStockSharesOutstanding';

export interface ShareSnapshot {
  period: string; // "end" date, e.g. "2026-04-17"
  outstanding: number;
  filed: Date | null;
  accn: string | null;
}

interface FactEntry {
  end: string;
  val: number;
  filed: string;
  accn: string;
  frame?: string;
}

interface CompanyFactsPayload {
  facts: {
    dei?: {
      EntityCommonStockSharesOutstanding?: { units?: { shares?: FactEntry[] } };
    };
    'us-gaap'?: {
      CommonStockSharesOutstanding?: { units?: { shares?: FactEntry[] } };
      CommonStockSharesIssued?: { units?: { shares?: FactEntry[] } };
    };
  };
}

// Pick first non-empty shares array from the concept fallback chain.
function pickShareEntries(facts: CompanyFactsPayload['facts']): FactEntry[] {
  const candidates = [
    facts.dei?.EntityCommonStockSharesOutstanding?.units?.shares,
    facts['us-gaap']?.CommonStockSharesOutstanding?.units?.shares,
    facts['us-gaap']?.CommonStockSharesIssued?.units?.shares,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

// Dedupe by `end` date. Priority: frame!==undefined > latest filed > greatest accn.
// NEVER uses max val — that breaks reverse splits and silent restatements.
function dedupeByEnd(entries: FactEntry[]): FactEntry[] {
  const byEnd = new Map<string, FactEntry>();
  for (const entry of entries) {
    const existing = byEnd.get(entry.end);
    if (!existing) {
      byEnd.set(entry.end, entry);
      continue;
    }
    const eHasFrame = existing.frame !== undefined;
    const nHasFrame = entry.frame !== undefined;
    if (nHasFrame && !eHasFrame) {
      byEnd.set(entry.end, entry);
      continue;
    }
    if (!nHasFrame && eHasFrame) continue;
    if (entry.filed > existing.filed) {
      byEnd.set(entry.end, entry);
      continue;
    }
    if (entry.filed < existing.filed) continue;
    if (entry.accn > existing.accn) byEnd.set(entry.end, entry);
  }
  return Array.from(byEnd.values());
}

export interface SyncFactsResult {
  status: 'success' | 'error';
  count: number;
  cik: string | null;
  snapshots: ShareSnapshot[];
  error?: string;
}

export async function readSharesFromDb(cik: string, limit = 40): Promise<ShareSnapshot[]> {
  const rows = await prisma.dilutionFact.findMany({
    where: { cik, fact: SHARES_FACT },
    orderBy: { period: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    period: r.period,
    outstanding: r.val,
    filed: r.filed,
    accn: r.accn,
  }));
}

/**
 * Sync shares-outstanding history for a ticker. Serves DB rows if
 * factsLastSynced is fresher than 7d; otherwise fetches + upserts per-period.
 */
export async function syncSharesOutstanding(
  rawTicker: string,
  options?: { limit?: number },
): Promise<SyncFactsResult> {
  const limit = options?.limit ?? 40;
  const entry = await getCikForTicker(rawTicker);
  if (!entry) {
    return { status: 'error', count: 0, cik: null, snapshots: [], error: `No CIK for ${rawTicker}` };
  }
  const { cik, name, ticker, exchange } = entry;

  const company = await prisma.dilutionCompany.findUnique({
    where: { cik },
    select: { factsLastSynced: true },
  });
  if (company?.factsLastSynced && Date.now() - company.factsLastSynced.getTime() < FACTS_TTL_MS) {
    const snapshots = await readSharesFromDb(cik, limit);
    return { status: 'success', count: snapshots.length, cik, snapshots };
  }

  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padCik(cik)}.json`;
  let payload: CompanyFactsPayload;
  try {
    payload = await secFetchJson<CompanyFactsPayload>(url);
  } catch (err) {
    if (err instanceof SecHttpError && err.status === 404) {
      return { status: 'success', count: 0, cik, snapshots: [] };
    }
    if (company?.factsLastSynced) {
      const snapshots = await readSharesFromDb(cik, limit);
      if (snapshots.length) return { status: 'success', count: snapshots.length, cik, snapshots };
    }
    const message = err instanceof Error ? err.message : 'SEC fetch failed';
    return { status: 'error', count: 0, cik, snapshots: [], error: message };
  }

  const deduped = dedupeByEnd(pickShareEntries(payload.facts));
  deduped.sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
  const top = deduped.slice(0, limit);

  // Ensure company row exists (facts may sync before filings).
  await prisma.dilutionCompany.upsert({
    where: { cik },
    create: {
      cik,
      name,
      tickers: [ticker],
      exchange,
      factsLastSynced: new Date(),
    },
    update: { factsLastSynced: new Date() },
  });

  await prisma.$transaction(
    top.map((e) =>
      prisma.dilutionFact.upsert({
        where: { cik_fact_period: { cik, fact: SHARES_FACT, period: e.end } },
        create: {
          cik,
          fact: SHARES_FACT,
          period: e.end,
          unit: 'shares',
          val: e.val,
          filed: new Date(e.filed),
          accn: e.accn,
        },
        update: { val: e.val, filed: new Date(e.filed), accn: e.accn },
      }),
    ),
  );

  return {
    status: 'success',
    count: top.length,
    cik,
    snapshots: top.map((e) => ({
      period: e.end,
      outstanding: e.val,
      filed: new Date(e.filed),
      accn: e.accn,
    })),
  };
}
