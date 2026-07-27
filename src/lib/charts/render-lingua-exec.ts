/**
 * Lingua Exec — regime cloud + switch wedges (visual foundation).
 *
 * Step 1 (visual only): the 50/89 EMA cloud is the MAIN-SIGNAL regime.
 *   • 50 above 89 → bull regime → GREEN cloud
 *   • 50 below 89 → bear regime → RED cloud
 * The cloud flips red↔green automatically via drawEMABand's segment logic.
 *
 * A wedge marks each EMA cross (the "switch"). The wedge is colored as the
 * regime we are switching TO: cross up → green ▲ (below bar), cross down →
 * red ▼ (above bar).
 *
 * NOTE: for step 1 the cloud computes 50/89 on the chart's working TF. When the
 * chart is on 1H this IS the hourly main signal. Cross-TF hourly-regime overlay
 * (so it's correct on a 15m execution chart) lands with the entry/exit step.
 */
import type { RenderContext } from './render-types'
import { drawEMABand } from './render-indicators'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'

function ema(vals: number[], span: number): number[] {
  const n = vals.length
  const out: number[] = new Array(n).fill(NaN)
  if (n === 0) return out
  const k = 2 / (span + 1)
  let prev = vals[0]
  out[0] = prev
  for (let i = 1; i < n; i++) {
    if (isNaN(vals[i])) { out[i] = prev; continue }
    prev = vals[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

function wilderAtr(high: number[], low: number[], close: number[], len: number): number[] {
  const n = close.length
  const out: number[] = new Array(n).fill(NaN)
  if (n < len + 1) return out
  let a = 0
  for (let i = 1; i <= len; i++) {
    a += Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
  }
  a /= len
  out[len] = a
  for (let i = len + 1; i < n; i++) {
    const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
    a = (a * (len - 1) + tr) / len
    out[i] = a
  }
  return out
}

export function renderLinguaExec(rc: RenderContext) {
  const p = getMergedToolParams(rc.panelIdx, 'lingua_exec') as any
  const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'lingua_exec')
  const cl = (tool?.colors as any) || {}
  const fast = p.fast ?? 50
  const slow = p.slow ?? 89
  const showWedge = p.showWedge ?? 1
  const wedgeSize = p.wedgeSize ?? 6

  const close: number[] = rc.data.map((b: any) => +b.close)
  const eFast = ema(close, fast)
  const eSlow = ema(close, slow)

  // ── Regime shading (layer 1): 6-state machine, background tint ──
  //   UP          50>89, below 6.9 upper band
  //   EXTREME_UP  high reaches ema72+atr72*6.9   (amber)
  //   RESET_UP    left the band → wait to tag 50ema → UP   (yellow)
  //   DOWN / EXTREME_DOWN / RESET_DOWN = mirror
  // Band math matches the db_72_89 tool exactly. RESET is sticky (stateful), so we
  // walk the full bar array tracking transitions, not per-bar independent.
  const showRegime = p.showRegime ?? 1
  const showPullback = p.showPullback ?? 1
  let regimes: number[] = new Array(rc.data.length).fill(-1)
  // pullback touches: dir=1 long setup (uptrend), dir=-1 short setup (backside)
  let pullbacks: { idx: number; dir: number }[] = []
  // kind 1 = initial entry, kind 2 = add (capped at 2 entries per pullback)
  let entries: { idx: number; dir: number; price: number; stop: number; kind: 1 | 2 }[] = []
  let exits: { idx: number; dir: number; price: number; kind: 1 | 2 }[] = []
  let stopOuts: { idx: number; dir: number; price: number }[] = []
  if ((showRegime || showPullback) && rc.data.length > 90) {
    const high: number[] = rc.data.map((b: any) => +b.high)
    const low: number[] = rc.data.map((b: any) => +b.low)
    const open: number[] = rc.data.map((b: any) => +b.open)
    const e72 = ema(close, 72)
    const e89 = ema(close, 89)
    const a72 = wilderAtr(high, low, close, 72)
    const a89 = wilderAtr(high, low, close, 89)
    const slot = (rc as any).barW && (rc as any).barW > 0 ? (rc as any).barW : (rc.candleW || 6)
    const half = slot / 2
    const pH = (rc as any).priceH || rc.ctx.canvas.clientHeight || 600

    // 0=UP 1=EX_UP 2=RS_UP 3=DOWN 4=EX_DN 5=RS_DN
    // Hysteresis on the 50/89 regime flip: a marginal EMA cross during a reset rally
    // would otherwise hijack a downtrend reset straight to UPTREND. Require N bars of
    // the opposite side before the regime actually flips.
    const hold = Math.max(1, Math.round(p.regimeHold ?? 2))
    const bullH: boolean[] = new Array(rc.data.length).fill(false)
    let macro = -1, oppRun = 0
    for (let i = 89; i < rc.data.length; i++) {
      if (isNaN(eFast[i]) || isNaN(eSlow[i])) continue
      const wantBull = eFast[i] >= eSlow[i]
      if (macro === -1) { macro = wantBull ? 0 : 1; oppRun = 0 }
      else {
        const opp = macro === 0 ? !wantBull : wantBull
        if (opp) { if (++oppRun >= hold) { macro = wantBull ? 0 : 1; oppRun = 0 } }
        else oppRun = 0
      }
      bullH[i] = macro === 0
    }

    regimes = new Array(rc.data.length).fill(-1)
    let st = -1
    for (let i = 89; i < rc.data.length; i++) {
      if (isNaN(eFast[i]) || isNaN(eSlow[i]) || isNaN(a72[i]) || isNaN(a89[i])) continue
      const upBand = e72[i] + a72[i] * 6.9
      const dnBand = e89[i] - a89[i] * 6.9
      const bull = bullH[i]
      const exUp = high[i] >= upBand
      const exDn = low[i] <= dnBand
      const tag50fromAbove = low[i] <= eFast[i]   // price dropping to 50ema
      const tag50fromBelow = high[i] >= eFast[i]  // price rising to 50ema
      if (st === -1) st = bull ? 0 : 3
      if (bull && st >= 3) st = 0                  // macro flip: bear→bull
      else if (!bull && st <= 2) st = 3            // macro flip: bull→bear
      if (st === 0 && tag50fromAbove) { /* long setup detected in trade pass */ }
      if (st === 3 && tag50fromBelow) { /* short setup detected in trade pass */ }
      if (st === 0) { if (exUp) st = 1 }
      else if (st === 1) { if (!exUp) st = 2 }
      else if (st === 2) { if (tag50fromAbove) st = 0; else if (exUp) st = 1 }
      else if (st === 3) { if (exDn) st = 4 }
      else if (st === 4) { if (!exDn) st = 5 }
      else if (st === 5) { if (tag50fromBelow) st = 3; else if (exDn) st = 4 }
      regimes[i] = st
    }

    // ── LONG-ONLY 3-signal sequence (shorts / retries / position-mgmt deferred) ──
    //   Signal 1 (entry): pullback to 50ema while 50>89; close>prior high → enter at
    //     priorHigh+1c; risk = tight dev band lower (e89 - atr89*tightDn).
    //   Signal 2 (add): close>prior high → enter at close; risk = pullback low − 1c.
    //   Cover: 6.9 upper hit arms exit; 50% on first bar-break-of-low, 50% on 9/20 cross.
    // Wrapped in try/catch: a logic error must NEVER blank the whole chart again.
    try {
    const e9 = ema(close, 9), e20 = ema(close, 20)
    const e39 = ema(close, 39), e61 = ema(close, 61)
    const tightDn = p.tightMultDn ?? 3.6   // ADD (trigger entry) stop mult
    const entryMultDn = p.entryMultDn ?? 3.9 // ENTRY 1 (bar break) stop mult — wider
    const addFreedMin = p.addFreedMin ?? 0.2 // add fires when the stop rise frees ≥ this FRACTION of current risk
    const recycleMult = p.recycleMult ?? 6.0 // near-extreme upper dev zone (below 6.9) that arms a recycle 50%
    let phase = 0          // 0=SCAN 1=ARM 2=IN
    let pbLow = NaN
    let activeStop = NaN     // current position stop; checked every bar in IN
    let lastFill = NaN       // most recent entry/add fill price (reference for % risk gate)
    let coverArmed = false, ex1 = false, ex2 = false
    let recycleArmed = false, recycled = false       // near-extreme (6.0) zone reached; recycle 50% fired
    let add1Done = false, sold = false                // add1Done = first add fired; sold = adding stops
    let pendingEntry = false                          // E1 trigger fires → fill at NEXT bar's open
    let addedThisPullback = false                     // one add per 50ema pullback episode
    for (let i = 90; i < rc.data.length; i++) {
      if (regimes[i] < 0) continue
      if (phase === 0) { pendingEntry = false; addedThisPullback = false; add1Done = false; sold = false; recycleArmed = false; recycled = false; lastFill = NaN }   // clear between trades
      const bullLeg = regimes[i] <= 2
      // abandon current trade if macro flips bear
      if (phase !== 0 && !bullLeg) { phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false }
      // SCAN: a fresh pullback to 50ema starts one episode — but ONLY when
      // momentum is green (39 > 61). While 39 < 61 we sit out, even in a bull regime.
      if (phase === 0) {
        if (bullLeg && e39[i] > e61[i] && low[i] <= eFast[i]) {
          phase = 1; pbLow = low[i]; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
          pullbacks.push({ idx: i, dir: 1 })
        }
        continue
      }
      // ARM: track pullback low; on close-confirmed break, ARM a pending entry that
      // fills at the OPEN of the FOLLOWING bar (execution realism — not the break level).
      if (phase === 1) {
        pbLow = Math.min(pbLow, low[i])
        if (pendingEntry) {                            // trigger fired last bar → fill at THIS open
          activeStop = e89[i] - a89[i] * entryMultDn     // ENTRY 1 stop = 3.9 band (wider)
          lastFill = open[i]
          entries.push({ idx: i, dir: 1, price: open[i], stop: activeStop, kind: 1 })
          pendingEntry = false
          phase = 2
          // FIRST ADD is immediate: fires on this entry-fill bar at the open, no pullback
          // needed. Ratchets the stop to the tighter 3.6 band. Subsequent adds fill ON a pullback.
          activeStop = e89[i] - a89[i] * tightDn           // add1 stop = 3.6 band
          entries.push({ idx: i, dir: 1, price: open[i], stop: activeStop, kind: 2 })
          lastFill = open[i]
          add1Done = true
          // fall through to IN so this bar's stop/cover checks run against the open fill
        } else {
          if (close[i] > high[i - 1]) pendingEntry = true   // trigger → enter NEXT bar at open
          continue
        }
      }
      // IN — STOP-OUT first (highest priority), then cover, escape, then add
      if (low[i] <= activeStop) {
        stopOuts.push({ idx: i, dir: 1, price: activeStop })
        phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
        continue
      }
      // IN — cover (6.9 hit) / recycle (near-extreme) / escape (39/61), then add
      if (regimes[i] === 1) coverArmed = true                 // 6.9 upper hit arms full cover
      if (high[i] >= e72[i] + a72[i] * recycleMult) recycleArmed = true   // near-extreme (almost 6.9) zone
      if (coverArmed) {
        if (!ex1 && low[i] < low[i - 1]) { exits.push({ idx: i, dir: 1, price: low[i], kind: 1 }); ex1 = true; sold = true }   // 1st cover → no more adds
        if (!ex2 && e9[i] < e20[i] && e9[i - 1] >= e20[i - 1]) { exits.push({ idx: i, dir: 1, price: close[i], kind: 2 }); ex2 = true; sold = true }
        if (ex1 && ex2) { phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false; continue }
      } else {
        // RECYCLE: price reached the near-extreme zone but never cleanly tagged 6.9. If the 9/20
        // then flips bearish, take 50% off (recycle) to bank the almost-hit run. Fires once; the
        // remaining half rides until the 39/61 escape below. Frozen on any sell (sold=true).
        if (recycleArmed && !recycled && !sold && e9[i] < e20[i] && e9[i - 1] >= e20[i - 1]) {
          exits.push({ idx: i, dir: 1, price: close[i], kind: 4 }); recycled = true; sold = true
        }
        // ESCAPE HATCH: 39 below 61 (bearish momentum) → sell out (full, or remaining 50% post-recycle).
        if (e39[i] < e61[i]) {
          exits.push({ idx: i, dir: 1, price: close[i], kind: 3 })
          phase = 0; coverArmed = false; ex1 = false; ex2 = false; add1Done = false; sold = false; addedThisPullback = false; recycleArmed = false; recycled = false
          continue
        }
      }
      // MULTI-ADD: add1 was immediate (add1Done). Each FRESH pullback to the 50ema during the
      // trade FILLS an add directly AT the mean (limit order sitting on the 50ema), gated by the
      // freed-risk %. One add per pullback episode — addedThisPullback resets once price LEAVES
      // the mean (low > eFast), so the next touch is a fresh pullback. Frozen on any sell (sold).
      if (!sold && add1Done) {
        if (low[i] <= eFast[i] && !addedThisPullback) {        // fresh pullback touching the 50ema
          const newStop = e89[i] - a89[i] * tightDn            // candidate add stop = 3.6 band
          const freed = newStop - activeStop                   // $ of risk the rising band freed
          const curRisk = lastFill - activeStop                // per-share risk from most recent fill
          // GATE (PERCENT): fill only when the stop rise frees ≥ 20% of current risk. If the band
          // hasn't risen enough yet the touch is skipped and retries on the next pullback.
          if (curRisk > 0 && freed >= addFreedMin * curRisk) {
            activeStop = newStop
            entries.push({ idx: i, dir: 1, price: eFast[i], stop: activeStop, kind: 2 })  // limit fill @ 50ema
            lastFill = eFast[i]
            addedThisPullback = true                           // one add per episode
          }
        }
        if (low[i] > eFast[i]) addedThisPullback = false       // price left the mean → next touch is fresh
      }
    }
    } catch { /* trade logic error → arrays stay as-is, chart still renders */ }

    if (showRegime) {
    const shade = [
      cl.regime_up      || 'rgba(34,197,94,.05)',
      cl.regime_extreme || 'rgba(230,140,0,.10)',
      cl.regime_reset   || 'rgba(250,204,21,.08)',
      cl.regime_down    || 'rgba(239,68,68,.05)',
      cl.regime_extreme || 'rgba(230,140,0,.10)',
      cl.regime_reset   || 'rgba(250,204,21,.08)',
    ]
    for (let i = Math.max(89, rc.vs); i <= rc.ve; i++) {
      const s = regimes[i]
      if (s < 0) continue
      const x = rc.xCtr(i - rc.vs)
      rc.ctx.fillStyle = shade[s]
      rc.ctx.fillRect(x - half, 0, slot, pH)
    }

    // ── Title: current regime at top-left ──
    const labels = ['UPTREND', 'EXTREME UP', 'RESET', 'BACKSIDE', 'EXTREME DOWN', 'RESET']
    const titleCols = [
      cl.regime_up || 'rgba(34,197,94,.9)',
      cl.regime_extreme || 'rgba(230,140,0,.95)',
      cl.regime_reset || 'rgba(250,204,21,.95)',
      cl.regime_down || 'rgba(239,68,68,.9)',
      cl.regime_extreme || 'rgba(230,140,0,.95)',
      cl.regime_reset || 'rgba(250,204,21,.95)',
    ]
    let cur = -1
    for (let i = rc.ve; i >= 0; i--) { if (regimes[i] >= 0) { cur = regimes[i]; break } }
    if (cur >= 0) {
      rc.ctx.save()
      rc.ctx.font = '700 11px JetBrains Mono, monospace'
      rc.ctx.fillStyle = titleCols[cur]
      rc.ctx.textBaseline = 'top'
      rc.ctx.fillText('▮ ' + labels[cur], 12, 8)
      rc.ctx.restore()
    }
    } // showRegime
  }

  // ── Layer 1b: Trend Pitch cloud — its own EMA cloud (pitchEma), pitch-colored ──
  //   Pitch = blended slope of the EMA over 10/30/60-bar windows, ATR-normalized
  //   (identical to the LinguaCycle trend pitch). Cloud is GREEN when rising, RED when
  //   falling. pitchTf can base it on a HIGHER TF (forward-filled onto this chart).
  if ((p.showPitch ?? 1) !== 0) {
    const ptLabel = String(p.pitchTf ?? 'Active')
    const ptMin = PITCH_TF_MIN[ptLabel] ?? '0'
    const peP = p.pitchEma ?? 63
    const pbP = p.pitchBand ?? 1
    let pEma: number[] = [], pAtr: number[] = [], pPitch: number[] = []
    if (ptMin === '0') {
      const h = rc.data.map((b: any) => +b.high), l = rc.data.map((b: any) => +b.low)
      pEma = ema(close, peP); pAtr = wilderAtr(h, l, close, peP); pPitch = blendedPitch(pEma, pAtr)
    } else {
      const src = _execPitch[rc.panelIdx ?? 0]
      if (src && src.times.length) {
        pEma = new Array(close.length).fill(NaN); pAtr = new Array(close.length).fill(NaN); pPitch = new Array(close.length).fill(NaN)
        for (let i = 0; i < close.length; i++) {
          const t = (rc.data[i] as any).time
          if (t == null) continue
          const k = execFfillIdx(src.times, t)
          if (k >= 0) { pEma[i] = src.eTrend[k]; pAtr[i] = src.aTrend[k]; pPitch[i] = src.pitch[k] }
        }
      }
    }
    drawPitchCloud(rc, pEma, pAtr, pPitch, pbP, cl.pitch_up || 'rgba(34,197,94,1)', cl.pitch_dn || 'rgba(239,68,68,1)')
    drawPitchReadout(rc, pPitch, ptLabel)
  }

  // ── Layer 2: pullback markers (setup bar = price tags 50ema) ──
  if (showPullback && pullbacks.length) {
    const pSize = Math.max(3, p.pbSize ?? 5)
    for (const pb of pullbacks) {
      if (pb.idx < rc.vs || pb.idx > rc.ve) continue
      const x = rc.xCtr(pb.idx - rc.vs)
      const y = rc.pToY(eFast[pb.idx])
      const col = pb.dir > 0 ? (cl.pb_long || 'rgba(34,197,94,.95)') : (cl.pb_short || 'rgba(239,68,68,.95)')
      rc.ctx.beginPath()
      rc.ctx.arc(x, y, pSize, 0, Math.PI * 2)
      rc.ctx.fillStyle = col
      rc.ctx.fill()
      rc.ctx.lineWidth = 1.2
      rc.ctx.strokeStyle = 'rgba(255,255,255,.35)'
      rc.ctx.stroke()
    }
  }

  // ── Layer 3 + 4: entry arrows + RED stop lines + exits + stop-outs ──
  // Both the initial entry (kind 1) and the add (kind 2) render as green long
  // arrows, EACH with its own RED stop line so the two risks are unambiguous.
  // The add is labelled "ADD" and uses a shorter stop projection to cut clutter.
  if ((p.showEntry ?? 1) && entries.length) {
    const eSize = Math.max(4, p.entrySize ?? 7)
    const showRisk = p.showRiskBox ?? 1
    const stopCol = cl.stop_line || 'rgba(239,68,68,.95)'   // stops always RED = risk
    for (const e of entries) {
      if (e.idx < rc.vs || e.idx > rc.ve) continue
      const x = rc.xCtr(e.idx - rc.vs)
      const y = rc.pToY(e.price)
      const isLong = e.dir > 0
      const col = isLong ? (cl.entry_long || 'rgba(34,197,94,1)') : (cl.entry_short || 'rgba(239,68,68,1)')
      const sy = rc.pToY(e.stop)
      const proj = Math.round((p.stopProj ?? 6) * (e.kind === 2 ? 0.6 : 1))
      const x0 = rc.xCtr(Math.max(rc.vs, e.idx - 3) - rc.vs)
      const x1 = rc.xCtr(Math.min(rc.ve, e.idx + proj) - rc.vs)

      // Risk zone on the starter entry only (avoids stacking two boxes)
      if (showRisk && e.kind === 1) {
        const yTop = Math.min(y, sy), yBot = Math.max(y, sy)
        rc.ctx.fillStyle = isLong ? (cl.risk_long || 'rgba(34,197,94,.07)') : (cl.risk_short || 'rgba(239,68,68,.07)')
        rc.ctx.fillRect(x0, yTop, x1 - x0, yBot - yTop)
      }
      // RED stop: vertical connector + dashed horizontal line (both entries)
      rc.ctx.save()
      rc.ctx.setLineDash([2, 3]); rc.ctx.strokeStyle = stopCol; rc.ctx.lineWidth = 1
      rc.ctx.beginPath(); rc.ctx.moveTo(x, y); rc.ctx.lineTo(x, sy); rc.ctx.stroke()
      rc.ctx.setLineDash([5, 3]); rc.ctx.lineWidth = 1.6
      rc.ctx.beginPath(); rc.ctx.moveTo(x0, sy); rc.ctx.lineTo(x1, sy); rc.ctx.stroke()
      rc.ctx.restore()
      // Green entry arrow (add slightly smaller + ADD label = 2nd entry)
      const aSize = e.kind === 2 ? Math.max(4, eSize - 2) : eSize
      drawArrow(rc.ctx, x, y, isLong ? 'up' : 'down', aSize, col)
      rc.ctx.save()
      rc.ctx.font = '700 8px JetBrains Mono, monospace'; rc.ctx.fillStyle = col; rc.ctx.textBaseline = 'bottom'
      rc.ctx.fillText(e.kind === 2 ? 'ADD' : 'E1', x + aSize + 2, y + aSize); rc.ctx.restore()
    }
  }

  // ── Exits (cover = SELL → RED down-wedges) after 6.9 upper hit ──
  //   kind 1 = first bar-break (50%), kind 2 = 9/20 cross (50%)
  if ((p.showExit ?? 1) && exits.length) {
    const xSize = Math.max(5, p.exitSize ?? 8)
    const col = cl.exit_long || 'rgba(239,68,68,1)'   // covers always RED (selling)
    for (const ex of exits) {
      if (ex.idx < rc.vs || ex.idx > rc.ve) continue
      const x = rc.xCtr(ex.idx - rc.vs)
      const y = rc.pToY(ex.price)
      drawWedge(rc.ctx, x, y, xSize, 'down', col)      // apex at price, base above → sell tag
      rc.ctx.save()
      rc.ctx.fillStyle = col; rc.ctx.font = '700 8px JetBrains Mono, monospace'; rc.ctx.textBaseline = 'bottom'
      rc.ctx.fillText(ex.kind === 2 ? '9/20' : (ex.kind as number) === 3 ? '39/61' : (ex.kind as number) === 4 ? 'RC' : 'BRK', x + xSize + 2, y - xSize - 2)
      rc.ctx.restore()
    }
  }

  // ── Stop-outs (loss): RED down-wedge + 'SL' label, same style as covers ──
  if ((p.showStop ?? 1) && stopOuts.length) {
    const xSize = Math.max(5, p.exitSize ?? 8)
    const col = cl.stop_line || 'rgba(239,68,68,1)'
    for (const so of stopOuts) {
      if (so.idx < rc.vs || so.idx > rc.ve) continue
      const x = rc.xCtr(so.idx - rc.vs)
      const y = rc.pToY(so.price)
      drawWedge(rc.ctx, x, y, xSize, 'down', col)
      rc.ctx.save()
      rc.ctx.fillStyle = col; rc.ctx.font = '700 8px JetBrains Mono, monospace'; rc.ctx.textBaseline = 'bottom'
      rc.ctx.fillText('SL', x + xSize + 2, y - xSize - 2)
      rc.ctx.restore()
    }
  }

  // Regime cloud — green when fast >= slow, red otherwise (drawEMABand segments).
  drawEMABand(rc, eFast, eSlow,
    cl.bull_fill || 'rgba(34,197,94,.15)',   // green fill (bull)
    cl.bear_fill || 'rgba(239,68,68,.15)',   // red fill (bear)
    cl.bull_line || 'rgba(34,197,94,.55)',   // green line
    cl.bear_line || 'rgba(239,68,68,.55)',   // red line
  )

  if (!showWedge) return

  // ── Switch wedges at each EMA cross ──
  const { ctx, vs, ve, xCtr, pToY, candleW } = rc
  const size = Math.max(3, wedgeSize)
  const gap = size * 0.5
  let prevSign = 0
  for (let i = 0; i < eFast.length; i++) {
    if (isNaN(eFast[i]) || isNaN(eSlow[i])) { prevSign = 0; continue }
    const sign = eFast[i] > eSlow[i] ? 1 : (eFast[i] < eSlow[i] ? -1 : 0)
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign && i >= vs && i <= ve) {
      const bar = rc.data[i]
      const x = xCtr(i - vs)
      if (sign > 0) {
        // cross UP → switching to bull/green: green ▲ below bar, apex up
        const apexY = pToY(bar.low) + gap
        drawWedge(ctx, x, apexY, size, 'up', cl.wedge_up || 'rgba(34,197,94,0.95)')
      } else {
        // cross DOWN → switching to bear/red: red ▼ above bar, apex down
        const apexY = pToY(bar.high) - gap
        drawWedge(ctx, x, apexY, size, 'down', cl.wedge_down || 'rgba(239,68,68,0.95)')
      }
    }
    if (sign !== 0) prevSign = sign
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  dir: 'up' | 'down', size: number, color: string,
) {
  const head = size, shaft = size * 1.4, w = size * 0.7
  const outline = 'rgba(8,10,14,.9)'   // dark outline so the arrow pops on any bg
  ctx.save()
  // --- shaft: thick dark base, thin color core on top ---
  ctx.strokeStyle = outline
  ctx.lineWidth = Math.max(2.5, size * 0.34)
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (dir === 'up') { ctx.moveTo(x, y + head + shaft); ctx.lineTo(x, y + head) }
  else { ctx.moveTo(x, y - head - shaft); ctx.lineTo(x, y - head) }
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, size * 0.16)
  ctx.beginPath()
  if (dir === 'up') { ctx.moveTo(x, y + head + shaft); ctx.lineTo(x, y + head) }
  else { ctx.moveTo(x, y - head - shaft); ctx.lineTo(x, y - head) }
  ctx.stroke()
  // --- arrowhead: color fill + dark outline (same treatment as wedges) ---
  ctx.beginPath()
  if (dir === 'up') {
    ctx.moveTo(x, y); ctx.lineTo(x - w / 2, y + head); ctx.lineTo(x + w / 2, y + head)
  } else {
    ctx.moveTo(x, y); ctx.lineTo(x - w / 2, y - head); ctx.lineTo(x + w / 2, y - head)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = Math.max(1, size * 0.18)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = outline
  ctx.stroke()
  ctx.restore()
}

export function drawWedge(
  ctx: CanvasRenderingContext2D, x: number, apexY: number, size: number,
  dir: 'up' | 'down', color: string,
) {
  const h = size, w = size * 0.9
  ctx.save()
  ctx.beginPath()
  if (dir === 'up') {
    // apex at (x, apexY) pointing up; base below
    ctx.moveTo(x, apexY)
    ctx.lineTo(x - w / 2, apexY + h)
    ctx.lineTo(x + w / 2, apexY + h)
  } else {
    // apex at (x, apexY) pointing down; base above
    ctx.moveTo(x, apexY)
    ctx.lineTo(x - w / 2, apexY - h)
    ctx.lineTo(x + w / 2, apexY - h)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  // dark outline so the wedge pops on any background (clarity)
  ctx.lineWidth = Math.max(1, size * 0.18)
  ctx.strokeStyle = 'rgba(8,10,14,.9)'
  ctx.stroke()
  ctx.restore()
}

// ── Trend Pitch (ported from LinguaCycle, self-contained) ──
// Identical formula: blended slope of a trend EMA over [10,30,60] windows, ATR-normalized,
// then pitchToDeg = atan(ratio * PITCH_K) * 180/π. PITCH_K=6 matches render-lingua.ts.
const PITCH_WIN = [10, 30, 60]
const PITCH_K = 6
const PITCH_TF_MIN: Record<string, string> = { 'Active': '0', '1H': '60', '4H': '240', 'D': 'D', 'W': 'W' }

function blendedPitch(eTrend: number[], aTrend: number[]): number[] {
  const out = new Array(eTrend.length).fill(NaN)
  for (let i = 0; i < eTrend.length; i++) {
    if (isNaN(eTrend[i]) || isNaN(aTrend[i]) || aTrend[i] === 0) continue
    let sum = 0, cnt = 0
    for (const w of PITCH_WIN) {
      if (i >= w && !isNaN(eTrend[i - w])) { sum += (eTrend[i] - eTrend[i - w]) / w / aTrend[i]; cnt++ }
    }
    if (cnt > 0) out[i] = sum / cnt
  }
  return out
}
function pitchToDeg(ratio: number): number { return Math.atan(ratio * PITCH_K) * 180 / Math.PI }

// Largest index k with times[k] <= t (binary search, ascending). -1 if none.
function execFfillIdx(times: number[], t: number): number {
  let lo = 0, hi = times.length - 1, ans = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans
}

// Cross-TF pitch cache (fed by ReactChartPanel via setLinguaExecPitch).
let _execPitch: Record<number, { times: number[]; eTrend: number[]; aTrend: number[]; pitch: number[] }> = {}
export function setLinguaExecPitch(panelIdx: number, bars: { time: number; high: number; low: number; close: number }[]) {
  if (!bars || bars.length < 70) return
  const lp = (getMergedToolParams(panelIdx, 'lingua_exec') as any) || {}
  const trendEma = lp.pitchEma ?? 63
  const close = bars.map(b => b.close), high = bars.map(b => b.high), low = bars.map(b => b.low), times = bars.map(b => b.time)
  const eTrend = ema(close, trendEma)
  const aTrend = wilderAtr(high, low, close, trendEma)
  _execPitch[panelIdx] = { times, eTrend, aTrend, pitch: blendedPitch(eTrend, aTrend) }
}

// Pitch cloud: GREEN when rising, RED when falling, split into sign-stable runs.
function drawPitchCloud(rc: RenderContext, emaArr: number[], atrArr: number[], pitchArr: number[], band: number, upCol: string, dnCol: string) {
  const ctx = rc.ctx, vs = rc.vs, ve = rc.ve
  const upSegs: { x: number; yU: number; yL: number; yC: number }[][] = []
  const dnSegs: typeof upSegs = []
  let run: { sign: number; pts: { x: number; yU: number; yL: number; yC: number }[] } | null = null
  const flush = () => { if (run && run.pts.length > 1) (run.sign > 0 ? upSegs : dnSegs).push(run.pts); run = null }
  for (let i = vs; i <= ve; i++) {
    const e = emaArr[i], a = atrArr[i], pi = pitchArr[i]
    if (isNaN(e) || isNaN(a)) { flush(); continue }
    const sign = (!isNaN(pi) && pi > 0) ? 1 : (!isNaN(pi) && pi < 0) ? -1 : 0
    if (sign === 0) { flush(); continue }
    const pt = { x: rc.xCtr(i - vs), yU: rc.pToY(e + band * a), yL: rc.pToY(e - band * a), yC: rc.pToY(e) }
    if (!run || run.sign !== sign) { flush(); run = { sign, pts: [pt] } } else run.pts.push(pt)
  }
  flush()
  const drawSeg = (pts: { x: number; yU: number; yL: number; yC: number }[], col: string) => {
    if (pts.length < 2) return
    ctx.save()
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].yU)
    for (const p of pts) ctx.lineTo(p.x, p.yU)
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].yL)
    ctx.closePath(); ctx.globalAlpha = 0.12; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].yC)
    for (const p of pts) ctx.lineTo(p.x, p.yC)
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke()
    ctx.restore()
  }
  for (const s of upSegs) drawSeg(s, upCol)
  for (const s of dnSegs) drawSeg(s, dnCol)
}

// Pitch readout (top-right): TF + arrow + degrees + regime word, colored by sign.
function drawPitchReadout(rc: RenderContext, pitchArr: number[], tfLabel: string) {
  let idx = -1
  for (let i = rc.ve; i >= rc.vs; i--) { if (!isNaN(pitchArr[i])) { idx = i; break } }
  if (idx < 0) return
  const deg = pitchToDeg(pitchArr[idx])
  const absD = Math.abs(deg)
  let regime = 'FLAT'
  if (deg > 1) regime = absD > 55 ? 'VIOLENT' : absD > 25 ? 'TRENDING' : 'RISING'
  else if (deg < -1) regime = absD > 55 ? 'CRASHING' : absD > 25 ? 'DOWNTREND' : 'FALLING'
  const col = deg >= 0 ? '#81c998' : '#ef9a9a'
  const ctx = rc.ctx
  const W = (rc as any).W || 800, PRICE_W = (rc as any).PRICE_W || 0
  const lbl = `${tfLabel} ${deg >= 0 ? '▲' : '▼'} ${absD.toFixed(1)}° ${regime}`
  ctx.save()
  ctx.font = '700 11px JetBrains Mono, monospace'; ctx.textBaseline = 'top'
  const tw = ctx.measureText(lbl).width
  const x = W - PRICE_W - tw - 8, y = 38
  ctx.fillStyle = 'rgba(8,12,20,0.9)'; ctx.fillRect(x - 6, y - 3, tw + 12, 17)
  ctx.fillStyle = col; ctx.fillText(lbl, x, y)
  ctx.restore()
}
