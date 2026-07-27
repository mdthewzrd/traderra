'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useChartStore } from '@/stores/charts/chartStore'
import { useTickerStore } from '@/stores/tickerStore'
import { TickerSearchBar } from '@/components/TickerSearchBar'

/**
 * /personality — Mean-Reversion Personality terminal.
 * Classifies how a stock pushes and whether it fades. Evolution of /gap-stats.
 * Descriptive: fade = peak→trough as a FACT (no entry trigger).
 * Data from /api/personality (ports assets/backtest/skyq-personality.mjs → TS).
 *
 * Verdict = fade-rate × reclaim% (name-CHARACTER, not trend):
 *   Fader   ≥50% fade / ≤60% reclaim   (small-cap / illiquid / episodic)
 *   Trender ≤15% fade / ≥70% reclaim   (large-cap / liquid — dips bought)
 */

const PAL = {
  BG: '#0a0a0a', PANEL: '#0f1623',
  BORDER: '#1f2937', BORDER_GOLD: 'rgba(212,175,55,0.30)',
  TEXT: '#e0e0e0', MUTED: '#6b7280', DIM: '#9ca3af',
  GOLD: '#D4AF37', GREEN: '#34d399', RED: '#f87171', AMBER: '#fbbf24',
}
const WIN_OPTS = ['1y', '2y', '5y', 'all'] as const
const CAT_ORDER = ['d1 pm/ah', 'd1 gap', 'd1 intraday para', 'd2', 'mdr'] as const
const CAT_LABEL: Record<string, string> = {
  'd1 pm/ah': 'D1 PM/AH', 'd1 gap': 'D1 Gap', 'd1 intraday para': 'D1 Intraday Para',
  d2: 'D2', mdr: 'MDR (3+ day)',
}
const pct = (x: number | null | undefined, d = 0) => (x == null || isNaN(x) ? '—' : (x * 100).toFixed(d) + '%')
const fmtA = (x: number | null | undefined) => (x == null || isNaN(x) ? '—' : x.toFixed(1) + 'A')
const fmtX = (x: number | null | undefined) => (x == null || isNaN(x) ? '—' : x.toFixed(0) + 'x')
// 15m 89-EMA overshoot: + = trough broke BELOW the 89 (real fade), − = held above the mean.
const fmtOsh = (x: number | null | undefined) => (x == null || isNaN(x) ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%')
const fmtMin = (x: number | null | undefined) => (x == null || isNaN(x) ? '—' : x.toFixed(0) + 'm')
const fmtDvol = (x: number | null | undefined) => (x == null || isNaN(x) ? '—' : x.toFixed(1) + 'x')
const fmtET = (h: number) => {
  const m = Math.floor(h), s = Math.round((h - m) * 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Fade definition: peak→trough retrace ≥ 10% of excursion.
const FADE_MIN = 0.10
// Excursion buckets in ATR units (A = daily ATR14).
const SIZE_BUCKETS = [
  { id: '<2A', label: '<2A', test: (e: number) => e < 2 },
  { id: '2-4A', label: '2–4A', test: (e: number) => e >= 2 && e < 4 },
  { id: '4-6A', label: '4–6A', test: (e: number) => e >= 4 && e < 6 },
  { id: '≥6A', label: '≥6A', test: (e: number) => e >= 6 },
] as const
const bucketIdFor = (ex: number) => SIZE_BUCKETS.find(b => b.test(ex))?.id ?? '<2A'

const fmtMoney = (x: number | null | undefined) => {
  if (x == null || isNaN(x)) return '—'
  const a = Math.abs(x)
  if (a >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return '$' + (x / 1e6).toFixed(1) + 'M'
  if (a >= 1e3) return '$' + (x / 1e3).toFixed(1) + 'K'
  return '$' + Math.round(x).toString()
}
const fmtNum = (x: number | null | undefined) => {
  if (x == null || isNaN(x)) return '—'
  const a = Math.abs(x)
  if (a >= 1e6) return (x / 1e6).toFixed(2) + 'M'
  if (a >= 1e3) return (x / 1e3).toFixed(1) + 'K'
  return Math.round(x).toString()
}

// §D Company Portrait helpers — market-cap size class from a dollar market cap.
const capClass = (m: number | null | undefined): string | null => {
  if (m == null || isNaN(m)) return null
  if (m < 300e6) return 'Micro'
  if (m < 2e9) return 'Small'
  if (m < 10e9) return 'Mid'
  return 'Large'
}
// Runway status badge from cash-remaining months.
const runwayBadge = (m: number | null | undefined): { label: string; tone: 'green' | 'amber' | 'red' } | null => {
  if (m == null || isNaN(m)) return null
  if (m > 12) return { label: `SAFE · ${m.toFixed(0)}mo`, tone: 'green' }
  if (m > 6) return { label: `<12mo · ${m.toFixed(1)}mo`, tone: 'amber' }
  if (m > 3) return { label: `<6mo · ${m.toFixed(1)}mo`, tone: 'red' }
  return { label: `DESPERATE · ${m.toFixed(1)}mo`, tone: 'red' }
}
const TONE_COLOR: Record<'green' | 'amber' | 'red', string> = {
  green: PAL.GREEN, amber: PAL.AMBER, red: PAL.RED,
}

// Fade/decay stats for a group of pushes.
function fadeStats(rows: any[]) {
  const n = rows.length
  if (!n) return { n: 0, fadeRate: null as number | null, medFade: null as number | null, medTT: null as number | null, reclaim: null as number | null, medOsh: null as number | null }
  const faded = rows.filter(e => (e.fadeDepth ?? 0) >= FADE_MIN).length
  const fd = rows.map(e => e.fadeDepth).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  const tt = rows.map(e => e.tTroughH).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  const osh = rows.map(e => e.overshoot89).filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  const recl = rows.filter(e => e.reclaim).length
  const med = (arr: number[]) => (arr.length ? arr[Math.floor(arr.length / 2)] : null)
  return { n, fadeRate: faded / n, medFade: med(fd), medTT: med(tt), reclaim: recl / n, medOsh: med(osh) }
}

// Dilution event dates used for the near-dilution flag (±10d). Reverse splits fall
// back to announcement date when no execution date is recorded.
function dilEventDates(snap: any): string[] {
  const out: string[] = []
  for (const o of snap?.offerings ?? []) if (o.filingDate) out.push(o.filingDate)
  for (const r of snap?.registrations ?? []) if (r.filingDate) out.push(r.filingDate)
  for (const rs of snap?.reverseSplits ?? []) {
    const d = rs.executionDate || rs.announcementDate
    if (d) out.push(d)
  }
  return out
}
function withinDays(pushDate: string, eventDates: string[], days = 10): boolean {
  const p = Date.parse(pushDate + 'T00:00:00Z')
  if (isNaN(p)) return false
  for (const d of eventDates) {
    const t = Date.parse(d + 'T00:00:00Z')
    if (!isNaN(t) && Math.abs(p - t) <= days * 86400000) return true
  }
  return false
}
// Merged recent dilution events (offerings + registrations + reverse splits), newest first.
function dilEvents(snap: any) {
  const out: { date: string; type: string; detail: string }[] = []
  for (const o of snap?.offerings ?? []) out.push({
    date: o.filingDate,
    type: `Offering · ${o.formType}`,
    detail: o.grossProceeds != null ? fmtMoney(o.grossProceeds) : (o.pricePerShare != null ? `@ $${o.pricePerShare}` : o.offeringType || '—'),
  })
  for (const r of snap?.registrations ?? []) out.push({
    date: r.filingDate,
    type: `Registration · ${r.formType}`,
    detail: r.aggregateOffering != null ? fmtMoney(r.aggregateOffering) : (r.shelfType || '—'),
  })
  for (const rs of snap?.reverseSplits ?? []) {
    const d = rs.executionDate || rs.announcementDate
    if (d) out.push({ date: d, type: 'Reverse Split', detail: rs.ratio || '—' })
  }
  return out.filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date))
}

const VERDICT_STYLE: Record<string, { color: string; bg: string; emoji: string }> = {
  Fader: { color: PAL.RED, bg: 'rgba(248,113,113,0.12)', emoji: '🔻' },
  Trender: { color: PAL.GREEN, bg: 'rgba(52,211,153,0.12)', emoji: '📈' },
  Range: { color: PAL.DIM, bg: 'rgba(156,163,175,0.10)', emoji: '🔀' },
}
const VERDICT_BLURB: Record<string, string> = {
  Fader: 'Pushes fade and stay down — dips do not get bought. Classic small-cap / illiquid / episodic name.',
  Trender: 'Dips get bought — pushes extend, not revert. Large-cap / liquid / trending name.',
  Range: 'No strong fade or follow personality — mixed signal.',
}

// ── Archetype derivation ─────────────────────────────────────────────────────
// Synthesizes a rich named type from trajectory + dilution + fade + cap dims.
// Used as the page headline. Degrades gracefully when trajectory/dilution absent.
type ArchetypeDim = { id: string; label: string }
type Archetype = {
  name: string
  blurb: string
  traj?: ArchetypeDim
  dilution: ArchetypeDim[]
  fade?: ArchetypeDim
  cap?: ArchetypeDim
}
const TRAJ_LABEL: Record<string, string> = {
  'straight-down': 'Straight-Down',
  'round-trip': 'Round-Trip',
  uptrend: 'Uptrend',
  'range-bound': 'Range-Bound',
}
function deriveArchetype(pers: any, dil: any): Archetype {
  const trajData = pers?.trajectory
  const a = pers?.aggregates
  const med = a?.medians
  const verdict = pers?.verdict
  const snap = dil?.snapshot

  // Trajectory dim (only if the API returned trajectory).
  let traj: ArchetypeDim | undefined
  let trajPhrase = ''
  if (trajData && typeof trajData.trajPct === 'number') {
    const tp = trajData.trajPct, pd = trajData.peakDropPct ?? 0
    let id = 'range-bound'
    if (tp <= -0.5) id = 'straight-down'
    else if (pd >= 0.6 && tp > -0.3) id = 'round-trip'
    else if (tp >= 0.3) id = 'uptrend'
    traj = { id, label: TRAJ_LABEL[id] }
    if (id === 'straight-down') trajPhrase = `Straight-down ${pct(tp, 0)}`
    else if (id === 'round-trip') trajPhrase = `Round-trip (peak −${pct(pd, 0)}, net ${pct(tp, 0)})`
    else if (id === 'uptrend') trajPhrase = `Uptrend ${pct(tp, 0)}`
    else trajPhrase = `Range-bound (${pct(tp, 0)})`
  }

  // Dilution dims (priority order: reverse-split > serial-diluter > shelf-loaded > high-overhang > low-runway > clean).
  const dilution: ArchetypeDim[] = []
  const dilBits: string[] = []
  if (snap) {
    const rs = snap.reverseSplits ?? []
    const ofs = snap.offerings ?? []
    const shelf = snap.shelfRemaining
    const oh = snap.overhang
    const cash = snap.cash
    if (rs.length >= 1) dilution.push({ id: 'reverse-split', label: 'Reverse-Split' })
    if (ofs.length >= 2) dilution.push({ id: 'serial-diluter', label: 'Serial Diluter' })
    if (shelf?.remainingPct != null && shelf.remainingPct >= 0.5) dilution.push({ id: 'shelf-loaded', label: 'Shelf-Loaded' })
    if (oh?.overhangPct != null && oh.overhangPct >= 0.3) dilution.push({ id: 'high-overhang', label: 'High-Overhang' })
    if (cash?.cashRemainingMonths != null && cash.cashRemainingMonths < 6) dilution.push({ id: 'low-runway', label: 'Low-Runway' })
    if (!dilution.length) dilution.push({ id: 'clean', label: 'Clean' })
    if (rs.length) dilBits.push(`${rs.length} reverse split${rs.length > 1 ? 's' : ''}`)
    if (shelf?.remaining != null) dilBits.push(`${fmtMoney(shelf.remaining)} shelf (${pct(shelf.remainingPct, 0)} remaining)`)
    if (oh?.overhangPct != null) dilBits.push(`${pct(oh.overhangPct, 0)} overhang`)
    if (cash?.cashRemainingMonths != null) dilBits.push(`~${cash.cashRemainingMonths.toFixed(0)}mo runway`)
  }

  // Fade dim.
  let fade: ArchetypeDim | undefined
  if (verdict === 'Trender') fade = { id: 'holds-pops', label: 'Holds its pops' }
  else if (verdict === 'Fader' && med?.osh != null && med.osh >= 0.04) fade = { id: 'fails-pops', label: 'Fails its pops' }
  else fade = { id: 'mixed', label: 'Mixed pops' }

  // Cap dim from computed float shares.
  let cap: ArchetypeDim | undefined
  const shares = snap?.computedFloat?.shares
  if (typeof shares === 'number') {
    if (shares < 10e6) cap = { id: 'microcap', label: 'Microcap' }
    else if (shares < 100e6) cap = { id: 'small-cap', label: 'Small-Cap' }
    else cap = { id: 'mid-large', label: 'Mid/Large-Cap' }
  }

  // Headline name: strongest 2 dilution tags (space-joined) + trajectory tag. Chips below carry the rest.
  const strongDil = dilution.filter(d => d.id !== 'clean').slice(0, 2)
  const dilName = (strongDil.length ? strongDil : dilution.slice(0, 1)).map(d => d.label).join(' ')
  const name = [dilName, traj?.label].filter(Boolean).join(' — ') || verdict || 'Unclassified'

  // Blurb: trajectory; dilution detail; fade behavior with real numbers; cap.
  const parts: string[] = []
  if (trajPhrase) parts.push(trajPhrase)
  if (dilBits.length) parts.push(dilBits.join(', '))
  const fadeRate = pers?.fadeRate
  const fadedPctStr = fadeRate != null ? pct(fadeRate, 0) : '—'
  if (fade?.id === 'fails-pops') {
    parts.push(`fails ${fadedPctStr} of its pops (median ${pct(med?.fd, 0)} fade${a?.faded89N != null ? `, ${a.faded89N} 89-breaks` : ''})`)
  } else if (fade?.id === 'holds-pops') {
    parts.push(`holds its pops (${fadedPctStr} still fade, reclaim ${pct(pers?.reclaimRate, 0)})`)
  } else {
    parts.push(`mixed pops (${fadedPctStr} fade)`)
  }
  if (cap) parts.push(`${cap.label} float`)
  const blurb = parts.join('; ')

  return { name, blurb, traj, dilution, fade, cap }
}

// Finds the dilution event closest (by calendar days) to a push date.
function closestDilEvent(pushDate: string, events: { date: string; type: string; detail: string }[]) {
  const p = Date.parse(pushDate + 'T00:00:00Z')
  if (isNaN(p)) return null
  let best: ({ date: string; type: string; detail: string } & { daysDelta: number }) | null = null
  let bestD = Infinity
  for (const e of events) {
    const t = Date.parse(e.date + 'T00:00:00Z')
    if (isNaN(t)) continue
    const d = Math.abs(p - t)
    if (d < bestD) { bestD = d; best = { ...e, daysDelta: Math.round((t - p) / 86400000) } }
  }
  return best
}

// Time-of-day windows (ET hour) for the move-timing stat block.
const TIMING_WINDOWS: { id: string; label: string; test: (h: number) => boolean }[] = [
  { id: 'pre', label: 'Pre-Mkt (<09:30)', test: h => h < 9.5 },
  { id: 'open', label: 'Open (09:30–10:30)', test: h => h >= 9.5 && h < 10.5 },
  { id: 'morning', label: 'Morning (10:30–12:00)', test: h => h >= 10.5 && h < 12 },
  { id: 'midday', label: 'Midday (12:00–14:00)', test: h => h >= 12 && h < 14 },
  { id: 'close', label: 'Close (14:00–16:00)', test: h => h >= 14 && h < 16 },
  { id: 'ah', label: 'After-Hrs (>16:00)', test: h => h >= 16 },
]

// §D Company Portrait — 4-panel fundamental snapshot placed at the top of the
// page (right after the archetype banner). Every snapshot field access is
// null-guarded so a sparse snapshot (e.g. AMD, where company / inTheMoney /
// compliance / shelfRemaining are null) degrades to muted "—" rather than crash.
function CompanyPortrait({ snap, pers }: { snap: any; pers: any }) {
  const company = snap?.company
  const itm = snap?.inTheMoney
  const mcap = itm?.marketCap
  const auth = snap?.authorizedShares
  const pubFloat = snap?.publicFloat
  const compFloat = snap?.computedFloat
  const compliance = snap?.compliance
  const cash = snap?.cash
  const shelf = snap?.shelfRemaining
  const overhang = snap?.overhang

  // Dilution headroom = available-to-issue shares ÷ outstanding (SKYQ ≈ 416x).
  const headroom = (auth?.available != null && auth?.outstanding && auth.outstanding > 0)
    ? auth.available / auth.outstanding : null
  const cc = capClass(mcap)

  // Listing-standard rules for profitability + stockholders equity.
  const rules: any[] = compliance?.rules ?? []
  const equityRule = rules.find(r => r?.rule === 'Stockholders Equity')
  const profitRule = rules.find(r => typeof r?.rule === 'string' && r.rule.includes('Profitability'))

  const rw = runwayBadge(cash?.cashRemainingMonths)

  // Price arc from the personality trajectory (pers) — null-safe.
  const trajStr = (typeof pers?.trajectory?.trajPct === 'number')
    ? `price ${pct(pers.trajectory.trajPct, 0)} arc` : ''

  // Share-count history sorted ascending by period; flag >30% drops as reverse splits.
  const hist = (snap?.sharesHistory ?? [])
    .filter((h: any) => h && h.outstanding != null)
    .slice()
    .sort((a: any, b: any) => String(a.period).localeCompare(String(b.period)))
    .map((h: any, i: number, arr: any[]) => {
      const prev = i > 0 ? arr[i - 1].outstanding : null
      const drop = prev != null && prev > 0 ? (h.outstanding - prev) / prev : null
      return { ...h, pctOfMax: 0, drop, reverseSplit: drop != null && drop < -0.3 }
    })
  if (hist.length) {
    const max = Math.max(...hist.map((h: any) => h.outstanding))
    hist.forEach((h: any) => { h.pctOfMax = max > 0 ? h.outstanding / max : 0 })
  }

  // Synthesized financial verdict line.
  const finVerdict = (() => {
    const bits: string[] = []
    if (cash?.monthlyCashFlow != null) bits.push(`${cash.monthlyCashFlow < 0 ? 'Burning' : 'Net +'}${fmtMoney(Math.abs(cash.monthlyCashFlow))}/mo`)
    if (cash?.cashRemainingMonths != null) bits.push(`~${cash.cashRemainingMonths.toFixed(1)}mo runway`)
    if (profitRule) {
      const ni = String(profitRule.detail ?? '').match(/\$-?[\d.]+[MBK]/)
      bits.push(ni ? `unprofitable (${ni[0]})` : `profitability ${profitRule.value ?? '—'}`)
    }
    if (equityRule?.status === 'fail') bits.push(`equity below standard`)
    if (!bits.length) return ''
    const forced = (cash?.cashRemainingMonths != null && cash.cashRemainingMonths < 3) || equityRule?.status === 'fail'
    return bits.join(' · ') + (forced ? ' — forced-dilution risk' : '')
  })()
  const hasFinData = cash?.estimatedCash != null || cash?.monthlyCashFlow != null || cash?.cashRemainingMonths != null || rules.length > 0

  // Recent activity (newest first).
  const programTypes: string[] = snap?.programTypes ?? []
  const draws = (snap?.draws ?? []).slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).slice(0, 3)
  const programs = (snap?.programs ?? []).slice().sort((a: any, b: any) => String(b.filingDate).localeCompare(String(a.filingDate))).slice(0, 3)
  const news = (snap?.news ?? []).slice().sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).slice(0, 2)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] text-[#D4AF37] uppercase tracking-widest font-bold">Company Portrait</span>
        <span className="text-[10px] text-[#444]">fundamental snapshot · SEC dilution data{trajStr ? ` · ${trajStr}` : ''}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 1. Size & Structure ── */}
        <Panel title="Size & Structure" subtitle={company ? `${company.name ?? ''}${company.exchange ? ' · ' + company.exchange : ''}` : 'company data unavailable'}>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <BigStat label="Market Cap" value={mcap != null ? fmtMoney(mcap) : '—'} sub={cc ? `${cc}-cap` : undefined} color={PAL.GOLD} />
              <BigStat label="Public Float" value={pubFloat?.value != null ? fmtMoney(pubFloat.value) : '—'} sub={pubFloat?.shares != null ? `${fmtNum(pubFloat.shares)} sh` : undefined} />
              <BigStat label="Computed Float" value={compFloat?.shares != null ? fmtNum(compFloat.shares) : '—'} sub={compFloat ? `${fmtNum(compFloat.insiderShares ?? 0)} insider` : undefined} />
            </div>
            <div>
              <div className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Authorized Shares {auth?.asOf ? `· ${auth.asOf}` : ''}</div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                <span><span className="text-[#666]">authorized </span><span className="text-[#e0e0e0] font-bold">{auth?.authorized != null ? fmtNum(auth.authorized) : '—'}</span></span>
                <span><span className="text-[#666]">outstanding </span><span className="text-[#e0e0e0] font-bold">{auth?.outstanding != null ? fmtNum(auth.outstanding) : '—'}</span></span>
                <span><span className="text-[#666]">available </span><span className="text-[#e0e0e0] font-bold">{auth?.available != null ? fmtNum(auth.available) : '—'}</span></span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap"
                  style={{ color: PAL.GOLD, borderColor: PAL.BORDER_GOLD, background: 'rgba(212,175,55,0.10)' }}>
                  {headroom != null ? `${fmtX(headroom)} dilution headroom` : 'headroom —'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {compliance?.tier && <DimChip key="tier" tone="muted">{compliance.tier}</DimChip>}
              {compliance?.exchange && compliance.exchange !== compliance.tier && <DimChip key="ex" tone="muted">{compliance.exchange}</DimChip>}
              {compliance?.failures != null && compliance.failures > 0 && <DimChip key="fail" tone="red">{compliance.failures} listing failure{compliance.failures > 1 ? 's' : ''}</DimChip>}
              {!compliance && <span className="text-[#444]">no listing-standard data</span>}
            </div>
          </div>
        </Panel>

        {/* ── 2. Financial Health ── */}
        <Panel title="Financial Health" subtitle={cash?.asOfDate ? `cash as of ${cash.asOfDate}` : 'fundamental trend'}>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <BigStat label="Est. Cash" value={cash?.estimatedCash != null ? fmtMoney(cash.estimatedCash) : '—'} sub={cash?.asOfDate ? `as of ${cash.asOfDate}` : undefined} color={PAL.GREEN} />
              <BigStat label="Monthly Burn" value={cash?.monthlyCashFlow != null ? fmtMoney(cash.monthlyCashFlow) : '—'} sub={cash?.monthlyCashFlow != null && cash.monthlyCashFlow < 0 ? 'cash outflow' : undefined} color={cash?.monthlyCashFlow != null && cash.monthlyCashFlow < 0 ? PAL.RED : PAL.TEXT} />
              <div>
                <div className="text-xs text-[#666] uppercase tracking-wide mb-1.5">Runway</div>
                {rw ? (
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap"
                    style={{ color: TONE_COLOR[rw.tone], borderColor: TONE_COLOR[rw.tone] + '66', background: TONE_COLOR[rw.tone] + '1f' }}>
                    {rw.label}
                  </span>
                ) : <span className="text-2xl font-bold text-[#444]">—</span>}
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              {profitRule && (
                <div className="flex items-start gap-2">
                  <span className="text-[#666] shrink-0 w-24">Profitability</span>
                  <span className="text-[#9ca3af]"><span className="text-[#f87171] font-bold">{profitRule.value ?? '—'}</span>{profitRule.detail ? ` · ${profitRule.detail}` : ''}</span>
                </div>
              )}
              {equityRule && (
                <div className="flex items-start gap-2">
                  <span className="text-[#666] shrink-0 w-24">Stkhldrs Equity</span>
                  <span className={equityRule.status === 'fail' ? 'text-[#f87171] font-bold' : 'text-[#34d399] font-bold'}>{equityRule.status ?? '—'}{equityRule.value ? ` · ${equityRule.value}` : ''}{equityRule.detail ? ` · ${equityRule.detail}` : ''}</span>
                </div>
              )}
              {cash?.acceleratingBurn && (
                <div className="flex items-start gap-2">
                  <span className="text-[#666] shrink-0 w-24">Burn Trend</span>
                  <span className="text-[#fbbf24] font-bold">accelerating burn</span>
                </div>
              )}
            </div>
            {finVerdict ? (
              <p className="text-xs text-[#9ca3af] leading-relaxed border-t border-[#1f2937] pt-2.5">
                <span className="text-[#D4AF37] font-bold">Verdict · </span>{finVerdict}
              </p>
            ) : !hasFinData ? (
              <p className="text-xs text-[#444] border-t border-[#1f2937] pt-2.5">no fundamental data available</p>
            ) : null}
          </div>
        </Panel>

        {/* ── 3. Dilution Arc (history → now) ── */}
        <div className="lg:col-span-2">
          <Panel title="Dilution Arc" subtitle="share-count history → shelf, overhang & in-the-money warrant exposure">
            <div className="p-4 space-y-4">
              <div>
                <div className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Outstanding Shares Over Time</div>
                {hist.length > 1 ? (
                  <div>
                    <div className="flex items-end gap-1.5 h-24">
                      {hist.map((h: any, i: number) => (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
                          title={`${fmtNum(h.outstanding)} outstanding · ${h.period}${h.reverseSplit ? ' · reverse split' : ''}`}>
                          <div className="w-full rounded-t transition-opacity" style={{
                            height: `${Math.max(3, h.pctOfMax * 100)}%`,
                            background: h.reverseSplit ? PAL.RED : (h.drop != null && h.drop < 0 ? PAL.AMBER : PAL.GOLD),
                            opacity: 0.75,
                          }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#666] mt-1">
                      <span>{hist[0].period}: <span className="text-[#9ca3af]">{fmtNum(hist[0].outstanding)}</span></span>
                      <span>{hist[hist.length - 1].period}: <span className="text-[#D4AF37] font-bold">{fmtNum(hist[hist.length - 1].outstanding)}</span></span>
                    </div>
                    {hist.some((h: any) => h.reverseSplit) && (
                      <div className="text-[10px] text-[#f87171] mt-1">reverse split detected (red bar · {hist.filter((h: any) => h.reverseSplit).map((h: any) => h.period).join(', ')})</div>
                    )}
                  </div>
                ) : hist.length === 1 ? (
                  <div className="text-xs text-[#9ca3af]">{fmtNum(hist[0].outstanding)} · {hist[0].period} (single data point)</div>
                ) : (
                  <div className="text-xs text-[#444]">no share-count history</div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#1f2937] pt-3">
                <BigStat label="Shelf Remaining" value={shelf?.remaining != null ? fmtMoney(shelf.remaining) : '—'} sub={shelf?.remainingPct != null ? `${shelf.remainingPct.toFixed(1)}% of ${fmtMoney(shelf.registered ?? 0)}` : undefined} color={shelf?.remainingPct != null && shelf.remainingPct > 50 ? PAL.AMBER : PAL.TEXT} />
                <BigStat label="Overhang" value={overhang?.overhangPct != null ? overhang.overhangPct.toFixed(0) + '%' : '—'} sub={overhang?.warrant != null && overhang.warrant.shares != null ? `${fmtNum(overhang.warrant.shares)} sh @ $${overhang.warrant.strike ?? '—'}` : undefined} color={overhang?.overhangPct != null && overhang.overhangPct > 20 ? PAL.RED : PAL.TEXT} />
                <BigStat label="ITM Warrant" value={itm?.warrant?.strike != null ? `$${itm.warrant.strike}` : '—'} sub={itm?.warrant != null ? `${itm.warrant.intrinsicPct != null ? itm.warrant.intrinsicPct.toFixed(0) + '%' : '—'} intrinsic · ${itm.warrant.itm ? 'ITM' : 'OTM'}` : undefined} color={itm?.warrant?.itm ? PAL.GREEN : PAL.TEXT} />
                <BigStat label="Imminent Dilution" value={itm?.imminentShares != null ? fmtNum(itm.imminentShares) : '—'} sub={itm?.imminentPct != null ? `${itm.imminentPct.toFixed(0)}% of float` : undefined} color={itm?.imminentPct != null && itm.imminentPct > 20 ? PAL.RED : PAL.TEXT} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-t border-[#1f2937] pt-3">
                <span className="text-[10px] text-[#666] uppercase tracking-wide mr-1">Program Types</span>
                {programTypes.length > 0 ? programTypes.map((t, i) => {
                  const toxic = t === 'promissory-note' || t === 'convertible'
                  return <DimChip key={i} tone={toxic ? 'red' : 'muted'}>{t}{toxic ? ' ⚠' : ''}</DimChip>
                }) : <span className="text-xs text-[#444]">no active programs</span>}
                {(snap?.warrants?.length || snap?.convertibles?.length) ? (
                  <span className="text-[10px] text-[#555] ml-2">{snap?.warrants?.length ?? 0} warrants · {snap?.convertibles?.length ?? 0} convertibles</span>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>

        {/* ── 4. Lately (90d) ── */}
        <div className="lg:col-span-2">
          <Panel title="Lately (90d)" subtitle="recent dilutive activity — insider shares, draws, programs, news">
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <BigStat label="Insider Dilutive (90d)" value={snap?.insiderDilutiveShares90d != null ? fmtNum(snap.insiderDilutiveShares90d) : '—'} color={PAL.GOLD} />
                <div className="mt-3">
                  <div className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Recent Draws</div>
                  {draws.length > 0 ? (
                    <div className="space-y-1.5">
                      {draws.map((d: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-[#9ca3af] shrink-0">{d.date ?? '—'}</span>
                          <span className="text-[#D4AF37] font-bold">{d.amount != null ? fmtMoney(d.amount) : '—'}</span>
                          <span className="text-[#9ca3af]">{d.shares != null ? fmtNum(d.shares) : '—'} sh</span>
                          {d.facilityType && <DimChip tone="muted">{d.facilityType}</DimChip>}
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-xs text-[#444]">no recent draws</div>}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Recent Programs</div>
                {programs.length > 0 ? (
                  <div className="space-y-1.5">
                    {programs.map((p: any, i: number) => {
                      const toxic = p.programType === 'promissory-note' || p.programType === 'convertible'
                      return (
                        <div key={i} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[#9ca3af] shrink-0">{p.filingDate ?? '—'}</span>
                            <span className={toxic ? 'text-[#f87171] font-bold' : 'text-[#9ca3af]'}>{p.programType ?? '—'}{toxic ? ' ⚠' : ''}</span>
                          </div>
                          {p.counterparty && <div className="text-[#666] truncate">{p.counterparty}</div>}
                        </div>
                      )
                    })}
                  </div>
                ) : <div className="text-xs text-[#444]">no programs</div>}
              </div>
              <div>
                <div className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Latest News</div>
                {news.length > 0 ? (
                  <div className="space-y-1.5">
                    {news.map((n: any, i: number) => (
                      <div key={i} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#9ca3af] shrink-0">{n.date ?? '—'}</span>
                          {n.source && <span className="text-[10px] text-[#555] uppercase">{n.source}</span>}
                        </div>
                        {n.url ? (
                          <a href={n.url} target="_blank" rel="noreferrer" className="text-[#e0e0e0] hover:text-[#D4AF37] hover:underline line-clamp-2">{n.title ?? '—'}</a>
                        ) : (
                          <div className="text-[#9ca3af] line-clamp-2">{n.title ?? '—'}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-[#444]">no recent news</div>}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

export default function PersonalityPage() {
  const router = useRouter()
  // Active ticker + recent list come from the shared store (the host owns the search bar).
  const ticker = useTickerStore((s) => s.ticker)
  const history = useTickerStore((s) => s.history)
  const selectTicker = useTickerStore((s) => s.select)
  // Tab state (Phase 1: personality works; gap-stats/dilution wire in next).
  const [tab, setTab] = useState<'personality' | 'gap-stats' | 'dilution'>('personality')
  const [win, setWin] = useState<(typeof WIN_OPTS)[number]>('2y')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // §A #4 push-inventory filters (table only — matrices use full data).
  const [filterCat, setFilterCat] = useState<Set<string>>(() => new Set())
  const [filterType, setFilterType] = useState<'all' | 'euphoric' | 'normal'>('all')
  const [filterSize, setFilterSize] = useState<Set<string>>(() => new Set())
  const [filterFaded, setFilterFaded] = useState(false)
  const [filterReclaimed, setFilterReclaimed] = useState(false)

  // Pure fetch — ticker + recent list are owned by the shared store (host search bar).
  const run = async (t: string, w: string) => {
    const tk = t.toUpperCase().trim()
    if (!tk) return
    setLoading(true); setError(''); setData(null)
    try {
      // Parallel fetch: personality (required) + dilution snapshot (degrades gracefully).
      const [persRes, dil] = await Promise.all([
        fetch(`/api/personality?ticker=${encodeURIComponent(tk)}&window=${w}`).then(async r => ({ ok: r.ok, j: await r.json() })),
        fetch(`/api/dilution/snapshot?ticker=${encodeURIComponent(tk)}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      ])
      if (!persRes.ok) throw new Error(persRes.j?.error || 'failed')
      const j = persRes.j
      j.dilution = dil // may be null or { snapshot: null } — never crashes the page
      setData(j)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  // Re-fetch whenever the shared ticker or window changes.
  useEffect(() => { if (ticker) run(ticker, win) }, [ticker, win]) // eslint-disable-line react-hooks/exhaustive-deps
  // Resume the last ticker on first load (recent list is hydrated by <TickerSearchBar/>).
  useEffect(() => { if (!ticker && history.length) selectTicker(history[0]) }, [history, ticker, selectTicker])

  const a = data?.aggregates
  const med = a?.medians
  const inv: any[] = data?.inventory ?? []
  const vs = data ? VERDICT_STYLE[data.verdict] : VERDICT_STYLE.Range
  const maxCat = a ? Math.max(1, ...CAT_ORDER.map(c => a.byCat[c] || 0)) : 1

  // §C dilution snapshot (may be null — degrades gracefully).
  const dil = data?.dilution
  const snap = dil?.snapshot
  const shelf = snap?.shelfRemaining
  const cfloat = snap?.computedFloat
  const overhang = snap?.overhang
  const cash = snap?.cash
  const offerings = snap?.offerings ?? []
  const registrations = snap?.registrations ?? []
  const reverseSplits = snap?.reverseSplits ?? []

  // §A #1-3 fade matrices — computed on the FULL inventory (table filters do not apply).
  const catMatrix = useMemo(() => CAT_ORDER.map(c => ({ c, ...fadeStats(inv.filter(e => e.cat === c)) })), [inv])
  const typeMatrix = useMemo(() => [
    { c: 'Euphoric (≥6.9σ)', ...fadeStats(inv.filter(e => e.devSigma >= 6.9)) },
    { c: 'Normal', ...fadeStats(inv.filter(e => e.devSigma < 6.9)) },
  ], [inv])
  const sizeMatrix = useMemo(() => SIZE_BUCKETS.map(b => ({ b, ...fadeStats(inv.filter(e => bucketIdFor(e.excursion) === b.id)) })), [inv])

  // §A #8 near-dilution flag: push date within ±10 calendar days of any dilution event.
  const dilDates = useMemo(() => (snap ? dilEventDates(snap) : []), [snap])
  const nearDilFlag = (pushDate: string) => withinDays(pushDate, dilDates, 10)
  const nearDilCount = useMemo(() => inv.filter(e => withinDays(e.date, dilDates, 10)).length, [inv, dilDates])

  // #1 Archetype headline (trajectory + dilution + fade + cap).
  const archetype = useMemo(() => (data ? deriveArchetype(data, dil) : null), [data, dil])

  // #2 Move-timing buckets (ET hour-of-day) + most-active window.
  const timingBuckets = useMemo(() => TIMING_WINDOWS.map(w => ({
    w, n: inv.filter(e => typeof e.originET === 'number' && w.test(e.originET)).length,
  })), [inv])
  const maxTiming = Math.max(1, ...timingBuckets.map(t => t.n))
  const topTiming = timingBuckets.length ? timingBuckets.reduce((x, y) => (y.n > x.n ? y : x)) : null
  // % of pushes within ±10d of a dilution event.
  const dilCorrelationPct = inv.length ? nearDilCount / inv.length : null

  // #3 near-dilution push ↔ event pairs (for the dedicated section below the table).
  const nearDilPairs = useMemo(() => {
    if (!snap) return [] as { push: any; event: ReturnType<typeof closestDilEvent> }[]
    const events = dilEvents(snap)
    return inv
      .filter(e => withinDays(e.date, dilDates, 10))
      .map(e => ({ push: e, event: closestDilEvent(e.date, events) }))
      .sort((a, b) => b.push.date.localeCompare(a.push.date))
  }, [inv, snap, dilDates])

  // #4 chart deep-link: set the chart symbol + focus date and route to /charts.
  const openChart = (date?: string) => {
    useChartStore.getState().scanNavigate(ticker.toUpperCase(), date ?? null)
    router.push('/charts')
  }

  // §A #4 filtered push inventory (matrices above stay on full data).
  const filteredInv = useMemo(() => inv.filter(e => {
    if (filterCat.size && !filterCat.has(e.cat)) return false
    if (filterType === 'euphoric' && e.devSigma < 6.9) return false
    if (filterType === 'normal' && e.devSigma >= 6.9) return false
    if (filterSize.size && !filterSize.has(bucketIdFor(e.excursion))) return false
    if (filterFaded && (e.fadeDepth ?? 0) < FADE_MIN) return false
    if (filterReclaimed && !e.reclaim) return false
    return true
  }), [inv, filterCat, filterType, filterSize, filterFaded, filterReclaimed])

  // §C #6 dilution-character risk badges.
  const riskBadges = useMemo(() => {
    if (!snap) return [] as { label: string; tone: 'red' | 'amber' }[]
    const b: { label: string; tone: 'red' | 'amber' }[] = []
    if (cash?.cashRemainingMonths != null && cash.cashRemainingMonths < 6) b.push({ label: 'cashBurn: HIGH', tone: 'red' })
    if (overhang?.overhangPct != null && overhang.overhangPct > 20) b.push({ label: 'overhang: HIGH', tone: 'amber' })
    if (shelf?.remainingPct != null && shelf.remainingPct > 80) b.push({ label: 'shelf: LOADED', tone: 'amber' })
    if (reverseSplits.length >= 2) b.push({ label: 'serial splitter', tone: 'red' })
    return b
  }, [snap, cash, overhang, shelf, reverseSplits])
  const recentEvents = useMemo(() => (snap ? dilEvents(snap).slice(0, 8) : []), [snap])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0]">
      {/* ── HOST CHROME: tab bar ── */}
      <div className="border-b border-[#1a1a1a] px-6">
        <div className="max-w-[1500px] mx-auto flex items-center gap-1">
          {(['personality', 'gap-stats', 'dilution'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-[#9ca3af] hover:text-[#e0e0e0]'}`}>
              {t === 'personality' ? 'MR Personality' : t === 'gap-stats' ? 'Gap Stats' : 'Dilution'}
            </button>
          ))}
        </div>
      </div>

      {/* ── SHARED SEARCH (ticker + recent live in the store; window is per-panel) ── */}
      <div className="px-6 py-4 border-b border-[#1a1a1a]">
        <div className="max-w-[1500px] mx-auto flex items-center gap-3 flex-wrap">
          <TickerSearchBar />
          {tab === 'personality' && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs text-[#666] mr-2">Window</span>
              {WIN_OPTS.map(w => (
                <button key={w} onClick={() => setWin(w)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${win === w ? 'bg-[#D4AF37] text-[#0a0a0a] font-bold' : 'bg-[#141c2b] text-[#9ca3af] border border-[#1f2937] hover:text-[#e0e0e0]'}`}>
                  {w}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TAB: gap-stats / dilution (wired in Phase 2/3) ── */}
      {tab === 'gap-stats' && (
        <div className="max-w-[1500px] mx-auto px-6 py-32 text-center text-[#555]">
          <div className="text-4xl mb-3">🔌</div>
          <p className="text-lg text-[#9ca3af]">Gap Stats panel — wiring in the next step</p>
        </div>
      )}
      {tab === 'dilution' && (
        <div className="max-w-[1500px] mx-auto px-6 py-32 text-center text-[#555]">
          <div className="text-4xl mb-3">🔌</div>
          <p className="text-lg text-[#9ca3af]">Dilution panel — wiring in the next step</p>
        </div>
      )}

      {/* ── TAB: MR Personality (hidden when another tab is active) ── */}
      <div className={tab === 'personality' ? '' : 'hidden'}>
        <div className="max-w-[1500px] mx-auto px-6 py-6">
          {!ticker && !loading && (
            <div className="flex flex-col items-center justify-center py-32 text-[#444]">
              <div className="text-5xl mb-4">🧬</div>
              <p className="text-lg">Enter a ticker to profile its push/fade personality</p>
              <p className="text-sm text-[#333] mt-2">Fetches daily + 4h + 5m bars, catalogs every push, classifies fader vs trender (~15-40s first run, then cached)</p>
            </div>
          )}
          {loading && (
            <div className="flex flex-col items-center justify-center py-32 text-[#666]">
              <div className="animate-pulse text-4xl mb-4">⚙️</div>
              <p className="text-lg text-[#9ca3af]">Profiling {ticker}…</p>
              <p className="text-sm mt-2">Fetching {win} of daily/4h/5m bars + push inventory</p>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <div className="text-4xl mb-3">⚠️</div>
                <p className="text-[#f87171] text-lg">{error}</p>
              </div>
            </div>
          )}

          {data && a && (
            <div className="space-y-6">
              {/* Archetype + verdict banner */}
              <div className="bg-[#0f1623] border border-[#1f2937] rounded-xl p-5">
                {archetype && (
                  <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-[#1f2937]">
                    <div className="min-w-0">
                      <div className="text-[10px] text-[#666] uppercase tracking-widest mb-1">Archetype</div>
                      <h2 className="text-3xl font-bold text-[#D4AF37] leading-tight break-words">{archetype.name}</h2>
                      <p className="text-sm text-[#9ca3af] mt-1.5 leading-relaxed">{archetype.blurb}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                        {archetype.dilution.filter(d => d.id !== 'clean').map((d, i) => <DimChip key={'dil' + i} tone="red">{d.label}</DimChip>)}
                        {archetype.traj && <DimChip key="traj" tone="amber">{archetype.traj.label}</DimChip>}
                        {archetype.fade && <DimChip key="fade" tone={archetype.fade.id === 'holds-pops' ? 'green' : 'red'}>{archetype.fade.label}</DimChip>}
                        {archetype.cap && <DimChip key="cap" tone="muted">{archetype.cap.label} Float</DimChip>}
                      </div>
                    </div>
                    <button type="button" onClick={() => openChart()} title={`Open ${ticker} on the chart`}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors">
                      Open chart ↗
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex flex-col items-center justify-center px-6 py-2 rounded-xl" style={{ background: vs.bg, border: `1px solid ${vs.color}40` }}>
                    <div className="text-5xl">{vs.emoji}</div>
                    <div className="text-2xl font-bold mt-1" style={{ color: vs.color }}>{data.verdict}</div>
                  </div>
                  {med.osh != null && (() => {
                    const held = med.osh < 0.04
                    const c = held ? PAL.GREEN : PAL.RED
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap"
                        style={{ color: c, background: held ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', borderColor: c + '66' }}
                        title={`Median 89-EMA overshoot ${fmtOsh(med.osh)} · ${held ? 'trough held above the mean' : 'trough broke below the 89'}`}>
                        {held ? '89 HELD' : '89 FAILED'}
                      </span>
                    )
                  })()}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <BigStat label="Fade Rate" value={pct(data.fadeRate)} sub={`${a.fadedN}/${a.count} ≥10%`} color={data.fadeRate >= 0.5 ? PAL.RED : PAL.TEXT} />
                    <BigStat label="Reclaim Rate" value={pct(data.reclaimRate)} sub={`${inv.filter(e => e.reclaim).length}/${a.count} new HOD`} color={data.reclaimRate >= 0.7 ? PAL.GREEN : PAL.TEXT} />
                    <BigStat label="4h Regime" value={data.regime} sub={`$${data.close} · ATR ${pct(data.atrPctOfPrice, 0)} of px`} color={data.regime === 'BULL' ? PAL.GREEN : PAL.RED} />
                    <BigStat label="Pushes" value={String(a.count)} sub={`${a.cadencePerMonth.toFixed(1)}/mo · ${a.euphoricN} euphoric ≥6.9σ`} />
                  </div>
                  <p className="text-xs text-[#777] mt-3 leading-relaxed">{VERDICT_BLURB[data.verdict]}
                    {data.verdict === 'Trender' && data.regime === 'BEAR' && ' — notably a trender DESPITE a bearish 4h regime (dips still bought).'}
                  </p>
                  {snap && (() => {
                    // §B #9: tie verdict to dilution character.
                    const charBits: string[] = []
                    if (reverseSplits.length >= 2) charBits.push('serial diluter')
                    else if (offerings.length || registrations.length) charBits.push('diluter')
                    const seg: string[] = []
                    if (overhang?.overhangPct != null) seg.push(`${overhang.overhangPct.toFixed(0)}% overhang`)
                    if (cash?.cashRemainingMonths != null) seg.push(`~${cash.cashRemainingMonths.toFixed(1)}mo runway`)
                    if (shelf?.remaining != null) seg.push(`${fmtMoney(shelf.remaining)} shelf remaining`)
                    if (!charBits.length || !seg.length) return null
                    return (
                      <p className="text-xs text-[#9ca3af] mt-1 leading-relaxed">
                        <span className="text-[#D4AF37] font-bold">{data.verdict}</span> + {charBits.join(' + ')} — {seg.join(', ')}.
                      </p>
                    )
                  })()}
                </div>
                </div>
              </div>

              {/* §D Company Portrait — 4-panel fundamental snapshot */}
              {snap && <CompanyPortrait snap={snap} pers={data} />}

              {/* Metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard label="Med Excursion" value={fmtA(med.ex)} sub={`${pct(med.exP)} of price`} />
                <MetricCard label="Med Fade Depth" value={pct(med.fd, 0)} tone={med.fd >= 0.2 ? 'good' : 'neutral'} />
                <MetricCard label="Med Hrs→Trough" value={isNaN(med.tt) ? '—' : `${med.tt.toFixed(0)}h`} />
                <MetricCard label="Med peakVol" value={fmtX(med.pv)} sub="× baseline" />
                <MetricCard label="Med devσ" value={isNaN(med.ds) ? '—' : med.ds.toFixed(1) + 'σ'} />
                <MetricCard label="Med accel" value={isNaN(med.ac) ? '—' : med.ac.toFixed(2)} sub=">1 = parabolic" />
                <MetricCard label="89 Overshoot" value={fmtOsh(med.osh)} sub={`${med.osh != null && med.osh >= 0.04 ? 'FAILED' : 'HELD'}${a.faded89N != null ? ` · ${a.faded89N}/${a.count} broke` : ''}`} tone={med.osh != null && med.osh >= 0.04 ? 'bad' : 'good'} />
                <MetricCard label="9/20 Flip Lag" value={fmtMin(med.fl)} sub="peak→9↓20 flip" />
                <MetricCard label="Decl/Push Vol" value={fmtDvol(med.dv)} sub="<1 push-heavy" />
              </div>

              {/* #2 Move insights — move-type distribution + time-of-day timing + cadence + dilution correlation */}
              <Panel title="Move Insights" subtitle="How this ticker pushes — by type, time-of-day, cadence, and dilution correlation">
                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Move-type distribution */}
                  <div>
                    <div className="text-xs text-[#D4AF37] font-bold mb-2">Move-Type Distribution</div>
                    <div className="space-y-2">
                      {CAT_ORDER.map(c => {
                        const n = a.byCat[c] || 0
                        const share = a.count ? n / a.count : 0
                        return (
                          <div key={c} className="flex items-center gap-3">
                            <div className="w-32 shrink-0 text-xs text-[#9ca3af]">{CAT_LABEL[c]}</div>
                            <div className="flex-1 h-5 bg-[#0a0a0a] rounded relative overflow-hidden border border-[#1f2937]">
                              <div className="h-full bg-[#D4AF37]/25 border-r border-[#D4AF37]/50" style={{ width: `${(n / maxCat) * 100}%` }} />
                              <div className="absolute inset-0 flex items-center px-2 text-xs">
                                <span className="text-[#D4AF37] font-bold">{n}</span>
                                <span className="text-[#555] ml-2">({pct(share, 0)})</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Time-of-day timing */}
                  <div>
                    <div className="text-xs text-[#D4AF37] font-bold mb-2">
                      Time-of-Day (ET)
                      {topTiming && topTiming.n > 0 && <span className="text-[#9ca3af] font-normal ml-2">· most active: <span className="text-[#D4AF37]">{topTiming.w.label}</span> ({topTiming.n})</span>}
                    </div>
                    <div className="space-y-2">
                      {timingBuckets.map(({ w, n }) => {
                        const share = a.count ? n / a.count : 0
                        return (
                          <div key={w.id} className="flex items-center gap-3">
                            <div className="w-36 shrink-0 text-xs text-[#9ca3af]">{w.label}</div>
                            <div className="flex-1 h-5 bg-[#0a0a0a] rounded relative overflow-hidden border border-[#1f2937]">
                              <div className="h-full bg-[#34d399]/20 border-r border-[#34d399]/50" style={{ width: `${(n / maxTiming) * 100}%` }} />
                              <div className="absolute inset-0 flex items-center px-2 text-xs">
                                <span className="text-[#34d399] font-bold">{n}</span>
                                <span className="text-[#555] ml-2">({pct(share, 0)})</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Cadence + dilution correlation summary row */}
                <div className="px-4 pb-4 pt-1 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-[#1f2937] mt-1">
                  <BigStat label="Pushes / Month" value={a.cadencePerMonth.toFixed(1)} sub={`${a.count} total pushes`} />
                  <BigStat label="Euphoric (≥6.9σ)" value={String(a.euphoricN)} sub={a.count ? `${pct(a.euphoricN / a.count, 0)} of pushes` : undefined} color={a.euphoricN ? PAL.GOLD : PAL.TEXT} />
                  <BigStat label="Near-Dilution" value={dilCorrelationPct != null ? pct(dilCorrelationPct, 0) : '—'} sub={`${nearDilCount}/${inv.length} pushes within ±10d of a dilution event`} color={dilCorrelationPct != null && dilCorrelationPct >= 0.3 ? PAL.AMBER : PAL.TEXT} />
                  <BigStat label="Dilution Events" value={snap ? String(recentEvents.length === 0 ? 0 : (snap.offerings?.length ?? 0) + (snap.registrations?.length ?? 0) + (snap.reverseSplits?.length ?? 0)) : '—'} sub={snap ? `${snap.offerings?.length ?? 0} offer · ${snap.reverseSplits?.length ?? 0} r/split` : 'no dilution data'} />
                </div>
              </Panel>

              {/* §A #1-3 Fade matrices */}
              <Panel title="Fade Matrices" subtitle="How hard pushes decay — by origin, type, and size. fade = peak→trough ≥ 10%. Computed on FULL inventory (table filters do not affect these).">
                <div className="p-4 space-y-5">
                  <div>
                    <div className="text-xs text-[#D4AF37] font-bold mb-2">Fade by Category</div>
                    <FadeTable rows={catMatrix} showOsh />
                  </div>
                  <div>
                    <div className="text-xs text-[#D4AF37] font-bold mb-2">Fade by Type</div>
                    <FadeTable rows={typeMatrix} showOsh />
                  </div>
                  <div>
                    <div className="text-xs text-[#D4AF37] font-bold mb-2">Fade by Size (excursion in ATR units)</div>
                    <FadeTable rows={sizeMatrix} compact showOsh />
                  </div>
                </div>
              </Panel>

              {/* Category breakdown */}
              <Panel title="Push Origins" subtitle="5 categories — by consecutive push-days + peak-bar session timing">
                <div className="p-4 space-y-2.5">
                  {CAT_ORDER.map(c => {
                    const n = a.byCat[c] || 0
                    return (
                      <div key={c} className="flex items-center gap-3">
                        <div className="w-36 shrink-0 text-xs text-[#9ca3af]">{CAT_LABEL[c]}</div>
                        <div className="flex-1 h-6 bg-[#0a0a0a] rounded relative overflow-hidden border border-[#1f2937]">
                          <div className="h-full bg-[#D4AF37]/25 border-r border-[#D4AF37]/50" style={{ width: `${(n / maxCat) * 100}%` }} />
                          <div className="absolute inset-0 flex items-center px-2 text-xs">
                            <span className="text-[#D4AF37] font-bold">{n}</span>
                            <span className="text-[#555] ml-2">{a.count ? `(${pct(n / a.count, 0)})` : ''}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="px-4 pb-3 text-xs text-[#555]">
                  d1 = single-day push · d2 = 2 consec · mdr = 3+ consec. d1 sub: <span className="text-[#9ca3af]">PM/AH</span> peak &lt;09:30 · <span className="text-[#9ca3af]">Gap</span> gapped ≥4% + peak &lt;10:30 · <span className="text-[#9ca3af]">Intraday Para</span> peak in RTH.
                </div>
              </Panel>

              {/* Push inventory */}
              <Panel title="Push Inventory" subtitle={`${inv.length} pushes · sorted by ATR excursion (desc) · fade = peak→trough within +3d · matrices above use FULL data`}>
                {/* §A #4 filter bar — filters the table only */}
                <FilterBar
                  invLen={inv.length} filteredN={filteredInv.length}
                  filterCat={filterCat} setFilterCat={setFilterCat}
                  filterType={filterType} setFilterType={setFilterType}
                  filterSize={filterSize} setFilterSize={setFilterSize}
                  filterFaded={filterFaded} setFilterFaded={setFilterFaded}
                  filterReclaimed={filterReclaimed} setFilterReclaimed={setFilterReclaimed}
                />
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0f1623] z-10">
                      <tr className="border-b border-[#1f2937]">
                        {['Date', 'Category', 'Exc', '% Px', 'Peak', 'Origin', 'Accel', 'Vel', 'pkVol', 'devσ', 'Fade', 'Hrs', 'Recl', 'Close', '89', 'osh%', 'flip', 'flips', 'dvol', 'cl4h', 'rc89', 'tHr'].map((h, i) => (
                          <th key={i} className="px-2.5 py-2 text-right text-[#666] font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredInv].sort((x, y) => y.excursion - x.excursion).map((e, i) => (
                        <tr key={i} className={`border-b border-[#1f2937]/50 hover:bg-[#141c2b] ${e.devSigma >= 6.9 ? 'bg-[#D4AF37]/[0.05]' : ''}`}>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap">
                            <button type="button" onClick={() => openChart(e.date)} title={`Open chart at ${e.date}`}
                              className="inline-flex items-center gap-1 text-[#e0e0e0] hover:text-[#D4AF37] underline-offset-2 hover:underline">
                              <span>{e.date}</span>
                              {nearDilFlag(e.date) && <span className="text-[#fbbf24]" title="Within ±10d of a dilution event (offering / registration / reverse split)">⚠</span>}
                              <span className="text-[#D4AF37]">↗</span>
                            </button>
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af] whitespace-nowrap">{e.cat}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#D4AF37]">{fmtA(e.excursion)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#6b7280]">{pct(e.excursionPct)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#e0e0e0]">${e.peak}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af]">{fmtET(e.originET)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af]">{e.accel.toFixed(2)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#6b7280]">{e.vel.toFixed(2)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af]">{fmtX(e.peakVolRatio)}</td>
                          <td className={`px-2.5 py-1.5 text-right ${e.devSigma >= 6.9 ? 'text-[#D4AF37] font-bold' : 'text-[#9ca3af]'}`}>{e.devSigma.toFixed(1)}</td>
                          <td className={`px-2.5 py-1.5 text-right ${e.fadeDepth >= 0.2 ? 'text-[#f87171]' : 'text-[#9ca3af]'}`}>{pct(e.fadeDepth)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#6b7280]">{e.tTroughH.toFixed(0)}h</td>
                          <td className={`px-2.5 py-1.5 text-right ${e.reclaim ? 'text-[#34d399]' : 'text-[#f87171]'}`}>{e.reclaim ? '✓' : '✗'}</td>
                          <td className={`px-2.5 py-1.5 text-right ${e.fadeDayCloseRed === null ? 'text-[#333]' : e.fadeDayCloseRed ? 'text-[#f87171]' : 'text-[#34d399]'}`}>{e.fadeDayCloseRed === null ? '—' : e.fadeDayCloseRed ? '▼' : '▲'}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af] whitespace-nowrap">{e.tag89 ? '✓' : '—'}</td>
                          <td className={`px-2.5 py-1.5 text-right whitespace-nowrap ${e.overshoot89 > 0 ? 'text-[#f87171]' : 'text-[#34d399]'}`}>{fmtOsh(e.overshoot89)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af] whitespace-nowrap">{fmtMin(e.flipLagMin)}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#6b7280] whitespace-nowrap">{e.flipCount}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af] whitespace-nowrap">{fmtDvol(e.declineVolRatio)}</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap" title="Fade broke the 4h EMA72/89 cloud">{e.cloudBreak4h ? <span className="text-[#34d399]">✓</span> : <span className="text-[#333]">—</span>}</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap" title="15m closed back above the 89 after tagging it">{e.reclaim89 ? <span className="text-[#34d399]">✓</span> : <span className="text-[#f87171]">✗</span>}</td>
                          <td className="px-2.5 py-1.5 text-right text-[#9ca3af] whitespace-nowrap" title="Time-of-day the fade troughed (ET)">{e.troughHour != null ? fmtET(e.troughHour) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 text-xs text-[#555] border-t border-[#1f2937]">
                  <span className="text-[#D4AF37]">gold row</span> = euphoric (≥6.9σ) · <span className="text-[#34d399]">✓ reclaim</span> = made new HOD within 3d · <span className="text-[#f87171]">✗</span> = stayed below peak. push = daily high ≥ 1.0× daily-ATR14 above prevClose. <span className="text-[#9ca3af]">89</span> = trough touched 15m 89-EMA · <span className="text-[#f87171]">osh%</span> = trough vs 89 (+ broke below, − held) · <span className="text-[#9ca3af]">flip</span> = min peak→9↓20 flip · <span className="text-[#34d399]">cl4h</span> = fade broke 4h 72/89 cloud · <span className="text-[#34d399]">rc89</span> = 15m reclaimed the 89 after tag (✗ = lower-for-longer) · <span className="text-[#9ca3af]">tHr</span> = trough hour-of-day (ET).
                </div>
                {dilDates.length > 0 && (
                  <div className="px-4 pb-2 text-xs text-[#555]">
                    <span className="text-[#fbbf24]">⚠</span> {nearDilCount} of {inv.length} pushes occurred within ±10d of a dilution event.
                  </div>
                )}
              </Panel>

              {/* #3 Dilution ↔ Move pairs — every push within ±10d of a dilution event, paired with the closest event */}
              <Panel title="Dilution ↔ Move Correlation" subtitle={snap ? `${nearDilPairs.length} push${nearDilPairs.length === 1 ? '' : 'es'} within ±10 calendar days of a dilution event — click any date to open the chart` : 'No dilution data for this ticker'}>
                {!snap ? (
                  <div className="p-6 text-sm text-[#555]">No dilution data for this ticker.</div>
                ) : nearDilPairs.length === 0 ? (
                  <div className="p-6 text-sm text-[#555]">No pushes fell within ±10 days of a recorded dilution event.</div>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#0f1623] z-10">
                        <tr className="border-b border-[#1f2937]">
                          <th className="px-3 py-2 text-left text-[#666] font-medium whitespace-nowrap">Push</th>
                          <th className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">Type</th>
                          <th className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">Exc</th>
                          <th className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">Fade</th>
                          <th className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">Δd</th>
                          <th className="px-3 py-2 text-left text-[#666] font-medium whitespace-nowrap">Matching Dilution Event</th>
                          <th className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">Date</th>
                          <th className="px-3 py-2 text-right text-[#666] font-medium whitespace-nowrap">Magnitude</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nearDilPairs.map(({ push: e, event }, i) => (
                          <tr key={i} className="border-b border-[#1f2937]/50 hover:bg-[#141c2b]">
                            <td className="px-3 py-1.5 text-left whitespace-nowrap">
                              <button type="button" onClick={() => openChart(e.date)} title={`Open chart at ${e.date}`}
                                className="inline-flex items-center gap-1 text-[#e0e0e0] hover:text-[#D4AF37] hover:underline">
                                <span>{e.date}</span><span className="text-[#D4AF37]">↗</span>
                              </button>
                            </td>
                            <td className="px-3 py-1.5 text-right text-[#9ca3af] whitespace-nowrap">{e.cat}</td>
                            <td className="px-3 py-1.5 text-right text-[#D4AF37] whitespace-nowrap">{fmtA(e.excursion)}</td>
                            <td className={`px-3 py-1.5 text-right whitespace-nowrap ${e.fadeDepth >= 0.2 ? 'text-[#f87171]' : 'text-[#9ca3af]'}`}>{pct(e.fadeDepth)}</td>
                            <td className={`px-3 py-1.5 text-right whitespace-nowrap ${event && event.daysDelta === 0 ? 'text-[#fbbf24] font-bold' : 'text-[#9ca3af]'}`}>{event ? (event.daysDelta === 0 ? '0' : (event.daysDelta > 0 ? '+' : '') + event.daysDelta) : '—'}</td>
                            <td className="px-3 py-1.5 text-left text-[#e0e0e0] whitespace-nowrap">{event ? event.type : '—'}</td>
                            <td className="px-3 py-1.5 text-right text-[#9ca3af] whitespace-nowrap">{event ? event.date : '—'}</td>
                            <td className="px-3 py-1.5 text-right text-[#D4AF37] whitespace-nowrap">{event ? event.detail : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              {/* §C Dilution ↔ Move */}
              <Panel title="Dilution ↔ Move" subtitle={snap ? `${snap.company?.name ?? ticker} — SEC dilution character vs push/fade inventory` : 'Dilution data unavailable'}>
                {!snap ? (
                  <div className="p-6 text-sm text-[#555]">Dilution data unavailable.</div>
                ) : (
                  <div className="p-4 space-y-4">
                    {/* #5 dilution cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <MetricCard label="Shelf Remaining" value={shelf?.remaining != null ? fmtMoney(shelf.remaining) : '—'} sub={shelf?.remainingPct != null ? `of ${fmtMoney(shelf.registered ?? 0)} · ${shelf.remainingPct.toFixed(1)}%` : undefined} tone={shelf?.remainingPct != null && shelf.remainingPct > 80 ? 'bad' : 'neutral'} />
                      <MetricCard label="Computed Float" value={cfloat?.shares != null ? fmtNum(cfloat.shares) : '—'} sub={cfloat ? `${fmtNum(cfloat.insiderShares ?? 0)} insider / ${fmtNum(cfloat.outstanding ?? 0)} out` : undefined} />
                      <MetricCard label="Overhang" value={overhang?.overhangPct != null ? overhang.overhangPct.toFixed(0) + '%' : '—'} sub={overhang?.warrant ? `warrant ${fmtNum(overhang.warrant.shares)} @ $${overhang.warrant.strike}` : undefined} tone={overhang?.overhangPct != null && overhang.overhangPct > 20 ? 'bad' : 'neutral'} />
                      <MetricCard label="Cash Runway" value={cash && cash.cashRemainingMonths != null ? `${cash.cashRemainingMonths.toFixed(1)}mo` : '—'} sub={cash ? `est $${Math.round(cash.estimatedCash ?? 0).toLocaleString()}` : undefined} tone={cash && cash.cashRemainingMonths != null && cash.cashRemainingMonths < 6 ? 'bad' : 'neutral'} />
                      <MetricCard label="Reverse Splits" value={String(reverseSplits.length)} sub={reverseSplits[0] ? `last: ${reverseSplits[0].ratio}` : undefined} tone={reverseSplits.length >= 2 ? 'bad' : 'neutral'} />
                      <MetricCard label="Offerings" value={String(offerings.length)} sub={`${registrations.length} registrations`} />
                    </div>
                    {/* #6 risk badges */}
                    {riskBadges.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-[#666] uppercase tracking-wide mr-1">Risk</span>
                        {riskBadges.map((b, i) => (
                          <span key={i} className={`px-2.5 py-1 rounded-full text-xs font-bold border ${b.tone === 'red' ? 'text-[#f87171] border-[#f87171]/40 bg-[#f87171]/10' : 'text-[#fbbf24] border-[#fbbf24]/40 bg-[#fbbf24]/10'}`}>{b.label}</span>
                        ))}
                      </div>
                    )}
                    {/* #7 recent dilution events */}
                    {recentEvents.length > 0 && (
                      <div>
                        <div className="text-[10px] text-[#666] uppercase tracking-wide mb-1.5">Recent Dilution Events (newest first, max 8)</div>
                        <div className="border border-[#1f2937] rounded-lg overflow-hidden">
                          {recentEvents.map((e, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b border-[#1f2937]/50 last:border-b-0">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[#9ca3af] font-mono shrink-0">{e.date}</span>
                                <span className="text-[#e0e0e0] truncate">{e.type}</span>
                              </div>
                              <span className="text-[#D4AF37] shrink-0 ml-3">{e.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BigStat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div className="text-xs text-[#666] uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-2xl font-bold" style={{ color: color || PAL.TEXT }}>{value}</div>
      {sub && <div className="text-xs text-[#555] mt-0.5">{sub}</div>}
    </div>
  )
}

// Archetype dimension chip (red = dilution risk, amber = trajectory, green = benign, muted = neutral).
function DimChip({ tone, children }: { tone: 'red' | 'amber' | 'green' | 'muted'; children: React.ReactNode }) {
  const map = {
    red: 'text-[#f87171] border-[#f87171]/40 bg-[#f87171]/10',
    amber: 'text-[#fbbf24] border-[#fbbf24]/40 bg-[#fbbf24]/10',
    green: 'text-[#34d399] border-[#34d399]/40 bg-[#34d399]/10',
    muted: 'text-[#9ca3af] border-[#1f2937] bg-[#0a0a0a]',
  } as const
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${map[tone]}`}>{children}</span>
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' | 'neutral' }) {
  return (
    <div className="bg-[#0f1623] border border-[#1f2937] rounded-xl p-4">
      <div className="text-xs text-[#666] uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tone === 'good' ? 'text-[#34d399]' : tone === 'bad' ? 'text-[#f87171]' : 'text-[#e0e0e0]'}`}>{value}</div>
      {sub && <div className="text-xs text-[#555] mt-1">{sub}</div>}
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0f1623] border border-[#1f2937] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1f2937]">
        <div className="text-sm font-bold text-[#e0e0e0]">{title}</div>
        {subtitle && <div className="text-xs text-[#666] mt-0.5">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

// §A #1-3 shared fade-matrix table.
function FadeTable({ rows, compact, showOsh }: {
  rows: { c?: string; b?: { id: string; label: string }; n: number; fadeRate: number | null; medFade: number | null; medTT: number | null; reclaim: number | null; medOsh?: number | null }[]
  compact?: boolean
  showOsh?: boolean
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1f2937] text-[#666]">
            <th className="px-2 py-1.5 text-left font-medium">Group</th>
            <th className="px-2 py-1.5 text-right font-medium">Count</th>
            <th className="px-2 py-1.5 text-right font-medium">Fade-Rate%</th>
            {!compact && <th className="px-2 py-1.5 text-right font-medium">Med Fade-Depth%</th>}
            {!compact && <th className="px-2 py-1.5 text-right font-medium">Med Hrs→Trough</th>}
            {!compact && <th className="px-2 py-1.5 text-right font-medium">Reclaim%</th>}
            {showOsh && <th className="px-2 py-1.5 text-right font-medium">osh%</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const label = r.b ? r.b.label : CAT_LABEL[r.c ?? ''] || r.c || '—'
            return (
              <tr key={i} className="border-b border-[#1f2937]/50">
                <td className="px-2 py-1.5 text-left text-[#e0e0e0] whitespace-nowrap">{label}</td>
                <td className="px-2 py-1.5 text-right text-[#9ca3af]">{r.n}</td>
                <td className={`px-2 py-1.5 text-right font-bold ${r.fadeRate != null && r.fadeRate >= 0.5 ? 'text-[#f87171]' : 'text-[#D4AF37]'}`}>{r.fadeRate == null ? '—' : pct(r.fadeRate)}</td>
                {!compact && <td className="px-2 py-1.5 text-right text-[#9ca3af]">{r.medFade == null ? '—' : pct(r.medFade)}</td>}
                {!compact && <td className="px-2 py-1.5 text-right text-[#9ca3af]">{r.medTT == null ? '—' : r.medTT.toFixed(0) + 'h'}</td>}
                {!compact && <td className={`px-2 py-1.5 text-right ${r.reclaim != null && r.reclaim >= 0.7 ? 'text-[#34d399]' : 'text-[#9ca3af]'}`}>{r.reclaim == null ? '—' : pct(r.reclaim)}</td>}
                {showOsh && <td className={`px-2 py-1.5 text-right ${r.medOsh != null && r.medOsh > 0 ? 'text-[#f87171]' : 'text-[#34d399]'}`}>{r.medOsh == null ? '—' : fmtOsh(r.medOsh)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${on ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]' : 'bg-[#0a0a0a] border-[#1f2937] text-[#9ca3af] hover:text-[#e0e0e0]'}`}>
      {children}
    </button>
  )
}

// §A #4 filter bar — filters the push inventory table only (matrices use full data).
function FilterBar(props: {
  invLen: number; filteredN: number
  filterCat: Set<string>; setFilterCat: (s: Set<string>) => void
  filterType: 'all' | 'euphoric' | 'normal'; setFilterType: (t: 'all' | 'euphoric' | 'normal') => void
  filterSize: Set<string>; setFilterSize: (s: Set<string>) => void
  filterFaded: boolean; setFilterFaded: (b: boolean) => void
  filterReclaimed: boolean; setFilterReclaimed: (b: boolean) => void
}) {
  const { invLen, filteredN, filterCat, setFilterCat, filterType, setFilterType, filterSize, setFilterSize, filterFaded, setFilterFaded, filterReclaimed, setFilterReclaimed } = props
  const toggle = (set: Set<string>, v: string, upd: (s: Set<string>) => void) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v); else n.add(v)
    upd(n)
  }
  const active = filterCat.size + filterSize.size + (filterType !== 'all' ? 1 : 0) + (filterFaded ? 1 : 0) + (filterReclaimed ? 1 : 0)
  const clear = () => { setFilterCat(new Set()); setFilterType('all'); setFilterSize(new Set()); setFilterFaded(false); setFilterReclaimed(false) }
  return (
    <div className="px-4 py-3 border-b border-[#1f2937] flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#666] uppercase tracking-wide mr-1">Cat</span>
        {CAT_ORDER.map(c => <FilterChip key={c} on={filterCat.has(c)} onClick={() => toggle(filterCat, c, setFilterCat)}>{CAT_LABEL[c]}</FilterChip>)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#666] uppercase tracking-wide mr-1">Type</span>
        <FilterChip on={filterType === 'euphoric'} onClick={() => setFilterType(filterType === 'euphoric' ? 'all' : 'euphoric')}>Euphoric</FilterChip>
        <FilterChip on={filterType === 'normal'} onClick={() => setFilterType(filterType === 'normal' ? 'all' : 'normal')}>Normal</FilterChip>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#666] uppercase tracking-wide mr-1">Size</span>
        {SIZE_BUCKETS.map(b => <FilterChip key={b.id} on={filterSize.has(b.id)} onClick={() => toggle(filterSize, b.id, setFilterSize)}>{b.label}</FilterChip>)}
      </div>
      <div className="flex items-center gap-1.5">
        <FilterChip on={filterFaded} onClick={() => setFilterFaded(!filterFaded)}>Faded only</FilterChip>
        <FilterChip on={filterReclaimed} onClick={() => setFilterReclaimed(!filterReclaimed)}>Reclaimed only</FilterChip>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-[#9ca3af] whitespace-nowrap">({filteredN}/{invLen})</span>
        {active > 0 && <button type="button" onClick={clear} className="text-xs text-[#f87171] hover:underline">Clear ({active})</button>}
      </div>
    </div>
  )
}
