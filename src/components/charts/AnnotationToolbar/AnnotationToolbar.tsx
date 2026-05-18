'use client'

/**
 * AnnotationToolbar — floating toolbar for annotation editing.
 * Full drag-to-move, color swatches + hex input, text color, line weight/style,
 * opacity, lock, visibility, duplicate, bring/send z-order, edit text.
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { useDrawingStore, Annotation } from '@/stores/charts/drawingStore'

export function AnnotationToolbar() {
  const selectedAnn = useDrawingStore(s => s.selectedAnn)
  const setSelectedAnn = useDrawingStore(s => s.setSelectedAnn)
  const updateAnnotation = useDrawingStore(s => s.updateAnnotation)
  const removeAnnotation = useDrawingStore(s => s.removeAnnotation)
  const addAnnotation = useDrawingStore(s => s.addAnnotation)

  // ── Toolbar position (draggable) ──
  const [pos, setPos] = useState({ x: 300, y: 60 })
  const dragRef = useRef<{ startX: number; startY: number; posStartX: number; posStartY: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Initialize position near chart area
  useEffect(() => {
    const chart = document.querySelector('#main-area') as HTMLElement
    if (chart) {
      const rect = chart.getBoundingClientRect()
      setPos({ x: rect.left + rect.width * 0.3, y: rect.top + 40 })
    }
  }, [])

  // Hide/show
  useEffect(() => {
    if (!toolbarRef.current) return
    toolbarRef.current.style.display = selectedAnn ? 'flex' : 'none'
  }, [selectedAnn])

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, posStartX: pos.x, posStartY: pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      setPos({
        x: dragRef.current.posStartX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.posStartY + (ev.clientY - dragRef.current.startY),
      })
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  // ── Actions ──
  const update = useCallback((patch: Partial<Annotation>) => {
    const sel = useDrawingStore.getState().selectedAnn
    if (!sel) return
    useDrawingStore.getState().updateAnnotation(sel.id, patch)
    setSelectedAnn({ ...sel, ...patch } as Annotation)
  }, [setSelectedAnn])

  const annDelete = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) { useDrawingStore.getState().removeAnnotation(sel.id); setSelectedAnn(null) }
  }, [setSelectedAnn])

  const annDuplicate = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (!sel) return
    const ds = useDrawingStore.getState()
    const offset = sel.y1 ? sel.y1 * 0.01 : 1
    ds.addAnnotation({ ...sel, id: ds.getNextId(), y1: (sel.y1 || 0) + offset, y2: sel.y2 ? sel.y2 + offset : undefined } as any)
  }, [])

  const annEditText = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (!sel) return
    const newText = prompt('Edit text:', sel.text || '')
    if (newText !== null) update({ text: newText } as any)
  }, [update])

  const annDeleteAllOfType = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (!sel) return
    const ds = useDrawingStore.getState()
    ds.annotations.filter(a => a.type === sel.type).forEach(a => ds.removeAnnotation(a.id))
    setSelectedAnn(null)
  }, [setSelectedAnn])

  // ── Dropdown state ──
  const [openDD, setOpenDD] = useState<string | null>(null)
  const toggleDD = (name: string) => setOpenDD(prev => prev === name ? null : name)

  if (!selectedAnn) return <div ref={toolbarRef} style={{ display: 'none' }} />

  const isText = ['text_orange', 'text_yellow', 'callout', 'note'].includes(selectedAnn.type)
  const lineColor = selectedAnn.color || '#7b61ff'
  const textColor = (selectedAnn as any).textColor || '#ff9800'
  const opacity = Math.round((selectedAnn.opacity ?? 1) * 100)

  return (
    <div
      ref={toolbarRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: selectedAnn ? 'flex' : 'none',
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 900,
        background: '#1e222d', border: '1px solid #2a3050', borderRadius: 4,
        padding: '2px 2px 2px 6px', gap: 1, alignItems: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto',
      }}
    >
      {/* Drag Handle */}
      <div style={{ cursor: 'grab', padding: '4px 4px 4px 0', display: 'flex', flexDirection: 'column', gap: 1 }} title="Drag to move"
        onMouseDown={onHandleMouseDown}
      >
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
      </div>
      <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 1px' }} />

      {/* Line Color */}
      <DDGroup open={openDD === 'color'} toggle={() => toggleDD('color')}>
        <DDTrigger title="Line Color">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="14" x2="16" y2="14" stroke={lineColor} strokeWidth="3" /><rect x="2" y="16" width="14" height="2" rx="1" fill={lineColor} /></svg>
        </DDTrigger>
        <DDContent style={{ minWidth: 180 }}>
          <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {['#ff9800','#26a69a','#e879f9','#7b61ff','#4ade80','#ff3d57','#facc15','#38bdf8','#f472b6','#ffffff','#94a3b8','#000000'].map(c => (
                <span key={c} onClick={() => { update({ color: c }); setOpenDD(null) }}
                  style={{ width: 18, height: 18, borderRadius: 3, background: c, cursor: 'pointer', border: lineColor === c ? '2px solid #dde3f0' : c === '#000000' ? '1px solid #444' : '1px solid transparent', flexShrink: 0 }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#4a6080' }}>Hex</span>
              <input type="text" defaultValue={lineColor} maxLength={7}
                style={{ width: 70, background: '#10131a', border: '1px solid #2a3050', borderRadius: 3, color: '#dde3f0', fontSize: 11, padding: '2px 4px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                onKeyDown={(e) => { if (e.key === 'Enter') { update({ color: (e.target as HTMLInputElement).value }); setOpenDD(null) } }}
              />
            </div>
          </div>
        </DDContent>
      </DDGroup>

      {/* Text Color (only for text annotations) */}
      {isText && (
        <DDGroup open={openDD === 'tcolor'} toggle={() => toggleDD('tcolor')}>
          <DDTrigger title="Text Color">
            <svg width="18" height="18" viewBox="0 0 18 18"><text x="3" y="14" fontSize="14" fontWeight="bold" fill={textColor}>A</text></svg>
          </DDTrigger>
          <DDContent>
            <div style={{ padding: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {['#ff9800','#26a69a','#fbbf24','#7b61ff','#4ade80','#ff3d57','#ffffff','#94a3b8'].map(c => (
                <span key={c} onClick={() => { update({ textColor: c } as any); setOpenDD(null) }}
                  style={{ width: 18, height: 18, borderRadius: 3, background: c, cursor: 'pointer', border: textColor === c ? '2px solid #dde3f0' : '1px solid transparent' }}
                />
              ))}
            </div>
          </DDContent>
        </DDGroup>
      )}

      {/* Line Weight */}
      <DDGroup open={openDD === 'weight'} toggle={() => toggleDD('weight')}>
        <DDTrigger title="Line Width">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" stroke="#dde3f0" strokeWidth={selectedAnn.lineWidth || 2} /></svg>
        </DDTrigger>
        <DDContent>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(w => (
              <div key={w} className="ann-opt-btn" onClick={() => { update({ lineWidth: w }); setOpenDD(null) }} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-block', width: 30, height: w, background: '#dde3f0', verticalAlign: 'middle' }} /> {w}px
              </div>
            ))}
          </div>
        </DDContent>
      </DDGroup>

      {/* Line Type */}
      <DDGroup open={openDD === 'linetype'} toggle={() => toggleDD('linetype')}>
        <DDTrigger title="Line Style">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" stroke="#dde3f0" strokeWidth="2"
            strokeDasharray={selectedAnn.lineStyle === 'dashed' ? '4,3' : selectedAnn.lineStyle === 'dotted' ? '2,3' : undefined}
          /></svg>
        </DDTrigger>
        <DDContent>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { style: 'solid', label: 'Solid', dash: undefined },
              { style: 'dashed', label: 'Dashed', dash: '6,3' },
              { style: 'dotted', label: 'Dotted', dash: '2,3' },
            ].map(({ style, label, dash }) => (
              <div key={style} className="ann-opt-btn" onClick={() => { update({ lineStyle: style } as any); setOpenDD(null) }} style={{ cursor: 'pointer' }}>
                <svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" strokeDasharray={dash} /></svg> {label}
              </div>
            ))}
          </div>
        </DDContent>
      </DDGroup>

      <div className="ann-tb-sep" />

      {/* Lock */}
      <button className="ann-tb-btn" onMouseDown={() => update({ locked: !selectedAnn.locked })} title="Lock">
        <svg width="16" height="16" viewBox="0 0 16 16">
          {selectedAnn.locked ? (
            <><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#D4AF37" strokeWidth="1.3" /><path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke="#D4AF37" strokeWidth="1.3" /></>
          ) : (
            <><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /><path d="M4 7V5a4 4 0 018 0" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /></>
          )}
        </svg>
      </button>

      {/* Visibility */}
      <button className="ann-tb-btn" onMouseDown={() => update({ hidden: !selectedAnn.hidden, visible: !selectedAnn.hidden } as any)} title="Show/Hide">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke={selectedAnn.hidden ? '#4a6080' : '#8aa0c0'} strokeWidth="1.3" />
          <circle cx="8" cy="8" r="2.5" fill="none" stroke={selectedAnn.hidden ? '#4a6080' : '#8aa0c0'} strokeWidth="1.3" />
          {selectedAnn.hidden && <line x1="2" y1="2" x2="14" y2="14" stroke="#ff3d57" strokeWidth="1.5" />}
        </svg>
      </button>

      {/* Opacity */}
      <DDGroup open={openDD === 'opacity'} toggle={() => toggleDD('opacity')}>
        <DDTrigger title="Opacity">
          <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="#8aa0c0" strokeWidth="1.2" /><circle cx="9" cy="9" r="3" fill="#8aa0c0" opacity={selectedAnn.opacity ?? 1} /></svg>
        </DDTrigger>
        <DDContent style={{ minWidth: 170 }}>
          <div style={{ padding: '6px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#8aa0c0', fontWeight: 700, letterSpacing: 0.5 }}>OPACITY</span>
              <span style={{ fontSize: 11, color: '#dde3f0', fontWeight: 700, fontFamily: 'monospace' }}>{opacity}%</span>
            </div>
            <input type="range" min={5} max={100} defaultValue={opacity}
              style={{ width: '100%', accentColor: '#D4AF37', cursor: 'pointer', height: 16 }}
              onChange={(e) => update({ opacity: parseInt(e.target.value) / 100 })}
            />
          </div>
        </DDContent>
      </DDGroup>

      <div className="ann-tb-sep" />

      {/* Delete */}
      <button className="ann-tb-btn ann-tb-btn-danger" onMouseDown={annDelete} title="Delete (Del)">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#ff3d57" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>

      {/* More */}
      <DDGroup open={openDD === 'more'} toggle={() => toggleDD('more')}>
        <DDTrigger title="More">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="#8aa0c0" /><circle cx="8" cy="8" r="1.5" fill="#8aa0c0" /><circle cx="13" cy="8" r="1.5" fill="#8aa0c0" /></svg>
        </DDTrigger>
        <DDContent>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div className="ann-opt-btn" onClick={() => { annDuplicate(); setOpenDD(null) }} style={{ cursor: 'pointer' }}>⧉ Duplicate</div>
            <div className="ann-opt-btn" onClick={() => { annEditText(); setOpenDD(null) }} style={{ cursor: 'pointer' }}>T✎ Edit Text</div>
            <div className="ann-opt-btn" onClick={() => {
              // Bring to front — remove and re-add at end
              const sel = useDrawingStore.getState().selectedAnn
              if (sel) { removeAnnotation(sel.id); addAnnotation({ ...sel, id: useDrawingStore.getState().getNextId() } as any) }
              setOpenDD(null)
            }} style={{ cursor: 'pointer' }}>▲ Bring to Front</div>
            <div className="ann-opt-btn" onClick={() => {
              // Send to back — remove and insert at beginning
              const ds = useDrawingStore.getState()
              const sel = ds.selectedAnn
              if (sel) {
                ds.removeAnnotation(sel.id)
                const newAnns = [{ ...sel, id: ds.getNextId() }, ...ds.annotations]
                ;(useDrawingStore as any).setState({ annotations: newAnns })
              }
              setOpenDD(null)
            }} style={{ cursor: 'pointer' }}>▼ Send to Back</div>
            <div style={{ height: 1, background: '#2a3050', margin: '2px 0' }} />
            <div className="ann-opt-btn" style={{ color: '#ff3d57', cursor: 'pointer' }} onClick={() => { annDeleteAllOfType(); setOpenDD(null) }}>✕ Delete All of This Type</div>
          </div>
        </DDContent>
      </DDGroup>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Dropdown primitives
   ═══════════════════════════════════════════════════════════════ */

function DDGroup({ open, toggle, children }: { open: boolean; toggle: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) toggle() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, toggle])
  return <div ref={ref} className="ann-tb-group" style={{ position: 'relative' }}>{children}</div>
}

function DDTrigger({ title, children }: { title: string; children: React.ReactNode }) {
  return <button className="ann-tb-btn" title={title}>{children}</button>
}

function DDContent({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="ann-dropdown" style={{ display: 'block', ...style }} onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  )
}
