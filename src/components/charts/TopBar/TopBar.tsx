'use client'

import { useState, useCallback, useEffect } from 'react'
import { useUIStore, useChartStore, useDrawingStore } from '@/stores/charts'
import { ReactChartPanel } from '@/components/charts/ChartCanvas/ReactChartPanel'

/**
 * TopBar — the main toolbar at the top of the charts app.
 * Extracted from charts-terminal.html lines 651-736.
 * Phase 3: Theme toggle uses Zustand. Other buttons still call global functions.
 */

export function TopBar() {
  const [symInput, setSymInput] = useState('AAPL')

  // Zustand-driven state
  const chartSymbol = useChartStore((s) => s.symbol)
  const setChartSymbol = useChartStore((s) => s.setSymbol)
  const activeTool = useDrawingStore((s) => s.activeTool)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
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

  const handleLoadSymbol = useCallback(() => {
    const sym = symInput.trim().toUpperCase()
    if (!sym) return
    setChartSymbol(sym)
    // Bridge to legacy engine
    ;(window as any).symbol = sym
    ;(window as any).loadChart?.(sym)
  }, [symInput, setChartSymbol])

  return (
    <div id="topbar">
      <span id="logo">TRADERRA</span>
      <div className="sep" />
      <SidebarToggleButton />
      <input
        id="symbol-input"
        type="text"
        value={symInput}
        placeholder="TICKER"
        onChange={(e) => setSymInput(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleLoadSymbol()}
      />
      <button className="tbtn" id="load-btn" onClick={handleLoadSymbol}>▶ LOAD</button>
      <button className={`tbtn${liveMode ? ' active' : ''}`} id="live-btn" onClick={() => setLiveMode(!liveMode)}>⬤ LIVE</button>
      <div id="live-indicator">
        <div id="live-dot" />
        <span id="live-label">LIVE</span>
      </div>
      <div className="sep" />

      {/* Draw dropdown */}
      <DrawMenu />
      {/* Trade dropdown */}
      <TradeMenu />

      <div className="sep" />

      <div className="tbtn-row">
        <button className="tbtn" id="toggle-bars-btn" onClick={() => useUIStore.getState().setBarsVisible(!useUIStore.getState().barsVisible)}>≡ BARS</button>
        <button className={`tbtn${showPriceLine ? '' : ' off'}`} id="price-line-btn" style={{ borderColor: showPriceLine ? '#26a69a' : '#4a5580', color: showPriceLine ? '#26a69a' : '#4a5580', textDecoration: showPriceLine ? 'none' : 'line-through' }} onClick={() => setShowPriceLine(!showPriceLine)}>— LINE</button>
        <button className={`tbtn${useAdjusted ? '' : ' unadj'}`} id="adj-btn" style={{ borderColor: useAdjusted ? '#f59e0b' : '#4a5580', color: useAdjusted ? '#f59e0b' : '#4a5580', textDecoration: useAdjusted ? 'none' : 'line-through' }} onClick={() => setUseAdjusted(!useAdjusted)}>ADJ</button>
        <button className={`tbtn${cleanPrints ? ' on' : ''}`} id="clean-btn" style={{ borderColor: '#e879f9', color: '#e879f9', textDecoration: cleanPrints ? 'none' : 'line-through' }} onClick={() => setCleanPrints(!cleanPrints)}>CLN</button>
        {[1, 2, 4].map(n => (
          <button key={n} className={`tbtn${activeLayout === n ? ' active' : ''}`} id={`ly${n}`} style={{ fontWeight: 900 }} onClick={() => setActiveLayout(n)}>{n}</button>
        ))}
        <button className="tbtn" id="bt-btn" style={{ borderColor: '#f59e0b!important', color: '#f59e0b!important' }} onClick={() => setSidebarTab('bt')}>⏱ BT</button>
        <button className="tbtn" id="scan-btn" style={{ borderColor: '#4ade80!important', color: '#4ade80!important' }} onClick={() => setSidebarTab('scan')}>📡 SCAN</button>
        <button className="tbtn" id="vault-btn" style={{ borderColor: '#a78bfa!important', color: '#a78bfa!important' }} onClick={() => setSidebarTab('vault')}>📦 VAULT</button>
        <button className="tbtn" id="settings-btn" style={{ borderColor: '#D4AF37!important', color: '#D4AF37!important' }} onClick={() => setSidebarTab('look')}>⚙ LOOK</button>
        <button className="tbtn" id="tools-btn" style={{ borderColor: '#D4AF37!important', color: '#D4AF37!important' }} onClick={() => setSidebarTab('tools')}>🔧 TOOLS</button>
        <button className="tbtn" id="input-settings-btn" style={{ borderColor: '#22d3ee!important', color: '#22d3ee!important' }} onClick={() => setSidebarTab('settings')}>⚙ SET</button>
        <div id="ind-btns-container" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} />
        <div id="hot-btns-container" style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }} />
        <button
          className="tbtn"
          id="add-ind-btn"
          style={{ borderColor: '#3a4a68', color: '#3a4a68' }}
          onClick={() => (window as any).openIndBtnPopup?.()}
          title="Add indicator button"
        >
          ＋
        </button>
        <TemplateDropdown />
        <ThemeToggleButton />
        <button
          className="tbtn"
          id="reload-chart-btn"
          style={{ borderColor: '#22d3ee', color: '#22d3ee' }}
          onClick={() => (window as any).renderAll?.()}
          title="Reload chart"
        >
          ⟳ RELOAD
        </button>
        <ReactPanelToggle />
      </div>
      <div id="ticker-info">
        <span id="ti-sym" style={{ color: '#dde3f0', fontWeight: 700, fontSize: 14 }} />
        <span id="ti-price" style={{ fontSize: 13 }} />
        <span id="ti-chg" style={{ fontSize: 12 }} />
      </div>
    </div>
  )
}

function DrawMenu() {
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const bridgeTool = (tool: string) => {
    setActiveTool(tool)
    ;(window as any).setActiveTool?.(tool)
  }
  return (
    <div className="dropdown-group">
      <button className="tbtn dropdown-trigger" id="draw-menu-btn">✏ DRAW ▾</button>
      <div className="dropdown-content" id="draw-menu">
        <button className="tool-btn" data-tool="trendline" onClick={() => bridgeTool('trendline')}>✏ Line</button>
        <button className="tool-btn" data-tool="fib_ret" style={{ borderColor: '#a78bfa', color: '#a78bfa' }} onClick={() => bridgeTool('fib_ret')}>〰 Fib Retracement</button>
        <button className="tool-btn" data-tool="box_orange" onClick={() => bridgeTool('box_orange')}>▣ Orange Box</button>
        <button className="tool-btn" data-tool="box_yellow" onClick={() => bridgeTool('box_yellow')}>▣ Yellow Box</button>
        <button className="tool-btn" data-tool="text_orange" onClick={() => bridgeTool('text_orange')}>T Orange Text</button>
        <button className="tool-btn" data-tool="text_yellow" onClick={() => bridgeTool('text_yellow')}>T Yellow Text</button>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <span style={{ fontSize: 8, color: '#3a4560', padding: '2px 6px' }}>HIGHLIGHT:</span>
        <button className="tool-btn" data-tool="hl_cyan" style={{ borderColor: '#22d3ee', color: '#22d3ee' }} onClick={() => bridgeTool('hl_cyan')}>■ Cyan</button>
        <button className="tool-btn" data-tool="hl_magenta" style={{ borderColor: '#e879f9', color: '#e879f9' }} onClick={() => bridgeTool('hl_magenta')}>■ Magenta</button>
        <button className="tool-btn" data-tool="hl_green" style={{ borderColor: '#4ade80', color: '#4ade80' }} onClick={() => bridgeTool('hl_green')}>■ Green</button>
        <button className="tool-btn" data-tool="hl_white" style={{ borderColor: '#cbd5e1', color: '#cbd5e1' }} onClick={() => bridgeTool('hl_white')}>■ White</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px' }}>
          <span style={{ fontSize: 8, color: '#3a4560' }}>OP:</span>
          <input id="hl-opacity" type="range" min={5} max={80} defaultValue={35} style={{ width: 60, height: 14, accentColor: '#22d3ee', cursor: 'pointer' }} />
          <span id="hl-opacity-val" style={{ fontSize: 11, color: '#4a6080' }}>15%</span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <button className="tool-btn" data-tool="edit" style={{ borderColor: '#fbbf24', color: '#fbbf24' }} onClick={() => bridgeTool('edit')}>✎ Edit</button>
        <button className="tool-btn" data-tool="del" style={{ borderColor: '#ff3d57', color: '#ff3d57' }} onClick={() => bridgeTool('del')}>🗑 Delete</button>
        <button className="tbtn" id="clr-btn" style={{ margin: '2px 4px' }}>✕ Clear All</button>
      </div>
    </div>
  )
}

function TradeMenu() {
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)
  const bridgeTool = (tool: string) => {
    setActiveTool(tool)
    ;(window as any).setActiveTool?.(tool)
  }
  return (
    <div className="dropdown-group">
      <button className="tbtn dropdown-trigger" id="trade-menu-btn" style={{ borderColor: '#ff9800', color: '#ff9800' }}>⇅ TRADE ▾</button>
      <div className="dropdown-content" id="trade-menu">
        <button className="tool-btn" data-tool="entry_arrow" style={{ borderColor: '#ff9800', color: '#ff9800' }} onClick={() => bridgeTool('entry_arrow')}>▲ Long Entry</button>
        <button className="tool-btn" data-tool="exit_arrow" style={{ borderColor: '#40c4ff', color: '#40c4ff' }} onClick={() => bridgeTool('exit_arrow')}>▼ Long Exit</button>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <button className="tool-btn" data-tool="short_arrow" style={{ borderColor: '#ff5252', color: '#ff5252' }} onClick={() => bridgeTool('short_arrow')}>▼ Short Entry</button>
        <button className="tool-btn" data-tool="cover_arrow" style={{ borderColor: '#00e676', color: '#00e676' }} onClick={() => bridgeTool('cover_arrow')}>▲ Cover</button>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <button className="tool-btn" data-tool="stop_line" style={{ borderColor: '#facc15', color: '#facc15' }} onClick={() => bridgeTool('stop_line')}>— Stop</button>
        <button className="tool-btn" data-tool="trail_stop" style={{ borderColor: '#38bdf8', color: '#38bdf8' }} onClick={() => bridgeTool('trail_stop')}>— Trail Stop</button>
      </div>
    </div>
  )
}

function TemplateDropdown() {
  return (
    <div className="dropdown-group">
      <button className="tbtn dropdown-trigger" id="tpl-menu-btn" style={{ borderColor: '#D4AF37', color: '#D4AF37' }}>📋 TPL ▾</button>
      <div className="dropdown-content" id="tpl-dropdown" style={{ minWidth: 180 }}>
        <div style={{ padding: '4px 10px', fontSize: 11, color: '#4a6080', fontWeight: 700 }}>CHART TEMPLATES</div>
        <div id="tpl-list" />
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <div className="tool-btn" id="tpl-update-btn" style={{ color: '#22d3ee', display: 'none' }}>🔄 Update Current Template</div>
        <div className="tool-btn" style={{ color: '#D4AF37' }}>💾 Save Current as Template</div>
      </div>
    </div>
  )
}

function ThemeToggleButton() {
  const theme = useUIStore((s) => s.theme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  return (
    <button
      className="tbtn"
      id="theme-toggle-btn"
      style={{ borderColor: '#5a6a88', color: '#5a6a88' }}
      onClick={toggleTheme}
    >
      {theme === 'dark' ? '🌙' : '☀'}
    </button>
  )
}

function SidebarToggleButton() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  return (
    <button
      className="tbtn"
      id="wl-toggle"
      style={{ borderColor: '#6878a8!important', color: '#6878a8!important' }}
      onClick={() => setSidebarOpen(!sidebarOpen)}
    >
      📋
    </button>
  )
}

function ReactPanelToggle() {
  const reactPanel = useUIStore((s) => s.reactPanel)
  const setReactPanel = useUIStore((s) => s.setReactPanel)
  return (
    <>
      <button
        className="tbtn"
        id="react-panel-btn"
        style={{
          borderColor: reactPanel ? '#26a69a' : '#3a4a68',
          color: reactPanel ? '#26a69a' : '#3a4a68',
          fontWeight: 900,
          textShadow: reactPanel ? '0 0 8px #26a69a' : 'none',
        }}
        onClick={() => setReactPanel(!reactPanel)}
        title="Toggle React canvas panel (Phase 3)"
      >
        ⚛ REACT
      </button>
      {reactPanel && <ReactPanelOverlay />}
    </>
  )
}

function ReactPanelOverlay() {
  // Fixed-position overlay matching the main chart area dimensions
  // This covers the legacy #grid area with a React-rendered panel
  const [mounted, setMounted] = useState(false)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 500)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) return null

  return (
    <div
      id="react-panel-overlay"
      style={{
        position: 'fixed',
        top: 50,        // topbar height
        left: 38,       // left toolbar width
        right: sidebarOpen ? 350 : 0,
        bottom: 0,
        zIndex: 50,
        display: 'flex',
        background: '#0c0e14',
      }}
    >
      <ReactChartPanel panelIdx={0} />
    </div>
  )
}
