'use client'
/**
 * Self-contained Lingua Exec backtest panel for the /backtest page.
 * Calls POST /api/backtest/lingua-exec (which runs the engine in
 * src/lib/backtest/lingua-exec-bt.ts). Renders stats, equity curve,
 * exit-label breakdown, and trade ledger. Kept decoupled from the
 * scan-signal page internals.
 */
import { useState, useMemo, useEffect } from 'react'
import { computeStats, type LEBTrade, type LEBStats } from '@/lib/backtest/lingua-exec-bt'

const C = {
  BG: '#0a0d14', SURFACE: '#0f1320', SURFACE2: '#161b2a', BORDER: '#1e2840',
  TEXT: '#dde3f0', MUTED: '#8aa0c0', GOLD: '#f59e0b', TEAL: '#14b8a6',
  GREEN: '#26a69a', RED: '#ef5350', GRID: '#161b2a',
}

const input: React.CSSProperties = {
  background: C.BG, border: `1px solid ${C.BORDER}`, color: C.TEXT,
  borderRadius: 3, padding: '4px 6px', fontSize: 11, width: '100%',
}
const lbl: React.CSSProperties = { fontSize: 8, color: C.MUTED, fontWeight: 700, letterSpacing: 1, marginBottom: 3 }

function windowFor(date: string, tf: string): { from: string; to: string } {
  const d = new Date(date + 'T12:00:00')
  const from = new Date(d), to = new Date(d)
  const back = tf === '5' ? 5 : tf === '15' ? 10 : tf === '30' ? 20 : tf === '60' ? 50 : tf === '240' ? 120 : tf === 'D' ? 400 : 60
  from.setDate(from.getDate() - back); to.setDate(to.getDate() + 5)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function LinguaExecPanel({
  dark = true, signals = [], selectedSignal,
}: {
  dark?: boolean
  signals?: { ticker: string; date: string }[]
  selectedSignal?: { ticker: string; date: string }
}) {
  const [cfg, setCfg] = useState({ symbol: 'SPY', tf: '60', from: '2024-03-27', to: '2026-06-18' })
  const [adv, setAdv] = useState({
    fast: 50, slow: 89, regimeHold: 2,
    entryMultDn: 3.9, tightDn: 3.6, addFreedMin: 0.2, recycleMult: 6.0,
  })
  const [showAdv, setShowAdv] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [data, setData] = useState<{ trades: LEBTrade[]; stats: LEBStats; barCount: number } | null>(null)

  // ── subset iteration: run the engine over several scan signals and aggregate ──
  const [subset, setSubset] = useState<string[]>([])
  const [aggLoading, setAggLoading] = useState(false)
  const [aggProgress, setAggProgress] = useState('')
  const [agg, setAgg] = useState<{ trades: LEBTrade[]; stats: LEBStats; names: number; bars: number } | null>(null)

  // default the subset to the selected signal (single = default; check more to expand)
  useEffect(() => {
    if (selectedSignal) setSubset([`${selectedSignal.ticker}|${selectedSignal.date}`])
  }, [selectedSignal?.ticker, selectedSignal?.date])

  const run = async () => {
    setLoading(true); setErr(''); setData(null)
    try {
      const res = await fetch('/api/backtest/lingua-exec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, params: adv }),
      })
      const j = await res.json()
      if (j.error) { setErr(j.error); setLoading(false); return }
      setData({ trades: j.trades, stats: j.stats, barCount: j.barCount })
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }

  // run engine over every checked subset signal, aggregate trades+stats
  const runSubset = async () => {
    const picks = subset.map(k => { const [ticker, date] = k.split('|'); return { ticker, date } })
      .filter(p => p.ticker && p.date)
    if (!picks.length) { setErr('Select at least one signal'); return }
    setAggLoading(true); setErr(''); setAgg(null); setAggProgress(`0/${picks.length}…`)
    const allTrades: LEBTrade[] = []
    let bars = 0, okCount = 0
    for (let i = 0; i < picks.length; i++) {
      const p = picks[i]
      setAggProgress(`${i + 1}/${picks.length} · ${p.ticker}`)
      try {
        const res = await fetch('/api/backtest/lingua-exec', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: p.ticker, tf: cfg.tf, ...windowFor(p.date, cfg.tf), params: adv }),
        })
        const j = await res.json()
        if (!j.error) { allTrades.push(...j.trades); bars += j.barCount || 0; okCount++ }
      } catch { /* skip individual failures */ }
    }
    setAggLoading(false); setAggProgress('')
    if (!allTrades.length) { setErr('No trades across subset'); return }
    setAgg({ trades: allTrades, stats: computeStats(allTrades), names: okCount, bars })
  }

  const eq = useMemo(() => {
    if (!data) return [] as number[]
    let c = 0; return data.trades.map(t => (c += t.tradeR))
  }, [data])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.BG, color: C.TEXT }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.BORDER}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: C.GREEN, fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>⚡ LINGUA EXEC</span>
        <span style={{ color: C.MUTED, fontSize: 10 }}>50/89 pullback engine · long-only · server-side</span>
        <button onClick={() => setShowAdv(s => !s)} style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer', background: showAdv ? `${C.GOLD}20` : C.SURFACE2, color: C.GOLD, border: `1px solid ${C.GOLD}40` }}>⚙ PARAMS</button>
      </div>

      {/* Config row */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.BORDER}`, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><div style={lbl}>SYMBOL</div><input style={input} value={cfg.symbol} onChange={e => setCfg(c => ({ ...c, symbol: e.target.value.toUpperCase() }))} /></div>
        <div>
          <div style={lbl}>TIMEFRAME</div>
          <select style={input} value={cfg.tf} onChange={e => setCfg(c => ({ ...c, tf: e.target.value }))}>
            <option value="5">5m</option><option value="15">15m</option><option value="30">30m</option>
            <option value="60">1H</option><option value="240">4H</option><option value="D">Daily</option><option value="W">Weekly</option>
          </select>
        </div>
        <div><div style={lbl}>FROM</div><input style={input} value={cfg.from} onChange={e => setCfg(c => ({ ...c, from: e.target.value }))} /></div>
        <div><div style={lbl}>TO</div><input style={input} value={cfg.to} onChange={e => setCfg(c => ({ ...c, to: e.target.value }))} /></div>
        {selectedSignal && (
          <button title="Sync symbol + window to the selected scan signal" onClick={() => setCfg(c => ({ ...c, symbol: selectedSignal.ticker.toUpperCase(), ...windowFor(selectedSignal.date, c.tf) }))} style={{ background: C.SURFACE2, color: C.TEAL, border: `1px solid ${C.TEAL}40`, fontSize: 10, fontWeight: 700, padding: '6px 10px', borderRadius: 4, cursor: 'pointer' }}>⚓ SIGNAL</button>
        )}
        <button onClick={run} disabled={loading} style={{ background: loading ? C.SURFACE2 : C.GREEN, color: '#000', border: 'none', fontSize: 11, fontWeight: 800, padding: '6px 16px', borderRadius: 4, cursor: loading ? 'wait' : 'pointer' }}>{loading ? '⏳ RUNNING…' : '⚡ RUN'}</button>
      </div>

      {/* Advanced params */}
      {showAdv && (
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.BORDER}`, display: 'flex', gap: 10, flexWrap: 'wrap', background: C.SURFACE }}>
          <div><div style={lbl}>FAST EMA</div><input type="number" step="1" style={input} value={adv.fast} onChange={e => setAdv(a => ({ ...a, fast: parseInt(e.target.value) || 0 }))} /></div>
        <div><div style={lbl}>SLOW EMA</div><input type="number" step="1" style={input} value={adv.slow} onChange={e => setAdv(a => ({ ...a, slow: parseInt(e.target.value) || 0 }))} /></div>
        <div><div style={lbl}>REGIME HOLD</div><input type="number" step="1" style={input} value={adv.regimeHold} onChange={e => setAdv(a => ({ ...a, regimeHold: parseInt(e.target.value) || 0 }))} /></div>
        <div><div style={lbl}>ENTRY1 STOP MULT</div><input type="number" step="0.1" style={input} value={adv.entryMultDn} onChange={e => setAdv(a => ({ ...a, entryMultDn: parseFloat(e.target.value) || 0 }))} /></div>
          <div><div style={lbl}>ADD STOP MULT</div><input type="number" step="0.1" style={input} value={adv.tightDn} onChange={e => setAdv(a => ({ ...a, tightDn: parseFloat(e.target.value) || 0 }))} /></div>
          <div><div style={lbl}>ADD FREED MIN</div><input type="number" step="0.05" style={input} value={adv.addFreedMin} onChange={e => setAdv(a => ({ ...a, addFreedMin: parseFloat(e.target.value) || 0 }))} /></div>
          <div><div style={lbl}>RECYCLE MULT</div><input type="number" step="0.5" style={input} value={adv.recycleMult} onChange={e => setAdv(a => ({ ...a, recycleMult: parseFloat(e.target.value) || 0 }))} /></div>
        </div>
      )}

      {/* ── Subset iteration over the scan universe ── */}
      {signals.length > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${C.BORDER}`, background: C.SURFACE, maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ ...lbl, marginBottom: 0 }}>SUBSET · {subset.length}/{signals.length} PICKED</span>
            <button onClick={() => setSubset(signals.map(s => `${s.ticker}|${s.date}`))} style={{ fontSize: 8, color: C.MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>all</button>
            <button onClick={() => setSubset(selectedSignal ? [`${selectedSignal.ticker}|${selectedSignal.date}`] : [])} style={{ fontSize: 8, color: C.MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>selected</button>
            <button onClick={() => setSubset([])} style={{ fontSize: 8, color: C.MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>clear</button>
            <button onClick={runSubset} disabled={aggLoading || subset.length === 0} style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 3, cursor: aggLoading ? 'wait' : 'pointer', background: aggLoading ? C.SURFACE2 : C.TEAL, color: '#000', border: 'none' }}>{aggLoading ? `⏳ ${aggProgress}` : `▶ RUN ${subset.length}`}</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {signals.slice(0, 200).map(s => {
              const k = `${s.ticker}|${s.date}`
              const on = subset.includes(k)
              return (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, cursor: 'pointer', padding: '2px 6px', borderRadius: 3, background: on ? `${C.TEAL}20` : 'transparent', border: `1px solid ${on ? C.TEAL : C.BORDER}`, color: on ? C.TEAL : C.MUTED }}>
                  <input type="checkbox" checked={on} onChange={() => setSubset(prev => on ? prev.filter(x => x !== k) : [...prev, k])} style={{ display: 'none' }} />
                  {s.ticker} <span style={{ opacity: 0.6 }}>{s.date.slice(5)}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {err && <div style={{ padding: '10px 16px', color: C.RED, fontSize: 11, background: `${C.RED}10`, borderBottom: `1px solid ${C.RED}40` }}>⚠ {err}</div>}

      {/* Results */}
      {agg && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', borderTop: `1px solid ${C.TEAL}30` }}>
          <div style={{ color: C.TEAL, fontSize: 11, fontWeight: 800, marginBottom: 4 }}>▌ SUBSET AGGREGATE</div>
          <div style={{ color: C.MUTED, fontSize: 10, marginBottom: 10 }}>{agg.names} names · {cfg.tf} · {agg.bars.toLocaleString()} bars · {agg.stats.closed} trades ({agg.stats.open} open @ end)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
            <Stat label="TOTAL R" value={agg.stats.totR.toFixed(2)} color={agg.stats.totR >= 0 ? C.GREEN : C.RED} />
            <Stat label="WIN RATE" value={`${agg.stats.winRate.toFixed(1)}%`} color={agg.stats.winRate >= 50 ? C.GREEN : C.RED} />
            <Stat label="PROFIT FACTOR" value={isFinite(agg.stats.profitFactor) ? agg.stats.profitFactor.toFixed(2) : '∞'} color={agg.stats.profitFactor >= 1 ? C.GREEN : C.RED} />
            <Stat label="AVG R" value={agg.stats.avgR.toFixed(2)} color={agg.stats.avgR >= 0 ? C.GREEN : C.RED} />
            <Stat label="AVG WIN R" value={`+${agg.stats.avgWinR.toFixed(2)}`} color={C.GREEN} />
            <Stat label="AVG LOSS R" value={agg.stats.avgLossR.toFixed(2)} color={C.RED} />
            <Stat label="MAX DD" value={`${agg.stats.maxDD.toFixed(1)}R`} color={C.RED} />
            <Stat label="W / L" value={`${agg.stats.wins} / ${agg.stats.losses}`} />
          </div>
          {Object.keys(agg.stats.labels).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...lbl, marginBottom: 6 }}>EXIT BREAKDOWN</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(agg.stats.labels).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: C.SURFACE2, color: C.TEXT, border: `1px solid ${C.BORDER}` }}><b style={{ color: lblColor(k) }}>{k}</b> {v}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ ...lbl, marginBottom: 6 }}>TRADE LEDGER</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead><tr style={{ color: C.MUTED, textAlign: 'left', borderBottom: `1px solid ${C.BORDER}` }}>{['#', 'OPEN', 'EXIT', 'LABEL', 'R'].map(h => <th key={h} style={{ padding: '4px 6px', fontWeight: 700 }}>{h}</th>)}</tr></thead>
            <tbody>
              {agg.trades.map((t, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.GRID}` }}>
                  <td style={{ padding: '3px 6px', color: C.MUTED }}>{i + 1}</td>
                  <td style={{ padding: '3px 6px', color: C.TEXT }}>{t.openDate}</td>
                  <td style={{ padding: '3px 6px', color: C.TEXT }}>{t.exitDate}</td>
                  <td style={{ padding: '3px 6px' }}><span style={{ color: lblColor(t.exitLabel), fontWeight: 700 }}>{t.exitLabel}</span></td>
                  <td style={{ padding: '3px 6px', color: t.tradeR >= 0 ? C.GREEN : C.RED, fontWeight: 700, textAlign: 'right' }}>{t.tradeR >= 0 ? '+' : ''}{t.tradeR.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          <div style={{ color: C.MUTED, fontSize: 10, marginBottom: 10 }}>{cfg.symbol} · {cfg.tf}min · {data.barCount.toLocaleString()} bars · {data.stats.closed} closed trades ({data.stats.open} open @ end)</div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
            <Stat label="TOTAL R" value={data.stats.totR.toFixed(2)} color={data.stats.totR >= 0 ? C.GREEN : C.RED} />
            <Stat label="WIN RATE" value={`${data.stats.winRate.toFixed(1)}%`} color={data.stats.winRate >= 50 ? C.GREEN : C.RED} />
            <Stat label="PROFIT FACTOR" value={isFinite(data.stats.profitFactor) ? data.stats.profitFactor.toFixed(2) : '∞'} color={data.stats.profitFactor >= 1 ? C.GREEN : C.RED} />
            <Stat label="AVG R" value={data.stats.avgR.toFixed(2)} color={data.stats.avgR >= 0 ? C.GREEN : C.RED} />
            <Stat label="AVG WIN R" value={`+${data.stats.avgWinR.toFixed(2)}`} color={C.GREEN} />
            <Stat label="AVG LOSS R" value={data.stats.avgLossR.toFixed(2)} color={C.RED} />
            <Stat label="MAX DD" value={`${data.stats.maxDD.toFixed(1)}R`} color={C.RED} />
            <Stat label="W / L" value={`${data.stats.wins} / ${data.stats.losses}`} />
          </div>

          {/* Equity curve */}
          {eq.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...lbl, marginBottom: 6 }}>EQUITY CURVE (CUMULATIVE R)</div>
              <EquityCurve data={eq} />
            </div>
          )}

          {/* Exit-label breakdown */}
          {Object.keys(data.stats.labels).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...lbl, marginBottom: 6 }}>EXIT BREAKDOWN</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(data.stats.labels).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: C.SURFACE2, color: C.TEXT, border: `1px solid ${C.BORDER}` }}>
                    <b style={{ color: lblColor(k) }}>{k}</b> {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trade ledger */}
          <div style={{ ...lbl, marginBottom: 6 }}>TRADE LEDGER</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <thead>
              <tr style={{ color: C.MUTED, textAlign: 'left', borderBottom: `1px solid ${C.BORDER}` }}>
                {['#', 'OPEN', 'EXIT', 'LABEL', 'FILLS', 'R'].map(h => <th key={h} style={{ padding: '4px 6px', fontWeight: 700 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.trades.map((t, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.GRID}` }}>
                  <td style={{ padding: '3px 6px', color: C.MUTED }}>{i + 1}</td>
                  <td style={{ padding: '3px 6px', color: C.TEXT }}>{t.openDate}</td>
                  <td style={{ padding: '3px 6px', color: C.TEXT }}>{t.exitDate}</td>
                  <td style={{ padding: '3px 6px' }}><span style={{ color: lblColor(t.exitLabel), fontWeight: 700 }}>{t.exitLabel}</span></td>
                  <td style={{ padding: '3px 6px', color: C.MUTED }}>{t.fills.map(f => f.kind).join('·')}</td>
                  <td style={{ padding: '3px 6px', color: t.tradeR >= 0 ? C.GREEN : C.RED, fontWeight: 700, textAlign: 'right' }}>{t.tradeR >= 0 ? '+' : ''}{t.tradeR.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data && !err && !loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.MUTED, fontSize: 12 }}>
          Configure range and press <b style={{ color: C.GREEN, margin: '0 4px' }}>RUN</b> to backtest the Lingua Exec engine.
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}`, borderRadius: 4, padding: '8px 10px' }}>
      <div style={{ fontSize: 8, color: C.MUTED, fontWeight: 700, letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.TEXT }}>{value}</div>
    </div>
  )
}

function EquityCurve({ data }: { data: number[] }) {
  const W = 900, H = 140, pad = 6
  const min = Math.min(0, ...data), max = Math.max(0, ...data)
  const range = max - min || 1
  const x = (i: number) => pad + (i / (data.length - 1 || 1)) * (W - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / range) * (H - pad * 2)
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const zeroY = y(0)
  const area = `${path} L${x(data.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${x(0).toFixed(1)},${zeroY.toFixed(1)} Z`
  const lastR = data[data.length - 1] ?? 0
  const col = lastR >= 0 ? C.GREEN : C.RED
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, background: C.SURFACE, borderRadius: 4, border: `1px solid ${C.BORDER}` }}>
      <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke={C.BORDER} strokeDasharray="3 3" />
      <path d={area} fill={col} opacity={0.12} />
      <path d={path} fill="none" stroke={col} strokeWidth={1.5} />
    </svg>
  )
}

function lblColor(label: string): string {
  if (label.includes('SL')) return C.RED
  if (label.includes('39/61')) return C.RED
  if (label.includes('RC')) return C.GOLD
  if (label.includes('BRK')) return C.TEAL
  if (label.includes('REGIME')) return C.MUTED
  if (label.includes('OPEN')) return C.MUTED
  return C.TEXT
}
