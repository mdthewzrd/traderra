/**
 * useLiveBars — wraps useBars with live polling when liveMode is on.
 * Appends/updates only new bars instead of refetching everything.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useBars, Bar } from './useBars'
import { useUIStore } from '@/stores/charts/uiStore'

export function useLiveBars(symbol: string | null, tf: string, focusDate?: string | null) {
  const liveMode = useUIStore(s => s.liveMode)

  // Compute from/to dates based on focusDate
  const { fromDate, toDate } = useMemo(() => {
    console.log(`[useLiveBars] focusDate=${focusDate} tf=${tf}`)
    if (!focusDate) return { fromDate: undefined, toDate: undefined }
    // Calculate how many days back based on timeframe
    const daysBack: Record<string, number> = { '2': 1, '5': 2, '15': 8, '60': 22, 'D': 90 }
    const back = daysBack[tf] || 30
    const to = new Date(focusDate + 'T12:00:00')
    const from = new Date(to.getTime() - back * 24 * 60 * 60 * 1000)
    return {
      fromDate: from.toISOString().split('T')[0],
      toDate: focusDate,
    }
  }, [focusDate, tf])

  const { bars: fetchedBars, loading, error } = useBars(symbol, tf, fromDate, toDate)
  const [liveBars, setLiveBars] = useState<Bar[]>([])
  const barsRef = useRef<Bar[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // When fetched bars change (new symbol/tf), reset live bars
  useEffect(() => {
    setLiveBars(fetchedBars)
    barsRef.current = fetchedBars
  }, [fetchedBars])

  // Live polling — fetch only latest bars and merge
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!liveMode || !symbol || fetchedBars.length === 0) return

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
              updated.push(nb) // brand new bar
            } else {
              const idx = updated.findIndex(b => b.time === nb.time)
              if (idx >= 0) updated[idx] = nb // update in-progress bar
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
  }, [liveMode, symbol, tf, fetchedBars])

  return { bars: liveBars, loading, error }
}
