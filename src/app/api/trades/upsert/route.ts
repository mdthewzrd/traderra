import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createHash } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Generate a hash from trade data for duplicate detection
 */
function generateTradeHash(trade: any): string {
  const keyData = {
    date: trade.date,
    symbol: trade.symbol,
    side: trade.side,
    quantity: trade.quantity,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice
  }
  return createHash('sha256').update(JSON.stringify(keyData)).digest('hex')
}

/**
 * Parse CSV content and extract trades
 */
function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const trades: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) continue

    const trade: any = {}
    headers.forEach((header, index) => {
      trade[header] = values[index]
    })

    // Skip if missing required fields
    if (!trade.Symbol || !trade['Entry Price']) continue

    trades.push({
      date: trade['Open Datetime'] || trade.date || new Date().toISOString(),
      symbol: trade.Symbol || trade.symbol,
      side: trade.Side || trade.side || 'Long',
      quantity: parseFloat(trade.Volume || trade.quantity || '0'),
      entryPrice: parseFloat(trade['Entry Price'] || trade.entryPrice || '0'),
      exitPrice: parseFloat(trade['Exit Price'] || trade.exitPrice || '0'),
      netPnL: parseFloat(trade['Net P&L'] || trade.netPnL || '0'),
      raw: trade // Keep raw data for reference
    })
  }

  return trades
}

export async function POST(request: NextRequest) {
  try {
    // Try to get userId from Clerk auth first
    let userId
    try {
      const authData = await auth()
      userId = authData?.userId
    } catch {
      // Auth failed, will use userId from request body
    }

    // Parse body to get userId and file data
    const body = await request.json()
    const { csvContent, fileName, userId: bodyUserId } = body

    // Use userId from auth, or fall back to body
    userId = userId || bodyUserId

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - no userId provided' }, { status: 401 })
    }

    if (!csvContent) {
      return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 })
    }

    if (!csvContent) {
      return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 })
    }

    // Decode base64 if needed
    let csvText = csvContent
    if (csvContent.includes('base64,')) {
      csvText = Buffer.from(csvContent.split(',')[1], 'base64').toString('utf-8')
    } else if (/^[A-Za-z0-9+/]+=*$/.test(csvContent)) {
      // Check if it's base64 without the prefix
      try {
        csvText = Buffer.from(csvContent, 'base64').toString('utf-8')
      } catch {
        // Not base64, use as-is
      }
    }

    // Remove BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1)
    }

    // Parse CSV
    const trades = parseCSV(csvText)

    if (trades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid trades found in CSV'
      }, { status: 400 })
    }

    // Import trades to database
    let importedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const trade of trades) {
      try {
        // Check if trade already exists (by date, symbol, side, entryPrice)
        const existingTrade = await prisma.trade.findFirst({
          where: {
            userId,
            date: trade.date,
            symbol: trade.symbol,
            side: trade.side,
            entryPrice: trade.entryPrice
          }
        })

        if (existingTrade) {
          // UPDATE existing trade with new values (especially P&L)
          await prisma.trade.update({
            where: { id: existingTrade.id },
            data: {
              exitPrice: trade.exitPrice,
              pnl: trade.netPnL || 0,
              pnlPercent: trade.netPnL && trade.entryPrice > 0
                ? (trade.netPnL / (trade.entryPrice * trade.quantity)) * 100
                : 0,
              quantity: trade.quantity,
              duration: trade.raw?.['Duration'] || existingTrade.duration,
              strategy: trade.raw?.Strategy || existingTrade.strategy,
              notes: trade.raw?.Notes || existingTrade.notes,
              exitTime: trade.raw?.['Close Datetime'] || trade.date
            }
          })
          skippedCount++ // Count as "updated" not "new"
        } else {
          // Create new trade
          await prisma.trade.create({
            data: {
              userId,
              date: trade.date,
              symbol: trade.symbol,
              side: trade.side,
              quantity: trade.quantity,
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice,
              pnl: trade.netPnL || 0,
              pnlPercent: trade.netPnL && trade.entryPrice > 0
                ? (trade.netPnL / (trade.entryPrice * trade.quantity)) * 100
                : 0,
              commission: 0,
              duration: trade.raw?.['Duration'] || '',
              strategy: trade.raw?.Strategy || '',
              notes: trade.raw?.Notes || '',
              entryTime: trade.raw?.['Open Datetime'] || trade.date,
              exitTime: trade.raw?.['Close Datetime'] || trade.date
            }
          })
          importedCount++
        }
      } catch (error) {
        const errorMsg = `Failed to import trade ${trade.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import complete: ${importedCount} new trades added${skippedCount > 0 ? `, ${skippedCount} existing trades updated` : ''}${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
      imported: importedCount,
      updated: skippedCount,
      skipped: 0, // No trades are truly skipped now
      errors: errors.length > 0 ? errors : undefined,
      trades: trades.slice(0, 5).map(t => ({ // Show first 5 as preview
        symbol: t.symbol,
        side: t.side,
        quantity: t.quantity,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        netPnL: t.netPnL,
        date: t.date
      })),
      totalTrades: trades.length
    })

  } catch (error) {
    console.error('Error in trades upsert:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process trades'
    }, { status: 500 })
  }
}
