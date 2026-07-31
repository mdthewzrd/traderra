'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useChatContext } from '@/contexts/TraderraContext'

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
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [imgs, setImgs] = useState<{ id: string; preview: string; url: string | null; uploading: boolean; error: boolean }[]>([])
  const [sending, setSending] = useState(false)
  const [reqs, setReqs] = useState<Req[]>([])
  const [sent, setSent] = useState<string | null>(null)
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([])
  const [jobId, setJobId] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const { setIsSidebarOpen } = useChatContext()

  const openCount = reqs.filter((r) => r.status !== 'done').length

  const loadReqs = useCallback(async () => {
    try {
      const r = await fetch('/api/requests?project=edge-dev', { cache: 'no-store' })
      if (r.ok) setReqs(await r.json())
    } catch { /* bridge may be down — badge stays quiet */ }
  }, [])

  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch('/api/jobs', { cache: 'no-store' })
      if (r.ok) setJobs(await r.json())
    } catch { /* bridge down */ }
  }, [])

  useEffect(() => {
    if (open) { loadReqs(); loadJobs(); return }
    // Light badge poll when closed: once on mount + every 90s
    loadReqs()
    const t = setInterval(loadReqs, 90000)
    return () => clearInterval(t)
  }, [open, loadReqs, loadJobs])

  // Paste a screenshot straight into the message box.
  const onPaste = useCallback(async (e: React.ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        // Instant local preview — don't wait for the upload round-trip.
        const id = (crypto as any).randomUUID?.() ?? String(Date.now() + Math.random())
        const preview = URL.createObjectURL(file)
        setImgs((p) => [...p, { id, preview, url: null, uploading: true, error: false }])
        try {
          const dataUrl: string = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result as string)
            reader.onerror = rej
            reader.readAsDataURL(file)
          })
          const up = await fetch('/api/inbox-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl }),
          })
          if (up.ok) {
            const { url } = await up.json()
            setImgs((p) => p.map((im) => (im.id === id ? { ...im, url, uploading: false } : im)))
          } else {
            setImgs((p) => p.map((im) => (im.id === id ? { ...im, uploading: false, error: true } : im)))
          }
        } catch {
          setImgs((p) => p.map((im) => (im.id === id ? { ...im, uploading: false, error: true } : im)))
        }
      }
    }
  }, [])

  const removeImg = (id: string) =>
    setImgs((p) => {
      const im = p.find((x) => x.id === id)
      if (im) URL.revokeObjectURL(im.preview)
      return p.filter((x) => x.id !== id)
    })

  const submit = async () => {
    if (!title.trim() || sending) return
    setSending(true)
    try {
      const ctx = typeof window !== 'undefined' ? `\n\n— sent from ${window.location.pathname}` : ''
      const uploaded = imgs.filter((i) => i.url)
      const imgLinks = uploaded.length ? `\n\nScreenshots:\n${uploaded.map((u) => `${window.location.origin}${u.url}`).join('\n')}` : ''
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
        // Attach the selected job. Bridge POST create omits job_id, so PATCH it.
        if (created?.id && jobId) {
          try {
            await fetch(`/api/requests/${created.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ job_id: jobId }),
            })
          } catch { /* job link is best-effort */ }
        }
        setSent(created?.id ?? 'REQ')
        setTitle(''); setMessage(''); setJobId('')
        imgs.forEach((i) => URL.revokeObjectURL(i.preview))
        setImgs([])
        await loadReqs()
      }
    } finally {
      setSending(false)
    }
  }

  const reset = () => { setSent(null) }

  // Extract screenshot paths embedded in a request description.
  // Matches both /api/inbox-asset/NNN.ext (new) and /inbox/NNN.ext (legacy).
  const screenshotsOf = (desc?: string): string[] => {
    if (!desc) return []
    const m = desc.match(/(?:\/api\/inbox-asset|\/inbox)\/[^\s)]+\.(?:png|jpe?g|gif|webp)/gi)
    return m ? m : []
  }

  // open/close via top-nav "Renata" button (toggle)
  useEffect(() => {
    const open = () => setOpen(true)
    const close = () => setOpen(false)
    window.addEventListener('open-request-inbox', open)
    window.addEventListener('close-request-inbox', close)
    return () => {
      window.removeEventListener('open-request-inbox', open)
      window.removeEventListener('close-request-inbox', close)
    }
  }, [])

  // Sync panel-open state to the context so AppLayout reserves a right gutter
  // (pushes main content left instead of overlaying it).
  useEffect(() => { setIsSidebarOpen(open) }, [open, setIsSidebarOpen])

  const close = () => setOpen(false)

  return (
    <>
      {/* Docked right-side panel — pushes main content left via context */}
      {open && (
        <div className="fixed top-16 right-0 bottom-0 z-50 flex w-[400px] max-w-full flex-col studio-surface border-l studio-border">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b studio-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary">Send to Renata</span>
                {openCount > 0 && (
                  <span className="rounded-full bg-[#1a1a1a] px-2 py-0.5 text-[10px] studio-muted">{openCount} open</span>
                )}
              </div>
              <button onClick={close} className="studio-muted hover:studio-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto">
            {sent ? (
              /* Sent confirmation */
              <div className="px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                </div>
                <p className="text-sm studio-text">Sent — <span className="font-mono text-emerald-300">{sent}</span></p>
                <p className="mt-1 text-xs studio-muted">Renata will pick it up in the edge project.</p>
                <button onClick={reset} className="mt-4 rounded-md bg-[#1a1a1a] px-3 py-1.5 text-xs studio-text hover:bg-[#222]">New request</button>
              </div>
            ) : (
              <>
                {/* Form */}
                <div className="space-y-3 px-4 py-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short title — what do you need?"
                    className="w-full rounded-md border studio-border bg-[#0a0a0a] px-3 py-2 text-sm studio-text placeholder:text-[#555] outline-none focus:border-primary/60"
                    autoFocus
                  />
                  {jobs.length > 0 && (
                    <select
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      className="w-full rounded-md border studio-border bg-[#0a0a0a] px-3 py-2 text-sm studio-text outline-none focus:border-primary/60"
                    >
                      <option value="">No job — unassigned</option>
                      {jobs.map((j) => (
                        <option key={j.id} value={j.id}>{j.id} · {j.title}</option>
                      ))}
                    </select>
                  )}
                  <textarea
                    ref={taRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onPaste={onPaste}
                    placeholder="Describe it. Paste a screenshot with Ctrl+V."
                    rows={5}
                    className="w-full resize-none rounded-md border studio-border bg-[#0a0a0a] px-3 py-2 text-sm studio-text placeholder:text-[#555] outline-none focus:border-primary/60"
                  />
                  {imgs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {imgs.map((im) => (
                        <div key={im.id} className="group relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={im.preview} alt="screenshot" className={`h-16 w-16 rounded border studio-border object-cover ${im.uploading ? 'opacity-40' : ''}`} />
                          {im.uploading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}
                          {im.error && (
                            <div className="absolute inset-0 flex items-center justify-center rounded bg-rose-500/40" title="Upload failed — try again">
                              <span className="text-xs font-bold text-white">!</span>
                            </div>
                          )}
                          <button
                            onClick={() => removeImg(im.id)}
                            className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white group-hover:flex"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send action */}
                <div className="flex shrink-0 items-center justify-end gap-2 border-t studio-border px-4 py-3">
                  <button onClick={close} className="rounded-md px-3 py-1.5 text-xs studio-muted hover:studio-text">Cancel</button>
                  <button
                    onClick={submit}
                    disabled={!title.trim() || sending}
                    className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? 'Sending…' : 'Send →'}
                  </button>
                </div>
              </>
            )}

            {/* Recent requests — always visible at the bottom of the panel */}
            <div className="shrink-0 border-t studio-border px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider studio-muted">Recent requests</span>
                <button onClick={loadReqs} className="text-[10px] studio-muted hover:studio-text">refresh</button>
              </div>
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {reqs.length === 0 ? (
                  <p className="py-3 text-center text-xs studio-muted">No requests yet.</p>
                ) : (
                  reqs.slice(0, 30).map((r) => {
                    const shots = screenshotsOf(r.description)
                    return (
                    <div key={r.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-[#1a1a1a]">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${STATUS_STYLE[r.status] ?? 'bg-[#1a1a1a] studio-muted ring-[#333]'}`}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {shots.length > 0 && (
                        <div className="relative mt-0.5 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={shots[0]} alt="screenshot" className="h-8 w-8 rounded border studio-border object-cover" />
                          {shots.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{shots.length}</span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs studio-text">
                          <span className="font-mono studio-muted">{r.id}</span> {r.title}
                        </p>
                      </div>
                    </div>
                    )
                  })
                )}
              </div>
            </div>
            </div>
        </div>
      )}
    </>
  )
}
