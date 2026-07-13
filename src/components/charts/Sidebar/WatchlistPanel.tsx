'use client'

import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { useWatchlistStore } from '@/stores/charts/watchlistStore'
import { useChartStore } from '@/stores/charts/chartStore'

/**
 * WatchlistPanel — live, multi-list watchlist for the charts sidebar.
 *
 * - Tab strip (click switch, double-click rename, + add, × delete)
 * - Live columns: LAST / CHG / % / VOL via /api/watchlist-quotes
 * - Refresh: on mount, on list/symbol change, on window focus (no timer)
 * - Click symbol row → loads chart (scanNavigate), active row synced from store
 * - Column settings popover (persisted to localStorage)
 * - Bulk paste-add (comma / space / newline separated)
 */

interface Quote { last: number | null; chg: number | null; chgPct: number | null; vol: number | null }

const COLS = [
  { key: 'sym', label: 'SYM', align: 'left' as const, grow: true },
  { key: 'last', label: 'LAST', align: 'right' as const },
  { key: 'chgPct', label: '%', align: 'right' as const },
  { key: 'chg', label: 'CHG', align: 'right' as const },
  { key: 'vol', label: 'VOL', align: 'right' as const },
]
const COL_STORAGE = 'traderra-wl-cols'
const DEFAULT_COLS = ['sym', 'last', 'chgPct', 'vol']

const C = {
  bg: '#0a0c12', panel: '#0d1018', border: '#222840', borderSoft: '#1a2030',
  muted: '#4a6080', text: '#dde3f0', active: '#1a2238', activeBd: '#6878a8',
  up: '#4ade80', dn: '#ff6b6b', gold: '#a855f7',
}

function loadCols(): string[] {
  try { const p = JSON.parse(localStorage.getItem(COL_STORAGE) || ''); if (Array.isArray(p) && p.includes('sym')) return p } catch {}
  return DEFAULT_COLS.slice()
}

function fmtVol(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'
  return String(v)
}
function fmt2(v: number | null): string { return v == null ? '—' : v.toFixed(2) }
function signed2(v: number | null): string { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) }

export function WatchlistPanel() {
  const lists = useWatchlistStore((s) => s.lists)
  const activeIdx = useWatchlistStore((s) => s.activeIdx)
  const switchList = useWatchlistStore((s) => s.switchList)
  const createList = useWatchlistStore((s) => s.createList)
  const deleteList = useWatchlistStore((s) => s.deleteList)
  const renameList = useWatchlistStore((s) => s.renameList)
  const addSymbol = useWatchlistStore((s) => s.addSymbol)
  const removeSymbol = useWatchlistStore((s) => s.removeSymbol)
  const reorderSymbols = useWatchlistStore((s) => s.reorderSymbols)
  const setNote = useWatchlistStore((s) => s.setNote)
  const scanNavigate = useChartStore((s) => s.scanNavigate)
  const chartSymbol = useChartStore((s) => s.symbol)

  const active = lists[activeIdx]
  const syms = active?.syms || []
  const meta = active?.meta || {}
  const symsKey = syms.join(',')

  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [visibleCols, setVisibleCols] = useState<string[]>(loadCols)
  const [colsOpen, setColsOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState('')
  const renameRef = useRef<HTMLInputElement>(null)

  // ---- quote refresh (focus + change only) ----
  const refresh = useCallback(async () => {
    const s = symsKey.split(',').filter(Boolean)
    if (!s.length) { setQuotes({}); return }
    setRefreshing(true)
    try {
      const r = await fetch('/api/watchlist-quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: s }),
      })
      if (r.ok) setQuotes((await r.json()).quotes || {})
    } catch {}
    setRefreshing(false)
  }, [symsKey])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const onFocus = () => refresh()
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis) }
  }, [refresh])

  // ---- column config persistence ----
  useEffect(() => { try { localStorage.setItem(COL_STORAGE, JSON.stringify(visibleCols)) } catch {} }, [visibleCols])

  // ---- rename handling ----
  useEffect(() => {
    if (renaming) { renameRef.current?.focus(); renameRef.current?.select() }
  }, [renaming])
  const startRename = () => { setRenameVal(active?.name || ''); setRenaming(true) }
  const commitRename = () => { if (renameVal.trim()) renameList(renameVal); setRenaming(false) }

  // ---- add (bulk paste) ----
  const [addVal, setAddVal] = useState('')
  const commitAdd = () => {
    const parts = addVal.toUpperCase().split(/[\s,\n]+/).filter(Boolean)
    if (parts.length) parts.forEach(addSymbol)
    setAddVal('')
  }

  // ---- CSV export / import ----
  const fileRef = useRef<HTMLInputElement>(null)
  const exportCsv = () => {
    const esc = (s: string) => /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    const csv = 'symbol,note\n' + syms.map(s => `${s},${esc(meta[s]?.note || '')}`).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `watchlist-${(active?.name || 'export').toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importCsv = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const start = lines[0]?.toLowerCase().startsWith('symbol') ? 1 : 0
      for (const line of lines.slice(start)) {
        const idx = line.indexOf(',')
        let sym: string, note: string
        if (idx === -1) { sym = line; note = '' }
        else { sym = line.slice(0, idx); note = line.slice(idx + 1) }
        sym = sym.replace(/^"|"$/g, '').trim().toUpperCase()
        note = note.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
        if (sym) { addSymbol(sym); if (note) setNote(sym, note) }
      }
    }
    reader.readAsText(file)
  }

  // ---- drag reorder symbols ----
  const dragSym = useRef<string | null>(null)
  const onDrop = (target: string) => {
    const src = dragSym.current
    if (!src || src === target) return
    const arr = [...syms]
    const from = arr.indexOf(src), to = arr.indexOf(target)
    arr.splice(from, 1); arr.splice(to, 0, src)
    reorderSymbols(arr)
    dragSym.current = null
  }

  const loadChart = (sym: string) => {
    scanNavigate(sym, null)
    ;(window as any).symbol = sym
    ;(window as any).loadChart?.(sym)
  }

  const colWidths = visibleCols.map(k => COLS.find(c => c.key === k)!.grow ? '1 1 0' : '0 0 56px').join(' ')

  return (
    <div id="wl-section" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
      {/* ---- Tab strip ---- */}
      <div style={{ display: 'flex', alignItems: 'stretch', background: C.bg, borderBottom: `1px solid ${C.border}`, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'thin' }}>
        {lists.map((l, i) => (
          <div
            key={l.id || i}
            onClick={() => switchList(i)}
            title={l.name}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
              borderBottom: i === activeIdx ? `2px solid ${C.activeBd}` : '2px solid transparent',
              color: i === activeIdx ? C.text : C.muted,
              background: i === activeIdx ? C.panel : 'transparent',
            }}
          >
            <span onDoubleClick={(e) => { e.stopPropagation(); switchList(i); startRename() }}>{l.name}</span>
            {lists.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); deleteList() }}
                style={{ opacity: 0.5, paddingLeft: 2 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
              >×</span>
            )}
          </div>
        ))}
        <button
          onClick={() => createList('New List')}
          title="New watchlist"
          style={{ background: 'none', border: 'none', color: C.muted, fontSize: 14, padding: '0 8px', cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.gold)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
        >+</button>
      </div>

      {/* ---- toolbar: rename / cols / refresh ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: C.panel, borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0, position: 'relative' }}>
        {renaming ? (
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false) }}
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.activeBd}`, color: C.text, fontSize: 11, padding: '2px 6px', borderRadius: 3, outline: 'none' }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 11, color: C.muted, fontWeight: 700 }} onDoubleClick={startRename}>
            {syms.length} symbols
          </span>
        )}
        <button onClick={startRename} title="Rename list" style={toolBtn}>✏</button>
        <button onClick={() => setColsOpen(v => !v)} title="Columns" style={{ ...toolBtn, color: colsOpen ? C.gold : C.muted }}>⚙</button>
        <button onClick={refresh} title="Refresh quotes" style={{ ...toolBtn, opacity: refreshing ? 0.4 : 1 }}>↻</button>
        <button onClick={exportCsv} title="Export CSV" style={toolBtn}>⬇</button>
        <button onClick={() => fileRef.current?.click()} title="Import CSV" style={toolBtn}>⬆</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = '' }} />

        {colsOpen && (
          <div style={{ position: 'absolute', top: '100%', right: 8, zIndex: 50, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,.5)', minWidth: 110 }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, marginBottom: 4 }}>COLUMNS</div>
            {COLS.map(c => {
              const on = visibleCols.includes(c.key)
              return (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.text, cursor: 'pointer', padding: '2px 0' }}>
                  <input type="checkbox" checked={on} disabled={c.key === 'sym'} onChange={() => {
                    setVisibleCols(prev => on ? prev.filter(k => k !== c.key) : prev.includes(c.key) ? prev : [...prev, c.key])
                  }} />
                  {c.label}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- column header ---- */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 10px', background: C.bg, borderBottom: `1px solid ${C.borderSoft}`, fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
        {visibleCols.map(k => {
          const c = COLS.find(x => x.key === k)!
          return <div key={k} style={{ flex: c.grow ? '1 1 0' : '0 0 56px', textAlign: c.align, minWidth: 0 }}>{c.label}</div>
        })}
      </div>

      {/* ---- rows ---- */}
      <div id="wl-list" style={{ flex: '1 1 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {syms.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 11 }}>No symbols. Add one below.</div>
        )}
        {syms.map(sym => {
          const q = quotes[sym] || null
          const isActive = chartSymbol === sym
          const pct = q?.chgPct
          const color = pct == null ? C.muted : pct >= 0 ? C.up : C.dn
          return (
            <div
              key={sym}
              title={meta[sym]?.note ? `${sym} — ${meta[sym].note}` : sym}
              draggable
              onDragStart={() => { dragSym.current = sym }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(sym)}
              onClick={() => loadChart(sym)}
              style={{
                display: 'flex', gap: 4, padding: '5px 10px', cursor: 'pointer', fontSize: 11,
                borderBottom: `1px solid ${C.borderSoft}`, alignItems: 'center',
                background: isActive ? C.active : 'transparent',
                borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.panel }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {visibleCols.map(k => {
                const c = COLS.find(x => x.key === k)!
                let val = sym
                if (k === 'last') val = fmt2(q?.last ?? null)
                if (k === 'chg') val = signed2(q?.chg ?? null)
                if (k === 'chgPct') val = pct == null ? '—' : (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%'
                if (k === 'vol') val = fmtVol(q?.vol ?? null)
                return (
                  <div
                    key={k}
                    style={{
                      flex: c.grow ? '1 1 0' : '0 0 56px', textAlign: c.align, minWidth: 0,
                      fontWeight: k === 'sym' ? 700 : 400,
                      color: k === 'sym' ? (isActive ? C.gold : C.text) : (k === 'last' ? C.text : color),
                      fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {k === 'sym' ? (
                      <>
                        {meta[sym]?.note && <span style={{ marginRight: 3, color: C.gold, fontSize: 8 }}>●</span>}
                        {val}
                        <span
                          onClick={(e) => { e.stopPropagation(); const n = prompt('Note for ' + sym + ':', meta[sym]?.note || ''); if (n !== null) setNote(sym, n) }}
                          style={{ marginLeft: 4, opacity: 0.3, color: C.muted }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                        >✏</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); removeSymbol(sym) }}
                          style={{ marginLeft: 2, opacity: 0.3, color: C.dn }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.3')}
                        >✕</span>
                      </>
                    ) : val}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ---- add (bulk) ---- */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 8px', background: C.panel, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <input
          value={addVal}
          onChange={(e) => setAddVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitAdd() }}
          placeholder="+ symbol (paste list ok)"
          style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontSize: 11, padding: '4px 8px', borderRadius: 3, outline: 'none' }}
        />
        <button onClick={commitAdd} style={{ background: C.borderSoft, border: `1px solid ${C.border}`, color: C.text, fontSize: 11, padding: '0 10px', borderRadius: 3, cursor: 'pointer' }}>+</button>
      </div>
    </div>
  )
}

const toolBtn: CSSProperties = {
  background: 'none', border: `1px solid ${C.border}`, color: C.muted,
  fontSize: 11, padding: '1px 5px', borderRadius: 3, cursor: 'pointer', lineHeight: 1.4,
}
