/**
 * Template management — save, load, apply, delete chart templates.
 * Extracted from inline JS. Templates are stored in both localStorage and server.
 */

const TPL_KEY = 'traderra-templates'
const PRESET_KEY = 'traderra-presets-seeded-v6'

/** Built-in preset templates — seeded to localStorage on first load */
export const PRESET_TEMPLATES: ChartTemplate[] = [
  {
    id: 'preset_lingua_cycle',
    name: 'Lingua Cycle',
    symbol: 'SPY',
    tf: '60',   // 1H — applied to the top panel on load
    chartStyle: 'candles',
    // Lingua Cycle = stage shading (CO/UP/EC/EU) + EMA clouds + its OWN dev band
    // (drawn at the tracked xtreme/euThr thresholds). The adaptive band tool was
    // removed — Lingua's own band is the single source of truth now.
    inds: {},
    tools: [
      // Lingua Cycle: stage shading + EMA clouds + dev band, all in one tool.
      { indKey: 'lingua', on: true, params: { xtreme: 6.3, euThr: 7.2, mtfTf: '60', showClouds: 1, showBands: 1 }, colors: {} },
    ],
    colors: {},
    params: {},
    ts: 0,
  },
]

export interface ChartTemplate {
  id: string
  name: string
  chartStyle?: string
  theme?: string
  symbol?: string    // optional: template targets this symbol (e.g. 'SPY')
  tf?: string        // optional: applied to the top panel on load (e.g. '60' = 1H)
  inds?: Record<string, boolean>
  tools: any[]
  colors?: Record<string, string>
  params?: Record<string, Record<string, any>>
  ts?: number
}

export function loadTemplatesFromStorage(): ChartTemplate[] {
  try {
    seedPresetsIfNeeded()
    return JSON.parse(localStorage.getItem(TPL_KEY) || '[]')
  } catch {
    return []
  }
}

/** Seed built-in presets on first load */
function seedPresetsIfNeeded() {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(PRESET_KEY)) return
  const existing: ChartTemplate[] = JSON.parse(localStorage.getItem(TPL_KEY) || '[]')
  // drop deprecated preset ids (renamed/superseded)
  const DEPRECATED = new Set(['preset_mikes_bands'])
  // built-in preset ids always overwrite their stale version on re-seed (PRESET_KEY bump)
  const PRESET_IDS = new Set(PRESET_TEMPLATES.map(p => p.id))
  const kept = existing.filter(t => !DEPRECATED.has(t.id) && !PRESET_IDS.has(t.id))
  // re-prepend all current presets at the front (fresh versions)
  kept.unshift(...PRESET_TEMPLATES)
  localStorage.setItem(TPL_KEY, JSON.stringify(kept))
  localStorage.setItem(PRESET_KEY, '1')
}

export function saveTemplatesToStorage(templates: ChartTemplate[]) {
  localStorage.setItem(TPL_KEY, JSON.stringify(templates))
}

export function saveTemplate(name: string, tools: any[], chartStyle: string, theme: string, inds: Record<string, boolean>, symbol = '', tf = ''): ChartTemplate {
  const templates = loadTemplatesFromStorage()
  const tpl: ChartTemplate = {
    id: 'tpl_' + Date.now(),
    name,
    chartStyle,
    theme,
    symbol,
    tf,
    inds: Object.assign({}, inds),
    tools: JSON.parse(JSON.stringify(tools)),
    colors: {},
    params: {},
    ts: Date.now(),
  }
  templates.push(tpl)
  saveTemplatesToStorage(templates)
  return tpl
}

export function updateTemplate(idx: number, updates: Partial<ChartTemplate>): ChartTemplate | null {
  const templates = loadTemplatesFromStorage()
  if (!templates[idx]) return null
  Object.assign(templates[idx], updates, { ts: Date.now() })
  saveTemplatesToStorage(templates)
  return templates[idx]
}

export function deleteTemplate(idx: number): string | null {
  const templates = loadTemplatesFromStorage()
  const name = templates[idx]?.name || 'template'
  templates.splice(idx, 1)
  saveTemplatesToStorage(templates)
  return name
}

/**
 * Sync templates to server via CloudStore.
 */
export async function syncTemplatesToServer(userId: string) {
  const templates = loadTemplatesFromStorage()
  try {
    await fetch('/api/chart-data/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates }),
    })
  } catch (e) {
    console.error('Template sync failed:', e)
  }
}
