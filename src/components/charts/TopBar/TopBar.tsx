'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useUIStore, useChartStore } from '@/stores/charts'
import { ProfileIcon } from '@/app/charts/ChartsTerminal'
import { ChartDateNav } from './ChartDateNav'

const GOLD = '#D4AF37'

/** Shared button style — compact gold-tinted */
const tb: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(212,175,55,0.35)',
  borderRadius: 3,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  padding: '2px 8px',
  fontFamily: 'JetBrains Mono, monospace',
  color: 'rgba(212,175,55,0.75)',
  letterSpacing: 0.3,
  transition: 'all 0.15s',
  lineHeight: '18px',
}

const tbActive: React.CSSProperties = {
  ...tb,
  background: `${GOLD}18`,
  borderColor: GOLD,
  color: GOLD,
}

/**
 * TopBar — site-level nav only.
 * Chart-specific controls (date, OHLCV, FROM/TO) live in the chart panel.
 * [Brand | Symbol ▶ LIVE ... spacer ... TPL | Theme | ⟳ | Profile]
 */

export function TopBar() {
  const [symInput, setSymInput] = useState('AAPL')
  const chartSymbol = useChartStore((s) => s.symbol)
  const setChartSymbol = useChartStore((s) => s.setSymbol)
  const liveMode = useUIStore((s) => s.liveMode)
  const setLiveMode = useUIStore((s) => s.setLiveMode)
  const activeLayout = useUIStore((s) => s.activeLayout)
  const setActiveLayout = useUIStore((s) => s.setActiveLayout)
  const setPanelTf = useChartStore((s) => s.setPanelTf)

  const handleLoadSymbol = useCallback(() => {
    const sym = symInput.trim().toUpperCase()
    if (!sym) return
    setChartSymbol(sym)
    ;(window as any).symbol = sym
    ;(window as any).loadChart?.(sym)
  }, [symInput, setChartSymbol])

  useEffect(() => { setSymInput(chartSymbol) }, [chartSymbol])

  return (
    <div id="topbar" style={{ flexWrap: 'nowrap', overflow: 'visible' }}>
      <span id="logo">TRADERRA</span>

      <input
        id="symbol-input"
        type="text"
        value={symInput}
        placeholder="TICKER"
        onChange={(e) => setSymInput(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleLoadSymbol()}
      />
      <button style={tb} onClick={handleLoadSymbol}>▶</button>
      <button
        style={liveMode ? tbActive : tb}
        onClick={() => setLiveMode(!liveMode)}
      >⬤ LIVE</button>
      {/* Layout buttons — tiny grid icons. '2h' defaults to 1H/4H side-by-side. */}
      {([
        ['single', [[1]], 'Single chart'],
        ['2h', [[1, 1]], 'Two side-by-side (scrollable, resizable)'],
        ['3h', [[1, 1, 1]], 'Three side-by-side (scrollable, resizable)'],
        ['2v', [[1], [1]], 'Two stacked (scrollable)'],
        ['3v', [[1], [1], [1]], 'Three stacked (scrollable)'],
      ] as const).map(([mode, rows, title]) => (
        <button
          key={mode}
          style={activeLayout === mode ? tbActive : tb}
          title={title as string}
          onClick={() => {
            setActiveLayout(mode as string)
            if (mode === '2h') { setPanelTf(0, '60'); setPanelTf(1, '240') }
            useUIStore.getState().setActivePanel(0)
          }}
        >
          <span style={{
            display: 'inline-grid',
            gridTemplateColumns: `repeat(${(rows as number[][])[0].length}, 4px)`,
            gap: 1, verticalAlign: 'middle', lineHeight: 0,
          }}>
            {(rows as number[][]).flat().map((_, i) => (
              <span key={i} style={{ width: 4, height: 4, background: 'currentColor', opacity: 0.85 }} />
            ))}
          </span>
        </button>
      ))}

      <div style={{ flex: 1 }} />

      <TemplateDropdown />
      <ThemeToggleButton />
      <button
        style={{ ...tb, fontSize: 16 }}
        onClick={() => { useUIStore.getState().setSidebarTab('look'); useUIStore.getState().setSidebarOpen(true) }}
        title="Chart settings"
      >⚙</button>
      <button
        style={{ ...tb, fontSize: 16 }}
        onClick={() => window.location.reload()}
        title="Reload chart"
      >⟳</button>

      <ProfileIcon />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Template Dropdown
   ═══════════════════════════════════════════════════════════════ */

function TemplateDropdown() {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  useEffect(() => {
    const { loadTemplatesFromStorage } = require('@/lib/charts/templates')
    setTemplates(loadTemplatesFromStorage())
  }, [open])

  const handleSave = () => {
    const { saveTemplate } = require('@/lib/charts/templates')
    const { useToolStore } = require('@/stores/charts/toolStore')
    const name = prompt('Template name:')
    if (!name) return
    const tools = useToolStore.getState().tools
    const chartStyle = useUIStore.getState().chartStyle
    const theme = useUIStore.getState().theme
    const inds = require('@/stores/charts/indicatorStore').useIndicatorStore.getState().inds
    // capture current view so saved templates preserve symbol + top-panel timeframe
    const { useChartStore } = require('@/stores/charts/chartStore')
    const symbol = useChartStore.getState().symbol
    const ap = useUIStore.getState().activePanel
    const tf = useChartStore.getState().panels[ap]?.tf || ''
    saveTemplate(name, tools, chartStyle, theme, inds, symbol, tf)
    const { loadTemplatesFromStorage } = require('@/lib/charts/templates')
    setTemplates(loadTemplatesFromStorage())
  }

  const handleApply = (idx: number) => {
    if (!templates[idx]) return
    const tpl = templates[idx]
    if (tpl.inds) {
      const { useIndicatorStore } = require('@/stores/charts/indicatorStore')
      useIndicatorStore.getState().setInds(tpl.inds)
    }
    if (tpl.chartStyle) {
      useUIStore.getState().setChartStyle(tpl.chartStyle)
    }
    // Symbol + timeframe: applied to the top panel (index 0). Optional — templates
    // without these fields leave the current symbol/TF untouched.
    if (tpl.symbol) {
      const { useChartStore } = require('@/stores/charts/chartStore')
      useChartStore.getState().setSymbol(tpl.symbol)
    }
    if (tpl.tf) {
      const { useChartStore } = require('@/stores/charts/chartStore')
      const ap = useUIStore.getState().activePanel
      useChartStore.getState().setPanelTf(ap, tpl.tf)
    }
    if (tpl.tools) {
      const { useToolStore } = require('@/stores/charts/toolStore')
      const { IND_CATALOG } = require('@/stores/charts/toolStore')
      // Build the template's DESIRED state per indKey, hydrating params/colors from catalog
      // defaults (same as before) so a template from an older config still loads.
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
      // MERGE (not replace): a template is a VISIBILITY/LAYOUT preset, NOT a destructive
      // list swap. Every existing tool stays in the Vault — tools in the template take the
      // template's on/params/colors; tools NOT in the template are turned OFF (hidden) but
      // are KEPT. Template tools missing from the Vault are added (hydrated). This is why
      // the Vault always shows ALL tools regardless of the active template.
      const existingKeys = new Set(ts.tools.map((t: any) => t.indKey))
      const merged = ts.tools.map((t: any) => {
        const want = tplByKey[t.indKey]
        if (want) return { ...t, on: want.on, params: { ...t.params, ...want.params }, colors: { ...t.colors, ...want.colors } }
        return { ...t, on: false }            // not in template → hidden, but KEPT in the Vault
      })
      for (const key of Object.keys(tplByKey)) {
        if (!existingKeys.has(key)) {           // template tool missing from Vault → add it
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
    }
    setOpen(false)
    useUIStore.getState().setActiveTemplateName(tpl.name)
  }

  const handleDelete = (idx: number) => {
    const { deleteTemplate, loadTemplatesFromStorage } = require('@/lib/charts/templates')
    deleteTemplate(idx)
    setTemplates(loadTemplatesFromStorage())
  }

  return (
    <div className="dropdown-group" ref={ref}>
      <button
        style={open ? tbActive : tb}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
      >📋 TPL ▾</button>
      <div className={`dropdown-content${open ? ' open' : ''}`} style={{ minWidth: 200 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '4px 10px', fontSize: 10, color: 'rgba(212,175,55,0.5)', fontWeight: 700, letterSpacing: 0.5 }}>TEMPLATES</div>
        {templates.length === 0 && (
          <div style={{ padding: '6px 10px', fontSize: 11, color: '#4a6080' }}>No templates saved</div>
        )}
        {templates.map((tpl, i) => (
          <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px' }}>
            <button
              className="tool-btn"
              style={{ flex: 1, textAlign: 'left', color: tpl.id.startsWith('preset_') ? '#22d3ee' : '#dde3f0', padding: '2px 4px' }}
              onClick={() => handleApply(i)}
            >{tpl.id.startsWith('preset_') ? '⚡ ' : ''}{tpl.name}</button>
            {!tpl.id.startsWith('preset_') && (
              <button
                style={{ background: 'none', border: 'none', color: '#ff3d57', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}
                onClick={() => handleDelete(i)}
                title="Delete template"
              >✕</button>
            )}
          </div>
        ))}
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <div className="tool-btn" style={{ color: GOLD, cursor: 'pointer' }} onClick={handleSave}>💾 Save Current</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Theme Toggle
   ═══════════════════════════════════════════════════════════════ */

function ThemeToggleButton() {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  return (
    <button style={tb} onClick={toggleTheme}>{theme === 'dark' ? '🌙' : '☀'}</button>
  )
}
