/**
 * REQ-571 Phase 1 — regression tests for the CIK ticker-chain resolver.
 *
 * These tests lock the resolution-layer LOGIC (pure helpers, snapshot-DIFF, the
 * 3-source merge) hermetically. The only network dependency in resolveTickerChain
 * is parseFormerNames (live SEC submissions.json); it is mocked here so the suite
 * is deterministic and offline. The live DFSC endpoint is validated separately
 * (see REQ-571 evidence) — these tests guard the logic, not the wire.
 *
 * Real bundled data IS exercised: snapshotSymbolTimeline + loadSaTransitions read
 * the committed files under data/sec-snapshots and data/sec-sa-changes, so the
 * snapshot-DIFF and SA-HTML parsing paths are covered against real inputs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoist the mock so vi.mock's factory can reference it safely.
const { parseFormerNamesMock } = vi.hoisted(() => ({ parseFormerNamesMock: vi.fn() }));
vi.mock('@/lib/sec/submissions', () => ({ parseFormerNames: parseFormerNamesMock }));

import {
  resolveTickerChain,
  padCik10,
  parseMonthDayYear,
  nameForYear,
  snapshotSymbolTimeline,
  loadSaTransitions,
} from '@/lib/sec/ticker-chain';
import type { FormerNameEntry, FormerNamesResult } from '@/lib/sec/submissions';

// ---- tiny builders ---------------------------------------------------------

/** 'YYYY-MM-DD' -> Date at UTC midnight (matches the resolver's date math). */
const D = (iso: string): Date => new Date(iso + 'T00:00:00.000Z');
const fn = (name: string, from?: string, to?: string): FormerNameEntry => ({
  name,
  startDate: from ? D(from) : null,
  endDate: to ? D(to) : null,
});
const result = (r: Partial<FormerNamesResult> & { cik: string }): FormerNamesResult =>
  ({
    currentName: null,
    currentTickers: [],
    earliestFilingDate: null,
    formerNames: [],
    ...r,
  }) as FormerNamesResult;

beforeEach(() => parseFormerNamesMock.mockReset());

// ---------------------------------------------------------------------------
// Unit: padCik10
// ---------------------------------------------------------------------------

describe('padCik10', () => {
  it('zero-pads a numeric CIK to 10 digits', () => {
    expect(padCik10(320193)).toBe('0000320193');
    expect(padCik10(1889823)).toBe('0001889823');
  });
  it('zero-pads a string CIK', () => {
    expect(padCik10('320193')).toBe('0000320193');
  });
  it('leaves an already-padded CIK unchanged', () => {
    expect(padCik10('0000320193')).toBe('0000320193');
  });
});

// ---------------------------------------------------------------------------
// Unit: parseMonthDayYear
// ---------------------------------------------------------------------------

describe('parseMonthDayYear', () => {
  it('parses "Mon D, YYYY" into a UTC Date', () => {
    expect(parseMonthDayYear('Dec 29, 2023')).toEqual(D('2023-12-29'));
    expect(parseMonthDayYear('Jan 5, 2020')).toEqual(D('2020-01-05'));
    expect(parseMonthDayYear('Jul 05 2022')).toEqual(D('2022-07-05'));
  });
  it('returns null for unparseable input', () => {
    expect(parseMonthDayYear('nonsense')).toBeNull();
    expect(parseMonthDayYear('')).toBeNull();
    expect(parseMonthDayYear('Xyz 99, 0000')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unit: nameForYear
// ---------------------------------------------------------------------------

describe('nameForYear', () => {
  const formerNames = [fn('KWESST Micro Systems Inc.', '2022-07-05', '2025-06-26')];
  it('returns the name whose range covers mid-year', () => {
    expect(nameForYear(formerNames, 'DEFSEC', 2023)).toBe('KWESST Micro Systems Inc.');
  });
  it('falls back to currentName when no formerName covers the year', () => {
    expect(nameForYear(formerNames, 'DEFSEC', 2026)).toBe('DEFSEC');
  });
  it('falls back to currentName when there are no formerNames', () => {
    expect(nameForYear([], 'Solo', 2010)).toBe('Solo');
  });
  it('treats a formerName with null dates as evergreen', () => {
    const open = [fn('Eternal Co')]; // null startDate/endDate
    expect(nameForYear(open, 'Current', 1999)).toBe('Eternal Co');
  });
});

// ---------------------------------------------------------------------------
// Real data: snapshotSymbolTimeline (reads committed data/sec-snapshots)
// ---------------------------------------------------------------------------

describe('snapshotSymbolTimeline (real bundled snapshots)', () => {
  it('collapses the Lumen CTL -> LUMN transition', async () => {
    const tl = await snapshotSymbolTimeline('0000018926');
    expect(tl).toEqual([
      { symbol: 'CTL', startYear: 2017, endYear: 2020 },
      { symbol: 'LUMN', startYear: 2021, endYear: 2024 },
    ]);
  });
  it('records the DFSC multi-ticker years (Map last-wins within a year)', async () => {
    // CIK 0001889823 has two rows in ct_2024 (common KWE + warrant KWESW);
    // the resolver keeps one symbol per period (last row wins). This is the
    // documented Phase-1 one-symbol-per-period simplification, not a bug.
    const tl = await snapshotSymbolTimeline('0001889823');
    expect(tl).toEqual([
      { symbol: 'KWE', startYear: 2023, endYear: 2023 },
      { symbol: 'KWESW', startYear: 2024, endYear: 2024 },
    ]);
  });
  it('returns [] for a CIK absent from all snapshots', async () => {
    expect(await snapshotSymbolTimeline('0000000099')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Real data: loadSaTransitions (reads committed data/sec-sa-changes)
// ---------------------------------------------------------------------------

describe('loadSaTransitions (real bundled SA change tables)', () => {
  it('parses all 10 yearly files into a well-formed map', async () => {
    const m = await loadSaTransitions();
    expect(m.size).toBe(10);
    expect([...m.keys()].sort((a, b) => a - b)).toEqual([
      2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
    const y2023 = m.get(2023)!;
    // Each committed SA file is capped at 50 transition rows by the source.
    expect(y2023.length).toBeGreaterThanOrEqual(50);
    for (const t of y2023.slice(0, 20)) {
      expect(t.date).toBeInstanceOf(Date);
      expect(typeof t.old).toBe('string');
      expect(typeof t.neu).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: resolveTickerChain merge (parseFormerNames mocked)
// ---------------------------------------------------------------------------

describe('resolveTickerChain merge logic', () => {
  it('LUMN: snapshot spine, names attached, earliestFilingDate carried, no gap-append', async () => {
    parseFormerNamesMock.mockResolvedValue(
      result({
        cik: '0000018926',
        currentName: 'Lumen Technologies, Inc.',
        currentTickers: ['LUMN'],
        earliestFilingDate: D('1994-01-28'),
        formerNames: [
          fn('CENTURYLINK, INC', '2017-01-01', '2020-09-13'),
          fn('Lumen Technologies, Inc.', '2020-09-14'),
        ],
      }),
    );
    const t = await resolveTickerChain('0000018926');
    expect(t.currentSymbol).toBe('LUMN');
    expect(t.currentName).toBe('Lumen Technologies, Inc.');
    expect(t.currentTickers).toEqual(['LUMN']);
    expect(t.earliestFilingDate).toEqual(D('1994-01-28'));
    // No SA row refines CTL->LUMN (verified absent), so dates stay year-granular.
    expect(t.chain).toEqual([
      { symbol: 'CTL', name: 'CENTURYLINK, INC', startDate: D('2017-01-01'), endDate: D('2020-12-31'), source: 'snapshot-diff' },
      { symbol: 'LUMN', name: 'Lumen Technologies, Inc.', startDate: D('2021-01-01'), endDate: null, source: 'snapshot-diff' },
    ]);
  });

  it('DFSC: appends the post-snapshot current symbol using the formerName end date', async () => {
    parseFormerNamesMock.mockResolvedValue(
      result({
        cik: '0001889823',
        currentName: 'DEFSEC Technologies Inc.',
        currentTickers: ['DFSC', 'DFSCW'],
        earliestFilingDate: D('2022-07-05'),
        formerNames: [fn('KWESST Micro Systems Inc.', '2022-07-05', '2025-06-26')],
      }),
    );
    const t = await resolveTickerChain('0001889823');
    expect(t.currentSymbol).toBe('DFSC');
    expect(t.earliestFilingDate).toEqual(D('2022-07-05'));
    // Last snapshot symbol (KWESW) != current (DFSC) -> appended from sec-submissions,
    // with the day-exact formerName end preferred over the coarse snapshot end.
    const last = t.chain.at(-1)!;
    expect(last.symbol).toBe('DFSC');
    expect(last.source).toBe('sec-submissions');
    expect(last.startDate).toEqual(D('2025-06-26'));
    expect(last.endDate).toBeNull();
    expect(last.name).toBe('DEFSEC Technologies Inc.');
  });

  it('regression: pre-snapshot formerNames are kept as name-only (symbol:null) entries', async () => {
    // The original bug: a name predating the snapshot window (e.g. 1990s) was
    // dropped because nameForYear only names snapshot-year periods. The
    // completeness step must re-add it as a symbol:null backbone entry.
    parseFormerNamesMock.mockResolvedValue(
      result({
        cik: '0000018926',
        currentName: 'Lumen Technologies, Inc.',
        currentTickers: ['LUMN'],
        earliestFilingDate: D('1994-01-28'),
        formerNames: [
          fn('CENCOLL Corp', '1990-01-01', '1996-12-31'),
          fn('CENTURYLINK, INC', '1997-01-01', '2020-09-13'),
          fn('Lumen Technologies, Inc.', '2020-09-14'),
        ],
      }),
    );
    const t = await resolveTickerChain('0000018926');
    // The pre-2017 name must lead the chain, oldest-first, as a backbone entry.
    expect(t.chain[0]).toEqual({
      symbol: null,
      name: 'CENCOLL Corp',
      startDate: D('1990-01-01'),
      endDate: D('1996-12-31'),
      source: 'sec-submissions',
    });
    // ...followed by the snapshot-derived symbol periods.
    expect(t.chain.map((e) => e.symbol)).toEqual([null, 'CTL', 'LUMN']);
  });

  it('no-snapshot fallback: name backbone + current symbol only', async () => {
    parseFormerNamesMock.mockResolvedValue(
      result({
        cik: '0000000099',
        currentName: 'NewCo',
        currentTickers: ['NEWC'],
        earliestFilingDate: D('2025-01-01'),
        formerNames: [fn('OldCo Inc', '2020-01-01', '2024-12-31')],
      }),
    );
    const t = await resolveTickerChain('0000000099');
    expect(t.currentSymbol).toBe('NEWC');
    expect(t.chain.map((e) => [e.symbol, e.name])).toEqual([
      [null, 'OldCo Inc'],
      ['NEWC', 'NewCo'],
    ]);
    // The current-symbol entry starts at the last formerName end date.
    expect(t.chain.at(-1)!.startDate).toEqual(D('2024-12-31'));
    expect(t.chain.every((e) => e.source === 'sec-submissions')).toBe(true);
  });
});
