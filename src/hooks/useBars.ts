/**
 * useBars — fetches OHLCV bar data from Polygon.io via API route.
 *
 * Usage:
 *   const { bars, loading, error } = useBars('AAPL', '5', from, to)
 */
import { useState, useEffect, useRef, useCallback } from 'react'

export interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap?: number
  n?: number
}

export function useBars(
  symbol: string | null,
  timeframe: string,
  fromDate?: string,
  toDate?: string
) {
  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchBars = useCallback(async () => {
    if (!symbol) {
      setBars([])
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        symbol,
        tf: timeframe,
      })
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)

      console.log(`[useBars] fetching ${symbol} tf=${timeframe} from=${fromDate} to=${toDate} url=/api/chart-data/bars?${params}`)

      const resp = await fetch(`/api/chart-data/bars?${params}`, {
        signal: controller.signal,
      })

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`)
      }

      const data = await resp.json()
      setBars(data.bars || data.results || [])
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        console.warn('[useBars] fetch failed:', err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [symbol, timeframe, fromDate, toDate])

  useEffect(() => {
    fetchBars()
    return () => abortRef.current?.abort()
  }, [fetchBars])

  return { bars, loading, error, refetch: fetchBars }
}
