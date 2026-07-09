/**
 * 10-Q/10-K dilution-DRAW parser.
 *
 * A "draw" is an actual cash-raising event under a dilution facility: shares
 * sold under a SEPA/equity-line/ATM, or a convertible/promissory note advance.
 * These are the real, recurring dilution events a short-bias trader wants
 * counted — distinct from the facility definition (programs) or the
 * registration capacity (shelf).
 *
 * WHY 10-Q/10-K (not 8-K): 8-K draw notices embed the detail in EX-99 exhibits
 * with inconsistent framing (verified: VWAV 8-K bodies had zero clean draw
 * clauses). 10-Q/10-K MD&A + footnote summaries state draws in standard
 * prose ("aggregate principal amount of $5.0 million in convertible notes
 * advanced"). Reliable, one filing per quarter, reuses the warrant-notes
 * body-fetch path.
 *
 * RESTATEMENT handling: the same draw is reported cumulatively across
 * successive quarterlies. Dedup by (amount + facilityType + clause
 * fingerprint) — collapses the quarterly restatement, keeps genuinely distinct
 * draws, tags the earliest filing date (≈ actual draw date). Honest
 * best-effort recall: surfaces the raw clause for verification.
 *
 * Storage: DilutionFiling.rawPayload.draws (idempotent via drawsParsed flag).
 * getDraws(cik) aggregates + dedupes for the snapshot.
 */
import { prisma } from '@/lib/prisma';
import { fetchAndParseFiling } from '@/lib/sec/client';

const SCALE: Record<string, number> = { million: 1e6, billion: 1e9, thousand: 1e3, trillion: 1e12 };
function scaleMoney(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand|trillion)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isNaN(n) ? null : n * (m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1);
}
function scaleShares(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isNaN(n) ? null : n * (m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#8217;|&#8220;|&#8221;|&ldquo;|&rdquo;|&rsquo;/g, "'")
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type DrawFacility = 'equity-line' | 'convertible' | 'promissory-note' | 'atm' | 'unknown';

export interface DrawEvent {
  amount: number | null; // $ raised in this draw
  shares: number | null; // shares issued (note advances → null)
  pricePerShare: number | null;
  facilityType: DrawFacility;
  facilityName: string | null; // "SEPA", "YA II", "Adrian Note"
  date: string | null; // filing date of first report (≈ draw date)
  description: string; // raw clause for verification
}

export interface ParsedDraws {
  drawsParsed: true;
  draws: DrawEvent[];
  source: string;
  parsedAt: string;
}

/** Extract dilution draws from stripped 10-Q/10-K body text. */
export function parseDrawsHtml(html: string, accessionNo: string, filingDate: string): ParsedDraws {
  const text = stripHtml(html);
  const raw: DrawEvent[] = [];

  // 1. Convertible / promissory NOTE ADVANCES (SEPA pre-paid advance, note draws).
  //    "advanced ... in the form of convertible promissory notes ... aggregate
  //    principal amount of $5.0 million" / "issued a $10 million promissory note".
  const noteRe = /(?:advanced|issued)\b[^.]{0,140}?(?:convertible\s+(?:promissory\s+)?notes?|promissory\s+note)[^.]{0,200}?(?:aggregate\s+(?:principal\s+)?amount[^$]{0,15})\$([\d,.]+\s*(?:million|billion|thousand)?)|issued\s+(?:a\s+)?\$([\d,.]+\s*(?:million|billion|thousand)?)\s+(?:promissory|convertible)\s+note/gi;
  for (const m of text.matchAll(noteRe)) {
    const amtRaw = m[1] ?? m[2];
    const amount = amtRaw ? scaleMoney(amtRaw) : null;
    if (!amount || amount <= 0) continue;
    const isConv = /convertible/i.test(m[0]);
    raw.push({
      amount,
      shares: null,
      pricePerShare: null,
      facilityType: isConv ? 'convertible' : 'promissory-note',
      facilityName: extractFacilityName(m[0]),
      date: filingDate,
      description: m[0].trim().replace(/\s+/g, ' ').slice(0, 320),
    });
  }

  // 2. SEPA / equity-line SHARE SALES: "sold N shares to the Investor ...
  //    $X" / "issued N shares pursuant to the SEPA ... gross proceeds $X".
  const sepaRe = /(?:sold|issued)\s+(?:an\s+aggregate\s+of\s+)?([\d,.]+\s*(?:million|billion|thousand)?)\s+shares?[^.]{0,180}?(?:to\s+the\s+(?:Investor|Purchaser|Buyer)|pursuant\s+to\s+the\s+(?:SEPA|Standby\s+Equity|Equity\s+Purchase|SPA|Purchase\s+Agreement)|gross\s+(?:proceeds|sales\s+proceeds))[^.]{0,150}?\$([\d,.]+\s*(?:million|billion|thousand)?)/gi;
  for (const m of text.matchAll(sepaRe)) {
    const shares = scaleShares(m[1]);
    const amount = scaleMoney(m[2]);
    if (!amount || amount <= 0) continue;
    raw.push({
      amount,
      shares,
      pricePerShare: shares && shares > 0 ? amount / shares : null,
      facilityType: 'equity-line',
      facilityName: extractFacilityName(m[0]),
      date: filingDate,
      description: m[0].trim().replace(/\s+/g, ' ').slice(0, 320),
    });
  }

  // 3. ATM / equity-distribution periodic sales: "sold N shares under the
  //    at-the-market ... $X" / "under the Equity Distribution Agreement".
  const atmRe = /(?:sold|issued)\s+([\d,.]+\s*(?:million|billion|thousand)?)\s+shares?[^.]{0,180}?(?:at[\s-]?the[\s-]?market|equity\s+distribution\s+agreement|sales\s+agreement)[^.]{0,150}?\$([\d,.]+\s*(?:million|billion|thousand)?)/gi;
  for (const m of text.matchAll(atmRe)) {
    const shares = scaleShares(m[1]);
    const amount = scaleMoney(m[2]);
    if (!amount || amount <= 0) continue;
    raw.push({
      amount,
      shares,
      pricePerShare: shares && shares > 0 ? amount / shares : null,
      facilityType: 'atm',
      facilityName: extractFacilityName(m[0]),
      date: filingDate,
      description: m[0].trim().replace(/\s+/g, ' ').slice(0, 320),
    });
  }

  return { drawsParsed: true, draws: raw, source: accessionNo, parsedAt: new Date().toISOString().slice(0, 10) };
}

/** Pull a short facility identifier from a clause ("SEPA", "YA II", "Adrian Note"). */
function extractFacilityName(clause: string): string | null {
  const named =
    clause.match(/\b(Standby\s+Equity\s+Purchase\s+Agreement|SEPA|Equity\s+Purchase\s+Agreement|Equity\s+Distribution\s+Agreement|Sales\s+Agreement)\b/i)?.[1] ??
    clause.match(/(?:the\s+)?([A-Z][A-Za-z0-9]{1,20})\s+(?:Note|Agreement|SEPA|Facility)\b/)?.[0] ??
    clause.match(/\b(YA\s+II|Yorkville|Lincoln\s+Park|GEM|Cantor|B\.Riley|BMO|Jefferies)\b/)?.[1];
  return named ? named.trim() : null;
}

export interface SyncDrawsResult {
  status: 'success' | 'error';
  parsed: number;
  withDetail: number;
  error?: string;
}

/** Fetch + parse the latest 10-Q/10-K bodies for dilution draws. Idempotent. */
export async function syncDraws(cik: string): Promise<SyncDrawsResult> {
  try {
    const filings = await prisma.dilutionFiling.findMany({
      where: { cik, formType: { in: ['10-Q', '10-K'] } },
      orderBy: { filingDate: 'desc' },
      take: 6, // ~last 5 quarterlies + annual
      select: { accessionNo: true, filingDate: true, primaryDoc: true, rawPayload: true },
    });
    let parsed = 0;
    let withDetail = 0;
    for (const filing of filings) {
      if (!filing.primaryDoc) continue;
      const existing = (filing.rawPayload ?? null) as { drawsParsed?: boolean; draws?: DrawEvent[] } | null;
      if (existing?.drawsParsed) {
        withDetail += (existing.draws ?? []).length;
        continue;
      }
      const d = await fetchAndParseFiling(
        cik,
        filing.accessionNo,
        filing.primaryDoc,
        (html) => parseDrawsHtml(html, filing.accessionNo, filing.filingDate.toISOString().slice(0, 10)),
        (result) => result.draws.length === 0,
      );
      if (!d) continue; // primary + .txt both failed — leave unmarked, retry later
      parsed++;
      withDetail += d.draws.length;
      await prisma.dilutionFiling.update({
        where: { accessionNo: filing.accessionNo },
        data: { rawPayload: { ...(existing ?? {}), drawsParsed: true, draws: d.draws } },
      });
    }
    return { status: 'success', parsed, withDetail };
  } catch (err) {
    return { status: 'error', parsed: 0, withDetail: 0, error: err instanceof Error ? err.message : 'draws sync failed' };
  }
}

/** Aggregate + dedup draws across the latest quarterlies (no SEC call).
 *  Dedup by (amount + facilityType) so the SAME draw restated in successive
 *  quarterlies (and restated within a filing across multiple note sections)
 *  collapses to ONE row, tagged with the EARLIEST report date (≈ actual draw
 *  date). The 10-Q reports period-aggregate draw amounts, not per-draw dates,
 *  so two genuinely identical-amount draws on different dates may merge —
 *  the raw clause is retained for the trader to verify. */
export async function getDraws(cik: string): Promise<DrawEvent[]> {
  const rows = await prisma.dilutionFiling.findMany({
    where: { cik, formType: { in: ['10-Q', '10-K'] }, rawPayload: { path: ['drawsParsed'], equals: true } },
    orderBy: { filingDate: 'desc' },
    take: 6,
    select: { filingDate: true, rawPayload: true },
  });
  // fingerprint: amount + facilityType only (collapses restatements)
  const fp = (d: DrawEvent) => `${Math.round(d.amount ?? 0)}|${d.facilityType}`;
  const byKey = new Map<string, DrawEvent>();
  // iterate oldest → newest so the EARLIEST report date wins (≈ actual draw date)
  for (const r of [...rows].reverse()) {
    const rp = (r.rawPayload ?? null) as { draws?: DrawEvent[] } | null;
    for (const d of rp?.draws ?? []) {
      const k = fp(d);
      const cur = byKey.get(k);
      if (!cur) { byKey.set(k, { ...d, date: r.filingDate.toISOString().slice(0, 10) }); }
    }
  }
  return [...byKey.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}
