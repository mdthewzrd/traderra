/**
 * Indicator registry — master definition of every chart indicator.
 * Extracted from inline JS (lines 1830-1870).
 * Each entry defines: label, group, color keys, and configurable parameters.
 */

export interface IndParam {
  key: string
  label: string
  def: number
  min?: number
  max?: number
  step?: number
  type?: 'toggle'
}

export interface IndDef {
  label: string
  group: string
  colors?: string[]
  colorLabels?: string[]
  params?: IndParam[]
}

export const IND_REGISTRY: Record<string, IndDef> = {
  ema9:     { label: 'EMA 9',  group: 'MA', colors: ['ema9'], params: [{ key: 'period', label: 'Period', def: 9, min: 1, max: 500 }] },
  ema20:    { label: 'EMA 20', group: 'MA', colors: ['ema20'], params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }] },
  ema50:    { label: 'EMA 50', group: 'MA', colors: ['ema50'], params: [{ key: 'period', label: 'Period', def: 50, min: 1, max: 500 }] },
  ema150:   { label: 'EMA 150', group: 'MA', colors: ['ema150'], params: [{ key: 'period', label: 'Period', def: 150, min: 1, max: 500 }] },
  ema200:   { label: 'EMA 200', group: 'MA', colors: ['ema200'], params: [{ key: 'period', label: 'Period', def: 200, min: 1, max: 500 }] },
  ema40_60: { label: 'EMA 40/60', group: 'MA', colors: ['ema40_60_fill', 'ema40_60_line'], colorLabels: ['Fill', 'Line'], params: [{ key: 'fast', label: 'Fast', def: 40, min: 1, max: 500 }, { key: 'slow', label: 'Slow', def: 60, min: 1, max: 500 }] },
  band_9_20: { label: 'EMA Band 9/20', group: 'EMA Bands', colors: ['band_9_20_bull_fill', 'band_9_20_bull_line', 'band_9_20_bear_fill', 'band_9_20_bear_line'], colorLabels: ['Bull Fill', 'Bull Line', 'Bear Fill', 'Bear Line'] },
  band_72_89: { label: 'EMA Band 72/89', group: 'EMA Bands', colors: ['band_72_89_bull_fill', 'band_72_89_bull_line', 'band_72_89_bear_fill', 'band_72_89_bear_line'], colorLabels: ['Bull Fill', 'Bull Line', 'Bear Fill', 'Bear Line'] },
  dev_s_9_20: { label: 'Dev Band S 9/20', group: 'Dev Bands', colors: ['dev_s_9_20_up_fill', 'dev_s_9_20_up_line', 'dev_s_9_20_dn_fill', 'dev_s_9_20_dn_line'], colorLabels: ['Upper Fill', 'Upper Line', 'Lower Fill', 'Lower Line'], params: [{ key: 'fast', label: 'Fast', def: 9, min: 1, max: 200 }, { key: 'slow', label: 'Slow', def: 20, min: 1, max: 200 }, { key: 'upLow', label: 'Up Mult Low', def: 0.5, step: 0.1 }, { key: 'upHigh', label: 'Up Mult High', def: 1, step: 0.1 }, { key: 'dnLow', label: 'Dn Mult Low', def: 2, step: 0.1 }, { key: 'dnHigh', label: 'Dn Mult High', def: 2.4, step: 0.1 }] },
  dev_l_9_20: { label: 'Dev Band L 9/20', group: 'Dev Bands', colors: ['dev_l_9_20_up_fill', 'dev_l_9_20_up_line', 'dev_l_9_20_dn_fill', 'dev_l_9_20_dn_line'], colorLabels: ['Upper Fill', 'Upper Line', 'Lower Fill', 'Lower Line'], params: [{ key: 'fast', label: 'Fast', def: 9, min: 1, max: 200 }, { key: 'slow', label: 'Slow', def: 20, min: 1, max: 200 }, { key: 'upLow', label: 'Up Mult Low', def: 2, step: 0.1 }, { key: 'upHigh', label: 'Up Mult High', def: 2.4, step: 0.1 }, { key: 'dnLow', label: 'Dn Mult Low', def: 0.5, step: 0.1 }, { key: 'dnHigh', label: 'Dn Mult High', def: 1, step: 0.1 }] },
  db_72_89: { label: 'Dev Band 72/89', group: 'Dev Bands', colors: ['db_72_89_up_fill', 'db_72_89_up_line', 'db_72_89_dn_fill', 'db_72_89_dn_line'], colorLabels: ['Upper Fill', 'Upper Line', 'Lower Fill', 'Lower Line'], params: [{ key: 'fast', label: 'Fast', def: 72, min: 1, max: 500 }, { key: 'slow', label: 'Slow', def: 89, min: 1, max: 500 }, { key: 'upLow', label: 'Up Mult Low', def: 6.9, step: 0.1 }, { key: 'upHigh', label: 'Up Mult High', def: 9.6, step: 0.1 }, { key: 'dnLow', label: 'Dn Mult Low', def: 6.9, step: 0.1 }, { key: 'dnHigh', label: 'Dn Mult High', def: 9.6, step: 0.1 }] },
  db_upper: { label: 'Dev Upper (Sam)', group: 'Dev Bands', colors: ['db_upper_fill', 'db_upper_line'], colorLabels: ['Fill', 'Line'], params: [{ key: 'ema', label: 'EMA Period', def: 20, min: 1, max: 200 }, { key: 'atr', label: 'ATR Period', def: 20, min: 1, max: 200 }, { key: 'mult', label: 'Multiplier', def: 2, step: 0.1 }] },
  db_low1: { label: 'Dev Low 1 (Sam)', group: 'Dev Bands', colors: ['db_low1_fill', 'db_low1_line'], colorLabels: ['Fill', 'Line'], params: [{ key: 'ema', label: 'EMA Period', def: 9, min: 1, max: 200 }, { key: 'atr', label: 'ATR Period', def: 9, min: 1, max: 200 }, { key: 'mult', label: 'Multiplier', def: 2, step: 0.1 }] },
  db_low2: { label: 'Dev Low 2 (Sam)', group: 'Dev Bands', colors: ['db_low2_fill', 'db_low2_line'], colorLabels: ['Fill', 'Line'], params: [{ key: 'ema', label: 'EMA Period', def: 20, min: 1, max: 200 }, { key: 'atr', label: 'ATR Period', def: 20, min: 1, max: 200 }, { key: 'mult', label: 'Multiplier', def: 2, step: 0.1 }] },
  vwap: { label: 'VWAP', group: 'Overlays', colors: ['vwap'] },
  vol: { label: 'Volume', group: 'Overlays', colors: ['vol_up', 'vol_dn'], colorLabels: ['Up', 'Down'] },
  pdc: { label: 'Prior Day Close', group: 'Overlays' },
  pzones: { label: 'Key Levels', group: 'Overlays', colors: ['pz_sup_fill', 'pz_sup_line', 'pz_sup_label', 'pz_res_fill', 'pz_res_line', 'pz_res_label'], colorLabels: ['Sup Fill', 'Sup Line', 'Sup Label', 'Res Fill', 'Res Line', 'Res Label'], params: [
    { key: 'left', label: 'Look Left', def: 66, min: 5, max: 200 },
    { key: 'right', label: 'Look Right', def: 33, min: 1, max: 100 },
    { key: 'nPiv', label: 'Max Zones', def: 1, min: 1, max: 20 },
    { key: 'atrLen', label: 'ATR Length', def: 66, min: 5, max: 200 },
    { key: 'mult', label: 'Zone Width x ATR', def: 0.6, step: 0.1 },
    { key: 'per', label: 'Max Zone %', def: 1, step: 0.1 },
    { key: 'maxBoxes', label: 'Max Pattern Boxes', def: 10, min: 1, max: 50 },
    { key: 'offset', label: 'Label Offset', def: 30, min: 0, max: 100 },
    { key: 'showLabels', label: 'Show Price Labels', def: 1, min: 0, max: 1, type: 'toggle' },
    { key: 'lookbackBreaks', label: 'Lookback Breaks', def: 2, min: 1, max: 20 },
    { key: 'swingHL', label: 'Swing H/L', def: 5, min: 1, max: 50 },
    { key: 'sigHL', label: 'Significant H/L', def: 10, min: 1, max: 50 },
    { key: 'considerBar', label: 'Consider Bar', def: 1, min: 1, max: 10 },
  ] },
  bollinger: { label: 'Bollinger Bands', group: 'Overlays', colors: ['bb_fill', 'bb_upper', 'bb_lower'], colorLabels: ['Fill', 'Upper', 'Lower'], params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }, { key: 'stddev', label: 'Std Dev', def: 2, step: 0.1 }] },
  sma: { label: 'SMA', group: 'MA', colors: ['sma_color'], params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 500 }] },
  sma_vol: { label: 'Volume SMA', group: 'Volume', colors: ['vol_sma_color'], params: [{ key: 'period', label: 'Period', def: 20, min: 1, max: 200 }] },
  tl: { label: 'Trendlines', group: 'Annotations' },
  ann: { label: 'Annotations', group: 'Annotations' },
  otherann: { label: "Other Panels' Ann", group: 'Annotations' },
  exec: { label: 'Executions', group: 'Annotations' },
  btexec: { label: 'BT Executions', group: 'Annotations' },
}

/** Groups in display order */
export const IND_GROUPS = ['MA', 'EMA Bands', 'Dev Bands', 'Overlays', 'Volume', 'Annotations']
