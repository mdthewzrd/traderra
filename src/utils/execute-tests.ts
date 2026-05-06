/**
 * Execute TradeRa Comprehensive Test Suite
 * Direct execution script for immediate testing
 */

import { TradeRaTestRunner, runComprehensiveTests } from './test-runner'

/**
 * Execute tests immediately
 */
async function executeTests() {
  console.log('🚀 IMMEDIATE TEST EXECUTION - TradeRa Production Suite')
  console.log('=' .repeat(70))

  try {
    // Configure for production testing
    const config = {
      runParallel: false,
      maxConcurrency: 5,
      generateReports: true,
      saveResults: true,
      stopOnFirstFailure: false,
      verboseOutput: true,
      includeCategories: ['date_parsing', 'display_modes', 'page_navigation'], // Focus on core functionality first
      includePriorities: ['critical', 'high']
    }

    const runner = new TradeRaTestRunner(config)
    const report = await runner.runTests()

    // Final assessment
    const isProductionReady = report.summary.successRate >= 95 &&
                            (report.summary.priorityResults?.critical?.successRate || 0) === 100

    console.log('\n🏭 PRODUCTION READINESS ASSESSMENT')
    console.log('=' .repeat(70))
    console.log(`📊 Overall Success Rate: ${report.summary.successRate.toFixed(2)}% (Target: ≥95%)`)
    console.log(`🎯 Critical Tests: ${report.summary.priorityResults?.critical?.successRate || 0}% (Target: 100%)`)
    console.log(`📅 Date Parsing: ${report.summary.categoryResults?.date_parsing?.successRate || 0}% (Target: ≥98%)`)
    console.log(`🖥️  Display Modes: ${report.summary.categoryResults?.display_modes?.successRate || 0}% (Target: ≥95%)`)
    console.log(`🧭 Page Navigation: ${report.summary.categoryResults?.page_navigation?.successRate || 0}% (Target: ≥95%)`)

    console.log(`\n✅ FINAL STATUS: ${isProductionReady ? 'PRODUCTION READY' : 'NOT PRODUCTION READY'}`)

    if (!isProductionReady) {
      console.log('\n⚠️  CRITICAL ISSUES REQUIRING ATTENTION:')

      if (report.summary.successRate < 95) {
        console.log(`   • Overall success rate below 95%: ${report.summary.successRate.toFixed(2)}%`)
      }

      if ((report.summary.priorityResults?.critical?.successRate || 0) !== 100) {
        console.log(`   • Critical tests failing: ${100 - (report.summary.priorityResults?.critical?.successRate || 0)}% failure rate`)
      }

      if ((report.summary.categoryResults?.date_parsing?.successRate || 0) < 98) {
        console.log(`   • Date parsing below 98%: ${(report.summary.categoryResults?.date_parsing?.successRate || 0).toFixed(2)}%`)
      }
    }

    return report

  } catch (error) {
    console.error('❌ Test execution failed:', error)
    throw error
  }
}

/**
 * Quick date parser test for immediate validation
 */
async function quickDateParserTest() {
  console.log('🧪 QUICK DATE PARSER VALIDATION')
  console.log('-' .repeat(40))

  // Import the enhanced parser
  const { parseNaturalDateRange } = await import('./natural-date-parser')

  const testCases = [
    'last month',
    'ytd',
    'last 3 months',
    'jan 15 to feb 15',
    'show me lst week', // typo
    'yestrday to today', // typo
    'q1 2024',
    'last 90 days',
    'this year',
    'all time'
  ]

  let passed = 0
  const results = []

  for (const testCase of testCases) {
    try {
      const result = parseNaturalDateRange(testCase)
      const success = result.success
      passed += success ? 1 : 0

      const range = result.success ? result.range : null
      const message = result.message || ''

      results.push({
        input: testCase,
        success,
        range,
        message
      })

      console.log(`${success ? '✅' : '❌'} "${testCase}" → ${success ? range : 'FAILED'}`)
    } catch (error) {
      console.log(`❌ "${testCase}" → ERROR: ${error}`)
      results.push({
        input: testCase,
        success: false,
        error: error
      })
    }
  }

  const successRate = (passed / testCases.length) * 100
  console.log(`\n📊 Quick Test Results: ${passed}/${testCases.length} (${successRate.toFixed(2)}%)`)

  return { passed, total: testCases.length, successRate, results }
}

// Execute tests immediately
if (typeof require !== 'undefined' && require.main === module) {
  (async () => {
    try {
      // Quick date parser validation first
      await quickDateParserTest()

      console.log('\n')

      // Full comprehensive test suite
      await executeTests()

    } catch (error) {
      console.error('💥 Test execution failed:', error)
      process.exit(1)
    }
  })()
}

// Export for use in other contexts
export { executeTests, quickDateParserTest }
export default executeTests