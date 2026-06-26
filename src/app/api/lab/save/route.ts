import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

// POST { dataUrl } -> writes annotated PNG to the edge-dev uploads folder
// (which the Renata agent reads). Returns the saved path + name.
const OUT_DIR = '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads'

export async function POST(req: NextRequest) {
  try {
    const { dataUrl, objects, cw, ch } = await req.json()
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'missing or invalid dataUrl' }, { status: 400 })
    }
    const base64 = dataUrl.split(',')[1]
    const buf = Buffer.from(base64, 'base64')
    await mkdir(OUT_DIR, { recursive: true })
    const name = `lab-${Date.now()}.png`
    const full = path.join(OUT_DIR, name)
    await writeFile(full, buf)

    // Sidecar .txt: human-readable serialization of the annotations. The agent cannot
    // read the PNG (no image input), so we expose every text label, arrow, and box here.
    // ALWAYS write a sidecar so we can diagnose whether the lab captured any objects.
    const lines: string[] = []
    lines.push(`# Lingua Lab annotations — ${name}`)
    lines.push(`# Canvas: ${cw || '?'}x${ch || '?'}, received ${Array.isArray(objects) ? objects.length : 'NON-ARRAY(' + typeof objects + ')'} objects`)
    if (Array.isArray(objects) && objects.length) {
      lines.push(`# Sorted left→right = chart timeline`)
      lines.push(`# leftPct/topPct = position relative to canvas; 0% = far left/top, 100% = far right/bottom`)
      lines.push('')
      lines.push('## TEXT LABELS (cycle notes — read these first)')
      for (const o of objects.filter((o: any) => o.text)) {
        lines.push(`[${o.leftPct}% L, ${o.topPct}% T] ${JSON.stringify(o.text)}`)
      }
      lines.push('')
      lines.push('## ALL OBJECTS (in timeline order)')
      for (const o of objects) {
        const pos = `[${o.leftPct}% L, ${o.topPct}% T]`
        const col = o.stroke || o.fill || ''
        if (o.type === 'i-text' || o.type === 'textbox' || o.text) {
          lines.push(`${pos} TEXT ${col}: ${JSON.stringify(o.text || '')}`)
        } else if (o.type === 'line') {
          lines.push(`${pos} LINE ${col} ${o.width}x${o.height} angle=${o.angle}`)
        } else if (o.type === 'path') {
          lines.push(`${pos} ARROW/PATH ${col} ${o.width}x${o.height} angle=${o.angle}`)
        } else if (o.type === 'rect') {
          lines.push(`${pos} BOX ${col} ${o.width}x${o.height}`)
        } else {
          lines.push(`${pos} ${o.type?.toUpperCase()} ${col} ${o.width}x${o.height}`)
        }
      }
    } else {
      lines.push('')
      lines.push('## NO FABRIC OBJECTS FOUND')
      lines.push('The pasted image has annotations baked as pixels (drawn on the charts page),')
      lines.push('OR nothing was drawn in the lab on top of the image.')
      lines.push('To make annotations readable: use the lab Text (T) / Arrow tools on the lab canvas, then save again.')
    }
    await writeFile(full.replace(/\.png$/, '.txt'), lines.join('\n'))

    return NextResponse.json({ ok: true, path: full, name })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
