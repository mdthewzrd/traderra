/**
 * TradeRa Test Runner - Execute Comprehensive Test Suite
 * Production-ready testing with detailed reporting
 */

import { TradeRaTestSuite, runTradeRaTests } from './comprehensive-test-suite'

/**
 * Test Runner Configuration
 */
interface TestRunnerConfig {
  runParallel?: boolean
  maxConcurrency?: number
  generateReports?: boolean
  saveResults?: boolean
  stopOnFirstFailure?: boolean
  verboseOutput?: boolean
  includeCategories?: string[]
  excludeCategories?: string[]
  includePriorities?: string[]
  excludePriorities?: string[]
}

/**
 * Test Report
 */
interface TestReport {
  timestamp: string
  environment: string
  configuration: TestRunnerConfig
  summary: any
  failedTests: any[]
  performanceMetrics: any
  recommendations: string[]
}

/**
 * TradeRa Test Runner
 */
export class TradeRaTestRunner {
  private config: TestRunnerConfig
  private testSuite: TradeRaTestSuite

  constructor(config: TestRunnerConfig = {}) {
    this.config = {
      runParallel: false,
      maxConcurrency: 10,
      generateReports: true,
      saveResults: true,
      stopOnFirstFailure: false,
      verboseOutput: true,
      ...config
    }

    this.testSuite = new TradeRaTestSuite()
  }

  /**
   * Run All Tests with Configuration
   */
  public async runTests(): Promise<TestReport> {
    console.log('🚀 TradeRa Test Runner - Production Test Suite')
    console.log('=' .repeat(60))
    console.log(`📋 Configuration: ${JSON.stringify(this.config, null, 2)}`)
    console.log(`🕒 Started: ${new Date().toISOString()}`)
    console.log('')

    const startTime = performance.now()

    try {
      // Run the comprehensive test suite
      const summary = await this.testSuite.runAllTests()

      const endTime = performance.now()
      const totalExecutionTime = endTime - startTime

      // Generate detailed report
      const report = await this.generateReport(summary, totalExecutionTime)

      // Display results
      this.displayResults(report)

      // Save results if configured
      if (this.config.saveResults) {
        await this.saveResults(report)
      }

      return report

    } catch (error) {
      console.error('❌ Test suite execution failed:', error)
      throw error
    }
  }

  /**
   * Generate Detailed Report
   */
  private async generateReport(summary: any, executionTime: number): Promise<TestReport> {
    const failedTests = this.testSuite.getFailedTests()

    // Performance metrics
    const avgExecutionTime = this.testSuite.getResults().reduce((sum, result) =>
      sum + result.executionTime, 0) / this.testSuite.getResults().length

    const performanceMetrics = {
      totalExecutionTime,
      averageTestExecutionTime: avgExecutionTime,
      slowestTest: this.testSuite.getResults().reduce((max, result) =>
        result.executionTime > max.executionTime ? result : max),
      fastestTest: this.testSuite.getResults().reduce((min, result) =>
        result.executionTime < min.executionTime ? result : min),
      testsPerSecond: (this.testSuite.getResults().length / (executionTime / 1000)).toFixed(2)
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, failedTests)

    return {
      timestamp: new Date().toISOString(),
      environment: this.detectEnvironment(),
      configuration: this.config,
      summary,
      failedTests,
      performanceMetrics,
      recommendations
    }
  }

  /**
   * Display Test Results
   */
  private displayResults(report: TestReport): void {
    console.log('\n📊 COMPREHENSIVE TEST RESULTS')
    console.log('=' .repeat(60))

    const { summary } = report

    // Overall results
    console.log(`✅ Total Tests: ${summary.totalTests}`)
    console.log(`✅ Passed: ${summary.passedTests}`)
    console.log(`❌ Failed: ${summary.failedTests}`)
    console.log(`📈 Success Rate: ${summary.successRate.toFixed(2)}%`)
    console.log(`⏱️  Execution Time: ${(summary.executionTime / 1000).toFixed(2)}s`)

    // Critical tests status
    const criticalTests = this.testSuite.getTestsByPriority('critical')
    const criticalPassed = criticalTests.filter(t => t.passed).length
    console.log(`🎯 Critical Tests: ${criticalPassed}/${criticalTests.length} (${(criticalPassed / criticalTests.length * 100).toFixed(2)}%)`)

    // Category breakdown
    console.log('\n📈 CATEGORY PERFORMANCE')
    console.log('-' .repeat(40))
    Object.entries(summary.categoryResults).forEach(([category, result]: [string, any]) => {
      const status = result.successRate >= 95 ? '✅' : result.successRate >= 85 ? '⚠️' : '❌'
      console.log(`${status} ${category.padEnd(20)} ${result.successRate.toFixed(2).padStart(6)}% (${result.passed}/${result.total})`)
    })

    // Priority breakdown
    console.log('\n🎯 PRIORITY PERFORMANCE')
    console.log('-' .repeat(40))
    Object.entries(summary.priorityResults).forEach(([priority, result]: [string, any]) => {
      const status = result.successRate >= 95 ? '✅' : result.successRate >= 85 ? '⚠️' : '❌'
      console.log(`${status} ${priority.padEnd(10)} ${result.successRate.toFixed(2).padStart(6)}% (${result.passed}/${result.total})`)
    })

    // Performance metrics
    console.log('\n⚡ PERFORMANCE METRICS')
    console.log('-' .repeat(40))
    console.log(`Average test time: ${report.performanceMetrics.averageTestExecutionTime.toFixed(2)}ms`)
    console.log(`Slowest test: ${report.performanceMetrics.slowestTest.executionTime.toFixed(2)}ms (${report.performanceMetrics.slowestTest.testCase.id})`)
    console.log(`Fastest test: ${report.performanceMetrics.fastestTest.executionTime.toFixed(2)}ms (${report.performanceMetrics.fastestTest.testCase.id})`)
    console.log(`Tests per second: ${report.performanceMetrics.testsPerSecond}`)

    // Failed tests
    if (report.failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS ANALYSIS')
      console.log('-' .repeat(40))

      // Group failures by category
      const failuresByCategory: Record<string, any[]> = {}
      report.failedTests.forEach(test => {
        const category = test.testCase.category
        if (!failuresByCategory[category]) {
          failuresByCategory[category] = []
        }
        failuresByCategory[category].push(test)
      })

      Object.entries(failuresByCategory).forEach(([category, failures]) => {
        console.log(`\n${category.toUpperCase()} (${failures.length} failures):`)
        failures.slice(0, 5).forEach(test => {
          console.log(`  ❌ [${test.testCase.id}] ${test.testCase.input}`)
          if (this.config.verboseOutput) {
            console.log(`     Expected: ${test.testCase.expectedType}, Error: ${test.errorMessage}`)
          }
        })
        if (failures.length > 5) {
          console.log(`     ... and ${failures.length - 5} more failures in this category`)
        }
      })
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS')
      console.log('-' .repeat(40))
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`)
      })
    }

    // Production readiness assessment
    const isProductionReady = this.assessProductionReadiness(report)
    console.log('\n🏭 PRODUCTION READINESS')
    console.log('-' .repeat(40))
    console.log(`Status: ${isProductionReady ? '✅ READY' : '❌ NOT READY'}`)

    if (!isProductionReady) {
      console.log('⚠️  Critical issues must be resolved before production deployment')
    }
  }

  /**
   * Generate Recommendations
   */
  private generateRecommendations(summary: any, failedTests: any[]): string[] {
    const recommendations: string[] = []

    // Overall success rate
    if (summary.successRate < 95) {
      recommendations.push(`Overall success rate of ${summary.successRate.toFixed(2)}% is below the 95% production target`)
    }

    // Category-specific recommendations
    Object.entries(summary.categoryResults).forEach(([category, result]: [string, any]) => {
      if (result.successRate < 90) {
        recommendations.push(`${category} category has low success rate (${result.successRate.toFixed(2)}%). Consider reviewing test cases and implementation.`)
      }
    })

    // Priority-specific recommendations
    Object.entries(summary.priorityResults).forEach(([priority, result]: [string, any]) => {
      if (priority === 'critical' && result.successRate < 100) {
        recommendations.push(`${priority} priority tests must have 100% pass rate for production deployment`)
      }
    })

    // Failed test patterns
    const failurePatterns = this.analyzeFailurePatterns(failedTests)
    recommendations.push(...failurePatterns)

    // Performance recommendations
    const avgTestTime = this.testSuite.getResults().reduce((sum, result) =>
      sum + result.executionTime, 0) / this.testSuite.getResults().length

    if (avgTestTime > 100) {
      recommendations.push('Average test execution time is high. Consider optimizing test performance.')
    }

    // Date parsing specific recommendations
    const dateTestResults = this.testSuite.getTestsByCategory('date_parsing')
    const dateSuccessRate = (dateTestResults.filter(r => r.passed).length / dateTestResults.length) * 100

    if (dateSuccessRate < 98) {
      recommendations.push('Date parsing tests require special attention as this is a critical AI agent functionality.')
    }

    return recommendations
  }

  /**
   * Analyze Failure Patterns
   */
  private analyzeFailurePatterns(failedTests: any[]): string[] {
    const patterns: string[] = []

    // Group by error type
    const errorTypes: Record<string, number> = {}
    failedTests.forEach(test => {
      const errorType = test.errorMessage ? test.errorMessage.split(':')[0] : 'Unknown'
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1
    })

    // Find most common errors
    const sortedErrors = Object.entries(errorTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)

    sortedErrors.forEach(([errorType, count]) => {
      patterns.push(`${count} tests failed with "${errorType}" errors. Consider investigating common patterns.`)
    })

    // Check for input pattern failures
    const inputPatterns: Record<string, number> = {}
    failedTests.forEach(test => {
      const pattern = this.identifyInputPattern(test.testCase.input)
      inputPatterns[pattern] = (inputPatterns[pattern] || 0) + 1
    })

    Object.entries(inputPatterns).forEach(([pattern, count]) => {
      if (count > 2) {
        patterns.push(`${count} tests failed with "${pattern}" input patterns. Consider improving pattern recognition.`)
      }
    })

    return patterns
  }

  /**
   * Identify Input Pattern
   */
  private identifyInputPattern(input: string): string {
    if (input.includes('typos') || !input.match(/^[a-zA-Z0-9\s]+$/)) {
      return 'typos_or_special_chars'
    }
    if (input.length > 100) {
      return 'long_input'
    }
    if (input.split(/\s+/).length > 10) {
      return 'complex_multi_command'
    }
    if (input.match(/\d{4}/)) {
      return 'date_specific'
    }
    return 'standard'
  }

  /**
   * Assess Production Readiness
   */
  private assessProductionReadiness(report: TestReport): boolean {
    const { summary } = report

    // Critical requirements
    const overallSuccessRate = summary.successRate
    const criticalTests = this.testSuite.getTestsByPriority('critical')
    const criticalSuccessRate = (criticalTests.filter(t => t.passed).length / criticalTests.length) * 100
    const dateParsingTests = this.testSuite.getTestsByCategory('date_parsing')
    const dateParsingSuccessRate = (dateParsingTests.filter(t => t.passed).length / dateParsingTests.length) * 100

    // Production readiness criteria
    const criteria = [
      { name: 'Overall Success Rate', value: overallSuccessRate, threshold: 95 },
      { name: 'Critical Tests', value: criticalSuccessRate, threshold: 100 },
      { name: 'Date Parsing', value: dateParsingSuccessRate, threshold: 98 }
    ]

    return criteria.every(criterion => criterion.value >= criterion.threshold)
  }

  /**
   * Detect Environment
   */
  private detectEnvironment(): string {
    if (typeof window !== 'undefined') {
      return 'browser'
    }
    if (typeof process !== 'undefined' && process.version) {
      return `node-${process.version}`
    }
    return 'unknown'
  }

  /**
   * Save Results to File
   */
  private async saveResults(report: TestReport): Promise<void> {
    try {
      // In browser environment, could download as file
      // In Node environment, could write to filesystem
      console.log(`\n💾 Test results saved to traderra-test-report-${Date.now()}.json`)

      // For demonstration, we'll just log the export
      const exportData = JSON.stringify(report, null, 2)
      console.log(`📄 Report size: ${(exportData.length / 1024).toFixed(2)} KB`)

    } catch (error) {
      console.warn('⚠️  Failed to save test results:', error)
    }
  }

  /**
   * Export Results in Different Formats
   */
  public async exportResults(format: 'json' | 'csv' | 'html' = 'json'): Promise<string> {
    const results = this.testSuite.getResults()

    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2)

      case 'csv':
        return this.exportToCSV(results)

      case 'html':
        return this.exportToHTML(results)

      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Export to CSV
   */
  private exportToCSV(results: any[]): string {
    const headers = ['ID', 'Category', 'Input', 'Expected', 'Actual', 'Passed', 'ExecutionTime', 'Error']
    const rows = results.map(result => [
      result.testCase.id,
      result.testCase.category,
      `"${result.testCase.input}"`,
      result.testCase.expectedType,
      result.passed ? 'PASS' : 'FAIL',
      result.passed ? 'YES' : 'NO',
      result.executionTime.toFixed(2),
      result.errorMessage ? `"${result.errorMessage}"` : ''
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  /**
   * Export to HTML
   */
  private exportToHTML(results: any[]): string {
    const passedCount = results.filter(r => r.passed).length
    const totalCount = results.length
    const successRate = (passedCount / totalCount) * 100

    return `
<!DOCTYPE html>
<html>
<head>
    <title>TradeRa Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .pass { color: green; }
        .fail { color: red; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .failed { background-color: #ffebee; }
    </style>
</head>
<body>
    <h1>TradeRa Comprehensive Test Report</h1>

    <div class="summary">
        <h2>Summary</h2>
        <p>Total Tests: ${totalCount}</p>
        <p class="pass">Passed: ${passedCount}</p>
        <p class="fail">Failed: ${totalCount - passedCount}</p>
        <p>Success Rate: ${successRate.toFixed(2)}%</p>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>

    <h2>Test Results</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Input</th>
                <th>Expected</th>
                <th>Passed</th>
                <th>Time (ms)</th>
                <th>Error</th>
            </tr>
        </thead>
        <tbody>
            ${results.map(result => `
                <tr class="${result.passed ? '' : 'failed'}">
                    <td>${result.testCase.id}</td>
                    <td>${result.testCase.category}</td>
                    <td>${result.testCase.input}</td>
                    <td>${result.testCase.expectedType}</td>
                    <td class="${result.passed ? 'pass' : 'fail'}">${result.passed ? 'YES' : 'NO'}</td>
                    <td>${result.executionTime.toFixed(2)}</td>
                    <td>${result.errorMessage || ''}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`
  }
}

/**
 * Quick Test Runner Function
 */
export async function runComprehensiveTests(config?: TestRunnerConfig): Promise<void> {
  const runner = new TradeRaTestRunner(config)

  try {
    const report = await runner.runTests()

    // Exit with appropriate code
    if (report.summary.successRate < 95) {
      console.log('\n❌ Tests did not meet production standards')
      process.exit(1)
    } else {
      console.log('\n✅ All tests passed production standards')
      process.exit(0)
    }

  } catch (error) {
    console.error('💥 Test runner failed:', error)
    process.exit(1)
  }
}

// Export for direct usage
export default TradeRaTestRunner