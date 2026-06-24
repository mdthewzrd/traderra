'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { useChartStore } from '@/stores/charts/chartStore'

/**
 * /live-feed — Live + historical scan dashboard.
 *
 * Two view modes driven by a date navigator:
 *   • LIVE (today): connects to /api/scans/stream (SSE). Every live-poller push
 *     (d1-gap etc.) lands here instantly: card prepended, sound + toast fired.
 *   • DATE (any day ‹ ›): loads that day's hits across ALL persisted SavedScans
 *     (grouped by scan name), so you can browse "what hit on day X" by strategy.
 *
 * Push payload (from /api/scans/push): { id, name, results:[{ticker,date,...}], spec, meta, createdAt }
 * Persisted scans: GET /api/scans (list) + GET /api/scans/[id] (results, has `date` per result)
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
  market_cap?: number
  close?: number
  prev_close?: number
  label?: string
  receivedAt: number
}

interface DayGroup {
  scanName: string
  strategy: string
  hits: Hit[]
}

const fmtVol = (v?: number) => {
  if (!v && v !== 0) return '-'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return String(Math.round(v))
}
const fmtPct = (v?: number) => (v === undefined || v === null ? '-' : (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%')
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour12: false })
const fmtMcap = (v?: number) => {
  if (!v) return '-'
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M'
  return '$' + v
}
const todayStr = () => new Date().toISOString().slice(0, 10)
const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const isWeekend = (d: string) => { const w = new Date(d + 'T12:00:00').getUTCDay(); return w === 0 || w === 6 }
// previous/next trading day (skip Sat/Sun)
const shiftDay = (d: string, dir: 1 | -1) => {
  let dt = new Date(d + 'T12:00:00')
  do { dt = new Date(dt.getTime() + dir * 86400000) } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6)
  return dt.toISOString().slice(0, 10)
}

// Reuses the AudioContext beep convention from AICommentaryPanel.
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
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * dur + dur)
        osc.start(t + i * dur); osc.stop(t + i * dur + dur)
      })
    } catch {}
  }
})()

const STRATEGY_COLORS: Record<string, string> = {
  'd1-gap': '#ef5350',
  'frd-gap': '#4ade80',
  'frd-gap-lc': '#38bdf8',
  'aparascan': '#a855f7',
  'backside-b': '#f59e0b',
  'short-fbo': '#ec4899',
}
const colorFor = (s: string) => STRATEGY_COLORS[s] || '#8aa0c0'

export default function LiveFeedPage() {
  const router = useRouter()
  const [liveHits, setLiveHits] = useState<Hit[]>([])
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [stratFilter, setStratFilter] = useState<string>('all')
  const [now, setNow] = useState(Date.now())

  // ── Calendar / historical view state ──
  const [selectedDate, setSelectedDate] = useState<string | null>(null) // null = LIVE
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([])
  const [dayLoading, setDayLoading] = useState(false)
  const scanCacheRef = useRef<Map<string, any[]>>(new Map()) // scanId -> results

  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const strategies = Array.from(new Set(liveHits.map(h => h.strategy))).filter(Boolean)

  const addHits = useCallback((pushed: any, live = true) => {
    const spec = pushed.meta?.strategy || pushed.spec || 'unknown'
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
      prev_close: r.prev_close,
      label: r.label,
      receivedAt: pushed.createdAt || Date.now(),
    }))
    if (!incoming.length) return
    if (live) {
      setLiveHits(prev => [...incoming, ...prev].slice(0, 200))
      if (!mutedRef.current) BEEP(phase === 'confirmed' ? [880, 1100] : [800, 600], 0.15, 0.35)
      const top = incoming[0]
      toast.success(`🔔 ${top.ticker} ${fmtPct(top.pm_high_pct)} pm`, {
        description: `${top.scanName} · ${phase || top.date}`,
        duration: 8000,
      })
    }
    return incoming
  }, [])

  // SSE connection — only in LIVE mode
  useEffect(() => {
    if (selectedDate !== null) return // historical mode: no SSE
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

  // Clock
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  // Catch up on missed live pushes on entering LIVE mode
  useEffect(() => {
    if (selectedDate !== null) return
    fetch('/api/scans/push?since=0').then(r => r.json()).then(d => {
      (d.scans || []).sort((a: any, b: any) => a.createdAt - b.createdAt).forEach((s: any) => addHits(s))
    }).catch(() => {})
  }, [addHits, selectedDate])

  // ── Load historical hits for a day, grouped by scan name ──
  const loadDay = useCallback(async (date: string) => {
    setDayLoading(true); setDayGroups([])
    try {
      const listRes = await fetch('/api/scans')
      const list = (await listRes.json()).scans || []
      const groups: DayGroup[] = []
      for (const s of list) {
        // skip scans whose declared range excludes this day (when range known)
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
          const det = await r.json()
          results = det.results || []
          scanCacheRef.current.set(s.id, results)
        }
        const dayHits: Hit[] = results
          .filter((x: any) => {
            const xd = x.date ? String(x.date).slice(0, 10) : ''
            return xd === date
          })
          .map((x: any, i: number) => ({
            id: s.id + '-' + i,
            ticker: x.ticker || x.symbol || '?',
            date,
            strategy: s.strategy || 'unknown',
            scanName: s.name || s.strategy || 'unknown',
            phase: x.phase || '',
            pm_high_pct: x.pm_high_pct,
            gap: x.gap,
            pm_vol: x.pm_vol,
            market_cap: x.market_cap,
            close: x.close,
            prev_close: x.prev_close,
            label: x.label,
            receivedAt: s.createdAt || Date.now(),
          }))
        if (dayHits.length) groups.push({ scanName: s.name || s.strategy, strategy: s.strategy || 'unknown', hits: dayHits })
      }
      groups.sort((a, b) => b.hits.length - a.hits.length)
      setDayGroups(groups)
    } finally { setDayLoading(false) }
  }, [])

  useEffect(() => { if (selectedDate) loadDay(selectedDate) }, [selectedDate, loadDay])

  const openChart = useCallback((h: Hit) => {
    useChartStore.getState().scanNavigate(h.ticker, h.date || null)
    router.push('/charts')
  }, [router])

  const testPing = () => {
    addHits({
      id: 'test-' + Date.now(), name: 'D1 Gap', spec: 'd1-gap',
      meta: { phase: 'premarket', strategy: 'd1-gap' }, createdAt: Date.now(),
      results: [{
        ticker: ['TEST', 'FAKE', 'PING'][Math.floor(Math.random() * 3)],
        date: new Date().toISOString().slice(0, 10),
        pm_high_pct: 0.6 + Math.random() * 0.8, gap: 0.5 + Math.random() * 0.5,
        pm_vol: 5e6 + Math.random() * 5e7, market_cap: 5e7 + Math.random() * 3e8,
        phase: 'premarket', label: 'test ping',
      }],
    })
  }

  // ── Date nav handlers ──
  const isLive = selectedDate === null
  const goPrevDay = () => setSelectedDate(d => d === null ? shiftDay(todayStr(), -1) : shiftDay(d, -1))
  const goNextDay = () => {
    setSelectedDate(d => {
      if (d === null) return null
      const next = shiftDay(d, 1)
      return next >= todayStr() ? null : next // reach today → switch to LIVE
    })
  }
  const goLive = () => setSelectedDate(null)

  const S = {
    page: { background: '#070a10', color: '#dde3f0', minHeight: '100vh', fontFamily: 'JetBrains Mono, monospace' } as React.CSSProperties,
    hdr: { position: 'sticky' as const, top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #111620', background: '#0a0e16', backdropFilter: 'blur(8px)' },
    dot: (on: boolean) => ({ width: 8, height: 8, borderRadius: '50%', background: on ? '#4ade80' : '#ef5350', boxShadow: on ? '0 0 8px #4ade80' : 'none', flexShrink: 0 }) as React.CSSProperties,
    chip: (active: boolean, color: string) => ({ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 10, fontWeight: 700, letterSpacing: 0.5, borderRadius: 3, cursor: 'pointer', border: `1px solid ${active ? color : '#1e2840'}`, background: active ? color + '18' : 'transparent', color: active ? color : '#4a6080', textTransform: 'uppercase' as const }),
    card: (phase: string) => ({ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #111620', cursor: 'pointer', borderLeft: `3px solid ${phase === 'confirmed' ? '#4ade80' : '#f59e0b'}`, transition: 'background .12s' }) as React.CSSProperties,
    metric: { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', minWidth: 64 } as React.CSSProperties,
    ml: { fontSize: 9, color: '#3a4560', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const },
    mv: { fontSize: 13, fontWeight: 700 },
    navBtn: { background: 'none', border: '1px solid #2a3050', color: '#8aa0c0', fontSize: 16, width: 30, height: 30, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  }

  // ── Render a hit row (shared by live + historical) ──
  const renderHit = (h: Hit) => (
    <div key={h.id} style={S.card(h.phase)} onClick={() => openChart(h)}
      onMouseOver={e => (e.currentTarget.style.background = '#0d1220')}
      onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
      <div style={{ minWidth: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#dde3f0' }}>{h.ticker}</span>
          {h.phase && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 2, color: '#000', background: h.phase === 'confirmed' ? '#4ade80' : '#f59e0b', letterSpacing: 0.5 }}>{h.phase}</span>}
        </div>
        <div style={{ fontSize: 10, color: colorFor(h.strategy), fontWeight: 700, marginTop: 2 }}>{h.scanName}</div>
      </div>
      <div style={S.metric}><span style={S.ml}>PM HI</span><span style={{ ...S.mv, color: '#ef5350', fontSize: 16 }}>{fmtPct(h.pm_high_pct)}</span></div>
      <div style={S.metric}><span style={S.ml}>GAP</span><span style={{ ...S.mv, color: '#ef5350' }}>{fmtPct(h.gap)}</span></div>
      <div style={S.metric}><span style={S.ml}>PM VOL</span><span style={{ ...S.mv, color: '#8aa0c0' }}>{fmtVol(h.pm_vol)}</span></div>
      <div style={S.metric}><span style={S.ml}>MCAP</span><span style={{ ...S.mv, color: '#8aa0c0', fontSize: 11 }}>{fmtMcap(h.market_cap)}</span></div>
      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700 }}>{isLive ? fmtTime(h.receivedAt) : h.date}</div>
        <div style={{ fontSize: 9, color: '#3a4560' }}>↗ chart</div>
      </div>
    </div>
  )

  const dayTotal = dayGroups.reduce((n, g) => n + g.hits.length, 0)

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.hdr}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#4ade80', letterSpacing: 1 }}>📡 LIVE FEED</span>
        <div style={S.dot(connected && isLive)} />
        <span style={{ fontSize: 10, color: connected && isLive ? '#4ade80' : '#ef5350', fontWeight: 700 }}>
          {isLive ? (connected ? 'CONNECTED' : 'RECONNECTING…') : 'HISTORICAL'}
        </span>

        {isLive && (
          <div style={{ display: 'flex', gap: 5, marginLeft: 16 }}>
            <button style={S.chip(stratFilter === 'all', '#8aa0c0')} onClick={() => setStratFilter('all')}>ALL {liveHits.length}</button>
            {strategies.map(s => (
              <button key={s} style={S.chip(stratFilter === s, colorFor(s))} onClick={() => setStratFilter(s)}>
                {s} {liveHits.filter(h => h.strategy === s).length}
              </button>
            ))}
          </div>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4a6080', fontWeight: 700 }}>
          {new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {fmtTime(now)} ET
        </span>
        <button onClick={testPing} title="Send test ping" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 3, cursor: 'pointer' }}>TEST</button>
        <button onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: `1px solid ${muted ? '#ef5350' : '#4ade80'}`, color: muted ? '#ef5350' : '#4ade80', fontSize: 14, width: 26, height: 26, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Date navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #111620', background: '#0a0e16' }}>
        <button style={{ ...S.navBtn, opacity: 0.5 }} title="Previous trading day" onClick={goPrevDay}>‹</button>
        <button
          onClick={goLive}
          style={{
            flex: 0, padding: '6px 18px', fontSize: 12, fontWeight: 800, letterSpacing: 1, borderRadius: 3, cursor: 'pointer',
            border: `1px solid ${isLive ? '#4ade80' : '#3a4a68'}`,
            background: isLive ? '#4ade8018' : 'transparent',
            color: isLive ? '#4ade80' : '#8aa0c0',
            fontFamily: 'JetBrains Mono, monospace',
          }}
          title={isLive ? 'Live mode' : 'Click to return to LIVE'}
        >
          {isLive ? '● LIVE' : `📅 ${fmtDay(selectedDate!)}`}
        </button>
        <button style={{ ...S.navBtn, opacity: isLive ? 0.35 : 1, cursor: isLive ? 'not-allowed' : 'pointer' }} title="Next trading day" onClick={goNextDay} disabled={isLive}>›</button>
        <span style={{ fontSize: 10, color: '#3a4560', marginLeft: 8 }}>
          {isLive ? 'flip ‹ to browse past days' : `${dayLoading ? 'loading…' : dayTotal + ' hits across ' + dayGroups.length + ' scan' + (dayGroups.length === 1 ? '' : 's')}`}
        </span>
      </div>

      {/* Body */}
      {isLive ? (
        // ── LIVE view ──
        liveHits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#4a6080' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Waiting for live hits…</div>
            <div style={{ fontSize: 11, color: '#3a4560' }}>Live pollers push here the moment a name triggers. Hit TEST to verify sound.</div>
          </div>
        ) : (
          <div>{(stratFilter === 'all' ? liveHits : liveHits.filter(h => h.strategy === stratFilter)).map(renderHit)}</div>
        )
      ) : (
        // ── HISTORICAL day view, grouped by scan name ──
        dayLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#4a6080', fontSize: 12 }}>Loading {fmtDay(selectedDate!)}…</div>
        ) : dayGroups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#4a6080' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🌑</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>No signals on {fmtDay(selectedDate!)}</div>
            <div style={{ fontSize: 11, color: '#3a4560', marginTop: 4 }}>No persisted scan fired that day. Use ‹ › to check other days.</div>
          </div>
        ) : (
          <div>
            {dayGroups.map(g => (
              <div key={g.scanName + g.strategy}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#0a0e16', borderBottom: '1px solid #111620', borderTop: '1px solid #111620' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorFor(g.strategy), display: 'inline-block' }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: colorFor(g.strategy), letterSpacing: 0.5, textTransform: 'uppercase' }}>{g.scanName}</span>
                  <span style={{ fontSize: 10, color: '#3a4560' }}>· {g.hits.length} hit{g.hits.length === 1 ? '' : 's'}</span>
                </div>
                {g.hits.map(renderHit)}
              </div>
            ))}
          </div>
        )
      )}

      <Toaster position="top-right" theme="dark" richColors closeButton />
    </div>
  )
}
