import { create } from 'zustand'

/**
 * Watchlist store — manages multiple watchlists with symbol lists.
 * Extracted from inline JS (lines 11913-12000).
 * Persisted to localStorage.
 */

const WL_STORAGE_KEY = 'traderra-watchlists'
const WL_COL_KEY = 'traderra-wl-cols'

export interface WatchList {
  name: string
  syms: string[]
}

interface WatchlistState {
  lists: WatchList[]
  activeIdx: number
  visibleCols: string[]

  // Getters
  activeList: () => WatchList
  getSymbols: () => string[]

  // Actions
  load: () => void
  save: () => void
  addSymbol: (sym: string) => void
  removeSymbol: (sym: string) => void
  switchList: (idx: number) => void
  createList: (name: string) => void
  deleteList: () => boolean
  renameList: (name: string) => void
  setActiveIdx: (idx: number) => void
  setColumns: (cols: string[]) => void
}

const DEFAULT_LISTS: WatchList[] = [
  { name: 'Default', syms: ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','SPY','QQQ','AMD','NFLX','DIS'] },
  { name: 'Tech', syms: ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','NFLX','CRM','ORCL','ADBE'] },
  { name: 'Swing', syms: ['TSLA','AMD','BABA','PLTR','COIN','SOFI','RIVN','MARA','LCID','NIO'] },
]

const DEFAULT_COLS = ['sym','last','chg','chgPct','vol']

function loadFromStorage(): { lists: WatchList[]; active: number } {
  try {
    const s = localStorage.getItem(WL_STORAGE_KEY)
    if (s) {
      const d = JSON.parse(s)
      if (d?.lists?.length) return d
    }
  } catch {}
  return { lists: JSON.parse(JSON.stringify(DEFAULT_LISTS)), active: 0 }
}

function loadCols(): string[] {
  try {
    const s = localStorage.getItem(WL_COL_KEY)
    if (s) {
      const p = JSON.parse(s)
      if (Array.isArray(p) && p.length) return p
    }
  } catch {}
  return DEFAULT_COLS.slice()
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  lists: JSON.parse(JSON.stringify(DEFAULT_LISTS)),
  activeIdx: 0,
  visibleCols: DEFAULT_COLS.slice(),

  activeList: () => {
    const { lists, activeIdx } = get()
    return lists[activeIdx] || lists[0]
  },

  getSymbols: () => get().activeList().syms,

  load: () => {
    const { lists, active } = loadFromStorage()
    const cols = loadCols()
    set({ lists, activeIdx: active, visibleCols: cols })
  },

  save: () => {
    const { lists, activeIdx, visibleCols } = get()
    localStorage.setItem(WL_STORAGE_KEY, JSON.stringify({ lists, active: activeIdx }))
    localStorage.setItem(WL_COL_KEY, JSON.stringify(visibleCols))
  },

  addSymbol: (sym) => {
    const s = sym.trim().toUpperCase()
    if (!s) return
    set((state) => {
      const lists = state.lists.map((l, i) => {
        if (i !== state.activeIdx) return l
        if (l.syms.includes(s)) return l
        return { ...l, syms: [...l.syms, s] }
      })
      return { lists }
    })
    get().save()
  },

  removeSymbol: (sym) => {
    set((state) => {
      const lists = state.lists.map((l, i) => {
        if (i !== state.activeIdx) return l
        return { ...l, syms: l.syms.filter(s => s !== sym) }
      })
      return { lists }
    })
    get().save()
  },

  switchList: (idx) => {
    set({ activeIdx: idx })
    get().save()
  },

  createList: (name) => {
    set((state) => ({
      lists: [...state.lists, { name, syms: [] }],
      activeIdx: state.lists.length,
    }))
    get().save()
  },

  deleteList: () => {
    const { lists, activeIdx } = get()
    if (lists.length <= 1) return false
    const newLists = lists.filter((_, i) => i !== activeIdx)
    const newIdx = Math.min(activeIdx, newLists.length - 1)
    set({ lists: newLists, activeIdx: newIdx })
    get().save()
    return true
  },

  renameList: (name) => {
    set((state) => ({
      lists: state.lists.map((l, i) => i === state.activeIdx ? { ...l, name } : l),
    }))
    get().save()
  },

  setActiveIdx: (idx) => set({ activeIdx: idx }),
  setColumns: (cols) => {
    set({ visibleCols: cols })
    get().save()
  },
}))
