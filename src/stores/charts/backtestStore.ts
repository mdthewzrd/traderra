import { create } from 'zustand'

/**
 * Backtest state — trade history, markers, stats.
 */

interface BTTrade {
  id?: string
  symbol: string
  side: string
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  date: string
  exitDate?: string
  duration: string
  strategy: string
  reason?: string
  [key: string]: any
}

interface BacktestState {
  btTrades: BTTrade[]
  setBtTrades: (t: BTTrade[]) => void

  btActive: boolean
  setBtActive: (v: boolean) => void

  btSelected: string | null
  setBtSelected: (id: string | null) => void

  btMarkers: any[]
  setBtMarkers: (m: any[]) => void
}

export const useBacktestStore = create<BacktestState>((set) => ({
  btTrades: [],
  setBtTrades: (t) => set({ btTrades: t }),

  btActive: false,
  setBtActive: (v) => set({ btActive: v }),

  btSelected: null,
  setBtSelected: (id) => set({ btSelected: id }),

  btMarkers: [],
  setBtMarkers: (m) => set({ btMarkers: m }),
}))
