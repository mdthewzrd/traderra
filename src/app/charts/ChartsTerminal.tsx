'use client'

import { useEffect, useRef } from 'react'
import '../../styles/charts-terminal.css'

/**
 * ChartsTerminal — 100% accurate clone of the original layout.
 * Renders the exact same HTML and loads charts-engine.js for interactivity.
 * React handles: routing, auth, token injection.
 * charts-engine.js handles: canvas rendering, events, state, everything else.
 *
 * This is the foundation. We'll incrementally extract sections into React
 * components from here.
 */
export default function ChartsTerminal({ userId, userName, userImage }: {
  userId: string
  userName: string
  userImage: string
}) {
  const loaded = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // The exact HTML body from charts-terminal-backup.html lines 649-1470
  // Kept as a static string — identical to the original layout
  const html = RAW_HTML

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    // Set user context
    ;(window as any).__CHARTS_USER = { id: userId, name: userName, image: userImage }

    // Inject auth token for CloudStore
    fetch('/api/auth/token')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.token) localStorage.setItem('traderra-auth-token', data.token)
      })
      .catch(() => {})
      .then(() => {
        // Load scripts in order — same as the original HTML
        const load = (src: string) => new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = src
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('Failed: ' + src))
          document.body.appendChild(s)
        })
        return load('/indicators/vault.js')
          .then(() => load('/charts-engine.js'))
          .then(() => load('/charts-engine-footer.js'))
      })
      .then(() => {
        console.log('[Charts] all scripts loaded')
        window.dispatchEvent(new CustomEvent('charts-user-ready', {
          detail: (window as any).__CHARTS_USER,
        }))
      })
      .catch(err => console.error('[Charts] script load failed:', err))
  }, [userId, userName, userImage])

  return (
    <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

// ── RAW HTML ──
// This is the exact body content from charts-terminal-backup.html
// Lines 649-1470 — every ID, class, style, and element preserved
const RAW_HTML = `
<!-- Profile icon - fixed top right -->
<div id="profile-icon" style="position:fixed;top:6px;right:12px;z-index:9999;cursor:pointer;width:28px;height:28px;border-radius:50%;background:#2a3050;display:flex;align-items:center;justify-content:center;font-size:13px;color:#6a7a98;border:1px solid #3a4a68;transition:all .15s;" onmouseover="this.style.borderColor='#D4AF37';this.style.color='#D4AF37'" onmouseout="this.style.borderColor=this.style.background==='#2a3050'?'#3a4a68':this.style.borderColor;this.style.color=this.style.background==='#2a3050'?'#6a7a98':this.style.color" title="Sign in to sync your data">👤</div>
<div id="topbar">
  <span id="logo">TRADERRA</span>
  <div class="sep"></div>
  <button class="tbtn" id="wl-toggle" style="border-color:#6878a8!important;color:#6878a8!important;" onclick="var sb=document.getElementById('sidebar');if(sb&&sb.classList.contains('open')){sbClose();}else{sbOpen();}">📋</button>
  <input id="symbol-input" type="text" value="AAPL" placeholder="TICKER"/>
  <button class="tbtn" id="load-btn">▶ LOAD</button>
  <button class="tbtn" id="live-btn">⬤ LIVE</button>
  <div id="live-indicator"><div id="live-dot"></div><span id="live-label">LIVE</span></div>
  <div class="sep"></div>
  <!-- Grouped dropdown menus -->
  <div class="dropdown-group">
    <button class="tbtn dropdown-trigger" id="draw-menu-btn">✏ DRAW ▾</button>
    <div class="dropdown-content" id="draw-menu">
      <button class="tool-btn" data-tool="trendline">✏ Line</button>
      <button class="tool-btn" data-tool="fib_ret" style="border-color:#a78bfa;color:#a78bfa;">〰 Fib Retracement</button>
      <button class="tool-btn" data-tool="box_orange">▣ Orange Box</button>
      <button class="tool-btn" data-tool="box_yellow">▣ Yellow Box</button>
      <button class="tool-btn" data-tool="text_orange">T Orange Text</button>
      <button class="tool-btn" data-tool="text_yellow">T Yellow Text</button>
      <hr style="border:none;border-top:1px solid #2a3050;margin:2px 0;">
      <span style="font-size:8px;color:#3a4560;padding:2px 6px;">HIGHLIGHT:</span>
      <button class="tool-btn" data-tool="hl_cyan" style="border-color:#22d3ee;color:#22d3ee;">■ Cyan</button>
      <button class="tool-btn" data-tool="hl_magenta" style="border-color:#e879f9;color:#e879f9;">■ Magenta</button>
      <button class="tool-btn" data-tool="hl_green" style="border-color:#4ade80;color:#4ade80;">■ Green</button>
      <button class="tool-btn" data-tool="hl_white" style="border-color:#cbd5e1;color:#cbd5e1;">■ White</button>
      <div style="display:flex;align-items:center;gap:4px;padding:2px 6px;">
        <span style="font-size:8px;color:#3a4560;">OP:</span>
        <input id="hl-opacity" type="range" min="5" max="80" value="35" style="width:60px;height:14px;accent-color:#22d3ee;cursor:pointer;"/>
        <span id="hl-opacity-val" style="font-size:11px;color:#4a6080;">15%</span>
      </div>
      <hr style="border:none;border-top:1px solid #2a3050;margin:2px 0;">
      <button class="tool-btn" data-tool="edit" style="border-color:#fbbf24;color:#fbbf24;">✎ Edit</button>
      <button class="tool-btn" data-tool="del" style="border-color:#ff3d57;color:#ff3d57;">🗑 Delete</button>
      <button class="tbtn" id="clr-btn" style="margin:2px 4px;">✕ Clear All</button>
    </div>
  </div>
  <div class="dropdown-group">
    <button class="tbtn dropdown-trigger" id="trade-menu-btn" style="border-color:#ff9800;color:#ff9800;">⇅ TRADE ▾</button>
    <div class="dropdown-content" id="trade-menu">
      <button class="tool-btn" data-tool="entry_arrow" style="border-color:#ff9800;color:#ff9800;">▲ Long Entry</button>
      <button class="tool-btn" data-tool="exit_arrow" style="border-color:#40c4ff;color:#40c4ff;">▼ Long Exit</button>
      <hr style="border:none;border-top:1px solid #2a3050;margin:2px 0;">
      <button class="tool-btn" data-tool="short_arrow" style="border-color:#ff5252;color:#ff5252;">▼ Short Entry</button>
      <button class="tool-btn" data-tool="cover_arrow" style="border-color:#00e676;color:#00e676;">▲ Cover</button>
      <hr style="border:none;border-top:1px solid #2a3050;margin:2px 0;">
      <button class="tool-btn" data-tool="stop_line" style="border-color:#facc15;color:#facc15;">— Stop</button>
      <button class="tool-btn" data-tool="trail_stop" style="border-color:#38bdf8;color:#38bdf8;">— Trail Stop</button>
    </div>
  </div>
  <div class="sep"></div>
  <div class="tbtn-row">
    <button class="tbtn" id="toggle-bars-btn">≡ BARS</button>
    <button class="tbtn" id="price-line-btn" style="border-color:#26a69a;color:#26a69a;">— LINE</button>
    <button class="tbtn" id="adj-btn" style="border-color:#f59e0b;color:#f59e0b;">ADJ</button>
    <button class="tbtn on" id="clean-btn" style="border-color:#e879f9;color:#e879f9;text-decoration:none;">CLN</button>
    <button class="tbtn active" id="ly1" style="font-weight:900;">1</button>
    <button class="tbtn" id="ly2" style="font-weight:900;">2</button>
    <button class="tbtn" id="ly4" style="font-weight:900;">4</button>
    <button class="tbtn" id="bt-btn" style="border-color:#f59e0b!important;color:#f59e0b!important;">⏱ BT</button>
    <button class="tbtn" id="scan-btn" style="border-color:#4ade80!important;color:#4ade80!important;">📡 SCAN</button>
    <button class="tbtn" id="vault-btn" style="border-color:#a78bfa!important;color:#a78bfa!important;">📦 VAULT</button>
    <button class="tbtn" id="settings-btn" style="border-color:#D4AF37!important;color:#D4AF37!important;">⚙ LOOK</button>
    <button class="tbtn" id="tools-btn" style="border-color:#D4AF37!important;color:#D4AF37!important;" onclick="sbOpen('tools')">🔧 TOOLS</button>
    <button class="tbtn" id="input-settings-btn" style="border-color:#22d3ee!important;color:#22d3ee!important;">⚙ SET</button>
    <div id="ind-btns-container" style="display:flex;gap:4px;align-items:center;flex-shrink:0;"></div>
    <div id="hot-btns-container" style="display:flex;gap:4px;align-items:center;flex-shrink:0;"></div>
    <button class="tbtn" id="add-ind-btn" style="border-color:#3a4a68;color:#3a4a68;" onclick="openIndBtnPopup()" title="Add indicator button">＋</button>
    <div class="dropdown-group">
      <button class="tbtn dropdown-trigger" id="tpl-menu-btn" style="border-color:#D4AF37;color:#D4AF37;">📋 TPL ▾</button>
      <div class="dropdown-content" id="tpl-dropdown" style="min-width:180px;">
        <div style="padding:4px 10px;font-size:11px;color:#4a6080;font-weight:700;">CHART TEMPLATES</div>
        <div id="tpl-list"></div>
        <hr style="border:none;border-top:1px solid #2a3050;margin:2px 0;">
        <div class="tool-btn" id="tpl-update-btn" onmousedown="updateCurrentTemplate()" style="color:#22d3ee;display:none;">🔄 Update Current Template</div>
        <div class="tool-btn" onmousedown="saveNewTemplate()" style="color:#D4AF37;">💾 Save Current as Template</div>
      </div>
    </div>
    <button class="tbtn" id="theme-toggle-btn" style="border-color:#5a6a88;color:#5a6a88;">🌙</button>
    <button class="tbtn" id="reload-chart-btn" style="border-color:#22d3ee;color:#22d3ee;" onclick="renderAll();" title="Reload chart">⟳ RELOAD</button>
  </div>
  <div id="ticker-info">
    <span id="ti-sym" style="color:#dde3f0;font-weight:700;font-size:14px;"></span>
    <span id="ti-price" style="font-size:13px;"></span>
    <span id="ti-chg" style="font-size:12px;"></span>
  </div>
</div>

<!-- Left Toolbar (Categorized with Flyouts) -->
<div id="left-toolbar">
  <!-- Cursor -->
  <button class="lt-btn active" data-tool="" onclick="setActiveTool(null);ltCloseAll()" title="Cursor"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 1l10 7-5 1-2 5z" fill="currentColor"/></svg></button>
  <div class="lt-sep"></div>

  <!-- Trend Lines -->
  <button class="lt-cat" data-cat="trend" onmousedown="ltToggle('trend')" title="Trend Lines">
    <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.5"/></svg>
    <span class="cat-arrow">▸</span>
  </button>
  <div class="lt-flyout" id="fo-trend">
    <div class="lt-fo-label">Trend Lines</div>
    <div class="lt-fo-item" data-tool="trendline" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.5"/></svg> Trend Line</div>
    <div class="lt-fo-item" data-tool="hline" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5"/></svg> Horizontal Line</div>
    <div class="lt-fo-item" data-tool="vline" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1.5"/></svg> Vertical Line</div>
    <div class="lt-fo-item" data-tool="ray" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="1" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.5"/><line x1="14" y1="2" x2="16" y2="0" stroke="currentColor" stroke-width="1"/></svg> Ray</div>
    <div class="lt-fo-item" data-tool="hray" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5"/><polygon points="14,6 16,8 14,10" fill="currentColor"/></svg> Horizontal Ray</div>
    <div class="lt-fo-item" data-tool="xline" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1"/><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width="1"/></svg> Cross Line</div>
    <div class="lt-fo-sep"></div>
    <div class="lt-fo-item" data-tool="parallel" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="3" y1="14" x2="13" y2="3" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="14" x2="16" y2="3" stroke="currentColor" stroke-width="1.2"/></svg> Parallel Channel</div>
    <div class="lt-fo-item" data-tool="disjoint" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="14" x2="10" y2="3" stroke="currentColor" stroke-width="1.2"/><line x1="6" y1="14" x2="14" y2="3" stroke="currentColor" stroke-width="1.2"/></svg> Disjoint Channel</div>
  </div>

  <!-- Fibonacci & Gann -->
  <button class="lt-cat" data-cat="fib" onmousedown="ltToggle('fib')" title="Fibonacci & Gann">
    <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1"/><line x1="2" y1="2" x2="8" y2="2" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/><line x1="5" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/><line x1="8" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/></svg>
    <span class="cat-arrow">▸</span>
  </button>
  <div class="lt-flyout" id="fo-fib">
    <div class="lt-fo-label">Fibonacci</div>
    <div class="lt-fo-item" data-tool="fib_ret" onmousedown="ltPick(this)" style="color:#a78bfa"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1"/><line x1="2" y1="2" x2="8" y2="2" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/><line x1="5" y1="5" x2="14" y2="5" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1"/></svg> Fib Retracement</div>
    <div class="lt-fo-sep"></div>
    <div class="lt-fo-label">Gann</div>
    <div class="lt-fo-item" data-tool="gann_box" onmousedown="ltPick(this)" style="color:#f59e0b"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1"/><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width=".5" stroke-dasharray="1,1"/><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" stroke-width=".5" stroke-dasharray="1,1"/></svg> Gann Box</div>
  </div>

  <!-- Shapes -->
  <button class="lt-cat" data-cat="shape" onmousedown="ltToggle('shape')" title="Geometric Shapes">
    <svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
    <span class="cat-arrow">▸</span>
  </button>
  <div class="lt-flyout" id="fo-shape">
    <div class="lt-fo-label">Shapes</div>
    <div class="lt-fo-item" data-tool="box_orange" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg> Rectangle</div>
    <div class="lt-fo-item" data-tool="circle" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg> Circle</div>
    <div class="lt-fo-item" data-tool="ellipse" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="7" ry="4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg> Ellipse</div>
    <div class="lt-fo-item" data-tool="triangle" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,2 14,14 2,14" fill="none" stroke="currentColor" stroke-width="1.2"/></svg> Triangle</div>
    <div class="lt-fo-item" data-tool="path" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><polyline points="2,12 5,4 10,10 14,3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg> Polyline</div>
    <div class="lt-fo-sep"></div>
    <div class="lt-fo-label">Brush</div>
    <div class="lt-fo-item" data-tool="hl_cyan" onmousedown="ltPick(this)" style="color:#22d3ee"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="8" fill="currentColor" opacity="0.3" stroke="currentColor" stroke-width="0.5"/></svg> Highlight</div>
    <div class="lt-fo-item" data-tool="brush" onmousedown="ltPick(this)" style="color:#94a3b8"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 14Q4 10 8 6Q12 2 14 2Q14 4 10 8Q6 12 2 14Z" fill="none" stroke="currentColor" stroke-width="1"/></svg> Brush</div>
  </div>

  <!-- Annotations -->
  <button class="lt-cat" data-cat="annot" onmousedown="ltToggle('annot')" title="Annotations">
    <svg width="16" height="16" viewBox="0 0 16 16"><text x="3" y="13" font-size="13" font-weight="bold" fill="currentColor">A</text></svg>
    <span class="cat-arrow">▸</span>
  </button>
  <div class="lt-flyout" id="fo-annot">
    <div class="lt-fo-label">Text & Notes</div>
    <div class="lt-fo-item" data-tool="text_orange" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><text x="3" y="13" font-size="13" font-weight="bold" fill="currentColor">T</text></svg> Text</div>
    <div class="lt-fo-item" data-tool="callout" onmousedown="ltPick(this)" style="color:#f97316"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="1" width="12" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><polygon points="5,10 7,14 9,10" fill="currentColor"/></svg> Callout</div>
    <div class="lt-fo-item" data-tool="note" onmousedown="ltPick(this)" style="color:#fbbf24"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="1" width="12" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><line x1="5" y1="5" x2="11" y2="5" stroke="currentColor" stroke-width="1"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" stroke-width="1"/></svg> Note</div>
    <div class="lt-fo-item" data-tool="price_label" onmousedown="ltPick(this)" style="color:#26a69a"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="1" y="6" width="14" height="4" rx="2" fill="none" stroke="currentColor" stroke-width="1"/></svg> Price Label</div>
    <div class="lt-fo-item" data-tool="flag" onmousedown="ltPick(this)" style="color:#ef5350"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="2" x2="4" y2="14" stroke="currentColor" stroke-width="1.2"/><polygon points="4,2 14,4 4,7" fill="currentColor"/></svg> Flag</div>
  </div>

  <!-- Trade / Position -->
  <button class="lt-cat" data-cat="trade" onmousedown="ltToggle('trade')" title="Trade Positions">
    <svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 13,7 10,7 10,15 6,15 6,7 3,7" fill="currentColor"/></svg>
    <span class="cat-arrow">▸</span>
  </button>
  <div class="lt-flyout" id="fo-trade">
    <div class="lt-fo-label">Entries & Exits</div>
    <div class="lt-fo-item" data-tool="entry_arrow" onmousedown="ltPick(this)" style="color:#ff9800"><svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 13,7 10,7 10,15 6,15 6,7 3,7" fill="currentColor"/></svg> Long Entry</div>
    <div class="lt-fo-item" data-tool="exit_arrow" onmousedown="ltPick(this)" style="color:#40c4ff"><svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,15 13,9 10,9 10,1 6,1 6,9 3,9" fill="currentColor"/></svg> Long Exit</div>
    <div class="lt-fo-item" data-tool="short_arrow" onmousedown="ltPick(this)" style="color:#ff5252"><svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,15 13,9 10,9 10,1 6,1 6,9 3,9" fill="currentColor"/></svg> Short Entry</div>
    <div class="lt-fo-item" data-tool="cover_arrow" onmousedown="ltPick(this)" style="color:#00e676"><svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 13,7 10,7 10,15 6,15 6,7 3,7" fill="currentColor"/></svg> Cover</div>
    <div class="lt-fo-sep"></div>
    <div class="lt-fo-label">Stops</div>
    <div class="lt-fo-item" data-tool="stop_line" onmousedown="ltPick(this)" style="color:#facc15"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/></svg> Stop Loss</div>
    <div class="lt-fo-item" data-tool="trail_stop" onmousedown="ltPick(this)" style="color:#38bdf8"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 12 L5 8 L8 10 L12 4 L14 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,1"/></svg> Trail Stop</div>
    <div class="lt-fo-sep"></div>
    <div class="lt-fo-label">Position</div>
    <div class="lt-fo-item" data-tool="long_pos" onmousedown="ltPick(this)" style="color:#26a69a"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="rgba(38,166,154,.15)" stroke="#26a69a" stroke-width="1"/><line x1="2" y1="12" x2="14" y2="5" stroke="#26a69a" stroke-width="1"/></svg> Long Position</div>
    <div class="lt-fo-item" data-tool="short_pos" onmousedown="ltPick(this)" style="color:#ef5350"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="rgba(239,83,80,.15)" stroke="#ef5350" stroke-width="1"/><line x1="2" y1="5" x2="14" y2="12" stroke="#ef5350" stroke-width="1"/></svg> Short Position</div>
    <div class="lt-fo-item" data-tool="forecast" onmousedown="ltPick(this)" style="color:#7b61ff"><svg width="16" height="16" viewBox="0 0 16 16"><polyline points="2,12 6,8 10,10 14,3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/></svg> Forecast</div>
  </div>

  <!-- Measure -->
  <button class="lt-cat" data-cat="measure" onmousedown="ltToggle('measure')" title="Measure & Zoom">
    <svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1" stroke-dasharray="2,1"/><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg>
    <span class="cat-arrow">▸</span>
  </button>
  <div class="lt-flyout" id="fo-measure">
    <div class="lt-fo-item" data-tool="measure" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1" stroke-dasharray="2,1"/><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="14" cy="14" r="1.5" fill="currentColor"/></svg> Measure</div>
    <div class="lt-fo-item" data-tool="zoom_in" onmousedown="ltPick(this)"><svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="5" x2="7" y2="9" stroke="currentColor" stroke-width="1.2"/></svg> Zoom In</div>
  </div>

  <!-- Edit / Delete -->
  <div class="lt-sep"></div>
  <button class="lt-btn tool-btn" data-tool="edit" title="Edit" style="color:#fbbf24"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M12 1l3 3-9 9H3v-3z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
  <button class="lt-btn tool-btn" data-tool="del" title="Delete" style="color:#ff3d57"><svg width="16" height="16" viewBox="0 0 16 16"><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="1.5"/></svg></button>

  <!-- Bottom actions -->
  <div class="lt-bottom">
    <button class="lt-btn" id="magnet-btn" title="Magnet Snap" onclick="this.classList.toggle('active');_magnetSnap=this.classList.contains('active')"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 7a4 4 0 018 0v4h-2V7a2 2 0 00-4 0v4H4z" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="1" width="3" height="3" fill="#ff3d57" rx="0.5"/><rect x="10" y="1" width="3" height="3" fill="#3d85ff" rx="0.5"/></svg></button>
    <button class="lt-btn" id="stay-draw-btn" title="Stay in Drawing Mode" onclick="this.classList.toggle('active-bottom');_stayDraw=this.classList.contains('active-bottom')"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1"/><circle cx="8" cy="8" r="3" fill="none" stroke="#D4AF37" stroke-width="1"/></svg></button>
    <button class="lt-btn" id="lock-all-btn" title="Lock All Drawings" onclick="this.classList.toggle('active-bottom');_lockAll=this.classList.contains('active-bottom')"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 018 0v2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>
    <button class="lt-btn" id="hide-all-btn" title="Hide All Drawings" onclick="this.classList.toggle('active-bottom');_hideAll=this.classList.contains('active-bottom');renderAll()"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5"/></svg></button>
  </div>
</div>
<!-- Floating annotation toolbar (TradingView-style) -->
<div id="ann-toolbar" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()" style="display:none;position:fixed;z-index:900;background:#1e222d;border:1px solid #2a3050;border-radius:4px;padding:2px 2px 2px 6px;gap:1px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,0.5);pointer-events:auto;">
  <!-- Drag Handle -->
  <div id="ann-toolbar-handle" style="cursor:grab;padding:4px 4px 4px 0;display:flex;flex-direction:column;gap:1px;" title="Drag to move">
    <div style="width:10px;height:2px;background:#4a6080;border-radius:1px;"></div>
    <div style="width:10px;height:2px;background:#4a6080;border-radius:1px;"></div>
    <div style="width:10px;height:2px;background:#4a6080;border-radius:1px;"></div>
  </div>
  <div style="width:1px;height:20px;background:#2a3050;margin:0 1px;"></div>
  <!-- Line Color -->
  <div class="ann-tb-group" style="position:relative;">
    <button id="ann-color-btn" class="ann-tb-btn" onmousedown="annToggleDropdown('color')" title="Line Color">
      <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="14" x2="16" y2="14" stroke-width="3" id="ann-color-line" stroke="#7b61ff"/><rect x="2" y="16" width="14" height="2" rx="1" id="ann-color-bar" fill="#7b61ff"/></svg>
    </button>
    <div id="ann-dd-color" class="ann-dropdown" style="display:none;" onmousedown="event.stopPropagation();">
      <div class="ann-color-picker">
        <canvas id="ann-sv-canvas" width="180" height="150" style="border-radius:3px;cursor:crosshair;display:block;"></canvas>
        <canvas id="ann-hue-canvas" width="180" height="16" style="border-radius:3px;cursor:crosshair;display:block;margin-top:4px;"></canvas>
        <canvas id="ann-alpha-canvas" width="180" height="12" style="border-radius:2px;cursor:crosshair;display:block;margin-top:4px;"></canvas>
        <div style="display:flex;align-items:center;gap:4px;margin-top:6px;">
          <input type="text" id="ann-hex-input" value="#7b61ff" style="width:72px;background:#10131a;border:1px solid #2a3050;border-radius:3px;color:#dde3f0;font-size:11px;padding:2px 4px;font-family:monospace;text-transform:uppercase;"/>
          <span style="color:#4a6080;font-size:11px;">α</span>
          <input type="number" id="ann-alpha-input" min="0" max="100" value="100" style="width:38px;background:#10131a;border:1px solid #2a3050;border-radius:3px;color:#dde3f0;font-size:11px;padding:2px 4px;"/>%
        </div>
        <div class="ann-swatches">
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#ff9800" style="background:#ff9800;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#26a69a" style="background:#26a69a;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#e879f9" style="background:#e879f9;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#7b61ff" style="background:#7b61ff;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#4ade80" style="background:#4ade80;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#ff3d57" style="background:#ff3d57;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#facc15" style="background:#facc15;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#38bdf8" style="background:#38bdf8;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#f472b6" style="background:#f472b6;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#ffffff" style="background:#ffffff;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#94a3b8" style="background:#94a3b8;"></span>
          <span onclick="annPickSwatch(this.dataset.c)" data-c="#000000" style="background:#000;border:1px solid #444;"></span>
        </div>
      </div>
    </div>
  </div>
  <!-- Text Color -->
  <div class="ann-tb-group" id="ann-tcolor-group" style="position:relative;display:none;">
    <button id="ann-tcolor-btn" class="ann-tb-btn" onmousedown="annToggleDropdown('tcolor')" title="Text Color">
      <svg width="18" height="18" viewBox="0 0 18 18"><text x="3" y="14" font-size="14" font-weight="bold" font-family="monospace" id="ann-tcolor-text" fill="#ff9800">A</text></svg>
    </button>
  </div>
  <!-- Line Weight -->
  <div class="ann-tb-group" style="position:relative;">
    <button id="ann-weight-btn" class="ann-tb-btn" onmousedown="annToggleDropdown('weight')" title="Line Width">
      <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" stroke-width="2" stroke="#dde3f0"/></svg>
    </button>
    <div id="ann-dd-weight" class="ann-dropdown" style="display:none;" onmousedown="event.stopPropagation();">
      <div style="padding:4px;display:flex;flex-direction:column;gap:2px;">
        <div class="ann-opt-btn" data-w="1" onmousedown="annSetWeight(1)" style="cursor:pointer;"><span style="display:inline-block;width:30px;height:1px;background:#dde3f0;vertical-align:middle;"></span> 1px</div>
        <div class="ann-opt-btn" data-w="2" onmousedown="annSetWeight(2)" style="cursor:pointer;"><span style="display:inline-block;width:30px;height:2px;background:#dde3f0;vertical-align:middle;"></span> 2px</div>
        <div class="ann-opt-btn" data-w="3" onmousedown="annSetWeight(3)" style="cursor:pointer;"><span style="display:inline-block;width:30px;height:3px;background:#dde3f0;vertical-align:middle;"></span> 3px</div>
        <div class="ann-opt-btn" data-w="4" onmousedown="annSetWeight(4)" style="cursor:pointer;"><span style="display:inline-block;width:30px;height:4px;background:#dde3f0;vertical-align:middle;"></span> 4px</div>
        <div class="ann-opt-btn" data-w="5" onmousedown="annSetWeight(5)" style="cursor:pointer;"><span style="display:inline-block;width:30px;height:5px;background:#dde3f0;vertical-align:middle;"></span> 5px</div>
      </div>
    </div>
  </div>
  <!-- Line Type -->
  <div class="ann-tb-group" style="position:relative;">
    <button id="ann-linetype-btn" class="ann-tb-btn" onmousedown="annToggleDropdown('linetype')" title="Line Style">
      <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" stroke-width="2" stroke="#dde3f0" stroke-dasharray="4,3"/></svg>
    </button>
    <div id="ann-dd-linetype" class="ann-dropdown" style="display:none;" onmousedown="event.stopPropagation();">
      <div style="padding:4px;display:flex;flex-direction:column;gap:2px;">
        <div class="ann-opt-btn" onmousedown="annSetLineStyle('solid')" style="cursor:pointer;"><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" stroke-width="2"/></svg> Solid</div>
        <div class="ann-opt-btn" onmousedown="annSetLineStyle('dashed')" style="cursor:pointer;"><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" stroke-width="2" stroke-dasharray="6,3"/></svg> Dashed</div>
        <div class="ann-opt-btn" onmousedown="annSetLineStyle('dotted')" style="cursor:pointer;"><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" stroke-width="2" stroke-dasharray="2,3"/></svg> Dotted</div>
      </div>
    </div>
  </div>
  <!-- Separator -->
  <div class="ann-tb-sep"></div>
  <!-- Settings -->
  <button class="ann-tb-btn" onmousedown="annShowSettings()" title="Settings">
    <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.5" fill="none" stroke="#8aa0c0" stroke-width="1.5"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15M3.05 3.05l1.77 1.77M11.18 11.18l1.77 1.77M3.05 12.95l1.77-1.77M11.18 4.82l1.77-1.77" stroke="#8aa0c0" stroke-width="1.2"/></svg>
  </button>
  <!-- Lock -->
  <button id="ann-lock-btn" class="ann-tb-btn" onmousedown="annToggleLock()" title="Lock">
    <svg width="16" height="16" viewBox="0 0 16 16" id="ann-lock-icon"><path d="M4 7V5a4 4 0 018 0v2" fill="none" stroke="#8aa0c0" stroke-width="1.3"/><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8aa0c0" stroke-width="1.3"/></svg>
  </button>
  <!-- Visibility -->
  <button id="ann-vis-btn" class="ann-tb-btn" onmousedown="annToggleVisibility()" title="Show/Hide">
    <svg width="16" height="16" viewBox="0 0 16 16" id="ann-vis-icon"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="#8aa0c0" stroke-width="1.3"/><circle cx="8" cy="8" r="2.5" fill="none" stroke="#8aa0c0" stroke-width="1.3"/></svg>
  </button>
  <!-- Opacity -->
  <div class="ann-tb-group" style="position:relative;">
    <button id="ann-opacity-btn" class="ann-tb-btn" onmousedown="annToggleDropdown('opacity')" title="Opacity">
      <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="#8aa0c0" stroke-width="1.2"/><circle cx="9" cy="9" r="3" fill="#8aa0c0" opacity="0.5"/></svg>
    </button>
    <div id="ann-dd-opacity" class="ann-dropdown" style="display:none;min-width:170px;" onmousedown="event.stopPropagation();">
      <div style="padding:6px 8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:11px;color:#8aa0c0;font-weight:700;letter-spacing:.5px;">OPACITY</span>
          <span id="ann-opacity-val" style="font-size:11px;color:#dde3f0;font-weight:700;font-family:monospace;">100%</span>
        </div>
        <input type="range" id="ann-opacity-slider" min="5" max="100" value="100" style="width:100%;accent-color:#D4AF37;cursor:pointer;height:16px;"/>
        <div style="display:flex;justify-content:space-between;margin-top:3px;">
          <span style="font-size:8px;color:#4a6080;">5%</span>
          <span style="font-size:8px;color:#4a6080;">100%</span>
        </div>
      </div>
    </div>
  </div>
  <!-- Separator -->
  <div class="ann-tb-sep"></div>
  <!-- Delete -->
  <button class="ann-tb-btn ann-tb-btn-danger" onmousedown="annDelete()" title="Delete (Del)">
    <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#ff3d57" stroke-width="1.5" stroke-linecap="round"/></svg>
  </button>
  <!-- More -->
  <div class="ann-tb-group" style="position:relative;">
    <button class="ann-tb-btn" onmousedown="annToggleDropdown('more')" title="More">
      <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="#8aa0c0"/><circle cx="8" cy="8" r="1.5" fill="#8aa0c0"/><circle cx="13" cy="8" r="1.5" fill="#8aa0c0"/></svg>
    </button>
    <div id="ann-dd-more" class="ann-dropdown" style="display:none;" onmousedown="event.stopPropagation();">
      <div style="padding:4px;display:flex;flex-direction:column;gap:1px;">
        <div class="ann-opt-btn" onmousedown="annDuplicate();annCloseDropdowns();" style="cursor:pointer;">⧉ Duplicate</div>
        <div class="ann-opt-btn" onmousedown="annBringToFront();annCloseDropdowns();" style="cursor:pointer;">▲ Bring to Front</div>
        <div class="ann-opt-btn" onmousedown="annSendToBack();annCloseDropdowns();" style="cursor:pointer;">▼ Send to Back</div>
        <div class="ann-opt-btn" id="ann-more-text" style="display:none;cursor:pointer;" onmousedown="annEditText();annCloseDropdowns();">T✎ Edit Text</div>
        <div style="height:1px;background:#2a3050;margin:2px 0;"></div>
        <div class="ann-opt-btn" style="color:#ff3d57;cursor:pointer;" onmousedown="annDeleteAllOfType();annCloseDropdowns();">✕ Delete All of This Type</div>
      </div>
    </div>
  </div>
</div>

<div id="main-area" style="flex:1;display:flex;min-height:0;overflow:hidden;transition:margin-right 0.15s ease;margin-right:350px;margin-left:38px;">
<div id="grid"></div>
<div id="bt-sidebar">
  <div id="bt-header">
    <span id="bt-title">⏱ BACKTEST MODE</span>
    <button id="bt-close">✕</button>
  </div>
  <!-- TOP PANE: upload + stats + filter + range + sim — scrollable, resizable -->
  <div id="bt-top-pane" style="overflow-y:auto;overflow-x:hidden;flex-shrink:0;">
  <div id="bt-upload-area">
    <div id="bt-drop">
      <input type="file" id="bt-file-input" accept=".csv"/>
      <div id="bt-drop-label">Drop <span>CSV</span> or click to upload<br>entry/exit execution file</div>
    </div>
  </div>
  <div id="bt-stats">
    <div class="bt-stat-row"><span class="bt-stat-l">TRADES</span><span class="bt-stat-v" id="bts-trades">—</span></div>
    <div class="bt-stat-row"><span class="bt-stat-l">TOTAL PNL</span><span class="bt-stat-v" id="bts-pnl">—</span></div>
    <div class="bt-stat-row"><span class="bt-stat-l">WIN RATE</span><span class="bt-stat-v" id="bts-wr">—</span></div>
    <div class="bt-stat-row"><span class="bt-stat-l">AVG WIN</span><span class="bt-stat-v pos" id="bts-aw">—</span></div>
    <div class="bt-stat-row"><span class="bt-stat-l">AVG LOSS</span><span class="bt-stat-v neg" id="bts-al">—</span></div>
    <div class="bt-stat-row"><span class="bt-stat-l">BEST</span><span class="bt-stat-v pos" id="bts-best">—</span></div>
    <div class="bt-stat-row"><span class="bt-stat-l">WORST</span><span class="bt-stat-v neg" id="bts-worst">—</span></div>
  </div>
  <div id="bt-strategy" style="display:none;padding:5px 10px;border-bottom:1px solid #1e2840;flex-shrink:0;">
    <div style="font-size:11px;color:#4a6080;letter-spacing:.5px;margin-bottom:4px;font-family:'Inter',system-ui,-apple-system,sans-serif;">STRATEGY TYPE</div>
    <div style="display:flex;gap:5px;">
      <button id="bt-strat-long" style="flex:1;padding:3px 0;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a5580;letter-spacing:.5px;">▲ LONG</button>
      <button id="bt-strat-short" style="flex:1;padding:3px 0;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #ff5252;background:#ff525218;color:#ff5252;letter-spacing:.5px;">▼ SHORT</button>
    </div>
  </div>
  <div id="bt-filter">
    <input id="bt-search" type="text" placeholder="FILTER TICKER…" maxlength="10"/>
    <select id="bt-sort">
      <option value="date_asc">DATE ↑</option>
      <option value="date_desc">DATE ↓</option>
      <option value="pnl_desc">PNL ↓</option>
      <option value="pnl_asc">PNL ↑</option>
      <option value="ticker">TICKER</option>
    </select>
    <button id="bt-hldt-btn" title="Highlight trade dates on chart" style="padding:2px 7px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #f59e0b;background:#f59e0b18;color:#f59e0b;letter-spacing:.5px;flex-shrink:0;">HLDT</button>
  </div>
  <div id="bt-range-cfg" style="display:none;padding:6px 10px;border-bottom:1px solid #1e2840;background:#0d0f18;">
    <div style="font-size:11px;color:#3a5070;letter-spacing:1px;margin-bottom:5px;text-transform:uppercase;">Chart Lookback / Forward</div>
    <div id="bt-panel-ranges"></div>
  </div>
  <div id="bt-sim" style="display:none;padding:8px 10px;background:#080b12;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="font-size:11px;font-weight:700;color:#38bdf8;letter-spacing:1px;">MANUAL SIM</span>
      <span style="margin-left:auto;display:flex;align-items:center;gap:4px;">
        <span style="color:#ef5350;font-size:11px;font-weight:700;letter-spacing:0.5px;">R%</span>
        <input id="bt-sim-riskpct" type="number" min="0.01" step="0.1" value="1" style="width:52px;background:#1a1e2e;border:1px solid #ef5350;color:#ef5350;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Risk per R as % of equity"/>
        <span id="btsim-rdollar" style="color:#ef535099;font-size:11px;font-weight:700;font-family:'Inter',system-ui,-apple-system,sans-serif;min-width:50px;">—</span>
        <button id="bt-sim-clear" style="background:none;border:1px solid #2a3050;color:#4a5580;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;padding:1px 5px;border-radius:2px;cursor:pointer;">CLR</button>
      </span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap;">
      <span style="color:#a78bfa;font-size:11px;font-weight:700;letter-spacing:0.5px;">EQ$</span>
      <input id="bt-sim-equity" type="number" min="0" step="1000" value="" placeholder="—" style="width:72px;background:#1a1e2e;border:1px solid #a78bfa;color:#a78bfa;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Account equity"/>
      <span style="color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:0.5px;">BP×</span>
      <input id="bt-sim-bpmult" type="number" min="1" max="10" step="1" value="4" style="width:36px;background:#1a1e2e;border:1px solid #f59e0b;color:#f59e0b;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Buying power multiplier (e.g. 4× for margin)"/>
      <span id="btsim-eq-summary" style="font-size:11px;color:#4a6080;margin-left:auto;"></span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <span style="color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.5px;">R$</span>
      <input id="bt-sim-rdirect" type="number" min="1" step="50" value="" placeholder="— override" style="width:90px;background:#1a1e2e;border:1px solid #34d399;color:#34d399;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Direct R dollar amount — overrides EQ$×R% when set"/>
      <span style="font-size:11px;color:#2a5040;font-weight:600;letter-spacing:0.3px;">overrides EQ%</span>
    </div>
    <div id="bt-sim-legs" style="margin-bottom:6px;font-size:11px;color:#8aa0c0;min-height:14px;line-height:1.6;font-weight:600;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:11px;">
      <span style="color:#6a80a0;font-size:11px;">AVG ENTRY</span><span id="btsim-entry" style="font-weight:800;color:#dde3f0;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">SHARES</span><span id="btsim-shares" style="font-weight:800;color:#dde3f0;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">STOP</span><span id="btsim-stop" style="font-weight:800;color:#facc15;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">RISK</span><span id="btsim-risk" style="font-weight:800;color:#ef5350;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">AVG EXIT</span><span id="btsim-avgexit" style="font-weight:800;color:#dde3f0;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">LAST EXIT</span><span id="btsim-exit" style="font-weight:800;color:#dde3f0;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">SIM PNL</span><span id="btsim-pnl" style="font-weight:800;font-size:13px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">SIM R</span><span id="btsim-r" style="font-weight:800;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">SIM %</span><span id="btsim-pct" style="font-weight:800;font-size:12px;" title="PnL as % of account equity">—</span>
      <span style="color:#6a80a0;font-size:11px;">R MATH</span><span id="btsim-rmath" style="font-weight:600;color:#4a6080;font-size:11px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">STATUS</span><span id="btsim-status" style="font-weight:800;font-size:11px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">POS VALUE</span><span id="btsim-posval" style="font-weight:800;color:#dde3f0;font-size:12px;">—</span>
      <span style="color:#6a80a0;font-size:11px;">BP USED</span><span id="btsim-bpused" style="font-weight:800;color:#dde3f0;font-size:12px;">—</span>
    </div>
    <div id="btsim-bp-warn" style="display:none;margin-top:4px;padding:3px 6px;background:rgba(239,83,80,0.15);border:1px solid #ef5350;border-radius:3px;font-size:11px;font-weight:700;color:#ef5350;"></div>
    <div style="display:flex;gap:5px;margin-top:6px;border-top:1px solid #1e2840;padding-top:6px;">
      <button id="review-save-btn" style="flex:1;background:#0d1a2e;border:1px solid #38bdf8;color:#38bdf8;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:700;padding:4px 0;border-radius:3px;cursor:pointer;letter-spacing:0.5px;">💾 SAVE REVIEW</button>
      <button id="review-load-btn" style="flex:1;background:#0d1a2e;border:1px solid #a855f7;color:#a855f7;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;font-weight:700;padding:4px 0;border-radius:3px;cursor:pointer;letter-spacing:0.5px;">📂 LOAD REVIEW</button>
      <input type="file" id="review-file-input" accept=".json" style="display:none;"/>
    </div>
    <div id="review-status" style="display:none;margin-top:4px;font-size:11px;font-weight:700;padding:2px 5px;border-radius:2px;text-align:center;"></div>
  </div>
  </div>
  <!-- DRAG HANDLE -->
  <div id="bt-divider" style="height:6px;background:#1e2840;cursor:ns-resize;flex-shrink:0;display:flex;align-items:center;justify-content:center;user-select:none;">
    <div class="bt-div-pip"></div>
  </div>
  <!-- BOTTOM PANE: trade list — takes remaining space -->
  <div id="bt-list" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:40px;"></div>
</div>
</div>
<div id="fs-backdrop"></div>
<div id="draw-hint"></div>
<div id="toast"></div>


<!-- ══════════ UNIFIED RIGHT SIDEBAR ══════════ -->
<div id="sidebar" class="open">
  <!-- TOP: Watchlist -->
  <div id="wl-section">
    <div id="wl-head" onclick="wlToggleCollapse()">
      <div style="display:flex;align-items:center;gap:6px;">
        <span id="wl-chevron" style="color:#4a5580;font-size:11px;">▼</span>
        <select id="wl-picker" onclick="event.stopPropagation()" onchange="wlSwitchList(this.value)"></select>
        <button id="wl-add-list-btn" onclick="event.stopPropagation();wlCreateList()" title="New Watchlist" style="background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;padding:1px 4px;border-radius:2px;cursor:pointer;">+</button>
        <button id="wl-del-list-btn" onclick="event.stopPropagation();wlDeleteListConfirm()" title="Delete Watchlist" style="background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;padding:1px 4px;border-radius:2px;cursor:pointer;">🗑</button>
        <button id="wl-rename-list-btn" onclick="event.stopPropagation();wlRenameListPrompt()" title="Rename" style="background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;padding:1px 4px;border-radius:2px;cursor:pointer;">✏</button>
        <button onclick="event.stopPropagation();wlColSettings()" title="Columns" style="background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;padding:1px 4px;border-radius:2px;cursor:pointer;">⚙</button>
      </div>
      <span id="wl-count" style="color:#4a5580;font-size:11px;"></span>
    </div>
    <div id="wl-body">
      <div id="wl-col-header"></div>
      <div id="wl-list"></div>
      <div id="wl-add">
        <input id="wl-add-input" type="text" placeholder="+ symbol" onkeydown="if(event.key==='Enter')wlAdd()" />
        <button onclick="wlAdd()">+</button>
      </div>
    </div>
  </div>
  <!-- TAB BAR -->
  <div id="sidebar-tabs">
    <div class="sb-tab" data-tab="look" onclick="sbTab('look')">LOOK</div>
    <div class="sb-tab" data-tab="tools" onclick="sbTab('tools')">TOOLS</div>
    <div class="sb-tab" data-tab="settings" onclick="sbTab('settings')">SET</div>
    <div class="sb-tab" data-tab="vault" onclick="sbTab('vault')">VAULT</div>
    <div class="sb-tab" data-tab="scan" onclick="sbTab('scan')">SCAN</div>
    <div class="sb-tab" data-tab="bt" onclick="sbTab('bt')">BT</div>
    <div class="sb-tab" data-tab="lab" onclick="sbTab('lab')">LAB</div>
    <div style="flex:1"></div>
    <div class="sb-tab" onclick="sbClose()" style="color:#4a5580;padding-right:10px;">✕</div>
  </div>
  <!-- TAB CONTENT -->
  <div id="sidebar-content">
    <div id="tab-look">
      <div id="settings-panel-header" style="justify-content:space-between;">
        <span style="font-size:11px;font-weight:700;color:#D4AF37;letter-spacing:1px;">⚙ LOOK & FEEL</span>
        <span id="theme-editing-label" style="font-size:11px;font-weight:700;color:#6878a8;letter-spacing:.5px;background:#1a1e2e;padding:2px 8px;border-radius:3px;">EDITING: DARK</span>
      </div>
      <div id="settings-panel-body">
        <div class="ss"><div class="sst">CANDLES</div>
          <div class="sr"><label>Up</label><input type="color" id="sc-up" value="#26a69a"></div>
          <div class="sr"><label>Down</label><input type="color" id="sc-dn" value="#ef5350"></div>
          <div class="sr"><label>Vol Up</label><input type="color" id="sc-vu" value="#26a69a"></div>
          <div class="sr"><label>Vol Down</label><input type="color" id="sc-vd" value="#ef5350"></div>
          <div class="sr" style="margin-top:4px;padding-top:4px;border-top:1px solid #1a1e2a;"><label>Filter Prints</label><button id="sc-clean" style="background:#e879f918;border:1px solid #e879f9;color:#e879f9;font-size:11px;font-weight:700;padding:2px 10px;border-radius:3px;cursor:pointer;font-family:'Inter',system-ui,-apple-system,sans-serif;">ON</button><span style="font-size:11px;color:#4a6080;margin-left:4px;">Drop fake bars</span></div>
        </div>
        <div class="ss"><div class="sst">BACKGROUND</div>
          <div class="sr"><label>Chart</label><input type="color" id="sc-bg" value="#0c0e14"></div>
          <div class="sr"><label>Axis</label><input type="color" id="sc-ax" value="#0d0f18"></div>
          <div class="sr"><label>Grid</label><input type="color" id="sc-gr" value="#141926"></div>
          <div class="sr"><label>Border</label><input type="color" id="sc-bd" value="#1e2535"></div>
        </div>
        <div class="ss"><div class="sst">SESSIONS</div>
          <div class="sr"><label>Pre-Mkt</label><input type="color" id="sc-pre" value="#787878"><input type="range" id="sc-preo" min="1" max="40" value="7" style="flex:1;"><span class="srv" id="sc-preo-v">7%</span></div>
          <div class="sr"><label>After-Hrs</label><input type="color" id="sc-aft" value="#3c3c3c"><input type="range" id="sc-afto" min="1" max="40" value="9" style="flex:1;"><span class="srv" id="sc-afto-v">9%</span></div>
        </div>
        <div class="ss"><div class="sst">CROSSHAIR</div>
          <div class="sr"><label>Color</label><input type="color" id="sc-cr" value="#8ca0c8"><input type="range" id="sc-cro" min="10" max="100" value="50" style="flex:1;"><span class="srv" id="sc-cro-v">50%</span></div>
        </div>
        <div class="ss"><div class="sst">FONT SIZE</div>
          <div class="sr" style="margin-bottom:6px;">
            <label>Quick Scale</label>
            <div style="display:flex;gap:4px;flex:1;justify-content:flex-end;">
              <button class="tbtn" onclick="setFontScale('small')" id="fs-small" style="font-size:11px;padding:3px 8px;min-width:0;">S</button>
              <button class="tbtn" onclick="setFontScale('medium')" id="fs-medium" style="font-size:11px;padding:3px 8px;min-width:0;border-color:#D4AF37!important;color:#D4AF37!important;">M</button>
              <button class="tbtn" onclick="setFontScale('large')" id="fs-large" style="font-size:11px;padding:3px 10px;min-width:0;">L</button>
            </div>
          </div>
          <div class="sr"><label>Price Axis</label><input type="range" id="sf-p" min="7" max="16" value="10" style="flex:1;"><span class="srv" id="sf-p-v">10</span></div>
          <div class="sr"><label>Time Axis</label><input type="range" id="sf-t" min="7" max="16" value="9" style="flex:1;"><span class="srv" id="sf-t-v">9</span></div>
          <div class="sr"><label>OHLCV Tip</label><input type="range" id="sf-o" min="9" max="18" value="12" style="flex:1;"><span class="srv" id="sf-o-v">12</span></div>
          <div class="sr"><label>UI Scale</label><input type="range" id="sf-ui" min="9" max="18" value="13" style="flex:1;"><span class="srv" id="sf-ui-v">13</span></div>
        </div>
        <div class="ss"><div class="sst">PRESETS</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="spb" data-pr="default">Default</button>
            <button class="spb" data-pr="gold">Gold</button>
            <button class="spb" data-pr="light">Light</button>
            <button class="spb" data-pr="nord">Nord</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;margin-top:8px;">
          <button id="s-save" class="sab" style="background:#D4AF37;color:#000;">💾 Save as Default</button>
          <span id="save-hint" style="font-size:8px;color:#4a6080;margin-top:2px;text-align:center;display:block;">...</span>
          <button id="s-reset" class="sab" style="border-color:#ef5350;color:#ef5350;">↺ Factory Reset</button>
        </div>
      </div>
    </div>
    <div id="tab-tools">
      <div style="padding:10px 14px;border-bottom:1px solid #1a1e2a;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#D4AF37;letter-spacing:1px;">⚙ TOOL SETTINGS</span>
        <span id="tools-ind-label" style="font-size:11px;font-weight:700;color:#6878a8;letter-spacing:.5px;background:#1a1e2e;padding:2px 8px;border-radius:3px;margin-left:8px;">SELECT TOOL</span>
        <button id="add-tool-btn" onclick="openAddToolPopup()" style="margin-left:auto;width:24px;height:24px;border-radius:50%;border:1px solid #D4AF37;color:#D4AF37;background:transparent;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;font-weight:700;">＋</button>
      </div>
      <!-- Add tool popup (centered modal) -->
      <div id="add-tool-popup" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:1000;display:none;align-items:center;justify-content:center;"></div>
      <div id="tools-body" style="flex:1;overflow-y:auto;padding:0;"></div>
    </div>
    <div id="tab-settings">
      <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#22d3ee;letter-spacing:1px;">⚙ SETTINGS</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:10px 14px;display:flex;flex-direction:column;gap:12px;">
        <div class="vs"><div class="vst">INPUT</div>
          <div class="vr"><label>Zoom Sensitivity</label><input id="is-zoom" type="range" min="0.05" max="0.4" step="0.01" value="0.15" style="flex:1;accent-color:#D4AF37;"><span id="is-zoom-v" class="vrv">0.15</span></div>
          <div class="vr"><label>Trackpad Pan</label><input id="is-tpan" type="range" min="0.1" max="2.0" step="0.05" value="0.5" style="flex:1;accent-color:#22d3ee;"><span id="is-tpan-v" class="vrv">0.50</span></div>
          <div class="vr"><label>Mouse Scroll</label><input id="is-mpan" type="range" min="0.2" max="3.0" step="0.1" value="1.0" style="flex:1;accent-color:#a78bfa;"><span id="is-mpan-v" class="vrv">1.0</span></div>
          <div class="vr"><label>Right Padding</label><input id="is-rpad" type="range" min="0" max="40" step="1" value="6" style="flex:1;accent-color:#22c55e;"><span id="is-rpad-v" class="vrv">6</span></div>
        </div>
        <div class="vs"><div class="vst">DISPLAY</div>
          <div class="vr"><label>Crosshair</label><input type="color" id="sc-cr2" value="#8ca0c8"><input id="sc-cro2" type="range" min="10" max="100" value="50" style="flex:1;accent-color:#D4AF37;"><span id="sc-cro2-v" class="vrv">50%</span></div>
          <div class="vr"><label>Price Labels</label><input id="sf-p2" type="range" min="7" max="16" value="10" style="flex:1;accent-color:#22d3ee;"><span id="sf-p2-v" class="vrv">10</span></div>
          <div class="vr"><label>Time Labels</label><input id="sf-t2" type="range" min="7" max="16" value="9" style="flex:1;accent-color:#a78bfa;"><span id="sf-t2-v" class="vrv">9</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          <button id="is-save" style="flex:2;padding:4px;border:1px solid #D4AF37;color:#000;background:#D4AF37;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">💾 SAVE</button>
          <button id="is-reset" style="flex:1;padding:4px;border:1px solid #ef5350;color:#ef5350;background:transparent;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;">↺ RESET</button>
        </div>
      </div>
    </div>
    <div id="tab-vault">
      <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:11px;font-weight:700;color:#a78bfa;letter-spacing:1px;">📦 INDICATOR VAULT</span>
      </div>
      <div id="vault-list" style="flex:1;overflow-y:auto;padding:6px;"></div>
    </div>
    <div id="tab-scan">
      <div id="scan-panel-header" style="display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid #111620;">
        <span style="font-size:11px;font-weight:700;color:#4ade80;letter-spacing:1px;">📡 SCANS</span>
        <span id="scan-count" style="margin-left:auto;font-size:11px;color:#8aa0c0;font-weight:700;"></span>
        <button id="scan-col-cog" title="Column settings" style="margin-left:6px;background:none;border:1px solid #3a4a68;color:#5a7090;font-size:13px;width:22px;height:22px;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:all .15s;" onmouseover="this.style.borderColor='#4ade80';this.style.color='#4ade80'" onmouseout="this.style.borderColor='#3a4a68';this.style.color='#5a7090'">⚙</button>
        <button id="scan-add-btn" title="Add scan" style="margin-left:4px;background:none;border:1px solid #4ade80;color:#4ade80;font-size:14px;width:22px;height:22px;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">+</button>
      </div>
      <div id="scan-panel-body" style="flex:1;overflow-y:auto;padding:8px;">
        <!-- Scan list: saved scans appear here -->
        <div id="scan-list" style="margin-bottom:8px;"></div>
        <!-- Run controls (shown for any selected scan) -->
        <div id="scan-run-controls" style="display:none;">
          <div style="display:flex;gap:5px;margin-bottom:6px;">
            <div id="scan-active-label" style="flex:1;background:#1a1e2e;border:1px solid #4ade80;color:#4ade80;font-size:11px;font-weight:700;padding:4px 6px;border-radius:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
            <button id="scan-run-btn" style="background:#4ade80;color:#000;border:none;font-size:11px;font-weight:700;padding:4px 12px;border-radius:3px;cursor:pointer;white-space:nowrap;">▶ SCAN</button>
          </div>
          <div style="display:flex;gap:4px;margin-bottom:6px;">
            <button class="scan-tab active" data-scantab="live" style="padding:4px 10px;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">LIVE</button>
            <button class="scan-tab" data-scantab="historical" style="padding:4px 10px;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">HIST</button>
          </div>
          <div id="scan-date-range" style="display:none;margin-bottom:6px;">
            <div style="display:flex;gap:5px;align-items:center;">
              <span style="font-size:11px;color:#6a80a0;font-weight:700;">FROM</span>
              <input id="scan-from" type="date" style="flex:1;background:#1a1e2e;border:1px solid #a855f7;color:#a855f7;font-size:11px;padding:3px 5px;border-radius:3px;outline:none;"/>
              <span style="font-size:11px;color:#6a80a0;font-weight:700;">TO</span>
              <input id="scan-to" type="date" style="flex:1;background:#1a1e2e;border:1px solid #a855f7;color:#a855f7;font-size:11px;padding:3px 5px;border-radius:3px;outline:none;"/>
            </div>
            <div style="display:flex;gap:4px;margin-top:4px;">
              <button class="scan-preset" data-days="30" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">1M</button>
              <button class="scan-preset" data-days="90" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">3M</button>
              <button class="scan-preset" data-days="180" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">6M</button>
              <button class="scan-preset" data-days="365" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">1Y</button>
              <button class="scan-preset" data-days="730" style="flex:1;background:none;border:1px solid #2a3050;color:#4a6080;font-size:11px;font-weight:700;padding:4px;border-radius:3px;cursor:pointer;">2Y</button>
            </div>
          </div>
          <div id="scan-filters" style="margin-bottom:6px;">
            <span style="font-size:11px;color:#6a80a0;font-weight:700;">FILTER:</span>
            <div style="display:flex;gap:4px;margin-top:3px;">
              <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#4ade80;cursor:pointer;border:1px solid #1e2840;padding:2px 6px;border-radius:3px;">
                <input type="radio" name="scan-filter" value="1" style="accent-color:#4ade80;"/> F1
              </label>
              <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#38bdf8;cursor:pointer;border:1px solid #1e2840;padding:2px 6px;border-radius:3px;">
                <input type="radio" name="scan-filter" value="2" style="accent-color:#38bdf8;"/> F2
              </label>
              <label style="display:flex;align-items:center;gap:3px;font-size:11px;color:#f59e0b;cursor:pointer;border:1px solid #1e2840;padding:2px 6px;border-radius:3px;">
                <input type="radio" name="scan-filter" value="3" checked style="accent-color:#f59e0b;"/> Both
              </label>
            </div>
          </div>
        </div>
        <div id="scan-status" style="font-size:11px;color:#8aa0c0;margin-bottom:6px;min-height:14px;"></div>
        <div id="scan-watchlist"></div>
        <div id="scan-historical" style="display:none;"></div>
      </div>
    </div>
    <div id="tab-bt">
      <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;">
        <span style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:1px;">⏱ BT — SAVED SCANS</span>
      </div>
      <div style="flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px;">
        <div id="scan-bt-active" style="padding:8px 10px;background:#0d1220;border:1px solid #1e2840;border-radius:4px;font-size:11px;color:#8aa0c0;line-height:1.5;">Select a saved scan in <span style="color:#4ade80;font-weight:700;">SCAN</span> to backtest it here.</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">SIDE</div>
            <select id="scan-bt-side" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;">
              <option value="long">▲ LONG</option>
              <option value="short">▼ SHORT</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">ENTRY</div>
            <select id="scan-bt-entry" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;">
              <option value="next_open">Next day open</option>
              <option value="trigger_break">Trigger break</option>
              <option value="signal_close">Signal close</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">STOP</div>
            <select id="scan-bt-stop" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;">
              <option value="signal">Setup bar extreme</option>
              <option value="pct">Fixed % stop</option>
            </select>
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">STOP %</div>
            <input id="scan-bt-stop-pct" type="number" min="0.1" step="0.5" value="5" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">TARGET (R)</div>
            <input id="scan-bt-target-r" type="number" min="0" step="0.25" value="2" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
          </div>
          <div>
            <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">MAX HOLD</div>
            <input id="scan-bt-hold-days" type="number" min="1" step="1" value="5" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
          </div>
        </div>

        <div>
          <div style="font-size:10px;color:#4a6080;font-weight:700;letter-spacing:.8px;margin-bottom:4px;">RISK / TRADE ($)</div>
          <input id="scan-bt-risk" type="number" min="1" step="50" value="1000" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:11px;padding:6px 8px;border-radius:4px;outline:none;" />
        </div>

        <div style="display:flex;gap:6px;">
          <button id="scan-bt-run-btn" style="flex:1;background:#f59e0b;color:#000;border:none;font-size:11px;font-weight:800;padding:7px 10px;border-radius:4px;cursor:pointer;">▶ RUN BT</button>
          <button id="scan-bt-review-btn" style="flex:1;background:#0d1220;border:1px solid #38bdf8;color:#38bdf8;font-size:11px;font-weight:800;padding:7px 10px;border-radius:4px;cursor:pointer;">📋 REVIEW</button>
        </div>

        <div id="scan-bt-status" style="font-size:11px;color:#8aa0c0;line-height:1.5;padding:8px 10px;background:#0a0c12;border:1px solid #1e2840;border-radius:4px;">Uses saved scan results + Polygon daily bars. Conservative fill model: if stop and target hit on the same bar, stop wins.</div>

        <div id="scan-bt-summary" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>

        <div style="font-size:10px;color:#4a6080;line-height:1.5;padding:8px 10px;border:1px dashed #2a3050;border-radius:4px;">
          MVP rules: daily bars only, no intraday sequencing, no overlapping-position controls yet. Review generated trades in the BT review sidebar.
        </div>
      </div>
    </div>
    <div id="tab-lab">
              <div style="padding:8px 12px;border-bottom:1px solid #111620;display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;font-weight:700;color:#c084fc;letter-spacing:1px;">🔬 STRATEGY LAB</span>
                <span style="flex:1"></span>
                <button id="lab-add-project" style="background:#c084fc;color:#000;border:none;font-size:10px;font-weight:800;padding:3px 8px;border-radius:3px;cursor:pointer;">+ NEW</button>
              </div>
        
              <div id="lab-projects-list" style="padding:6px 0;max-height:120px;overflow-y:auto;">
                <div style="padding:10px 14px;font-size:11px;color:#4a6080;">No strategy projects yet.</div>
              </div>
        
              <div id="lab-project-detail" style="display:none;padding:0;">
                <div id="lab-project-header" style="padding:8px 12px;border-bottom:1px solid #1e2840;display:flex;align-items:center;gap:6px;">
                  <button id="lab-back-btn" style="background:none;border:none;color:#4a6080;font-size:14px;cursor:pointer;">←</button>
                  <span id="lab-project-title" style="font-size:12px;font-weight:800;color:#c084fc;flex:1;"></span>
                  <span id="lab-project-status" style="font-size:10px;padding:2px 6px;border-radius:3px;font-weight:700;"></span>
                  <button id="lab-capture-btn" style="background:#c084fc;color:#000;border:none;font-size:10px;font-weight:800;padding:3px 8px;border-radius:3px;cursor:pointer;" title="Capture chart screenshot">📷</button>
                  <button id="lab-add-note-btn" style="background:none;border:1px solid #3a4a68;color:#8aa0c0;font-size:10px;font-weight:700;padding:3px 8px;border-radius:3px;cursor:pointer;">+ Note</button>
                </div>
        
                <div id="lab-phase-tabs" style="display:flex;border-bottom:1px solid #1e2840;overflow-x:auto;"></div>
        
                <div id="lab-entries" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;"></div>
              </div>
            </div>

  </div>
</div>

<!-- Generic Modal -->
<div id="modal-overlay" onclick="modalClose()"></div>
<div id="modal-box">
  <div id="modal-title"></div>
  <div id="modal-body"></div>
  <div id="modal-actions"></div>
</div>

<!-- Scan Add Modal -->
<div id="scan-add-modal">
  <div id="scan-add-box">
    <h3>＋ ADD SCAN</h3>
    <div style="padding:0 16px;overflow-y:auto;flex:1;">
      <!-- Tab selector -->
      <div style="display:flex;gap:4px;margin:10px 0 8px;">
        <button class="scan-add-tab active" data-addtab="upload" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:#1a2030;color:#4ade80;">📤 UPLOAD</button>
        <button class="scan-add-tab" data-addtab="builtin" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">📡 BUILT-IN</button>
        <button class="scan-add-tab" data-addtab="code" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">💻 CODE</button>
      </div>

      <!-- Name field -->
      <input type="text" id="scan-add-name" placeholder="Scan name (e.g. Inside Day — Q1 2025)" />

      <!-- Upload tab -->
      <div id="scan-add-upload" class="scan-add-panel">
        <div class="scan-upload-zone" id="scan-drop-zone">
          <div class="icon">📂</div>
          <p style="color:#dde3f0;font-weight:700;font-size:12px;">Drop file or click to upload</p>
          <p>CSV, JSON, or JS scan files</p>
          <input type="file" id="scan-file-input" accept=".csv,.json,.js,.py" style="display:none;" />
        </div>
        <div id="scan-file-info" style="display:none;padding:8px;background:#0d1220;border:1px solid #1e2840;border-radius:4px;margin-top:8px;font-size:11px;color:#8aa0c0;"></div>
      </div>

      <!-- Built-in tab -->
      <div id="scan-add-builtin" class="scan-add-panel" style="display:none;">
        <select id="scan-add-strategy" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:6px 10px;border-radius:4px;margin:4px 0;">
          <option value="inside_day_long">Inside Day Long</option>
        </select>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <div style="flex:1;">
            <label style="font-size:11px;color:#4a6080;">FROM</label>
            <input type="date" id="scan-add-from" style="width:100%;background:#141926;border:1px solid #2a3050;color:#a855f7;font-size:11px;padding:4px 6px;border-radius:3px;outline:none;" />
          </div>
          <div style="flex:1;">
            <label style="font-size:11px;color:#4a6080;">TO</label>
            <input type="date" id="scan-add-to" style="width:100%;background:#141926;border:1px solid #2a3050;color:#a855f7;font-size:11px;padding:4px 6px;border-radius:3px;outline:none;" />
          </div>
        </div>
        <p style="font-size:11px;color:#4a6080;margin-top:6px;">Creates a saved scan and runs it. Results are stored.</p>
      </div>

      <!-- Code tab -->
      <div id="scan-add-code" class="scan-add-panel" style="display:none;">
        <textarea id="scan-add-codearea" placeholder="// Paste scan code here...\n// Must export: function scan(dayMaps, dates, filterMode) → results[]" style="width:100%;height:140px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;padding:8px;border-radius:4px;resize:vertical;outline:none;"></textarea>
        <p style="font-size:11px;color:#4a6080;margin-top:4px;">JS code receives (dayMaps, dates, filterMode) and returns results[].</p>
      </div>
    </div>
    <div class="scan-modal-btns">
      <button class="btn-cancel" onclick="scanAddClose()">Cancel</button>
      <button class="btn-validate" id="scan-validate-btn" onclick="scanAddValidate()" style="background:#a855f7;color:#fff;">🤖 Validate & Fix</button>
      <button class="btn-save" id="scan-add-save" onclick="scanAddSave()">Save Scan</button>
    </div>
    <div id="scan-validate-result" style="display:none;padding:10px 16px;border-top:1px solid #1e2840;max-height:200px;overflow-y:auto;"></div>
  </div>
</div>

<div id="pct-popup">
  <div id="pct-popup-title" style="font-size:11px;letter-spacing:1px;font-weight:700;color:#ff9800;cursor:move;user-select:none;">LONG</div>
  <div style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5px 8px;">
    <label id="pct-price-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;display:none;">PRICE</label>
    <input id="pct-price-input" type="number" step="0.01" placeholder="price" style="background:#1e2436;border:1px solid #fbbf24;color:#fbbf24;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;display:none;"/>
    <label style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;">%&nbsp;RISK</label>
    <div style="display:flex;gap:4px;">
      <input id="pct-input" type="number" min="0" max="9999" step="1" placeholder="100" style="background:#1e2436;border:1px solid #2a3050;color:#dde3f0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;flex:1;min-width:0;"/>
      <button id="pct-rebuy" title="Re-add last sold qty" style="background:none;border:1px solid #ff9800;color:#ff9800;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;padding:2px 5px;border-radius:3px;cursor:pointer;white-space:nowrap;">↺ REBUY</button>
    </div>
    <label id="pct-stop-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;">STOP</label>
    <input id="pct-stop-input" type="number" step="0.0001" placeholder="price" style="background:#1e2436;border:1px solid #2a3050;color:#facc15;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;"/>
    <label id="pct-pnlrisk-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;display:none;">+BASE%</label>
    <input id="pct-pnlrisk-input" type="number" min="0" max="9999" step="1" placeholder="0" title="Use locked PnL + this% of Risk$ as risk budget" style="background:#1e2436;border:1px solid #2a3050;color:#a78bfa;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;display:none;"/>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="pct-mode-normal" style="flex:1;padding:2px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;cursor:pointer;border:1px solid #ff9800;background:#ff980018;color:#ff9800;" id="pct-mode-normal-label">% RISK</button>
    <button id="pct-mode-pnl" style="flex:1;padding:2px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">PNL + %</button>
  </div>
  <div id="pct-popup-hint" style="font-size:11px;color:#2a4060;margin-top:3px;line-height:1.4;min-height:12px;"></div>
  <div class="popup-btns">
    <button id="pct-ok">PLACE</button>
    <button class="cancel" id="pct-cancel">CANCEL</button>
  </div>
</div>

<div id="text-popup">
  <div style="font-size:11px;color:#a855f7;letter-spacing:1px;font-weight:700;">ANNOTATION TEXT</div>
  <input id="text-input" type="text" placeholder="Enter label…" maxlength="80"/>
  <div class="popup-btns">
    <button id="text-ok">PLACE</button>
    <button class="cancel" id="text-cancel">CANCEL</button>
  </div>
</div>

<script src="/indicators/vault.js"></script>

`
