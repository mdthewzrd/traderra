'use client'

import { useUIStore } from '@/stores/charts'

/**
 * TopBar — the main toolbar at the top of the charts app.
 * Extracted from charts-terminal.html lines 651-736.
 * Phase 3: Theme toggle uses Zustand. Other buttons still call global functions.
 */

export function TopBar() {
  return (
    <div id="topbar">
      <span id="logo">TRADERRA</span>
      <div className="sep" />
      <SidebarToggleButton />
      <input id="symbol-input" type="text" defaultValue="AAPL" placeholder="TICKER" />
      <button className="tbtn" id="load-btn">▶ LOAD</button>
      <button className="tbtn" id="live-btn">⬤ LIVE</button>
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
        <button className="tbtn" id="toggle-bars-btn">≡ BARS</button>
        <button className="tbtn" id="price-line-btn" style={{ borderColor: '#26a69a', color: '#26a69a' }}>— LINE</button>
        <button className="tbtn" id="adj-btn" style={{ borderColor: '#f59e0b', color: '#f59e0b' }}>ADJ</button>
        <button className="tbtn on" id="clean-btn" style={{ borderColor: '#e879f9', color: '#e879f9', textDecoration: 'none' }}>CLN</button>
        <button className="tbtn active" id="ly1" style={{ fontWeight: 900 }}>1</button>
        <button className="tbtn" id="ly2" style={{ fontWeight: 900 }}>2</button>
        <button className="tbtn" id="ly4" style={{ fontWeight: 900 }}>4</button>
        <button className="tbtn" id="bt-btn" style={{ borderColor: '#f59e0b!important', color: '#f59e0b!important' }}>⏱ BT</button>
        <button className="tbtn" id="scan-btn" style={{ borderColor: '#4ade80!important', color: '#4ade80!important' }}>📡 SCAN</button>
        <button className="tbtn" id="vault-btn" style={{ borderColor: '#a78bfa!important', color: '#a78bfa!important' }}>📦 VAULT</button>
        <button className="tbtn" id="settings-btn" style={{ borderColor: '#D4AF37!important', color: '#D4AF37!important' }}>⚙ LOOK</button>
        <button className="tbtn" id="tools-btn" style={{ borderColor: '#D4AF37!important', color: '#D4AF37!important' }} onClick={() => (window as any).sbOpen?.('tools')}>🔧 TOOLS</button>
        <button className="tbtn" id="input-settings-btn" style={{ borderColor: '#22d3ee!important', color: '#22d3ee!important' }}>⚙ SET</button>
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
  return (
    <div className="dropdown-group">
      <button className="tbtn dropdown-trigger" id="draw-menu-btn">✏ DRAW ▾</button>
      <div className="dropdown-content" id="draw-menu">
        <button className="tool-btn" data-tool="trendline">✏ Line</button>
        <button className="tool-btn" data-tool="fib_ret" style={{ borderColor: '#a78bfa', color: '#a78bfa' }}>〰 Fib Retracement</button>
        <button className="tool-btn" data-tool="box_orange">▣ Orange Box</button>
        <button className="tool-btn" data-tool="box_yellow">▣ Yellow Box</button>
        <button className="tool-btn" data-tool="text_orange">T Orange Text</button>
        <button className="tool-btn" data-tool="text_yellow">T Yellow Text</button>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <span style={{ fontSize: 8, color: '#3a4560', padding: '2px 6px' }}>HIGHLIGHT:</span>
        <button className="tool-btn" data-tool="hl_cyan" style={{ borderColor: '#22d3ee', color: '#22d3ee' }}>■ Cyan</button>
        <button className="tool-btn" data-tool="hl_magenta" style={{ borderColor: '#e879f9', color: '#e879f9' }}>■ Magenta</button>
        <button className="tool-btn" data-tool="hl_green" style={{ borderColor: '#4ade80', color: '#4ade80' }}>■ Green</button>
        <button className="tool-btn" data-tool="hl_white" style={{ borderColor: '#cbd5e1', color: '#cbd5e1' }}>■ White</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px' }}>
          <span style={{ fontSize: 8, color: '#3a4560' }}>OP:</span>
          <input id="hl-opacity" type="range" min={5} max={80} defaultValue={35} style={{ width: 60, height: 14, accentColor: '#22d3ee', cursor: 'pointer' }} />
          <span id="hl-opacity-val" style={{ fontSize: 11, color: '#4a6080' }}>15%</span>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <button className="tool-btn" data-tool="edit" style={{ borderColor: '#fbbf24', color: '#fbbf24' }}>✎ Edit</button>
        <button className="tool-btn" data-tool="del" style={{ borderColor: '#ff3d57', color: '#ff3d57' }}>🗑 Delete</button>
        <button className="tbtn" id="clr-btn" style={{ margin: '2px 4px' }}>✕ Clear All</button>
      </div>
    </div>
  )
}

function TradeMenu() {
  return (
    <div className="dropdown-group">
      <button className="tbtn dropdown-trigger" id="trade-menu-btn" style={{ borderColor: '#ff9800', color: '#ff9800' }}>⇅ TRADE ▾</button>
      <div className="dropdown-content" id="trade-menu">
        <button className="tool-btn" data-tool="entry_arrow" style={{ borderColor: '#ff9800', color: '#ff9800' }}>▲ Long Entry</button>
        <button className="tool-btn" data-tool="exit_arrow" style={{ borderColor: '#40c4ff', color: '#40c4ff' }}>▼ Long Exit</button>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <button className="tool-btn" data-tool="short_arrow" style={{ borderColor: '#ff5252', color: '#ff5252' }}>▼ Short Entry</button>
        <button className="tool-btn" data-tool="cover_arrow" style={{ borderColor: '#00e676', color: '#00e676' }}>▲ Cover</button>
        <hr style={{ border: 'none', borderTop: '1px solid #2a3050', margin: '2px 0' }} />
        <button className="tool-btn" data-tool="stop_line" style={{ borderColor: '#facc15', color: '#facc15' }}>— Stop</button>
        <button className="tool-btn" data-tool="trail_stop" style={{ borderColor: '#38bdf8', color: '#38bdf8' }}>— Trail Stop</button>
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
