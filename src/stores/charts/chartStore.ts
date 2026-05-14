import { create } from 'zustand'

/**
 * Chart state — panels, symbol, bars, crosshair, canvas rendering.
 * The core store — largest and most complex.
 */

export interface Panel {
  tf: string
  bars: any[]
  tools: any[]
  inds: Record<string, boolean>
  canvas?: HTMLCanvasElement | null
  cwrap?: HTMLDivElement | null
  [key: string]: any
}

interface ChartState {
  // Current symbol
  symbol: string
  setSymbol: (s: string) => void

  // Panels (4 by default: 5min, 15min, 60min, Daily)
  panels: Panel[]
  setPanels: (p: Panel[]) => void
  updatePanel: (idx: number, updates: Partial<Panel>) => void
  setPanelTf: (idx: number, tf: string) => void

  // Active tool ID counter
  toolId: number
  getNextToolId: () => number

  // Global crosshair
  globalCrossTime: number
  globalCrossPrice: number
  setCrosshair: (time: number, price: number) => void

  // Bar cache
  barCache: Map<string, { bars: any[]; ts: number }>
  setBarCache: (key: string, bars: any[]) => void
  getBarCache: (key: string) => any[] | null
}

const BAR_CACHE_TTL = 120000

export const useChartStore = create<ChartState>((set, get) => ({
  symbol: 'AAPL',
  setSymbol: (s) => set({ symbol: s.toUpperCase() }),

  panels: [
    { tf: '5', bars: [], tools: [], inds: {} },
    { tf: '15', bars: [], tools: [], inds: {} },
    { tf: '60', bars: [], tools: [], inds: {} },
    { tf: 'D', bars: [], tools: [], inds: {} },
  ],
  setPanels: (p) => set({ panels: p }),
  updatePanel: (idx, updates) => set((s) => ({
    panels: s.panels.map((p, i) => i === idx ? { ...p, ...updates } : p),
  })),
  setPanelTf: (idx: number, tf: string) => set((s) => ({
    panels: s.panels.map((p, i) => i === idx ? { ...p, tf } : p),
  })),

  toolId: Date.now(),
  getNextToolId: () => {
    const id = get().toolId
    set({ toolId: id + 1 })
    return id + 1
  },

  globalCrossTime: -1,
  globalCrossPrice: -1,
  setCrosshair: (time, price) => set({ globalCrossTime: time, globalCrossPrice: price }),

  barCache: new Map(),
  setBarCache: (key, bars) => {
    const cache = new Map(get().barCache)
    cache.set(key, { bars, ts: Date.now() })
    set({ barCache: cache })
  },
  getBarCache: (key) => {
    const entry = get().barCache.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > BAR_CACHE_TTL) return null
    return entry.bars
  },
}))
