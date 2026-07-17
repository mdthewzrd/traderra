'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, Trash2, Loader2, LayoutTemplate } from 'lucide-react'

interface ReviewDocViewProps {
  reviewId: string
  onChanged?: () => void
  onDeleted?: () => void
  onBack?: () => void
}

// Structured review sections — mirrors the playbook section pattern
// (gold uppercase label + muted hint + bordered textarea + chart thumbnails).
type SectionData = { text: string; annots: { ref: string; caption?: string }[] }
type ReviewContent = { sections: Record<string, SectionData>; legacyHtml?: string }

const REVIEW_SECTIONS: { key: string; label: string; hint: string; prompt: string }[] = [
  { key: 'context', label: 'Market Context', hint: 'Indices, breadth, regime — what kind of day was it?', prompt: 'SPY/QQQ levels + trend:\nBreadth & volatility (VIX, adv/dec):\nSector strength:\nOverall bias (risk-on/off/mixed):' },
  { key: 'watchlist', label: 'Watchlist & Thesis', hint: 'Names on radar and why — the plan into the session.', prompt: 'Ticker — key level + trigger + thesis:\nTicker — key level + trigger + thesis:\nTicker — key level + trigger + thesis:' },
  { key: 'execution', label: 'Execution', hint: 'Trades taken — entry, sizing, risk.', prompt: 'Trade 1 — side, entry, exit, size, R:\nTrade 2 — side, entry, exit, size, R:\nFills & slippage:\nRisk used / stops hit:' },
  { key: 'performance', label: 'Performance', hint: "What worked, what didn't — grade the process, not just the P&L.", prompt: 'Winners — why they worked:\nLosers — what went wrong:\nMistakes / process breaks:\nDid I follow the plan?' },
  { key: 'takeaways', label: 'Takeaways', hint: 'The lesson + tomorrow\'s action.', prompt: 'Key lesson:\nWhat to do differently:\nTomorrow\'s plan & watchlist:' },
]

// Colors (mirrors playbook C.* constants)
const C = { GOLD: '#D4AF37', MUTED: '#6b7280', SURFACE: '#0f0f0f', BORDER: '#222', TEXT: '#e5e5e5' }

function parseContent(raw: unknown): ReviewContent {
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const p = JSON.parse(raw)
      if (p && typeof p === 'object' && p.sections) {
        const sections: Record<string, SectionData> = {}
        for (const s of REVIEW_SECTIONS) {
          const ex = p.sections[s.key]
          sections[s.key] = { text: typeof ex?.text === 'string' ? ex.text : '', annots: Array.isArray(ex?.annots) ? ex.annots : [] }
        }
        return { sections, legacyHtml: typeof p.legacyHtml === 'string' ? p.legacyHtml : undefined }
      }
    } catch { /* fall through */ }
  }
  // Legacy: HTML string (old template / imported review). Preserve in legacyHtml.
  const sections: Record<string, SectionData> = {}
  for (const s of REVIEW_SECTIONS) sections[s.key] = { text: '', annots: [] }
  const legacy = typeof raw === 'string' && raw.trim() ? raw : undefined
  return { sections, legacyHtml: legacy }
}

function SectionField({ label, hint, section, onChange, onImageClick }: {
  label: string; hint: string
  section: SectionData
  onChange: (s: SectionData) => void
  onImageClick: (ref: string) => void
}) {
  const [local, setLocal] = useState(section.text)
  const pushRef = useRef(section.text)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (section.text !== pushRef.current && section.text !== local) {
      setLocal(section.text); pushRef.current = section.text
    }
    // eslint-disable-next-line react-hooks-exhaustive-deps
  }, [section.text])

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (local !== pushRef.current) { pushRef.current = local; onChange({ text: local, annots: section.annots }) }
  }
  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items; if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile(); if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          pushRef.current = local
          onChange({ text: local, annots: [...section.annots, { ref: reader.result as string, caption: '' }] })
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
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(flush, 500)
        }}
        onBlur={flush}
        onPaste={onPaste}
        placeholder="Write here… (paste screenshots straight in)"
        className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none min-h-[120px]"
        style={{ background: C.SURFACE, borderColor: C.BORDER, color: C.TEXT }}
      />
      {section.annots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {section.annots.map((a, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.ref} alt={a.caption ?? ''} onClick={() => onImageClick(a.ref)}
                className="w-56 h-36 object-cover rounded-lg border cursor-zoom-in" style={{ borderColor: C.BORDER }} />
              <button
                onClick={() => { pushRef.current = local; onChange({ text: local, annots: section.annots.filter((_, idx) => idx !== i) }) }}
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
  const [doc, setDoc] = useState<{ id: string; title: string; content: ReviewContent } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setDoc(null); setDirty(false)
    fetch(`/api/calendar/review/${reviewId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setDoc({ id: d.id, title: d.title || '', content: parseContent(d.content) })
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reviewId])

  const save = useCallback(async (title: string, content: ReviewContent) => {
    setSaving(true)
    try {
      const r = await fetch(`/api/calendar/review/${reviewId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: JSON.stringify(content) }),
      })
      if (r.ok) { setDirty(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); onChanged?.() }
    } finally { setSaving(false) }
  }, [reviewId, onChanged])

  const scheduleSave = useCallback((title: string, content: ReviewContent) => {
    setDirty(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(title, content), 900)
  }, [save])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

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
    return (!v || (!v.text.trim() && v.annots.length === 0))
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
            section={doc.content.sections[s.key] ?? { text: '', annots: [] }}
            onChange={(data) => setSection(s.key, data)}
            onImageClick={(ref) => setLightbox(ref)} />
        ))}
      </div>

      {/* Legacy / imported content — preserves old HTML reviews + imports */}
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
              setDoc(next); scheduleSave(next.title, next.content)
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
