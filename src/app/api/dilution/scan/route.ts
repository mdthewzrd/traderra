/**
 * GET /api/dilution/scan
 * Batched screening rows for ALL synced companies. No per-ticker SEC calls —
 * one set of batched DB queries folded in JS. Designed for a sortable table
 * that surfaces the most dilution-toxic names (low/negative runway, high
 * overhang %, loaded shelf, going concern).
 */
import { NextResponse } from 'next/server';
import { getScanRows } from '@/lib/dilution/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await getScanRows();
    return NextResponse.json({ count: rows.length, rows });
  } catch (error) {
    console.error('[api/dilution/scan]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'scan failed' },
      { status: 500 },
    );
  }
}
