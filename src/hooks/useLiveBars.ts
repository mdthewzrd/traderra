/**
 * useLiveBars — fetches OHLCV bars with two modes:
 *
 * Live mode (focusDate=null): fetches latest data, polls every 3s to append new bars.
 * Historical mode (focusDate set): fetches data ending at focusDate, no polling,
 *   bars are hard-trimmed to never exceed the signal date.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useBars, Bar } from './useBars'
import { useUIStore } from '@/stores/charts/uiStore'

function barToDate(bar: Bar): string {
  if (typeof bar.time === 'string') return bar.time
  // time is in seconds for intraday, or ms for daily — normalize
  const d = new Date(bar.time * 1000)
  return d.toISOString().split('T')[0]
}

export function useLiveBars(symbol: string | null, tf: string, focusDate?: string | null) {
  const liveMode = useUIStore(s => s.liveMode)

  // Compute from/to dates based on focusDate
  const { fromDate, toDate } = useMemo(() => {
    if (!focusDate) return { fromDate: undefined, toDate: undefined }
    // How many calendar days back per timeframe to get enough trading days
    const daysBack: Record<string, number> = { '2': 2, '5': 4, '15': 15, '60': 40, 'D': 120 }
    const back = daysBack[tf] || 30
    const to = new Date(focusDate + 'T12:00:00')
    const from = new Date(to.getTime() - back * 24 * 60 * 60 * 1000)
    return {
      fromDate: from.toISOString().split('T')[0],
      toDate: focusDate,
    }
  }, [focusDate, tf])

  // In historical mode, pause fetching until we have bounded dates
  const paused = !!focusDate && !toDate

  const { bars: fetchedBars, loading, error } = useBars(symbol, tf, fromDate, toDate, paused)
  const [liveBars, setLiveBars] = useState<Bar[]>([])
  const barsRef = useRef<Bar[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // When fetched bars change, update live bars
  // In historical mode: hard-trim any bars past focusDate
  useEffect(() => {
    if (focusDate) {
      // Historical mode: only keep bars up to and including focusDate
      const trimmed = fetchedBars.filter(b => barToDate(b) <= focusDate)
      setLiveBars(trimmed)
      barsRef.current = trimmed
    } else {
      // Live mode: use all fetched bars
      setLiveBars(fetchedBars)
      barsRef.current = fetchedBars
    }
  }, [fetchedBars, focusDate])

  // Live polling — only in live mode (no focusDate)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!liveMode || !symbol || fetchedBars.length === 0 || focusDate) return

    intervalRef.current = setInterval(async () => {
      try {
        const current = barsRef.current
        if (!current.length) return
        const lastTime = current[current.length - 1].time
        const from = new Date(lastTime * 1000).toISOString().split('T')[0]
        const resp = await fetch(`/api/chart-data/bars?symbol=${symbol}&tf=${tf}&from=${from}`)
        if (!resp.ok) return
        const data = await resp.json()
        const newBars: Bar[] = data.bars || data.results || []
        if (!newBars.length) return

        setLiveBars(prev => {
          const updated = [...prev]
          const lastT = updated[updated.length - 1]?.time ?? 0
          for (const nb of newBars) {
            if (nb.time > lastT) {
              updated.push(nb)
            } else {
              const idx = updated.findIndex(b => b.time === nb.time)
              if (idx >= 0) updated[idx] = nb
            }
          }
          barsRef.current = updated
          return updated
        })
      } catch {
        // Silently ignore polling errors
      }
    }, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [liveMode, symbol, tf, fetchedBars, focusDate])

  return { bars: liveBars, loading, error }
}
