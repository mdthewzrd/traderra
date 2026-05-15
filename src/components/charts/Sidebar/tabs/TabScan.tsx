'use client'

/**
 * TabScan — Scan panel with saved scans, run controls, upload/builtin/code tabs.
 * Most content populated by charts-engine.js ScanManager.
 */

export function TabScan() {
  return (
    <div id="tab-scan">
      <div id="scan-panel-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #111620' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>📡 SCANS</span>
        <span id="scan-count" style={{ marginLeft: 'auto', fontSize: 11, color: '#8aa0c0', fontWeight: 700 }} />
        <button id="scan-col-cog" title="Column settings" style={{ marginLeft: 6, background: 'none', border: '1px solid #3a4a68', color: '#5a7090', fontSize: 13, width: 22, height: 22, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙</button>
        <button id="scan-add-btn" title="Add scan" style={{ marginLeft: 4, background: 'none', border: '1px solid #4ade80', color: '#4ade80', fontSize: 14, width: 22, height: 22, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
      <div id="scan-panel-body" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <div id="scan-list" style={{ marginBottom: 8 }} />
        <div id="scan-run-controls" style={{ display: 'none' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <div id="scan-active-label" style={{ flex: 1, background: '#1a1e2e', border: '1px solid #4ade80', color: '#4ade80', fontSize: 11, fontWeight: 700, padding: '4px 6px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
            <button id="scan-run-btn" style={{ background: '#4ade80', color: '#000', border: 'none', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ SCAN</button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button className="scan-tab active" data-scantab="live" style={{ padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #2a3050', background: 'none', color: '#4a6080' }}>LIVE</button>
            <button className="scan-tab" data-scantab="historical" style={{ padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #2a3050', background: 'none', color: '#4a6080' }}>HIST</button>
          </div>
          <div id="scan-date-range" style={{ display: 'none', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700 }}>FROM</span>
              <input id="scan-from" type="date" style={{ flex: 1, background: '#1a1e2e', border: '1px solid #a855f7', color: '#a855f7', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }} />
              <span style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700 }}>TO</span>
              <input id="scan-to" type="date" style={{ flex: 1, background: '#1a1e2e', border: '1px solid #a855f7', color: '#a855f7', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[{ l: '1M', d: 30 }, { l: '3M', d: 90 }, { l: '6M', d: 180 }, { l: '1Y', d: 365 }, { l: '2Y', d: 730 }].map(p => (
                <button key={p.d} className="scan-preset" data-days={p.d} style={{ flex: 1, background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, fontWeight: 700, padding: 4, borderRadius: 3, cursor: 'pointer' }}>{p.l}</button>
              ))}
            </div>
          </div>
          <div id="scan-filters" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#6a80a0', fontWeight: 700 }}>FILTER:</span>
            <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
              {[
                { value: '1', label: 'F1', color: '#4ade80' },
                { value: '2', label: 'F2', color: '#38bdf8' },
                { value: '3', label: 'Both', color: '#f59e0b', checked: true },
              ].map(f => (
                <label key={f.value} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: f.color, cursor: 'pointer', border: '1px solid #1e2840', padding: '2px 6px', borderRadius: 3 }}>
                  <input type="radio" name="scan-filter" value={f.value} defaultChecked={f.checked} style={{ accentColor: f.color }} /> {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div id="scan-status" style={{ fontSize: 11, color: '#8aa0c0', marginBottom: 6, minHeight: 14 }} />
        <div id="scan-watchlist" />
        <div id="scan-historical" style={{ display: 'none' }} />
      </div>
    </div>
  )
}
