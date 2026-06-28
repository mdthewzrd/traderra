'use client';

/**
 * Dilution Radar — standalone per-ticker SEC dilution view.
 * Route: /dilution (not in nav yet). Reads ?ticker= from URL.
 * Data: /api/dilution/snapshot (DB) + /api/dilution/sync (SEC pull).
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, ExternalLink, TrendingDown, AlertTriangle,
  FileText, Building2, Loader2, Gauge, Layers, Wallet,
} from 'lucide-react';

import { DILUTION_TAG_META, type DilutionTag } from '@/lib/dilution/classify';
import { deriveDilutionSummary, cashBurnRiskFromRunway } from '@/lib/dilution/summary';

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
    cik: string; filingsLastSynced: string | null; factsLastSynced: string | null;
  } | null;
  sharesLatest: { period: string; outstanding: number } | null;
  sharesHistory: { period: string; outstanding: number }[];
  cash: {
    estimatedCash: number | null;
    asOfDate: string | null;
    monthlyCashFlow: number | null;
    asOfOperatingEnd: string | null;
    reportedRunwayMonths: number | null;
    projectedCash: number | null;
    cashRemainingMonths: number | null;
    projectedAsOf: string | null;
  };
  filings: Filing[];
  tagSummary: Record<string, number>;
  form4Txns: {
    reporter: string; isOfficer: boolean; txnCode: string; securities: number;
    price: number | null; afterShares: number | null; txnDate: string; dilutive: boolean;
  }[];
  offerings: {
    accessionNo: string; formType: string; filingDate: string;
    sharesOffered: number | null; pricePerShare: number | null; grossProceeds: number | null;
    offeringType: string; underwriter: string | null;
  }[];
  registrations: {
    accessionNo: string; formType: string; filingDate: string;
    aggregateOffering: number | null; shelfType: string; salesChannel: string | null;
    agent: string | null; securitiesTypes: string[];
  }[];
  insiderDilutiveShares90d: number;
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

function fmtMoney(n: number | null): string {
  if (n === null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(0);
}

export default function DilutionPage() {
  const [input, setInput] = useState('AAPL');
  const [ticker, setTicker] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true); // true on mount → immediate spinner, proves page mounted
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

  const summary = snapshot
    ? deriveDilutionSummary(
        snapshot.filings.map((f) => ({
          formType: f.formType,
          filingDate: f.filingDate,
          dilutionTags: f.dilutionTags,
          primaryDesc: f.primaryDesc,
        })),
        {
          registrations: snapshot.registrations,
          offerings: snapshot.offerings,
          insiderDilutiveShares90d: snapshot.insiderDilutiveShares90d,
          sharesOutstanding: snapshot.sharesLatest?.outstanding ?? null,
          overhang: snapshot.overhang,
        },
      )
    : null;

  const cash = snapshot?.cash ?? null;
  const cashOutOfMoney = cash !== null && cash.cashRemainingMonths !== null && cash.cashRemainingMonths < 0;
  const cashRanOutDate =
    cash?.asOfDate && cash.reportedRunwayMonths !== null
      ? new Date(new Date(cash.asOfDate).getTime() + cash.reportedRunwayMonths * 30.44 * 86_400_000)
      : null;

  // Shares staleness + YoY dilution velocity (the core signal — computed from the
  // XBRL history we already have). Staleness is flagged because distressed/OTC
  // filers stop reporting the DEI cover-page tag; current count then lives only
  // in 8-K text (Loop 3 full-text recovery).
  const shareStaleDays =
    snapshot?.sharesLatest
      ? Math.floor((Date.now() - new Date(snapshot.sharesLatest.period).getTime()) / 86_400_000)
      : null;
  const shareDilution1y = (() => {
    const h = snapshot?.sharesHistory ?? [];
    if (!snapshot?.sharesLatest || h.length < 2) return null;
    const latest = snapshot.sharesLatest;
    const latestT = new Date(latest.period).getTime();
    const old = h
      .filter((p) => latestT - new Date(p.period).getTime() >= 300 * 86_400_000)
      .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())[0];
    if (!old || old.outstanding === 0) return null;
    return ((latest.outstanding - old.outstanding) / old.outstanding) * 100;
  })();

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
          <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
            <span>{status}</span>
            {snapshot?.company?.filingsLastSynced && (
              <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-400">
                DB · last sync {new Date(snapshot.company.filingsLastSynced).toLocaleString()}
              </span>
            )}
          </div>
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

            {/* Nasdaq compliance + shelf capacity remaining — the "can they keep listing / dilute more" view */}
            {snapshot?.compliance && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Nasdaq compliance</span>
                    <span className="ml-auto text-[10px] text-zinc-600">{snapshot.compliance.tier}</span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className={`text-2xl font-bold ${snapshot.compliance.failures === 0 ? 'text-emerald-400' : snapshot.compliance.failures === 1 ? 'text-amber-400' : 'text-red-400'}`}>
                      {snapshot.compliance.failures === 0 ? 'PASSING' : `${snapshot.compliance.failures} FAIL`}
                    </span>
                    <span className="mb-0.5 text-xs text-zinc-500">{snapshot.compliance.computable} rules computable from SEC data</span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {snapshot.compliance.rules.map((r) => (
                      <div key={r.rule} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300">{r.rule}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-zinc-500">{r.value}</span>
                          <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                            r.status === 'pass' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
                            r.status === 'fail' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                            r.status === 'review' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                            'border-zinc-700 bg-zinc-800/50 text-zinc-500'
                          }`}>{r.status}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 border-t border-zinc-800/60 pt-1.5 text-[10px] text-zinc-600">
                    Best-effort flag from SEC XBRL + live price — not a legal determination. Shareholder/director rules need proxy data.
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Layers className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Shelf capacity remaining</span>
                  </div>
                  {snapshot.shelfRemaining ? (
                    <>
                      <div className="mt-2 flex items-end gap-2">
                        <span className={`text-3xl font-bold ${snapshot.shelfRemaining.remainingPct <= 0 ? 'text-red-400' : snapshot.shelfRemaining.remainingPct <= 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          ${(snapshot.shelfRemaining.remaining / 1e6).toFixed(0)}M
                        </span>
                        <span className="mb-1 text-xs text-zinc-500">of ${(snapshot.shelfRemaining.registered / 1e6).toFixed(0)}M registered still drawable</span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-zinc-500">Registered (shelf)</span><span className="text-zinc-300">${(snapshot.shelfRemaining.registered / 1e6).toFixed(1)}M</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Raised so far (424B5)</span><span className="text-zinc-300">${(snapshot.shelfRemaining.raised / 1e6).toFixed(1)}M</span></div>
                        <div className="flex justify-between border-t border-zinc-800/60 pt-1"><span className="text-zinc-500">Remaining</span><span className="font-semibold text-zinc-200">${(snapshot.shelfRemaining.remaining / 1e6).toFixed(1)}M ({snapshot.shelfRemaining.remainingPct.toFixed(0)}%)</span></div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-500">No active registered shelf (S-3/S-1). Offerings, if any, were standalone deals.</div>
                  )}
                </div>
              </div>
            )}

            {/* Dilution Summary + Rating — the AskEdgar dilution-tracker view */}
            {summary && (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Gauge className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Dilution rating</span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className={`text-4xl font-bold ${summary.rating <= 20 ? 'text-emerald-400' : summary.rating <= 45 ? 'text-amber-400' : summary.rating <= 70 ? 'text-orange-400' : 'text-red-400'}`}>
                      {summary.rating}
                    </span>
                    <span className="mb-1 text-sm text-zinc-500">/ 100</span>
                    <span className={`mb-1 ml-auto rounded border px-2 py-0.5 text-xs ${summary.rating <= 20 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : summary.rating <= 45 ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : summary.rating <= 70 ? 'border-orange-500/30 bg-orange-500/10 text-orange-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                      {summary.tier}
                    </span>
                  </div>
                  {/* AskEdgar-aligned risk labels (reverse-engineered from 1,758 reports) */}
                  {(() => {
                    const rw = snapshot?.cash?.reportedRunwayMonths ?? null;
                    const labels = { ...summary.askedgarLabels, cashBurnRisk: cashBurnRiskFromRunway(rw) };
                    const RISK_COLOR: Record<string, string> = { high: 'text-red-400 bg-red-500/10 border-red-500/30', medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30', low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
                    const chip = (l: string | null) => l ? (
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${RISK_COLOR[l]}`}>{l}</span>
                    ) : <span className="text-zinc-700">—</span>;
                    return (
                      <div className="mt-2 flex items-center gap-2 border-t border-zinc-800/60 pt-2 text-[11px]">
                        <span className="text-zinc-500">AE-aligned:</span>
                        <span className="flex items-center gap-1"><span className="text-zinc-600">cash</span>{chip(labels.cashBurnRisk)}</span>
                        <span className="flex items-center gap-1"><span className="text-zinc-600">dil</span>{chip(labels.dilutionRisk)}</span>
                        <span className="flex items-center gap-1"><span className="text-zinc-600">off</span>{chip(labels.offeringRisk)}</span>
                      </div>
                    );
                  })()}
                  <div className="mt-3 space-y-1">
                    {summary.breakdown.map((b) => (
                      <div key={b.component} className="flex items-center justify-between text-xs">
                        <span className={b.fired ? 'text-zinc-300' : 'text-zinc-600'}>
                          {b.fired ? '◉' : '○'} {b.component}
                        </span>
                        <span className={b.fired ? 'text-zinc-400' : 'text-zinc-700'}>
                          +{b.weight}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 lg:col-span-2">
                  <div className="mb-2 flex items-center gap-2 text-zinc-400">
                    <Layers className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Dilution programs (from SEC filings)</span>
                  </div>
                  {summary.programs.length === 0 ? (
                    <div className="py-6 text-center text-sm text-zinc-500">
                      No dilution-relevant filings detected in the synced window.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800/60">
                      {summary.programs.map((p) => (
                        <div key={p.key} className="flex items-start gap-3 py-2">
                          <span
                            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                              p.severity === 'danger' ? 'bg-red-500' : p.severity === 'warn' ? 'bg-amber-500' : 'bg-zinc-600'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium">{p.label}</span>
                              <span className="shrink-0 text-xs text-zinc-500">
                                {p.count} filing{p.count > 1 ? 's' : ''}{p.latestDate ? ` · latest ${p.latestDate}` : ''}
                              </span>
                            </div>
                            <div className="truncate text-xs text-zinc-500">{p.blurb}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-600">
                    Metadata-derived (form type + 8-K items). Deeper program status — capacity remaining, shares sold — arrives with full-text document parsing.
                  </div>
                </div>
              </div>
            )}

            {/* Cash Position — AskEdgar/Nexus methodology: total liquidity (cash + restricted) as-of report date */}
            {snapshot.cash && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Wallet className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wide">Cash position</span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">total liquidity · SEC XBRL</span>
                  {snapshot.cash.asOfDate && (
                    <span className="ml-auto text-[11px] text-zinc-600">as of {snapshot.cash.asOfDate}</span>
                  )}
                </div>
                {snapshot.cash.estimatedCash === null && snapshot.cash.monthlyCashFlow === null ? (
                  <div className="mt-2 text-sm text-zinc-500">No XBRL cash/operating data reported.</div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                      <div>
                        <div className="text-xs text-zinc-500">Cash &amp; equiv. (incl. restricted)</div>
                        <div className="text-2xl font-bold">{fmtMoney(snapshot.cash.estimatedCash)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Monthly burn</div>
                        <div className={`text-2xl font-bold ${(snapshot.cash.monthlyCashFlow ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {fmtMoney(Math.abs(snapshot.cash.monthlyCashFlow ?? 0))}{snapshot.cash.monthlyCashFlow !== null && snapshot.cash.monthlyCashFlow >= 0 ? ' gen' : '/mo'}
                        </div>
                      </div>
                      {/* HEADLINE: as-reported runway — matches Nexus methodology */}
                      <div className="rounded-md border border-zinc-600/60 bg-zinc-800/40 px-3 py-1">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <span>Runway</span>
                          <span className="rounded bg-zinc-700 px-1 py-px text-[9px] uppercase tracking-wide text-zinc-300">≈ Nexus</span>
                        </div>
                        {snapshot.cash.reportedRunwayMonths === null ? (
                          <div className="text-2xl font-bold text-emerald-400">
                            {(snapshot.cash.monthlyCashFlow ?? 0) >= 0 ? 'Cash-flow+' : '—'}
                          </div>
                        ) : (
                          <div className={`text-3xl font-bold ${snapshot.cash.reportedRunwayMonths < 6 ? 'text-red-400' : snapshot.cash.reportedRunwayMonths < 12 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {snapshot.cash.reportedRunwayMonths.toFixed(1)}<span className="ml-1 text-sm font-normal text-zinc-500">mo</span>
                          </div>
                        )}
                      </div>
                      {/* SECONDARY: forward-projected to today */}
                      <div>
                        <div className="text-xs text-zinc-500">Projected to today</div>
                        {snapshot.cash.cashRemainingMonths === null ? (
                          <div className="text-2xl font-bold text-zinc-500">—</div>
                        ) : (
                          <div className={`text-2xl font-bold ${cashOutOfMoney ? 'text-red-400' : snapshot.cash.cashRemainingMonths < 6 ? 'text-red-400' : snapshot.cash.cashRemainingMonths < 12 ? 'text-amber-400' : 'text-zinc-300'}`}>
                            {snapshot.cash.cashRemainingMonths.toFixed(1)}<span className="ml-1 text-sm font-normal text-zinc-500">mo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                      {snapshot.cash.projectedCash !== null && (
                        <span>Est. cash today: {fmtMoney(snapshot.cash.projectedCash)}</span>
                      )}
                      {cashOutOfMoney && cashRanOutDate && (
                        <span className="font-medium text-red-400">Out of money since ~{cashRanOutDate.toISOString().slice(0, 10)}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600">
                      Headline = total liquidity (cash + restricted cash) ÷ latest operating burn, as-of report date — matches AskEdgar/Nexus. Projected = forward to today assuming burn continues.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Shares outstanding */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <FileText className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Shares outstanding (SEC XBRL)</span>
              </div>
              {snapshot.sharesLatest ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
                    <div>
                      <span className="text-2xl font-bold">{fmtNum(snapshot.sharesLatest.outstanding)}</span>
                      <span className="ml-2 text-sm text-zinc-500">as of {snapshot.sharesLatest.period}</span>
                    </div>
                    {/* Dilution velocity — the core signal of a dilution terminal */}
                    {shareDilution1y !== null && (
                      <div>
                        <div className="text-xs text-zinc-500">YoY share growth</div>
                        {shareDilution1y < -30 ? (
                          // A >30% drop straddles a reverse split / restatement in the
                          // history — showing the raw negative % would imply buybacks (wrong).
                          <div className="text-xl font-bold text-amber-400">Reverse split</div>
                        ) : (
                          <div className={`text-xl font-bold ${shareDilution1y > 50 ? 'text-red-400' : shareDilution1y > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {shareDilution1y > 0 ? '+' : ''}{shareDilution1y.toFixed(0)}%
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-zinc-500">
                      {snapshot.sharesHistory.length} reported periods on file
                    </div>
                  </div>
                  {/* Staleness flag — never present stale XBRL as current */}
                  {shareStaleDays !== null && shareStaleDays > 120 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide">Stale</span>
                      Last XBRL report {Math.round(shareStaleDays / 30)}mo ago — current count likely in recent 8-K text
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-sm text-zinc-500">No XBRL share data.</div>
              )}
            </div>

            {/* Recent offerings (424B5) — the actual dilution event */}
            {snapshot.offerings.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Recent offerings
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">424B5</span>
                </div>
                <div className="space-y-2">
                  {snapshot.offerings.map((o) => (
                    <div key={o.accessionNo} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-zinc-800/60 pb-2 text-sm last:border-0 last:pb-0">
                      <span className="text-zinc-500">{o.filingDate} · {o.formType}</span>
                      {o.sharesOffered !== null && (
                        <span className="font-semibold">{fmtNum(o.sharesOffered)} shares</span>
                      )}
                      {o.pricePerShare !== null && (
                        <span className="text-zinc-400">@ ${o.pricePerShare.toFixed(o.pricePerShare < 1 ? 4 : 2)}</span>
                      )}
                      {o.grossProceeds !== null && (
                        <span className="text-emerald-400">{fmtMoney(o.grossProceeds)} gross</span>
                      )}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        o.offeringType === 'atm' ? 'bg-red-500/15 text-red-400' :
                        o.offeringType === 'underwritten' ? 'bg-blue-500/15 text-blue-400' :
                        'bg-zinc-700 text-zinc-300'}`}>{o.offeringType}</span>
                      {o.underwriter && (
                        <span className="text-zinc-600">{o.underwriter}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shelf registrations (S-3) — the potential dilution PIPELINE */}
            {snapshot.registrations.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Shelf registrations
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">S-3</span>
                </div>
                <div className="space-y-2">
                  {snapshot.registrations.map((r) => (
                    <div key={r.accessionNo} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-zinc-800/60 pb-2 text-sm last:border-0 last:pb-0">
                      <span className="text-zinc-500">{r.filingDate} · {r.formType}</span>
                      {r.aggregateOffering !== null && (
                        <span className="font-semibold text-amber-300">{fmtMoney(r.aggregateOffering)} capacity</span>
                      )}
                      {r.shelfType === 'automatic-shelf' && (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">ASR</span>
                      )}
                      {r.salesChannel === 'atm' && (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">ATM</span>
                      )}
                      {r.salesChannel === 'underwritten' && (
                        <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-400"> UW</span>
                      )}
                      {r.securitiesTypes.length > 0 && (
                        <span className="text-zinc-500">{r.securitiesTypes.join(' · ')}</span>
                      )}
                      {r.agent && (
                        <span className="text-zinc-600">agent: {r.agent}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warrants & convertibles overhang (XBRL) — the price-dependent dilution threat */}
            {snapshot.overhang && (snapshot.overhang.warrant || snapshot.overhang.convertible) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Warrants &amp; convertibles
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">XBRL</span>
                  {snapshot.overhang.overhangPct !== null && snapshot.overhang.overhangPct >= 20 && (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">high overhang</span>
                  )}
                  {snapshot.overhang.overhangPct !== null && snapshot.overhang.overhangPct >= 5 && snapshot.overhang.overhangPct < 20 && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-400">med overhang</span>
                  )}
                  {snapshot.overhang.suspect && (
                    <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-orange-400" title="Share count exceeds 50× float — likely a unit mis-tag or contingent class. In-the-money scoring neutralizes it; raw magnitude is unreliable.">⚠ suspect magnitude</span>
                  )}
                </div>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-300">{snapshot.overhang.overhangPct !== null ? snapshot.overhang.overhangPct.toFixed(1) + '%' : '—'}</span>
                  <span className="text-xs text-zinc-500">of shares outstanding (dilutive overhang)</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {snapshot.overhang.warrant && (
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-300">warrant</span>
                      <span className="font-semibold text-zinc-200">{fmtNum(snapshot.overhang.warrant.shares)}</span>
                      <span className="text-zinc-500">shares{snapshot.overhang.warrant.strike !== null ? ` · $${snapshot.overhang.warrant.strike.toFixed(2)} strike` : ''} · @ {snapshot.overhang.warrant.period}</span>
                    </div>
                  )}
                  {snapshot.overhang.convertible && (
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">convert</span>
                      <span className="font-semibold text-zinc-200">{fmtNum(snapshot.overhang.convertible.shares)}</span>
                      <span className="text-zinc-500">shares{snapshot.overhang.convertible.strike !== null ? ` · $${snapshot.overhang.convertible.strike.toFixed(2)} conv` : ''} · @ {snapshot.overhang.convertible.period}</span>
                    </div>
                  )}
                </div>

                {/* In-the-money status — strike vs current price (dilutable NOW?) */}
                {snapshot.inTheMoney && snapshot.inTheMoney.price !== null && (
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <div className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                      In the money
                      <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">{`$${snapshot.inTheMoney.price.toFixed(2)} close`}</span>
                    </div>
                    {(snapshot.inTheMoney.warrant?.itm || snapshot.inTheMoney.convertible?.itm) ? (
                      <div className="mb-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-red-400">{snapshot.inTheMoney.imminentPct !== null ? `${snapshot.inTheMoney.imminentPct.toFixed(1)}%` : '—'}</span>
                        <span className="text-xs text-zinc-500">{`dilutable NOW — ${fmtNum(snapshot.inTheMoney.imminentShares)} shares in the money`}</span>
                      </div>
                    ) : (
                      <div className="mb-2 text-sm text-emerald-400">No warrants/convertibles in the money — overhang is dormant at current price.</div>
                    )}
                    <div className="space-y-1 text-sm">
                      {snapshot.inTheMoney.warrant && (
                        <div className="flex items-baseline gap-2">
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-300">warrant</span>
                          <span className={snapshot.inTheMoney.warrant.itm ? 'font-semibold text-red-400' : 'text-zinc-400'}>
                            {snapshot.inTheMoney.warrant.itm ? `IN THE MONEY +${(snapshot.inTheMoney.warrant.intrinsicPct ?? 0).toFixed(0)}%` : 'out of the money'}
                          </span>
                          <span className="text-zinc-500">{`$${snapshot.inTheMoney.price.toFixed(2)} vs $${snapshot.inTheMoney.warrant.strike.toFixed(2)} strike`}</span>
                        </div>
                      )}
                      {snapshot.inTheMoney.convertible && (
                        <div className="flex items-baseline gap-2">
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">convert</span>
                          <span className={snapshot.inTheMoney.convertible.itm ? 'font-semibold text-red-400' : 'text-zinc-400'}>
                            {snapshot.inTheMoney.convertible.itm ? `IN THE MONEY +${(snapshot.inTheMoney.convertible.intrinsicPct ?? 0).toFixed(0)}%` : 'out of the money'}
                          </span>
                          <span className="text-zinc-500">{`$${snapshot.inTheMoney.price.toFixed(2)} vs $${snapshot.inTheMoney.convertible.strike.toFixed(2)} conv`}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Insider transactions (Form 4) */}
            {snapshot.form4Txns.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Insider transactions
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">Form 4</span>
                  {snapshot.insiderDilutiveShares90d > 0 && (
                    <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                      {fmtNum(snapshot.insiderDilutiveShares90d)} dilutive (90d)
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {snapshot.form4Txns.slice(0, 8).map((t, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-zinc-500">{t.txnDate}</span>
                      <span className={`font-semibold ${t.dilutive ? 'text-amber-400' : 'text-zinc-300'}`}>{t.txnCode}</span>
                      <span className="text-zinc-400">
                        {t.txnCode === 'S' ? '−' : t.txnCode === 'P' ? '+' : ''}{fmtNum(t.securities)}
                      </span>
                      {t.price !== null && <span className="text-zinc-600">@ ${t.price.toFixed(2)}</span>}
                      <span className="text-zinc-300">{t.reporter}{t.isOfficer ? ' (officer)' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
