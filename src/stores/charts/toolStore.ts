import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { C } from '@/lib/charts/theme'

// ═══════════════════════════════════════════════════════════════
//  IND_CATALOG — defines all available tool types
// ═══════════════════════════════════════════════════════════════

export interface IndParamDef {
  key: string; label: string; def: number | string; min?: number; max?: number; step?: number; type?: 'number' | 'toggle' | 'select'
  options?: string[]   // for select type
  group?: string       // sub-group within params: 'zones' (core) | 'src' | 'detect' | 'display' → drives Parameters vs Settings pages
}
export interface IndColorDef {
  key: string; label: string; def: string
}
export interface IndCatalogEntry {
  label: string; group: string
  combo?: boolean          // true = custom multi-indicator combo/layout (Lingua, Trendline);
                          //       shows in TOOLS tab, NOT in the indicator Vault
  params?: IndParamDef[]
  colors?: IndColorDef[]
  legacyKeys?: string[]  // maps to indicatorStore keys
}

export const IND_CATALOG: Record<string, IndCatalogEntry> = {
  ema:            { label:'EMA',             group:'MA',          params:[{key:'period',label:'Period',def:20,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#3a70e0'}], legacyKeys:['ema20'] },
  ema9:           { label:'EMA 9',           group:'MA',          params:[{key:'period',label:'Period',def:9,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#e8d000'}], legacyKeys:['ema9'] },
  ema20:          { label:'EMA 20',          group:'MA',          params:[{key:'period',label:'Period',def:20,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#3a70e0'}], legacyKeys:['ema20'] },
  ema50:          { label:'EMA 50',          group:'MA',          params:[{key:'period',label:'Period',def:50,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#00c8e8'}], legacyKeys:['ema50'] },
  ema150:         { label:'EMA 150',         group:'MA',          params:[{key:'period',label:'Period',def:150,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#e0e0e0'}], legacyKeys:['ema150'] },
  ema200:         { label:'EMA 200',         group:'MA',          params:[{key:'period',label:'Period',def:200,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#e0e0e0'}], legacyKeys:['ema200'] },
  sma:            { label:'SMA',             group:'MA',          params:[{key:'period',label:'Period',def:20,min:1,max:500}], colors:[{key:'color',label:'Color',def:'#5a9ae6'}], legacyKeys:['sma'] },
  band_9_20:      { label:'EMA Band 9/20',   group:'EMA Bands',   colors:[{key:'bull_fill',label:'Bull Fill',def:'rgba(34,197,94,.15)'},{key:'bull_line',label:'Bull Line',def:'rgba(34,197,94,.50)'},{key:'bear_fill',label:'Bear Fill',def:'rgba(239,68,68,.15)'},{key:'bear_line',label:'Bear Line',def:'rgba(239,68,68,.50)'}], legacyKeys:['band_9_20'] },
  band_72_89:     { label:'EMA Band 72/89',  group:'EMA Bands',   colors:[{key:'bull_fill',label:'Bull Fill',def:'rgba(34,197,94,.15)'},{key:'bull_line',label:'Bull Line',def:'rgba(34,197,94,.50)'},{key:'bear_fill',label:'Bear Fill',def:'rgba(239,68,68,.15)'},{key:'bear_line',label:'Bear Line',def:'rgba(239,68,68,.50)'}], legacyKeys:['band_72_89'] },
  dev_s_9_20:     { label:'Dev Band S 9/20', group:'Dev Bands',   params:[{key:'fast',label:'Fast',def:9,min:1,max:200},{key:'slow',label:'Slow',def:20,min:1,max:200},{key:'upLow',label:'Up Low',def:0.5,step:0.1},{key:'upHigh',label:'Up High',def:1,step:0.1},{key:'dnLow',label:'Dn Low',def:2,step:0.1},{key:'dnHigh',label:'Dn High',def:2.4,step:0.1}], colors:[{key:'up_fill',label:'Upper Fill',def:'rgba(239,68,68,.15)'},{key:'up_line',label:'Upper Line',def:'rgba(239,68,68,.40)'},{key:'dn_fill',label:'Lower Fill',def:'rgba(34,197,94,.15)'},{key:'dn_line',label:'Lower Line',def:'rgba(34,197,94,.40)'}], legacyKeys:['dev_s_9_20'] },
  dev_l_9_20:     { label:'Dev Band L 9/20', group:'Dev Bands',   params:[{key:'fast',label:'Fast',def:9,min:1,max:200},{key:'slow',label:'Slow',def:20,min:1,max:200},{key:'upLow',label:'Up Low',def:2,step:0.1},{key:'upHigh',label:'Up High',def:2.4,step:0.1},{key:'dnLow',label:'Dn Low',def:0.5,step:0.1},{key:'dnHigh',label:'Dn High',def:1,step:0.1}], colors:[{key:'up_fill',label:'Upper Fill',def:'rgba(239,68,68,.15)'},{key:'up_line',label:'Upper Line',def:'rgba(239,68,68,.40)'},{key:'dn_fill',label:'Lower Fill',def:'rgba(34,197,94,.15)'},{key:'dn_line',label:'Lower Line',def:'rgba(34,197,94,.40)'}], legacyKeys:['dev_l_9_20'] },
  db_72_89:       { label:'Dev Band 72/89',  group:'Dev Bands',   params:[{key:'fast',label:'Fast',def:72,min:1,max:500},{key:'slow',label:'Slow',def:89,min:1,max:500},{key:'upLow',label:'Up Low',def:6.9,step:0.1},{key:'upHigh',label:'Up High',def:9.6,step:0.1},{key:'dnLow',label:'Dn Low',def:6.9,step:0.1},{key:'dnHigh',label:'Dn High',def:9.6,step:0.1}], colors:[{key:'up_fill',label:'Upper Fill',def:'rgba(239,68,68,.15)'},{key:'up_line',label:'Upper Line',def:'rgba(239,68,68,.40)'},{key:'dn_fill',label:'Lower Fill',def:'rgba(34,197,94,.15)'},{key:'dn_line',label:'Lower Line',def:'rgba(34,197,94,.40)'}], legacyKeys:['db_72_89'] },
  db_72_89_tight: { label:'Dev Band 72/89 Tight', group:'Dev Bands', params:[{key:'fast',label:'Fast',def:72,min:1,max:500},{key:'slow',label:'Slow',def:89,min:1,max:500},{key:'upLow',label:'Up Low',def:3,step:0.1},{key:'upHigh',label:'Up High',def:3.3,step:0.1},{key:'dnLow',label:'Dn Low',def:3.6,step:0.1},{key:'dnHigh',label:'Dn High',def:3.9,step:0.1}], colors:[{key:'up_fill',label:'Upper Fill',def:'rgba(239,68,68,.10)'},{key:'up_line',label:'Upper Line',def:'rgba(239,68,68,.30)'},{key:'dn_fill',label:'Lower Fill',def:'rgba(34,197,94,.10)'},{key:'dn_line',label:'Lower Line',def:'rgba(34,197,94,.30)'}], legacyKeys:['db_72_89_tight'] },
  adp_bands:      { label:'Adaptive Dev Band', group:'Dev Bands', params:[{key:'xtreme',label:'Partial Band',def:6,step:0.1},{key:'euThr',label:'Extreme Band',def:6.9,step:0.1},{key:'emaFast',label:'Chase EMA',def:20,min:1,max:100},{key:'wMin',label:'Min Influence',def:0.10,step:0.05,min:0,max:1},{key:'wMax',label:'Max Influence',def:0.40,step:0.05,min:0,max:1},{key:'showCenter',label:'Show Center Line',def:1,type:'toggle'}], colors:[{key:'up_fill',label:'Upper Fill',def:'rgba(239,68,68,.15)'},{key:'up_line',label:'Upper Line',def:'rgba(239,68,68,.40)'},{key:'dn_fill',label:'Lower Fill',def:'rgba(34,197,94,.15)'},{key:'dn_line',label:'Lower Line',def:'rgba(34,197,94,.40)'},{key:'center',label:'Center Line',def:'rgba(212,175,55,.55)'}], legacyKeys:['adp_bands'] },
  lingua_exec:    { label:'Lingua Exec', group:'Exec', combo:true, params:[{key:'fast',label:'Fast EMA',def:50,min:1,max:500},{key:'slow',label:'Slow EMA',def:89,min:1,max:500},{key:'showWedge',label:'Show Switch Wedge',def:1,type:'toggle'},{key:'wedgeSize',label:'Wedge Size',def:9,min:3,max:24,step:1},{key:'showRegime',label:'Show Regime Shade',def:1,type:'toggle'},{key:'regimeHold',label:'Regime Hold Bars',def:2,min:1,max:10,step:1},{key:'showPullback',label:'Show Pullback Marks',def:1,type:'toggle'},{key:'pbSize',label:'Pullback Mark Size',def:5,min:3,max:16,step:1},{key:'showEntry',label:'Show Entry Arrows',def:1,type:'toggle'},{key:'entrySize',label:'Entry Arrow Size',def:7,min:4,max:20,step:1},{key:'swingLb',label:'Swing Stop Lookback',def:5,min:1,max:30,step:1},{key:'tightMultUp',label:'Tight Band Up Mult',def:3.0,step:0.1,min:0.5,max:10},{key:'tightMultDn',label:'Add Stop Mult',def:3.6,step:0.1,min:0.5,max:10},{key:'entryMultDn',label:'Entry1 Stop Mult',def:3.9,step:0.1,min:0.5,max:10},{key:'addFreedMin',label:'Add Freed Min (%)',def:0.2,step:0.05,min:0,max:1},{key:'stopProj',label:'Stop Line Projection',def:6,min:0,max:40,step:1},{key:'showRiskBox',label:'Show Risk Zone',def:1,type:'toggle'},{key:'showExit',label:'Show Exits',def:1,type:'toggle'},{key:'exitSize',label:'Exit Mark Size',def:8,min:4,max:20,step:1},{key:'showStop',label:'Show Stop-Outs',def:1,type:'toggle'},{key:'showPitch',label:'Show Pitch Cloud',def:1,type:'toggle'},{key:'pitchEma',label:'Pitch EMA',def:63,min:5,max:300},{key:'pitchBand',label:'Pitch Band (ATR)',def:1,step:0.1,min:0,max:5},{key:'pitchTf',label:'Pitch TF',def:'Active',type:'select',options:['Active','1H','4H','D','W']}], colors:[{key:'bull_fill',label:'Bull Fill',def:'rgba(34,197,94,.15)'},{key:'bull_line',label:'Bull Line',def:'rgba(34,197,94,.55)'},{key:'bear_fill',label:'Bear Fill',def:'rgba(239,68,68,.15)'},{key:'bear_line',label:'Bear Line',def:'rgba(239,68,68,.55)'},{key:'wedge_up',label:'Wedge Up',def:'rgba(34,197,94,1)'},{key:'wedge_down',label:'Wedge Down',def:'rgba(239,68,68,1)'},{key:'regime_up',label:'Regime Up',def:'rgba(34,197,94,.05)'},{key:'regime_down',label:'Regime Down',def:'rgba(239,68,68,.05)'},{key:'regime_extreme',label:'Regime Extreme',def:'rgba(230,140,0,.10)'},{key:'regime_reset',label:'Regime Reset',def:'rgba(250,204,21,.08)'},{key:'pb_long',label:'Pullback Long',def:'rgba(34,197,94,.95)'},{key:'pb_short',label:'Pullback Short',def:'rgba(239,68,68,.95)'},{key:'entry_long',label:'Entry Long',def:'rgba(34,197,94,1)'},{key:'entry_short',label:'Entry Short',def:'rgba(239,68,68,1)'},{key:'stop_line',label:'Stop Line',def:'rgba(239,68,68,.95)'},{key:'risk_long',label:'Risk Zone Long',def:'rgba(34,197,94,.07)'},{key:'risk_short',label:'Risk Zone Short',def:'rgba(239,68,68,.07)'},{key:'exit_long',label:'Exit Long',def:'rgba(239,68,68,1)'},{key:'exit_short',label:'Exit Short',def:'rgba(239,68,68,1)'},{key:'pitch_up',label:'Pitch Up',def:'rgba(34,197,94,1)'},{key:'pitch_dn',label:'Pitch Down',def:'rgba(239,68,68,1)'}], legacyKeys:['lingua_exec'] },
  db_upper:       { label:'Dev Upper',       group:'Dev Bands',   params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(200,120,20,.20)'},{key:'line',label:'Line',def:'rgba(220,140,30,.90)'}], legacyKeys:['db_upper'] },
  db_low1:        { label:'Dev Low 1',       group:'Dev Bands',   params:[{key:'ema',label:'EMA Period',def:9,min:1,max:200},{key:'atr',label:'ATR Period',def:9,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(200,184,0,.20)'},{key:'line',label:'Line',def:'rgba(220,200,10,.90)'}], legacyKeys:['db_low1'] },
  db_low2:        { label:'Dev Low 2',       group:'Dev Bands',   params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(20,120,200,.20)'},{key:'line',label:'Line',def:'rgba(30,150,220,.90)'}], legacyKeys:['db_low2'] },
  vwap:           { label:'VWAP',            group:'Overlays',    colors:[{key:'color',label:'Color',def:'#00e676'}], legacyKeys:['vwap'] },
  bollinger:      { label:'Bollinger Bands', group:'Overlays',    params:[{key:'period',label:'Period',def:20,min:1,max:500},{key:'stddev',label:'Std Dev',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(100,149,237,.08)'},{key:'upper',label:'Upper',def:'rgba(100,149,237,.40)'},{key:'lower',label:'Lower',def:'rgba(100,149,237,.40)'}], legacyKeys:['bollinger'] },
  trail_stop:     { label:'Trail Stop',       group:'Dev Bands',   params:[{key:'fast',label:'Fast EMA',def:9,min:1,max:200},{key:'slow',label:'Slow EMA',def:20,min:1,max:200},{key:'band_mult',label:'Band Multiplier',def:3.0,step:0.1},{key:'lookback',label:'Swing Lookback',def:5,min:2,max:20}], colors:[{key:'color',label:'Color',def:'#4ade80'}], legacyKeys:['trail_stop'] },
  sma_vol:        { label:'Volume SMA',      group:'Volume',      params:[{key:'period',label:'Period',def:20,min:1,max:200}], colors:[{key:'color',label:'Color',def:'#D4AF37'}], legacyKeys:['sma_vol'] },
  pzones:         { label:'Key Levels',      group:'Overlays',
    params:[
      // ── Parameters (core Zones) — Mike's TV config ──
      {key:'left',label:'Look Left',def:48,min:2,max:200,group:'zones'},
      {key:'right',label:'Look Right',def:24,min:1,max:100,group:'zones'},
      {key:'nPiv',label:'Number of Pivots',def:1,min:1,max:50,group:'zones'},
      {key:'atrLen',label:'ATR Length',def:66,min:5,max:200,group:'zones'},
      {key:'mult',label:'Zone Width (ATR)',def:0.6,step:0.1,group:'zones'},
      {key:'per',label:'Max Zone Percent',def:1,step:0.5,group:'zones'},
      // ── Settings: Source & Display ──
      {key:'src',label:'Source For Pivots',def:'HA',type:'select',options:['HA','High/Low Body','High/Low'],group:'src'},
      {key:'alignZones',label:'Align Zones',def:1,min:0,max:1,type:'toggle',group:'src'},
      {key:'extend',label:'Extend Right',def:0,min:0,max:1,type:'toggle',group:'src'},
      {key:'showLabels',label:'Show Level Labels',def:1,min:0,max:1,type:'toggle',group:'src'},
      {key:'fut',label:'Offset For Labels',def:30,min:0,max:200,group:'src'},
      {key:'max',label:'Max Boxes (Patterns)',def:10,min:1,max:50,group:'src'},
      // ── Settings: Detection ──
      {key:'detectHighs',label:'Detect Pivot Highs',def:1,min:0,max:1,type:'toggle',group:'detect'},
      {key:'detectLows',label:'Detect Pivot Lows',def:1,min:0,max:1,type:'toggle',group:'detect'},
      {key:'repaint',label:'Wait For Confirmed Bar',def:1,min:0,max:1,type:'toggle',group:'detect'},
      // ── Settings: Candle Pattern Filters ──
      {key:'hammerFib',label:'H&S Ratio (%)',def:33,step:1,group:'patterns'},
      {key:'hammerSize',label:'H&S Min Size (× ATR)',def:0.1,step:0.1,group:'patterns'},
      {key:'dojiSize',label:'Doji Size (%)',def:5,step:1,group:'patterns'},
      {key:'dojiWickSize',label:'Max Doji Wick Size',def:2,step:1,group:'patterns'},
      {key:'luRatio',label:'Long Shadow (%)',def:75,step:1,group:'patterns'},
      // ── Settings: Lookback (Breakout Detection) ──
      {key:'lookback',label:'Lookback For Breaks',def:2,min:1,max:50,group:'lookback'},
      {key:'swing',label:'Swing High/Low',def:5,min:1,max:100,group:'lookback'},
      {key:'reflect',label:'Significant High/Low',def:10,min:1,max:200,group:'lookback'},
      {key:'offset',label:'Consider Bar From High/Low',def:1,min:0,max:50,group:'lookback'},
      // ── Settings: TSI (Momentum Curl) ──
      {key:'strat',label:'TSI Speed',def:'Fast',type:'select',options:['Fast','Slow'],group:'tsi'},
      {key:'longf',label:'Fast Long Length',def:25,min:1,max:200,group:'tsi'},
      {key:'shortf',label:'Fast Short Length',def:5,min:1,max:200,group:'tsi'},
      {key:'signalf',label:'Fast Signal Length',def:14,min:1,max:200,group:'tsi'},
      {key:'longs',label:'Slow Long Length',def:25,min:1,max:200,group:'tsi'},
      {key:'shorts',label:'Slow Short Length',def:13,min:1,max:200,group:'tsi'},
      {key:'signals',label:'Slow Signal Length',def:13,min:1,max:200,group:'tsi'},
    ],
    colors:[{key:'pz_sup_fill',label:'Sup Fill',def:'rgba(100,181,246,0.06)'},{key:'pz_sup_line',label:'Sup Line',def:'rgba(100,181,246,0.40)'},{key:'pz_sup_label',label:'Sup Label',def:'rgba(100,181,246,0.85)'},{key:'pz_res_fill',label:'Res Fill',def:'rgba(255,235,59,0.06)'},{key:'pz_res_line',label:'Res Line',def:'rgba(255,235,59,0.40)'},{key:'pz_res_label',label:'Res Label',def:'rgba(255,235,59,0.85)'}], legacyKeys:['pzones'] },
  devzones:       { label:'Dev Zones',       group:'Overlays',
    params:[
      {key:'partThr',label:'Low Band (partial)',def:6.9,step:0.1,min:0,max:20,group:'dev'},
      {key:'fullThr',label:'High Band (extreme)',def:9.6,step:0.1,min:0,max:20,group:'dev'},
    ],
    colors:[
      {key:'part_fill',label:'Partial Fill (red)',def:'rgba(183,28,28,0.45)'},
      {key:'full_fill',label:'Extreme Fill (orange)',def:'rgba(230,81,0,0.55)'},
    ], legacyKeys:['devzones'] },
  lingua:         { label:'Lingua Cycle',     group:'Overlays', combo:true,
    params:[
      {key:'slopeN',label:'Slope Lookback (bars)',def:10,min:2,max:50,group:'aop'},
      {key:'smooth',label:'AoP Smoothing',def:5,min:1,max:30,group:'aop'},
      {key:'flat',label:'Flat Threshold (1H)',def:0.05,step:0.01,group:'aop'},
      {key:'flatH',label:'Flat Threshold (4H)',def:0.03,step:0.01,group:'aop'},
      {key:'holdBars',label:'Stage Hold Bars',def:3,min:1,max:20,group:'aop'},
      {key:'emaMid',label:'Mean EMA Mid',def:59,min:1,max:500,group:'ema'},
      {key:'emaSlow',label:'Mean EMA Slow',def:69,min:1,max:500,group:'ema'},
      {key:'cloudFast',label:'Cycle Cloud Fast',def:200,min:2,max:500,group:'ema'},
      {key:'cloudSlow',label:'Cycle Cloud Slow',def:236,min:3,max:600,group:'ema'},
      {key:'trendEma',label:'Trend Pitch EMA',def:39,min:1,max:500,group:'ema'},
      {key:'mtfTf',label:'Working Timeframe',def:'60',type:'select',options:['5','15','30','60','120','240'],group:'ema'},
      {key:'xtreme',label:'Partial Band (low)',def:6.3,step:0.1,group:'dev'},
      {key:'euThr',label:'Extreme Band (high)',def:7.2,step:0.1,group:'dev'},
      {key:'tbOn',label:'Trendbreak Stage',def:1,type:'toggle',group:'trendbreak'},
      {key:'tbConfirm',label:'TB Confirm Bars',def:1,min:1,max:5,group:'trendbreak'},
      {key:'tbMargin',label:'TB Margin (xATR)',def:0,min:0,max:1,step:0.05,group:'trendbreak'},
      {key:'tbReclaim',label:'TB Reclaim Bars',def:1,min:1,max:5,group:'trendbreak'},
      {key:'cycleErOn',label:'Cleanliness Split',def:1,type:'toggle',group:'aop'},
      {key:'cycleChop',label:'Chop Threshold',def:0.30,step:0.05,min:0,max:1,group:'aop'},
  {key:'cyclePitchOn',label:'Structural Pitch',def:1,type:'toggle',group:'aop'},
  {key:'cyclePitchWin',label:'Pitch Window',def:20,step:1,min:5,max:60,group:'aop'},
  {key:'cyclePitchBlend',label:'Pitch Blend',def:0.6,step:0.05,min:0,max:1,group:'aop'},
  {key:'cyclePitchSmooth',label:'Pitch Smooth',def:5,step:1,min:1,max:20,group:'aop'},
  {key:'cycleStructOn',label:'Struct Break Gate',def:1,type:'toggle',group:'aop'},
  {key:'structHtfExt',label:'HTF Extended (×xtreme)',def:0.7,step:0.05,min:0,max:1,group:'aop'},
  {key:'structSuppress',label:'Counter-Trend Suppress',def:1,type:'toggle',group:'aop'},
      {key:'tbLtfOn',label:'15m Lead Markers',def:1,type:'toggle',group:'trendbreak'},
      {key:'swOn',label:'Swing Trendline',def:1,type:'toggle',group:'swing'},
      {key:'swPattern',label:'Swing Pattern',def:5,min:2,max:13,group:'swing'},
      {key:'swLeft',label:'Look Left',def:69,min:1,max:120,group:'swing'},
      {key:'swRight',label:'Look Right',def:21,min:1,max:60,group:'swing'},
      {key:'swConfirm',label:'Confirmation Candle',def:2,min:1,max:5,group:'swing'},
      {key:'swMinSwing',label:'Min Size (×ATR)',def:1.2,step:0.1,min:0,max:5,group:'swing'},
      {key:'swTouches',label:'Trend Touch #',def:3,min:2,max:12,group:'swing'},
      {key:'swTouchTol',label:'Touch Tol (×ATR)',def:0.1,step:0.05,min:0,max:3,group:'swing'},
      {key:'swSpineLen',label:'EMA Spine Length',def:50,min:5,max:200,group:'swing'},
      {key:'swCloudFast',label:'EMA Cloud Fast',def:50,min:3,max:200,group:'swing'},
      {key:'swCloudSlow',label:'EMA Cloud Slow',def:69,min:5,max:300,group:'swing'},
      {key:'swShowWindow',label:'Show Pivot Window',def:0,type:'toggle',group:'swing'},
      {key:'swShowPivots',label:'Show Pivot Dots',def:0,type:'toggle',group:'swing'},
      {key:'swShowBreaks',label:'Show Breaks',def:1,type:'toggle',group:'swing'},
      {key:'swShowBothSides',label:'Show Both Sides',def:0,type:'toggle',group:'swing'},
      {key:'swBreakConfirm',label:'EMA Cross Confirm',def:0,type:'toggle',group:'swing'},
      {key:'swEmaFast',label:'Break EMA Fast',def:39,min:2,max:50,group:'swing'},
      {key:'swEmaSlow',label:'Break EMA Slow',def:50,min:3,max:100,group:'swing'},
      {key:'tlLeft',label:'Light TL — Look Left',def:50,min:1,max:200,group:'trendline'},
      {key:'tlRight',label:'Light TL — Look Right',def:15,min:1,max:120,group:'trendline'},
      {key:'tlPattern',label:'Light TL — Pattern',def:2,min:1,max:13,group:'trendline'},
      {key:'tlMinSize',label:'Light TL — Min Size (×ATR)',def:0,step:0.1,min:0,max:5,group:'trendline'},
      {key:'tlMainLeft',label:'Main TL — Look Left',def:69,min:1,max:200,group:'trendline'},
      {key:'tlMainRight',label:'Main TL — Look Right',def:15,min:5,max:120,group:'trendline'},
      {key:'tlMainPattern',label:'Main TL — Pattern',def:3,min:1,max:13,group:'trendline'},
      {key:'swHideCons',label:'Hide Consolidation',def:0,type:'toggle',group:'display'},
      {key:'showClouds',label:'Show EMA Clouds',def:1,type:'toggle',group:'display'},
      {key:'cycleCloudOn',label:'Cycle Cloud (200/236)',def:1,type:'toggle',group:'display'},
      {key:'showBands',label:'Show Dev Bands',def:1,type:'toggle',group:'display'},
      {key:'lgKeyLevels',label:'Show Key Levels',def:1,type:'toggle',group:'overlay'},
      {key:'lgTrendMain',label:'Show Trendline (Main)',def:1,type:'toggle',group:'overlay'},
      {key:'lgTrendLight',label:'Show Trendline (Light)',def:1,type:'toggle',group:'overlay'},
    ],
    colors:[
      {key:'con_tint',label:'Consol Fill',def:'rgba(120,140,170,0.05)'},{key:'con_line',label:'Consol Line',def:'rgba(150,160,180,0.5)'},{key:'con_text',label:'Consol Text',def:'rgba(180,190,210,0.85)'},
      {key:'up_tint',label:'Uptrend Fill',def:'rgba(76,175,80,0.06)'},{key:'up_line',label:'Uptrend Line',def:'rgba(76,175,80,0.6)'},{key:'up_text',label:'Uptrend Text',def:'rgba(129,199,132,0.95)'},
      {key:'dn_tint',label:'Backside Fill',def:'rgba(239,83,80,0.06)'},{key:'dn_line',label:'Backside Line',def:'rgba(239,83,80,0.6)'},{key:'dn_text',label:'Backside Text',def:'rgba(239,154,154,0.95)'},
      {key:'cont_tint',label:'ExtCont Fill',def:'rgba(255,193,7,0.08)'},{key:'cont_line',label:'ExtCont Line',def:'rgba(255,193,7,0.55)'},{key:'cont_text',label:'ExtCont Text',def:'rgba(255,213,79,0.9)'},
      {key:'ex_tint',label:'Euphoric Fill',def:'rgba(255,87,34,0.13)'},{key:'ex_line',label:'Euphoric Line',def:'rgba(255,87,34,0.8)'},{key:'ex_text',label:'Euphoric Text',def:'rgba(255,138,101,0.97)'},
      {key:'up_fill',label:'Dev Upper Fill',def:'rgba(239,68,68,.15)'},{key:'up_line',label:'Dev Upper Line',def:'rgba(239,68,68,.40)'},{key:'dn_fill',label:'Dev Lower Fill',def:'rgba(34,197,94,.15)'},{key:'dn_line',label:'Dev Lower Line',def:'rgba(34,197,94,.40)'},
      {key:'sw_line',label:'Swing Trendline',def:'rgba(0,229,255,0.85)'},{key:'sw_tent',label:'Swing Tentative',def:'rgba(0,229,255,0.35)'},{key:'sw_pivot',label:'Swing Pivot Dot',def:'rgba(0,229,255,1)'},{key:'sw_break',label:'Swing Break',def:'rgba(255,0,110,0.95)'},
    ], legacyKeys:['lingua'] },
  curltrend:      { label:'Curl Trendline', group:'Trendlines', combo:true,
    params:[
      {key:'ctLeft',label:'Look Left',def:34,min:2,max:200,group:'pivot'},
      {key:'ctRight',label:'Look Right',def:10,min:1,max:120,group:'pivot'},
      {key:'ctPattern',label:'Pattern',def:5,min:1,max:13,group:'pivot'},
      {key:'ctPivots',label:'Pivots in Window',def:3,min:2,max:6,group:'curl'},
      {key:'ctShowBreak',label:'Show Break Marker',def:1,type:'toggle',group:'display'},
    ],
    colors:[
      {key:'ct_sup',label:'Support (rising)',def:'rgba(86,156,214,0.95)'},
      {key:'ct_res',label:'Resistance (falling)',def:'rgba(230,150,40,0.95)'},
      {key:'ct_break',label:'Break Marker',def:'rgba(250,204,21,0.95)'},
    ], legacyKeys:['curltrend'] },
  trendline:      { label:'Trendline (Anchored)', group:'Trendlines', combo:true,
    params:[
      {key:'tlLeft',label:'Look Left',def:50,min:1,max:120,group:'detect'},
      {key:'tlRight',label:'Look Right',def:15,min:1,max:60,group:'detect'},
      {key:'tlPattern',label:'Pattern Window',def:2,min:1,max:13,group:'detect'},
      {key:'tlMinSize',label:'Min Size (×ATR)',def:0,step:0.1,min:0,max:5,group:'detect'},
      {key:'tlMainLeft',label:'Main Look Left',def:69,min:1,max:200,group:'main'},
      {key:'tlMainRight',label:'Main Look Right',def:15,min:5,max:120,group:'main'},
      {key:'tlMainPattern',label:'Main Pattern',def:3,min:1,max:13,group:'main'},
      {key:'tlShowCloud',label:'Show EMA Cloud',def:0,type:'toggle',group:'cloud'},
      {key:'tlCloudFast',label:'Cloud Fast',def:20,min:2,max:200,group:'cloud'},
      {key:'tlCloudSlow',label:'Cloud Slow',def:39,min:3,max:300,group:'cloud'},
      {key:'tlBothSides',label:'Show Both Sides',def:0,type:'toggle',group:'display'},
      {key:'tlShowMain',label:'Show Main Lines',def:1,type:'toggle',group:'display'},
      {key:'tlShowBreaks',label:'Show Breaks',def:0,type:'toggle',group:'display'},
      {key:'tlBreakSize',label:'Break Wedge Size',def:7,min:3,max:16,group:'display'},
    ],
    colors:[
      {key:'tl_support',label:'Support (green)',def:'rgba(0,230,118,0.95)'},{key:'tl_resist',label:'Resistance (red)',def:'rgba(255,68,68,0.95)'},{key:'tl_main',label:'Main Glow',def:'rgba(212,175,55,0.28)'},
    ], legacyKeys:['trendline'] },
  trendline_light: { label:'Trendline (Light)', group:'Trendlines', combo:true,
    params:[
      {key:'tlLeft',label:'Look Left',def:28,min:1,max:120,group:'detect'},
      {key:'tlRight',label:'Look Right',def:7,min:1,max:60,group:'detect'},
      {key:'tlPattern',label:'Pattern Window',def:1,min:1,max:13,group:'detect'},
      {key:'tlMinSize',label:'Min Size (×ATR)',def:0.3,step:0.1,min:0,max:5,group:'detect'},
      {key:'tlMainLeft',label:'Main Look Left',def:28,min:1,max:200,group:'main'},
      {key:'tlMainRight',label:'Main Look Right',def:7,min:5,max:120,group:'main'},
      {key:'tlMainPattern',label:'Main Pattern',def:2,min:1,max:13,group:'main'},
      {key:'tlShowCloud',label:'Show EMA Cloud',def:0,type:'toggle',group:'cloud'},
      {key:'tlCloudFast',label:'Cloud Fast',def:20,min:2,max:200,group:'cloud'},
      {key:'tlCloudSlow',label:'Cloud Slow',def:39,min:3,max:300,group:'cloud'},
      {key:'tlBothSides',label:'Show Both Sides',def:0,type:'toggle',group:'display'},
      {key:'tlShowMain',label:'Show Main Lines',def:1,type:'toggle',group:'display'},
      {key:'tlShowBreaks',label:'Show Breaks',def:0,type:'toggle',group:'display'},
      {key:'tlBreakSize',label:'Break Wedge Size',def:7,min:3,max:16,group:'display'},
    ],
    colors:[
      {key:'tl_support',label:'Support (blue)',def:'rgba(86,156,214,0.95)'},{key:'tl_resist',label:'Resistance (orange)',def:'rgba(230,150,40,0.95)'},{key:'tl_main',label:'Main Glow',def:'rgba(130,160,200,0.28)'},
    ], legacyKeys:['trendline_light'] },
  consolidation:  { label:'Consolidation Zones', group:'Overlays', combo:true,
    params:[
      {key:'coPivLeft',label:'Pivot Look Left',def:8,min:3,max:40,group:'detect'},
      {key:'coPivRight',label:'Pivot Look Right',def:8,min:3,max:40,group:'detect'},
      {key:'coBand',label:'Max Range (×ATR)',def:8,step:1,min:2,max:30,group:'detect'},
      {key:'coMinBars',label:'Min Duration (bars)',def:30,min:5,max:200,group:'detect'},
      {key:'coMinSwings',label:'Min Swings',def:4,min:3,max:20,group:'detect'},
      {key:'coUseHtf',label:'Use HTF (Bigger Picture)',def:1,type:'toggle',group:'htf'},
      {key:'coHtfGroup',label:'HTF Grouping (bars)',def:5,min:2,max:20,group:'htf'},
      {key:'coShowBreak',label:'Color on Breakout',def:1,type:'toggle',group:'display'},
      {key:'coMaxHeight',label:'Max Height (×ATR)',def:0,step:0.5,min:0,max:50,group:'detect'},
      {key:'coMaxHeightPct',label:'Max Height (%)',def:0,step:0.5,min:0,max:50,group:'detect'},
      {key:'coAtrLen',label:'ATR Period',def:14,min:2,max:200,group:'detect'},
      {key:'coTouches',label:'Min Touches/Side',def:2,min:0,max:10,group:'detect'},
      {key:'coTouchBand',label:'Touch Band (%)',def:12,step:1,min:1,max:50,group:'detect'},
      {key:'coLegFast',label:'Leg EMA Fast',def:7,min:2,max:50,group:'detect'},
      {key:'coLegSlow',label:'Leg EMA Slow',def:14,min:3,max:100,group:'detect'},
      {key:'coMaxDrift',label:'Max Drift (%)',def:75,step:1,min:0,max:150,group:'detect'},
      {key:'coDirDrift',label:'Dir Drift (%)',def:40,step:1,min:0,max:100,group:'detect'},
      {key:'coShowVals',label:'Show Values',def:1,type:'toggle',group:'display'},
      {key:'coShowTouches',label:'Show Touches',def:1,type:'toggle',group:'display'},
      {key:'coShowChannel',label:'Show Channel',def:0,type:'toggle',group:'display'},
      {key:'coColorType',label:'Color by Type',def:1,type:'toggle',group:'display'},
    ],
    colors:[
      {key:'co_neutral',label:'Neutral Fill',def:'rgba(180,185,205,0.16)'},{key:'co_neutral_line',label:'Neutral Border',def:'rgba(180,185,205,0.7)'},{key:'co_up',label:'Break Up',def:'rgba(34,197,94,0.22)'},{key:'co_dn',label:'Break Down',def:'rgba(239,68,68,0.22)'},
    ], legacyKeys:['consolidation'] },
  regime:  { label:'Regime', group:'Overlays', combo:true,
    params:[
      {key:'rgLen',label:'ER Lookback',def:20,min:5,max:100,group:'detect'},
      {key:'rgSmooth',label:'ER Smoothing',def:10,min:1,max:50,group:'detect'},
      {key:'rgChop',label:'Chop Threshold',def:0.30,step:0.05,min:0,max:1,group:'detect'},
      {key:'rgCloudF',label:'Cloud EMA Fast',def:16,min:2,max:100,group:'detect'},
      {key:'rgCloudS',label:'Cloud EMA Slow',def:33,min:3,max:200,group:'detect'},
      {key:'rgRangeOnly',label:'Highlight Range Only',def:1,type:'toggle',group:'display'},
      {key:'rgShowLabel',label:'Show Regime Label',def:1,type:'toggle',group:'display'},
      {key:'rgShowDiv',label:'Show Dividers',def:1,type:'toggle',group:'display'},
    ],
    colors:[
      {key:'rg_up',label:'Up Tint',def:'rgba(34,197,94,0.09)'},{key:'rg_dn',label:'Down Tint',def:'rgba(239,68,68,0.09)'},{key:'rg_range',label:'Range Tint',def:'rgba(160,165,180,0.18)'},
    ], legacyKeys:['regime'] },
}

// Keys excluded from hot buttons
const HOT_EXCLUDE = new Set(['tl','ann','otherann','exec','btexec','adjusted','adj'])

// ═══════════════════════════════════════════════════════════════
//  TOOL INSTANCE
// ═══════════════════════════════════════════════════════════════

export interface ToolInstance {
  id: string
  indKey: string
  name: string
  on: boolean
  params: Record<string, number>
  colors: Record<string, string>
  hot: boolean
  hotLabel: string
  hotColor: string
  legacyKeys: string[]
}

let _toolId = Date.now()
function newToolId() { return 't' + (++_toolId) }

// ═══════════════════════════════════════════════════════════════
//  DEFAULT TOOLS (Mike preset)
// ═══════════════════════════════════════════════════════════════

function makeDefaultTools(): ToolInstance[] {
  const mk = (indKey: string, on: boolean, hot = false): ToolInstance => {
    const cat = IND_CATALOG[indKey]
    const params: Record<string, number> = {}
    cat?.params?.forEach(p => { params[p.key] = p.def })
    const colors: Record<string, string> = {}
    cat?.colors?.forEach(c => { colors[c.key] = c.def })
    return {
      id: newToolId(), indKey, name: cat?.label || indKey, on,
      params, colors, hot,
      hotLabel: cat?.label?.toUpperCase().slice(0, 10) || indKey.toUpperCase(),
      hotColor: '#D4AF37',
      legacyKeys: cat?.legacyKeys || [indKey],
    }
  }
  return [
    mk('vwap', true, true),
    mk('band_9_20', true, true),
    mk('band_72_89', true, true),
    mk('dev_s_9_20', true, true),
    mk('trail_stop', true, true),
    mk('db_72_89', true, true),
    mk('db_72_89_tight', true, true),
    mk('sma_vol', true, false),
    mk('pzones', true, false),
    mk('devzones', false, false),
    mk('lingua', false, false),
    mk('lingua_exec', false, false),
    mk('curltrend', false, false),
  ]
}

// Derive inds map from tools (for ReactChartPanel compatibility)
function deriveInds(tools: ToolInstance[]): Record<string, boolean> {
  const inds: Record<string, boolean> = { vol: true }
  tools.forEach(t => {
    if (t.on && t.legacyKeys) t.legacyKeys.forEach(k => { inds[k] = true })
  })
  return inds
}

// ═══════════════════════════════════════════════════════════════
//  TOOL STORE
// ═══════════════════════════════════════════════════════════════

export interface ToolState {
  tools: ToolInstance[]
  inds: Record<string, boolean>
  selectedToolId: string | null
  showAddPopup: boolean

  // Actions
  toggleTool: (id: string) => void
  addTool: (indKey: string) => ToolInstance
  deleteTool: (id: string) => void
  duplicateTool: (id: string) => void
  setToolParam: (id: string, key: string, value: number | string) => void
  setToolColor: (id: string, key: string, value: string) => void
  setToolName: (id: string, name: string) => void
  setToolHot: (id: string, hot: boolean) => void
  setToolHotLabel: (id: string, label: string) => void
  setToolHotColor: (id: string, color: string) => void
  selectTool: (id: string | null) => void
  setTools: (tools: ToolInstance[]) => void
  toggleShowAddPopup: () => void
  closeAddPopup: () => void
  resetTools: () => void

  // Per-panel param overrides — lets each chart carry independent indicator params
  // (e.g. Lingua on 1H tuned differently from 4H) while sharing the tool list/on-off/colors.
  panelParams: Record<number, Record<string, Record<string, number | string>>>
  setPanelParam: (panelIdx: number, indKey: string, key: string, value: number | string) => void

  // Read
  getActiveTools: () => ToolInstance[]
  getInactiveTools: () => ToolInstance[]
  getHotTools: () => ToolInstance[]
}

/** Merge a tool's global params with the per-panel override for panelIdx.
 *  Used by render-lingua (non-reactive) to read the correct params per chart. */
export function getMergedToolParams(panelIdx: number, indKey: string): Record<string, number | string> {
  const s = useToolStore.getState()
  const globalP = (s.tools.find(t => t.indKey === indKey)?.params as Record<string, number | string>) || {}
  const override = s.panelParams[panelIdx]?.[indKey]
  return override ? { ...globalP, ...override } : { ...globalP }
}

export const useToolStore = create<ToolState>()(
  persist(
    (set, get) => {
  const initialTools = makeDefaultTools()
  return {
    tools: initialTools,
    inds: deriveInds(initialTools),
    selectedToolId: null,
    showAddPopup: false,
    panelParams: {} as Record<number, Record<string, Record<string, number | string>>>,

    toggleTool: (id) => set(s => {
      const tools = s.tools.map(t => t.id === id ? { ...t, on: !t.on } : t)
      return { tools, inds: deriveInds(tools) }
    }),

    addTool: (indKey) => {
      const cat = IND_CATALOG[indKey]
      const params: Record<string, number> = {}
      cat?.params?.forEach(p => { params[p.key] = p.def })
      const colors: Record<string, string> = {}
      cat?.colors?.forEach(c => { colors[c.key] = c.def })
      const tool: ToolInstance = {
        id: newToolId(), indKey, name: cat?.label || indKey, on: true,
        params, colors, hot: true,
        hotLabel: cat?.label?.toUpperCase().slice(0, 10) || indKey.toUpperCase(),
        hotColor: '#D4AF37',
        legacyKeys: cat?.legacyKeys || [indKey],
      }
      set(s => {
        const tools = [...s.tools, tool]
        return { tools, inds: deriveInds(tools), selectedToolId: tool.id, showAddPopup: false }
      })
      return tool
    },

    deleteTool: (id) => set(s => {
      const tools = s.tools.filter(t => t.id !== id)
      return { tools, inds: deriveInds(tools), selectedToolId: s.selectedToolId === id ? null : s.selectedToolId }
    }),

    duplicateTool: (id) => set(s => {
      const orig = s.tools.find(t => t.id === id)
      if (!orig) return s
      const dup: ToolInstance = { ...orig, id: newToolId(), name: orig.name + ' copy' }
      const tools = [...s.tools, dup]
      return { tools, inds: deriveInds(tools), selectedToolId: dup.id }
    }),

    setToolParam: (id, key, value) => set(s => ({
      tools: s.tools.map(t => t.id === id ? { ...t, params: { ...t.params, [key]: value } } : t),
    })),

    setToolColor: (id, key, value) => set(s => ({
      tools: s.tools.map(t => t.id === id ? { ...t, colors: { ...t.colors, [key]: value } } : t),
    })),

    setToolName: (id, name) => set(s => ({
      tools: s.tools.map(t => t.id === id ? { ...t, name, hotLabel: name.toUpperCase().slice(0, 10) } : t),
    })),

    setToolHot: (id, hot) => set(s => ({
      tools: s.tools.map(t => t.id === id ? { ...t, hot } : t),
    })),

    setToolHotLabel: (id, hotLabel) => set(s => ({
      tools: s.tools.map(t => t.id === id ? { ...t, hotLabel } : t),
    })),

    setToolHotColor: (id, hotColor) => set(s => ({
      tools: s.tools.map(t => t.id === id ? { ...t, hotColor } : t),
    })),

    selectTool: (id) => set({ selectedToolId: id }),
    setTools: (tools) => set({ tools, inds: deriveInds(tools) }),

    // Restore the seeded default tool list (e.g. after a template narrowed the working
    // set). Replaces the current list entirely; user-added/duplicated tools are dropped.
    resetTools: () => { const tools = makeDefaultTools(); set({ tools, inds: deriveInds(tools), selectedToolId: null }) },

    // Write a param override scoped to ONE panel (the active chart). Reads merge this on top
    // of the global tool.params, so unedited charts keep showing global defaults.
    setPanelParam: (panelIdx, indKey, key, value) => set(s => {
      const byPanel = s.panelParams[panelIdx] || {}
      const byInd = byPanel[indKey] || {}
      return { panelParams: { ...s.panelParams, [panelIdx]: { ...byPanel, [indKey]: { ...byInd, [key]: value } } } }
    }),

    toggleShowAddPopup: () => set(s => ({ showAddPopup: !s.showAddPopup })),
    closeAddPopup: () => set({ showAddPopup: false }),

    getActiveTools: () => get().tools.filter(t => t.on),
    getInactiveTools: () => get().tools.filter(t => !t.on),
    getHotTools: () => get().tools.filter(t => t.hot && t.on && !HOT_EXCLUDE.has(t.indKey)),
  }
},
    {
      name: 'traderra-tools',
      version: 1,
      // sessionStorage → per-tab isolation: tool list/params are local to each tab so a
      // template applied in one tab doesn't change indicators in another.
      storage: createJSONStorage(() => sessionStorage),
      // Migrate the old v0 shape ({ toolOverrides: { indKey: {...} } }) → new tools-list
      // shape, so existing persisted Lingua config carries over without a re-apply.
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted
        if (version === undefined && persisted.toolOverrides && !persisted.tools) {
          const tools = Object.entries(persisted.toolOverrides).map(([indKey, o]: [string, any]) => ({ indKey, on: o.on, hot: o.hot, params: o.params, colors: o.colors }))
          return { ...persisted, tools, toolOverrides: undefined }
        }
        return persisted
      },
      // Persist the ACTUAL tool list (on/hot/params/colors), not indKey overrides — so a
      // template that narrows the list (setTools([lingua]) → only Lingua) restores exactly
      // that list. Default-on tools that weren't in the template do NOT reappear. On
      // hydration each tool is deep-merged against fresh catalog defaults: new params
      // (e.g. trendEma 63→39) propagate from code, while user-tuned params survive.
      // Stale tools whose indKey was removed from the catalog are dropped.
      partialize: (s) => ({
        tools: s.tools.map(t => ({ indKey: t.indKey, on: t.on, hot: t.hot, params: t.params, colors: t.colors })),
        selectedToolId: s.selectedToolId,
        panelParams: s.panelParams,
      }),
      merge: (persisted: any, current: any) => {
        // If persisted tool list is empty/missing (cleared state or fresh browser), fall
        // back to the seeded defaults so the Vault isn't permanently blank. Non-empty
        // templates (e.g. setTools([lingua])) restore exactly as saved.
        const raw: any[] = Array.isArray(persisted?.tools) ? persisted.tools : []
        const pTools: any[] = raw.length === 0
          ? current.tools.map(t => ({ indKey: t.indKey, on: t.on, hot: t.hot, params: t.params, colors: t.colors }))
          : raw
        const restored = pTools
          .filter((t: any) => t && IND_CATALOG[t.indKey])
          .map((t: any) => {
            const cat = IND_CATALOG[t.indKey]
            const freshParams: Record<string, any> = {}
            cat?.params?.forEach((p: any) => { freshParams[p.key] = p.def })
            const freshColors: Record<string, string> = {}
            cat?.colors?.forEach((c: any) => { freshColors[c.key] = c.def })
            return {
              id: newToolId(),
              indKey: t.indKey,
              name: cat?.label || t.indKey,
              on: t.on ?? false,
              hot: t.hot ?? false,
              params: { ...freshParams, ...(t.params || {}) },
              colors: { ...freshColors, ...(t.colors || {}) },
              hotLabel: cat?.label?.toUpperCase().slice(0, 10) || t.indKey.toUpperCase(),
              hotColor: '#D4AF37',
              legacyKeys: cat?.legacyKeys || [t.indKey],
            }
          })
        // BACK-FILL: ensure EVERY catalog tool exists in the Vault. A template's old
        // destructive apply (now fixed in handleApply) could persist a truncated list like
        // [lingua]; the Vault must always show the full set. Any catalog key missing from
        // the restored list is appended with catalog defaults (default-off so a template's
        // visibility isn't silently changed — the user turns them on as needed).
        const have = new Set(restored.map((t: any) => t.indKey))
        for (const key of Object.keys(IND_CATALOG)) {
          if (have.has(key)) continue
          const cat = IND_CATALOG[key]
          const freshParams: Record<string, any> = {}
          cat?.params?.forEach((p: any) => { freshParams[p.key] = p.def })
          const freshColors: Record<string, string> = {}
          cat?.colors?.forEach((c: any) => { freshColors[c.key] = c.def })
          restored.push({
            id: newToolId(), indKey: key, name: cat?.label || key,
            on: false, hot: false, params: freshParams, colors: freshColors,
            hotLabel: cat?.label?.toUpperCase().slice(0, 10) || key.toUpperCase(),
            hotColor: '#D4AF37', legacyKeys: cat?.legacyKeys || [key],
          })
        }
        return {
          ...current,
          tools: restored,
          inds: deriveInds(restored),
          selectedToolId: persisted?.selectedToolId ?? current.selectedToolId,
          panelParams: persisted?.panelParams || {},
        }
      },
    }
  )
)
