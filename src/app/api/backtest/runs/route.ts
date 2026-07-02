import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * GET /api/backtest/runs           -> registry (list of runs + summaries)
 * GET /api/backtest/runs?id=<id>   -> one run (trades + summary)
 *
 * Runs live in traderra/data/backtest-runs/{id}.json + registry.json.
 * Mirrors how scans are served, so the /backtest page can list & load them
 * as peers to scan runs.
 */
const DATA_DIR = join(process.cwd(), 'data', 'backtest-runs')

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  try {
    if (id) {
      const f = join(DATA_DIR, `${id}.json`)
      if (!existsSync(f)) return NextResponse.json({ error: 'run not found' }, { status: 404 })
      return NextResponse.json(JSON.parse(readFileSync(f, 'utf8')))
    }
    const reg = join(DATA_DIR, 'registry.json')
    if (!existsSync(reg)) return NextResponse.json({ runs: [] })
    return NextResponse.json({ runs: JSON.parse(readFileSync(reg, 'utf8')) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
