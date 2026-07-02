/**
 * 8-K material-agreement parser (Phase 1 keystone).
 *
 * The metadata-only classifier (classify.ts) cannot detect ATM / equity-line /
 * SPA programs because 8-K primaryDocDescription is generic ("8-K"). Nexus-style
 * coverage requires reading the 8-K BODY — specifically Item 1.01 (Entry into a
 * Material Definitive Agreement), 2.03 (Creation of Direct Obligation), 3.02
 * (Unregistered Sales), 3.03 (Material Modifications to Rights).
 *
 * This fetches the body of item-1.01/2.03/3.02 8-Ks, classifies the agreement
 * type, and extracts terms (counterparty, max commitment, pricing mechanism,
 * ownership cap, maturity). High-PRECISION, partial-RECALL — keeps the raw
 * section text for user verification.
 *
 * Storage: DilutionFiling.rawPayload.programDetail (idempotent — skipped once
 * parsed). getPrograms(cik) aggregates into a program list for the snapshot.
 *
 * Verified patterns (2026-06-29, SRFM):
 *   "aggregate principal amount of up to $15 million ... maturity date ... is
 *    April 20, 2029 ... shares of Common Stock (or pre-funded warrants)" →
 *    promissory-note/convertible facility, $15M max, 2029 maturity.
 */
import { prisma } from '@/lib/prisma';
import { secFetchResponse } from '@/lib/sec/client';

const SCALE: Record<string, number> = { million: 1e6, billion: 1e9, thousand: 1e3, trillion: 1e12 };
function scaleMoney(raw: string): number | null {
  const m = raw.match(/([\d,.]+)\s*(million|billion|thousand|trillion)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n)) return null;
  return n * (m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1);
}
function scalePct(raw: string): number | null {
  const m = raw.match(/([\d.]+)\s*(?:%|percent)/i);
  return m && !isNaN(parseFloat(m[1])) ? parseFloat(m[1]) : null;
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

function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${primaryDoc ?? ''}`;
}

export type ProgramType =
  | 'atm'
  | 'equity-line'
  | 'convertible'
  | 'promissory-note'
  | 'warrant-offering'
  | 'material-agreement';

export interface ProgramDetail {
  filingAccession: string;
  filingDate: string;
  items: string[];
  programType: ProgramType;
  counterparty: string | null;
  maxCommitment: number | null; // $ maximum drawable
  pricing: string | null; // 'fixed $1.274', 'VWAP', '94% of VWAP', 'trailing 15-day'
  ownershipCap: number | null; // % (9.99 common in SEPA/converts)
  maturity: string | null; // date text
  drawCapPerPeriod: string | null; // e.g. '$5M / 90 days'
  securities: string[]; // ['common stock','pre-funded warrants','convertible note']
  description: string; // raw section text (verify source)
}

// Detect agreement type from an Item-1.01 section. Priority: most-specific first.
function detectType(sect: string): ProgramType | null {
  const s = sect.toLowerCase();
  if (/(at[\s-]?the[\s-]?market|sales\s+agreement|equity\s+distribution\s+agreement)/.test(s)) return 'atm';
  if (/(standby\s+equity|sepa|equity\s+(?:purchase|line)|share\s+purchase\s+agreement|purchase\s+facility|drawdown)/.test(s)) return 'equity-line';
  if (/convertible\s+(?:note|debenture|security)|conversion\s+price/.test(s)) return 'convertible';
  if (/promissory\s+note|secured\s+note/.test(s)) return 'promissory-note';
  if (/(pre-?funded\s+warrant|warrant\s+to\s+purchase|issuance\s+of\s+warrants)/.test(s)) return 'warrant-offering';
  return null; // generic 1.01 we don't model — skip
}

const SEC_RE = /(common\s+stock|preferred\s+stock|pre-?\s*funded\s+warrants?|warrants?|convertible\s+notes?|promissory\s+note|units)/gi;

export function parse8kMaterialAgreement(html: string, accessionNo: string, filingDate: string, items: string[]): ProgramDetail | null {
  const text = stripHtml(html);
  // Extract Item 1.01 section (primary); fall back to Item 2.03/3.02/3.03.
  // Boundary: from "Item 1.01" up to the next "Item N.NN".
  const sectMatch =
    text.match(/Item\s*1\.01[\s\S]{0,80}?(?:Entry\s+into\s+a\s+Material|Material\s+Definitive)([\s\S]{0,6000}?)(?=Item\s*\d)/i) ??
    text.match(/Item\s*2\.03[\s\S]{0,80}?(?:Creation[\s\S]{0,40}?Direct)([\s\S]{0,6000}?)(?=Item\s*\d)/i) ??
    text.match(/Item\s*3\.0[23][\s\S]{0,80}?(?:Unregistered|Material\s+Modif)([\s\S]{0,6000}?)(?=Item\s*\d)/i);
  if (!sectMatch) return null;
  const sect = sectMatch[0].trim();
  return parseClause(sect, accessionNo, filingDate, items);
}

/** Parse a single facility clause (already-extracted text window) into a
 *  ProgramDetail. Exported so the EFTS recall layer (efts.ts) can reuse the
 *  same term-extraction logic on exhibit text that has no Item headers. */
export function parseClause(
  sect: string,
  accessionNo: string,
  filingDate: string,
  items: string[],
): ProgramDetail | null {
  const programType = detectType(sect);
  if (!programType) return null; // not a modeled dilution facility

  // Counterparty — usually "with X (the "Lender"/"Purchaser"/"Agent")".
  // Broadened for exhibit text: catches "GEM Global Yield LLC SCS",
  // "Lincoln Park Capital Fund, LLC", etc. via a trailing entity suffix.
  const cp =
    sect.match(/(?:with|by\s+and\s+between|between)\s+([A-Z][A-Za-z0-9&.,'\s]{3,50}?(?:LLC|L\.L\.C\.|Inc|Ltd|Capital|Partners|Group|Securities|Management|Advisors|Global\s+\w+|Markets))\b/)?.[1]?.trim() ??
    sect.match(/(?:with|by\s+and\s+between)\s+([A-Z][A-Za-z0-9&.]{2,30})\s+(?:Global\s+Equity|Global\s+Yield|Capital|Partners|Management|Lender|Purchaser)/)?.[1]?.trim() ??
    null;

  // Max commitment — "aggregate principal amount of up to $N" / "up to $N" / "maximum ... $N".
  const mc =
    sect.match(/aggregate\s+(?:principal\s+)?(?:amount\s+)?(?:of\s+)?(?:up\s+to\s+)?a?\s*\$([\d,.]+\s*(?:million|billion|thousand)?)/i) ??
    sect.match(/(?:up\s+to|maximum\s+(?:of\s+)?)\s*\$([\d,.]+\s*(?:million|billion|thousand)?)/i) ??
    sect.match(/commitment(?:\s+(?:of|up\s+to))?\s+\$([\d,.]+\s*(?:million|billion|thousand)?)/i);
  const maxCommitment = mc ? scaleMoney(mc[1]) : null;

  // Pricing mechanism.
  let pricing: string | null = null;
  if (/volume[\s-]?weighted\s+average\s+price|VWAP/i.test(sect)) pricing = 'VWAP-based';
  else {
    const fix = sect.match(/\$\s*([\d,.]+)\s*(?:per\s+share)?/);
    if (fix) pricing = `fixed $${fix[1]} per share`;
  }

  // Ownership cap (9.99% classic in SEPA/converts).
  const oc = sect.match(/(?:beneficial\s+ownership|ownership)\s+limit(?:ation)?\s+of\s+([\d.]+)\s*(?:%|percent)/i) ??
             sect.match(/not\s+to\s+exceed\s+([\d.]+)\s*(?:%|percent)[^.]{0,30}?(?:outstanding|shares)/i);
  const ownershipCap = oc ? scalePct(oc[0]) : null;

  // Maturity.
  const mat = sect.match(/matur(?:e|ity)(?:\s+date)?[^.]{0,30}?(?:is|of|on)\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i) ??
              sect.match(/due\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2},?\s+\d{4}|\d{4})/i);
  const maturity = mat ? mat[1] : null;

  // Period draw cap — "$5 million in each consecutive 90-day period".
  const dc = sect.match(/\$([\d,.]+)\s*(million|billion|thousand)?[^.]{0,40}?(?:each|per)\s+(?:consecutive\s+)?(\d+[\s-]?day|quarter|month)/i);
  const drawCapPerPeriod = dc ? `$${dc[1]} ${dc[2] ?? ''}/ ${dc[3].replace(/\s+/g,'')}` : null;

  // Securities involved.
  const securities = [...new Set((sect.match(SEC_RE) ?? []).map((s) => s.toLowerCase().replace(/\s+/g, ' ')))].slice(0, 5);

  // Only keep clauses with at least one structured fact (avoid noise).
  if (maxCommitment === null && pricing === null && maturity === null && ownershipCap === null && securities.length === 0) {
    return null;
  }

  return {
    filingAccession: accessionNo,
    filingDate,
    items,
    programType,
    counterparty: cp,
    maxCommitment,
    pricing,
    ownershipCap,
    maturity,
    drawCapPerPeriod,
    securities,
    description: sect.slice(0, 1200),
  };
}

export interface SyncProgramsResult {
  status: 'success' | 'error';
  parsed: number;
  withDetail: number;
  error?: string;
}

/** Fetch + parse item-1.01/2.03/3.02 8-Ks for a CIK. Idempotent per filing. */
export async function syncMaterialAgreements(cik: string): Promise<SyncProgramsResult> {
  try {
    // Only 8-Ks with material-agreement items.
    const candidates = await prisma.dilutionFiling.findMany({
      where: {
        cik,
        formType: '8-K',
        items: { hasSome: ['1.01', '2.03', '3.02', '3.03'] },
      },
      select: { accessionNo: true, filingDate: true, primaryDoc: true, items: true, rawPayload: true },
      orderBy: { filingDate: 'desc' },
      take: 20, // recent 20 — programs refresh, old ones don't matter
    });
    let parsed = 0;
    let withDetail = 0;
    for (const f of candidates) {
      const existing = (f.rawPayload ?? null) as { programDetail?: ProgramDetail; programParsed?: boolean } | null;
      if (existing?.programParsed) continue; // idempotent
      if (!f.primaryDoc) continue;
      let html: string;
      try {
        const res = await secFetchResponse(filingUrl(cik, f.accessionNo, f.primaryDoc), 'text/html');
        if (!res.ok) continue;
        html = await res.text();
      } catch {
        continue;
      }
      const detail = parse8kMaterialAgreement(html, f.accessionNo, f.filingDate.toISOString().slice(0, 10), f.items ?? []);
      parsed++;
      // Mark parsed regardless (avoid re-fetching unmodeled agreements); store detail if found.
      await prisma.dilutionFiling.update({
        where: { accessionNo: f.accessionNo },
        data: { rawPayload: { ...(existing ?? {}), programParsed: true, programDetail: detail ?? undefined } },
      });
      if (detail) withDetail++;
    }
    return { status: 'success', parsed, withDetail };
  } catch (err) {
    return { status: 'error', parsed: 0, withDetail: 0, error: err instanceof Error ? err.message : 'programs sync failed' };
  }
}

export interface CompanyProgram {
  programType: ProgramType;
  filingDate: string;
  counterparty: string | null;
  maxCommitment: number | null;
  pricing: string | null;
  ownershipCap: number | null;
  maturity: string | null;
  drawCapPerPeriod: string | null;
  securities: string[];
  description: string;
  filingAccession: string;
}

/** Read all parsed material-agreement programs for a CIK (no SEC call).
 *  Dedupes by (type + amount) — EFTS recall surfaces the same facility across
 *  many filings (amendments, prospectus re-filings, 8-K + S-4 definitions);
 *  collapsing to one row per facility keeps the programs card scannable.
 *  Prefers rows with an extracted counterparty; falls back to newest date. */
export async function getPrograms(cik: string): Promise<CompanyProgram[]> {
  const rows = await prisma.dilutionFiling.findMany({
    where: { cik, rawPayload: { path: ['programDetail'], not: null } },
    select: { rawPayload: true, filingDate: true },
    orderBy: { filingDate: 'desc' },
  });
  const all: CompanyProgram[] = [];
  for (const r of rows) {
    const rp = (r.rawPayload ?? null) as { programDetail?: ProgramDetail } | null;
    const d = rp?.programDetail;
    if (!d) continue;
    all.push({
      programType: d.programType,
      filingDate: d.filingDate,
      counterparty: d.counterparty,
      maxCommitment: d.maxCommitment,
      pricing: d.pricing,
      ownershipCap: d.ownershipCap,
      maturity: d.maturity,
      drawCapPerPeriod: d.drawCapPerPeriod,
      securities: d.securities,
      description: d.description,
      filingAccession: d.filingAccession,
    });
  }
  // Dedup: group by type + amount (rounded to avoid float noise). Keep the
  // row with a counterparty if any in the group has one; else newest.
  const byKey = new Map<string, CompanyProgram>();
  for (const p of all) {
    const key = `${p.programType}|${p.maxCommitment != null ? Math.round(p.maxCommitment) : 'null'}`;
    const cur = byKey.get(key);
    if (!cur) { byKey.set(key, p); continue; }
    const curHasCp = !!cur.counterparty;
    const pHasCp = !!p.counterparty;
    const replace = pHasCp && !curHasCp;
    if (replace) byKey.set(key, p);
  }
  return [...byKey.values()].sort((a, b) => (b.filingDate ?? '').localeCompare(a.filingDate ?? ''));
}
