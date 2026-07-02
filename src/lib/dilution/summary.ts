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

export interface SubRating {
  score: number; // 0–100
  tier: 'Low' | 'Moderate' | 'High' | 'Toxic';
  bullets: string[]; // 1–3 short facts driving this score
  grid?: { cols: string[]; rows: { label: string; cells: (number | string)[] }[] }; // optional table (e.g. offering-frequency time windows)
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
  // 5 Nexus-aligned sub-scores. Overall blends them, weighted toward the
  // short-bias thesis (need cash + can dilute + history of doing it).
  subRatings: {
    cashNeed: SubRating;
    dilutionAbility: SubRating;
    offeringFrequency: SubRating;
    warrantExercise: SubRating;
    compliance: SubRating;
  };
  bullets: string[]; // top-level narrative (AskEdgar-style explainer)
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
  draws?: {
    amount: number | null;
    shares: number | null;
    facilityType: string;
    date: string | null;
  }[];
  // --- inputs for the 5 named sub-scores (Nexus-aligned) ---
  runwayMonths?: number | null; // cash need (≤6mo = desperate for cash)
  cashValue?: number | null; // last reported cash (USD), for narrative
  monthlyBurn?: number | null; // for narrative
  price?: number | null; // latest price (in-the-money warrant + bid logic)
  compliance?: { rules: { rule: string; status: 'pass' | 'fail' | 'review' | 'n/a' }[]; failures: number } | null;
  shelfRemaining?: { registered: number; raised: number; remaining: number } | null;
  publicFloat?: { value: number; shares: number | null; asOf: string } | null;
  // Parsed 8-K material agreements — the authoritative source for tappable
  // facilities (SEPA/equity-line max commitment, ATM). More accurate than filing
  // tags for 'can they dilute right now' because it carries actual capacity.
  programs?: { programType: string; maxCommitment: number | null; filingDate: string; counterparty: string | null }[];
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

  // --- Draw pressure (the most direct short-bias signal) ---
  // ACTUAL cash raised under dilution facilities in recent quarterlies.
  // A company drawing right now is a far stronger short than one with a dormant
  // facility. Two tiers: any recent draw (180d), and heavy cumulative draws
  // ($10M+ in 180d) flagging sustained, material dilution.
  const draws = magnitude?.draws ?? [];
  const DRAW_RECENT_DAYS = 180;
  const HEAVY_DRAW_USD = 10_000_000;
  const recentDraws = draws.filter((d) => d.date != null && daysSince(d.date) <= DRAW_RECENT_DAYS);
  const recentDrawTotal = recentDraws.reduce((s, d) => s + (d.amount ?? 0), 0);
  const hasRecentDraw = recentDraws.length > 0;
  const hasHeavyDraw = recentDrawTotal >= HEAVY_DRAW_USD;
  const drawDetail = draws.length
    ? hasHeavyDraw
      ? `${recentDraws.length} draws, $${(recentDrawTotal / 1e6).toFixed(1)}M in 180d`
      : `${draws.length} total${hasRecentDraw ? `, latest ${recentDraws[0].date}` : ''}`
    : 'none';

  // Keep the component-level breakdown for the transparency detail view.
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
    { component: 'Active facility draw (180d)', weight: 20, fired: hasRecentDraw, detail: drawDetail },
    { component: 'Heavy recent draws ($10M+/180d)', weight: 15, fired: hasHeavyDraw, detail: hasHeavyDraw ? `$${(recentDrawTotal / 1e6).toFixed(1)}M drawn` : 'none' },
    { component: 'Insider dilution (90d)', weight: 15, fired: dil90d > 0, detail: insiderDetail },
  ];

  const tierFromScore = (s: number): SubRating['tier'] => (s <= 20 ? 'Low' : s <= 45 ? 'Moderate' : s <= 70 ? 'High' : 'Toxic');
  const clamp100 = (n: number) => Math.max(0, Math.min(100, n));
  const usd = (n: number | null | undefined, m = true) => (n == null ? '—' : m ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}k`);

  // --- Cash Need: urgency to raise (runway). <6mo = desperate, >12mo = funded. ---
  const runway = magnitude?.runwayMonths ?? null;
  let cashScore = 0;
  const cashBullets: string[] = [];
  if (runway == null) {
    cashBullets.push('No burn data — cash need unknown.');
  } else {
    cashScore = runway <= 0 ? 100 : runway <= 3 ? 100 : runway <= 6 ? 85 : runway <= 12 ? 55 : runway <= 24 ? 25 : 5;
    cashBullets.push(
      `${runway <= 0 ? 'Out of cash' : runway.toFixed(1) + 'mo runway'}${magnitude?.cashValue != null ? ` · ${usd(magnitude.cashValue)} cash` : ''}${magnitude?.monthlyBurn != null ? ` · ${usd(Math.abs(magnitude.monthlyBurn), false)}/mo burn` : ''}${runway <= 6 ? ' (desperate for cash)' : runway > 12 ? ' (well-funded)' : ''}.`,
    );
  }
  const cashNeed: SubRating = { score: clamp100(cashScore), tier: tierFromScore(clamp100(cashScore)), bullets: cashBullets };

  // --- Dilution Ability: CAN they sell? shelf remaining, equity line, ATM, converts, S-1.
  //     Programs (parsed 8-K material agreements) are preferred over filing tags —
  //     they carry actual committed capacity ($50M SEPA etc.) and catch facilities
  //     that aren't separately tagged on a filing.
  let abilScore = 0;
  const abilBullets: string[] = [];
  const progs = magnitude?.programs ?? [];
  const eqProg = progs.filter((p) => p.programType === 'equity-line');
  const atmProg = progs.filter((p) => p.programType === 'atm');
  const convProg = progs.filter((p) => p.programType === 'convertible');
  const sr = magnitude?.shelfRemaining ?? null;
  if (sr && sr.remaining > 0) { abilScore += sr.remaining >= 50e6 ? 40 : 30; abilBullets.push(`Shelf: $${(sr.remaining / 1e6).toFixed(0)}M of $${(sr.registered / 1e6).toFixed(0)}M remaining (tappable).`); }
  else if (shelfRecent) { abilScore += 10; abilBullets.push('Shelf active; remaining capacity unclear.'); }
  // Equity line / SEPA — from programs (with capacity) OR filing tag fallback.
  if (eqProg.length) {
    abilScore += 35;
    const cap = Math.max(0, ...eqProg.map((p) => p.maxCommitment ?? 0));
    abilBullets.push(`Equity line / SEPA${cap > 0 ? ` up to $${(cap / 1e6).toFixed(0)}M` : ''}${eqProg[0].counterparty ? ` (${eqProg[0].counterparty})` : ''}.`);
  } else if (equityLine.length) { abilScore += 35; abilBullets.push(`Equity line / SEPA active (${equityLine.length}).`); }
  if (atmProg.length) { abilScore += 25; abilBullets.push(`ATM agreement (${atmProg.length}).`); }
  else if (atm.length) { abilScore += 25; abilBullets.push(`ATM agreement (${atm.length}).`); }
  if (convProg.length || convertible.length) { abilScore += 20; abilBullets.push(`Convertible outstanding (${convProg.length || convertible.length}).`); }
  const s1Filed = tagged('shelf').filter((f) => /^S-1(\/A)?$/.test(f.formType));
  if (s1Filed.length) { abilScore += 10; abilBullets.push('S-1 filed (good to go pending effectiveness).'); }
  // Warrant overhang is dilution ability (sell-side capacity) — merged here.
  const wpx = magnitude?.price ?? null;
  if (warrantHas) {
    abilScore += overhangPct != null && overhangPct >= 20 ? 40 : overhangPct != null && overhangPct >= 5 ? 20 : 8;
    const w = warrantOverhang!;
    const itm = w.strike != null && wpx != null && wpx > w.strike;
    if (itm) abilScore += 15;
    abilBullets.push(`${(w.shares / 1e6).toFixed(2)}M warrants${w.strike != null ? ` @ $${w.strike.toFixed(2)}` : ''}${overhangPct != null ? ` · ${overhangPct.toFixed(0)}% of shares` : ''}${itm ? ' · IN THE MONEY (exercise likely)' : wpx != null ? ' · out of the money' : ''}.`);
  }
  if (!abilBullets.length) abilBullets.push('No tappable dilution facilities detected.');
  const dilutionAbility: SubRating = { score: clamp100(abilScore), tier: tierFromScore(clamp100(abilScore)), bullets: abilBullets };

  // --- Offering Frequency: tendency to dump (history: offerings, draws, splits, insiders). ---
  let freqScore = 0;
  const freqBullets: string[] = [];
  if (recentGross > 0) { freqScore += 30; freqBullets.push(`${usd(recentGross)} raised in offerings (90d).`); }
  else if (offeringDetails.length) { freqScore += 10; freqBullets.push(`${offeringDetails.length} historical offering(s).`); }
  if (hasHeavyDraw) { freqScore += 35; freqBullets.push(`Heavy draws: ${usd(recentDrawTotal)} in 180d.`); }
  else if (hasRecentDraw) { freqScore += 20; freqBullets.push('Active facility draws (180d).'); }
  if (rsRecent) { freqScore += 25; freqBullets.push('Reverse split within 12mo (dilution pattern).'); }
  if (dil90d > 0) { freqScore += 15; freqBullets.push(`${insiderDetail}.`); }
  if (!freqBullets.length) freqBullets.push('No recent offerings, draws, or splits.');
  // Time-windowed counts (6mo / 1yr / 3yr / 5yr). Offerings, draws, reverse splits are
  // real per-event counts. ATM / equity-line are shown as active-facility FLAGS only —
  // per-tap usage is NOT parsed from SEC (reported as aggregates in 10-Qs), so we do
  // not fabricate tap counts. Honest over precise.
  const WINS = [{ l: '6mo', d: 182 }, { l: '1yr', d: 365 }, { l: '3yr', d: 1095 }, { l: '5yr', d: 1825 }];
  const anyDate = (x: unknown): string | null => {
    if (!x || typeof x !== 'object') return null;
    const o = x as Record<string, unknown>;
    return (typeof o.filingDate === 'string' && o.filingDate) || (typeof o.date === 'string' && o.date) || (typeof o.effectiveDate === 'string' && o.effectiveDate) || (typeof o.announcedDate === 'string' && o.announcedDate) || null;
  };
  const countIn = (arr: unknown[], days: number) => arr.filter((x) => { const ds = anyDate(x); return !!ds && daysSince(ds) <= days; }).length;
  const drawsAll = magnitude?.draws ?? [];
  const progsAll = magnitude?.programs ?? [];
  const activeFac: string[] = [];
  if (atm.length || progsAll.some((p) => p.programType === 'atm')) activeFac.push('ATM');
  if (equityLine.length || progsAll.some((p) => p.programType === 'equity-line')) activeFac.push('SEPA/equity line');
  if (convertible.length || progsAll.some((p) => p.programType === 'convertible')) activeFac.push('convertible');
  if (activeFac.length) freqBullets.push(`Active facilities: ${activeFac.join(', ')} (per-tap usage not disclosed in filings).`);
  const freqGrid = {
    cols: WINS.map((w) => w.l),
    rows: [
      { label: 'Offerings', cells: WINS.map((w) => countIn(offeringDetails, w.d)) },
      { label: 'Draws', cells: WINS.map((w) => countIn(drawsAll, w.d)) },
      { label: 'Reverse splits', cells: WINS.map((w) => countIn(reverseSplit, w.d)) },
    ],
  };
  const offeringFrequency: SubRating = { score: clamp100(freqScore), tier: tierFromScore(clamp100(freqScore)), bullets: freqBullets, grid: freqGrid };

  // --- Compliance: forced-dilution / listing modifier (NUANCED per trader logic). ---
  // NC stockholders-equity = real distress → GOOD short (high). NC bid <$1 often
  // forces a reverse split / relief rally → NOT a clean short (low weight).
  const comp = magnitude?.compliance ?? null;
  let compScore = 0;
  const compBullets: string[] = [];
  if (comp && comp.rules.length) {
    const findFail = (re: RegExp) => comp!.rules.find((r) => re.test(r.rule) && r.status === 'fail');
    const eqFail = findFail(/equity/i);
    const mvFail = findFail(/market value/i);
    const bidFail = findFail(/bid/i);
    if (eqFail) { compScore += 70; compBullets.push('Stockholders-equity deficiency — real distress (good short).'); }
    if (mvFail) { compScore += 50; compBullets.push('Market-value listing deficiency.'); }
    if (bidFail) { compScore += 20; compBullets.push('Bid <$1 (reverse-split risk — may rally, not a clean short).'); }
    if (compScore === 0) compBullets.push('Passing all listing standards.');
  }
  if (!compBullets.length) compBullets.push('Compliance data unavailable.');
  const compliance: SubRating = { score: clamp100(compScore), tier: tierFromScore(clamp100(compScore)), bullets: compBullets };

  const subRatings = { cashNeed, dilutionAbility, offeringFrequency, compliance };

  // Overall blends the 5 — weighted toward the short thesis (need + can + history).
  const rating = Math.round(
    cashNeed.score * 0.25 + dilutionAbility.score * 0.40 + offeringFrequency.score * 0.25 + compliance.score * 0.10,
  );
  const tier = tierFromScore(rating);
  const tierColor = rating <= 20 ? 'emerald' : rating <= 45 ? 'amber' : rating <= 70 ? 'orange' : 'red';

  // Top-level narrative bullets — highest-signal facts across all sub-scores.
  const bullets: string[] = [
    ...cashBullets,
    ...abilBullets,
    ...(hasRecentDraw ? [drawDetail === 'none' ? 'Recent dilution draws.' : `Dilution draws: ${drawDetail}.`] : []),
    ...compBullets,
  ].slice(0, 8);

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
      cashBurnRisk: runway == null ? null : runway <= 7 ? 'high' : runway <= 12 ? 'medium' : 'low',
      dilutionRisk,
      offeringRisk,
      note: 'cashBurnRisk from runway (≤7/≤12mo); offeringRisk overhang-aware (warrant+convertible % of shares); dilutionRisk from facility breadth.',
    };
  })();

  return { programs, rating, tier, tierColor, breakdown, askedgarLabels, subRatings, bullets };
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
