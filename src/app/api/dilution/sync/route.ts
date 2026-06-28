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
import { syncForm4Txns } from '@/lib/sec/form4';
import { syncOfferings } from '@/lib/sec/prospectus';
import { syncRegistrations } from '@/lib/sec/registration';
import { syncSecurities } from '@/lib/sec/warrants';
import { syncWarrantNotes } from '@/lib/sec/warrant-notes';
import { backfillTags, getSnapshot } from '@/lib/dilution/store';
import { prisma } from '@/lib/prisma';

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

    // Form 4 + 424B5 parsers run AFTER filings are in the DB (they query
    // DilutionFiling for their target forms). Sequential to the filings sync.
    const [form4Res, offeringsRes, registrationsRes, securitiesRes, warrantNotesRes] = await Promise.all([
      syncForm4Txns(entry.cik),
      syncOfferings(entry.cik),
      syncRegistrations(entry.cik),
      syncSecurities(ticker),
      syncWarrantNotes(entry.cik),
    ]);

    const tagsChanged = await backfillTags(entry.cik);
    const snapshot = await getSnapshot(entry.cik);

    // Persist a 'traderra'-source snapshot to the UNIFIED DilutionReport store
    // so our computed results share a table with the backlogged AskEdgar reports
    // (enables side-by-side comparison + migration off AskEdgar).
    try {
      const rating = (snapshot as { rating?: number }).rating;
      await prisma.dilutionReport.upsert({
        where: { id: `tr-${ticker}-${new Date().toISOString().slice(0, 10)}` },
        create: {
          id: `tr-${ticker}-${new Date().toISOString().slice(0, 10)}`,
          ticker,
          reportDate: new Date(),
          source: 'traderra',
          sourceRef: entry.cik,
          price: null,
          marketCap: null,
          floatShares: null,
          outstandingShares: snapshot.sharesLatest ? BigInt(Math.floor(snapshot.sharesLatest.outstanding)) : null,
          industry: snapshot.company?.sicCode ?? null,
          rawText: 'traderra computed snapshot',
          parsedJson: {
            cik: entry.cik,
            rating,
            tagSummary: snapshot.tagSummary,
            cash: snapshot.cash,
            insiderDilutiveShares90d: snapshot.insiderDilutiveShares90d,
            overhang: snapshot.overhang,
          } as unknown as object,
        },
        update: {}, // idempotent same-day
      });
    } catch {
      // report persistence is non-critical; never fail the sync on it
    }

    return NextResponse.json({
      ticker,
      cik: entry.cik,
      sync: {
        filings: { count: filingsRes.count, status: filingsRes.status, error: filingsRes.error },
        shares: { count: sharesRes.count, status: sharesRes.status },
        cash: { status: finRes.status },
        form4: { status: form4Res.status, parsed: form4Res.parsed, inserted: form4Res.inserted },
        offerings: { status: offeringsRes.status, parsed: offeringsRes.parsed, withDetail: offeringsRes.withDetail },
        registrations: { status: registrationsRes.status, parsed: registrationsRes.parsed, withDetail: registrationsRes.withDetail },
        warrantNotes: { status: warrantNotesRes.status, withDetail: warrantNotesRes.withDetail },
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
