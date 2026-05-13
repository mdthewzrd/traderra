import { create } from 'zustand'

/**
 * Drawing state — active tool, annotations, drawing defaults.
 * Self-contained with clear boundaries.
 */

export interface Annotation {
  id: number
  type: string
  points: { x: number; y: number }[]
  color: string
  lineWidth: number
  lineStyle: string
  opacity: number
  text?: string
  locked: boolean
  visible: boolean
  panelIdx: number
  [key: string]: any
}

interface DrawingState {
  // Active tool
  activeTool: string | null
  setActiveTool: (tool: string | null) => void

  // Tool step (multi-step tools like trendline)
  toolStep: number
  setToolStep: (s: number) => void

  // Tool anchor point (first click position)
  toolAnchor: { x: number; y: number } | null
  setToolAnchor: (p: { x: number; y: number } | null) => void

  // Drawing defaults
  drawDefaults: {
    color: string
    lineWidth: number
    dashed: boolean
    opacity: number
  }
  setDrawDefaults: (d: Partial<DrawingState['drawDefaults']>) => void

  // Annotations
  annotations: Annotation[]
  setAnnotations: (a: Annotation[]) => void
  addAnnotation: (a: Annotation) => void
  removeAnnotation: (id: number) => void
  updateAnnotation: (id: number, updates: Partial<Annotation>) => void

  // Selected annotation
  selectedAnn: Annotation | null
  setSelectedAnn: (a: Annotation | null) => void

  // Dragging state
  draggingAnn: Annotation | null
  dragOffset: { dx: number; dy: number }
  setDragging: (a: Annotation | null, offset?: { dx: number; dy: number }) => void

  // Next annotation ID
  nextId: number
  getNextId: () => number

  // Magnet snap
  magnetSnap: boolean
  setMagnetSnap: (v: boolean) => void

  // Stay in drawing mode
  stayDraw: boolean
  setStayDraw: (v: boolean) => void

  // Lock all drawings
  lockAll: boolean
  setLockAll: (v: boolean) => void

  // Hide all drawings
  hideAll: boolean
  setHideAll: (v: boolean) => void
}

export const useDrawingStore = create<DrawingState>((set, get) => ({
  activeTool: null,
  setActiveTool: (tool) => set({ activeTool: tool, toolStep: 0, toolAnchor: null }),

  toolStep: 0,
  setToolStep: (s) => set({ toolStep: s }),

  toolAnchor: null,
  setToolAnchor: (p) => set({ toolAnchor: p }),

  drawDefaults: {
    color: '#dde3f0',
    lineWidth: 2,
    dashed: false,
    opacity: 1,
  },
  setDrawDefaults: (d) => set((s) => ({ drawDefaults: { ...s.drawDefaults, ...d } })),

  annotations: [],
  setAnnotations: (a) => set({ annotations: a }),
  addAnnotation: (a) => set((s) => ({ annotations: [...s.annotations, a] })),
  removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter(a => a.id !== id) })),
  updateAnnotation: (id, updates) => set((s) => ({
    annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates } : a),
  })),

  selectedAnn: null,
  setSelectedAnn: (a) => set({ selectedAnn: a }),

  draggingAnn: null,
  dragOffset: { dx: 0, dy: 0 },
  setDragging: (a, offset) => set({ draggingAnn: a, dragOffset: offset || { dx: 0, dy: 0 } }),

  nextId: 1,
  getNextId: () => {
    const id = get().nextId
    set({ nextId: id + 1 })
    return id
  },

  magnetSnap: false,
  setMagnetSnap: (v) => set({ magnetSnap: v }),

  stayDraw: false,
  setStayDraw: (v) => set({ stayDraw: v }),

  lockAll: false,
  setLockAll: (v) => set({ lockAll: v }),

  hideAll: false,
  setHideAll: (v) => set({ hideAll: v }),
}))
