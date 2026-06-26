/**
 * render-linguafast.ts — Lingua Cycle (Fast): two editable EMA clouds.
 *
 * Uses the PROVEN drawEMABand (same function the working Lingua cloud uses) — no
 * hand-rolled draw loop. Just two editable clouds:
 *   - Fast cloud: 9 / 20
 *   - Slow cloud: 72 / 89
 */
import type { RenderContext } from './render-types'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'
import { drawEMABand } from './render-indicators'

// EMA seeded from the first finite value. Returns (number|null)[] — warmup/gap
// bars are NULL, not NaN. CRITICAL: drawEMABand skips bars via `null == t[e]`,
// and `null == NaN` is FALSE, so NaN warmup bars would feed pToY(NaN) into the
// canvas path and break it (nothing plots). This was the 4-hour bug.
function ema(src: number[], span: number): (number | null)[] {
  const n = src.length, out: (number | null)[] = new Array(n).fill(null)
  if (n === 0) return out
  const k = 2 / (span + 1)
  let prev = NaN, startIdx = 0
  for (let i = 0; i < n; i++) {
    if (!isNaN(src[i])) { prev = src[i]; startIdx = i; break }
    out[i] = null
  }
  if (isNaN(prev)) return out
  out[startIdx] = prev
  for (let i = startIdx + 1; i < n; i++) {
    if (isNaN(src[i])) { out[i] = prev; continue }
    prev = src[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function renderLinguaFast(rc: RenderContext) {
  try {
    const panelIdx = rc.panelIdx ?? 0
    const tool = useToolStore.getState().tools.find((t: any) => t.indKey === 'linguafast')
    if (!tool || !tool.on) return
    const p = getMergedToolParams(panelIdx, 'linguafast') as any

    const lfFast1 = (p.lfFast1 as number) ?? 9
    const lfFast2 = (p.lfFast2 as number) ?? 20
    const lfSlow1 = (p.lfSlow1 as number) ?? 72
    const lfSlow2 = (p.lfSlow2 as number) ?? 89

    if (!rc.data || rc.data.length < 50 || rc.visible.length === 0) return
    const close = rc.data.map((b: any) => b.close as number)

    const f1 = ema(close, lfFast1), f2 = ema(close, lfFast2)
    const s1 = ema(close, lfSlow1), s2 = ema(close, lfSlow2)

    // slow cloud (72/89) behind, fast cloud (9/20) on top — both via the proven drawEMABand
    drawEMABand(rc, s1, s2, 'rgba(0,180,140,0.10)', 'rgba(210,70,50,0.10)', 'rgba(180,160,90,0.45)', 'rgba(180,160,90,0.45)')
    drawEMABand(rc, f1, f2, 'rgba(0,200,120,0.16)', 'rgba(230,90,60,0.16)', 'rgba(0,229,255,0.85)', 'rgba(0,229,255,0.85)')
  } catch (e) {
    console.error('[linguafast] threw:', e)
  }
}
