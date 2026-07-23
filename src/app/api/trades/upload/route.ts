import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { detectBrokerFormat, parseCSV, convertTraderVueToTraderra, parseDASCSV, convertDASToTraderra, type TraderraTrade } from '@/utils/csv-parser'

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

    console.log(`📥 Processing ${traderraTrades.length} trades for user ${userId}`)
    console.log('📋 Sample trade:', JSON.stringify(traderraTrades[0], null, 2))

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId }
    })

    // BATCH DUPLICATE CHECK - Get all existing trades for this user at once
    const existingTrades = await prisma.trade.findMany({
      where: { userId },
      select: { id: true, symbol: true, date: true, entryPrice: true, side: true }
    })

    const existingLookup = new Map(
      existingTrades.map(t => [
        `${t.symbol}|${t.date}|${t.entryPrice}`,
        t.id
      ])
    )

    // SEPARATE NEW VS EXISTING TRADES
    const newTrades: any[] = []
    const updateTrades: any[] = []
    let duplicateCount = 0

    for (const trade of traderraTrades) {
      // Use just the date portion for duplicate checking (matches database format)
      const lookupDate = trade.date // This is already just the date portion
      const lookupKey = `${trade.symbol}|${lookupDate}|${trade.entryPrice}`
      const existingId = existingLookup.get(lookupKey)

      if (existingId) {
        if (importIfExists === 'update') {
          updateTrades.push({
            where: { id: existingId },
            data: {
              exitPrice: trade.exitPrice,
              pnl: trade.pnl,
              grossPnl: trade.grossPnl,
              pnlPercent: trade.pnlPercent,
              quantity: trade.quantity,
              commission: trade.commission,
              riskAmount: trade.riskAmount,
              rMultiple: trade.rMultiple,
              duration: trade.duration,
              strategy: trade.strategy,
              notes: trade.notes,
              entryTime: trade.entryTime,
              exitTime: trade.exitTime
            }
          })
        } else {
          duplicateCount++
        }
      } else {
        newTrades.push({
          id: randomUUID(),
          userId,
          date: trade.date, // Already in YYYY-MM-DD format
          symbol: trade.symbol,
          side: trade.side,
          quantity: trade.quantity,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          pnl: trade.pnl,
          grossPnl: trade.grossPnl,
          pnlPercent: trade.pnlPercent,
          commission: trade.commission,
          riskAmount: trade.riskAmount,
          rMultiple: trade.rMultiple,
          duration: trade.duration,
          strategy: trade.strategy,
          notes: trade.notes,
          entryTime: trade.entryTime,
          exitTime: trade.exitTime
        })
      }
    }

    // BATCH OPERATIONS
    let newCount = 0
    let updatedCount = 0

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

    // Batch update existing trades
    if (importIfExists === 'update') {
      for (const update of updateTrades) {
        await prisma.trade.update(update)
        updatedCount++
      }
      console.log(`✅ Updated ${updatedCount} existing trades`)
    }

    console.log(`✅ Import complete: ${newCount} new, ${updatedCount} updated, ${duplicateCount} duplicates skipped`)

    return NextResponse.json({
      success: true,
      message: `Import complete: ${newCount} new trades added${updatedCount > 0 ? `, ${updatedCount} existing trades updated` : ''}${duplicateCount > 0 ? `, ${duplicateCount} duplicates skipped` : ''}`,
      newCount,
      updatedCount,
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
