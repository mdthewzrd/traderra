'use client'

export const dynamic = 'force-dynamic'   // /live-feed evaluates a hook that references an undefined value at build time; skip static prerender

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useChartStore } from '@/stores/charts/chartStore'
import { ScanMiniChart, ChartSettings, Timeframe, IND_TEMPLATES, TEMPLATE_IND_KEYS } from '@/app/scanner/page'

/**
 * /live-feed — Live + historical scan dashboard.
 *
 * Three-zone layout:
 *   LEFT  — Day-of Candidates (d1-gap-potential): developing setups with trigger checklist
 *   RIGHT — Recent Signals (validated scans: d1-gap, aparascan, backside-b, etc.)
 *   BOTTOM — MiniChart: canvas candlestick chart for the clicked ticker
 *
 * Date nav switches between LIVE (SSE stream) and any historical day.
 */

interface Hit {
  id: string
  ticker: string
  date: string
  strategy: string
  scanName: string
  phase: string
  pm_high_pct?: number
  gap?: number
  pm_vol?: number
  volume?: number
  market_cap?: number
  close?: number
  high?: number
  prev_close?: number
  label?: string
  checks?: Record<string, boolean>
  checks_met?: number
  checks_total?: number
  receivedAt: number
}

interface DayGroup {
  scanName: string
  strategy: string
  hits: Hit[]
}

interface ChartBar { time: number; open: number; high: number; low: number; close: number; volume: number }

// ── Helpers ─────────────────────────────────────────────────
const fmtVol = (v?: number) => {
  if (!v && v !== 0) return '-'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return String(Math.round(v))
}
const fmtPct = (v?: number) => (v === undefined || v === null ? '-' : (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%')
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false })
const todayStr = () => new Date().toISOString().slice(0, 10)
const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const shiftDay = (d: string, dir: 1 | -1) => {
  let dt = new Date(d + 'T12:00:00')
  do { dt = new Date(dt.getTime() + dir * 86400000) } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6)
  return dt.toISOString().slice(0, 10)
}

const STRATEGY_COLORS: Record<string, string> = {
  'd1-gap': '#ef5350',
  'd1-gap-potential': '#38bdf8',
  'frd-gap': '#4ade80',
  'frd-gap-lc': '#38bdf8',
  'aparascan': '#a855f7',
  'backside-b': '#f59e0b',
  'short-fbo': '#ec4899',
}
const colorFor = (s: string) => STRATEGY_COLORS[s] || '#8aa0c0'

const POTENTIAL = 'd1-gap-potential'

// Merge a DB baseline with live pushes, deduping by ticker+date (live wins)
function dedupMerge(base: Hit[], live: Hit[]): Hit[] {
  const map = new Map<string, Hit>()
  for (const h of base) map.set(h.ticker + '|' + h.date, h)
  for (const h of live) map.set(h.ticker + '|' + h.date, h)
  return [...map.values()]
}

// Trigger check order + labels for the candidate dots
const CHECK_ORDER = ['pm_high', 'gap', 'open_vs_ph', 'pm_vol', 'prev_close'] as const
const CHECK_LABELS: Record<string, string> = {
  pm_high: 'PM High ≥50%', gap: 'Gap ≥50%', open_vs_ph: 'Open ≥PH+30%',
  pm_vol: 'PM Vol ≥5M', prev_close: 'PDC ≥$0.75',
}

function ChecksDots({ checks, met, total }: { checks?: Record<string, boolean>; met?: number; total?: number }) {
  if (checks) {
    return (
      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }} title={CHECK_ORDER.map(k => `${CHECK_LABELS[k]}: ${checks[k] ? '✓' : '○'}`).join('\n')}>
        {CHECK_ORDER.map(k => (
          <span key={k} style={{ width: 7, height: 7, borderRadius: '50%', background: checks[k] ? '#4ade80' : '#2a3050', flexShrink: 0 }} />
        ))}
      </span>
    )
  }
  // fallback: just show fraction
  if (met !== undefined && total) return <span style={{ fontSize: 10, color: '#4a6080' }}>{met}/{total}</span>
  return null
}

// ── Sound ───────────────────────────────────────────────────
const BEEP = (() => {
  let ctx: AudioContext | null = null
  return (freqs: number[], dur = 0.15, vol = 0.3) => {
    try {
      ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)()
      const t = ctx.currentTime
      freqs.forEach((f, i) => {
        const osc = ctx!.createOscillator()
        const gain = ctx!.createGain()
        osc.connect(gain); gain.connect(ctx!.destination)
        osc.frequency.setValueAtTime(f, t + i * dur)
        gain.gain.setValueAtTime(vol, t + i * dur)
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * dur + dur)
        osc.start(t + i * dur); osc.stop(t + i * dur + dur)
      })
    } catch {}
  }
})()

// ── MiniChart (canvas candlestick) ──────────────────────────
function ScanChartPanel({ ticker, date, onClose }: { ticker: string | null; date: string | null; onClose: () => void }) {
  const [tf, setTf] = useState<Timeframe>('5')
  const mikes = IND_TEMPLATES.find(t => t.id === 'mikes-bands')!.settings
  const [settings, setSettings] = useState<ChartSettings>({
    showEma9_20: false, showEma72_89: false, showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false, showKeyLevels: false,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: false,
    ...mikes, // default to Mike's Bands layout
  })
  const [showSettings, setShowSettings] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  // Measure the chart wrapper so ScanMiniChart fills the row (no fixed height → no dead space)
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const [chartH, setChartH] = useState(400)

  useEffect(() => { setDayOffset(0) }, [ticker, date])
  useEffect(() => {
    const el = chartWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setChartH(el.clientHeight))
    ro.observe(el)
    setChartH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const toggle = (key: keyof ChartSettings) => setSettings(s => ({ ...s, [key]: !s[key] }))
  const applyTemplate = (id: string) => {
    const t = IND_TEMPLATES.find(x => x.id === id)
    if (t) setSettings(s => ({ ...s, ...t.settings }))
  }

  const GOLD = '#D4AF37'
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '2px 9px', fontSize: 10, fontWeight: 700, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? GOLD : '#262626'}`,
    background: active ? GOLD + '22' : 'transparent',
    color: active ? GOLD : '#777777',
  })
  const navBtn = { background: 'none', border: '1px solid #262626', color: '#777777', fontSize: 11, width: 22, height: 22, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties

  if (!ticker) {
    return (
      <div style={{ background: '#0a0a0a', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontSize: 26, opacity: 0.25 }}>📈</span>
        <span style={{ fontSize: 11, color: '#666666' }}>Click a candidate or signal to load the chart</span>
      </div>
    )
  }

  return (
    <div style={{ background: '#0a0a0a', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderBottom: '1px solid #1a1a1a', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#e5e5e5' }}>{ticker}</span>
        <span style={{ fontSize: 10, color: '#666666' }}>{date || todayStr()}</span>

        <div style={{ width: 1, height: 16, background: '#1a1a1a' }} />

        {/* TF buttons */}
        <div style={{ display: 'flex', gap: 3 }}>
          {(['5', '15', '60', 'D'] as Timeframe[]).map(t => (
            <button key={t} onClick={() => setTf(t)} style={btn(tf === t)}>{t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '1H' : '1D'}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: '#1a1a1a' }} />

        {/* day-by-day offset */}
        <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} title="Back 1 day" style={navBtn}>◀</button>
        <button onClick={() => setDayOffset(d => d + 1)} title="Forward 1 day" style={navBtn}>▶</button>

        <div style={{ width: 1, height: 16, background: '#1a1a1a' }} />

        {/* indicator templates */}
        <div style={{ display: 'flex', gap: 3 }}>
          {IND_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t.id)} style={{
              padding: '2px 7px', fontSize: 9, fontWeight: 700, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid #262626', background: 'transparent', color: '#666666',
            }}>{t.name}</button>
          ))}
        </div>

        <button onClick={() => setShowSettings(s => !s)} title="Indicator toggles" style={{
          ...navBtn, background: showSettings ? GOLD + '18' : 'transparent', color: showSettings ? GOLD : '#777777',
        }}>⚙</button>

        <a href={`/charts-terminal.html?symbol=${ticker}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#666666', textDecoration: 'none' }}>↗ full</a>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666666', fontSize: 14, cursor: 'pointer', padding: '0 4px', marginLeft: 'auto' }}>✕</button>
      </div>

      {/* settings toggles */}
      {showSettings && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '5px 14px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
          {TEMPLATE_IND_KEYS.map(([key, label]) => (
            <button key={key} onClick={() => toggle(key)} style={btn(settings[key])}>{label}</button>
          ))}
        </div>
      )}

      {/* Chart — same ScanMiniChart as /scanner. Fills its grid cell (boxy, not a wide band). */}
      <div ref={chartWrapRef} style={{ padding: '0 2px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ScanMiniChart symbol={ticker} tf={tf} date={date || todayStr()} height={chartH} settings={settings} dark={true} centerOnDate dayOffset={dayOffset} />
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────
export default function LiveFeedPage() {
  const router = useRouter()
  const [liveHits, setLiveHits] = useState<Hit[]>([])
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [now, setNow] = useState(0) // 0 = pre-mount placeholder (avoids hydration mismatch)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([])
  const [dayLoading, setDayLoading] = useState(false)
  const [chartTicker, setChartTicker] = useState<string | null>(null)
  const [chartDate, setChartDate] = useState<string | null>(null)
  // LIVE-mode baseline from the DB (recent signals + today's candidates)
  const [recentSignals, setRecentSignals] = useState<Hit[]>([])
  const [recentCandidates, setRecentCandidates] = useState<Hit[]>([])
  // per-strategy view controls
  const [enabledScans, setEnabledScans] = useState<Set<string>>(new Set())  // empty = all enabled
  const [collapsedScans, setCollapsedScans] = useState<Set<string>>(new Set())
  const scanCacheRef = useRef<Map<string, any[]>>(new Map())
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const isLive = selectedDate === null

  // ── SSE hit handler ──
  const knownRef = useRef<Set<string>>(new Set())  // ticker|strategy|date ever seen (beep only for new)
  const addHits = useCallback((pushed: any, live = true, silent = false) => {
    const spec = pushed.spec || pushed.meta?.strategy || 'unknown'
    const phase = pushed.meta?.phase || ''
    const fullState = !!pushed.meta?.fullState
    const incoming: Hit[] = (pushed.results || []).map((r: any, i: number) => ({
      id: pushed.id + '-' + i,
      ticker: r.ticker || r.symbol || '?',
      date: r.date || r.d0_date || '',
      strategy: spec,
      scanName: pushed.name || spec,
      phase: r.phase || phase,
      pm_high_pct: r.pm_high_pct,
      gap: r.gap,
      pm_vol: r.pm_vol,
      market_cap: r.market_cap,
      close: r.close,
      high: r.high,
      prev_close: r.prev_close,
      label: r.label,
      checks: r.checks,
      checks_met: r.checks_met,
      checks_total: r.checks_total,
      receivedAt: pushed.createdAt || Date.now(),
    }))
    if (!incoming.length) return
    if (live) {
      // determine genuinely-new tickers (for the beep) before mutating state
      const isPotential = spec === POTENTIAL
      const newOnes = silent ? [] : incoming.filter(h => {
        const k = h.ticker + '|' + h.strategy + '|' + (h.date || '').slice(0, 10)
        return !knownRef.current.has(k) && (knownRef.current.add(k), true)
      })
      setLiveHits(prev => {
        if (fullState) {
          // authoritative full set for this strategy: replace its hits, keep others
          const others = prev.filter(h => h.strategy !== spec)
          return [...others, ...incoming].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 400)
        }
        // legacy single ping: dedupe by ticker+strategy, keep newest
        const map = new Map<string, Hit>()
        for (const h of [...incoming, ...prev]) {
          const key = h.ticker + '|' + h.strategy
          if (!map.has(key) || map.get(key)!.receivedAt < h.receivedAt) map.set(key, h)
        }
        return [...map.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 400)
      })
      // beep only for genuinely new, non-potential, non-muted (never on fullState replay / catch-up)
      if (!mutedRef.current && !isPotential && !fullState && newOnes.length) {
        BEEP(phase === 'confirmed' ? [880, 1100] : [800, 600], 0.15, 0.35)
      }
    }
    return incoming
  }, [])

  // SSE connection — LIVE mode only
  useEffect(() => {
    if (selectedDate !== null) return
    let es: EventSource | null = null
    let retryT: ReturnType<typeof setTimeout>
    const connect = () => {
      es = new EventSource('/api/scans/stream')
      es.onopen = () => setConnected(true)
      es.onerror = () => { setConnected(false); es?.close(); retryT = setTimeout(connect, 3000) }
      es.addEventListener('scan', (e: MessageEvent) => { try { addHits(JSON.parse(e.data)) } catch {} })
    }
    connect()
    return () => { es?.close(); clearTimeout(retryT) }
  }, [addHits, selectedDate])

  // Clock — seeded post-mount to avoid SSR/client timestamp mismatch (#418)
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  // Catch up on missed pushes entering LIVE — SILENT (replay), repeats every 60s so
  // names that persist on the server buffer reappear after a reload.
  useEffect(() => {
    if (selectedDate !== null) return
    const run = () => fetch('/api/scans/push?since=0').then(r => r.json()).then(d => {
      // dedupe to the latest fullState per strategy + all non-fullState pings
      const latestFull = new Map<string, any>()
      const pings: any[] = []
      for (const s of (d.scans || []).sort((a: any, b: any) => a.createdAt - b.createdAt)) {
        const strat = s.spec || s.meta?.strategy || ''
        if (s.meta?.fullState) latestFull.set(strat, s)
        else pings.push(s)
      }
      pings.forEach(s => addHits(s, true, true))
      latestFull.forEach(s => addHits(s, true, true))
    }).catch(() => {})
    run()
    const t = setInterval(run, 60000)
    return () => clearInterval(t)
  }, [addHits, selectedDate])

  // ── Load historical day ──
  const loadDay = useCallback(async (date: string) => {
    setDayLoading(true); setDayGroups([])
    try {
      const listRes = await fetch('/api/scans')
      const list = (await listRes.json()).scans || []
      const groups: DayGroup[] = []
      for (const s of list) {
        let covers = true
        if (s.dateRange) {
          try {
            const dr = typeof s.dateRange === 'string' ? JSON.parse(s.dateRange) : s.dateRange
            if (dr?.from && dr?.to && (date < dr.from || date > dr.to)) covers = false
          } catch {}
        }
        if (!covers) continue
        let results = scanCacheRef.current.get(s.id)
        if (!results) {
          const r = await fetch(`/api/scans/${s.id}`)
          if (!r.ok) continue
          results = (await r.json()).results || []
          scanCacheRef.current.set(s.id, results)
        }
        const dayHits: Hit[] = results
          .filter((x: any) => { const xd = x.date ? String(x.date).slice(0, 10) : ''; return xd === date })
          .map((x: any, i: number) => ({
            id: s.id + '-' + i, ticker: x.ticker || '?', date,
            strategy: s.strategy || 'unknown', scanName: s.name || s.strategy || '?',
            phase: x.phase || '', pm_high_pct: x.pm_high_pct, gap: x.gap, pm_vol: x.pm_vol, volume: x.volume,
            market_cap: x.market_cap, close: x.close, high: x.high, prev_close: x.prev_close,
            checks: x.checks, checks_met: x.checks_met, checks_total: x.checks_total,
            receivedAt: s.createdAt || Date.now(),
          }))
        if (dayHits.length) groups.push({ scanName: s.name || s.strategy, strategy: s.strategy || 'unknown', hits: dayHits })
      }
      groups.sort((a, b) => b.hits.length - a.hits.length)
      setDayGroups(groups)
    } finally { setDayLoading(false) }
  }, [])

  // ── Load recent signals + today's candidates from DB for LIVE mode baseline ──
  const loadRecent = useCallback(async () => {
    try {
      const listRes = await fetch('/api/scans')
      const list = (await listRes.json()).scans || []
      const today = todayStr()
      let allSigs: Hit[] = []
      let todayCands: Hit[] = []
      let allCands: Hit[] = []
      for (const s of list) {
        let results = scanCacheRef.current.get(s.id)
        if (!results) {
          const r = await fetch(`/api/scans/${s.id}`)
          if (!r.ok) continue
          results = (await r.json()).results || []
          scanCacheRef.current.set(s.id, results)
        }
        const isPot = s.strategy === POTENTIAL
        results.forEach((x: any, i: number) => {
          const h: Hit = {
            id: s.id + '-' + i, ticker: x.ticker || '?', date: (x.date || '').slice(0, 10),
            strategy: s.strategy || 'unknown', scanName: s.name || s.strategy || '?',
            phase: x.phase || '', pm_high_pct: x.pm_high_pct, gap: x.gap, pm_vol: x.pm_vol, volume: x.volume,
            market_cap: x.market_cap, close: x.close, high: x.high, prev_close: x.prev_close,
            checks: x.checks, checks_met: x.checks_met, checks_total: x.checks_total,
            receivedAt: s.createdAt || 0,
          }
          if (isPot) { allCands.push(h); if (h.date === today) todayCands.push(h) }
          else allSigs.push(h)
        })
      }
      // Recent signals: newest date first, top 60
      allSigs.sort((a, b) => b.date.localeCompare(a.date))
      setRecentSignals(allSigs.slice(0, 60))
      // Candidates: prefer today; else most recent available day
      if (todayCands.length) {
        setRecentCandidates(todayCands)
      } else {
        allCands.sort((a, b) => b.date.localeCompare(a.date))
        const latest = allCands[0]?.date
        setRecentCandidates(latest ? allCands.filter(c => c.date === latest) : [])
      }
    } catch {}
  }, [])

  useEffect(() => { if (selectedDate === null) loadRecent() }, [selectedDate, loadRecent])

  useEffect(() => { if (selectedDate) loadDay(selectedDate) }, [selectedDate, loadDay])

  // ── Click handler: load chart in bottom panel ──
  const selectRow = (h: Hit) => { setChartTicker(h.ticker); setChartDate(h.date || selectedDate) }
  const openFullChart = (h: Hit) => { useChartStore.getState().scanNavigate(h.ticker, h.date || null); router.push('/charts') }

  // ── Date nav ──
  const goPrevDay = () => setSelectedDate(d => d === null ? shiftDay(todayStr(), -1) : shiftDay(d, -1))
  const goNextDay = () => setSelectedDate(d => {
    if (d === null) return null
    const next = shiftDay(d, 1); return next >= todayStr() ? null : next
  })
  const goLive = () => setSelectedDate(null)

  const testPing = () => {
    addHits({
      id: 'test-' + Date.now(), name: 'D1 Gap', spec: 'd1-gap',
      meta: { phase: 'confirmed', strategy: 'd1-gap' }, createdAt: Date.now(),
      results: [{ ticker: 'TEST' + Math.floor(Math.random() * 100), date: todayStr(), pm_high_pct: 0.6 + Math.random() * 0.8, gap: 0.5 + Math.random() * 0.5, pm_vol: 5e6 + Math.random() * 5e7, phase: 'confirmed' }],
    })
  }

  // ── Derived: merge DB + live, group into scan rows (d1-gap + potential merge into "D1 Gap") ──
  const sortCands = (a: Hit, b: Hit) => (b.checks_met || 0) - (a.checks_met || 0) || (b.pm_high_pct || 0) - (a.pm_high_pct || 0)
  const allHits: Hit[] = isLive
    ? dedupMerge([...recentCandidates, ...recentSignals], liveHits)
    : dayGroups.flatMap(g => g.hits)

  // Scan grouping: d1-gap + d1-gap-potential merge into one "D1 Gap" row
  const GROUP_OF: Record<string, string> = { 'd1-gap': 'D1 Gap', 'd1-gap-potential': 'D1 Gap' }
  const groupOf = (strategy: string) => GROUP_OF[strategy] || strategy
  const GROUP_COLORS: Record<string, string> = { 'D1 Gap': '#ef5350' }
  const groupColor = (g: string) => GROUP_COLORS[g] || colorFor(g)

  interface ScanRow { group: string; color: string; potential: Hit[]; valid: Hit[]; recent: Hit[] }
  const MAX_COL = 24
  const scanRows: ScanRow[] = useMemo(() => {
    const today = isLive ? todayStr() : (selectedDate || todayStr())
    const byGroup = new Map<string, Hit[]>()
    for (const h of allHits) {
      const g = groupOf(h.strategy)
      if (!byGroup.has(g)) byGroup.set(g, [])
      byGroup.get(g)!.push(h)
    }
    const rows: ScanRow[] = [...byGroup.entries()].map(([group, hits]) => {
      const isDev = (h: Hit) => h.strategy === POTENTIAL && (h.checks_met || 0) < 5
      const potential = hits.filter(h => h.date === today && isDev(h)).sort(sortCands)
      const valid = hits.filter(h => h.date === today && !isDev(h))
        .sort((a, b) => (b.pm_high_pct || 0) - (a.pm_high_pct || 0))
      const recent = hits.filter(h => h.date < today)
        .sort((a, b) => b.date.localeCompare(a.date))
      return { group, color: groupColor(group), potential, valid, recent }
    })
    rows.sort((a, b) => (a.group === 'D1 Gap' ? 0 : 1) - (b.group === 'D1 Gap' ? 0 : 1)
      || (b.potential.length + b.valid.length + b.recent.length) - (a.potential.length + a.valid.length + a.recent.length))
    return rows
  }, [allHits, isLive, selectedDate])

  const visibleRows = enabledScans.size === 0 ? scanRows : scanRows.filter(r => enabledScans.has(r.group))
  const toggleScan = (g: string) => setEnabledScans(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n })
  const toggleCollapse = (g: string) => setCollapsedScans(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n })

  // ── Studio theme tokens (matches globals.css / studio-theme.tsx) ──
  const GOLD = '#D4AF37'
  const S = {
    page: { background: '#0a0a0a', color: '#e5e5e5', minHeight: '100vh', fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties,
    hdr: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid #1a1a1a', background: '#0a0a0a', position: 'sticky' as const, top: 0, zIndex: 20 } as React.CSSProperties,
    dot: (on: boolean) => ({ width: 8, height: 8, borderRadius: '50%', background: on ? '#4ade80' : '#ef5350', boxShadow: on ? '0 0 8px #4ade80' : 'none', flexShrink: 0 }) as React.CSSProperties,
    navBtn: { background: 'none', border: '1px solid #262626', color: '#999999', fontSize: 16, width: 28, height: 28, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  }

  // Compact hit row — adapts to view kind (potential shows trigger dots, valid/recent show pm% / date)
  const renderHitCompact = (h: Hit, kind: 'potential' | 'valid' | 'recent', key: string) => {
    const active = chartTicker === h.ticker
    const hv = {
      onMouseEnter: (e: any) => { if (!active) e.currentTarget.style.background = '#171717' },
      onMouseLeave: (e: any) => { if (!active) e.currentTarget.style.background = 'transparent' },
      onClick: () => selectRow(h), onDoubleClick: () => openFullChart(h),
    }
    const gapColor = (h.gap || 0) >= 0.5 ? '#5eead4' : '#666666'   // teal when at trigger-level
    const pmhColor = (h.pm_high_pct || 0) >= 0.5 ? '#4ade80' : '#777777'
    if (kind === 'potential') return (
      <div key={key} style={{ display: 'grid', alignItems: 'center', gridTemplateColumns: '1fr 44px 44px 78px', padding: '5px 10px', borderBottom: '1px solid #161616', cursor: 'pointer', fontSize: 12, background: active ? '#1f1a0a' : 'transparent', borderLeft: `3px solid ${(h.checks_met || 0) === 5 ? '#4ade80' : (h.checks_met || 0) === 4 ? '#f59e0b' : '#3a8c4a'}` }} {...hv}>
        <span style={{ fontWeight: 800, color: '#e5e5e5' }}>{h.ticker}</span>
        <span style={{ textAlign: 'right', color: gapColor, fontWeight: 700 }} title="Gap (open/prev close − 1)">{fmtPct(h.gap)}</span>
        <span style={{ textAlign: 'right', color: pmhColor, fontWeight: 700 }} title="PM high / prev close − 1">{fmtPct(h.pm_high_pct)}</span>
        <span style={{ display: 'flex', justifyContent: 'flex-end' }}><ChecksDots checks={h.checks} met={h.checks_met} total={h.checks_total} /></span>
      </div>
    )
    return (
      <div key={key} style={{ display: 'grid', alignItems: 'center', gridTemplateColumns: kind === 'valid' ? '1fr 44px 44px 50px' : '1fr 44px 42px 50px', padding: '5px 10px', borderBottom: '1px solid #161616', cursor: 'pointer', fontSize: 12, background: active ? '#1f1a0a' : 'transparent', borderLeft: `3px solid ${colorFor(h.strategy)}` }} {...hv}>
        <span style={{ fontWeight: 800, color: '#e5e5e5' }}>{h.ticker}</span>
        <span style={{ textAlign: 'right', color: gapColor, fontWeight: 700 }} title="Gap (open/prev close − 1)">{fmtPct(h.gap)}</span>
        {kind === 'valid'
          ? <span style={{ textAlign: 'right', color: pmhColor, fontWeight: 700 }} title="PM high / prev close − 1">{fmtPct(h.pm_high_pct)}</span>
          : <span style={{ textAlign: 'right', color: '#666666', fontSize: 10 }}>{h.date ? h.date.slice(5) : ''}</span>}
        <span style={{ textAlign: 'right', color: '#666666' }}>{fmtVol(h.pm_vol || h.volume)}</span>
      </div>
    )
  }

  // ── Per-box view toggle: Potential | Valid | Recent in ONE box (saves width → more boxes fit) ──
  type ViewKind = 'potential' | 'valid' | 'recent'
  const [boxViews, setBoxViews] = useState<Record<string, ViewKind>>({})
  const boxView = (g: string): ViewKind => boxViews[g] || 'potential'
  const setBoxView = (g: string, v: ViewKind) => setBoxViews(prev => ({ ...prev, [g]: v }))

  // One scan = one box. Segmented toggle switches between Potential / Valid / Recent lists.
  const renderScanBox = (row: ScanRow, style?: React.CSSProperties) => {
    const v = boxView(row.group)
    const list = v === 'potential' ? row.potential : v === 'valid' ? row.valid : row.recent
    const SEG: [ViewKind, string, string][] = [['potential', 'POTENTIAL', '#38bdf8'], ['valid', 'VALID', '#4ade80'], ['recent', 'RECENT', '#999999']]
    return (
      <div key={row.group} style={{ background: '#111111', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', ...style }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px 0' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: row.color, boxShadow: `0 0 6px ${row.color}88`, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: row.color, letterSpacing: 0.5 }}>{row.group.toUpperCase()}</span>
          <span style={{ fontSize: 9, color: '#444444', marginLeft: 'auto' }}>{row.potential.length + row.valid.length} today / {row.recent.length} prior</span>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a', marginTop: 5, flexShrink: 0 }}>
          {SEG.map(([kind, label, color]) => {
            const on = v === kind
            const cnt = kind === 'potential' ? row.potential.length : kind === 'valid' ? row.valid.length : row.recent.length
            return (
              <button key={kind} onClick={() => setBoxView(row.group, kind)} style={{
                flex: 1, padding: '5px 4px', fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: 'pointer', fontFamily: 'inherit',
                border: 'none', borderBottom: `2px solid ${on ? color : 'transparent'}`,
                background: on ? color + '14' : 'transparent', color: on ? color : '#555555',
              }}>{label} <span style={{ fontSize: 8, opacity: 0.8 }}>{cnt}</span></button>
            )
          })}
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {list.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: '#333333', fontSize: 10 }}>—</div>
            : list.slice(0, MAX_COL).map((h, i) => renderHitCompact(h, v, row.group + '-' + v + '-' + i))}
          {list.length > MAX_COL && <div style={{ padding: '4px 10px', fontSize: 9, color: '#444444', textAlign: 'center' }}>+{list.length - MAX_COL} more</div>}
        </div>
      </div>
    )
  }

  // Top-4 scans (by today's hits) go into the dashboard grid; the rest go in the list below.
  const top4 = visibleRows.slice(0, 4)
  const rest = visibleRows.slice(4)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.hdr}>
        <span style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: 1 }}>📡 LIVE FEED</span>
        <div style={S.dot(connected && isLive)} />
        <span style={{ fontSize: 9, color: connected && isLive ? '#4ade80' : '#ef5350', fontWeight: 700 }}>
          {isLive ? (connected ? 'LIVE' : 'RECONNECT…') : 'HISTORICAL'}
        </span>
        <span style={{ fontSize: 9, color: '#666666', fontWeight: 700 }}>{now > 0 ? fmtTime(now) : '--:--:--'} ET</span>

        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button style={S.navBtn} onClick={goPrevDay} title="Previous trading day">‹</button>
          <input type="date" value={isLive ? '' : (selectedDate || '')} max={now > 0 ? todayStr() : undefined}
            onChange={e => setSelectedDate(e.target.value || null)}
            style={{ background: '#0a0a0a', color: isLive ? '#444444' : '#e5e5e5', border: `1px solid ${isLive ? '#262626' : GOLD}`, borderRadius: 3, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', colorScheme: 'dark' as const }} />
          <button style={{ ...S.navBtn, opacity: isLive ? 0.35 : 1 }} onClick={goNextDay} disabled={isLive} title="Next trading day">›</button>
          <button onClick={goLive} style={{ padding: '4px 12px', fontSize: 10, fontWeight: 800, letterSpacing: 1, borderRadius: 3, cursor: 'pointer', border: `1px solid ${isLive ? '#4ade80' : '#333333'}`, background: isLive ? '#4ade8018' : 'transparent', color: isLive ? '#4ade80' : '#999999', fontFamily: 'inherit' }}>● LIVE</button>
        </div>
        <button onClick={testPing} title="Test ping" style={{ background: 'none', border: '1px solid #262626', color: '#666666', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 3, cursor: 'pointer' }}>TEST</button>
        <button onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: `1px solid ${muted ? '#ef5350' : '#4ade80'}`, color: muted ? '#ef5350' : '#4ade80', fontSize: 13, width: 26, height: 26, borderRadius: 3, cursor: 'pointer' }}>{muted ? '🔇' : '🔊'}</button>
      </div>

      {/* Scan selector bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#444444', textTransform: 'uppercase', marginRight: 2 }}>Scans:</span>
        <button onClick={() => setEnabledScans(new Set())} style={{ fontSize: 8, fontWeight: 700, color: enabledScans.size === 0 ? GOLD : '#666666', background: 'none', border: `1px solid ${enabledScans.size === 0 ? GOLD : '#262626'}`, borderRadius: 3, padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>ALL</button>
        {scanRows.map(row => {
          const on = enabledScans.size === 0 || enabledScans.has(row.group)
          return (
            <button key={row.group} onClick={() => toggleScan(row.group)} style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              borderRadius: 3, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 5,
              border: `1px solid ${on ? row.color : '#262626'}`,
              background: on ? row.color + '18' : 'transparent',
              color: on ? row.color : '#666666', opacity: on ? 1 : 0.5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: row.color }} />
              {row.group}
              <span style={{ fontSize: 8, opacity: 0.7 }}>{row.potential.length + row.valid.length + row.recent.length}</span>
            </button>
          )
        })}
      </div>

      {/* Body */}
      {dayLoading && !isLive ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#666666', fontSize: 12 }}>Loading…</div>
      ) : visibleRows.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#666666', fontSize: 12 }}>No scans selected{isLive ? '' : ' with hits on this day'}.</div>
      ) : (
        <>
          {/* Dashboard grid: 3 scans top row · chart (2-wide) + scan bottom row · chart cell reserved */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '340px 600px', gap: 8, padding: 8 }}>
            {top4[0] && renderScanBox(top4[0])}
            {top4[1] && renderScanBox(top4[1])}
            {top4[2] && renderScanBox(top4[2])}
            {/* Chart cell — spans 2 columns on row 2; gold border when a ticker is loaded */}
            <div style={{ gridColumn: '1 / span 2', gridRow: 2, background: '#0a0a0a', border: `1px solid ${chartTicker ? GOLD + '55' : '#1a1a1a'}`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              <ScanChartPanel ticker={chartTicker} date={chartDate} onClose={() => { setChartTicker(null); setChartDate(null) }} />
            </div>
            {top4[3] && renderScanBox(top4[3], { gridColumn: 3, gridRow: 2 })}
          </div>

          {/* Scan list — remaining scans below the dashboard */}
          {rest.length > 0 && (
            <div style={{ padding: '4px 8px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 6px 8px' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#666666', letterSpacing: 1 }}>SCAN LIST</span>
                <span style={{ height: 1, flex: 1, background: '#1a1a1a' }} />
                <span style={{ fontSize: 9, color: '#444444' }}>{rest.length} more</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gridAutoRows: '360px', gap: 8 }}>
                {rest.map(row => renderScanBox(row))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
