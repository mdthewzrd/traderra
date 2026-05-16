import { create } from 'zustand'
import { useToolStore } from './toolStore'

/**
 * Indicator store — reads derived inds from toolStore.
 * ReactChartPanel uses this to know which indicators to render.
 */

export interface IndicatorState {
  /** Derived from active tools */
  inds: Record<string, boolean>
  toggle: (key: string) => void
  isOn: (key: string) => boolean
  setInds: (inds: Record<string, boolean>) => void
}

export const useIndicatorStore = create<IndicatorState>((set, get) => ({
  inds: {},  // populated by toolStore derivation
  toggle: (key) => {
    // Find the tool that owns this indicator and toggle it
    const tools = useToolStore.getState().tools
    const tool = tools.find(t => t.legacyKeys?.includes(key))
    if (tool) {
      useToolStore.getState().toggleTool(tool.id)
    } else {
      // Legacy toggle for vol etc
      set(s => ({ inds: { ...s.inds, [key]: !s.inds[key] } }))
    }
  },
  isOn: (key) => !!get().inds[key],
  setInds: (inds) => set({ inds }),
}))

// Subscribe to toolStore changes and derive inds
useToolStore.subscribe((state) => {
  useIndicatorStore.setState({ inds: state.inds })
})
// Initial sync
useIndicatorStore.setState({ inds: useToolStore.getState().inds })
