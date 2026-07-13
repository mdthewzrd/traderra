import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

/**
 * Save a screenshot pasted/dropped in the request modal.
 * Body: { dataUrl: "data:image/png;base64,..." }
 * Returns { url } that the client appends to the request description.
 * Stored in Traderra's public dir so Renata can open it directly.
 */
export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = await req.json()
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'dataUrl required' }, { status: 400 })
    }
    const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!m) return NextResponse.json({ error: 'bad dataUrl' }, { status: 400 })
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
    const dir = join(process.cwd(), 'public', 'inbox')
    mkdirSync(dir, { recursive: true })
    const name = `${Date.now()}.${ext}`
    writeFileSync(join(dir, name), Buffer.from(m[2], 'base64'))
    return NextResponse.json({ url: `/inbox/${name}` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
