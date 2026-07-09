'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

/**
 * /backtest/run/[id] — backtest detail subpage.
 * Calendar heatmap + daily stats + equity curve + monthly breakdown + trade table.
 * Matches the dark-gold aesthetic of /backtest (page.tsx).
 */

// ── palette (mirror page.tsx) ──
const BG = '#08080d', SURFACE = '#0c0c14', SURFACE2 = '#10101c', SURFACE3 = '#141422'
const BORDER = '#1a1a2e', TEXT = '#e0e0e0', TEXT2 = '#b0b0c0', MUTED = '#555570'
const RED = '#ef4444', TEAL = '#14b8a6', GREEN = '#22c55e'

const G = '#D4AF37'
const G_DIM = 'rgba(212,175,55,0.12)'
const G_BORDER = 'rgba(212,175,55,0.3)'

interface DayStat { r: number; trades: number; wins: number; losses: number; pnl: number }
interface Summary {
  trades: number; wins: number; winRate: number; totR: number; profitFactor: number
  longs: number; shorts: number; avgR: number; greenDays: number; greenPct: number
  tradingDays: number; perDay: number; maxDD: number; avgDayR: number
  bestDay: { date: string; r: number } | null; worstDay: { date: string; r: number } | null
}
interface Trade { id: string; side: string; openDate: string; exitDate: string; entry: number; stop: number; exit: number; exitLabel: string; r: number; pnl: number }

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [run, setRun] = useState<any>(null)
  const [selDay, setSelDay] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'date' | 'r' | 'side'>('date')
  const [sideFilter, setSideFilter] = useState<'all' | 'long' | 'short'>('all')

  useEffect(() => {
    if (!id) return
    fetch(`/api/backtest/runs?id=${id}`).then(r => r.json()).then(d => { setRun(d); if (d.byDay) setSelDay(null) })
  }, [id])

  if (!run) return <div style={{ background: BG, color: MUTED, minHeight: '100vh', padding: 40 }}>loading…</div>

  const S = run.summary as Summary
  const byDay = (run.byDay || {}) as Record<string, DayStat>
  const trades = (run.trades || []) as Trade[]

  // ── monthly aggregation ──
  const months = useMemo(() => {
    const m: Record<string, { trades: number; r: number; green: number; days: number; wins: number; grossW: number; grossL: number }> = {}
    for (const d of Object.keys(byDay).sort()) {
      const mk = d.slice(0, 7) // YYYY-MM
      if (!m[mk]) m[mk] = { trades: 0, r: 0, green: 0, days: 0, wins: 0, grossW: 0, grossL: 0 }
      m[mk].trades += byDay[d].trades; m[mk].r += byDay[d].r; m[mk].days++
      if (byDay[d].r > 0) m[mk].green++
      m[mk].wins += byDay[d].wins
      m[mk].grossW += Math.max(0, byDay[d].r); m[mk].grossL += Math.max(0, -byDay[d].r)
    }
    return Object.entries(m).sort((a, b) => a[0] < b[0] ? 1 : -1)
  }, [byDay])

  // ── cumulative equity (daily) ──
  const equity = useMemo(() => {
    let c = 0; const out: number[] = []
    for (const d of Object.keys(byDay).sort()) { c += byDay[d].r; out.push(c) }
    return out
  }, [byDay])

  // ── filtered trades (by selected day + side) ──
  const shownTrades = useMemo(() => {
    let t = trades
    if (selDay) t = t.filter(x => x.openDate.slice(0, 10) === selDay)
    if (sideFilter !== 'all') t = t.filter(x => x.side === sideFilter)
    return [...t].sort((a, b) => {
      if (sortKey === 'r') return b.r - a.r
      if (sortKey === 'side') return a.side < b.side ? 1 : -1
      return a.openDate < b.openDate ? -1 : 1
    }).slice(0, 400)
  }, [trades, selDay, sideFilter, sortKey])

  return (
    <div style={{ background: BG, color: TEXT, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '14px 18px 60px' }}>
        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/backtest')} style={btn(G_DIM, G_BORDER, G)}>← Runs</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{run.name}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{run.meta?.symbol} · {run.meta?.tf}m · {run.meta?.from} → {run.meta?.to} · {run.engine}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <RunLink id="lingua-mtf-5m" cur={id} label="SPY" />
            <RunLink id="lingua-mtf-spy2022" cur={id} label="2022 BEAR" />
            <RunLink id="lingua-mtf-qqq" cur={id} label="QQQ" />
          </div>
        </div>

        {/* ── stat strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6, marginBottom: 14 }}>
          <Stat label="Total R" value={fmtR(S.totR)} color={S.totR >= 0 ? G : RED} />
          <Stat label="Profit Factor" value={S.profitFactor.toFixed(2)} color={S.profitFactor >= 1.5 ? TEAL : G} />
          <Stat label="Green Days" value={`${S.greenPct}%`} color={GREEN} />
          <Stat label="Trades" value={S.trades.toLocaleString()} />
          <Stat label="Trades/Day" value={S.perDay.toFixed(1)} />
          <Stat label="Win Rate" value={`${S.winRate}%`} color={S.winRate >= 35 ? TEAL : TEXT2} />
          <Stat label="Avg R" value={`+${S.avgR.toFixed(2)}`} color={S.avgR > 0 ? G : RED} />
          <Stat label="Avg Day R" value={fmtR(S.avgDayR)} color={S.avgDayR >= 0 ? G : RED} />
          <Stat label="Max DD" value={`-${S.maxDD.toFixed(1)}R`} color={RED} />
          <Stat label="Trading Days" value={S.tradingDays.toString()} />
          <Stat label="Long / Short" value={`${S.longs} / ${S.shorts}`} />
          <Stat label="Best Day" value={S.bestDay ? `${fmtR(S.bestDay.r)}` : '—'} color={GREEN} sub={S.bestDay?.date} />
        </div>

        {/* ── equity curve ── */}
        <Panel title="Equity Curve (cumulative daily R)" right={<span style={{ color: MUTED, fontSize: 10 }}>max DD {S.maxDD.toFixed(1)}R</span>}>
          <Equity data={equity} color={G} height={150} />
        </Panel>

        {/* ── calendar ── */}
        <Panel title="Daily R Calendar" right={selDay ? (
          <button onClick={() => setSelDay(null)} style={btn(SURFACE3, BORDER, TEXT2)}>clear day filter ({selDay})</button>
        ) : <span style={{ color: MUTED, fontSize: 10 }}>click a day to filter trades</span>}>
          <Calendar byDay={byDay} selDay={selDay} onPick={setSelDay} />
        </Panel>

        {/* ── monthly + day detail side by side ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, 1.4fr)', gap: 12, marginBottom: 12 }}>
          <Panel title="Monthly Breakdown">
            <MonthlyTable months={months} />
          </Panel>
          <Panel title={selDay ? `Day Detail · ${selDay}` : 'Day Distribution'}>
            {selDay && byDay[selDay] ? (
              <DayDetail ds={byDay[selDay]} date={selDay} trades={trades.filter(t => t.openDate.slice(0, 10) === selDay)} />
            ) : (
              <DayDist byDay={byDay} />
            )}
          </Panel>
        </div>

        {/* ── trade table ── */}
        <Panel title={`Trades${selDay ? ` · ${selDay}` : ' · recent 400'}`} right={
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'long', 'short'] as const).map(f => (
              <button key={f} onClick={() => setSideFilter(f)} style={btn(sideFilter === f ? G_DIM : SURFACE3, sideFilter === f ? G_BORDER : BORDER, sideFilter === f ? G : TEXT2)}>{f}</button>
            ))}
          </div>
        }>
          <TradeTable trades={shownTrades} sortKey={sortKey} setSortKey={setSortKey} />
        </Panel>
      </div>
    </div>
  )
}

// ── Equity (canvas, mirror EquityChart) ──
function Equity({ data, color, height }: { data: number[]; color: string; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv || !data.length) return
    const ctx = cv.getContext('2d')!; const w = cv.offsetWidth, h = height
    cv.width = w * 2; cv.height = h * 2; ctx.scale(2, 2); ctx.clearRect(0, 0, w, h)
    const min = Math.min(...data, 0), max = Math.max(...data, 0), range = (max - min) || 1
    const x = (i: number) => i * w / (data.length - 1 || 1)
    const y = (v: number) => h - ((v - min) / range) * h
    // zero line
    ctx.strokeStyle = SURFACE3; ctx.lineWidth = 0.5; ctx.setLineDash([3, 3])
    ctx.beginPath(); ctx.moveTo(0, y(0)); ctx.lineTo(w, y(0)); ctx.stroke(); ctx.setLineDash([])
    // fill
    ctx.beginPath(); ctx.moveTo(0, y(data[0]))
    data.forEach((v, i) => ctx.lineTo(x(i), y(v)))
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, color + '30'); g.addColorStop(1, color + '05')
    ctx.fillStyle = g; ctx.fill()
    // line
    ctx.beginPath(); ctx.moveTo(0, y(data[0]))
    data.forEach((v, i) => ctx.lineTo(x(i), y(v)))
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke()
  }, [data, color, height])
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} />
}

// ── Calendar heatmap ──
function Calendar({ byDay, selDay, onPick }: { byDay: Record<string, DayStat>; selDay: string | null; onPick: (d: string) => void }) {
  const days = Object.keys(byDay)
  if (!days.length) return <div style={{ color: MUTED, fontSize: 12 }}>no daily data</div>
  // build month groups
  const months: { key: string; year: number; month: number }[] = []
  const seen = new Set<string>()
  for (const d of days.sort()) { const mk = d.slice(0, 7); if (!seen.has(mk)) { seen.add(mk); months.push({ key: mk, year: +d.slice(0, 4), month: +d.slice(5, 7) }) } }
  const maxAbs = Math.max(...days.map(d => Math.abs(byDay[d].r)), 1)
  const wd = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const colorFor = (r: number) => {
    const a = Math.min(Math.abs(r) / maxAbs, 1) * 0.85 + 0.15
    return r >= 0 ? `rgba(34,197,94,${a})` : `rgba(239,68,68,${a})`
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {months.map(({ key, year, month }) => {
        const first = new Date(Date.UTC(year, month - 1, 1))
        const startWd = first.getUTCDay()
        const daysInMo = new Date(Date.UTC(year, month, 0)).getUTCDate()
        const cells: (string | null)[] = []
        for (let i = 0; i < startWd; i++) cells.push(null)
        for (let d = 1; d <= daysInMo; d++) cells.push(`${key}-${String(d).padStart(2, '0')}`)
        return (
          <div key={key} style={{ minWidth: 200 }}>
            <div style={{ fontSize: 10, color: G, fontWeight: 700, marginBottom: 4 }}>{first.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, fontSize: 8, color: MUTED, marginBottom: 2 }}>
              {wd.map((w, i) => <div key={i} style={{ textAlign: 'center' }}>{w}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {cells.map((c, i) => {
                if (!c) return <div key={i} style={{ aspectRatio: '1' }} />
                const ds = byDay[c]
                if (!ds) return <div key={i} title={c} style={{ aspectRatio: '1', background: SURFACE2, borderRadius: 2, opacity: 0.4 }} />
                const sel = selDay === c
                return (
                  <div key={i} title={`${c} · ${fmtR(ds.r)} · ${ds.trades} trades`}
                    onClick={() => onPick(sel ? '' as any : c)}
                    style={{ aspectRatio: '1', background: colorFor(ds.r), borderRadius: 2, cursor: 'pointer',
                      outline: sel ? `2px solid ${G}` : 'none', outlineOffset: -1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'rgba(0,0,0,0.6)', fontWeight: 700 }}>
                    {+c.slice(8)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── monthly table ──
function MonthlyTable({ months }: { months: [string, { trades: number; r: number; green: number; days: number; wins: number; grossW: number; grossL: number }][] }) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 60px 44px 44px 56px', gap: 4, color: MUTED, padding: '4px 4px', borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', fontSize: 9 }}>
        <span>Month</span><span style={{ textAlign: 'right' }}>Trades</span><span style={{ textAlign: 'right' }}>R</span><span style={{ textAlign: 'right' }}>Green%</span><span style={{ textAlign: 'right' }}>PF</span><span style={{ textAlign: 'right' }}>R/Day</span>
      </div>
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {months.map(([mk, m]) => (
          <div key={mk} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 60px 44px 44px 56px', gap: 4, padding: '3px 4px', borderBottom: `1px solid ${SURFACE2}`, alignItems: 'center' }}>
            <span style={{ color: TEXT2 }}>{new Date(mk + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            <span style={{ textAlign: 'right', color: MUTED }}>{m.trades}</span>
            <span style={{ textAlign: 'right', color: m.r >= 0 ? G : RED, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtR(m.r)}</span>
            <span style={{ textAlign: 'right', color: TEXT2 }}>{(100 * m.green / (m.days || 1)).toFixed(0)}%</span>
            <span style={{ textAlign: 'right', color: m.grossL ? (m.grossW / m.grossL >= 1.5 ? TEAL : TEXT2) : MUTED }}>{m.grossL ? (m.grossW / m.grossL).toFixed(2) : '—'}</span>
            <span style={{ textAlign: 'right', color: m.r >= 0 ? G : RED, fontVariantNumeric: 'tabular-nums' }}>{(m.r / (m.days || 1)).toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── day distribution (when no day selected) ──
function DayDist({ byDay }: { byDay: Record<string, DayStat> }) {
  const rs = Object.values(byDay).map(d => d.r).sort((a, b) => a - b)
  if (!rs.length) return null
  const buckets = [[-99, -8], [-8, -4], [-4, -2], [-2, 0], [0, 2], [2, 4], [4, 8], [8, 99]] as [number, number][]
  const counts = buckets.map(([lo, hi]) => rs.filter(r => r >= lo && r < hi).length)
  const max = Math.max(...counts, 1)
  const lbl = (i: number) => i === 0 ? '≤-8' : i === 7 ? '≥8' : `${buckets[i][0]}…${buckets[i][1]}`
  const col = (i: number) => i < 4 ? RED : i === 4 ? MUTED : GREEN
  return (
    <div>
      <div style={{ fontSize: 10, color: MUTED, marginBottom: 8 }}>Daily R distribution ({rs.length} days · median {rs[Math.floor(rs.length / 2)].toFixed(2)}R)</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${buckets.length}, 1fr)`, gap: 4, alignItems: 'end', height: 200 }}>
        {counts.map((c, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 9, color: MUTED, marginBottom: 2 }}>{c}</span>
            <div style={{ width: '100%', background: col(i), opacity: 0.8, height: `${(c / max) * 100}%`, minHeight: c ? 2 : 0, borderRadius: '2px 2px 0 0' }} />
            <span style={{ fontSize: 8, color: TEXT2, marginTop: 4 }}>{lbl(i)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── day detail (when a day is selected) ──
function DayDetail({ ds, date, trades }: { ds: DayStat; date: string; trades: Trade[] }) {
  const bySide = { long: trades.filter(t => t.side === 'long').reduce((a, t) => a + t.r, 0), short: trades.filter(t => t.side === 'short').reduce((a, t) => a + t.r, 0) }
  const byExit: Record<string, number[]> = {}
  for (const t of trades) (byExit[t.exitLabel] ||= []).push(t.r)
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
        <MiniStat label="Day R" value={fmtR(ds.r)} color={ds.r >= 0 ? G : RED} />
        <MiniStat label="Trades" value={String(ds.trades)} />
        <MiniStat label="Wins/Loss" value={`${ds.wins}/${ds.losses}`} color={ds.wins >= ds.losses ? TEAL : RED} />
        <MiniStat label="Win Rate" value={`${(100 * ds.wins / (ds.trades || 1)).toFixed(0)}%`} />
        <MiniStat label="Long R" value={fmtR(bySide.long)} color={bySide.long >= 0 ? G : RED} />
        <MiniStat label="Short R" value={fmtR(bySide.short)} color={bySide.short >= 0 ? G : RED} />
        <MiniStat label="P&L $" value={`$${ds.pnl.toFixed(0)}`} color={ds.pnl >= 0 ? G : RED} />
        <MiniStat label="Date" value={new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />
      </div>
      <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', marginBottom: 4 }}>Exit breakdown</div>
      {Object.entries(byExit).sort((a, b) => b[1].reduce((s, r) => s + r, 0) - a[1].reduce((s, r) => s + r, 0)).map(([k, arr]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${SURFACE2}` }}>
          <span style={{ color: TEXT2 }}>{k}</span>
          <span style={{ color: MUTED }}>{arr.length} · <span style={{ color: arr.reduce((s, r) => s + r, 0) >= 0 ? G : RED, fontWeight: 700 }}>{fmtR(arr.reduce((s, r) => s + r, 0))}</span></span>
        </div>
      ))}
    </div>
  )
}

// ── trade table ──
function TradeTable({ trades, sortKey, setSortKey }: { trades: Trade[]; sortKey: string; setSortKey: (k: any) => void }) {
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 50px 64px 64px 64px 60px 60px', gap: 4, color: MUTED, padding: '4px', borderBottom: `1px solid ${BORDER}`, textTransform: 'uppercase', fontSize: 9 }}>
        <span style={{ cursor: 'pointer' }} onClick={() => setSortKey('date')}>Time {sortKey === 'date' ? '↕' : ''}</span>
        <span style={{ cursor: 'pointer' }} onClick={() => setSortKey('side')}>Side {sortKey === 'side' ? '↕' : ''}</span>
        <span style={{ textAlign: 'right' }}>Entry</span><span style={{ textAlign: 'right' }}>Stop</span><span style={{ textAlign: 'right' }}>Exit</span>
        <span>Exit</span>
        <span style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setSortKey('r')}>R {sortKey === 'r' ? '↕' : ''}</span>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {trades.map(t => (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '120px 50px 64px 64px 64px 60px 60px', gap: 4, padding: '3px 4px', borderBottom: `1px solid ${SURFACE2}`, alignItems: 'center' }}>
            <span style={{ color: TEXT2 }}>{t.openDate.slice(5)}</span>
            <span style={{ color: t.side === 'long' ? TEAL : RED, fontWeight: 700, fontSize: 10 }}>{t.side === 'long' ? 'L' : 'S'}</span>
            <span style={{ textAlign: 'right', color: TEXT2, fontVariantNumeric: 'tabular-nums' }}>{t.entry.toFixed(2)}</span>
            <span style={{ textAlign: 'right', color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{t.stop.toFixed(2)}</span>
            <span style={{ textAlign: 'right', color: TEXT2, fontVariantNumeric: 'tabular-nums' }}>{t.exit.toFixed(2)}</span>
            <span style={{ color: MUTED, fontSize: 9 }}>{t.exitLabel}</span>
            <span style={{ textAlign: 'right', color: t.r >= 0 ? G : RED, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{t.r >= 0 ? '+' : ''}{t.r.toFixed(2)}</span>
          </div>
        ))}
        {!trades.length && <div style={{ color: MUTED, padding: 20, textAlign: 'center' }}>no trades match filter</div>}
      </div>
    </div>
  )
}

// ── primitives ──
function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 4, padding: '6px 10px' }}>
      <div style={{ color: MUTED, fontSize: 9, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: color || G, fontSize: 17, fontWeight: 700, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ color: MUTED, fontSize: 8 }}>{sub}</div>}
    </div>
  )
}
function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 3, padding: '4px 6px' }}>
      <div style={{ color: MUTED, fontSize: 8, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: color || TEXT, fontSize: 13, fontWeight: 700 }}>{value}</div>
    </div>
  )
}
function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 5, padding: 10, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: G, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  )
}
function RunLink({ id, cur, label }: { id: string; cur: string; label: string }) {
  const router = useRouter()
  const active = cur === id
  return <button onClick={() => router.push(`/backtest/run/${id}`)} style={btn(active ? G_DIM : SURFACE3, active ? G_BORDER : BORDER, active ? G : TEXT2)}>{label}</button>
}
function btn(bg: string, bdr: string, col: string) {
  return { background: bg, border: `1px solid ${bdr}`, borderRadius: 3, cursor: 'pointer' as const, fontSize: 10, fontWeight: 700, padding: '3px 8px', fontFamily: 'inherit' as const, color: col }
}
function fmtR(r: number) { return `${r >= 0 ? '+' : ''}${r.toFixed(1)}R` }
