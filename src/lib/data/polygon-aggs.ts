/**
 * REQ-571 Phase 2 — Reusable Polygon aggregates fetcher.
 *
 * Adapted from the inline loop in src/app/api/chart-data/bars/route.ts (which
 * stays UNTOUCHED — this phase is strictly additive). Mirrors the same URL shape
 * (`/v2/aggs/ticker/.../range/...`), `next_url` pagination (capped at 25 pages),
 * and free-tier pacing (120ms between pages). DIVERGES from the original on
 * error handling: an unknown/not-found ticker returns [] here (so the stitcher
 * degrades gracefully) rather than surfacing an error to the client.
 *
 * Adds an `adjusted` flag the bars route hardcodes to `true`. The CIK stitcher
 * passes `adjusted=false` so SEC-sourced reverse splits (getReverseSplits) are
 * the SOLE adjustment layer — otherwise Polygon's own per-symbol split adjustment
 * and ours would double-scale the prices.
 *
 * Phase 4 may refactor bars/route.ts onto this client; today it only exists to be
 * imported by cik-history.ts without touching the protected route.
 */
const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r';
const POLY_BASE = 'https://api.polygon.io';

export interface PolygonAgg {
  /** Polygon millisecond timestamp. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  n?: number;
}

export interface FetchAggsOptions {
  /** 'YYYY-MM-DD' inclusive start. */
  from: string;
  /** 'YYYY-MM-DD' inclusive end. */
  to: string;
  /** Bar size multiplier; default 1 (daily). */
  multiplier?: number;
  /** Polygon timespan; default 'day'. */
  timespan?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  /**
   * Polygon's own split/dividend adjustment. Default true (parity with bars
   * route). The CIK stitcher passes false to own the split math.
   */
  adjusted?: boolean;
}

/**
 * Fetch raw Polygon aggregates for a symbol over a [from, to] window, following
 * `next_url` pagination. Returns [] for a symbol Polygon has no data for
 * (delisted / foreign) rather than throwing — callers stitch segments and may
 * legitimately get empty contributions.
 */
export async function fetchPolygonAggs(
  symbol: string,
  opts: FetchAggsOptions,
): Promise<PolygonAgg[]> {
  const multiplier = opts.multiplier ?? 1;
  const timespan = opts.timespan ?? 'day';
  const adjusted = opts.adjusted ?? true;

  const all: PolygonAgg[] = [];
  let nextUrl: string | null =
    `${POLY_BASE}/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${opts.from}/${opts.to}?adjusted=${adjusted}&sort=asc&limit=50000&apiKey=${POLY_KEY}`;
  let pages = 0;
  while (nextUrl && pages < 25) {
    const resp = await fetch(nextUrl);
    const data = await resp.json();
    if (data.status === 'ERROR') {
      // Unknown/foreign ticker → no data; surface as empty so the stitcher degrades
      // gracefully. Genuine transport errors still throw below.
      if (typeof data.error === 'string' && /Unknown|not found/i.test(data.error)) {
        return all;
      }
      throw new Error(`Polygon aggs error for ${symbol}: ${data.error}`);
    }
    all.push(...((data.results || []) as PolygonAgg[]));
    nextUrl = data.next_url ? `${data.next_url}&apiKey=${POLY_KEY}` : null;
    pages++;
    if (nextUrl) await new Promise((r) => setTimeout(r, 120));
  }
  return all;
}
