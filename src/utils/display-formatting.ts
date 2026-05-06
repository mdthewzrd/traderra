import { DisplayMode } from '@/contexts/DisplayModeContext'

// Configuration for different display formats
export interface DisplayFormatConfig {
  // Account size for percentage calculations (default: $10,000)
  accountSize?: number
  // Risk per trade for R-multiple calculations (default: $200)
  riskPerTrade?: number
  // Precision settings
  currencyPrecision?: number
  percentagePrecision?: number
  rMultiplePrecision?: number
}

const DEFAULT_CONFIG: Required<DisplayFormatConfig> = {
  accountSize: 10000,
  riskPerTrade: 200,
  currencyPrecision: 2,
  percentagePrecision: 2,
  rMultiplePrecision: 2,
}

// Value type definitions for type safety
export type ValueType = 'currency' | 'percentage' | 'ratio' | 'expectancy' | 'count'

/**
 * Format a numeric value according to the specified display mode
 */
export function formatDisplayValue(
  value: number | null | undefined,
  displayMode: DisplayMode,
  valueType: ValueType = 'currency',
  config: DisplayFormatConfig = {},
  rMultiple?: number | null
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Handle null/undefined
  if (value == null) {
    return formatZeroValue(displayMode, valueType)
  }

  // Handle special cases
  if (value === 0) {
    return formatZeroValue(displayMode, valueType)
  }

  if (!isFinite(value)) {
    return formatInfiniteValue(value, displayMode, valueType)
  }

  switch (displayMode) {
    case 'dollar':
      return formatDollarMode(value, valueType, cfg)

    case 'r':
      return formatRMode(value, valueType, cfg, rMultiple)

    default:
      return formatDollarMode(value, valueType, cfg)
  }
}

/**
 * Format value in dollar mode
 */
function formatDollarMode(value: number, valueType: ValueType, config: Required<DisplayFormatConfig>): string {
  switch (valueType) {
    case 'currency':
      return formatCurrency(value, config.currencyPrecision)

    case 'percentage':
      return formatPercentage(value, config.percentagePrecision)

    case 'ratio':
      return formatRatio(value, 2)

    case 'expectancy':
      return formatCurrency(value, config.currencyPrecision)

    case 'count':
      return Math.round(value).toString()

    default:
      return formatCurrency(value, config.currencyPrecision)
  }
}


/**
 * Format value in R-multiple mode
 */
function formatRMode(
  value: number,
  valueType: ValueType,
  config: Required<DisplayFormatConfig>,
  rMultiple?: number
): string {
  switch (valueType) {
    case 'currency':
      // Use provided R-multiple if available, otherwise calculate from risk amount
      if (rMultiple !== undefined) {
        return formatRMultiple(rMultiple, config.rMultiplePrecision)
      }
      // Fallback: convert dollar amount to R-multiple using default risk
      const rValue = value / config.riskPerTrade
      return formatRMultiple(rValue, config.rMultiplePrecision)

    case 'percentage':
      return formatPercentage(value, config.percentagePrecision)

    case 'ratio':
      return formatRatio(value, 2)

    case 'expectancy':
      // Use provided R-multiple or calculate from risk
      const expectancyR = rMultiple !== undefined ? rMultiple : value / config.riskPerTrade
      return formatRMultiple(expectancyR, config.rMultiplePrecision, true)

    case 'count':
      return Math.round(value).toString()

    default:
      // Use provided R-multiple if available, otherwise calculate from risk amount
      if (rMultiple !== undefined) {
        return formatRMultiple(rMultiple, config.rMultiplePrecision)
      }
      const defaultR = value / config.riskPerTrade
      return formatRMultiple(defaultR, config.rMultiplePrecision)
  }
}

/**
 * Format currency values
 */
function formatCurrency(value: number | null | undefined, precision: number = 2): string {
  if (value == null || !isFinite(value)) return '$0.00'
  const isNegative = value < 0
  const absValue = Math.abs(value)

  const formatted = absValue.toLocaleString('en-US', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })

  return `${isNegative ? '-' : ''}$${formatted}`
}

/**
 * Format percentage values
 */
function formatPercentage(value: number | null | undefined, precision: number = 2, showSign: boolean = false): string {
  if (value == null || !isFinite(value)) return '0.00%'
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(precision)}%`
}

/**
 * Format R-multiple values
 */
function formatRMultiple(value: number | null | undefined, precision: number = 2, showSign: boolean = false): string {
  if (value == null || !isFinite(value)) return '0.00R'
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(precision)}R`
}

/**
 * Format ratio values
 */
function formatRatio(value: number | null | undefined, precision: number = 2): string {
  if (value == null || !isFinite(value)) return '0.00'
  if (value === Infinity) return '∞'
  if (value === -Infinity) return '-∞'
  return value.toFixed(precision)
}

/**
 * Handle zero values
 */
function formatZeroValue(displayMode: DisplayMode, valueType: ValueType): string {
  switch (displayMode) {
    case 'dollar':
      return valueType === 'percentage' ? '0.00%' : '$0.00'
    case 'r':
      return valueType === 'percentage' ? '0.00%' : '0.00R'
    default:
      return '$0.00'
  }
}

/**
 * Handle infinite values
 */
function formatInfiniteValue(value: number, displayMode: DisplayMode, valueType: ValueType): string {
  const isPositive = value > 0

  if (valueType === 'ratio') {
    return isPositive ? '∞' : '-∞'
  }

  // For other types, show a more descriptive label
  return isPositive ? 'Unlimited' : 'N/A'
}

/**
 * Get appropriate color class for a value
 */
export function getValueColorClass(
  value: number,
  isPositiveGood: boolean = true,
  neutralThreshold: number = 0
): string {
  if (Math.abs(value) <= Math.abs(neutralThreshold)) {
    return 'text-gray-400'
  }

  const isPositive = value > neutralThreshold

  if (isPositiveGood) {
    return isPositive ? 'text-green-400' : 'text-red-400'
  } else {
    return isPositive ? 'text-red-400' : 'text-green-400'
  }
}

/**
 * Get formatted value with appropriate color class
 */
export function formatValueWithColor(
  value: number,
  displayMode: DisplayMode,
  valueType: ValueType = 'currency',
  isPositiveGood: boolean = true,
  config: DisplayFormatConfig = {},
  rMultiple?: number
): { formatted: string; colorClass: string } {
  const formatted = formatDisplayValue(value, displayMode, valueType, config, rMultiple)
  const colorClass = getValueColorClass(value, isPositiveGood)

  return { formatted, colorClass }
}

/**
 * Parse a formatted display value back to number (for form inputs)
 */
export function parseDisplayValue(
  formattedValue: string,
  displayMode: DisplayMode,
  valueType: ValueType = 'currency',
  config: DisplayFormatConfig = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // Remove formatting characters
  let cleaned = formattedValue
    .replace(/[$%R,]/g, '')
    .replace(/[+\-\s]/g, (match) => match === '+' || match === '-' ? match : '')
    .trim()

  const parsedValue = parseFloat(cleaned)

  if (isNaN(parsedValue)) {
    return 0
  }

  // Convert back to base currency if needed
  switch (displayMode) {
    case 'r':
      if (valueType === 'currency') {
        return parsedValue * cfg.riskPerTrade
      }
      return parsedValue

    default:
      return parsedValue
  }
}

/**
 * Pre-configured formatters for common use cases
 */
export const formatters = {
  pnl: (value: number, displayMode: DisplayMode, config?: DisplayFormatConfig, rMultiple?: number) =>
    formatDisplayValue(value, displayMode, 'currency', config, rMultiple),

  winRate: (value: number, displayMode: DisplayMode) =>
    formatDisplayValue(value, displayMode, 'percentage'),

  profitFactor: (value: number, displayMode: DisplayMode) =>
    formatDisplayValue(value, displayMode, 'ratio'),

  expectancy: (value: number, displayMode: DisplayMode, config?: DisplayFormatConfig, rMultiple?: number) =>
    formatDisplayValue(value, displayMode, 'expectancy', config, rMultiple),

  drawdown: (value: number, displayMode: DisplayMode, config?: DisplayFormatConfig, rMultiple?: number) =>
    formatDisplayValue(value, displayMode, 'currency', config, rMultiple),
}