/**
 * POST /api/dilution/sync  { ticker: string }
 * Pulls filings + shares from SEC, persists, classifies tags. Returns snapshot.
 * Idempotent — re-syncing a ticker only fetches the delta (submissions recent).
 */
import { NextResponse } from 'next/server';
import { getCikForTicker } from '@/lib/sec/cik-map';
import { syncFilings } from '@/lib/sec/submissions';
import { syncSharesOutstanding } from '@/lib/sec/companyfacts';
import { syncFinancials } from '@/lib/sec/financials';
import { backfillTags, getSnapshot } from '@/lib/dilution/store';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ticker = typeof body?.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    if (!ticker) {
      return NextResponse.json({ error: 'ticker required' }, { status: 400 });
    }

    const entry = await getCikForTicker(ticker);
    if (!entry) {
      return NextResponse.json(
        { error: `No SEC filer found for ticker "${ticker}"` },
        { status: 404 },
      );
    }

    const [filingsRes, sharesRes, finRes] = await Promise.all([
      syncFilings(ticker, { limit: 50 }),
      syncSharesOutstanding(ticker, { limit: 40 }),
      syncFinancials(ticker, { force: true }),
    ]);

    if (filingsRes.status === 'error' && filingsRes.cik === null) {
      return NextResponse.json({ error: filingsRes.error }, { status: 502 });
    }

    const tagsChanged = await backfillTags(entry.cik);
    const snapshot = await getSnapshot(entry.cik);

    return NextResponse.json({
      ticker,
      cik: entry.cik,
      sync: {
        filings: { count: filingsRes.count, status: filingsRes.status, error: filingsRes.error },
        shares: { count: sharesRes.count, status: sharesRes.status },
        cash: { status: finRes.status },
        tagsChanged,
      },
      snapshot,
    });
  } catch (error) {
    console.error('[api/dilution/sync]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'sync failed' },
      { status: 500 },
    );
  }
}
