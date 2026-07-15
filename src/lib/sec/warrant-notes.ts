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
  // 'active' = outstanding dilution; 'redeemed' = exchanged/settled/no longer
  // outstanding — excluded from active overhang, shown as history only.
  status: 'active' | 'redeemed';
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
function extractWarrantScheduleTable(text: string, filingDate?: Date | null): WarrantNoteRow[] | null {
  const headerIdx = text.search(
    /schedule\s+of\s+(?:the\s+)?(?:company'?s\s+)?warrants?\s+outstanding|schedule\s+of\s+(?:the\s+)?(?:company'?s\s+)?outstanding\s+warrants|following\s+warrants\s+(?:were\s+)?outstanding/i,
  );
  if (headerIdx < 0) return null;
  const block = text.slice(headerIdx, headerIdx + 3000)
    .split(/schedule\s+of\s+warrants\s+activity|the\s+following\s+table\s+shows|warrant\s+activity/i)[0];
  // Row: "<Type> Warrants <shares> $<price> <expiration>"
  // Price is matched LAZILY because HTML table-cell merging fuses price+date
  // without spaces ('$14,329.4709/09/27'). Expiration can be date/-/None/*/n/a.
  const re = /([A-Za-z][A-Za-z0-9 ()/.,'\-]{1,40}?[Ww]arrants?)\s+([\d,]+)\s+\$\s*([\d,.]+?)\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|none|-|\*|n\/a)/gi;
  const rows: WarrantNoteRow[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    // Strip leading classification column values that bleed into next row's type.
    let type = m[1].trim();
    for (const prefix of ['Equity', 'Liability', 'Total']) {
      if (type.startsWith(prefix + ' ')) { type = type.slice(prefix.length + 1); break; }
    }
    const shares = parseInt(m[2].replace(/,/g, ''), 10);
    const price = parseFloat(m[3].replace(/,/g, ''));
    if (isNaN(shares) || shares < 50 || isNaN(price)) continue;

    // Expiration: date from table, perpetual for None/-, or enrich from footnote.
    let expiry: string | null = null;
    const expRaw = m[4].trim().toLowerCase();
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(m[4])) {
      expiry = m[4].trim();
    } else if (expRaw === 'none' || expRaw === '-') {
      expiry = 'perpetual';
    }
    // When table shows '-'/'*'/'None', search for expire-language footnote.
    if (!expiry || expiry === 'perpetual') {
      const escType = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fm = text.match(new RegExp(
        `(?:\\*|${escType})[^.]{0,30}?${escType}[^.]{0,100}?expir[^.]{0,120}`, 'i'));
      if (fm) {
        const dm = fm[0].match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
        if (dm) {
          expiry = dm[1];
        } else if (filingDate) {
          const yr = fm[0].match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]?years?/i);
          if (yr) {
            const yrs = /^\d+$/.test(yr[1]) ? parseInt(yr[1], 10) : (WORD_YEARS[yr[1].toLowerCase()] ?? null);
            if (yrs) {
              const d = new Date(filingDate);
              d.setFullYear(d.getFullYear() + yrs);
              expiry = d.toISOString().slice(0, 10);
            }
          }
        }
      }
    }

    // Enrich exercisable from prose (table row has no exercisable clause).
    let exercisableDate: string | null = null;
    let searchFrom = 0;
    while (exercisableDate == null) {
      const sIdx = text.indexOf(type, searchFrom);
      if (sIdx < 0) break;
      const ctx = text.slice(Math.max(0, sIdx - 150), sIdx + 250);
      const ed = ctx.match(/exercisable(?:\s+(?:commencing|beginning|on|until))?\s+(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ed) exercisableDate = ed[1];
      else if (/(?:immediately|upon\s+issuance|as\s+of\s+issuance)\s+exercisable|exercisable\s+(?:immediately|upon\s+issuance|as\s+of\s+issuance)/i.test(ctx)) exercisableDate = 'immediately';
      searchFrom = sIdx + 1;
    }

    rows.push({
      description: `${type} — ${shares.toLocaleString()} sh @ $${price}${expiry ? ', exp ' + expiry : ''}`,
      shares, exercisePrice: price, expiry, exercisableDate,
    });
  }
  return rows.length ? rows : null;
}

/** Assemble per-instrument convertible note detail from 10-K narrative.
 *  Unlike warrants (which live in schedule tables), convertibles appear as
 *  issuance PROSE: principal stated in one clause, conversion price + maturity
 *  in the next 1–3 clauses. The clause-splitter emits these as separate rows and
 *  grabs the price as "principal" (e.g. NVVE: $80.8 conversion price shown as
 *  principal). This pass anchors on each "convertible note" mention, scans a
 *  ~1500-char window for principal + price + maturity, and emits ONE row per note.
 *  WINDOWED (not global) so it can't catastrophically backtrack on the multi-MB
 *  complete-submission .txt fallback. Returns null when nothing is found. */
function extractConvertibleDetail(text: string, filingDate?: Date | null): ConvertibleNoteRow[] | null {
  void filingDate;
  const NOISE_RE = /\b(?:interest\s+expense|(?:decrease|increase)\s+in\s+interest|change\s+in\s+fair\s+value|recorded[^.]{0,30}?in\s+income|operating\s+lease|lease\s+liabilit|(?:gain|loss)\s+on\s+(?:the\s+)?(?:conversion|exchange|extinguish|settlement))\b/i;
  const REDEEMED_RE = /\b(?:no\s+longer(?:\s+\w+){0,4}\s+outstanding|prior\s+to\s+(?:the\s+)?(?:exchange|redempt|repay|settl|extinguish)|exchange[d]?\s+agreement|exchange[d]?\s+(?:the\s+)?(?:convertible|notes)|\bredeemed\b|\brepaid\b|\brepurchas|\bretired\b|\bsettled\b|\bextinguis|was\s+comprised\s+of|converted\s+(?:into|to)\s+(?:shares\s+of\s+)?common)\b/i;

  const rows: ConvertibleNoteRow[] = [];
  const seen = new Set<string>();
  // Anchor on each "convertible note/debenture" mention — cheap single pass.
  const reCN = /convertible\s+(?:notes?|debentures?|promissory\s+notes?|preferred\s+notes?)/gi;
  let m: RegExpExecArray | null;
  while ((m = reCN.exec(text))) {
    const win = text.slice(Math.max(0, m.index - 600), m.index + 900);
    if (NOISE_RE.test(win)) continue;

    // Principal in window: "principal [amount] [of] $N" (principal-led) OR
    // "$N [million] of [Senior] Convertible Notes" (value-led). Take the LARGEST
    // principal figure in the window so a footnote total wins over a partial.
    let principal: number | null = null;
    const prA = win.match(/(?:aggregate\s+)?principal\s+(?:amount\s+)?(?:of\s+|equal\s+to\s+)?\$?\s*([\d,]+(?:\.\d+)?)\s*(million|billion|thousand)?/i);
    const prB = win.match(/\$?\s*([\d,]+(?:\.\d+)?)\s*(million|billion)\s+(?:of\s+)?(?:the\s+)?(?:aggregate\s+)?(?:principal\s+(?:amount\s+)?(?:of\s+)?)?(?:[A-Z][\w'-]*\s+){0,3}(?:convertible|senior)\s+[\w\s'-]{0,18}?\bnotes?\b/i);
    for (const cand of [prA, prB]) {
      if (!cand) continue;
      const p = scaleMoney(cand[1] + (cand[2] ? ' ' + cand[2] : ''));
      if (p == null || p < 1000) continue;
      if (principal == null || p > principal) principal = p;
    }
    if (principal == null) continue; // no real principal here — not an issuance mention

    // Conversion price ("conversion price of $Y", "price per share of $Y",
    // "convertible ... at $Y per share"). Discount phrasing ("62% of...") → null.
    let conversionPrice: number | null = null;
    const cp = win.match(/conversion\s+price\s+(?:of\s+|equal\s+to\s+|was\s+changed\s+to\s+)?\$?\s*([\d,.]+)/i)
      ?? win.match(/(?:fixed\s+)?(?:conversion\s+)?price\s+per\s+share\s+(?:of\s+|equal\s+to\s+)?\$?\s*([\d,.]+)/i)
      ?? win.match(/convertible(?:[^.]{0,45}?)at\s+(?:a\s+)?(?:fixed\s+)?\$?\s*([\d,.]+)\s*(?:per\s+share)?/i);
    if (cp) conversionPrice = scaleMoney(cp[1]);

    // Maturity ("maturity date of <DATE>", "due <DATE/Year>").
    let maturity: string | null = null;
    const mt = win.match(/matur(?:e|ity)(?:\s+date)?(?:\s+(?:of|on|in))?\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4})/i)
      ?? win.match(/matur(?:e|ity)(?:\s+date)?(?:\s+(?:of|on|in))?\s+(\d{4})/i)
      ?? win.match(/\bdue\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4})/i)
      ?? win.match(/\bdue\s+(\d{4})/i);
    if (mt) maturity = mt[1];

    const k = `${principal}|${conversionPrice}|${maturity}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const status: 'active' | 'redeemed' = REDEEMED_RE.test(win) ? 'redeemed' : 'active';
    rows.push({
      description: win.slice(win.indexOf('convertible') < 0 ? 0 : Math.max(0, win.indexOf('convertible') - 40), 130).replace(/\s+/g, ' ').trim(),
      principal, maturity, conversionPrice, status,
    });
  }
  return rows.length ? rows.slice(0, 12) : null;
}

const WORD_YEARS: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 };

export function parseWarrantNotesHtml(html: string, accessionNo: string, filingDate?: Date | null): ParsedWarrantNotes {
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
      // Expiry: absolute date — widened window from [^.]{0,30} to [\s\S]{0,60}
      // because warrant terms span sentence boundaries (the period-split clause
      // boundary truncates the match before the date appears).
      const ex = c.match(/expir(?:e|es|ing|ation|y)[\s\S]{0,60}?(?:on)?\s*([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ex) expiry = ex[1];
      // Perpetual / no-expiry warrants: "did not expire until exercised in
      // full". Mark as perpetual so the table shows it instead of null.
      if (!expiry && /expir(?:e|es|ing)?[^.]{0,20}?(?:until|upon)\s+(?:exercis|the\s+earlier)|no\s+expir|without\s+expir/i.test(c)) {
        expiry = 'perpetual';
      }
      // Expiry: relative term — "for five years", "expiring five years after",
      // "term of N years", "five-year anniversary of [issuance]". Compute from
      // filing date. Without this, ALL relative-term warrants show null expiry.
      if (!expiry && filingDate) {
        const yr = c.match(/(?:for|term\s+of|expir(?:e|es|ing|ation|y)[\s\S]{0,20}?(?:after)?|following|anniversary\s+of)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?/i)
          ?? c.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\s+from\s+/i)
          // Hyphenated anniversary: "five-year anniversary of the issuance date"
          ?? c.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]year(?:s)?\s+anniversary/i);
        if (yr) {
          const yrs = /^\d+$/.test(yr[1]) ? parseInt(yr[1], 10) : (WORD_YEARS[yr[1].toLowerCase()] ?? null);
          if (yrs) {
            const d = new Date(filingDate);
            d.setFullYear(d.getFullYear() + yrs);
            expiry = d.toISOString().slice(0, 10);
          }
        }
      }
      const ed = c.match(/exercisable(?:\s+(?:commencing|beginning|on|until))?\s+(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (ed) exercisableDate = ed[1];
      else if (/(?:immediately|upon\s+issuance|as\s+of\s+issuance)\s+exercisable|exercisable\s+(?:immediately|upon\s+issuance|as\s+of\s+issuance)/i.test(c)) exercisableDate = 'immediately';

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

      // Negative-status filter: a clause mentioning converts + a $ figure isn't
      // always an outstanding instrument. Drop pure accounting noise (interest-
      // expense discussion, fair-value income entries, operating-lease tables)
      // and mark exchanged/redeemed/no-longer-outstanding converts 'redeemed' so
      // they're excluded from active overhang but still visible as history.
      // Without this, ERNA shows ~$18M phantom convert dilution for a name that
      // exchanged all its notes in 2024.
      const NOISE_RE = /\b(?:interest\s+expense|(?:decrease|increase)\s+in\s+interest|change\s+in\s+fair\s+value|recorded(?:\s+(?:approximately|a|an)?\s*\$?[\d,.]+\s*(?:million|billion)?)?\s+in\s+income|operating\s+lease|lease\s+liabilit|(?:gain|loss)\s+on\s+(?:the\s+)?(?:conversion|exchange|extinguish))\b/i;
      const REDEEMED_RE = /\b(?:no\s+longer(?:\s+\w+){0,4}\s+outstanding|prior\s+to\s+(?:the\s+)?(?:exchange|redempt|repay|settl|extinguish)|exchange[d]?\s+agreement|exchange[d]?\s+(?:the\s+)?(?:convertible|notes)|\bredeemed\b|\brepaid\b|\brepurchas|\bretired\b|\bsettled\b|\bextinguis|was\s+comprised\s+of|converted\s+(?:into|to)\s+(?:shares\s+of\s+)?common\s+stock)\b/i;
      const isNoise = NOISE_RE.test(c);
      const isRedeemed = !isNoise && REDEEMED_RE.test(c);
      if (!isNoise && (principal != null || maturity != null || conversionPrice != null)) {
        convertibles.push({ description: c, principal, maturity, conversionPrice, status: isRedeemed ? 'redeemed' : 'active' });
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
  const tableWarrants = extractWarrantScheduleTable(text, filingDate);
  // Prefer assembled convertible detail (principal + price + maturity per note)
  // over the per-clause prose rows, which split a note across clauses and grab
  // the conversion price as "principal".
  const tableConverts = extractConvertibleDetail(text, filingDate);

  return {
    warrantNotesParsed: true,
    warrants: dedup(tableWarrants ?? warrants).slice(0, 12),
    convertibles: dedup(tableConverts ?? convertibles).slice(0, 12),
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
    // Latest 10-K (annual note schedules — the authoritative warrant/convert
    //    tranche list) PLUS latest few 10-Qs (new facilities surface there
    //    first). Recent 10-Qs can crowd the 10-K out of a plain `take`, so
    //    fetch them separately and merge by accessionNo.
    const [latest10K, recent10Q] = await Promise.all([
      prisma.dilutionFiling.findFirst({
        where: { cik, formType: '10-K' },
        orderBy: { filingDate: 'desc' },
        select: { accessionNo: true, primaryDoc: true, filingDate: true, rawPayload: true },
      }),
      prisma.dilutionFiling.findMany({
        where: { cik, formType: '10-Q' },
        orderBy: { filingDate: 'desc' },
        take: 3,
        select: { accessionNo: true, primaryDoc: true, filingDate: true, rawPayload: true },
      }),
    ]);
    const seenAcc = new Set<string>();
    const filings = [latest10K, ...recent10Q].filter((f): f is NonNullable<typeof f> => {
      if (!f || seenAcc.has(f.accessionNo)) return false;
      seenAcc.add(f.accessionNo);
      return true;
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
        (html) => parseWarrantNotesHtml(html, filing.accessionNo, filing.filingDate),
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
      const k = w.shares != null ? `${w.shares}` : `x|${w.exercisePrice ?? '?'}`;
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
