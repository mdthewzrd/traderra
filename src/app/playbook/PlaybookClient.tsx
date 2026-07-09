'use client'

import { useState, useEffect, useRef } from 'react'
import { ScanMiniChart, type ChartSettings, type Timeframe, IND_TEMPLATES, TEMPLATE_IND_KEYS } from '@/app/scanner/page'
// NOTE: flushRef pattern used below to fire pending saves on tab-close / switch
import { createPortal } from 'react-dom'
import { Plus, Trash2, X, Loader2, BookOpen, Clock, Tag, Maximize2 } from 'lucide-react'

// ─── Palette (matches /database & /scanner dark) ──────────
const C = {
  BG: '#08080d', SURFACE: '#0c0c14', SURFACE2: '#10101c', SURFACE3: '#141422',
  BORDER: '#1a1a2e', TEXT: '#e0e0e0', TEXT2: '#b0b0c0', MUTED: '#555570',
  GOLD: '#D4AF37', GOLD_DIM: 'rgba(212,175,55,0.10)', GOLD_BORDER: 'rgba(212,175,55,0.30)',
  RED: '#ef4444', TEAL: '#14b8a6', GREEN: '#34d399', AMBER: '#f59e0b',
}

const STATUSES = ['idea', 'spec', 'scan-built', 'validated', 'live'] as const
const STATUS_COLORS: Record<string, string> = {
  idea: C.MUTED, spec: C.AMBER, 'scan-built': C.TEAL, validated: C.GREEN, live: C.GOLD,
}
const GRADES = ['', 'A+', 'A', 'B', 'C'] as const

interface PlaybookSummary {
  id: string; name: string; status: string; thesis: string | null
  setupType: string | null; tags: string[]; grade: string | null; category: string | null
  createdAt: string; updatedAt: string
}
type SectionData = { text: string; annots: { ref: string; caption?: string }[] }
interface Playbook extends PlaybookSummary {
  sections: Record<string, SectionData> | null
}

// A logged example play against a playbook (mirrors CorpusTrade, carries its own symbol)
interface Trade {
  id: string
  symbol: string
  direction: string
  date: string | null
  entryPrice: number | null
  exitPrice: number | null
  qty: number | null
  grade: string | null
  trendStage: string | null
  routeStart: string | null
  routeEnd: string | null
  sections: Record<string, SectionData> | null
  notes: string | null
}

// Default mini-chart settings for the Chart Viewer (Mike's Bands, matches /scanner + /database)
const VIEWER_SETTINGS: ChartSettings = {
  showEma9_20: false, showEma72_89: true,
  showDevBands9_20: false, showDevBands72_89: true, showDevBands72_89Tight: false,
  showKeyLevels: false, showVwap: true, showPrevClose: true, showAhPmShade: true,
  showVolume: true, showCrosshair: true, showLegend: false,
  ...IND_TEMPLATES.find((t) => t.id === 'mikes-bands')!.settings,
}
// Per-TF defaults: chartDays = total window width; fwd = dayOffset (days forward past D0).
// back-from-D0 = chartDays - fwd. Matches the user's spec table.
const VIEWER_TF_CONFIG: Record<Timeframe, { lbl: string; chartDays: number; fwd: number }> = {
  '5':   { lbl: '5m',  chartDays: 2,  fwd: 1 },   // d-1 → d+1
  '15':  { lbl: '15m', chartDays: 6,  fwd: 1 },   // 5 back + 1 fwd
  '60':  { lbl: '1H',  chartDays: 12, fwd: 2 },   // 10 back + 2 fwd
  '240': { lbl: '4H',  chartDays: 23, fwd: 3 },   // 20 back + 3 fwd
  'D':   { lbl: '1D',  chartDays: 45, fwd: 5 },   // 40 back + 5 fwd
}
const VIEWER_TFS: Timeframe[] = ['5', '15', '60', '240', 'D']

// Timeframe sections for each logged example (mirrors corpus TRADE_SECTIONS)
const TRADE_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'daily', label: 'Daily', hint: 'Daily context for this play.' },
  { key: 'htf', label: 'HTF', hint: 'High timeframe structure on the name.' },
  { key: 'mtf', label: 'MTF', hint: 'Mid timeframe — the setup read.' },
  { key: 'ltf', label: 'LTF', hint: 'Low timeframe — execution + first moves.' },
]

// Document sections — structured around how a setup is actually read + graded.
// Timeframes (Daily/HTF/MTF/LTF) mirror the corpus TRADE_SECTIONS so it feels native.
const PLAYBOOK_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'edge', label: 'The Edge', hint: 'Why does this work? The actual reason for the edge — your thesis in depth.' },
  { key: 'universe', label: 'Universe', hint: 'Ticker filters — price, float, dilution profile, sector, exchange.' },
  { key: 'indicators', label: 'Indicators & Tools', hint: "What's on the charts and what confirms the read — Mike's Bands, VWAP, levels, scans." },
  { key: 'daily', label: 'Daily Context', hint: 'Broader market — indices, sector, what kind of day is it?' },
  { key: 'htf', label: 'HTF Structure', hint: 'High timeframe structure — the big picture on the name.' },
  { key: 'mtf', label: 'MTF Setup', hint: 'Mid timeframe — where on the cycle, the setup read.' },
  { key: 'ltf', label: 'LTF Execution', hint: 'Low timeframe — entry trigger, execution, first moves.' },
  { key: 'aplus', label: 'A+ Characteristics', hint: 'What the best version looks like. The ideal conditions that make it an A+.' },
  { key: 'negatives', label: 'Negative Factors', hint: 'Red flags that degrade it — and hard invalidations: when NOT to take it.' },
  { key: 'management', label: 'Management', hint: 'Entry scaling, stop, targets — feeds the backtest params.' },
  { key: 'examples', label: 'A+ Examples', hint: 'Textbook instances — charts, ticker + dates of perfect plays.' },
]

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function PlaybookClient() {
  const [list, setList] = useState<PlaybookSummary[]>([])
  const [active, setActive] = useState<Playbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [openTradeId, setOpenTradeId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('traderra.pbCollapsed'); return new Set(s ? JSON.parse(s) : []) } catch { return new Set() }
  })
  useEffect(() => { try { localStorage.setItem('traderra.pbCollapsed', JSON.stringify([...collapsed])) } catch {} }, [collapsed])

  const activeRef = useRef<Playbook | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushRef = useRef<() => void>(() => {})
  const tradesRef = useRef<Trade[]>([])
  const tradeTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // load list on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/playbook', { cache: 'no-store' })
        if (!r.ok) { setErr('Not signed in'); setLoading(false); return }
        const j = await r.json()
        setList(j.playbooks ?? [])
      } catch { setErr('Failed to load') }
      setLoading(false)
    })()
  }, [])

  // fire any pending save when the tab hides / closes or the component unmounts
  useEffect(() => {
    const onFlush = () => flushRef.current()
    const onVis = () => { if (document.visibilityState === 'hidden') flushRef.current() }
    window.addEventListener('beforeunload', onFlush)
    window.addEventListener('pagehide', onFlush)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      flushRef.current()
      window.removeEventListener('beforeunload', onFlush)
      window.removeEventListener('pagehide', onFlush)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const open = async (id: string) => {
    flushRef.current()  // persist the current playbook + trades before switching
    setOpening(true)
    setTrades([]); tradesRef.current = []; setOpenTradeId(null)
    try {
      const r = await fetch(`/api/playbook?id=${id}`, { cache: 'no-store' })
      if (r.ok) { const j = await r.json(); const pb = j.playbook; activeRef.current = pb; setActive(pb) }
      const rt = await fetch(`/api/playbook/trades?playbookId=${id}`, { cache: 'no-store' })
      if (rt.ok) { const jt = await rt.json(); tradesRef.current = jt.trades ?? []; setTrades(jt.trades ?? []) }
    } catch { /* ignore */ }
    setOpening(false)
  }

  const createNew = async () => {
    try {
      const r = await fetch('/api/playbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Untitled Strategy' }) })
      if (!r.ok) return
      const j = await r.json()
      const pb = j.playbook
      setList(prev => [{ ...pb, tags: pb.tags ?? [], sections: undefined }, ...prev] as any)
      await open(pb.id)
    } catch { /* ignore */ }
  }

  // persist one snapshot to the API + sync the list summary
  const doSave = (pb: Playbook) => {
    const { id, createdAt, updatedAt, ...fields } = pb
    return fetch('/api/playbook', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pb.id, ...fields }),
    }).then(() => {
      setList(prev => prev.map(x => x.id === pb.id
        ? { id: pb.id, name: pb.name, status: pb.status, thesis: pb.thesis, setupType: pb.setupType, tags: pb.tags, grade: pb.grade, category: pb.category, createdAt: x.createdAt, updatedAt: new Date().toISOString() }
        : x))
    }).catch(() => { /* ignore */ })
  }

  // central patcher: reads the live ref, computes next, schedules a debounced save.
  // The snapshot is captured at schedule time so a switch away can't drop it.
  const patch = (p: Partial<Playbook>) => {
    const base = activeRef.current
    if (!base) return
    const next = { ...base, ...p }
    activeRef.current = next       // sync ref immediately so rapid edits accumulate
    setActive(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      setSaving(false)
      void doSave(next)            // save the captured snapshot (not the ref)
    }, 700)
  }

  // fire any pending saves immediately (playbook + all open trades)
  const flushAll = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current); saveTimer.current = null
      if (activeRef.current) void doSave(activeRef.current)
    }
    for (const tid in tradeTimers.current) {
      clearTimeout(tradeTimers.current[tid])
      const t = tradesRef.current.find(x => x.id === tid)
      if (t) { const { id, ...fields } = t; void fetch('/api/playbook/trades', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tid, ...fields }) }).catch(() => {}) }
    }
    tradeTimers.current = {}
    setSaving(false)
  }
  flushRef.current = flushAll    // keep the ref fresh each render

  const setSection = (key: string, s: SectionData) =>
    patch({ sections: { ...(activeRef.current?.sections ?? {}), [key]: s } })

  // ── Trade (example play) CRUD — own API, same hardened save pattern ──
  const addTrade = async (direction: string) => {
    if (!active) return
    try {
      const r = await fetch('/api/playbook/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playbookId: active.id, direction, symbol: '' }) })
      if (!r.ok) return
      const j = await r.json()
      const next = [...tradesRef.current, j.trade]; tradesRef.current = next; setTrades(next)
      setOpenTradeId(j.trade.id)
    } catch { /* ignore */ }
  }
  const updateTrade = (tradeId: string, p: Partial<Trade>) => {
    const next = tradesRef.current.map(t => t.id === tradeId ? { ...t, ...p } : t)
    tradesRef.current = next; setTrades(next)
    if (tradeTimers.current[tradeId]) clearTimeout(tradeTimers.current[tradeId])
    tradeTimers.current[tradeId] = setTimeout(() => {
      const t = tradesRef.current.find(x => x.id === tradeId)
      if (!t) return
      const { id, ...fields } = t
      void fetch('/api/playbook/trades', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tradeId, ...fields }) }).catch(() => {})
      delete tradeTimers.current[tradeId]
    }, 700)
  }
  const deleteTrade = async (tradeId: string) => {
    if (tradeTimers.current[tradeId]) { clearTimeout(tradeTimers.current[tradeId]); delete tradeTimers.current[tradeId] }
    await fetch(`/api/playbook/trades?id=${tradeId}`, { method: 'DELETE' }).catch(() => {})
    const next = tradesRef.current.filter(t => t.id !== tradeId)
    tradesRef.current = next; setTrades(next)
    if (openTradeId === tradeId) setOpenTradeId(null)
  }

  const addTag = () => {
    const t = tagInput.trim(); if (!t || !active) return
    if (active.tags.includes(t)) { setTagInput(''); return }
    patch({ tags: [...active.tags, t] })
    setTagInput('')
  }
  const removeTag = (t: string) => active && patch({ tags: active.tags.filter(x => x !== t) })

  const del = async () => {
    if (!active || !confirm(`Delete "${active.name}"? This cannot be undone.`)) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    setSaving(false)
    await fetch(`/api/playbook?id=${active.id}`, { method: 'DELETE' })
    setList(prev => prev.filter(x => x.id !== active.id))
    setActive(null); activeRef.current = null
    setTrades([]); tradesRef.current = []; setOpenTradeId(null)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: C.BG, color: C.TEXT }}>
      {/* ── LEFT RAIL ── */}
      <aside className="w-72 shrink-0 border-r flex flex-col" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
        <div className="px-4 py-3.5 border-b flex items-center justify-between" style={{ borderColor: C.BORDER }}>
          <div className="flex items-center gap-2">
            <BookOpen size={16} style={{ color: C.GOLD }} />
            <h1 className="text-sm font-bold tracking-wide" style={{ color: C.GOLD }}>PLAYBOOK</h1>
          </div>
          <button onClick={createNew} title="New strategy"
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-opacity hover:opacity-90"
            style={{ background: C.GOLD, color: C.BG }}>
            <Plus size={13} /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin" size={16} style={{ color: C.MUTED }} /></div>
          ) : list.length === 0 ? (
            <p className="text-xs px-4 py-8 text-center" style={{ color: C.MUTED }}>No strategies yet.<br />Hit <span style={{ color: C.GOLD }}>New</span> to start a playbook.</p>
          ) : (() => {
            // Group playbooks by category → collapsible tree.
            const UNC = '__uncategorized__'
            const groups = new Map<string, PlaybookSummary[]>()
            for (const p of list) {
              const key = (p.category && p.category.trim()) ? p.category.trim() : UNC
              if (!groups.has(key)) groups.set(key, [])
              groups.get(key)!.push(p)
            }
            const keys = [...groups.keys()].sort((a, b) => {
              if (a === UNC) return 1
              if (b === UNC) return -1
              return a.localeCompare(b)
            })
            const toggle = (k: string) => setCollapsed(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
            const Chev = ({ open }: { open: boolean }) =>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s', color: C.MUTED }}><path d="M3 1 L7 5 L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
            return keys.map(k => {
              const items = groups.get(k)!
              const isUnc = k === UNC
              const isOpen = !collapsed.has(k)
              return (
                <div key={k}>
                  <button onClick={() => toggle(k)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 border-b text-[10px] uppercase tracking-wider font-bold sticky top-0"
                    style={{ borderColor: C.BORDER, background: C.SURFACE2, color: isUnc ? C.MUTED : C.GOLD, zIndex: 1 }}>
                    <Chev open={isOpen} />
                    <span className="truncate flex-1 text-left">{isUnc ? 'Uncategorized' : k}</span>
                    <span style={{ color: C.MUTED }}>{items.length}</span>
                  </button>
                  {isOpen && items.map(p => (
                    <button key={p.id} onClick={() => open(p.id)}
                      className="w-full text-left pl-7 pr-4 py-2.5 border-b transition-colors"
                      style={{ borderColor: C.BORDER, background: active?.id === p.id ? C.SURFACE3 : 'transparent' }}
                      onMouseEnter={(e) => { if (active?.id !== p.id) e.currentTarget.style.background = C.SURFACE2 }}
                      onMouseLeave={(e) => { if (active?.id !== p.id) e.currentTarget.style.background = 'transparent' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[p.status] ?? C.MUTED }} />
                        <span className="text-sm font-semibold truncate flex-1" style={{ color: C.TEXT }}>{p.name}</span>
                        {p.grade && <span className="text-[9px] font-bold px-1 rounded" style={{ color: C.GOLD, background: C.GOLD_DIM }}>{p.grade}</span>}
                      </div>
                      {p.thesis && <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: C.MUTED }}>{p.thesis}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        {p.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: C.SURFACE3, color: C.TEXT2 }}>{t}</span>
                        ))}
                        <span className="text-[9px] ml-auto flex items-center gap-0.5" style={{ color: C.MUTED }}><Clock size={9} />{timeAgo(p.updatedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })
          })()}
        </div>
      </aside>

      {/* ── RIGHT: EDITOR ── */}
      <main className="flex-1 overflow-y-auto">
        {err ? (
          <Center><p className="text-sm" style={{ color: C.MUTED }}>{err}</p></Center>
        ) : opening ? (
          <Center><Loader2 className="animate-spin" size={20} style={{ color: C.GOLD }} /></Center>
        ) : !active ? (
          <Center>
            <div className="text-center">
              <BookOpen size={40} className="mx-auto mb-3" style={{ color: C.SURFACE3 }} />
              <p className="text-base font-semibold mb-1" style={{ color: C.TEXT2 }}>Strategy Playbook</p>
              <p className="text-sm mb-4" style={{ color: C.MUTED }}>Brain-dump a setup before we build the scan.<br />Paste charts, define the edge, hand it to Renata.</p>
              <button onClick={createNew} className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg" style={{ background: C.GOLD, color: C.BG }}>
                <Plus size={15} /> New Playbook
              </button>
            </div>
          </Center>
        ) : (
          <div className="max-w-3xl mx-auto px-8 py-6">
            {/* header */}
            <div className="flex items-start gap-3 pb-4 border-b" style={{ borderColor: C.BORDER }}>
              <input value={active.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="flex-1 bg-transparent text-2xl font-bold focus:outline-none"
                style={{ color: C.TEXT }} />
              <div className="flex items-center gap-2 shrink-0">
                {saving ? (
                  <span className="text-[10px] flex items-center gap-1" style={{ color: C.MUTED }}><Loader2 size={11} className="animate-spin" />saving</span>
                ) : (
                  <span className="text-[10px]" style={{ color: C.GREEN }}>✓ saved</span>
                )}
                <select value={active.status} onChange={(e) => patch({ status: e.target.value })}
                  className="text-[11px] font-semibold px-2 py-1 rounded-md border focus:outline-none"
                  style={{ background: C.SURFACE2, borderColor: STATUS_COLORS[active.status] ?? C.BORDER, color: STATUS_COLORS[active.status] ?? C.TEXT2 }}>
                  {STATUSES.map(s => <option key={s} value={s} style={{ color: C.TEXT }}>{s}</option>)}
                </select>
                <button onClick={del} title="Delete" className="p-1.5 rounded-md opacity-40 hover:opacity-100" style={{ color: C.RED }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* thesis one-liner */}
            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>One-Liner Thesis</label>
              <input value={active.thesis ?? ''} placeholder="The edge in a single sentence…"
                onChange={(e) => patch({ thesis: e.target.value })}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT2 }} />
            </div>

            {/* meta row: category + grade + setup type + tags */}
            <div className="grid grid-cols-4 gap-3 mt-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Category</label>
                <input value={active.category ?? ''} placeholder="e.g. Lingua Cycles" list="pb-categories"
                  onChange={(e) => patch({ category: e.target.value || null })}
                  className="w-full mt-1 text-sm border rounded-lg px-3 py-2 focus:outline-none"
                  style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }} />
                <datalist id="pb-categories">
                  {[...new Set(list.map(p => p.category).filter(Boolean) as string[])].sort().map(c => <option key={c} value={c!} />)}
                </datalist>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Grade</label>
                <select value={active.grade ?? ''} onChange={(e) => patch({ grade: e.target.value || null })}
                  className="w-full mt-1 text-sm border rounded-lg px-2 py-2 focus:outline-none"
                  style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }}>
                  {GRADES.map(g => <option key={g} value={g} style={{ color: C.TEXT }}>{g || '—'}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Setup Type</label>
                <input value={active.setupType ?? ''} placeholder="e.g. D1, FRD…"
                  onChange={(e) => patch({ setupType: e.target.value })}
                  className="w-full mt-1 text-sm border rounded-lg px-3 py-2 focus:outline-none"
                  style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Tags</label>
                <input value={tagInput} placeholder="type + Enter"
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  className="w-full mt-1 text-sm border rounded-lg px-3 py-2 focus:outline-none"
                  style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }} />
              </div>
            </div>
            {active.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {active.tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.SURFACE3, color: C.TEXT2 }}>
                    <Tag size={9} />{t}
                    <button onClick={() => removeTag(t)} className="opacity-50 hover:opacity-100" style={{ color: C.MUTED }}><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}

            {/* sections */}
            <div className="mt-6 space-y-5">
              {PLAYBOOK_SECTIONS.map(s => (
                <SectionWithLightbox key={s.key} label={s.label} hint={s.hint}
                  section={active.sections?.[s.key] ?? null}
                  onChange={(data) => setSection(s.key, data)}
                  onImageClick={(ref) => setLightbox(ref)} />
              ))}
            </div>

            {/* setup examples — structured trade logs (like the corpus trade section) */}
            <div className="mt-8 pb-16">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Setup Examples</h2>
                <span className="text-[10px]" style={{ color: C.MUTED }}>— log textbook instances</span>
                <button onClick={() => addTrade('long')} className="ml-auto flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md" style={{ background: C.SURFACE3, color: C.TEXT2, border: `1px solid ${C.BORDER}` }}>
                  <Plus size={12} /> Log Example
                </button>
              </div>
              {trades.length === 0 ? (
                <p className="text-xs px-3 py-6 text-center border rounded-lg" style={{ color: C.MUTED, borderColor: C.BORDER, background: C.SURFACE }}>
                  No examples logged yet. Hit <span style={{ color: C.GOLD }}>Log Example</span> to add one.
                </p>
              ) : (
                <div className="space-y-2">
                  {trades.map(t => (
                    <TradeDocument key={t.id} trade={t}
                      expanded={openTradeId === t.id}
                      onToggle={() => setOpenTradeId(openTradeId === t.id ? null : t.id)}
                      onUpdate={(p) => updateTrade(t.id, p)}
                      onDelete={() => { if (confirm('Delete this example?')) deleteTrade(t.id) }}
                      onImageClick={(ref) => setLightbox(ref)} />
                  ))}
                </div>
              )}
            </div>

            {/* ── CHART VIEWER — compact signal rows → inline mini-chart (separate from the detailed examples above) ── */}
            <PlaybookChartViewer trades={trades} theme={C} />
          </div>
        )}
      </main>

      {/* lightbox */}
      {lightbox && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-8 cursor-zoom-out"
          style={{ background: 'rgba(0,0,0,0.88)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-5 right-5 text-white opacity-70 hover:opacity-100"><X size={28} /></button>
        </div>, document.body)}
    </div>
  )
}

// Section wired to a lightbox handler (kept the paste+debounce logic identical to corpus)
function SectionWithLightbox({ label, hint, section, onChange, onImageClick }: {
  label: string; hint?: string
  section: SectionData | null
  onChange: (s: SectionData) => void
  onImageClick: (ref: string) => void
}) {
  const propText = section?.text ?? ''
  const annots = Array.isArray(section?.annots) ? section!.annots : []
  const [local, setLocal] = useState(propText)
  const pushRef = useRef(propText)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (propText !== pushRef.current && propText !== local) { setLocal(propText); pushRef.current = propText }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propText])
  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (local !== pushRef.current) { pushRef.current = local; onChange({ text: local, annots }) }
  }
  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile(); if (!file) continue
        const reader = new FileReader()
        reader.onload = () => { pushRef.current = local; onChange({ text: local, annots: [...annots, { ref: reader.result as string, caption: '' }] }) }
        reader.readAsDataURL(file)
        e.preventDefault()
        return
      }
    }
  }
  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>{label}</label>
        {hint && <p className="text-[10px] mt-0.5" style={{ color: C.MUTED }}>{hint}</p>}
      </div>
      <textarea value={local} onChange={(e) => {
          setLocal(e.target.value)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(flush, 500)
        }} onBlur={flush} onPaste={onPaste}
        placeholder="Write here… (paste screenshots straight in)"
        className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none min-h-[120px]"
        style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }} />
      {annots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {annots.map((a, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.ref} alt={a.caption ?? ''} onClick={() => onImageClick(a.ref)}
                className="w-56 h-36 object-cover rounded-lg border cursor-zoom-in"
                style={{ borderColor: C.BORDER }} />
              <button onClick={() => { pushRef.current = local; onChange({ text: local, annots: annots.filter((_, idx) => idx !== i) }) }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
                style={{ background: C.RED, color: '#fff' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── One logged example play (expandable) — reuses the timeframe sections ───
function TradeDocument({ trade, expanded, onToggle, onUpdate, onDelete, onImageClick }: {
  trade: Trade
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: Partial<Trade>) => void
  onDelete: () => void
  onImageClick: (ref: string) => void
}) {
  const isShort = trade.direction === 'short'
  const dColor = isShort ? C.RED : C.GREEN
  const updSec = (key: string, s: SectionData) => onUpdate({ sections: { ...(trade.sections ?? {}), [key]: s } })
  const input = (extra?: React.CSSProperties): React.CSSProperties => ({ background: C.BG, borderColor: C.BORDER, color: C.TEXT, ...extra })
  return (
    <div className="border rounded-lg" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
      {/* header — click to expand/collapse */}
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onToggle}
        style={{ borderBottom: expanded ? `1px solid ${C.BORDER}` : 'none' }}>
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: dColor + '22', color: dColor }}>{trade.direction}</span>
        <input value={trade.symbol} placeholder="TICKER" onClick={(e) => e.stopPropagation()} onChange={(e) => onUpdate({ symbol: e.target.value.toUpperCase() })}
          className="bg-transparent text-sm font-bold uppercase w-28 focus:outline-none" style={{ color: C.TEXT }} />
        {trade.grade && <span className="text-[9px] font-bold px-1 rounded" style={{ color: C.GOLD, background: C.GOLD_DIM }}>{trade.grade}</span>}
        {trade.date && <span className="text-[10px] ml-1" style={{ color: C.MUTED }}>{trade.date}</span>}
        {trade.entryPrice != null && trade.exitPrice != null && trade.qty && (
          <span className="text-[10px]" style={{ color: C.TEXT2 }}>· {(((trade.exitPrice - trade.entryPrice) * (isShort ? -1 : 1)) * trade.qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        )}
        <span className="text-[10px] ml-auto" style={{ color: C.MUTED }}>{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div className="px-3 py-3 space-y-4">
          {/* meta row 1 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Labeled label="Dir">
              <select value={trade.direction} onChange={(e) => onUpdate({ direction: e.target.value })} className="text-xs border rounded px-1.5 py-1" style={input()}>
                <option value="short">short</option><option value="long">long</option>
              </select>
            </Labeled>
            <Labeled label="Date"><input type="date" value={trade.date ?? ''} onChange={(e) => onUpdate({ date: e.target.value || null })} className="text-xs border rounded px-1.5 py-1 w-[124px]" style={input()} /></Labeled>
            <Labeled label="Grade">
              <select value={trade.grade ?? ''} onChange={(e) => onUpdate({ grade: e.target.value || null })} className="text-xs border rounded px-1.5 py-1" style={input()}>
                {GRADES.map(g => <option key={g} value={g}>{g || '—'}</option>)}
              </select>
            </Labeled>
            <Labeled label="Entry"><input type="number" step="0.01" value={trade.entryPrice ?? ''} onChange={(e) => onUpdate({ entryPrice: e.target.value ? parseFloat(e.target.value) : null })} className="text-xs border rounded px-1.5 py-1 w-20" style={input()} /></Labeled>
            <Labeled label="Exit"><input type="number" step="0.01" value={trade.exitPrice ?? ''} onChange={(e) => onUpdate({ exitPrice: e.target.value ? parseFloat(e.target.value) : null })} className="text-xs border rounded px-1.5 py-1 w-20" style={input()} /></Labeled>
            <Labeled label="Qty"><input type="number" value={trade.qty ?? ''} onChange={(e) => onUpdate({ qty: e.target.value ? parseInt(e.target.value) : null })} className="text-xs border rounded px-1.5 py-1 w-16" style={input()} /></Labeled>
          </div>
          {/* meta row 2: stage + route */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Labeled label="Stage"><input value={trade.trendStage ?? ''} placeholder="e.g. Backside" onChange={(e) => onUpdate({ trendStage: e.target.value || null })} className="text-xs border rounded px-1.5 py-1 w-32" style={input()} /></Labeled>
            <Labeled label="Route">
              <div className="flex items-center gap-1">
                <input value={trade.routeStart ?? ''} placeholder="start" onChange={(e) => onUpdate({ routeStart: e.target.value || null })} className="text-xs border rounded px-1.5 py-1 w-24" style={input()} />
                <span style={{ color: C.MUTED }}>→</span>
                <input value={trade.routeEnd ?? ''} placeholder="end" onChange={(e) => onUpdate({ routeEnd: e.target.value || null })} className="text-xs border rounded px-1.5 py-1 w-24" style={input()} />
              </div>
            </Labeled>
          </div>
          {/* timeframe sections — paste charts for this play */}
          {TRADE_SECTIONS.map(s => (
            <SectionWithLightbox key={s.key} label={s.label} hint={s.hint}
              section={trade.sections?.[s.key] ?? null}
              onChange={(data) => updSec(s.key, data)}
              onImageClick={onImageClick} />
          ))}
          {/* notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Notes</label>
            <textarea value={trade.notes ?? ''} placeholder="Notes on this example…" onChange={(e) => onUpdate({ notes: e.target.value })}
              className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[60px]" style={input({ background: C.BG })} />
          </div>
          <button onClick={onDelete} className="text-[10px] opacity-50 hover:opacity-100" style={{ color: C.RED }}>Delete this example</button>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PlaybookChartViewer — compact signal rows + inline mini-chart.
   Separate from the detailed examples area above. Each dated example
   becomes a clickable row; clicking loads an interactive multi-TF chart
   parked at the example's D0 date. Reuses the scanner's ScanMiniChart.
   ═══════════════════════════════════════════════════════════════ */
function PlaybookChartViewer({ trades, theme }: { trades: Trade[]; theme: any }) {
  const C = theme
  const [open, setOpen] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tf, setTf] = useState<Timeframe>('15')
  const [dayOffset, setDayOffset] = useState(1)        // forward offset past D0 (resets per TF)
  const [settings, setSettings] = useState<ChartSettings>(() => ({ ...VIEWER_SETTINGS }))
  const [showInd, setShowInd] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const cfg = VIEWER_TF_CONFIG[tf]

  const withDates = trades
    .filter((t) => t.date && t.symbol)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  if (withDates.length === 0) return null

  const selected = withDates.find((t) => t.id === selectedId) || null
  const row: React.CSSProperties = { padding: '6px 10px', borderBottom: `1px solid ${C.BORDER}` }

  const changeTf = (newTf: Timeframe) => {
    setTf(newTf)
    setDayOffset(VIEWER_TF_CONFIG[newTf].fwd)   // reset forward offset to that TF's default
  }
  const toggle = (key: keyof ChartSettings) => setSettings((s) => ({ ...s, [key]: !s[key] }))
  const applyTemplate = (id: string) => {
    const t = IND_TEMPLATES.find((x) => x.id === id)
    if (t) setSettings((s) => ({ ...s, ...t.settings }))
  }

  // Shared toolbar JSX: TF buttons + nav + fullscreen + indicators (used inline AND in fullscreen)
  // Rendered as a FUNCTION (not a component) so toggling showInd doesn't remount the chart canvas.
  const renderToolbar = (compactNav = false) => (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider font-bold mr-1" style={{ color: C.MUTED }}>{selected?.symbol}</span>
      <span className="text-[10px] font-mono mr-2" style={{ color: C.MUTED }}>{selected?.date}</span>
      {VIEWER_TFS.map((t) => (
        <button key={t} onClick={() => changeTf(t)}
          className="text-[10px] px-2 py-0.5 rounded font-mono transition-colors"
          style={tf === t ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
          {VIEWER_TF_CONFIG[t].lbl}
        </button>
      ))}
      {!compactNav && (<>
        <span className="w-px h-3 mx-1" style={{ background: C.BORDER }} />
        <button onClick={() => setDayOffset((p) => p - 1)} title="Pan back 1 day" className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>◀</button>
        <button onClick={() => setDayOffset(cfg.fwd)} title="Reset to default D0 window" className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ color: C.BG, background: C.GOLD }}>D0</button>
        <button onClick={() => setDayOffset((p) => p + 1)} title="Pan forward 1 day" className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▶</button>
        <button onClick={() => setDayOffset((p) => p + 3)} title="Forward 3 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+3d</button>
        <button onClick={() => setDayOffset((p) => p + 7)} title="Forward 7 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+7d</button>
        <button onClick={() => setDayOffset((p) => p + 14)} title="Forward 14 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+14d</button>
      </>)}
      <button onClick={() => setFullscreen((f) => !f)} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="ml-1 p-0.5 rounded flex items-center justify-center transition-colors hover:opacity-100"
        style={{ color: C.MUTED, background: fullscreen ? C.GOLD_DIM : C.SURFACE2, border: `1px solid ${fullscreen ? C.GOLD_BORDER : C.BORDER}`, opacity: 0.85 }}>
        <Maximize2 className="w-3 h-3" />
      </button>
      <button onClick={() => setShowInd((s) => !s)} title="Indicator toggles"
        className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
        style={showInd ? { color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` } : { color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>⚙ Ind</button>
      {showInd && (
        <div className="flex flex-wrap gap-0.5 w-full mt-1">
          {IND_TEMPLATES.map((tpl) => (
            <button key={tpl.id} onClick={() => applyTemplate(tpl.id)}
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>{tpl.name}</button>
          ))}
          {TEMPLATE_IND_KEYS.map(([key, label]) => (
            <button key={key} onClick={() => toggle(key)}
              className="text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors"
              style={settings[key] ? { color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` } : { color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>{label}</button>
          ))}
        </div>
      )}
    </div>
  )

  const chart = (height: number) => selected && (
    <ScanMiniChart
      symbol={selected.symbol}
      tf={tf}
      date={selected.date!}
      height={height}
      settings={settings}
      dark={true}
      dayOffset={dayOffset}
      chartDays={cfg.chartDays}
      compact
    />
  )

  return (
    <div className="mt-6 pb-16">
      {/* collapsible header */}
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 mb-3 w-full">
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s', color: C.MUTED }}>
          <path d="M3 1 L7 5 L3 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
        <h2 className="text-xs uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>A+ Chart Viewer</h2>
        <span className="text-[10px]" style={{ color: C.MUTED }}>— {withDates.length} dated examples · click a row to load its chart at D0</span>
      </button>

      {open && (
        <>
          {/* compact signal rows */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: C.BORDER, background: C.SURFACE }}>
            <div className="grid grid-cols-[88px_1fr_56px_36px_1fr_24px] gap-2 px-3 py-1.5 text-[9px] uppercase tracking-wider font-bold border-b" style={{ color: C.MUTED, borderColor: C.BORDER, background: C.SURFACE2 }}>
              <span>Date</span><span>Symbol</span><span>Dir</span><span>Grd</span><span>Stage</span><span></span>
            </div>
            {withDates.map((t) => {
              const isSel = selectedId === t.id
              return (
                <div key={t.id}
                  onClick={() => setSelectedId(isSel ? null : t.id)}
                  className="grid grid-cols-[88px_1fr_56px_36px_1fr_24px] gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors items-center"
                  style={{ ...row, background: isSel ? C.SURFACE3 : 'transparent', color: C.TEXT }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = C.SURFACE2 }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                  <span className="font-mono text-[11px]" style={{ color: C.MUTED }}>{t.date}</span>
                  <span className="font-bold tracking-wide">{t.symbol}</span>
                  <span className="text-[10px] uppercase font-bold" style={{ color: t.direction === 'short' ? C.RED : C.GREEN }}>{t.direction === 'short' ? 'SH' : 'L'}</span>
                  <span className="text-[10px] font-bold" style={{ color: t.grade === 'A+' ? C.GOLD : C.TEXT2 }}>{t.grade || '–'}</span>
                  <span className="text-[10px] truncate" style={{ color: C.TEXT2 }}>{t.trendStage || ''}</span>
                  <span className="text-[10px] text-center" style={{ color: isSel ? C.GOLD : C.MUTED }}>{isSel ? '▲' : '▾'}</span>
                </div>
              )
            })}
          </div>

          {/* inline mini-chart + toolbar */}
          {selected && (
            <div className="mt-3 border rounded-lg p-3" style={{ borderColor: C.BORDER, background: C.BG }}>
              {renderToolbar()}
              <div className="mt-2">{chart(420)}</div>
            </div>
          )}
        </>
      )}

      {/* FULLSCREEN overlay */}
      {fullscreen && selected && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.BG }}>
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: C.BORDER }}>
            {renderToolbar(true)}
            <button onClick={() => setFullscreen(false)} className="p-1" style={{ color: C.MUTED }}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 min-h-0 p-3">{chart(Math.max(400, typeof window !== 'undefined' ? window.innerHeight - 100 : 700))}</div>
        </div>, document.body)}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase" style={{ color: C.MUTED }}>{label}</span>
      {children}
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full flex items-center justify-center">{children}</div>
}
