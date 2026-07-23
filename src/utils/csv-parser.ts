export interface TraderVueTrade {
  'Open Datetime': string
  'Close Datetime': string
  'Symbol': string
  'Side': string
  'Volume': string
  'Exec Count': string
  'Entry Price': string
  'Exit Price': string
  'Gross P&L': string
  'Gross P&L (%)': string
  'Shared': string
  'Notes': string
  'Tags': string
  'Gross P&L (t)': string
  'Net P&L': string
  'Commissions': string
  'Fees': string
  'Initial Risk': string
  'P&L (R)': string
  'Position MFE': string
  'Position MAE': string
  'Price MFE': string
  'Price MAE': string
  'Position MFE Datetime': string
  'Position MAE Datetime': string
  'Price MFE Datetime': string
  'Price MAE Datetime': string
  'Best Exit P&L': string
  'Best Exit Datetime': string
}

export interface DASTrade {
  'Date': string
  'Time': string
  'Symbol': string
  'Quantity': string
  'Price': string
  'Side': string
  'Commission': string
  'ECNFee': string
}

export interface TraderraTrade {
  id: string
  date: string
  symbol: string
  side: 'Long' | 'Short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  grossPnl?: number
  pnlPercent: number
  commission: number
  duration: string
  strategy: string
  notes: string
  entryTime: string
  exitTime: string
  riskAmount?: number
  riskPercent?: number
  stopLoss?: number
  rMultiple?: number
  mfe?: number
  mae?: number
  broker?: string
  brokerFormat?: string
}

// Broker format types
export type BrokerFormat = 'tradervue' | 'das' | 'generic'

/**
 * Detect CSV format from headers
 */
export function detectBrokerFormat(headers: string[]): BrokerFormat {
  const headersLower = headers.map(h => h.toLowerCase().trim())

  // DAS format detection
  if (headersLower.includes('date') && headersLower.includes('time') &&
      headersLower.includes('symbol') && headersLower.includes('commission')) {
    return 'das'
  }

  // Tradervue format detection
  if (headersLower.includes('open datetime') && headersLower.includes('close datetime')) {
    return 'tradervue'
  }

  return 'generic'
}

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length
  const commas = (line.match(/,/g) || []).length
  if (tabs > commas) return '\t'
  if (commas > 0) return ','
  // Fallback: 2+ consecutive spaces (some DAS blotters paste space-separated)
  if (/ {2,}/.test(line)) return 'multi-space'
  return ','
}

function parseCSVLine(line: string, delimiter?: string): string[] {
  const delim = delimiter || detectDelimiter(line)
  // Multi-space: split on 2+ spaces
  if (delim === 'multi-space') {
    return line.trim().split(/ {2,}/).map(s => s.trim())
  }
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 2
        continue
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delim && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
    i++
  }

  result.push(current.trim())
  return result
}

/**
 * Parse DAS broker format
 */
export function parseDASCSV(csvText: string): DASTrade[] {
  const lines = csvText.trim().split('\n')
  if (lines.length === 0) return []

  // Remove BOM if present
  let headerLine = lines[0]
  if (headerLine.charCodeAt(0) === 0xFEFF) {
    headerLine = headerLine.slice(1)
  }

  const headers = parseCSVLine(headerLine).map(h => h.trim())
  const trades: DASTrade[] = []

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])

      if (values.length > 0) {
        const trade: any = {}

        headers.forEach((header, index) => {
          trade[header] = index < values.length ? values[index].trim() : ''
        })

        // Only add if has critical fields
        if (trade['Symbol'] && (trade['Date'] || trade['Time'])) {
          trades.push(trade as DASTrade)
        }
      }
    } catch (error) {
      console.warn(`Error parsing DAS row ${i + 1}:`, error)
    }
  }

  return trades
}

/**
 * Convert DAS fills to Traderra round-trip trades using FIFO matching.
 *
 * DAS exports individual EXECUTIONS (fills), not paired trades. We match
 * buys against sells in FIFO order per symbol to produce round-trip trades
 * with real P&L. If you buy first then sell → Long; sell short first then
 * buy to cover → Short. Partial fills and multiple lots are handled.
 */
export function convertDASToTraderra(dasTrades: DASTrade[], broker: string = 'DAS'): TraderraTrade[] {
  const ts = Date.now()
  let tradeIdx = 0

  const safeFloat = (v: string): number => {
    if (!v) return 0
    const c = v.trim().replace(/[$,%]/g, '')
    if (c === '' || c === 'N/A') return 0
    return parseFloat(c) || 0
  }

  const parseDateTime = (date: string, time: string): Date => {
    try {
      // DAS format: M/D/YYYY H:MM:SS (may also be M/D/YY)
      const s = `${date.trim()} ${time.trim()}`
      let d = new Date(s)
      if (isNaN(d.getTime())) {
        // Try normalizing: split date parts, pad month/day
        const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
        if (m) {
          const yr = m[3].length === 2 ? `20${m[3]}` : m[3]
          d = new Date(`${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:${m[6]}`)
        }
      }
      return isNaN(d.getTime()) ? new Date('2020-01-01T00:00:00.000Z') : d
    } catch {
      return new Date('2020-01-01T00:00:00.000Z')
    }
  }

  const formatDuration = (entry: Date, exit: Date): string => {
    const ms = Math.max(0, exit.getTime() - entry.getTime())
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  // Normalize DAS side codes to buy/sell.
  // B/BUY = buy, S/SELL = sell, SS/SSH = short sell, BC/C/COVER = buy to cover.
  const isBuySide = (side: string): boolean => {
    const s = side.toUpperCase().trim()
    return s === 'B' || s === 'BUY' || s === 'BC' || s === 'C' || s === 'COVER'
  }

  // Group fills by symbol
  const bySymbol = new Map<string, { time: Date; side: string; qty: number; price: number; comm: number }[]>()
  for (const f of dasTrades) {
    const sym = (f['Symbol'] || '').trim()
    if (!sym) continue
    const qty = parseInt(f['Quantity']) || 0
    if (qty <= 0) continue
    if (!bySymbol.has(sym)) bySymbol.set(sym, [])
    bySymbol.get(sym)!.push({
      time: parseDateTime(f['Date'], f['Time']),
      side: f['Side'] || '',
      qty,
      price: safeFloat(f['Price']),
      comm: safeFloat(f['Commission']) + safeFloat(f['ECNFee']),
    })
  }

  const out: TraderraTrade[] = []

  for (const [symbol, fills] of bySymbol) {
    // Sort oldest-first for FIFO
    fills.sort((a, b) => a.time.getTime() - b.time.getTime())

    // Open lots waiting to be matched. isLong=true = bought (waiting to sell);
    // isLong=false = shorted (waiting to cover).
    let openLots: { qty: number; price: number; time: Date; comm: number; isLong: boolean }[] = []

    const emit = (dir: 'Long' | 'Short', qty: number, entryPrice: number, exitPrice: number, entryTime: Date, exitTime: Date, comm: number) => {
      const gross = dir === 'Long'
        ? (exitPrice - entryPrice) * qty
        : (entryPrice - exitPrice) * qty
      const pnl = gross - comm
      const cost = entryPrice * qty
      const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0
      out.push({
        id: `das_${ts}_${++tradeIdx}`,
        date: entryTime.toISOString().split('T')[0],
        symbol,
        side: dir,
        quantity: qty,
        entryPrice,
        exitPrice,
        pnl,
        grossPnl: gross,
        pnlPercent,
        commission: comm,
        duration: formatDuration(entryTime, exitTime),
        strategy: broker,
        notes: `Imported from ${broker} (${fills.length} fills, FIFO matched)`,
        entryTime: entryTime.toISOString(),
        exitTime: exitTime.toISOString(),
        rMultiple: 0,
        broker,
        brokerFormat: 'das',
      })
    }

    for (const fill of fills) {
      const buy = isBuySide(fill.side)
      let remaining = fill.qty
      const fillComm = fill.comm

      if (buy) {
        // Cover shorts first (if any), then open/add longs
        while (remaining > 0) {
          const shortLot = openLots.find(l => !l.isLong && l.qty > 0.5)
          if (!shortLot) break
          const matched = Math.min(remaining, shortLot.qty)
          const proratedComm = shortLot.comm * (matched / shortLot.qty) + fillComm * (matched / fill.qty)
          emit('Short', matched, shortLot.price, fill.price, shortLot.time, fill.time, proratedComm)
          shortLot.qty -= matched
          remaining -= matched
        }
        openLots = openLots.filter(l => l.qty > 0.5)
        if (remaining > 0) {
          openLots.push({ qty: remaining, price: fill.price, time: fill.time, comm: fillComm * (remaining / fill.qty), isLong: true })
        }
      } else {
        // Close longs first (if any), then open/add shorts
        while (remaining > 0) {
          const longLot = openLots.find(l => l.isLong && l.qty > 0.5)
          if (!longLot) break
          const matched = Math.min(remaining, longLot.qty)
          const proratedComm = longLot.comm * (matched / longLot.qty) + fillComm * (matched / fill.qty)
          emit('Long', matched, longLot.price, fill.price, longLot.time, fill.time, proratedComm)
          longLot.qty -= matched
          remaining -= matched
        }
        openLots = openLots.filter(l => l.qty > 0.5)
        if (remaining > 0) {
          openLots.push({ qty: remaining, price: fill.price, time: fill.time, comm: fillComm * (remaining / fill.qty), isLong: false })
        }
      }
    }
    // Remaining open lots = unclosed position at EOD. Skip (no exit yet).
  }

  return out
}

/**
 * Parse CSV (auto-detects format)
 */
export function parseCSV(csvText: string, brokerFormat?: BrokerFormat): TraderVueTrade[] | DASTrade[] {
  const lines = csvText.trim().split('\n')
  if (lines.length === 0) return []

  // Remove BOM
  let headerLine = lines[0]
  if (headerLine.charCodeAt(0) === 0xFEFF) {
    headerLine = headerLine.slice(1)
  }

  const headers = parseCSVLine(headerLine).map(h => h.trim())

  // Auto-detect format if not specified
  const detectedFormat = brokerFormat || detectBrokerFormat(headers)

  if (detectedFormat === 'das') {
    console.log('[CSV Parser] Detected DAS broker format')
    return parseDASCSV(csvText)
  }

  console.log('[CSV Parser] Using Tradervue format')
  // Tradervue parsing
  const trades: TraderVueTrade[] = []

  const expectedColumns = [
    'Open Datetime', 'Close Datetime', 'Symbol', 'Side', 'Volume',
    'Exec Count', 'Entry Price', 'Exit Price', 'Gross P&L', 'Gross P&L (%)',
    'Shared', 'Notes', 'Tags', 'Gross P&L (t)', 'Net P&L', 'Commissions',
    'Fees', 'Initial Risk', 'P&L (R)', 'Position MFE', 'Position MAE',
    'Price MFE', 'Price MAE', 'Position MFE Datetime', 'Position MAE Datetime',
    'Price MFE Datetime', 'Price MAE Datetime', 'Best Exit P&L', 'Best Exit Datetime'
  ]

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])

      if (values.length > 0) {
        const trade: any = {}

        headers.forEach((header, index) => {
          trade[header] = index < values.length ? values[index].trim() : ''
        })

        if (trade['Symbol'] && (trade['Open Datetime'] || trade['Close Datetime'])) {
          trades.push(trade as TraderVueTrade)
        }
      }
    } catch (error) {
      console.warn(`Error parsing row ${i + 1}:`, error)
    }
  }

  return trades
}

export function convertTraderVueToTraderra(traderVueTrades: TraderVueTrade[]): TraderraTrade[] {
  const timestamp = Date.now()
  return traderVueTrades.map((trade, index) => {
    const parseDateTime = (dateTimeStr: string): Date => {
      const cleaned = dateTimeStr ? dateTimeStr.trim() : ''
      if (!cleaned || cleaned === '' || cleaned === '""' || cleaned === 'null') {
        return new Date('2020-01-01T00:00:00.000Z')
      }

      try {
        const isoFormat = cleaned.replace(' ', 'T')
        let date = new Date(isoFormat)

        if (isNaN(date.getTime())) {
          const parts = cleaned.split(' ')
          if (parts.length === 2) {
            const [datePart, timePart] = parts
            const isoString = `${datePart}T${timePart}`
            date = new Date(isoString)
          }

          if (isNaN(date.getTime())) {
            date = new Date(`${cleaned}Z`)
          }

          if (isNaN(date.getTime())) {
            console.warn(`⚠️ Invalid datetime: "${dateTimeStr}". Using fallback.`)
            return new Date('2020-01-01T00:00:00.000Z')
          }
        }

        if (date.getFullYear() < 2000 || date.getFullYear() > 2030) {
          console.warn(`⚠️ Unreasonable date: "${dateTimeStr}". Using fallback.`)
          return new Date('2020-01-01T00:00:00.000Z')
        }

        return date
      } catch (error) {
        console.warn(`⚠️ Error parsing datetime "${dateTimeStr}":`, error)
        return new Date('2020-01-01T00:00:00.000Z')
      }
    }

    const entryDateTime = parseDateTime(trade['Open Datetime'])
    const exitDateTime = parseDateTime(trade['Close Datetime'])

    const durationMs = Math.max(0, exitDateTime.getTime() - entryDateTime.getTime())
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
    const duration = `${Math.max(0, hours).toString().padStart(2, '0')}:${Math.max(0, minutes).toString().padStart(2, '0')}:${Math.max(0, seconds).toString().padStart(2, '0')}`

    const safeParseFloat = (value: string, roundToCents: boolean = false): number => {
      if (!value || typeof value !== 'string') return 0
      const cleanValue = value.trim()
      if (cleanValue === '' || cleanValue === 'N/A' || cleanValue === 'n/a') return 0
      if (cleanValue === 'Inf' || cleanValue === 'inf' || cleanValue === 'Infinity') return 0
      if (cleanValue === '-Inf' || cleanValue === '-inf' || cleanValue === '-Infinity') return 0

      const numericValue = cleanValue.replace(/[$,%]/g, '')
      const parsed = parseFloat(numericValue)

      if (isNaN(parsed) || !isFinite(parsed)) return 0

      if (roundToCents) {
        return Math.round(parsed * 100) / 100
      }

      return parsed
    }

    const safeParseInt = (value: string): number => {
      if (!value || typeof value !== 'string') return 0
      const cleanValue = value.trim().replace(/[,$]/g, '')
      if (cleanValue === '' || cleanValue === 'N/A' || cleanValue === 'n/a') return 0
      const parsed = parseInt(cleanValue)
      return isNaN(parsed) ? 0 : parsed
    }

    const entryPrice = safeParseFloat(trade['Entry Price'], true)
    const exitPrice = safeParseFloat(trade['Exit Price'], true)
    const grossPnL = safeParseFloat(trade['Gross P&L'], true)
    const grossPnLPercent = safeParseFloat(trade['Gross P&L (%)'])
    const netPnL = safeParseFloat(trade['Net P&L'], true)
    const commission = safeParseFloat(trade['Commissions'], true)
    const fees = safeParseFloat(trade['Fees'], true)
    const totalCommission = commission + fees
    const volume = safeParseInt(trade['Volume'])
    const initialRisk = safeParseFloat(trade['Initial Risk'], true)
    const rMultipleStr = trade['P&L (R)'] || '0R'
    const rMultiple = safeParseFloat(rMultipleStr.replace('R', ''))

    const mfeValue = safeParseFloat(trade['Position MFE'], true)
    const maeValue = safeParseFloat(trade['Position MAE'], true)
    const mfe = mfeValue !== 0 ? mfeValue : undefined
    const mae = maeValue !== 0 ? maeValue : undefined

    const tags = trade['Tags'] || ''
    const strategy = tags.trim() || 'Untagged'

    const riskPercent = initialRisk > 0 ? (initialRisk / (volume * entryPrice)) * 100 : undefined

    const createSafeDateString = (date: Date): string => {
      try {
        if (!date || isNaN(date.getTime())) {
          return '2020-01-01T00:00:00.000Z'
        }
        return date.toISOString()
      } catch (error) {
        console.warn('Error creating date string:', error)
        return '2020-01-01T00:00:00.000Z'
      }
    }

    const createSafeDateOnly = (date: Date): string => {
      try {
        if (!date || isNaN(date.getTime())) {
          return '2020-01-01'
        }
        return date.toISOString().split('T')[0]
      } catch (error) {
        console.warn('Error creating date string:', error)
        return '2020-01-01'
      }
    }

    return {
      id: `import_${timestamp}_${index + 1}`,
      date: createSafeDateOnly(entryDateTime),
      symbol: trade['Symbol'] || '',
      side: trade['Side'] === 'S' ? 'Short' : 'Long',
      quantity: volume,
      entryPrice,
      exitPrice,
      pnl: netPnL,
      grossPnl: grossPnL,
      pnlPercent: grossPnLPercent,
      commission: totalCommission,
      duration,
      strategy,
      notes: trade['Notes'] || '',
      entryTime: createSafeDateString(entryDateTime),
      exitTime: createSafeDateString(exitDateTime),
      riskAmount: initialRisk > 0 ? initialRisk : undefined,
      riskPercent,
      rMultiple,
      mfe,
      mae
    }
  })
}

export interface ValidationResult {
  valid: boolean
  error?: string
  warnings?: string[]
  preview?: TraderVueTrade[] | DASTrade[]
  statistics?: {
    totalTrades: number
    tradesWithIssues: number
    optionsTrades: number
    invalidSymbols: string[]
    infiniteValues: number
    processingTime: number
  }
  broker?: string
  brokerFormat?: BrokerFormat
}

export function validateTraderVueCSV(csvText: string, broker?: string): ValidationResult {
  const startTime = Date.now()

  try {
    if (!csvText || csvText.trim().length === 0) {
      return { valid: false, error: 'CSV file is empty' }
    }

    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return { valid: false, error: 'CSV file must have at least a header and one data row' }
    }

    let headerLine = lines[0]
    if (headerLine.charCodeAt(0) === 0xFEFF) {
      headerLine = headerLine.slice(1)
    }

    const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''))
    const brokerFormat = detectBrokerFormat(headers)

    // DAS validation
    if (brokerFormat === 'das') {
      const dasRequiredColumns = ['Date', 'Time', 'Symbol', 'Quantity', 'Price', 'Side', 'Commission']
      const missingDAS = dasRequiredColumns.filter(col => !headers.includes(col))

      if (missingDAS.length === 0) {
        const trades = parseDASCSV(csvText)
        if (trades.length === 0) {
          return { valid: false, error: 'No valid trades found in DAS CSV file' }
        }

        return {
          valid: true,
          broker: broker || 'DAS',
          brokerFormat,
          preview: trades.slice(0, 5),
          statistics: {
            totalTrades: trades.length,
            tradesWithIssues: 0,
            optionsTrades: 0,
            invalidSymbols: [],
            infiniteValues: 0,
            processingTime: Date.now() - startTime
          }
        }
      } else {
        return { valid: false, error: `Missing DAS columns: ${missingDAS.join(', ')}` }
      }
    }

    // Tradervue validation
    const requiredColumns = ['Open Datetime', 'Close Datetime', 'Symbol', 'Side', 'Volume', 'Entry Price', 'Exit Price', 'Net P&L']
    const missingColumns = requiredColumns.filter(col => !headers.includes(col))

    if (missingColumns.length > 0) {
      return { valid: false, error: `Missing required columns: ${missingColumns.join(', ')}` }
    }

    const trades = parseCSV(csvText)

    if (trades.length === 0) {
      return { valid: false, error: 'No valid trades found in CSV file (all rows may be missing critical data)' }
    }

    const warnings: string[] = []
    let tradesWithIssues = 0
    let optionsTrades = 0
    let infiniteValues = 0
    const invalidSymbols: string[] = []

    trades.forEach((trade, index) => {
      const symbol = trade['Symbol'] || ''
      if (isOptionsSymbol(symbol)) {
        optionsTrades++
      }

      if (!symbol.trim()) {
        invalidSymbols.push(`Row ${index + 2}: Empty symbol`)
        tradesWithIssues++
      }

      const netPnL = trade['Net P&L'] || ''
      const grossPnL = trade['Gross P&L'] || ''
      const pnlPercent = trade['Gross P&L (%)'] || ''

      if (netPnL.includes('Inf') || grossPnL.includes('Inf') || pnlPercent.includes('Inf')) {
        infiniteValues++
      }

      const openDateTime = trade['Open Datetime'] || ''
      const closeDateTime = trade['Close Datetime'] || ''

      if (!openDateTime || !closeDateTime) {
        tradesWithIssues++
      } else {
        try {
          const testOpen = new Date(openDateTime.replace(' ', 'T'))
          const testClose = new Date(closeDateTime.replace(' ', 'T'))

          if (isNaN(testOpen.getTime()) || isNaN(testClose.getTime())) {
            console.warn(`Row ${index + 2}: Invalid datetime format - Open: "${openDateTime}", Close: "${closeDateTime}"`)
            tradesWithIssues++
          }
        } catch (error) {
          console.warn(`Row ${index + 2}: Datetime parsing error`, error)
          tradesWithIssues++
        }
      }
    })

    if (optionsTrades > 0) {
      warnings.push(`Found ${optionsTrades} options trades - verify symbol handling`)
    }

    if (infiniteValues > 0) {
      warnings.push(`Found ${infiniteValues} trades with infinite values - will be converted to 0`)
    }

    if (invalidSymbols.length > 0) {
      warnings.push(`Found ${invalidSymbols.length} trades with invalid symbols`)
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      preview: trades.slice(0, 5),
      statistics: {
        totalTrades: trades.length,
        tradesWithIssues,
        optionsTrades,
        invalidSymbols,
        infiniteValues,
        processingTime: Date.now() - startTime
      },
      broker: broker || 'Tradervue'
    }
  } catch (error) {
    return {
      valid: false,
      error: `Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

function isOptionsSymbol(symbol: string): boolean {
  if (!symbol) return false
  const cleanSymbol = symbol.trim().toUpperCase()

  if (/\d{6}[CP]\d{8}/.test(cleanSymbol)) return true
  if (/^[A-Z]{1,5}\d+[CP]/.test(cleanSymbol) || /\d{6}/.test(cleanSymbol)) {
    return true
  }

  return false
}
