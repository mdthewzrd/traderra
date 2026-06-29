'use client';

/**
 * Dilution Scan — sortable short-bias screen across ALL synced SEC filers.
 * Route: /dilution/scan
 * Data: /api/dilution/scan (batched DB, no per-ticker SEC calls).
 *
 * Surfaces the raw screening signals a short-bias trader ranks by:
 * runway months (low/negative = desperate → will dilute), warrant overhang %
 * (selling pressure), shelf remaining $ (loaded dilution capacity), going
 * concern. Click a row → /dilution?ticker=X for the full DD terminal.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, AlertTriangle, Loader2, ArrowUpDown, Flame } from 'lucide-react';

type ScanRow = {
  cik: string;
  ticker: string;
  name: string;
  exchange: string | null;
  sicCode: string | null;
  cash: number | null;
  monthlyCashFlow: number | null;
  runwayMonths: number | null;
  overhangShares: number | null;
  overhangPct: number | null;
  overhangSuspect: boolean;
  shelfRemaining: number | null;
  goingConcern: boolean;
  lastSynced: string | null;
};

type SortKey = 'ticker' | 'runwayMonths' | 'monthlyCashFlow' | 'overhangPct' | 'shelfRemaining' | 'cash';

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtMoney(n: number | null): string {
  if (n === null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(0);
}

export default function ScanPage() {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('runwayMonths');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [gcOnly, setGcOnly] = useState(false);

  useEffect(() => {
    fetch('/api/dilution/scan')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('scan fetch failed'))))
      .then((d: { rows: ScanRow[] }) => setRows(d.rows))
      .catch((e: Error) => setError(e.message));
  }, []);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const filtered = rows.filter((r) => {
      if (gcOnly && !r.goingConcern) return false;
      if (!q.trim()) return true;
      const s = q.trim().toLowerCase();
      return r.ticker.toLowerCase().includes(s) || r.name.toLowerCase().includes(s);
    });
    // nulls always sort last regardless of direction (so unknown doesn't
    // dominate the top of a 'most toxic' sort).
    const val = (r: ScanRow): number | string => {
      switch (sortKey) {
        case 'ticker': return r.ticker.toLowerCase();
        case 'runwayMonths': return r.runwayMonths ?? Number.POSITIVE_INFINITY;
        case 'monthlyCashFlow': return r.monthlyCashFlow ?? Number.NEGATIVE_INFINITY;
        case 'overhangPct': return r.overhangSuspect ? Number.NEGATIVE_INFINITY : (r.overhangPct ?? Number.NEGATIVE_INFINITY);
        case 'shelfRemaining': return r.shelfRemaining ?? Number.NEGATIVE_INFINITY;
        case 'cash': return r.cash ?? Number.NEGATIVE_INFINITY;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      let cmp: number;
      if (typeof va === 'string' || typeof vb === 'string') cmp = String(va).localeCompare(String(vb));
      else cmp = (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, q, sortKey, sortDir, gcOnly]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'ticker' ? 'asc' : 'asc'); }
  };

  const Th = ({ k, label, hint }: { k: SortKey; label: string; hint?: string }) => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right font-semibold uppercase tracking-wide transition hover:text-zinc-100 ${sortKey === k ? 'text-amber-300' : 'text-zinc-400'}`}
      onClick={() => toggleSort(k)}
      title={hint}
    >
      <span className="inline-flex items-center gap-1">{label}<ArrowUpDown size={11} className="opacity-50" /></span>
    </th>
  );

  const runwayColor = (m: number | null): string => {
    if (m === null) return 'text-zinc-600';
    if (m < 0) return 'text-red-400 font-bold';
    if (m < 6) return 'text-red-400';
    if (m < 12) return 'text-amber-400';
    if (m < 24) return 'text-zinc-300';
    return 'text-emerald-400';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Flame size={22} className="text-red-400" /> Dilution Scan
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Short-bias screen across synced SEC filers. Sort by runway / overhang / shelf to spot the most dilution-toxic names. Click a row for full DD.
            </p>
          </div>
          <a href="/dilution" className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">← Single ticker</a>
        </div>

        {/* Controls */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ticker or name…"
              className="w-56 rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
            <input type="checkbox" checked={gcOnly} onChange={(e) => setGcOnly(e.target.checked)} className="accent-red-500" />
            <AlertTriangle size={12} className="text-red-400" /> Going concern only
          </label>
          <span className="text-xs text-zinc-600">
            {rows ? `${sorted.length} of ${rows.length} companies` : 'loading…'}
          </span>
        </div>

        {/* Table */}
        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
        ) : rows === null ? (
          <div className="flex items-center gap-2 p-8 text-sm text-zinc-500"><Loader2 size={16} className="animate-spin" /> Loading scan…</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-zinc-900/80 text-[11px]">
                <tr className="border-b border-zinc-800">
                  <th className="cursor-pointer select-none px-3 py-2 text-left font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-100" onClick={() => toggleSort('ticker')}>
                    <span className="inline-flex items-center gap-1">Ticker<ArrowUpDown size={11} className="opacity-50" /></span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-zinc-400">Name</th>
                  <Th k="cash" label="Cash" hint="Last reported cash & equivalents (USD)" />
                  <Th k="monthlyCashFlow" label="Burn/mo" hint="TTM monthly cash flow (neg = burning)" />
                  <Th k="runwayMonths" label="Runway" hint="Projected cash / |burn| — can be NEGATIVE if already past last report" />
                  <Th k="overhangPct" label="Overhang %" hint="Warrant + convertible shares / shares outstanding" />
                  <Th k="shelfRemaining" label="Shelf $" hint="Registered capacity − raised (last 3y)" />
                  <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-zinc-400">GC</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.cik} className="border-b border-zinc-900 transition hover:bg-zinc-900/60">
                    <td className="px-3 py-1.5">
                      <a href={`/dilution?ticker=${encodeURIComponent(r.ticker)}`} className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:underline">
                        {r.ticker}<ExternalLink size={10} className="opacity-50" />
                      </a>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-1.5 text-zinc-300" title={r.name}>{r.name}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{fmtMoney(r.cash)}</td>
                    <td className={`px-3 py-1.5 text-right ${r.monthlyCashFlow !== null && r.monthlyCashFlow < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                      {r.monthlyCashFlow !== null ? fmtMoney(r.monthlyCashFlow) : '—'}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${runwayColor(r.runwayMonths)}`}>
                      {r.runwayMonths !== null ? (r.runwayMonths < 0 ? `${r.runwayMonths.toFixed(1)}mo` : `${r.runwayMonths.toFixed(1)}mo`) : '—'}
                    </td>
                    <td className={`px-3 py-1.5 text-right ${r.overhangSuspect ? 'text-zinc-600 line-through' : r.overhangPct !== null && r.overhangPct >= 20 ? 'text-red-400 font-semibold' : r.overhangPct !== null && r.overhangPct >= 5 ? 'text-amber-400' : 'text-zinc-300'}`} title={r.overhangSuspect ? 'Suspect magnitude — XBRL warrant/convert shares > 50× outstanding. Likely reporting corruption, excluded from sort.' : undefined}>
                      {r.overhangPct !== null ? <span className="inline-flex items-center gap-1">{r.overhangSuspect && <AlertTriangle size={11} className="text-zinc-600" />}{r.overhangPct.toFixed(1)}%</span> : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{fmtMoney(r.shelfRemaining)}</td>
                    <td className="px-3 py-1.5 text-center">
                      {r.goingConcern ? <AlertTriangle size={14} className="mx-auto text-red-400" /> : <span className="text-zinc-700">·</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
          Computed from SEC filings only (no paid data). Runway uses the same forward-projection methodology as the detail page. Overhang = XBRL-reported warrant + convertible shares. Shelf = registered aggregate − raised (3y window). Null = not reported in XBRL / not synced — click through for the full picture including 10-K notes, 8-K programs, and 424B5 tranches.
        </p>
      </div>
    </div>
  );
}
