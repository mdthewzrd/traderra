'use client'
/**
 * AnnotationBar — notes + lab-image link for the selected backtest signal.
 * Manual flow: user annotates a screenshot in /lab, saves (gets lab-<ts>.png),
 * pastes the filename here, types notes. Persisted per (scanId, ticker, date).
 */
import { useState, useEffect, useRef } from 'react'

type T = Record<string, string>

export function AnnotationBar({
  scanId, ticker, date, dark, T,
}: {
  scanId: string; ticker: string; date: string; dark: boolean; T: T
}) {
  const [note, setNote] = useState('')
  const [labImage, setLabImage] = useState('')
  const [tag, setTag] = useState('')
  const [saved, setSaved] = useState(false)
  const [imgOk, setImgOk] = useState(true)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load on signal change
  useEffect(() => {
    setSaved(false); setImgOk(true)
    fetch(`/api/backtest/annotation?scanId=${encodeURIComponent(scanId)}&ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(d => { setNote(d.note || ''); setLabImage(d.labImage || ''); setTag(d.tag || '') })
      .catch(() => {})
  }, [scanId, ticker, date])

  // Debounced autosave
  const scheduleSave = (patch: { note?: string; labImage?: string; tag?: string }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await fetch('/api/backtest/annotation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, ticker, signalDate: date, ...patch }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 1500)
    }, 600)
  }

  const TAGS = ['HELD', 'CRAP', 'PUSH-FAIL', 'WATCH']
  const tagColor: Record<string, string> = { HELD: T.TEAL || '#14b8a6', CRAP: T.RED || '#ef4444', 'PUSH-FAIL': T.RED || '#ef4444', WATCH: T.GOLD || '#D4AF37' }

  return (
    <div style={{ borderBottom: `1px solid ${T.BORDER}`, background: dark ? 'rgba(20,184,166,0.03)' : 'rgba(20,184,166,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderBottom: `1px solid ${T.BORDER}` }}>
        <span style={{ color: T.TEAL, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>✎ ANNOTATE</span>
        <span style={{ color: T.MUTED, fontSize: 8 }}>{ticker} · {date.slice(5)}</span>
        <a href="/lab" target="_blank" rel="noreferrer" title="Open the lab to annotate a screenshot"
          style={{ marginLeft: 'auto', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3, color: T.GOLD, border: `1px solid ${T.GOLD}55`, textDecoration: 'none' }}>
          Lab ↗
        </a>
        {saved && <span style={{ color: T.TEAL, fontSize: 8, fontWeight: 700 }}>✓ saved</span>}
      </div>

      {/* Tag chips */}
      <div style={{ display: 'flex', gap: 3, padding: '5px 10px 0' }}>
        {TAGS.map(t => {
          const on = tag === t
          return (
            <button key={t} onClick={() => { setTag(on ? '' : t); scheduleSave({ tag: on ? '' : t }) }}
              style={{ fontSize: 7, fontWeight: 800, padding: '2px 5px', borderRadius: 2, cursor: 'pointer',
                border: `1px solid ${on ? tagColor[t] : T.BORDER}`, background: on ? tagColor[t] : 'transparent',
                color: on ? '#000' : T.MUTED, letterSpacing: 0.3 }}>{t}</button>
          )
        })}
      </div>

      {/* Notes */}
      <textarea
        value={note}
        onChange={e => { setNote(e.target.value); scheduleSave({ note: e.target.value }) }}
        placeholder="notes… (gap & crap, lost VWAP 9:45, red 1m broke ORL)"
        style={{ width: '100%', minHeight: 52, resize: 'vertical', padding: '5px 10px',
          background: 'transparent', border: 'none', borderTop: `1px solid ${T.BORDER}`,
          color: T.TEXT, fontSize: 10, fontFamily: 'inherit', outline: 'none' }}
      />

      {/* Lab image link + thumbnail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 6px' }}>
        <input
          value={labImage}
          onChange={e => { setLabImage(e.target.value); setImgOk(true); scheduleSave({ labImage: e.target.value }) }}
          placeholder="lab-1782…png  (from lab save)"
          style={{ flex: 1, fontSize: 9, padding: '3px 6px', borderRadius: 3,
            background: dark ? '#0a0e16' : '#fff', border: `1px solid ${T.BORDER}`, color: T.TEXT, outline: 'none' }}
        />
        {labImage && imgOk && (
          <a href={`/api/lab/image/${labImage}`} target="_blank" rel="noreferrer" title="View annotated image">
            <img src={`/api/lab/image/${labImage}`} alt="lab" onError={() => setImgOk(false)}
              style={{ height: 30, width: 40, objectFit: 'cover', borderRadius: 3, border: `1px solid ${T.BORDER}` }} />
          </a>
        )}
      </div>
    </div>
  )
}
