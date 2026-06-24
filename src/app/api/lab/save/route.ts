import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

// POST { dataUrl } -> writes annotated PNG to the edge-dev uploads folder
// (which the Renata agent reads). Returns the saved path + name.
const OUT_DIR = '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads'

export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = await req.json()
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'missing or invalid dataUrl' }, { status: 400 })
    }
    const base64 = dataUrl.split(',')[1]
    const buf = Buffer.from(base64, 'base64')
    await mkdir(OUT_DIR, { recursive: true })
    const name = `lab-${Date.now()}.png`
    const full = path.join(OUT_DIR, name)
    await writeFile(full, buf)
    return NextResponse.json({ ok: true, path: full, name })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
