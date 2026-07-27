'use client'

import { useState, useEffect } from 'react'
import { ScanMiniChart, IND_TEMPLATES, type ChartSettings } from '@/app/scanner/page'
import { useTickerStore } from '@/stores/tickerStore'

const DEFAULT_SETTINGS: ChartSettings = {
  showEma9_20: false, showEma72_89: false,
  showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false,
  showKeyLevels: false, showVwap: true, showPrevClose: true, showAhPmShade: true,
  showVolume: true, showCrosshair: true, showLegend: false,
  ...IND_TEMPLATES.find((t) => t.id === 'mikes-bands')!.settings,
}

/**
 * /gap-stats — Gap microstructure research page.
 * Full-page, visual-first. Data from /api/gap-stats (cached, heavy first lookup).
 */

const PAL = {
 BG: '#0a0a0a', PANEL: '#0f1623', PANEL2: '#141c2b',
 BORDER: '#1f2937', BORDER_GOLD: 'rgba(212,175,55,0.30)',
 TEXT: '#e0e0e0', MUTED: '#6b7280', DIM: '#9ca3af',
 GOLD: '#D4AF37', GREEN: '#34d399', RED: '#f87171',
}
const CAS_LABEL = [
 '15m close < prior 15m low',
 '5m close < 5m VWAP',
 '15m close < 15m VWAP',
 '5m EMA 9/20 bearish flip',
 '5m close < prior 5m low',
 '15m close < prior 5m low',
]
const pct = (x: number | null | undefined, d = 0): string => (x == null || isNaN(x) ? '—' : (x * 100).toFixed(d) + '%')

export function GapStatsPanel({ win }: { win: string }) {
 // Active ticker comes from the shared store; the host owns the search bar + window toggle.
 const ticker = useTickerStore((s) => s.ticker)
 const [minGap, setMinGap] = useState<20 | 50>(50)
 const [data, setData] = useState<any>(null)
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState('')
 const [chartMode, setChartMode] = useState<'single' | '2stack'>('2stack')
 const [selectedDay, setSelectedDay] = useState<string | null>(null)

 // Pure fetch — the shared store owns ticker + recent list (host search bar).
 const run = async (t: string, w: string) => {
  const tk = t.toUpperCase().trim()
  if (!tk) return
  setLoading(true); setError(''); setData(null)
  try {
   const r = await fetch(`/api/gap-stats?ticker=${encodeURIComponent(tk)}&window=${w}`)
   const j = await r.json()
   if (!r.ok) throw new Error(j.error || 'failed')
   setData(j)
   if (j.days?.length) setSelectedDay(j.days[0].date)
  } catch (e: any) { setError(e.message) } finally { setLoading(false) }
 }

 // Re-fetch whenever the shared ticker or window changes.
 useEffect(() => { if (ticker) run(ticker, win) }, [ticker, win]) // eslint-disable-line react-hooks/exhaustive-deps

 const a = minGap === 50 ? data?.agg50 : data?.agg20
 const shownDays = data ? (minGap === 50 ? (data.days as any[]).filter((d: any) => d.g50) : (data.days as any[])) : []

 return (
  <div>
   {/* Min Gap filter (gap-stats specific); search bar + window live in the host */}
   <div className="px-6 py-3 border-b border-[#1a1a1a]">
    <div className="max-w-[1400px] mx-auto flex items-center gap-1">
     <span className="text-xs text-[#666] mr-2">Min Gap</span>
     {[20, 50].map(g => (
      <button key={g} onClick={() => setMinGap(g as 20 | 50)}
       className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${minGap === g ? 'bg-[#D4AF37] text-[#0a0a0a] font-bold' : 'bg-[#141c2b] text-[#9ca3af] border border-[#1f2937] hover:text-[#e0e0e0]'}`}>
       {g}%
      </button>
     ))}
    </div>
   </div>

   <div className="max-w-[1400px] mx-auto px-6 py-6">
    <div className="flex-1 min-w-0">
    {/* Empty state */}
    {!ticker && !loading && (
     <div className="flex flex-col items-center justify-center py-32 text-[#444]">
      <div className="text-5xl mb-4">🔍</div>
      <p className="text-lg">Enter a ticker to analyze its gap history</p>
      <p className="text-sm text-[#333] mt-2">First lookup fetches years of 5m/15m data (~15-60s), then cached</p>
     </div>
    )}

    {loading && (
     <div className="flex flex-col items-center justify-center py-32 text-[#666]">
      <div className="animate-pulse text-4xl mb-4">⚙️</div>
      <p className="text-lg text-[#9ca3af]">Computing {ticker} gap stats…</p>
      <p className="text-sm mt-2">Fetching {win} of 5m/15m bars + intraday cascades</p>
     </div>
    )}

    {error && (
     <div className="flex items-center justify-center py-32">
      <div className="text-center">
       <div className="text-4xl mb-3">⚠️</div>
       <p className="text-[#f87171] text-lg">{error}</p>
      </div>
     </div>
    )}

    {data && a && (
     <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
       <MetricCard label="Gaps 20%+" value={String(data.count20)} sub={`${data.count50} at 50%+`} accent={minGap === 20} />
       <MetricCard label="Gaps 50%+" value={String(data.count50)} accent={minGap === 50} />
       <MetricCard label="Fade Rate" value={pct(a.fadeRate)} sub={`${Math.round(a.fadeRate * a.n)} of ${a.n} faded`} tone={a.fadeRate >= 0.6 ? 'good' : 'neutral'} />
       <MetricCard label="Avg Range" value={`$${a.avgRange.toFixed(2)}`} sub="RTH hi−lo" />
       <MetricCard label="Fade Depth" value={pct(a.fadeDepthAvgPct, 1)} sub="of PDC" tone="good" />
       <MetricCard label="PMH Break" value={pct(a.pmhBreakFreq)} sub={`+${pct(a.pmhBreakAvgPct, 1)} avg`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
       {/* Time stats */}
       <Panel title="Time of High / Low (RTH)" subtitle={`faded subset only · n=${a.fadedN}`}>
        <div className="grid grid-cols-2 gap-4 p-4">
         <TimeStat label="HIGH — avg" value={a.avgHighTime} />
         <TimeStat label="HIGH — median" value={a.medHighTime} />
         <TimeStat label="LOW — avg" value={a.avgLowTime} />
         <TimeStat label="LOW — median" value={a.medLowTime} />
        </div>
        <div className="px-4 pb-3 text-xs text-[#555] leading-relaxed">
         Averages exclude relentless runners. A day counts as &ldquo;faded&rdquo; if it has both a 15m close below the prior 15m low AND a 15m close below 15m VWAP.
        </div>
       </Panel>

       {/* Cascades — FADE-CENTRIC */}
       <Panel title="Fade After Trigger" subtitle="after trigger fires (post-open), does price FAIL to make a new HOD? (the fade)">
        <div className="p-3 space-y-2">
         {[0, 1, 2, 3, 4, 5].map(ci => {
          const c = a.cascades[String(ci + 1)]
          const fadeRate = c.fired ? c.fadeRate : 0
          return (
           <div key={ci} className="flex items-center gap-3">
            <div className="w-52 shrink-0 text-xs text-[#9ca3af]">{ci + 1}. {CAS_LABEL[ci]}</div>
            <div className="flex-1 h-5 bg-[#0a0a0a] rounded relative overflow-hidden border border-[#1f2937]">
             {c.fired > 0 && (
              <div className="h-full flex">
               <div className="h-full bg-[#34d399]/30 border-r border-[#34d399]/50" style={{ width: `${fadeRate * 100}%` }} />
              </div>
             )}
             <div className="absolute inset-0 flex items-center justify-center text-xs">
              <span className="text-[#34d399]">{c.faded}</span>
              <span className="text-[#666] mx-1">/</span>
              <span className="text-[#9ca3af]">{c.fired}</span>
              <span className="text-[#D4AF37] ml-2">({pct(fadeRate)} fade)</span>
             </div>
            </div>
           </div>
          )
         })}
        </div>
        <div className="px-4 pb-3 text-xs text-[#555]">
         <span className="text-[#34d399]">green</span> = faded (no new HOD — the win) · <span className="text-[#f87171]">red</span> = made new HOD (kept running). <span className="text-[#666]">·</span> = trigger never fired that day. 100% fade = every trigger day failed to reclaim.
        </div>
       </Panel>
      </div>

      {/* Per-date table */}
      <Panel title="Gap Day History" subtitle={`${shownDays.length} gap days · min ${minGap}% · sorted newest first`}>
       <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs">
         <thead className="sticky top-0 bg-[#0f1623] z-10">
          <tr className="border-b border-[#1f2937]">
           {['Date', 'Gap', 'Real O→C', 'PMH', 'RTH Hi', 'RTH Lo', 'Hi Time', 'Lo Time', '', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((h, i) => (
            <th key={i} className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">{h}</th>
           ))}
          </tr>
         </thead>
         <tbody>
          {shownDays.map(d => (
           <tr key={d.date} onClick={() => setSelectedDay(d.date)} className={`border-b border-[#1f2937]/50 hover:bg-[#141c2b] cursor-pointer ${d.faded ? 'bg-[#D4AF37]/[0.04]' : ''} ${selectedDay === d.date ? 'bg-[#D4AF37]/[0.10]' : ''}`}>
            <td className="px-3 py-2 text-right text-[#e0e0e0] whitespace-nowrap">{d.date}</td>
            <td className={`px-3 py-2 text-right ${d.g50 ? 'text-[#D4AF37] font-bold' : 'text-[#e0e0e0]'}`}>{pct(d.gapPct)}</td>
            <td className="px-3 py-2 text-right text-[#6b7280] whitespace-nowrap">${(d.realOpen ?? d.open).toFixed(2)}→${(d.realClose ?? d.close).toFixed(2)}</td>
            <td className="px-3 py-2 text-right text-[#6b7280]">{d.pmh != null ? '$' + d.pmh.toFixed(2) : '—'}</td>
            <td className="px-3 py-2 text-right text-[#e0e0e0]">{d.rthHigh != null ? '$' + d.rthHigh.toFixed(2) : '—'}</td>
            <td className="px-3 py-2 text-right text-[#e0e0e0]">{d.rthLow != null ? '$' + d.rthLow.toFixed(2) : '—'}</td>
            <td className="px-3 py-2 text-right text-[#9ca3af]">{d.highTime || '—'}</td>
            <td className="px-3 py-2 text-right text-[#9ca3af]">{d.lowTime || '—'}</td>
            <td className={`px-3 py-2 text-right ${d.close < d.open ? 'text-[#f87171]' : 'text-[#34d399]'}`}>{d.close < d.open ? '▼' : '▲'}</td>
            {d.c.map((cv: boolean | null, i: number) => (
             <td key={i} className={`px-3 py-2 text-right ${cv === null ? 'text-[#333]' : cv ? 'text-[#f87171]' : 'text-[#34d399]'}`}>
              {cv === null ? '·' : cv ? '▲' : '✓'}
             </td>
            ))}
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      </Panel>

      {/* Chart — click a row above to load */}
      {selectedDay && (
       <Panel title={`${ticker} · ${selectedDay}`} subtitle={`${chartMode === 'single' ? 'Single 5m' : '2-Stack: Daily + 15m'} · click any row to change day`}>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1f2937]">
         <button onClick={() => setChartMode('single')} className={`px-3 py-1 rounded text-sm transition-colors ${chartMode === 'single' ? 'bg-[#D4AF37] text-[#0a0a0a] font-bold' : 'text-[#9ca3af] bg-[#141c2b] border border-[#1f2937]'}`}>Single</button>
         <button onClick={() => setChartMode('2stack')} className={`px-3 py-1 rounded text-sm transition-colors ${chartMode === '2stack' ? 'bg-[#D4AF37] text-[#0a0a0a] font-bold' : 'text-[#9ca3af] bg-[#141c2b] border border-[#1f2937]'}`}>2-Stack</button>
         <button onClick={() => setSelectedDay(null)} className="ml-auto px-3 py-1 rounded text-sm text-[#666] hover:text-[#999] transition-colors">✕ Close</button>
        </div>
        <div className="p-3">
         {chartMode === 'single' ? (
          <ScanMiniChart symbol={ticker} tf="5" date={selectedDay} height={620} settings={DEFAULT_SETTINGS} dark={true} compact />
         ) : (
          <div className="space-y-2">
           <ScanMiniChart symbol={ticker} tf="D" date={selectedDay} height={440} settings={{ ...DEFAULT_SETTINGS, showEma9_20: true }} dark={true} compact />
           <ScanMiniChart symbol={ticker} tf="15" date={selectedDay} height={360} settings={{ ...DEFAULT_SETTINGS, showEma72_89: true, showDevBands72_89: true, showDevBands9_20: true, showDevBands72_89Tight: true }} dark={true} zoomDays={{ before: 3, after: 1 }} />
          </div>
         )}
        </div>
       </Panel>
      )}
     </div>
    )}
    </div>
   </div>
  </div>
 )
}

function MetricCard({ label, value, sub, accent, tone }: { label: string; value: string; sub?: string; accent?: boolean; tone?: 'good' | 'neutral' }) {
 return (
  <div className={`bg-[#0f1623] border rounded-xl p-4 ${accent ? 'border-[#D4AF37]/30' : 'border-[#1f2937]'}`}>
   <div className="text-xs text-[#666] uppercase tracking-wide mb-1">{label}</div>
   <div className={`text-2xl font-bold ${tone === 'good' ? 'text-[#34d399]' : accent ? 'text-[#D4AF37]' : 'text-[#e0e0e0]'}`}>{value}</div>
   {sub && <div className="text-xs text-[#555] mt-1">{sub}</div>}
  </div>
 )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
 return (
  <div className="bg-[#0f1623] border border-[#1f2937] rounded-xl overflow-hidden">
   <div className="px-4 py-3 border-b border-[#1f2937]">
    <div className="text-sm font-bold text-[#e0e0e0]">{title}</div>
    {subtitle && <div className="text-xs text-[#666] mt-0.5">{subtitle}</div>}
   </div>
   {children}
  </div>
 )
}

function TimeStat({ label, value }: { label: string; value: string | null }) {
 return (
  <div>
   <div className="text-xs text-[#666] mb-1">{label}</div>
   <div className="text-2xl font-bold text-[#D4AF37]">{value || '—'}</div>
  </div>
 )
}
