/**
 * S-3 / S-3ASR shelf-registration parser → registration detail on
 * DilutionFiling.rawPayload.
 *
 * A shelf registration is the PIPELINE of FUTURE potential dilution: the max
 * dollar amount the company has registered to sell over time. S-3ASR (automatic
 * shelf) is immediate — only large seasoned filers (WKSI) qualify; it is the
 * most aggressive. AskEdgar's `registrations` endpoint surfaces exactly this.
 *
 * Unlike 424B5 offerings (the actual DRAW), a shelf is CAPACITY. An S-3 may be
 * drawn later via 424B5, or never. So this is "potential dilution overhang",
 * distinct from offerings.
 *
 * Extraction (cover-scoped, first ~10k stripped chars — the explanatory note /
 * summary that names the registered amount):
 *   - aggregateOffering:  max $ registered ("aggregate offering price of up to $N")
 *   - shelfType:          'automatic-shelf' (S-3ASR) | 'shelf' (S-3/S-3/A) | 'foreign' (F-3)
 *   - salesChannel:       'atm' | 'underwritten' | 'best-efforts' | null
 *   - agent:              named placement/sales agent if present
 *   - securitiesTypes:    which classes registered (common/preferred/warrants/debt/units)
 *
 * Ground-truth verified 2026-06-27:
 *   SOUN S-3ASR  → $300,000,000, automatic-shelf, delayed/continuous
 *   FFAI S-3     → $90,000,000, atm, agent AGP/Maxim
 */
import { prisma } from '@/lib/prisma';
import { fetchAndParseFiling } from '@/lib/sec/client';

export const REGISTRATION_FORMS = ['S-3', 'S-3ASR', 'S-3/A', 'F-3', 'F-3/A', 'S-1', 'S-1/A'];
const REGISTRATION_WINDOW = 30;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const SCALE: Record<string, number> = {
  million: 1e6, billion: 1e9, thousand: 1e3, trillion: 1e12,
};
function scaleMoney(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand|trillion)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return null;
  return num * (m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1);
}

export interface ParsedRegistration {
  aggregateOffering: number | null; // max $ registered on the shelf
  shelfType: 'automatic-shelf' | 'shelf' | 'foreign' | 'unknown';
  salesChannel: 'atm' | 'underwritten' | 'best-efforts' | 'resale' | null;
  agent: string | null;
  securitiesTypes: string[]; // ['common stock','warrants','debt',...]
}

export function parseRegistrationHtml(html: string, formType: string): ParsedRegistration {
  // SEC HTML often splits numbers with stray spaces (PDF→HTML artifacts):
  // '$ 5 0,000,000' instead of '$50,000,000'. Collapse '$ ' → '$' and join
  // digit-space-digit so amount regexes match. Without this, shelves register
  // null (the 'cant tell whats available' bug).
  const text = stripHtml(html).replace(/\$\s+/g, '$').replace(/(\d)\s+(?=\d)/g, '$1');
  // The registered amount lives in the explanatory note / summary (first ~10k chars).
  const cover = text.slice(0, 10000);
  const coverLower = cover.toLowerCase();

  // Aggregate $ registered — the key signal. "aggregate offering price of up to $N".
  // Several phrasings; take the largest plausible hit (shelves register a MAX).
  let aggregate: number | null = null;
  for (const re of [
    /aggregate (?:offering price|principal amount)(?:\s+of)?\s+(?:up to\s+)?a?\s*(?:maximum\s+)?(?:aggregate\s+)?(?:offering price\s+of\s+)?\$([\d,.]+\s*(?:million|billion|thousand)?)/i,
    /(?:maximum\s+aggregate|up to a maximum aggregate)\s+offering price(?:\s+of)?\s+\$([\d,.]+\s*(?:million|billion|thousand)?)/i,
    /offering.{0,30}?\$([\d,.]+\s*(?:million|billion|thousand)?)\s+(?:of|aggregate)/i,
    // "offer up to $N of our common stock" / "we may offer $N" — verb form.
    /(?:offer|offering)s?\s+(?:up\s+to\s+)?a?\s*\$([\d,.]+\s*(?:million|billion|thousand)?)/i,
    // Cover-page table: "$100,000,000 Common Stock Preferred Stock Warrants..."
    // — bare amount immediately followed by registered securities classes.
    /\$([\d,.]+\s*(?:million|billion)?)\s+(?:Common\s+Stock|Preferred\s+Stock|Warrants?|Debt\s+Securities|Units|Securities|Shares)\b/i,
  ]) {
    const m = cover.match(re);
    if (m) {
      const v = scaleMoney(m[1]);
      // Magnitude floor ≥ $1M: rejects par-value noise ($0.0001–$0.01) which the
      // verb/cover patterns would otherwise match as the registered amount.
      if (v && v >= 1e6) { aggregate = Math.max(aggregate ?? 0, v); }
    }
  }

  // Shelf type — FORM-DRIVEN (authoritative). Only S-3ASR is an automatic
  // shelf; a plain S-3 must NOT be promoted via cover keywords (boilerplate
  // cross-references like 'pursuant to an automatic shelf registration'
  // otherwise mis-tag non-WKSI shelves as WKSI, breaking baby-shelf detection).
  const f = formType.toUpperCase();
  let shelfType: ParsedRegistration['shelfType'] = 'unknown';
  if (f === 'S-3ASR') shelfType = 'automatic-shelf';
  else if (f.startsWith('F-3') || f.startsWith('F-1')) shelfType = 'foreign';
  else if (f.startsWith('S-3') || f.startsWith('S-1')) shelfType = 'shelf';

  // Sales channel — note: on an S-3, "at the market"/"sales agreement" IS the
  // legitimate signal (the shelf literally registers the ATM facility), unlike
  // 424B5 where bare mentions are noise. Still scope to cover.
  let salesChannel: ParsedRegistration['salesChannel'] = null;
  if (/\bat-the-market\b|\bat the market\b|\bsales agreement\b|\bequity distribution agreement\b/i.test(coverLower))
    salesChannel = 'atm';
  else if (/underwriter|firm commitment|underwritten/i.test(coverLower)) salesChannel = 'underwritten';
  else if (/best[\s-]?efforts/i.test(coverLower)) salesChannel = 'best-efforts';
  else if (/selling securityholder|\bresale\b/i.test(coverLower)) salesChannel = 'resale';

  // Named agent — "with [Agent]" / "as sales agent" / "placement agent".
  // Reject generic fragments ("one or more", "certain of") that match the pattern.
  let agent: string | null = null;
  const GENERIC_AGENT = /^(one or more|certain|various|several|the|such|other|a number of)\b/i;
  const ag =
    cover.match(/(?:with|by)\s+([A-Z][A-Za-z0-9.&\s]{2,40}?)\s+(?:as\s+)?(?:sales agent|placement agent|underwriter|agent)/i) ||
    cover.match(/(sales agreement|equity distribution agreement).{0,40}?(?:with|by)\s+([A-Z][A-Za-z0-9.&\s]{2,40}?)[.,]/i);
  if (ag) {
    const name = (ag[2] ?? ag[1]).trim();
    if (!GENERIC_AGENT.test(name)) agent = name;
  }

  // Securities types registered — breadth of potential dilution.
  const securitiesTypes: string[] = [];
  if (/common stock|ordinary shares/i.test(cover)) securitiesTypes.push('common stock');
  if (/preferred stock/i.test(cover)) securitiesTypes.push('preferred stock');
  if (/\bwarrants?\b/i.test(cover)) securitiesTypes.push('warrants');
  if (/debt securities|notes|bonds/i.test(cover)) securitiesTypes.push('debt');
  if (/\bunits\b/i.test(cover)) securitiesTypes.push('units');

  return { aggregateOffering: aggregate, shelfType, salesChannel, agent, securitiesTypes };
}

export interface SyncRegistrationsResult {
  status: 'success' | 'error';
  parsed: number;
  withDetail: number;
  error?: string;
}

/** Query recent shelf filings, fetch + parse each, store detail on rawPayload.
 *  Idempotent per filing unless force=true (re-parse to pick up parser fixes). */
export async function syncRegistrations(cik: string, opts: { force?: boolean } = {}): Promise<SyncRegistrationsResult> {
  try {
    const filings = await prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: REGISTRATION_FORMS } },
      orderBy: { filingDate: 'desc' },
      take: REGISTRATION_WINDOW,
      select: { accessionNo: true, formType: true, primaryDoc: true, rawPayload: true },
    });

    let withDetail = 0;
    let parsed = 0;
    for (const f of filings) {
      if (!f.primaryDoc) continue;
      const existing = (f.rawPayload ?? null) as { registrationParsed?: boolean } | null;
      if (existing?.registrationParsed && !opts.force) {
        withDetail++;
        continue; // idempotent
      }
      const r = await fetchAndParseFiling(
        cik,
        f.accessionNo,
        f.primaryDoc,
        (html) => parseRegistrationHtml(html, f.formType),
        (result) => result.aggregateOffering === null && result.salesChannel === null && result.securitiesTypes.length === 0,
      );
      parsed++;
      // Nothing extractable (some S-3 are pre-effective amendments with no amount) — skip.
      if (!r || (r.aggregateOffering === null && r.salesChannel === null && r.securitiesTypes.length === 0)) continue;
      await prisma.dilutionFiling.update({
        where: { accessionNo: f.accessionNo },
        data: {
          rawPayload: { ...(existing ?? {}), registrationParsed: true, ...r },
        },
      });
      withDetail++;
    }

    return { status: 'success', parsed, withDetail };
  } catch (error) {
    return {
      status: 'error',
      parsed: 0,
      withDetail: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
