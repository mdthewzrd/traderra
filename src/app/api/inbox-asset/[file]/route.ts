import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * GET /api/inbox-asset/[file] — serve a pasted screenshot at runtime.
 *
 * Next.js production (`next start`) only serves public/ files that existed at
 * build time. Screenshots are written to public/inbox/ AFTER the build, so the
 * static handler 404s on them. This route reads the live filesystem instead,
 * so every pasted screenshot is servable immediately — no rebuild required.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  // sanitize: basename only, no path traversal
  const safe = file.replace(/[^a-zA-Z0-9._-]/g, '')
  if (!safe || safe !== file) return NextResponse.json({ error: 'bad file' }, { status: 400 })

  const path = join(process.cwd(), 'public', 'inbox', safe)
  if (!existsSync(path)) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const buf = readFileSync(path)
  const ext = safe.split('.').pop()?.toLowerCase()
  const type =
    ext === 'png' ? 'image/png' :
    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
    ext === 'gif' ? 'image/gif' :
    ext === 'webp' ? 'image/webp' :
    'application/octet-stream'

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
