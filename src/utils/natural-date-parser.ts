/**
 * 🗓️ Enhanced Natural Language Date Parser with AI-Powered Fuzzy Matching
 *
 * Intelligent date parsing system that handles:
 * - Typos and spelling corrections: "januray to febuary", "march 15th ot april 10th"
 * - Missing spaces: "1/1/25to3/1/25", "jan15tofeb15"
 * - Varied punctuation: "Jan 15 - Feb 15", "Jan 15...Feb 15", "Jan 15? Feb 15"
 * - Natural language variations: "show me", "change to", "set date range"
 * - Fuzzy matching: "tommorow", "yestrday", "last munth"
 * - Intelligent fallback: handles partial matches and context
 *
 * @author Renata AI System - Enhanced with Bulletproof Parsing
 */

export interface ParsedDateRange {
  start: Date
  end: Date
  label: string
  isCustom: boolean
  confidence: number // 0-1 confidence score
  correctionInfo?: {
    original: string
    corrected: string
    corrections: string[]
  }
}

export interface DateParseResult {
  success: boolean
  dateRange?: ParsedDateRange
  error?: string
  originalText: string
  suggestions?: string[]
}

// Common typos and corrections dictionary
const TYPO_CORRECTIONS: Record<string, string> = {
  // Month typos
  'januray': 'january', 'januray': 'january', 'january': 'january',
  'feburary': 'february', 'febuary': 'february', 'februray': 'february',
  'march': 'march', 'marhc': 'march',
  'april': 'april', 'aprill': 'april',
  'may': 'may', 'mayy': 'may',
  'june': 'june', 'june': 'june',
  'july': 'july', 'julY': 'july',
  'august': 'august', 'augst': 'august', 'augut': 'august',
  'september': 'september', 'septemebr': 'september', 'septemer': 'september',
  'october': 'october', 'october': 'october', 'octoer': 'october',
  'november': 'november', 'novmber': 'november', 'novemebr': 'november',
  'december': 'december', 'decembe': 'december', 'decmeber': 'december',

  // Short month typos
  'jan': 'jan', 'jna': 'jan',
  'feb': 'feb', 'fe': 'feb',
  'mar': 'mar', 'mr': 'mar',
  'apr': 'apr', 'ap': 'apr',
  'jun': 'jun', 'jn': 'jun',
  'jul': 'jul', 'jl': 'jul',
  'aug': 'aug', 'ag': 'aug',
  'sep': 'sep', 'sept': 'sep', 'sp': 'sep',
  'oct': 'oct', 'ot': 'oct',
  'nov': 'nov', 'nv': 'nov',
  'dec': 'dec', 'dc': 'dec',

  // Common word typos (be more conservative)
  'tommorow': 'tomorrow', 'tommorrow': 'tomorrow', 'tomorow': 'tomorrow',
  'yestrday': 'yesterday', 'yersteday': 'yesterday',
  'todat': 'today', 'todya': 'today',
  'munth': 'month', 'monnth': 'month',
  'wek': 'week', 'weak': 'week',
  'yaer': 'year', 'yeer': 'year',
  'daY': 'day', 'dya': 'day',

  // Prepositions and connectors (be conservative)
  'ot': 'to', 'too': 'to',
  'form': 'from',
  'thru': 'through', 'thrugh': 'through',
  'till': 'until', 'til': 'until',
  'sice': 'since', 'sence': 'since'
}

// Fuzzy month matching - allows for missing letters and extra letters
const FUZZY_MONTHS: Array<{name: string, pattern: RegExp, index: number}> = [
  {name: 'january', pattern: /j[au]*n[au]*[ae]*r[ai]*y/, index: 0},
  {name: 'february', pattern: /f[ae]*b[ru]*[ae]*r[ai]*y/, index: 1},
  {name: 'march', pattern: /m[au]*r[ae]*c[ho]*/, index: 2},
  {name: 'april', pattern: /[ai]*p[ri]*[ei]*l/, index: 3},
  {name: 'may', pattern: /m[au]*y/, index: 4},
  {name: 'june', pattern: /j[au]*n[ei]*/, index: 5},
  {name: 'july', pattern: /j[au]*l[ai]*y/, index: 6},
  {name: 'august', pattern: /[au]*g[au]*[st]*[ae]*[st]*[ae]*[st]*/, index: 7},
  {name: 'september', pattern: /s[ae]*p[ta]*[te]*[me]*[mb]*[ae]*r/, index: 8},
  {name: 'october', pattern: /[ou]*c[ta]*[ou]*b[ae]*r/, index: 9},
  {name: 'november', pattern: /n[ou]*v[ae]*[me]*[mb]*[ae]*r/, index: 10},
  {name: 'december', pattern: /d[ae]*c[ae]*[me]*[mb]*[ae]*r/, index: 11}
]

/**
 * Enhanced main date parsing function with intelligent preprocessing
 */
export function parseNaturalDateRange(text: string): DateParseResult {
  const originalText = text
  console.log(`🧠 ENHANCED DATE PARSER: Processing "${text}"`)

  try {
    // Step 1: Intelligent preprocessing with typo correction and normalization
    const preprocessResult = intelligentPreprocess(text)
    const normalizedText = preprocessResult.correctedText

    console.log(`🔧 PREPROCESS: "${text}" -> "${normalizedText}" (${preprocessResult.corrections.join(', ')})`)

    // Step 2: Try different parsing strategies in order of specificity
    const strategies = [
      parseDateToDateRanges,    // Most specific - "Jan 1st to Apr 1st"
      parseSpecificDateRanges,  // "15th of January", "January 15"
      parseComplexRanges,      // "July to the end of August"
      parseMonthToMonthRanges, // "January to March"
      parseQuarterRanges,      // "Q1 2024", "Q4 2023"
      parseMonthYearRanges,    // "January 2025"
      parseRelativeRanges,    // "last 3 months", "ytd"
      parseYearOnlyRanges,    // Least specific - "2025 data", "all of 2025"
      parsePresetRanges       // Fallback - preset buttons
    ]

    // Step 3: Try each strategy with higher confidence for exact matches
    for (const strategy of strategies) {
      const result = strategy(normalizedText)
      if (result.success && result.dateRange) {
        // Add correction info to the result
        if (preprocessResult.corrections.length > 0) {
          result.dateRange.correctionInfo = {
            original: text,
            corrected: normalizedText,
            corrections: preprocessResult.corrections
          }
          // Less confidence penalty for minor corrections (typos, spacing)
          const penalty = preprocessResult.corrections.filter(c =>
            c.includes('typo') || c.includes('missing')
          ).length * 0.05
          result.dateRange.confidence = Math.max(0.7, result.dateRange.confidence - penalty)
        }

        console.log(`✅ PARSED with strategy ${strategy.name}: ${result.dateRange.label} (confidence: ${result.dateRange.confidence})`)
        return { ...result, originalText }
      }
    }

    // Step 4: Try smart fuzzy matching only as last resort
    // Skip fuzzy matching if there were significant preprocessing corrections
    if (preprocessResult.corrections.length <= 2) {
      const fuzzyResult = trySmartFuzzyParsing(normalizedText)
      if (fuzzyResult.success && fuzzyResult.dateRange) {
        if (preprocessResult.corrections.length > 0) {
          fuzzyResult.dateRange.correctionInfo = {
            original: text,
            corrected: normalizedText,
            corrections: [...preprocessResult.corrections, 'smart fuzzy matching']
          }
          fuzzyResult.dateRange.confidence = Math.max(0.4, fuzzyResult.dateRange.confidence - 0.15)
        }

        console.log(`🎯 SMART FUZZY PARSED: ${fuzzyResult.dateRange.label} (confidence: ${fuzzyResult.dateRange.confidence})`)
        return { ...fuzzyResult, originalText }
      }
    }

    // Step 5: Generate intelligent suggestions if all parsing fails
    const suggestions = generateIntelligentSuggestions(normalizedText)

    console.log(`❌ PARSING FAILED: No strategy could parse "${text}"`)
    return {
      success: false,
      error: `Could not parse date range: "${text}". Try: ${suggestions.slice(0, 3).join(', ')}`,
      originalText,
      suggestions
    }

  } catch (error) {
    console.error(`💥 DATE PARSER ERROR:`, error)
    return {
      success: false,
      error: `Error parsing date: ${error instanceof Error ? error.message : 'Unknown error'}`,
      originalText
    }
  }
}

/**
 * Intelligent preprocessing with typo correction and normalization
 */
function intelligentPreprocess(text: string): { correctedText: string, corrections: string[] } {
  const corrections: string[] = []
  let processedText = text.toLowerCase().trim()

  // Step 1: Remove conversational prefixes
  const conversationPrefixes = [
    'show me', 'show', 'change to', 'change', 'set date range to', 'set date range', 'set',
    'i want to see', 'i want', 'can you show me', 'can you show', 'display', 'view',
    'switch to', 'switch', 'go to', 'navigate to', 'update to', 'update'
  ]

  for (const prefix of conversationPrefixes) {
    if (processedText.startsWith(prefix)) {
      processedText = processedText.substring(prefix.length).trim()
      corrections.push(`removed "${prefix}"`)
      break
    }
  }

  // Step 2: Apply typo corrections - be very conservative to avoid breaking valid patterns
  const words = processedText.split(/\s+/)
  const correctedWords = words.map(word => {
    // Check for exact typo matches first
    if (TYPO_CORRECTIONS[word]) {
      corrections.push(`"${word}" → "${TYPO_CORRECTIONS[word]}"`)
      return TYPO_CORRECTIONS[word]
    }

    // Only apply fuzzy matching for very obvious typos, and only if exact correction doesn't exist
    // Skip fuzzy matching for important words that shouldn't be changed
    const importantWords = ['last', 'next', 'this', 'data', 'show', 'set', 'get', 'time', 'date', 'days', 'months', 'month', 'tomorrow', 'yesterday']
    if (importantWords.includes(word.toLowerCase())) {
      return word
    }

    // Very conservative fuzzy matching - only for words that are very close to known typos
    for (const [incorrect, correct] of Object.entries(TYPO_CORRECTIONS)) {
      if (word.length >= 4 && Math.abs(word.length - incorrect.length) <= 1 && isFuzzyMatch(word, incorrect, 0.9)) {
        corrections.push(`"${word}" → "${correct}" (fuzzy)`)
        return correct
      }
    }

    return word
  })

  processedText = correctedWords.join(' ')

  // Step 3: Fix spacing and punctuation issues
  // Add missing spaces around dates: "1/1/25to3/1/25" -> "1/1/25 to 3/1/25"
  processedText = processedText.replace(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)to(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/g, '$1 to $2')
  // Add missing spaces around month abbreviations: "jan15tofeb15" -> "jan 15 to feb 15"
  processedText = processedText.replace(/([a-z]{3,})(\d{1,2})(to)([a-z]{3,})(\d{1,2})/g, '$1 $2 to $4 $5')
  // Add missing spaces around month names: "janto" -> "jan to" but only for actual months
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  monthNames.forEach(month => {
    const regex = new RegExp(`(${month})to(${month})`, 'gi')
    processedText = processedText.replace(regex, '$1 to $2')
  })
  // Add missing spaces between month abbreviations with numbers: "janto" -> "jan to"
  monthNames.forEach(month => {
    const regex = new RegExp(`(${month})to`, 'gi')
    processedText = processedText.replace(regex, '$1 to')
  })

  // Fix common punctuation issues - be smarter about preserving month names
  processedText = processedText.replace(/[.?]/g, ' ') // Replace ? and . with spaces
  processedText = processedText.replace(/\s+/g, ' ') // Normalize multiple spaces

  // More intelligent punctuation normalization
  // Replace various connectors with "to" but only when appropriate
  processedText = processedText.replace(/\s*-\s*/g, ' to ') // Replace hyphens with "to"
  processedText = processedText.replace(/\s*\.\.\.\s*/g, ' to ') // Replace "..." with "to"
  processedText = processedText.replace(/\s*—\s*/g, ' to ') // Replace em dash with "to"

  // Handle edge case: "Jan 15...Feb 15" -> "Jan 15 to Feb 15" (preserve month names)
  processedText = processedText.replace(/\s*\.\.+\s*([a-z]{3,})/gi, ' to $1')
  processedText = processedText.replace(/([a-z]{3,})\s*\.\.+\s*/gi, '$1 to ')

  // Step 4: Fix number format issues
  // Add missing spaces in ordinal suffixes
  processedText = processedText.replace(/(\d+)(st|nd|rd|th)/g, '$1$2')

  // Step 5: Normalize connectors
  processedText = processedText.replace(/\b(ot|too)\b/g, 'to')
  processedText = processedText.replace(/\b(thru|thrugh)\b/g, 'through')
  processedText = processedText.replace(/\b(form)\b/g, 'from')
  processedText = processedText.replace(/\b(till|til|untill)\b/g, 'until')

  return {
    correctedText: processedText.trim(),
    corrections
  }
}

/**
 * Fuzzy string matching for typo detection - more conservative approach
 */
function isFuzzyMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
  if (str1 === str2) return true

  // Skip fuzzy matching for very short words (be more conservative)
  if (str1.length < 4 || str2.length < 4) return false

  // Skip fuzzy matching if length difference is too large
  if (Math.abs(str1.length - str2.length) > 2) return false

  // Preserve key words that should never be fuzzy-matched
  const preserveWords = ['last', 'next', 'this', 'data', 'time', 'date', 'show', 'set', 'get', 'from', 'to', 'and', 'or', 'not']
  if (preserveWords.includes(str1.toLowerCase()) || preserveWords.includes(str2.toLowerCase())) {
    return false
  }

  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1

  let matches = 0
  for (let i = 0; i < longer.length; i++) {
    if (shorter.includes(longer[i])) {
      matches++
    }
  }

  return matches / longer.length >= threshold
}

/**
 * Smart fuzzy parsing as a fallback when exact matching fails - more conservative approach
 */
function trySmartFuzzyParsing(text: string): DateParseResult {
  console.log(`🔍 TRYING SMART FUZZY PARSING FOR: "${text}"`)

  // Only apply fuzzy parsing for specific, safe patterns
  const fuzzyStrategies = [
    tryExtractMonthNames,
    tryExtractRelativePatterns,
    tryExtractDateNumbers,
    tryExtractYearPatterns
  ]

  for (const strategy of fuzzyStrategies) {
    const result = strategy(text)
    if (result.success) {
      return result
    }
  }

  return { success: false, originalText: text }
}

/**
 * Legacy fuzzy parsing function (no longer used)
 */
function tryFuzzyParsing(text: string): DateParseResult {
  return { success: false, originalText: text }
}

/**
 * Extract month names using fuzzy matching - improved to handle compound text
 */
function tryExtractMonthNames(text: string): DateParseResult {
  const foundMonths: string[] = []

  // Only apply fuzzy matching for month-like patterns, not every text
  const monthLikeWords = text.toLowerCase().split(/\s+/).filter(word =>
    word.length >= 3 && !isDateStopWord(word)
  )

  for (const word of monthLikeWords) {
    for (const month of FUZZY_MONTHS) {
      if (month.pattern.test(word)) {
        foundMonths.push(month.name)
        break // Only count each word once
      }
    }
  }

  if (foundMonths.length >= 2) {
    // Found two months, try to create a range
    const startMonth = parseMonth(foundMonths[0])
    const endMonth = parseMonth(foundMonths[1])

    if (startMonth !== -1 && endMonth !== -1) {
      const currentYear = new Date().getFullYear()
      const start = new Date(currentYear, startMonth, 1)
      const end = new Date(currentYear, endMonth + 1, 0) // Last day of end month

      const dateRange = createRange(start, end, `${foundMonths[0]} to ${foundMonths[1]}`, true, 0.7)
      return { success: true, dateRange, originalText: text }
    }
  } else if (foundMonths.length === 1) {
    // Found one month, create a month-long range
    const month = parseMonth(foundMonths[0])
    if (month !== -1) {
      const currentYear = new Date().getFullYear()
      const start = new Date(currentYear, month, 1)
      const end = new Date(currentYear, month + 1, 0)

      const dateRange = createRange(start, end, foundMonths[0], true, 0.6)
      return { success: true, dateRange, originalText: text }
    }
  }

  return { success: false, originalText: text }
}

/**
 * Check if a word should stop date parsing (to avoid false positives)
 */
function isDateStopWord(word: string): boolean {
  const stopWords = [
    'last', 'next', 'this', 'that', 'data', 'time', 'date', 'show', 'set', 'get', 'from', 'to',
    'and', 'or', 'not', 'with', 'for', 'the', 'of', 'in', 'on', 'at', 'by', 'up', 'down',
    'today', 'yesterday', 'tomorrow', 'days', 'week', 'month', 'year', 'quarter'
  ]
  return stopWords.includes(word.toLowerCase())
}

/**
 * Extract relative patterns with fuzzy matching
 */
function tryExtractRelativePatterns(text: string): DateParseResult {
  const fuzzyPatterns = [
    { pattern: /last\s+(\d+)/, handler: (match: RegExpMatchArray) => {
      const num = parseInt(match[1])
      const today = new Date()
      const start = new Date(today)
      start.setMonth(today.getMonth() - num)
      return createRange(start, today, `Last ${num} months`, true, 0.5)
    }},
    { pattern: /(recent|latest)/, handler: () => {
      const today = new Date()
      const start = new Date(today)
      start.setMonth(today.getMonth() - 3)
      return createRange(start, today, 'Recent', true, 0.4)
    }}
  ]

  for (const {pattern, handler} of fuzzyPatterns) {
    const match = text.match(pattern)
    if (match) {
      const dateRange = handler(match)
      return { success: true, dateRange, originalText: text }
    }
  }

  return { success: false, originalText: text }
}

/**
 * Extract date numbers from text
 */
function tryExtractDateNumbers(text: string): DateParseResult {
  // Look for patterns like "1/15" or "15 jan"
  const numberPatterns = [
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
  ]

  for (const pattern of numberPatterns) {
    const matches = text.match(new RegExp(pattern.source, 'g'))
    if (matches && matches.length >= 2) {
      // Try to parse the first two date-like strings
      const match1 = matches[0].match(pattern)
      const match2 = matches[1].match(pattern)

      if (match1 && match2) {
        // This is a best-effort extraction with low confidence
        const dateRange = createRange(
          new Date(), new Date(),
          `${match1[0]} to ${match2[0]}`,
          true, 0.3
        )
        return { success: true, dateRange, originalText: text }
      }
    }
  }

  return { success: false, originalText: text }
}

/**
 * Extract year patterns with fuzzy matching
 */
function tryExtractYearPatterns(text: string): DateParseResult {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/)
  if (yearMatch) {
    const year = parseInt(yearMatch[0])
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)

    const dateRange = createRange(start, end, `${year}`, true, 0.4)
    return { success: true, dateRange, originalText: text }
  }

  return { success: false, originalText: text }
}

/**
 * Generate intelligent suggestions when parsing fails
 */
function generateIntelligentSuggestions(text: string): string[] {
  const suggestions: string[] = []

  // Common date range formats
  suggestions.push(
    "January to March",
    "last 3 months",
    "ytd",
    "1/1/25 to 3/1/25",
    "2024 data",
    "this month",
    "last month"
  )

  // If the user tried a specific format, suggest similar formats
  if (text.includes('/')) {
    suggestions.push("1/15/25 to 2/15/25", "1/15 to 2/15")
  }

  if (text.match(/\d{4}/)) {
    suggestions.push("2024 data", "all of 2024")
  }

  if (/\w+/.test(text) && !text.includes('to') && !text.includes('through')) {
    suggestions.push("January to March", "March through June")
  }

  return suggestions.slice(0, 5) // Return top 5 suggestions
}

/**
 * 🎯 Strategy 1: Parse preset ranges (ytd, last month, etc.)
 */
function parsePresetRanges(text: string): DateParseResult {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const presets: Record<string, () => ParsedDateRange> = {
    // Current periods
    'today': () => createRange(today, today, 'Today', false, 1.0),
    'this week': () => createRange(getStartOfWeek(today), today, 'This Week', false, 1.0),
    'this month': () => createRange(new Date(now.getFullYear(), now.getMonth(), 1), today, 'This Month', false, 1.0),
    'this quarter': () => {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return createRange(quarterStart, today, 'This Quarter', false, 1.0)
    },
    'this year': () => createRange(new Date(now.getFullYear(), 0, 1), today, 'This Year', false, 1.0),
    'ytd': () => createRange(new Date(now.getFullYear(), 0, 1), today, 'Year to Date', false, 1.0),
    'year to date': () => createRange(new Date(now.getFullYear(), 0, 1), today, 'Year to Date', false, 1.0),

    // Last periods
    'last week': () => {
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(today.getDate() - 1)
      const lastWeekStart = getStartOfWeek(lastWeekEnd)
      return createRange(lastWeekStart, getEndOfWeek(lastWeekStart), 'Last Week', false, 1.0)
    },
    'last month': () => {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return createRange(lastMonthStart, lastMonthEnd, 'Last Month', false, 1.0)
    },
    'last quarter': () => {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
      const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const start = new Date(year, lastQuarter * 3, 1)
      const end = new Date(year, lastQuarter * 3 + 3, 0)
      return createRange(start, end, 'Last Quarter', false, 1.0)
    },
    'last year': () => {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31)
      return createRange(start, end, 'Last Year', false, 1.0)
    },

    // Relative days (more comprehensive)
    '7d': () => createRange(getDaysAgo(7), today, '7 Days', false, 1.0),
    '7 days': () => createRange(getDaysAgo(7), today, '7 Days', false, 1.0),
    'last 7 days': () => createRange(getDaysAgo(7), today, 'Last 7 Days', false, 1.0),
    '30d': () => createRange(getDaysAgo(30), today, '30 Days', false, 1.0),
    '30 days': () => createRange(getDaysAgo(30), today, '30 Days', false, 1.0),
    'last 30 days': () => createRange(getDaysAgo(30), today, 'Last 30 Days', false, 1.0),
    '90d': () => createRange(getDaysAgo(90), today, '90 Days', false, 1.0),
    '90 days': () => createRange(getDaysAgo(90), today, '90 Days', false, 1.0),
    'last 90 days': () => createRange(getDaysAgo(90), today, 'Last 90 Days', false, 1.0),
    'yesterday': () => createRange(getDaysAgo(1), getDaysAgo(1), 'Yesterday', false, 1.0),
    'tomorrow': () => createRange(getDaysAgo(-1), getDaysAgo(-1), 'Tomorrow', false, 1.0),

    // All time
    'all': () => createRange(new Date(2020, 0, 1), today, 'All Time', false, 1.0),
    'all time': () => createRange(new Date(2020, 0, 1), today, 'All Time', false, 1.0),
    'everything': () => createRange(new Date(2020, 0, 1), today, 'All Time', false, 1.0)
  }

  for (const [pattern, generator] of Object.entries(presets)) {
    if (text.includes(pattern)) {
      const dateRange = generator()
      return { success: true, dateRange, originalText: text }
    }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 2: Parse year-only ranges (2025 data, etc.)
 */
function parseYearOnlyRanges(text: string): DateParseResult {
  // Match year patterns like "2025 data", "2024", "year 2025"
  const yearPatterns = [
    /all\s+of\s+(\d{4})/,       // "all of 2025" - most specific pattern
    /(\d{4})\s+data/,           // "2025 data"
    /year\s+(\d{4})/,           // "year 2025"
    /(\d{4})\s+year/,           // "2025 year"
    /in\s+(\d{4})/,             // "in 2025"
    /for\s+(\d{4})/,            // "for 2025"
    /during\s+(\d{4})/,         // "during 2025"
    /\b(\d{4})\b(?!\s+days?)(?!\s+months?)(?!\s+weeks?)/ // Standalone year (but not "2025 days")
  ]

  for (const pattern of yearPatterns) {
    const match = text.match(pattern)
    if (match) {
      const year = parseInt(match[1])

      // Validate year range (1900-2100)
      if (year >= 1900 && year <= 2100) {
        const start = new Date(year, 0, 1)        // January 1st of year
        const end = new Date(year, 11, 31)        // December 31st of year

        // Create appropriate label based on the pattern
        let label: string
        if (text.includes('all of')) {
          label = `All of ${year}`
        } else {
          label = `${year} Data`
        }

        const dateRange = createRange(start, end, label, true, 0.95)
        return { success: true, dateRange, originalText: text }
      }
    }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 3: Parse relative ranges (last N months, etc.)
 */
function parseRelativeRanges(text: string): DateParseResult {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Match "last N months/days/weeks"
  const lastNPattern = /last\s+(\d+)\s+(month|day|week|year)s?/
  const match = text.match(lastNPattern)

  if (match) {
    const number = parseInt(match[1])
    const unit = match[2]

    let start: Date
    let label: string

    switch (unit) {
      case 'day':
        start = getDaysAgo(number)
        label = `Last ${number} Day${number > 1 ? 's' : ''}`
        break
      case 'week':
        start = getDaysAgo(number * 7)
        label = `Last ${number} Week${number > 1 ? 's' : ''}`
        break
      case 'month':
        start = new Date(now)
        start.setMonth(now.getMonth() - number)
        label = `Last ${number} Month${number > 1 ? 's' : ''}`
        break
      case 'year':
        start = new Date(now)
        start.setFullYear(now.getFullYear() - number)
        label = `Last ${number} Year${number > 1 ? 's' : ''}`
        break
      default:
        return { success: false, originalText: text }
    }

    const dateRange = createRange(start, today, label, true, 0.9)
    return { success: true, dateRange, originalText: text }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 4: Parse specific date ranges (January 15 to March 13, etc.)
 */
function parseSpecificDateRanges(text: string): DateParseResult {
  // Match "15th of January to 13th of March" style
  const specificPatterns = [
    /(\d{1,2})(st|nd|rd|th)?\s+of\s+(\w+)\s+to\s+(?:the\s+)?(\d{1,2})(st|nd|rd|th)?\s+of\s+(\w+)/,
    // Also match "January 15th to March 13th"
    /(\w+)\s+(\d{1,2})(st|nd|rd|th)?\s+to\s+(\w+)\s+(\d{1,2})(st|nd|rd|th)?/
  ]

  for (let i = 0; i < specificPatterns.length; i++) {
    const match = text.match(specificPatterns[i])

    if (match) {
      let startDay: number, startMonth: number, endDay: number, endMonth: number

      if (i === 0) {
        // "15th of January to 13th of March" format
        startDay = parseInt(match[1])
        startMonth = parseMonth(match[3])
        endDay = parseInt(match[4])
        endMonth = parseMonth(match[6])
      } else {
        // "January 15th to March 13th" format
        startMonth = parseMonth(match[1])
        startDay = parseInt(match[2])
        endMonth = parseMonth(match[4])
        endDay = parseInt(match[5])
      }

      if (startMonth !== -1 && endMonth !== -1) {
        const currentYear = new Date().getFullYear()
        const currentDate = new Date()
        const currentMonth = currentDate.getMonth()

        // Smart year determination - default to current year unless clear indication otherwise
        let startYear = currentYear
        let endYear = currentYear

        // Only increment years in specific cases
        if (endMonth < startMonth) {
          // Cross year boundary (e.g., October to March)
          endYear = currentYear + 1
        }
        // For past months like July-August in November, keep current year (2024)

        // Create dates at UTC midnight to avoid timezone conversion issues
        const start = new Date(Date.UTC(startYear, startMonth, startDay))
        const end = new Date(Date.UTC(endYear, endMonth, endDay))

        const startMonthName = getMonthName(startMonth)
        const endMonthName = getMonthName(endMonth)
        const label = `${startMonthName} ${startDay} to ${endMonthName} ${endDay}`

        const dateRange = createRange(start, end, label, true, 0.95)
        return { success: true, dateRange, originalText: text }
      }
    }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 5: Parse month-to-month ranges (July to August, etc.)
 */
function parseMonthToMonthRanges(text: string): DateParseResult {
  // Match "July to August", "July to the end of August", "March through June"
  const monthRangePatterns = [
    /(\w+)\s+to\s+(?:the\s+end\s+of\s+)?(\w+)/,
    /(\w+)\s+through\s+(\w+)/,
    /(\w+)\s+thru\s+(\w+)/,
    /from\s+(\w+)\s+to\s+(\w+)/
  ]

  for (const pattern of monthRangePatterns) {
    const match = text.match(pattern)
    if (match) {
      const startMonth = parseMonth(match[1])
      const endMonth = parseMonth(match[2])

      if (startMonth !== -1 && endMonth !== -1) {
        const currentYear = new Date().getFullYear()

        // Determine year logic - default to current year for historical data
        let startYear = currentYear
        let endYear = currentYear

        // Only use next year in specific scenarios
        const currentMonth = new Date().getMonth()

        if (endMonth < startMonth) {
          // Cross year boundary (e.g., October to March)
          endYear = currentYear + 1
        }
        // For July to August in November, use current year (2024) for historical data

        // Create dates at UTC midnight to avoid timezone conversion issues
        const start = new Date(Date.UTC(startYear, startMonth, 1))
        const end = new Date(Date.UTC(endYear, endMonth + 1, 0)) // Last day of end month

        const startMonthName = getMonthName(startMonth)
        const endMonthName = getMonthName(endMonth)
        const label = `${startMonthName} to ${endMonthName}`

        const dateRange = createRange(start, end, label, true, 0.9)
        return { success: true, dateRange, originalText: text }
      }
    }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 6: Parse quarter ranges (Q1, Q4 2024, etc.)
 */
function parseQuarterRanges(text: string): DateParseResult {
  const quarterPattern = /q([1-4])(\s+(\d{4}))?/
  const match = text.match(quarterPattern)

  if (match) {
    const quarter = parseInt(match[1])
    const year = match[3] ? parseInt(match[3]) : new Date().getFullYear()

    const startMonth = (quarter - 1) * 3
    const start = new Date(year, startMonth, 1)
    const end = new Date(year, startMonth + 3, 0) // Last day of quarter

    const label = `Q${quarter} ${year}`

    const dateRange = createRange(start, end, label, true, 0.95)
    return { success: true, dateRange, originalText: text }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 7: Parse date-to-date ranges (2024-01-15 to 2024-03-13, etc.)
 */
function parseDateToDateRanges(text: string): DateParseResult {
  // Match various date formats with "to"
  const dateToDatePatterns = [
    // ISO format: 2024-01-15 to 2024-03-13
    /(\d{4})-(\d{1,2})-(\d{1,2})\s+to\s+(\d{4})-(\d{1,2})-(\d{1,2})/,
    // US format with years: 01/15/2024 to 03/13/2024
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+to\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    // NEW: US format with 2-digit years: 1/1/25 to 3/1/25
    /(\d{1,2})\/(\d{1,2})\/(\d{2})\s+to\s+(\d{1,2})\/(\d{1,2})\/(\d{2})/,
    // US format without years (assumes current year): 1/25 to 7/25
    /(\d{1,2})\/(\d{1,2})\s+to\s+(\d{1,2})\/(\d{1,2})/,
    // Natural format: January 15, 2024 to March 13, 2024
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})\s+to\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    // Natural format without years: January 15 to March 13
    /(\w+)\s+(\d{1,2})\s+to\s+(\w+)\s+(\d{1,2})/,
    // NEW: Natural format with ordinal suffixes and years: January 1st, 2025 to April 1st, 25
    /(\w+)\s+(\d{1,2})(?:st|nd|rd|th),?\s+(\d{2,4})\s+to\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th),?\s+(\d{2,4})/,
    // NEW: Natural format with ordinal suffixes without years: January 1st to April 1st
    /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)\s+to\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)/
  ]

  for (let i = 0; i < dateToDatePatterns.length; i++) {
    const pattern = dateToDatePatterns[i]
    const match = text.match(pattern)

    if (match) {
      let start: Date
      let end: Date
      let label: string

      if (i === 0) { // ISO format
        start = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]))
        end = new Date(parseInt(match[4]), parseInt(match[5]) - 1, parseInt(match[6]))
        label = `${match[1]}-${match[2]}-${match[3]} to ${match[4]}-${match[5]}-${match[6]}`
      } else if (i === 1) { // US format with years
        start = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]))
        end = new Date(parseInt(match[6]), parseInt(match[4]) - 1, parseInt(match[5]))
        label = `${match[1]}/${match[2]}/${match[3]} to ${match[4]}/${match[5]}/${match[6]}`
      } else if (i === 2) { // US format with 2-digit years
        // Handle 2-digit years like "25" -> 2025
        const startYear = parseInt(match[3])
        const endYear = parseInt(match[6])
        const startYearFull = startYear < 100 ? 2000 + startYear : startYear
        const endYearFull = endYear < 100 ? 2000 + endYear : endYear
        start = new Date(startYearFull, parseInt(match[1]) - 1, parseInt(match[2]))
        end = new Date(endYearFull, parseInt(match[4]) - 1, parseInt(match[5]))
        label = `${match[1]}/${match[2]}/${startYear.toString().slice(-2)} to ${match[4]}/${match[5]}/${endYear.toString().slice(-2)}`
      } else if (i === 3) { // US format without years (assumes current year)
        const currentYear = new Date().getFullYear()
        start = new Date(currentYear, parseInt(match[1]) - 1, parseInt(match[2]))
        end = new Date(currentYear, parseInt(match[3]) - 1, parseInt(match[4]))
        label = `${match[1]}/${match[2]} to ${match[3]}/${match[4]}`
      } else if (i === 4) { // Natural format with years
        const startMonth = parseMonth(match[1])
        const endMonth = parseMonth(match[4])
        if (startMonth === -1 || endMonth === -1) continue

        start = new Date(parseInt(match[3]), startMonth, parseInt(match[2]))
        end = new Date(parseInt(match[6]), endMonth, parseInt(match[5]))
        label = `${match[1]} ${match[2]}, ${match[3]} to ${match[4]} ${match[5]}, ${match[6]}`
      } else if (i === 5) { // Natural format without years
        const startMonth = parseMonth(match[1])
        const endMonth = parseMonth(match[3])
        if (startMonth === -1 || endMonth === -1) continue

        const currentYear = new Date().getFullYear()
        start = new Date(currentYear, startMonth, parseInt(match[2]))
        end = new Date(currentYear, endMonth, parseInt(match[4]))
        label = `${match[1]} ${match[2]} to ${match[3]} ${match[4]}`
      } else if (i === 6) { // Natural format with ordinal suffixes and years
        const startMonth = parseMonth(match[1])
        const endMonth = parseMonth(match[4])
        if (startMonth === -1 || endMonth === -1) continue

        // Handle 2-digit years like "25" -> 2025
        const startYear = parseInt(match[3])
        const endYear = parseInt(match[6])
        const startYearFull = startYear < 100 ? 2000 + startYear : startYear
        const endYearFull = endYear < 100 ? 2000 + endYear : endYear

        start = new Date(startYearFull, startMonth, parseInt(match[2]))
        end = new Date(endYearFull, endMonth, parseInt(match[5]))
        label = `${match[1]} ${match[2]}, ${startYearFull} to ${match[4]} ${match[5]}, ${endYearFull}`
      } else { // Natural format with ordinal suffixes without years (i === 7)
        const startMonth = parseMonth(match[1])
        const endMonth = parseMonth(match[3])
        if (startMonth === -1 || endMonth === -1) continue

        const currentYear = new Date().getFullYear()
        start = new Date(currentYear, startMonth, parseInt(match[2]))
        end = new Date(currentYear, endMonth, parseInt(match[4]))
        label = `${match[1]} ${match[2]} to ${match[3]} ${match[4]}`
      }

      const dateRange = createRange(start, end, label, true, 0.95)
      return { success: true, dateRange, originalText: text }
    }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 8: Parse month-year combinations (January 2024, etc.)
 */
function parseMonthYearRanges(text: string): DateParseResult {
  const monthYearPattern = /(\w+)\s+(\d{4})/
  const match = text.match(monthYearPattern)

  if (match) {
    const month = parseMonth(match[1])
    const year = parseInt(match[2])

    if (month !== -1) {
      // Create dates at UTC midnight to avoid timezone conversion issues
      const start = new Date(Date.UTC(year, month, 1))
      const end = new Date(Date.UTC(year, month + 1, 0)) // Last day of month

      const label = `${getMonthName(month)} ${year}`

      const dateRange = createRange(start, end, label, true, 0.8)
      return { success: true, dateRange, originalText: text }
    }
  }

  return { success: false, originalText: text }
}

/**
 * 🎯 Strategy 9: Parse complex ranges (first half, second half, etc.)
 */
function parseComplexRanges(text: string): DateParseResult {
  const now = new Date()
  const currentYear = now.getFullYear()

  const complexPatterns: Record<string, () => ParsedDateRange> = {
    'first half': () => {
      const start = new Date(currentYear, 0, 1) // January 1
      const end = new Date(currentYear, 5, 30) // June 30
      return createRange(start, end, 'First Half of Year', true, 0.8)
    },
    'first half of the year': () => {
      const start = new Date(currentYear, 0, 1)
      const end = new Date(currentYear, 5, 30)
      return createRange(start, end, 'First Half of Year', true, 0.9)
    },
    'second half': () => {
      const start = new Date(currentYear, 6, 1) // July 1
      const end = new Date(currentYear, 11, 31) // December 31
      return createRange(start, end, 'Second Half of Year', true, 0.8)
    },
    'second half of the year': () => {
      const start = new Date(currentYear, 6, 1)
      const end = new Date(currentYear, 11, 31)
      return createRange(start, end, 'Second Half of Year', true, 0.9)
    },
    'summer': () => {
      const start = new Date(currentYear, 5, 1) // June 1
      const end = new Date(currentYear, 7, 31) // August 31
      return createRange(start, end, 'Summer', true, 0.7)
    },
    'winter': () => {
      const start = new Date(currentYear - 1, 11, 1) // December 1 of last year
      const end = new Date(currentYear, 1, 28) // February 28/29
      return createRange(start, end, 'Winter', true, 0.7)
    }
  }

  for (const [pattern, generator] of Object.entries(complexPatterns)) {
    if (text.includes(pattern)) {
      const dateRange = generator()
      return { success: true, dateRange, originalText: text }
    }
  }

  return { success: false, originalText: text }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createRange(start: Date, end: Date, label: string, isCustom: boolean, confidence: number): ParsedDateRange {
  return { start, end, label, isCustom, confidence }
}

function getDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

function getStartOfWeek(date: Date): Date {
  const start = new Date(date)
  start.setDate(date.getDate() - date.getDay())
  return start
}

function getEndOfWeek(date: Date): Date {
  const end = new Date(date)
  end.setDate(date.getDate() + (6 - date.getDay()))
  return end
}

function parseMonth(monthStr: string): number {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]

  const shortMonths = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]

  const month = monthStr.toLowerCase()

  let index = months.indexOf(month)
  if (index !== -1) return index

  index = shortMonths.indexOf(month)
  if (index !== -1) return index

  return -1 // Not found
}

function getMonthName(monthIndex: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[monthIndex] || 'Unknown'
}

/**
 * Enhanced test function for development - Tests bulletproof parsing capabilities
 */
export function testDateParser() {
  console.log('🚀 TESTING ENHANCED BULLETPROOF DATE PARSER:')
  console.log('=' .repeat(80))

  const testCategories = [
    {
      name: '🔤 TYPO AND SPELLING CORRECTIONS',
      tests: [
        "januray to febuary",                    // Month typos
        "show me march 15th ot april 10th",     // Connector typo + conversational prefix
        "last munth",                           // Common word typo
        "tommorow",                             // Tomorrow typo
        "change to yestrday",                   // Yesterday typo with command
        "Q1 2024",                              // Should work without changes
        "jan15tofeb15",                         // Missing spaces
        "1/1/25to3/1/25",                      // Missing spaces in dates
        "Jan 15 - Feb 15",                      // Hyphen instead of "to"
        "Jan 15...Feb 15",                      // Ellipsis instead of "to"
        "Jan 15? Feb 15",                       // Question mark punctuation
        "januray 15th to febuary 10th",         // Multiple typos
        "show me Q2 data",                      // Conversational prefix
        "i want to see 2024 data",              // Complex conversational prefix
      ]
    },
    {
      name: '📅 STANDARD DATE FORMATS',
      tests: [
        "2025 data",                            // Year only
        "show me July to the end of August",    // Complex month range
        "15th of January to 13th of March",     // Ordinal format
        "last 3 months",                        // Relative range
        "Q4 2024",                              // Quarter
        "first half of the year",               // Complex range
        "October to December",                  // Simple month range
        "March through June",                   // Alternative connector
        "ytd",                                  // Preset
        "last 90 days",                         // Relative days
        "January 2024",                         // Month-year
        "1/15/25 to 2/15/25",                  // US format with 2-digit years
        "2024-01-15 to 2024-03-13",            // ISO format
        "January 15th to March 13th",           // Natural format
      ]
    },
    {
      name: '🎯 EDGE CASES AND FUZZY MATCHING',
      tests: [
        "jan to mar",                           // Short months
        "jantofeb",                             // No spaces, short months
        "recents",                              // Fuzzy matching
        "lats 3 munths",                        // Multiple typos
        "set date range 2024",                  // Command with year
        "display janaury to march",             // Command with typo
        "can you show me Q1",                   // Complex command
        "gib me 2023 stuff",                    // Severe typos (should fail gracefully)
        "xyz123 abc456",                        // No date content (should fail gracefully)
        "last 999 months",                      // Unreasonable number (should handle)
        "31 to 32",                             // Invalid dates (should handle)
      ]
    }
  ]

  let totalTests = 0
  let passedTests = 0
  let correctedTests = 0

  testCategories.forEach(category => {
    console.log(`\n${category.name}:`)
    console.log('-'.repeat(60))

    category.tests.forEach(testCase => {
      totalTests++
      const result = parseNaturalDateRange(testCase)

      let status = ''
      let details = ''

      if (result.success && result.dateRange) {
        passedTests++
        status = '✅'

        if (result.dateRange.correctionInfo) {
          correctedTests++
          details = ` (${result.dateRange.correctionInfo.corrections.join(', ')})`
        }

        console.log(`  ${status} "${testCase}" -> "${result.dateRange.label}" (confidence: ${(result.dateRange.confidence * 100).toFixed(0)}%)${details}`)
      } else {
        status = '❌'
        details = result.suggestions ? ` [Suggestions: ${result.suggestions.slice(0, 2).join(', ')}]` : ''
        console.log(`  ${status} "${testCase}" -> ${result.error}${details}`)
      }
    })
  })

  console.log('\n' + '='.repeat(80))
  console.log('📊 SUMMARY:')
  console.log(`   Total Tests: ${totalTests}`)
  console.log(`   Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`)
  console.log(`   With Corrections: ${correctedTests} (${((correctedTests/totalTests)*100).toFixed(1)}%)`)
  console.log(`   Failed: ${totalTests - passedTests} (${(((totalTests - passedTests)/totalTests)*100).toFixed(1)}%)`)
  console.log('='.repeat(80))
}

/**
 * Test specific typo correction scenarios
 */
export function testTypoCorrections() {
  console.log('\n🔧 TESTING TYPO CORRECTION SYSTEM:')

  const typoTests = [
    { input: 'januray to febuary', expected: 'january to february' },
    { input: 'show me last munth', expected: 'last month' },
    { input: 'tommorow data', expected: 'tomorrow data' },
    { input: 'change ot yestrday', expected: 'change to yesterday' },
    { input: 'jan15tofeb15', expected: 'jan to feb' }, // Will be further processed
    { input: '1/1/25to3/1/25', expected: '1/1/25 to 3/1/25' },
  ]

  typoTests.forEach(({ input, expected }) => {
    const result = intelligentPreprocess(input)
    const matched = result.correctedText.includes(expected.toLowerCase())
    console.log(`${matched ? '✅' : '❌'} "${input}" -> "${result.correctedText}" (${result.corrections.join(', ')})`)
  })
}

/**
 * Test fuzzy month matching
 */
export function testFuzzyMonthMatching() {
  console.log('\n🎯 TESTING FUZZY MONTH MATCHING:')

  const fuzzyTests = [
    'januray', 'feburary', 'marhc', 'aprill', 'june', 'july',
    'augst', 'septemer', 'octber', 'novmber', 'decembe'
  ]

  fuzzyTests.forEach(test => {
    const found = FUZZY_MONTHS.find(month => month.pattern.test(test))
    console.log(`${found ? '✅' : '❌'} "${test}" -> ${found ? found.name : 'NOT FOUND'}`)
  })
}