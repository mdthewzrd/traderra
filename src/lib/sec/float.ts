/**
 * Public float — SEC-derived, no paid feed.
 *
 * The 10-K / 20-F cover page reports "aggregate market value of voting common
 * equity held by non-affiliates" — the SEC's OWN definition of public float.
 * It's tagged in XBRL as `dei:EntityPublicFloat` and exposed as a single tiny
 * concept JSON (not the multi-MB companyfacts). This is MORE authoritative than
 * a third-party float feed (it's the company's SEC filing), with one tradeoff:
 * it's updated annually on the cover, so it can be stale for fast-diluting
 * names. We surface the as-of date explicitly so staleness is never hidden.
 *
 * The cover figure is a market VALUE ($). Float SHARES = value ÷ close price on
 * the cover date (Polygon /v2/aggs/one, one call). We persist both the value and
 * the derived share count so the snapshot + scan can use the number without a
 * per-view price lookup.
 *
 * Honest degradation: if the concept is absent (some filers skip it) or the
 * cover-date price is missing (illiquid/halted), we persist nothing — the header
 * falls back to "Shares Out" (current Polygon) which we never mislabel as float.
 */
import { prisma } from '@/lib/prisma';
import { secFetchJson } from '@/lib/sec/client';
import { padCik } from '@/lib/sec/cik-map';

const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r';

interface DeiConcept {
  units?: Record<string, Array<{ end?: string; val?: number; fy?: number; fp?: string; form?: string }>>;
}

/** Latest EntityPublicFloat entry (USD) — the 10-K cover non-affiliate float. */
async function fetchPublicFloat(cik: string): Promise<{ value: number; asOf: string; form: string | null } | null> {
  try {
    const url = `https://data.sec.gov/api/xbrl/companyconcept/CIK${padCik(cik)}/dei/EntityPublicFloat.json`;
    const j = await secFetchJson<DeiConcept>(url);
    const usd = j.units?.USD;
    if (!Array.isArray(usd) || !usd.length) return null;
    // Newest by end; prefer 10-K/20-F form cover (annual) over 10-Q cover.
    const sorted = [...usd]
      .filter((e) => typeof e.val === 'number' && e.val > 0 && e.end)
      .sort((a, b) => {
        const f = (x: typeof a) => (/(10-K|20-F)/.test(x.form ?? '') ? 0 : 1);
        if (f(a) !== f(b)) return f(a) - f(b);
        return (a.end! < b.end! ? 1 : a.end! > b.end! ? -1 : 0);
      });
    const top = sorted[0];
    if (!top) return null;
    return { value: top.val as number, asOf: top.end as string, form: top.form ?? null };
  } catch {
    return null;
  }
}

/** Close price on a specific date — for float-share math. Only the proper
 *  single-day endpoint (/v1/open-close) works; returns null if Polygon has no
 *  history for that ticker/day (common for micro-cap & recent de-SPAC names),
 *  in which case float SHARES stay null but the float VALUE still stands. */
async function fetchCloseOn(ticker: string, date: string): Promise<number | null> {
  try {
    const url = `https://api.polygon.io/v1/open-close/${encodeURIComponent(ticker)}/${date}?adjusted=true&apiKey=${POLY_KEY}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 0 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { close?: number };
    return typeof j.close === 'number' && j.close > 0 ? j.close : null;
  } catch {
    return null;
  }
}

export interface SyncFloatResult {
  status: 'success' | 'no-data' | 'skipped';
  publicFloatValue: number | null; // USD market value of non-affiliate shares
  floatShares: number | null; // value ÷ cover-date close
  asOf: string | null; // cover date (period-end of the float figure)
  form: string | null;
}

/** Extract + persist public float for a CIK. Self-contained: one SEC concept
 *  fetch + one Polygon historical close. Degrades to null on any miss. */
export async function syncFloat(cik: string, ticker?: string | null): Promise<SyncFloatResult> {
  const pf = await fetchPublicFloat(cik);
  if (!pf) return { status: 'no-data', publicFloatValue: null, floatShares: null, asOf: null, form: null };

  let floatShares: number | null = null;
  if (ticker) {
    const close = await fetchCloseOn(ticker, pf.asOf);
    if (close) floatShares = pf.value / close;
  }

  // Persist value + derived shares, keyed on the cover date (period). The date
  // doubles as the staleness label in the UI. Stale annual figures are the
  // honest state until the next 10-K cover — we never overwrite with nothing.
  await prisma.dilutionFact.upsert({
    where: { cik_fact_period: { cik, fact: 'PublicFloat', period: pf.asOf } },
    create: { cik, fact: 'PublicFloat', period: pf.asOf, unit: 'USD', val: pf.value },
    update: { val: pf.value },
  });
  if (floatShares !== null) {
    await prisma.dilutionFact.upsert({
      where: { cik_fact_period: { cik, fact: 'PublicFloatShares', period: pf.asOf } },
      create: { cik, fact: 'PublicFloatShares', period: pf.asOf, unit: 'shares', val: floatShares },
      update: { val: floatShares },
    });
  }

  return { status: 'success', publicFloatValue: pf.value, floatShares, asOf: pf.asOf, form: pf.form };
}
