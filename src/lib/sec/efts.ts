/**
 * EDGAR Full-Text Search (EFTS) recall layer.
 *
 * `efts.sec.gov/LATEST/search-index` indexes the FULL TEXT of every filing +
 * exhibit. This is the missing input our per-filing parsers lacked: they regex
 * a single primaryDoc and miss facilities buried in (a) exhibits, (b) older
 * filings outside our 50-row window, (c) non-8-K forms (S-3 prospectuses).
 *
 * Proven gap: SRFM's GEM SPA is mentioned in 126 filings; our filings8k parser
 * found 1 (the 10-K). EFTS surfaces the exact exhibit (accessionNo:exhibit).
 *
 * Flow: search facility phrases → dedupe against already-parsed filings →
 * fetch only NEW exhibits → reuse filings8k.parseClause on a window around the
 * phrase hit → store as a DilutionFiling row (rawPayload.programDetail) so
 * getPrograms renders it with zero UI change.
 *
 * Idempotent: rawPayload.eftsScanned flags scanned accessions; re-runs only
 * fetch new filings. Free + official (10 req/s shared budget, User-Agent set).
 */
import { prisma } from '@/lib/prisma';
import { secFetchResponse } from '@/lib/sec/client';
import { parseClause, type ProgramDetail } from '@/lib/sec/filings8k';

const EFTS_BASE = 'https://efts.sec.gov/LATEST/search-index';
const MAX_HITS_PER_PHRASE = 20;
const WINDOW_CHARS = 4500; // clause context extracted around each phrase hit
const MAX_EXHIBITS = 24; // cap fetches per sync (rate budget)

// Phrases that signal a dilution facility. Two tiers:
//  (1) GENERIC facility phrases — catch most deals regardless of counterparty.
//  (2) NOTORIOUS SEPA/standby-equity counterparties — high precision (if the
//      name appears for this CIK, it's almost certainly their deal). Proven:
//      'GEM Global Yield' surfaces SRFM's SPA that generic phrases missed.
const FACILITY_PHRASES = [
  // generic
  '"Security Purchase Agreement"',
  '"standby equity"',
  '"equity line of credit"',
  '"pre-funded warrants"',
  '"at the market" "sales agreement"',
  // repeat-offender standby-equity / SEPA counterparties
  '"GEM Global"',
  '"Yorkville Advisors"',
  '"Lincoln Park Capital"',
  '"Kingswood Capital"',
];

export interface EftsHit {
  accessionNo: string; // 0000950170-24-094783 (dashed)
  exhibit: string | null; // srfm-20240807.htm (null = primary doc)
  rootForm: string | null; // 8-K, S-3, 424B5, 10-K ...
  filingDate: string | null; // ISO
  adsh: string; // accession no-dashes (archive path segment)
}

interface EftsResponse {
  hits?: {
    total?: { value?: number };
    hits?: Array<{
      _id: string; // "accession:exhibit.htm"
      _source?: {
        root_forms?: string[];
        file_date?: string;
        display_names?: string[];
      };
    }>;
  };
}

function archiveUrl(cik: string, adsh: string, exhibit: string | null): string {
  const num = Number(cik);
  return `https://www.sec.gov/Archives/edgar/data/${num}/${adsh}/${exhibit ?? ''}`;
}

/** Call EFTS for one phrase. Returns matched exhibits. */
export async function eftsSearch(cik: string, phrase: string): Promise<EftsHit[]> {
  const url = `${EFTS_BASE}?q=${encodeURIComponent(phrase)}&ciks=${cik}`;
  try {
    const res = await secFetchResponse(url, 'application/json');
    if (!res.ok) return [];
    const j = (await res.json()) as EftsResponse;
    const hits = j.hits?.hits ?? [];
    return hits.slice(0, MAX_HITS_PER_PHRASE).map((h) => {
      const [accessionNo, exhibit] = h._id.split(':');
      return {
        accessionNo,
        exhibit: exhibit || null,
        rootForm: h._source?.root_forms?.[0] ?? null,
        filingDate: h._source?.file_date ?? null,
        adsh: accessionNo.replace(/-/g, ''),
      };
    });
  } catch {
    return [];
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SyncEftsResult {
  status: 'success' | 'error';
  searched: number; // distinct accessions found via EFTS
  fetched: number; // exhibits fetched + parsed
  found: number; // parsed into a ProgramDetail
  created: number; // new DilutionFiling rows created (outside our window)
  error?: string;
}

/** Search EFTS for facility phrases, fetch new exhibits, parse + persist. */
export async function syncEftsFacilities(cik: string): Promise<SyncEftsResult> {
  const res: SyncEftsResult = { status: 'success', searched: 0, fetched: 0, found: 0, created: 0 };
  try {
    // Gather hits across all phrases, deduped by accessionNo (one program/filing).
    const byAccession = new Map<string, EftsHit>();
    for (const phrase of FACILITY_PHRASES) {
      const hits = await eftsSearch(cik, phrase);
      for (const h of hits) {
        if (!byAccession.has(h.accessionNo)) byAccession.set(h.accessionNo, h);
      }
    }
    res.searched = byAccession.size;
    if (byAccession.size === 0) return res;

    // Determine which accessions we've already scanned (any filing with this
    // accessionNo in our DB that has rawPayload.eftsScanned or programDetail).
    const ourAccessions = new Set(
      (await prisma.dilutionFiling.findMany({
        where: { cik, accessionNo: { in: [...byAccession.keys()] } },
        select: { accessionNo: true, rawPayload: true, primaryDoc: true, formType: true },
      })).map((f) => f.accessionNo),
    );
    const scannedRows = await prisma.dilutionFiling.findMany({
      where: { cik, accessionNo: { in: [...byAccession.keys()] } },
      select: { accessionNo: true, rawPayload: true },
    });
    const alreadyScanned = new Set(
      scannedRows
        .filter((f) => {
          const rp = (f.rawPayload ?? {}) as { eftsScanned?: boolean; programDetail?: unknown };
          return !!rp.eftsScanned || !!rp.programDetail;
        })
        .map((f) => f.accessionNo),
    );

    // Fetch + parse only the new accessions, capped to protect rate budget.
    // PRIORITIZE filings NOT already in our DB — those are the truly new
    // discoveries (often old facilities outside our 50-row window, like SRFM's
    // 2024 GEM SPA). In-DB accessions are fetched second (they may be primaries
    // filings8k already covered, but their exhibits often weren't).
    const todo = [...byAccession.values()]
      .filter((h) => !alreadyScanned.has(h.accessionNo))
      .sort((a, b) => {
        const aNew = ourAccessions.has(a.accessionNo) ? 1 : 0;
        const bNew = ourAccessions.has(b.accessionNo) ? 1 : 0;
        if (aNew !== bNew) return aNew - bNew; // non-DB first
        return (b.filingDate ?? '').localeCompare(a.filingDate ?? ''); // then newest
      })
      .slice(0, MAX_EXHIBITS);

    for (const hit of todo) {
      if (!hit.exhibit) continue; // skip primary-doc hits (filings8k already covers 8-K primaries)
      try {
        const r = await secFetchResponse(archiveUrl(cik, hit.adsh, hit.exhibit), 'text/html');
        if (!r.ok) continue;
        const text = stripHtml(await r.text());
        res.fetched++;
        // Find the best clause window: the earliest phrase match with a
        // facility signal. Take a window AROUND the hit for context.
        let bestClause = '';
        let bestScore = -1;
        for (const phrase of FACILITY_PHRASES) {
          const term = phrase.replace(/"/g, '');
          const idx = text.toLowerCase().indexOf(term);
          if (idx < 0) continue;
          const start = Math.max(0, idx - 200);
          const clause = text.slice(start, start + WINDOW_CHARS);
          // crude score: prefer clauses with $ amounts + counterparty signals
          const score =
            (/\$\s?[\d,.]+\s*(million|billion|thousand)?/i.test(clause) ? 2 : 0) +
            (/(LLC|Inc|Capital|Partners|Global|Lender|Purchaser)/i.test(clause) ? 1 : 0);
          if (score > bestScore) { bestScore = score; bestClause = clause; }
        }
        if (!bestClause) {
          // mark scanned even with no clause so we don't re-fetch
          await upsertEftsFiling(cik, hit, ourAccessions.has(hit.accessionNo), { eftsScanned: true });
          continue;
        }
        const detail = parseClause(bestClause, hit.accessionNo, hit.filingDate ?? '', []);
        if (detail) res.found++;
        await upsertEftsFiling(cik, hit, ourAccessions.has(hit.accessionNo), {
          eftsScanned: true,
          ...(detail ? { programDetail: detail } : {}),
        });
        if (!ourAccessions.has(hit.accessionNo)) { res.created++; ourAccessions.add(hit.accessionNo); }
      } catch {
        // network/parse fail — leave unscanned so a later run retries
      }
    }
    return res;
  } catch (err) {
    return { ...res, status: 'error', error: err instanceof Error ? err.message : 'efts sync failed' };
  }
}

/** Upsert a DilutionFiling row for an EFTS-discovered filing. Creates a minimal
 *  row when the accession is outside our 50-filing window; merges into existing
 *  rawPayload when present. Never overwrites primaryDoc on an existing row. */
async function upsertEftsFiling(
  cik: string,
  hit: EftsHit,
  existsInDb: boolean,
  payloadPatch: Record<string, unknown>,
): Promise<void> {
  const filingDate = hit.filingDate ? new Date(hit.filingDate) : new Date();
  if (existsInDb) {
    const existing = await prisma.dilutionFiling.findUnique({
      where: { accessionNo: hit.accessionNo },
      select: { rawPayload: true },
    });
    await prisma.dilutionFiling.update({
      where: { accessionNo: hit.accessionNo },
      data: { rawPayload: { ...((existing?.rawPayload as Record<string, unknown>) ?? {}), ...payloadPatch } },
    });
  } else {
    await prisma.dilutionFiling.upsert({
      where: { accessionNo: hit.accessionNo },
      create: {
        accessionNo: hit.accessionNo,
        cik,
        formType: hit.rootForm ?? '8-K',
        filingDate,
        primaryDoc: hit.exhibit,
        primaryDesc: 'EFTS facility exhibit',
        rawPayload: { eftsDiscovered: true, eftsSource: 'efts.ts', ...payloadPatch },
      },
      update: { rawPayload: { eftsDiscovered: true, eftsSource: 'efts.ts', ...payloadPatch } },
    });
  }
}

/** Standalone debug helper: count EFTS hits for a phrase without persisting. */
export async function eftsCount(cik: string, phrase: string): Promise<number> {
  const hits = await eftsSearch(cik, phrase);
  return hits.length;
}
