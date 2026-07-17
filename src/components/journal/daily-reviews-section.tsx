'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Plus, Loader2 } from 'lucide-react'
import { ReviewDrawer } from '@/components/calendar/review-drawer'

interface ReviewMeta {
  id: string
  title: string
  updated_at: string
}

/**
 * "Daily Reviews" section for the journal page.
 * Surfaces calendar-linked reviews (ContentItems of type 'review') alongside
 * journal entries. Clicking a review opens the same editor drawer used on the
 * calendar. Independent of folder selection (reviews have no folder).
 */
export function DailyReviewsSection() {
  const [reviews, setReviews] = useState<ReviewMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<{ date: string; reviewId: string | null } | null>(null)

  const load = useCallback(() => {
    const y = new Date().getFullYear()
    fetch(`/api/calendar/reviews?from=${y - 1}-01-01&to=${y}-12-31`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const map = (d?.reviews || {}) as Record<string, ReviewMeta>
        // newest first by date key
        setReviews(Object.entries(map).map(([date, r]) => ({ ...r, _date: date } as any)).sort((a: any, b: any) => (a._date < b._date ? 1 : -1)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const fmtDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="studio-surface rounded-lg p-4 border-l-2 border-[#D4AF37]/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#D4AF37]" />
          <h3 className="text-sm font-semibold studio-text">Daily Reviews</h3>
          {!loading && reviews.length > 0 && (
            <span className="text-xs studio-muted">{reviews.length}</span>
          )}
        </div>
        <button
          onClick={() => setOpen({ date: new Date().toISOString().split('T')[0], reviewId: null })}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs studio-muted hover:text-[#D4AF37] hover:bg-[#141c2b]"
        >
          <Plus className="h-3 w-3" /> Today
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm studio-muted py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm studio-muted py-2">
          No daily reviews yet. Create one from the <a href="/calendar" className="text-[#D4AF37] hover:underline">calendar</a>.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {reviews.map((r: any) => (
            <button
              key={r.id}
              onClick={() => setOpen({ date: r._date, reviewId: r.id })}
              className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D4AF37]/5 border border-[#D4AF37]/20 hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 transition-colors text-left max-w-[280px]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 text-[10px] font-bold text-[#D4AF37]">
                {fmtDate(r._date).split(' ')[1]}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium studio-text truncate">{r.title}</span>
                <span className="block text-[10px] studio-muted">{fmtDate(r._date)} · {new Date(r.updated_at).toLocaleDateString()}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <ReviewDrawer
          date={open.date}
          reviewId={open.reviewId}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
