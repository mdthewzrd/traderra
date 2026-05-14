/**
 * useIndicator — fetches calculated indicator values from Python API.
 *
 * Usage:
 *   const { values, loading } = useIndicator('ema', { period: 9 }, bars)
 *
 * Flow: React → POST /api/calc → Python → values → canvas renderer
 */
import { useState, useEffect, useCallback } from 'react'

interface IndicatorResult {
  values: number[]
  [key: string]: any
}

export function useIndicator(
  key: string | null,
  params: Record<string, any>,
  bars: BarData[] | null
) {
  const [result, setResult] = useState<IndicatorResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!key || !bars || bars.length === 0) {
      setResult(null)
      return
    }

    setLoading(true)

    fetch('/api/calc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        params,
        data: bars.map(b => ({
          t: b.time,
          o: b.open,
          h: b.high,
          l: b.low,
          c: b.close,
          v: b.volume,
        })),
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.result) {
          setResult(data.result)
        }
      })
      .catch(err => {
        console.warn(`[useIndicator] ${key} failed:`, err)
        setResult(null)
      })
      .finally(() => setLoading(false))
  }, [key, JSON.stringify(params), bars])

  return { result, loading }
}

/**
 * Batch indicator calculation — calculate multiple indicators in one call.
 */
export function useIndicators(
  indicators: Array<{ key: string; params: Record<string, any> }> | null,
  bars: BarData[] | null
) {
  const [results, setResults] = useState<Record<string, IndicatorResult>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!indicators || indicators.length === 0 || !bars || bars.length === 0) {
      setResults({})
      return
    }

    setLoading(true)

    Promise.all(
      indicators.map(ind =>
        fetch('/api/calc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: ind.key,
            params: ind.params,
            data: bars.map(b => ({
              t: b.time, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume,
            })),
          }),
        })
          .then(r => r.json())
          .then(data => ({ key: ind.key, result: data.result }))
          .catch(() => ({ key: ind.key, result: null }))
      )
    ).then(all => {
      const map: Record<string, IndicatorResult> = {}
      for (const { key, result } of all) {
        if (result) map[key] = result
      }
      setResults(map)
      setLoading(false)
    })
  }, [JSON.stringify(indicators), bars])

  return { results, loading }
}

export interface BarData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
