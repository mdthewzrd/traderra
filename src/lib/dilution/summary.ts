/**
 * Dilution summary derivation + composite rating.
 * Spec: edge-dev assets/dilution/SPEC.md §6–7.
 *
 * Pure function over already-synced filings — no SEC call. Honest v1: derives
 * program categories + recency + an explainable 0–100 rating from metadata
 * (formType, items, tags, dates). Deeper per-program status (capacity
 * remaining, shares sold, exercise price) requires 424B5/8-K body parsing —
 * Loop 3+.
 */
import type { DilutionTag } from '@/lib/dilution/classify';

export interface ProgramRow {
  key: string;
  label: string;
  severity: 'info' | 'warn' | 'danger';
  count: number;
  latestDate: string | null;
  latestForm: string | null;
  blurb: string;
}

export interface RatingBreakdown {
  component: string;
  weight: number;
  fired: boolean;
  detail: string;
}

export interface DilutionSummary {
  programs: ProgramRow[];
  rating: number; // 0–100
  tier: 'Low' | 'Moderate' | 'High' | 'Toxic';
  tierColor: string;
  breakdown: RatingBreakdown[];
}

const MS_PER_DAY = 86_400_000;
const daysSince = (dateStr: string): number =>
  Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);

interface FilingInput {
  formType: string;
  filingDate: string;
  dilutionTags: DilutionTag[];
  primaryDesc: string | null;
}

export function deriveDilutionSummary(filings: FilingInput[]): DilutionSummary {
  const tagged = (tag: DilutionTag) => filings.filter((f) => f.dilutionTags.includes(tag));
  const latest = (arr: FilingInput[]): string | null =>
    arr.length ? arr.map((f) => f.filingDate).sort().reverse()[0] ?? null : null;
  const latestForm = (arr: FilingInput[]): string | null =>
    arr.length
      ? arr.slice().sort((a, b) => (a.filingDate < b.filingDate ? 1 : -1))[0].formType
      : null;

  const shelf = tagged('shelf');
  const shelfEffective = tagged('shelf-effective');
  const atm = tagged('atm');
  const equityLine = tagged('equity-line');
  const convertible = tagged('convertible');
  const reverseSplit = tagged('reverse-split');
  const offerings = tagged('offering');
  const warrant = tagged('warrant');
  const delist = tagged('delisting-risk');

  const programList: ProgramRow[] = [
    {
      key: 'shelf',
      label: 'Shelf Registration',
      severity: shelf.length ? 'warn' : 'info',
      count: shelf.length,
      latestDate: latest(shelf),
      latestForm: latestForm(shelf),
      blurb: 'S-1/S-3/F-1/F-3 — a registration that lets the issuer sell into the market.',
    },
    {
      key: 'shelf-effective',
      label: 'Shelf Draw (424B5)',
      severity: shelfEffective.length ? 'warn' : 'info',
      count: shelfEffective.length,
      latestDate: latest(shelfEffective),
      latestForm: latestForm(shelfEffective),
      blurb: 'Prospectus supplement — the shelf is actively being drawn down.',
    },
    {
      key: 'equity-line',
      label: 'Equity Line / SEPA',
      severity: equityLine.length ? 'danger' : 'info',
      count: equityLine.length,
      latestDate: latest(equityLine),
      latestForm: latestForm(equityLine),
      blurb: 'Standby Equity Purchase Agreement — potentially toxic, dilutive financing.',
    },
    {
      key: 'atm',
      label: 'ATM Offering',
      severity: atm.length ? 'danger' : 'info',
      count: atm.length,
      latestDate: latest(atm),
      latestForm: latestForm(atm),
      blurb: 'At-The-Market sales agreement — issuer sells into the bid.',
    },
    {
      key: 'convertible',
      label: 'Convertible Security',
      severity: convertible.length ? 'warn' : 'info',
      count: convertible.length,
      latestDate: latest(convertible),
      latestForm: latestForm(convertible),
      blurb: 'Convertible note/debt — dilutes on conversion.',
    },
    {
      key: 'reverse-split',
      label: 'Reverse Split',
      severity: reverseSplit.length ? 'danger' : 'info',
      count: reverseSplit.length,
      latestDate: latest(reverseSplit),
      latestForm: latestForm(reverseSplit),
      blurb: 'Reverse stock split (8-K 5.03) — often precedes / follows dilution.',
    },
    {
      key: 'offering',
      label: 'Offering (424Bx)',
      severity: offerings.length ? 'info' : 'info',
      count: offerings.length,
      latestDate: latest(offerings),
      latestForm: latestForm(offerings),
      blurb: 'Prospectus supplement — securities offered to market.',
    },
    {
      key: 'warrant',
      label: 'Warrants',
      severity: warrant.length ? 'info' : 'info',
      count: warrant.length,
      latestDate: latest(warrant),
      latestForm: latestForm(warrant),
      blurb: 'Warrants attached to an offering.',
    },
    {
      key: 'delisting-risk',
      label: 'Delisting Risk',
      severity: delist.length ? 'danger' : 'info',
      count: delist.length,
      latestDate: latest(delist),
      latestForm: latestForm(delist),
      blurb: 'Exchange deficiency / minimum-bid notice (8-K 3.01).',
    },
  ];

  const programs = programList.filter((p) => p.count > 0);

  // Composite rating (SPEC §7) — explainable, tunable.
  const shelfRecent = shelf.some((f) => daysSince(f.filingDate) <= 730); // 24mo
  const rsRecent = reverseSplit.some((f) => daysSince(f.filingDate) <= 365); // 12mo

  const breakdown: RatingBreakdown[] = [
    { component: 'Shelf active (24mo)', weight: 25, fired: shelfRecent, detail: shelf.length ? `${shelf.length} registration(s), latest ${latest(shelf)}` : 'none' },
    { component: 'Equity line / SEPA', weight: 30, fired: equityLine.length > 0, detail: equityLine.length ? `${equityLine.length}, latest ${latest(equityLine)}` : 'none' },
    { component: 'ATM agreement', weight: 20, fired: atm.length > 0, detail: atm.length ? `${atm.length}, latest ${latest(atm)}` : 'none' },
    { component: 'Convertible security', weight: 25, fired: convertible.length > 0, detail: convertible.length ? `${convertible.length}` : 'none' },
    { component: 'Reverse split (12mo)', weight: 15, fired: rsRecent, detail: reverseSplit.length ? `${reverseSplit.length}` : 'none' },
    { component: 'Offering recent', weight: 10, fired: offerings.some((f) => daysSince(f.filingDate) <= 90), detail: offerings.length ? `${offerings.length} total` : 'none' },
  ];

  const rating = Math.min(100, breakdown.filter((b) => b.fired).reduce((s, b) => s + b.weight, 0));
  const tier = rating <= 20 ? 'Low' : rating <= 45 ? 'Moderate' : rating <= 70 ? 'High' : 'Toxic';
  const tierColor = rating <= 20 ? 'emerald' : rating <= 45 ? 'amber' : rating <= 70 ? 'orange' : 'red';

  return { programs, rating, tier, tierColor, breakdown };
}
