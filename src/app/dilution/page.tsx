'use client';

/**
 * Dilution Radar — standalone per-ticker SEC dilution view.
 * Route: /dilution (not in nav yet). Reads ?ticker= from URL.
 * Data: /api/dilution/snapshot (DB) + /api/dilution/sync (SEC pull).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, ExternalLink, TrendingDown, AlertTriangle,
  FileText, Building2, Loader2,
} from 'lucide-react';

import { DILUTION_TAG_META, type DilutionTag } from '@/lib/dilution/classify';

type Filing = {
  accessionNo: string;
  formType: string;
  filingDate: string;
  primaryDesc: string | null;
  items: string[];
  dilutionTags: DilutionTag[];
  url: string;
};

type Snapshot = {
  company: {
    name: string; tickers: string[]; exchange: string | null;
    cik: string; filingsLastSynced: string | null;
  } | null;
  sharesLatest: { period: string; outstanding: number } | null;
  sharesHistory: { period: string; outstanding: number }[];
  filings: Filing[];
  tagSummary: Record<string, number>;
};

const TAG_STYLES: Record<string, string> = {
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

function fmtNum(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function DilutionPage() {
  const [input, setInput] = useState('AAPL');
  const [ticker, setTicker] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async (t: string, forceSync: boolean) => {
    setLoading(true); setError(null); setStatus(null);
    try {
      const up = t.trim().toUpperCase();
      if (forceSync) {
        setSyncing(true);
        const res = await fetch('/api/dilution/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: up }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'sync failed');
        setSnapshot(json.snapshot);
        const s = json.sync;
        setStatus(`Synced ${s.filings.count} filings · ${s.shares.count} share points · ${s.tagsChanged} tags classified`);
      } else {
        const res = await fetch(`/api/dilution/snapshot?ticker=${encodeURIComponent(up)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'lookup failed');
        if (json.needsSync) {
          // first lookup for this ticker — pull from SEC
          setSnapshot(null);
          await load(up, true);
          return;
        }
        setSnapshot(json.snapshot);
        setStatus('From cache — click Refresh to pull latest');
      }
      setTicker(up);
      const url = new URL(window.location.href);
      url.searchParams.set('ticker', up);
      window.history.replaceState({}, '', url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setLoading(false); setSyncing(false);
    }
  }, []);

  // initial load from ?ticker= or default AAPL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = (params.get('ticker') ?? 'AAPL').trim().toUpperCase();
    setInput(t);
    load(t, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toxicCount =
    (snapshot?.tagSummary['equity-line'] ?? 0) +
    (snapshot?.tagSummary['atm'] ?? 0) +
    (snapshot?.tagSummary['convertible'] ?? 0) +
    (snapshot?.tagSummary['reverse-split'] ?? 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-red-400" />
            <h1 className="text-xl font-semibold">Dilution Radar</h1>
            <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              free SEC
            </span>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); load(input, false); }}
            className="ml-auto flex items-center gap-2"
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ticker (e.g. AAPL)"
                className="w-44 rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pl-8 pr-2 text-sm uppercase placeholder:normal-case placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              Lookup
            </button>
            <button
              type="button"
              onClick={() => ticker && load(ticker, true)}
              disabled={!ticker || syncing}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}
        {status && !error && (
          <div className="mb-4 text-xs text-zinc-500">{status}</div>
        )}

        {loading && !snapshot ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading SEC data…
          </div>
        ) : snapshot ? (
          <div className="space-y-6">
            {/* Company + toxic summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 md:col-span-2">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Company</span>
                </div>
                <div className="mt-1.5 text-lg font-semibold">{snapshot.company?.name ?? ticker}</div>
                <div className="mt-1 text-sm text-zinc-500">
                  {snapshot.company?.tickers.join(' · ') ?? ticker}
                  {snapshot.company?.exchange ? ` · ${snapshot.company.exchange}` : ''}
                  {snapshot.company ? ` · CIK ${snapshot.company.cik}` : ''}
                </div>
              </div>
              <div
                className={`rounded-lg border p-4 ${
                  toxicCount > 0
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-emerald-500/30 bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center gap-2 text-zinc-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Toxic signals (90d-ish)</span>
                </div>
                <div className={`mt-1.5 text-3xl font-bold ${toxicCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {toxicCount}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  equity-line · ATM · convertible · reverse-split
                </div>
              </div>
            </div>

            {/* Shares outstanding */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <FileText className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Shares outstanding (SEC XBRL)</span>
              </div>
              {snapshot.sharesLatest ? (
                <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1">
                  <div>
                    <span className="text-2xl font-bold">{fmtNum(snapshot.sharesLatest.outstanding)}</span>
                    <span className="ml-2 text-sm text-zinc-500">as of {snapshot.sharesLatest.period}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {snapshot.sharesHistory.length} reported periods on file
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-zinc-500">No XBRL share data.</div>
              )}
            </div>

            {/* Dilution tag summary */}
            {Object.keys(snapshot.tagSummary).length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Dilution signals detected</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(snapshot.tagSummary)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tag, count]) => {
                      const meta = DILUTION_TAG_META[tag as DilutionTag];
                      return (
                        <span
                          key={tag}
                          title={meta?.tooltip}
                          className={`rounded border px-2 py-1 text-xs ${TAG_STYLES[meta?.color ?? 'blue']}`}
                        >
                          {meta?.label ?? tag} · {count}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Filings table */}
            <div className="overflow-hidden rounded-lg border border-zinc-800">
              <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs uppercase tracking-wide text-zinc-400">
                Recent filings ({snapshot.filings.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Form</th>
                      <th className="px-3 py-2 font-medium">Tags</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.filings.map((f) => (
                      <tr key={f.accessionNo} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40">
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{f.filingDate}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-medium">{f.formType}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {f.dilutionTags.length === 0 ? (
                              <span className="text-xs text-zinc-600">—</span>
                            ) : (
                              f.dilutionTags.map((t) => {
                                const meta = DILUTION_TAG_META[t];
                                return (
                                  <span
                                    key={t}
                                    title={meta.tooltip}
                                    className={`rounded border px-1.5 py-0.5 text-[10px] ${TAG_STYLES[meta.color]}`}
                                  >
                                    {meta.label}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>
                        <td className="max-w-md px-3 py-2 text-zinc-400">{f.primaryDesc ?? '—'}</td>
                        <td className="px-3 py-2">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
