import { create } from 'zustand'
import { C, LIGHT_THEME_OVERRIDES } from '@/lib/charts/theme'

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

  // PDC (Prior Day Close) line
  showPDC: boolean
  setShowPDC: (v: boolean) => void

  // Target line (vertical dashed)
  showTarget: boolean
  targetDate: string
  setShowTarget: (v: boolean) => void
  setTargetDate: (v: string) => void

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

  // Agent chat panel (sits in watchlist area, independent of tabs)
  agentChatOpen: boolean
  setAgentChatOpen: (v: boolean) => void

  // Chart style
  chartStyle: string
  setChartStyle: (v: string) => void

  // Active layout
  activeLayout: number
  setActiveLayout: (v: number) => void

  // Custom indicator buttons in TopBar
  indBtns: string[]  // indKey list
  addIndBtn: (indKey: string) => void
  removeIndBtn: (indKey: string) => void
  _hydrateIndBtns: () => void

  // Active template name (for update button)
  activeTemplateName: string | null
  setActiveTemplateName: (v: string | null) => void

  // Input settings
  zoomSens: number
  trackPanSens: number
  mousePanSens: number
  rightPad: number
  setZoomSens: (v: number) => void
  setTrackPanSens: (v: number) => void
  setMousePanSens: (v: number) => void
  setRightPad: (v: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: (typeof window !== 'undefined' && localStorage.getItem('traderra-theme') === 'light') ? 'light' as const : 'dark' as const,
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('traderra-theme', next)
    if (next === 'light') {
      document.body.classList.add('light')
    } else {
      document.body.classList.remove('light')
    }
    // Apply bg/axis/grid/cross overrides — up/dn come from user's saved cfg
    const overrides: Record<string, string> = next === 'light'
      ? { bg: '#e8e4d9', axisbg: '#ddd9cc', grid: '#d0cdc2', axisLabel: '#4a5580', axisMuted: '#6a7a9a', axisHighlight: '#3a4a6a', crossLabelBg: '#d8d4c8', crossLabelBd: '#b0a898' }
      : { bg: '#0c0e14', axisbg: '#0d0f18', grid: '#141926', axisLabel: '#6878a8', axisMuted: '#4a5580', axisHighlight: '#8090b0', crossLabelBg: '#141a2a', crossLabelBd: '#2a3050' }
    Object.entries(overrides).forEach(([k, v]) => { (C as any)[k] = v })
    return { theme: next }
  }),

  fullscreenPanel: null,
  setFullscreenPanel: (idx) => set({ fullscreenPanel: idx }),

  liveMode: true,
  setLiveMode: (v) => set({ liveMode: v }),

  showPriceLine: true,
  setShowPriceLine: (v) => set({ showPriceLine: v }),

  showPDC: true,
  setShowPDC: (v) => set({ showPDC: v }),

  showTarget: false,
  targetDate: '',
  setShowTarget: (v) => set({ showTarget: v }),
  setTargetDate: (v) => set({ targetDate: v }),

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

  agentChatOpen: false,
  setAgentChatOpen: (v) => set({ agentChatOpen: v }),

  chartStyle: 'candles',
  setChartStyle: (v) => set({ chartStyle: v }),

  activeLayout: 1,
  setActiveLayout: (v) => set({ activeLayout: v }),

  indBtns: [] as string[],
  _hydrateIndBtns: () => {
    try {
      const stored = JSON.parse(localStorage.getItem('traderra-ind-btns') || '[]')
      if (Array.isArray(stored) && stored.length) set({ indBtns: stored })
    } catch {}
  },
  addIndBtn: (indKey) => set((s) => {
    const next = [...s.indBtns, indKey]
    localStorage.setItem('traderra-ind-btns', JSON.stringify(next))
    return { indBtns: next }
  }),
  removeIndBtn: (indKey) => set((s) => {
    const next = s.indBtns.filter(k => k !== indKey)
    localStorage.setItem('traderra-ind-btns', JSON.stringify(next))
    return { indBtns: next }
  }),

  activeTemplateName: null,
  setActiveTemplateName: (v) => set({ activeTemplateName: v }),

  zoomSens: 0.15,
  trackPanSens: 0.5,
  mousePanSens: 1.0,
  rightPad: 6,
  setZoomSens: (v) => set({ zoomSens: v }),
  setTrackPanSens: (v) => set({ trackPanSens: v }),
  setMousePanSens: (v) => set({ mousePanSens: v }),
  setRightPad: (v) => set({ rightPad: v }),
}))
