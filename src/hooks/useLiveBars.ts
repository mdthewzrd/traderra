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

// daysBack sized for EMA(69)+ATR warmup + cycle hysteresis context. 1H is the Lingua
// MTF primary — needs the most history so the cold zone sits far left when panning.
const DAYS_BACK: Record<string, number> = { '2': 8, '5': 15, '15': 60, '60': 220, '120': 350, '240': 500, 'D': 550, 'W': 2000 }
// Warmup buffer (in DAYS) added BEFORE the visible window. Sized per-TF to yield
// ~200 extra bars so every indicator (emaSlow=69, db_72_89=89, Bollinger, ATR) is fully
// seeded by the time the first VISIBLE candle renders. The warmup bars ride in `bars`
// (indicators compute over them) but the chart clamps its leftmost visible bar past
// `visibleFromDate` — they're fetched for seeding, never shown.
const WARMUP_DAYS: Record<string, number> = { '1': 1, '2': 2, '5': 3, '15': 8, '30': 16, '60': 35, '120': 60, '240': 105, 'D': 200, 'W': 1400, 'M': 6000 }

function barToDate(bar: Bar): string {
  if (typeof bar.time === 'string') return bar.time
  return new Date(bar.time * 1000).toISOString().split('T')[0]
}

function computeDateRange(tf: string, focusDate: string) {
  // Fetch a WARMUP buffer (WARMUP_DAYS) BEFORE the visible window so indicators
  // (emaSlow=69, db_72_89=89, Bollinger, ATR) are fully seeded by the first VISIBLE
  // candle. Warmup bars stay in `bars` (indicators compute over them); the chart clamps
  // its leftmost visible bar past `visibleFromDate` so the cold zone is never shown.
  const back = DAYS_BACK[tf] || 30
  const warmup = WARMUP_DAYS[tf] || 30
  const DAY = 24 * 60 * 60 * 1000
  const to = new Date(focusDate + 'T12:00:00')
  const visibleFrom = new Date(to.getTime() - back * DAY)
  const from = new Date(to.getTime() - (back + warmup) * DAY)

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
    visibleFromDate: visibleFrom.toISOString().split('T')[0],
    toDate,
  }
}

export function useLiveBars(symbol: string | null, tf: string, focusDate?: string | null) {
  const liveMode = useUIStore(s => s.liveMode)

  const [bars, setBars] = useState<Bar[]>([])
  const [loading, setLoading] = useState(false)
  const [warmupBars, setWarmupBars] = useState(0)
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
    setWarmupBars(0)
    setLoading(true)

    const params = new URLSearchParams({ symbol, tf })

    // visibleFromDate = first VISIBLE bar's date (warmup bars sit before it). Hoisted
    // so the shared .then() can count how many warmup bars arrived and tell the chart.
    let visibleFromDate = ''
    if (focusDate) {
      const { fromDate, visibleFromDate: vf, toDate } = computeDateRange(tf, focusDate)
      visibleFromDate = vf
      params.set('from', fromDate)
      params.set('to', toDate)
      console.log(`[useLiveBars] ${symbol} tf=${tf} HISTORICAL from=${fromDate} to=${toDate} fetchId=${thisFetchId}`)
    } else {
      // LIVE mode: pass `from` = DAYS_BACK + WARMUP_DAYS so the API fetches our
      // per-TF warmup buffer too (not its hardcoded 30-day default).
      const back = DAYS_BACK[tf] || 30
      const warmup = WARMUP_DAYS[tf] || 30
      const DAY = 24 * 60 * 60 * 1000
      const fromMs = Date.now() - (back + warmup) * DAY
      const visibleMs = Date.now() - back * DAY
      params.set('from', new Date(fromMs).toISOString().split('T')[0])
      visibleFromDate = new Date(visibleMs).toISOString().split('T')[0]
      console.log(`[useLiveBars] ${symbol} tf=${tf} LIVE from=${params.get('from')} (${back}+${warmup}d) fetchId=${thisFetchId}`)
    }

    fetch(`/api/chart-data/bars?${params}`)
      .then(r => r.json())
      .then(data => {
        if (fetchIdRef.current !== thisFetchId) {
          console.log(`[useLiveBars] ${symbol} STALE fetchId=${thisFetchId} current=${fetchIdRef.current} — discarded`)
          return
        }
        const raw: Bar[] = data.bars || data.results || []

        // Keep bars up to focusDate (historical) or all (live). Warmup bars (before
        // visibleFromDate) are KEPT — indicators compute over them; the chart hides them.
        let kept: Bar[]
        if (focusDate) {
          const fd = focusDate.length > 10 ? focusDate.slice(0, 10) : focusDate
          kept = raw.filter(b => barToDate(b) <= fd)
          const rawDates = raw.length > 3 ? `${barToDate(raw[0])}..${barToDate(raw[raw.length-1])}` : raw.map(b => barToDate(b)).join(',')
          console.log(`[useLiveBars] ${symbol} HISTORICAL focusDate=${focusDate} raw=${raw.length} (${rawDates}) kept=${kept.length} last=${kept.length ? barToDate(kept[kept.length-1]) : 'none'}`)
        } else {
          kept = raw
          console.log(`[useLiveBars] ${symbol} LIVE got ${raw.length} bars (last: ${raw.length ? barToDate(raw[raw.length-1]) : 'none'})`)
        }
        // Count warmup bars = bars whose date is before the visible window starts.
        const wb = visibleFromDate ? kept.findIndex(b => barToDate(b) >= visibleFromDate) : 0
        setWarmupBars(wb < 0 ? kept.length : wb)
        setBars(kept)
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

  return { bars, loading, warmupBars, error: null }
}
