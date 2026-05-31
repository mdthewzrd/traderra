/**
 * useLiveBars — fetches OHLCV bars with two modes:
 *
 * Live mode (focusDate=null): fetches latest data, polls every 3s.
 * Historical mode (focusDate set): fetches data ending at focusDate, no polling.
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

function computeDateRange(tf: string, focusDate: string) {
  const daysBack: Record<string, number> = { '2': 2, '5': 4, '15': 15, '60': 40, 'D': 120, 'W': 260 }
  const back = daysBack[tf] || 30
  const to = new Date(focusDate + 'T12:00:00')
  const from = new Date(to.getTime() - back * 24 * 60 * 60 * 1000)

  // For intraday TFs, set `to` to 7:59:59 PM ET (end of after-hours)
  // This captures all bars including post-market on the focus date
  const isIntraday = tf !== 'D' && tf !== 'W' && tf !== 'M'
  let toDate: string
  if (isIntraday) {
    // 7:59:59 PM ET = next day ~00:00 UTC (EST) or 23:59 UTC (EDT)
    // Use day+1 at 05:00 UTC to cover both EST/EDT after-hours
    const eod = new Date(focusDate + 'T12:00:00')
    eod.setDate(eod.getDate() + 1)
    eod.setUTCHours(5, 0, 0, 0) // 1 AM ET next day = safely past after-hours
    toDate = String(eod.getTime()) // Unix ms for Polygon
  } else {
    toDate = focusDate // date string works fine for daily/weekly
  }

  return {
    fromDate: from.toISOString().split('T')[0],
    toDate,
  }
}

export function useLiveBars(symbol: string | null, tf: string, focusDate?: string | null) {
  const liveMode = useUIStore(s => s.liveMode)

  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(false)
  const fetchIdRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch data — uses focusDate prop directly (no store read needed)
  useEffect(() => {
    if (!symbol) {
      setBars([])
      return
    }

    const thisFetchId = ++fetchIdRef.current

    // Clear old data immediately
    setBars([])
    setLoading(true)

    const params = new URLSearchParams({ symbol, tf })

    if (focusDate) {
      const { fromDate, toDate } = computeDateRange(tf, focusDate)
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

        if (focusDate) {
          const fd = focusDate.length > 10 ? focusDate.slice(0, 10) : focusDate
          const trimmed = raw.filter(b => barToDate(b) <= fd)
          const rawDates = raw.length > 3 ? `${barToDate(raw[0])}..${barToDate(raw[raw.length-1])}` : raw.map(b => barToDate(b)).join(',')
          console.log(`[useLiveBars] ${symbol} HISTORICAL focusDate=${focusDate} raw=${raw.length} (${rawDates}) trimmed=${trimmed.length} last=${trimmed.length ? barToDate(trimmed[trimmed.length-1]) : 'none'}`)
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
