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

function parseCSVLine(line: string): string[] {
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
    } else if (char === ',' && !inQuotes) {
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
 * Convert DAS trades to Traderra format
 */
export function convertDASToTraderra(dasTrades: DASTrade[], broker: string = 'DAS'): TraderraTrade[] {
  const timestamp = Date.now()

  return dasTrades.map((trade, index) => {
    // Parse date and time
    const dateStr = trade['Date'] || ''
    const timeStr = trade['Time'] || ''

    // Create datetime from DAS format (M/D/YYYY H:MM:SS)
    const parseDateTime = (date: string, time: string): Date => {
      try {
        const dateTimeStr = `${date} ${time}`
        let parsed = new Date(dateTimeStr)

        if (isNaN(parsed.getTime())) {
          const parts = dateTimeStr.split(' ')
          if (parts.length === 2) {
            const isoString = `${parts[0]}T${parts[1]}`
            parsed = new Date(isoString)
          }
        }

        return parsed
      } catch (error) {
        return new Date('2020-01-01T00:00:00.000Z')
      }
    }

    const entryDateTime = parseDateTime(dateStr, timeStr)

    // For single-entry trades, set close time to same day end of day
    const closeDateTime = new Date(entryDateTime)
    closeDateTime.setHours(23, 59, 59, 999)

    // Parse values
    const safeParseFloat = (value: string): number => {
      if (!value) return 0
      const cleanValue = value.trim()
      if (cleanValue === '' || cleanValue === 'N/A') return 0
      return parseFloat(cleanValue.replace(/[$,%]/g, '')) || 0
    }

    const quantity = parseInt(trade['Quantity']) || 0
    const price = safeParseFloat(trade['Price'])
    const commission = safeParseFloat(trade['Commission'])
    const ecnFee = safeParseFloat(trade['ECNFee'])
    const totalCommission = commission + ecnFee

    // Convert side: B -> Long, S -> Short
    const side = trade['Side']?.toUpperCase() === 'B' ? 'Long' : 'Short'

    return {
      id: `das_${timestamp}_${index + 1}`,
      date: entryDateTime.toISOString().split('T')[0],
      symbol: trade['Symbol'] || '',
      side,
      quantity,
      entryPrice: price,
      exitPrice: price,
      pnl: 0, // Single entry, no P&L yet
      grossPnl: 0,
      pnlPercent: 0,
      commission: totalCommission,
      duration: '00:00:00',
      strategy: broker || 'DAS',
      notes: `Imported from ${broker}`,
      entryTime: entryDateTime.toISOString(),
      exitTime: closeDateTime.toISOString(),
      rMultiple: 0,
      broker: broker,
      brokerFormat: 'das'
    }
  })
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
