import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

// GET /api/lab/image/lab-1782...png  → serves the annotated PNG from the uploads folder
const UPLOAD_DIR = '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!/^lab-\d+\.png$/.test(name)) return NextResponse.json({ error: 'invalid name' }, { status: 400 })
  try {
    const buf = await readFile(path.join(UPLOAD_DIR, name))
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
}
