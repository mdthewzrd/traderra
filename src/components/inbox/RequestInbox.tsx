'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Req = {
  id: string
  title: string
  description?: string
  type?: string
  priority?: string
  status: string
  project?: string
  created_at?: string
  updated_at?: string
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  in_progress: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  'in-progress': 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  done: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  blocked: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
}
const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_progress: 'Working',
  'in-progress': 'Working',
  done: 'Done',
  blocked: 'Blocked',
}

export function RequestInbox() {
  const [open, setOpen] = useState(false)
  const [showList, setShowList] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [imgs, setImgs] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [reqs, setReqs] = useState<Req[]>([])
  const [sent, setSent] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const openCount = reqs.filter((r) => r.status !== 'done').length

  const loadReqs = useCallback(async () => {
    try {
      const r = await fetch('/api/requests?project=traderra', { cache: 'no-store' })
      if (r.ok) setReqs(await r.json())
    } catch { /* bridge may be down — badge stays quiet */ }
  }, [])

  useEffect(() => {
    if (open) { loadReqs(); return }
    // Light badge poll when closed: once on mount + every 90s
    loadReqs()
    const t = setInterval(loadReqs, 90000)
    return () => clearInterval(t)
  }, [open, loadReqs])

  // Paste a screenshot straight into the message box.
  const onPaste = useCallback(async (e: React.ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = async () => {
          const dataUrl = reader.result as string
          try {
            const up = await fetch('/api/inbox-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ dataUrl }),
            })
            if (up.ok) {
              const { url } = await up.json()
              setImgs((p) => [...p, url])
            }
          } catch { /* ignore failed upload */ }
        }
        reader.readAsDataURL(file)
      }
    }
  }, [])

  const removeImg = (u: string) => setImgs((p) => p.filter((x) => x !== u))

  const submit = async () => {
    if (!title.trim() || sending) return
    setSending(true)
    try {
      const ctx = typeof window !== 'undefined' ? `\n\n— sent from ${window.location.pathname}` : ''
      const imgLinks = imgs.length ? `\n\nScreenshots:\n${imgs.map((u) => `${window.location.origin}${u}`).join('\n')}` : ''
      const r = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: `${message.trim()}${ctx}${imgLinks}`.trim(),
        }),
      })
      if (r.ok) {
        const created = await r.json()
        setSent(created?.id ?? 'REQ')
        setTitle(''); setMessage(''); setImgs([])
        await loadReqs()
        setShowList(true)
      }
    } finally {
      setSending(false)
    }
  }

  const reset = () => { setSent(null); setShowList(true) }

  // open via top-nav "Renata" button (no more floating FAB)
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-request-inbox', handler)
    return () => window.removeEventListener('open-request-inbox', handler)
  }, [])

  return (
    <>
      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-300">Send to Renata</span>
                {openCount > 0 && (
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                    {openCount} open
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {sent ? (
              /* Sent confirmation */
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-sm text-zinc-200">Sent — <span className="font-mono text-emerald-300">{sent}</span></p>
                <p className="mt-1 text-xs text-zinc-500">Renata will pick it up. Track it in the list below.</p>
                <button onClick={reset} className="mt-4 rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700">New request</button>
              </div>
            ) : (
              <>
                {/* Form */}
                <div className="space-y-3 px-4 py-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short title — what do you need?"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500/60"
                    autoFocus
                  />
                  <textarea
                    ref={taRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onPaste={onPaste}
                    placeholder="Describe it. Paste a screenshot with Ctrl+V."
                    rows={4}
                    className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500/60"
                  />
                  {imgs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {imgs.map((u) => (
                        <div key={u} className="group relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="screenshot" className="h-16 w-16 rounded border border-zinc-700 object-cover" />
                          <button
                            onClick={() => removeImg(u)}
                            className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white group-hover:flex"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
                  <button
                    onClick={() => { setShowList((s) => !s); if (!showList) loadReqs() }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    {showList ? '▲ Hide' : `▼ Your requests (${reqs.length})`}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
                    <button
                      onClick={submit}
                      disabled={!title.trim() || sending}
                      className="rounded-md bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {sending ? 'Sending…' : 'Send →'}
                    </button>
                  </div>
                </div>

                {/* Request list */}
                {showList && (
                  <div className="max-h-56 overflow-y-auto border-t border-zinc-800 px-2 py-2">
                    {reqs.length === 0 ? (
                      <p className="px-2 py-4 text-center text-xs text-zinc-600">No requests yet.</p>
                    ) : (
                      reqs.slice(0, 30).map((r) => (
                        <div key={r.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800/50">
                          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${STATUS_STYLE[r.status] ?? 'bg-zinc-800 text-zinc-400 ring-zinc-700'}`}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-zinc-200">
                              <span className="font-mono text-zinc-500">{r.id}</span> {r.title}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
