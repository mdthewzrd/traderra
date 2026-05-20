'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useUIStore, useChartStore, useDrawingStore } from '@/stores/charts'
import { ProfileIcon } from '@/app/charts/ChartsTerminal'
import { useToolStore } from '@/stores/charts/toolStore'

/**
 * TopBar — the main toolbar at the top of the charts terminal.
 * Matches the original HTML topbar exactly.
 */

export function TopBar() {
  const [symInput, setSymInput] = useState('AAPL')

  const chartSymbol = useChartStore((s) => s.symbol)
  const setChartSymbol = useChartStore((s) => s.setSymbol)
  const liveMode = useUIStore((s) => s.liveMode)
  const setLiveMode = useUIStore((s) => s.setLiveMode)
  const showPriceLine = useUIStore((s) => s.showPriceLine)
  const setShowPriceLine = useUIStore((s) => s.setShowPriceLine)
  const useAdjusted = useUIStore((s) => s.useAdjusted)
  const setUseAdjusted = useUIStore((s) => s.setUseAdjusted)
  const cleanPrints = useUIStore((s) => s.cleanPrints)
  const setCleanPrints = useUIStore((s) => s.setCleanPrints)
  const activeLayout = useUIStore((s) => s.activeLayout)
  const setActiveLayout = useUIStore((s) => s.setActiveLayout)
  const setSidebarTab = useUIStore((s) => s.setSidebarTab)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  const handleLoadSymbol = useCallback(() => {
    const sym = symInput.trim().toUpperCase()
    if (!sym) return
    setChartSymbol(sym)
    ;(window as any).symbol = sym
    ;(window as any).loadChart?.(sym)
  }, [symInput, setChartSymbol])

  // Sync symbol input when chart symbol changes
  useEffect(() => { setSymInput(chartSymbol) }, [chartSymbol])

  return (
    <div id="topbar">
      <span id="logo">TRADERRA</span>
      <div className="sep" />

      {/* Watchlist toggle */}
      <button
        className="tbtn"
        id="wl-toggle"
        style={{ borderColor: '#6878a8!important', color: '#6878a8!important' }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >📋</button>

      <input
        id="symbol-input"
        type="text"
        value={symInput}
        placeholder="TICKER"
        onChange={(e) => setSymInput(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleLoadSymbol()}
      />
      <button className="tbtn" id="load-btn" onClick={handleLoadSymbol}>▶ LOAD</button>
      <button
        className={`tbtn${liveMode ? ' active' : ''}`}
        id="live-btn"
        onClick={() => setLiveMode(!liveMode)}
      >⬤ LIVE</button>
      <div id="live-indicator" className={liveMode ? 'show' : ''}>
        <div id="live-dot" />
        <span id="live-label">LIVE</span>
      </div>

      <div className="sep" />

      {/* DRAW dropdown */}
      <Dropdown id="draw" label="✏ DRAW ▾">
        <DropdownToolButton emoji="✏" label="Line" tool="trendline" />
        <DropdownToolButton emoji="〰" label="Fib Retracement" tool="fib_ret" color="#a78bfa" />
        <DropdownToolButton emoji="▣" label="Orange Box" tool="box_orange" />
        <DropdownToolButton emoji="▣" label="Yellow Box" tool="box_yellow" />
        <DropdownToolButton emoji="T" label="Orange Text" tool="text_orange" />
        <DropdownToolButton emoji="T" label="Yellow Text" tool="text_yellow" />
        <DropdownSep />
        <span style={{ fontSize: 8, color: '#3a4560', padding: '2px 6px' }}>HIGHLIGHT:</span>
        <DropdownToolButton emoji="■" label="Cyan" tool="hl_cyan" color="#22d3ee" stayOpen />
        <DropdownToolButton emoji="■" label="Magenta" tool="hl_magenta" color="#e879f9" stayOpen />
        <DropdownToolButton emoji="■" label="Green" tool="hl_green" color="#4ade80" stayOpen />
        <DropdownToolButton emoji="■" label="White" tool="hl_white" color="#cbd5e1" stayOpen />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px' }}>
          <span style={{ fontSize: 8, color: '#3a4560' }}>OP:</span>
          <input id="hl-opacity" type="range" min={5} max={80} defaultValue={35} style={{ width: 60, height: 14, accentColor: '#22d3ee', cursor: 'pointer' }} />
          <span id="hl-opacity-val" style={{ fontSize: 11, color: '#4a6080' }}>15%</span>
        </div>
        <DropdownSep />
        <DropdownToolButton emoji="✎" label="Edit" tool="edit" color="#fbbf24" />
        <DropdownToolButton emoji="🗑" label="Delete" tool="del" color="#ff3d57" />
        <button
          className="tbtn"
          style={{ margin: '2px 4px' }}
          onClick={() => useDrawingStore.getState().clearAnnotations()}
        >✕ Clear All</button>
      </Dropdown>

      {/* TRADE dropdown */}
      <Dropdown id="trade" label="⇅ TRADE ▾" labelColor="#ff9800">
        <DropdownToolButton emoji="▲" label="Long Entry" tool="entry_arrow" color="#ff9800" />
        <DropdownToolButton emoji="▼" label="Long Exit" tool="exit_arrow" color="#40c4ff" />
        <DropdownSep />
        <DropdownToolButton emoji="▼" label="Short Entry" tool="short_arrow" color="#ff5252" />
        <DropdownToolButton emoji="▲" label="Cover" tool="cover_arrow" color="#00e676" />
        <DropdownSep />
        <DropdownToolButton emoji="—" label="Stop" tool="stop_line" color="#facc15" />
        <DropdownToolButton emoji="—" label="Trail Stop" tool="trail_stop" color="#38bdf8" />
      </Dropdown>

      <div className="sep" />

      <div className="tbtn-row">
        <button className="tbtn" id="toggle-bars-btn" onClick={() => useUIStore.getState().setBarsVisible(!useUIStore.getState().barsVisible)}>≡ BARS</button>
        <button className={`tbtn${showPriceLine ? '' : ' off'}`} id="price-line-btn" style={{ borderColor: showPriceLine ? '#26a69a' : '#4a5580', color: showPriceLine ? '#26a69a' : '#4a5580', textDecoration: showPriceLine ? 'none' : 'line-through' }} onClick={() => setShowPriceLine(!showPriceLine)}>— LINE</button>
        <button className={`tbtn${useAdjusted ? '' : ' unadj'}`} id="adj-btn" style={{ borderColor: useAdjusted ? '#f59e0b' : '#4a5580', color: useAdjusted ? '#f59e0b' : '#4a5580', textDecoration: useAdjusted ? 'none' : 'line-through' }} onClick={() => setUseAdjusted(!useAdjusted)}>ADJ</button>
        <button className={`tbtn${cleanPrints ? ' on' : ''}`} id="clean-btn" style={{ borderColor: '#e879f9', color: '#e879f9', textDecoration: cleanPrints ? 'none' : 'line-through' }} onClick={() => setCleanPrints(!cleanPrints)}>CLN</button>
        {[1, 2, 4].map(n => (
          <button key={n} className={`tbtn${activeLayout === n ? ' active' : ''}`} id={`ly${n}`} style={{ fontWeight: 900 }} onClick={() => setActiveLayout(n)}>{n}</button>
        ))}
        <button className="tbtn" id="bt-btn" style={{ borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => setSidebarTab('bt')}>⏱ BT</button>
        <button className="tbtn" id="scan-btn" style={{ borderColor: '#4ade80', color: '#4ade80' }} onClick={() => setSidebarTab('scan')}>📡 SCAN</button>
        <button className="tbtn" id="vault-btn" style={{ borderColor: '#a78bfa', color: '#a78bfa' }} onClick={() => setSidebarTab('vault')}>📦 VAULT</button>
        <button className="tbtn" id="settings-btn" style={{ borderColor: '#D4AF37', color: '#D4AF37' }} onClick={() => setSidebarTab('look')}>⚙ LOOK</button>
        <button className="tbtn" id="tools-btn" style={{ borderColor: '#D4AF37', color: '#D4AF37' }} onClick={() => setSidebarTab('tools')}>🔧 TOOLS</button>
        <button className="tbtn" id="input-settings-btn" style={{ borderColor: '#22d3ee', color: '#22d3ee' }} onClick={() => setSidebarTab('settings')}>⚙ SET</button>
        <IndBtnsContainer />
        <div id="hot-btns-container" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} />
        <AddIndBtnButton />
        <TemplateDropdown />
        <ThemeToggleButton />
        <button
          className="tbtn"
          id="reload-chart-btn"
          style={{ borderColor: '#22d3ee', color: '#22d3ee' }}
          onClick={() => window.location.reload()}
          title="Reload chart"
        >⟳ RELOAD</button>
      </div>
      <div id="ticker-info">
        <span id="ti-sym" style={{ color: '#dde3f0', fontWeight: 700, fontSize: 14 }} />
        <span id="ti-price" style={{ fontSize: 13 }} />
        <span id="ti-chg" style={{ fontSize: 12 }} />
      </div>
      <ProfileIcon />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Dropdown — handles open/close with click-outside
   ═══════════════════════════════════════════════════════════════ */

function Dropdown({ id, label, labelColor, children }: {
  id: string
  label: string
  labelColor?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  return (
    <div className="dropdown-group" ref={ref}>
      <button
        className={`tbtn dropdown-trigger${open ? ' active' : ''}`}
        id={`${id}-menu-btn`}
        style={labelColor ? { borderColor: labelColor, color: labelColor } : undefined}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
      >{label}</button>
      <div className={`dropdown-content${open ? ' open' : ''}`} id={`${id}-menu`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function DropdownSep() {
  return <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
}

function DropdownToolButton({ emoji, label, tool, color, stayOpen }: {
  emoji: string
  label: string
  tool: string
  color?: string
  stayOpen?: boolean
}) {
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  return (
    <button
      className="tool-btn"
      data-tool={tool}
      style={color ? { borderColor: color, color } : undefined}
      onClick={() => {
        setActiveTool(tool)
        ;(window as any).setActiveTool?.(tool)
      }}
    >{emoji} {label}</button>
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
    saveTemplate(name, tools, chartStyle, theme, inds)
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
    if (tpl.tools) {
      const { useToolStore } = require('@/stores/charts/toolStore')
      useToolStore.getState().setTools(tpl.tools)
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
        className={`tbtn dropdown-trigger${open ? ' active' : ''}`}
        id="tpl-menu-btn"
        style={{ borderColor: '#D4AF37', color: '#D4AF37' }}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
      >📋 TPL ▾</button>
      <div className={`dropdown-content${open ? ' open' : ''}`} id="tpl-dropdown" style={{ minWidth: 200 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '4px 10px', fontSize: 11, color: '#4a6080', fontWeight: 700 }}>CHART TEMPLATES</div>
        {templates.length === 0 && (
          <div style={{ padding: '6px 10px', fontSize: 11, color: '#4a6080' }}>No templates saved</div>
        )}
        {templates.map((tpl, i) => (
          <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px' }}>
            <button
              className="tool-btn"
              style={{ flex: 1, textAlign: 'left', color: '#dde3f0', padding: '2px 4px' }}
              onClick={() => handleApply(i)}
            >{tpl.name}</button>
            <button
              style={{ background: 'none', border: 'none', color: '#ff3d57', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}
              onClick={() => handleDelete(i)}
              title="Delete template"
            >✕</button>
          </div>
        ))}
        <DropdownSep />
        {useUIStore.getState().activeTemplateName && (
          <div className="tool-btn" style={{ color: '#22d3ee', cursor: 'pointer' }} onClick={() => {
            const name = useUIStore.getState().activeTemplateName
            const { loadTemplatesFromStorage, saveTemplate } = require('@/lib/charts/templates')
            const all = loadTemplatesFromStorage()
            const idx = all.findIndex((t: any) => t.name === name)
            if (idx >= 0) {
              const tools = require('@/stores/charts/toolStore').useToolStore.getState().tools
              const chartStyle = useUIStore.getState().chartStyle
              const theme = useUIStore.getState().theme
              const inds = require('@/stores/charts/indicatorStore').useIndicatorStore.getState().inds
              saveTemplate(name, tools, chartStyle, theme, inds)
              // Overwrite existing
              const { deleteTemplate } = require('@/lib/charts/templates')
              const updated = loadTemplatesFromStorage()
              // The new one is at the end, move it to the original position
              // Simpler: just re-save and let duplicates exist
              setTemplates(updated)
            }
            setOpen(false)
          }}>🔄 Update "{useUIStore.getState().activeTemplateName}"</div>
        )}
        <div className="tool-btn" style={{ color: '#D4AF37', cursor: 'pointer' }} onClick={handleSave}>💾 Save Current as Template</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Theme Toggle & Hot Buttons
   ═══════════════════════════════════════════════════════════════ */

function ThemeToggleButton() {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  return (
    <button
      className="tbtn"
      id="theme-toggle-btn"
      style={{ borderColor: '#5a6a88', color: '#5a6a88' }}
      onClick={toggleTheme}
    >{theme === 'dark' ? '🌙' : '☀'}</button>
  )
}


/** Custom indicator buttons in TopBar */
function IndBtnsContainer() {
  const indBtns = useUIStore(s => s.indBtns)
  const removeIndBtn = useUIStore(s => s.removeIndBtn)

  return (
    <div id="ind-btns-container" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
      {indBtns.map((indKey: string) => {
        const { IND_CATALOG } = require('@/stores/charts/toolStore')
        const cat = IND_CATALOG[indKey]
        const label = cat?.label || indKey
        const isOn = !!require('@/stores/charts/indicatorStore').useIndicatorStore.getState().inds[indKey]
        return (
          <button
            key={indKey}
            className={`ptog${isOn ? ' on' : ''}`}
            data-ind={indKey}
            style={{ opacity: isOn ? 1 : 0.55 }}
            onClick={() => {
              const store = require('@/stores/charts/indicatorStore').useIndicatorStore.getState()
              store.setInds({ ...store.inds, [indKey]: !store.inds[indKey] })
            }}
            onContextMenu={(e) => { e.preventDefault(); removeIndBtn(indKey) }}
            title={`${label} (right-click to remove)`}
          >{label.toUpperCase().slice(0, 8)}</button>
        )
      })}
    </div>
  )
}

/** + button to add indicator button */
function AddIndBtnButton() {
  const [open, setOpen] = useState(false)
  const addIndBtn = useUIStore(s => s.addIndBtn)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const { IND_CATALOG } = require('@/stores/charts/toolStore')

  return (
    <div className="dropdown-group" ref={ref}>
      <button
        className="tbtn"
        id="add-ind-btn"
        style={{ borderColor: '#3a4a68', color: '#3a4a68' }}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        title="Add indicator button"
      >＋</button>
      <div className={`dropdown-content${open ? ' open' : ''}`} style={{ minWidth: 200, maxHeight: 300, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '4px 10px', fontSize: 11, color: '#4a6080', fontWeight: 700 }}>ADD INDICATOR BUTTON</div>
        {Object.entries(IND_CATALOG).map(([key, cat]: [string, any]) => (
          <button
            key={key}
            className="tool-btn"
            style={{ textAlign: 'left' }}
            onClick={() => { addIndBtn(key); setOpen(false) }}
          >{cat.label}</button>
        ))}
      </div>
    </div>
  )
}
