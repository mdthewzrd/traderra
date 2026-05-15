'use client'

/**
 * TabBt — Backtest controls for saved scans: side, entry, stop, target, risk.
 */

export function TabBt() {
  const selectStyle: React.CSSProperties = { width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }
  const inputStyle: React.CSSProperties = { width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }
  const labelStyle: React.CSSProperties = { fontSize: 10, color: '#4a6080', fontWeight: 700, letterSpacing: 0.8, marginBottom: 4 }

  return (
    <div id="tab-bt">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 1 }}>⏱ BT — SAVED SCANS</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div id="scan-bt-active" style={{ padding: '8px 10px', background: '#0d1220', border: '1px solid #1e2840', borderRadius: 4, fontSize: 11, color: '#8aa0c0', lineHeight: 1.5 }}>
          Select a saved scan in <span style={{ color: '#4ade80', fontWeight: 700 }}>SCAN</span> to backtest it here.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={labelStyle}>SIDE</div>
            <select id="scan-bt-side" style={selectStyle}>
              <option value="long">▲ LONG</option>
              <option value="short">▼ SHORT</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>ENTRY</div>
            <select id="scan-bt-entry" style={selectStyle}>
              <option value="next_open">Next day open</option>
              <option value="trigger_break">Trigger break</option>
              <option value="signal_close">Signal close</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>STOP</div>
            <select id="scan-bt-stop" style={selectStyle}>
              <option value="signal">Setup bar extreme</option>
              <option value="pct">Fixed % stop</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>STOP %</div>
            <input id="scan-bt-stop-pct" type="number" min={0.1} step={0.5} defaultValue={5} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>TARGET (R)</div>
            <input id="scan-bt-target-r" type="number" min={0} step={0.25} defaultValue={2} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>MAX HOLD</div>
            <input id="scan-bt-hold-days" type="number" min={1} step={1} defaultValue={5} style={inputStyle} />
          </div>
        </div>

        <div>
          <div style={labelStyle}>RISK / TRADE ($)</div>
          <input id="scan-bt-risk" type="number" min={1} step={50} defaultValue={1000} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button id="scan-bt-run-btn" style={{ flex: 1, background: '#f59e0b', color: '#000', border: 'none', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 4, cursor: 'pointer' }}>▶ RUN BT</button>
          <button id="scan-bt-review-btn" style={{ flex: 1, background: '#0d1220', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: 11, fontWeight: 800, padding: '7px 10px', borderRadius: 4, cursor: 'pointer' }}>📋 REVIEW</button>
        </div>

        <div id="scan-bt-status" style={{ fontSize: 11, color: '#8aa0c0', lineHeight: 1.5, padding: '8px 10px', background: '#0a0c12', border: '1px solid #1e2840', borderRadius: 4 }}>
          Uses saved scan results + Polygon daily bars. Conservative fill model: if stop and target hit on the same bar, stop wins.
        </div>

        <div id="scan-bt-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }} />
      </div>
    </div>
  )
}
