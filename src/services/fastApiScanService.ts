/**
 * FastAPI Scan Service - Integration with backend scanning API
 * Replaces the original TypeScript scan logic with FastAPI calls
 */

export interface ScanFilters {
  min_gap?: number
  min_volume?: number
  min_price?: number
  max_price?: number
  sector?: string
  lc_frontside_d2_extended?: boolean
  lc_frontside_d3_extended?: boolean
  risk_tolerance?: 'conservative' | 'moderate' | 'aggressive'
  natural_language_query?: string
}

export interface ScanRequest {
  start_date: string
  end_date: string
  filters: ScanFilters
  enable_progress?: boolean
}

export interface ScanResult {
  ticker: string
  date: string
  gap_pct: number
  parabolic_score: number
  lc_frontside_d2_extended?: number
  lc_frontside_d3_extended?: number
  volume: number
  price?: number
}

export interface ScanResponse {
  success: boolean
  scan_id: string
  message: string
  results: ScanResult[]
  total_processed?: number
  execution_time?: number
}

export interface WebSocketMessage {
  type: 'connected' | 'progress' | 'result' | 'complete' | 'error'
  scan_id: string
  message: string
  progress?: number
  current_ticker?: string
  results_count?: number
  data?: any
}

class FastApiScanService {
  private baseUrl: string
  private wsUrl: string

  constructor() {
    // Use environment variable or default to localhost:8000
    this.baseUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
    this.wsUrl = this.baseUrl.replace('http', 'ws')
  }

  /**
   * Execute a trading scan using the FastAPI backend
   */
  async executeScan(request: ScanRequest): Promise<ScanResponse> {
    try {
      console.log('🚀 Executing scan via FastAPI:', request)

      const response = await fetch(`${this.baseUrl}/api/scan/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Scan API error (${response.status}): ${errorText}`)
      }

      const data: ScanResponse = await response.json()
      console.log('✅ Scan completed:', data)

      // Transform the results to match frontend expectations
      const transformedResults = data.results.map(result => ({
        ticker: result.ticker,
        gapPercent: result.gap_pct * 100, // Convert to percentage
        volume: result.volume,
        rMultiple: result.parabolic_score,
        date: result.date
      }))

      return {
        ...data,
        results: data.results // Keep original format for compatibility
      }

    } catch (error) {
      console.error('❌ FastAPI scan error:', error)
      throw error
    }
  }

  /**
   * Execute scan with dynamic date range (1/1/24 - today format)
   */
  async executeScanWithDateRange(
    scanDate?: string,
    filters: ScanFilters = {},
    enableProgress = false
  ): Promise<ScanResponse> {
    // Default date range: from January 1, 2024 to scan date (or today)
    const endDate = scanDate || new Date().toISOString().split('T')[0]
    const startDate = '2024-01-01'

    const request: ScanRequest = {
      start_date: startDate,
      end_date: endDate,
      filters,
      enable_progress: enableProgress
    }

    return this.executeScan(request)
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan/status/${scanId}`)

      if (!response.ok) {
        throw new Error(`Failed to get scan status: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting scan status:', error)
      throw error
    }
  }

  /**
   * List all scans
   */
  async listScans(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scan/list`)

      if (!response.ok) {
        throw new Error(`Failed to list scans: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error listing scans:', error)
      throw error
    }
  }

  /**
   * Create WebSocket connection for real-time progress updates
   */
  createProgressWebSocket(
    scanId: string,
    onMessage: (message: WebSocketMessage) => void,
    onError?: (error: Event) => void,
    onClose?: (event: CloseEvent) => void
  ): WebSocket {
    const ws = new WebSocket(`${this.wsUrl}/api/scan/progress/${scanId}`)

    ws.onopen = () => {
      console.log('🔗 WebSocket connected for scan:', scanId)
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        onMessage(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      if (onError) onError(error)
    }

    ws.onclose = (event) => {
      console.log('🔌 WebSocket closed for scan:', scanId)
      if (onClose) onClose(event)
    }

    return ws
  }

  /**
   * Execute scan with real-time progress updates
   */
  async executeScanWithProgress(
    request: ScanRequest,
    onProgress: (message: WebSocketMessage) => void,
    onError?: (error: any) => void
  ): Promise<ScanResponse> {
    try {
      // Start the scan
      const scanResponse = await this.executeScan({
        ...request,
        enable_progress: true
      })

      // Connect to WebSocket for progress updates
      const ws = this.createProgressWebSocket(
        scanResponse.scan_id,
        onProgress,
        onError,
        () => {
          console.log('Progress WebSocket closed')
        }
      )

      // Close WebSocket after a reasonable timeout
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close()
        }
      }, 60000) // 1 minute timeout

      return scanResponse

    } catch (error) {
      console.error('Error executing scan with progress:', error)
      if (onError) onError(error)
      throw error
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      return response.ok
    } catch (error) {
      console.error('FastAPI health check failed:', error)
      return false
    }
  }

  /**
   * Transform natural language query to filters
   */
  parseNaturalLanguageQuery(query: string): ScanFilters {
    const filters: ScanFilters = {
      natural_language_query: query
    }

    const text = query.toLowerCase()

    // Basic pattern matching
    if (text.includes('gap') && text.includes('up')) {
      filters.min_gap = 2.0
    }
    if (text.includes('high volume') || text.includes('heavy volume')) {
      filters.min_volume = 10000000
    }
    if (text.includes('momentum') || text.includes('breakout')) {
      filters.lc_frontside_d2_extended = true
    }
    if (text.includes('biotech') || text.includes('pharma')) {
      filters.sector = 'healthcare'
    }
    if (text.includes('large cap') || text.includes('big stocks')) {
      filters.min_price = 20.0
    }
    if (text.includes('conservative')) {
      filters.risk_tolerance = 'conservative'
      filters.min_volume = Math.max(filters.min_volume || 0, 10000000)
    } else if (text.includes('aggressive')) {
      filters.risk_tolerance = 'aggressive'
    }

    return filters
  }

  /**
   * Generate AI-enhanced scan configuration
   */
  generateAIScanConfig(
    marketCondition: 'bullish' | 'bearish' | 'volatile' | 'ranging',
    tradingStyle: 'scalping' | 'swing' | 'momentum' | 'breakout',
    riskTolerance: 'conservative' | 'moderate' | 'aggressive'
  ): ScanFilters {
    const filters: ScanFilters = {
      risk_tolerance: riskTolerance
    }

    // Market condition adjustments
    switch (marketCondition) {
      case 'bullish':
        filters.min_gap = 1.5
        filters.min_volume = 5000000
        filters.lc_frontside_d2_extended = true
        break
      case 'bearish':
        filters.min_gap = 3.0
        filters.min_volume = 15000000
        filters.min_price = 5.0
        break
      case 'volatile':
        filters.min_gap = 2.5
        filters.min_volume = 20000000
        filters.max_price = 50.0
        break
      case 'ranging':
        filters.min_gap = 1.0
        filters.min_volume = 3000000
        break
    }

    // Trading style adjustments
    switch (tradingStyle) {
      case 'scalping':
        filters.min_volume = Math.max(filters.min_volume || 0, 25000000)
        filters.min_price = 10.0
        filters.max_price = 100.0
        break
      case 'swing':
        filters.min_gap = Math.max(filters.min_gap || 0, 2.0)
        filters.lc_frontside_d2_extended = true
        break
      case 'momentum':
        filters.min_gap = Math.max(filters.min_gap || 0, 3.0)
        filters.lc_frontside_d3_extended = true
        break
      case 'breakout':
        filters.lc_frontside_d2_extended = true
        filters.min_volume = Math.max(filters.min_volume || 0, 10000000)
        break
    }

    // Risk tolerance adjustments
    if (riskTolerance === 'conservative') {
      filters.min_volume = Math.max(filters.min_volume || 0, 15000000)
      filters.min_price = Math.max(filters.min_price || 0, 5.0)
      if (filters.max_price === undefined) filters.max_price = 200.0
    } else if (riskTolerance === 'aggressive') {
      // Remove conservative constraints
      delete filters.max_price
      filters.min_price = Math.max(filters.min_price || 0, 1.0)
    }

    return filters
  }
}

// Export singleton instance
export const fastApiScanService = new FastApiScanService()
export default fastApiScanService