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
 * This is an honest best-effort flag, NOT a legal determination. EXCHANGE
 * BRANCHING: the $1 bid-price floor is universal (NYSE 802.01B, Nasdaq
 * 5810(c), NYSE American). But equity/market-cap standards DIFFER by exchange
 * family. For Nasdaq we apply the rulebook thresholds confidently. For NYSE/
 * NYSE American we do NOT fabricate the differing equity numbers — we apply
 * the common $50M market-cap standard and mark the equity rule 'review'. Never
 * silently apply one exchange's rulebook to another's listing.
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

type ExchangeFamily = 'nasdaq' | 'nyse' | 'nyse-american' | 'other';

/** Detect exchange family + Nasdaq tier from the exchange string. SEC carries
 *  'NYSE' / 'NYSE American' / 'Nasdaq' (+ CM/GM/GS suffixes). NYSE American =
 *  the former AMEX/MKT, smaller-company venue with its own lower thresholds. */
function detectMarket(exchange: string | null): { family: ExchangeFamily; tier: string; isCapital: boolean } {
  const e = (exchange ?? '').toUpperCase();
  if (/NYSE\s+AMERICAN|\bAMEX\b|NYSE\s*MKT/.test(e)) return { family: 'nyse-american', tier: 'NYSE American', isCapital: false };
  if (/\bNYSE\b|NEW\s+YORK\s+STOCK/.test(e)) return { family: 'nyse', tier: 'NYSE', isCapital: false };
  if (/NASDAQ.*(CM|CAPITAL)|CAPITAL/.test(e)) return { family: 'nasdaq', tier: 'Nasdaq Capital Market', isCapital: true };
  if (/NASDAQ.*\bGS\b|GLOBAL[\s-]?SELECT/.test(e)) return { family: 'nasdaq', tier: 'Nasdaq Global Select Market', isCapital: false };
  if (/NASDAQ/.test(e)) return { family: 'nasdaq', tier: 'Nasdaq Global Market', isCapital: false };
  return { family: 'other', tier: 'Unknown exchange (Nasdaq Global thresholds assumed)', isCapital: false };
}

const M = 1e6;

export async function computeCompliance(
  cik: string,
  ticker: string | undefined,
  exchange: string | null,
): Promise<ComplianceResult | null> {
  if (!ticker) return null;
  const { family, tier, isCapital } = detectMarket(exchange);
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

  // 2. Market Value of Listed Securities (total market cap). $50M is the
  //    common global standard (Nasdaq Global/GS, NYSE); Nasdaq Capital $10M.
  const mvlsThr = (family === 'nasdaq' && isCapital) ? 10 * M : 50 * M;
  if (marketCap !== null) {
    const ok = marketCap >= mvlsThr;
    rules.push({
      rule: 'Market Value of Listed Securities',
      threshold: `≥ $${(mvlsThr / M).toFixed(0)}M (${tier})`,
      status: ok ? 'pass' : 'fail',
      value: `$${(marketCap / M).toFixed(1)}M`,
      detail: `Nasdaq Capital $10M · Nasdaq Global/GS $50M · NYSE ~$50M global standard. Computed at $${px!.price.toFixed(2)} × ${sharesOut!.toLocaleString()} shares.`,
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

  // 3. Stockholders Equity — Nasdaq thresholds (Capital $2.5M / Global $10M) are
  //    rulebook-specific. NYSE/NYSE American use DIFFERENT equity standards; we
  //    surface SE as context but mark 'review' rather than fabricate thresholds.
  if (family !== 'nasdaq') {
    rules.push({
      rule: 'Stockholders Equity',
      threshold: 'exchange-specific (NYSE)',
      status: 'review',
      value: se !== null ? `$${(se / M).toFixed(1)}M` : 'not synced',
      detail: 'NYSE/NYSE American equity standards differ from Nasdaq. Low SE is still a red flag — verify against the specific listing agreement.',
    });
  } else {
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
