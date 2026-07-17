'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, FileText, LayoutTemplate, Trash2 } from 'lucide-react'
import { BlockNoteEditor } from '@/components/journal/BlockNoteEditor'

export const DAILY_REVIEW_TEMPLATE = `<h1>PM Notes</h1>
<ul>
<li>SPY / QQQ levels:</li>
<li>Catalysts &amp; news:</li>
<li>Overall bias for the day:</li>
</ul>

<h1>Trade Watchlist</h1>
<ul>
<li>Ticker — key level &amp; trigger:</li>
<li>Ticker — key level &amp; trigger:</li>
<li>Ticker — key level &amp; trigger:</li>
</ul>

<h1>Exec</h1>
<ul>
<li>Trades taken &amp; sizing:</li>
<li>Fills &amp; slippage:</li>
<li>Risk used / stops hit:</li>
</ul>

<h1>Daily Review</h1>
<ul>
<li>What worked:</li>
<li>What to fix:</li>
<li>Key lesson:</li>
<li>Tomorrow's action item:</li>
</ul>`

interface ReviewDoc {
  id: string
  title: string
  content: any
}

/**
 * Editor drawer for a daily review linked to a calendar date.
 * Opens (creates-on-open if needed) the review for `date`, loads full content,
 * and saves title + BlockNote content via /api/calendar/review/[id].
 */
export function ReviewDrawer({
  date,
  reviewId,
  onClose,
  onChanged,
}: {
  date: string
  reviewId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [doc, setDoc] = useState<ReviewDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Lock page scroll while the drawer is open — otherwise wheel events over a
  // panel with no internal overflow bubble up to document.body and scroll the
  // site behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Ensure a review doc exists for this date, then load it.
  useEffect(() => {
    let cancelled = false
    setLoading(true); setDoc(null); setDirty(false)
    const ensure = async () => {
      try {
        // If we don't have an id yet, create one for this date (idempotent).
        let id = reviewId
        if (!id) {
          const r = await fetch('/api/calendar/reviews', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date }),
          })
          if (!r.ok) throw new Error('create failed')
          const created = await r.json()
          id = created.id
        }
        const full = await fetch(`/api/calendar/review/${id}`, { cache: 'no-store' })
        if (!full.ok) throw new Error('load failed')
        const d = await full.json()
        if (!cancelled) { setDoc({ id: d.id, title: d.title, content: d.content }); onChanged() }
      } catch (e) {
        if (!cancelled) setDoc(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    ensure()
    return () => { cancelled = true }
  }, [date, reviewId])

  const save = async () => {
    if (!doc) return
    setSaving(true)
    try {
      await fetch(`/api/calendar/review/${doc.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: doc.title, content: doc.content }),
      })
      setDirty(false); onChanged()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!doc) return
    if (!window.confirm(`Delete "${doc.title || 'this review'}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/calendar/review/${doc.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('delete failed')
      onChanged(); onClose()
    } catch {
      window.alert('Failed to delete review. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const pretty = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full max-w-2xl bg-[#0a0a0a] border-l border-[#1f2937] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1a1a1a]">
          <FileText className="h-5 w-5 text-[#D4AF37] shrink-0" />
          <div className="min-w-0 flex-1">
            <input
              value={doc?.title ?? ''}
              onChange={(e) => { setDoc(d => d ? { ...d, title: e.target.value } : d); setDirty(true) }}
              disabled={loading}
              className="w-full bg-transparent text-lg font-semibold studio-text outline-none focus:bg-[#141c2b] rounded px-1 -mx-1"
            />
            <div className="text-xs studio-muted">{pretty}</div>
          </div>
          {dirty && (
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0a0a0a] text-sm font-semibold hover:opacity-90 disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </button>
          )}
          {doc && (
            <button onClick={remove} disabled={deleting} title="Delete review"
              className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg studio-muted hover:studio-text hover:bg-[#141c2b]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — editor is the single scroll container (flex-1 min-h-0); body is overflow-hidden so wheel events never bubble to the page */}
        <div className="flex-1 min-h-0 flex flex-col px-5 py-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 studio-muted">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading review…
            </div>
          ) : doc ? (
            <>
              {/* Template loader — only for empty reviews */}
              {!doc.content && (
                <div className="mb-4">
                  <button
                    onClick={() => { setDoc(d => d ? { ...d, content: DAILY_REVIEW_TEMPLATE } : d); setDirty(true) }}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] hover:bg-[#D4AF37]/5 text-left transition-colors"
                  >
                    <LayoutTemplate className="h-5 w-5 text-[#D4AF37] shrink-0" />
                    <span>
                      <span className="block text-sm font-semibold studio-text">Load Daily Review template</span>
                      <span className="block text-xs studio-muted">PM notes · watchlist · exec · recap</span>
                    </span>
                  </button>
                </div>
              )}
              <BlockNoteEditor
                value={doc.content}
                onChange={(v: any) => { setDoc(d => d ? { ...d, content: v } : d); setDirty(true) }}
                placeholder="Write your daily review, or load the Daily Review template above…"
                fullHeight
              />
            </>
          ) : (
            <div className="py-20 text-center studio-muted">Couldn&apos;t load this review.</div>
          )}
        </div>
      </div>
    </div>
  )
}
