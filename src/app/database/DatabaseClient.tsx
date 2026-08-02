'use client'

import { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, createColumnHelper, type ColumnDef, type SortingState,
} from '@tanstack/react-table'
import {
  Database, X, Trash2, Copy, Tag, Loader2, Image as ImageIcon,
  Inbox, Check, Upload, Layers, AlertCircle, CheckCircle2, BarChart3, Plus,
  ArrowUpDown, ArrowUp, ArrowDown, Sun, Moon, Filter, Maximize2, Settings,
} from 'lucide-react'
import { BlockNoteEditor } from '@/components/journal/BlockNoteEditor'
import { ScanMiniChart, ChartSettings, Timeframe, IND_TEMPLATES, TEMPLATE_IND_KEYS } from '@/app/scanner/page'

// ─── Palette (matches /scanner exactly) ──────────────────
// Theme palettes — mirrors /scanner dark + light
const DARK = {
  BG: '#08080d', SURFACE: '#0c0c14', SURFACE2: '#10101c', SURFACE3: '#141422',
  BORDER: '#1a1a2e', TEXT: '#e0e0e0', TEXT2: '#b0b0c0', MUTED: '#555570',
  GOLD: '#D4AF37', GOLD_DIM: 'rgba(212,175,55,0.10)', GOLD_BORDER: 'rgba(212,175,55,0.30)',
  RED: '#ef4444', TEAL: '#14b8a6', GREEN: '#34d399', AMBER: '#f59e0b',
}
const LIGHT_THEME = {
  BG: '#f8f8fa', SURFACE: '#ffffff', SURFACE2: '#f0f0f4', SURFACE3: '#e8e8ee',
  BORDER: '#d0d0dc', TEXT: '#1a1a2e', TEXT2: '#4a4a60', MUTED: '#8a8aa0',
  GOLD: '#D4AF37', GOLD_DIM: 'rgba(212,175,55,0.12)', GOLD_BORDER: 'rgba(212,175,55,0.40)',
  RED: '#dc2626', TEAL: '#0d9488', GREEN: '#16a34a', AMBER: '#d97706',
}
// Theme context — every component reads palette via useTheme() so the toggle re-renders all.
const ThemeContext = createContext(DARK)
const useTheme = () => useContext(ThemeContext)
// @ts-ignore legacy alias — some module-scope consts (SETUP_TYPES etc.) reference via C.X
const C = DARK

const SETUP_TYPES = ['D1', 'FRD', 'Backside', 'LC FRD', 'Structure', 'Long'] as const
const SETUP_DETAILS: Record<string, string[]> = {
  D1: ['D1 Gap & Crap', 'D1 Dilutive'],
  FRD: ['FRD-ET 2-leg', 'FRD-ET 1-leg', 'FRD-TB'],
  Backside: ['Backside Cont', 'Backside Reset', 'Backside Extreme'],
  'LC FRD': ['LC FRD ET', 'LC FRD TB'],
  Structure: ['Consolidation Sweep', 'Breakout', 'Breakdown'],
  Long: ['Uptrend Cont', 'Euphoric Low', 'Euphoric Bottom', 'Trendbreak'],
}
const GRADES = ['A+', 'A', 'B+', 'B', 'C'] as const
const GRADE_COLORS: Record<string, { c: string; b: string }> = {
  'A+': { c: '#34d399', b: 'rgba(52,211,153,0.35)' },
  'A': { c: C.GOLD, b: C.GOLD_BORDER },
  'B': { c: '#f59e0b', b: 'rgba(245,158,11,0.35)' },
}
const ALL_SETUPS = [...new Set(Object.values(SETUP_DETAILS).flat())]

// ─── Filter definitions for the unified filter popup ──
type FilterType = 'text' | 'enum' | 'boolean' | 'date' | 'number'
interface FilterDef {
  id: string
  label: string
  type: FilterType
  options?: readonly string[]
  multi?: boolean  // enum rendered as multi-select (OR within column)
}

// Reuse the scanner's mini chart. Default layout = Mike's Bands (matches /scanner & /live-feed).
// Actual settings live in RowDrawer state so the indicator toggles take effect.
const DEFAULT_SETTINGS: ChartSettings = {
  showEma9_20: false, showEma72_89: false,
  showDevBands9_20: false, showDevBands72_89: false, showDevBands72_89Tight: false,
  showKeyLevels: false, showVwap: true, showPrevClose: true, showAhPmShade: true,
  showVolume: true, showCrosshair: true, showLegend: false,
  ...IND_TEMPLATES.find((t) => t.id === 'mikes-bands')!.settings,
}
const TF_OPTIONS: Timeframe[] = ['D', '240', '120', '60', '15', '5']
const TF_LABELS: Record<Timeframe, string> = { D: '1D', '240': '4H', '120': '2H', '60': '1H', '15': '15m', '5': '5m' }

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v ? { ...(fallback as any), ...JSON.parse(v) } : fallback } catch { return fallback }
}
function loadVal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return (v ?? (fallback as any)) as T } catch { return fallback }
}

interface CorpusRow {
  id: string
  scanSources: string[]
  symbol: string
  signalDate: string
  metrics: any
  setupType: string | null
  setup: string | null
  grade: string | null
  move: string | null
  tags: string[]
  notes: string | null
  annotations: any
  status: string
  customValues: Record<string, any> | null
  createdAt: string
  updatedAt: string
}

interface CorpusTrade {
  id: string
  direction: string
  routeStart: string | null
  routeEnd: string | null
  entryPrice: number | null
  exitPrice: number | null
  qty: number | null
  trendStage: string | null
  grade: string | null
  sections: { text: string; annots: { ref: string; caption?: string }[] } | null
  notes: string | null
  date: string | null
  setup?: string | null
}

type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date' | 'grade' | 'tags'
interface CorpusField {
  id: string
  name: string
  type: FieldType
  options: string[]
  colors: Record<string, string> | null
  order: number
}
const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text', number: 'Number', select: 'Dropdown',
  multiselect: 'Multi-Select', boolean: 'Checkbox', date: 'Date',
  grade: 'Grade',
  tags: 'Tags',
}
// Color palette for option chips (cycled on click in FieldModal / inline)
const PALETTE = ['#D4AF37', '#34d399', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7', '#3b82f6', '#ec4899']

interface ScanItem {
  id: string
  name: string
  strategy: string
  resultCount: number
  tags: string[]
}

// ─── Themed select — universal dark popover dropdown (portaled to body so it never clips) ──
function ThemedSelect({
  value, options, colors, onChange, placeholder = '—', allowCreate, onCreate, wide, mini,
}: {
  value: string | null
  options: readonly string[]
  colors?: Record<string, string>   // label → hex
  onChange: (v: string | null) => void
  placeholder?: string
  allowCreate?: boolean
  onCreate?: (label: string) => void
  wide?: boolean
  mini?: boolean
}) {
  const C = useTheme()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuId = useRef('ts-menu-' + Math.random().toString(36).slice(2)).current

  useEffect(() => {
    if (!open) return
    const close = () => { setOpen(false); setQ('') }
    const onDoc = (e: MouseEvent) => {
      const menu = document.getElementById(menuId)
      if (btnRef.current?.contains(e.target as Node)) return
      if (menu?.contains(e.target as Node)) return
      close()
    }
    const onScroll = () => close()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true) }
  }, [open, menuId])

  const toggle = () => {
    if (open) { setOpen(false); setQ(''); return }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(true)
  }
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options
  const canCreate = allowCreate && onCreate && q.trim() && !options.some((o) => o.toLowerCase() === q.trim().toLowerCase())
  const spaceBelow = rect ? Math.max(0, window.innerHeight - rect.bottom) : 400
  const spaceAbove = rect ? Math.max(0, rect.top) : 400
  const openUp = rect ? (spaceBelow < 120 && spaceAbove > spaceBelow) : false
  const availH = openUp ? spaceAbove - 12 : Math.max(120, spaceBelow - 12)
  const menuH = Math.min(300, availH)
  const menuTop = !rect ? 0 : openUp ? (rect.top - menuH - 4) : (rect.bottom + 2)

  const vc = value ? colors?.[value] : undefined
  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className={`border rounded ${mini ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} font-semibold cursor-pointer flex items-center gap-1 transition-colors w-full`}
        style={{
          color: value ? (vc ?? C.TEXT) : C.MUTED,
          borderColor: value && vc ? `${vc}55` : C.BORDER,
          background: value && vc ? `${vc}1a` : C.SURFACE,
          minWidth: wide ? 90 : undefined,
        }}>
        <span className="flex-1 text-left truncate">{value ?? placeholder}</span>
        <span style={{ color: C.MUTED, fontSize: 8 }}>▼</span>
      </button>
      {open && rect && typeof document !== 'undefined' && createPortal(
        <div id={menuId} className="rounded-md border shadow-2xl py-1 flex flex-col"
          style={{ position: 'fixed', top: menuTop, left: rect.left, zIndex: 200,
            background: C.SURFACE, borderColor: C.BORDER, minWidth: Math.max(rect.width, 150), maxWidth: 230 }}>
          <div className="px-1.5 pb-1 shrink-0">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="w-full border rounded px-1.5 py-1 text-xs focus:outline-none" style={{ background: C.SURFACE2, borderColor: C.BORDER, color: C.TEXT }} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: menuH - 38 }}>
            {filtered.map((o) => {
              const oc = colors?.[o]
              const sel = o === value
              return (
                <button key={o} onClick={() => { onChange(o); setOpen(false); setQ('') }}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left transition-colors"
                  style={{ color: sel ? C.GOLD : C.TEXT, background: sel ? C.GOLD_DIM : 'transparent' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: oc ?? 'transparent', border: oc ? 'none' : `1px solid ${C.BORDER}` }} />
                  <span className="flex-1 truncate">{o}</span>
                </button>
              )
            })}
            {filtered.length === 0 && !canCreate && (
              <div className="px-2 py-1.5 text-xs" style={{ color: C.MUTED }}>No matches</div>
            )}
            {canCreate && (
              <button onClick={() => { onCreate!(q.trim()); setOpen(false); setQ('') }}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left"
                style={{ color: C.GOLD, borderTop: `1px solid ${C.BORDER}` }}>
                <Plus className="w-3 h-3" /> Create “{q.trim()}”
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Multi-value creatable combobox (mirrors ThemedSelect, multi-select) ──
function ThemedMultiSelect({
  value, options, colors, onChange, placeholder = '—', allowCreate, onCreate,
}: {
  value: string[]
  options: readonly string[]
  colors?: Record<string, string>
  onChange: (v: string[]) => void
  placeholder?: string
  allowCreate?: boolean
  onCreate?: (label: string) => void
}) {
  const C = useTheme()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuId = useRef('tms-menu-' + Math.random().toString(36).slice(2)).current

  useEffect(() => {
    if (!open) return
    const close = () => { setOpen(false); setQ('') }
    const onDoc = (e: MouseEvent) => {
      const menu = document.getElementById(menuId)
      if (btnRef.current?.contains(e.target as Node)) return
      if (menu?.contains(e.target as Node)) return
      close()
    }
    const onScroll = () => close()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true) }
  }, [open, menuId])

  const toggle = () => {
    if (open) { setOpen(false); setQ(''); return }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(true)
  }
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options
  const canCreate = allowCreate && onCreate && q.trim() && !options.some((o) => o.toLowerCase() === q.trim().toLowerCase()) && !value.some((v) => v.toLowerCase() === q.trim().toLowerCase())
  const spaceBelow = rect ? Math.max(0, window.innerHeight - rect.bottom) : 400
  const spaceAbove = rect ? Math.max(0, rect.top) : 400
  const openUp = rect ? (spaceBelow < 120 && spaceAbove > spaceBelow) : false
  const availH = openUp ? spaceAbove - 12 : Math.max(120, spaceBelow - 12)
  const menuH = Math.min(300, availH)
  const menuTop = !rect ? 0 : openUp ? (rect.top - menuH - 4) : (rect.bottom + 2)

  // toggle an option (add/remove); keep menu open so multiple can be picked
  const toggleOpt = (o: string) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  const create = () => { const label = q.trim(); if (!label) return; onCreate!(label); onChange([...value, label]); setQ('') }

  return (
    <>
      <button ref={btnRef} onClick={toggle}
        className="border rounded px-1.5 py-0.5 text-xs font-semibold cursor-pointer flex items-center gap-1 transition-colors w-full"
        style={{ borderColor: C.BORDER, background: C.SURFACE }}>
        <span className="flex-1 text-left flex flex-wrap gap-0.5 min-w-0" style={{ maxHeight: 20, overflow: 'hidden' }}>
          {value.length === 0
            ? <span style={{ color: C.MUTED }}>{placeholder}</span>
            : (<>
                {value.slice(0, 2).map((t) => {
                  const tc = colors?.[t]
                  return <span key={t} className="text-[9px] px-1 rounded shrink-0" style={{ color: tc ?? C.GOLD, background: tc ? `${tc}1a` : C.GOLD_DIM }}>{t}</span>
                })}
                {value.length > 2 && <span className="text-[9px] px-1 shrink-0" style={{ color: C.MUTED }}>+{value.length - 2}</span>}
              </>)}
        </span>
        <span style={{ color: C.MUTED, fontSize: 8 }}>▼</span>
      </button>
      {open && rect && typeof document !== 'undefined' && createPortal(
        <div id={menuId} className="rounded-md border shadow-2xl py-1 flex flex-col"
          style={{ position: 'fixed', top: menuTop, left: rect.left, zIndex: 200,
            background: C.SURFACE, borderColor: C.BORDER, minWidth: Math.max(rect.width, 150), maxWidth: 230 }}>
          <div className="px-1.5 pb-1 shrink-0">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); create() } }}
              placeholder="Search or type to create…"
              className="w-full border rounded px-1.5 py-1 text-xs focus:outline-none" style={{ background: C.SURFACE2, borderColor: C.BORDER, color: C.TEXT }} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: menuH - 38 }}>
            {filtered.map((o) => {
              const oc = colors?.[o]
              const sel = value.includes(o)
              return (
                <button key={o} onClick={() => toggleOpt(o)}
                  className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left transition-colors"
                  style={{ color: sel ? C.GOLD : C.TEXT, background: sel ? C.GOLD_DIM : 'transparent' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: oc ?? 'transparent', border: oc ? 'none' : `1px solid ${C.BORDER}` }} />
                  <span className="flex-1 truncate">{o}</span>
                  {sel && <span style={{ color: C.GOLD }}>✓</span>}
                </button>
              )
            })}
            {filtered.length === 0 && !canCreate && (
              <div className="px-2 py-1.5 text-xs" style={{ color: C.MUTED }}>No matches</div>
            )}
            {canCreate && (
              <button onClick={create}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-left"
                style={{ color: C.GOLD, borderTop: `1px solid ${C.BORDER}` }}>
                <Plus className="w-3 h-3" /> Create “{q.trim()}”
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// Grade hex map (full, for the colored popover)
const GRADE_HEX: Record<string, string> = {
  'A+': '#34d399', 'A': '#D4AF37', 'B': '#f59e0b',
}

// ─── Inline classify select (legacy wrapper around ThemedSelect) ───────
function ClassifySelect({
  value, options, onChange, placeholder, color, colors, allowCreate, onCreate,
}: {
  value: string | null
  options: readonly string[]
  onChange: (v: string | null) => void
  placeholder: string
  color?: { c: string; b: string }     // legacy: single-value color for current value
  colors?: Record<string, string>      // full map (preferred)
  allowCreate?: boolean
  onCreate?: (label: string) => void
}) {
  const map = colors ?? (color && value ? { [value]: color.c } as Record<string, string> : undefined)
  return <ThemedSelect value={value} options={options} colors={map} onChange={onChange} placeholder={placeholder} allowCreate={allowCreate} onCreate={onCreate} />
}


// ─── Tags cell: freeform multi-value with column-centric autocomplete ──
function TagsCell({ value, suggestions, colors, onChange }: {
  value: string[]
  suggestions: string[]
  colors?: Record<string, string> | null
  onChange: (v: string[]) => void
}) {
  const C = useTheme()
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!focused) return
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setFocused(false) }
    const onScroll = () => { if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect()) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true) }
  }, [focused])
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (focused) inputRef.current?.focus({ preventScroll: true }) }, [focused])
  const cur: string[] = Array.isArray(value) ? value : []
  const q = input.trim().toLowerCase()
  const matches = suggestions.filter((s) => !cur.includes(s) && (!q || s.toLowerCase().includes(q))).slice(0, 30)
  const add = (t: string) => { const v = t.trim(); if (v && !cur.includes(v)) onChange([...cur, v]); setInput('') }
  const remove = (t: string) => onChange(cur.filter((x) => x !== t))
  const open = () => { if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect()); setFocused(true) }
  return (
    <div ref={wrapRef} className="relative cursor-text" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); open() }}>
      <div className="flex flex-wrap gap-1 items-center min-h-[22px] py-0.5">
        {cur.map((t) => {
          const col = colors?.[t]
          return (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5"
              style={{ color: col ?? '#c4b5fd', background: col ? `${col}1a` : 'rgba(139,92,246,0.10)', border: `1px solid ${col ? col + '55' : 'rgba(139,92,246,0.30)'}` }}>
              {t}
              <button onClick={(e) => { e.stopPropagation(); remove(t) }} className="opacity-60 hover:opacity-100">✕</button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={open}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(input) }
            else if (e.key === 'Backspace' && !input && cur.length) { remove(cur[cur.length - 1]) }
            else if (e.key === 'Escape') setFocused(false)
          }}
          placeholder={cur.length ? '' : 'add tag…'}
          className="bg-transparent outline-none text-[11px] min-w-[40px] flex-1"
          style={{ color: C.TEXT }}
        />
      </div>
      {focused && rect && typeof document !== 'undefined' && matches.length > 0 && createPortal(
        <div className="rounded-md border shadow-xl max-h-44 overflow-y-auto py-0.5"
          style={{ position: 'fixed', top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 160), zIndex: 1300, background: C.SURFACE, borderColor: C.BORDER }}>
          {matches.map((s) => {
            const col = colors?.[s]
            return (
              <button key={s} type="button" onMouseDown={(e) => { e.preventDefault(); add(s) }}
                className="w-full text-left text-[11px] px-2 py-1 transition-colors hover:bg-white/5 capitalize"
                style={{ color: col ?? C.TEXT2 }}>
                {col && <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: col }} />}{s}
              </button>
            )
          })}
        </div>, document.body)}
    </div>
  )
}
// ─── Compact read-only tag chips for TABLE rows — click opens the detail drawer (full editing lives there) ──
function TagsDisplay({ value, colors, onActivate }: { value: string[]; colors?: Record<string, string> | null; onActivate: () => void }) {
  const C = useTheme()
  const cur = Array.isArray(value) ? value : []
  return (
    <div onClick={onActivate} className="cursor-pointer">
      <div className="flex flex-wrap gap-1 items-center min-h-[22px] py-0.5" style={{ maxHeight: 24, overflow: 'hidden' }}>
        {cur.slice(0, 2).map((t) => {
          const col = colors?.[t]
          return (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ color: col ?? '#c4b5fd', background: col ? `${col}1a` : 'rgba(139,92,246,0.10)', border: `1px solid ${col ? col + '55' : 'rgba(139,92,246,0.30)'}` }}>{t}</span>
          )
        })}
        {cur.length > 2 && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }} title={`${cur.length - 2} more — open detail to see all`}>+{cur.length - 2}</span>}
        {cur.length === 0 && <span className="text-[11px]" style={{ color: C.MUTED }}>+ add tag</span>}
      </div>
    </div>
  )
}
// ─── Custom column inline cell editor (forward testing) ──
function CustomCell({ field, value, onSave, colors, onAddOption, onCreateOption, getTagsSuggestions }: {
  field: CorpusField
  value: any
  onSave: (v: any) => void
  colors?: Record<string, string> | null
  onAddOption?: (label: string) => void
  onCreateOption?: (label: string) => void   // add field option only (no value clobber) — for multiselect create
  getTagsSuggestions?: (fieldId: string) => string[]
}) {
  const C = useTheme()
  const base = "border rounded px-1.5 py-0.5 text-xs transition-colors w-full"
  const st = { background: C.SURFACE2, borderColor: C.BORDER, color: C.TEXT }
  if (field.type === 'grade') {
    return <ThemedSelect value={value} options={GRADES} colors={GRADE_HEX} onChange={onSave} />
  }
  if (field.type === 'select') {
    return <ThemedSelect value={value} options={field.options} colors={colors ?? undefined} onChange={onSave} allowCreate onAddOption onCreate={onAddOption} />
  }
  if (field.type === 'boolean') {
    const on = value === true
    return (
      <button onClick={() => onSave(!on)} title={on ? 'Yes' : 'No'}
        className="w-5 h-5 rounded flex items-center justify-center transition-colors"
        style={on ? { background: C.GOLD, border: `1px solid ${C.GOLD_BORDER}` } : { background: 'transparent', border: `1px solid ${C.BORDER}` }}>
        {on && <Check className="w-3 h-3" style={{ color: C.BG }} />}
      </button>
    )
  }
  if (field.type === 'multiselect') {
    const cur: string[] = Array.isArray(value) ? value : []
    return <ThemedMultiSelect value={cur} options={field.options} colors={colors ?? undefined}
      onChange={(v) => onSave(v)} allowCreate onCreate={onCreateOption} />
  }
  if (field.type === 'tags') {
    const cur: string[] = Array.isArray(value) ? value : []
    return <TagsCell value={cur} suggestions={getTagsSuggestions?.(field.id) ?? []} colors={colors}
      onChange={(v) => onSave(v)} />
  }
  if (field.type === 'date') {
    return <input type="date" value={value ?? ''} onChange={(e) => onSave(e.target.value || null)} className={base} style={st} />
  }
  if (field.type === 'number') {
    return <input type="number" value={value ?? ''} onChange={(e) => onSave(e.target.value === '' ? null : Number(e.target.value))}
      placeholder="—" className={base} style={{ ...st, width: 70 }} />
  }
  // text
  return <input value={value ?? ''} onChange={(e) => onSave(e.target.value || null)} placeholder="—" className={base} style={st} />
}

// ─── Manage enum options modal (built-in Setup Type / Setup / Grade) ──
function ManageEnumModal({ enumKey, title, options, onSave, onClose }: {
  enumKey: string
  title: string
  options: { label: string; color?: string }[]
  onSave: (key: string, options: { label: string; color?: string }[]) => void
  onClose: () => void
}) {
  const C = useTheme()
  const st = { background: C.SURFACE2, borderColor: C.BORDER, color: C.TEXT }
  const [list, setList] = useState(options)
  const [input, setInput] = useState('')
  const add = () => { const v = input.trim(); if (v && !list.some((o) => o.label === v)) { setList((p) => [...p, { label: v }]); setInput('') } }
  const remove = (label: string) => setList((p) => p.filter((o) => o.label !== label))
  const cycleColor = (label: string) => {
    setList((p) => p.map((o) => {
      if (o.label !== label) return o
      const idx = o.color ? PALETTE.indexOf(o.color) : -1
      const next = PALETTE[(idx + 1) % (PALETTE.length + 1)]
      return next ? { ...o, color: next } : { ...o, color: undefined }
    }))
  }
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-[380px] rounded-lg border p-5 space-y-4" style={{ background: C.BG, borderColor: C.BORDER }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: C.GOLD }}>Manage {title}</h3>
          <button onClick={onClose} style={{ color: C.MUTED }}><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[10px]" style={{ color: C.MUTED }}>Add, remove, or recolor options. Applies across all rows.</p>
        <div className="flex gap-1">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Type an option + Enter" className="flex-1 border rounded px-2 py-1 text-xs" style={st} />
          <button onClick={add} className="text-xs px-2 py-1 rounded" style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, color: C.TEXT2 }}>Add</button>
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-1 max-h-60 overflow-y-auto">
            {list.map((o) => {
              const col = o.color
              return (
                <span key={o.label} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: col ? `${col}1a` : C.GOLD_DIM, color: col ?? C.GOLD, border: `1px solid ${col ? col + '55' : C.GOLD_BORDER}` }}>
                  <button onClick={() => cycleColor(o.label)} title="Cycle color" className="w-2 h-2 rounded-full shrink-0" style={{ background: col ?? 'transparent', border: col ? 'none' : `1px solid ${col ?? C.MUTED}` }} />
                  {o.label}
                  <button onClick={() => remove(o.label)} className="opacity-60 hover:opacity-100">✕</button>
                </span>
              )
            })}
          </div>
        )}
        {list.length === 0 && <p className="text-xs text-center py-4" style={{ color: C.MUTED }}>No options yet — add one above.</p>}
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: C.BORDER }}>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded" style={{ color: C.MUTED }}>Cancel</button>
          <button onClick={() => { onSave(enumKey, list); onClose() }} className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: C.GOLD, color: C.BG }}>Save</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Create / edit column modal ──
function FieldModal({ edit, onClose, onSubmit, onDelete }: {
  edit?: CorpusField
  onClose: () => void
  onSubmit: (name: string, type: FieldType, options: string[], colors: Record<string, string>, shared: boolean) => void
  onDelete?: () => void
}) {
  const C = useTheme()
  const st = { background: C.SURFACE2, borderColor: C.BORDER, color: C.TEXT }
  const [name, setName] = useState(edit?.name ?? '')
  const [type, setType] = useState<FieldType>(edit?.type ?? 'select')
  const [shared, setShared] = useState<boolean>(edit ? edit.databaseId == null : false)
  const [opts, setOpts] = useState<string[]>(edit?.options ?? [])
  const [optColors, setOptColors] = useState<Record<string, string>>(edit?.colors ?? {})
  const [optInput, setOptInput] = useState('')
  const addOpt = () => { const v = optInput.trim(); if (v) { setOpts((p) => [...p, v]); setOptInput('') } }
  const cycleColor = (o: string) => {
    setOptColors((p) => {
      const cur = p[o]; const idx = cur ? PALETTE.indexOf(cur) : -1
      const next = PALETTE[(idx + 1) % (PALETTE.length + 1)]   // +1 to allow clearing (undefined)
      const cp = { ...p }
      if (!next) delete cp[o]; else cp[o] = next
      return cp
    })
  }
  const needsOpts = type === 'select' || type === 'multiselect'
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-[420px] rounded-lg border p-5 space-y-4" style={{ background: C.BG, borderColor: C.BORDER }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: C.GOLD }}>{edit ? 'Edit Column' : 'New Column'}</h3>
          <button onClick={onClose} style={{ color: C.MUTED }}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider" style={{ color: C.MUTED }}>Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Outcome, Entry Hit, R Multiple"
            className="w-full border rounded px-2 py-1.5 text-sm" style={st} />
        </div>
        {!edit && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: C.MUTED }}>Type</label>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <button key={t} onClick={() => setType(t)} className="text-[10px] px-2 py-1.5 rounded font-mono transition-colors"
                  style={type === t ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
                  {FIELD_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        )}
        {needsOpts && (
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider" style={{ color: C.MUTED }}>Options</label>
            <div className="flex gap-1">
              <input value={optInput} onChange={(e) => setOptInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpt() } }}
                placeholder="Type an option + Enter" className="flex-1 border rounded px-2 py-1 text-xs" style={st} />
              <button onClick={addOpt} className="text-xs px-2 py-1 rounded" style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}`, color: C.TEXT2 }}>Add</button>
            </div>
            {opts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {opts.map((o, i) => {
                  const col = optColors[o]
                  return (
                  <span key={o} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: col ? `${col}1a` : C.GOLD_DIM, color: col ?? C.GOLD, border: `1px solid ${col ? col + '55' : C.GOLD_BORDER}` }}>
                    <button onClick={() => cycleColor(o)} title="Cycle color" className="w-2 h-2 rounded-full shrink-0" style={{ background: col ?? 'transparent', border: col ? 'none' : `1px solid ${col ?? C.MUTED}` }} />
                    {o}
                    <button onClick={() => { setOpts((p) => p.filter((_, idx) => idx !== i)); setOptColors((p) => { const cp = { ...p }; delete cp[o]; return cp }) }} className="opacity-60 hover:opacity-100">✕</button>
                  </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer text-xs select-none pb-1" style={{ color: C.TEXT2 }}>
          <button type="button" onClick={() => setShared((v) => !v)} className="w-8 h-4 rounded-full transition-colors relative shrink-0" style={{ background: shared ? C.GOLD : C.SURFACE2, border: `1px solid ${shared ? C.GOLD_BORDER : C.BORDER}` }}>
            <span className="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all" style={{ left: shared ? 16 : 2, background: shared ? C.BG : C.MUTED }} />
          </button>
          <span>Use in all databases <span style={{ color: C.MUTED }}>(shared — same column in every database)</span></span>
        </label>
        <div className="flex items-center gap-2 pt-1">
          <button disabled={!name.trim()} onClick={() => { onSubmit(name.trim(), type, opts, optColors, shared); onClose() }}
            className="flex-1 text-xs font-semibold py-2 rounded disabled:opacity-40" style={{ background: C.GOLD, color: C.BG }}>
            {edit ? 'Save' : 'Create Column'}
          </button>
          {edit && onDelete && (
            <button onClick={() => { onDelete(); onClose() }} className="text-xs py-2 px-3 rounded" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
const stIsDead = true // legacy module const removed — FieldModal now derives st from C

// ─── Column manager popover (sits at the end of the header row) ──
function ColumnMenu({ fields, onCreate, onEdit, onDelete }: {
  fields: CorpusField[]
  onCreate: () => void
  onEdit: (f: CorpusField) => void
  onDelete: (id: string, name: string) => void
}) {
  const C = useTheme()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuId = useRef('cm-menu-' + Math.random().toString(36).slice(2)).current
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDoc = (e: MouseEvent) => {
      const menu = document.getElementById(menuId)
      if (btnRef.current?.contains(e.target as Node)) return
      if (menu?.contains(e.target as Node)) return
      close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, menuId])
  const toggle = () => {
    if (open) { setOpen(false); return }
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(true)
  }
  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggle} title="Add or manage columns"
        className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:opacity-100"
        style={{ color: C.GOLD, border: `1px solid ${open ? C.GOLD_BORDER : C.BORDER}`, opacity: 0.8 }}>
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && rect && typeof document !== 'undefined' && createPortal(
        <div id={menuId} className="rounded-lg border shadow-2xl py-1.5"
          style={{ position: 'fixed', top: rect.bottom + 2, right: window.innerWidth - rect.right, zIndex: 250,
            background: C.SURFACE, borderColor: C.BORDER, width: 208 }}>
          <button onClick={() => { setOpen(false); onCreate() }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
            style={{ color: C.GOLD }}>
            <Plus className="w-3.5 h-3.5" /> New column
          </button>
          {fields.length > 0 && (
            <>
              <div className="border-t my-1" style={{ borderColor: C.BORDER }} />
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider" style={{ color: C.MUTED }}>Manage</div>
              <div className="max-h-72 overflow-y-auto">
                {fields.map((f) => (
                  <div key={f.id} className="group flex items-center gap-1 px-2 py-1 transition-colors" style={{ color: C.TEXT2 }}>
                    <span className="flex-1 truncate text-xs">{f.name}</span>
                    <span className="text-[8px] uppercase" style={{ color: C.MUTED }}>{FIELD_TYPE_LABELS[f.type]}</span>
                    <button onClick={() => { setOpen(false); onEdit(f) }} title="Rename / options" className="opacity-0 group-hover:opacity-70 hover:!opacity-100" style={{ color: C.TEXT2 }}>✎</button>
                    <button onClick={() => { setOpen(false); onDelete(f.id, f.name) }} title="Delete" className="opacity-0 group-hover:opacity-70 hover:!opacity-100" style={{ color: C.RED }}>✕</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Unified filter popup (filters by ANY column) ──
function FilterPopup({ filterDefs, values, onChange }: {
  filterDefs: FilterDef[]
  values: Record<string, string | string[]>
  onChange: (v: Record<string, string | string[]>) => void
}) {
  const C = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const activeCount = Object.values(values).filter((v) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0)).length
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const inputCls = "border rounded px-2 py-1 text-xs w-full focus:outline-none"
  const inputSt = { background: C.SURFACE2, borderColor: C.BORDER, color: C.TEXT }
  // Saved filter presets (localStorage, per-browser). One click recalls a combo.
  const PK = 'traderra:dbFilterPresets'
  const [presets, setPresets] = useState<{ name: string; filters: Record<string, string | string[]> }[]>([])
  useEffect(() => { try { setPresets(JSON.parse(localStorage.getItem(PK) || '[]')) } catch {} }, [])
  const persist = (next: typeof presets) => { setPresets(next); try { localStorage.setItem(PK, JSON.stringify(next)) } catch {} }
  const savePreset = () => {
    const has = Object.values(values).some((v) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0))
    if (!has) { alert('Set some filters first, then save.'); return }
    const name = prompt('Name this filter preset:')
    if (!name?.trim()) return
    persist([...presets.filter((p) => p.name !== name.trim()), { name: name.trim(), filters: values }])
  }
  const delPreset = (name: string) => persist(presets.filter((p) => p.name !== name))
  const curKey = JSON.stringify(values)
  // dynamic filter: one type expanded at a time, type-to-search within it
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [qBy, setQBy] = useState<Record<string, string>>({})
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} title="Filter rows"
        className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
        style={{ background: open || activeCount ? C.GOLD_DIM : C.SURFACE, color: activeCount ? C.GOLD : C.TEXT2, border: `1px solid ${activeCount ? C.GOLD_BORDER : C.BORDER}` }}>
        <Filter className="w-3.5 h-3.5" />
        Filter
        {activeCount > 0 && <span className="text-[10px] px-1 rounded" style={{ background: C.GOLD, color: C.BG }}>{activeCount}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-[1200] w-72 rounded-lg border shadow-2xl"
          style={{ background: C.SURFACE, borderColor: C.BORDER }}>
          {/* Saved presets — one-click recall of a filter combo */}
          <div className="flex flex-wrap items-center gap-1 p-2 border-b" style={{ borderColor: C.BORDER }}>
            <span className="text-[9px] uppercase tracking-wider font-bold mr-0.5" style={{ color: C.MUTED }}>Presets</span>
            {presets.map((p) => {
              const on = JSON.stringify(p.filters) === curKey
              return (
                <div key={p.name} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: on ? C.GOLD_DIM : C.SURFACE2, border: `1px solid ${on ? C.GOLD_BORDER : C.BORDER}`, color: on ? C.GOLD : C.TEXT2 }}>
                  <button onClick={() => onChange({ ...p.filters })} className="cursor-pointer">{p.name}</button>
                  <button onClick={() => delPreset(p.name)} className="opacity-50 hover:opacity-100 ml-0.5" style={{ color: C.MUTED }} title="Delete preset">✕</button>
                </div>
              )
            })}
            <button onClick={savePreset} title="Save current filters as a preset"
              className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold" style={{ border: `1px dashed ${C.BORDER}`, color: C.MUTED }}>
              <Plus className="w-2.5 h-2.5" /> Save
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {filterDefs.map((def) => {
              const raw = values[def.id]
              const sel: string[] = Array.isArray(raw) ? raw : (raw ? [String(raw)] : [])
              const isEnum = def.type === 'enum'
              const expanded = expandedType === def.id
              const opts = isEnum ? (def.options ?? []).filter((o) => {
                const q = (qBy[def.id] || '').toLowerCase(); return !q || String(o).toLowerCase().includes(q)
              }) : []
              const toggle = (o: string) => onChange({ ...values, [def.id]: sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o] })
              return (
                <div key={def.id} className="border-b" style={{ borderColor: C.BORDER }}>
                  <button type="button" onClick={() => setExpandedType(expanded ? null : def.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs"
                    style={{ color: sel.length ? C.GOLD : C.TEXT2, background: sel.length ? C.GOLD_DIM : 'transparent' }}>
                    <span className="font-semibold capitalize">{def.label}</span>
                    <span className="flex items-center gap-1.5">
                      {isEnum && <span className="text-[9px]" style={{ color: C.MUTED }}>{def.options?.length ?? 0}</span>}
                      {sel.length > 0 && <span className="text-[9px] px-1 rounded font-bold" style={{ background: C.GOLD, color: C.BG }}>{sel.length}</span>}
                      <span className="text-[10px] w-2 text-center" style={{ color: C.MUTED }}>{expanded ? '▾' : '▸'}</span>
                    </span>
                  </button>
                  {expanded && (
                    <div className="px-3 pb-2.5 space-y-1.5">
                      {isEnum ? (
                        <>
                          <input autoFocus value={qBy[def.id] || ''} onChange={(e) => setQBy((s) => ({ ...s, [def.id]: e.target.value }))}
                            placeholder={`Search ${def.options?.length ?? 0} options…`} className={inputCls} style={inputSt} />
                          <div className="max-h-40 overflow-y-auto space-y-0.5">
                            {opts.map((o) => {
                              const on = sel.includes(o)
                              return (
                                <button type="button" key={o} onClick={() => toggle(o)}
                                  className="w-full flex items-center gap-1.5 text-[11px] text-left capitalize rounded px-1 py-0.5 transition-colors"
                                  style={{ color: on ? C.GOLD : C.TEXT2, background: on ? C.GOLD_DIM : 'transparent' }}>
                                  <span className="w-2.5 h-2.5 rounded-sm border flex items-center justify-center text-[8px] leading-none"
                                    style={{ borderColor: on ? C.GOLD : C.BORDER, background: on ? C.GOLD : 'transparent', color: C.BG }}>{on ? '✓' : ''}</span>
                                  <span className="truncate">{o}</span>
                                </button>
                              )
                            })}
                            {opts.length === 0 && <span className="text-[10px] block px-1" style={{ color: C.MUTED }}>no matches</span>}
                          </div>
                          {sel.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {sel.map((o) => (
                                <button type="button" key={o} onClick={() => toggle(o)} title="Remove"
                                  className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize"
                                  style={{ background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}`, color: C.GOLD }}>
                                  {o} <span style={{ color: C.MUTED }}>✕</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : def.type === 'boolean' ? (
                        <select value={values[def.id] ?? ''} onChange={(e) => onChange({ ...values, [def.id]: e.target.value })} className={inputCls} style={inputSt}>
                          <option value="">All</option><option value="__true">Yes</option><option value="__false">No</option>
                        </select>
                      ) : (
                        <input autoFocus type={def.type} value={values[def.id] ?? ''} onChange={(e) => onChange({ ...values, [def.id]: e.target.value })} placeholder="—" className={inputCls} style={inputSt} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {activeCount > 0 && (
            <div className="border-t p-2" style={{ borderColor: C.BORDER }}>
              <button onClick={() => onChange({})} className="text-[10px] px-2 py-1 rounded w-full font-semibold" style={{ color: C.MUTED, border: `1px solid ${C.BORDER}` }}>Clear all filters</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Scan loader tree — matches scanner NestedFolderGroup ──
function ScanLoader({
  scans, selected, onToggle, onToggleGroup, onClear, onLoad, loading,
}: {
  scans: ScanItem[]
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleGroup: (ids: string[], allOn: boolean) => void
  onClear: () => void
  onLoad: () => void
  loading: boolean
}) {
  const C = useTheme()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const groups = useMemo(() => {
    const g: Record<string, ScanItem[]> = {}
    for (const s of scans) {
      const key = prettyStrategy(s.strategy)
      ;(g[key] ||= []).push(s)
    }
    // sort: most results first within a group; groups alphabetical
    for (const k in g) g[k].sort((a, b) => b.resultCount - a.resultCount)
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]))
  }, [scans])

  const toggleGroupOpen = (k: string) => setOpenGroups((o) => ({ ...o, [k]: !o[k] }))

  return (
    <div className="border-b" style={{ borderColor: C.BORDER, background: C.SURFACE }}>
      <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
        {groups.length === 0 ? (
          <div className="text-center py-8" style={{ color: C.MUTED }}>
            <Inbox className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No saved scans found. Run scans on /scanner first.</p>
          </div>
        ) : (
          groups.map(([label, items]) => {
            const allOn = items.every((i) => selected.has(i.id))
            const selInGroup = items.filter((i) => selected.has(i.id)).length
            const totalSig = items.reduce((s, i) => s + i.resultCount, 0)
            return (
              <div key={label}>
                {/* group header — scanner-style */}
                <div
                  onClick={() => toggleGroupOpen(label)}
                  className="flex items-center"
                  style={{
                    padding: '7px 10px', cursor: 'pointer',
                    borderBottom: `1px solid ${C.BORDER}`,
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: C.GOLD, fontSize: 10, marginRight: 6, display: 'inline-block', transition: 'transform 0.15s', transform: openGroups[label] ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  <span style={{ color: C.GOLD, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>{label}</span>
                  <span style={{ color: C.MUTED, fontSize: 9, marginRight: 6 }}>{totalSig} sig</span>
                  {/* group select-all checkbox */}
                  <span
                    onClick={(e) => { e.stopPropagation(); onToggleGroup(items.map((i) => i.id), allOn) }}
                    className="inline-flex items-center justify-center"
                    style={{ width: 13, height: 13, border: `1px solid ${allOn ? C.GOLD : C.BORDER}`, borderRadius: 2, background: allOn ? C.GOLD : 'transparent', cursor: 'pointer' }}
                    title={allOn ? 'Deselect all' : 'Select all'}
                  >
                    {allOn && <Check className="w-2.5 h-2.5" style={{ color: C.BG }} />}
                  </span>
                </div>

                {/* group items */}
                {openGroups[label] && items.map((s) => {
                  const on = selected.has(s.id)
                  const empty = s.resultCount === 0
                  return (
                    <button
                      key={s.id}
                      onClick={() => onToggle(s.id)}
                      className="flex items-center gap-2 w-full text-left"
                      style={{
                        padding: '6px 10px 6px 28px',
                        cursor: 'pointer',
                        borderLeft: on ? `2px solid ${C.GOLD}` : '2px solid transparent',
                        borderBottom: `1px solid ${C.BORDER}`,
                        background: on ? C.GOLD_DIM : 'transparent',
                      }}
                      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span className="inline-flex items-center justify-center shrink-0"
                        style={{ width: 13, height: 13, border: `1px solid ${on ? C.GOLD : C.BORDER}`, borderRadius: 2, background: on ? C.GOLD : 'transparent' }}>
                        {on && <Check className="w-2.5 h-2.5" style={{ color: C.BG }} />}
                      </span>
                      <span className="text-xs font-semibold truncate flex-1" style={{ color: on ? C.GOLD : C.TEXT }}>{s.name}</span>
                      <span className="text-[9px] px-1.5 rounded shrink-0" style={{ color: empty ? C.RED : C.TEAL, background: empty ? 'rgba(239,68,68,0.10)' : `${C.TEAL}20` }}>
                        {s.resultCount} sig
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* action bar */}
      <div className="flex items-center justify-between px-5 py-2 border-t" style={{ borderColor: C.BORDER, background: C.SURFACE2 }}>
        <span className="text-xs" style={{ color: C.MUTED }}>{selected.size} selected</span>
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: C.TEXT2 }}>Clear</button>
          <button
            onClick={onLoad}
            disabled={selected.size === 0 || loading}
            className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-opacity disabled:opacity-30"
            style={{ background: C.GOLD, color: C.BG }}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Load {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function DatabasePage() {
  const [rows, setRows] = useState<CorpusRow[]>([])
  const rowsRef = useRef(rows); rowsRef.current = rows
  const tagsSuggestions = useCallback((fieldId: string) => {
    const set = new Set<string>()
    for (const r of rowsRef.current) {
      const v = (r.customValues ?? {})[fieldId]
      if (Array.isArray(v)) v.forEach((t) => set.add(String(t)))
    }
    return [...set].sort()
  }, [])
  const [scans, setScans] = useState<ScanItem[]>([])
  const [selectedScanIds, setSelectedScanIds] = useState<Set<string>>(new Set())
  // Derived: distinct scan sources actually present in the loaded corpus rows.
  // Persists across reloads (unlike session-only state) so chips always match the DB.
  const loadedScanNames = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.scanSources))).sort(),
    [rows],
  )
  const [loaderOpen, setLoaderOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [columnFilters, setColumnFilters] = useState<Record<string, string | string[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openTradeId, setOpenTradeId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'warn' | 'err'; msg: string } | null>(null)
  const [panelH, setPanelH] = useState<number>(0) // 0 = default 50%
  const [fields, setFields] = useState<CorpusField[]>([])

  // ── Database (workspace) switching ──
  // Each workspace is an isolated collection of rows. The active id rides
  // every /api/database* call via the x-db-id header (dbFetch below).
  const [databases, setDatabases] = useState<{ id: string; name: string; rowCount: number }[]>([])
  const [currentDbId, setCurrentDbId] = useState<string | null>(null)
  const dbIdRef = useRef<string | null>(null)
  const dbFetch = useCallback((url: string, opts: RequestInit = {}) => {
    const headers = new Headers(opts.headers || {})
    if (dbIdRef.current) headers.set('x-db-id', dbIdRef.current)
    return fetch(url, { ...opts, headers })
  }, [])

  const fetchDatabases = useCallback(async () => {
    const res = await dbFetch('/api/database/databases')
    const data = await res.json()
    const list: { id: string; name: string; rowCount: number }[] = data.databases ?? []
    setDatabases(list)
    return list
  }, [dbFetch])

  const switchDatabase = useCallback((id: string) => {
    setCurrentDbId(id)
    try { localStorage.setItem('traderra.currentDbId', id) } catch {}
    setSelectedId(null)
    setOpenTradeId(null)
  }, [])

  const createDatabase = useCallback(async (name: string, duplicateFrom?: string) => {
    const res = await dbFetch('/api/database/databases', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ...(duplicateFrom ? { duplicateFrom } : {}) }),
    })
    const data = await res.json()
    if (!res.ok) { setStatus({ kind: 'err', msg: data.error || 'Failed to create database' }); return null }
    const list = await fetchDatabases()
    const created = list.find((d) => d.name === name)
    if (created) switchDatabase(created.id)
    return data.database
  }, [dbFetch, fetchDatabases, switchDatabase])

  const deleteDatabase = useCallback(async (id: string) => {
    const res = await dbFetch(`/api/database/databases?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { setStatus({ kind: 'err', msg: data.error || 'Failed to delete database' }); return }
    const list = await fetchDatabases()
    if (currentDbId === id && list[0]) switchDatabase(list[0].id)
  }, [dbFetch, fetchDatabases, currentDbId, switchDatabase])

  // Managed option lists (Setup Type, Setup) — DB-backed, user-editable
  const [enums, setEnums] = useState<Record<string, { label: string; color?: string }[]>>({})
  const fetchEnums = useCallback(async () => {
    const res = await dbFetch('/api/database/enums')
    const data = await res.json()
    setEnums(data.enums ?? {})
  }, [])
  const enumOpts = useCallback((key: string) => (enums[key] ?? []).map((o) => o.label), [enums])
  const enumColors = useCallback((key: string) => {
    const out: Record<string, string> = {}
    for (const o of enums[key] ?? []) if (o.color) out[o.label] = o.color
    return out
  }, [enums])
  const addEnumOption = useCallback(async (key: string, label: string) => {
    const cur = enums[key] ?? []
    if (cur.some((o) => o.label === label)) return
    const next = [...cur, { label }]
    setEnums((prev) => ({ ...prev, [key]: next }))
    await dbFetch('/api/database/enums', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, options: next }),
    })
  }, [enums])
  // add an option to a custom column inline (select type)
  const addFieldOption = useCallback(async (fieldId: string, label: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field || field.options.includes(label)) return
    const nextOpts = [...field.options, label]
    setFields((prev) => prev.map((f) => (f.id === fieldId ? { ...f, options: nextOpts } : f)))
    await dbFetch('/api/database/fields', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fieldId, options: nextOpts }),
    })
  }, [fields])

  // replace the full option list for a built-in enum (setupType / setup / grade)
  const saveEnum = useCallback(async (key: string, options: { label: string; color?: string }[]) => {
    setEnums((prev) => ({ ...prev, [key]: options }))
    await dbFetch('/api/database/enums', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, options }),
    })
  }, [])
  const [fieldModal, setFieldModal] = useState<{ open: boolean; edit?: CorpusField }>({ open: false })
  const [enumModal, setEnumModal] = useState<{ key: string; title: string } | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [dark, setDark] = useState(true)
  const C = dark ? DARK : LIGHT_THEME
  const [viewMode, setViewMode] = useState<'database' | 'review'>('database')
  // Unified filter defs — every column is filterable
  const filterDefs = useMemo<FilterDef[]>(() => {
    const builtIn: FilterDef[] = [
      { id: 'symbol', label: 'Symbol', type: 'text' },
      { id: 'signalDate', label: 'Signal Date', type: 'date' },
      { id: 'scanSources', label: 'Scan', type: 'enum', options: loadedScanNames, multi: true },
      { id: 'setupType', label: 'Setup Type', type: 'enum', options: enumOpts('setupType'), multi: true },
      { id: 'setup', label: 'Setup', type: 'enum', options: enumOpts('setup'), multi: true },
      { id: 'grade', label: 'Grade', type: 'enum', options: enumOpts('grade'), multi: true },
      { id: 'move', label: 'Move', type: 'enum', options: enumOpts('move'), multi: true },
      { id: 'tags', label: 'Tags', type: 'text' },
    ]
    const custom: FilterDef[] = fields.map((f) => {
      const base = { id: `custom__${f.id}`, label: f.name }
      if (f.type === 'grade' || f.type === 'select' || f.type === 'multiselect')
        return { ...base, type: 'enum' as const, options: f.type === 'grade' ? GRADES : f.options, multi: f.type === 'multiselect' }
      if (f.type === 'tags') {
        const union = [...new Set(rows.flatMap((r) => { const v = (r.customValues ?? {})[f.id]; return Array.isArray(v) ? v : [] }))].sort()
        return { ...base, type: 'enum' as const, options: union, multi: true }
      }
      if (f.type === 'boolean') return { ...base, type: 'boolean' as const }
      if (f.type === 'number') return { ...base, type: 'number' as const }
      if (f.type === 'date') return { ...base, type: 'date' as const }
      return { ...base, type: 'text' as const }
    })
    return [...builtIn, ...custom]
  }, [fields, loadedScanNames, enums, rows])
  const splitDrag = useRef<{ startY: number; startH: number } | null>(null)
  const onSplitDown = (e: React.MouseEvent) => {
    const vh = window.innerHeight
    splitDrag.current = { startY: e.clientY, startH: panelH || vh / 2 }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    const move = (ev: MouseEvent) => {
      if (!splitDrag.current) return
      // dragging UP = taller bottom panel
      const next = splitDrag.current.startH + (splitDrag.current.startY - ev.clientY)
      setPanelH(Math.max(140, Math.min(vh - 140, next)))
    }
    const up = () => {
      splitDrag.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch('/api/scans')
      const data = await res.json()
      const list: ScanItem[] = (data.scans || []).map((s: any) => ({
        id: s.id, name: s.name, strategy: s.strategy || 'custom',
        resultCount: s.resultCount || 0,
        tags: Array.isArray(s.tags) ? s.tags : safeParse(s.tags),
      }))
      list.sort((a, b) => b.resultCount - a.resultCount)
      setScans(list)
    } catch {}
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const res = await dbFetch('/api/database')
    const data = await res.json()
    setRows(data.rows ?? [])
    setLoading(false)
  }, [])

  const fetchFields = useCallback(async () => {
    const res = await dbFetch('/api/database/fields')
    const data = await res.json()
    setFields(data.fields ?? [])
  }, [])

  // save a custom value into a row's customValues blob
  const saveCustomValue = useCallback(async (rowId: string, fieldId: string, value: any) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r
      const next = { ...(r.customValues ?? {}) }
      next[fieldId] = value
      return { ...r, customValues: next }
    }))
    const target = rows.find((r) => r.id === rowId)
    const next = { ...(target?.customValues ?? {}) }
    next[fieldId] = value
    await dbFetch('/api/database', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rowId, customValues: next }),
    })
  }, [rows])

  // ── Trades CRUD ──
  const [trades, setTrades] = useState<Record<string, CorpusTrade[]>>({})
  const fetchTrades = useCallback(async (rowId: string) => {
    const res = await dbFetch(`/api/database/trades?setupRowId=${rowId}`)
    const data = await res.json()
    setTrades((prev) => ({ ...prev, [rowId]: data.trades ?? [] }))
  }, [])
  const addTrade = useCallback(async (rowId: string, direction: string, date: string) => {
    const res = await dbFetch('/api/database/trades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupRowId: rowId, direction, date }),
    })
    const data = await res.json()
    if (data.trade) setTrades((prev) => ({ ...prev, [rowId]: [...(prev[rowId] ?? []), data.trade] }))
    return data.trade ?? null
  }, [])

  // open a day trade from the table: select row, create/open a trade for that day
  const openDayTrade = useCallback(async (rowId: string, signalDate: string, dayOffset: number) => {
    const d = new Date(signalDate); d.setDate(d.getDate() + dayOffset)
    const dateStr = d.toISOString().slice(0, 10)
    setSelectedId(rowId)
    // check if a trade already exists for this date
    const existing = (trades[rowId] ?? []).find((t) => t.date === dateStr)
    if (existing) { setOpenTradeId(existing.id); return }
    const t = await addTrade(rowId, 'short', dateStr)
    if (t) setOpenTradeId(t.id)
  }, [trades, addTrade])
  const updateTrade = useCallback(async (rowId: string, tradeId: string, patch: Partial<CorpusTrade>) => {
    setTrades((prev) => ({ ...prev, [rowId]: (prev[rowId] ?? []).map((t) => (t.id === tradeId ? { ...t, ...patch } : t)) }))
    await dbFetch('/api/database/trades', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tradeId, ...patch }),
    })
  }, [])
  const deleteTrade = useCallback(async (rowId: string, tradeId: string) => {
    setTrades((prev) => ({ ...prev, [rowId]: (prev[rowId] ?? []).filter((t) => t.id !== tradeId) }))
    await dbFetch(`/api/database/trades?id=${tradeId}`, { method: 'DELETE' })
  }, [])

  const createField = async (name: string, type: FieldType, options: string[], colors: Record<string, string>, shared: boolean = false) => {
    const res = await dbFetch('/api/database/fields', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, options, colors, shared }),
    })
    if (!res.ok) { const e = await res.json().catch(() => ({})); setStatus({ kind: 'err', msg: e.error || 'Create failed' }); return }
    await fetchFields()
    setStatus({ kind: 'ok', msg: `Added column “${name}”.` })
  }

  const updateColumn = async (id: string, name: string, options: string[], colors: Record<string, string>, shared: boolean = false) => {
    await dbFetch('/api/database/fields', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, options, colors, shared }),
    })
    await fetchFields()
  }

  const deleteField = async (id: string, name: string) => {
    if (!confirm(`Delete column “${name}”? Its values will be removed from all rows.`)) return
    await dbFetch(`/api/database/fields?id=${id}`, { method: 'DELETE' })
    await fetchFields()
    setRows((prev) => prev.map((r) => {
      if (!r.customValues || !(id in r.customValues)) return r
      const next = { ...r.customValues }; delete next[id]
      return { ...r, customValues: next }
    }))
    setStatus({ kind: 'ok', msg: `Deleted column “${name}”.` })
  }

  // Load databases on mount; restore last active workspace from localStorage
  useEffect(() => {
    (async () => {
      const list = await fetchDatabases()
      let saved: string | null = null
      try { saved = localStorage.getItem('traderra.currentDbId') } catch {}
      const target = saved && list.some((d) => d.id === saved) ? saved : (list[0]?.id ?? null)
      if (target) setCurrentDbId(target)
    })()
  }, [fetchDatabases])

  // Sync the db-id ref + reload all workspace data when the active db changes
  useEffect(() => {
    dbIdRef.current = currentDbId
    if (!currentDbId) return
    fetchRows(); fetchScans(); fetchEnums(); fetchFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDbId])
  useEffect(() => { if (selectedId) fetchTrades(selectedId) }, [selectedId, fetchTrades])

  // auto-dismiss status after 5s
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 5000)
    return () => clearTimeout(t)
  }, [status])

  const updateField = useCallback(async (id: string, patch: Partial<CorpusRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setSaving(true)
    await dbFetch('/api/database', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    setSaving(false)
  }, [])

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveNotes = useCallback((id: string, val: string) => {
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      setSaving(true)
      await dbFetch('/api/database', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes: val }),
      })
      setSaving(false)
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, notes: val } : r)))
    }, 600)
  }, [])

  const deleteRow = useCallback(async (id: string) => {
    await dbFetch(`/api/database?id=${id}`, { method: 'DELETE' })
    setRows((prev) => prev.filter((r) => r.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  // Evict one scan source from the corpus (removes it from every row; deletes orphaned rows)
  const removeScan = useCallback(async (name: string) => {
    const res = await dbFetch(`/api/database?scan=${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) { setStatus({ kind: 'err', msg: `Couldn't remove ${name}` }); return }
    const d = await res.json().catch(() => ({}))
    await fetchRows()
    setStatus({ kind: 'ok', msg: `Removed ${name} — ${d.deleted ?? 0} deleted, ${d.updated ?? 0} kept (shared)` })
  }, [])

  // Wipe the whole working corpus (non-archived rows)
  const clearAll = useCallback(async () => {
    const res = await dbFetch(`/api/database?all=1`, { method: 'DELETE' })
    if (!res.ok) { setStatus({ kind: 'err', msg: 'Clear failed' }); return }
    const d = await res.json().catch(() => ({}))
    setSelectedId(null)
    await fetchRows()
    setStatus({ kind: 'ok', msg: `Cleared ${d.deleted ?? 0} rows from the corpus.` })
  }, [])

  const downloadBackup = useCallback(async () => {
    const res = await dbFetch('/api/database/backup')
    if (!res.ok) { setStatus({ kind: 'err', msg: 'Backup failed' }); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `traderra-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setStatus({ kind: 'ok', msg: 'Backup downloaded — keep this file safe.' })
  }, [])

  const restoreBackup = useCallback(async (file: File) => {
    if (!confirm('Restore will REPLACE everything in the database with the backup. Continue?')) return
    try {
      const text = await file.text()
      const backup = JSON.parse(text)
      const res = await dbFetch('/api/database/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ backup }) })
      const data = await res.json()
      if (!res.ok) { setStatus({ kind: 'err', msg: data.error || 'Restore failed' }); return }
      await fetchRows()
      setStatus({ kind: 'ok', msg: 'Restored from backup.' })
    } catch (e: any) {
      setStatus({ kind: 'err', msg: 'Invalid backup file: ' + e.message })
    }
  }, [fetchRows])

  const toggleScan = (id: string) => setSelectedScanIds((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const toggleGroup = (ids: string[], allOn: boolean) => setSelectedScanIds((s) => {
    const n = new Set(s); allOn ? ids.forEach((i) => n.delete(i)) : ids.forEach((i) => n.add(i)); return n
  })

  const handleLoad = async () => {
    setImporting(true)
    try {
      const ids = Array.from(selectedScanIds)
      const res = await dbFetch('/api/database/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanIds: ids }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server error ${res.status}`)
      }
      const data = await res.json()
      // reset filters so freshly imported (ungraded) rows are visible
      setColumnFilters({})
      await fetchScans() // refresh counts
      await fetchRows() // refresh the table rows themselves
      setSelectedScanIds(new Set())
      setLoaderOpen(false)

      const scanNames = (data.scans || []).map((s: any) => s.name).filter(Boolean)
      const totalSignals = (data.scans || []).reduce((n: number, s: any) => n + (s.signalCount || 0), 0)
      if (data.imported > 0) {
        setStatus({ kind: 'ok', msg: `Imported ${data.imported} new row${data.imported === 1 ? '' : 's'} from ${scanNames.length} scan${scanNames.length === 1 ? '' : 's'}.` })
      } else if (totalSignals > 0) {
        // rows already existed — not an error, the corpus already has them
        setStatus({ kind: 'ok', msg: `${totalSignals} ticker${totalSignals === 1 ? '' : 's'} already in the corpus from ${scanNames.join(', ')} — no new rows to add.` })
      } else {
        setStatus({ kind: 'warn', msg: `No signal data found in those scans.` })
      }
    } catch (e: any) {
      setStatus({ kind: 'err', msg: `Load failed: ${e.message || 'unknown error'}` })
    }
    setImporting(false)
  }

  // ─── table columns ───
  const columns = useMemo<ColumnDef<CorpusRow>[]>(() => {
    const ch = createColumnHelper<CorpusRow>()
    const cols: ColumnDef<CorpusRow>[] = [
      ch.accessor('symbol', {
        header: 'Symbol', size: 90, cell: (i) => (
          <span className="font-bold tracking-wide" style={{ color: C.TEXT }}>{i.getValue()}</span>
        ),
      }),
      ch.accessor('signalDate', {
        header: 'Signal', size: 95, cell: (i) => <span className="text-xs" style={{ color: C.MUTED }}>{i.getValue()}</span>,
      }),
    ]
    cols.push(
      ch.accessor('setupType', {
        header: 'Setup Type', size: 120, cell: (i) => (
          <ClassifySelect value={i.getValue()} options={enumOpts('setupType')} colors={enumColors('setupType')} placeholder="—"
            allowCreate onCreate={(label) => { addEnumOption('setupType', label); updateField(i.row.original.id, { setupType: label, status: 'classified' }) }}
            onChange={(v) => updateField(i.row.original.id, { setupType: v, status: v ? 'classified' : 'new' })} />
        ),
      }),
      ch.accessor('setup', {
        header: 'Setup', size: 140, cell: (i) => (
          <ClassifySelect value={i.getValue()} options={enumOpts('setup')} colors={enumColors('setup')} placeholder="—"
            allowCreate onCreate={(label) => { addEnumOption('setup', label); updateField(i.row.original.id, { setup: label }) }}
            onChange={(v) => updateField(i.row.original.id, { setup: v })} />
        ),
      }),
      ch.accessor('grade', {
        header: 'Grade', size: 85, cell: (i) => (
          <ThemedSelect value={i.getValue()} options={enumOpts('grade')} colors={enumColors('grade')} onChange={(v) => updateField(i.row.original.id, { grade: v })} />
        ),
      }),
      ch.accessor('move', {
        header: 'Move', size: 150, cell: (i) => (
          <ThemedSelect value={i.getValue()} options={enumOpts('move')} colors={enumColors('move')} placeholder="—"
            allowCreate onCreate={(label) => { addEnumOption('move', label); updateField(i.row.original.id, { move: label }) }}
            onChange={(v) => updateField(i.row.original.id, { move: v })} />
        ),
      }),
      ch.accessor('tags', {
        header: 'Tags', size: 180, cell: (i) => {
          const tags = (i.getValue() ?? []) as string[]
          if (!tags.length) return <span className="text-xs" style={{ color: C.BORDER }}>—</span>
          const show = tags.slice(0, 2); const hidden = tags.length - show.length
          return <div className="flex flex-wrap gap-1 items-center" style={{ maxHeight: 26, overflow: 'hidden' }}>
            {show.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#c4b5fd', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)' }}>{t}</span>
            ))}
            {hidden > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }} title={`${hidden} more: ${tags.slice(2).join(', ')}`}>+{hidden}</span>}
          </div>
        },
      }),
      // ── day trade quick-open buttons (d0–d4) ──
      ...[0,1,2,3,4].map((off) => ch.display({
        id: `day${off}`, size: 42,
        header: () => <span className="text-[10px] font-mono" style={{ color: C.MUTED }}>d{off}</span>,
        cell: (i) => {
          const r = i.row.original
          const d = new Date(r.signalDate); d.setDate(d.getDate() + off)
          const dateStr = d.toISOString().slice(0,10)
          const has = (trades[r.id] ?? []).some((t) => t.date === dateStr)
          return (
            <button onClick={(e) => { e.stopPropagation(); openDayTrade(r.id, r.signalDate, off) }}
              title={`Open d${off} trade — ${dateStr}`}
              className="w-7 h-7 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-colors hover:opacity-100"
              style={{ background: has ? C.GOLD_DIM : 'transparent', color: has ? C.GOLD : C.MUTED, border: `1px solid ${has ? C.GOLD_BORDER : C.BORDER}`, opacity: 0.7 }}>
              {off}
            </button>
          )
        },
      })),
      // ── scan-source columns (moved right so classify columns lead) ──
      ch.accessor('scanSources', {
        header: 'Sources', size: 80, cell: (i) => (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.MUTED, background: C.SURFACE2 }}>{i.getValue().length}</span>
        ),
      }),
      ...loadedScanNames.map((name) => ch.display({
        id: `scan__${name}`, size: 40,
        enableSorting: false,
        header: () => <span className="text-[10px] font-semibold uppercase tracking-wide truncate block max-w-[90px]" title={name} style={{ color: C.TEXT2 }}>{name}</span>,
        cell: (i) => {
          const hit = i.row.original.scanSources.includes(name)
          return hit ? (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm" style={{ background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` }}>
              <Check className="w-2.5 h-2.5" style={{ color: C.GOLD }} />
            </span>
          ) : <span style={{ color: C.BORDER }}>·</span>
        },
      })),
      // ── user-defined custom columns (forward testing) ──
      ...fields.map((f) => ch.display({
        id: `custom__${f.id}`, size: 140,
        sortingFn: (rowA, rowB) => {
          const a = (rowA.original.customValues ?? {})[f.id]
          const b = (rowB.original.customValues ?? {})[f.id]
          // nulls/undefined sort last
          if (a == null && b == null) return 0
          if (a == null) return 1
          if (b == null) return -1
          if (typeof a === 'number' && typeof b === 'number') return a - b
          if (Array.isArray(a) && Array.isArray(b)) return a.length - b.length
          return String(a).localeCompare(String(b))
        },
        header: () => (
          <div className="flex items-center gap-1 w-full">
            <span className="text-[10px] font-semibold uppercase tracking-wide truncate" title={f.name} style={{ color: C.GOLD }}>{f.name}</span>
            <span className="text-[8px] uppercase shrink-0" style={{ color: C.MUTED }}>{FIELD_TYPE_LABELS[f.type]}</span>
            <div className="flex items-center gap-0.5 ml-auto shrink-0 opacity-0 group-hover/hdr:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); setFieldModal({ open: true, edit: f }) }} title="Edit column" className="px-0.5 text-[11px] hover:opacity-100" style={{ color: C.TEXT2 }}>✎</button>
              <button onClick={(e) => { e.stopPropagation(); deleteField(f.id, f.name) }} title="Delete column" className="px-0.5 text-[11px] hover:opacity-100" style={{ color: C.RED }}>✕</button>
            </div>
          </div>
        ),
        cell: (i) => {
          const rid = i.row.original.id
          const val = (i.row.original.customValues ?? {})[f.id]
          if (f.type === 'tags') return <TagsDisplay value={val} colors={f.colors} onActivate={() => setSelectedId(rid)} />
          return <CustomCell field={f} value={val} colors={f.colors} onSave={(v) => saveCustomValue(rid, f.id, v)} onAddOption={(label) => { addFieldOption(f.id, label); saveCustomValue(rid, f.id, label) }} onCreateOption={(label) => addFieldOption(f.id, label)} getTagsSuggestions={tagsSuggestions} />
        },
      })),
      ch.display({
        id: 'actions', enableSorting: false, enableColumnResizing: false, size: 48,
        header: () => (
          <ColumnMenu
            fields={fields}
            onCreate={() => setFieldModal({ open: true })}
            onEdit={(f) => setFieldModal({ open: true, edit: f })}
            onDelete={deleteField}
          />
        ),
        cell: (i) => (
          <button onClick={() => deleteRow(i.row.original.id)} className="p-1 transition-colors" style={{ color: C.MUTED }} title="Delete">
            <Trash2 className="w-3.5 h-3.5 hover:text-red-400" />
          </button>
        ),
      }),
    )
    return cols
  }, [loadedScanNames, fields, enums, trades, enumOpts, enumColors, addEnumOption, addFieldOption, updateField, deleteRow, saveCustomValue, deleteField, openDayTrade, tagsSuggestions, setSelectedId])

  // Unified client-side filter — works on ANY column
  const tableData = useMemo(() => {
    const active = Object.entries(columnFilters).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && v.length === 0))
    if (active.length === 0) return rows
    return rows.filter((r) => active.every(([key, want]) => {
      if (Array.isArray(want)) {
        // multi-select: OR within column (exact for scalars, any-of for arrays)
        if (key.startsWith('custom__')) {
          const fid = key.slice(8)
          const rv0 = (r.customValues ?? {})[fid]
          return Array.isArray(rv0) ? want.some((w) => rv0.includes(w)) : want.includes(rv0)
        }
        const rv0 = (r as any)[key]
        if (key === 'scanSources' || key === 'tags') return Array.isArray(rv0) && rv0.some((x: string) => want.includes(x))
        return want.includes(rv0)
      }
      if (key.startsWith('custom__')) {
        const fid = key.slice(8)
        const rv = (r.customValues ?? {})[fid]
        if (want === '__true') return rv === true
        if (want === '__false') return rv !== true
        if (Array.isArray(rv)) return rv.includes(want)
        return String(rv ?? '').toLowerCase().includes(want.toLowerCase())
      }
      const rv = (r as any)[key]
      if (key === 'scanSources') return Array.isArray(rv) && rv.includes(want)
      if (key === 'tags') return Array.isArray(rv) && rv.some((t: string) => t.toLowerCase().includes(want.toLowerCase()))
      if (key === 'symbol') return String(rv ?? '').toLowerCase().includes(want.toLowerCase())
      if (key === 'setupType' || key === 'grade') return rv === want
      if (key === 'signalDate') return String(rv ?? '') === want
      return String(rv ?? '').toLowerCase().includes(want.toLowerCase())
    }))
  }, [rows, columnFilters])

  const [{ pageIndex, pageSize }, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  // ── column drag-reorder (client columnOrder state, reconciled with dynamic columns) ──
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const orderedIds = useMemo(() => {
    const allIds = columns.map((c) => c.id)
    const PINNED = ['symbol', 'signalDate']           // Symbol & Signal are locked to the front
    const pinned = PINNED.filter((id) => allIds.includes(id))
    const rest = allIds.filter((id) => !pinned.includes(id))
    let orderedRest: string[]
    if (columnOrder.length === 0) orderedRest = rest
    else {
      const known = new Set(rest)
      orderedRest = columnOrder.filter((id) => known.has(id))
      const seen = new Set(orderedRest)
      for (const id of rest) if (!seen.has(id)) orderedRest.push(id)
    }
    return [...pinned, ...orderedRest]
  }, [columns, columnOrder])
  const [dragOver, setDragOver] = useState<string | null>(null)
  const persistFieldOrder = useCallback(async (fullOrder: string[]) => {
    const ids = fullOrder.filter((id) => id.startsWith('custom__')).map((id) => id.slice(8))
    if (ids.length < 2) return
    await dbFetch('/api/database/fields', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reorder: ids.map((id, i) => ({ id, order: i })) }) })
  }, [])

  // pointer-based column drag — robust under html{zoom:0.9} (elementFromPoint shares the cursor's coord space, unlike native DnD)
  const startColDrag = useCallback((e: React.MouseEvent, colId: string) => {
    if (colId === 'symbol' || colId === 'signalDate') return
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, .cursor-col-resize, input, select')) return
    const sx = e.clientX, sy = e.clientY
    let dragging = false
    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.abs(ev.clientX - sx) < 5 && Math.abs(ev.clientY - sy) < 5) return
        dragging = true
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const id = el?.closest('th[data-colid]')?.getAttribute('data-colid') ?? null
      setDragOver((cur) => (cur === id ? cur : id))
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragOver(null)
      if (!dragging) return // it was a click (sort), not a drag
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const to = el?.closest('th[data-colid]')?.getAttribute('data-colid') ?? null
      if (to && to !== colId) {
        const base = orderedIds.slice()
        const fi = base.indexOf(colId), ti = base.indexOf(to)
        if (fi >= 0 && ti >= 0) { const [m] = base.splice(fi, 1); base.splice(ti, 0, m); setColumnOrder(base); persistFieldOrder(base) }
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [orderedIds, persistFieldOrder])

  const table = useReactTable({
    data: tableData, columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
    state: { sorting, columnOrder: orderedIds, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onPaginationChange: setPagination,
  })

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])
  const counts = useMemo(() => ({
    total: rows.length,
    graded: rows.filter((r) => r.grade).length,
    classified: rows.filter((r) => r.setupType).length,
  }), [rows])

  return (
    <ThemeContext.Provider value={C}>
    {/* Shell height is responsive to the two-row TopNav: main nav h-14 (56px) always, plus a sticky sub-nav h-10 (40px) that only renders on md+ (top-nav.tsx). So subtract 56px on mobile, 96px on desktop — otherwise the pagination footer (last flex child) is clipped ~40px below the fold. (REQ-332) */}
    <div className="h-[calc(100vh-56px)] md:h-[calc(100vh-96px)] flex flex-col overflow-hidden font-mono" style={{ background: C.BG, color: C.TEXT }}>
      {/* Header */}
      <header className="relative z-[1100] flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: C.BORDER }}>
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5" style={{ color: C.GOLD }} />
          <h1 className="text-base font-bold" style={{ color: C.TEXT }}>Pattern Corpus</h1>
          <span className="text-xs" style={{ color: C.MUTED }}>
            {counts.total} rows · {counts.classified} classified · {counts.graded} graded
          </span>
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.MUTED }} />}
          {/* Database (workspace) switcher */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: C.SURFACE, border: `1px solid ${C.BORDER}` }}>
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: C.MUTED }}>DB</span>
            <select
              value={currentDbId ?? ''}
              onChange={(e) => switchDatabase(e.target.value)}
              className="bg-transparent text-xs font-bold outline-none cursor-pointer"
              style={{ color: C.TEXT }}
              title="Switch database (workspace)"
            >
              {databases.map((d) => (
                <option key={d.id} value={d.id} style={{ background: C.SURFACE2 }}>{d.name} · {d.rowCount}</option>
              ))}
            </select>
            <button onClick={() => { const n = prompt('Name for the new (empty) database:'); if (n?.trim()) createDatabase(n.trim()) }} title="New empty database"
              className="opacity-70 hover:opacity-100 transition-opacity" style={{ color: C.GOLD }}>
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { if (!currentDbId) return; const cur = databases.find((d) => d.id === currentDbId); const n = prompt(`Duplicate "${cur?.name ?? ''}" to a new database named:`); if (n?.trim()) createDatabase(n.trim(), currentDbId) }} title="Duplicate current database"
              className="opacity-70 hover:opacity-100 transition-opacity" style={{ color: C.GOLD }}>
              <Copy className="w-3.5 h-3.5" />
            </button>
            {databases.length > 1 && (
              <button onClick={() => { if (currentDbId && confirm('Delete this database and ALL its rows + trades? Cannot be undone.')) deleteDatabase(currentDbId) }} title="Delete current database"
                className="opacity-70 hover:opacity-100 transition-opacity" style={{ color: C.RED }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded p-0.5" style={{ background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
            {(['database', 'review'] as const).map((m) => (
              <button key={m} onClick={() => setViewMode(m)}
                className="text-[10px] px-2 py-0.5 rounded font-mono transition-colors"
                style={viewMode === m
                  ? { color: C.BG, background: C.GOLD }
                  : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
                {m === 'database' ? 'Database' : 'Review'}
              </button>
            ))}
          </div>
          <FilterPopup
            filterDefs={filterDefs}
            values={columnFilters}
            onChange={setColumnFilters}
          />
          <button
            onClick={() => setDark((d) => !d)} title={dark ? 'Light mode' : 'Dark mode'}
            className="p-1.5 rounded flex items-center justify-center transition-colors"
            style={{ background: C.SURFACE, color: dark ? C.GOLD : C.TEXT2, border: `1px solid ${C.BORDER}` }}
          >
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <div className="relative group">
            <button
              onClick={() => setFieldModal({ open: true })}
              className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
              style={{ background: C.SURFACE, color: C.TEXT2, border: `1px solid ${C.BORDER}` }}
              title="Add a custom column"
            >
              <Plus className="w-3.5 h-3.5" />
              Column
              {fields.length > 0 && <span className="text-[10px] px-1 rounded" style={{ background: C.GOLD, color: C.BG }}>{fields.length}</span>}
            </button>
          </div>
          <button
            onClick={() => setLoaderOpen((o) => !o)}
            className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
            style={{ background: loaderOpen ? C.GOLD_DIM : C.SURFACE, color: loaderOpen ? C.GOLD : C.TEXT2, border: `1px solid ${loaderOpen ? C.GOLD_BORDER : C.BORDER}` }}
          >
            <Layers className="w-3.5 h-3.5" />
            Load Scans
            {loadedScanNames.length > 0 && <span className="text-[10px] px-1 rounded" style={{ background: C.GOLD, color: C.BG }}>{loadedScanNames.length}</span>}
          </button>
        </div>
      </header>

      {/* status banner */}
      {status && (
        <div className="flex items-center gap-2 px-5 py-2 border-b text-xs" style={{
          borderColor: C.BORDER,
          background: status.kind === 'ok' ? 'rgba(52,211,153,0.08)' : status.kind === 'warn' ? C.GOLD_DIM : 'rgba(239,68,68,0.10)',
          color: status.kind === 'ok' ? '#34d399' : status.kind === 'warn' ? C.GOLD : C.RED,
        }}>
          {status.kind === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          <span className="flex-1">{status.msg}</span>
          <button onClick={() => setStatus(null)} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Loader panel */}
      {loaderOpen && (
        <ScanLoader
          scans={scans}
          selected={selectedScanIds}
          onToggle={toggleScan}
          onToggleGroup={toggleGroup}
          onClear={() => setSelectedScanIds(new Set())}
          onLoad={handleLoad}
          loading={importing}
        />
      )}

      {/* Active scan chips — X evicts a scan from the corpus */}
      {loadedScanNames.length > 0 && (
        <div className="flex items-center gap-1.5 px-5 py-2 border-b flex-wrap" style={{ borderColor: C.BORDER, background: C.SURFACE }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold mr-1" style={{ color: C.MUTED }}>Loaded</span>
          {loadedScanNames.map((n) => (
            <span key={n} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-mono" style={{ background: C.GOLD_DIM, color: C.GOLD, border: `1px solid ${C.GOLD_BORDER}` }}>
              {n}
              <button onClick={() => removeScan(n)} title={`Remove ${n} from corpus`} className="opacity-60 hover:opacity-100 leading-none">✕</button>
            </span>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={downloadBackup} title="Download a full JSON backup (rows, trades, screenshots)"
              className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` }}>
              ⤓ Backup
            </button>
            <label title="Restore database from a backup JSON (replaces everything)"
              className="text-[10px] px-2 py-0.5 rounded font-semibold cursor-pointer" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
              ⤒ Restore
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) restoreBackup(f); e.target.value = '' }} />
            </label>
            <button onClick={() => { if (confirm('Clear ALL rows from the corpus? This cannot be undone. (Tip: download a Backup first!)')) clearAll() }}
              className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ color: C.RED, background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.3)` }}>
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Table — database mode: single scroll area; review mode: split (chart | table) */}
      <div className={viewMode === 'review' ? 'flex flex-1 min-h-0' : 'flex-1 min-h-0 overflow-auto'}>
        {viewMode === 'review' && (
          <div className="w-[55%] border-r flex flex-col min-h-0 p-2" style={{ borderColor: C.BORDER }}>
            <ReviewPane symbol={selected?.symbol} date={selected?.signalDate} dark={dark} C={C} />
          </div>
        )}
        <div className={viewMode === 'review' ? 'flex-1 min-h-0 overflow-auto' : 'contents'}>
        {loading ? (
          <div className="flex items-center justify-center h-full" style={{ color: C.MUTED }}>
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8" style={{ color: C.MUTED }}>
            <Inbox className="w-10 h-10 opacity-40" />
            <p className="text-sm">No rows in this database yet.</p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button onClick={() => setLoaderOpen(true)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1.5" style={{ background: C.GOLD, color: C.BG }}>
                <Layers className="w-3.5 h-3.5" /> Load scans to populate
              </button>
              <button onClick={() => setFieldModal({ open: true })} title="Create a custom column" className="text-xs px-3 py-1.5 rounded flex items-center gap-1.5 font-semibold" style={{ background: C.SURFACE2, color: C.GOLD, border: `1px solid ${C.GOLD_BORDER}` }}>
                <Plus className="w-3.5 h-3.5" /> New column
              </button>
            </div>
            {fields.length > 0 && (
              <div className="mt-3 flex flex-col items-center gap-1.5 w-full max-w-lg">
                <p className="text-[10px] uppercase tracking-wider opacity-70">Columns ({fields.length})</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {fields.map((f) => (
                    <span key={f.id} className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1.5" style={{ background: C.SURFACE2, color: C.TEXT2, border: `1px solid ${C.BORDER}` }}>
                      {f.name}
                      <button onClick={() => setFieldModal({ open: true, edit: f })} title="Edit column" className="opacity-60 hover:opacity-100" style={{ color: C.MUTED }}>✎</button>
                      <button onClick={() => deleteField(f.id, f.name)} title="Delete column" className="opacity-60 hover:opacity-100" style={{ color: C.RED }}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <table className="text-sm" style={{ tableLayout: 'fixed', width: table.getTotalSize() }}>
            <thead className="sticky top-0 z-10 backdrop-blur" style={{ background: `${C.BG}f5` }}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b" style={{ borderColor: C.BORDER }}>
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort()
                    const dir = h.column.getIsSorted()
                    return (
                    <th key={h.id} data-colid={h.column.id}
                      onMouseDown={(e) => startColDrag(e, h.column.id)}
                      className={`text-left font-semibold text-xs uppercase tracking-wider px-3 py-2.5 whitespace-nowrap relative group/hdr select-none ${h.column.id !== 'symbol' && h.column.id !== 'signalDate' ? 'cursor-grab active:cursor-grabbing' : ''} ${dragOver === h.column.id ? 'ring-2 ring-inset' : ''}`}
                      style={{ color: C.MUTED, width: h.getSize(),
                        ...((h.column.id === 'symbol' || h.column.id === 'signalDate') ? {
                          position: 'sticky', left: h.column.id === 'symbol' ? 0 : (table.getColumn('symbol')?.getSize() ?? 90),
                          zIndex: 11, background: `${C.BG}f5`,
                          boxShadow: h.column.id === 'signalDate' ? '2px 0 6px -2px rgba(0,0,0,.5)' : undefined,
                        } : { boxShadow: dragOver === h.column.id ? `inset 2px 0 0 ${C.GOLD}` : undefined }) }}>
                      {canSort ? (
                        <div onClick={() => h.column.toggleSorting(dir === 'asc')}
                          className="flex items-center gap-1 transition-colors hover:opacity-100 cursor-pointer" style={{ opacity: dir ? 1 : 0.8 }}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" style={{ color: C.GOLD }} />
                          : dir === 'desc' ? <ArrowDown className="w-3 h-3 shrink-0" style={{ color: C.GOLD }} />
                          : <ArrowUpDown className="w-3 h-3 shrink-0 opacity-50" />}
                        </div>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                      {h.column.id === 'setupType' || h.column.id === 'setup' || h.column.id === 'grade' || h.column.id === 'move' ? (
                        <button onClick={(e) => { e.stopPropagation(); setEnumModal({ key: h.column.id, title: h.column.id === 'setupType' ? 'Setup Type' : h.column.id === 'setup' ? 'Setup' : h.column.id === 'grade' ? 'Grade' : 'Move' }) }}
                          title="Manage options" className="absolute top-1.5 right-2 opacity-0 group-hover/hdr:opacity-70 hover:!opacity-100 transition-opacity z-10">
                          <Settings className="w-3 h-3" style={{ color: C.TEXT2 }} />
                        </button>
                      ) : null}
                      {h.column.getCanResize() && (
                        <div
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                          className="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none group/th"
                          style={{ background: h.column.getIsResizing() ? C.GOLD : 'transparent', transition: 'background 0.15s' }}
                        >
                          <div className="absolute inset-y-0 -left-0.5 w-0.5 opacity-0 group-hover/th:opacity-40" style={{ background: C.GOLD }} />
                        </div>
                      )}
                    </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} onClick={() => setSelectedId(row.original.id)}
                  className="border-b cursor-pointer transition-colors"
                  style={{ borderColor: C.SURFACE2, background: selectedId === row.original.id ? C.SURFACE2 : 'transparent' }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle whitespace-nowrap" style={{
                      width: cell.column.getSize(),
                      ...((cell.column.id === 'symbol' || cell.column.id === 'signalDate') ? {
                        position: 'sticky', left: cell.column.id === 'symbol' ? 0 : (table.getColumn('symbol')?.getSize() ?? 90),
                        zIndex: 2, background: selectedId === row.original.id ? C.SURFACE2 : C.BG,
                        boxShadow: cell.column.id === 'signalDate' ? '2px 0 6px -2px rgba(0,0,0,.5)' : undefined,
                      } : {}),
                    }} onClick={(e) => {
                      const t = e.target as HTMLElement
                      if (t.closest('select') || t.closest('button') || t.closest('.cursor-col-resize')) e.stopPropagation()
                    }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Pagination — caps DOM rows so typing/re-render stays fast with hundreds of rows */}
      {table.getPageCount() > 1 && (
        <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-1.5 border-t" style={{ borderColor: C.BORDER, background: C.SURFACE }}>
          <div className="flex items-center gap-1">
            <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="text-[10px] px-2 py-0.5 rounded font-mono disabled:opacity-30" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>«</button>
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="text-[10px] px-2 py-0.5 rounded font-mono disabled:opacity-30" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>◀</button>
            <span className="text-[10px] font-mono px-2" style={{ color: C.MUTED }}>page {pageIndex + 1} / {table.getPageCount()}</span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="text-[10px] px-2 py-0.5 rounded font-mono disabled:opacity-30" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▶</button>
            <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="text-[10px] px-2 py-0.5 rounded font-mono disabled:opacity-30" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>»</button>
          </div>
          <span className="text-[10px] font-mono" style={{ color: C.MUTED }}>{tableData.length} rows · {pageSize}/page</span>
          <select value={pageSize} onChange={(e) => { setPagination(p => ({ pageIndex: 0, pageSize: Number(e.target.value) })) }} className="text-[10px] rounded px-1 py-0.5 font-mono" style={{ background: C.SURFACE2, color: C.MUTED, border: `1px solid ${C.BORDER}` }}>
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {columnOrder.length > 0 && (
            <button onClick={() => setColumnOrder([])} title="Reset column order to default (Symbol, Signal first)" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.GOLD, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>↺ cols</button>
          )}
        </div>
      )}

      {selected && (
        <div onMouseDown={onSplitDown} title="Drag to resize"
          className="shrink-0 h-[5px] cursor-row-resize flex items-center justify-center group transition-colors"
          style={{ background: C.BORDER }}>
          <div className="h-1 w-12 rounded-full group-hover:w-20 transition-all" style={{ background: C.MUTED, opacity: 0.6 }} />
        </div>
      )}
      {selected && viewMode === 'database' && (
        <RowDrawer row={selected} panelH={panelH} fields={fields}
          customValues={selected.customValues ?? {}}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => updateField(selected.id, patch)}
          onNotes={(val) => saveNotes(selected.id, val)}
          onSaveCustom={(fieldId, v) => saveCustomValue(selected.id, fieldId, v)}
          onEditField={(f) => setFieldModal({ open: true, edit: f })}
          onDeleteField={deleteField}
          enumOpts={enumOpts} enumColors={enumColors} addEnumOption={addEnumOption} addFieldOption={addFieldOption}
          getTagsSuggestions={tagsSuggestions}
          allTags={Array.from(new Set(rows.flatMap((r) => r.tags ?? []))).sort()}
          trades={trades[selected.id] ?? []}
          onAddTrade={(dir) => addTrade(selected.id, dir, selected.signalDate)}
          onUpdateTrade={(tid, patch) => updateTrade(selected.id, tid, patch)}
          onDeleteTrade={(tid) => deleteTrade(selected.id, tid)}
          openTradeId={openTradeId} setOpenTradeId={setOpenTradeId} />
      )}
      {fieldModal.open && (
        <FieldModal
          edit={fieldModal.edit}
          onClose={() => setFieldModal({ open: false })}
          onSubmit={(name, type, options, colors, shared) => {
            if (fieldModal.edit) updateColumn(fieldModal.edit.id, name, options, colors, shared)
            else createField(name, type, options, colors, shared)
          }}
          onDelete={fieldModal.edit ? () => deleteField(fieldModal.edit.id, fieldModal.edit.name) : undefined}
        />
      )}
      {enumModal && (
        <ManageEnumModal
          enumKey={enumModal.key}
          title={enumModal.title}
          options={enums[enumModal.key] ?? []}
          onSave={saveEnum}
          onClose={() => setEnumModal(null)}
        />
      )}
    </div>
    </ThemeContext.Provider>
  )
}

// PnL for a trade — short: (entry-exit)*qty, long: (exit-entry)*qty
function pnl(t: CorpusTrade): number {
  if (t.entryPrice == null || t.exitPrice == null || t.qty == null) return 0
  return (t.direction === 'short' ? t.entryPrice - t.exitPrice : t.exitPrice - t.entryPrice) * t.qty
}

// Small labeled number input (for trade entry/exit/qty)
function LabeledNum({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number | null) => void }) {
  const C = useTheme()
  return (
    <div className="flex flex-col">
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onSave(e.target.value === '' ? null : Number(e.target.value))}
        placeholder={label}
        className="w-16 border rounded px-1 py-0.5 text-[10px] font-mono"
        style={{ background: 'transparent', borderColor: C.BORDER, color: C.TEXT2 }}
      />
    </div>
  )
}

// One multi-timeframe context section on a trade: text + paste-able annotations
const TRADE_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'daily', label: 'Daily Context', hint: 'Broader market — indices, sector, what kind of day is it?' },
  { key: 'htf', label: 'HTF Context', hint: 'High timeframe structure — the big picture on the name' },
  { key: 'mtf', label: 'MTF Context', hint: 'Mid timeframe — where on the cycle, the setup read' },
  { key: 'ltf', label: 'LTF Execution', hint: 'Low timeframe — entry trigger, execution, management' },
]

// One document section — generous textarea + screenshot paste (Notion-grade)
function TradeSection({ label, hint, section, onChange }: {
  label: string
  hint?: string
  section: { text: string; annots: { ref: string; caption?: string }[] } | null
  onChange: (s: { text: string; annots: { ref: string; caption?: string }[] }) => void
}) {
  const C = useTheme()
  const propText = section?.text ?? ''
  const annots = Array.isArray(section?.annots) ? section!.annots : []
  // LOCAL text state + debounced push so typing never re-renders the whole table
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
        placeholder="Write your analysis… (paste screenshots straight in)"
        className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none min-h-[120px]"
        style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }} />
      {annots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {annots.map((a, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.ref} alt={a.caption ?? ''} className="w-48 h-32 object-cover rounded-lg border" style={{ borderColor: C.BORDER }} />
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

// ─── Trade Document — inline expandable writing surface (chart stays visible) ──
function TradeDocument({ trade, row, onUpdate, onDelete, enumOpts, enumColors, addEnumOption, hideDate }: {
  trade: CorpusTrade
  row: CorpusRow
  onUpdate: (patch: Partial<CorpusTrade>) => void
  onDelete: () => void
  enumOpts: (key: string) => string[]
  enumColors: (key: string) => Record<string, string>
  addEnumOption: (key: string, label: string) => void
  hideDate?: boolean
}) {
  const C = useTheme()
  const isShort = trade.direction === 'short'
  const p = pnl(trade)
  const dColor = isShort ? C.RED : C.GREEN
  const updSec = (key: string, s: any) => onUpdate({ sections: { ...(trade.sections ?? {}), [key]: s } })
  return (
    <div className="border rounded-lg mt-1" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
      {/* header */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: C.BORDER }}>
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: dColor + '22', color: dColor }}>{trade.direction}</span>
        <div className="w-24"><ThemedSelect value={trade.routeStart} options={enumOpts('routeStart')} colors={enumColors('routeStart')} placeholder="start" allowCreate onCreate={(l) => { addEnumOption('routeStart', l); onUpdate({ routeStart: l }) }} onChange={(v) => onUpdate({ routeStart: v })} /></div>
        <div className="w-24"><ThemedSelect value={trade.routeEnd} options={enumOpts('routeEnd')} colors={enumColors('routeEnd')} placeholder="end" allowCreate onCreate={(l) => { addEnumOption('routeEnd', l); onUpdate({ routeEnd: l }) }} onChange={(v) => onUpdate({ routeEnd: v })} /></div>
        <button onClick={onDelete} className="text-[10px] opacity-50 hover:opacity-100 ml-auto" style={{ color: C.RED }}>Delete</button>
      </div>
      {/* document body */}
      <div className="px-2.5 py-3 space-y-4">
        {/* basic info */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase" style={{ color: C.MUTED }}>Setup</span>
            <span className="text-xs font-semibold" style={{ color: C.TEXT }}>{row.setupType ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase" style={{ color: C.MUTED }}>Move</span>
            <span className="text-xs font-semibold" style={{ color: C.TEXT }}>{row.move ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase" style={{ color: C.MUTED }}>Stage</span>
            <div className="w-40"><ThemedSelect value={trade.trendStage} options={enumOpts('trendStage')} colors={enumColors('trendStage')} placeholder="—"
              allowCreate onCreate={(label) => { addEnumOption('trendStage', label); onUpdate({ trendStage: label }) }}
              onChange={(v) => onUpdate({ trendStage: v })} /></div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase" style={{ color: C.MUTED }}>Date</span>
            {!hideDate && <input type="date" value={trade.date ?? ''} onChange={(e) => onUpdate({ date: e.target.value || null })} className="w-[112px] border rounded px-1.5 py-0.5 text-xs font-mono" style={{ background: C.BG, borderColor: C.BORDER, color: C.TEXT }} />}
          </div>
        </div>
        {/* document sections */}
        {TRADE_SECTIONS.map((s) => (
          <TradeSection key={s.key} label={s.label} hint={s.hint} section={(trade.sections as any)?.[s.key] ?? null} onChange={(sec) => updSec(s.key, sec)} />
        ))}
      </div>
    </div>
  )
}

// ─── Row workspace drawer ─────────────────────────────────
function RowDrawer({
  row, panelH, fields, customValues, onClose, onUpdate, onNotes, onSaveCustom, onEditField, onDeleteField,
  enumOpts, enumColors, addEnumOption, addFieldOption,
  allTags,
  getTagsSuggestions,
  trades, onAddTrade, onUpdateTrade, onDeleteTrade,
  openTradeId, setOpenTradeId,
}: {
  row: CorpusRow
  panelH: number
  fields: CorpusField[]
  customValues: Record<string, any>
  onClose: () => void
  onUpdate: (patch: Partial<CorpusRow>) => void
  onNotes: (val: string) => void
  onSaveCustom: (fieldId: string, v: any) => void
  onEditField: (f: CorpusField) => void
  onDeleteField: (id: string, name: string) => void
  enumOpts: (key: string) => string[]
  enumColors: (key: string) => Record<string, string>
  addEnumOption: (key: string, label: string) => void
  addFieldOption: (fieldId: string, label: string) => void
  getTagsSuggestions: (fieldId: string) => string[]
  allTags: string[]
  trades: CorpusTrade[]
  onAddTrade: (direction: string) => void
  onUpdateTrade: (tradeId: string, patch: Partial<CorpusTrade>) => void
  onDeleteTrade: (tradeId: string) => void
  openTradeId: string | null
  setOpenTradeId: (id: string | null) => void
}) {
  const C = useTheme()
  const [tagInput, setTagInput] = useState('')
  const [tf, setTf] = useState<Timeframe>('D')
  const [chartExpanded, setChartExpanded] = useState(false)
  const [panOffset, setPanOffset] = useState(0)   // extra days beyond base dayOffset (◀/▶)
  const [extraDays, setExtraDays] = useState(0)   // widened view (+=3/7/14)
  const ZOOM_RANGES = { '6m': { before: 126, after: 25 }, '1y': { before: 252, after: 25 }, '2y': { before: 504, after: 25 }, '3y': { before: 756, after: 25 } } as const
  const [zoomPreset, setZoomPreset] = useState<string | null>(null)  // daily zoom-out: null = perfect default | '6m'|'1y'|'2y'|'3y'
  // N trading days before D0 + ~1mo after (the post-gap move). null => no zoomDays =>
  // ScanMiniChart behaves exactly as the "perfect" starting daily chart.
  const zoomDays = zoomPreset ? ZOOM_RANGES[zoomPreset] : undefined
  const navDayOffset = (tf === 'D' ? 6 : 1) + panOffset
  const [mounted, setMounted] = useState(false)
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const [chartH, setChartH] = useState(300)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const el = chartWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setChartH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [showInd, setShowInd] = useState(false)
  const [settings, setSettings] = useState<ChartSettings>(() => ({ ...DEFAULT_SETTINGS }))
  const toggle = (key: keyof ChartSettings) => setSettings((s) => ({ ...s, [key]: !s[key] }))
  const applyTemplate = (id: string) => {
    const t = IND_TEMPLATES.find((x) => x.id === id)
    if (t) setSettings((s) => ({ ...s, ...t.settings }))
  }
  const metricEntries = useMemo(() => { try { return Object.entries(row.metrics ?? {}) } catch { return [] } }, [row.metrics])

  // paste a screenshot (copied from the lab) straight into annotations
  const onPasteAnnotation = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.type.startsWith('image/')) {
        const file = it.getAsFile(); if (!file) continue
        const reader = new FileReader()
        reader.onload = () => onUpdate({ annotations: [...annots, { ref: reader.result, caption: '' }] })
        reader.readAsDataURL(file)
        e.preventDefault()
        return
      }
    }
  }
  const removeAnnot = (i: number) => onUpdate({ annotations: annots.filter((_, idx) => idx !== i) })
  const annots = useMemo(() => { try { return Array.isArray(row.annotations) ? row.annotations : [] } catch { return [] } }, [row.annotations])

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !row.tags.includes(t)) onUpdate({ tags: [...row.tags, t] })
    setTagInput('')
  }

  return (
    <div className="shrink-0 border-t flex flex-col" style={{ height: panelH || '50%', background: C.BG, borderColor: C.BORDER }}>
      <div className="shrink-0 backdrop-blur border-b px-5 py-1.5 flex items-center justify-between" style={{ background: `${C.BG}f5`, borderColor: C.BORDER }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl font-black tracking-wide" style={{ color: C.TEXT }}>{row.symbol}</span>
            <span className="text-xs" style={{ color: C.MUTED }}>{row.signalDate}</span>
            <div className="flex gap-1 flex-wrap">
              {row.scanSources.map((s) => (
                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` }}>{s}</span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1" style={{ color: C.MUTED }}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* LEFT — chart (stays in view while you classify) */}
          <div className="w-1/2 border-r flex flex-col p-2 gap-1.5" style={{ borderColor: C.BORDER }}>
            <div className="flex items-center justify-between shrink-0">
              <h3 className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1" style={{ color: C.MUTED }}><BarChart3 className="w-3 h-3" />Chart</h3>
              <div className="flex gap-0.5">
                {TF_OPTIONS.map((t) => (
                  <button key={t} onClick={() => setTf(t)} className="text-[10px] px-2 py-0.5 rounded font-mono transition-colors"
                    style={tf === t
                      ? { color: C.BG, background: C.GOLD }
                      : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
                    {TF_LABELS[t]}
                  </button>
                ))}
                <button onClick={() => setChartExpanded(true)} title="Expand chart (big screenshot)"
                  className="ml-1 p-0.5 rounded flex items-center justify-center transition-colors hover:opacity-100"
                  style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}`, opacity: 0.8 }}>
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setZoomPreset(null); setPanOffset(p => p - 1) }} title="Pan back 1 day" className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>◀</button>
              <button onClick={() => { setPanOffset(0); setExtraDays(0); setZoomPreset(null) }} title="Reset to D0" className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ color: C.BG, background: C.GOLD }}>D0</button>
              <button onClick={() => { setZoomPreset(null); setPanOffset(p => p + 1) }} title="Pan forward 1 day" className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▶</button>
              <span className="w-px h-3" style={{ background: C.BORDER }} />
              <button onClick={() => { setZoomPreset(null); setPanOffset(p => p + 3); setExtraDays(d => d + 3) }} title="Progress forward 3 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+3d</button>
              <button onClick={() => { setZoomPreset(null); setPanOffset(p => p + 7); setExtraDays(d => d + 7) }} title="Progress forward 7 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+7d</button>
              <button onClick={() => { setZoomPreset(null); setPanOffset(p => p + 14); setExtraDays(d => d + 14) }} title="Progress forward 14 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+14d</button>
              <span className="w-px h-3" style={{ background: C.BORDER }} />
              {(['6m','1y','2y','3y'] as const).map(k => (
                <button key={k} onClick={() => { setZoomPreset(p => p === k ? null : k); setPanOffset(0); setExtraDays(0) }} title={`Zoom out to ~${k} of daily history before D0 (daily only)`} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={zoomPreset === k && tf === 'D' ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>{k}</button>
              ))}
            </div>
            <div ref={chartWrapRef} className="flex-1 min-h-0 overflow-hidden">
              <ScanMiniChart symbol={row.symbol} tf={tf} date={row.signalDate} height={Math.max(80, chartH - 22)} settings={settings} dark={C === DARK as any} dayOffset={navDayOffset} extraDays={extraDays} zoomDays={tf === 'D' ? zoomDays as any : undefined} compact />
            </div>
            {/* indicator bar — templates + dropdown toggle (mirrors /scanner & /live-feed) */}
            <div className="shrink-0 space-y-1.5">
              <div className="flex gap-0.5 items-center flex-wrap">
                {IND_TEMPLATES.map((tpl) => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl.id)}
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>
                    {tpl.name}
                  </button>
                ))}
                <button onClick={() => setShowInd((s) => !s)}
                  className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ml-auto"
                  style={showInd ? { color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` } : { color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>
                  ⚙ Indicators
                </button>
              </div>
              {showInd && (
                <div className="flex flex-wrap gap-0.5">
                  {TEMPLATE_IND_KEYS.map(([key, label]) => (
                    <button key={key} onClick={() => toggle(key)}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors"
                      style={settings[key]
                        ? { color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` }
                        : { color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* RIGHT — detail info (scrollable) */}
          <div className="w-1/2 overflow-y-auto p-5 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.MUTED }}>Classification</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] block mb-1" style={{ color: C.MUTED }}>Setup Type</label>
                <ClassifySelect value={row.setupType} options={enumOpts('setupType')} colors={enumColors('setupType')} placeholder="—"
                  allowCreate onCreate={(label) => { addEnumOption('setupType', label); onUpdate({ setupType: label, status: 'classified' }) }}
                  onChange={(v) => onUpdate({ setupType: v, status: v ? 'classified' : 'new' })} />
              </div>
              <div>
                <label className="text-[10px] block mb-1" style={{ color: C.MUTED }}>Setup</label>
                <ClassifySelect value={row.setup} options={enumOpts('setup')} colors={enumColors('setup')} placeholder="—"
                  allowCreate onCreate={(label) => { addEnumOption('setup', label); onUpdate({ setup: label }) }}
                  onChange={(v) => onUpdate({ setup: v })} />
              </div>
              <div>
                <label className="text-[10px] block mb-1" style={{ color: C.MUTED }}>Grade</label>
                <ThemedSelect value={row.grade} options={enumOpts('grade')} colors={enumColors('grade')} onChange={(v) => onUpdate({ grade: v })} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.MUTED }}>Move</h3>
            <div className="flex items-center gap-2">
              <div className="w-52">
                <ThemedSelect value={row.move} options={enumOpts('move')} colors={enumColors('move')} placeholder="— none —"
                  allowCreate onCreate={(label) => { addEnumOption('move', label); onUpdate({ move: label }) }}
                  onChange={(v) => onUpdate({ move: v })} />
              </div>
              <span className="text-[10px]" style={{ color: C.MUTED }}>links scans into one cycle</span>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1" style={{ color: C.MUTED }}><Tag className="w-3 h-3" />Tags</h3>
            <div className="flex flex-wrap gap-1.5 items-center">
              {row.tags.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded flex items-center gap-1" style={{ color: '#c4b5fd', background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.30)' }}>
                  {t}
                  <button onClick={() => onUpdate({ tags: row.tags.filter((x) => x !== t) })} style={{ color: '#8b5cf6' }}><X className="w-3 h-3" /></button>
                </span>
              ))}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="add tag…"
                className="border rounded px-2 py-0.5 text-xs w-24 focus:outline-none" style={{ background: 'transparent', borderColor: C.BORDER, color: C.TEXT }} />
            </div>
            {(() => {
              const have = new Set(row.tags)
              const want = tagInput.trim().toLowerCase()
              const suggestions = allTags.filter((t) => !have.has(t) && (!want || t.toLowerCase().includes(want))).slice(0, 16)
              if (suggestions.length === 0) return null
              return (
                <div className="flex flex-wrap gap-1 mt-1">
                  {suggestions.map((t) => (
                    <button key={t} onClick={() => onUpdate({ tags: [...row.tags, t] })}
                      className="text-[10px] px-1.5 py-0.5 rounded transition-colors hover:opacity-100"
                      style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}`, opacity: 0.7 }}>
                      + {t}
                    </button>
                  ))}
                </div>
              )
            })()}
          </section>

          {fields.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.MUTED }}>Custom Fields</h3>
              </div>
              <div className="border rounded-md divide-y" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
                {fields.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: C.TEXT }}>{f.name}</span>
                      <span className="text-[9px] uppercase" style={{ color: C.MUTED }}>{FIELD_TYPE_LABELS[f.type]}</span>
                    </div>
                    <div className={f.type === 'tags' ? 'flex-1 min-w-[200px]' : 'w-40'}><CustomCell field={f} value={customValues[f.id]} colors={f.colors} onSave={(v) => onSaveCustom(f.id, v)} onAddOption={(label) => { addFieldOption(f.id, label); onSaveCustom(f.id, label) }} onCreateOption={(label) => addFieldOption(f.id, label)} getTagsSuggestions={getTagsSuggestions} /></div>
                    {onDeleteField && <button onClick={() => onDeleteField(f.id, f.name)} title="Delete column" style={{ color: C.MUTED, fontSize: 11 }}>✕</button>}
                    {onEditField && <button onClick={() => onEditField(f)} title="Edit column" style={{ color: C.MUTED, fontSize: 11 }}>✎</button>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {metricEntries.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.MUTED }}>Scan Metrics</h3>
              <div className="border rounded-md p-3 grid grid-cols-2 gap-x-4 gap-y-1.5" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
                {metricEntries.slice(0, 24).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span style={{ color: C.MUTED }}>{k}</span>
                    <span className="font-mono" style={{ color: C.TEXT2 }}>{fmtVal(v)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Trades — mini database of executions/backtests off this setup ── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wider font-semibold" style={{ color: C.MUTED }}>Trades</h3>
              <div className="flex items-center gap-1">
                {(() => {
                  const tot = trades.reduce((s, t) => s + pnl(t), 0)
                  const closed = trades.filter((t) => t.entryPrice != null && t.exitPrice != null && t.qty)
                  return closed.length > 0 ? <span className="text-xs font-mono font-bold" style={{ color: tot >= 0 ? C.GREEN : C.RED }}>{tot >= 0 ? '+' : ''}{tot.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> : null
                })()}
                <button onClick={() => { onAddTrade('short'); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.RED + '22', color: C.RED, border: `1px solid ${C.RED}44` }}>+ Short</button>
                <button onClick={() => { onAddTrade('long'); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.GREEN + '22', color: C.GREEN, border: `1px solid ${C.GREEN}44` }}>+ Long</button>
              </div>
            </div>
            {trades.length === 0 ? (
              <p className="text-xs" style={{ color: C.MUTED }}>No trades yet. Add one to open a trade document.</p>
            ) : (
              <div className="space-y-1">
                {trades.map((t) => {
                  const isShort = t.direction === 'short'
                  const p = pnl(t)
                  const dColor = isShort ? C.RED : C.GREEN
                  const hasContent = t.sections && Object.keys(t.sections).length > 0
                  const open = openTradeId === t.id
                  return (
                    <div key={t.id}>
                      <div className="flex items-center gap-1 px-2 py-1.5 rounded-md border flex-wrap" style={{ background: C.SURFACE, borderColor: open ? C.GOLD_BORDER : C.BORDER }}>
                        <button onClick={() => setOpenTradeId(open ? null : t.id)} className="shrink-0 text-[9px]" style={{ color: C.MUTED }}>{open ? '▼' : '▶'}</button>
                        <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded shrink-0" style={{ background: dColor + '22', color: dColor }}>{t.direction}</span>
                        <div className="w-[68px]"><ThemedSelect mini value={t.setup ?? row.setup} options={enumOpts('setup')} colors={enumColors('setup')} placeholder="setup" allowCreate onCreate={(l) => { addEnumOption('setup', l); onUpdateTrade(t.id, { setup: l }) }} onChange={(v) => onUpdateTrade(t.id, { setup: v })} /></div>
                        <div className="w-[72px]"><ThemedSelect mini value={row.move} options={enumOpts('move')} colors={enumColors('move')} placeholder="move" allowCreate onCreate={(l) => { addEnumOption('move', l); onUpdate({ move: l }) }} onChange={(v) => onUpdate({ move: v })} /></div>
                        <div className="w-[78px]"><ThemedSelect mini value={t.trendStage} options={enumOpts('trendStage')} colors={enumColors('trendStage')} placeholder="stage" allowCreate onCreate={(l) => { addEnumOption('trendStage', l); onUpdateTrade(t.id, { trendStage: l }) }} onChange={(v) => onUpdateTrade(t.id, { trendStage: v })} /></div>
                        <div className="w-[58px]"><ThemedSelect mini value={t.routeStart} options={enumOpts('routeStart')} colors={enumColors('routeStart')} placeholder="start" allowCreate onCreate={(l) => { addEnumOption('routeStart', l); onUpdateTrade(t.id, { routeStart: l }) }} onChange={(v) => onUpdateTrade(t.id, { routeStart: v })} /></div>
                        <div className="w-[58px]"><ThemedSelect mini value={t.routeEnd} options={enumOpts('routeEnd')} colors={enumColors('routeEnd')} placeholder="end" allowCreate onCreate={(l) => { addEnumOption('routeEnd', l); onUpdateTrade(t.id, { routeEnd: l }) }} onChange={(v) => onUpdateTrade(t.id, { routeEnd: v })} /></div>
                        <div className="w-[50px]"><ThemedSelect mini value={t.grade} options={enumOpts('grade')} colors={enumColors('grade')} placeholder="grade" onChange={(v) => onUpdateTrade(t.id, { grade: v })} /></div>
                        {!chartExpanded && <input type="date" value={t.date ?? ''} onChange={(e) => onUpdateTrade(t.id, { date: e.target.value || null })} className="w-[112px] border rounded px-1 py-0.5 text-[10px] font-mono shrink-0" style={{ background: 'transparent', borderColor: C.BORDER, color: C.TEXT2 }} />}
                        {hasContent ? <span className="text-[9px] shrink-0" style={{ color: C.GOLD }}>●</span> : null}
                      </div>
                      {open && (
                        <TradeDocument
                          trade={t} row={row}
                          onUpdate={(patch) => onUpdateTrade(t.id, patch)}
                          onDelete={() => { onDeleteTrade(t.id); setOpenTradeId(null) }}
                          enumOpts={enumOpts} enumColors={enumColors} addEnumOption={addEnumOption}
                          hideDate={chartExpanded}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1" style={{ color: C.MUTED }}><ImageIcon className="w-3 h-3" />Annotations</h3>
            <div
              tabIndex={0}
              onPaste={onPasteAnnotation}
              className="border rounded-md p-2 outline-none focus:ring-1 transition-shadow"
              style={{ background: C.SURFACE, borderColor: C.BORDER }}
            >
              {annots.length === 0 ? (
                <p className="text-xs px-1 py-2" style={{ color: C.MUTED }}>Click here then paste (⌘V) a screenshot — copy it from the Lab first.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {annots.map((a: any, i: number) => (
                    <div key={i} className="relative group">
                      <img src={a.ref} alt={a.caption ?? ''} className="rounded border w-full" style={{ borderColor: C.BORDER }} />
                      <button onClick={() => removeAnnot(i)} title="Remove" className="absolute top-1 right-1 text-xs w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: C.BG, color: C.TEXT, border: `1px solid ${C.BORDER}` }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1" style={{ color: C.MUTED }}>Notes (auto-saves)</h3>
            <div className="border rounded-md" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
              <BlockNoteEditor value={row.notes ?? ''} onChange={onNotes}
                placeholder="Analysis, why it qualifies, ideal entry, what disqualifies it…" />
            </div>
          </section>
          </div>
        </div>
      {chartExpanded && mounted && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setChartExpanded(false)} className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div onClick={(e) => e.stopPropagation()} className="relative rounded-lg shadow-2xl flex flex-col" style={{ background: C.SURFACE, width: '92vw', height: '88vh', border: `1px solid ${C.BORDER}` }}>
            <div className="flex items-center justify-between px-3 py-2 border-b shrink-0" style={{ borderColor: C.BORDER }}>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wide" style={{ color: C.TEXT }}>{row.symbol}</span>
                <div className="flex gap-0.5">
                  {TF_OPTIONS.map((t) => (
                    <button key={t} onClick={() => setTf(t)} className="text-[11px] px-2 py-0.5 rounded font-mono transition-colors"
                      style={tf === t
                        ? { color: C.BG, background: C.GOLD }
                        : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>
                      {TF_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPanOffset(p => p - 1)} title="Pan back 1 day" className="text-[12px] px-2 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>◀</button>
                <button onClick={() => { setPanOffset(0); setExtraDays(0) }} title="Reset to D0" className="text-[11px] px-2 py-0.5 rounded font-mono font-bold" style={{ color: C.BG, background: C.GOLD }}>D0</button>
                <button onClick={() => setPanOffset(p => p + 1)} title="Pan forward 1 day" className="text-[12px] px-2 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▶</button>
                <span className="w-px h-4" style={{ background: C.BORDER }} />
                <button onClick={() => { setPanOffset(p => p + 3); setExtraDays(d => d + 3) }} title="Progress forward 3 days" className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+3d</button>
                <button onClick={() => { setPanOffset(p => p + 7); setExtraDays(d => d + 7) }} title="Progress forward 7 days" className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+7d</button>
                <button onClick={() => { setPanOffset(p => p + 14); setExtraDays(d => d + 14) }} title="Progress forward 14 days" className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+14d</button>
              </div>
              <button onClick={() => setChartExpanded(false)} className="p-1 rounded ml-2" style={{ color: C.MUTED }}><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <ScanMiniChart symbol={row.symbol} tf={tf} date={row.signalDate}
                height={typeof window !== 'undefined' ? window.innerHeight * 0.88 - 90 : 600}
                settings={settings} dark={C === DARK as any} dayOffset={navDayOffset} extraDays={extraDays} volH={130} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Review split-pane: 2-stack (Daily + 15m) Mike's Bands synced to the selected row ─
function ReviewPane({ symbol, date, dark, C }: { symbol?: string; date?: string; dark: boolean; C: typeof DARK }) {
  const [topSettings, setTopSettings] = useState<ChartSettings>(() => loadJSON('rv_top_settings', DEFAULT_SETTINGS))
  const [botSettings, setBotSettings] = useState<ChartSettings>(() => loadJSON('rv_bot_settings', DEFAULT_SETTINGS))
  const [topTf, setTopTf] = useState<Timeframe>(() => loadVal<Timeframe>('rv_top_tf', 'D'))
  const [botTf, setBotTf] = useState<Timeframe>(() => loadVal<Timeframe>('rv_bot_tf', '15'))
  const [selectedChart, setSelectedChart] = useState<'top' | 'bottom'>('bottom')
  const [dayOffset, setDayOffset] = useState(0)
  const [extraDays, setExtraDays] = useState(0)
  const [zoomPreset, setZoomPreset] = useState<'6m' | '1y' | '2y' | '3y' | null>(null)
  const [showInd, setShowInd] = useState(false)
  const [splitPct, setSplitPct] = useState<number>(() => {
    try { const v = localStorage.getItem('rv_split'); const n = v ? parseFloat(v) : NaN; return Number.isFinite(n) ? n : 0.58 } catch { return 0.58 }
  })
  const ZOOM_RANGES = { '6m': { before: 126, after: 25 }, '1y': { before: 252, after: 25 }, '2y': { before: 504, after: 25 }, '3y': { before: 756, after: 25 } } as const
  const zoomDays = zoomPreset ? ZOOM_RANGES[zoomPreset] : undefined
  useEffect(() => { try { localStorage.setItem('rv_top_settings', JSON.stringify(topSettings)) } catch {} }, [topSettings])
  useEffect(() => { try { localStorage.setItem('rv_bot_settings', JSON.stringify(botSettings)) } catch {} }, [botSettings])
  useEffect(() => { try { localStorage.setItem('rv_top_tf', topTf) } catch {} }, [topTf])
  useEffect(() => { try { localStorage.setItem('rv_bot_tf', botTf) } catch {} }, [botTf])
  useEffect(() => { try { localStorage.setItem('rv_split', String(splitPct)) } catch {} }, [splitPct])
  useEffect(() => () => { try { document.body.style.userSelect = '' } catch {} }, [])
  const isTop = selectedChart === 'top'
  const curSettings = isTop ? topSettings : botSettings
  const setCurSettings = isTop ? setTopSettings : setBotSettings
  const curTf = isTop ? topTf : botTf
  const setCurTf = isTop ? setTopTf : setBotTf
  const toggle = (key: keyof ChartSettings) => setCurSettings((s) => ({ ...s, [key]: !s[key] }))
  const applyTemplate = (id: string) => {
    const t = IND_TEMPLATES.find((x) => x.id === id)
    if (t) setCurSettings((s) => ({ ...s, ...t.settings }))
  }
  const CHART_TF_OPTIONS: { v: Timeframe; label: string }[] = [
    { v: '5', label: '5m' }, { v: '15', label: '15m' }, { v: '60', label: '1h' }, { v: '120', label: '2h' }, { v: '240', label: '4h' }, { v: 'D', label: 'D' },
  ]
  const tfLabel = (tf: Timeframe) => CHART_TF_OPTIONS.find((o) => o.v === tf)?.label ?? tf
  const baseOff = (tf: Timeframe) => tf === 'D' ? 6 : 1
  const wrapRef = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(360)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [symbol])
  const DIV = 6
  const topH = Math.max(80, Math.floor((h - DIV) * splitPct))
  const botH = Math.max(60, Math.floor((h - DIV) * (1 - splitPct)))

  if (!symbol) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: C.MUTED }}>
        Select a row to view charts
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-1">
      {/* shared pan/zoom controls (copied from RowDrawer) */}
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        <button onClick={() => { setZoomPreset(null); setDayOffset((o) => o - 1) }} title="Pan back 1 day" className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>◀</button>
        <button onClick={() => { setDayOffset(0); setExtraDays(0); setZoomPreset(null) }} title="Reset to D0" className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style={{ color: C.BG, background: C.GOLD }}>D0</button>
        <button onClick={() => { setZoomPreset(null); setDayOffset((o) => o + 1) }} title="Pan forward 1 day" className="text-[11px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▶</button>
        <span className="w-px h-3" style={{ background: C.BORDER }} />
        <button onClick={() => { setZoomPreset(null); setDayOffset((o) => o + 3); setExtraDays((d) => d + 3) }} title="Progress forward 3 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+3d</button>
        <button onClick={() => { setZoomPreset(null); setDayOffset((o) => o + 7); setExtraDays((d) => d + 7) }} title="Progress forward 7 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+7d</button>
        <button onClick={() => { setZoomPreset(null); setDayOffset((o) => o + 14); setExtraDays((d) => d + 14) }} title="Progress forward 14 days" className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>+14d</button>
        <span className="w-px h-3" style={{ background: C.BORDER }} />
        {(['6m', '1y', '2y', '3y'] as const).map((k) => (
          <button key={k} onClick={() => { setZoomPreset((p) => p === k ? null : k); setDayOffset(0); setExtraDays(0) }} title={`Zoom out to ~${k} of daily history before D0`} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={zoomPreset === k ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>{k}</button>
        ))}
      </div>

      {/* selected chart + per-chart timeframe selector */}
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        <button onClick={() => setSelectedChart('top')} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={isTop ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▲ Top {tfLabel(topTf)}</button>
        <button onClick={() => setSelectedChart('bottom')} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={!isTop ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>▼ Bottom {tfLabel(botTf)}</button>
        <span className="w-px h-3" style={{ background: C.BORDER }} />
        <span className="text-[10px]" style={{ color: C.MUTED }}>TF:</span>
        {CHART_TF_OPTIONS.map((o) => (
          <button key={o.v} onClick={() => setCurTf(o.v)} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={curTf === o.v ? { color: C.BG, background: C.GOLD } : { color: C.MUTED, background: C.SURFACE2, border: `1px solid ${C.BORDER}` }}>{o.label}</button>
        ))}
      </div>

      {/* indicator template bar (copied from RowDrawer) */}
      <div className="shrink-0 space-y-1">
        <div className="flex gap-0.5 items-center flex-wrap">
          {IND_TEMPLATES.map((tpl) => (
            <button key={tpl.id} onClick={() => applyTemplate(tpl.id)} className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>{tpl.name}</button>
          ))}
          <button onClick={() => setShowInd((s) => !s)} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ml-auto" style={showInd ? { color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` } : { color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>⚙ Indicators</button>
        </div>
        {showInd && (
          <div className="flex flex-wrap gap-0.5">
            {TEMPLATE_IND_KEYS.map(([key, label]) => (
              <button key={key} onClick={() => toggle(key)} className="text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors" style={curSettings[key] ? { color: C.GOLD, background: C.GOLD_DIM, border: `1px solid ${C.GOLD_BORDER}` } : { color: C.MUTED, background: 'transparent', border: `1px solid ${C.BORDER}` }}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* 2-stack: per-chart tf/settings — click a chart to select it */}
      <div ref={wrapRef} className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div style={{ height: topH, boxShadow: isTop ? `inset 0 0 0 2px ${C.GOLD}` : 'none' }} className="min-h-0 overflow-hidden cursor-pointer" onClick={() => setSelectedChart('top')}>
          <ScanMiniChart symbol={symbol} tf={topTf} date={date} height={topH} settings={topSettings} dark={dark} dayOffset={baseOff(topTf) + dayOffset} extraDays={extraDays} zoomDays={topTf === 'D' ? (zoomDays as any) : topTf === '5' ? { before: 1 + extraDays, after: 0 } : undefined} compact />
        </div>
        <div
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const wrap = wrapRef.current
            if (!wrap) return
            const move = (ev: PointerEvent) => {
              const rect = wrap.getBoundingClientRect()
              const pct = (ev.clientY - rect.top - DIV / 2) / Math.max(1, rect.height - DIV)
              setSplitPct(Math.min(0.85, Math.max(0.15, pct)))
            }
            const up = () => {
              window.removeEventListener('pointermove', move, true)
              window.removeEventListener('pointerup', up, true)
              document.body.style.userSelect = ''
            }
            document.body.style.userSelect = 'none'
            window.addEventListener('pointermove', move, true)
            window.addEventListener('pointerup', up, true)
          }}
          className="shrink-0 cursor-row-resize flex items-center justify-center"
          style={{ height: DIV, background: C.SURFACE2, borderTop: `1px solid ${C.BORDER}`, borderBottom: `1px solid ${C.BORDER}`, touchAction: 'none' }}
        >
          <div style={{ width: 36, height: 3, borderRadius: 2, background: C.MUTED }} />
        </div>
        <div style={{ height: botH, boxShadow: !isTop ? `inset 0 0 0 2px ${C.GOLD}` : 'none' }} className="min-h-0 overflow-hidden cursor-pointer" onClick={() => setSelectedChart('bottom')}>
          <ScanMiniChart symbol={symbol} tf={botTf} date={date} height={botH} settings={botSettings} dark={dark} dayOffset={baseOff(botTf) + dayOffset} extraDays={extraDays} zoomDays={botTf === 'D' ? (zoomDays as any) : botTf === '5' ? { before: 1 + extraDays, after: 0 } : undefined} compact />
        </div>
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────
function prettyStrategy(s: string): string {
  return (s || 'custom').replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}
function safeParse(s: any): string[] { try { return Array.isArray(s) ? s : JSON.parse(s || '[]') } catch { return [] } }
function fmtVal(v: any): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3)
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 40)
  return String(v).slice(0, 60)
}
