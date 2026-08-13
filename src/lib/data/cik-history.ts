/**
 * REQ-571 Phase 2/3 — Continuous CIK-keyed price-history stitcher.
 *
 * Given a ticker OR CIK, returns ONE continuous, corporate-action-adjusted daily
 * OHLCV series spanning ALL historical symbols for that company, with reverse-
 * split boundaries scaled so the line is continuous across the split.
 *
 * Builds on Phase 1 (resolveTickerChain) and reuses the existing reverse-split
 * infra (getReverseSplits) + split-adjust helpers (dedupeSplits, parseRatio,
 * effectiveDate). Fetches RAW (adjusted=false) Polygon segments so the SEC-
 * sourced splits are the SOLE adjustment layer (no double-scaling vs Polygon's
 * own per-symbol adjustment).
 *
 * GUARDRAIL (ticker-recycling hazard): two unrelated companies can share a
 * recycled symbol; only bars at/after the CIK's first SEC filing belong to THIS
 * entity. Bars predating earliestFilingDate are pruned.
 *
 * ADDITIVE: this module is new. It does not modify bars/route.ts or any scan
 * engine file.
 */
import {
  resolveTickerChain,
  resolveTickerChainByTicker,
  type TickerChain,
} from '@/lib/sec/ticker-chain';
import { getReverseSplits, type ReverseSplit } from '@/lib/sec/reverse-splits';
import {
  dedupeSplits,
  parseRatio,
  effectiveDate,
} from '@/lib/dilution/split-adjust';
import { fetchPolygonAggs } from '@/lib/data/polygon-aggs';

export interface ContinuousBar {
  /** 'YYYY-MM-DD'. */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  /** Which historical ticker this bar was fetched under. */
  sourceSymbol: string;
}

export interface AppliedSplit {
  ratio: string;
  executionDate: string;
  /** Multiply pre-split PRICE by this to express it post-split. */
  priceFactor: number;
}

/**
 * Internal resolved split (includes volume factor used during scaling but trimmed
 * from the public AppliedSplit response).
 */
export interface ResolvedSplit extends AppliedSplit {
  /** Multiply pre-split VOLUME by this (reciprocal of priceFactor). */
  volumeFactor: number;
}

export interface ContinuousHistory {
  cik: string;
  symbol: string;
  bars: ContinuousBar[];
  splits: AppliedSplit[];
  earliestFilingDate: string | null;
  chain: {
    symbol: string;
    startDate: string | null;
    endDate: string | null;
    source: string;
  }[];
}

export interface GetContinuousHistoryOptions {
  ticker?: string;
  cik?: string;
  /** 'YYYY-MM-DD' inclusive lower bound. */
  from?: string;
  /** 'YYYY-MM-DD' inclusive upper bound. */
  to?: string;
}

function toIsoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/**
 * Dedupe + sort + ratio-parse raw reverse splits into ordered, resolvable events.
 * PURE (no I/O) — exported for unit testing.
 *
 * Convention (per split-adjust.ts doc): parseRatio("1-for-5") → [num=1, den=5]
 * where num = NEW shares, den = OLD shares. To express a pre-split bar in
 * post-split terms: price × (den/num), volume × (num/den). A 1-for-5 reverse
 * split → priceFactor 5, volumeFactor 0.2 (price 5×, volume ÷5).
 */
export function buildAppliedSplits(raw: ReverseSplit[]): ResolvedSplit[] {
  const events = dedupeSplits(raw).sort((a, b) =>
    effectiveDate(a).localeCompare(effectiveDate(b)),
  );
  const resolved: ResolvedSplit[] = [];
  for (const s of events) {
    const r = parseRatio(s.ratio);
    if (!r) continue; // unparseable ratio → skip rather than corrupt the series
    const [num, den] = r;
    resolved.push({
      ratio: s.ratio,
      executionDate: effectiveDate(s),
      priceFactor: den / num,
      volumeFactor: num / den,
    });
  }
  // executionDate ascending so a bar predating multiple splits accumulates each
  // factor in the correct order.
  return resolved.sort((a, b) => a.executionDate.localeCompare(b.executionDate));
}

/**
 * Apply reverse-split scaling to a single bar. PURE — exported for unit testing.
 * For every split whose executionDate is AFTER the bar's date, scale OHLC by
 * priceFactor and volume by volumeFactor. A bar older than several splits
 * accumulates every applicable factor (continuous across compound events).
 */
export function scaleBar(bar: ContinuousBar, splits: ResolvedSplit[]): ContinuousBar {
  let o = bar.o;
  let h = bar.h;
  let l = bar.l;
  let c = bar.c;
  let v = bar.v;
  for (const ev of splits) {
    if (bar.t < ev.executionDate) {
      o *= ev.priceFactor;
      h *= ev.priceFactor;
      l *= ev.priceFactor;
      c *= ev.priceFactor;
      v = Math.round(v * ev.volumeFactor);
    }
  }
  return { t: bar.t, o, h, l, c, v, sourceSymbol: bar.sourceSymbol };
}

/**
 * De-duplicate rename-boundary overlap. Input MUST be date-ascending; within a
 * shared date the bars are assumed ordered oldest-symbol → newest-symbol (the
 * chain is chronological). We keep the LAST bar per date so the NEW symbol wins
 * on the boundary day (its bar reflects the live ticker's session). PURE.
 */
export function dedupBoundaryBars(bars: ContinuousBar[]): ContinuousBar[] {
  const out: ContinuousBar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const next = bars[i + 1];
    if (next && next.t === bars[i].t) continue; // a newer-symbol bar shares this date → drop the older
    out.push(bars[i]);
  }
  return out;
}

export async function getContinuousHistory(
  opts: GetContinuousHistoryOptions,
): Promise<ContinuousHistory> {
  const { ticker, cik, from, to } = opts;
  if (!cik && !ticker) {
    throw new Error('getContinuousHistory requires either `ticker` or `cik`');
  }

  // --- 1. Resolve the ticker chain (Phase 1) ---
  const chain: TickerChain | null = cik
    ? await resolveTickerChain(cik)
    : await resolveTickerChainByTicker(ticker!);
  if (!chain) {
    throw new Error(
      `No SEC ticker chain resolved for ${cik ? `CIK ${cik}` : `ticker ${ticker}`}`,
    );
  }

  const earliestIso = toIsoDate(chain.earliestFilingDate);
  const toDate = to || new Date().toISOString().slice(0, 10);
  // Default lower bound is the earliest filing so the full recoverable company
  // history is returned (the bars route defaults to last 30d; a continuous-
  // history consumer wants the whole timeline).
  const fromDate = from || earliestIso || toDate;

  // --- 2. Fetch RAW daily aggs per chain entry (adjusted=false) ---
  const segments: ContinuousBar[][] = [];
  for (const entry of chain.chain) {
    if (!entry.symbol) continue; // name-only backbone period, no market data
    let segFrom = toIsoDate(entry.startDate) || fromDate;
    let segTo = toIsoDate(entry.endDate) || toDate;
    // Clamp the fetch window to the company's recoverable range so we don't pull
    // years of an unrelated company's recycled-symbol history (the guardrail
    // below would drop it anyway) or data beyond the requested `to`.
    if (earliestIso && segFrom < earliestIso) segFrom = earliestIso;
    if (segTo > toDate) segTo = toDate;
    if (segFrom > segTo) continue;
    try {
      const aggs = await fetchPolygonAggs(entry.symbol, {
        from: segFrom,
        to: segTo,
        adjusted: false,
      });
      segments.push(
        aggs.map((a) => ({
          t: new Date(a.t).toISOString().slice(0, 10),
          o: a.o,
          h: a.h,
          l: a.l,
          c: a.c,
          v: a.v,
          sourceSymbol: entry.symbol!,
        })),
      );
    } catch {
      // Transport errors (429 rate limit, transient 5xx, DNS) for a delisted or
      // foreign (TSXV) symbol → degrade gracefully: this segment contributes no
      // bars. The boundary dedup still joins whatever segments DID resolve.
      segments.push([]);
    }
  }

  // Flatten + date-sort. Stable sort preserves chain order within a shared date
  // (older symbol first) so dedupBoundaryBars can prefer the newer symbol.
  const sorted = segments
    .flat()
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));

  // --- 3. CIK guardrail: prune bars before earliestFilingDate ---
  const guarded = earliestIso ? sorted.filter((b) => b.t >= earliestIso) : sorted;

  // --- 4. Reverse-split scaling (sole adjustment layer) ---
  const splits = buildAppliedSplits(await getReverseSplits(chain.cik));
  const scaled = splits.length ? guarded.map((b) => scaleBar(b, splits)) : guarded;

  // --- 5. Dedup rename-boundary overlap (prefer NEW symbol on shared date) ---
  const deduped = dedupBoundaryBars(scaled);

  // --- 6. Final user-range filter + public response (trim volumeFactor) ---
  const bars = deduped.filter(
    (b) => (!from || b.t >= from) && (!to || b.t <= to),
  );

  return {
    cik: chain.cik,
    symbol: chain.currentSymbol,
    bars,
    splits: splits.map(({ ratio, executionDate, priceFactor }) => ({
      ratio,
      executionDate,
      priceFactor,
    })),
    earliestFilingDate: earliestIso,
    chain: chain.chain.map((e) => ({
      symbol: e.symbol ?? chain.currentSymbol,
      startDate: toIsoDate(e.startDate),
      endDate: toIsoDate(e.endDate),
      source: e.source,
    })),
  };
}
