export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

// Chart templates — GLOBAL store. This is a local single-user app, so templates
// are persisted globally (visible on /chart, /live-scan, /database, /dilution …
// with NO sign-in required). The `global` flag makes a template readable by
// everyone; the authed/local user remains its owner for edit/delete control.
//
// The full ChartTemplate payload (chartStyle, theme, symbol, tf, inds, tools,
// colors, params) is stored as JSON in the `tools` column and returned spread,
// so every page gets the rich template, not just the tools array.

const LOCAL_USER_EMAIL = process.env.LOCAL_USER_EMAIL || 'mikedurante13@gmail.com'

// Owner for a write: the signed-in user, or (local fallback) the known local
// account — lets the chart page persist without requiring sign-in everywhere.
async function resolveOwnerId(req?: Request): Promise<string | null> {
  const authed = await getAuthUserId(req)
  if (authed) return authed
  try {
    const u = await prisma.user.findFirst({ where: { email: LOCAL_USER_EMAIL }, select: { id: true } })
    return u?.id ?? null
  } catch {
    return null
  }
}

// GET /api/chart-data/templates — global templates to everyone (no auth) + own.
export async function GET(req: Request) {
  const userId = await getAuthUserId(req)
  const filterType = new URL(req.url).searchParams.get('type')
  const where: any = { OR: [{ global: true }, ...(userId ? [{ userId }] : [])] }
  if (filterType) where.type = filterType
  const templates = await prisma.chartTemplate.findMany({
    where,
    orderBy: [{ global: 'desc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({
    templates: templates.map(t => {
      let payload: any = {}
      try { payload = JSON.parse(t.tools) } catch {}
      return { id: t.id, name: t.name, global: t.global, type: t.type, ...(payload || {}) }
    }),
  })
}

// PUT /api/chart-data/templates  body: { id?, name, payload, global? }
// Upserts BY NAME (so saving the same name updates in place). Defaults global:true.
export async function PUT(req: Request) {
  const userId = await resolveOwnerId(req)
  if (!userId) return NextResponse.json({ error: 'no local user found' }, { status: 500 })
  const { id, name, payload, global, type } = await req.json()
  const tplName = name || payload?.name
  if (!tplName) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const isGlobal = global !== false // default true
  const tplType = type || 'template'
  // match an existing global/own template by name + type → update in place
  const existing = await prisma.chartTemplate.findFirst({
    where: { name: tplName, type: tplType, OR: [{ global: true }, { userId }] },
    select: { id: true },
  })
  const rowId = existing?.id || id || `tpl_${Date.now()}`
  const snapshot = JSON.stringify({ ...payload, name: tplName, ts: Date.now() })
  const template = await prisma.chartTemplate.upsert({
    where: { id: rowId },
    create: { userId, name: tplName, type: tplType, tools: snapshot, global: isGlobal },
    update: { name: tplName, type: tplType, tools: snapshot, global: isGlobal },
  })
  return NextResponse.json({ ok: true, id: template.id })
}

// DELETE /api/chart-data/templates?id=xxx — local trusted: delete global or own.
export async function DELETE(req: NextRequest) {
  const userId = await resolveOwnerId(req)
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await prisma.chartTemplate.deleteMany({
    where: { id, OR: [{ global: true }, ...(userId ? [{ userId }] : [])] },
  })
  return NextResponse.json({ ok: true })
}
