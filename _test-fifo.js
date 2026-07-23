// Quick sanity test of the FIFO matcher against user's GLD data
const { parseDASCSV, convertDASToTraderra } = require('./src/utils/csv-parser')

const sample = `Date\tTime\tSymbol\tQuantity\tPrice\tSide\tCommission\tECNFee
7/22/2026\t10:01:27\tGLD\t50\t381.42\tB\t\t0.175
7/22/2026\t9:58:32\tGLD\t75\t380.91\tB\t\t0.2625
7/22/2026\t9:59:14\tGLD\t25\t381.18\tB\t\t0.0875
7/22/2026\t9:58:38\tGLD\t10\t380.93\tSS\t\t-0.02
7/22/2026\t9:59:45\tGLD\t25\t381.22\tSS\t\t0
7/22/2026\t10:01:50\tGLD\t25\t381.6\tSS\t\t0
7/22/2026\t10:02:14\tGLD\t25\t381.77\tSS\t\t-0.05
7/22/2026\t10:04:12\tGLD\t32\t381.93\tB\t\t0.112
7/22/2026\t10:04:12\tGLD\t3\t381.93\tB\t\t0.0105
7/22/2026\t10:22:12\tGLD\t5\t380.935\tSS\t\t0`

const fills = parseDASCSV(sample)
console.log('Parsed fills:', fills.length)
fills.forEach(f => console.log(`  ${f.Date} ${f.Time} ${f.Symbol} qty=${f.Quantity} $${f.Price} ${f.Side}`))

const trades = convertDASToTraderra(fills, 'DAS')
console.log('\nMatched round-trip trades:', trades.length)
let totalPnl = 0
trades.forEach(t => {
  console.log(`  ${t.side} ${t.symbol} qty=${t.quantity} entry=$${t.entryPrice.toFixed(2)} exit=$${t.exitPrice.toFixed(2)} pnl=$${t.pnl.toFixed(2)} dur=${t.duration}`)
  totalPnl += t.pnl
})
console.log(`\nTotal P&L: $${totalPnl.toFixed(2)}`)

// Count unmatched fills
const totalFillQty = fills.reduce((s, f) => s + parseInt(f.Quantity), 0)
const matchedQty = trades.reduce((s, t) => s + t.quantity, 0)
console.log(`Total fill qty: ${totalFillQty}, matched qty: ${matchedQty}, open: ${totalFillQty - matchedQty*2}`)
