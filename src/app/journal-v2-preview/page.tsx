'use client'

import { useState, useEffect, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ScanMiniChart, IND_TEMPLATES, type ChartSettings } from '@/app/scanner/page'

/* ──────────────────────────────────────────────────────────────────────────
 * /journal-v2-preview — Notion-style Journal v2 preview.
 * REAL candlestick charts (the actual ScanMiniChart from /scanner) rendered
 * on 15m with Mike's Bands + entry/exit arrows, driven by REAL trades from
 * the database. Click any trade row to load that trade's chart below.
 *
 * This is a PREVIEW of the Phase-1 design (Daily Review ↔ Day). Not the final
 * journal build — that goes through the REQ / feature workflow.
 * ────────────────────────────────────────────────────────────────────────── */

interface Trade {
  id: string
  date: string
  symbol: string
  side: string
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  pnlPercent: number
  rMultiple?: number | null
  strategy: string
  entryTime?: string
  exitTime?: string
}

const MIKE_SETTINGS: ChartSettings = {
  showEma9_20: false, showEma72_89: false,
  showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false,
  showKeyLevels: false, showVwap: true, showPrevClose: true, showAhPmShade: true,
  showVolume: true, showCrosshair: true, showLegend: false,
  ...IND_TEMPLATES.find((t) => t.id === 'mikes-bands')!.settings,
} as ChartSettings

const TF = '15' as const

// epoch in SECONDS (matches bars API `time` field; findBar tolerance is 300s)
const toEpoch = (iso?: string) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : undefined)

const fmtMoney = (n: number) => `${n >= 0 ? '+' : '−'}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

export default function JournalV2PreviewPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // selected day (date string) + selected trade within that day
  const [daySel, setDaySel] = useState<string | null>(null)
  const [tradeSel, setTradeSel] = useState<Trade | null>(null)

  useEffect(() => {
    fetch('/api/trades?limit=600')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => {
        const all: Trade[] = d.trades || []
        // only trades with intraday timing + a real symbol
        const withTimes = all.filter((t) => t.entryTime && t.exitTime && t.symbol && t.entryPrice > 0)
        setTrades(withTimes.length ? withTimes : all)
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  // group trades by date (descending)
  const days = useMemo(() => {
    const map = new Map<string, Trade[]>()
    for (const t of trades) {
      const d = (t.date || '').slice(0, 10)
      if (!d) continue
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(t)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [trades])

  // auto-select the most recent day on load
  useEffect(() => {
    if (!daySel && days.length) setDaySel(days[0][0])
  }, [days, daySel])

  const dayTrades = useMemo(
    () => (daySel ? days.find((d) => d[0] === daySel)?.[1] ?? [] : []),
    [days, daySel]
  )

  const dayStats = useMemo(() => {
    if (!dayTrades.length) return null
    const net = dayTrades.reduce((s, t) => s + (t.pnl || 0), 0)
    const wins = dayTrades.filter((t) => (t.pnl || 0) > 0).length
    const rs = dayTrades.map((t) => t.rMultiple).filter((x): x is number => typeof x === 'number')
    const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0
    return { net, winRate: (wins / dayTrades.length) * 100, count: dayTrades.length, avgR }
  }, [dayTrades])

  const markers = useMemo(() => {
    if (!tradeSel) return {}
    return {
      entryMarker: tradeSel.entryTime
        ? { price: tradeSel.entryPrice, timeInt: tradeSel.entryTime, epoch: toEpoch(tradeSel.entryTime) }
        : undefined,
      exitMarker: tradeSel.exitTime
        ? { price: tradeSel.exitPrice, timeInt: tradeSel.exitTime, epoch: toEpoch(tradeSel.exitTime) }
        : undefined,
    }
  }, [tradeSel])

  return (
    <div className="min-h-screen" style={{ background: '#08080d', color: '#e0e0e0' }}>
      {/* Banner */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(212,175,55,.15), transparent)',
        borderBottom: '1px solid #D4AF37', padding: '8px 24px', fontSize: 12, color: '#D4AF37',
      }}>
        ⚙️ <b style={{ color: '#fff' }}>MOCKUP PREVIEW</b> — Journal v2 (real {TF}m charts, real trades). Click any trade row ↓ to load its chart.
      </div>

      {/* Sub nav */}
      <nav className="flex items-center gap-1 px-4" style={{ height: 40, background: '#0c0c14', borderBottom: '1px solid #1a1a1a' }}>
        {['Dashboard', 'Trades', 'Journal', 'Calendar', 'Statistics', 'Analytics', 'Research'].map((n) => (
          <span key={n} style={{
            fontSize: 13, padding: '8px 12px', borderRadius: 6,
            color: n === 'Journal' ? '#D4AF37' : '#666680',
            background: n === 'Journal' ? 'rgba(212,175,55,.06)' : 'transparent',
            border: n === 'Journal' ? '1px solid rgba(212,175,55,.2)' : '1px solid transparent',
          }}>{n}</span>
        ))}
        <span className="ml-auto" style={{ fontSize: 12, color: '#555' }}>Journal / Docs (preview)</span>
      </nav>

      <div className="flex" style={{ height: 'calc(100vh - 72px)' }}>
        {/* Sidebar — Days database */}
        <aside style={{ width: 240, flexShrink: 0, background: '#0c0c14', borderRight: '1px solid #1a1a1a', overflowY: 'auto', padding: '16px 0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#555', padding: '12px 16px 6px' }}>Databases</div>
          {[
            { ico: '📅', name: 'Days', n: days.length, on: true },
            { ico: '📊', name: 'Trades', n: trades.length, on: false },
            { ico: '📡', name: 'Scan Signals', n: 588, on: false },
          ].map((d) => (
            <div key={d.name} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', fontSize: 13, cursor: 'pointer',
              borderLeft: d.on ? '2px solid #D4AF37' : '2px solid transparent',
              background: d.on ? 'rgba(212,175,55,.06)' : 'transparent',
              color: d.on ? '#D4AF37' : '#e0e0e0',
            }}>
              <span>{d.ico}</span><span>{d.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', background: '#111', padding: '1px 6px', borderRadius: 8 }}>{d.n}</span>
            </div>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#555', padding: '16px 16px 6px' }}>Days · click to open</div>
          {days.slice(0, 14).map(([d]) => (
            <div key={d} onClick={() => { setDaySel(d); setTradeSel(null) }} style={{
              padding: '5px 16px 5px 24px', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              color: d === daySel ? '#D4AF37' : '#666680',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: d === daySel ? '#D4AF37' : '#555' }} />
              {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>{days.find((x) => x[0] === d)?.[1].length}</span>
            </div>
          ))}
        </aside>

        {/* Doc */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 80px' }}>
          <div style={{ maxWidth: 860, margin: '0 auto' }}>
            {loading && <div style={{ textAlign: 'center', padding: 80, color: '#666' }}>Loading trades…</div>}
            {err && <div style={{ textAlign: 'center', padding: 80, color: '#f87171' }}>Couldn&apos;t load trades: {err}.<br /><span style={{ color: '#555' }}>Make sure you&apos;re logged in.</span></div>}

            {!loading && !err && daySel && dayStats && (
              <>
                {/* Linked badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Badge gold>📅 Linked to Day · <b>{new Date(daySel + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</b></Badge>
                  <Badge>📊 {dayStats.count} trades</Badge>
                  <Badge>🏷️ {[...new Set(dayTrades.map((t) => t.symbol))].slice(0, 6).join(' · ')}</Badge>
                </div>
                <h1 style={{ fontSize: 32, fontWeight: 700, color: '#fff', margin: '6px 0 4px' }}>
                  Daily Review — {new Date(daySel + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </h1>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 28 }}>Auto-populated from the Day database · {trades.length} trades loaded</div>

                {/* Day P&L auto block */}
                <Block head={`📊 Day P&L — auto from Trades DB`} >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1a1a1a' }}>
                    <Cell label="Net P&L" val={fmtMoney(dayStats.net)} pos={dayStats.net >= 0} />
                    <Cell label="Win Rate" val={`${dayStats.winRate.toFixed(0)}%`} />
                    <Cell label="Trades" val={String(dayStats.count)} />
                    <Cell label="Avg R" val={`${dayStats.avgR >= 0 ? '+' : ''}${dayStats.avgR.toFixed(1)}R`} pos={dayStats.avgR >= 0} />
                  </div>
                </Block>

                {/* Trades table — CLICK to chart */}
                <Block head={`📊 Today's Trades — click a row to chart it`}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>{['Symbol', 'Side', 'Entry', 'Exit', 'P&L', ''].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555', padding: '9px 14px', borderBottom: '1px solid #1a1a1a' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {dayTrades.map((t) => {
                        const active = tradeSel?.id === t.id
                        return (
                          <tr key={t.id} onClick={() => setTradeSel(t)} style={{
                            cursor: 'pointer',
                            background: active ? 'rgba(212,175,55,.10)' : 'transparent',
                            boxShadow: active ? 'inset 2px 0 0 #D4AF37' : 'none',
                          }}>
                            <td style={td(active, true)}>{t.symbol}</td>
                            <td style={{ ...td(active), color: t.side === 'Short' ? '#f87171' : '#34d399' }}>{(t.side || '').toUpperCase()}</td>
                            <td style={td(active)}>${t.entryPrice.toLocaleString()}</td>
                            <td style={td(active)}>${t.exitPrice.toLocaleString()}</td>
                            <td style={{ ...td(active), color: t.pnl >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>{fmtMoney(t.pnl)}</td>
                            <td style={td(active)}>
                              <span style={{ fontSize: 10, color: '#D4AF37', background: 'rgba(212,175,55,.06)', border: '1px solid rgba(212,175,55,.2)', padding: '1px 6px', borderRadius: 8 }}>
                                {active ? '✓ selected' : '📈 chart'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Block>

                {/* Chart zone — REAL ScanMiniChart */}
                <div style={{ marginTop: 4 }}>
                  {tradeSel ? (
                    <Block head={`📈 ${tradeSel.symbol} · ${(tradeSel.side || '').toUpperCase()} · ${TF}m intraday — entry ▼ / exit ▲`} >
                      <div style={{ padding: 0 }}>
                        <ScanMiniChart
                          symbol={tradeSel.symbol}
                          tf={TF}
                          date={tradeSel.date.slice(0, 10)}
                          height={340}
                          settings={MIKE_SETTINGS}
                          dark={true}
                          compact
                          entryMarker={markers.entryMarker}
                          exitMarker={markers.exitMarker}
                        />
                      </div>
                    </Block>
                  ) : (
                    <div style={{
                      marginTop: 4, fontSize: 12, color: '#555', padding: 24, textAlign: 'center',
                      border: '1px dashed #1a1a1a', borderRadius: 10, fontStyle: 'italic',
                    }}>
                      👆 <b style={{ color: '#D4AF37', fontStyle: 'normal' }}>Click any trade row above</b> to load that trade&apos;s real 15m candlestick chart with entry/exit arrows.
                    </div>
                  )}
                </div>

                {/* Notes sections (placeholder — real editor in the build) */}
                <Section title="PM Notes">
                  <div style={{ color: '#c8c8d0', lineHeight: 1.75, minHeight: 40 }}>
                    <span style={{ color: '#555', fontStyle: 'italic' }}>…your read on the tape. (Editor wires up in the real build.)</span>
                  </div>
                </Section>
                <Section title="Daily Review">
                  <div style={{ color: '#c8c8d0', lineHeight: 1.75, minHeight: 40 }}>
                    <span style={{ color: '#555', fontStyle: 'italic' }}>…what you learned today.</span>
                  </div>
                </Section>
              </>
            )}

            {!loading && !err && !dayStats && (
              <div style={{ textAlign: 'center', padding: 80, color: '#666' }}>No trades with intraday timing found.</div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

/* ── small presentational helpers ── */
const td = (active: boolean, bold = false): CSSProperties => ({
  padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontWeight: bold ? 600 : 400,
  color: active ? '#fff' : '#e0e0e0',
})

function Badge({ children, gold }: { children: ReactNode; gold?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 9px', borderRadius: 12,
      background: gold ? 'rgba(212,175,55,.06)' : '#111', border: gold ? '1px solid rgba(212,175,55,.35)' : '1px solid #1a1a1a',
      color: gold ? '#D4AF37' : '#666680',
    }}>{children}</span>
  )
}

function Block({ head, children }: { head: string; children: ReactNode }) {
  return (
    <div style={{ margin: '16px 0', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden', background: '#0c0c14' }}>
      <div style={{ padding: '9px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: '#666680' }}>{head}</div>
      {children}
    </div>
  )
}

function Cell({ label, val, pos }: { label: string; val: string; pos?: boolean }) {
  return (
    <div style={{ background: '#0c0c14', padding: '14px 16px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: '#555' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, color: pos === undefined ? '#fff' : pos ? '#34d399' : '#f87171' }}>{val}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#D4AF37', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>{title}</h2>
      {children}
    </div>
  )
}
