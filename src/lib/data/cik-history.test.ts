/**
 * REQ-571 Phase 2/3 — regression tests for the continuous-history STITCHER.
 *
 * Locks the pure adjustment LOGIC hermetically: split-ratio parsing/scaling, the
 * ticker-recycling guardrail interaction, and rename-boundary dedup. The on-chain
 * (DB + Polygon) integration is validated live via the cik-bars route (see the
 * plan's curl checks); these tests run offline with zero network or DB access by
 * exercising the exported pure helpers directly.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAppliedSplits,
  scaleBar,
  dedupBoundaryBars,
  type ContinuousBar,
} from '@/lib/data/cik-history';
import type { ReverseSplit } from '@/lib/sec/reverse-splits';

const mk = (
  t: string,
  c: number,
  v: number,
  sourceSymbol = 'X',
): ContinuousBar => ({
  t,
  o: c,
  h: c,
  l: c,
  c,
  v,
  sourceSymbol,
});

const rs = (
  ratio: string,
  executionDate: string | null,
  announcementDate = executionDate ?? '2020-01-01',
): ReverseSplit => ({
  ratio,
  executionDate,
  announcementDate,
  accessionNo: 'A',
  url: 'u',
});

describe('buildAppliedSplits', () => {
  it('parses a 1-for-5 reverse split into price×5 / volume×0.2', () => {
    const out = buildAppliedSplits([rs('1-for-5', '2024-06-01')]);
    expect(out).toHaveLength(1);
    expect(out[0].priceFactor).toBeCloseTo(5, 6);
    expect(out[0].volumeFactor).toBeCloseTo(0.2, 6);
    expect(out[0].executionDate).toBe('2024-06-01');
  });

  it('falls back to announcementDate when executionDate is null', () => {
    const out = buildAppliedSplits([rs('1-for-3', null, '2024-03-10')]);
    expect(out[0].executionDate).toBe('2024-03-10');
  });

  it('sorts events executionDate-ascending', () => {
    const out = buildAppliedSplits([
      rs('1-for-2', '2024-12-01'),
      rs('1-for-10', '2023-01-01'),
    ]);
    expect(out.map((s) => s.executionDate)).toEqual(['2023-01-01', '2024-12-01']);
  });

  it('dedupes announce+effectiveness filings for the same event (windowDays)', () => {
    const out = buildAppliedSplits([
      rs('1-for-4', '2024-06-10'), // effectiveness
      rs('1-for-4', '2024-05-20'), // announce
    ]);
    expect(out).toHaveLength(1);
  });

  it('skips unparseable ratios rather than corrupting the series', () => {
    // A lone bogus entry is dropped entirely (empty result).
    expect(buildAppliedSplits([rs('bogus', '2024-01-01')])).toEqual([]);
    // A valid entry alongside is kept; spaced >60d so dedupeSplits does not
    // cluster them (announce+effectiveness of one event share the SAME ratio).
    const out = buildAppliedSplits([rs('bogus', '2024-01-01'), rs('1-for-8', '2024-05-01')]);
    expect(out).toHaveLength(1);
    expect(out[0].priceFactor).toBeCloseTo(8, 6);
  });
});

describe('scaleBar', () => {
  it('scales a pre-split bar (price×5, volume÷5) and leaves post-split bars alone', () => {
    const splits = buildAppliedSplits([rs('1-for-5', '2024-06-01')]);
    const pre = scaleBar(mk('2024-05-31', 1.0, 5000), splits);
    const post = scaleBar(mk('2024-06-01', 5.0, 1000), splits);

    expect(pre.o).toBeCloseTo(5.0, 6);
    expect(pre.c).toBeCloseTo(5.0, 6);
    expect(pre.v).toBe(1000); // 5000 / 5

    // boundary date (=== executionDate) is NOT pre-split → unchanged
    expect(post.o).toBeCloseTo(5.0, 6);
    expect(post.v).toBe(1000);
  });

  it('compounds multiple splits for a bar older than several events', () => {
    // 1-for-2 then 1-for-3: a bar before both → price ×6, volume ÷6
    const splits = buildAppliedSplits([
      rs('1-for-2', '2024-01-01'),
      rs('1-for-3', '2024-06-01'),
    ]);
    const b = scaleBar(mk('2023-12-31', 1.0, 6000), splits);
    expect(b.o).toBeCloseTo(6.0, 6); // ×2 ×3
    expect(b.v).toBe(1000); // 6000 /6
  });
});

describe('dedupBoundaryBars', () => {
  it('keeps the NEW (later) symbol on a shared boundary date', () => {
    const bars = [
      mk('2025-06-26', 1.0, 100, 'OLDSYM'), // last day of old ticker
      mk('2025-06-26', 2.0, 200, 'NEWSYM'), // first day of new ticker
      mk('2025-06-27', 2.1, 210, 'NEWSYM'),
    ];
    const out = dedupBoundaryBars(bars);
    expect(out).toHaveLength(2);
    expect(out[0].sourceSymbol).toBe('NEWSYM'); // old dropped on the boundary
    expect(out[1].sourceSymbol).toBe('NEWSYM');
  });

  it('is a no-op when no dates overlap', () => {
    const bars = [mk('2025-06-24', 1, 1, 'OLD'), mk('2025-06-26', 2, 2, 'NEW')];
    expect(dedupBoundaryBars(bars)).toHaveLength(2);
  });

  it('keeps the last bar when 3+ share a date', () => {
    const bars = [
      mk('d', 1, 1, 'A'),
      mk('d', 2, 2, 'B'),
      mk('d', 3, 3, 'C'),
      mk('e', 4, 4, 'C'),
    ];
    const out = dedupBoundaryBars(bars);
    expect(out.map((b) => b.sourceSymbol)).toEqual(['C', 'C']);
  });
});
