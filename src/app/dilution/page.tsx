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
  const M = 1e6;
  const px = snapshot?.inTheMoney?.price ?? null;
  const sharesFor = (maxDollars: number | null | undefined) =>
    px != null && maxDollars != null && maxDollars > 0 ? Math.round(maxDollars / px) : null;
  const eqLines = [
    ...((snapshot?.warrantNotes?.equityLines ?? []).map((el: any, i: number) => ({ key: 'el' + i, date: '', who: el.counterparty, max: el.maxCommitment, extra: [el.pricing, el.ownershipCap != null ? el.ownershipCap + '% cap' : null].filter(Boolean).join(' · ') }))),
    ...((snapshot?.programs ?? []).filter((p: any) => p.programType === 'equity-line').map((p: any, i: number) => ({ key: 'pr' + i, date: p.filingDate, who: p.counterparty, max: p.maxCommitment, extra: [p.pricing, p.ownershipCap != null ? p.ownershipCap + '% cap' : null].filter(Boolean).join(' · ') }))),
  ];
  const warrants = snapshot?.warrants ?? [];
  const converts = [
    ...((snapshot?.programs ?? []).filter((p: any) => p.programType === 'convertible').map((p: any, i: number) => ({ key: 'cv' + i, date: p.filingDate, who: p.counterparty, max: p.maxCommitment, extra: [p.maturity ? 'matures ' + p.maturity : null, p.pricing].filter(Boolean).join(' · ') }))),
  ];
  const overhangConv = snapshot?.overhang?.convertible;
  if (overhangConv) converts.push({ key: 'ovc', date: overhangConv.period, who: 'XBRL overhang', max: null, extra: overhangConv.shares + ' sh' + (overhangConv.strike != null ? ' @ $' + overhangConv.strike : '') });
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
  const convShares = snapshot?.overhang?.convertible?.shares ?? 0;
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

      <div className="space-y-5">
        {/* SHELVES */}
        {shelf.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Shelves</span>
              <span className="text-[10px] text-zinc-600">{shelf.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Form</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Type</th>
                    <th className={th}>Channel</th>
                    <th className={th}>Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {shelf.map((r: any) => {
                    const isWksi = floatVal != null && floatVal >= 700e6;
                    const isBaby = /^S-3$/.test(r.formType) && !isWksi;
                    return (
                      <tr key={r.accessionNo}>
                        <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.filingDate}</td>
                        <td className={td}><span className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-400">{r.formType}</span></td>
                        <td className={td + ' font-medium text-zinc-100'}>${(r.aggregateOffering / M).toFixed(0)}M</td>
                        <td className={td}>{isWksi ? <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase text-emerald-300">WKSI</span> : isBaby ? <span className="rounded bg-amber-500/20 px-1 text-[9px] font-semibold uppercase text-amber-300">baby</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td}>{r.salesChannel === 'atm' ? <span className="rounded bg-red-500/20 px-1 text-[9px] font-semibold uppercase text-red-400">ATM</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td + ' text-zinc-500'}>{r.agent || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sr && (
              <div className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-zinc-500">
                <span>Registered <span className="text-zinc-300">${(sr.registered / M).toFixed(0)}M</span></span>
                <span>Raised <span className="text-zinc-300">${(sr.raised / M).toFixed(1)}M</span></span>
                <span className="font-medium text-emerald-400">Remaining ${(sr.remaining / M).toFixed(1)}M ({sr.remainingPct.toFixed(0)}%)</span>
              </div>
            )}
          </div>
        )}

        {/* ATM PROGRAMS */}
        {atm.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">ATM programs</span>
              <span className="text-[10px] text-zinc-600">{atm.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Agent / bank</th>
                    <th className={th}>Max</th>
                    <th className={th}>Shares avail</th>
                    <th className={th}>Status</th>
                    <th className={th}>Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {atm.map((r: any) => {
                    const st = statusFor(r.date);
                    const sh = sharesFor(r.max);
                    return (
                      <tr key={r.key}>
                        <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.date || '—'}</td>
                        <td className={td + ' text-zinc-200'}>{r.who || '—'}</td>
                        <td className={td}>{r.max != null ? <span className="font-medium text-zinc-100">${(Number(r.max) / M).toFixed(1)}M</span> : '—'}</td>
                        <td className={td + ' text-zinc-400'}>{sh != null ? fmtSh(sh) : '—'}</td>
                        <td className={td}>{st ? <span className={'rounded px-1 py-px text-[9px] font-semibold uppercase ' + st.cls}>{st.label}</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td + ' text-zinc-500'}>{r.extra || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EQUITY LINES */}
        {eqLines.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Equity lines</span>
              <span className="text-[10px] text-zinc-600">{eqLines.length}</span>
            </div>
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
                    <th className={th}>Status</th>
                    <th className={th}>Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {eqLines.map((r: any) => {
                    const st = statusFor(r.date);
                    return (
                      <tr key={r.key}>
                        <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.date || '—'}</td>
                        <td className={td + ' text-zinc-200'}>{r.who || 'equity line'}</td>
                        <td className={td}>{r.max != null ? <span className="font-medium text-zinc-100">${(Number(r.max) / M).toFixed(1)}M</span> : '—'}</td>
                        <td className={td}>{st ? <span className={'rounded px-1 py-px text-[9px] font-semibold uppercase ' + st.cls}>{st.label}</span> : <span className="text-zinc-600">—</span>}</td>
                        <td className={td + ' text-zinc-500'}>{r.extra || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-1 text-[10px] text-zinc-600">Remaining = max − already sold, totaled across all lines (filings don't say which line was tapped).</div>
          </div>
        )}

        {/* WARRANTS */}
        {warrants.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Warrants</span>
              <span className="text-[10px] text-zinc-600">{warrants.length}{px != null && <span className="ml-1 text-zinc-600">· ${px}</span>}</span>
            </div>
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
            <div className="mt-1 text-[10px] text-zinc-500"><span className="text-red-400">ITM</span> = in-the-money (exercise likely) · <span className="text-amber-400">NEAR</span> = within 20% of strike · <span className="text-fuchsia-400">pre-funded</span> = already paid.</div>
          </div>
        )}

        {/* CONVERTIBLE NOTES */}
        {converts.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">Convertible notes</span>
              <span className="text-[10px] text-zinc-600">{converts.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Counterparty</th>
                    <th className={th}>Max / principal</th>
                    <th className={th}>Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {converts.map((r: any) => (
                    <tr key={r.key}>
                      <td className={td + ' whitespace-nowrap text-zinc-500'}>{r.date || '—'}</td>
                      <td className={td + ' text-zinc-200'}>{r.who || '—'}</td>
                      <td className={td}>{r.max != null ? <span className="font-medium text-zinc-100">${(Number(r.max) / M).toFixed(1)}M</span> : '—'}</td>
                      <td className={td + ' text-zinc-500'}>{r.extra || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* S-1 / F-1 */}
        {s1.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-300">S-1 / F-1 registrations</span>
              <span className="text-[10px] text-zinc-600">{s1.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-zinc-800">
                  <tr>
                    <th className={th}>Filed</th>
                    <th className={th}>Form</th>
                    <th className={th}>Headline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {s1.map((f: any, i: number) => (
                    <tr key={i}>
                      <td className={td + ' whitespace-nowrap text-zinc-500'}>{f.filingDate}</td>
                      <td className={td}><span className="rounded bg-zinc-800 px-1 text-[10px] text-zinc-400">{f.formType}</span></td>
                      <td className={td + ' text-zinc-400'}>{f.primaryDesc ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {nothing && <div className="py-6 text-center text-xs text-zinc-500">No dilution facilities detected.</div>}
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
  type PastRow = { date: string; type: string; shares: number | null; price: number | null; amount: number | null; underwriter: string | null; };
  const pastOfferings: PastRow[] = [
    ...offerings.map((o: any) => ({
      date: o.filingDate, type: o.offeringType ?? o.formType,
      shares: o.sharesOffered, price: o.pricePerShare,
      amount: o.grossProceeds, underwriter: o.underwriter,
    })),
    // Registrations (S-3/F-3/F-1/S-1) as timeline events — the company filed
    // intent to raise, not an executed sale. No shares/price; amount = the
    // aggregate registered ceiling. Amber badge distinguishes from sales.
    ...registrations.map((r: any) => ({
      date: r.filingDate, type: r.formType,
      shares: null, price: null,
      amount: r.aggregateOffering, underwriter: r.agent,
    })),
    ...draws.map((d: any) => ({
      date: d.filingDate ?? d.date ?? '', type: 'SEPA draw',
      shares: d.shares ?? null, price: d.pricePerShare ?? d.price ?? null,
      amount: d.proceeds ?? d.grossAmount ?? null, underwriter: d.counterparty ?? d.partner ?? null,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const tabs = [
    { label: 'Past Offerings', n: pastOfferings.length },
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
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{o.date || '—'}</td>
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

      {/* Tab 1: Recent Filings */}
      {tab === 1 && (
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

      {/* Tab 2: Shares & Float */}
      {tab === 2 && (
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

      {/* Tab 3: Ownership — insider holdings from Form 4, or transaction
          activity when holdings aren't reportable (afterShares null, e.g.
          option grants). Many micro-caps have Form 4 sales but no holding
          figure — showing the transaction log fills the tab with real signal. */}
      {tab === 3 && (
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
                      <div className="mt-3 space-y-2 border-t border-zinc-800/60 pt-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Cash need <span className="text-zinc-700">· {tw(sr.cashNeed.score)}</span></div>
                          <div className="mt-0.5 text-sm text-zinc-200">
                            {rw == null ? <span className="text-zinc-500">No burn data</span>
                              : <><span className={`font-semibold ${rw <= 6 ? 'text-red-400' : rw <= 12 ? 'text-orange-300' : 'text-emerald-300'}`}>{rw <= 0 ? 'Out of cash' : `${rw.toFixed(1)} mo runway`}</span>{snapshot?.cash?.acceleratingBurn && <span className="text-red-400"> · accelerating</span>}{cashTail ? <span className="text-zinc-500"> — {cashTail}</span> : null}</>}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Dilution ability <span className="text-zinc-700">· {tw(sr.dilutionAbility.score)}</span></div>
                          <div className="mt-0.5 text-xs leading-relaxed">
                            {(() => {
                              const chips = mechanicsSummary(snapshot);
                              if (!chips.length) return <span className="text-zinc-500">No tappable facilities detected.</span>;
                              return chips.map((c, i) => (
                                <span key={i} className={i > 0 ? 'ml-2' : ''} title={c.title}>
                                  <span className="text-zinc-600">{c.label}:</span> <span className={`font-medium ${TONE[c.tone] ?? 'text-zinc-300'}`}>{c.value}</span>
                                </span>
                              ));
                            })()}
                          </div>
                        </div>
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
                      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        {summary.subRatings.dilutionAbility.bullets.map((bl, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                            <span>{bl}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

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

            {/* Dilution programs — active mechanisms: ATM, equity-line/SEPA, promissory notes,
                convertibles (from 8-K material agreements + 10-K facility notes). Matches
                Nexus 'Offering Ability / ATM / Equity Lines / Convertible Notes' coverage. */}
            {((snapshot?.programs?.length ?? 0) > 0 || (snapshot?.warrantNotes?.equityLines?.length ?? 0) > 0) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Dilution programs
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">8-K + 10-K</span>
                </div>
                <div className="mb-2 text-[10px] text-zinc-600">Active financing mechanisms — standing facilities + new agreements. Read the clause to verify terms.</div>
                {eqLineMax > 0 && (
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded border border-zinc-700/60 bg-zinc-800/30 px-2 py-1 text-[11px]">
                    <span className="font-semibold uppercase tracking-wide text-zinc-400">Equity-line capacity</span>
                    <span className="text-zinc-300">${(eqLineMax / 1e6).toFixed(1)}M max</span>
                    <span className="text-emerald-400">${(eqLineDrawn / 1e6).toFixed(1)}M raised</span>
                    <span className="font-semibold text-amber-300">${(eqLineRemaining! / 1e6).toFixed(1)}M remaining</span>
                    {eqLineDrawn === 0 && <span className="text-[10px] text-zinc-600">(no draws parsed yet)</span>}
                  </div>
                )}
                <div className="space-y-1.5">
                  {/* Equity lines / SEPA from 10-K notes (pre-existing standing facilities) */}
                  {snapshot!.warrantNotes?.equityLines?.map((el, i) => (
                    <div key={`el${i}`} className="rounded border border-red-500/20 bg-red-500/5 p-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-400">Equity Line / SEPA</span>
                        {el.counterparty && <span className="font-medium text-zinc-200">{el.counterparty}</span>}
                        {el.maxCommitment !== null && <span className="text-zinc-400">· ${'$'}{(el.maxCommitment / 1e6).toFixed(0)}M max</span>}
                        {el.pricing && <span className="text-zinc-400">· {el.pricing}</span>}
                        {el.ownershipCap !== null && <span className="text-zinc-400">· {el.ownershipCap}% cap</span>}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[10px] italic text-zinc-500">“{el.description.slice(0, 240)}{el.description.length > 240 ? '…' : ''}”</div>
                    </div>
                  ))}
                  {/* 8-K material agreements (new) */}
                  {snapshot!.programs?.map((pr, i) => {
                    const label: Record<string,string> = { 'atm':'ATM Offering','equity-line':'Equity Line / SEPA','convertible':'Convertible Note','promissory-note':'Promissory Note','warrant-offering':'Warrant Offering','material-agreement':'Material Agreement' };
                    const tone: Record<string,string> = { 'atm':'red','equity-line':'red','convertible':'amber','promissory-note':'amber','warrant-offering':'blue','material-agreement':'zinc' };
                    const t = tone[pr.programType] ?? 'zinc';
                    const tc = t==='red'?'border-red-500/20 bg-red-500/5':t==='amber'?'border-amber-500/20 bg-amber-500/5':t==='blue'?'border-blue-500/20 bg-blue-500/5':'border-zinc-700 bg-zinc-800/40';
                    const bc = t==='red'?'bg-red-500/20 text-red-400':t==='amber'?'bg-amber-500/20 text-amber-400':t==='blue'?'bg-blue-500/20 text-blue-400':'bg-zinc-700 text-zinc-300';
                    return (
                      <div key={`pr${i}`} className={`rounded border p-2 ${tc}`}>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${bc}`}>{label[pr.programType] ?? pr.programType}</span>
                          {pr.counterparty && <span className="font-medium text-zinc-200">{pr.counterparty}</span>}
                          <span className="text-zinc-600">{pr.filingDate}</span>
                          {pr.maxCommitment !== null && <span className="text-zinc-400">· ${'$'}{(pr.maxCommitment / 1e6).toFixed(0)}M max</span>}
                          {pr.pricing && <span className="text-zinc-400">· {pr.pricing}</span>}
                          {pr.ownershipCap !== null && <span className="text-zinc-400">· {pr.ownershipCap}% cap</span>}
                          {pr.maturity && <span className="text-zinc-400">· matures {pr.maturity}</span>}
                          {pr.drawCapPerPeriod && <span className="text-zinc-400">· {pr.drawCapPerPeriod}</span>}
                          {pr.securities.length > 0 && <span className="text-zinc-500">· {pr.securities.join(', ')}</span>}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[10px] italic text-zinc-500">“{pr.description.slice(0, 240)}{pr.description.length > 240 ? '…' : ''}”</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}



            {/* Warrants & convertibles overhang (XBRL) — the price-dependent dilution threat */}
            {snapshot.overhang && (snapshot.overhang.warrant || snapshot.overhang.convertible) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Warrants &amp; convertibles
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">XBRL</span>
                  {snapshot.overhang.splitNote && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300" title={`Strike/shares adjusted for a stock split effective after the reported period: ${snapshot.overhang.splitNote}`}>⚠ split-adj</span>
                  )}
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

            {/* Per-instrument warrant/convertible detail from latest 10-K notes (Loop 4) */}
            {snapshot.warrantNotes && (snapshot.warrantNotes.warrants.length > 0 || snapshot.warrantNotes.convertibles.length > 0) && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
                  Warrant &amp; convertible detail
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300">10-K notes</span>
                  <span className="ml-auto text-[10px] text-zinc-600" title={snapshot.warrantNotes.source}>{snapshot.warrantNotes.source} · parsed {snapshot.warrantNotes.parsedAt}</span>
                </div>
                <div className="mb-1 text-[10px] text-zinc-600">Extracted from financial-statement notes. Partial coverage — read the clause to verify.</div>
                {snapshot.warrantNotes.warrants.length > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Warrants</span>
                      {snapshot.inTheMoney?.price != null && (
                        <span className="text-[10px] text-zinc-500">at <span className="font-semibold text-emerald-400">${snapshot.inTheMoney.price.toFixed(2)}</span> today</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {snapshot.warrantNotes.warrants.map((w, i) => {
                        const now = Date.now();
                        const expTs = w.expiry ? Date.parse(w.expiry) : NaN;
                        const exTs = w.exercisableDate ? Date.parse(w.exercisableDate) : NaN;
                        const expired = !isNaN(expTs) && expTs < now;
                        const notYet = !isNaN(exTs) && exTs > now;
                        const hasDates = !isNaN(expTs) || !isNaN(exTs);
                        // Only assert 'In play' when we have real date evidence;
                        // null dates → 'Status unknown' (don't fake confidence).
                        const statusLabel = expired ? 'Expired' : notYet ? `Exercisable ${w.exercisableDate}` : hasDates ? 'In play' : 'Status unknown';
                        const statusClass = expired ? 'bg-zinc-700 text-zinc-400' : notYet ? 'bg-zinc-700 text-zinc-300' : hasDates ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500';
                        // Moneyness coloring — matches ProgramTabs. Price-aware:
                        // ITM (red, exercise likely) / NEAR (amber, within 20% below) / OTM (plain).
                        const px = snapshot.inTheMoney?.price;
                        const itm = w.exercisePrice !== null && px != null && px >= w.exercisePrice;
                        const near = w.exercisePrice !== null && px != null && px >= w.exercisePrice * 0.8 && px < w.exercisePrice;
                        const strikeClass = itm ? 'text-red-400' : near ? 'text-amber-400' : 'text-zinc-200';
                        const moneyLabel = itm ? ' · ITM' : near ? ' · near' : '';
                        return (
                        <div key={`w${i}`} className="rounded bg-zinc-800/40 p-2 text-xs">
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${statusClass}`} title="Derived from expiry/exercisable dates in the 10-K clause">{statusLabel}</span>
                            {w.shares !== null && <span><span className="text-zinc-500">shares:</span> <span className="font-medium text-zinc-200">{fmtNum(w.shares)}</span></span>}
                            {w.exercisePrice !== null && <span><span className="text-zinc-500">strike:</span> <span className={`font-medium ${strikeClass}`}>${w.exercisePrice.toFixed(w.exercisePrice < 1 ? 4 : 2)}{moneyLabel}</span></span>}
                            {w.expiry !== null && <span><span className="text-zinc-500">expires:</span> <span className="font-medium text-amber-300">{w.expiry}</span></span>}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[10px] italic text-zinc-500">“{w.description.slice(0, 220)}{w.description.length > 220 ? '…' : ''}”</div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Registered warrants from 424B5 offerings — per-tranche strikes/expiry */}
                {snapshot.offerings.some((o) => (o.warrantTranches ?? []).length > 0) && (
                  <div className="mb-3">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Registered warrants <span className="font-normal text-zinc-600">(424B5)</span></div>
                    <div className="space-y-1.5">
                      {snapshot.offerings.flatMap((o, oi) => (o.warrantTranches ?? []).map((t, ti) => (
                        <div key={`${oi}-${ti}`} className="rounded bg-zinc-800/40 p-2 text-xs">
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                            {t.strike !== null && <span><span className="text-zinc-500">strike:</span> <span className="font-medium text-zinc-200">${t.strike.toFixed(2)}</span></span>}
                            {t.shares !== null && <span><span className="text-zinc-500">shares:</span> <span className="font-medium text-zinc-200">{fmtNum(t.shares)}</span></span>}
                            {t.expiry !== null && <span><span className="text-zinc-500">expires:</span> <span className="font-medium text-amber-300">{t.expiry}</span></span>}
                            {t.exercisable !== null && <span><span className="text-zinc-500">exercisable:</span> <span className="text-zinc-300">{t.exercisable}</span></span>}
                            <span className="text-zinc-600">· {o.filingDate}</span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-[10px] italic text-zinc-500">“{t.description.slice(0, 200)}{t.description.length > 200 ? '…' : ''}”</div>
                        </div>
                      )))}
                    </div>
                  </div>
                )}
                {snapshot.warrantNotes.convertibles.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Convertibles</div>
                    <div className="space-y-1.5">
                      {snapshot.warrantNotes.convertibles.map((c, i) => (
                        <div key={`c${i}`} className="rounded bg-zinc-800/40 p-2 text-xs">
                          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                            {c.principal !== null && <span><span className="text-zinc-500">principal:</span> <span className="font-medium text-zinc-200">${(c.principal / 1e6).toFixed(1)}M</span></span>}
                            {c.maturity !== null && <span><span className="text-zinc-500">matures:</span> <span className="font-medium text-amber-300">{c.maturity}</span></span>}
                            {c.conversionPrice !== null && <span><span className="text-zinc-500">conv price:</span> <span className="font-medium text-zinc-200">${c.conversionPrice.toFixed(2)}</span></span>}
                          </div>
                          <div className="mt-1 line-clamp-2 text-[10px] italic text-zinc-500">“{c.description.slice(0, 220)}{c.description.length > 220 ? '…' : ''}”</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              {/* Authorized share headroom — XBRL authorized − outstanding. The
                  core 'how much can they print without a shareholder vote' number. */}
              {snapshot.authorizedShares && (
                <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Dilution headroom</span>
                    <span className="text-[11px] text-zinc-500">authorized − outstanding (XBRL, as of {snapshot.authorizedShares.asOf})</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-sm">
                    <span><span className="text-zinc-500">Authorized</span> <span className="font-semibold text-zinc-200">{fmtNum(snapshot.authorizedShares.authorized)}</span></span>
                    <span><span className="text-zinc-500">Outstanding</span> <span className="font-semibold text-zinc-200">{fmtNum(snapshot.authorizedShares.outstanding)}</span></span>
                    <span><span className="text-zinc-500">Available</span> <span className="font-bold text-amber-300">{fmtNum(snapshot.authorizedShares.available)}</span></span>
                    <span className="text-[11px] text-zinc-500">{(snapshot.authorizedShares.available / snapshot.authorizedShares.authorized * 100).toFixed(0)}% of authorized unissued</span>
                  </div>
                </div>
              )}
              {/* Public float — prefer SEC 10-K/20-F cover (EntityPublicFloat:
                  authoritative, ~18% coverage, annual); fall back to COMPUTED
                  (outstanding − insiders) for the majority with no cover float.
                  Labeled distinctly so a derived figure is never mistaken for
                  the SEC-reported one. */}
              {(snapshot.publicFloat || snapshot.computedFloat) && (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-t border-zinc-800/60 pt-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Est. public float</span>
                  {snapshot.publicFloat ? (
                    <>
                      {snapshot.publicFloat.shares != null && (
                        <span className="font-semibold text-zinc-200">{fmtNum(snapshot.publicFloat.shares)} sh</span>
                      )}
                      <span className="text-zinc-400">{fmtMoney(snapshot.publicFloat.value)} non-affiliate mkt value</span>
                      <span className="text-[11px] text-zinc-600">SEC cover, as of {snapshot.publicFloat.asOf}</span>
                    </>
                  ) : snapshot.computedFloat ? (
                    <>
                      <span className="font-semibold text-zinc-200">{fmtNum(snapshot.computedFloat.shares)} sh</span>
                      <span className="text-zinc-400">{fmtNum(snapshot.computedFloat.insiderShares)} insider subtr.</span>
                      <span className="text-[11px] text-amber-500/80">computed: outstanding − insiders</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {/* Reverse-split history — high-value short-bias signal (8-K Item 3.03) */}
            {snapshot.reverseSplits.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Reverse splits</span>
                  <span className="text-[10px] text-zinc-500">8-K Item 3.03 · classic dilution/avoidance precursor</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {snapshot.reverseSplits.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm">
                      <span className="text-lg font-bold text-red-300">{s.ratio}</span>
                      {s.executionDate && <span><span className="text-zinc-500">effective</span> <span className="font-medium text-zinc-200">{s.executionDate}</span></span>}
                      <span><span className="text-zinc-500">filed</span> <span className="text-zinc-300">{s.announcementDate}</span></span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">8-K ↗</a>
                    </div>
                  ))}
                </div>
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

            {/* Nasdaq compliance — SIDE NOTE: listing status only matters once dilution/cash need is real */}
            {snapshot?.compliance && (
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
            )}

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
