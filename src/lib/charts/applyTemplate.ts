/**
 * Shared chart-template apply + save helpers.
 * Extracted so both the TopBar dropdown AND the SavedChartsStrip (hot buttons)
 * use the SAME logic — preventing drift between the two views.
 *
 * Uses dynamic require() for the stores to avoid circular-import issues at
 * module load (same pattern the original inline TopBar code used).
 */
import type { ChartTemplate } from './templates'

/** Apply a saved template to the live chart: inds + chartStyle + symbol + tf + tools (merged). */
export function applyTemplate(tpl: ChartTemplate) {
  if (tpl.inds) {
    const { useIndicatorStore } = require('@/stores/charts/indicatorStore')
    useIndicatorStore.getState().setInds(tpl.inds)
  }
  if (tpl.chartStyle) {
    const { useUIStore } = require('@/stores/charts/uiStore')
    useUIStore.getState().setChartStyle(tpl.chartStyle)
  }
  // Symbol + timeframe: applied to the active panel. Optional.
  if (tpl.symbol) {
    const { useChartStore } = require('@/stores/charts/chartStore')
    useChartStore.getState().setSymbol(tpl.symbol)
  }
  if (tpl.tf) {
    const { useChartStore } = require('@/stores/charts/chartStore')
    const { useUIStore } = require('@/stores/charts/uiStore')
    const ap = useUIStore.getState().activePanel
    useChartStore.getState().setPanelTf(ap, tpl.tf)
  }
  if (tpl.tools) {
    const { useToolStore, IND_CATALOG } = require('@/stores/charts/toolStore')
    // Hydrate desired per-indKey state from catalog defaults so old templates still load.
    const tplByKey: Record<string, any> = {}
    for (const t of tpl.tools) {
      const cat = IND_CATALOG[t.indKey]
      const params: Record<string, string | number> = {}
      cat?.params?.forEach((p: any) => { params[p.key] = t.params?.[p.key] ?? p.def })
      const colors: Record<string, string> = {}
      cat?.colors?.forEach((c: any) => { colors[c.key] = t.colors?.[c.key] ?? c.def })
      tplByKey[t.indKey] = { on: t.on !== false, params, colors }
    }
    const ts = useToolStore.getState()
    // MERGE (not replace): a template is a VISIBILITY/LAYOUT preset. Tools in the template
    // take the template's on/params/colors; tools NOT in the template are turned OFF but
    // KEPT in the Vault. Missing tools are added (hydrated).
    const existingKeys = new Set(ts.tools.map((t: any) => t.indKey))
    const merged = ts.tools.map((t: any) => {
      const want = tplByKey[t.indKey]
      if (want) return { ...t, on: want.on, params: { ...t.params, ...want.params }, colors: { ...t.colors, ...want.colors } }
      return { ...t, on: false }
    })
    for (const key of Object.keys(tplByKey)) {
      if (!existingKeys.has(key)) {
        const want = tplByKey[key]
        merged.push({
          id: 't' + Date.now() + Math.random().toString(36).slice(2, 6),
          indKey: key, name: IND_CATALOG[key]?.label || key,
          on: want.on, params: want.params, colors: want.colors, hot: false,
          legacyKeys: IND_CATALOG[key]?.legacyKeys || [key],
        })
      }
    }
    ts.setTools(merged)
    // Saved params must be AUTHORITATIVE at render. Render reads getMergedToolParams(),
    // where a per-panel override WINS over a tool's base params — so a stale override
    // left from prior editing would silently clobber the just-restored params. Write the
    // template's params into the active panel's override so the chart shows exactly what
    // was saved.
    const { useUIStore: _ui } = require('@/stores/charts/uiStore')
    const _ap = _ui.getState().activePanel
    const _apOverrides: Record<string, Record<string, number | string>> = { ...(ts.panelParams[_ap] || {}) }
    for (const tt of tpl.tools) {
      const inst = merged.find((m: any) => m.indKey === tt.indKey)
      const want = tplByKey[tt.indKey]
      if (inst && want) _apOverrides[inst.id] = want.params
    }
    useToolStore.setState({ panelParams: { ...ts.panelParams, [_ap]: _apOverrides } })
  }
  const { useUIStore } = require('@/stores/charts/uiStore')
  useUIStore.getState().setActiveTemplateName(tpl.name)
}

/** Snapshot the current chart (symbol + timeframe + tools + params + chartStyle) as a named template. */
export function saveCurrentAsTemplate(name: string): ChartTemplate {
  const { saveTemplate } = require('./templates')
  const { useToolStore, getMergedToolParams } = require('@/stores/charts/toolStore')
  const { useUIStore } = require('@/stores/charts/uiStore')
  const { useIndicatorStore } = require('@/stores/charts/indicatorStore')
  const { useChartStore } = require('@/stores/charts/chartStore')
  const ap = useUIStore.getState().activePanel
  // Snapshot the EFFECTIVE params (base tool.params + per-panel override) for the
  // active panel. Every param slider edits via setPanelParam (the override store);
  // reading just tool.params would capture only catalog defaults and drop user edits.
  const tools = useToolStore.getState().tools.map((t: any) => ({
    ...t,
    params: getMergedToolParams(ap, t.id),
  }))
  const chartStyle = useUIStore.getState().chartStyle
  const theme = useUIStore.getState().theme
  const inds = useIndicatorStore.getState().inds
  const symbol = useChartStore.getState().symbol
  const tf = useChartStore.getState().panels[ap]?.tf || ''
  return saveTemplate(name, tools, chartStyle, theme, inds, symbol, tf)
}
