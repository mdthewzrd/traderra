import { NextResponse } from 'next/server'

/**
 * Proxy to the WZRD web bridge jobs API (localhost:9876/api/requests jobs).
 * Server-side fetch avoids browser CORS. Traderra is always the edge-dev
 * project, so we filter to edge-dev jobs only.
 *
 * Used by the RequestInbox compose form's job-tag dropdown.
 */
const BRIDGE = 'http://localhost:9876'

export async function GET() {
  try {
    const r = await fetch(`${BRIDGE}/api/jobs`, { cache: 'no-store' })
    const data = await r.json()
    const jobs = Array.isArray(data) ? data : []
    return NextResponse.json(jobs.filter((j: any) => j.project === 'edge-dev'), { status: 200 })
  } catch {
    // Bridge down (e.g. Vercel serverless) — degrade to empty list.
    return NextResponse.json([], { status: 200 })
  }
}
