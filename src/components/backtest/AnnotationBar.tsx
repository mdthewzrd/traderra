'use client'
/**
 * AnnotationBar — compact summary in the sidebar + a large modal workspace.
 *
 * Modal ("chat area"):
 *   - big notes textarea (autosaves, debounced)
 *   - PASTE anywhere (Ctrl+V) → screenshot uploads via /api/lab/save → inline gallery
 *   - multi-image gallery (view / remove)
 *   - multi-tag chips (presets + custom, Enter to add)
 *
 * Persisted per (scanId, ticker, date) with denormalized `strategy` for tag organization.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

type T = Record<string, string>

const PRESETS = ['HELD', 'CRAP', 'PUSH-FAIL', 'GAP-CRAP', 'WATCH', 'LONG', 'SHORT']

export function AnnotationBar({
  scanId, strategy, ticker, date, dark, T, onChanged,
}: {
  scanId: string; strategy?: string; ticker: string; date: string; dark: boolean; T: T
  onChanged?: () => void
}) {
  const [note, setNote] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)        // uploading pasted image
  const [pasteHint, setPasteHint] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on signal change
  useEffect(() => {
    setSaved(false)
    fetch(`/api/backtest/annotation?scanId=${encodeURIComponent(scanId)}&ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(d => { setNote(d.note || ''); setImages(d.images || []); setTags(d.tags || []) })
      .catch(() => {})
  }, [scanId, ticker, date])

  const persist = useCallback((patch: { note?: string; images?: string[]; tags?: string[] }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch('/api/backtest/annotation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, strategy, ticker, signalDate: date, ...patch }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 1200)
      onChanged?.()
    }, 500)
  }, [scanId, strategy, ticker, date, onChanged])

  // Paste → upload via /api/lab/save (reuses the lab pipeline + image-serve route)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    let file: File | null = null
    for (const it of items) { if (it.type.startsWith('image/')) { file = it.getAsFile(); break } }
    if (!file) return
    e.preventDefault()
    setBusy(true)
    try {
      const dataUrl = await new Promise<string>(res => {
        const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(file)
      })
      const r = await fetch('/api/lab/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const j = await r.json()
      if (j.name) {
        setImages(prev => {
          const next = [...prev, j.name]
          persist({ images: next })
          return next
        })
      }
    } catch { /* ignore */ }
    setBusy(false)
  }, [persist])

  const tagColor = (t: string) => {
    if (/HELD|LONG/i.test(t)) return T.TEAL || '#14b8a6'
    if (/CRAP|FAIL|SHORT/i.test(t)) return T.RED || '#ef4444'
    if (/WATCH/i.test(t)) return T.GOLD || '#D4AF37'
    return T.TEXT2 || '#888'
  }

  const toggleTag = (t: string) => {
    setTags(prev => {
      const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
      persist({ tags: next })
      return next
    })
  }
  const addCustomTag = () => {
    const t = newTag.trim().toUpperCase()
    if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); persist({ tags: [...tags, t] }) }
    setNewTag('')
  }
  const removeImage = (name: string) => {
    setImages(prev => { const next = prev.filter(x => x !== name); persist({ images: next }); return next })
  }

  // ── Compact summary (in the sidebar) ──
  const Compact = () => (
    <div style={{ borderBottom: `1px solid ${T.BORDER}`, background: dark ? 'rgba(20,184,166,0.03)' : 'rgba(20,184,166,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
        <span style={{ color: T.TEAL, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>✎ ANNOTATE</span>
        <span style={{ color: T.MUTED, fontSize: 8 }}>{ticker} · {date.slice(5)}</span>
        {tags.length > 0 && tags.slice(0, 3).map(t => (
          <span key={t} style={{ fontSize: 7, fontWeight: 800, padding: '1px 4px', borderRadius: 2, background: tagColor(t), color: '#000' }}>{t}</span>
        ))}
        <button onClick={() => setOpen(true)} title="Open annotation workspace"
          style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
            color: T.GOLD, border: `1px solid ${T.GOLD}66`, background: 'transparent' }}>
          {images.length > 0 || note ? `✎ Expand` : '✎ Open'}
        </button>
      </div>
      {(note || images.length > 0) && (
        <div style={{ padding: '2px 10px 5px', color: T.MUTED, fontSize: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          {note && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{note}</span>}
          {images.length > 0 && <span style={{ color: T.TEAL, fontWeight: 700 }}>🖼 {images.length}</span>}
        </div>
      )}
    </div>
  )

  // ── Modal workspace ──
  return (
    <>
      <Compact />
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onPaste={handlePaste}>
          <div style={{ width: 760, maxWidth: '94vw', maxHeight: '90vh', background: T.SURFACE, border: `1px solid ${T.BORDER}`, borderRadius: 8, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
            onPaste={handlePaste}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.BORDER}`, flexShrink: 0 }}>
              <span style={{ color: T.TEAL, fontSize: 12, fontWeight: 800 }}>✎ ANNOTATION</span>
              <span style={{ color: T.GOLD, fontSize: 14, fontWeight: 800 }}>{ticker}</span>
              <span style={{ color: T.MUTED, fontSize: 10 }}>{date}</span>
              {strategy && <span style={{ color: T.MUTED, fontSize: 9, padding: '1px 6px', border: `1px solid ${T.BORDER}`, borderRadius: 8 }}>{strategy}</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {busy && <span style={{ color: T.GOLD, fontSize: 9 }}>⏳ uploading…</span>}
                {saved && <span style={{ color: T.TEAL, fontSize: 9, fontWeight: 700 }}>✓ saved</span>}
                <a href="/lab" target="_blank" rel="noreferrer" style={{ fontSize: 9, color: T.GOLD, border: `1px solid ${T.GOLD}55`, borderRadius: 3, padding: '2px 6px', textDecoration: 'none' }}>Lab ↗</a>
                <button onClick={() => setOpen(false)} style={{ fontSize: 12, color: T.MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {/* Tags */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>TAGS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                  {PRESETS.map(p => {
                    const on = tags.includes(p)
                    return <button key={p} onClick={() => toggleTag(p)} style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                      border: `1px solid ${on ? tagColor(p) : T.BORDER}`, background: on ? tagColor(p) : 'transparent', color: on ? '#000' : T.TEXT2 }}>{p}</button>
                  })}
                  {tags.filter(t => !PRESETS.includes(t)).map(t => (
                    <button key={t} onClick={() => toggleTag(t)} style={{ fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                      border: `1px solid ${tagColor(t)}`, background: tagColor(t), color: '#000' }}>{t} ✕</button>
                  ))}
                  <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag() } }}
                    placeholder="+ custom" style={{ fontSize: 9, padding: '3px 6px', width: 80, background: dark ? '#0a0e16' : '#fff', border: `1px solid ${T.BORDER}`, borderRadius: 3, color: T.TEXT, outline: 'none' }} />
                </div>
              </div>

              {/* Notes — the "chat area" */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>NOTES</div>
                <textarea value={note}
                  onChange={e => { setNote(e.target.value); persist({ note: e.target.value }) }}
                  onPaste={handlePaste}
                  onFocus={() => setPasteHint(true)} onBlur={() => setPasteHint(false)}
                  placeholder="type notes… you can paste a screenshot anywhere here (Ctrl+V)"
                  style={{ width: '100%', minHeight: 140, resize: 'vertical', padding: '10px', boxSizing: 'border-box',
                    background: dark ? '#0a0e16' : '#fff', border: `1px solid ${T.BORDER}`, borderRadius: 4, color: T.TEXT, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.5, outline: 'none' }} />
                {pasteHint && <div style={{ color: T.TEAL, fontSize: 8, marginTop: 4 }}>⌨ paste a screenshot with Ctrl+V — it uploads automatically</div>}
              </div>

              {/* Image gallery */}
              <div>
                <div style={{ color: T.MUTED, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>IMAGES {images.length > 0 && `(${images.length})`}</div>
                {images.length === 0 ? (
                  <div style={{ padding: 18, textAlign: 'center', border: `1px dashed ${T.BORDER}`, borderRadius: 4, color: T.MUTED, fontSize: 10 }}>
                    📋 Paste a screenshot here (Ctrl+V), or annotate in the Lab and it'll link here
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                    {images.map((name, i) => (
                      <div key={name + i} style={{ position: 'relative', border: `1px solid ${T.BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                        <img src={`/api/lab/image/${name}`} alt="annotation" onClick={() => setLightbox(name)}
                          style={{ width: '100%', height: 100, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
                        <button onClick={() => removeImage(name)} title="remove"
                          style={{ position: 'absolute', top: 3, right: 3, fontSize: 10, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', padding: '1px 5px' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={`/api/lab/image/${lightbox}`} alt="full" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain' }} />
        </div>
      )}
    </>
  )
}
