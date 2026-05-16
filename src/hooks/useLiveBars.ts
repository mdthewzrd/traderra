/**
 * useLiveBars — wraps useBars with live polling when liveMode is on.
 * Appends/updates only new bars instead of refetching everything.
 */
import { useState, useEffect, useRef } from 'react'
import { useBars, Bar } from './useBars'
import { useUIStore } from '@/stores/charts/uiStore'

export function useLiveBars(symbol: string | null, tf: string) {
  const liveMode = useUIStore(s => s.liveMode)
  const { bars: fetchedBars, loading, error } = useBars(symbol, tf)
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
