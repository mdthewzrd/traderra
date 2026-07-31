'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useChartStore } from '@/stores/charts/chartStore'
import { ScanMiniChart, IND_TEMPLATES, TEMPLATE_IND_KEYS } from '@/app/scanner/page'
import type { ChartSettings, Timeframe } from '@/app/scanner/page'

/**
 * /live-scan — Live scan dashboard, 3 group cards + resizable chart block.
 *
 *   DAY 1s    — D1 Wide, D1 Scan
 *   BACKSIDE  — Backside B
 *   FRONTSIDE — Aparascan, Half A+, Other Half A+, SC DMR, MDR Swing, Short FBO/2
 *
 * Every group has EOD | VALID | RECENT tabs.
 *   VALID  — names that hit d0 metrics during the session (live). Green dot =
 *            phase 'confirmed' = opened valid. All PM hits stay visible (prep).
 *            Only tab that updates live. Past dates = frozen snapshot.
 *   EOD    — potentials (names that closed on the scan that day). ◀ date ▶.
 *   RECENT — valid names across a date range, with a Date column.
 *
 * Chart lives in-flow as a resizable block; scan cards reflow around it.
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
  checks?: Record<string, boolean>
  checks_met?: number
  checks_total?: number
  receivedAt: number
  current?: boolean
  confirmed?: boolean
}

interface ScanDef { spec: string; label: string; color: string }
interface GroupDef {
  key: 'day1s' | 'backside' | 'frontside' | 'gc'
  label: string
  accent: string
  scans: ScanDef[]
}

const GROUPS: GroupDef[] = [
  {
    key: 'day1s', label: 'Day 1s', accent: '#38bdf8',
    scans: [
      { spec: 'd1-gap-wide', label: 'D1 Wide', color: '#38bdf8' },
      { spec: 'd1-gap', label: 'D1 Scan', color: '#ef5350' },
    ],
  },
  {
    key: 'backside', label: 'Backside', accent: '#f59e0b',
    scans: [
      { spec: 'backside-b', label: 'Backside B', color: '#f59e0b' },
    ],
  },
  {
    key: 'frontside', label: 'Frontside', accent: '#a855f7',
    scans: [
      { spec: 'aparascan', label: 'Aparascan', color: '#a855f7' },
      { spec: 'half-a', label: 'Half A+', color: '#ec4899' },
      { spec: 'half-a-other', label: 'Other Half A+', color: '#f472b6' },
      { spec: 'sc-dmr', label: 'SC DMR', color: '#22d3ee' },
      { spec: 'mdr-swing', label: 'MDR Swing', color: '#84cc16' },
      { spec: 'short-fbo', label: 'Short FBO', color: '#fb923c' },
      { spec: 'short-fbo-2', label: 'Short FBO 2', color: '#f97316' },
    ],
  },
  {
    key: 'gc', label: 'D1 PM G&C', accent: '#ef4444',
    scans: [
      { spec: 'real-d1-pm-gc', label: 'G&C', color: '#ef4444' },
    ],
  },
]

const SPEC_LABEL: Record<string, string> = {}
const SPEC_COLOR: Record<string, string> = {}
const SPEC_GROUP: Record<string, string> = {}
for (const g of GROUPS) for (const s of g.scans) {
  SPEC_LABEL[s.spec] = s.label
  SPEC_COLOR[s.spec] = s.color
  SPEC_GROUP[s.spec] = g.key
}
// live potential variants — relaxed candidates pushed live during the session
// (day1s premarket via run_get_d1s.py; backside/frontside intraday via
// live_spec_poller.py). Registered so they (a) pass the live-stream group filter
// at the SSE handler and (b) carry a label/color mapped to their own group.
for (const g of GROUPS) for (const s of g.scans) {
  const p = s.spec + '-potential'
  SPEC_LABEL[p] = s.label
  SPEC_COLOR[p] = s.color
  SPEC_GROUP[p] = g.key
}

// chart widget palette (mirrors /database DARK theme + GOLD accents)
const W = {
  BG: '#08080d', SURFACE: '#0c0c14', SURFACE2: '#10101c', BORDER: '#1a1a2e',
  TEXT: '#e0e0e0', MUTED: '#555570', GOLD: '#D4AF37', GOLD_DIM: 'rgba(212,175,55,0.10)', GOLD_BORDER: 'rgba(212,175,55,0.30)',
}
const TF_OPTIONS: Timeframe[] = ['D', '60', '15', '5']

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
// previous trading day (skip Sat/Sun) — for the D-1 potentials radar
const prevTradingDay = (date: string): string => {
  const d = new Date(date + 'T12:00:00Z')
  do { d.setUTCDate(d.getUTCDate() - 1) } while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  return d.toISOString().slice(0, 10)
}
const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const fmtDateShort = (d: string) => { const dt = new Date(d + 'T12:00:00'); return (dt.getMonth() + 1) + '/' + dt.getDate() }
const shiftDay = (d: string, dir: 1 | -1) => {
  let dt = new Date(d + 'T12:00:00')
  do { dt = new Date(dt.getTime() + dir * 86400000) } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6)
  return dt.toISOString().slice(0, 10)
}
const shiftDays = (d: string, days: number) => {
  let dt = new Date(d + 'T12:00:00')
  const step = days > 0 ? 1 : -1
  let left = Math.abs(days)
  while (left > 0) {
    dt = new Date(dt.getTime() + step * 86400000)
    if (dt.getUTCDay() !== 0 && dt.getUTCDay() !== 6) left--
  }
  return dt.toISOString().slice(0, 10)
}

const BEEP = (freqs: number[], dur: number, vol: number) => {
  try {
    const C = new (window.AudioContext || (window as any).webkitAudioContext)()
    const t = C.currentTime
    freqs.forEach((f, i) => {
      const o = C.createOscillator(), g = C.createGain()
      o.frequency.value = f; o.type = 'sine'
      o.connect(g); g.connect(C.destination)
      g.gain.setValueAtTime(0, t + i * dur)
      g.gain.linearRampToValueAtTime(vol, t + i * dur + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * dur + dur)
      o.start(t + i * dur); o.stop(t + i * dur + dur)
    })
  } catch {}
}

// column grid templates (dot column optional)
// Column grid (fixed widths → header + rows align identically)
const cols = (showValid: boolean) => (showValid ? '18px 56px 92px 50px 50px 54px' : '56px 92px 50px 50px 54px')

// Self-contained clock — owns its own 1s interval so the parent NEVER re-renders
// on clock ticks. (Parent re-render remounts inline child components → scroll reset.)
function Clock() {
  const [t, setT] = useState(0)
  useEffect(() => {
    setT(Date.now())
    const i = setInterval(() => setT(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  return t > 0 ? <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{fmtTime(t)}</span> : null
}

// ── Page ────────────────────────────────────────────────────
// ── Gap Stat Checker (fixed bottom panel) ──
const CAS_LABEL = ['15m c<prior15mLow', '5m c<5mVWAP', '15m c<15mVWAP', '5m 9/20 flip', '5m c<prior5mLow', '15m c<prior5mLow']
const WIN_OPTS = ['1y', '2y', '5y', 'all'] as const
function pct(x: number | null | undefined, d = 0): string { return x == null || isNaN(x) ? '—' : (x * 100).toFixed(d) + '%' }
function GapStatsView({ data }: { data: any }) {
  const a = data.agg50
  const cRow = (ci: number) => { const c = a.cascades[String(ci + 1)]; return `${ci + 1} ${CAS_LABEL[ci]}: ${c.newHod}/${c.fired} (${pct(c.rate)})` }
  const sStat = (label: string, val: any, sub?: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
      <span style={{ color: W.MUTED, fontSize: 11 }}>{label}</span>
      <span style={{ color: W.TEXT, fontSize: 11, fontFamily: 'monospace' }}>{val}{sub ? <span style={{ color: W.MUTED, fontSize: 10 }}> {sub}</span> : null}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      {/* left: aggregate (50% set) */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: W.GOLD, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Aggregate · 50%+ gaps</div>
        {sStat('gap count', `${data.count50}`, `· 20%+: ${data.count20}`)}
        {sStat('fade rate (c<o)', pct(a.fadeRate))}
        {sStat('avg range', `$${a.avgRange.toFixed(2)}`)}
        {sStat('high time avg/med', `${a.avgHighTime || '—'} / ${a.medHighTime || '—'}`, `faded n=${a.fadedN}`)}
        {sStat('low time avg/med', `${a.avgLowTime || '—'} / ${a.medLowTime || '—'}`)}
        {sStat('PMH break', pct(a.pmhBreakFreq), `· +${pct(a.pmhBreakAvgPct, 1)}`)}
        {sStat('fade depth / PDC', pct(a.fadeDepthAvgPct, 1))}
        <div style={{ fontSize: 10, color: W.GOLD, textTransform: 'uppercase', letterSpacing: 0.5, margin: '6px 0 2px' }}>new HOD after trigger</div>
        {[0, 1, 2, 3, 4, 5].map(ci => <div key={ci} style={{ fontSize: 10, fontFamily: 'monospace', color: W.TEXT }}>{cRow(ci)}</div>)}
      </div>
      {/* right: per-date table */}
      <div style={{ flex: 1, overflow: 'auto', maxHeight: 280 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 10, fontFamily: 'monospace', width: '100%' }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: W.BG }}>
              {['Date', 'Gap', 'Real O→C', 'PMH', 'RTH Hi', 'RTH Lo', 'HiT', 'LoT', 'Fade', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map(h =>
                <th key={h} style={{ padding: '3px 5px', textAlign: 'right', color: W.MUTED, borderBottom: `1px solid ${W.BORDER}`, whiteSpace: 'nowrap' }}>{h}</th>)
              }
            </tr>
          </thead>
          <tbody>
            {(data.days as any[]).map(d => (
              <tr key={d.date} style={d.faded ? { background: W.GOLD_DIM } : {}}>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.TEXT, whiteSpace: 'nowrap' }}>{d.date}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: d.g50 ? W.GOLD : W.TEXT }}>{pct(d.gapPct)}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.MUTED, whiteSpace: 'nowrap' }}>${(d.realOpen ?? d.open).toFixed(2)}→${(d.realClose ?? d.close).toFixed(2)}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.MUTED }}>{d.pmh != null ? '$' + d.pmh.toFixed(2) : '—'}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.TEXT }}>{d.rthHigh != null ? '$' + d.rthHigh.toFixed(2) : '—'}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.TEXT }}>{d.rthLow != null ? '$' + d.rthLow.toFixed(2) : '—'}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.MUTED }}>{d.highTime || '—'}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: W.MUTED }}>{d.lowTime || '—'}</td>
                <td style={{ padding: '3px 5px', textAlign: 'right', color: d.close < d.open ? '#f87171' : '#34d399' }}>{d.close < d.open ? '▼' : '▲'}</td>
                {d.c.map((cv: boolean | null, i: number) => (
                  <td key={i} style={{ padding: '3px 5px', textAlign: 'right', color: cv === null ? W.MUTED : cv ? '#34d399' : '#f87171' }}>{cv === null ? '·' : cv ? '✓' : '✗'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
function GapStatChecker() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [ticker, setTicker] = useState('')
  const [win, setWin] = useState<typeof WIN_OPTS[number]>('2y')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const run = async (tk: string, w: string) => {
    const t = (tk || ticker).toUpperCase().trim(); if (!t) return
    setTicker(t); setLoading(true); setError(''); setData(null)
    try {
      const r = await fetch(`/api/gap-stats?ticker=${encodeURIComponent(t)}&window=${w}`)
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'failed'); setData(j)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }
  const hdrBtn = (active: boolean): React.CSSProperties => active ? { fontSize: 10, padding: '2px 8px', borderRadius: 3, color: W.BG, background: W.GOLD, border: 'none', cursor: 'pointer', fontFamily: 'monospace' } : { fontSize: 10, padding: '2px 8px', borderRadius: 3, color: W.MUTED, background: W.SURFACE2, border: `1px solid ${W.BORDER}`, cursor: 'pointer', fontFamily: 'monospace' }
  return (
    <div style={{ width: 380, maxWidth: 400, flexShrink: 0, background: '#0f1623', border: `1px solid ${W.GOLD_BORDER}`, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: open ? `1px solid ${W.BORDER}` : 'none' }}>
        <button onClick={() => setOpen(o => !o)} style={{ fontSize: 12, fontWeight: 600, color: open ? W.GOLD : W.MUTED, background: 'transparent', border: 'none', cursor: 'pointer' }}>🔍 Gap Stat Checker {open ? '▾' : '▸'}</button>
        {open && (<>
          <form onSubmit={e => { e.preventDefault(); run(input, win) }} style={{ display: 'flex', gap: 4 }}>
            <input value={input} onChange={e => setInput(e.target.value.toUpperCase())} placeholder="TICKER" style={{ background: W.SURFACE2, color: W.TEXT, border: `1px solid ${W.BORDER}`, borderRadius: 3, padding: '3px 8px', fontSize: 12, fontFamily: 'monospace', width: 90, textTransform: 'uppercase' }} />
            <button type="submit" style={hdrBtn(true)}>Go</button>
          </form>
          <div style={{ display: 'flex', gap: 2 }}>
            {WIN_OPTS.map(w => <button key={w} onClick={() => { setWin(w); if (ticker) run(ticker, w) }} style={hdrBtn(win === w)}>{w}</button>)}
          </div>
          {ticker && !loading && !error && <span style={{ color: W.MUTED, fontSize: 11, fontFamily: 'monospace' }}>{ticker} · 20%+ {data?.count20 ?? '—'} · 50%+ {data?.count50 ?? '—'}</span>}
        </>)}
      </div>
      {open && (
        <div style={{ padding: '8px 12px' }}>
          {loading && <div style={{ color: W.MUTED, fontSize: 12 }}>Computing gap stats — first lookup fetches years of 5m/15m bars…</div>}
          {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}
          {data && <GapStatsView data={data} />}
        </div>
      )}
    </div>
  )
}

export default function LiveScanPage() {
  const router = useRouter()

  const [scans, setScans] = useState<any[]>([])
  const scanCacheRef = useRef<Map<string, any[]>>(new Map())
  const [resultsVersion, setResultsVersion] = useState(0)

  const liveValidRef = useRef<Map<string, Hit>>(new Map())
  const liveSeenRef = useRef<Map<string, Hit>>(new Map())
  const [liveVersion, setLiveVersion] = useState(0)
  const [connected, setConnected] = useState(false)

  const [eodDate, setEodDate] = useState<string>(todayStr())
  const [validDate, setValidDate] = useState<string>(todayStr())
  const [recentFrom, setRecentFrom] = useState<string>(shiftDays(todayStr(), -14))
  const [recentTo, setRecentTo] = useState<string>(todayStr())

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<Record<string, 'eod' | 'valid' | 'recent'>>({
    day1s: 'valid', backside: 'eod', frontside: 'eod', gc: 'eod',
  })

  // chart (in-flow resizable block)
  const [chartTicker, setChartTicker] = useState<string>('')
  const [chartDate, setChartDate] = useState<string | null>(null)
  const [chartTf, setChartTf] = useState<Timeframe>('D')
  const [chartOpen, setChartOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const visibleHitsRef = useRef<Record<string, Hit[]>>({ day1s: [], backside: [], frontside: [], gc: [] })
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [showInd, setShowInd] = useState(false)
  const [settings, setSettings] = useState<ChartSettings>(() => ({
    showEma9_20: false, showEma72_89: false, showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false, showAnchoredLight: false, showAnchoredMain: false, showKeyLevels: false,
    showVwap: true, showPrevClose: true, showAhPmShade: true,
    showVolume: true, showCrosshair: true, showLegend: false,
    ...IND_TEMPLATES.find(t => t.id === 'mikes-bands')!.settings,
  }))
  const toggleInd = (key: keyof ChartSettings) => setSettings(s => ({ ...s, [key]: !s[key] }))
  const applyTemplate = (id: string) => { const t = IND_TEMPLATES.find(x => x.id === id); if (t) setSettings(s => ({ ...s, ...t.settings })) }

  // static chart canvas height (viewport-based, no observer → no feedback loop)
  const canvasH = Math.max(200, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220)

  const [refreshing, setRefreshing] = useState(false)

  // ── Load scan catalog + all results into cache ──
  const fetchAll = useCallback(async () => {
    try {
      const listRes = await fetch('/api/scans')
      const list = (await listRes.json()).scans || []
      setScans(list)
      await Promise.all(list.map(async (s: any) => {
        if (scanCacheRef.current.has(s.id)) return
        try {
          const r = await fetch(`/api/scans/${s.id}`)
          if (!r.ok) return
          const results = (await r.json()).results || []
          scanCacheRef.current.set(s.id, results)
        } catch {}
      }))
      setResultsVersion(v => v + 1)
    } catch {}
  }, [])

  // manual refresh: clear the cache so fetchAll re-fetches every row
  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    scanCacheRef.current.clear()
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  useEffect(() => {
    fetchAll()
    // Poll the catalog every 60s so newly-backfilled EOD rows appear without a
    // hard reload (fetchAll skips already-cached rows, so this is cheap — one
    // list fetch + results fetch only for new IDs). Without this, /live-scan's
    // EOD/Recent tabs show stale data after backfills push new SavedScan rows.
    const t = setInterval(fetchAll, 60000)
    return () => clearInterval(t)
  }, [fetchAll])

  // SSE — live valid
  const addHits = useCallback((incoming: any, replay = false) => {
    const spec: string = incoming.spec || incoming.meta?.strategy || ''
    if (!spec) return
    const isFull = !!incoming.meta?.fullState
    const results: any[] = incoming.results || []
    const createdAt: number = incoming.createdAt || Date.now()
    if (isFull) {
      const newKeys = new Set<string>()
      for (const x of results) {
        const tk = (x.ticker || '?').toUpperCase()
        const key = `${spec}::${tk}`
        const h: Hit = {
          id: spec + '-' + tk, ticker: tk, date: (x.date || todayStr()).slice(0, 10),
          strategy: spec, scanName: SPEC_LABEL[spec] || spec,
          phase: x.phase || incoming.meta?.phase || '', pm_high_pct: x.pm_high_pct, gap: x.gap,
          pm_vol: x.pm_vol, volume: x.volume, market_cap: x.market_cap, close: x.close, high: x.high,
          prev_close: x.prev_close, checks: x.checks, checks_met: x.checks_met, checks_total: x.checks_total,
          receivedAt: createdAt, current: true,
        }
        liveValidRef.current.set(key, h)
        liveSeenRef.current.set(key, h)
        newKeys.add(key)
      }
      for (const [k, h] of liveValidRef.current) {
        if (h.strategy === spec && !newKeys.has(k)) {
          liveValidRef.current.delete(k)
          if (liveSeenRef.current.has(k)) liveSeenRef.current.get(k)!.current = false
        }
      }
    } else {
      for (const x of results) {
        const tk = (x.ticker || '?').toUpperCase()
        const key = `${spec}::${tk}`
        const h: Hit = {
          id: spec + '-' + tk, ticker: tk, date: (x.date || todayStr()).slice(0, 10),
          strategy: spec, scanName: SPEC_LABEL[spec] || spec,
          phase: x.phase || incoming.meta?.phase || '', pm_high_pct: x.pm_high_pct, gap: x.gap,
          pm_vol: x.pm_vol, volume: x.volume, market_cap: x.market_cap, close: x.close, high: x.high,
          prev_close: x.prev_close, checks: x.checks, checks_met: x.checks_met, checks_total: x.checks_total,
          receivedAt: createdAt, current: true,
        }
        liveValidRef.current.set(key, h)
        liveSeenRef.current.set(key, h)
      }
    }
    setLiveVersion(v => v + 1)
    if (!replay && (incoming.meta?.phase === 'confirmed' || incoming.meta?.phase === 'valid')) {
      BEEP([800, 600], 0.15, 0.3)
    }
  }, [])

  useEffect(() => {
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
  }, [addHits])

  // catchup on mount + every 60s
  useEffect(() => {
    const run = () => fetch('/api/scans/push?since=0').then(r => r.json()).then(d => {
      const latestFull = new Map<string, any>()
      const pings: any[] = []
      for (const s of (d.scans || []).sort((a: any, b: any) => a.createdAt - b.createdAt)) {
        const strat = s.spec || s.meta?.strategy || ''
        if (s.meta?.fullState) latestFull.set(strat, s)
        else pings.push(s)
      }
      pings.forEach(s => addHits(s, true))
      latestFull.forEach(s => addHits(s, true))
    }).catch(() => {})
    run()
    const t = setInterval(run, 60000)
    return () => clearInterval(t)
  }, [addHits])

  const _ = [resultsVersion, liveVersion]

  const specResults = useMemo(() => {
    // Merge results across ALL SavedScan rows of the same strategy (union by
    // ticker+date). scans is newest-first (createdAt desc), so first occurrence
    // of a ticker+date is the freshest state and wins; later rows skipped.
    // This matters for backfills: a small fresh 07-01 row would otherwise be
    // shadowed by an older larger multi-month row → backfilled dates invisible.
    const buckets = new Map<string, Map<string, any>>()
    for (const s of scans) {
      const spec = s.strategy
      if (!SPEC_GROUP[spec]) continue
      const res = scanCacheRef.current.get(s.id) || []
      if (!buckets.has(spec)) buckets.set(spec, new Map())
      const bucket = buckets.get(spec)!
      for (const x of res) {
        const key = `${(x.ticker || '?').toUpperCase()}::${(x.date || '').slice(0, 10)}`
        if (!bucket.has(key)) bucket.set(key, x)
      }
    }
    const m = new Map<string, any[]>()
    for (const [spec, bucket] of buckets) m.set(spec, [...bucket.values()])
    return m
  }, [scans, resultsVersion])

  const resultToHit = useCallback((x: any, spec: string, date: string): Hit => ({
    id: spec + '-' + x.ticker + '-' + date, ticker: (x.ticker || '?').toUpperCase(), date,
    strategy: spec, scanName: SPEC_LABEL[spec] || spec,
    phase: x.phase || '', pm_high_pct: x.pm_high_pct, gap: x.gap, pm_vol: x.pm_vol, volume: x.volume,
    market_cap: x.market_cap, close: x.close, high: x.high, prev_close: x.prev_close,
    checks: x.checks, checks_met: x.checks_met, checks_total: x.checks_total,
    receivedAt: 0,
  }), [])

  const eodHitsFor = useCallback((groupKey: string, date: string) => {
    const out: Hit[] = []
    for (const g of GROUPS) {
      if (g.key !== groupKey) continue
      for (const s of g.scans) {
        const res = specResults.get(s.spec) || []
        for (const x of res) {
          const xd = x.date ? String(x.date).slice(0, 10) : ''
          if (xd === date) out.push(resultToHit(x, s.spec, date))
        }
      }
    }
    return out
  }, [specResults, resultToHit])

  const validHitsFor = useCallback((groupKey: string, date: string) => {
    const today = todayStr()
    if (date >= today) {
      const out: Hit[] = []
      for (const [, h] of liveSeenRef.current) {
        if (SPEC_GROUP[h.strategy] !== groupKey) continue
        if (h.date !== date) continue
        out.push(h)
      }
      // opened-valid (confirmed) first, then by gap
      out.sort((a, b) => Number(b.phase === 'confirmed') - Number(a.phase === 'confirmed') || (b.pm_high_pct || 0) - (a.pm_high_pct || 0))
      return out
    }
    return eodHitsFor(groupKey, date)
  }, [eodHitsFor, liveVersion])

  // Valid tab (backside/frontside): live monitor = overnight radar (potentials
  // stamped D-1) + today's confirmed valids (stamped D0). Confirmed names are
  // flagged confirmed=true → HitRow highlights them (green border + tint + dot);
  // potential-only names on the radar render dimmed. day1s not routed here.
  const validRadarHitsFor = useCallback((groupKey: string, date: string) => {
    const g = GROUPS.find(x => x.key === groupKey)!
    const today = todayStr()
    const radarDate = prevTradingDay(date)
    const byKey = new Map<string, Hit>()
    // seed: radar potentials (confirmed=false), re-tagged to base spec for the box filter
    for (const s of g.scans) {
      const res = specResults.get(s.spec + '-potential') || []
      for (const x of res) {
        const xd = x.date ? String(x.date).slice(0, 10) : ''
        if (xd === radarDate) {
          const h = resultToHit(x, s.spec, date)
          h.confirmed = false
          byKey.set(`${s.spec}::${h.ticker}`, h)
        }
      }
    }
    // overlay: confirmed valids (base spec stamped D0) — live SSE + DB
    const markValid = (h: Hit) => { byKey.set(`${h.strategy}::${h.ticker}`, { ...h, confirmed: true }) }
    if (date >= today) {
      for (const [, h] of liveSeenRef.current) {
        if (SPEC_GROUP[h.strategy] !== groupKey) continue
        markValid(h)
      }
    }
    for (const s of g.scans) {
      const res = specResults.get(s.spec) || []
      for (const x of res) {
        const xd = x.date ? String(x.date).slice(0, 10) : ''
        if (xd === date) markValid(resultToHit(x, s.spec, date))
      }
    }
    const out = [...byKey.values()]
    out.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || (b.pm_high_pct || 0) - (a.pm_high_pct || 0))
    return out
  }, [specResults, resultToHit, liveVersion])

  // Potentials tab. day1s = same-day premarket model (unchanged).
  // backside/frontside = D-1/D0 lifecycle: <spec>-potential stamped on D-1 (EOD
  // close analysis) shown on D0's tab — the overnight radar.
  const potentialHitsFor = useCallback((groupKey: string, date: string) => {
    const out: Hit[] = []
    const byTk = new Map<string, Hit>()
    const add = (h: Hit) => byTk.set(h.ticker, h)
    const g = GROUPS.find(x => x.key === groupKey)!
    if (groupKey === 'day1s') {
      // day1s: <spec>-potential stamped on `date` (DB) + live SSE for today.
      const today = todayStr()
      for (const s of g.scans) {
        const p = s.spec + '-potential'
        const res = specResults.get(p) || []
        for (const x of res) {
          const xd = x.date ? String(x.date).slice(0, 10) : ''
          if (xd === date) add(resultToHit(x, p, date))
        }
      }
      if (date >= today) {
        for (const s of g.scans) {
          const res = specResults.get(s.spec) || []
          for (const x of res) {
            const xd = x.date ? String(x.date).slice(0, 10) : ''
            if (xd === date) add(resultToHit(x, s.spec, date))
          }
        }
        for (const [, h] of liveSeenRef.current) {
          if (SPEC_GROUP[h.strategy] !== groupKey) continue
          if (h.date !== date) continue
          add(h)
        }
      }
    } else {
      // backside/frontside: EOD tab for date D = the EOD close analysis
      // (relaxed radar) run ON date D, stamped D. Navigate to a date → see that
      // date's end-of-day scan. This is the D-1 source: 07-07's EOD radar seeds
      // 07-08's watchlist.
      for (const s of g.scans) {
        const p = s.spec + '-potential'
        const res = specResults.get(p) || []
        for (const x of res) {
          const xd = x.date ? String(x.date).slice(0, 10) : ''
          if (xd === date) add(resultToHit(x, p, date))
        }
      }
    }
    for (const h of byTk.values()) out.push(h)
    out.sort((a, b) => (b.pm_high_pct || 0) - (a.pm_high_pct || 0))
    return out
  }, [specResults, resultToHit, liveVersion])

  const recentHitsFor = useCallback((groupKey: string, from: string, to: string) => {
    const out: Hit[] = []
    for (const g of GROUPS) {
      if (g.key !== groupKey) continue
      for (const s of g.scans) {
        const res = specResults.get(s.spec) || []
        for (const x of res) {
          const xd = x.date ? String(x.date).slice(0, 10) : ''
          if (xd >= from && xd <= to) out.push(resultToHit(x, s.spec, xd))
        }
      }
    }
    out.sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker))
    return out
  }, [specResults, resultToHit])

  const selectRow = (h: Hit) => { setSelectedId(h.id); setChartTicker(h.ticker); setChartDate(h.date); setChartOpen(true) }

  // arrow-key navigation: move up/down through the active group's visible hits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      let gk: string | null = null, idx = -1
      for (const g of GROUPS) {
        const list = visibleHitsRef.current[g.key] || []
        const i = list.findIndex(h => h.id === selectedId)
        if (i >= 0) { gk = g.key; idx = i; break }
      }
      if (!gk) return
      const list = visibleHitsRef.current[gk] || []
      const nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, list.length - 1) : Math.max(idx - 1, 0)
      const next = list[nextIdx]
      if (next && next.id !== selectedId) {
        setSelectedId(next.id); setChartTicker(next.ticker); setChartDate(next.date); setChartOpen(true)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])
  const openFullChart = (h: Hit) => { useChartStore.getState().scanNavigate(h.ticker, h.date || null); router.push('/charts') }

  const isLive = validDate >= todayStr()

  // ── Date nav ──
  const DateNav = ({ date, setDate }: { date: string; setDate: (d: string) => void }) => {
    const [pick, setPick] = useState(false)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <button onClick={() => setDate(shiftDay(date, -1))} style={btnWedge} title="Previous trading day">◀</button>
        <span onClick={() => setPick(p => !p)} style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: 4, background: '#1f2937', fontSize: 12, minWidth: 120, textAlign: 'center' }}>
          {fmtDay(date)}
        </span>
        {pick && (
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setPick(false) }}
            style={{ position: 'absolute', top: 26, left: 30, zIndex: 50, background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 4, padding: 4 }} />
        )}
        <button onClick={() => { const n = shiftDay(date, 1); if (n <= todayStr()) setDate(n) }} disabled={date >= todayStr()} style={{ ...btnWedge, opacity: date >= todayStr() ? 0.3 : 1 }} title="Next trading day">▶</button>
      </div>
    )
  }

  // ── Column header ──
  const HitHeader = ({ showValid = false, showDate = false }: { showValid?: boolean; showDate?: boolean }) => (
    <div style={{ display: 'grid', gridTemplateColumns: cols(showValid), gap: 8, alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #1f2937', fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, background: '#0b1120' }}>
      {showValid && <span />}
      <span>Ticker</span>
      <span>Scan</span>
      <span style={{ textAlign: 'right' }}>Gap</span>
      <span style={{ textAlign: 'right' }}>Vol</span>
      <span style={{ textAlign: 'right' }}>{showDate ? 'Date' : showValid ? 'Time' : 'Chk'}</span>
    </div>
  )

  // ── Hit row ──
  const HitRow = ({ h, showValid = false, showDate = false }: { h: Hit; showValid?: boolean; showDate?: boolean }) => {
    const color = SPEC_COLOR[h.strategy] || '#9ca3af'
    const openedValid = h.confirmed === true || h.phase === 'confirmed'
    const checksStr = h.checks_met !== undefined && h.checks_total !== undefined ? `${h.checks_met}/${h.checks_total}` : ''
    const tail = showDate ? fmtDateShort(h.date) : (showValid && h.receivedAt ? fmtTime(h.receivedAt) : checksStr)
    const sel = h.id === selectedId
    return (
      <div ref={el => { if (el) rowRefs.current.set(h.id, el) }} onClick={() => selectRow(h)} onDoubleClick={() => openFullChart(h)}
        style={{ display: 'grid', gridTemplateColumns: cols(showValid), gap: 8, alignItems: 'center', padding: '5px 8px', cursor: 'pointer', borderBottom: '1px solid #141a26', borderLeft: h.confirmed === true ? '2px solid #22c55e' : '2px solid transparent', fontSize: 12, outline: sel ? '1px solid #D4AF37' : 'none', outlineOffset: -1, opacity: h.confirmed === false ? 0.6 : 1, background: sel ? 'rgba(212,175,55,0.08)' : h.confirmed === true ? 'rgba(34,197,94,0.10)' : 'transparent' }}>
        {showValid && (
          <span title={openedValid ? 'Opened valid' : 'PM hit'} style={{ width: 8, height: 8, borderRadius: '50%', background: openedValid ? '#22c55e' : 'transparent', border: openedValid ? 'none' : '1px solid #374151', boxShadow: openedValid ? '0 0 6px #22c55e' : 'none' }} />
        )}
        <span style={{ fontWeight: 700, color: h.confirmed === false ? '#6b7280' : '#f9fafb' }}>{h.ticker}</span>
        <span style={{ display: 'flex' }}>
          <span style={{ background: color + '33', color, border: `1px solid ${color}66`, borderRadius: 3, padding: '1px 5px', fontSize: 10, whiteSpace: 'nowrap' }}>{h.scanName}</span>
        </span>
        <span style={{ color: h.gap !== undefined ? (h.gap >= 0 ? '#4ade80' : '#f87171') : '#6b7280', textAlign: 'right' }}>{fmtPct(h.gap)}</span>
        <span style={{ color: '#9ca3af', textAlign: 'right' }}>{fmtVol(h.volume || h.pm_vol)}</span>
        <span style={{ color: '#6b7280', textAlign: 'right', fontSize: 11 }}>{tail}</span>
      </div>
    )
  }

  // ── Card header ──
  const CardHeader = ({ title, accent, count, onExpand, expanded }: any) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', borderBottom: '1px solid #1f2937' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 4, height: 14, background: accent, borderRadius: 2 }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#f9fafb' }}>{title}</span>
        <span style={{ background: '#374151', color: '#d1d5db', borderRadius: 8, padding: '0 7px', fontSize: 11 }}>{count}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={refreshAll} disabled={refreshing} title="Refresh all scan data" style={{ background: 'none', border: '1px solid #374151', borderRadius: 4, color: '#9ca3af', padding: '2px 6px', fontSize: 11, cursor: refreshing ? 'wait' : 'pointer', opacity: refreshing ? 0.5 : 1 }}>
          <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
        </button>
        {onExpand && (
          <button onClick={onExpand} title={expanded ? 'Collapse to merged card' : 'Expand to individual scan cards'} style={{ background: 'none', border: '1px solid #374151', borderRadius: 4, color: '#9ca3af', padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}>
            {expanded ? 'groupBy' : 'unfold'}
        </button>
      )}
      </div>
    </div>
  )

  // ── Group card ──
  const GroupCard = ({ group }: { group: GroupDef }) => {
    const isExp = expanded.has(group.key)
    const toggle = () => setExpanded(prev => { const n = new Set(prev); n.has(group.key) ? n.delete(group.key) : n.add(group.key); return n })

    const activeTab = tab[group.key] || 'valid'
    let hits: Hit[] = []
    let showValid = false
    let showDate = false
    // EOD/Potentials tab: potentials for the selected date (day1s same-day;
    // backside/frontside = D-1 radar). Valid tab + Recent use their own readers.
    // gc (D1 PM G&C): potentials-only panel (no valids). Real D1 PM G&C pushes
    // base-spec rows stamped per date (traderra_scan.py _push_results → strategy
    // = spec_name), so source the list from eodHitsFor (not potentialHitsFor,
    // which reads -potential variants no poller pushes for this scan).
    if (group.key === 'gc') hits = eodHitsFor('gc', eodDate)
    else if (activeTab === 'eod') hits = potentialHitsFor(group.key, eodDate)
    else if (activeTab === 'valid') {
      hits = group.key === 'day1s' ? validHitsFor(group.key, validDate) : validRadarHitsFor(group.key, validDate)
      showValid = true
    }
    else { hits = recentHitsFor(group.key, recentFrom, recentTo); showDate = true }
    visibleHitsRef.current[group.key] = hits

    if (isExp) {
      return (
        <div style={{ ...cardStyle, padding: 0 }}>
          <CardHeader title={group.label} accent={group.accent} onExpand={toggle} expanded={isExp} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
            {group.scans.map(s => {
              const isPotentialView = activeTab === 'eod'
              // day1s potentials box shows -potential + confirmed-valid (base spec).
              // backside/frontside potentials box shows only -potential (valids are on
              // the Valid tab).
              const wantSpecs = group.key === 'gc' ? new Set([s.spec])
                : isPotentialView
                ? (group.key === 'day1s' ? new Set([s.spec + '-potential', s.spec]) : new Set([s.spec + '-potential']))
                : new Set([s.spec])
              const sh: Hit[] = hits.filter(h => wantSpecs.has(h.strategy))
              return (
                <div key={s.spec} style={{ background: '#0f1623', border: `1px solid ${s.color}44`, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 200 }}>
                  <div style={{ padding: '6px 10px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#e5e7eb' }}>{s.label}</span>
                    <span style={{ color: '#6b7280', fontSize: 11 }}>{sh.length}</span>
                  </div>
                  <HitHeader showValid={showValid} showDate={showDate} />
                  <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                    {sh.length === 0 ? <Empty /> : sh.map(h => <HitRow key={h.id} h={h} showValid={showValid} showDate={showDate} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div style={cardStyle}>
        <CardHeader title={group.label} accent={group.accent} count={hits.length} onExpand={toggle} expanded={isExp} />
        {/* tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1f2937' }}>
          {((group.key === 'gc' ? ['eod'] : ['eod', 'valid', 'recent']) as Array<'eod' | 'valid' | 'recent'>).map(t => {
            const label = t === 'eod' ? (group.key === 'day1s' || group.key === 'gc' ? 'Potentials' : 'EOD') : t === 'valid' ? 'Valid' : 'Recent'
            const live = t === 'valid' && isLive
            return (
              <button key={t} onClick={() => setTab(p => ({ ...p, [group.key]: t }))}
                style={{ flex: 1, padding: '4px 0', background: activeTab === t ? '#1f2937' : 'transparent', border: 'none', borderBottom: activeTab === t ? `2px solid ${group.accent}` : '2px solid transparent', color: activeTab === t ? '#f9fafb' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {label}
                {live && <span title="Live" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />}
              </button>
            )
          })}
        </div>
        {/* date nav per tab */}
        <div style={{ padding: '4px 12px', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'flex-end', minHeight: 30, alignItems: 'center' }}>
          {activeTab === 'eod' && <DateNav date={eodDate} setDate={setEodDate} />}
          {activeTab === 'valid' && <DateNav date={validDate} setDate={setValidDate} />}
          {activeTab === 'recent' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ca3af' }}>
              <input type="date" value={recentFrom} onChange={e => setRecentFrom(e.target.value)} style={dateInputStyle} />
              <span>→</span>
              <input type="date" value={recentTo} onChange={e => setRecentTo(e.target.value)} style={dateInputStyle} />
            </div>
          )}
        </div>
        <HitHeader showValid={showValid} showDate={showDate} />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {hits.length === 0 ? <Empty /> : hits.map(h => <HitRow key={h.id} h={h} showValid={showValid} showDate={showDate} />)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e14', color: '#e5e7eb', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1f2937', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Live Scan</h1>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{fmtDay(todayStr())}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: connected ? '#22c55e' : '#6b7280' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#22c55e' : '#6b7280', boxShadow: connected ? '0 0 5px #22c55e' : 'none' }} />
            {connected ? 'LIVE' : 'offline'}
          </span>
          <Clock />
        </div>
      </div>

      {/* Body: chart (left half) + single scrollable scan column (right half) */}
      <div style={{ display: 'flex', gap: 12, padding: 16, alignItems: 'stretch', flex: 1, overflow: 'hidden' }}>
        {/* Chart block (60%) — visible by default, placeholder until a name is selected */}
        {chartOpen ? (
          <div style={{ flex: 3, minWidth: 0, height: 'calc(100vh - 90px)', overflow: 'hidden', background: W.BG, border: `1px solid ${W.BORDER}`, borderRadius: 8, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: W.SURFACE, borderBottom: `1px solid ${W.BORDER}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: chartTicker ? W.TEXT : W.MUTED }}>{chartTicker || 'Select a name'}</span>
                <span style={{ fontSize: 11, color: W.MUTED }}>{chartDate && chartTicker ? fmtDay(chartDate) : ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => { useChartStore.getState().scanNavigate(chartTicker, chartDate); router.push('/charts') }} title="Open full chart" style={{ background: 'transparent', border: `1px solid ${W.BORDER}`, color: W.GOLD, borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>↗</button>
                <button onClick={() => setChartOpen(false)} title="Collapse" style={{ background: 'transparent', border: 'none', color: W.MUTED, fontSize: 14, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
            {/* TF buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: `1px solid ${W.BORDER}`, flexShrink: 0 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: W.MUTED }}>Chart</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {TF_OPTIONS.map(t => (
                  <button key={t} onClick={() => setChartTf(t)} style={chartTf === t ? { color: W.BG, background: W.GOLD, border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' } : { color: W.MUTED, background: W.SURFACE2, border: `1px solid ${W.BORDER}`, borderRadius: 3, padding: '2px 8px', fontSize: 10, fontFamily: 'monospace', cursor: 'pointer' }}>{t}</button>
                ))}
              </div>
            </div>
            {/* canvas */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {chartTicker
                ? <ScanMiniChart symbol={chartTicker} tf={chartTf} date={chartDate || todayStr()} height={canvasH} settings={settings} dark={true} dayOffset={chartTf === 'D' ? 6 : 1} compact />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: W.MUTED, fontSize: 13 }}>Select a name from the scan list →</div>
              }
            </div>
            {/* indicator bar */}
            <div style={{ padding: '6px 8px', borderTop: `1px solid ${W.BORDER}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {IND_TEMPLATES.map(tpl => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl.id)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', color: W.MUTED, background: 'transparent', border: `1px solid ${W.BORDER}`, cursor: 'pointer' }}>{tpl.name}</button>
                ))}
                <button onClick={() => setShowInd(s => !s)} style={showInd ? { fontSize: 10, padding: '2px 6px', borderRadius: 3, color: W.GOLD, background: W.GOLD_DIM, border: `1px solid ${W.GOLD_BORDER}`, cursor: 'pointer', marginLeft: 'auto' } : { fontSize: 10, padding: '2px 6px', borderRadius: 3, color: W.MUTED, background: 'transparent', border: `1px solid ${W.BORDER}`, cursor: 'pointer', marginLeft: 'auto' }}>⚙ Ind</button>
              </div>
              {showInd && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4 }}>
                  {TEMPLATE_IND_KEYS.map(([key, label]) => (
                    <button key={key} onClick={() => toggleInd(key)} style={settings[key] ? { fontSize: 10, padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', color: W.GOLD, background: W.GOLD_DIM, border: `1px solid ${W.GOLD_BORDER}`, cursor: 'pointer' } : { fontSize: 10, padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', color: W.MUTED, background: 'transparent', border: `1px solid ${W.BORDER}`, cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : chartTicker ? (
          <button onClick={() => setChartOpen(true)} style={{ flexShrink: 0, background: W.BG, border: `1px solid ${W.BORDER}`, borderRadius: 6, color: W.GOLD, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>📈 {chartTicker}</button>
        ) : null}

        {/* Scan column (40%) — single vertical column, scrolls top→bottom through all 3 groups */}
        <div style={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 90px)', overflowY: 'auto', paddingRight: 4, alignItems: 'center' }}>
          {GROUPS.map(g => <GroupCard key={g.key} group={g} />)}
        </div>
      </div>
    </div>
  )
}

// ── shared styles ──
const cardStyle: React.CSSProperties = {
  background: '#0f1623', border: '1px solid #1f2937', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', width: 'fit-content', minWidth: 320, maxWidth: 400, height: 'calc(100vh - 150px)',
}
const btnWedge: React.CSSProperties = {
  background: '#1f2937', border: '1px solid #374151', borderRadius: 4, color: '#d1d5db',
  width: 26, height: 24, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const dateInputStyle: React.CSSProperties = {
  background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 4, padding: '3px 6px', fontSize: 11,
}
const Empty = () => (
  <div style={{ padding: '32px 12px', textAlign: 'center', color: '#4b5563', fontSize: 12 }}>No names</div>
)
