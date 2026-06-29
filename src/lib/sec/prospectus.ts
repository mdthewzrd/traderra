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
import { secFetchResponse } from '@/lib/sec/client';

export const OFFERING_FORMS = ['424B1', '424B3', '424B4', '424B5', '424B7', '424B8'];
const PROSPECTUS_WINDOW = 40;

function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${primaryDoc ?? ''}`;
}

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

export function parseProspectusHtml(html: string): ParsedOffering {
  const text = stripHtml(html);
  // Offer terms live on the cover page + offering summary (first ~2-3 pages).
  // Deep-prose numbers (risk factors, exhibits) are noise — scope extraction there.
  const cover = text.slice(0, 8000);
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

  // Per-warrant tranches — scan cover for warrant clauses with strike/expiry.
  // Common phrasing: "accompanying warrants to purchase N shares ... exercise
  // price of $Y ... exercisable ... expiring on DATE".
  const warrantTranches: WarrantTranche[] = [];
  const warrantClauses = cover.match(/[A-Z][^.]{0,40}?warrant[s]?[^.]{0,400}?(?:exercis|expir|exercise\s+price)[^.]{0,300}?(?:\.|;)/gi) ?? [];
  for (const wc of warrantClauses.slice(0, 8)) {
    const sh = wc.match(/(?:purchase|represent|for|of|to\s+purchase)\s+([\d,.]+\s*(?:million|billion|thousand)?)\s+shares?/i);
    const ep = wc.match(/(?:exercise|exercisable\s+at(?:\s+a)?(?:\s+price\s+of)?|strike\s+price\s+of)\s+\$?([\d,.]+(?:\.\d{1,4})?)/i)
      ?? wc.match(/exercise\s+price[^.]{0,50}?(?:equal\s+to|of)\s+\$?([\d,.]+(?:\.\d{1,4})?)/i);
    const ex = wc.match(/expir(?:e|es|ing|ation|y)[^.]{0,30}?(?:on)?\s*([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const ed = wc.match(/exercisable(?:\s+(?:commencing|beginning|on|immediately|until|any\s+time))?[^.]{0,25}?(?:on\s+)?([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const shares = sh ? scaleNum(sh[1]) : null;
    const strike = ep ? parseFloat(ep[1].replace(/,/g, '')) : null;
    const expiry = ex ? ex[1] : null;
    const exercisable = ed ? ed[1] : null;
    if (shares != null || strike != null || expiry != null) {
      warrantTranches.push({ shares, strike, expiry, exercisable, description: wc.trim().replace(/\s+/g, ' ').slice(0, 300) });
    }
  }

  return { sharesOffered: shares, pricePerShare: price, grossProceeds: proceeds, offeringType, underwriter, warrantTranches };
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
      select: { accessionNo: true, primaryDoc: true, rawPayload: true },
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
      let html: string;
      try {
        const res = await secFetchResponse(filingUrl(cik, f.accessionNo, f.primaryDoc), 'text/html');
        if (!res.ok) continue;
        html = await res.text();
      } catch {
        continue;
      }
      parsed++;
      const o = parseProspectusHtml(html);
      if (!o.sharesOffered && !o.pricePerShare && !o.grossProceeds) continue; // nothing extractable
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
