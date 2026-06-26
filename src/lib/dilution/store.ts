/**
 * Dilution DB store — persistence + read helpers built on the pure classifier.
 * Keeps classify.ts side-effect-free and gives both API routes a single source
 * of truth for snapshot shape.
 */
import { prisma } from '@/lib/prisma';
import { classifyFiling, type DilutionTag } from '@/lib/dilution/classify';

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
  fromCache: boolean; // true = served from DB only (no SEC call this request)
}

/** Build the dilution snapshot entirely from the DB (no SEC call). */
export async function getSnapshot(cik: string): Promise<DilutionSnapshot> {
  const [company, factRows, filings] = await Promise.all([
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
  ]);

  const sharesHistory = factRows.map((r) => ({ period: r.period, outstanding: r.val }));

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
    fromCache: true,
  };
}

// accessionNo in submissions.json uses dashes (0000320193-26-000013); the
// archive folder strips them. Standard SEC archives URL:
function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  const doc = primaryDoc ?? '';
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${doc}`;
}
