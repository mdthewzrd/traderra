/**
 * Nasdaq continued-listing quantitative compliance.
 *
 * Evaluates ONLY rules computable from SEC XBRL facts + live price. The two that
 * trigger ~90% of delisting notices are computable:
 *   - Bid Price (≥ $1.00) — IM-5810(c); tier-independent
 *   - Market Value of Listed Securities — IM-5810(c); tier-dependent
 * Plus supporting standards we now extract:
 *   - Stockholders Equity (≥ $2.5M Capital / ≥ $10M Global)
 *   - Profitability context (net income, last 3 FY)
 *
 * NOT computable from SEC data (explicitly marked 'n/a' with the reason):
 *   - Round-lot shareholders (≥300/450/400) — shareholder registry, not XBRL
 *   - Independent directors / audit committee — proxy statements
 *
 * This is an honest best-effort flag, NOT a legal determination. Tier detection
 * from the exchange string is best-effort; defaults to Global Market with a
 * 'review' note when unknown, and surfaces BOTH Capital/Global thresholds in the
 * detail so the number is never misleading.
 */
import { prisma } from '@/lib/prisma';

const POLY_KEY = process.env.POLYGON_API_KEY || 'd95jSGsXx6ZoqYG1_GXaqnmP6y64ZO_r';
const POLY_BASE = 'https://api.polygon.io';

export interface ComplianceRule {
  rule: string;
  threshold: string;
  status: 'pass' | 'fail' | 'review' | 'n/a';
  value: string;
  detail?: string;
}

export interface ComplianceResult {
  exchange: string | null;
  tier: string;
  price: number | null;
  asOf: string | null;
  rules: ComplianceRule[];
  failures: number; // count of 'fail' on computable rules → delisting-risk signal
  computable: number;
}

async function fetchPrice(ticker: string): Promise<{ price: number; asOf: string } | null> {
  try {
    const r = await fetch(
      `${POLY_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(ticker)}?apiKey=${POLY_KEY}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { status?: string; ticker?: { day?: { c?: number }; last?: { price?: number } } };
    if (j.status !== 'OK' || !j.ticker) return null;
    const price = j.ticker.last?.price ?? j.ticker.day?.c ?? null;
    if (price == null || price <= 0) return null;
    return { price, asOf: new Date().toISOString().slice(0, 10) };
  } catch {
    return null;
  }
}

/** Detect Nasdaq tier from the exchange string. 'CM'/'Capital' → Capital Market
 *  (stricter SE, looser MVLS). 'GS'/'Global Select' → Global Select. Else Global. */
function detectTier(exchange: string | null): { tier: string; isCapital: boolean; isGlobalSelect: boolean } {
  const e = (exchange ?? '').toUpperCase();
  if (/\BCM\b|CAPITAL/.test(e)) return { tier: 'Nasdaq Capital Market', isCapital: true, isGlobalSelect: false };
  if (/GLOBAL[\s-]?SELECT|\bGS\b/.test(e)) return { tier: 'Nasdaq Global Select Market', isCapital: false, isGlobalSelect: true };
  return { tier: 'Nasdaq Global Market', isCapital: false, isGlobalSelect: false };
}

const M = 1e6;

export async function computeNasdaqCompliance(
  cik: string,
  ticker: string | undefined,
  exchange: string | null,
): Promise<ComplianceResult | null> {
  if (!ticker) return null;
  const { tier, isCapital } = detectTier(exchange);
  const px = await fetchPrice(ticker);

  // Shares outstanding (latest) + balance-sheet/income facts from DB.
  const [sharesFact, seFact, niFacts, revFacts] = await Promise.all([
    prisma.dilutionFact.findFirst({
      where: { cik, fact: 'EntityCommonStockSharesOutstanding' },
      orderBy: { period: 'desc' },
      select: { val: true, period: true },
    }),
    prisma.dilutionFact.findFirst({
      where: { cik, fact: 'StockholdersEquity' },
      orderBy: { period: 'desc' },
      select: { val: true, period: true },
    }),
    prisma.dilutionFact.findMany({
      where: { cik, fact: 'NetIncomeLoss' },
      orderBy: { period: 'desc' },
      take: 3,
      select: { val: true, period: true },
    }),
    prisma.dilutionFact.findMany({
      where: { cik, fact: 'Revenues' },
      orderBy: { period: 'desc' },
      take: 3,
      select: { val: true, period: true },
    }),
  ]);

  const sharesOut = sharesFact ? Number(sharesFact.val) : null;
  const se = seFact ? Number(seFact.val) : null;
  const marketCap = px && sharesOut && sharesOut > 0 ? px.price * sharesOut : null;

  const rules: ComplianceRule[] = [];

  // 1. Bid Price ≥ $1.00 (all tiers) — the #1 delisting trigger.
  if (px) {
    const ok = px.price >= 1;
    rules.push({
      rule: 'Bid Price',
      threshold: '≥ $1.00',
      status: ok ? 'pass' : 'fail',
      value: `$${px.price.toFixed(2)}`,
      detail: ok ? undefined : 'Below $1 for 30 consecutive business days → delisting notice (180-day cure).',
    });
  } else {
    rules.push({ rule: 'Bid Price', threshold: '≥ $1.00', status: 'review', value: 'no price', detail: 'Price feed unavailable.' });
  }

  // 2. Market Value of Listed Securities (total market cap) — tier-dependent.
  const mvlsThr = isCapital ? 10 * M : 50 * M; // Capital $10M / Global $50M (Global Select $35M)
  if (marketCap !== null) {
    const ok = marketCap >= mvlsThr;
    rules.push({
      rule: 'Market Value of Listed Securities',
      threshold: `≥ $${(mvlsThr / M).toFixed(0)}M (${tier})`,
      status: ok ? 'pass' : 'fail',
      value: `$${(marketCap / M).toFixed(1)}M`,
      detail: `Capital $10M · Global $50M · Global Select $35M. Computed at $${px!.price.toFixed(2)} × ${sharesOut!.toLocaleString()} shares.`,
    });
  } else {
    rules.push({
      rule: 'Market Value of Listed Securities',
      threshold: `≥ $${(mvlsThr / M).toFixed(0)}M (${tier})`,
      status: 'review',
      value: 'n/a',
      detail: 'Needs price + shares outstanding.',
    });
  }

  // 3. Stockholders Equity — part of the alternative continued-listing standards.
  const seThr = isCapital ? 2.5 * M : 10 * M;
  if (se !== null) {
    const ok = se >= seThr;
    rules.push({
      rule: 'Stockholders Equity',
      threshold: `≥ $${(seThr / M).toFixed(1)}M (${tier})`,
      status: ok ? 'pass' : 'fail',
      value: `$${(se / M).toFixed(1)}M`,
      detail: `Capital $2.5M · Global $10M. As of ${seFact!.period}. Low SE + losses = the equity-standard failure mode.`,
    });
  } else {
    rules.push({
      rule: 'Stockholders Equity',
      threshold: `≥ $${(seThr / M).toFixed(1)}M (${tier})`,
      status: 'review',
      value: 'not synced',
      detail: 'Balance-sheet facts not yet extracted (run force-resync).',
    });
  }

  // 4. Profitability context — net income, last 3 fiscal years. Informational
  //    (supports the SE-standard "and losses" condition), not a standalone rule.
  if (niFacts.length) {
    const positives = niFacts.filter((n) => Number(n.val) > 0).length;
    const sum = niFacts.reduce((s, n) => s + Number(n.val), 0);
    rules.push({
      rule: 'Profitability (net income)',
      threshold: 'context',
      status: 'n/a',
      value: `${positives}/${niFacts.length} yrs profitable`,
      detail: `3-FY net income sum $${(sum / M).toFixed(1)}M. Persistent losses compound SE-standard delisting risk.`,
    });
  }

  // 5-6. NOT computable from SEC data — explicit so the table is honest.
  rules.push({
    rule: 'Round-lot shareholders',
    threshold: '≥ 400',
    status: 'n/a',
    value: '—',
    detail: 'Shareholder registry data — not filed in XBRL.',
  });
  rules.push({
    rule: 'Independent directors / audit committee',
    threshold: 'majority',
    status: 'n/a',
    value: '—',
    detail: 'Proxy statements / governance disclosures — not in XBRL.',
  });

  const computable = rules.filter((r) => r.status === 'pass' || r.status === 'fail').length;
  const failures = rules.filter((r) => r.status === 'fail').length;

  return { exchange, tier, price: px?.price ?? null, asOf: px?.asOf ?? null, rules, failures, computable };
}
