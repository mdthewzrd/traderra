// Shared ticker search + recent-history store.
//
// Single source of truth for the "active ticker" across the personality tab
// host (MR Personality / Gap Stats / Dilution) — and any other view that wants
// to share the same ticker + recent list. Persists the recent list to
// localStorage under `traderra:shared-tickers`.
import { create } from 'zustand'

const LS_KEY = 'traderra:shared-tickers'
const MAX_HISTORY = 24

function loadHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveHistory(h: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(h))
  } catch {
    /* ignore quota / private mode */
  }
}

function pushUnique(h: string[], t: string): string[] {
  return [t, ...h.filter((x) => x !== t)].slice(0, MAX_HISTORY)
}

export type TickerState = {
  /** Current text in the search box (uppercased). */
  input: string
  /** The committed/active ticker (set on Analyze or recent click). Empty = none. */
  ticker: string
  /** Recent tickers, newest first (persisted). */
  history: string[]
  setInput: (v: string) => void
  /** Commit current input (or `raw` if given) as the active ticker. Returns it, or null if blank. */
  search: (raw?: string) => string | null
  /** Select a recent ticker: sets active + input, re-pushes to front. */
  select: (t: string) => void
  clearHistory: () => void
  /** Load the persisted recent list from localStorage (client-only; call once on mount). Idempotent. */
  hydrate: () => void
}

// Guards against clobbering in-session history if hydrate runs more than once.
let _hydrated = false

export const useTickerStore = create<TickerState>((set, get) => ({
  input: '',
  ticker: '',
  history: [],
  setInput: (v) => set({ input: v.toUpperCase() }),
  search: (raw) => {
    const t = (raw != null ? raw : get().input).toUpperCase().trim()
    if (!t) return null
    const history = pushUnique(get().history, t)
    saveHistory(history)
    set({ ticker: t, input: t, history })
    return t
  },
  select: (t) => {
    const u = t.toUpperCase().trim()
    if (!u) return
    const history = pushUnique(get().history, u)
    saveHistory(history)
    set({ ticker: u, input: u, history })
  },
  hydrate: () => {
    if (_hydrated || typeof window === 'undefined') return
    _hydrated = true
    set({ history: loadHistory() })
  },
  clearHistory: () => {
    _hydrated = true
    saveHistory([])
    set({ history: [] })
  },
}))
