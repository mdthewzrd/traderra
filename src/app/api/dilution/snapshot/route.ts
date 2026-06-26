/**
 * GET /api/dilution/snapshot?ticker=AAPL
 * Reads the dilution snapshot from DB only (no SEC call). If the company has
 * never been synced, returns needsSync:true so the client can trigger a sync.
 */
import { NextResponse } from 'next/server';
import { getCikForTicker } from '@/lib/sec/cik-map';
import { getSnapshot } from '@/lib/dilution/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = (searchParams.get('ticker') ?? '').trim().toUpperCase();
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

    const snapshot = await getSnapshot(entry.cik);
    return NextResponse.json({
      ticker,
      cik: entry.cik,
      needsSync: snapshot.company === null,
      snapshot,
    });
  } catch (error) {
    console.error('[api/dilution/snapshot]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'snapshot failed' },
      { status: 500 },
    );
  }
}
