'use client'

/**
 * MainArea — the main content area containing the React chart panel(s) and backtest sidebar.
 * Supports 1, 2, or 4 panel layouts.
 */

import { ReactChartPanel } from '@/components/charts/ChartCanvas/ReactChartPanel'
import { useUIStore } from '@/stores/charts/uiStore'

const BT_SIDEBAR_HTML = `
<div id="bt-sidebar">
  <div id="bt-header">
    <span id="bt-title">⏱ BACKTEST MODE</span>
    <button id="bt-close">✕</button>
  </div>
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
      <div style="font-size:11px;color:#4a6080;letter-spacing:.5px;margin-bottom:4px;">STRATEGY TYPE</div>
      <div style="display:flex;gap:5px;">
        <button id="bt-strat-long" style="flex:1;padding:3px 0;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a5580;letter-spacing:.5px;">▲ LONG</button>
        <button id="bt-strat-short" style="flex:1;padding:3px 0;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #ff5252;background:#ff525218;color:#ff5252;letter-spacing:.5px;">▼ SHORT</button>
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
      <button id="bt-hldt-btn" title="Highlight trade dates on chart" style="padding:2px 7px;border-radius:3px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #f59e0b;background:#f59e0b18;color:#f59e0b;letter-spacing:.5px;flex-shrink:0;">HLDT</button>
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
          <input id="bt-sim-riskpct" type="number" min="0.01" step="0.1" value="1" style="width:52px;background:#1a1e2e;border:1px solid #ef5350;color:#ef5350;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Risk per R as % of equity"/>
          <span id="btsim-rdollar" style="color:#ef535099;font-size:11px;font-weight:700;min-width:50px;">—</span>
          <button id="bt-sim-clear" style="background:none;border:1px solid #2a3050;color:#4a5580;font-size:8px;padding:1px 5px;border-radius:2px;cursor:pointer;">CLR</button>
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap;">
        <span style="color:#a78bfa;font-size:11px;font-weight:700;letter-spacing:0.5px;">EQ$</span>
        <input id="bt-sim-equity" type="number" min="0" step="1000" value="" placeholder="—" style="width:72px;background:#1a1e2e;border:1px solid #a78bfa;color:#a78bfa;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Account equity"/>
        <span style="color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:0.5px;">BP×</span>
        <input id="bt-sim-bpmult" type="number" min="1" max="10" step="1" value="4" style="width:36px;background:#1a1e2e;border:1px solid #f59e0b;color:#f59e0b;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Buying power multiplier (e.g. 4× for margin)"/>
        <span id="btsim-eq-summary" style="font-size:11px;color:#4a6080;margin-left:auto;"></span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="color:#34d399;font-size:11px;font-weight:700;letter-spacing:0.5px;">R$</span>
        <input id="bt-sim-rdirect" type="number" min="1" step="50" value="" placeholder="— override" style="width:90px;background:#1a1e2e;border:1px solid #34d399;color:#34d399;font-size:11px;font-weight:800;padding:2px 5px;border-radius:3px;outline:none;text-align:right;" title="Direct R dollar amount — overrides EQ$×R% when set"/>
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
        <button id="review-save-btn" style="flex:1;background:#0d1a2e;border:1px solid #38bdf8;color:#38bdf8;font-size:11px;font-weight:700;padding:4px 0;border-radius:3px;cursor:pointer;letter-spacing:0.5px;">💾 SAVE REVIEW</button>
        <button id="review-load-btn" style="flex:1;background:#0d1a2e;border:1px solid #a855f7;color:#a855f7;font-size:11px;font-weight:700;padding:4px 0;border-radius:3px;cursor:pointer;letter-spacing:0.5px;">📂 LOAD REVIEW</button>
        <input type="file" id="review-file-input" accept=".json" style="display:none;"/>
      </div>
      <div id="review-status" style="display:none;margin-top:4px;font-size:11px;font-weight:700;padding:2px 5px;border-radius:2px;text-align:center;"></div>
    </div>
  </div>
  <div id="bt-divider" style="height:6px;background:#1e2840;cursor:ns-resize;flex-shrink:0;display:flex;align-items:center;justify-content:center;user-select:none;">
    <div class="bt-div-pip"></div>
  </div>
  <div id="bt-list" style="flex:1;overflow-y:auto;overflow-x:hidden;min-height:40px;"></div>
</div>
`

export function MainArea() {
  const activeLayout = useUIStore(s => s.activeLayout)
  const fullscreenPanel = useUIStore(s => s.fullscreenPanel)
  const sidebarOpen = useUIStore(s => s.sidebarOpen)

  const maStyle = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    marginRight: sidebarOpen ? 340 : 0,
    marginLeft: 38,
    transition: 'margin-right 0.15s ease',
    ...extra,
  })

  if (fullscreenPanel !== null) {
    return (
      <div id="main-area" style={maStyle()}>
        <ReactChartPanel panelIdx={fullscreenPanel} />
        <div dangerouslySetInnerHTML={{ __html: BT_SIDEBAR_HTML }} />
      </div>
    )
  }

  if (activeLayout === 2) {
    return (
      <div id="main-area" style={maStyle({ display: 'flex', flexDirection: 'column' })}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactChartPanel panelIdx={0} />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <ReactChartPanel panelIdx={1} />
        </div>
        <div style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: BT_SIDEBAR_HTML }} />
      </div>
    )
  }

  if (activeLayout === 4) {
    return (
      <div id="main-area" style={maStyle({ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2 })}>
        <ReactChartPanel panelIdx={0} />
        <ReactChartPanel panelIdx={1} />
        <ReactChartPanel panelIdx={2} />
        <ReactChartPanel panelIdx={3} />
        <div style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: BT_SIDEBAR_HTML }} />
      </div>
    )
  }

  return (
    <div id="main-area" style={maStyle({ display: 'flex' })}>
      <ReactChartPanel panelIdx={0} />
      <div dangerouslySetInnerHTML={{ __html: BT_SIDEBAR_HTML }} />
    </div>
  )
}
