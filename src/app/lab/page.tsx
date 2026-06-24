'use client'
/**
 * /lab — Annotation workspace (v3: Select tool + contextual toolbar + clean history).
 *
 * Model: image stays at NATIVE resolution as the canvas background; fit/zoom/pan
 * via the Fabric viewport transform. Canvas is always screen-sized.
 *
 * Tools: ✋ Hand (pan) | ▦ Select (move/edit drawings) | ✎ Pen | ▭ Box | → Arrow | T Text
 * History: snapshot on object:added AND object:modified AND text-edit exit, so text
 *   edits get their own undo entry (no more "pen undo reverts my text").
 * Selection toolbar: when a drawing is selected (Select tool), a floating bar shows
 *   Stroke / Fill / Size and Delete, applied live to the active object.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, FabricImage, Rect, IText, Line, Path } from 'fabric'

type Tool = 'hand' | 'select' | 'pen' | 'rect' | 'line' | 'arrow' | 'text'

const DRAW_TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'pen',   label: '✎ Pen',   hint: 'Freehand draw' },
  { id: 'rect',  label: '▭ Box',   hint: 'Drag to draw a rectangle' },
  { id: 'line',  label: '╱ Line',  hint: 'Drag to draw a straight line' },
  { id: 'arrow', label: '→ Arrow', hint: 'Drag from tail to head' },
  { id: 'text',  label: 'T Text',  hint: 'Click to place, then type' },
]

type SelProps = { stroke: string; fill: string; size: number; isText: boolean } | null

export default function LabPage() {
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fc = useRef<Canvas | null>(null)
  const [tool, setTool] = useState<Tool>('hand')
  const toolRef = useRef<Tool>('hand')
  const [color, setColor] = useState('#ff3b30')
  const colorRef = useRef('#ff3b30')
  const [size, setSize] = useState(4)
  const sizeRef = useRef(4)
  const [hasImage, setHasImage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('Paste a screenshot (Ctrl+V), drop an image, or use Upload.')
  // selection toolbar state
  const [sel, setSel] = useState<any>(null)
  const [, forceSel] = useState(0)

  // draw state
  const drawing = useRef(false)
  const startPt = useRef<{ x: number; y: number } | null>(null)
  const tempObj = useRef<any>(null)
  // hand-pan state
  const lastPan = useRef<{ x: number; y: number } | null>(null)
  // pen (manual freehand) state
  const penPts = useRef<{ x: number; y: number }[]>([])
  const penObj = useRef<any>(null)
  const suppressHist = useRef(false)
  // undo/redo history (two-stack)
  const hist = useRef<string[]>([])
  const redoHist = useRef<string[]>([])
  const restoring = useRef(false)
  // memoized (stable ref) so the canvas-init effect doesn't re-run every render
  const pushHist = useCallback(() => {
    const c = fc.current; if (!c) return
    hist.current.push(JSON.stringify(c.toJSON()))
    if (hist.current.length > 60) hist.current.shift()
    redoHist.current = []
  }, [])

  const setV = (ref: any, v: any, setter?: any) => { ref.current = v; setter?.(v) }

  // ── read active object's editable props into SelProps ──
  const readSel = useCallback((): SelProps => {
    const c = fc.current; if (!c) return null
    const o = c.getActiveObject(); if (!o) return null
    const isText = o.type === 'i-text' || o.type === 'text' || o.type === 'textbox'
    return {
      stroke: (o.stroke as string) || '#ff3b30',
      fill: isText ? (o.fill as string) : ((o.fill && o.fill !== 'transparent') ? (o.fill as string) : '#ff3b30'),
      size: isText ? (o.fontSize as number) : (o.strokeWidth as number),
      isText,
    }
  }, [])

  // ── fit image to viewport (centered, 95%) ──
  const fitImage = useCallback(() => {
    const c = fc.current; if (!c || !c.backgroundImage) return
    const img = c.backgroundImage as any
    const cw = c.getWidth(), ch = c.getHeight()
    const iw = (img.width || 1) * (img.scaleX || 1)
    const ih = (img.height || 1) * (img.scaleY || 1)
    const scale = Math.min(cw / iw, ch / ih) * 0.95
    c.setViewportTransform([scale, 0, 0, scale, (cw - iw * scale) / 2, (ch - ih * scale) / 2])
    c.requestRenderAll()
  }, [])

  const zoomBy = useCallback((factor: number) => {
    const c = fc.current; if (!c) return
    const cw = c.getWidth(), ch = c.getHeight()
    const next = Math.max(0.1, Math.min(8, c.getZoom() * factor))
    c.zoomToPoint({ x: cw / 2, y: ch / 2 } as any, next)
    c.requestRenderAll()
  }, [])

  const sizeToWrap = useCallback(() => {
    const c = fc.current, w = wrapRef.current; if (!c || !w) return
    c.setDimensions({ width: w.clientWidth, height: w.clientHeight })
    c.requestRenderAll()
  }, [])

  // ── init canvas ──
  useEffect(() => {
    if (!canvasEl.current) return
    const c = new Canvas(canvasEl.current, {
      backgroundColor: '#0d1117', preserveObjectStacking: true, selection: false,
    })
    fc.current = c
    ;(globalThis as any).__labCanvas = c
    sizeToWrap()

    const onResize = () => { sizeToWrap(); if (c.backgroundImage) fitImage() }
    window.addEventListener('resize', onResize)

    const onWinUp = () => {
      if (!penObj.current) return
      suppressHist.current = false
      penObj.current = null
      penPts.current = []
      pushHist()
      c.requestRenderAll()
    }
    window.addEventListener('pointerup', onWinUp)

    // history: snapshot on add AND modified (modified = text typing, move, resize)
    const onAdded = () => { if (!restoring.current && !suppressHist.current) pushHist() }
    const onModified = () => { if (!restoring.current) pushHist() }
    c.on('object:added', onAdded)
    c.on('object:modified', onModified)
    // commit text edits on exit so typed content gets its own undo point
    c.on('text:editing:exited', onModified)

    // selection tracking → drive contextual toolbar
    const onSelChange = () => { setSel(c.getActiveObject()); forceSel(x => x + 1) }
    c.on('selection:created', onSelChange)
    c.on('selection:updated', onSelChange)
    c.on('selection:cleared', () => setSel(null))

    const pointer = (e: any) => c.getScenePoint(e.e)   // fabric v7: getPointer removed

    c.on('mouse:down', (e: any) => {
      const t = toolRef.current
      if (t === 'select') return                          // native selection handles it
      if (t === 'hand') { lastPan.current = { x: e.e.clientX, y: e.e.clientY }; return }
      const p = pointer(e)
      if (t === 'pen') { penPts.current = [p]; suppressHist.current = true; return }
      if (t === 'text') {
        const it = new IText('text', {
          left: p.x, top: p.y, fill: colorRef.current,
          fontSize: 18, fontFamily: 'ui-monospace, monospace',
        })
        c.add(it); c.setActiveObject(it); it.enterEditing(); it.selectAll()
        return
      }
      drawing.current = true
      startPt.current = p
      if (t === 'rect') {
        tempObj.current = new Rect({
          left: p.x, top: p.y, width: 0, height: 0,
          fill: 'transparent', stroke: colorRef.current, strokeWidth: sizeRef.current,
        })
        c.add(tempObj.current)
      } else if (t === 'line') {
        tempObj.current = new Line([p.x, p.y, p.x, p.y], {
          stroke: colorRef.current, strokeWidth: sizeRef.current, strokeLineCap: 'round',
        })
        c.add(tempObj.current)
      }
    })

    c.on('mouse:move', (e: any) => {
      const t = toolRef.current
      if (t === 'hand' && lastPan.current) {
        const vpt = c.viewportTransform
        if (vpt) { vpt[4] += e.e.clientX - lastPan.current.x; vpt[5] += e.e.clientY - lastPan.current.y; c.setViewportTransform(vpt) }
        lastPan.current = { x: e.e.clientX, y: e.e.clientY }
        return
      }
      if (t === 'pen') {
        if (!penPts.current.length) return
        penPts.current.push(pointer(e))
        if (penObj.current) c.remove(penObj.current)
        const pts = penPts.current
        let s = `M ${pts[0].x} ${pts[0].y}`
        for (let i = 1; i < pts.length; i++) s += ` L ${pts[i].x} ${pts[i].y}`
        suppressHist.current = true
        penObj.current = new Path(s, { fill: 'transparent', stroke: colorRef.current, strokeWidth: sizeRef.current, strokeLineCap: 'round', strokeLineJoin: 'round' })
        c.add(penObj.current); c.requestRenderAll(); return
      }
      if (drawing.current && t === 'arrow' && startPt.current) {
        const p = pointer(e), s = startPt.current
        if (tempObj.current) c.remove(tempObj.current)
        tempObj.current = new Line([s.x, s.y, p.x, p.y], { stroke: colorRef.current, strokeWidth: sizeRef.current, strokeLineCap: 'round', strokeDashArray: [6, 4] })
        c.add(tempObj.current); c.requestRenderAll(); return
      }
      if (drawing.current && t === 'line' && startPt.current && tempObj.current) {
        const p = pointer(e)
        tempObj.current.set({ x2: p.x, y2: p.y })
        c.requestRenderAll(); return
      }
      if (!drawing.current || t !== 'rect' || !tempObj.current) return
      const p = pointer(e), s = startPt.current!
      tempObj.current.set({ width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y), left: Math.min(p.x, s.x), top: Math.min(p.y, s.y) })
      c.requestRenderAll()
    })

    c.on('mouse:up', (e: any) => {
      lastPan.current = null
      if (penObj.current) {
        suppressHist.current = false; penObj.current = null; penPts.current = []; pushHist(); return
      }
      if (!drawing.current) return
      drawing.current = false
      const t = toolRef.current, p = pointer(e), s = startPt.current
      startPt.current = null
      if (t === 'rect') {
        if (tempObj.current && (tempObj.current.width! < 3 || tempObj.current.height! < 3)) c.remove(tempObj.current)
        tempObj.current = null
      } else if (t === 'line' && s) {
        const x1 = s.x, y1 = s.y, x2 = p.x, y2 = p.y
        if (Math.hypot(x2 - x1, y2 - y1) < 5 && tempObj.current) c.remove(tempObj.current)
        tempObj.current = null
      } else if (t === 'arrow' && s) {
        if (tempObj.current) { c.remove(tempObj.current); tempObj.current = null }
        const x1 = s.x, y1 = s.y, x2 = p.x, y2 = p.y
        if (Math.hypot(x2 - x1, y2 - y1) < 5) return
        const ang = Math.atan2(y2 - y1, x2 - x1), hl = 16
        const a1 = ang - Math.PI / 6, a2 = ang + Math.PI / 6
        const shaft = new Line([x1, y1, x2, y2], { stroke: colorRef.current, strokeWidth: sizeRef.current, strokeLineCap: 'round' })
        const head = new Path(`M ${x2} ${y2} L ${x2 - hl * Math.cos(a1)} ${y2 - hl * Math.sin(a1)} L ${x2 - hl * Math.cos(a2)} ${y2 - hl * Math.sin(a2)} z`, { fill: colorRef.current, stroke: colorRef.current, strokeWidth: 1 })
        c.add(shaft); c.add(head)
      }
    })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointerup', onWinUp)
      c.dispose(); fc.current = null
    }
  }, [sizeToWrap, fitImage, pushHist])

  // ── apply tool settings + exit text-editing when leaving text tool ──
  useEffect(() => {
    const c = fc.current; if (!c) return
    // leaving text or switching to a non-select tool → commit + deselect
    const active = c.getActiveObject()
    if (active && (active as any).isEditing) (active as any).exitEditing()
    if (tool !== 'select') c.discardActiveObject()
    c.isDrawingMode = false
    c.selection = tool === 'select'
    c.skipTargetFind = tool !== 'select'
    const cur = tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'
    c.defaultCursor = cur; c.hoverCursor = cur
  }, [tool])

  // ── load image native-scale; fit ──
  const loadImage = useCallback((file: File) => {
    const c = fc.current; if (!c) return
    const reader = new FileReader()
    reader.onload = () => {
      FabricImage.fromURL(reader.result as string, { crossOrigin: 'anonymous' }).then((img: any) => {
        img.set({ scaleX: 1, scaleY: 1, left: 0, top: 0 })
        c.backgroundImage = img
        c.setViewportTransform([1, 0, 0, 1, 0, 0])
        fitImage()
        setHasImage(true)
        hist.current = [JSON.stringify(c.toJSON())]
        redoHist.current = []
        setMsg('Image loaded. Fit/Zoom/Hand to navigate, Select to edit, draw tools to annotate.')
      }).catch((e: any) => setMsg('Load error: ' + e.message))
    }
    reader.readAsDataURL(file)
  }, [fitImage])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) loadImage(f)
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return
      for (const it of items) {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile(); if (f) { loadImage(f); e.preventDefault(); break }
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadImage])

  // restore canvas to a serialized state, preserving background image
  const restore = (snap: string | null) => {
    const c = fc.current; if (!c) return
    restoring.current = true
    if (snap) c.loadFromJSON(snap).then(() => { c.requestRenderAll(); restoring.current = false })
    else {
      const bg = c.backgroundImage
      c.getObjects().slice().forEach(o => c.remove(o))
      c.backgroundImage = bg; c.requestRenderAll(); restoring.current = false
    }
  }
  const undo = () => {
    if (hist.current.length < 2) return
    redoHist.current.push(hist.current.pop()!)
    restore(hist.current[hist.current.length - 1])
  }
  const redo = () => {
    if (!redoHist.current.length) return
    const n = redoHist.current.pop()!; hist.current.push(n); restore(n)
  }
  const clearAll = () => {
    const c = fc.current; if (!c) return
    const bg = c.backgroundImage
    c.getObjects().slice().forEach(o => c.remove(o))
    c.backgroundImage = bg; c.requestRenderAll()
    hist.current = [JSON.stringify(c.toJSON())]; redoHist.current = []
  }

  // ── selection toolbar: apply prop changes live to active object ──
  const applySel = (patch: Partial<{ stroke: string; fill: string; size: number }>) => {
    const c = fc.current; if (!c) return
    const o = c.getActiveObject(); if (!o) return
    const sp = readSel()
    if (patch.stroke !== undefined && !sp?.isText) o.set('stroke', patch.stroke)
    if (patch.fill !== undefined) sp?.isText ? o.set('fill', patch.fill) : o.set('fill', patch.fill)
    if (patch.size !== undefined) sp?.isText ? o.set('fontSize', patch.size) : o.set('strokeWidth', patch.size)
    o.setCoords(); c.requestRenderAll(); forceSel(x => x + 1)
  }
  const deleteSel = () => {
    const c = fc.current; if (!c) return
    const objs = c.getActiveObjects(); if (!objs.length) return
    objs.forEach(o => c.remove(o))
    c.discardActiveObject(); c.requestRenderAll(); setSel(null)
  }

  // keyboard: Cmd+Z undo, Cmd+Shift+Z redo, Delete/Backspace remove (select tool, not editing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = fc.current; if (!c) return
      const tgt = e.target as HTMLElement
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
      const editing = (c.getActiveObject() as any)?.isEditing
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if (editing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && c.getActiveObject()) {
        e.preventDefault(); deleteSel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadImage(f) }

  const save = async () => {
    const c = fc.current; if (!c) return
    setBusy(true); setMsg('Saving…')
    try {
      const dataUrl = c.toDataURL({ format: 'png', multiplier: 2 })
      const r = await fetch('/api/lab/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) })
      const j = await r.json()
      if (j.ok) setMsg(`✓ Saved — tell Renata "check the lab". (${j.name})`)
      else setMsg('Save failed: ' + j.error)
    } catch (e: any) { setMsg('Save error: ' + e.message) }
    finally { setBusy(false) }
  }

  const Btn = (p: { on?: boolean; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) => (
    <button title={p.title} onClick={p.onClick} disabled={p.disabled} style={btn(!!p.on, p.disabled)}>{p.children}</button>
  )
  const Sep = () => <span style={{ width: 1, alignSelf: 'stretch', background: '#30363d', margin: '2px 4px' }} />

  const sp = readSel()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#e6edf3' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
          padding: '10px 14px', borderBottom: '1px solid #21262d', background: '#161b22' }}>
        <strong style={{ color: '#f0c674', letterSpacing: 1, marginRight: 6 }}>LINGUA LAB</strong>

        <label title="Upload an image file" style={btn(false, false)}>
          ⬆ Upload<input type="file" accept="image/*" onChange={onFile} hidden />
        </label>

        <Sep />
        <Btn title="Fit image to screen" onClick={fitImage}>⛶ Fit</Btn>
        <Btn title="Zoom out" onClick={() => zoomBy(0.8)}>－</Btn>
        <Btn title="Zoom in" onClick={() => zoomBy(1.25)}>＋</Btn>
        <Btn title="Hand: drag to pan" on={tool === 'hand'} onClick={() => setV(toolRef, 'hand', setTool)}>✋ Hand</Btn>
        <Btn title="Select & edit drawings" on={tool === 'select'} onClick={() => setV(toolRef, 'select', setTool)}>▦ Select</Btn>

        <Sep />
        {DRAW_TOOLS.map(t => (
          <Btn key={t.id} title={t.hint} on={tool === t.id} onClick={() => setV(toolRef, t.id, setTool)}>{t.label}</Btn>
        ))}

        <Sep />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Color <input type="color" value={color} onChange={e => setV(colorRef, e.target.value, setColor)} style={colorStyle} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          Size <input type="range" min={1} max={20} value={size} onChange={e => setV(sizeRef, +e.target.value, setSize)} />
        </label>
        <Btn title="Undo (Cmd+Z)" onClick={undo}>↶ Undo</Btn>
        <Btn title="Redo (Cmd+Shift+Z)" onClick={redo}>↷ Redo</Btn>
        <Btn title="Clear all annotations" onClick={clearAll}>✕ Clear</Btn>

        <button onClick={save} disabled={busy || !hasImage}
          style={{ ...btn(false, !hasImage), background: hasImage ? '#2ea043' : '#21262d', color: hasImage ? '#fff' : '#6e7681', cursor: hasImage ? 'pointer' : 'not-allowed' }}>
          {busy ? 'Saving…' : '💾 Save to Renata'}
        </button>
        <span style={{ fontSize: 12, color: '#8b949e', marginLeft: 'auto' }}>{msg}</span>
      </div>

      {/* contextual selection toolbar — only when a drawing is selected */}
      {sel && sp && (
        <div style={{ position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
            display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px',
            background: 'rgba(13,17,23,0.95)', border: '1px solid #f0c674', borderRadius: 8,
            fontSize: 13, color: '#e6edf3' }}>
          <span style={{ color: '#f0c674', fontWeight: 700 }}>{sp.isText ? 'TEXT' : 'SHAPE'}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {sp.isText ? 'Fill' : 'Stroke'}
            <input type="color" value={sp.stroke} onChange={e => applySel({ stroke: e.target.value })} style={colorStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Fill
            <input type="color" value={sp.fill} onChange={e => applySel({ fill: e.target.value })} style={colorStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {sp.isText ? 'Font' : 'Width'}
            <input type="range" min={1} max={sp.isText ? 64 : 20} value={sp.size}
              onChange={e => applySel({ size: +e.target.value })} />
            <span style={{ color: '#8b949e', width: 22 }}>{sp.size}</span>
          </label>
          <button onClick={deleteSel} title="Delete (Del)"
            style={{ ...btn(false, false), background: '#da3633', color: '#fff' }}>🗑 Delete</button>
        </div>
      )}

      <div ref={wrapRef} onDrop={onDrop} onDragOver={e => e.preventDefault()}
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <canvas ref={canvasEl} />
      </div>
    </div>
  )
}

const btn = (on: boolean, disabled?: boolean): React.CSSProperties => ({
  background: on ? '#f0c674' : '#21262d', color: on ? '#0d1117' : disabled ? '#6e7681' : '#e6edf3',
  border: '1px solid #30363d', borderRadius: 6, padding: '6px 10px',
  fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: on ? 700 : 500,
  display: 'inline-flex', alignItems: 'center',
})
const colorStyle: React.CSSProperties = { width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }
