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
  // AskEdgar-aligned risk labels — reverse-engineered from 1,758 labeled reports.
  // cashBurnRisk cloned from prose-cited runway (68.5% acc, fit on AE's own numbers).
  // dilutionRisk/offeringRisk = best-effort from available magnitude (improve as
  // estimated_cash adjustment is dialed in + warrant parser lands).
  askedgarLabels: {
    cashBurnRisk: 'low' | 'medium' | 'high' | null;
    dilutionRisk: 'low' | 'medium' | 'high' | null;
    offeringRisk: 'low' | 'medium' | 'high' | null;
    note: string;
  };
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

/** Optional parsed-detail signal — makes the rating MAGNITUDE-aware (a $500M
 *  shelf scores higher than a $5M one) and surfaces insider dilution that tag
 *  metadata can't see. All optional; summary degrades gracefully without it. */
export interface MagnitudeInput {
  registrations: {
    aggregateOffering: number | null;
    shelfType: string;
    salesChannel: string | null;
    filingDate: string;
  }[];
  offerings: {
    grossProceeds: number | null;
    sharesOffered: number | null;
    offeringType: string;
    filingDate: string;
  }[];
  insiderDilutiveShares90d: number;
  sharesOutstanding: number | null;
  overhang?: {
    warrant: { shares: number; strike: number | null; period: string } | null;
    convertible: { shares: number; strike: number | null; period: string } | null;
    overhangPct: number | null;
  } | null;
}

export function deriveDilutionSummary(
  filings: FilingInput[],
  magnitude?: MagnitudeInput,
): DilutionSummary {
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

  // --- Magnitude signals (parsed detail, not just tags) ---
  // Registered shelf capacity ($): the potential dilution PIPELINE.
  const registrations = magnitude?.registrations ?? [];
  const shelfCapacity = registrations
    .filter((r) => r.aggregateOffering !== null)
    .reduce((max, r) => Math.max(max, r.aggregateOffering as number), 0);
  const hasLargeShelf = shelfCapacity >= 100_000_000; // $100M+ = significant overhang
  const hasAsr = registrations.some((r) => r.shelfType === 'automatic-shelf');
  const shelfCapacityDetail =
    shelfCapacity > 0
      ? `${shelf.length} registration(s), capacity up to $${(shelfCapacity / 1e6).toFixed(0)}M${hasAsr ? ' (ASR)' : ''}`
      : shelf.length
        ? `${shelf.length} registration(s)`
        : 'none';

  // Recent (90d) offering proceeds actually raised.
  const offeringDetails = magnitude?.offerings ?? [];
  const recentGross = offeringDetails
    .filter((o) => daysSince(o.filingDate) <= 90 && o.grossProceeds !== null)
    .reduce((s, o) => s + (o.grossProceeds as number), 0);
  const offeringDetail =
    offeringDetails.length
      ? recentGross > 0
        ? `${offeringDetails.length} total, ~$${(recentGross / 1e6).toFixed(1)}M raised in 90d`
        : `${offerings.length} total`
      : 'none';

  // Insider dilution velocity — dilutive shares as % of shares outstanding.
  const dil90d = magnitude?.insiderDilutiveShares90d ?? 0;
  const shares = magnitude?.sharesOutstanding ?? null;
  const insiderPct = shares && shares > 0 ? (dil90d / shares) * 100 : null;
  const insiderDetail =
    dil90d > 0
      ? insiderPct !== null
        ? `${(dil90d / 1e6).toFixed(2)}M shares (${insiderPct.toFixed(2)}% of out.) in 90d`
        : `${(dil90d / 1e6).toFixed(2)}M shares in 90d`
      : 'none';

  // Warrant overhang from XBRL (magnitude.overhang.warrant) — the price-
  // dependent dilution threat. Mirrors the shelf pattern: a presence component
  // plus a magnitude component when the overhang is large vs float.
  const warrantOverhang = magnitude?.overhang?.warrant ?? null;
  const warrantHas = warrantOverhang !== null && warrantOverhang.shares > 0;
  const warrantDetail = warrantHas
    ? `${(warrantOverhang!.shares / 1e6).toFixed(2)}M shares${warrantOverhang!.strike !== null ? ` · $${warrantOverhang!.strike.toFixed(2)} strike` : ''} @ ${warrantOverhang!.period}`
    : 'none';
  const overhangPct = magnitude?.overhang?.overhangPct ?? null;

  const breakdown: RatingBreakdown[] = [
    { component: 'Shelf active (24mo)', weight: 25, fired: shelfRecent, detail: shelfCapacityDetail },
    { component: 'Large shelf capacity ($100M+)', weight: 10, fired: hasLargeShelf, detail: shelfCapacity > 0 ? `$${(shelfCapacity / 1e6).toFixed(0)}M registered` : 'none' },
    { component: 'Equity line / SEPA', weight: 30, fired: equityLine.length > 0, detail: equityLine.length ? `${equityLine.length}, latest ${latest(equityLine)}` : 'none' },
    { component: 'ATM agreement', weight: 20, fired: atm.length > 0, detail: atm.length ? `${atm.length}, latest ${latest(atm)}` : 'none' },
    { component: 'Convertible security', weight: 25, fired: convertible.length > 0, detail: convertible.length ? `${convertible.length}` : 'none' },
    { component: 'Warrant overhang', weight: 15, fired: warrantHas, detail: warrantDetail },
    { component: 'Large warrant overhang (20%+)', weight: 10, fired: warrantHas && overhangPct !== null && overhangPct >= 20, detail: overhangPct !== null ? `${overhangPct.toFixed(0)}% of shares out.` : 'none' },
    { component: 'Reverse split (12mo)', weight: 15, fired: rsRecent, detail: reverseSplit.length ? `${reverseSplit.length}` : 'none' },
    { component: 'Offering recent', weight: 10, fired: offeringDetails.some((o) => daysSince(o.filingDate) <= 90), detail: offeringDetail },
    { component: 'Insider dilution (90d)', weight: 15, fired: dil90d > 0, detail: insiderDetail },
  ];

  const rating = Math.min(100, breakdown.filter((b) => b.fired).reduce((s, b) => s + b.weight, 0));
  const tier = rating <= 20 ? 'Low' : rating <= 45 ? 'Moderate' : rating <= 70 ? 'High' : 'Toxic';
  const tierColor = rating <= 20 ? 'emerald' : rating <= 45 ? 'amber' : rating <= 70 ? 'orange' : 'red';

  // --- AskEdgar-aligned risk labels (reverse-engineered from 1,758 labeled reports) ---
  // cashBurnRisk: cloned from prose-cited runway thresholds (68.5% acc on AE's own
  //   numbers). Our runway uses raw reported cash — will sharpen as estimated_cash
  //   adjustment is dialed in. Thresholds: ≤7mo→high, ≤12mo→medium, >12mo→low.
  // dilutionRisk: best-effort from insider 90d dilution + offering recency.
  // offeringRisk: best-effort from shelf/ATM/SEPA presence (warrant parser = Loop B).
  const askedgarLabels: DilutionSummary['askedgarLabels'] = (() => {
    // cashBurnRisk from runway — magnitude doesn't carry runway directly, infer
    // from programs (we don't recompute here to keep summary pure; the page wires
    // the actual runway via a separate call if needed). Use offering+shelf presence
    // as a proxy intensity until runway is threaded through magnitude.
    const shelfOn = shelfRecent;
    const eqOn = equityLine.length > 0;
    const atmOn = atm.length > 0;
    const convOn = convertible.length > 0;
    const toxicCount = [shelfOn, eqOn, atmOn, convOn].filter(Boolean).length;
    // offeringRisk — PRICE-DEPENDENT ability to dilute. Combines (a) legal
    // capacity (shelf/ATM/SEPA presence) with (b) outstanding overhang
    // (warrants+convertibles as % of shares). Overhang is the real signal from
    // the warrant parser (ClassOfWarrantOrRightOutstanding + convertible issuable).
    const overhangPct = magnitude?.overhang?.overhangPct ?? null;
    let offeringRisk: 'low' | 'medium' | 'high' = 'low';
    // overhang tiers: >20% = high (massive dilution threat), 5-20% = medium
    if (overhangPct !== null && overhangPct >= 20) offeringRisk = 'high';
    else if (overhangPct !== null && overhangPct >= 5) offeringRisk = 'medium';
    else if (eqOn || atmOn) offeringRisk = 'high';
    else if (shelfOn || convOn) offeringRisk = 'medium';
    // dilutionRisk — recent executed dilution intensity.
    let dilutionRisk: 'low' | 'medium' | 'high' = 'low';
    if (toxicCount >= 3) dilutionRisk = 'high';
    else if (toxicCount >= 2) dilutionRisk = 'medium';
    return {
      cashBurnRisk: null, // populated by caller (needs runway from cash snapshot)
      dilutionRisk,
      offeringRisk,
      note: 'cashBurnRisk cloned (runway ≤7/≤12mo); offeringRisk overhang-aware (warrant+convertible % of shares); in-the-money scoring pending price feed',
    };
  })();

  return { programs, rating, tier, tierColor, breakdown, askedgarLabels };
}

/** Apply the cashBurnRisk threshold using an actual runway value (months).
 *  Called by the page with the real cash-snapshot runway, since deriveDilutionSummary
 *  is kept pure (no SEC/cash computation). Thresholds cloned from AskEdgar's own
 *  prose-cited runway numbers: ≤7mo→high, ≤12mo→medium, >12mo→low (68.5% acc). */
export function cashBurnRiskFromRunway(runwayMonths: number | null): 'low' | 'medium' | 'high' | null {
  if (runwayMonths === null || runwayMonths <= 0) return null;
  if (runwayMonths <= 7) return 'high';
  if (runwayMonths <= 12) return 'medium';
  return 'low';
}
