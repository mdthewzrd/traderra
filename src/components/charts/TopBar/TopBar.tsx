'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useUIStore, useChartStore } from '@/stores/charts'
import { useWatchlistStore } from '@/stores/charts/watchlistStore'
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
  const [wlAddOpen, setWlAddOpen] = useState(false)
  const chartSymbol = useChartStore((s) => s.symbol)
  const setChartSymbol = useChartStore((s) => s.setSymbol)
  const wlLists = useWatchlistStore((s) => s.lists)
  const wlAddSymbol = useWatchlistStore((s) => s.addSymbol)
  const wlRemoveSymbol = useWatchlistStore((s) => s.removeSymbol)
  const symInAnyList = wlLists.some(l => l.syms.includes(chartSymbol))
  const liveMode = useUIStore((s) => s.liveMode)
  const setLiveMode = useUIStore((s) => s.setLiveMode)
  const activeLayout = useUIStore((s) => s.activeLayout)
  const setActiveLayout = useUIStore((s) => s.setActiveLayout)
  const setPanelTf = useChartStore((s) => s.setPanelTf)
  const activePanel = useUIStore((s) => s.activePanel)
  const tabs = useUIStore((s) => s.tabs)
  const activeTab = useUIStore((s) => s.activeTab)
  const setActiveTab = useUIStore((s) => s.setActiveTab)
  const cycleTab = useUIStore((s) => s.cycleTab)

  const handleLoadSymbol = useCallback(() => {
    const sym = symInput.trim().toUpperCase()
    if (!sym) return
    setChartSymbol(sym)
    ;(window as any).symbol = sym
    ;(window as any).loadChart?.(sym)
  }, [symInput, setChartSymbol])

  useEffect(() => { setSymInput(chartSymbol) }, [chartSymbol])

  // Tab → active panel's timeframe. Fires on tab change (incl. mount sync to the persisted tab).
  useEffect(() => {
    const t = tabs[activeTab]
    if (t) setPanelTf(activePanel, t.tf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ◀ ▶ arrow keys cycle tabs (skipped while typing or interacting with the chart canvas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'CANVAS' || el?.isContentEditable) return
      if (e.key === 'ArrowLeft') { cycleTab(-1); e.preventDefault() }
      else if (e.key === 'ArrowRight') { cycleTab(1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleTab])

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
      <div style={{ position: 'relative' }}>
        <button
          style={symInAnyList ? tbActive : tb}
          title="Add to watchlist"
          onClick={() => setWlAddOpen(v => !v)}
        >★</button>
        {wlAddOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setWlAddOpen(false)} />
            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: '#0d1018', border: '1px solid #222840', borderRadius: 6, padding: 6, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
              <div style={{ fontSize: 9, color: '#4a6080', fontWeight: 700, marginBottom: 4, padding: '0 4px' }}>ADD {chartSymbol} TO</div>
              {wlLists.map((l, i) => {
                const has = l.syms.includes(chartSymbol)
                return (
                  <div
                    key={l.id || i}
                    onClick={() => { has ? wlRemoveSymbol(chartSymbol) : wlAddSymbol(chartSymbol) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#dde3f0', borderRadius: 3 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#1a2030')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ color: has ? '#4ade80' : '#4a6080', fontSize: 10 }}>{has ? '✓' : '○'}</span>
                    {l.name}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
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

      {/* Chart tabs — timeframe presets. ◀ ▶ cycle; selecting sets the active panel's TF. */}
      <button style={tb} title="Previous timeframe (←)" onClick={() => cycleTab(-1)}>◀</button>
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {tabs.map((t, i) => (
          <button
            key={t.tf}
            style={i === activeTab ? tbActive : tb}
            title={`Work on ${t.label}`}
            onClick={() => setActiveTab(i)}
          >{t.label}</button>
        ))}
      </div>
      <button style={tb} title="Next timeframe (→)" onClick={() => cycleTab(1)}>▶</button>

      <SavedChartsStrip />

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
    // Backfill localStorage templates → DB (global) so every page (/live-scan,
    // /database, /dilution) can read them without sign-in. Idempotent: skips
    // names already present in the DB. Presets are skipped (re-seeded everywhere).
    fetch('/api/chart-data/templates').then(r => r.json()).then(d => {
      const dbNames = new Set((d.templates || []).map((t: any) => t.name))
      const local = loadTemplatesFromStorage()
      const pending = local.filter((t: any) => !dbNames.has(t.name) && !String(t.id).startsWith('preset_'))
      Promise.all(pending.map((t: any) =>
        fetch('/api/chart-data/templates', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: t.name, payload: t, global: true }),
        })
      ))
    }).catch(() => {})
  }, [open])

  const handleSave = () => {
    const name = prompt('Template name:')
    if (!name) return
    const { saveCurrentAsTemplate } = require('@/lib/charts/applyTemplate')
    const { loadTemplatesFromStorage } = require('@/lib/charts/templates')
    saveCurrentAsTemplate(name)
    const updated = loadTemplatesFromStorage()
    setTemplates(updated)
    // Persist to DB (global) — single source of truth shared by every page.
    const saved = updated.find((t: any) => t.name === name)
    if (saved) {
      fetch('/api/chart-data/templates', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, payload: saved, global: true }),
      }).catch(() => {})
    }
  }

  const handleApply = (idx: number) => {
    if (!templates[idx]) return
    const { applyTemplate } = require('@/lib/charts/applyTemplate')
    applyTemplate(templates[idx])
    setOpen(false)
  }

  const handleDelete = (idx: number) => {
    const tpl = templates[idx]
    const { deleteTemplate, loadTemplatesFromStorage } = require('@/lib/charts/templates')
    deleteTemplate(idx)
    setTemplates(loadTemplatesFromStorage())
    if (tpl?.id && !String(tpl.id).startsWith('preset_')) {
      fetch(`/api/chart-data/templates?id=${encodeURIComponent(tpl.id)}`, { method: 'DELETE' }).catch(() => {})
    }
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
   Saved Charts Strip — inline hot buttons (separate from the dropdown).
   Sits LEFT in the top bar. One click = load a full chart snapshot
   (symbol + timeframe + indicators + params). Saves the current chart
   as a new hot button via 💾. Shares the same template store as the dropdown.
   ═══════════════════════════════════════════════════════════════ */
function SavedChartsStrip() {
  const [charts, setCharts] = useState<any[]>([])

  useEffect(() => {
    const { loadSavedCharts } = require('@/lib/charts/savedCharts')
    setCharts(loadSavedCharts())
  }, [])

  const handleApply = (idx: number) => {
    if (!charts[idx]) return
    const { applyTemplate } = require('@/lib/charts/applyTemplate')
    applyTemplate(charts[idx])
  }

  const handleSave = () => {
    const name = prompt('Save current chart as — name:')
    if (!name) return
    const { saveCurrentAsSavedChart, loadSavedCharts } = require('@/lib/charts/savedCharts')
    saveCurrentAsSavedChart(name)
    setCharts(loadSavedCharts())
  }

  const handleDelete = (idx: number) => {
    const { deleteSavedChart, loadSavedCharts } = require('@/lib/charts/savedCharts')
    deleteSavedChart(idx)
    setCharts(loadSavedCharts())
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {charts.map((c, i) => (
        <div key={c.id || i} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            className="tool-btn"
            style={{ ...tb, padding: '0 7px', color: '#fbbf24' }}
            onClick={() => handleApply(i)}
            title={`Load "${c.name}" (${c.symbol || '?'} ${c.tf || '?'})`}
          >★ {c.name}</button>
          <button
            style={{ background: 'none', border: 'none', color: '#ff3d57', cursor: 'pointer', fontSize: 9, padding: '0 1px' }}
            onClick={() => handleDelete(i)}
            title={`Delete "${c.name}"`}
          >✕</button>
        </div>
      ))}
      <button className="tool-btn" style={{ ...tb, color: GOLD, padding: '0 6px' }} onClick={handleSave} title="Save current chart as a snapshot (symbol + timeframe + indicators)">💾</button>
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
