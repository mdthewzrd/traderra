/**
 * SAVED CHARTS — separate from Templates (Split A).
 *
 *   Template   (right dropdown) = indicator LAYOUT (which indicators + params),
 *                                 applied to the current symbol. No symbol/tf.
 *   SavedChart (left strip)     = complete chart SNAPSHOT (symbol + timeframe +
 *                                 indicators + params) for screenshot gathering.
 *
 * Fully separate storage: own localStorage key + DB rows tagged type='savedchart'.
 * Saving a chart here NEVER appears in the template dropdown, and vice versa.
 */
import type { ChartTemplate } from './templates'

const SAVED_KEY = 'traderra-saved-charts'
const SCHEMA_VERSION = 2   // bump to force a one-time wipe of stale local saved-charts (poisoned pre-fix snapshots)
const VERSION_KEY = 'traderra-saved-charts-v'

export interface SavedChart extends ChartTemplate {}

export function loadSavedCharts(): SavedChart[] {
  try {
    // One-time migration: if the local copy predates SCHEMA_VERSION, drop it.
    // (Old snapshots captured only base params, not per-panel edits → broken switching.)
    const v = Number(localStorage.getItem(VERSION_KEY) || 0)
    if (v < SCHEMA_VERSION) {
      localStorage.setItem(SAVED_KEY, '[]')
      localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION))
      return []
    }
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')
  } catch {
    return []
  }
}

function persist(list: SavedChart[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list))
}

/** Snapshot the current live chart (symbol + tf + tools + params + chartStyle) as a saved chart. */
export function saveCurrentAsSavedChart(name: string): SavedChart {
  const { saveTemplate } = require('./templates')
  const { useToolStore, getMergedToolParams } = require('@/stores/charts/toolStore')
  const { useUIStore } = require('@/stores/charts/uiStore')
  const { useIndicatorStore } = require('@/stores/charts/indicatorStore')
  const { useChartStore } = require('@/stores/charts/chartStore')
  const ap = useUIStore.getState().activePanel
  // Snapshot EFFECTIVE params (base tool.params + per-panel override) for the active
  // panel — param sliders edit the override store, so plain tool.params = defaults only.
  const tools = useToolStore.getState().tools.map((t: any) => ({
    ...t,
    params: getMergedToolParams(ap, t.id),
  }))
  const chartStyle = useUIStore.getState().chartStyle
  const theme = useUIStore.getState().theme
  const inds = useIndicatorStore.getState().inds
  const symbol = useChartStore.getState().symbol
  const tf = useChartStore.getState().panels[ap]?.tf || ''
  const tpl = saveTemplate(name, tools, chartStyle, theme, inds, symbol, tf)

  // Store in the SEPARATE saved-charts list (saveTemplate writes to the template key,
  // so we additionally persist here and remove from the template list to keep them clean).
  const list = loadSavedCharts()
  const existingIdx = list.findIndex((t) => t.name === name)
  if (existingIdx >= 0) list[existingIdx] = tpl
  else list.push(tpl)
  persist(list)

  // Also strip it from the template list if saveTemplate added it there.
  try {
    const tlist: ChartTemplate[] = JSON.parse(localStorage.getItem('traderra-templates') || '[]')
    const filtered = tlist.filter((t) => t.name !== name)
    if (filtered.length !== tlist.length) localStorage.setItem('traderra-templates', JSON.stringify(filtered))
  } catch {}

  // Sync to DB tagged as a savedchart (separate from templates).
  fetch('/api/chart-data/templates', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, payload: tpl, global: true, type: 'savedchart' }),
  }).catch(() => {})

  return tpl
}

export function deleteSavedChart(idx: number) {
  const list = loadSavedCharts()
  const removed = list[idx]
  if (!removed) return
  list.splice(idx, 1)
  persist(list)
  if (removed.id && !String(removed.id).startsWith('preset_')) {
    fetch(`/api/chart-data/templates?id=${encodeURIComponent(removed.id)}`, { method: 'DELETE' }).catch(() => {})
  }
}
