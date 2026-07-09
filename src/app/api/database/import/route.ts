import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUserId } from '@/lib/auth-helpers'
import { getDatabaseId } from '@/lib/db-id'

export const maxDuration = 60 // allow large scans to process

// POST /api/database/import  { scanIds: string[] }
// Pulls signal data from each selected saved scan and dedups them into
// CorpusRows (one row per symbol+signalDate). A row hit by multiple scans
// accumulates all scan names in scanSources[].
//
// Data source: SavedScan.results (JSON array) primary, ScanSignal fallback.
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dbId = await getDatabaseId(request, userId)

  const body = await request.json()
  const scanIds: string[] = Array.isArray(body.scanIds) ? body.scanIds : []
  if (scanIds.length === 0) {
    return NextResponse.json({ error: 'No scanIds provided' }, { status: 400 })
  }

  const scans = await prisma.savedScan.findMany({
    where: { id: { in: scanIds } },
    select: { id: true, name: true, results: true },
  })

  const results: { id: string; name: string; signalCount: number }[] = []
  let totalImported = 0

  for (const scan of scans) {
    // gather signal entries: results JSON first, ScanSignal fallback
    let entries: any[] = []
    try {
      const r = JSON.parse(scan.results || '[]')
      if (Array.isArray(r) && r.length) entries = r
    } catch {}
    if (entries.length === 0) {
      const sigs = await prisma.scanSignal.findMany({
        where: { scanId: scan.id },
        select: { ticker: true, signalDate: true, data: true },
      })
      entries = sigs.map((s) => {
        let d: any = {}; try { d = JSON.parse(s.data || '{}') } catch {}
        return { ticker: s.ticker, symbol: s.ticker, date: s.signalDate, ...d }
      })
    }

    // 1. Dedupe IN MEMORY by symbol+signalDate (keep first occurrence)
    const deduped = new Map<string, any>()
    for (const e of entries) {
      const symbol = String(e.symbol || e.ticker || '').toUpperCase()
      const signalDate = String(e.date || e.signalDate || '').slice(0, 10)
      if (!symbol || !signalDate) continue
      const key = `${symbol}|${signalDate}`
      if (!deduped.has(key)) deduped.set(key, e)
    }

    if (deduped.size === 0) {
      results.push({ id: scan.id, name: scan.name, signalCount: 0 })
      continue
    }

    // 2. Fetch existing rows for these symbols in ONE bulk query
    const symbols = [...new Set([...deduped.keys()].map((k) => k.split('|')[0]))]
    const existingRows = await prisma.corpusRow.findMany({
      where: { userId, databaseId: dbId, symbol: { in: symbols } },
      select: { id: true, symbol: true, signalDate: true, scanSources: true },
    })
    const existingMap = new Map<string, { id: string; scanSources: string[] }>()
    for (const r of existingRows) {
      existingMap.set(`${r.symbol}|${r.signalDate}`, { id: r.id, scanSources: r.scanSources })
    }

    // 3. Split into creates vs scan-source updates
    const toCreate: any[] = []
    const toUpdate: string[] = []
    for (const [key, e] of deduped) {
      const existing = existingMap.get(key)
      if (existing) {
        if (!existing.scanSources.includes(scan.name)) toUpdate.push(existing.id)
      } else {
        const { ticker, symbol: _s, date: _d, signal, ...metrics } = e
        const [symbol, signalDate] = key.split('|')
        toCreate.push({ userId, databaseId: dbId, symbol, signalDate, scanSources: [scan.name], metrics })
      }
    }

    // 4. Batch create (chunks of 500)
    for (let i = 0; i < toCreate.length; i += 500) {
      await prisma.corpusRow.createMany({ data: toCreate.slice(i, i + 500), skipDuplicates: true })
    }
    totalImported += toCreate.length

    // 5. Batch scan-source updates (only shared rows — usually few)
    for (const id of toUpdate) {
      await prisma.corpusRow.update({
        where: { id },
        data: { scanSources: { push: scan.name } },
      })
    }

    results.push({ id: scan.id, name: scan.name, signalCount: deduped.size })
  }

  return NextResponse.json({ imported: totalImported, scans: results })
}
