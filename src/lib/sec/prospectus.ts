/**
 * 424Bx prospectus supplement parser → offering detail (DilutionFiling.rawPayload).
 *
 * This is the ACTUAL dilution event: shares sold, price, gross proceeds, ATM vs
 * underwritten. AskEdgar's `offerings` endpoint surfaces exactly this. Stored on
 * rawPayload (Json) — no schema change. Idempotent via an `offeringParsed` flag.
 *
 * Prospectuses are HTML prose → strip tags, then regex. Numbers may be numeric
 * ("5,000,000") or spelled out ("5 million") — normalized both ways.
 */
import { prisma } from '@/lib/prisma';
import { fetchAndParseFiling } from '@/lib/sec/client';

export const OFFERING_FORMS = ['424B1', '424B3', '424B4', '424B5', '424B7', '424B8'];
const PROSPECTUS_WINDOW = 40;

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

function scaleNum(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand|trillion)?/i);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return null;
  const scale = m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1;
  return num * scale;
}

export interface WarrantTranche {
  shares: number | null;
  strike: number | null;
  expiry: string | null;
  exercisable: string | null;
  description: string;
}

export interface ParsedOffering {
  sharesOffered: number | null;
  pricePerShare: number | null;
  grossProceeds: number | null;
  offeringType: string; // 'atm' | 'underwritten' | 'best-efforts' | 'unknown'
  underwriter: string | null;
  // Per-warrant tranches registered in this offering (shares/strike/expiry/exercisable).
  // Nexus's 'Outstanding Warrants' table sources these from 424B5 cover/securities.
  warrantTranches: WarrantTranche[];
}

export function parseProspectusHtml(html: string, filingDate?: Date): ParsedOffering {
  // Normalize PDF→HTML number-split artifacts ('$ 5 0,000,000' → '$50,000,000').
  const text = stripHtml(html).replace(/\$\s+/g, '$').replace(/(\d)\s+(?=\d)/g, '$1');
  // Offer terms live on the cover page + offering summary (first ~2-3 pages).
  // Deep-prose numbers (risk factors, exhibits) are noise — scope extraction there.
  const cover = text.slice(0, 30000);
  const coverLower = cover.toLowerCase();

  // shares offered — cover-scoped (first ~2 pages), so the headline "N shares of
  // common stock" is the OFFERING size, not total shares outstanding (which lives
  // deeper). Negative lookahead skips any "...shares outstanding" mention.
  let shares: number | null = null;
  for (const re of [
    /resale[\s\S]{0,400}?up to\s+(\d[\d,.]*\s*(?:million|billion|thousand)?)\s+shares/i,
    /up to\s+(\d[\d,.]*\s*(?:million|billion|thousand)?)\s+shares/i,
    /(\d[\d,.]*\s*(?:million|billion|thousand)?)\s+shares\s+of\s+(?:our\s+)?(?:class\s+[a-z]\s+)?common\s+stock(?!\s+(?:issued\s+and\s+)?outstanding)/i,
    /(?:offering|offered|sold|selling)\s+(?:of\s+)?(\d[\d,.]*\s*(?:million|billion|thousand)?)\s+shares/i,
  ]) {
    const m = cover.match(re);
    if (m) { shares = scaleNum(m[1]); if (shares && shares > 0) break; }
  }

  // price per share — ATMs have NO fixed price by definition (null). For others,
  // require CENTS ($X.YY) so a bare "$10" deep in legal prose can't false-match.
  const isAtm = /\bat-the-market\b|\bat the market\b|\bequity distribution agreement\b/i.test(coverLower);
  let price: number | null = null;
  if (!isAtm) {
    for (const re of [
      /public offering price of \$([\d,.]+\.\d{2,4})\s+per share/i,
      /offering price[^.\n]{0,30}?\$([\d,.]+\.\d{2,4})\s+per share/i,
      /price of \$([\d,.]+\.\d{2,4})\s+per share/i,
    ]) {
      const m = cover.match(re);
      if (m) { price = parseFloat(m[1].replace(/,/g, '')); if (price > 0) break; }
    }
  }

  // gross proceeds
  let proceeds: number | null = null;
  const gp =
    text.match(/gross proceeds[^$]{0,40}?\$([\d,.]+\s*(?:million|billion|thousand)?)/i) ||
    text.match(/gross proceeds[^.]{0,60}?of\s+\$?([\d,.]+\s*(?:million|billion|thousand)?)/i);
  if (gp) proceeds = scaleNum(gp[1]);

  // offering type
  let offeringType = 'unknown';
  if (/\bat-the-market\b|\bat the market\b|\bequity distribution agreement\b/i.test(coverLower))
    offeringType = 'atm';
  else if (/underwriter|firm commitment|underwritten/i.test(coverLower))
    offeringType = 'underwritten';
  else if (/best[\s-]?efforts/i.test(coverLower)) offeringType = 'best-efforts';
  else if (/selling securityholder|\bresale\b/i.test(coverLower)) offeringType = 'resale';

  // underwriter
  let underwriter: string | null = null;
  const uw =
    text.match(/([A-Z][\w&.,\s]{2,40}?)\s+is acting as.{0,30}?(?:sole\s+)?underwriter/i) ||
    text.match(/underwriters?:?\s*([A-Z][\w&.,\s]{2,40}?)[.,]/);
  if (uw) underwriter = uw[1].trim();

  // Per-warrant tranches — anchor on each "warrant" keyword occurrence and
  // scan a ±window around it. Warrant terms SPAN SENTENCES: shares are
  // described in the transaction summary ("warrants to purchase N shares")
  // while exercise price and expiry live in the warrant terms paragraph
  // ("exercise price of $Y, exercisable for Z years"). A sentence-bounded
  // regex misses the shares; a multi-sentence window catches both.
  const warrantTranches: WarrantTranche[] = [];
  const seenKeys = new Set<string>();
  const warrantRe = /\bwarrant[s]?\b/gi;
  for (let wm; (wm = warrantRe.exec(cover)) !== null && warrantTranches.length < 8;) {
    const start = Math.max(0, wm.index - 300);
    const end = Math.min(cover.length, wm.index + 700);
    const zone = cover.slice(start, end);
    // Must have a terms signal to avoid prose mentions (risk factors, etc.).
    if (!/exercis|expir|exercise\s+price|strike\s+price/i.test(zone)) continue;
    // Shares: "warrants to purchase (up to) N shares" / "N warrants".
    const sh = zone.match(/(?:purchase|for|of|to\s+purchase|represent|accompany|concurrent|issu(?:e|ing|ed))\s+(?:up\s+to\s+|an\s+aggregate\s+of\s+|equal\s+to\s+)?([\d,.]+)\s*(?:million|billion|thousand)?\s+(?:shares?|warrants?)/i);
    const shares = sh ? scaleNum(sh[1]) : null;
    // Strike: "exercise price of $Y" / "exercisable at $Y".
    const ep = zone.match(/exercise\s+price\s+(?:of\s+|equal\s+to\s+)?\$([\d,.]+(?:\.\d{1,4})?)/i)
      ?? zone.match(/(?:exercisable\s+at(?:\s+a)?(?:\s+price\s+of)?|strike\s+price\s+of)\s+\$([\d,.]+(?:\.\d{1,4})?)/i);
    const strike = ep ? parseFloat(ep[1].replace(/,/g, '')) : null;
    // Expiry: absolute date after "expir...".
    const ex = zone.match(/expir(?:e|es|ing|ation|y)[\s\S]{0,30}?(?:on)?\s*([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    let expiry: string | null = ex ? ex[1] : null;
    // Relative-term expiry: "for N years", "N years from issuance/closing",
    // "expiring N years after". Compute from the filing date when available —
    // most warrant terms are relative ("five years from the date of issuance"),
    // and without this ALL expiries are null.
    if (!expiry && filingDate) {
      // Word-number map: warrant terms are prose ("for five years", not "for 5 years").
      const WORD_YEARS: Record<string, number> = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10 };
      const yrText = zone.match(/(?:for|term\s+of|expir(?:e|es|ing|ation|y)[^.]{0,20}?(?:after)?|following)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?/i)
        ?? zone.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\s+from\s+/i);
      if (yrText) {
        const yrs = /^\d+$/.test(yrText[1]) ? parseInt(yrText[1], 10) : (WORD_YEARS[yrText[1].toLowerCase()] ?? null);
        if (yrs) {
          const d = new Date(filingDate);
          d.setFullYear(d.getFullYear() + yrs);
          expiry = d.toISOString().slice(0, 10);
        }
      }
    }
    // Exercisable: absolute date or "immediately".
    const ed = zone.match(/exercisable(?:\s+(?:commencing|beginning|on|immediately|until|any\s+time))?[\s\S]{0,40}?(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const exercisable = ed ? ed[1] : (/exercisable\s+(?:immediately|upon\s+issuance|as\s+of\s+issuance)/i.test(zone) ? 'immediately' : null);
    if (shares == null && strike == null && expiry == null) continue;
    const key = `${shares}|${strike?.toFixed(4)}|${expiry}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    warrantTranches.push({ shares, strike, expiry, exercisable, description: zone.trim().replace(/\s+/g, ' ').slice(0, 300) });
  }
  // Merge tranches that share shares OR strike (same warrant caught in
  // overlapping windows with different fields populated). Fill nulls from
  // the counterpart, then drop entries with no shares AND no strike.
  const merged: WarrantTranche[] = [];
  for (const t of warrantTranches) {
    const match = merged.find(m =>
      (t.shares != null && m.shares != null && t.shares === m.shares) ||
      (t.strike != null && m.strike != null && Math.abs(t.strike - m.strike) < 0.001),
    );
    if (match) {
      if (match.shares == null && t.shares != null) match.shares = t.shares;
      if (match.strike == null && t.strike != null) match.strike = t.strike;
      if (match.expiry == null && t.expiry != null) match.expiry = t.expiry;
      if (match.exercisable == null && t.exercisable != null) match.exercisable = t.exercisable;
    } else {
      merged.push({ ...t });
    }
  }

  return { sharesOffered: shares, pricePerShare: price, grossProceeds: proceeds, offeringType, underwriter, warrantTranches: merged };
}

export interface SyncOfferingsResult {
  status: 'success' | 'error';
  parsed: number;
  withDetail: number;
  error?: string;
}

/** Query recent 424Bx filings, fetch + parse each, store detail on rawPayload. */
export async function syncOfferings(cik: string): Promise<SyncOfferingsResult> {
  try {
    const filings = await prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: OFFERING_FORMS } },
      orderBy: { filingDate: 'desc' },
      take: PROSPECTUS_WINDOW,
      select: { accessionNo: true, filingDate: true, primaryDoc: true, rawPayload: true },
    });

    let withDetail = 0;
    let parsed = 0;
    for (const f of filings) {
      if (!f.primaryDoc) continue;
      const existing = (f.rawPayload ?? null) as { offeringParsed?: boolean } | null;
      if (existing?.offeringParsed) {
        withDetail++;
        continue; // idempotent
      }
      const o = await fetchAndParseFiling(
        cik,
        f.accessionNo,
        f.primaryDoc,
        (html) => parseProspectusHtml(html, f.filingDate ?? undefined),
        (result) => !result.sharesOffered && !result.pricePerShare && !result.grossProceeds,
      );
      parsed++;
      if (!o || (!o.sharesOffered && !o.pricePerShare && !o.grossProceeds)) continue; // nothing extractable
      await prisma.dilutionFiling.update({
        where: { accessionNo: f.accessionNo },
        data: {
          rawPayload: { ...(existing ?? {}), offeringParsed: true, ...o },
        },
      });
      withDetail++;
    }
    return { status: 'success', parsed, withDetail };
  } catch (err) {
    return { status: 'error', parsed: 0, withDetail: 0, error: err instanceof Error ? err.message : 'offerings sync failed' };
  }
}
