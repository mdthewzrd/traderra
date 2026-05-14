/**
 * Panel render context — passed to all sub-render functions.
 * Computed once per frame in renderPanel(), then shared.
 */

export interface PanelState {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  data: any[]          // full bar array
  W: number
  H: number
  PRICE_W: number
  TIME_H: number
  viewStart: number
  viewBars: number
  cx: number           // mouse X
  cy: number           // mouse Y
  tf: string           // timeframe
  inds: Record<string, any>  // enabled indicators
  volFrac?: number
  priceScale?: number
}

export interface RenderContext extends PanelState {
  // Derived — computed in renderPanel setup
  chartW: number
  volH: number
  priceH: number
  vs: number           // clamped viewStart
  ve: number           // clamped viewEnd
  visible: any[]       // visible bars slice
  barW: number
  GAP: number
  candleW: number
  xCtr: (i: number) => number
  xLc: (i: number) => number
  xL: (i: number) => number
  minP: number
  maxP: number
  priceRange: number
  pToY: (v: number) => number
  annTimeToX: (t: number) => number | null
}
