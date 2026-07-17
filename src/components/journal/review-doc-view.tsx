'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, Trash2, Loader2, LayoutTemplate } from 'lucide-react'
import { BlockNoteEditor } from '@/components/journal/BlockNoteEditor'
import { DAILY_REVIEW_TEMPLATE } from '@/components/calendar/review-drawer'

interface ReviewDocViewProps {
  reviewId: string
  onChanged?: () => void
  onDeleted?: () => void
  onBack?: () => void
}

/**
 * Centered, playbook/database-style editor for a daily review.
 * Replaces the slide-in drawer on the journal page. Opens IN the main content
 * area as a first-class document (max-w-3xl, title field, save indicator,
 * delete). Autosaves on a debounce.
 */
export function ReviewDocView({ reviewId, onChanged, onDeleted, onBack }: ReviewDocViewProps) {
  const [doc, setDoc] = useState<{ id: string; title: string; content: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load full doc.
  useEffect(() => {
    let alive = true
    setLoading(true); setDoc(null); setDirty(false)
    fetch(`/api/calendar/review/${reviewId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setDoc({ id: d.id, title: d.title || '', content: typeof d.content === 'string' ? d.content : '' })
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [reviewId])

  const save = useCallback(async (title: string, content: string) => {
    setSaving(true)
    try {
      const r = await fetch(`/api/calendar/review/${reviewId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (r.ok) {
        setDirty(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); onChanged?.()
      }
    } finally { setSaving(false) }
  }, [reviewId, onChanged])

  // Debounced autosave.
  const scheduleSave = useCallback((title: string, content: string) => {
    setDirty(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(title, content), 900)
  }, [save])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const remove = async () => {
    if (!doc) return
    if (!window.confirm(`Delete "${doc.title || 'this review'}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/calendar/review/${reviewId}`, { method: 'DELETE' })
      if (!r.ok) throw new Error('delete failed')
      onDeleted?.()
    } catch {
      window.alert('Failed to delete review.')
    } finally { setDeleting(false) }
  }

  const loadTemplate = () => {
    if (!doc) return
    const next = { ...doc, content: DAILY_REVIEW_TEMPLATE }
    setDoc(next)
    scheduleSave(next.title, next.content)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 studio-muted">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading review…
      </div>
    )
  }
  if (!doc) {
    return <div className="py-24 text-center studio-muted">Couldn&apos;t load this review.</div>
  }

  const isEmpty = !doc.content || doc.content.trim() === '' || doc.content.trim() === '<p></p>'

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
            <span className="text-[11px] text-green-400/70">{savedFlash ? '✓ saved' : '✓ saved'}</span>
          )}
          <button onClick={remove} disabled={deleting} title="Delete review"
            className="p-1.5 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-40">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Template loader — only for empty docs */}
      {isEmpty && (
        <button onClick={loadTemplate}
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 text-sm">
          <LayoutTemplate className="h-4 w-4" /> Load Daily Review template
        </button>
      )}

      {/* Editor — fills the document area */}
      <div className="mt-4 min-h-[60vh] flex flex-col studio-surface rounded-lg border border-[#1a1a1a]">
        <BlockNoteEditor
          value={doc.content}
          onChange={(v) => { const next = { ...doc, content: v }; setDoc(next); scheduleSave(next.title, next.content) }}
          placeholder="Write your daily review, or load the template above…"
          fullHeight
        />
      </div>
    </div>
  )
}
