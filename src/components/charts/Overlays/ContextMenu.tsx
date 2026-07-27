'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDrawingStore } from '@/stores/charts/drawingStore'

/**
 * ContextMenu — right-click context menu for annotations.
 * Shows Edit, Duplicate, Lock, Hide, Delete options.
 * Positioned at mouse cursor.
 */
export function ContextMenu() {
  const [pos, setPos] = useState<{ x: number; y: number; annId: string } | null>(null)
  const selectedAnn = useDrawingStore(s => s.selectedAnn)
  const setSelectedAnn = useDrawingStore(s => s.setSelectedAnn)
  const updateAnnotation = useDrawingStore(s => s.updateAnnotation)
  const removeAnnotation = useDrawingStore(s => s.removeAnnotation)
  const annotations = useDrawingStore(s => s.annotations)

  const close = useCallback(() => setPos(null), [])

  // Listen for contextmenu on the canvas area
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const canvas = (e.target as HTMLElement)?.closest('canvas')
      if (!canvas) return
      e.preventDefault()

      // Find annotation near click — use window.selectedAnn if already set by render-annotations hit test
      const sel = useDrawingStore.getState().selectedAnn
      if (sel) {
        setPos({ x: e.clientX, y: e.clientY, annId: sel.id })
      }
    }
    document.addEventListener('contextmenu', handler)
    return () => document.removeEventListener('contextmenu', handler)
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!pos) return
    const handler = (e: MouseEvent) => { close() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pos, close])

  // Close on Escape
  useEffect(() => {
    if (!pos) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pos, close])

  if (!pos) return null

  const ann = annotations.find(a => a.id === (pos.annId as any))
  if (!ann) return null

  const action = (fn: () => void) => { fn(); close() }

  const items = [
    { label: '✎ Edit Text', action: () => { const t = prompt('Edit text:', ann.text || ''); if (t !== null) updateAnnotation(ann.id, { text: t } as any) }, show: !!ann.text || ['text_orange','text_yellow','callout','note'].includes(ann.type) },
    { label: '⧉ Duplicate', action: () => { const ds = useDrawingStore.getState(); ds.addAnnotation({ ...ann, id: ds.getNextId() } as any) } },
    { label: ann.locked ? '🔓 Unlock' : '🔒 Lock', action: () => updateAnnotation(ann.id, { locked: !ann.locked }) },
    { label: ann.hidden ? '👁 Show' : '👁‍🗨 Hide', action: () => updateAnnotation(ann.id, { hidden: !ann.hidden, visible: !ann.hidden } as any) },
    { label: '─', action: () => {}, sep: true },
    { label: '🗑 Delete', action: () => { removeAnnotation(ann.id); setSelectedAnn(null) }, danger: true },
  ]

  return (
    <div id="ctx-menu" className="open" style={{ left: pos.x, top: pos.y }}>
      {items.filter(i => i.show !== false).map((item, i) =>
        item.sep ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <div key={i} className="ctx-item" style={item.danger ? { color: '#ff3d57' } : undefined}
            onMouseDown={(e) => { e.stopPropagation(); action(item.action) }}
          >{item.label}</div>
        )
      )}
    </div>
  )
}
