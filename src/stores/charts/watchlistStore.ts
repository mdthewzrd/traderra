import { create } from 'zustand'

/**
 * Watchlist store — multiple named watchlists, server-persisted.
 *
 * Backend: ChartWatchlist Prisma model via /api/chart-data/watchlists.
 * localStorage is an offline cache + pre-auth bootstrap so the UI never
 * flashes empty. On load we hydrate from localStorage first (instant),
 * then sync from the server.
 *
 * Quotes (last/chg/vol) are NOT stored here — they're fetched on demand by
 * the Sidebar via /api/watchlist-quotes (focus/click only).
 */

const WL_STORAGE_KEY = 'traderra-watchlists'

export interface WatchList {
  id: string | null       // server id; null = local-only fallback
  name: string
  syms: string[]
  meta: Record<string, { note?: string }>
}

interface WatchlistState {
  lists: WatchList[]
  activeIdx: number
  loaded: boolean

  // Getters
  activeList: () => WatchList
  getSymbols: () => string[]

  // Lifecycle
  load: () => Promise<void>
  syncFromServer: () => Promise<void>

  // Actions (all persist: server + localStorage)
  addSymbol: (sym: string) => void
  removeSymbol: (sym: string) => void
  reorderSymbols: (syms: string[]) => void
  switchList: (idx: number) => void
  createList: (name: string) => Promise<void>
  deleteList: () => Promise<boolean>
  renameList: (name: string) => void
  setNote: (sym: string, note: string) => void

  setActiveIdx: (idx: number) => void
}

const DEFAULT_LISTS: WatchList[] = [
  { id: null, name: 'Default', meta: {}, syms: ['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','SPY','QQQ','AMD','NFLX','DIS'] },
  { id: null, name: 'Tech', meta: {}, syms: ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','NFLX','CRM','ORCL','ADBE'] },
  { id: null, name: 'Swing', meta: {}, syms: ['TSLA','AMD','BABA','PLTR','COIN','SOFI','RIVN','MARA','LCID','NIO'] },
]

// ---- localStorage cache -------------------------------------------------

function cacheToStorage(lists: WatchList[], active: number) {
  try {
    localStorage.setItem(WL_STORAGE_KEY, JSON.stringify({ lists, active }))
  } catch {}
}

function loadFromCache(): { lists: WatchList[]; active: number } {
  try {
    const s = localStorage.getItem(WL_STORAGE_KEY)
    if (s) {
      const d = JSON.parse(s)
      if (d?.lists?.length) {
        const lists = d.lists.map((l: any) => ({
          id: l.id ?? null,
          name: String(l.name || 'List'),
          syms: Array.isArray(l.syms) ? l.syms.map((x: any) => String(x).toUpperCase()) : [],
          meta: l.meta && typeof l.meta === 'object' ? l.meta : {},
        }))
        return { lists, active: typeof d.active === 'number' ? d.active : 0 }
      }
    }
  } catch {}
  return { lists: clone(DEFAULT_LISTS), active: 0 }
}

function clone(l: WatchList[]): WatchList[] { return JSON.parse(JSON.stringify(l)) }

// ---- store --------------------------------------------------------------

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  lists: clone(DEFAULT_LISTS),
  activeIdx: 0,
  loaded: false,

  activeList: () => {
    const { lists, activeIdx } = get()
    return lists[activeIdx] || lists[0]
  },

  getSymbols: () => get().activeList().syms,

  load: async () => {
    // 1) instant hydrate from cache
    const cached = loadFromCache()
    set({ lists: cached.lists, activeIdx: cached.active })
    // 2) sync from server (best-effort)
    await get().syncFromServer()
    set({ loaded: true })
  },

  syncFromServer: async () => {
    try {
      const r = await fetch('/api/chart-data/watchlists')
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d.lists) && d.lists.length) {
        const lists: WatchList[] = d.lists.map((l: any) => ({
          id: l.id,
          name: l.name,
          syms: Array.isArray(l.symbols) ? l.symbols.map((s: any) => String(s).toUpperCase()) : [],
          meta: l.meta && typeof l.meta === 'object' ? l.meta : {},
        }))
        set({ lists })
        cacheToStorage(lists, get().activeIdx)
      }
    } catch {}
  },

  addSymbol: (sym) => {
    const u = sym.toUpperCase().trim()
    if (!u) return
    set((state) => {
      const lists = state.lists.map((l, i) =>
        i !== state.activeIdx || l.syms.includes(u) ? l : { ...l, syms: [...l.syms, u] })
      return { lists }
    })
    persistActive(get, set)
  },

  removeSymbol: (sym) => {
    set((state) => {
      const lists = state.lists.map((l, i) =>
        i !== state.activeIdx ? l : { ...l, syms: l.syms.filter(s => s !== sym) })
      return { lists }
    })
    persistActive(get, set)
  },

  reorderSymbols: (syms) => {
    set((state) => {
      const lists = state.lists.map((l, i) => i !== state.activeIdx ? l : { ...l, syms })
      return { lists }
    })
    persistActive(get, set)
  },

  switchList: (idx) => {
    const { lists } = get()
    if (idx < 0 || idx >= lists.length) return
    set({ activeIdx: idx })
    cacheToStorage(get().lists, idx)
  },

  createList: async (name) => {
    const n = name.trim() || 'New List'
    // optimistic insert (local-only until server confirms)
    const temp: WatchList = { id: null, name: n, syms: [], meta: {} }
    set((state) => ({ lists: [...state.lists, temp], activeIdx: state.lists.length }))
    cacheToStorage(get().lists, get().activeIdx)
    try {
      const r = await fetch('/api/chart-data/watchlists', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      })
      if (r.ok) {
        const d = await r.json()
        if (d.list?.id) {
          set((state) => ({
            lists: state.lists.map(l => l === temp ? { ...l, id: d.list.id } : l),
          }))
          cacheToStorage(get().lists, get().activeIdx)
        }
      }
    } catch {}
  },

  deleteList: async () => {
    const { lists, activeIdx } = get()
    if (lists.length <= 1) return false
    const target = lists[activeIdx]
    const newLists = lists.filter((_, i) => i !== activeIdx)
    const newIdx = Math.min(activeIdx, newLists.length - 1)
    set({ lists: newLists, activeIdx: newIdx })
    cacheToStorage(newLists, newIdx)
    if (target?.id) {
      try {
        await fetch(`/api/chart-data/watchlists/${target.id}`, { method: 'DELETE' })
      } catch {}
    }
    return true
  },

  renameList: (name) => {
    const n = name.trim()
    if (!n) return
    set((state) => ({
      lists: state.lists.map((l, i) => i !== state.activeIdx ? l : { ...l, name: n }),
    }))
    persistActive(get, set)
  },

  setNote: (sym, note) => {
    const u = sym.toUpperCase().trim()
    set((state) => {
      const lists = state.lists.map((l, i) => {
        if (i !== state.activeIdx) return l
        const meta = { ...l.meta }
        if (note.trim()) meta[u] = { note: note.trim() }
        else delete meta[u]
        return { ...l, meta }
      })
      return { lists }
    })
    persistActive(get, set)
  },

  setActiveIdx: (idx) => set({ activeIdx: idx }),
}))

// ---- persistence helper -------------------------------------------------

function persistActive(
  get: () => WatchlistState,
  set: (partial: Partial<WatchlistState>) => void,
) {
  const { lists, activeIdx } = get()
  const active = lists[activeIdx]
  cacheToStorage(lists, activeIdx)
  if (active?.id) {
    fetch(`/api/chart-data/watchlists/${active.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: active.name, symbols: active.syms, meta: active.meta }),
    }).catch(() => {})
  }
}
