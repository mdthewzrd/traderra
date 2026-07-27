import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy PATCH /api/requests/:id to the WZRD bridge (localhost:9876).
 * Used to attach a job_id (and optionally phase_id) to a freshly-created REQ,
 * since the bridge's POST create does not persist job_id.
 */
const BRIDGE = 'http://localhost:9876'

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.pathname.split('/api/requests/')[1] || ''
  try {
    const body = await req.json()
    const r = await fetch(`${BRIDGE}/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json()
    return NextResponse.json(data, { status: r.status })
  } catch {
    return NextResponse.json({ error: 'Bridge unavailable' }, { status: 200 })
  }
}
