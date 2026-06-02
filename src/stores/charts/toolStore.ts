import { create } from 'zustand'
import { C } from '@/lib/charts/theme'

// ═══════════════════════════════════════════════════════════════
//  IND_CATALOG — defines all available tool types
// ═══════════════════════════════════════════════════════════════

export interface IndParamDef {
  key: string; label: string; def: number; min?: number; max?: number; step?: number; type?: string
}
export interface IndColorDef {
  key: string; label: string; def: string
}
export interface IndCatalogEntry {
  label: string; group: string
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
  db_upper:       { label:'Dev Upper',       group:'Dev Bands',   params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(200,120,20,.20)'},{key:'line',label:'Line',def:'rgba(220,140,30,.90)'}], legacyKeys:['db_upper'] },
  db_low1:        { label:'Dev Low 1',       group:'Dev Bands',   params:[{key:'ema',label:'EMA Period',def:9,min:1,max:200},{key:'atr',label:'ATR Period',def:9,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(200,184,0,.20)'},{key:'line',label:'Line',def:'rgba(220,200,10,.90)'}], legacyKeys:['db_low1'] },
  db_low2:        { label:'Dev Low 2',       group:'Dev Bands',   params:[{key:'ema',label:'EMA Period',def:20,min:1,max:200},{key:'atr',label:'ATR Period',def:20,min:1,max:200},{key:'mult',label:'Multiplier',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(20,120,200,.20)'},{key:'line',label:'Line',def:'rgba(30,150,220,.90)'}], legacyKeys:['db_low2'] },
  vwap:           { label:'VWAP',            group:'Overlays',    colors:[{key:'color',label:'Color',def:'#00e676'}], legacyKeys:['vwap'] },
  bollinger:      { label:'Bollinger Bands', group:'Overlays',    params:[{key:'period',label:'Period',def:20,min:1,max:500},{key:'stddev',label:'Std Dev',def:2,step:0.1}], colors:[{key:'fill',label:'Fill',def:'rgba(100,149,237,.08)'},{key:'upper',label:'Upper',def:'rgba(100,149,237,.40)'},{key:'lower',label:'Lower',def:'rgba(100,149,237,.40)'}], legacyKeys:['bollinger'] },
  trail_stop:     { label:'Trail Stop',       group:'Dev Bands',   params:[{key:'fast',label:'Fast EMA',def:9,min:1,max:200},{key:'slow',label:'Slow EMA',def:20,min:1,max:200},{key:'band_mult',label:'Band Multiplier',def:3.0,step:0.1},{key:'lookback',label:'Swing Lookback',def:5,min:2,max:20}], colors:[{key:'color',label:'Color',def:'#4ade80'}], legacyKeys:['trail_stop'] },
  sma_vol:        { label:'Volume SMA',      group:'Volume',      params:[{key:'period',label:'Period',def:20,min:1,max:200}], colors:[{key:'color',label:'Color',def:'#D4AF37'}], legacyKeys:['sma_vol'] },
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
    mk('sma_vol', true, false),
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
  setToolParam: (id: string, key: string, value: number) => void
  setToolColor: (id: string, key: string, value: string) => void
  setToolName: (id: string, name: string) => void
  setToolHot: (id: string, hot: boolean) => void
  setToolHotLabel: (id: string, label: string) => void
  setToolHotColor: (id: string, color: string) => void
  selectTool: (id: string | null) => void
  setTools: (tools: ToolInstance[]) => void
  toggleShowAddPopup: () => void
  closeAddPopup: () => void

  // Read
  getActiveTools: () => ToolInstance[]
  getInactiveTools: () => ToolInstance[]
  getHotTools: () => ToolInstance[]
}

export const useToolStore = create<ToolState>((set, get) => {
  const initialTools = makeDefaultTools()
  return {
    tools: initialTools,
    inds: deriveInds(initialTools),
    selectedToolId: null,
    showAddPopup: false,

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

    toggleShowAddPopup: () => set(s => ({ showAddPopup: !s.showAddPopup })),
    closeAddPopup: () => set({ showAddPopup: false }),

    getActiveTools: () => get().tools.filter(t => t.on),
    getInactiveTools: () => get().tools.filter(t => !t.on),
    getHotTools: () => get().tools.filter(t => t.hot && t.on && !HOT_EXCLUDE.has(t.indKey)),
  }
})
