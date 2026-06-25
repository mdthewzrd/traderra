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

  useEffect(() => { setDayOffset(0) }, [ticker, date])

  const toggle = (key: keyof ChartSettings) => setSettings(s => ({ ...s, [key]: !s[key] }))
  const applyTemplate = (id: string) => {
    const t = IND_TEMPLATES.find(x => x.id === id)
    if (t) setSettings(s => ({ ...s, ...t.settings }))
  }

  const GOLD = '#D4AF37'
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '2px 9px', fontSize: 10, fontWeight: 700, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${active ? GOLD : '#2a3050'}`,
    background: active ? GOLD + '22' : 'transparent',
    color: active ? GOLD : '#4a6080',
  })
  const navBtn = { background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, width: 22, height: 22, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties

  if (!ticker) {
    return (
      <div style={{ borderTop: '1px solid #1a2030', background: '#070a10', flexShrink: 0, padding: '44px 14px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#4a6080' }}>Click a candidate or signal above to load the chart</span>
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #1a2030', background: '#070a10', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderBottom: '1px solid #111620', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#dde3f0' }}>{ticker}</span>
        <span style={{ fontSize: 10, color: '#4a6080' }}>{date || todayStr()}</span>

        <div style={{ width: 1, height: 16, background: '#1a2030' }} />

        {/* TF buttons */}
        <div style={{ display: 'flex', gap: 3 }}>
          {(['5', '15', '60', 'D'] as Timeframe[]).map(t => (
            <button key={t} onClick={() => setTf(t)} style={btn(tf === t)}>{t === '5' ? '5m' : t === '15' ? '15m' : t === '60' ? '1H' : '1D'}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 16, background: '#1a2030' }} />

        {/* day-by-day offset */}
        <button onClick={() => setDayOffset(d => Math.max(0, d - 1))} title="Back 1 day" style={navBtn}>◀</button>
        <button onClick={() => setDayOffset(d => d + 1)} title="Forward 1 day" style={navBtn}>▶</button>

        <div style={{ width: 1, height: 16, background: '#1a2030' }} />

        {/* indicator templates */}
        <div style={{ display: 'flex', gap: 3 }}>
          {IND_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t.id)} style={{
              padding: '2px 7px', fontSize: 9, fontWeight: 700, borderRadius: 2, cursor: 'pointer', fontFamily: 'inherit',
              border: '1px solid #2a3050', background: 'transparent', color: '#5a6a80',
            }}>{t.name}</button>
          ))}
        </div>

        <button onClick={() => setShowSettings(s => !s)} title="Indicator toggles" style={{
          ...navBtn, background: showSettings ? GOLD + '18' : 'transparent', color: showSettings ? GOLD : '#4a6080',
        }}>⚙</button>

        <a href={`/charts-terminal.html?symbol=${ticker}`} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#4a6080', textDecoration: 'none' }}>↗ full</a>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 14, cursor: 'pointer', padding: '0 4px', marginLeft: 'auto' }}>✕</button>
      </div>

      {/* settings toggles */}
      {showSettings && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '5px 14px', borderBottom: '1px solid #111620' }}>
          {TEMPLATE_IND_KEYS.map(([key, label]) => (
            <button key={key} onClick={() => toggle(key)} style={btn(settings[key])}>{label}</button>
          ))}
        </div>
      )}

      {/* Chart — same ScanMiniChart as /scanner */}
      <div style={{ padding: '0 2px', maxHeight: '46vh', overflow: 'hidden' }}>
        <ScanMiniChart symbol={ticker} tf={tf} date={date || todayStr()} height={440} settings={settings} dark={true} centerOnDate dayOffset={dayOffset} />
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
  const addHits = useCallback((pushed: any, live = true) => {
    const spec = pushed.spec || pushed.meta?.strategy || 'unknown'
    const phase = pushed.meta?.phase || ''
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
      setLiveHits(prev => {
        // dedupe by ticker+strategy: replace if newer phase/checks
        const map = new Map<string, Hit>()
        for (const h of [...incoming, ...prev]) {
          const key = h.ticker + '|' + h.strategy
          if (!map.has(key) || map.get(key)!.receivedAt < h.receivedAt) map.set(key, h)
        }
        return [...map.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 300)
      })
      // Sound: beep only (no toast popups — hits already appear in the panels)
      const isPotential = spec === POTENTIAL
      if (!mutedRef.current && !isPotential) {
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

  // Catch up on missed pushes entering LIVE
  useEffect(() => {
    if (selectedDate !== null) return
    fetch('/api/scans/push?since=0').then(r => r.json()).then(d => {
      (d.scans || []).sort((a: any, b: any) => a.createdAt - b.createdAt).forEach((s: any) => addHits(s))
    }).catch(() => {})
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

  // ── Derived: merge DB + live, group into one section per strategy (deduped) ──
  const sortCands = (a: Hit, b: Hit) => (b.checks_met || 0) - (a.checks_met || 0) || (b.pm_high_pct || 0) - (a.pm_high_pct || 0)
  const allHits: Hit[] = isLive
    ? dedupMerge([...recentCandidates, ...recentSignals], liveHits)
    : dayGroups.flatMap(g => g.hits)

  interface ScanSection { strategy: string; name: string; color: string; isPotential: boolean; hits: Hit[] }
  const sections: ScanSection[] = useMemo(() => {
    const map = new Map<string, Hit[]>()
    for (const h of allHits) {
      if (!map.has(h.strategy)) map.set(h.strategy, [])
      map.get(h.strategy)!.push(h)
    }
    const list: ScanSection[] = [...map.entries()].map(([strategy, hits]) => {
      const isPot = strategy === POTENTIAL
      const sorted = isPot
        ? [...hits].sort(sortCands)
        : [...hits].sort((a, b) => b.date.localeCompare(a.date))
      return { strategy, name: hits[0]?.scanName || strategy, color: colorFor(strategy), isPotential: isPot, hits: sorted }
    })
    // D1 Gap + Potential always first, then by count desc
    const priority = (s: string) => (s === 'd1-gap' ? 0 : s === POTENTIAL ? 1 : 2)
    return list.sort((a, b) => priority(a.strategy) - priority(b.strategy) || b.hits.length - a.hits.length)
  }, [allHits])

  const visibleSections = enabledScans.size === 0 ? sections : sections.filter(s => enabledScans.has(s.strategy))
  const toggleScan = (s: string) => setEnabledScans(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })
  const toggleCollapse = (s: string) => setCollapsedScans(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })

  // ── Row renderers ──
  const S = {
    page: { background: '#070a10', color: '#dde3f0', height: '100vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', fontFamily: 'JetBrains Mono, monospace' },
    hdr: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid #111620', background: '#0a0e16', flexShrink: 0 },
    dot: (on: boolean) => ({ width: 8, height: 8, borderRadius: '50%', background: on ? '#4ade80' : '#ef5350', boxShadow: on ? '0 0 8px #4ade80' : 'none', flexShrink: 0 }) as React.CSSProperties,
    navBtn: { background: 'none', border: '1px solid #2a3050', color: '#8aa0c0', fontSize: 16, width: 28, height: 28, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
    panelHdr: (color: string) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderBottom: '1px solid #111620', background: '#0a0e16', position: 'sticky' as const, top: 0, zIndex: 5 }) as React.CSSProperties,
    row: { display: 'grid', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #0d1118', cursor: 'pointer', transition: 'background .1s', fontSize: 11 } as React.CSSProperties,
  }

  const renderCandidateRow = (h: Hit) => (
    <div key={h.id} style={{ ...S.row, gridTemplateColumns: '1fr 90px 90px 100px 110px', background: chartTicker === h.ticker ? '#0d1828' : 'transparent', borderLeft: `3px solid ${h.checks_met === 5 ? '#4ade80' : h.checks_met === 4 ? '#f59e0b' : '#3a8c4a'}` }}
      onClick={() => selectRow(h)} onDoubleClick={() => openFullChart(h)}
      onMouseEnter={e => { if (chartTicker !== h.ticker) e.currentTarget.style.background = '#0d1220' }}
      onMouseLeave={e => { if (chartTicker !== h.ticker) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ fontWeight: 800, color: '#dde3f0', fontSize: 13 }}>{h.ticker}</span>
      <span style={{ color: (h.pm_high_pct || 0) >= 0.5 ? '#4ade80' : '#8aa0c0', fontWeight: 700, textAlign: 'right' }}>{fmtPct(h.pm_high_pct)}</span>
      <span style={{ color: '#6a7a90', textAlign: 'right' }}>{fmtPct(h.gap)}</span>
      <span style={{ color: '#6a7a90', textAlign: 'right' }}>{fmtVol(h.pm_vol)}</span>
      <span><ChecksDots checks={h.checks} met={h.checks_met} total={h.checks_total} /></span>
    </div>
  )

  const renderSignalRow = (h: Hit) => (
    <div key={h.id} style={{ ...S.row, gridTemplateColumns: '1fr 90px 90px 100px', background: chartTicker === h.ticker ? '#0d1828' : 'transparent', borderLeft: `3px solid ${colorFor(h.strategy)}` }}
      onClick={() => selectRow(h)} onDoubleClick={() => openFullChart(h)}
      onMouseEnter={e => { if (chartTicker !== h.ticker) e.currentTarget.style.background = '#0d1220' }}
      onMouseLeave={e => { if (chartTicker !== h.ticker) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ fontWeight: 800, color: '#dde3f0', fontSize: 13 }}>{h.ticker}</span>
      <span style={{ color: '#6a7a90', textAlign: 'right', fontSize: 11 }}>{h.date ? h.date.slice(5) : ''}</span>
      <span style={{ color: (h.pm_high_pct || 0) >= 0.5 ? '#4ade80' : '#8aa0c0', fontWeight: 700, textAlign: 'right' }}>{fmtPct(h.pm_high_pct || h.gap)}</span>
      <span style={{ color: '#6a7a90', textAlign: 'right' }}>{fmtVol(h.pm_vol || h.volume)}</span>
    </div>
  )

  // One collapsible section per scan. Potential sections show trigger-dot rows; others use date-grouped rows.
  const renderSection = (sec: ScanSection) => {
    const collapsed = collapsedScans.has(sec.strategy)
    const renderRow = sec.isPotential ? renderCandidateRow : renderSignalRow
    // date-grouped body (potential rows are already sorted by checks; date grouping only for signal rows)
    const body: JSX.Element[] = []
    if (!collapsed) {
      if (sec.isPotential) {
        sec.hits.forEach(h => body.push(renderRow(h)))
      } else {
        let lastDate = ''
        sec.hits.forEach((h, idx) => {
          if (h.date !== lastDate) {
            lastDate = h.date
            body.push(<div key={'d-' + sec.strategy + '-' + h.date + '-' + idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 3px', background: '#0c111b', borderTop: '1px solid #111620' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#6a7a90' }}>{fmtDay(h.date)}</span>
              <span style={{ fontSize: 8, color: '#3a4560' }}>{h.date}</span>
            </div>)
          }
          body.push(renderRow(h))
        })
      }
    }
    const cols = sec.isPotential ? '1fr 90px 90px 100px 110px' : '1fr 90px 90px 100px'
    return (
      <div key={sec.strategy} style={{ borderBottom: '1px solid #111620' }}>
        <div onClick={() => toggleCollapse(sec.strategy)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0a0e16', cursor: 'pointer', position: 'sticky', top: 0, zIndex: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sec.color, boxShadow: `0 0 6px ${sec.color}66` }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: sec.color, letterSpacing: 0.5 }}>{sec.name.toUpperCase()}</span>
          <span style={{ fontSize: 9, color: '#3a4560' }}>{sec.isPotential ? '· developing setups' : `· ${sec.hits.length} recent`}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#5a6a80', background: '#111620', padding: '1px 8px', borderRadius: 8 }}>{sec.hits.length}</span>
          <span style={{ fontSize: 10, color: '#4a6080' }}>{collapsed ? '▸' : '▾'}</span>
        </div>
        {!collapsed && <>
          <div style={{ ...S.row, gridTemplateColumns: cols, color: '#2a3550', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid #111620', cursor: 'default' }}>
            {sec.isPotential
              ? <><span>Ticker</span><span style={{ textAlign: 'right' }}>PM Hi%</span><span style={{ textAlign: 'right' }}>Gap</span><span style={{ textAlign: 'right' }}>PM Vol</span><span>Triggers</span></>
              : <><span>Ticker</span><span style={{ textAlign: 'right' }}>Date</span><span style={{ textAlign: 'right' }}>PM Hi%</span><span style={{ textAlign: 'right' }}>PM Vol</span></>
            }
          </div>
          {sec.hits.length === 0
            ? <div style={{ padding: 16, textAlign: 'center', color: '#4a6080', fontSize: 11 }}>No hits.</div>
            : body}
        </>}
      </div>
    )
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.hdr}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#4ade80', letterSpacing: 1 }}>📡 LIVE FEED</span>
        <div style={S.dot(connected && isLive)} />
        <span style={{ fontSize: 9, color: connected && isLive ? '#4ade80' : '#ef5350', fontWeight: 700 }}>
          {isLive ? (connected ? 'LIVE' : 'RECONNECT…') : 'HISTORICAL'}
        </span>
        <span style={{ fontSize: 9, color: '#4a6080', fontWeight: 700 }}>{now > 0 ? fmtTime(now) : '--:--:--'} ET</span>

        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button style={S.navBtn} onClick={goPrevDay} title="Previous trading day">‹</button>
          <input type="date" value={isLive ? '' : (selectedDate || '')} max={now > 0 ? todayStr() : undefined}
            onChange={e => setSelectedDate(e.target.value || null)}
            style={{ background: '#070a10', color: isLive ? '#3a4560' : '#dde3f0', border: `1px solid ${isLive ? '#1e2840' : '#4ade80'}`, borderRadius: 3, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', colorScheme: 'dark' as const }} />
          <button style={{ ...S.navBtn, opacity: isLive ? 0.35 : 1 }} onClick={goNextDay} disabled={isLive} title="Next trading day">›</button>
          <button onClick={goLive} style={{ padding: '4px 12px', fontSize: 10, fontWeight: 800, letterSpacing: 1, borderRadius: 3, cursor: 'pointer', border: `1px solid ${isLive ? '#4ade80' : '#3a4a68'}`, background: isLive ? '#4ade8018' : 'transparent', color: isLive ? '#4ade80' : '#8aa0c0', fontFamily: 'inherit' }}>● LIVE</button>
        </div>
        <button onClick={testPing} title="Test ping" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 3, cursor: 'pointer' }}>TEST</button>
        <button onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: `1px solid ${muted ? '#ef5350' : '#4ade80'}`, color: muted ? '#ef5350' : '#4ade80', fontSize: 13, width: 26, height: 26, borderRadius: 3, cursor: 'pointer' }}>{muted ? '🔇' : '🔊'}</button>
      </div>

      {/* Scan selector bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderBottom: '1px solid #111620', background: '#080c14', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#3a4560', textTransform: 'uppercase', marginRight: 2 }}>Scans:</span>
        <button onClick={() => setEnabledScans(new Set())} style={{ fontSize: 8, fontWeight: 700, color: enabledScans.size === 0 ? '#4ade80' : '#4a6080', background: 'none', border: '1px solid #1e2840', borderRadius: 3, padding: '2px 7px', cursor: 'pointer', fontFamily: 'inherit' }}>ALL</button>
        {sections.map(sec => {
          const on = enabledScans.size === 0 || enabledScans.has(sec.strategy)
          return (
            <button key={sec.strategy} onClick={() => toggleScan(sec.strategy)} style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              borderRadius: 3, padding: '3px 9px', display: 'flex', alignItems: 'center', gap: 5,
              border: `1px solid ${on ? sec.color : '#1e2840'}`,
              background: on ? sec.color + '18' : 'transparent',
              color: on ? sec.color : '#4a6080', opacity: on ? 1 : 0.5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sec.color }} />
              {sec.name}
              <span style={{ fontSize: 8, opacity: 0.7 }}>{sec.hits.length}</span>
            </button>
          )
        })}
      </div>

      {/* Body — one collapsible section per enabled scan */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {dayLoading && !isLive ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4a6080', fontSize: 12 }}>Loading…</div>
        ) : visibleSections.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4a6080', fontSize: 12 }}>No signals for the selected scans{isLive ? '' : ' on this day'}.</div>
        ) : (
          visibleSections.map(renderSection)
        )}
      </div>

      {/* BOTTOM — Chart */}
      <ScanChartPanel ticker={chartTicker} date={chartDate} onClose={() => { setChartTicker(null); setChartDate(null) }} />

    </div>
  )
}
