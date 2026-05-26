/**
 * useLiveBars — fetches OHLCV bars with two modes:
 *
 * Live mode (focusDate=null): fetches latest data, polls every 3s.
 * Historical mode (focusDate set): fetches data ending at focusDate, no polling.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useChartStore } from '@/stores/charts/chartStore'
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

function computeDateRange(tf: string, focusDate: string) {
  const daysBack: Record<string, number> = { '2': 2, '5': 4, '15': 15, '60': 40, 'D': 120 }
  const back = daysBack[tf] || 30
  const to = new Date(focusDate + 'T12:00:00')
  const from = new Date(to.getTime() - back * 24 * 60 * 60 * 1000)
  return {
    fromDate: from.toISOString().split('T')[0],
    toDate: focusDate,
  }
}

export function useLiveBars(symbol: string | null, tf: string, focusDate?: string | null) {
  const liveMode = useUIStore(s => s.liveMode)

  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(false)
  const fetchIdRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch data — reads focusDate from store to avoid stale closures
  useEffect(() => {
    if (!symbol) {
      setBars([])
      return
    }

    const currentFocus = useChartStore.getState().focusDate
    const thisFetchId = ++fetchIdRef.current

    // Clear old data immediately
    setBars([])
    setLoading(true)

    const params = new URLSearchParams({ symbol, tf })

    if (currentFocus) {
      const { fromDate, toDate } = computeDateRange(tf, currentFocus)
      params.set('from', fromDate)
      params.set('to', toDate)
      console.log(`[useLiveBars] ${symbol} tf=${tf} HISTORICAL from=${fromDate} to=${toDate} fetchId=${thisFetchId}`)
    } else {
      console.log(`[useLiveBars] ${symbol} tf=${tf} LIVE (no date bounds) fetchId=${thisFetchId}`)
    }

    fetch(`/api/chart-data/bars?${params}`)
      .then(r => r.json())
      .then(data => {
        if (fetchIdRef.current !== thisFetchId) {
          console.log(`[useLiveBars] ${symbol} STALE fetchId=${thisFetchId} current=${fetchIdRef.current} — discarded`)
          return
        }
        const raw: Bar[] = data.bars || data.results || []

        if (currentFocus) {
          const trimmed = raw.filter(b => barToDate(b) <= currentFocus)
          console.log(`[useLiveBars] ${symbol} HISTORICAL got ${raw.length} bars, trimmed to ${trimmed.length} (last: ${trimmed.length ? barToDate(trimmed[trimmed.length-1]) : 'none'})`)
          setBars(trimmed)
        } else {
          console.log(`[useLiveBars] ${symbol} LIVE got ${raw.length} bars (last: ${raw.length ? barToDate(raw[raw.length-1]) : 'none'})`)
          setBars(raw)
        }
        setLoading(false)
      })
      .catch(err => {
        if (fetchIdRef.current !== thisFetchId) return
        console.warn(`[useLiveBars] ${symbol} fetch failed:`, err)
        setBars([])
        setLoading(false)
      })

    return () => { fetchIdRef.current++ }
  }, [symbol, tf, focusDate])

  // Live polling — only when no focusDate
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
      } catch { /* silent */ }
    }, 3000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [liveMode, symbol, tf, focusDate])

  return { bars, loading, error: null }
}
