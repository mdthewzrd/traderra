import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy to the WZRD web bridge REQ API (localhost:9876/api/requests).
 * Server-side fetch avoids browser CORS (bridge sends no CORS headers).
 * The bridge reads/writes the same .pi/memory/memory.db that Renata's
 * request_create / request_list tools use — so a web submission appears
 * in Renata's inbox instantly.
 */
const BRIDGE = 'http://localhost:9876'

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search || ''
  try {
    const r = await fetch(`${BRIDGE}/api/requests${qs}`, { cache: 'no-store' })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Tag every web-submitted request as a Traderra request and mark the
    // submitter so Renata can tell human-originated work apart.
    const payload = {
      type: 'feature',
      priority: 'normal',
      project: 'traderra',
      triaged_by: 'human',
      ...body,
    }
    const r = await fetch(`${BRIDGE}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
