'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, Trash2, Loader2, LayoutTemplate, Paperclip, Plus, X, Search, Pencil } from 'lucide-react'
import { TradingChart } from '@/components/charts/trading-chart'

interface ReviewDocViewProps {
  reviewId: string
  onChanged?: () => void
  onDeleted?: () => void
  onBack?: () => void
}

// Structured review sections — mirrors the playbook section pattern
// (gold uppercase label + muted hint + bordered textarea + chart thumbnails).
type Bias = 'Long' | 'Short' | 'Neutral'
type TradeIdea = { id: string; ticker: string; thesis: string; setupId?: string; setupName?: string; bias?: Bias }
type SectionData = { text: string; annots: { ref: string; caption?: string }[]; tradeIdeas?: TradeIdea[] }
type ReviewContent = { sections: Record<string, SectionData>; legacyHtml?: string }

type PlaybookOption = { id: string; name: string; setupType?: string | null; category?: string | null }
const BIAS_COLORS: Record<Bias, string> = {
  Long: 'rgba(16,185,129,0.12)│#10b981│rgba(16,185,129,0.3)',
  Short: 'rgba(239,68,68,0.12)│#ef4444│rgba(239,68,68,0.3)',
  Neutral: 'rgba(156,163,175,0.12)│#9ca3af│rgba(156,163,175,0.3)',
}

const REVIEW_SECTIONS: { key: string; label: string; hint: string; prompt: string }[] = [
  { key: 'context', label: 'Market Context', hint: 'Indices, breadth, regime — what kind of day was it?', prompt: 'SPY/QQQ levels + trend:\nBreadth & volatility (VIX, adv/dec):\nSector strength:\nOverall bias (risk-on/off/mixed):' },
  { key: 'watchlist', label: 'Watchlist & Thesis', hint: 'Names on radar and why — the plan into the session.', prompt: 'Ticker — key level + trigger + thesis:\nTicker — key level + trigger + thesis:\nTicker — key level + trigger + thesis:' },
  { key: 'execution', label: 'Execution', hint: 'Trades taken — entry, sizing, risk.', prompt: 'Trade 1 — side, entry, exit, size, R:\nTrade 2 — side, entry, exit, size, R:\nFills & slippage:\nRisk used / stops hit:' },
  { key: 'performance', label: 'Performance', hint: "What worked, what didn't — grade the process, not just the P&L.", prompt: 'Winners — why they worked:\nLosers — what went wrong:\nMistakes / process breaks:\nDid I follow the plan?' },
  { key: 'takeaways', label: 'Takeaways', hint: 'The lesson + tomorrow\'s action.', prompt: 'Key lesson:\nWhat to do differently:\nTomorrow\'s plan & watchlist:' },
]

// Colors (mirrors playbook C.* constants)
const C = { GOLD: '#D4AF37', MUTED: '#6b7280', SURFACE: '#0f0f0f', BORDER: '#222', TEXT: '#e5e5e5', SURFACE2: '#0a0a0a', SURFACE3: '#161616' }

/**
 * Searchable, category-grouped setup picker. Mirrors the /playbook tree:
 * groups by category (Uncategorized last), all groups auto-expanded.
 * Type to filter across name + setupType + category.
 */
function SetupPicker({ value, onChange, playbooks }: {
  value: string
  onChange: (id: string, name?: string) => void
  playbooks: PlaybookOption[]
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = playbooks.find((p) => p.id === value) || null

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20) }, [open])

  // Filter + group (mirrors /playbook tree logic).
  const ql = q.trim().toLowerCase()
  const filtered = ql
    ? playbooks.filter((p) =>
        p.name.toLowerCase().includes(ql) ||
        (p.setupType ?? '').toLowerCase().includes(ql) ||
        (p.category ?? '').toLowerCase().includes(ql))
    : playbooks
  const UNC = '__uncategorized__'
  const groups = new Map<string, PlaybookOption[]>()
  for (const p of filtered) {
    const k = (p.category && p.category.trim()) ? p.category.trim() : UNC
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(p)
  }
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === UNC) return 1
    if (b === UNC) return -1
    return a.localeCompare(b)
  })

  const trigger = (
    <button type="button" onClick={() => setOpen((v) => !v)}
      className="flex items-center gap-1.5 w-full min-w-[160px] px-2 py-1.5 text-sm rounded-lg text-left focus:outline-none"
      style={{ background: C.SURFACE2, border: '1px solid ' + C.BORDER, color: selected ? C.TEXT : C.MUTED }}>
      {selected ? (
        <span className="flex-1 truncate">
          {selected.name}{selected.setupType ? <span style={{ color: C.MUTED }}> · {selected.setupType}</span> : null}
        </span>
      ) : <span className="flex-1 italic">Setup (optional)…</span>}
      {selected && (
        <span role="button" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onChange('') }}
          className="p-0.5 hover:opacity-80" style={{ color: C.MUTED }}><X className="h-3 w-3" /></span>
      )}
      <Search className="h-3.5 w-3.5" style={{ color: C.MUTED }} />
    </button>
  )

  return (
    <div className="relative flex-1 min-w-[160px]" ref={ref}>
      {trigger}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border shadow-2xl overflow-hidden" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b sticky top-0" style={{ borderColor: C.BORDER, background: C.SURFACE }}>
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: C.MUTED }} />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter setups…"
              className="flex-1 bg-transparent text-sm focus:outline-none" style={{ color: C.TEXT }}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }} />
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs" style={{ color: C.MUTED }}>No matches</div>
            ) : keys.map((k) => {
              const items = groups.get(k)!
              const isUnc = k === UNC
              return (
                <div key={k}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold sticky" style={{ color: isUnc ? C.MUTED : C.GOLD, background: C.SURFACE2 }}>
                    {isUnc ? 'Uncategorized' : k} <span style={{ color: C.MUTED }}>{items.length}</span>
                  </div>
                  {items.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => { onChange(p.id, p.name); setOpen(false); setQ('') }}
                      className="w-full text-left pl-5 pr-3 py-1.5 text-sm transition-colors hover:bg-[#1a1a1a]"
                      style={{ background: p.id === value ? C.SURFACE3 : 'transparent', color: C.TEXT }}>
                      <span className="block truncate">{p.name}</span>
                      {p.setupType && <span className="block text-[10px] truncate" style={{ color: C.MUTED }}>{p.setupType}</span>}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function parseContent(raw: unknown): ReviewContent {
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const p = JSON.parse(raw)
      if (p && typeof p === 'object' && p.sections) {
        const sections: Record<string, SectionData> = {}
        for (const s of REVIEW_SECTIONS) {
          const ex = p.sections[s.key]
          sections[s.key] = { text: typeof ex?.text === 'string' ? ex.text : '', annots: Array.isArray(ex?.annots) ? ex.annots : [], tradeIdeas: Array.isArray(ex?.tradeIdeas) ? ex.tradeIdeas : [] }
        }
        return { sections, legacyHtml: sanitizeLegacyHtml(typeof p.legacyHtml === 'string' ? p.legacyHtml : undefined) }
      }
    } catch { /* fall through */ }
  }
  // Legacy: HTML string (old template / imported review). Preserve in legacyHtml.
  const sections: Record<string, SectionData> = {}
  for (const s of REVIEW_SECTIONS) sections[s.key] = { text: '', annots: [] }
  const legacy = typeof raw === 'string' && raw.trim() ? raw : undefined
  return { sections, legacyHtml: sanitizeLegacyHtml(legacy) }
}

/**
 * Replace <img> tags whose src is a relative path (i.e. points at a Notion
 * export sibling folder that was never uploaded) with a styled placeholder
 * showing the original filename. Served sources (http://, data:, /api/...)
 * are left intact. Same treatment for <a href> pointing at bundled files
 * (.csv/.xlsx/etc.) — those were lost alongside the images.
 */
function sanitizeLegacyHtml(html: string | undefined): string | undefined {
  if (!html) return html
  // <img src="..." ...> — capture src and alt
  let out = html.replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi, (full, src: string) => {
    if (/^(https?:\/\/|data:|\/api\/|\/)/.test(src)) return full
    const decoded = (() => { try { return decodeURIComponent(src) } catch { return src } })()
    const name = decoded.split('/').pop() || decoded
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin:6px 0;border:1px dashed #444;border-radius:6px;background:#1a1a1a;color:#888;font-size:12px;"><span style="font-size:16px;">🖼️</span><span>Image not imported: <code style="color:#aaa;">${name.replace(/</g,'&lt;')}</code><br/><span style="font-size:11px;color:#666;">Re-import this review with its source folder to recover.</span></span></div>`
  })
  // <a href="..."> — only intercept Notion-bundled file types
  out = out.replace(/<a\b([^>]*?)\bhref="([^"]+)"([^>]*)>(.*?)<\/a>/gi, (full, pre: string, href: string, post: string, text: string) => {
    if (/^(https?:\/\/|mailto:|data:|\/api\/|\/|#)/.test(href)) return full
    const decoded = (() => { try { return decodeURIComponent(href) } catch { return href } })()
    const name = decoded.split('/').pop() || decoded
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;margin:2px 0;border:1px dashed #444;border-radius:4px;background:#1a1a1a;color:#888;font-size:11px;">📎 ${text.replace(/<[^>]+>/g,'')} — ${name.replace(/</g,'&lt;')} not imported</span>`
  })
  return out
}

function SectionField({ label, hint, section, onChange, onImageClick, allowTradeIdeas, playbooks }: {
  label: string; hint: string
  section: SectionData
  onChange: (s: SectionData) => void
  onImageClick: (ref: string) => void
  allowTradeIdeas?: boolean
  playbooks?: PlaybookOption[]
}) {
  // Controlled by the parent — no local buffer. Every keystroke flows straight
  // into the parent doc state so nothing can be stranded in a per-field debounce
  // window (REQ-300). The parent debounces the network save.
  const taRef = useRef<HTMLTextAreaElement>(null)
  // Trade idea mini-form (watchlist only)
  const [showIdeaForm, setShowIdeaForm] = useState(false)
  const [newTicker, setNewTicker] = useState('')
  const [newThesis, setNewThesis] = useState('')
  const [newSetupId, setNewSetupId] = useState('')
  const [newSetupName, setNewSetupName] = useState('')
  const [newBias, setNewBias] = useState<Bias | ''>('')
  const tickerRef = useRef<HTMLInputElement>(null)
  // Edit-in-place state (mirrors the add-form field set, one idea at a time)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edTicker, setEdTicker] = useState('')
  const [edThesis, setEdThesis] = useState('')
  const [edSetupId, setEdSetupId] = useState('')
  const [edSetupName, setEdSetupName] = useState('')
  const [edBias, setEdBias] = useState<Bias | ''>('')

  const ideas = section.tradeIdeas ?? []
  const addIdea = () => {
    const t = newTicker.trim().toUpperCase()
    if (!t) { tickerRef.current?.focus(); return }
    const setup = playbooks?.find((p) => p.id === newSetupId)
    onChange({ ...section, tradeIdeas: [...ideas, { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random()), ticker: t, thesis: newThesis.trim(), setupId: setup?.id, setupName: setup?.name, bias: (newBias || undefined) as Bias | undefined }] })
    setNewTicker(''); setNewThesis(''); setNewSetupId(''); setNewSetupName(''); setNewBias(''); tickerRef.current?.focus()  // keep form open for rapid entry
  }
  const removeIdea = (id: string) => {
    onChange({ ...section, tradeIdeas: ideas.filter((x) => x.id !== id) })
  }
  const resetEditDraft = () => {
    setEditingId(null); setEdTicker(''); setEdThesis(''); setEdSetupId(''); setEdSetupName(''); setEdBias('')
  }
  const startEdit = (idea: TradeIdea) => {
    setEditingId(idea.id); setEdTicker(idea.ticker); setEdThesis(idea.thesis); setEdSetupId(idea.setupId ?? ''); setEdSetupName(idea.setupName ?? ''); setEdBias(idea.bias ?? '')
  }
  const saveEdit = () => {
    const t = edTicker.trim().toUpperCase()
    if (!t) { resetEditDraft(); return }
    const setup = playbooks?.find((p) => p.id === edSetupId)
    onChange({ ...section, tradeIdeas: ideas.map((x) => x.id === editingId ? { ...x, ticker: t, thesis: edThesis.trim(), setupId: edSetupId || undefined, setupName: setup?.name ?? edSetupName ?? undefined, bias: (edBias || undefined) as Bias | undefined } : x) })
    resetEditDraft()
  }
  const cancelEdit = () => resetEditDraft()

  // Auto-grow: each field sizes to its own content so a one-liner is compact
  // and a long block expands to show everything (no internal scrolling).
  const autoSize = useCallback(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])
  useEffect(() => { autoSize() }, [section.text, autoSize])



  const fileRef = useRef<HTMLInputElement>(null)
  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    const reads = await Promise.all(imgs.map((f) => new Promise<string>((res) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f)
    })))
    onChange({ ...section, annots: [...section.annots, ...reads.map((ref) => ({ ref, caption: '' }))] })
    if (fileRef.current) fileRef.current.value = ''
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile(); if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          onChange({ ...section, annots: [...section.annots, { ref: reader.result as string, caption: '' }] })
        }
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
        <p className="text-[10px] mt-0.5" style={{ color: C.MUTED }}>{hint}</p>
      </div>
      <textarea
        value={section.text}
        onChange={(e) => onChange({ ...section, text: e.target.value })}
        onPaste={onPaste}
        ref={taRef}
        placeholder="Write here… (paste screenshots straight in)"
        className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed overflow-hidden resize-none focus:outline-none min-h-[2.5rem]"
        style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }}
      />
      {allowTradeIdeas && (
        <div className="space-y-1.5">
          {/* Trade idea list — gold ticker pills + thesis, stacked bullets */}
          {ideas.map((idea) => (
            idea.id === editingId ? (
              <div key={idea.id} className="flex flex-col gap-2 px-3 py-2 rounded-lg border" style={{ background: C.SURFACE, borderColor: C.GOLD }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <input autoFocus value={edTicker} onChange={(e) => setEdTicker(e.target.value.toUpperCase().slice(0, 8))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && edTicker.trim()) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') cancelEdit() }} placeholder="TICKER" className="w-24 px-2 py-1.5 text-sm font-bold uppercase rounded-lg focus:outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.4)', color: C.GOLD }} />
                  <select value={edBias} onChange={(e) => setEdBias(e.target.value as Bias | '')} className="px-2 py-1.5 text-sm rounded-lg focus:outline-none" style={{ background: '#0a0a0a', border: '1px solid ' + C.BORDER, color: C.TEXT }}>
                    <option value="">Bias…</option>
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                  <SetupPicker
                    value={edSetupId}
                    onChange={(id, name) => { setEdSetupId(id); setEdSetupName(name || '') }}
                    playbooks={playbooks ?? []}
                  />
                </div>
                <textarea value={edThesis} onChange={(e) => setEdThesis(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && edTicker.trim()) { e.preventDefault(); saveEdit() } if (e.key === 'Escape') cancelEdit() }} placeholder="Thesis / level / trigger — multi-line OK" rows={3} className="w-full px-2 py-1.5 text-sm rounded-lg leading-relaxed resize-none focus:outline-none" style={{ background: '#0a0a0a', border: '1px solid ' + C.BORDER, color: C.TEXT, minHeight: '4rem' }} />
                <div className="text-[11px]" style={{ color: C.MUTED }}>Edit — <kbd className="px-1 rounded bg-[#1a1a1a] border border-[#2a2a2a]">Enter</kbd> to save · <kbd className="px-1 rounded bg-[#1a1a1a] border border-[#2a2a2a]">Esc</kbd> to cancel</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={saveEdit} disabled={!edTicker.trim()} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: C.GOLD, color: '#0a0a0a' }}>Save</button>
                  <button type="button" onClick={cancelEdit} className="px-2 py-1.5 text-xs studio-muted hover:text-studio-text">Cancel</button>
                </div>
              </div>
            ) : (
            <div key={idea.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border group" style={{ background: '#0a0a0a', borderColor: C.BORDER }}>
              <div className="flex flex-col gap-1 shrink-0">
                <span className="px-1.5 py-0.5 rounded text-xs font-bold tracking-wide" style={{ background: 'rgba(212,175,55,0.12)', color: C.GOLD, border: '1px solid rgba(212,175,55,0.3)' }}>{idea.ticker}</span>
                {idea.bias && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-center" style={{ background: BIAS_COLORS[idea.bias].split('│')[0], color: BIAS_COLORS[idea.bias].split('│')[1], border: '1px solid ' + BIAS_COLORS[idea.bias].split('│')[2] }}>{idea.bias}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {idea.setupName && (
                  <a href={idea.setupId ? `/playbook?id=${idea.setupId}` : '/playbook'} className="inline-flex items-center gap-1 text-[11px] font-semibold mb-1 hover:underline" style={{ color: C.GOLD }}>
                    {idea.setupName}
                  </a>
                )}
                <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: C.TEXT }}>{idea.thesis || <span style={{ color: C.MUTED }}>—</span>}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => startEdit(idea)} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors hover:bg-[rgba(212,175,55,0.12)]" style={{ color: C.GOLD, border: '1px solid rgba(212,175,55,0.3)' }} title="Edit this idea"><Pencil className="h-3 w-3" /> Edit</button>
                <button type="button" onClick={() => removeIdea(idea.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5" style={{ color: '#9ca3af' }} title="Remove"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            )
          ))}
          {/* Inline add form */}
          {showIdeaForm ? (
            <div className="flex flex-col gap-2 px-3 py-2 rounded-lg border" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={tickerRef} value={newTicker} onChange={(e) => setNewTicker(e.target.value.toUpperCase().slice(0, 8))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addIdea() } if (e.key === 'Escape') { setShowIdeaForm(false); setNewTicker(''); setNewThesis(''); setNewSetupId(''); setNewBias('') } }} placeholder="TICKER" className="w-24 px-2 py-1.5 text-sm font-bold uppercase rounded-lg focus:outline-none" style={{ background: '#0a0a0a', border: '1px solid rgba(212,175,55,0.4)', color: C.GOLD }} />
                <select value={newBias} onChange={(e) => setNewBias(e.target.value as Bias | '')} className="px-2 py-1.5 text-sm rounded-lg focus:outline-none" style={{ background: '#0a0a0a', border: '1px solid ' + C.BORDER, color: C.TEXT }}>
                  <option value="">Bias…</option>
                  <option value="Long">Long</option>
                  <option value="Short">Short</option>
                  <option value="Neutral">Neutral</option>
                </select>
                <SetupPicker
                  value={newSetupId}
                  onChange={(id, name) => { setNewSetupId(id); setNewSetupName(name || '') }}
                  playbooks={playbooks ?? []}
                />
              </div>
              <div className="text-[11px]" style={{ color: C.MUTED }}>Thesis — <kbd className="px-1 rounded bg-[#1a1a1a] border border-[#2a2a2a]">Enter</kbd> to save · <kbd className="px-1 rounded bg-[#1a1a1a] border border-[#2a2a2a]">Shift+Enter</kbd> for newline</div>
              <textarea value={newThesis} onChange={(e) => setNewThesis(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && newTicker.trim()) { e.preventDefault(); addIdea() } if (e.key === 'Escape') { setShowIdeaForm(false); setNewTicker(''); setNewThesis(''); setNewSetupId(''); setNewBias('') } }} placeholder="Thesis / level / trigger — multi-line OK" rows={3} className="w-full px-2 py-1.5 text-sm rounded-lg leading-relaxed resize-none focus:outline-none" style={{ background: '#0a0a0a', border: '1px solid ' + C.BORDER, color: C.TEXT, minHeight: '4rem' }} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={addIdea} disabled={!newTicker.trim()} className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40" style={{ background: C.GOLD, color: '#0a0a0a' }}>Add idea</button>
                <button type="button" onClick={() => { setShowIdeaForm(false); setNewTicker(''); setNewThesis(''); setNewSetupId(''); setNewBias('') }} className="px-2 py-1.5 text-xs studio-muted hover:text-studio-text">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setShowIdeaForm(true); setTimeout(() => tickerRef.current?.focus(), 50) }} className="flex items-center gap-1 text-[11px] hover:text-[#D4AF37] transition-colors" style={{ color: C.MUTED }}>
              <Plus className="h-3 w-3" /> {ideas.length > 0 ? 'add another trade idea' : 'add trade idea'}
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[11px] studio-muted hover:text-[#D4AF37]">
          <Paperclip className="h-3 w-3" /> attach charts
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>
      {section.annots.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          {section.annots.map((a, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.ref} alt={a.caption ?? ''} onClick={() => onImageClick(a.ref)}
                className="w-full h-auto rounded-lg border cursor-zoom-in" style={{ borderColor: C.BORDER }} />
              <button
                onClick={() => onChange({ ...section, annots: section.annots.filter((_, idx) => idx !== i) })}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
                style={{ background: '#dc2626', color: '#fff' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReviewDocView({ reviewId, onChanged, onDeleted, onBack }: ReviewDocViewProps) {
  const [doc, setDoc] = useState<{ id: string; title: string; date: string; content: ReviewContent } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dayTrades, setDayTrades] = useState<any[]>([])
  const [playbooks, setPlaybooks] = useState<PlaybookOption[]>([])
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest pending edit — flushed on unmount so navigation/close never drops the
  // last batch of typing (REQ-300).
  const pendingRef = useRef<{ title: string; content: ReviewContent } | null>(null)
  // Only refetch the sidebar when the title (all it shows) actually changes;
  // debounced so we don't hit the API on every keystroke.
  const lastNotifiedTitle = useRef<string>('')
  const notifiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)

  // Auto-populated trades for this review's date (read-only computed view).
  useEffect(() => {
    const date = doc?.date
    if (!date) { setDayTrades([]); return }
    let alive = true
    fetch('/api/trades?limit=1000', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.trades) return
        const ts = d.trades.filter((t: any) => {
          const td = t.date instanceof Date ? t.date.toISOString() : String(t.date)
          return td.split('T')[0] === date
        })
        setDayTrades(ts)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [doc?.date])

  // Load the user's playbook list once — powers the setup dropdown in trade ideas.
  useEffect(() => {
    fetch('/api/playbook', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.playbooks) setPlaybooks(j.playbooks.map((p: any) => ({ id: p.id, name: p.name, setupType: p.setupType ?? null, category: p.category ?? null }))) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true); setDoc(null); setDirty(false)
    fetch(`/api/calendar/review/${reviewId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setDoc({ id: d.id, title: d.title || '', date: d.metadata?.reviewDate || '', content: parseContent(d.content) })
          lastNotifiedTitle.current = d.title || ''
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reviewId])

  const save = useCallback(async (title: string, content: ReviewContent, opts?: { keepalive?: boolean }) => {
    setSaveError(false)
    const payload = JSON.stringify({ title, content: JSON.stringify(content) })
    const attempt = async (isFirst: boolean) => {
      if (isFirst) setSaving(true)
      try {
        const r = await fetch(`/api/calendar/review/${reviewId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: !!opts?.keepalive,
        })
        if (r.ok) {
          retryCount.current = 0
          pendingRef.current = null
          setDirty(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200)
          // Refresh the sidebar only when its visible field (title) changes.
          if (title !== lastNotifiedTitle.current) {
            lastNotifiedTitle.current = title
            if (notifiedTimer.current) clearTimeout(notifiedTimer.current)
            notifiedTimer.current = setTimeout(() => onChanged?.(), 1500)
          }
          return
        }
      } catch { /* fall through to retry */ }
      setSaveError(true)
      // Bounded auto-retry so a transient blip doesn't silently lose content
      // (REQ-300). Skipped for the keepalive unload flush.
      if (!opts?.keepalive && retryCount.current < 3) {
        retryCount.current += 1
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => attempt(false), 2000 * retryCount.current)
      }
    }
    await attempt(true)
    setSaving(false)
  }, [reviewId, onChanged])

  const scheduleSave = useCallback((title: string, content: ReviewContent) => {
    setDirty(true); setSaveError(false); retryCount.current = 0
    pendingRef.current = { title, content }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(title, content), 900)
  }, [save])

  // Flush pending edits on unmount — the single most important fix for REQ-300.
  useEffect(() => {
    return () => {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
      if (notifiedTimer.current) clearTimeout(notifiedTimer.current)
      const pending = pendingRef.current
      if (pending) save(pending.title, pending.content, { keepalive: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewId])

  const setSection = (key: string, s: SectionData) => {
    if (!doc) return
    const next = { ...doc, content: { ...doc.content, sections: { ...doc.content.sections, [key]: s } } }
    setDoc(next); scheduleSave(next.title, next.content)
  }

  const remove = async () => {
    if (!doc) return
    if (!window.confirm(`Delete "${doc.title || 'this review'}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/calendar/review/${reviewId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('delete failed')
      onDeleted?.()
    } catch { window.alert('Failed to delete review.') }
    finally { setDeleting(false) }
  }

  const loadTemplate = () => {
    if (!doc) return
    const sections: Record<string, SectionData> = {}
    for (const s of REVIEW_SECTIONS) sections[s.key] = { text: s.prompt, annots: [] }
    const next = { ...doc, content: { sections, legacyHtml: doc.content.legacyHtml } }
    setDoc(next); scheduleSave(next.title, next.content)
  }

  if (loading) {
    return (<div className="flex items-center justify-center py-24 studio-muted"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading review…</div>)
  }
  if (!doc) {
    return <div className="py-24 text-center studio-muted">Couldn&apos;t load this review.</div>
  }

  const allEmpty = REVIEW_SECTIONS.every((s) => {
    const v = doc.content.sections[s.key]
    return (!v || (!v.text.trim() && v.annots.length === 0 && !(v.tradeIdeas && v.tradeIdeas.length)))
  }) && !doc.content.legacyHtml

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm studio-muted hover:text-studio-text mb-4 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to Daily Reviews
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 pb-4 border-b border-[#1a1a1a]">
        <input
          value={doc.title}
          onChange={(e) => { const next = { ...doc, title: e.target.value }; setDoc(next); scheduleSave(next.title, next.content) }}
          placeholder="Review title…"
          className="flex-1 bg-transparent text-2xl font-bold studio-text focus:outline-none"
        />
        <div className="flex items-center gap-3 shrink-0 pt-1">
          {saving ? (
            <span className="text-[11px] flex items-center gap-1 studio-muted"><Loader2 className="h-3 w-3 animate-spin" />saving</span>
          ) : saveError ? (
            <span className="text-[11px] text-red-400" title="Couldn't reach the server — retrying">save failed — retrying…</span>
          ) : dirty ? (
            <span className="text-[11px] studio-muted">unsaved</span>
          ) : (
            <span className="text-[11px] text-green-400/70">✓ saved</span>
          )}
          <button onClick={remove} disabled={deleting} title="Delete review"
            className="p-1.5 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Template loader — only when everything is empty */}
      {allEmpty && (
        <button onClick={loadTemplate}
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-sm">
          <LayoutTemplate className="h-4 w-4" /> Load Daily Review template
        </button>
      )}

      {/* Structured sections — discrete bordered textareas like playbook */}
      <div className="mt-6 space-y-5">
        {REVIEW_SECTIONS.map((s) => (
          <SectionField key={s.key} label={s.label} hint={s.hint}
            allowTradeIdeas={s.key === 'watchlist'}
            playbooks={s.key === 'watchlist' ? playbooks : undefined}
            section={doc.content.sections[s.key] ?? { text: '', annots: [] }}
            onChange={(data) => setSection(s.key, data)}
            onImageClick={(ref) => setLightbox(ref)} />
        ))}
      </div>

      {/* Legacy / imported content — preserves old HTML reviews + imports */}
      {/* Day's trades — auto-populated from the DB by reviewDate (read-only) */}
      <div className="mt-6">
        <label className="text-xs uppercase tracking-wider font-bold" style={{ color: C.GOLD }}>Day&apos;s Trades</label>
        <p className="text-[10px] mt-0.5 mb-2" style={{ color: C.MUTED }}>Auto-populated from your recorded trades for this date.</p>
        {dayTrades.length === 0 ? (
          <div className="border rounded-lg px-3 py-4 text-center text-xs studio-muted" style={{ background: C.SURFACE, borderColor: C.BORDER }}>
            No trades recorded for this date.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: C.BORDER }}>
            <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ background: '#0a0a0a', color: C.MUTED }}>
              <span>{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}</span>
              <span>
                {dayTrades.filter((t) => (t.pnl || 0) > 0).length}W / {dayTrades.filter((t) => (t.pnl || 0) < 0).length}L ·{' '}
                <span style={{ color: dayTrades.reduce((s, t) => s + (t.pnl || 0), 0) >= 0 ? '#4ade80' : '#f87171' }}>
                  {dayTrades.reduce((s, t) => s + (t.pnl || 0), 0) >= 0 ? '+' : ''}${dayTrades.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(0)}
                </span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left" style={{ color: C.MUTED, borderBottom: `1px solid ${C.BORDER}` }}>
                    <th className="py-2 px-3">Symbol</th>
                    <th className="py-2 px-3">Side</th>
                    <th className="py-2 px-3 text-right">Entry</th>
                    <th className="py-2 px-3 text-right">Exit</th>
                    <th className="py-2 px-3 text-right">Qty</th>
                    <th className="py-2 px-3 text-right">P&amp;L</th>
                    <th className="py-2 px-3 text-right">R</th>
                  </tr>
                </thead>
                <tbody>
                  {dayTrades.flatMap((t) => {
                    const isOpen = expandedTradeId === t.id
                    return [
                    <tr key={t.id} onClick={() => setExpandedTradeId(isOpen ? null : t.id)} className="cursor-pointer hover:bg-[#141c2b]" style={{ borderBottom: '1px solid #141414' }}>
                      <td className="py-2 px-3 font-medium" style={{ color: C.TEXT }}>{t.symbol} {isOpen && <span className="text-[10px] studio-muted ml-1">▾</span>}</td>
                      <td className="py-2 px-3"><span style={{ color: String(t.side || '').toLowerCase().startsWith('l') ? '#4ade80' : '#f87171' }}>{t.side}</span></td>
                      <td className="py-2 px-3 text-right" style={{ color: C.MUTED }}>${(t.entryPrice || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: C.MUTED }}>${(t.exitPrice || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: C.MUTED }}>{t.quantity}</td>
                      <td className="py-2 px-3 text-right font-semibold" style={{ color: (t.pnl || 0) >= 0 ? '#4ade80' : '#f87171' }}>{(t.pnl || 0) >= 0 ? '+' : ''}${(t.pnl || 0).toFixed(0)}</td>
                      <td className="py-2 px-3 text-right" style={{ color: C.MUTED }}>{t.rMultiple != null ? `${t.rMultiple.toFixed(2)}R` : '—'}</td>
                    </tr>,
                    isOpen && (
                      <tr key={t.id + '-chart'}>
                        <td colSpan={7} className="px-3 pb-3" style={{ background: '#0a0a0a' }}>
                          <div className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: C.GOLD }}>{t.symbol} · {new Date(t.entryTime).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })}</div>
                          <TradingChart
                            symbol={t.symbol}
                            height={320}
                            trade={{
                              entryTime: t.entryTime,
                              exitTime: t.exitTime,
                              entryPrice: t.entryPrice,
                              exitPrice: t.exitPrice,
                              side: t.side === 'Long' ? 'Long' : 'Short',
                            }}
                          />
                        </td>
                      </tr>
                    ),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {doc.content.legacyHtml && (
        <div className="mt-6">
          <label className="text-xs uppercase tracking-wider font-bold" style={{ color: C.MUTED }}>Imported Notes</label>
          <p className="text-[10px] mt-0.5 mb-2" style={{ color: C.MUTED }}>From an earlier version or import — edit above and remove when no longer needed.</p>
          <div
            className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed prose prose-invert max-w-none"
            style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }}
            dangerouslySetInnerHTML={{ __html: doc.content.legacyHtml }}
          />
          <button
            onClick={() => {
              if (!window.confirm('Remove the imported notes block? This cannot be undone.')) return
              const next = { ...doc, content: { sections: doc.content.sections } }
              setDoc(next); save(next.title, next.content)
            }}
            className="mt-2 text-[11px] text-red-400/70 hover:text-red-400"
          >Remove imported notes</button>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}
