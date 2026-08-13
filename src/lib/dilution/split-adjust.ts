/**
 * Split-adjustment for stale warrant/convertible overhang.
 *
 * Problem (Gap 4): the XBRL overhang (computeOverhangFromDb) takes the LATEST
 * reported warrant/convertible share count + strike AS-REPORTED for that period.
 * When a company does a reverse (or forward) stock split AFTER that period and
 * hasn't re-filed a 10-Q/10-K re-tagging the warrants, the stored strike/shares
 * are pre-split — wrong vs the live price and shares outstanding.
 *
 * Fix: compare the instrument's `period` against the company's split history.
 * For every split effective AFTER the period, apply the ratio:
 *   shares  × (num/den)   // num = new shares, den = old (per reverse-splits.ts)
 *   strike  × (den/num)
 * The general formula handles both reverse (1-for-N) and forward (M-for-1).
 *
 * Same corporate event is reported across multiple filings (8-K announce +
 * effectiveness + amendment) → dedupe by chaining splits within `windowDays`.
 */
import type { ReverseSplit } from '@/lib/sec/reverse-splits';

/** Effective date of a split: stated execution date, else the filing date. */
export function effectiveDate(s: ReverseSplit): string {
  return s.executionDate ?? s.announcementDate;
}

/** Parse "1-for-3" / "1:3" / "1 to 3" → [num=1, den=3]. null if unparseable. */
export function parseRatio(ratio: string): [num: number, den: number] | null {
  const m = ratio.match(/(\d+)\s*[-:]?\s*(?:for|to)\s*[-:]?\s*(\d+)/i);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!isFinite(num) || !isFinite(den) || num <= 0 || den <= 0) return null;
  return [num, den];
}

/**
 * Collapse split records describing the SAME event. Walks oldest→newest,
 * chaining records whose effective date is within `windowDays` of the previous
 * cluster member. Reverse/forward splits are rare (>6mo apart in practice), so
 * a 60-day chain safely merges announce+effectiveness+amendment for one event.
 */
export function dedupeSplits(splits: ReverseSplit[], windowDays = 60): ReverseSplit[] {
  if (splits.length <= 1) return [...splits];
  const sorted = [...splits].sort((a, b) => effectiveDate(a).localeCompare(effectiveDate(b)));
  const events: ReverseSplit[] = [];
  let cluster: ReverseSplit[] = [];
  for (const s of sorted) {
    if (cluster.length === 0) {
      cluster = [s];
      continue;
    }
    const last = cluster[cluster.length - 1];
    const gapDays = (Date.parse(effectiveDate(s)) - Date.parse(effectiveDate(last))) / 86_400_000;
    if (gapDays <= windowDays) cluster.push(s);
    else {
      // earliest effective date is the binding comparison date for "pre-split?"
      events.push(cluster.reduce((a, b) => (effectiveDate(a) <= effectiveDate(b) ? a : b)));
      cluster = [s];
    }
  }
  if (cluster.length) {
    events.push(cluster.reduce((a, b) => (effectiveDate(a) <= effectiveDate(b) ? a : b)));
  }
  return events;
}

export interface SplitAdjustment {
  /** true if ≥1 split post-dates the period and changes the values. */
  applied: boolean;
  /** multiply instrument shares by this (prod of num/den). */
  shareFactor: number;
  /** multiply instrument strike by this (prod of den/num). */
  priceFactor: number;
  /** human-readable, e.g. "1-for-30 R/S @ 2026-06-01". */
  note: string | null;
  /** count of distinct events applied. */
  count: number;
}

const NOOP: SplitAdjustment = { applied: false, shareFactor: 1, priceFactor: 1, note: null, count: 0 };

/**
 * Compute the cumulative split adjustment for an instrument whose latest
 * reported `period` predates one or more splits. Returns identity (applied:false)
 * when the period is at/after all split dates or no ratio is parseable.
 */
export function splitAdjustment(period: string, splits: ReverseSplit[]): SplitAdjustment {
  if (!period || splits.length === 0) return NOOP;
  const events = dedupeSplits(splits);
  const applicable = events.filter((s) => effectiveDate(s) > period);
  if (applicable.length === 0) return NOOP;

  let shareFactor = 1;
  let priceFactor = 1;
  let parsed = 0;
  const labels: string[] = [];
  for (const s of applicable) {
    const r = parseRatio(s.ratio);
    if (!r) continue;
    const [num, den] = r;
    shareFactor *= num / den;
    priceFactor *= den / num;
    parsed++;
    labels.push(`${s.ratio} @ ${effectiveDate(s)}`);
  }
  if (parsed === 0 || Math.abs(shareFactor - 1) < 1e-9) return NOOP;
  const kind = shareFactor < 1 ? 'R/S' : 'split';
  return {
    applied: true,
    shareFactor,
    priceFactor,
    note: `${labels.join(' + ')} ${kind}`,
    count: parsed,
  };
}
