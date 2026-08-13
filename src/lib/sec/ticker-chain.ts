/**
 * REQ-571 Phase 1 — CIK ticker-chain resolver.
 *
 * Given a current ticker OR CIK, returns the full ordered chain of historical
 * ticker symbols + their date ranges for that company. This chain is the spine
 * continuous price history hangs off of. RESOLUTION ONLY — no price stitching.
 *
 * Sources (merged in priority order):
 *   (a) SEC snapshot-DIFF  — `data/sec-snapshots/ct_{YYYY}.json`. Diffs a CIK's
 *        ticker across annual snapshots to find when the symbol changed. This is
 *        the OLD-symbol driver (~88.5% of real rename breaks). Year-granular.
 *   (b) SEC formerNames    — `parseFormerNames()` (submissions.json). Company
 *        name + day-exact date ranges. The name backbone; also yields current
 *        tickers + the earliest-filing-date recycling-hazard prune field.
 *   (c) stockanalysis.com  — `data/sec-sa-changes/changes_{YYYY}.html`. "Old" /
 *        "New" symbol columns with day-exact transition dates (weak, free, best
 *        effort). Used only to REFINE snapshot boundaries, never to invent.
 *
 * TICKER-RECYCLING HAZARD: Polygon silently concatenates histories of companies
 * reusing the same symbol. Every chain carries `earliestFilingDate`; downstream
 * consumers MUST discard bars predating it.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseFormerNames, type FormerNameEntry } from '@/lib/sec/submissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChainSource = 'snapshot-diff' | 'sec-submissions' | 'stockanalysis' | 'merged';

export interface TickerChainEntry {
  symbol: string | null; // null = name-only backbone period (symbol unknown)
  name: string | null; // company name active during this period
  startDate: Date | null;
  endDate: Date | null; // null = open-ended / ongoing
  source: ChainSource;
}

export interface TickerChain {
  cik: string; // 10-digit zero-padded
  currentSymbol: string | null;
  currentName: string | null;
  currentTickers: string[];
  /** Earliest evidence this CIK existed. Discard pre-date bars (recycling hazard). */
  earliestFilingDate: Date | null;
  chain: TickerChainEntry[]; // ordered oldest → newest
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Zero-pad a CIK (number or string) to SEC's 10-digit form. */
export function padCik10(cik: number | string): string {
  return String(cik).padStart(10, '0');
}

/** "Dec 29, 2023" → Date (UTC noon-safe). Null if unparseable. */
export function parseMonthDayYear(s: string): Date | null {
  const m = s.match(/([A-Z][a-z]{2})\s+(\d{1,2}),?\s*(\d{4})/);
  if (!m) return null;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const mo = months[m[1]];
  if (mo === undefined) return null;
  const d = new Date(Date.UTC(Number(m[3]), mo, Number(m[2])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Best company name for a given year from the formerNames backbone. */
export function nameForYear(
  formerNames: FormerNameEntry[],
  currentName: string | null,
  year: number,
): string | null {
  const mid = new Date(Date.UTC(year, 5, 1)).getTime(); // ~mid-year probe
  for (const f of formerNames) {
    const s = f.startDate?.getTime() ?? -Infinity;
    const e = f.endDate?.getTime() ?? Infinity;
    if (mid >= s && mid <= e) return f.name;
  }
  return currentName ?? null;
}

// ---------------------------------------------------------------------------
// Source (a) — annual SEC snapshots (memoized)
// ---------------------------------------------------------------------------

interface SnapRow { cik_str: number; ticker: string; title?: string }

let snapshotCache: Map<number, Map<string, string>> | null = null; // year → (cik10 → ticker)
const SNAP_DIR = path.join(process.cwd(), 'data', 'sec-snapshots');

async function loadSnapshots(): Promise<Map<number, Map<string, string>>> {
  if (snapshotCache) return snapshotCache;
  const byYear = new Map<number, Map<string, string>>();
  const files = await fs.readdir(SNAP_DIR).catch(() => [] as string[]);
  for (const f of files) {
    const m = f.match(/^ct_(\d{4})\.json$/);
    if (!m) continue;
    const year = Number(m[1]);
    const raw = JSON.parse(await fs.readFile(path.join(SNAP_DIR, f), 'utf8'));
    const rows: SnapRow[] = Array.isArray(raw) ? raw : Object.values(raw);
    const idx = new Map<string, string>();
    for (const r of rows) {
      if (r && r.ticker) idx.set(padCik10(r.cik_str), r.ticker.toUpperCase());
    }
    byYear.set(year, idx);
  }
  snapshotCache = byYear;
  return byYear;
}

interface SymbolPeriod { symbol: string; startYear: number; endYear: number }

/**
 * Snapshot-DIFF: ordered symbols this CIK traded under. Consecutive years with
 * the same ticker collapse into one period; a year with a different ticker
 * starts a new one. Dates are year-granular (Jan 1 / Dec 31) and refined later.
 */
export async function snapshotSymbolTimeline(cik: string): Promise<SymbolPeriod[]> {
  const byYear = await loadSnapshots();
  const cik10 = padCik10(cik);
  const years = [...byYear.keys()].sort((a, b) => a - b);

  const yearTicker: { year: number; ticker: string }[] = [];
  for (const y of years) {
    const t = byYear.get(y)!.get(cik10);
    if (t) yearTicker.push({ year: y, ticker: t });
  }
  if (!yearTicker.length) return [];

  const periods: SymbolPeriod[] = [];
  let cur: SymbolPeriod = { symbol: yearTicker[0].ticker, startYear: yearTicker[0].year, endYear: yearTicker[0].year };
  for (let i = 1; i < yearTicker.length; i++) {
    const { year, ticker } = yearTicker[i];
    if (ticker === cur.symbol) cur.endYear = year;
    else { periods.push(cur); cur = { symbol: ticker, startYear: year, endYear: year }; }
  }
  periods.push(cur);
  return periods;
}

// ---------------------------------------------------------------------------
// Source (c) — stockanalysis.com change tables (memoized, best-effort)
// ---------------------------------------------------------------------------

interface SaTransition { date: Date; old: string; neu: string; company: string }
let saCache: Map<number, SaTransition[]> | null = null; // year → transitions
const SA_DIR = path.join(process.cwd(), 'data', 'sec-sa-changes');

export async function loadSaTransitions(): Promise<Map<number, SaTransition[]>> {
  if (saCache) return saCache;
  const byYear = new Map<number, SaTransition[]>();
  const files = await fs.readdir(SA_DIR).catch(() => [] as string[]);
  for (const f of files) {
    const m = f.match(/^changes_(\d{4})\.html$/);
    if (!m) continue;
    const year = Number(m[1]);
    const html = await fs.readFile(path.join(SA_DIR, f), 'utf8');
    const clean = html.replace(/<!--[\s\S]*?-->/g, ''); // strip Svelte markers
    const cells = [...clean.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((mm) => mm[1].replace(/<[^>]+>/g, '').trim());
    const rows: SaTransition[] = [];
    for (let i = 0; i + 3 < cells.length; i += 4) {
      const [d, old, neu, company] = cells.slice(i, i + 4);
      const date = parseMonthDayYear(d);
      if (!date) continue;
      rows.push({ date, old: (old || '').toUpperCase(), neu: (neu || '').toUpperCase(), company });
    }
    byYear.set(year, rows);
  }
  saCache = byYear;
  return byYear;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the full ticker/name chain for a CIK (10-digit or unpadded).
 * Fetches live formerNames from SEC + diffs bundled snapshots. Never throws on
 * missing optional data (snapshots/SA) — degrades to the formerNames backbone.
 */
export async function resolveTickerChain(cik: string): Promise<TickerChain> {
  const cik10 = padCik10(cik);

  // (b) Live SEC formerNames backbone.
  const fn = await parseFormerNames(cik10);

  // (a) Snapshot symbol timeline (year-granular).
  const snap = await snapshotSymbolTimeline(cik10).catch(() => [] as SymbolPeriod[]);

  // (c) SA transitions that touch any symbol this CIK has used.
  const knownSymbols = new Set<string>([
    ...snap.map((p) => p.symbol),
    ...fn.currentTickers.map((t) => t.toUpperCase()),
  ]);
  const saByYear = await loadSaTransitions().catch(() => new Map<number, SaTransition[]>());
  const saMatches: SaTransition[] = [];
  for (const rows of saByYear.values()) {
    for (const r of rows) {
      if (knownSymbols.has(r.neu) || knownSymbols.has(r.old)) saMatches.push(r);
    }
  }

  const entries: TickerChainEntry[] = [];

  if (snap.length) {
    // Snapshot symbol spine with year-granular dates.
    for (let i = 0; i < snap.length; i++) {
      const p = snap[i];
      const isLast = i === snap.length - 1;
      const curSym = fn.currentTickers[0]?.toUpperCase();
      const openEnded = isLast && !!curSym && p.symbol === curSym;
      entries.push({
        symbol: p.symbol,
        name: nameForYear(fn.formerNames, fn.currentName, p.startYear),
        startDate: new Date(Date.UTC(p.startYear, 0, 1)),
        endDate: openEnded ? null : new Date(Date.UTC(p.endYear, 11, 31)),
        source: 'snapshot-diff',
      });
    }

    // Refine adjacent-symbol boundaries with day-exact SA dates where matched.
    for (let i = 0; i + 1 < entries.length; i++) {
      const cur = entries[i];
      const nxt = entries[i + 1];
      const hit = saMatches.find((r) => r.old === cur.symbol && r.neu === nxt.symbol);
      if (hit) {
        cur.endDate = hit.date;
        nxt.startDate = hit.date;
        cur.source = 'merged';
        nxt.source = 'merged';
      }
    }

    // If the current symbol is newer than the last snapshot (post-2024 gap,
    // e.g. DFSC: KMA → DFSC after the 2024 snapshot), append it from formerNames.
    const last = entries[entries.length - 1];
    const curSym = fn.currentTickers[0]?.toUpperCase() ?? null;
    if (curSym && last.symbol !== curSym) {
      const lastFormerEnd = fn.formerNames.at(-1)?.endDate ?? null;
      entries.push({
        symbol: curSym,
        name: fn.currentName,
        // Prefer the day-exact formerName rename date over the coarse snapshot end.
        startDate: lastFormerEnd ?? last.endDate,
        endDate: null,
        source: 'sec-submissions',
      });
    }
  } else {
    // No snapshot coverage for this CIK (post-2024 gap / not in snapshots).
    // Emit the formerNames name backbone + the current symbol as name+date only.
    for (const f of fn.formerNames) {
      entries.push({
        symbol: null,
        name: f.name,
        startDate: f.startDate,
        endDate: f.endDate,
        source: 'sec-submissions',
      });
    }
    const curSym = fn.currentTickers[0]?.toUpperCase() ?? null;
    entries.push({
      symbol: curSym,
      name: fn.currentName,
      startDate: fn.formerNames.at(-1)?.endDate ?? fn.earliestFilingDate,
      endDate: null,
      source: 'sec-submissions',
    });
  }

  // Ensure the name backbone is complete: every formerName must appear in the
  // chain. The snapshot spine only names periods it covers (2017+), so historical
  // names predating the snapshot window — e.g. a 1990s name for a company whose
  // snapshots start in 2017 — would otherwise be dropped. Add name-only entries
  // for any formerName not yet represented, then re-sort oldest → newest.
  const presentNames = new Set(entries.map((e) => e.name).filter((n): n is string => !!n));
  for (const f of fn.formerNames) {
    if (!presentNames.has(f.name)) {
      entries.push({
        symbol: null,
        name: f.name,
        startDate: f.startDate,
        endDate: f.endDate,
        source: 'sec-submissions',
      });
    }
  }
  entries.sort((a, b) => {
    const ta = a.startDate?.getTime() ?? -Infinity;
    const tb = b.startDate?.getTime() ?? -Infinity;
    return ta - tb;
  });

  const currentSymbol =
    fn.currentTickers[0]?.toUpperCase() ?? snap.at(-1)?.symbol ?? entries.at(-1)?.symbol ?? null;

  return {
    cik: cik10,
    currentSymbol,
    currentName: fn.currentName,
    currentTickers: fn.currentTickers,
    earliestFilingDate: fn.earliestFilingDate,
    chain: entries,
  };
}

/**
 * Resolve the ticker chain starting from a (current) ticker. Uses the
 * SecTickerCik table to map ticker → CIK, then resolves the chain. Returns null
 * if the ticker is unknown (e.g. an OLD symbol not present as a current ticker).
 */
export async function resolveTickerChainByTicker(ticker: string): Promise<TickerChain | null> {
  const { prisma } = await import('@/lib/prisma');
  const row = await prisma.secTickerCik.findUnique({ where: { ticker: ticker.toUpperCase() } });
  if (!row) return null;
  return resolveTickerChain(row.cik);
}
