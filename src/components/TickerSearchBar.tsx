'use client'

import { useEffect } from 'react'
import { useTickerStore } from '@/stores/tickerStore'

/**
 * Shared ticker search bar + inline recent list.
 *
 * Reads/writes the global `useTickerStore`, so every tab/host that renders it
 * shares the same active ticker and recent history. The active tab panel is
 * expected to subscribe to `ticker` and run its own fetch in an effect when it
 * changes — this component only owns input + commit.
 *
 * Styling matches the existing personality/gap-stats search bar (gold CTA on
 * the dark panel palette) so it drops in without a visual seam.
 */
export function TickerSearchBar() {
  const input = useTickerStore((s) => s.input)
  const ticker = useTickerStore((s) => s.ticker)
  const history = useTickerStore((s) => s.history)
  const setInput = useTickerStore((s) => s.setInput)
  const search = useTickerStore((s) => s.search)
  const select = useTickerStore((s) => s.select)
  const hydrate = useTickerStore((s) => s.hydrate)

  // Load persisted recent list once, client-side (avoids SSR hydration mismatch).
  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="TICKER"
          className="bg-[#141c2b] text-[#e0e0e0] border border-[#1f2937] rounded-lg px-4 py-2 text-lg uppercase w-48 focus:outline-none focus:border-[#D4AF37]/50"
        />
        <button
          type="submit"
          className="bg-[#D4AF37] text-[#0a0a0a] font-bold rounded-lg px-5 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          Analyze
        </button>
      </form>

      {history.length > 0 && (
        <div className="flex items-center gap-1 ml-1 overflow-x-auto">
          <span className="text-xs text-[#666] mr-1 shrink-0">Recent</span>
          {history.slice(0, 12).map((t) => (
            <button
              key={t}
              onClick={() => select(t)}
              className={`px-2.5 py-1.5 rounded-lg text-sm transition-colors shrink-0 border ${
                t === ticker
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30'
                  : 'text-[#9ca3af] hover:bg-[#141c2b] hover:text-[#e0e0e0] border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
