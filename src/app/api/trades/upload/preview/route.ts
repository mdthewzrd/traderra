import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PrismaClient } from '@prisma/client'
import { detectBrokerFormat, parseCSV, convertTraderVueToTraderra, parseDASCSV, convertDASToTraderra, type TraderraTrade } from '@/utils/csv-parser'

const prisma = new PrismaClient()

/**
 * POST /api/trades/upload/preview
 * Preview trades from CSV before importing
 * Supports: Tradervue, DAS, and generic formats
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('user_id') as string || 'default_user'
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

    // Detect broker format from headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const detectedFormat = detectBrokerFormat(headers)
    const format = brokerFormat === 'auto' ? detectedFormat : brokerFormat

    // Parse based on format
    let traderraTrades: TraderraTrade[] = []
    let displayFormat: string = format.toUpperCase()

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
        error: `Failed to parse ${displayFormat} format. Please check your CSV format matches the selected broker.`,
        detected_format: detectedFormat,
        requested_format: format
      }, { status: 400 })
    }

    // Safe numeric parsing helper
    const safeParseFloat = (value: string | number): number => {
      if (typeof value === 'number') return value
      if (!value) return 0
      const cleanValue = String(value).trim()
      if (cleanValue === '' || cleanValue === 'N/A' || cleanValue === 'n/a') return 0
      const numericValue = cleanValue.replace(/[$,%]/g, '')
      const parsed = parseFloat(numericValue)
      return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
    }

    // Check for duplicates against database
    const preview = []
    let duplicates = 0
    let new_trades = 0

    for (const trade of traderraTrades.slice(0, 10)) {
      // Use just the date portion for duplicate checking (not full ISO datetime)
      const lookupDate = trade.date // This is already just the date portion
      const entryPrice = safeParseFloat(trade.entryPrice)

      // Check if trade exists
      let existing = await prisma.trade.findFirst({
        where: {
          userId,
          symbol: trade.symbol,
          date: lookupDate,
          entryPrice,
          side: trade.side
        }
      })

      // If not found with current userId, check across all users
      if (!existing) {
        existing = await prisma.trade.findFirst({
          where: {
            symbol: trade.symbol,
            date: lookupDate,
            entryPrice,
            side: trade.side
          }
        })
      }

      const isDuplicate = !!existing
      if (isDuplicate) duplicates++
      else new_trades++

      preview.push({
        symbol: trade.symbol,
        side: trade.side,
        entry_date: lookupDate,
        entry_price: entryPrice,
        pnl: safeParseFloat(trade.pnl || 0),
        is_duplicate: isDuplicate
      })
    }

    return NextResponse.json({
      total_trades: traderraTrades.length,
      duplicates,
      new_trades,
      preview,
      broker_format: format,
      detected_format: detectedFormat
    })
  } catch (error) {
    console.error('Error in preview:', error)
    return NextResponse.json({ error: 'Failed to preview file' }, { status: 500 })
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
      // Found delimiter
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Push the last field
  result.push(current.trim())
  return result
}
