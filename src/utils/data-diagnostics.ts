import { TraderraTrade, TraderVueTrade } from './csv-parser'
import { calculateTradeStatistics } from './trade-statistics'

export interface DiagnosticReport {
  summary: {
    totalTradesTraderVue: number
    totalTradesTraderra: number
    tradeCountMatch: boolean

    totalPnLTraderVue: number
    totalPnLTraderra: number
    pnlDiscrepancy: number
    pnlMatch: boolean

    totalCommissionsTraderVue: number
    totalCommissionsTraderra: number
    commissionDiscrepancy: number

    grossPnLTraderVue: number
    netPnLTraderVue: number
    grossVsNetDifference: number
  }

  detailedAnalysis: {
    missingTrades: TraderVueTrade[]
    invalidParsedTrades: Array<{
      original: TraderVueTrade
      converted: TraderraTrade
      issues: string[]
    }>
    commissionAnalysis: Array<{
      symbol: string
      traderVueCommission: number
      traderVueFees: number
      traderVueTotal: number
      traderraCommission: number
      difference: number
    }>
    pnlAnalysis: Array<{
      symbol: string
      date: string
      traderVueGross: number
      traderVueNet: number
      traderraCalculated: number
      difference: number
    }>
  }

  recommendations: string[]
}

export function createDataDiagnostic(
  traderVueTrades: TraderVueTrade[],
  traderraTrades: TraderraTrade[]
): DiagnosticReport {

  // Basic counts and totals
  const totalTradesTraderVue = traderVueTrades.length
  const totalTradesTraderra = traderraTrades.length

  // Enhanced calculation function matching CSV parser logic
  const safeParseFloat = (value: string): number => {
    if (!value || typeof value !== 'string') return 0

    const cleanValue = value.trim()
    if (cleanValue === '' || cleanValue === 'N/A' || cleanValue === 'n/a') return 0
    if (cleanValue === 'Inf' || cleanValue === 'inf' || cleanValue === 'Infinity') return 0
    if (cleanValue === '-Inf' || cleanValue === '-inf' || cleanValue === '-Infinity') return 0

    const numericValue = cleanValue.replace(/[$,%]/g, '')
    const parsed = parseFloat(numericValue)

    if (isNaN(parsed) || !isFinite(parsed)) return 0
    return Math.round(parsed * 10000) / 10000
  }

  // Calculate totals from TraderVue raw data using same logic as parser
  const totalPnLTraderVue = traderVueTrades.reduce((sum, trade) => {
    const netPnL = safeParseFloat(trade['Net P&L'])
    return sum + netPnL
  }, 0)

  const grossPnLTraderVue = traderVueTrades.reduce((sum, trade) => {
    const grossPnL = safeParseFloat(trade['Gross P&L'])
    return sum + grossPnL
  }, 0)

  const netPnLTraderVue = traderVueTrades.reduce((sum, trade) => {
    const netPnL = safeParseFloat(trade['Net P&L'])
    return sum + netPnL
  }, 0)

  const totalCommissionsTraderVue = traderVueTrades.reduce((sum, trade) => {
    const commission = safeParseFloat(trade['Commissions'])
    const fees = safeParseFloat(trade['Fees'])
    return sum + commission + fees
  }, 0)

  // Calculate totals from Traderra converted data
  const totalPnLTraderra = traderraTrades.reduce((sum, trade) => sum + trade.pnl, 0)
  const totalCommissionsTraderra = traderraTrades.reduce((sum, trade) => sum + trade.commission, 0)

  // Identify discrepancies
  const pnlDiscrepancy = totalPnLTraderVue - totalPnLTraderra
  const commissionDiscrepancy = totalCommissionsTraderVue - totalCommissionsTraderra

  // Find missing or problematic trades
  const missingTrades: TraderVueTrade[] = []
  const invalidParsedTrades: Array<{
    original: TraderVueTrade
    converted: TraderraTrade
    issues: string[]
  }> = []

  // Detailed analysis
  const commissionAnalysis = traderVueTrades.map((tvTrade, index) => {
    const traderraTradeAtIndex = traderraTrades[index]
    const traderVueCommission = parseFloat(tvTrade['Commissions']) || 0
    const traderVueFees = parseFloat(tvTrade['Fees']) || 0
    const traderVueTotal = traderVueCommission + traderVueFees

    return {
      symbol: tvTrade['Symbol'],
      traderVueCommission,
      traderVueFees,
      traderVueTotal,
      traderraCommission: traderraTradeAtIndex?.commission || 0,
      difference: traderVueTotal - (traderraTradeAtIndex?.commission || 0)
    }
  })

  const pnlAnalysis = traderVueTrades.map((tvTrade, index) => {
    const traderraTradeAtIndex = traderraTrades[index]
    const traderVueGross = parseFloat(tvTrade['Gross P&L']) || 0
    const traderVueNet = parseFloat(tvTrade['Net P&L']) || 0

    return {
      symbol: tvTrade['Symbol'],
      date: tvTrade['Open Datetime'],
      traderVueGross,
      traderVueNet,
      traderraCalculated: traderraTradeAtIndex?.pnl || 0,
      difference: traderVueNet - (traderraTradeAtIndex?.pnl || 0)
    }
  })

  // Validate each conversion
  traderVueTrades.forEach((tvTrade, index) => {
    const converted = traderraTrades[index]
    const issues: string[] = []

    if (!converted) {
      missingTrades.push(tvTrade)
      return
    }

    // Check for parsing issues
    const expectedNetPnL = parseFloat(tvTrade['Net P&L']) || 0
    if (Math.abs(converted.pnl - expectedNetPnL) > 0.01) {
      issues.push(`P&L mismatch: expected ${expectedNetPnL}, got ${converted.pnl}`)
    }

    const expectedVolume = parseInt(tvTrade['Volume']) || 0
    if (converted.quantity !== expectedVolume) {
      issues.push(`Quantity mismatch: expected ${expectedVolume}, got ${converted.quantity}`)
    }

    if (issues.length > 0) {
      invalidParsedTrades.push({
        original: tvTrade,
        converted,
        issues
      })
    }
  })

  // Generate recommendations
  const recommendations: string[] = []

  if (totalTradesTraderVue !== totalTradesTraderra) {
    recommendations.push(`Trade count mismatch: ${totalTradesTraderVue} in TraderVue vs ${totalTradesTraderra} in Traderra`)
  }

  if (Math.abs(pnlDiscrepancy) > 1.00) {
    recommendations.push(`Significant P&L discrepancy: $${pnlDiscrepancy.toFixed(2)}. Check if using Net P&L vs Gross P&L consistently.`)
  }

  if (Math.abs(commissionDiscrepancy) > 1.00) {
    recommendations.push(`Commission discrepancy: $${commissionDiscrepancy.toFixed(2)}. Verify commission + fees calculation.`)
  }

  if (missingTrades.length > 0) {
    recommendations.push(`${missingTrades.length} trades were not converted properly`)
  }

  if (invalidParsedTrades.length > 0) {
    recommendations.push(`${invalidParsedTrades.length} trades have parsing issues`)
  }

  const grossVsNetDifference = grossPnLTraderVue - netPnLTraderVue
  if (Math.abs(grossVsNetDifference - totalCommissionsTraderVue) > 1.00) {
    recommendations.push(`Gross vs Net P&L difference (${grossVsNetDifference.toFixed(2)}) doesn't match total commissions (${totalCommissionsTraderVue.toFixed(2)})`)
  }

  return {
    summary: {
      totalTradesTraderVue,
      totalTradesTraderra,
      tradeCountMatch: totalTradesTraderVue === totalTradesTraderra,

      totalPnLTraderVue,
      totalPnLTraderra,
      pnlDiscrepancy,
      pnlMatch: Math.abs(pnlDiscrepancy) < 1.00,

      totalCommissionsTraderVue,
      totalCommissionsTraderra,
      commissionDiscrepancy,

      grossPnLTraderVue,
      netPnLTraderVue,
      grossVsNetDifference
    },

    detailedAnalysis: {
      missingTrades,
      invalidParsedTrades,
      commissionAnalysis,
      pnlAnalysis
    },

    recommendations
  }
}

export function logDiagnosticReport(report: DiagnosticReport) {
  console.group('🔍 TRADE DATA DIAGNOSTIC REPORT')

  console.group('📊 Summary')
  console.log('Trade Counts:', {
    TraderVue: report.summary.totalTradesTraderVue,
    Traderra: report.summary.totalTradesTraderra,
    Match: report.summary.tradeCountMatch ? '✅' : '❌'
  })

  console.log('P&L Analysis:', {
    'TraderVue Net P&L': `$${report.summary.totalPnLTraderVue.toFixed(2)}`,
    'Traderra P&L': `$${report.summary.totalPnLTraderra.toFixed(2)}`,
    'Discrepancy': `$${report.summary.pnlDiscrepancy.toFixed(2)}`,
    'Match': report.summary.pnlMatch ? '✅' : '❌'
  })

  console.log('Commission Analysis:', {
    'TraderVue Total': `$${report.summary.totalCommissionsTraderVue.toFixed(2)}`,
    'Traderra Total': `$${report.summary.totalCommissionsTraderra.toFixed(2)}`,
    'Discrepancy': `$${report.summary.commissionDiscrepancy.toFixed(2)}`
  })

  console.log('Gross vs Net:', {
    'Gross P&L': `$${report.summary.grossPnLTraderVue.toFixed(2)}`,
    'Net P&L': `$${report.summary.netPnLTraderVue.toFixed(2)}`,
    'Difference': `$${report.summary.grossVsNetDifference.toFixed(2)}`
  })
  console.groupEnd()

  if (report.detailedAnalysis.missingTrades.length > 0) {
    console.group(`❌ Missing Trades (${report.detailedAnalysis.missingTrades.length})`)
    report.detailedAnalysis.missingTrades.forEach((trade, i) => {
      console.log(`${i + 1}. ${trade.Symbol} - ${trade['Open Datetime']} - Net P&L: $${trade['Net P&L']}`)
    })
    console.groupEnd()
  }

  if (report.detailedAnalysis.invalidParsedTrades.length > 0) {
    console.group(`⚠️  Invalid Parsed Trades (${report.detailedAnalysis.invalidParsedTrades.length})`)
    report.detailedAnalysis.invalidParsedTrades.forEach((item, i) => {
      console.log(`${i + 1}. ${item.original.Symbol}:`, item.issues)
    })
    console.groupEnd()
  }

  // Show top discrepancies
  const significantPnLDiscrepancies = report.detailedAnalysis.pnlAnalysis
    .filter(item => Math.abs(item.difference) > 1.00)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 10)

  if (significantPnLDiscrepancies.length > 0) {
    console.group(`💰 Top P&L Discrepancies`)
    significantPnLDiscrepancies.forEach(item => {
      console.log(`${item.symbol} (${item.date}): TraderVue Net: $${item.traderVueNet.toFixed(2)}, Traderra: $${item.traderraCalculated.toFixed(2)}, Diff: $${item.difference.toFixed(2)}`)
    })
    console.groupEnd()
  }

  console.group('💡 Recommendations')
  report.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`)
  })
  console.groupEnd()

  console.groupEnd()
}

export function generateDiagnosticHTML(report: DiagnosticReport): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Trade Data Diagnostic Report</title>
      <style>
        body { font-family: 'Courier New', monospace; background: #0a0a0a; color: #ffffff; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .summary { background: #1a1a1a; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { background: #111; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
        .match { color: #22c55e; }
        .mismatch { color: #ef4444; }
        .warning { color: #f59e0b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #333; }
        th { background: #1a1a1a; }
        .number { font-family: 'Courier New', monospace; text-align: right; }
        .discrepancy { background: #ef4444; color: white; padding: 2px 6px; border-radius: 4px; }
        h1, h2, h3 { color: #60a5fa; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔍 Trade Data Diagnostic Report</h1>

        <div class="summary">
          <h2>📊 Summary</h2>
          <table>
            <tr>
              <th>Metric</th>
              <th>TraderVue</th>
              <th>Traderra</th>
              <th>Discrepancy</th>
              <th>Status</th>
            </tr>
            <tr>
              <td>Total Trades</td>
              <td class="number">${report.summary.totalTradesTraderVue}</td>
              <td class="number">${report.summary.totalTradesTraderra}</td>
              <td class="number">${report.summary.totalTradesTraderVue - report.summary.totalTradesTraderra}</td>
              <td class="${report.summary.tradeCountMatch ? 'match' : 'mismatch'}">${report.summary.tradeCountMatch ? '✅' : '❌'}</td>
            </tr>
            <tr>
              <td>Total P&L</td>
              <td class="number">$${report.summary.totalPnLTraderVue.toFixed(2)}</td>
              <td class="number">$${report.summary.totalPnLTraderra.toFixed(2)}</td>
              <td class="number ${Math.abs(report.summary.pnlDiscrepancy) > 100 ? 'discrepancy' : ''}">$${report.summary.pnlDiscrepancy.toFixed(2)}</td>
              <td class="${report.summary.pnlMatch ? 'match' : 'mismatch'}">${report.summary.pnlMatch ? '✅' : '❌'}</td>
            </tr>
            <tr>
              <td>Total Commissions</td>
              <td class="number">$${report.summary.totalCommissionsTraderVue.toFixed(2)}</td>
              <td class="number">$${report.summary.totalCommissionsTraderra.toFixed(2)}</td>
              <td class="number">$${report.summary.commissionDiscrepancy.toFixed(2)}</td>
              <td class="${Math.abs(report.summary.commissionDiscrepancy) < 1 ? 'match' : 'mismatch'}">${Math.abs(report.summary.commissionDiscrepancy) < 1 ? '✅' : '⚠️'}</td>
            </tr>
          </table>

          <h3>P&L Breakdown</h3>
          <table>
            <tr>
              <td>Gross P&L</td>
              <td class="number">$${report.summary.grossPnLTraderVue.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Net P&L</td>
              <td class="number">$${report.summary.netPnLTraderVue.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Difference (should equal commissions)</td>
              <td class="number">$${report.summary.grossVsNetDifference.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>💡 Recommendations</h2>
          <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>

        ${report.detailedAnalysis.missingTrades.length > 0 ? `
        <div class="section">
          <h2>❌ Missing Trades (${report.detailedAnalysis.missingTrades.length})</h2>
          <table>
            <tr><th>Symbol</th><th>Date</th><th>Net P&L</th><th>Gross P&L</th></tr>
            ${report.detailedAnalysis.missingTrades.slice(0, 20).map(trade => `
              <tr>
                <td>${trade.Symbol}</td>
                <td>${trade['Open Datetime']}</td>
                <td class="number">$${trade['Net P&L']}</td>
                <td class="number">$${trade['Gross P&L']}</td>
              </tr>
            `).join('')}
          </table>
          ${report.detailedAnalysis.missingTrades.length > 20 ? `<p>... and ${report.detailedAnalysis.missingTrades.length - 20} more</p>` : ''}
        </div>
        ` : ''}

        ${report.detailedAnalysis.invalidParsedTrades.length > 0 ? `
        <div class="section">
          <h2>⚠️ Invalid Parsed Trades (${report.detailedAnalysis.invalidParsedTrades.length})</h2>
          <table>
            <tr><th>Symbol</th><th>Issues</th></tr>
            ${report.detailedAnalysis.invalidParsedTrades.slice(0, 20).map(item => `
              <tr>
                <td>${item.original.Symbol}</td>
                <td>${item.issues.join(', ')}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `
}