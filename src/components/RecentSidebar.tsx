'use client'

import { useTickerStore } from '@/stores/tickerStore'

/**
 * Shared vertical "Recent tickers" sidebar.
 *
 * Reads/writes the global `useTickerStore`, so it stays in sync with the search
 * bar and every tab panel. Clicking a ticker selects it (sets active + input,
 * re-pushes to front) — the active panel re-fetches via its `[ticker]` effect.
 */
export function RecentSidebar() {
  const history = useTickerStore((s) => s.history)
  const ticker = useTickerStore((s) => s.ticker)
  const select = useTickerStore((s) => s.select)

  return (
    <aside className="w-44 shrink-0 py-6">
      <div className="text-xs text-[#666] uppercase tracking-wide mb-2 px-1">Recent</div>
      <div className="flex flex-col gap-0.5">
        {history.length === 0 && (
          <div className="text-xs text-[#444] px-2.5 py-1">No history yet</div>
        )}
        {history.map((t) => (
          <button
            key={t}
            onClick={() => select(t)}
            className={`text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors border ${
              t === ticker
                ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30'
                : 'text-[#9ca3af] hover:bg-[#141c2b] hover:text-[#e0e0e0] border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </aside>
  )
}
