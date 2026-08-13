/**
 * REQ-571 Phase 2/3 — regression tests for the continuous-history STITCHER.
 *
 * Locks the pure adjustment LOGIC hermetically: split-ratio parsing/scaling, the
 * ticker-recycling guardrail interaction, and rename-boundary dedup. The on-chain
 * (DB + Polygon) integration is validated live via the cik-bars route (see the
 * plan's curl checks); these tests run offline with zero network or DB access by
 * exercising the exported pure helpers directly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Module-level mocks for the orchestrator's I/O deps (hoisted by vitest). The
// pure-helper tests below import only pure functions and are unaffected.
const mocks = vi.hoisted(() => ({
  resolveTickerChainByTicker: vi.fn(),
  resolveTickerChain: vi.fn(),
  fetchPolygonAggs: vi.fn(),
  getReverseSplits: vi.fn(),
}));

vi.mock('@/lib/sec/ticker-chain', () => ({
  resolveTickerChainByTicker: mocks.resolveTickerChainByTicker,
  resolveTickerChain: mocks.resolveTickerChain,
}));

vi.mock('@/lib/data/polygon-aggs', () => ({
  fetchPolygonAggs: mocks.fetchPolygonAggs,
}));

vi.mock('@/lib/sec/reverse-splits', () => ({
  getReverseSplits: mocks.getReverseSplits,
}));

import {
  buildAppliedSplits,
  scaleBar,
  dedupBoundaryBars,
  getContinuousHistory,
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

  it('rounds volume ONCE across compound splits (not per-split) — regression', () => {
    // NUWE's real triple reverse split (1:5, 1:42, 1:35), spaced >60d so
    // dedupeSplits keeps all three. vol 3673 consolidates to 3673/7350 = 0.4997
    // -> single rounding 0. Per-split rounding drifts 3673 -> 735 -> 18 -> 1.
    const splits = buildAppliedSplits([
      rs('1-for-5', '2024-01-01'),
      rs('1-for-42', '2024-04-15'),
      rs('1-for-35', '2024-08-01'),
    ]);
    const out = scaleBar(mk('2023-12-15', 100.0, 3673), splits);
    expect(out.v).toBe(0); // single-rounding (correct); progressive would be 1
    expect(out.c).toBeCloseTo(735000); // 100 * 5 * 42 * 35
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

// Polygon aggs payload shape (subset the stitcher reads).
const ag = (t: string, c: number, v: number) => ({ t, o: c, h: c, l: c, c, v });

describe('getContinuousHistory (orchestration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTickerChain.mockResolvedValue(null);
    mocks.resolveTickerChainByTicker.mockResolvedValue(null);
    mocks.getReverseSplits.mockResolvedValue([]);
  });

  it('joins segments: prunes guardrail, scales splits, NEW-symbol-wins on boundary', async () => {
    mocks.resolveTickerChainByTicker.mockResolvedValue({
      cik: '000123',
      currentSymbol: 'NEW',
      currentName: 'Newco',
      earliestFilingDate: new Date('2023-06-01T00:00:00Z'),
      chain: [
        { symbol: 'OLD', name: 'Oldco', startDate: new Date('2023-01-01T00:00:00Z'), endDate: new Date('2024-06-15T00:00:00Z'), source: 'sec-submissions' },
        { symbol: 'NEW', name: 'Newco', startDate: new Date('2024-06-15T00:00:00Z'), endDate: null, source: 'sec-submissions' },
      ],
    });
    mocks.fetchPolygonAggs.mockImplementation(async (symbol: string) =>
      symbol === 'OLD'
        ? [
            ag('2023-05-15', 12, 300), // before earliestFilingDate -> pruned
            ag('2023-06-01', 10, 100), // kept; before split -> scaled 20/50
            ag('2024-01-10', 8, 200), // kept; before split -> scaled 16/100
            ag('2024-06-15', 9, 80), // boundary day; NEW wins -> dropped
          ]
        : [
            ag('2024-06-15', 18, 40), // boundary day; NEW wins; after split -> unscaled
            ag('2024-07-01', 20, 30), // after split -> unscaled
          ],
    );
    mocks.getReverseSplits.mockResolvedValue([
      { ratio: '1-for-2', executionDate: '2024-01-15', announcementDate: '2024-01-10', accessionNo: 'A', url: 'u' },
    ]);

    const h = await getContinuousHistory({ ticker: 'NEW' });

    expect(h.bars.map((b) => b.t)).toEqual(['2023-06-01', '2024-01-10', '2024-06-15', '2024-07-01']);
    expect(h.bars.map((b) => b.sourceSymbol)).toEqual(['OLD', 'OLD', 'NEW', 'NEW']); // NEW wins boundary
    expect(h.bars[0].c).toBeCloseTo(20);
    expect(h.bars[0].v).toBe(50); // OLD scaled
    expect(h.bars[1].c).toBeCloseTo(16);
    expect(h.bars[1].v).toBe(100); // OLD scaled
    expect(h.bars[2].c).toBe(18);
    expect(h.bars[2].v).toBe(40); // NEW unscaled winner
    expect(h.bars[3].c).toBe(20);
    expect(h.bars[3].v).toBe(30); // NEW unscaled
    expect(h.earliestFilingDate).toBe('2023-06-01');
    expect(h.splits).toHaveLength(1);
    expect(h.splits[0].priceFactor).toBeCloseTo(2);
    // locks the no-double-scaling contract: every segment fetched RAW
    expect(mocks.fetchPolygonAggs.mock.calls.every((c) => c[1].adjusted === false)).toBe(true);
  });

  it('degrades gracefully when a segment fetch throws (empty contribution, no crash)', async () => {
    mocks.resolveTickerChainByTicker.mockResolvedValue({
      cik: '000456',
      currentSymbol: 'NEW',
      currentName: 'Newco',
      earliestFilingDate: new Date('2023-01-01T00:00:00Z'),
      chain: [
        { symbol: 'OLD', name: 'Oldco', startDate: new Date('2023-01-01T00:00:00Z'), endDate: new Date('2024-01-01T00:00:00Z'), source: 'sec-submissions' },
        { symbol: 'NEW', name: 'Newco', startDate: new Date('2024-01-01T00:00:00Z'), endDate: null, source: 'sec-submissions' },
      ],
    });
    mocks.fetchPolygonAggs.mockImplementation(async (symbol: string) => {
      if (symbol === 'OLD') throw new Error('429 rate limit');
      return [ag('2024-02-01', 5, 10)];
    });

    const h = await getContinuousHistory({ ticker: 'NEW' });
    expect(h.bars.map((b) => b.t)).toEqual(['2024-02-01']);
    expect(h.bars[0].sourceSymbol).toBe('NEW');
  });
});
