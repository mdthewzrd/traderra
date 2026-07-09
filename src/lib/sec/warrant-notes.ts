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
import { fetchAndParseFiling } from '@/lib/sec/client';

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

/** Extract the "Schedule of outstanding warrants" summary table — the
 *  authoritative per-tranche list (type, shares, strike, expiry). This table
 *  appears in most 10-Ks with warrants and is FAR more complete than prose
 *  clause extraction, which misses expiry/exercisable split across sentences.
 *  Returns null when no schedule table is found (caller falls back to prose). */
function extractWarrantScheduleTable(text: string): WarrantNoteRow[] | null {
  const headerIdx = text.search(/(schedule\s+of\s+(?:the\s+)?(?:company'?s\s+)?outstanding\s+warrants|outstanding\s+warrants\s+(?:as\s+of|is\s+as\s+follows))/i);
  if (headerIdx < 0) return null;
  const block = text.slice(headerIdx, headerIdx + 3000);
  // Row: "<Type> Warrants <shares> $<price> <issuance M/D/Y> <expiry M/D/Y>"
  const re = /([A-Za-z][A-Za-z ()/.\-]{1,40}?Warrants)\s+([\d,]+(?:\.\d+)?)\s+\$\s*([\d,.]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g;
  const rows: WarrantNoteRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const type = m[1].trim().replace(/^(?:.*(?:Expiration Date|Issuance Date|Exercise Price)\s+)/i, '');
    const shares = parseInt(m[2].replace(/,/g, ''), 10);
    const price = parseFloat(m[3].replace(/,/g, ''));
    if (isNaN(shares) || shares < 50) continue;
    // Enrich exercisable: scan ALL occurrences of this series (the table row
    // itself has no exercisable clause; the discussion appears in prose elsewhere).
    let exercisableDate: string | null = null;
    let searchFrom = 0;
    while (exercisableDate == null) {
      const sIdx = text.indexOf(type, searchFrom);
      if (sIdx < 0) break;
      const ctx = text.slice(Math.max(0, sIdx - 150), sIdx + 250);
      const ed = ctx.match(/exercisable(?:\s+(?:commencing|beginning|on|until))?\s+(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ed) exercisableDate = ed[1];
      else if (/exercisable\s+(?:immediately|upon\s+issuance|as\s+of\s+issuance)|immediately\s+exercisable/i.test(ctx)) exercisableDate = 'immediately';
      searchFrom = sIdx + 1;
    }
    rows.push({ description: `${type} — ${shares.toLocaleString()} sh @ $${price}, issued ${m[4]}, expires ${m[5]}`, shares, exercisePrice: price, expiry: m[5], exercisableDate });
  }
  return rows.length ? rows : null;
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

      // Flexible share-count extraction: a warrant clause keyword, then the
      // number (possibly with 'up to' / 'an aggregate of' filler on either
      // side), then 'shares'. Lookbehind rejects a $-prefixed price; the
      // >=100 filter drops small false positives (e.g. 'five years').
      const sh = c.match(/\b(?:purchase|aggregate|exercisable|represent|issued)\b[\s\S]{0,60}?(?<![\d.$])([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?[\s\S]{0,30}?\bshares?\b/i);
      if (sh) {
        const v = scaleShares(sh[1]);
        if (v != null && v >= 100) shares = v;
      }
      const ep = c.match(/exercise\s+price\s+of\s+(?:\$\s*)?([\d,.]+)/i)
        ?? c.match(/(?:at|of)\s+(?:a\s+)?(?:price\s+of\s+)?\$\s*([\d,.]+)\s+per\s+share/i)
        ?? c.match(/\$\s*([\d,.]+)\s+per\s+share[^.]{0,20}?exercis/i)
        ?? c.match(/\$\s*([\d,.]+)\s+per\s+share/i);
      if (ep) exercisePrice = scaleMoney(ep[1]);
      const ex = c.match(/expir(?:e|es|ing|ation|y)[^.]{0,30}?(?:on)?\s*([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ex) expiry = ex[1];
      const ed = c.match(/exercisable(?:\s+(?:commencing|beginning|on|until))?\s+(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ed) exercisableDate = ed[1];
      else if (/exercisable\s+(?:immediately|upon\s+issuance|as\s+of\s+issuance)/i.test(c)) exercisableDate = 'immediately';

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

  // Prefer the warrant SCHEDULE TABLE (complete: shares+strike+expiry per
  // tranche) over prose clauses when present. Prose misses expiry because the
  // sentence-splitter can't join detail spread across clauses.
  const tableWarrants = extractWarrantScheduleTable(text);

  return {
    warrantNotesParsed: true,
    warrants: dedup(tableWarrants ?? warrants).slice(0, 12),
    convertibles: dedup(convertibles).slice(0, 12),
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
      const notes = await fetchAndParseFiling(
        cik,
        filing.accessionNo,
        filing.primaryDoc,
        (html) => parseWarrantNotesHtml(html, filing.accessionNo),
        (n) => n.warrants.length === 0 && n.convertibles.length === 0,
      );
      if (!notes) continue; // primary + .txt both failed — leave unmarked, retry later
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
  // Detect an authoritative schedule TABLE (>=3 warrants carry expiry) in the
  // newest filing. When present, treat it as the complete warrant list and
  // ignore prose-only restatements from older 10-Qs — those restate the same
  // tranches without expiry, creating noise duplicates (LUCY: 22 rows → 11).
  let authoritativeWarrantSet: WarrantNoteRow[] | null = null;
  for (const f of filings) {
    const n0 = (f.rawPayload ?? null) as { warrantNotes?: ParsedWarrantNotes } | null;
    const wn0 = n0?.warrantNotes;
    if (wn0 && (wn0.warrants ?? []).filter((w) => w.expiry).length >= 3) {
      authoritativeWarrantSet = wn0.warrants ?? [];
      break;
    }
  }
  for (const f of filings) {
    const n = (f.rawPayload ?? null) as { warrantNotes?: ParsedWarrantNotes } | null;
    const wn = n?.warrantNotes;
    if (!wn) continue;
    if (!source) source = wn.source;
    if (wn.goingConcern?.present) gc = wn.goingConcern;
    // When an authoritative table exists, only ingest warrants FROM that filing;
    // skip prose warrants from other filings (restatements without expiry).
    if (authoritativeWarrantSet && wn.warrants !== authoritativeWarrantSet) {
      // still fall through to convertibles/equityLines below
    } else {
    for (const w of wn.warrants ?? []) {
      // Dedup by shares alone (the same tranche is restated across filings
      // and within a clause the share price often bleeds in as a false strike —
      // e.g. CLRO '437,500 shares at $4.00 ... warrant ... at $5.00'. Keying on
      // shares+strike would keep both. Key on shares; on collision keep the
      // HIGHER strike (warrant exercise prices exceed the concurrent share price,
      // so max filters out the share-price bleed). null strike = lowest.
      const k = `${w.shares ?? 'x'}`;
      const cur = seenW.get(k);
      if (!cur) seenW.set(k, w);
      else {
        const a = w.exercisePrice ?? -Infinity;
        const b = cur.exercisePrice ?? -Infinity;
      if (a > b || (a === b && (cur.expiry == null && w.expiry != null))) seenW.set(k, w);
      }
    }
    }
    for (const c of wn.convertibles ?? []) {
      const k = `${c.principal}|${c.conversionPrice}`;
      if (!seenC.has(k)) seenC.set(k, c);
    }
    for (const e of wn.equityLines ?? []) {
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
