'use client'

/**
 * AnnotationToolbar — floating toolbar for annotation editing.
 * Wires to drawingStore for color/width/opacity/delete operations.
 */

import { useEffect, useCallback } from 'react'
import { useDrawingStore, Annotation } from '@/stores/charts/drawingStore'

export function AnnotationToolbar() {
  const selectedAnn = useDrawingStore(s => s.selectedAnn)
  const setSelectedAnn = useDrawingStore(s => s.setSelectedAnn)
  const updateAnnotation = useDrawingStore(s => s.updateAnnotation)
  const removeAnnotation = useDrawingStore(s => s.removeAnnotation)
  const annotations = useDrawingStore(s => s.annotations)

  // Position the toolbar near the selected annotation
  useEffect(() => {
    const toolbar = document.getElementById('ann-toolbar')
    if (!toolbar) return

    if (!selectedAnn) {
      toolbar.style.display = 'none'
      return
    }

    toolbar.style.display = 'flex'

    // Position near top-right of chart area
    const chart = document.querySelector('#main-area') as HTMLElement
    if (chart) {
      const rect = chart.getBoundingClientRect()
      toolbar.style.top = `${rect.top + 40}px`
      toolbar.style.left = `${rect.left + rect.width * 0.3}px`
    }
  }, [selectedAnn])

  // Wire up annotation toolbar actions as global functions
  const annSetWeight = useCallback((w: number) => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().updateAnnotation(sel.id, { lineWidth: w })
      setSelectedAnn({ ...sel, lineWidth: w })
    }
  }, [setSelectedAnn])

  const annSetLineStyle = useCallback((style: string) => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().updateAnnotation(sel.id, { lineStyle: style })
      setSelectedAnn({ ...sel, lineStyle: style })
    }
  }, [setSelectedAnn])

  const annToggleLock = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().updateAnnotation(sel.id, { locked: !sel.locked })
      setSelectedAnn({ ...sel, locked: !sel.locked })
    }
  }, [setSelectedAnn])

  const annToggleVisibility = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().updateAnnotation(sel.id, { hidden: !sel.hidden, visible: sel.visible })
      setSelectedAnn({ ...sel, hidden: !sel.hidden, visible: sel.visible })
    }
  }, [setSelectedAnn])

  const annDelete = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().removeAnnotation(sel.id)
      setSelectedAnn(null)
    }
  }, [setSelectedAnn])

  const annDuplicate = useCallback(() => {
    const sel = useDrawingStore.getState().selectedAnn
    if (!sel) return
    const ds = useDrawingStore.getState()
    ds.addAnnotation({
      ...sel,
      id: ds.getNextId(),
      x1: (sel.x1 || sel.points?.[0]?.x || 0) as number,
      y1: ((sel.y1 || sel.points?.[0]?.y || 0) as number) + (sel.y1 ? (sel.y1 * 0.01) : 1),
    } as any)
  }, [])

  const annPickSwatch = useCallback((color: string) => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().updateAnnotation(sel.id, { color })
      setSelectedAnn({ ...sel, color })
    }
    // Close dropdown
    const dd = document.getElementById('ann-dd-color')
    if (dd) dd.style.display = 'none'
  }, [setSelectedAnn])

  const annToggleDropdown = useCallback((name: string) => {
    // Close all, then toggle the named one
    const dropdowns = ['color', 'tcolor', 'weight', 'linetype', 'opacity', 'more']
    for (const d of dropdowns) {
      const el = document.getElementById(`ann-dd-${d}`)
      if (el && d !== name) el.style.display = 'none'
    }
    const target = document.getElementById(`ann-dd-${name}`)
    if (target) {
      target.style.display = target.style.display === 'none' ? 'block' : 'none'
    }
  }, [])

  const annCloseDropdowns = useCallback(() => {
    const dropdowns = ['color', 'tcolor', 'weight', 'linetype', 'opacity', 'more']
    for (const d of dropdowns) {
      const el = document.getElementById(`ann-dd-${d}`)
      if (el) el.style.display = 'none'
    }
  }, [])

  const annSetOpacity = useCallback((opacity: number) => {
    const sel = useDrawingStore.getState().selectedAnn
    if (sel) {
      useDrawingStore.getState().updateAnnotation(sel.id, { opacity: opacity / 100 })
      setSelectedAnn({ ...sel, opacity: opacity / 100 })
    }
  }, [setSelectedAnn])

  // Expose functions to window for the HTML-based dropdown buttons
  useEffect(() => {
    const w = window as any
    w.annSetWeight = annSetWeight
    w.annSetLineStyle = annSetLineStyle
    w.annToggleLock = annToggleLock
    w.annToggleVisibility = annToggleVisibility
    w.annDelete = annDelete
    w.annDuplicate = annDuplicate
    w.annPickSwatch = annPickSwatch
    w.annToggleDropdown = annToggleDropdown
    w.annCloseDropdowns = annCloseDropdowns
    w.annSetOpacity = annSetOpacity

    // Wire opacity slider
    const slider = document.getElementById('ann-opacity-slider')
    if (slider) {
      const handler = () => {
        const v = parseInt((slider as HTMLInputElement).value)
        const valEl = document.getElementById('ann-opacity-val')
        if (valEl) valEl.textContent = v + '%'
        annSetOpacity(v)
      }
      slider.addEventListener('input', handler)
      return () => slider.removeEventListener('input', handler)
    }
  }, [annSetWeight, annSetLineStyle, annToggleLock, annToggleVisibility, annDelete, annDuplicate, annPickSwatch, annToggleDropdown, annCloseDropdowns, annSetOpacity])

  // Bridge selectedAnn to window for render-annotations
  useEffect(() => {
    ;(window as any).selectedAnn = selectedAnn || null
  }, [selectedAnn])

  return (
    <div
      id="ann-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'none', position: 'fixed', zIndex: 900, background: '#1e222d', border: '1px solid #2a3050', borderRadius: 4, padding: '2px 2px 2px 6px', gap: 1, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
    >
      {/* Drag Handle */}
      <div id="ann-toolbar-handle" style={{ cursor: 'grab', padding: '4px 4px 4px 0', display: 'flex', flexDirection: 'column', gap: 1 }} title="Drag to move">
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
      </div>
      <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 1px' }} />

      {/* Line Color */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-color-btn" className="ann-tb-btn" onMouseDown={() => annToggleDropdown('color')} title="Line Color">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="14" x2="16" y2="14" strokeWidth="3" id="ann-color-line" stroke={selectedAnn?.color || '#7b61ff'} /><rect x="2" y="16" width="14" height="2" rx="1" id="ann-color-bar" fill={selectedAnn?.color || '#7b61ff'} /></svg>
        </button>
        <div id="ann-dd-color" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="ann-color-picker">
            <div className="ann-swatches">
              {['#ff9800', '#26a69a', '#e879f9', '#7b61ff', '#4ade80', '#ff3d57', '#facc15', '#38bdf8', '#f472b6', '#ffffff', '#94a3b8', '#000000'].map(c => (
                <span
                  key={c}
                  onClick={() => annPickSwatch(c)}
                  data-c={c}
                  style={{ background: c, cursor: 'pointer', ...(c === '#000000' ? { border: '1px solid #444' } : {}) }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Line Weight */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-weight-btn" className="ann-tb-btn" onMouseDown={() => annToggleDropdown('weight')} title="Line Width">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" strokeWidth={selectedAnn?.lineWidth || 2} stroke="#dde3f0" /></svg>
        </button>
        <div id="ann-dd-weight" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(w => (
              <div key={w} className="ann-opt-btn" data-w={w} onMouseDown={() => { annSetWeight(w); annCloseDropdowns() }} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-block', width: 30, height: w, background: '#dde3f0', verticalAlign: 'middle' }} /> {w}px
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Line Type */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-linetype-btn" className="ann-tb-btn" onMouseDown={() => annToggleDropdown('linetype')} title="Line Style">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" strokeWidth="2" stroke="#dde3f0" strokeDasharray={selectedAnn?.lineStyle === 'dashed' ? '4,3' : selectedAnn?.lineStyle === 'dotted' ? '2,3' : undefined} /></svg>
        </button>
        <div id="ann-dd-linetype" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="ann-opt-btn" onMouseDown={() => { annSetLineStyle('solid'); annCloseDropdowns() }} style={{ cursor: 'pointer' }}><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" /></svg> Solid</div>
            <div className="ann-opt-btn" onMouseDown={() => { annSetLineStyle('dashed'); annCloseDropdowns() }} style={{ cursor: 'pointer' }}><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" strokeDasharray="6,3" /></svg> Dashed</div>
            <div className="ann-opt-btn" onMouseDown={() => { annSetLineStyle('dotted'); annCloseDropdowns() }} style={{ cursor: 'pointer' }}><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" strokeDasharray="2,3" /></svg> Dotted</div>
          </div>
        </div>
      </div>

      <div className="ann-tb-sep" />

      {/* Lock */}
      <button className="ann-tb-btn" onMouseDown={annToggleLock} title="Lock">
        <svg width="16" height="16" viewBox="0 0 16 16">
          {selectedAnn?.locked ? (
            <><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#D4AF37" strokeWidth="1.3" /><path d="M5 7V5a3 3 0 016 0v2" fill="none" stroke="#D4AF37" strokeWidth="1.3" /></>
          ) : (
            <><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /><path d="M4 7V5a4 4 0 018 0" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /></>
          )}
        </svg>
      </button>

      {/* Visibility */}
      <button className="ann-tb-btn" onMouseDown={annToggleVisibility} title="Show/Hide">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke={selectedAnn?.hidden ? '#4a6080' : '#8aa0c0'} strokeWidth="1.3" /><circle cx="8" cy="8" r="2.5" fill="none" stroke={selectedAnn?.hidden ? '#4a6080' : '#8aa0c0'} strokeWidth="1.3" />{selectedAnn?.hidden && <line x1="2" y1="2" x2="14" y2="14" stroke="#ff3d57" strokeWidth="1.5" />}</svg>
      </button>

      {/* Opacity */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-opacity-btn" className="ann-tb-btn" onMouseDown={() => annToggleDropdown('opacity')} title="Opacity">
          <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="#8aa0c0" strokeWidth="1.2" /><circle cx="9" cy="9" r="3" fill="#8aa0c0" opacity={selectedAnn?.opacity || 1} /></svg>
        </button>
        <div id="ann-dd-opacity" className="ann-dropdown" style={{ display: 'none', minWidth: 170 }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: '6px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#8aa0c0', fontWeight: 700, letterSpacing: 0.5 }}>OPACITY</span>
              <span id="ann-opacity-val" style={{ fontSize: 11, color: '#dde3f0', fontWeight: 700, fontFamily: 'monospace' }}>{Math.round((selectedAnn?.opacity ?? 1) * 100)}%</span>
            </div>
            <input type="range" id="ann-opacity-slider" min={5} max={100} defaultValue={Math.round((selectedAnn?.opacity ?? 1) * 100)} style={{ width: '100%', accentColor: '#D4AF37', cursor: 'pointer', height: 16 }} />
          </div>
        </div>
      </div>

      <div className="ann-tb-sep" />

      {/* Delete */}
      <button className="ann-tb-btn ann-tb-btn-danger" onMouseDown={annDelete} title="Delete (Del)">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#ff3d57" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>

      {/* More */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button className="ann-tb-btn" onMouseDown={() => annToggleDropdown('more')} title="More">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="#8aa0c0" /><circle cx="8" cy="8" r="1.5" fill="#8aa0c0" /><circle cx="13" cy="8" r="1.5" fill="#8aa0c0" /></svg>
        </button>
        <div id="ann-dd-more" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div className="ann-opt-btn" onMouseDown={() => { annDuplicate(); annCloseDropdowns() }} style={{ cursor: 'pointer' }}>⧉ Duplicate</div>
            <div style={{ height: 1, background: '#2a3050', margin: '2px 0' }} />
            <div className="ann-opt-btn" style={{ color: '#ff3d57', cursor: 'pointer' }} onMouseDown={() => { annDelete(); annCloseDropdowns() }}>✕ Delete All of This Type</div>
          </div>
        </div>
      </div>
    </div>
  )
}
