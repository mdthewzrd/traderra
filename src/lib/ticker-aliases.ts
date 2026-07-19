/**
 * Ticker alias map — for delisted/renamed tickers where Polygon still has the
 * historical data under the OLD symbol but no longer returns it via the
 * /v3/reference/tickers detail endpoint, OR where Polygon has purged the old
 * data entirely and only the new ticker has anything to serve.
 *
 * Polygon does NOT expose old→new mappings (no `aliases` field, search-by-old
 * returns nothing). So this map is manual and user-extensible. Add to it as
 * renamed tickers surface.
 *
 * The chart's candle + splits fetches will try the alias as a fallback when
 * the original symbol returns no data, and merge splits from both symbols
 * when both have them.
 */
export const TICKER_ALIASES: Record<string, string> = {
  // User-confirmed renames in their trade history:
  FFIE: 'FFAI', // Faraday Future — renamed 2025
  // Common well-known renames (no-op if not in user's history):
  FB: 'META', // Meta Platforms (formerly Facebook)
}

/** Resolve a possibly-renamed ticker to its current symbol. */
export function resolveAlias(symbol: string): string | null {
  if (!symbol) return null
  return TICKER_ALIASES[symbol.toUpperCase()] || null
}

/**
 * Return every symbol worth trying for a chart lookup: the original first,
 * then any known alias. Used by the chart fetcher to walk possibilities.
 */
export function candidatesFor(symbol: string): string[] {
  const out = [symbol]
  const alias = resolveAlias(symbol)
  if (alias) out.push(alias)
  return out
}
