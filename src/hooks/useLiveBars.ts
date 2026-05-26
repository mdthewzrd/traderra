/**
 * useLiveBars — fetches OHLCV bars with two modes:
 *
 * Live mode (focusDate=null): fetches latest data, polls every 3s.
 * Historical mode (focusDate set): fetches data ending at focusDate, no polling.
 *
 * Key insight: fetch is keyed by [symbol, tf, focusDate] together.
 * When any changes, old fetch is aborted, bars cleared, new fetch starts.
 * No stale data can survive because we track a fetchId and discard stale results.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useUIStore } from '@/stores/charts/uiStore'

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

function barToDate(bar: Bar): string {
  if (typeof bar.time === 'string') return bar.time
  return new Date(bar.time * 1000).toISOString().split('T')[0]
}

export function useLiveBars(symbol: string | null, tf: string, focusDate?: string | null) {
  const liveMode = useUIStore(s => s.liveMode)

  // Compute bounded date range for historical mode
  const { fromDate, toDate } = useMemo(() => {
    if (!focusDate) return { fromDate: undefined, toDate: undefined }
    const daysBack: Record<string, number> = { '2': 2, '5': 4, '15': 15, '60': 40, 'D': 120 }
    const back = daysBack[tf] || 30
    const to = new Date(focusDate + 'T12:00:00')
    const from = new Date(to.getTime() - back * 24 * 60 * 60 * 1000)
    return {
      fromDate: from.toISOString().split('T')[0],
      toDate: focusDate,
    }
  }, [focusDate, tf])

  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(false)
  const fetchIdRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Main data fetch — keyed by symbol+tf+focusDate (via fromDate/toDate)
  useEffect(() => {
    if (!symbol) {
      setBars([])
      return
    }

    // Increment fetch ID to invalidate any in-flight fetches
    const thisFetchId = ++fetchIdRef.current

    // Clear old data immediately
    setBars([])
    setLoading(true)

    const params = new URLSearchParams({ symbol, tf })
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)

    fetch(`/api/chart-data/bars?${params}`)
      .then(r => r.json())
      .then(data => {
        // Discard if a newer fetch has started
        if (fetchIdRef.current !== thisFetchId) return
        const raw: Bar[] = data.bars || data.results || []

        // Historical mode: hard-trim anything past focusDate
        if (focusDate) {
          setBars(raw.filter(b => barToDate(b) <= focusDate))
        } else {
          setBars(raw)
        }
        setLoading(false)
      })
      .catch(() => {
        if (fetchIdRef.current !== thisFetchId) return
        setBars([])
        setLoading(false)
      })

    return () => {
      // Cleanup: increment fetchId to invalidate this fetch if still in-flight
      fetchIdRef.current++
    }
  }, [symbol, tf, fromDate, toDate])

  // Live polling — only in live mode, no focusDate
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!liveMode || !symbol || focusDate) return

    intervalRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/chart-data/bars?symbol=${symbol}&tf=${tf}&from=${new Date().toISOString().split('T')[0]}`)
        if (!resp.ok) return
        const data = await resp.json()
        const newBars: Bar[] = data.bars || data.results || []
        if (!newBars.length) return

        setBars(prev => {
          const updated = [...prev]
          const lastT = updated[updated.length - 1]?.time ?? 0
          for (const nb of newBars) {
            if (nb.time > lastT) updated.push(nb)
            else {
              const idx = updated.findIndex(b => b.time === nb.time)
              if (idx >= 0) updated[idx] = nb
            }
          }
          return updated
        })
      } catch {
        // Silent
      }
    }, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [liveMode, symbol, tf, focusDate])

  return { bars, loading, error: null }
}
