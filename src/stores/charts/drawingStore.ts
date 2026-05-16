import { create } from 'zustand'

/**
 * Drawing state — active tool, annotations, drawing defaults.
 * Includes undo/redo history and localStorage persistence per symbol.
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
  hidden?: boolean
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

  // Undo/Redo
  _history: string[]
  _redoStack: string[]
  undo: () => void
  redo: () => void

  // Persistence
  _currentSymbol: string | null
  loadAnnotations: (symbol: string) => void
  saveAnnotations: () => void
}

const ANN_STORAGE_PREFIX = 'traderra-ann-'

function annKey(symbol: string): string {
  return ANN_STORAGE_PREFIX + symbol.toUpperCase()
}

function loadFromStorage(symbol: string): Annotation[] {
  try {
    const s = localStorage.getItem(annKey(symbol))
    if (s) return JSON.parse(s)
  } catch {}
  return []
}

function saveToStorage(symbol: string, annotations: Annotation[]) {
  try {
    localStorage.setItem(annKey(symbol), JSON.stringify(annotations))
  } catch {}
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
  setAnnotations: (a) => {
    const { _currentSymbol } = get()
    const snap = JSON.stringify(get().annotations)
    set((s) => ({ annotations: a, _history: [...s._history.slice(-49), snap], _redoStack: [] }))
    if (_currentSymbol) saveToStorage(_currentSymbol, a)
  },
  addAnnotation: (a) => {
    const { _currentSymbol } = get()
    set((s) => ({
      annotations: [...s.annotations, a],
      _history: [...s._history.slice(-49), JSON.stringify(s.annotations)],
      _redoStack: [],
    }))
    const updated = [...get().annotations, a]
    if (_currentSymbol) saveToStorage(_currentSymbol, updated)
  },
  removeAnnotation: (id) => {
    const { _currentSymbol } = get()
    set((s) => ({
      annotations: s.annotations.filter(a => a.id !== id),
      _history: [...s._history.slice(-49), JSON.stringify(s.annotations)],
      _redoStack: [],
    }))
    if (_currentSymbol) saveToStorage(_currentSymbol, get().annotations)
  },
  updateAnnotation: (id, updates) => {
    const { _currentSymbol } = get()
    set((s) => ({
      annotations: s.annotations.map(a => a.id === id ? { ...a, ...updates } : a),
      _history: [...s._history.slice(-49), JSON.stringify(s.annotations)],
      _redoStack: [],
    }))
    if (_currentSymbol) saveToStorage(_currentSymbol, get().annotations)
  },

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

  // Undo/Redo
  _history: [],
  _redoStack: [],
  undo: () => {
    const { _history, _redoStack, annotations } = get()
    if (!_history.length) return
    const prev = JSON.parse(_history[_history.length - 1])
    set({
      annotations: prev,
      _history: _history.slice(0, -1),
      _redoStack: [..._redoStack, JSON.stringify(annotations)],
    })
    const { _currentSymbol } = get()
    if (_currentSymbol) saveToStorage(_currentSymbol, prev)
  },
  redo: () => {
    const { _history, _redoStack, annotations } = get()
    if (!_redoStack.length) return
    const next = JSON.parse(_redoStack[_redoStack.length - 1])
    set({
      annotations: next,
      _history: [..._history, JSON.stringify(annotations)],
      _redoStack: _redoStack.slice(0, -1),
    })
    const { _currentSymbol } = get()
    if (_currentSymbol) saveToStorage(_currentSymbol, next)
  },

  // Persistence
  _currentSymbol: null,
  loadAnnotations: (symbol) => {
    const loaded = loadFromStorage(symbol)
    set({ annotations: loaded, _currentSymbol: symbol, _history: [], _redoStack: [] })
  },
  saveAnnotations: () => {
    const { _currentSymbol, annotations } = get()
    if (_currentSymbol) saveToStorage(_currentSymbol, annotations)
  },
}))
