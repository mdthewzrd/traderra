'use client'

/**
 * MainArea — the main content area containing the grid and backtest sidebar.
 * Extracted from charts-terminal.html lines 984-1084.
 */

export function MainArea() {
  return (
    <div id="main-area" style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', transition: 'margin-right 0.15s ease', marginRight: 350, marginLeft: 38 }}>
      <div id="grid" />
      <BacktestSidebar />
    </div>
  )
}

function BacktestSidebar() {
  return (
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
  )
}
