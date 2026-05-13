import { create } from 'zustand'

/**
 * UI state — theme, fullscreen, visibility toggles.
 * Simplest store, fewest dependencies.
 */
interface UIState {
  // Theme
  theme: 'dark' | 'light'
  toggleTheme: () => void

  // Fullscreen panel
  fullscreenPanel: number | null
  setFullscreenPanel: (idx: number | null) => void

  // Live mode
  liveMode: boolean
  setLiveMode: (v: boolean) => void

  // Price line
  showPriceLine: boolean
  setShowPriceLine: (v: boolean) => void

  // Bars visible (indicator rows)
  barsVisible: boolean
  setBarsVisible: (v: boolean) => void

  // Adjusted prices
  useAdjusted: boolean
  setUseAdjusted: (v: boolean) => void

  // Clean prints (filter suspicious bars)
  cleanPrints: boolean
  setCleanPrints: (v: boolean) => void

  // BT strategy mode
  btStrategyMode: 'long' | 'short'
  setBtStrategyMode: (v: 'long' | 'short') => void

  // BT highlight dates
  btHighlightDates: boolean
  setBtHighlightDates: (v: boolean) => void

  // Sidebar
  sidebarOpen: boolean
  sidebarTab: string
  setSidebarOpen: (v: boolean) => void
  setSidebarTab: (v: string) => void

  // Chart style
  chartStyle: string
  setChartStyle: (v: string) => void

  // Active layout
  activeLayout: number
  setActiveLayout: (v: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  fullscreenPanel: null,
  setFullscreenPanel: (idx) => set({ fullscreenPanel: idx }),

  liveMode: true,
  setLiveMode: (v) => set({ liveMode: v }),

  showPriceLine: true,
  setShowPriceLine: (v) => set({ showPriceLine: v }),

  barsVisible: true,
  setBarsVisible: (v) => set({ barsVisible: v }),

  useAdjusted: true,
  setUseAdjusted: (v) => set({ useAdjusted: v }),

  cleanPrints: true,
  setCleanPrints: (v) => set({ cleanPrints: v }),

  btStrategyMode: 'short',
  setBtStrategyMode: (v) => set({ btStrategyMode: v }),

  btHighlightDates: true,
  setBtHighlightDates: (v) => set({ btHighlightDates: v }),

  sidebarOpen: true,
  sidebarTab: 'vault',
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSidebarTab: (v) => set({ sidebarTab: v, sidebarOpen: true }),

  chartStyle: 'candles',
  setChartStyle: (v) => set({ chartStyle: v }),

  activeLayout: 1,
  setActiveLayout: (v) => set({ activeLayout: v }),
}))
