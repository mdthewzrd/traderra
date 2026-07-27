'use client';

/**
 * Dilution Radar — standalone per-ticker SEC dilution view.
 * Route: /dilution (not in nav yet). Reads ?ticker= from URL.
 * Data: /api/dilution/snapshot (DB) + /api/dilution/sync (SEC pull).
 */
import { useEffect, useState, useCallback, Fragment } from 'react';
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
    acceleratingBurn?: any;
    postReportRaises?: any;
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
    warrantTranches: { shares: number | null; strike: number | null; expiry: string | null; exercisable: string | null; description: string }[];
  }[];
  registrations: {
    accessionNo: string; formType: string; filingDate: string;
    aggregateOffering: number | null; shelfType: string; salesChannel: string | null;
    agent: string | null; securitiesTypes: string[];
  }[];
  insiderDilutiveShares90d: number;
  inTheMoney: {
    price: number | null; asOf: string | null; volume: number | null; marketCap: number | null;
    imminentShares: number; imminentPct: number | null;
    warrant: { strike: number; itm: boolean; intrinsicPct: number | null } | null;
    convertible: { strike: number; itm: boolean; intrinsicPct: number | null } | null;
  } | null;
  authorizedShares: { authorized: number; outstanding: number; available: number; asOf: string } | null;
  reverseSplits: { ratio: string; executionDate: string | null; announcementDate: string; accessionNo: string; url: string }[];
  publicFloat: { value: number; shares: number | null; asOf: string } | null;
  overhang?: any;
  warrants?: any[];
  convertibles?: any[];
  compliance?: any;
  draws?: any[];
  programs?: any[];
  warrantNotes?: any;
  computedFloat?: any;
  news?: any;
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

const TONE: Record<string, string> = {
  red: 'text-red-400', amber: 'text-amber-300', zinc: 'text-zinc-300',
  purple: 'text-purple-400', emerald: 'text-emerald-400', orange: 'text-orange-300',
};

/** Compact summary of ACTIVE dilution mechanisms — colored facts, not counts.
 *  Warrants (shares/strike/ITM), equity lines (max), ATM/shelf (sold/remaining),
 *  converts (shares). Powers the dilution-ability sub-score line. */
function mechanicsSummary(snap: any): { label: string; value: string; tone: string; title?: string }[] {
  const out: { label: string; value: string; tone: string; title?: string }[] = [];
  const px = snap?.inTheMoney?.price ?? null;
  // Warrants — 10-K notes + registered tranches from 424B5
  const wnWarr = snap?.warrantNotes?.warrants ?? [];
  const regWarr = (snap?.offerings ?? []).flatMap((o: any) => o.warrantTranches ?? []);
  const allWarr = [...wnWarr, ...regWarr];
  const warrShares = allWarr.reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
  if (warrShares > 0) {
    const itmShares = allWarr.filter((w: any) => w.exercisePrice != null && px != null && px >= w.exercisePrice)
      .reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
    const strikes = allWarr.map((w: any) => w.exercisePrice).filter((x: any): x is number => typeof x === 'number');
    const minStrike = strikes.length ? Math.min(...strikes) : null;
    out.push({
      label: 'Warrants',
      value: fmtNum(warrShares) + ' sh' + (minStrike != null ? ' @ $' + minStrike.toFixed(minStrike < 1 ? 4 : 2) : '') + (itmShares > 0 ? ' · ' + fmtNum(itmShares) + ' ITM' : ''),
      tone: itmShares > 0 ? 'red' : 'amber',
      title: itmShares > 0 ? 'In-the-money warrants are dilutive at the current price' : 'Out of the money — not yet dilutive',
    });
  }
  // Equity lines / SEPA (10-K notes + 8-K agreements)
  const eqLines = [...(snap?.warrantNotes?.equityLines ?? []), ...((snap?.programs ?? []).filter((p: any) => p.programType === 'equity-line'))];
  if (eqLines.length > 0) {
    const eqMax = eqLines.reduce((a: number, e: any) => a + (e.maxCommitment ?? 0), 0);
    out.push({ label: 'Eq line', value: eqMax > 0 ? '$' + (eqMax / 1e6).toFixed(0) + 'M max' : eqLines.length + ' active', tone: 'red', title: 'Equity-line / SEPA facility — issuer can sell shares into the market' });
  }
  // ATM / shelf remaining capacity
  const sh = snap?.shelfRemaining;
  if (sh && sh.registered > 0) {
    const sold = sh.raised ?? 0;
    const left = sh.remaining ?? Math.max(0, sh.registered - sold);
    out.push({ label: 'ATM/shelf', value: '$' + (left / 1e6).toFixed(1) + 'M left of $' + (sh.registered / 1e6).toFixed(0) + 'M', tone: left > 0 ? 'orange' : 'zinc', title: sold > 0 ? '$' + (sold / 1e6).toFixed(1) + 'M already sold off this shelf' : 'Registered but untapped' });
  }
  // Convertible notes
  const convs = snap?.warrantNotes?.convertibles ?? [];
  const convShares = convs.reduce((a: number, c: any) => a + (c.shares ?? 0), 0);
  if (convShares > 0) out.push({ label: 'Converts', value: fmtNum(convShares) + ' sh', tone: 'purple', title: 'Convertible notes — share count on conversion' });
  // Other 8-K agreements (atm / purchase-agreement) if no eq line already shown
  const otherProgs = (snap?.programs ?? []).filter((p: any) => p.programType !== 'equity-line');
  if (otherProgs.length > 0 && eqLines.length === 0) {
    const otherMax = otherProgs.reduce((a: number, p: any) => a + (p.maxCommitment ?? 0), 0);
    out.push({ label: otherProgs[0].programType, value: otherMax > 0 ? '$' + (otherMax / 1e6).toFixed(0) + 'M' : otherProgs.length + ' filed', tone: 'amber' });
  }
  return out;
}

// Dilution programs organized into typed sub-tabs: equity lines / warrants /
// converts / ATM / shelf / S-1. Pulls from the richest available snapshot
// sources per type (parsed 8-K agreements, 10-K notes, registrations, filings).
// Detail-led: each row names the mechanism + where it came from, no scores.
// Nexus-parity dilution overview: one spacious <table> per instrument type,
// full page width, no scroll box. Replaces the old cramped tabbed ProgramTabs.
function DilutionOverview({ snapshot }: { snapshot: any }) {
  const [ovTab, setOvTab] = useState(0);
  const now = Date.now();
  const M = 1e6;
  const px = snapshot?.inTheMoney?.price ?? null;
  const sharesFor = (maxDollars: number | null | undefined) =>
    px != null && maxDollars != null && maxDollars > 0 ? Math.round(maxDollars / px) : null;
  const eqLines = [
    ...((snapshot?.warrantNotes?.equityLines ?? []).map((el: any, i: number) => ({ key: 'el' + i, date: '', who: el.counterparty, max: el.maxCommitment, extra: [el.pricing, el.ownershipCap != null ? el.ownershipCap + '% cap' : null].filter(Boolean).join(' · ') }))),
    ...((snapshot?.programs ?? []).filter((p: any) => p.programType === 'equity-line').map((p: any, i: number) => ({ key: 'pr' + i, date: p.filingDate, who: p.counterparty, max: p.maxCommitment, extra: [p.pricing, p.ownershipCap != null ? p.ownershipCap + '% cap' : null].filter(Boolean).join(' · ') }))),
  ];
  // Filter junk warrant rows: drop entries with no meaningful shares
  // AND no meaningful strike (noise), and filter absurd strike parse errors
  // (>$10K strike is clearly a mis-parsed dollar amount).
  const warrants = (snapshot?.warrants ?? []).filter((w: any) => {
    const hasShares = w.shares != null && w.shares > 0;
    const validStrike = w.strike != null && w.strike > 0 && w.strike < 10000;
    return hasShares || validStrike;
  });
  // Convertible notes — parsed 10-K note detail (principal, conversion
  // price, maturity, derived share overhang = principal ÷ conv price) is the
  // authoritative per-instrument source, parallel to the warrant schedule.
  // snapshot.convertibles already includes an XBRL-aggregate fallback row
  // when no note detail exists, so we no longer push overhang separately.
  const converts = [
    ...((snapshot?.convertibles ?? []).map((c: any, i: number) => ({
      key: 'cn' + i, date: c.filingDate, who: c.source === '10-K notes' ? '10-K notes' : 'XBRL overhang',
      principal: c.principal, convPrice: c.conversionPrice, shares: c.shares,
      maturity: c.maturity, status: c.status, source: c.source, extra: null,
    }))),
    ...((snapshot?.programs ?? []).filter((p: any) => p.programType === 'convertible').map((p: any, i: number) => ({
      key: 'cv' + i, date: p.filingDate, who: p.counterparty, principal: p.maxCommitment,
      convPrice: null, shares: null, maturity: p.maturity ?? null, status: 'active', source: '8-K agreement',
      extra: [p.pricing].filter(Boolean).join(' · ') || null,
    }))),
  ];
  const atm = [
    ...((snapshot?.programs ?? []).filter((p: any) => p.programType === 'atm').map((p: any, i: number) => ({ key: 'at' + i, date: p.filingDate, who: p.counterparty, max: p.maxCommitment, extra: p.pricing }))),
    ...((snapshot?.registrations ?? []).filter((r: any) => r.salesChannel === 'atm').map((r: any, i: number) => ({ key: 'ra' + i, date: r.filingDate, who: r.agent, max: r.aggregateOffering, extra: r.shelfType === 'automatic-shelf' ? 'S-3ASR' : r.formType }))),
  ];
  const shelf = (snapshot?.registrations ?? []).filter((r: any) => r.aggregateOffering != null);
  const s1 = (snapshot?.filings ?? []).filter((f: any) => /^S-1/.test(f.formType)).slice(0, 12);

  // ── DILUTION CAPACITY ROLLUP ──────────────────────────────────────────────
  // The at-a-glance answer to "how much can they still dilute?" Each bucket is
  // a distinct $ capacity (no double-count: shelves = S-3/F-3 registrations,
  // equity lines = 8-K SEPA programs). Draws = actual cash raised under any
  // facility. Warrants/converts are share dilution (not $), shown separately.
  const sr = snapshot?.shelfRemaining ?? null;
  const eqMax = eqLines.reduce((a: number, r) => a + (Number(r.max) || 0), 0);
  const eqDrawn = (snapshot?.draws ?? []).filter((d: any) => d.facilityType === 'equity-line').reduce((a: number, d: any) => a + (d.amount ?? 0), 0);
  const eqRemaining = eqMax > 0 ? Math.max(0, eqMax - eqDrawn) : 0;
  const totalDraws = (snapshot?.draws ?? []).reduce((a: number, d: any) => a + (d.amount ?? 0), 0);
  const warrantShares = warrants.reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
  const warrantItmShares = warrants.filter((w: any) => w.strike != null && w.strike > 0 && px != null && px >= w.strike).reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
  const convShares = converts.reduce((a: number, c: any) => a + (c.shares ?? 0), 0);
  // $ value of remaining capacity (shelf + equity line), in share terms.
  const capacityRemaining = (sr?.remaining ?? 0) + eqRemaining;
  const capacityRemainingShares = sharesFor(capacityRemaining);
  // ITM = price over strike (exercise likely, dilution imminent). NEAR =
  // within 20% below strike (watch). OTM (further below) is unremarkable.
  const stt = (strike: number | null) => {
    if (strike == null || strike === 0 || px == null) return null;
    if (px >= strike) return { label: 'ITM', border: 'border-l-2 border-red-500/70 pl-2', txt: 'text-red-300', bg: 'bg-red-500/15' };
    if (px >= strike * 0.8) return { label: 'NEAR', border: 'border-l-2 border-amber-500/70 pl-2', txt: 'text-amber-300', bg: 'bg-amber-500/15' };
    return null;
  };
  // float value (SEC cover) for baby-shelf / WKSI classification.
  const floatVal = snapshot?.publicFloat?.value ?? (snapshot?.computedFloat?.shares != null && px != null ? snapshot.computedFloat.shares * px : null);
  const DAY = 86400000;
  // Filing-age proxy: fresh SEPA/ATM = tappable; 2yr+ = likely drained.
  const statusFor = (ds: string): { label: string; cls: string; rel: string } | null => {
    if (!ds) return null;
    const days = Math.floor((Date.now() - new Date(ds).getTime()) / DAY);
    if (Number.isNaN(days)) return null;
    const rel = days < 30 ? days + 'd ago' : days < 365 ? Math.round(days / 30) + 'mo ago' : (days / 365).toFixed(1) + 'yr ago';
    if (days <= 90) return { label: 'new', cls: 'bg-emerald-500/15 text-emerald-400', rel };
    if (days <= 730) return { label: 'active', cls: 'bg-zinc-700 text-zinc-300', rel };
    return { label: 'aging', cls: 'bg-amber-500/15 text-amber-400', rel };
  };
  // Activity-based dilution-instrument status: a facility drawn last month is
  // ACTIVE even if filed 3yr ago. lastActivity (last draw/exercise/conversion)
  // wins when present; otherwise falls back to the filing/amendment date.
  // Graduated per the trader heuristic: ~2yr idle = likely aged, longer = aged.
  const agedStatus = (filingDate: string | null | undefined, lastActivity: string | null | undefined): { label: string; cls: string; rel: string } | null => {
    const base = lastActivity ?? filingDate;
    if (!base) return null;
    const days = Math.floor((Date.now() - new Date(base).getTime()) / DAY);
    if (Number.isNaN(days)) return null;
    const rel = days < 30 ? days + 'd ago' : days < 365 ? Math.round(days / 30) + 'mo ago' : (days / 365).toFixed(1) + 'yr ago';
    if (days < 365) return { label: 'active', cls: 'bg-emerald-500/15 text-emerald-400', rel };
    if (days < 730) return { label: 'aging', cls: 'bg-amber-500/15 text-amber-300', rel };
    if (days < 1095) return { label: 'likely aged', cls: 'bg-orange-500/15 text-orange-300', rel };
    return { label: 'aged', cls: 'bg-zinc-700 text-zinc-500', rel };
  };
  // Match dilution draws (actual cash raised) to a facility row by type +
  // counterparty name (facilityName ∋ who). Returns the full set, date-sorted,
  // and the most-recent — used for the "Last Activity" column + aged status.
  // matchName=false skips the name check: needed for ATM whose draws are labeled
  // generically ("Sales Agreement") rather than by agent, so a company's ATM
  // activity still surfaces on its ATM row.
  const facilityDraws = (facilityType: string, who: string | null | undefined, matchName = true) => {
    const ds = (snapshot?.draws ?? []).filter((d: any) => d.facilityType === facilityType && (!matchName || (who && d.facilityName && (d.facilityName.includes(who) || who.includes(d.facilityName)))));
    const sorted = ds.filter((d: any) => d.date).sort((a: any, b: any) => b.date.localeCompare(a.date));
    return { draws: ds, sorted, last: sorted[0] ?? null };
  };
  const fmtSh = (s: number | null | undefined) => (s != null ? (s >= M ? (s / M).toFixed(2) + 'M' : Math.round(s).toLocaleString()) : '—');
  const th = 'py-2 pr-4 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500 whitespace-nowrap';
  const td = 'py-1.5 pr-4 text-xs align-top';
  const nothing = shelf.length + atm.length + eqLines.length + warrants.length + converts.length + s1.length === 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-zinc-400">
        <Layers className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">Dilution overview</span>
        {px != null && <span className="ml-auto text-[11px] text-zinc-500">price ${px}</span>}
      </div>

      {/* ── ROLLUP: full dilution scope at a glance ── */}
      {(sr || eqMax > 0 || totalDraws > 0 || warrantShares > 0 || convShares > 0) && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-zinc-700/70 bg-zinc-800/30 p-3 sm:grid-cols-4">
          {capacityRemaining > 0 && (
            <div className="col-span-2 flex items-baseline gap-2 sm:col-span-4">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Capacity remaining</span>
              <span className="text-2xl font-bold leading-none text-amber-300">${(capacityRemaining / M).toFixed(1)}M</span>
              {capacityRemainingShares != null && px != null && <span className="text-[11px] text-zinc-500">= {(capacityRemainingShares / M).toFixed(1)}M shares @ ${px}</span>}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">Shelf</span>
            {sr ? (
              <>
                <span className="font-medium text-emerald-400">${(sr.remaining / M).toFixed(1)}M<span className="text-zinc-600"> left</span></span>
                <span className="text-[10px] text-zinc-600">of ${(sr.registered / M).toFixed(0)}M</span>
              </>
            ) : <span className="text-zinc-600">none</span>}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">Equity lines</span>
            {eqMax > 0 ? (
              <>
                <span className="font-medium text-emerald-400">${(eqRemaining / M).toFixed(1)}M<span className="text-zinc-600"> left</span></span>
                <span className="text-[10px] text-zinc-600">of ${(eqMax / M).toFixed(0)}M</span>
              </>
            ) : <span className="text-zinc-600">none</span>}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">Raised so far</span>
            {totalDraws > 0 ? (
              <>
                <span className="font-medium text-amber-400">${(totalDraws / M).toFixed(1)}M</span>
                <span className="text-[10px] text-zinc-600">{(snapshot?.draws ?? []).length} draws</span>
              </>
            ) : <span className="text-zinc-600">—</span>}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">Warrants + converts</span>
            {warrantShares > 0 || convShares > 0 ? (
              <>
                <span className="font-medium text-zinc-200">{fmtSh(warrantShares + convShares)}<span className="text-zinc-600"> sh</span></span>
                {warrantItmShares > 0 && <span className="text-[10px] text-red-400">{fmtSh(warrantItmShares)} ITM</span>}
              </>
            ) : <span className="text-zinc-600">none</span>}
          </div>
        </div>
      )}

      {/* Tab bar */}
      {(() => {
        const ovTabs = [
          { label: 'ATM', n: atm.length, idx: 0 },
          { label: 'Eq Lines', n: eqLines.length, idx: 1 },
          { label: 'Warrants', n: warrants.length, idx: 2 },
          { label: 'Converts', n: converts.length, idx: 3 },
          { label: 'S-1 / F-1', n: s1.length, idx: 4 },
        ].filter(t => t.n > 0);
        if (!ovTabs.length) return null;
        return (
          <div className="mb-3 flex flex-wrap gap-1">
            {ovTabs.map(t => (
              <button key={t.idx} onClick={() => setOvTab(t.idx)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${ovTab === t.idx ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>
                {t.label} <span className="ml-1 opacity-60">{t.n}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <div>
        {/* ATM PROGRAMS */}
        {ovTab === 0 && atm.length > 0 && (
          <details open className="rounded border border-zinc-800/60">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-800/30">
              <svg className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">ATM Programs</span>
              <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{atm.length}</span>
              <span className="text-[11px] text-zinc-500">· {atm.reduce((a: number, r: any) => a + (Number(r.max) || 0), 0) > 0 && '$' + (atm.reduce((a: number, r: any) => a + (Number(r.max) || 0), 0) / M).toFixed(0) + 'M max'}{sr && <> · <span className="text-emerald-400">${'$'}{(sr.remaining / M).toFixed(0)}M remaining</span></>}</span>
            </summary>
            <div className="border-t border-zinc-800/50 px-3 py-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Agent / bank</th>
                    <th className={th}>Max</th>
                    <th className={th}>Shares avail</th>
                    <th className={th}>Last activity</th>
                    <th className={th}>Status</th>
                    <th className={th}>Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {atm.map((r: any) => {
                    const fd = facilityDraws('atm', r.who, false);
                    const isRecentDraw = fd.last && (now - Date.parse(fd.last.date)) < 90 * 86400000;
                    const st = agedStatus(r.date, fd.last?.date ?? null);
                    const sh = sharesFor(r.max);
                    return (
                      <tr key={r.key}>
                        <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.date || '—'}</td>
                        <td className={td + ' text-zinc-200'}>{r.who || '—'}</td>
                        <td className={td}>{r.max != null ? <span className="font-medium text-zinc-100">${(Number(r.max) / M).toFixed(1)}M</span> : '—'}</td>
                        <td className={td + ' text-zinc-400'}>{sh != null ? fmtSh(sh) : '—'}</td>
                        <td className={td}>{fd.last ? <span className={isRecentDraw ? 'text-emerald-400' : 'text-zinc-500'}>{fd.last.date}{fd.draws.length > 1 && <span className="text-zinc-600"> · {fd.draws.length}×</span>}</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td}>{st ? <span className={'rounded px-1 py-px text-[9px] font-semibold uppercase ' + st.cls} title={st.rel ? 'last activity ' + st.rel : undefined}>{st.label}</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td + ' text-zinc-500'}>{r.extra || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </details>
        )}

        {/* EQUITY LINES */}
        {ovTab === 1 && eqLines.length > 0 && (
          <details open className="rounded border border-zinc-800/60">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-800/30">
              <svg className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Equity Lines / SEPA</span>
              <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{eqLines.length}</span>
              <span className="text-[11px] text-zinc-500">· ${(eqMax / M).toFixed(0)}M max · <span className="text-emerald-400">${((eqMax - eqDrawn) / M).toFixed(0)}M remaining</span></span>
            </summary>
            <div className="border-t border-zinc-800/50 px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-x-4 text-[11px]">
              <span className="text-zinc-500">Max <span className="text-zinc-300">${(eqMax / M).toFixed(1)}M</span></span>
              <span className="text-zinc-500">Drawn <span className="text-amber-400">${(eqDrawn / M).toFixed(1)}M</span></span>
              <span className="font-medium text-emerald-400">Remaining ${((eqMax - eqDrawn) / M).toFixed(1)}M</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Counterparty</th>
                    <th className={th}>Max</th>
                    <th className={th}>Last activity</th>
                    <th className={th}>Status</th>
                    <th className={th}>Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {eqLines.map((r: any) => {
                    // Match draws to this line by facilityName containing counterparty
                    const fd = facilityDraws('equity-line', r.who);
                    const lineDraws = fd.draws;
                    const lineDrawsSorted = fd.sorted;
                    const lastUse = fd.last;
                    const drawn = lineDraws.reduce((a: number, d: any) => a + (d.amount ?? 0), 0);
                    const isRecentDraw = lastUse && (now - Date.parse(lastUse.date)) < 90 * 86400000;
                    // Activity-aware: a facility tapped last month is ACTIVE even if filed years ago.
                    const st = agedStatus(r.date, lastUse?.date ?? null);
                    return (
                      <Fragment key={r.key}>
                        <tr>
                          <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.date || '—'}</td>
                          <td className={td + ' text-zinc-200'}>{r.who || 'equity line'}</td>
                          <td className={td}>{r.max != null ? <span className="font-medium text-zinc-100">${(Number(r.max) / M).toFixed(1)}M</span> : '—'}</td>
                          <td className={td}>{lastUse ? <span className={isRecentDraw ? 'text-emerald-400' : 'text-zinc-500'}>{lastUse.date}{lineDraws.length > 1 && <span className="text-zinc-600"> · {lineDraws.length}×</span>}</span> : <span className="text-zinc-600">—</span>}</td>
                          <td className={td}>{st ? <span className={'rounded px-1 py-px text-[9px] font-semibold uppercase ' + st.cls} title={st.rel ? 'last activity ' + st.rel : undefined}>{st.label}</span> : <span className="text-zinc-600">—</span>}</td>
                          <td className={td + ' text-zinc-500'}>{r.extra || '—'}</td>
                        </tr>
                        {lineDrawsSorted.length > 0 && (
                          <tr className="bg-zinc-900/40">
                            <td colSpan={6} className="py-1 pl-8 pr-4">
                              <details>
                                <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-400">{lineDraws.length} draw{lineDraws.length > 1 ? 's' : ''} · ${(drawn / M).toFixed(2)}M total</summary>
                                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-[10px]">
                                  {lineDrawsSorted.map((d: any, i: number) => (
                                    <span key={i} className="text-zinc-400">{d.date}<span className="text-zinc-600"> · </span><span className="text-zinc-300">${((d.amount ?? 0) / M).toFixed(2)}M</span>{d.shares ? <span className="text-zinc-600"> · </span> : null}{d.shares ? <span>{fmtSh(d.shares)} sh</span> : null}</span>
                                  ))}
                                </div>
                              </details>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
              <div className="mt-1 text-[10px] text-zinc-600">Remaining = max − already sold, totaled across all lines.</div>
            </div>
          </details>
        )}

        {/* WARRANTS */}
        {ovTab === 2 && warrants.length > 0 && (
          <details open className="rounded border border-zinc-800/60">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-800/30">
              <svg className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Warrants</span>
              <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{warrants.length}</span>
              <span className="text-[11px] text-zinc-500">· {fmtSh(warrantShares)} sh{warrantItmShares > 0 ? <span className="text-red-400"> · {fmtSh(warrantItmShares)} ITM</span> : ''}{px != null ? ` @ $${px}` : ''}</span>
            </summary>
            <div className="border-t border-zinc-800/50 px-3 py-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Shares</th>
                    <th className={th}>Strike</th>
                    <th className={th}>vs price</th>
                    <th className={th}>Status</th>
                    <th className={th}>Exercisable</th>
                    <th className={th}>Expires</th>
                    <th className={th}>Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {warrants.map((w: any, i: number) => {
                    const st = stt(w.strike);
                    const statCls = w.status === 'pre-funded' ? 'bg-fuchsia-500/15 text-fuchsia-300' : w.status === 'expired' ? 'bg-zinc-700 text-zinc-500 line-through' : w.status === 'pending' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-800/60 text-zinc-500';
                    return (
                      <tr key={i}>
                        <td className={td + ' font-medium text-zinc-100'}>{fmtSh(w.shares)}</td>
                        <td className={td + (st ? ' ' + st.txt : '')}>{w.strike != null ? '$' + w.strike : '—'}</td>
                        <td className={td}>{st ? <span className={'rounded px-1 text-[9px] font-semibold uppercase ' + st.bg + ' ' + st.txt}>{st.label}</span> : w.status === 'pre-funded' ? <span className="rounded px-1 text-[9px] font-semibold uppercase bg-fuchsia-500/15 text-fuchsia-300">paid</span> : <span className="text-zinc-600">OTM</span>}</td>
                        <td className={td}><span className={'rounded px-1 text-[9px] font-semibold uppercase ' + statCls}>{w.status}</span></td>
                        <td className={td + ' text-zinc-500'}>{w.exercisable || '—'}</td>
                        <td className={td + ' text-zinc-500'}>{w.expiry || '—'}</td>
                        <td className={td}><span className="rounded bg-zinc-800 px-1 text-[9px] text-zinc-500">{w.source}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              <div className="mt-1 text-[10px] text-zinc-500"><span className="text-red-400">ITM</span> = in-the-money · <span className="text-amber-400">NEAR</span> = within 20% of strike · <span className="text-fuchsia-400">pre-funded</span> = already paid.</div>
            </div>
          </details>
        )}

        {/* CONVERTIBLE NOTES */}
        {ovTab === 3 && converts.length > 0 && (
          <details open className="rounded border border-zinc-800/60">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-800/30">
              <svg className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Convertible Notes</span>
              <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{converts.length}</span>
              <span className="text-[11px] text-zinc-500">{converts.reduce((a: number, r: any) => a + (Number(r.principal) || 0), 0) > 0 && ' · $' + (converts.reduce((a: number, r: any) => a + (Number(r.principal) || 0), 0) / M).toFixed(0) + 'M principal'}{convShares > 0 && ' · ' + fmtSh(convShares) + ' sh'}</span>
            </summary>
            <div className="border-t border-zinc-800/50 px-3 py-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Counterparty</th>
                    <th className={th}>Principal</th>
                    <th className={th}>Conv price</th>
                    <th className={th}>Shares</th>
                    <th className={th}>Maturity</th>
                    <th className={th}>Last activity</th>
                    <th className={th}>Status</th>
                    <th className={th}>Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {converts.map((r: any) => {
                    const itm = r.convPrice != null && px != null && px >= r.convPrice;
                    const fd = facilityDraws('convertible', r.who);
                    const st = agedStatus(r.date, fd.last?.date ?? null);
                    const isRecentDraw = fd.last && (now - Date.parse(fd.last.date)) < 90 * 86400000;
                    const statCls = r.status === 'matured' ? 'bg-zinc-700 text-zinc-500 line-through' : r.status === 'redeemed' ? 'bg-orange-500/15 text-orange-300' : 'bg-zinc-800/60 text-zinc-500';
                    return (
                      <tr key={r.key}>
                        <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.date || '—'}</td>
                        <td className={td + ' text-zinc-200'}>{r.who || '—'}</td>
                        <td className={td}>{r.principal != null ? <span className="font-medium text-zinc-100">${(Number(r.principal) / M).toFixed(1)}M</span> : '—'}</td>
                        <td className={td + (itm ? ' text-red-300' : '')}>{r.convPrice != null ? '$' + r.convPrice : '—'}{itm && <span className="ml-1 rounded bg-red-500/15 px-1 text-[9px] font-semibold uppercase text-red-300">ITM</span>}</td>
                        <td className={td + ' text-zinc-400'}>{r.shares != null ? fmtSh(r.shares) : '—'}</td>
                        <td className={td + ' text-zinc-500'}>{r.maturity || '—'}</td>
                        <td className={td}>{fd.last ? <span className={isRecentDraw ? 'text-emerald-400' : 'text-zinc-500'}>{fd.last.date}{fd.draws.length > 1 && <span className="text-zinc-600"> · {fd.draws.length}×</span>}</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td}>{r.status === 'matured' || r.status === 'redeemed' ? <span className={'rounded px-1 text-[9px] font-semibold uppercase ' + statCls}>{r.status}</span> : st ? <span className={'rounded px-1 text-[9px] font-semibold uppercase ' + st.cls} title={st.rel ? 'last activity ' + st.rel : undefined}>{st.label}</span> : <span className="text-zinc-600">{r.status}</span>}</td>
                        <td className={td + ' text-zinc-500'}>{r.extra || <span className="rounded bg-zinc-800 px-1 text-[9px] text-zinc-500">{r.source}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              <div className="mt-1 text-[10px] text-zinc-500"><span className="text-red-400">ITM</span> = price ≥ conversion price (conversion likely). Shares = principal ÷ conv price when both parsed.</div>
            </div>
          </details>
        )}

        {/* S-1 / F-1 — registration lifecycle: filed → amended → effective (8-K notice) → withdrawn */}
        {ovTab === 4 && s1.length > 0 && (() => {
          const allFilings = snapshot?.filings ?? [];
          const has424 = allFilings.some((fl: any) => /^424B[345]/.test(fl.formType));
          const hasRW = allFilings.some((fl: any) => /RW/.test(fl.formType));
          const s1Regs = (snapshot?.registrations ?? []).filter((r: any) => /^S-1|^F-1/.test(r.formType));
          const s1RegTotal = s1Regs.reduce((a: number, r: any) => a + (r.aggregateOffering ?? 0), 0);
          // effectiveDate lookup by accessionNo (s1 comes from filings, effDate from registrations)
          const effByAcc = new Map((snapshot?.registrations ?? []).map((r: any) => [r.accessionNo, r.effectiveDate]));
          const anyEffective = s1.some((f: any) => effByAcc.get(f.accessionNo));
          const statusFor1 = (ft: string, acc: string): { label: string; cls: string; date?: string } => {
            if (/RW/.test(ft)) return { label: 'withdrawn', cls: 'bg-zinc-700 text-zinc-500 line-through' };
            const eff = effByAcc.get(acc);
            if (eff) return { label: 'effective', cls: 'bg-emerald-500/15 text-emerald-400', date: eff };
            if (/\/A/.test(ft)) return { label: 'amended', cls: 'bg-amber-500/15 text-amber-300' };
            if (has424) return { label: 'effective*', cls: 'bg-emerald-500/15 text-emerald-400' }; // inferred from 424B
            return { label: 'pending', cls: 'bg-zinc-800 text-zinc-500' };
          };
          return (
          <details className="group rounded border border-zinc-800/60">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-800/30">
              <svg className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">S-1 / F-1 Registrations</span>
              <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{s1.length}</span>
              <span className="text-[11px] text-zinc-500">· {s1RegTotal > 0 && '$' + (s1RegTotal / M).toFixed(0) + 'M registered'} · <span className={anyEffective ? 'text-emerald-400' : hasRW ? 'text-zinc-500' : 'text-zinc-500'}>{anyEffective ? 'effective' : hasRW ? 'withdrawn' : 'pending'}</span></span>
            </summary>
            <div className="border-t border-zinc-800/50 px-3 py-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Form</th>
                    <th className={th}>Status</th>
                    <th className={th}>Headline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {s1.map((f: any, i: number) => {
                    const st = statusFor1(f.formType, f.accessionNo);
                    return (
                      <tr key={i}>
                        <td className={td + ' whitespace-nowrap text-zinc-500'}>{f.filingDate}</td>
                        <td className={td}><span className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-400">{f.formType}</span></td>
                        <td className={td}><span className={'rounded px-1 text-[9px] font-semibold uppercase ' + st.cls}>{st.label}</span>{st.date && <span className="ml-1 text-[9px] text-zinc-600">{st.date}</span>}</td>
                        <td className={td + ' text-zinc-400'}>{f.primaryDesc ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </details>
          );
        })()}

        {nothing && <div className="py-3 text-center text-xs text-zinc-500">No dilution facilities detected.</div>}
      </div>
    </div>
  );
}


/**
 * Bottom tabbed block — consolidates the scattered bottom cards into three tabs.
 * Nexus-parity: Past Offerings (default) · Recent Filings · Shares & Float.
 * The user explicitly asked for this structure (replacing the flat filings list).
 */
function BottomTabs({ snapshot }: { snapshot: any }) {
  const [tab, setTab] = useState(0);
  const offerings = snapshot?.offerings ?? [];
  const registrations = snapshot?.registrations ?? [];
  const draws = snapshot?.draws ?? [];
  const filings = snapshot?.filings ?? [];
  const sharesHistory = (snapshot?.sharesHistory ?? []) as { period: string; outstanding: number }[];
  const authorized = snapshot?.authorizedShares ?? null;
  const reverseSplits = snapshot?.reverseSplits ?? [];
  // SEC filing link from accessionNo (Archive index; primaryDoc omitted →
  // lands on the filing's document list). Used across offerings/registrations.
  const secUrl = (accessionNo: string | null | undefined) => {
    const cik = snapshot?.company?.cik;
    if (!accessionNo || !cik) return null;
    return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNo.replace(/-/g, '')}/`;
  };

  // Insider ownership — aggregate latest afterShares per reporter from Form 4.
  // Honest: transaction-derived (not a holdings filing); institutional (13F)
  // data is not pulled. Each person's most-recent transaction's afterShares.
  const form4 = (snapshot?.form4Txns ?? []) as { reporter: string; isOfficer: boolean; txnCode: string; securities: number; price: number | null; afterShares: number | null; txnDate: string; dilutive: boolean }[];
  const insiderMap = new Map<string, { name: string; shares: number; isOfficer: boolean; latest: string }>();
  for (const t of form4) {
    if (t.afterShares == null) continue;
    const ex = insiderMap.get(t.reporter);
    if (!ex || Date.parse(t.txnDate) > Date.parse(ex.latest)) {
      insiderMap.set(t.reporter, { name: t.reporter, shares: t.afterShares, isOfficer: t.isOfficer, latest: t.txnDate });
    }
  }
  const insiders = [...insiderMap.values()].filter((x) => x.shares > 0).sort((a, b) => b.shares - a.shares);
  const outstandingRef = sharesHistory[0]?.outstanding ?? null;

  // Merge offerings + SEPA draws into one chronological offering history.
  type PastRow = { date: string; type: string; shares: number | null; price: number | null; amount: number | null; underwriter: string | null; acc: string | null; };
  const pastOfferings: PastRow[] = [
    ...offerings.map((o: any) => ({
      date: o.filingDate, type: o.offeringType ?? o.formType,
      shares: o.sharesOffered, price: o.pricePerShare,
      amount: o.grossProceeds, underwriter: o.underwriter, acc: o.accessionNo ?? null,
    })),
    // Registrations (S-3/F-3/F-1/S-1) as timeline events — the company filed
    // intent to raise, not an executed sale. No shares/price; amount = the
    // aggregate registered ceiling. Amber badge distinguishes from sales.
    ...registrations.map((r: any) => ({
      date: r.filingDate, type: r.formType,
      shares: null, price: null,
      amount: r.aggregateOffering, underwriter: r.agent, acc: r.accessionNo ?? null,
    })),
    ...draws.map((d: any) => ({
      date: d.filingDate ?? d.date ?? '', type: 'SEPA draw',
      shares: d.shares ?? null, price: d.pricePerShare ?? d.price ?? null,
      amount: d.proceeds ?? d.grossAmount ?? null, underwriter: d.counterparty ?? d.partner ?? null, acc: d.accessionNo ?? null,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const tabs = [
    { label: 'Past Offerings', n: pastOfferings.length },
    { label: 'Shelf Regs', n: registrations.length },
    { label: 'Recent Filings', n: filings.length },
    { label: 'Shares & Float', n: sharesHistory.length },
    { label: 'Ownership', n: insiders.length },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        {tabs.map((t, i) => (
          <button key={t.label} onClick={() => setTab(i)}
            className={`relative px-4 py-2.5 text-xs font-medium uppercase tracking-wide transition-colors ${
              tab === i ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {t.label}
            <span className="ml-1.5 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">{t.n}</span>
            {tab === i && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-amber-400" />}
          </button>
        ))}
      </div>

      {/* Tab 0: Past Offerings (default) */}
      {tab === 0 && (pastOfferings.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 text-right font-medium">Shares</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Underwriter</th>
            </tr></thead>
            <tbody>
              {pastOfferings.map((o, i) => (
                <tr key={i} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{(() => { const u = secUrl(o.acc); return u ? <a href={u} target="_blank" rel="noreferrer" className="hover:text-zinc-200 hover:underline">{o.date || '—'}</a> : (o.date || '—'); })()}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      o.type === 'atm' ? 'bg-red-500/15 text-red-400' :
                      o.type === 'underwritten' ? 'bg-blue-500/15 text-blue-400' :
                      o.type === 'SEPA draw' ? 'bg-purple-500/15 text-purple-400' :
                      /^(S-\d|F-\d)/.test(o.type) ? 'bg-amber-500/15 text-amber-300' :
                      'bg-zinc-700 text-zinc-300'}`}>{o.type}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300">{o.shares != null ? fmtNum(o.shares) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300">{o.price != null ? '$' + o.price.toFixed(o.price < 1 ? 4 : 2) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-emerald-400">{o.amount != null ? fmtMoney(o.amount) : '—'}</td>
                  <td className="px-3 py-2 text-zinc-600">{o.underwriter ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-zinc-600">No offerings or SEPA draws on file.</div>
      ))}

      {/* Tab 2: Recent Filings */}
      {tab === 2 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Form</th>
              <th className="px-3 py-2 font-medium">Tags</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2"></th>
            </tr></thead>
            <tbody>
              {filings.map((f: Filing) => (
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
                            <span key={t} title={meta.tooltip}
                              className={`rounded border px-1.5 py-0.5 text-[10px] ${TAG_STYLES[meta.color]}`}
                            >{meta.label}</span>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="max-w-md px-3 py-2 text-zinc-400">{f.primaryDesc ?? '—'}</td>
                  <td className="px-3 py-2">
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-zinc-300">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Shares & Float */}
      {tab === 3 && (
        <div className="p-4">
          {/* Public float — the headline number for this tab. Prefer SEC cover
              (authoritative, ~18% coverage); fall back to COMPUTED
              (outstanding − insiders) which fills the other 82%. */}
          {(() => {
            const pf = snapshot?.publicFloat;
            const cf = snapshot?.computedFloat;
            const floatShares = pf?.shares ?? cf?.shares ?? null;
            const outstanding = cf?.outstanding ?? sharesHistory[0]?.outstanding ?? null;
            if (floatShares == null) return null;
            const floatPct = outstanding && outstanding > 0 ? (floatShares / outstanding) * 100 : null;
            return (
              <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Public float
                  {pf ? (
                    <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">SEC cover</span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">computed</span>
                  )}
                </div>
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                  <div>
                    <div className="text-3xl font-bold text-zinc-100">{fmtNum(floatShares)}</div>
                    <div className="text-xs text-zinc-500">shares {floatPct != null ? `· ${floatPct.toFixed(1)}% of outstanding` : ''}</div>
                  </div>
                  {cf && (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
                      <span>{fmtNum(cf.outstanding)} outstanding</span>
                      <span className="text-amber-400/80">− {fmtNum(cf.insiderShares)} insider</span>
                      <span className="text-emerald-400">= {fmtNum(floatShares)} float</span>
                    </div>
                  )}
                  {pf && pf.value > 0 && (
                    <div className="text-xs text-zinc-500">{fmtMoney(pf.value)} non-affiliate mkt value · as of {pf.asOf}</div>
                  )}
                </div>
                {!pf && cf && (
                  <div className="mt-2 text-[10px] text-zinc-600">Computed = shares outstanding − aggregate insider holdings (Form 4 afterShares). Excludes non-filing institutions; approximate.</div>
                )}
              </div>
            );
          })()}
          {/* Summary row — latest outstanding, authorized, dilution velocity */}
          <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-2">
            {sharesHistory[0] && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Shares outstanding</div>
                <div className="text-2xl font-bold text-zinc-100">{fmtNum(sharesHistory[0].outstanding)}</div>
                <div className="text-xs text-zinc-500">as of {sharesHistory[0].period}</div>
              </div>
            )}
            {authorized && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Authorized</div>
                <div className="text-lg font-semibold text-zinc-300">{fmtNum(authorized.authorized)}</div>
                <div className="text-xs text-zinc-500">{fmtNum(authorized.available)} avail to issue</div>
              </div>
            )}
            {sharesHistory.length >= 2 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">YoY growth</div>
                {(() => {
                  const yoy = ((sharesHistory[0].outstanding - sharesHistory[1].outstanding) / sharesHistory[1].outstanding) * 100;
                  if (yoy < -30) return <div className="text-lg font-bold text-amber-400">Reverse split</div>;
                  return (
                    <div className={`text-lg font-bold ${yoy > 50 ? 'text-red-400' : yoy > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {yoy > 0 ? '+' : ''}{yoy.toFixed(0)}%
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          {reverseSplits.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {reverseSplits.map((rs: any) => (
                <span key={rs.accessionNo} className="rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-400">
                  {rs.executionDate ?? rs.announcementDate}: {rs.ratio} reverse split
                </span>
              ))}
            </div>
          )}
          {/* History table — the dilution trend, period by period */}
          {sharesHistory.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 text-right font-medium">Outstanding</th>
                  <th className="px-3 py-2 text-right font-medium">Δ vs prior</th>
                </tr></thead>
                <tbody>
                  {sharesHistory.map((s, i) => {
                    const prev = sharesHistory[i + 1];
                    const delta = prev ? ((s.outstanding - prev.outstanding) / prev.outstanding) * 100 : null;
                    return (
                      <tr key={s.period} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40">
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{s.period}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-zinc-200">{fmtNum(s.outstanding)}</td>
                        <td className={`whitespace-nowrap px-3 py-2 text-right ${delta == null ? 'text-zinc-600' : delta > 50 ? 'text-red-400' : delta > 5 ? 'text-amber-400' : delta < -30 ? 'text-amber-400' : 'text-zinc-500'}`}>
                          {delta == null ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(1) + '%'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 text-[10px] text-zinc-600">
                Float = outstanding − restricted/insider shares. Exact float needs 13F/proxy data; the outstanding trend above is the SEC-reported dilution signal.
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-zinc-600">No share history on file.</div>
          )}
        </div>
      )}

      {/* Tab 4: Ownership — insider holdings from Form 4, or transaction
          activity when holdings aren't reportable (afterShares null, e.g.
          option grants). Many micro-caps have Form 4 sales but no holding
          figure — showing the transaction log fills the tab with real signal. */}
      {tab === 4 && (
        <div className="p-4">
          {insiders.length ? (
            <>
              <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Insider holdings</div>
                  <div className="text-2xl font-bold text-zinc-100">{fmtNum(insiders.reduce((a, x) => a + x.shares, 0))}</div>
                  {outstandingRef && <div className="text-xs text-zinc-500">{((insiders.reduce((a, x) => a + x.shares, 0) / outstandingRef) * 100).toFixed(1)}% of {fmtNum(outstandingRef)} out</div>}
                </div>
                <div className="text-[11px] text-zinc-600">Latest reported holding per person, from Form 4 transactions. Institutional (13F) data not pulled.</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="px-3 py-2 font-medium">Reporter</th>
                    <th className="px-3 py-2 text-right font-medium">Shares</th>
                    <th className="px-3 py-2 text-right font-medium">% out</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Last txn</th>
                  </tr></thead>
                  <tbody>
                    {insiders.slice(0, 25).map((x, i) => (
                      <tr key={i} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-zinc-200">{x.name}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-zinc-300">{fmtNum(x.shares)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">{outstandingRef ? ((x.shares / outstandingRef) * 100).toFixed(2) + '%' : '—'}</td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${x.isOfficer ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-700 text-zinc-400'}`}>{x.isOfficer ? 'Officer' : 'Director'}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{x.latest}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : form4.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Insider transactions</div>
                  <div className="text-2xl font-bold text-zinc-100">{form4.length}</div>
                  <div className="text-xs text-zinc-500">Form 4 filings on record</div>
                </div>
                <div className="text-[11px] text-zinc-600">Holdings not reportable (afterShares null), but transaction activity below.</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Reporter</th>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 text-right font-medium">Shares</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                  </tr></thead>
                  <tbody>
                    {form4.slice(0, 25).map((t, i) => (
                      <tr key={i} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40">
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{t.txnDate}</td>
                        <td className="px-3 py-2 text-zinc-200">{t.reporter}</td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.dilutive ? 'bg-red-500/15 text-red-300' : 'bg-zinc-700 text-zinc-400'}`}>{t.txnCode}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-300">{t.securities ? fmtNum(t.securities) : '—'}</td>
                        <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.isOfficer ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-700 text-zinc-400'}`}>{t.isOfficer ? 'Officer' : 'Director'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-zinc-600">No Form 4 insider transactions on file. (Micro-caps often have sparse insider reporting.)</div>
          )}
        </div>
      )}
    </div>
  );
}

// Decode residual HTML entities + tags from SEC filing clause text so the
// UI never shows raw &ldquo;/&rdquo;/&quot; garbage.
function decodeEnt(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&ldquo;|&#8220;/gi, '"')
    .replace(/&rdquo;|&#8221;/gi, '"')
    .replace(/&lsquo;|&rsquo;|&#8217;|&#8216;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&hellip;|&#8230;/gi, '…')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Plain-English one-liner TLDR synthesized from the structured fields —
// replaces the truncated mid-sentence clause as the at-a-glance summary.
function programTldr(pr: any): string {
  const type: Record<string, string> = {
    atm: 'ATM equity facility',
    'equity-line': 'Standing equity line (SEPA)',
    convertible: 'Convertible note facility',
    'promissory-note': 'Promissory note',
    'warrant-offering': 'Warrant offering',
  };
  const parts: string[] = [type[pr.programType] ?? pr.programType];
  if (pr.counterparty) parts.push(`with ${pr.counterparty}`);
  if (pr.maxCommitment != null) parts.push(`up to $${(pr.maxCommitment / 1e6).toFixed(0)}M`);
  if (pr.pricing) parts.push(`priced ${pr.pricing}`);
  if (pr.maturity) parts.push(`matures ${pr.maturity}`);
  if (pr.drawCapPerPeriod) parts.push(`draw cap ${pr.drawCapPerPeriod}`);
  if (pr.ownershipCap != null) parts.push(`${pr.ownershipCap}% ownership cap`);
  return parts.filter(Boolean).join(' · ');
}

// Expandable program card: header (type + who + date + TLDR) always visible,
// click reveals a structured terms grid + the full decoded source clause.
// Fixes: double-$$ bug, undecoded HTML entities, mid-sentence truncation,
// no drill-down.
function ProgramCard({ pr, snap }: { pr: any; snap?: any }) {
  const [open, setOpen] = useState(false);
  const label: Record<string, string> = { atm: 'ATM Offering', 'equity-line': 'Equity Line / SEPA', convertible: 'Convertible Note', 'promissory-note': 'Promissory Note', 'warrant-offering': 'Warrant Offering', 'material-agreement': 'Material Agreement' };
  const tone: Record<string, string> = { atm: 'red', 'equity-line': 'red', convertible: 'amber', 'promissory-note': 'amber', 'warrant-offering': 'blue', 'material-agreement': 'zinc' };
  const t = tone[pr.programType] ?? 'zinc';
  const tc = t === 'red' ? 'border-red-500/20 bg-red-500/5' : t === 'amber' ? 'border-amber-500/20 bg-amber-500/5' : t === 'blue' ? 'border-blue-500/20 bg-blue-500/5' : 'border-zinc-700 bg-zinc-800/40';
  const bc = t === 'red' ? 'bg-red-500/20 text-red-400' : t === 'amber' ? 'bg-amber-500/20 text-amber-400' : t === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-700 text-zinc-300';

  const px = snap?.inTheMoney?.price ?? null;
  const now = Date.now();
  const DAY = 86_400_000;
  const draws = snap?.draws ?? [];

  // Match draws to this program type (ATM / equity-line / convertible)
  const typeDraws = draws.filter((d: any) => {
    if (pr.programType === 'atm') return d.facilityType === 'atm';
    if (pr.programType === 'equity-line') return d.facilityType === 'equity-line';
    if (pr.programType === 'convertible') return d.facilityType === 'convertible';
    return false;
  });
  const lastDraw = typeDraws.filter((d: any) => d.date).sort((a: any, b: any) => Date.parse(b.date) - Date.parse(a.date))[0];
  const totalDrawn = typeDraws.reduce((a: number, d: any) => a + (d.amount ?? 0), 0);

  // Relative date helper
  const relDate = (ds: string) => {
    if (!ds) return null;
    const days = Math.floor((now - Date.parse(ds)) / DAY);
    if (isNaN(days)) return null;
    if (days < 0) return 'upcoming';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.round(days / 30)}mo ago`;
    return `${(days / 365).toFixed(1)}yr ago`;
  };
  const filedRel = pr.filingDate ? relDate(pr.filingDate) : null;
  const lastActRel = lastDraw?.date ? relDate(lastDraw.date) : null;
  const lastActivity = lastActRel ?? filedRel;
  const isRecent = lastActRel != null && lastDraw!.date && (now - Date.parse(lastDraw!.date)) < 90 * DAY;

  // Shares available at current price
  const sharesAvail = px != null && pr.maxCommitment != null && pr.maxCommitment > 0 ? Math.round(pr.maxCommitment / px) : null;
  const remaining = pr.maxCommitment != null && totalDrawn > 0 ? pr.maxCommitment - totalDrawn : null;

  // Warrant offering tranche breakdown from description (424B5 path)
  const trancheText = pr.programType === 'warrant-offering' ? decodeEnt(pr.description) : null;

  const clause = decodeEnt(pr.description);
  const terms: [string, string | null | undefined][] = [
    ['Max commitment', pr.maxCommitment != null ? `$${(pr.maxCommitment / 1e6).toFixed(1)}M` : null],
    ['Shares avail', sharesAvail != null ? `${fmtNum(sharesAvail)} @ $${px}` : null],
    ['Drawn', totalDrawn > 0 ? `$${(totalDrawn / 1e6).toFixed(1)}M (${typeDraws.length} draws)` : null],
    ['Remaining', remaining != null ? `$${(remaining / 1e6).toFixed(1)}M` : null],
    ['Pricing', pr.pricing],
    ['Ownership cap', pr.ownershipCap != null ? `${pr.ownershipCap}%` : null],
    ['Maturity', pr.maturity],
    ['Draw cap', pr.drawCapPerPeriod],
    ['Originally filed', pr.filingDate ? `${pr.filingDate}${filedRel ? ` (${filedRel})` : ''}` : null],
    ['Last activity', lastActivity ? (lastDraw?.date ? `${lastActRel} — draw` : filedRel) : null],
    ['Securities', pr.securities?.length ? pr.securities.join(', ') : null],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <div className={`rounded border ${tc}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 p-2 text-left hover:bg-white/[0.02]">
        <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${bc}`}>{label[pr.programType] ?? pr.programType}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
            {pr.counterparty && <span className="font-medium text-zinc-200">{pr.counterparty}</span>}
            {pr.filingDate && <span className="text-zinc-600">{pr.filingDate}</span>}
            {pr.maxCommitment != null && <span className="text-zinc-400">· ${(pr.maxCommitment / 1e6).toFixed(0)}M max</span>}
            {lastActivity && (
              <span className={`rounded px-1 text-[9px] font-medium ${isRecent ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-700/50 text-zinc-500'}`}>
                {isRecent ? '◆ active' : '○'} {lastActivity}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-zinc-400">{programTldr(pr)}</div>
        </div>
        <svg className={`mt-1 h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="border-t border-zinc-700/50 px-2 pb-2 pt-2">
          {terms.length > 0 && (
            <div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-3">
              {terms.map(([k, v]) => (
                <div key={k}><span className="text-zinc-600">{k}: </span><span className="text-zinc-300">{v}</span></div>
              ))}
            </div>
          )}
          {trancheText && (
            <div className="mb-2 rounded bg-zinc-950/40 p-1.5 text-[10px] text-zinc-400">
              <span className="text-zinc-600">Tranches: </span>{trancheText}
            </div>
          )}
          {clause && pr.programType !== 'warrant-offering' && (
            <details className="group" open>
              <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-300">Source clause</summary>
              <div className="mt-1 max-h-48 overflow-y-auto rounded bg-zinc-950/50 p-2 text-[10px] leading-relaxed text-zinc-400">{clause}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// Tier 1 — "usable now" summary. Per mechanism type, computes a headline
// number (capacity/size) + activity insights (usage frequency, recency,
// availability). Activity > moneyness: an OTM warrant filed yesterday matters
// more than an ITM one from 2019. This replaces truncated clause fragments
// with synthesized plain-language status.
function dilutionCapacityCards(snap: any) {
  const cards: { type: string; label: string; headline: string; sub: string; insights: string[]; tone: string }[] = [];
  const px = snap?.inTheMoney?.price ?? null;
  const now = Date.now();
  const DAY = 86_400_000;
  const c6mo = now - 180 * DAY;
  const c90 = now - 90 * DAY;

  // ATM / shelf — registered capacity + draws
  const sh = snap?.shelfRemaining;
  const atmRegs = (snap?.registrations ?? []).filter((r: any) => r.salesChannel === 'atm' || r.formType === 'S-3' || r.formType === 'S-3ASR');
  if ((sh && sh.registered > 0) || atmRegs.length > 0) {
    const reg = sh?.registered ?? atmRegs.reduce((a: number, r: any) => a + (r.aggregateOffering ?? 0), 0);
    const sold = sh?.raised ?? 0;
    const left = sh?.remaining ?? Math.max(0, reg - sold);
    const ins: string[] = [];
    if (sold > 0) ins.push(`$${(sold / 1e6).toFixed(1)}M sold`);
    const atmDraws = (snap?.draws ?? []).filter((d: any) => d.facilityType === 'atm');
    const d6 = atmDraws.filter((d: any) => d.date && Date.parse(d.date) >= c6mo);
    if (d6.length > 0) ins.push(`Tapped ${d6.length}× in 6mo` + (d6.length >= 4 ? ' — heavy use' : ''));
    const latest = atmRegs.sort((a: any, b: any) => Date.parse(b.filingDate) - Date.parse(a.filingDate))[0];
    if (latest) { const d = now - Date.parse(latest.filingDate); ins.push(d < 90 * DAY ? 'Recently filed' : `Filed ${latest.filingDate.slice(0, 10)}`); }
    if (left <= 0 && reg > 0) ins.push('Exhausted');
    cards.push({ type: 'atm', label: 'ATM / Shelf', headline: reg > 0 ? `$${(left / 1e6).toFixed(1)}M` : '—', sub: reg > 0 ? `of $${(reg / 1e6).toFixed(0)}M registered` : `${atmRegs.length} filings`, insights: ins, tone: left > 0 ? 'orange' : 'zinc' });
  }

  // Equity lines / SEPA — standing facilities
  const eqLines = [...(snap?.warrantNotes?.equityLines ?? []), ...((snap?.programs ?? []).filter((p: any) => p.programType === 'equity-line'))];
  if (eqLines.length > 0) {
    const eqMax = eqLines.reduce((a: number, e: any) => a + (e.maxCommitment ?? 0), 0);
    const eqDraws = (snap?.draws ?? []).filter((d: any) => d.facilityType === 'equity-line');
    const eqDrawn = eqDraws.reduce((a: number, d: any) => a + (d.amount ?? 0), 0);
    const eqLeft = eqMax > 0 ? Math.max(0, eqMax - eqDrawn) : 0;
    const ins: string[] = [];
    const d6 = eqDraws.filter((d: any) => d.date && Date.parse(d.date) >= c6mo);
    if (d6.length > 0) { ins.push(`Used ${d6.length}× in 6mo` + (d6.length >= 5 ? ' — frequently' : '')); }
    else if (eqDrawn > 0) ins.push('No recent draws');
    if (eqDrawn > 0) ins.push(`$${(eqDrawn / 1e6).toFixed(1)}M drawn total`);
    // recency of agreement
    const progDates = (snap?.programs ?? []).filter((p: any) => p.programType === 'equity-line' && p.filingDate).map((p: any) => Date.parse(p.filingDate));
    if (progDates.length) { const latest = Math.max(...progDates); ins.push(now - latest < 90 * DAY ? 'Recently filed' : 'Active facility'); }
    cards.push({ type: 'equity-line', label: 'Equity Line / SEPA', headline: eqMax > 0 ? `$${(eqLeft / 1e6).toFixed(1)}M` : `${eqLines.length}`, sub: eqMax > 0 ? `of $${(eqMax / 1e6).toFixed(0)}M max` : `${eqLines.length} active`, insights: ins, tone: eqLeft > 0 ? 'red' : 'zinc' });
  }

  // Warrants — active tranches, ITM + near-money + overhang
  const wnWarr = snap?.warrantNotes?.warrants ?? [];
  const regWarr = (snap?.offerings ?? []).flatMap((o: any) => o.warrantTranches ?? []);
  const allWarr = [...wnWarr, ...regWarr];
  const warrShares = allWarr.reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
  if (warrShares > 0) {
    const isActive = (w: any) => { const ex = w.expiry ?? w.exercisable; return !ex || ex === 'N/A' || Date.parse(ex) > now; };
    const active = allWarr.filter(isActive);
    const itm = active.filter((w: any) => { const st = w.strike ?? w.exercisePrice; return st != null && px != null && px >= st; });
    const near = active.filter((w: any) => { const st = w.strike ?? w.exercisePrice; return st != null && px != null && px >= st * 0.8 && px < st; });
    const itmShares = itm.reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
    const nearShares = near.reduce((a: number, w: any) => a + (w.shares ?? 0), 0);
    const ins: string[] = [`${active.length} active`];
    if (itmShares > 0) ins.push(`${fmtNum(itmShares)} ITM`);
    if (nearShares > 0) ins.push(`${fmtNum(nearShares)} near-money`);
    const strikes = active.map((w: any) => w.strike ?? w.exercisePrice).filter((x: any): x is number => typeof x === 'number');
    if (strikes.length) ins.push(`$${Math.min(...strikes).toFixed(2)}–$${Math.max(...strikes).toFixed(2)}`);
    const oh = snap?.overhang?.warrant;
    if (oh?.intrinsicPct != null) ins.push(`${oh.intrinsicPct.toFixed(1)}% overhang`);
    cards.push({ type: 'warrant', label: 'Warrants', headline: `${fmtNum(warrShares)} sh`, sub: `${active.length} active · ${allWarr.length - active.length} expired`, insights: ins, tone: itmShares > 0 ? 'red' : nearShares > 0 ? 'amber' : 'blue' });
  }

  // Convertibles
  const convs = snap?.warrantNotes?.convertibles ?? [];
  const convProgs = (snap?.programs ?? []).filter((p: any) => p.programType === 'convertible');
  const convShares = convs.reduce((a: number, c: any) => a + (c.shares ?? 0), 0);
  if (convShares > 0 || convProgs.length > 0) {
    const ins: string[] = [];
    const oh = snap?.overhang?.convertible;
    if (oh?.itm) ins.push('In the money');
    if (oh?.strike != null) ins.push(`@ $${oh.strike.toFixed(2)}`);
    if (oh?.intrinsicPct != null) ins.push(`${oh.intrinsicPct.toFixed(1)}% intrinsic`);
    if (convProgs.length > 0) ins.push(`${convProgs.length} agreement${convProgs.length > 1 ? 's' : ''}`);
    cards.push({ type: 'convertible', label: 'Convertibles', headline: convShares > 0 ? `${fmtNum(convShares)} sh` : `${convProgs.length} filed`, sub: convProgs.length > 0 ? `${convProgs.length} agreement${convProgs.length > 1 ? 's' : ''}` : '', insights: ins, tone: oh?.itm ? 'red' : 'purple' });
  }

  return cards;
}

// Tier 3 — Dilution tendencies. Computes CONCRETE dilution metrics from
// actual data: total raised, shares issued, growth rate, offering frequency,
// preferred mechanism. Lens-aware: 60d / 6mo / 1yr / all filter date ranges.
type Lens = '60d' | '6mo' | '1yr' | 'all';
const LENS_DAYS: Record<Lens, number> = { '60d': 60, '6mo': 180, '1yr': 365, all: 99999 };

function dilutionTendencies(snap: any, lens: Lens = '1yr') {
  const now = Date.now();
  const DAY = 86_400_000;
  const cutoff = now - LENS_DAYS[lens] * DAY;
  const lensLabel = lens === 'all' ? 'all-time' : `last ${lens}`;
  const ins: { label: string; value: string; detail?: string; tone: string }[] = [];

  const offeringsAll = snap?.offerings ?? [];
  const drawsAll = snap?.draws ?? [];
  const filings = snap?.filings ?? [];
  // Filter events to the lens window
  const inLens = (d: string | undefined) => d != null && Date.parse(d) >= cutoff;
  const offerings = offeringsAll.filter((o: any) => inLens(o.filingDate));
  const draws = drawsAll.filter((d: any) => inLens(d.date ?? d.filingDate));
  const reverseSplits = (snap?.reverseSplits ?? []).filter((r: any) => inLens(r.executionDate ?? r.announcementDate));
  const form4 = ((snap?.form4Txns ?? []) as { txnDate: string; securities: number; dilutive: boolean }[]).filter((t) => t.dilutive && inLens(t.txnDate));
  const cash = snap?.cash;
  const sharesHistory = (snap?.sharesHistory ?? []) as { period: string; outstanding: number }[];

  // 1. TOTAL raised in lens — offerings + draws
  const offTotal = offerings.reduce((a: number, o: any) => a + (o.grossProceeds ?? 0), 0);
  const drawTotal = draws.reduce((a: number, d: any) => a + (d.amount ?? d.proceeds ?? 0), 0);
  const raisedLens = offTotal + drawTotal;
  const eventsLens = offerings.length + draws.length;
  if (raisedLens > 0 || eventsLens > 0) {
    ins.push({
      label: `Raised (${lensLabel})`,
      value: fmtMoney(raisedLens),
      detail: `${eventsLens} raise${eventsLens !== 1 ? 's' : ''}`,
      tone: eventsLens >= 8 ? 'red' : eventsLens >= 3 ? 'amber' : 'zinc',
    });
  } else {
    ins.push({ label: `Raised (${lensLabel})`, value: '$0', detail: 'no raises', tone: 'zinc' });
  }

  // 2. SHARES issued via dilution in lens
  const shOffered = offerings.reduce((a: number, o: any) => a + (o.sharesOffered ?? 0), 0);
  const shDrawn = draws.reduce((a: number, d: any) => a + (d.shares ?? 0), 0);
  const sharesIssued = shOffered + shDrawn;
  if (sharesIssued > 0) {
    ins.push({ label: 'Shares issued', value: fmtNum(sharesIssued) + ' sh', detail: lensLabel, tone: 'amber' });
  }

  // 3. SHARE GROWTH — compare newest vs point at start of lens window
  if (sharesHistory.length >= 2) {
    const sorted = [...sharesHistory].sort((a, b) => Date.parse(a.period) - Date.parse(b.period));
    const newest = sorted[sorted.length - 1];
    // oldest WITHIN the lens window (or the one just before it)
    const baseline = [...sorted].reverse().find((p) => Date.parse(p.period) <= cutoff) ?? sorted[0];
    if (baseline.outstanding > 0 && baseline.outstanding !== newest.outstanding) {
      const growth = ((newest.outstanding - baseline.outstanding) / baseline.outstanding) * 100;
      ins.push({
        label: 'Share growth',
        value: `${growth > 0 ? '+' : ''}${growth.toFixed(0)}%`,
        detail: lensLabel,
        tone: growth > 200 ? 'red' : growth > 50 ? 'amber' : 'zinc',
      });
    }
  }

  // 4. PREFERRED MECHANISM — most-used facility type in lens
  const facCounts: Record<string, number> = {};
  const facAmt: Record<string, number> = {};
  offerings.forEach((o: any) => { const t = o.offeringType ?? o.formType ?? 'unknown'; facCounts[t] = (facCounts[t] ?? 0) + 1; facAmt[t] = (facAmt[t] ?? 0) + (o.grossProceeds ?? 0); });
  draws.forEach((d: any) => { const t = d.facilityType ?? 'draw'; facCounts[t] = (facCounts[t] ?? 0) + 1; facAmt[t] = (facAmt[t] ?? 0) + (d.amount ?? 0); });
  const topFac = Object.entries(facCounts).sort((a, b) => b[1] - a[1])[0];
  if (topFac && topFac[1] > 0) {
    const nameMap: Record<string, string> = { 'equity-line': 'SEPA / Equity Line', atm: 'ATM Shelf', convertible: 'Convertibles', 'promissory-note': 'Promissory Notes', underwritten: 'Underwritten' };
    ins.push({ label: 'Go-to mechanism', value: nameMap[topFac[0]] ?? topFac[0], detail: `${topFac[1]}×`, tone: 'red' });
  }

  // 5. REVERSE SPLITS in lens
  if (reverseSplits.length > 0) {
    const last = [...reverseSplits].sort((a: any, b: any) => Date.parse(b.executionDate ?? b.announcementDate) - Date.parse(a.executionDate ?? a.announcementDate))[0];
    ins.push({ label: 'Reverse splits', value: `${reverseSplits.length}×`, detail: last.ratio ?? '', tone: reverseSplits.length >= 2 ? 'red' : 'amber' });
  }

  // 6. INSIDER selling in lens
  if (form4.length > 0) {
    const sh = form4.reduce((a, t) => a + t.securities, 0);
    ins.push({ label: 'Insider selling', value: `${form4.length} sale${form4.length !== 1 ? 's' : ''}`, detail: fmtNum(sh) + ' sh', tone: 'amber' });
  }

  // 7. CAPITAL CYCLE — runway pressure (lens-independent, always relevant)
  if (cash?.monthlyCashFlow != null && cash.monthlyCashFlow < 0 && cash.projectedCash != null) {
    const monthsLeft = cash.projectedCash / Math.abs(cash.monthlyCashFlow);
    ins.push({ label: 'Runway', value: monthsLeft < 12 ? `${monthsLeft.toFixed(0)}mo left` : 'Funded', detail: fmtMoney(cash.projectedCash) + ' cash', tone: monthsLeft < 6 ? 'red' : monthsLeft < 12 ? 'amber' : 'zinc' });
  }

  // 8. COMPLIANCE — late filings in lens
  const late = filings.filter((f: any) => /^NT-10/.test(f.formType) && inLens(f.filingDate));
  if (late.length > 0) {
    ins.push({ label: 'Late filings', value: `${late.length} NT notice${late.length !== 1 ? 's' : ''}`, detail: 'Failed to file on time', tone: 'red' });
  }
  if (snap?.compliance) {
    ins.push({ label: 'Listing compliance', value: snap.compliance.failures === 0 ? 'PASSING' : `${snap.compliance.failures} FAIL`, detail: snap.compliance.tier, tone: snap.compliance.failures === 0 ? 'zinc' : snap.compliance.failures === 1 ? 'amber' : 'red' });
  }

  return ins;
}

// Detailed dilution tendencies — event timeline table. Merges offerings,
// draws, and reverse splits into one chronologically-sorted feed within the
// selected lens. This is the drill-down beneath the summary cards.
function dilutionEvents(snap: any, lens: Lens = '1yr') {
  const now = Date.now();
  const DAY = 86_400_000;
  const cutoff = now - LENS_DAYS[lens] * DAY;
  const events: { date: string; type: string; amount: string; detail: string; tone: string }[] = [];
  const inLens = (d: string | undefined) => d != null && Date.parse(d) >= cutoff;
  (snap?.offerings ?? []).forEach((o: any) => {
    if (!inLens(o.filingDate)) return;
    events.push({ date: o.filingDate, type: 'Offering', amount: o.grossProceeds ? fmtMoney(o.grossProceeds) : '—', detail: `${o.formType ?? ''}${o.underwriter ? ' · ' + o.underwriter : ''}${o.sharesOffered ? ' · ' + fmtNum(o.sharesOffered) + ' sh' : ''}`, tone: 'amber' });
  });
  (snap?.draws ?? []).forEach((d: any) => {
    const dd = d.date ?? d.filingDate;
    if (!inLens(dd)) return;
    events.push({ date: dd, type: d.facilityType === 'atm' ? 'ATM Draw' : d.facilityType === 'equity-line' ? 'SEPA Draw' : d.facilityType === 'convertible' ? 'Convert Draw' : 'Draw', amount: d.amount ? fmtMoney(d.amount) : '—', detail: `${d.shares ? fmtNum(d.shares) + ' sh' : ''}${d.price ? ' @ $' + d.price.toFixed(2) : ''}`.trim() || '—', tone: 'red' });
  });
  (snap?.reverseSplits ?? []).forEach((r: any) => {
    const dd = r.executionDate ?? r.announcementDate;
    if (!inLens(dd)) return;
    events.push({ date: dd, type: 'Reverse Split', amount: r.ratio ?? '—', detail: r.announcementDate ?? '', tone: 'zinc' });
  });
  (snap?.form4Txns ?? []).filter((t: any) => t.dilutive).forEach((t: any) => {
    if (!inLens(t.txnDate)) return;
    events.push({ date: t.txnDate, type: 'Insider Sale', amount: fmtNum(t.securities) + ' sh', detail: t.reportingOwner ?? '', tone: 'amber' });
  });
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export default function DilutionPage() {
  const [input, setInput] = useState('AAPL');
  const [ticker, setTicker] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true); // true on mount → immediate spinner, proves page mounted
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('all');
  const [tendenciesLens, setTendenciesLens] = useState<'60d' | '6mo' | '1yr' | 'all'>('all');
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
          warrants: (snapshot.warrants ?? []).map((w: any) => ({
            shares: w.shares, strike: w.strike, expiry: w.expiry,
            exercisable: w.exercisable, status: w.status, description: w.description,
          })),
          convertibles: (snapshot.convertibles ?? []).map((c: any) => ({
            principal: c.principal, conversionPrice: c.conversionPrice, shares: c.shares,
            maturity: c.maturity, status: c.status,
          })),
          // Wire the named sub-score inputs that were previously dropped —
          // without these the rating showed 'No burn data' / 'Compliance data
          // unavailable' even though the snapshot carried both.
          runwayMonths: snapshot.cash?.cashRemainingMonths ?? null,
          cashValue: snapshot.cash?.estimatedCash ?? null,
          monthlyBurn: snapshot.cash?.monthlyCashFlow ?? null,
          compliance: snapshot.compliance ?? null,
          draws: (snapshot.draws ?? []).map((d: any) => ({
            amount: d.amount, shares: d.shares, facilityType: d.facilityType, date: d.date,
          })),
          programs: (snapshot.programs ?? []).map((p: any) => ({
            programType: p.programType, maxCommitment: p.maxCommitment,
            filingDate: p.filingDate, counterparty: p.counterparty,
          })),
          publicFloat: snapshot.publicFloat ?? null,
          price: snapshot.inTheMoney?.price ?? null,
        },
      )
    : null;

  // Equity-line remaining capacity = Σ facility max − Σ equity-line draws.
  // Per-facility draw attribution is unreliable (draws carry a generic
  // facilityName like 'SEPA', not the counterparty), so this is an honest
  // aggregate across all standing equity-line facilities — matches Nexus's
  // 'Raised So Far / Remaining' at the section level.
  const eqLineMax = [...(snapshot?.warrantNotes?.equityLines ?? []), ...((snapshot?.programs ?? []).filter((p: any) => p.programType === 'equity-line'))]
    .reduce((s: number, e: any) => s + (e.maxCommitment ?? 0), 0);
  const eqLineDrawn = (snapshot?.draws ?? [])
    .filter((d: any) => d.facilityType === 'equity-line')
    .reduce((s: number, d: any) => s + (d.amount ?? 0), 0);
  const eqLineRemaining = eqLineMax > 0 ? Math.max(0, eqLineMax - eqLineDrawn) : null;

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
    <div className="relative z-0 min-h-screen bg-zinc-950 pt-14 text-zinc-100">
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
          <a href="/dilution/scan" className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">Scan all →</a>
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
                {/* Market data (Polygon) — price + market cap + day volume */}
                {snapshot.inTheMoney?.price != null && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span><span className="text-zinc-500">Price</span> <span className="font-semibold text-zinc-200">${snapshot.inTheMoney.price.toFixed(2)}</span></span>
                    {snapshot.inTheMoney.marketCap != null && <span><span className="text-zinc-500">Mkt cap</span> <span className="font-semibold text-zinc-200">{fmtMoney(snapshot.inTheMoney.marketCap)}</span></span>}
                    {snapshot.inTheMoney.volume != null && <span><span className="text-zinc-500">Vol</span> <span className="font-semibold text-zinc-200">{fmtNum(snapshot.inTheMoney.volume)}</span></span>}
                  </div>
                )}
                {/* Float — SEC public float (cover) or computed (outstanding − restricted).
                    Critical for baby-shelf / WKSI classification + dilution math. */}
                {(() => {
                  const pxF = snapshot.inTheMoney?.price ?? null;
                  const fv = snapshot.publicFloat?.value ?? (snapshot.computedFloat?.shares != null && pxF != null ? snapshot.computedFloat.shares * pxF : null);
                  if (fv == null) return null;
                  const asOf = snapshot.publicFloat?.asOf || snapshot.computedFloat?.asOf;
                  return (
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span title="Public float = non-restricted shares × price (SEC cover / computed)">
                        <span className="text-zinc-500">Float</span> <span className="font-semibold text-zinc-200">{fmtNum(snapshot.publicFloat?.shares ?? snapshot.computedFloat?.shares)} sh</span> <span className="text-zinc-400">· {fmtMoney(fv)}</span>
                      </span>
                      {snapshot.sharesLatest?.outstanding != null && (
                        <span title="Shares outstanding (latest SEC cover)">
                          <span className="text-zinc-500">Out</span> <span className="font-semibold text-zinc-200">{fmtNum(snapshot.sharesLatest.outstanding)}</span>
                        </span>
                      )}
                      {asOf && (
                        <span className="text-zinc-600">as of {asOf.slice(0, 10)}</span>
                      )}
                    </div>
                  );
                })()}
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

            {/* Dilution Summary + Rating — the AskEdgar dilution-tracker view */}
            {summary && (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Gauge className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">Dilution rating</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-zinc-100">{summary.rating}</span>
                    <span className="text-xs text-zinc-600">/100</span>
                    <span className="ml-1 text-xs text-zinc-400">{summary.tier} dilution risk</span>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">{summary.bullets.slice(0, 3).join('  ·  ')}</div>
                  {/* Sub-scores — DETAIL-LED: facts lead, no bars/score-numbers/icons. */}
                  {(() => {
                    const sr = summary.subRatings;
                    const rw = snapshot?.cash?.reportedRunwayMonths ?? null;
                    const tw = (s: number) => s <= 20 ? 'Low' : s <= 45 ? 'Moderate' : s <= 70 ? 'High' : 'Toxic';
                    const cashTail = sr.cashNeed.bullets[0]?.split(' · ').slice(1).join(' · ') || '';
                    return (
                      <div className="mt-3 space-y-2.5 border-t border-zinc-800/60 pt-3">
                        {/* Cash snapshot — the numbers that drive the short-bias call:
                            balance, burn, reported + projected runway. Pulled from
                            snapshot.cash (computed in store.ts). */}
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Cash <span className="text-zinc-700">· {tw(sr.cashNeed.score)} need</span>{snapshot?.cash?.acceleratingBurn && <span className="ml-1 text-[9px] font-semibold uppercase text-red-400">accelerating</span>}</div>
                          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
                            <div className="flex items-baseline gap-1">
                              <span className="text-[10px] uppercase text-zinc-600">Balance</span>
                              <span className="font-semibold text-zinc-100">{fmtMoney(snapshot?.cash?.estimatedCash ?? 0)}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[10px] uppercase text-zinc-600">{(snapshot?.cash?.monthlyCashFlow ?? 0) >= 0 ? 'Gen' : 'Burn'}</span>
                              <span className={`font-semibold ${(snapshot?.cash?.monthlyCashFlow ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmtMoney(Math.abs(snapshot?.cash?.monthlyCashFlow ?? 0))}/mo</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[10px] uppercase text-zinc-600">Runway</span>
                              {rw == null ? <span className="text-zinc-500">—</span>
                                : <span className={`font-semibold ${rw <= 0 ? 'text-red-400' : rw <= 6 ? 'text-red-400' : rw <= 12 ? 'text-orange-300' : 'text-emerald-300'}`}>{rw <= 0 ? 'Out of cash' : rw.toFixed(1) + ' mo'}</span>}
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-[10px] uppercase text-zinc-600">Projected</span>
                              {snapshot?.cash?.cashRemainingMonths == null ? <span className="text-zinc-500">—</span>
                                : <span className={`font-semibold ${snapshot.cash.cashRemainingMonths < 6 ? 'text-red-400' : snapshot.cash.cashRemainingMonths < 12 ? 'text-orange-300' : 'text-zinc-300'}`}>{snapshot.cash.cashRemainingMonths.toFixed(1)} mo{snapshot.cash.projectedCash != null && <span className="font-normal text-zinc-600"> · {fmtMoney(snapshot.cash.projectedCash)}</span>}</span>}
                            </div>
                          </div>
                          {cashTail ? <div className="mt-0.5 text-[10px] text-zinc-600">{cashTail}</div> : null}
                        </div>
                        {/* Dilution ability lives in its own dedicated card below —
                            removed the redundant chips row to de-clutter the rating. */}
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Offering frequency</div>
                          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs leading-relaxed">
                            {(() => {
                              const facts: { v: string; s?: string; tone: string }[] = [];
                              const DAY = 86400000;
                              const cutoff90 = Date.now() - 90 * DAY;
                              // Raised in offerings (424B5) — last 90d
                              const off90 = (snapshot as any)?.offerings?.filter((o: any) => Date.parse(o.filingDate) >= cutoff90) ?? [];
                              const raised90 = off90.reduce((a: number, o: any) => a + (o.grossProceeds ?? 0), 0);
                              if (raised90 > 0) facts.push({ v: fmtMoney(raised90) + ' raised', s: off90.length + ' offerings · 90d', tone: 'red' });
                              // ATM / shelf drawn (amount sold off a registration)
                              const sh = (snapshot as any)?.shelfRemaining;
                              if (sh && (sh.raised ?? 0) > 0) facts.push({ v: fmtMoney(sh.raised) + ' drawn off shelf', s: 'of ' + fmtMoney(sh.registered), tone: 'orange' });
                              // SEPA / equity-line draws — 90d
                              const draws90 = (snapshot as any)?.draws?.filter((d: any) => { const dt = d.filingDate ?? d.date; return dt && Date.parse(dt) >= cutoff90; }) ?? [];
                              const drawAmt = draws90.reduce((a: number, d: any) => a + (d.proceeds ?? d.grossAmount ?? d.amount ?? 0), 0);
                              if (drawAmt > 0) facts.push({ v: fmtMoney(drawAmt) + ' SEPA draws', s: draws90.length + ' · 90d', tone: 'purple' });
                              // Reverse split — 12mo
                              const rs = (snapshot as any)?.reverseSplits?.find((r: any) => { const d = r.executionDate ?? r.announcementDate; return d && Date.now() - Date.parse(d) < 365 * DAY; });
                              if (rs) facts.push({ v: 'Reverse split', s: (rs.ratio ?? '') + ' · ' + (rs.executionDate ?? rs.announcementDate), tone: 'amber' });
                              // Equity-line / SEPA facilities — standing capacity
                              const eqLines = [...((snapshot as any)?.warrantNotes?.equityLines ?? []), ...(((snapshot as any)?.programs ?? []).filter((p: any) => p.programType === 'equity-line'))];
                              if (eqLines.length > 0) {
                                const eqMax = eqLines.reduce((a: number, e: any) => a + (e.maxCommitment ?? 0), 0);
                                facts.push({ v: eqLines.length + ' eq line' + (eqLines.length > 1 ? 's' : ''), s: eqMax > 0 ? fmtMoney(eqMax) + ' capacity' : '', tone: 'red' });
                              }
                              // Shelf / ATM registrations — capacity not counted above
                              if (!sh) {
                                const shelfCap = ((snapshot as any)?.registrations ?? []).reduce((a: number, r: any) => a + (r.aggregateOffering ?? 0), 0);
                                if (shelfCap > 0) facts.push({ v: fmtMoney(shelfCap) + ' shelf', s: 'registered', tone: 'orange' });
                              }
                              if (!facts.length) return <span className="text-zinc-500">No recent dilution activity or registered capacity.</span>;
                              return facts.map((f, i) => <span key={i}><span className={`font-semibold ${TONE[f.tone] ?? 'text-zinc-300'}`}>{f.v}</span>{f.s && <span className="text-zinc-500"> {f.s}</span>}</span>);
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Compliance</div>
                          <div className="mt-0.5 text-sm text-zinc-300">{sr.compliance.bullets[0] ?? '—'}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* News — 8-K catalysts + press releases, recency-sorted; last 24h highlighted */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-zinc-400">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wide">News</span>
                    <span className="ml-auto text-[10px] text-zinc-600">8-K catalysts + press</span>
                  </div>
                  {(() => {
                    const news = snapshot?.news ?? [];
                    if (!news.length) return <div className="py-3 text-center text-xs text-zinc-500">No recent news.</div>;
                    const today = new Date().toISOString().slice(0, 10);
                    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    return (
                      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                        {news.map((n, i) => {
                          const recent = n.date === today || n.date === yest;
                          const sec = n.source === 'sec-8k';
                          return (
                            <div key={i} className={`flex items-start gap-2 ${recent ? '-mx-1 rounded bg-amber-500/5 px-1' : ''}`}>
                              <span className="mt-0.5 shrink-0 text-[10px] text-zinc-600">{n.date}</span>
                              <span className={`mt-0.5 shrink-0 rounded px-1 text-[9px] font-semibold uppercase ${sec ? 'bg-blue-500/15 text-blue-300' : 'bg-zinc-700 text-zinc-300'}`}>{sec ? '8-K' : 'news'}</span>
                              <div className="min-w-0">
                                <span className="text-xs leading-snug text-zinc-200">{n.title}</span>
                                {n.url && <a href={n.url} target="_blank" rel="noreferrer" className="ml-1 text-[10px] text-blue-400 hover:underline">↗</a>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  {/* Dilution ability — BIG: what they can sell & where (shelf/SEPA/ATM/converts/warrants). Detail-led, no score. */}
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                    <div className="mb-2 text-xs uppercase tracking-wide text-zinc-400">Dilution ability — what they can sell & where</div>
                    {summary.subRatings.dilutionAbility.bullets.length === 0 ? (
                      <div className="py-3 text-sm text-zinc-500">No tappable dilution facilities detected.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {summary.subRatings.dilutionAbility.bullets.map((bl, i) => {
                          // Parse the leading facility type off each bullet into a
                          // color-coded badge + detail, so a trader can scan
                          // what's tappable at a glance instead of reading prose.
                          const FAC = [
                            { re: /^(ATM\/shelf)\s+active\s*[\u2014-]\s*/i, type: 'ATM/shelf', tone: 'blue' },
                            { re: /^(ATM\b)[\s:][\u2014-]?\s*/i, type: 'ATM', tone: 'blue' },
                            { re: /^(SEPA\s*\/\s*equity\s+line)\s*:\s*/i, type: 'SEPA', tone: 'amber' },
                            { re: /^(equity\s+line)\s*:\s*/i, type: 'Equity line', tone: 'amber' },
                            { re: /^(Convertible)\s*:\s*/i, type: 'Convert', tone: 'purple' },
                            { re: /^(Warrants)\s*:\s*/i, type: 'Warrants', tone: 'red' },
                            { re: /^(S-1)[\s:][\u2014-]?\s*/i, type: 'S-1', tone: 'zinc' },
                            { re: /^(shelf)\b[\s:][\u2014-]?\s*/i, type: 'Shelf', tone: 'blue' },
                          ] as const;
                          let detail = bl;
                          let type: string | null = null;
                          let tone: string = 'zinc';
                          for (const f of FAC) {
                            if (f.re.test(bl)) { detail = bl.replace(f.re, ''); type = f.type; tone = f.tone; break; }
                          }
                          const badgeCls: Record<string, string> = {
                            blue: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
                            amber: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
                            purple: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
                            red: 'bg-red-500/15 text-red-300 border-red-500/20',
                            zinc: 'bg-zinc-700/50 text-zinc-300 border-zinc-600/30',
                          };
                          return (
                            <div key={i} className="flex items-start gap-2">
                              {type ? (
                                <span className={'mt-px shrink-0 rounded border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ' + (badgeCls[tone] ?? badgeCls.zinc)}>{type}</span>
                              ) : (
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                              )}
                              <span className="text-[13px] leading-relaxed text-zinc-300">{detail}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tier 1 — Dilution capacity (usable now). Activity-aware summary:
                      not just ITM, but usage frequency, recency, availability. */}
                  {(() => {
                    const cards = dilutionCapacityCards(snapshot);
                    if (!cards.length) return null;
                    const toneCls: Record<string, string> = {
                      red: 'border-red-500/30 bg-red-500/[0.03]', orange: 'border-orange-500/30 bg-orange-500/[0.03]',
                      amber: 'border-amber-500/30 bg-amber-500/[0.03]', blue: 'border-blue-500/30 bg-blue-500/[0.03]',
                      purple: 'border-purple-500/30 bg-purple-500/[0.03]', zinc: 'border-zinc-700 bg-zinc-800/20',
                    };
                    const txtCls: Record<string, string> = {
                      red: 'text-red-400', orange: 'text-orange-400', amber: 'text-amber-400',
                      blue: 'text-blue-400', purple: 'text-purple-400', zinc: 'text-zinc-400',
                    };
                    return (
                      <div className="mb-4">
                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                          Dilution capacity <span className="text-zinc-700">· usable now</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {cards.map((c, i) => (
                            <div key={i} className={`rounded-lg border p-2.5 ${toneCls[c.tone] ?? toneCls.zinc}`}>
                              <div className={`text-[10px] font-semibold uppercase tracking-wide ${txtCls[c.tone] ?? 'text-zinc-400'}`}>{c.label}</div>
                              <div className="mt-0.5 text-lg font-bold text-zinc-100">{c.headline}</div>
                              {c.sub && <div className="text-[10px] text-zinc-500">{c.sub}</div>}
                              {c.insights.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
                                  {c.insights.map((ins, j) => (
                                    <span key={j} className="text-[10px] text-zinc-400">· {ins}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dilution overview — Nexus-style tables, one per instrument type */}
                  <DilutionOverview snapshot={snapshot} />
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
                  <div className="mt-2 space-y-3">
                    {/* Going-concern banner — substantial-doubt language from the 10-K */}
                    {snapshot.warrantNotes?.goingConcern?.present && (
                      <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">⚠ Going concern</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-red-200/80">{snapshot.warrantNotes.goingConcern.text}</div>
                      </div>
                    )}
                    {/* HERO: runway in months — the headline number for a short-bias view */}
                    <div className="rounded-md border border-zinc-600/60 bg-zinc-800/40 px-4 py-3">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <span>Cash runway</span>
                            <span className="rounded bg-zinc-700 px-1 py-px text-[9px] uppercase tracking-wide text-zinc-300">reported</span>
                            {snapshot.cash.acceleratingBurn && (
                              <span className="rounded border border-red-500/40 bg-red-500/10 px-1 py-px text-[9px] font-semibold uppercase text-red-400" title="Recent half-year+ stub burns >1.3× the smoothed TTM rate — runway shown uses the recent run-rate.">accelerating</span>
                            )}
                          </div>
                          {snapshot.cash.reportedRunwayMonths === null ? (
                            <div className="text-3xl font-bold text-emerald-400">
                              {(snapshot.cash.monthlyCashFlow ?? 0) >= 0 ? 'Cash-flow +' : '—'}
                            </div>
                          ) : (
                            <div className={`text-5xl font-bold leading-none ${snapshot.cash.reportedRunwayMonths < 6 ? 'text-red-400' : snapshot.cash.reportedRunwayMonths < 12 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {snapshot.cash.reportedRunwayMonths.toFixed(1)}<span className="ml-1.5 text-lg font-normal text-zinc-500">months</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs text-zinc-500">
                          <div>{fmtMoney(snapshot.cash.estimatedCash)} cash</div>
                          <div className={`${(snapshot.cash.monthlyCashFlow ?? 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {fmtMoney(Math.abs(snapshot.cash.monthlyCashFlow ?? 0))}{snapshot.cash.monthlyCashFlow !== null && snapshot.cash.monthlyCashFlow >= 0 ? ' gen' : ' burn'}/mo
                          </div>
                        </div>
                      </div>
                      {/* SECONDARY: forward-projected to today */}
                      {snapshot.cash.cashRemainingMonths !== null && (
                        <div className="mt-2 flex items-center gap-2 border-t border-zinc-700/60 pt-1.5 text-xs">
                          <span className="text-zinc-500">Projected to today:</span>
                          <span className={`font-semibold ${cashOutOfMoney ? 'text-red-400' : snapshot.cash.cashRemainingMonths < 6 ? 'text-red-400' : snapshot.cash.cashRemainingMonths < 12 ? 'text-amber-400' : 'text-zinc-300'}`}>
                            {snapshot.cash.cashRemainingMonths.toFixed(1)} mo
                          </span>
                          {snapshot.cash.projectedCash !== null && (
                            <span className="text-zinc-600">· est. {fmtMoney(snapshot.cash.projectedCash)} now</span>
                          )}
                          {snapshot.cash.postReportRaises && snapshot.cash.postReportRaises > 0 && (
                            <span className="font-medium text-emerald-400" title="Gross proceeds from offerings filed after the cash report date, added back so the projection reflects actual treasury.">
                              · includes {fmtMoney(snapshot.cash.postReportRaises)} raised since report
                            </span>
                          )}
                          {cashOutOfMoney && cashRanOutDate && (
                            <span className="font-medium text-red-400">· out of money ~{cashRanOutDate.toISOString().slice(0, 10)}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-600">
                      Runway = total liquidity (cash + restricted) ÷ latest operating burn, as-of report date — matches AskEdgar/Nexus. Projected carries the burn forward to today and adds back capital raised since the report.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Detailed dilution programs — expandable cards with full terms +
                source clause, filterable by type. The drill-down beneath the
                overview tabs. */}
            {(() => {
              const eqLines = (snapshot?.warrantNotes?.equityLines ?? []).map((el: any, i: number) => ({ ...el, programType: 'equity-line', filingDate: el.filingDate ?? '', securities: [] }));
              const progs = snapshot?.programs ?? [];
              // Also surface warrant offerings from 424B5 prospectuses
              const warrantOffers = (snapshot?.offerings ?? []).filter((o: any) => (o.warrantTranches ?? []).length > 0).map((o: any, i: number) => ({
                programType: 'warrant-offering', filingDate: o.filingDate, counterparty: o.underwriter, maxCommitment: null,
                pricing: o.pricePerShare != null ? '$' + o.pricePerShare.toFixed(2) + '/sh' : null,
                ownershipCap: null, maturity: null, drawCapPerPeriod: null,
                securities: ['warrant', 'pre-funded warrant', 'common stock'],
                description: (o.warrantTranches ?? []).map((w: any) => `${fmtNum(w.shares ?? 0)} sh @ $${(w.strike ?? 0).toFixed(2)}` + (w.expiry ? ` exp ${w.expiry}` : '')).join('; '),
                _key: 'wo' + i,
              }));
              const allProgs = [...eqLines, ...progs, ...warrantOffers];
              if (allProgs.length === 0) return null;
              const tabLabels: Record<string, string> = {
                all: 'All', atm: 'ATM', 'equity-line': 'Equity Line', convertible: 'Converts',
                'promissory-note': 'Notes', 'warrant-offering': 'Warrants', 'material-agreement': 'Other',
              };
              const tabOrder = ['all', 'atm', 'equity-line', 'warrant-offering', 'convertible', 'promissory-note', 'material-agreement'];
              const available = tabOrder.filter((t) => t === 'all' || allProgs.some((p: any) => p.programType === t));
              const filtered = detailTab === 'all' ? allProgs : allProgs.filter((p: any) => p.programType === detailTab);
              return (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                    Detailed dilution programs <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">terms + clauses</span>
                  </div>
                  {/* Category tabs */}
                  <div className="mb-3 flex flex-wrap gap-1">
                    {available.map((t) => (
                      <button
                        key={t}
                        onClick={() => setDetailTab(t)}
                        className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${detailTab === t ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
                      >
                        {tabLabels[t] ?? t}
                        {t !== 'all' && <span className="ml-1 opacity-60">{allProgs.filter((p: any) => p.programType === t).length}</span>}
                      </button>
                    ))}
                  </div>
                  {/* Equity-line aggregate bar (shown when relevant) */}
                  {(detailTab === 'all' || detailTab === 'equity-line') && eqLineMax > 0 && (
                    <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded border border-zinc-700/60 bg-zinc-800/30 px-2 py-1 text-[11px]">
                      <span className="font-semibold uppercase tracking-wide text-zinc-400">Equity-line capacity</span>
                      <span className="text-zinc-300">${(eqLineMax / 1e6).toFixed(1)}M max</span>
                      <span className="text-emerald-400">${(eqLineDrawn / 1e6).toFixed(1)}M raised</span>
                      <span className="font-semibold text-amber-300">${(eqLineRemaining! / 1e6).toFixed(1)}M remaining</span>
                      {eqLineDrawn === 0 && <span className="text-[10px] text-zinc-600">(no draws parsed yet)</span>}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {filtered.map((pr: any, i: number) => (
                      <ProgramCard key={pr._key ?? `p${i}`} pr={pr} snap={snapshot} />
                    ))}
                  </div>
                </div>
              );
            })()}




            {/* Tier 3 — Dilution tendencies. Short summary cards + detailed
                event timeline, both lens-aware (60d / 6mo / 1yr / all). */}
            {(() => {
              const ins = dilutionTendencies(snapshot, tendenciesLens);
              const events = dilutionEvents(snapshot, tendenciesLens);
              if (!ins.length) return null;
              const th = 'py-2 pr-4 text-left text-[10px] font-medium uppercase tracking-wide text-zinc-500 whitespace-nowrap';
              const td = 'py-1.5 pr-4 text-xs align-top';
              const toneCls: Record<string, string> = {
                red: 'border-red-500/20 bg-red-500/[0.03]',
                amber: 'border-amber-500/20 bg-amber-500/[0.03]',
                zinc: 'border-zinc-700 bg-zinc-800/20',
              };
              const txtCls: Record<string, string> = {
                red: 'text-red-400', amber: 'text-amber-400', zinc: 'text-zinc-300',
              };
              const lenses = ['60d', '6mo', '1yr', 'all'] as const;
              return (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-zinc-500">Dilution tendencies</span>
                    <span className="text-zinc-700 text-[10px]">· historical patterns</span>
                    {/* Time-lens toggle */}
                    <div className="ml-auto flex gap-1">
                      {lenses.map((l) => (
                        <button key={l} onClick={() => setTendenciesLens(l)}
                          className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase transition-colors ${tendenciesLens === l ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Short summary cards */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {ins.map((it, i) => (
                      <div key={i} className={`rounded border p-2.5 ${toneCls[it.tone] ?? toneCls.zinc}`}>
                        <div className="text-[10px] uppercase tracking-wide text-zinc-600">{it.label}</div>
                        <div className={`mt-0.5 text-sm font-semibold ${txtCls[it.tone] ?? 'text-zinc-300'}`}>{it.value}</div>
                        {it.detail && <div className="text-[10px] text-zinc-500">{it.detail}</div>}
                      </div>
                    ))}
                  </div>
                  {/* Detailed event timeline */}
                  {events.length > 0 && (
                    <details className="group mt-3 rounded border border-zinc-800/60">
                      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-zinc-800/30">
                        <svg className="h-3 w-3 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Event timeline</span>
                        <span className="rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-400">{events.length} events</span>
                      </summary>
                      <div className="border-t border-zinc-800/50 overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead className="border-b border-zinc-800">
                            <tr>
                              <th className={th}>Date</th>
                              <th className={th}>Type</th>
                              <th className={th}>Amount</th>
                              <th className={th}>Detail</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800/50">
                            {events.map((e, i) => {
                              const ec: Record<string,string> = { red: 'bg-red-500/15 text-red-400', amber: 'bg-amber-500/15 text-amber-400', zinc: 'bg-zinc-700 text-zinc-400' };
                              return (
                                <tr key={i}>
                                  <td className={td + ' whitespace-nowrap text-zinc-500'}>{e.date}</td>
                                  <td className={td}><span className={'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ' + (ec[e.tone] ?? ec.zinc)}>{e.type}</span></td>
                                  <td className={td + ' font-medium text-zinc-200'}>{e.amount}</td>
                                  <td className={td + ' text-zinc-500'}>{e.detail}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}

            {/* Bottom tabbed block — Past Offerings (default) · Recent Filings · Shares & Float.
                Consolidates the old scattered offerings/filings/shares cards into one
                Nexus-parity tabbed section (user-requested structure). */}
            <BottomTabs snapshot={snapshot} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
