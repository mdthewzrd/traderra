'use client'

import { useEffect, useRef } from 'react'
import '../../styles/charts-terminal.css'

/**
 * Charts Terminal — renders the original HTML body and loads chart engine scripts.
 * Uses the exact HTML from charts-terminal.html to guarantee compatibility.
 */
export default function ChartsTerminal({ userId, userName, userImage }: {
  userId: string
  userName: string
  userImage: string
}) {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    // Set user context globals
    ;(window as any).__CHARTS_USER = { id: userId, name: userName, image: userImage }

    // Fetch auth token for CloudStore
    fetch('/api/auth/token')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) localStorage.setItem('traderra-auth-token', data.token)
      })
      .catch(() => {})
      .then(() => {
        // Load scripts in order — same as static HTML
        const load = (src: string) => new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = src
          s.onload = () => { console.log('[Charts] loaded', src); resolve() }
          s.onerror = () => reject(new Error('Failed: ' + src))
          document.body.appendChild(s)
        })
        return load('/indicators/vault.js')
          .then(() => load('/charts-engine.js'))
          .then(() => load('/charts-engine-footer.js'))
      })
      .then(() => {
        console.log('[Charts] all scripts loaded')
        // Fire user-ready event after scripts load
        window.dispatchEvent(new CustomEvent('charts-user-ready', {
          detail: (window as any).__CHARTS_USER,
        }))
      })
      .catch(err => console.error('[Charts] script load failed:', err))
  }, [userId, userName, userImage])

  // Render the exact HTML body from the original charts-terminal.html
  // This is the HTML between <body> and the first <script> tag
  return (
    <>
      <div id="profile-icon" style={{ position: 'fixed', top: 6, right: 12, zIndex: 9999, cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', background: '#2a3050', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#6a7a98', border: '1px solid #3a4a68', transition: 'all .15s' }} title="Sign in to sync your data">👤</div>
      <div id="topbar">
        <div className="tbtn-row">
          <span id="logo" style={{ fontWeight: 900, fontSize: 13, color: '#D4AF37', letterSpacing: 1, marginRight: 6, cursor: 'pointer' }}>TRADEMAP</span>
          <input id="symbol-input" type="text" defaultValue="AAPL" style={{ background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '3px 8px', width: 72, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }} />
          <button className="tbtn" id="reload-chart-btn" title="Reload chart">↻</button>
          <button className="tbtn" id="adj-btn" title="Toggle adjusted prices">ADJ</button>
          <div id="top-tf-wrap" style={{ display: 'flex', gap: 2 }}>
            <button className="tbtn active" data-tf="5">5m</button>
            <button className="tbtn" data-tf="15">15m</button>
            <button className="tbtn" data-tf="60">1H</button>
            <button className="tbtn" data-tf="D">1D</button>
            <button className="tbtn" data-tf="W">1W</button>
            <button className="tbtn" data-tf="M">1M</button>
          </div>
          <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 3px' }} />
          <div className="tbtn-row" id="ind-btns-container" />
          <button className="tbtn" id="add-ind-btn" title="Add indicator button">+IND</button>
          <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 3px' }} />
          <button className="tbtn" id="tpl-menu-btn" title="Templates">📋</button>
          <button className="tbtn" id="tools-btn" title="Indicator tools">🔧</button>
          <div id="tpl-dropdown" style={{ display: 'none' }}>
            <div style={{ padding: '6px 10px', fontSize: 10, color: '#4a6080', fontWeight: 700, letterSpacing: 1, borderBottom: '1px solid #1e2840' }}>TEMPLATES</div>
            <div id="tpl-list" />
            <div style={{ padding: '4px 10px', borderTop: '1px solid #1e2840' }}>
              <input id="tpl-name-input" type="text" placeholder="Template name…" style={{ width: '100%', background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '3px 6px', fontSize: 11 }} />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button id="tpl-save-btn" style={{ flex: 1, padding: '3px 0', background: '#D4AF37', color: '#000', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>SAVE</button>
                <button id="tpl-update-btn" style={{ flex: 1, padding: '3px 0', background: '#2a3050', color: '#dde3f0', border: 'none', borderRadius: 3, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>UPDATE</button>
              </div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div id="ticker-info">
          <span id="ti-sym">AAPL</span>
          <span id="ti-price" style={{ fontWeight: 700 }} />
          <span id="ti-chg" style={{ fontSize: 11 }} />
        </div>
        <div className="tbtn-row">
          <button className="tbtn" id="settings-btn" title="Chart settings">⚙</button>
          <button className="tbtn" id="vault-btn" title="Vault (saved annotations)">🗄</button>
          <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 3px' }} />
          <button className="tbtn" id="bt-btn" title="Backtest sidebar">⏱</button>
          <button className="tbtn" id="theme-toggle-btn" title="Toggle theme">🌙</button>
          <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 3px' }} />
          <button className="tbtn" id="live-btn" title="Live mode" style={{ position: 'relative' }}>
            <span id="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#3a4a68', display: 'inline-block', marginRight: 3 }} />
            <span id="live-label">LIVE</span>
          </button>
          <div id="live-indicator" style={{ display: 'none', fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: 1 }}>● LIVE</div>
          <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 3px' }} />
          <button className="tbtn" id="fullscreen-btn" title="Fullscreen">⛶</button>
        </div>
      </div>

      <div id="left-toolbar">
        <button className="ltbtn" data-tool="cursor" title="Cursor (C)"><tspan>✥</tspan></button>
        <button className="ltbtn" data-tool="trendline" title="Trendline (T)">╱</button>
        <button className="ltbtn" data-tool="hline" title="Horizontal line (H)">─</button>
        <button className="ltbtn" data-tool="vline" title="Vertical line">│</button>
        <button className="ltbtn" data-tool="ray" title="Ray">╲</button>
        <button className="ltbtn" data-tool="box" title="Rectangle (R)">▭</button>
        <button className="ltbtn" data-tool="highlight" title="Highlight">▮</button>
        <button className="ltbtn" data-tool="callout" title="Callout">💬</button>
        <button className="ltbtn" data-tool="text" title="Text label">T</button>
        <button className="ltbtn" data-tool="note" title="Note">📝</button>
        <button className="ltbtn" data-tool="flag" title="Flag">⚑</button>
        <button className="ltbtn" data-tool="fib" title="Fibonacci retracement">⌀</button>
        <button className="ltbtn" data-tool="position" title="Position marker">💰</button>
        <button className="ltbtn" data-tool="exec" title="Execution arrow">⇅</button>
        <button className="ltbtn" data-tool="stop" title="Stop line">🛑</button>
        <button className="ltbtn" data-tool="pricelabel" title="Price label">$</button>
        <div style={{ height: 1, background: '#2a3050', margin: '3px 5px' }} />
        <button className="ltbtn" id="magnet-btn" title="Magnet snap">🧲</button>
        <button className="ltbtn" id="lock-all-btn" title="Lock all">🔒</button>
        <button className="ltbtn" id="hide-all-btn" title="Hide all">👁</button>
        <button className="ltbtn" id="clean-btn" title="Clear all">🗑</button>
        <div style={{ height: 1, background: '#2a3050', margin: '3px 5px' }} />
        <button className="ltbtn" id="draw-menu-btn" title="Drawing menu">☰</button>
        <div id="draw-menu" style={{ display: 'none' }}>
          <button className="dm-btn" id="stay-draw-btn">Stay in draw mode</button>
          <button className="dm-btn" id="price-line-btn">Price line</button>
        </div>
        <div id="draw-hint" style={{ display: 'none', position: 'absolute', left: 40, top: 0, background: '#1e222d', border: '1px solid #2a3050', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#6a80a0', whiteSpace: 'nowrap', zIndex: 100, pointerEvents: 'none' }} />
      </div>

      <div id="ann-toolbar" style={{ display: 'none', position: 'fixed', zIndex: 900, background: '#1e222d', border: '1px solid #2a3050', borderRadius: 4, padding: '2px 2px 2px 6px', gap: 1, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
        <div id="ann-toolbar-handle" style={{ cursor: 'grab', padding: '0 2px', color: '#4a5a78', fontSize: 12 }}>⠿</div>
        <div style={{ width: 1, height: 16, background: '#2a3050' }} />
        <button className="ann-btn" id="ann-color-btn" title="Color">
          <div id="ann-color-line" style={{ width: 16, height: 3, background: '#D4AF37', borderRadius: 2 }} />
        </button>
        <button className="ann-btn" id="ann-tcolor-btn" title="Text color">
          <span id="ann-tcolor-text" style={{ fontSize: 11, fontWeight: 700 }}>A</span>
        </button>
        <button className="ann-btn" id="ann-weight-btn" title="Line weight">2</button>
        <button className="ann-btn" id="ann-linetype-btn" title="Line type">━</button>
        <button className="ann-btn" id="ann-opacity-btn" title="Opacity">
          <span id="ann-opacity-val" style={{ fontSize: 10 }}>○</span>
        </button>
        <button className="ann-btn" id="ann-vis-btn" title="Toggle visibility">
          <span id="ann-vis-icon">👁</span>
        </button>
        <button className="ann-btn" id="ann-lock-btn" title="Lock">
          <span id="ann-lock-icon">🔓</span>
        </button>
        <button className="ann-btn" id="ann-more-text" title="Edit text">✏</button>
        <div style={{ width: 1, height: 16, background: '#2a3050' }} />
        <button className="ann-btn ann-del-btn" id="ann-dd-more" title="More">⋯</button>
        <div id="ann-dd-color" className="ann-dropdown" style={{ display: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {['#D4AF37','#ef4444','#3b82f6','#4ade80','#a855f7','#f97316','#ec4899','#06b6d4','#eab308','#ffffff'].map(c => (
                <button key={c} className="ann-swatch" data-color={c} style={{ width: 18, height: 18, borderRadius: 3, background: c, border: '1px solid #3a4a68', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#4a6080' }}>Custom:</span>
              <input id="ann-hex-input" type="text" defaultValue="#D4AF37" style={{ width: 60, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 2, padding: '1px 4px', fontSize: 10 }} />
            </div>
          </div>
        </div>
        <div id="ann-dd-weight" className="ann-dropdown" style={{ display: 'none' }}>
          {['1','2','3','4','5'].map(w => (
            <button key={w} className="ann-opt-btn" data-weight={w} style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>{w}px</button>
          ))}
        </div>
        <div id="ann-dd-linetype" className="ann-dropdown" style={{ display: 'none' }}>
          <button className="ann-opt-btn" data-lt="solid" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Solid</button>
          <button className="ann-opt-btn" data-lt="dashed" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Dashed</button>
          <button className="ann-opt-btn" data-lt="dotted" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Dotted</button>
        </div>
        <div id="ann-dd-opacity" className="ann-dropdown" style={{ display: 'none' }}>
          <input id="ann-opacity-slider" type="range" min={0} max={100} defaultValue={100} style={{ width: 100 }} />
          <span id="ann-opacity-val2" style={{ fontSize: 10, color: '#6a80a0', marginLeft: 4 }}>100%</span>
        </div>
        <div id="ann-dd-more" className="ann-dropdown" style={{ display: 'none' }}>
          <button className="ann-opt-btn" id="ann-set-text" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Edit text</button>
          <button className="ann-opt-btn" id="ann-set-label" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Set price label</button>
          <button className="ann-opt-btn" id="ann-set-y1" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Y1 label</button>
          <button className="ann-opt-btn" id="ann-set-y2" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Y2 label</button>
          <button className="ann-opt-btn" id="ann-set-y3" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Y3 label</button>
          <button className="ann-opt-btn" id="ann-set-opacity" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #2a3050', borderRadius: 2, color: '#dde3f0', fontSize: 11, cursor: 'pointer' }}>Set opacity</button>
          <button className="ann-opt-btn ann-del-btn" style={{ padding: '2px 8px', background: '#0b0d12', border: '1px solid #ef4444', borderRadius: 2, color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>Delete</button>
        </div>
        <div id="ann-dd-tcolor" className="ann-dropdown" style={{ display: 'none' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {['#D4AF37','#ef4444','#3b82f6','#4ade80','#a855f7','#f97316','#ec4899','#06b6d4','#eab308','#ffffff'].map(c => (
              <button key={c} className="ann-swatch" data-tcolor={c} style={{ width: 18, height: 18, borderRadius: 3, background: c, border: '1px solid #3a4a68', cursor: 'pointer' }} />
            ))}
          </div>
          <div id="ann-tcolor-group" style={{ display: 'flex', gap: 3, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#4a6080' }}>Custom:</span>
            <input id="ann-tcolor-text" type="text" defaultValue="#dde3f0" style={{ width: 60, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 2, padding: '1px 4px', fontSize: 10 }} />
          </div>
        </div>
        <div id="ann-sv-canvas" style={{ display: 'none', width: 160, height: 140, borderRadius: 4, cursor: 'crosshair' }} />
        <div id="ann-hue-canvas" style={{ display: 'none', width: 160, height: 16, borderRadius: 4, cursor: 'crosshair' }} />
        <div id="ann-alpha-canvas" style={{ display: 'none', width: 160, height: 16, borderRadius: 4, cursor: 'crosshair' }} />
      </div>

      <div id="main-area" style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', transition: 'margin-right 0.15s ease', marginRight: 350, marginLeft: 38 }}>
        <div id="grid" />
        <div id="bt-sidebar">
          <div id="bt-top-pane">
            <div id="bt-header">
              <span id="bt-title">⏱ BACKTEST</span>
              <button id="bt-close">✕</button>
            </div>
            <div id="bt-upload-area">
              <div id="bt-drop">
                <div id="bt-drop-label">
                  <span>Drop CSV</span> or click to upload<br />
                  <span style={{ fontSize: 10, color: '#3a4560' }}>Date,Symbol,Side,Qty,Entry,Exit,PnL,Duration,Strategy</span>
                </div>
                <input id="bt-file-input" type="file" accept=".csv,.txt" />
              </div>
            </div>
            <div id="bt-stats">
              <div className="bt-stat-row"><span className="bt-stat-l">Total Trades</span><span className="bt-stat-v" id="bst-total">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Win Rate</span><span className="bt-stat-v" id="bst-wr">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Net P&L</span><span className="bt-stat-v" id="bst-pnl">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Avg Win</span><span className="bt-stat-v pos" id="bst-aw">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Avg Loss</span><span className="bt-stat-v neg" id="bst-al">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Profit Factor</span><span className="bt-stat-v" id="bst-pf">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Max Drawdown</span><span className="bt-stat-v neg" id="bst-dd">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Best Trade</span><span className="bt-stat-v pos" id="bst-best">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Worst Trade</span><span className="bt-stat-v neg" id="bst-worst">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">Avg Duration</span><span className="bt-stat-v" id="bst-dur">—</span></div>
              <div className="bt-stat-row"><span className="bt-stat-l">By Strategy</span><span className="bt-stat-v" id="bst-strat">—</span></div>
            </div>
            <div id="bt-filter">
              <input id="bt-search" type="text" placeholder="Search ticker..." />
              <select id="bt-sort">
                <option value="date">Date</option>
                <option value="pnl">P&L</option>
                <option value="sym">Symbol</option>
              </select>
            </div>
            <div id="bt-list" />
          </div>
          <div id="bt-divider"><div className="bt-div-pip" /></div>
          <div id="scan-watchlist" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div id="scan-watchlist-header" style={{ padding: '6px 10px', borderBottom: '1px solid #1e2840', fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center' }}>
              <span>📊 TRADES ON CHART</span>
            </div>
            <div id="scan-watchlist-body" style={{ flex: 1, overflowY: 'auto' }} />
          </div>
        </div>
      </div>

      <div id="fs-backdrop" />
      <div id="toast" />

      <div id="sidebar" className="open">
        <div id="sidebar-tabs">
          <button className="stab active" data-tab="scan">📡 SCANS</button>
          <button className="stab" data-tab="bt">⏱ BT</button>
          <button className="stab" data-tab="lab">🧪 LAB</button>
          <button className="stab" data-tab="tools">🔧 TOOLS</button>
          <button className="stab" data-tab="vault">🗄 VAULT</button>
          <button className="stab" data-tab="settings">⚙ SETTINGS</button>
        </div>
        <div id="sidebar-content">
          <div className="stab-content active" data-tab="scan">
            <div style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
              <input id="scan-add-input" type="text" placeholder="Add scan by name or ticker..." style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '3px 8px', fontSize: 11 }} />
              <button className="tbtn" id="scan-add-btn" style={{ fontSize: 14, padding: '2px 6px' }}>+</button>
            </div>
            <div id="scan-list" />
            <div id="scan-panel" style={{ display: 'none' }}>
              <div id="scan-panel-header">
                <span id="scan-panel-title" />
                <button id="scan-panel-close">✕</button>
              </div>
              <div id="scan-status" />
              <div id="scan-active-label" />
              <div id="scan-run-controls">
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="tbtn" id="scan-run-btn">▶ Run</button>
                  <button className="tbtn" id="scan-stop-btn" style={{ display: 'none' }}>■ Stop</button>
                </div>
              </div>
              <div id="scan-symbol" />
              <div id="scan-filters" />
              <div id="scan-date-range" style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, margin: '4px 0' }}>
                <span style={{ color: '#4a6080' }}>From:</span>
                <input id="scan-from" type="date" style={{ background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 2, padding: '1px 4px', fontSize: 10 }} />
                <span style={{ color: '#4a6080' }}>To:</span>
                <input id="scan-to" type="date" style={{ background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 2, padding: '1px 4px', fontSize: 10 }} />
              </div>
              <div id="scan-watchlist" />
              <div style={{ display: 'flex', gap: 4, margin: '6px 0' }}>
                <input id="scan-validate-result" readOnly style={{ display: 'none', flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '3px 8px', fontSize: 11 }} />
                <button className="tbtn" id="scan-validate-btn" style={{ fontSize: 10 }}>🤖 Validate</button>
                <button className="tbtn" id="scan-go" style={{ fontSize: 10 }}>▶ Scan</button>
              </div>
              <div id="scan-results" style={{ maxHeight: 300, overflowY: 'auto' }} />
              <div id="scan-col-cog" style={{ position: 'absolute', top: 4, right: 8, cursor: 'pointer', fontSize: 13, color: '#4a6080' }}>⚙</div>
            </div>
          </div>
          <div className="stab-content" data-tab="bt">
            <div id="bt-sim">
              <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>SIMULATOR</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Side</span>
                <select id="bt-sim-entry" style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Entry</span>
                <input id="bt-sim-pnl" type="text" readOnly style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Stop</span>
                <input id="bt-sim-stop" type="text" placeholder="Stop price" style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Target</span>
                <input id="bt-sim-legs" type="text" placeholder="Target price" style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Shares</span>
                <input id="bt-sim-shares" type="number" defaultValue={100} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Risk $</span>
                <input id="sim-risk" type="text" readOnly style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>Size</span>
                <input id="sim-size" type="text" readOnly style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 40 }}>BP</span>
                <input id="sim-bp" type="text" readOnly style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div id="btsim-bp-warn" style={{ fontSize: 10, color: '#ef4444', display: 'none' }}>⚠ Exceeds buying power</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button className="tbtn" id="pct-bp" style={{ flex: 1, fontSize: 10 }}>% of BP</button>
              </div>
              <div id="bt-sim-pnl" style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#4a6080' }} />
              <div id="bt-strategy" style={{ marginTop: 8, fontSize: 10, color: '#4a6080' }}>
                <span style={{ fontWeight: 700, letterSpacing: 1 }}>STRATEGY</span>
                <select id="bt-strat-sel" style={{ width: '100%', background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11, marginTop: 4 }}>
                  <option value="">None</option>
                </select>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #1e2840', marginTop: 10, paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>RISK CALC</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>Account</span>
                <input id="bs-avg" type="number" defaultValue={25000} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>Max DD%</span>
                <input id="bs-dd" type="number" defaultValue={6} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>Win%</span>
                <input id="bs-winPct" type="number" defaultValue={55} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>Avg Win</span>
                <input id="bs-gross" type="number" defaultValue={200} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>PF</span>
                <input id="bs-pf" type="number" defaultValue={1.5} step={0.1} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>Trades</span>
                <input id="bs-trades" type="number" defaultValue={20} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#4a6080', width: 50 }}>Wins</span>
                <input id="bs-wins" type="number" defaultValue={11} style={{ flex: 1, background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '2px 4px', fontSize: 11 }} />
              </div>
            </div>
          </div>
          <div className="stab-content" data-tab="lab">
            <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>STRATEGY LAB</div>
            <div id="lab-body" />
          </div>
          <div className="stab-content" data-tab="tools">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1 }}>INDICATOR TOOLS</span>
              <button className="tbtn" id="add-tool-btn" style={{ fontSize: 11, padding: '2px 8px' }}>+ADD</button>
            </div>
            <div id="hot-btns-container" />
            <div id="tool-settings-body" />
            <div id="input-settings-btn" style={{ display: 'none' }} />
            <div style={{ borderTop: '1px solid #1e2840', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>CHART SETTINGS</div>
              <div id="chart-settings-body" />
            </div>
          </div>
          <div className="stab-content" data-tab="vault">
            <div style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>SAVED ANNOTATIONS</div>
            <div id="vault-list" />
          </div>
          <div className="stab-content" data-tab="settings">
            <div id="settings-panel-body" />
          </div>
        </div>
      </div>

      <div id="modal-overlay" />
      <div id="modal-box">
        <div id="modal-title" />
        <div id="modal-body" />
        <div id="modal-actions" />
      </div>

      <div id="scan-add-modal">
        <div id="scan-add-box">
          <h3>📡 ADD SCAN</h3>
          <div style={{ padding: '0 16px' }}>
            <input id="scan-name-input" type="text" placeholder="Scan name (e.g. Gap Up Scanner)" />
          </div>
          <div className="scan-upload-zone" id="scan-upload-zone">
            <div className="icon">📄</div>
            <p><strong>Drop .js file</strong> or click to upload</p>
            <p style={{ fontSize: 10 }}>Scanner code that returns an array of signals</p>
            <input id="scan-file-input" type="file" accept=".js,.txt" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </div>
          <div style={{ padding: '0 16px' }}>
            <label style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700, display: 'block', marginBottom: 4 }}>or paste code:</label>
            <textarea id="scan-code-input" style={{ width: '100%', height: 120, background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontFamily: 'monospace', fontSize: 11, padding: 8, borderRadius: 4, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} defaultValue="// Your scan code here&#10;// Must export: function scan(bars, params) { ... }&#10;// Return: [{ ticker, date, signal: 'long'|'short' }]" />
          </div>
          <div className="scan-modal-btns">
            <button className="btn-cancel" id="scan-modal-cancel">Cancel</button>
            <button className="btn-validate" id="scan-validate-btn">🤖 Validate</button>
            <button className="btn-save" id="scan-save-btn" disabled>💾 Save</button>
          </div>
          <div id="scan-validate-result" style={{ display: 'none', padding: '8px 16px' }} />
        </div>
      </div>

      <div id="pct-popup">
        <div id="pct-popup-title" style={{ fontSize: 11, color: '#D4AF37', letterSpacing: 1, fontWeight: 700 }}>% OF BUYING POWER</div>
        <input id="pct-risk" type="number" defaultValue={2} min={0.1} max={100} step={0.1} style={{ width: '100%', background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '3px 8px', fontSize: 12, marginTop: 4 }} />
        <input id="pct-stop-input" type="text" placeholder="Stop price (optional)" style={{ width: '100%', background: '#0b0d12', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 3, padding: '3px 8px', fontSize: 12, marginTop: 4 }} />
        <div id="pct-popup-hint" style={{ fontSize: 11, color: '#2a4060', marginTop: 3, lineHeight: 1.4, minHeight: 12 }} />
        <div className="popup-btns">
          <button id="pct-ok">PLACE</button>
          <button className="cancel" id="pct-cancel">CANCEL</button>
        </div>
      </div>

      <div id="text-popup">
        <div style={{ fontSize: 11, color: '#a855f7', letterSpacing: 1, fontWeight: 700 }}>ANNOTATION TEXT</div>
        <input id="text-input" type="text" placeholder="Enter label…" maxLength={80} />
        <div className="popup-btns">
          <button id="text-ok">PLACE</button>
          <button className="cancel" id="text-cancel">CANCEL</button>
        </div>
      </div>
    </>
  )
}
