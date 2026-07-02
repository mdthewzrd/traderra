/**
 * 10-K warrant & convertible notes parser (Loop 4).
 *
 * The per-instrument detail Nexus shows — warrant expiry, exercisable date,
 * convertible principal + maturity — lives in 10-K financial-statement NOTES
 * (stockholders' equity / long-term debt), which XBRL does NOT expose as clean
 * facts. We previously stored only 10-K metadata; this fetches the body and
 * extracts structured detail from the warrant/convertible note clauses.
 *
 * HONEST SCOPE: 10-K note prose is highly variable. This is a high-PRECISION,
 * partial-RECALL extractor — it pulls from structured clauses it can parse
 * confidently and surfaces the raw clause text so the user verifies. It does
 * NOT fabricate; when nothing parses, warrantNotes is null and the UI shows the
 * aggregate XBRL overhang only. Expect detail on ~30-50% of filers.
 *
 * Storage: latest-parsed detail written to DilutionFiling.rawPayload.warrantNotes
 * on the most recent 10-K (idempotent — skipped once parsed). Read via
 * getWarrantNotes(cik) for the snapshot.
 *
 * Verified patterns (2026-06-28):
 *   "warrants to purchase N shares ... exercise price of $Y ... expire on DATE"
 *   "N% convertible notes due YEAR ... conversion price of $Y"
 */
import { prisma } from '@/lib/prisma';
import { secFetchResponse } from '@/lib/sec/client';

const SCALE: Record<string, number> = { million: 1e6, billion: 1e9, thousand: 1e3 };
function scaleShares(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n)) return null;
  return n * (m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1);
}
function scaleMoney(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n)) return null;
  return n * (m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&amp;/gi, '&')
    .replace(/&#8217;|&#8220;|&#8221;|&ldquo;|&rdquo;|&rsquo;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${primaryDoc ?? ''}`;
}

// Split stripped text into clause-ish chunks (sentence-ish). Warrant/convertible
// detail rarely crosses these boundaries. Caps chunk size to bound regex cost.
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.;])\s+(?=[A-Z0-9])/)
    .map((c) => c.trim())
    .filter((c) => c.length > 25 && c.length < 600);
}

export interface WarrantNoteRow {
  description: string; // raw clause — the user reads + verifies
  shares: number | null;
  exercisePrice: number | null;
  expiry: string | null; // date text or ISO — when the overhang DISAPPEARS
  exercisableDate: string | null;
}

export interface ConvertibleNoteRow {
  description: string;
  principal: number | null;
  maturity: string | null; // "due 2027" or date — when converts/matures
  conversionPrice: number | null;
}

export interface EquityLineNoteRow {
  description: string;
  counterparty: string | null; // e.g. "GEM Global Yield LLC"
  maxCommitment: number | null; // $ facility ceiling if stated
  pricing: string | null; // 'VWAP-based' / 'fixed $N'
  ownershipCap: number | null; // % (9.99 common)
}

export interface GoingConcern {
  present: boolean;
  text: string | null; // the going-concern clause (~400 chars) for display
}

export interface ParsedWarrantNotes {
  warrantNotesParsed: true;
  warrants: WarrantNoteRow[];
  convertibles: ConvertibleNoteRow[];
  equityLines: EquityLineNoteRow[]; // pre-existing SEPA/SPA facilities (GEM-style)
  goingConcern: GoingConcern; // substantial-doubt language from 10-K/10-Q
  source: string; // '10-K <accessionNo>' for traceability
  parsedAt: string;
}

export function parseWarrantNotesHtml(html: string, accessionNo: string): ParsedWarrantNotes {
  const text = stripHtml(html);
  const chunks = clauses(text);
  const DATE = /([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/;
  const YEAR = /\b(20\d{2})\b/;

  const warrants: WarrantNoteRow[] = [];
  const convertibles: ConvertibleNoteRow[] = [];
  const equityLines: EquityLineNoteRow[] = [];

  for (const c of chunks) {
    const lower = c.toLowerCase();
    // WARRANT clauses: must mention warrant + (shares or exercise price or expiry)
    if (/\bwarrant/i.test(c) && /(exercis|expir|shares?\s+of\s+common|exercise\s+price)/i.test(c)) {
      let shares: number | null = null;
      let exercisePrice: number | null = null;
      let expiry: string | null = null;
      let exercisableDate: string | null = null;

      const sh = c.match(/(?:purchase|represent|for|of|issued)\s+([\d,.]+\s*(?:million|billion|thousand)?)\s+(?:shares?|warrants?)/i);
      if (sh) shares = scaleShares(sh[1]);
      const ep = c.match(/exercise\s+price\s+of\s+(?:\$\s*)?([\d,.]+)/i)
        ?? c.match(/(?:at|of)\s+(?:a\s+)?(?:price\s+of\s+)?\$\s*([\d,.]+)\s+per\s+share/i)
        ?? c.match(/\$\s*([\d,.]+)\s+per\s+share[^.]{0,20}?exercis/i)
        ?? c.match(/\$\s*([\d,.]+)\s+per\s+share/i);
      if (ep) exercisePrice = scaleMoney(ep[1]);
      const ex = c.match(/expir(?:e|es|ing|ation|y)[^.]{0,30}?(?:on)?\s*([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ex) expiry = ex[1];
      const ed = c.match(/exercisable(?:\s+(?:commencing|beginning|on|until))?\s+(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ed) exercisableDate = ed[1];

      // Only keep clauses with at least one structured fact (avoid prose-only).
      if (shares != null || exercisePrice != null || expiry != null || exercisableDate != null) {
        warrants.push({ description: c, shares, exercisePrice, expiry, exercisableDate });
      }
    }

    // CONVERTIBLE clauses: "convertible notes due YEAR" / "convert into ... at conversion price"
    if (/convertible\s+notes?\b/i.test(c) && /(due|principal|conversion|matur)/i.test(c)) {
      let principal: number | null = null;
      let maturity: string | null = null;
      let conversionPrice: number | null = null;

      const pr = c.match(/\$\s*([\d,.]+\s*(?:million|billion|thousand)?)/i) ?? c.match(/aggregate\s+principal\s+(?:amount\s+)?(?:of\s+)?([\d,.]+)/i);
      if (pr) principal = scaleMoney(pr[1]);
      const mt = c.match(/due\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4})/i) ?? c.match(/due\s+(\d{4})/i) ?? c.match(/matur(?:e|ity)[^.]{0,20}?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{4})/i);
      if (mt) maturity = mt[1];
      const cp = c.match(/conversion\s+price\s+of\s+(?:\$)?([\d,.]+)/i);
      if (cp) conversionPrice = scaleMoney(cp[1]);

      if (principal != null || maturity != null || conversionPrice != null) {
        convertibles.push({ description: c, principal, maturity, conversionPrice });
      }
    }

    // EQUITY-LINE / SEPA / SPA clauses (pre-existing facilities disclosed in
    // annual notes — NOT new 8-K events). GEM-style share subscription facility.
    // These are the toxic standing facilities Nexus surfaces as 'Equity Lines'.
    if (/(standby\s+equity|share\s+purchase\s+agreement|equity\s+purchase\s+agreement|share\s+subscription\s+facility|purchase\s+facility|\bsepa\b)/i.test(c)) {
      let counterparty: string | null = null;
      let maxCommitment: number | null = null;
      let pricing: string | null = null;
      let ownershipCap: number | null = null;
      // Counterparty: capitalized entity name ending in LLC/Inc/Capital/Global/Yield.
      const cp = c.match(/(?:with|by)\s+([A-Z][A-Za-z0-9&.,'\s]{3,40}?(?:LLC|Inc|Ltd|Capital|Partners|Global|CS|Yield)[A-Za-z]{0,15})/);
      if (cp) counterparty = cp[1].trim().replace(/\s+/g, ' ');
      const mc = c.match(/\$\s*([\d,.]+\s*(?:million|billion|thousand)?)/i);
      if (mc) maxCommitment = scaleMoney(mc[1]);
      if (/vwap|volume[\s-]?weighted/i.test(c)) pricing = 'VWAP-based';
      const oc = c.match(/([\d.]+)\s*(?:%|percent)[^.]{0,30}?(?:beneficial|ownership|outstanding)/i);
      if (oc) ownershipCap = parseFloat(oc[1]);
      if (counterparty != null || maxCommitment != null) {
        equityLines.push({ description: c, counterparty, maxCommitment, pricing, ownershipCap });
      }
    }
    void DATE; void YEAR;
  }

  // Going-concern language — scan the FULL text (not clause-split) since the
  // phrasing spans sentences. Extract ~400 chars around the first hit.
  let goingConcern: GoingConcern = { present: false, text: null };
  const gc = text.match(/[A-Z][^.]{0,60}?(?:substantial doubt about(?:	s+its)? ability to continue as a going concern|going concern qualification|ability to continue as a going concern)[^.]{0,400}/i);
  if (gc) goingConcern = { present: true, text: gc[0].trim().replace(/\s+/g, ' ').slice(0, 500) };

  // De-dup by description (note tables repeat clauses).
  const dedup = <T extends { description: string }>(arr: T[]): T[] => {
    const seen = new Set<string>();
    return arr.filter((r) => {
      const k = r.description.slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    warrantNotesParsed: true,
    warrants: dedup(warrants).slice(0, 6),
    convertibles: dedup(convertibles).slice(0, 6),
    equityLines: dedup(equityLines).slice(0, 6),
    goingConcern,
    source: `10-K ${accessionNo}`,
    parsedAt: new Date().toISOString().slice(0, 10),
  };
}

export interface SyncWarrantNotesResult {
  status: 'success' | 'error';
  parsed: number;
  withDetail: number;
  error?: string;
}

/** Fetch + parse warrant/convertible detail from the latest 10-K AND recent
 *  10-Qs. Outstanding tranches are often first disclosed in a 10-Q footnote
 *  (VWAV: $11.5 SPAC + $9 Feb-2026 warrants appear in 10-Q, not the older
 *  10-K). Idempotent per filing via the warrantNotes flag. */
export async function syncWarrantNotes(
  cik: string,
  opts?: { force?: boolean },
): Promise<SyncWarrantNotesResult> {
  const force = opts?.force === true;
  try {
    const filings = await prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: ['10-K', '10-Q'] } },
      orderBy: { filingDate: 'desc' },
      take: 4, // latest 10-K + latest few 10-Qs
      select: { accessionNo: true, primaryDoc: true, rawPayload: true },
    });
    let parsed = 0;
    let withDetail = 0;
    for (const filing of filings) {
      if (!filing.primaryDoc) continue;
      const existing = (filing.rawPayload ?? null) as { warrantNotes?: ParsedWarrantNotes } | null;
      // Idempotent: skip re-parsing filings already parsed, UNLESS force=true
      // (used to propagate parser fixes — e.g. the shares-regex broadening —
      // across already-synced tickers via resync-universe.cjs).
      if (existing?.warrantNotes && !force) {
        withDetail += existing.warrantNotes.warrants.length + existing.warrantNotes.convertibles.length;
        continue;
      }
      let html: string;
      try {
        const res = await secFetchResponse(filingUrl(cik, filing.accessionNo, filing.primaryDoc), 'text/html');
        if (!res.ok) continue;
        html = await res.text();
      } catch {
        continue;
      }
      const notes = parseWarrantNotesHtml(html, filing.accessionNo);
      const detail = notes.warrants.length + notes.convertibles.length;
      await prisma.dilutionFiling.update({
        where: { accessionNo: filing.accessionNo },
        data: { rawPayload: { ...(existing ?? {}), warrantNotes: notes } },
      });
      parsed++;
      withDetail += detail;
    }
    return { status: 'success', parsed, withDetail };
  } catch (err) {
    return { status: 'error', parsed: 0, withDetail: 0, error: err instanceof Error ? err.message : 'warrant-notes sync failed' };
  }
}

/** Read + MERGE parsed warrant/convertible detail across the latest 10-K +
 *  10-Qs (no SEC call). The same tranche is restated in successive filings;
 *  dedup by shares+strike so the table shows each tranche once. */
export async function getWarrantNotes(cik: string): Promise<ParsedWarrantNotes | null> {
  const filings = await prisma.dilutionFiling.findMany({
    where: { cik, formType: { in: ['10-K', '10-Q'] }, rawPayload: { path: ['warrantNotes'], not: null } },
    orderBy: { filingDate: 'desc' },
    take: 3,
    select: { rawPayload: true },
  });
  if (!filings.length) return null;
  const seenW = new Map<string, WarrantNoteRow>();
  const seenC = new Map<string, ConvertibleNoteRow>();
  const seenE = new Map<string, EquityLineNoteRow>();
  let source = '';
  let gc: GoingConcern = { present: false, text: null };
  for (const f of filings) {
    const n = (f.rawPayload ?? null) as { warrantNotes?: ParsedWarrantNotes } | null;
    const wn = n?.warrantNotes;
    if (!wn) continue;
    if (!source) source = wn.source;
    if (wn.goingConcern?.present) gc = wn.goingConcern;
    for (const w of wn.warrants) {
      const k = `${w.shares}|${w.exercisePrice}`;
      if (!seenW.has(k)) seenW.set(k, w);
    }
    for (const c of wn.convertibles) {
      const k = `${c.principal}|${c.conversionPrice}`;
      if (!seenC.has(k)) seenC.set(k, c);
    }
    for (const e of wn.equityLines) {
      const k = `${e.counterparty}|${e.maxCommitment}`;
      if (!seenE.has(k)) seenE.set(k, e);
    }
  }
  return {
    warrantNotesParsed: true,
    warrants: [...seenW.values()],
    convertibles: [...seenC.values()],
    equityLines: [...seenE.values()],
    goingConcern: gc,
    source,
    parsedAt: new Date().toISOString().slice(0, 10),
  };
}
