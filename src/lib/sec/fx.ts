/**
 * Foreign-currency → USD FX conversion for Foreign Private Issuer financials.
 *
 * FPIs (20-F filers: Israeli, Canadian, European, Chinese listings) report
 * under IFRS in a native currency (ILS, CAD, EUR, GBP, CNY…). Their XBRL facts
 * arrive tagged with that unit. To make runway, burn, equity and the cross-
 * company scan comparable, we convert each fact to USD at its own period-end
 * rate.
 *
 * NOTE on runway: cash ÷ monthly-burn is currency-neutral when both are in the
 * same unit, so even WITHOUT conversion the headline runway is correct.
 * Conversion serves the USD display headline and the scan's absolute-cash sort.
 *
 * Rate source: Frankfurter.app — free, no key, ECB-backed reference rates.
 *   GET https://api.frankfurter.app/{YYYY-MM-DD}?from={CUR}&to=USD
 *   → { "base":"ILS", "date":"…", "rates":{"USD":0.2764…} }
 * Rates are daily (business days; weekends/holidays roll back to the last
 * available). Caches per (currency,date) in-process — syncFinancials re-uses
 * the same rate for repeat periods within a run.
 */

const cache = new Map<string, number>(); // `${cur}|${date}` → rate vs USD

/** Convert `amount` (in `currency`) to USD using the FX rate for `date`.
 *  USD passes through unchanged. Returns null on fetch failure (caller skips
 *  the entry — an honest gap, never a crash). */
export async function fxToUsd(
  amount: number,
  currency: string | null | undefined,
  date: string | null | undefined,
): Promise<number | null> {
  if (!currency || currency === 'USD') return amount;
  if (typeof amount !== 'number' || !isFinite(amount)) return null;
  const d = (date ?? new Date().toISOString().slice(0, 10));
  const key = `${currency}|${d}`;
  let rate = cache.get(key);
  if (rate === undefined) {
    try {
      const res = await fetch(
        `https://api.frankfurter.app/${d}?from=${encodeURIComponent(currency)}&to=USD`,
        { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } },
      );
      if (!res.ok) { cache.set(key, NaN); return null; }
      const j = (await res.json()) as { rates?: { USD?: number } };
      rate = j.rates?.USD ?? NaN;
      cache.set(key, rate);
    } catch {
      cache.set(key, NaN);
      return null;
    }
  }
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;
  return amount * rate;
}

/** Reporting currency for display/flagging. True iff a non-USD unit was used. */
export function isForeign(currency: string | null | undefined): boolean {
  return !!currency && currency !== 'USD';
}
