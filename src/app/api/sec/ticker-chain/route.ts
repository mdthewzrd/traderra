import { NextRequest, NextResponse } from 'next/server';
import { resolveTickerChain, resolveTickerChainByTicker } from '@/lib/sec/ticker-chain';

/**
 * REQ-571 Phase 1 — CIK ticker-chain resolver API.
 *
 * GET /api/sec/ticker-chain?cik=0001889823   → resolve by SEC CIK (10-digit or unpadded)
 * GET /api/sec/ticker-chain?ticker=DFSC       → resolve by CURRENT ticker (SecTickerCik lookup)
 *
 * Returns the full ordered chain of historical ticker symbols + date ranges for
 * the company, plus currentName/currentTickers and earliestFilingDate (the
 * recycling-hazard prune field — consumers MUST discard pre-date bars).
 *
 * Resolution only — no price stitching. See src/lib/sec/ticker-chain.ts.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  const cik = req.nextUrl.searchParams.get('cik');

  if (!ticker && !cik) {
    return NextResponse.json(
      { error: 'Provide ?ticker= (current symbol) or ?cik= (SEC CIK).' },
      { status: 400 },
    );
  }

  try {
    const chain = ticker ? await resolveTickerChainByTicker(ticker) : await resolveTickerChain(cik!);

    if (!chain) {
      return NextResponse.json(
        {
          error: `Unknown ticker "${ticker}" (not present in SecTickerCik as a current ticker). Try ?cik= instead.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(chain);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ticker-chain resolver failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
