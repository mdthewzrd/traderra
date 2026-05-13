/**
 * Template management — save, load, apply, delete chart templates.
 * Extracted from inline JS. Templates are stored in both localStorage and server.
 */

const TPL_KEY = 'traderra-templates'

export interface ChartTemplate {
  id: string
  name: string
  chartStyle?: string
  theme?: string
  inds?: Record<string, boolean>
  tools: any[]
  colors?: Record<string, string>
  params?: Record<string, Record<string, any>>
  ts?: number
}

export function loadTemplatesFromStorage(): ChartTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TPL_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveTemplatesToStorage(templates: ChartTemplate[]) {
  localStorage.setItem(TPL_KEY, JSON.stringify(templates))
}

export function saveTemplate(name: string, tools: any[], chartStyle: string, theme: string, inds: Record<string, boolean>): ChartTemplate {
  const templates = loadTemplatesFromStorage()
  const tpl: ChartTemplate = {
    id: 'tpl_' + Date.now(),
    name,
    chartStyle,
    theme,
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
