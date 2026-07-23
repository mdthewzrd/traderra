import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { detectBrokerFormat, parseCSV, convertTraderVueToTraderra, parseDASCSV, convertDASToTraderra, groupTradesForStorage, type TraderraTrade } from '@/utils/csv-parser'

/**
 * POST /api/trades/upload
 * Import trades from CSV file - OPTIMIZED for bulk operations
 * Supports: Tradervue, DAS, and generic formats
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('user_id') as string || 'default_user'
    const importIfExists = formData.get('import_if_exists') as string || 'update'
    const brokerFormat = formData.get('broker_format') as string || 'auto'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read file content
    const text = await file.text()

    // Parse CSV
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })
    }

    // Detect broker format from headers (DAS is tab-separated, not comma)
    const headerDelimiter = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? '\t' : ','
    const headers = lines[0].split(headerDelimiter).map(h => h.trim().replace(/"/g, ''))
    const detectedFormat = detectBrokerFormat(headers)
    const format = brokerFormat === 'auto' ? detectedFormat : brokerFormat

    console.log(`📥 Processing ${format.toUpperCase()} format for user ${userId}`)

    // Parse based on format
    let traderraTrades: TraderraTrade[] = []

    try {
      if (format === 'das') {
        const dasTrades = parseDASCSV(text)
        traderraTrades = convertDASToTraderra(dasTrades)
      } else {
        // Default to tradervue format
        const traderVueTrades = parseCSV(text, 'tradervue') as any[]
        traderraTrades = convertTraderVueToTraderra(traderVueTrades)
      }
    } catch (parseError) {
      console.error('CSV parsing error:', parseError)
      return NextResponse.json({
        success: false,
        error: `Failed to parse ${format.toUpperCase()} format. Please check your CSV format matches the selected broker.`
      }, { status: 400 })
    }

    console.log(`📥 Processing ${traderraTrades.length} round-trip trades for user ${userId}`)

    // GROUP into per-ticker-per-day parent summaries + child exec trades.
    // Multi-day trades stay standalone. Only multi-trade same-day groups get a parent.
    const storageRows = groupTradesForStorage(traderraTrades)
    const parentCount = storageRows.filter(r => !r.parentId).length
    const childCount = storageRows.filter(r => r.parentId).length
    console.log(`📦 Grouped into ${parentCount} summary rows + ${childCount} exec children`)

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    })

    // BATCH DUPLICATE CHECK - Get all existing trades for this user at once
    const existingTrades = await prisma.trade.findMany({
      where: { userId },
      select: { id: true, symbol: true, date: true, entryPrice: true, side: true, parentId: true }
    })

    // Dedup keys: for parent rows, symbol+date (summary level). For standalone rows, symbol+date+entryPrice.
    const existingParentKeys = new Set(
      existingTrades.filter(t => !t.parentId).map(t => `${t.symbol}|${t.date}`)
    )
    const existingLookup = new Map(
      existingTrades.map(t => [`${t.symbol}|${t.date}|${t.entryPrice}`, t.id])
    )

    // SEPARATE NEW VS EXISTING TRADES
    const newTrades: any[] = []
    let duplicateCount = 0

    // Track which parent IDs we're creating in this batch (so children get included)
    const createdParentIds = new Set<string>()

    for (const row of storageRows) {
      if (!row.parentId) {
        // Parent or standalone row
        const parentKey = `${row.symbol}|${row.date}`
        const standaloneKey = `${row.symbol}|${row.date}|${row.entryPrice}`
        const isGrouped = childCount > 0 && storageRows.some(r => r.parentId === row.id)

        if (isGrouped && existingParentKeys.has(parentKey)) {
          // Parent for this symbol+date already exists → skip entire group (parent + its children)
          duplicateCount++
          continue
        }
        if (!isGrouped && existingLookup.has(standaloneKey)) {
          duplicateCount++
          continue
        }

        createdParentIds.add(row.id)
        newTrades.push({
          id: row.id,
          userId,
          date: row.date,
          symbol: row.symbol,
          side: row.side,
          quantity: row.quantity,
          entryPrice: row.entryPrice,
          exitPrice: row.exitPrice,
          pnl: row.pnl,
          grossPnl: row.grossPnl,
          pnlPercent: row.pnlPercent,
          commission: row.commission,
          riskAmount: row.riskAmount ?? null,
          rMultiple: row.rMultiple ?? null,
          duration: row.duration,
          strategy: row.strategy,
          notes: row.notes,
          entryTime: row.entryTime,
          exitTime: row.exitTime,
          parentId: null,
        })
      } else {
        // Child exec trade — include only if its parent is being created
        if (createdParentIds.has(row.parentId)) {
          newTrades.push({
            id: row.id,
            userId,
            date: row.date,
            symbol: row.symbol,
            side: row.side,
            quantity: row.quantity,
            entryPrice: row.entryPrice,
            exitPrice: row.exitPrice,
            pnl: row.pnl,
            grossPnl: row.grossPnl,
            pnlPercent: row.pnlPercent,
            commission: row.commission,
            riskAmount: row.riskAmount ?? null,
            rMultiple: row.rMultiple ?? null,
            duration: row.duration,
            strategy: row.strategy,
            notes: row.notes,
            entryTime: row.entryTime,
            exitTime: row.exitTime,
            parentId: row.parentId,
          })
        }
      }
    }

    // BATCH OPERATIONS
    let newCount = 0

    // Batch create new trades (in chunks of 100 to avoid timeout)
    const CHUNK_SIZE = 100
    for (let i = 0; i < newTrades.length; i += CHUNK_SIZE) {
      const chunk = newTrades.slice(i, i + CHUNK_SIZE)
      await prisma.trade.createMany({
        data: chunk
      })
      newCount += chunk.length
      console.log(`✅ Imported ${newCount}/${newTrades.length} new trades...`)
    }

    console.log(`✅ Import complete: ${newCount} trades added (${parentCount} parents, ${childCount} children), ${duplicateCount} duplicates skipped`)

    return NextResponse.json({
      success: true,
      message: `Import complete: ${parentCount} ticker${parentCount !== 1 ? 's' : ''} (${childCount} round trips), ${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`,
      newCount,
      updatedCount: 0,
      duplicateCount,
      errorCount: 0,
      batchId: randomUUID()
    })
  } catch (error) {
    console.error('Error in upload:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import trades'
    }, { status: 500 })
  }
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}
