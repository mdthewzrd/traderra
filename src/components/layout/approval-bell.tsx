'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Check, X } from 'lucide-react'

interface PendingUser {
  id: string
  email: string | null
  name: string | null
  createdAt: string
}

/**
 * Notification bell for the account owner/admin.
 * Self-gating: fetches /api/admin/pending — if it 403s, renders nothing.
 * Polls every 30s while mounted.
 */
export function ApprovalBell() {
  const [pending, setPending] = useState<PendingUser[]>([])
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    fetch('/api/admin/pending', { cache: 'no-store' })
      .then(r => {
        if (r.status === 403) { setIsAdmin(false); return null }
        setIsAdmin(true)
        return r.json()
      })
      .then(d => { if (d) setPending(d.pending || []) })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => { clearInterval(t); document.removeEventListener('mousedown', onClick) }
  }, [])

  const approve = async (userId: string) => {
    setActing(userId)
    await fetch('/api/admin/approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setActing(null)
    load()
  }
  const reject = async (userId: string) => {
    setActing(userId)
    await fetch('/api/admin/reject', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setActing(null)
    load()
  }

  if (!isAdmin) return null
  const count = pending.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#e0e0e0] hover:bg-[#141c2b] transition-colors"
        title="Access requests"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#1f2937] bg-[#0f1623] shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2937] flex items-center justify-between">
            <span className="text-sm font-semibold text-[#e0e0e0]">Access Requests</span>
            {count === 0 && <span className="text-xs text-[#666]">All caught up</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {count === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#666]">
                No pending requests
              </div>
            ) : (
              pending.map(u => (
                <div key={u.id} className="px-4 py-3 border-b border-[#141c2b] last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#e0e0e0] truncate">
                        {u.name || u.email || 'Unknown'}
                      </div>
                      {u.email && u.name && (
                        <div className="text-xs text-[#666] truncate">{u.email}</div>
                      )}
                      <div className="text-[10px] text-[#555] mt-0.5">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => approve(u.id)} disabled={acting === u.id}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-40"
                        title="Approve"
                      >
                        {acting === u.id ? '…' : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => reject(u.id)} disabled={acting === u.id}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40"
                        title="Reject"
                      >
                        {acting === u.id ? '…' : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
