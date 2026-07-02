/**
 * Reverse-split scanner — extracts reverse stock split ratios + effective dates
 * from SEC filings (8-K Item 3.03 + proxy statements). High-value short-bias
 * signal: reverse splits are a classic dilution/avoidance precursor and often
 * precede/at accompany toxic financing.
 *
 * Parser adapted from the Nexus-Terminal reference implementation (MIT); scan
 * + persistence follow our standard sync/get pattern (result stored on the
 * filing's rawPayload.reverseSplit, no schema change).
 */
import { prisma } from '@/lib/prisma';
import { secFetchResponse } from '@/lib/sec/client';

export interface ReverseSplit {
  ratio: string; // '1-for-3' normalized
  executionDate: string | null; // ISO effective date if the filing states one
  announcementDate: string; // filing date
  accessionNo: string;
  url: string;
}

const MAX_SCAN_CHARS = 50_000;
const CONTEXT_WINDOW_CHARS = 200;

// Reverse-split ratio phrasing. Numerator is the NEW share count, denominator
// is OLD ("1-for-3" = every 3 old shares → 1 new share).
const RATIO_PATTERNS: RegExp[] = [
  /(\d+)\s*[-\s]?\s*(?:for|to|:)\s*[-\s]?\s*(\d+)\s+reverse\s+(?:stock\s+)?split/i,
  /reverse\s+(?:stock\s+)?split\s+(?:at\s+(?:a\s+)?ratio\s+of\s+)?(\d+)\s*[-\s]?\s*(?:for|to|:)\s*[-\s]?\s*(\d+)/i,
  // Flexible: reverse split ... <intervening words> ... N-for-M (the most
  // common real phrasing: 'reverse split of common stock at a ratio of 1-for-4').
  /reverse\s+(?:stock\s+)?split[^.]{0,100}?(?:ratio\s+of\s+)?(\d+)\s*[-\s]?\s*(?:for|to|:)\s*[-\s]?\s*(\d+)/i,
  /(\d+)\s*[-\s]?\s*(?:for|to)\s*[-\s]?\s*(\d+)\s+(?:share\s+)?consolidation/i,
];
const WORD_RATIO_PATTERNS: RegExp[] = [
  /\b([a-z-]+)\s*[-\s]?(?:for|to)\s*[-\s]?([a-z-]+)\s+reverse\s+(?:stock\s+)?split/i,
  /\breverse\s+(?:stock\s+)?split\s+(?:at\s+(?:a\s+)?ratio\s+of\s+)?([a-z-]+)\s*[-\s]?(?:for|to)\s*[-\s]?([a-z-]+)/i,
  /\b([a-z-]+)\s*[-\s]?(?:for|to)\s*[-\s]?([a-z-]+)\s+(?:share\s+)?consolidation/i,
];
const DATE_PATTERNS: RegExp[] = [
  /effective\s+(?:on\s+|as\s+of\s+|date\s+of\s+)?([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/i,
  /effective\s+(?:on\s+|as\s+of\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  /effective\s+(?:on\s+|as\s+of\s+)?(\d{4}-\d{2}-\d{2})/i,
];

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function parseWordNumber(word: string): number | null {
  const n = NUMBER_WORDS[word.toLowerCase().replace(/-/g, '')];
  return n !== undefined ? n : null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function monthNameToNumber(month: string): number | null {
  const i = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(month.toLowerCase());
  return i >= 0 ? i + 1 : null;
}

function parseFlexibleDate(value: string): string | null {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(v);
  if (slash) {
    let y = Number.parseInt(slash[3], 10);
    if (y < 100) y += 2000;
    return toIsoDate(y, Number.parseInt(slash[1], 10), Number.parseInt(slash[2], 10));
  }
  const long = /^([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})$/i.exec(v);
  if (long) {
    const m = monthNameToNumber(long[1]);
    if (!m) return null;
    return toIsoDate(Number.parseInt(long[3], 10), m, Number.parseInt(long[2], 10));
  }
  return null;
}

function normalizeRatio(num: number, den: number): string | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) return null;
  return `${num}-for-${den}`;
}

function extractExecutionDate(text: string, matchIndex: number, matchLength: number): string | null {
  const start = Math.max(0, matchIndex - CONTEXT_WINDOW_CHARS);
  const context = text.slice(start, Math.min(text.length, matchIndex + matchLength + CONTEXT_WINDOW_CHARS));
  for (const p of DATE_PATTERNS) {
    const m = p.exec(context);
    if (m?.[1]) { const parsed = parseFlexibleDate(m[1]); if (parsed) return parsed; }
  }
  return null;
}

export function extractReverseSplit(text: string): { ratio: string; executionDate: string | null } | null {
  const clipped = text.slice(0, MAX_SCAN_CHARS).trim();
  if (!clipped) return null;
  // digit patterns first (more precise), then word patterns ("one-for-three")
  for (const p of RATIO_PATTERNS) {
    const m = p.exec(clipped);
    if (m?.[1] && m[2]) {
      const r = normalizeRatio(Number.parseInt(m[1], 10), Number.parseInt(m[2], 10));
      if (r) return { ratio: r, executionDate: extractExecutionDate(clipped, m.index, m[0].length) };
    }
  }
  for (const p of WORD_RATIO_PATTERNS) {
    const m = p.exec(clipped);
    if (m?.[1] && m[2]) {
      const num = parseWordNumber(m[1]);
      const den = parseWordNumber(m[2]);
      if (num === null || den === null) continue;
      const r = normalizeRatio(num, den);
      if (r) return { ratio: r, executionDate: extractExecutionDate(clipped, m.index, m[0].length) };
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filingUrl(cik: string, accessionNo: string, primaryDoc: string | null): string {
  const stripped = accessionNo.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${stripped}/${primaryDoc ?? ''}`;
}

// Forms most likely to announce/confirm a reverse split. 8-K Item 3.03 is the
// canonical "material modification" notice; DEF 14A carries the shareholder
// vote; the 8-K often supersedes the proxy once effective.
const SPLIT_FORMS = ['8-K', 'DEF 14A', '8-A', 'PRE 14A', 'N-2'];

export async function syncReverseSplits(cik: string): Promise<{ parsed: number; found: number }> {
  const since = new Date(Date.now() - 2 * 365 * 86_400_000); // 2y window
  const filings = await prisma.dilutionFiling.findMany({
    where: { cik, formType: { in: SPLIT_FORMS }, filingDate: { gte: since } },
    select: { accessionNo: true, formType: true, filingDate: true, primaryDoc: true, items: true, rawPayload: true, dilutionTags: true },
    orderBy: { filingDate: 'desc' },
    take: 40,
  });

  let parsed = 0;
  let found = 0;
  for (const f of filings) {
    // Skip filings already scanned (idempotent) unless they had no hit — a
    // re-parse only happens if the marker is absent (fresh filing / first run).
    if (f.rawPayload && (f.rawPayload as Record<string, unknown>).reverseSplitScanned) continue;
    // For 8-Ks, only fetch the body if Item 3.03 is present (saves a fetch).
    // items is a String[] (submissions.json splits on comma).
    const is8K = f.formType === '8-K';
    const has303 = Array.isArray(f.items) && f.items.some((it) => String(it).trim() === '3.03');
    if (is8K && !has303) {
      // mark scanned so we don't re-evaluate non-3.03 8-Ks every run
      await prisma.dilutionFiling.update({
        where: { accessionNo: f.accessionNo },
        data: { rawPayload: { ...(f.rawPayload ?? {}), reverseSplitScanned: true } },
      });
      continue;
    }
    if (!f.primaryDoc) continue;
    parsed++;
    try {
      const res = await secFetchResponse(filingUrl(cik, f.accessionNo, f.primaryDoc), 'text/html');
      if (!res.ok) continue;
      const html = await res.text();
      const text = stripHtml(html);
      const split = extractReverseSplit(text);
      const payload: Record<string, unknown> = {
        ...(f.rawPayload ?? {}),
        reverseSplitScanned: true,
        ...(split
          ? {
              reverseSplit: {
                ratio: split.ratio,
                executionDate: split.executionDate,
                announcementDate: f.filingDate.toISOString().slice(0, 10),
                accessionNo: f.accessionNo,
                formType: f.formType,
              },
            }
          : {}),
      };
      await prisma.dilutionFiling.update({
        where: { accessionNo: f.accessionNo },
        data: {
          rawPayload: payload,
          // Promote the detected split to the 'reverse-split' tag. classify.ts
          // only tags 8-Ks at ingest; proxy/10-K detections land here via the
          // body scanner, so this is the authoritative tagger for those forms.
          ...(split
            ? { dilutionTags: [...new Set([...(f.dilutionTags ?? []), 'reverse-split'])] }
            : {}),
        },
      });
      if (split) found++;
    } catch {
      // network/parse failure — leave unscanned so a later run can retry
    }
  }
  return { parsed, found };
}

export async function getReverseSplits(cik: string): Promise<ReverseSplit[]> {
  const filings = await prisma.dilutionFiling.findMany({
    where: { cik },
    select: { accessionNo: true, primaryDoc: true, rawPayload: true },
  });
  const out: ReverseSplit[] = [];
  for (const f of filings) {
    const p = (f.rawPayload ?? {}) as { reverseSplit?: { ratio: string; executionDate: string | null; announcementDate: string; accessionNo: string } };
    const s = p.reverseSplit;
    if (s) {
      out.push({
        ratio: s.ratio,
        executionDate: s.executionDate,
        announcementDate: s.announcementDate,
        accessionNo: s.accessionNo,
        url: filingUrl(cik, s.accessionNo, f.primaryDoc),
      });
    }
  }
  // newest announcement first
  return out.sort((a, b) => b.announcementDate.localeCompare(a.announcementDate));
}
