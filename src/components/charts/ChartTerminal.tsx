'use client'

import { useEffect, useRef, useState } from 'react'

interface ChartTerminalProps {
  defaultSymbol?: string
  defaultTimeframe?: string
}

export function ChartTerminal({ defaultSymbol = 'AAPL', defaultTimeframe = '5' }: ChartTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!containerRef.current || initialized.current) return
    initialized.current = true

    // Set Polygon API key on window for the engine to pick up
    ;(window as any).__POLY_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY

    const container = containerRef.current

    // Load CSS
    const loadCSS = () => new Promise<void>((resolve) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/charts/charts.css'
      link.onload = () => resolve()
      document.head.appendChild(link)
    })

    // Build the HTML structure for the chart
    const html = `
      <div id="topbar">
        <span id="logo">TRADERRA</span>
        <div class="sep"></div>
        <input id="symbol-input" value="${defaultSymbol}" spellcheck="false" autocomplete="off" />
        <div class="sep"></div>
        <div class="tf-wrap" id="top-tf-wrap">
          <button class="tbtn tf" data-tf="1">1m</button>
          <button class="tbtn tf" data-tf="2">2m</button>
          <button class="tbtn tf" data-tf="5">5m</button>
          <button class="tbtn tf" data-tf="15">15m</button>
          <button class="tbtn tf" data-tf="30">30m</button>
          <button class="tbtn tf" data-tf="60">1h</button>
          <button class="tbtn tf" data-tf="240">4h</button>
          <button class="tbtn tf" data-tf="D">D</button>
          <button class="tbtn tf" data-tf="W">W</button>
          <button class="tbtn tf" data-tf="M">Mo</button>
        </div>
        <div class="sep"></div>
        <button id="load-btn" class="tbtn">Load</button>
        <button id="live-btn" class="tbtn">Live</button>
        <button id="price-line-btn" class="tbtn">Price</button>
        <div class="sep"></div>
        <div class="tool-group">
          <button class="tool-btn" data-tool="trendline">TL</button>
          <button class="tool-btn" data-tool="fib_ret">Fib</button>
          <button class="tool-btn" data-tool="box_orange">Box+</button>
          <button class="tool-btn" data-tool="box_yellow">Box*</button>
          <button class="tool-btn" data-tool="hl_cyan">HL</button>
          <button class="tool-btn" data-tool="hl_magenta">HL*</button>
          <button class="tool-btn" data-tool="hl_green">HL**</button>
          <button class="tool-btn" data-tool="hl_white">HLw</button>
          <button class="tool-btn" data-tool="text_orange">Txt</button>
          <button class="tool-btn" data-tool="entry_arrow">Entry</button>
          <button class="tool-btn" data-tool="exit_arrow">Exit</button>
          <button class="tool-btn" data-tool="short_arrow">Short</button>
          <button class="tool-btn" data-tool="cover_arrow">Cover</button>
          <button class="tool-btn" data-tool="stop_line">Stop</button>
          <button class="tool-btn" data-tool="trail_stop">Trail</button>
          <button class="tool-btn" data-tool="edit">Edit</button>
          <button class="tool-btn" data-tool="del">Del</button>
        </div>
        <div class="sep"></div>
        <button id="clr-btn" class="tool-btn" data-tool="clr">Clr</button>
        <div id="ticker-info"></div>
      </div>

      <div id="main-area" style="flex:1;display:flex;min-height:0;overflow:hidden;transition:margin-right 0.15s ease;">
        <div id="grid"></div>
        <div id="bt-sidebar">
          <div id="bt-header"><span id="bt-title">Backtest</span><button id="bt-close">&times;</button></div>
          <div id="bt-top-pane" style="overflow-y:auto;overflow-x:hidden;flex-shrink:0;">
            <div id="bt-upload-area">
              <div id="bt-drop">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a5580" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div id="bt-drop-label">Drop <span>CSV</span> or click to upload<br>entry/exit execution file</div>
              </div>
              <input type="file" id="bt-file" accept=".csv,.txt" style="display:none">
            </div>
            <div id="bt-stats">
              <div class="bs-row"><span class="bs-l">Trades</span><span class="bs-v" id="bs-trades">—</span></div>
              <div class="bs-row"><span class="bs-l">Gross</span><span class="bs-v" id="bs-gross">—</span></div>
              <div class="bs-row"><span class="bs-l">Wins</span><span class="bs-v" id="bs-wins">—</span></div>
              <div class="bs-row"><span class="bs-l">Win %</span><span class="bs-v" id="bs-winPct">—</span></div>
              <div class="bs-row"><span class="bs-l">Avg \$</span><span class="bs-v" id="bs-avg">—</span></div>
              <div class="bs-row"><span class="bs-l">PF</span><span class="bs-v" id="bs-pf">—</span></div>
              <div class="bs-row"><span class="bs-l">DD</span><span class="bs-v" id="bs-dd">—</span></div>
            </div>
            <div id="bt-strategy" style="display:none;padding:5px 10px;border-bottom:1px solid #1e2840;flex-shrink:0;">
              <span style="font-size:10px;color:#4a5580;">Strategy</span>
              <select id="bt-strat-sel" style="width:100%;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 5px;border-radius:3px;margin-top:2px;">
                <option value="short">Short</option><option value="long">Long</option>
              </select>
            </div>
            <div id="bt-filter">
              <span style="font-size:10px;color:#4a5580;letter-spacing:.5px;">SHOW</span>
              <div style="display:flex;gap:4px;margin-top:3px;">
                <button class="ptog on" data-ind="btexec">Exec</button>
                <button class="ptog on" data-ind="exec">Man</button>
                <button class="ptog on" data-ind="tl">TL</button>
                <button class="ptog on" data-ind="ann">Ann</button>
              </div>
            </div>
            <div id="bt-range-cfg" style="display:none;padding:6px 10px;border-bottom:1px solid #1e2840;background:#0d0f18;">
              <span style="font-size:10px;color:#4a5580;letter-spacing:.5px;">LOOKBACK/FORWARD</span>
              <div id="bt-panel-ranges"></div>
            </div>
            <div id="bt-sim" style="display:none;padding:8px 10px;background:#080b12;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:11px;">
                <div><span style="color:#4a5580;">Entry</span><div id="bt-sim-entry" style="color:#dde3f0;font-weight:700;"></div></div>
                <div><span style="color:#4a5580;">Exit</span><div id="bt-sim-exit" style="color:#dde3f0;font-weight:700;"></div></div>
                <div><span style="color:#4a5580;">Shares</span><div id="bt-sim-shares" style="color:#dde3f0;font-weight:700;"></div></div>
                <div><span style="color:#4a5580;">P&L</span><div id="bt-sim-pnl" style="font-weight:700;"></div></div>
              </div>
              <div id="bt-sim-legs" style="margin-bottom:6px;font-size:11px;color:#8aa0c0;min-height:14px;line-height:1.6;font-weight:600;"></div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">
                <span style="font-size:9px;color:#4a5580;letter-spacing:.5px;">RISK</span>
                <input id="sim-risk" type="number" value="1000" step="100" style="width:70px;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:10px;padding:2px 5px;border-radius:3px;">
                <span style="font-size:9px;color:#4a5580;letter-spacing:.5px;">BP</span>
                <input id="sim-bp" type="number" value="50000" step="1000" style="width:80px;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:10px;padding:2px 5px;border-radius:3px;">
              </div>
              <div id="btsim-bp-warn" style="display:none;margin-top:4px;padding:3px 6px;background:rgba(239,83,80,0.15);border:1px solid #ef5350;border-radius:3px;font-size:10px;font-weight:700;color:#ef5350;"></div>
              <div style="margin-top:6px;font-size:9px;color:#4a5580;letter-spacing:.5px;">SIZE</div>
              <div id="sim-size" style="margin-top:3px;padding:4px 6px;background:#10131a;border-radius:4px;font-size:11px;color:#8aa0c0;line-height:1.6;"></div>
              <div id="review-status" style="display:none;margin-top:4px;font-size:9px;font-weight:700;padding:2px 5px;border-radius:2px;text-align:center;"></div>
            </div>
          </div>
          <div id="bt-divider" style="height:6px;background:#1e2840;cursor:ns-resize;flex-shrink:0;display:flex;align-items:center;justify-content:center;user-select:none;">
            <div style="width:30px;height:2px;background:#2a3a5a;border-radius:1px;"></div>
          </div>
          <div id="bt-list" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:40px;"></div>
        </div>
      </div>

      <div id="fs-backdrop"></div>
      <div id="draw-hint"></div>
      <div id="toast"></div>

      <div id="scan-panel">
        <div id="scan-panel-header">
          <span id="scan-panel-title">Scanner</span>
          <button id="scan-panel-close">&times;</button>
        </div>
        <div id="scan-panel-body">
          <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">
            <input id="scan-symbol" placeholder="Ticker" style="flex:1;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:4px 8px;border-radius:4px;text-transform:uppercase;">
            <button id="scan-go" class="tbtn" style="background:#D4AF37!important;border-color:#D4AF37!important;color:#000!important;font-size:11px;padding:4px 10px;">Scan</button>
          </div>
          <div id="scan-date-range" style="display:none;margin-bottom:6px;">
            <div style="display:flex;gap:4px;align-items:center;">
              <input id="scan-from" type="date" style="flex:1;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:10px;padding:2px 5px;border-radius:3px;color-scheme:dark;">
              <span style="color:#4a5580;font-size:10px;">→</span>
              <input id="scan-to" type="date" style="flex:1;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:10px;padding:2px 5px;border-radius:3px;color-scheme:dark;">
            </div>
          </div>
          <div id="scan-filters" style="margin-bottom:6px;">
            <div style="display:flex;gap:4px;flex-wrap:wrap;">
              <button class="scan-filter active" data-mode="topvol">Top Vol</button>
              <button class="scan-filter" data-mode="gappers">Gappers</button>
              <button class="scan-filter" data-mode="momentum">Momentum</button>
              <button class="scan-filter" data-mode="earnings">Earnings</button>
            </div>
          </div>
          <div id="scan-status" style="font-size:11px;color:#8aa0c0;margin-bottom:6px;min-height:14px;line-height:1.5;"></div>
          <div id="scan-watchlist"></div>
          <div id="scan-historical" style="display:none;"></div>
        </div>
      </div>

      <div id="pct-popup">
        <div id="pct-popup-title" style="font-size:10px;letter-spacing:1px;font-weight:700;color:#ff9800;cursor:move;user-select:none;">LONG</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;">
          <span style="font-size:10px;color:#4a5580;">Price</span>
          <input id="pct-price" type="number" step="0.01" style="background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 6px;border-radius:3px;">
          <span style="font-size:10px;color:#4a5580;">Stop</span>
          <input id="pct-stop-input" type="number" step="0.01" style="background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 6px;border-radius:3px;">
          <span style="font-size:10px;color:#4a5580;">Shares</span>
          <input id="pct-shares" type="number" step="1" style="background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 6px;border-radius:3px;">
          <span style="font-size:10px;color:#4a5580;">Risk</span>
          <input id="pct-risk" type="number" value="1000" step="100" style="background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 6px;border-radius:3px;">
          <span style="font-size:10px;color:#4a5580;">BP</span>
          <input id="pct-bp" type="number" value="50000" step="1000" style="background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 6px;border-radius:3px;">
          <span style="font-size:10px;color:#4a5580;">Notes</span>
          <input id="pct-notes" style="background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:3px 6px;border-radius:3px;">
        </div>
        <div id="pct-popup-hint" style="font-size:9px;color:#2a4060;margin-top:3px;line-height:1.4;min-height:12px;"></div>
        <div class="popup-btns" style="display:flex;gap:6px;margin-top:4px;">
          <button id="pct-ok">Save</button><button id="pct-cancel">Cancel</button>
        </div>
      </div>

      <div id="text-popup">
        <input id="text-input" placeholder="Note..." style="width:100%;background:#181d28;border:1px solid #2a3050;color:#dde3f0;font-family:'Courier New',monospace;font-size:11px;padding:4px 8px;border-radius:4px;">
      </div>
    `

    container.innerHTML = html

    // Load the chart engine script
    const script = document.createElement('script')
    script.src = '/charts/chart-engine.js'
    script.onload = () => {
      // The engine auto-initializes when it sees the DOM elements
      // Trigger the default symbol load
      const loadBtn = document.getElementById('load-btn')
      if (loadBtn) loadBtn.click()
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup
      if (container) container.innerHTML = ''
      initialized.current = false
    }
  }, [defaultSymbol, defaultTimeframe])

  return (
    <div
      ref={containerRef}
      className="chart-terminal-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 56px)',
        background: '#0c0e14',
        color: '#dde3f0',
        fontFamily: "'Courier New', monospace",
        fontSize: '13px',
        overflow: 'hidden',
      }}
    />
  )
}
