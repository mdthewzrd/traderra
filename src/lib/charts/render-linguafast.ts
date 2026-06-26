/**
 * render-linguafast.ts — Lingua Cycle (Fast): two editable EMA clouds.
 *
 * Per user: strip the over-engineered classifier (it was "all over the place").
 * Just two visible CLOUDS with editable EMA values:
 *   - Fast cloud: 9 / 20 (tight, tracks near-term trend)
 *   - Slow cloud: 72 / 89 (wide, the macro trend base)
 * Each cloud is tinted by its own trend (fast-above-slow = bull green, below = bear red).
 * That's it — clean, editable, build regime logic back on top later once we can see it.
 */
import type { RenderContext } from './render-types'
import { useToolStore, getMergedToolParams } from '@/stores/charts/toolStore'

function ema(src: number[], len: number): number[] {
  const n = src.length, k = 2 / (len + 1), out = new Array(n).fill(NaN)
  let prev = NaN
  for (let i = 0; i < n; i++) {
    const v = src[i]
    if (isNaN(v)) continue
    if (isNaN(prev)) prev = v
    else prev = v * k + prev * (1 - k)
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

    const { ctx, data, vs, visible, xCtr, pToY, barW } = rc
    if (!data || data.length < 50 || visible.length === 0) return

    const close = data.map((b: any) => b.close as number)
    const f1 = ema(close, lfFast1), f2 = ema(close, lfFast2)
    const s1 = ema(close, lfSlow1), s2 = ema(close, lfSlow2)

    // draw a cloud: band fill between the two EMAs (tinted by trend) + thin edge lines
    const drawCloud = (a: number[], b: number[], bullCol: string, bearCol: string, edgeCol: string) => {
      for (let i = 0; i < visible.length - 1; i++) {
        const ai = vs + i
        if (isNaN(a[ai]) || isNaN(b[ai])) continue
        const x1 = xCtr(i) - barW / 2
        const top = pToY(Math.max(a[ai], b[ai]))
        const bot = pToY(Math.min(a[ai], b[ai]))
        ctx.fillStyle = a[ai] >= b[ai] ? bullCol : bearCol
        ctx.fillRect(x1, top, barW + 0.5, bot - top)
      }
      ctx.strokeStyle = edgeCol; ctx.lineWidth = 1; ctx.lineJoin = 'round'
      for (const arr of [a, b]) {
        ctx.beginPath()
        let started = false
        for (let i = 0; i < visible.length; i++) {
          const ai = vs + i, v = arr[ai]
          if (v == null || isNaN(v)) { started = false; continue }
          const x = xCtr(i), y = pToY(v)
          if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    // slow cloud (72/89) behind, fast cloud (9/20) on top
    drawCloud(s1, s2, 'rgba(0,180,140,0.10)', 'rgba(210,70,50,0.10)', 'rgba(180,160,90,0.45)')
    drawCloud(f1, f2, 'rgba(0,200,120,0.16)', 'rgba(230,90,60,0.16)', 'rgba(0,229,255,0.7)')
  } catch (e) {
    console.error('[linguafast] threw:', e)
  }
}
