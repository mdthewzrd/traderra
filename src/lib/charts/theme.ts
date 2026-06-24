/**
 * Chart theme colors — dark theme defaults.
 * Extracted from inline JS (lines 1790-1830).
 * Mutable object — values are overridden by user customizations.
 */

export const C: Record<string, string> = {
  bg: '#0c0e14', axisbg: '#0d0f18', grid: '#141926',
  up: '#26a69a', dn: '#ef5350',
  vol_up: 'rgba(38,166,154,0.5)', vol_dn: 'rgba(239,83,80,0.5)',
  axisLabel: '#6878a8', axisMuted: '#4a5580', axisHighlight: '#8090b0',
  crossLabelBg: '#141a2a', crossLabelBd: '#2a3050',
  ema9: '#e8d000', ema20: '#3a70e0', ema50: '#00c8e8', ema150: '#e0e0e0', ema200: '#e0e0e0', vwap: '#00e676',
  sma_color: '#5a9ae6',
  bb_fill: 'rgba(100,149,237,.08)', bb_upper: 'rgba(100,149,237,.40)', bb_lower: 'rgba(100,149,237,.40)',
  vol_sma_color: '#D4AF37',
  ema40_60_fill: 'rgba(0,200,232,0.10)', ema40_60_line: 'rgba(0,200,232,0.55)',
  db_upper_fill: 'rgba(200,120,20,.20)', db_upper_line: 'rgba(220,140,30,.90)',
  db_low1_fill: 'rgba(200,184,0,.20)', db_low1_line: 'rgba(220,200,10,.90)',
  db_low2_fill: 'rgba(20,120,200,.20)', db_low2_line: 'rgba(30,150,220,.90)',
  pre: 'rgba(120,120,120,.08)', after: 'rgba(60,60,60,.10)',
  cross: 'rgba(140,160,200,.5)',
  trendline: '#dde3f0',
  box_orange: '#f97316', box_yellow: '#eab308',
  hl_cyan: '#22d3ee', hl_magenta: '#e879f9', hl_green: '#4ade80', hl_white: '#cbd5e1',
  band_green: 'rgba(34,197,94,.15)', band_red: 'rgba(239,68,68,.15)',
  band_green_line: 'rgba(34,197,94,.50)', band_red_line: 'rgba(239,68,68,.50)',
  band_9_20_bull_fill: 'rgba(34,197,94,.15)', band_9_20_bull_line: 'rgba(34,197,94,.50)',
  band_9_20_bear_fill: 'rgba(239,68,68,.15)', band_9_20_bear_line: 'rgba(239,68,68,.50)',
  band_72_89_bull_fill: 'rgba(34,197,94,.15)', band_72_89_bull_line: 'rgba(34,197,94,.50)',
  band_72_89_bear_fill: 'rgba(239,68,68,.15)', band_72_89_bear_line: 'rgba(239,68,68,.50)',
  dev_s_9_20_up_fill: 'rgba(239,68,68,.15)', dev_s_9_20_up_line: 'rgba(239,68,68,.40)',
  dev_s_9_20_dn_fill: 'rgba(34,197,94,.15)', dev_s_9_20_dn_line: 'rgba(34,197,94,.40)',
  dev_l_9_20_up_fill: 'rgba(239,68,68,.15)', dev_l_9_20_up_line: 'rgba(239,68,68,.40)',
  dev_l_9_20_dn_fill: 'rgba(34,197,94,.15)', dev_l_9_20_dn_line: 'rgba(34,197,94,.40)',
  db_72_89_up_fill: 'rgba(239,68,68,.15)', db_72_89_up_line: 'rgba(239,68,68,.40)',
  db_72_89_dn_fill: 'rgba(34,197,94,.15)', db_72_89_dn_line: 'rgba(34,197,94,.40)',
  db_72_89_tight_up_fill: 'rgba(239,68,68,.10)', db_72_89_tight_up_line: 'rgba(239,68,68,.30)',
  db_72_89_tight_dn_fill: 'rgba(34,197,94,.10)', db_72_89_tight_dn_line: 'rgba(34,197,94,.30)',
  zone_fill: 'rgba(212,175,55,.12)', zone_line: 'rgba(212,175,55,.40)',
  pz_sup_fill: 'rgba(34,197,94,.08)', pz_sup_line: 'rgba(34,197,94,.35)', pz_sup_label: '#26a69a',
  pz_res_fill: 'rgba(239,68,68,.08)', pz_res_line: 'rgba(239,68,68,.35)', pz_res_label: '#ef5350',
}

/** Hex color → {r,g,b} */
export function hexRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) }
}

/** Font size constants */
export const F: Record<string, number> = {
  p: 11, // price axis
  t: 10, // time axis
  o: 12, // ohlcv tip
}

/** Light theme overrides */
export const LIGHT_THEME_OVERRIDES: Record<string, string> = {
  bg: '#e8e4d9', axisbg: '#ddd9cc', grid: '#d0cdc2',
  axisLabel: '#4a5580', axisMuted: '#6a7a9a', axisHighlight: '#3a4a6a',
  crossLabelBg: '#d8d4c8', crossLabelBd: '#b0a898',
  up: '#1a7a6f', dn: '#c0392b',
  vol_up: 'rgba(26,122,111,.45)', vol_dn: 'rgba(192,57,43,.45)',
  axisbg: '#ddd9cc',
}
