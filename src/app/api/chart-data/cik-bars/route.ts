import { NextRequest, NextResponse } from 'next/server';
import { getContinuousHistory } from '@/lib/data/cik-history';

/**
 * GET /api/chart-data/cik-bars — Continuous, corporate-action-adjusted daily
 * OHLCV history keyed by COMPANY (ticker OR CIK), spanning all historical symbols
 * with reverse-split boundaries scaled for a continuous line.
 *
 * Drop-in alternative to /api/chart-data/bars for consumers that want a
 * rename/split-robust continuous series. ADDITIVE: does NOT modify bars/route.ts.
 *
 * Query:
 *   ?ticker=X   |   ?cik=Y    [&from=YYYY-MM-DD] [&to=YYYY-MM-DD]
 *
 * Response envelope mirrors bars/route.ts ({ bars, symbol, ... }) and adds the
 * CIK-keyed context (cik, splits, chain, earliestFilingDate) plus a sourceSymbol
 * tag on every bar for debuggability. Bars use { t, o, h, l, c, v, sourceSymbol }.
 *
 * Graceful degradation: if Polygon lacks bars for a historical symbol (delisted,
 * foreign/TSXV) the endpoint returns the segments that DID resolve rather than
 * erroring — the ~11.5% residual documented in the Phase 1 resolution landscape.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker') || undefined;
  const cik = searchParams.get('cik') || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;

  if (!ticker && !cik) {
    return NextResponse.json(
      { error: 'Required query param missing: provide `ticker` or `cik`.' },
      { status: 400 },
    );
  }

  try {
    const history = await getContinuousHistory({ ticker, cik, from, to });
    return NextResponse.json({
      bars: history.bars,
      symbol: history.symbol,
      cik: history.cik,
      splits: history.splits,
      chain: history.chain,
      earliestFilingDate: history.earliestFilingDate,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
