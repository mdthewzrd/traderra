'use client'

/**
 * Overlays — modal popups, toasts, hints, and other overlay elements.
 * Extracted from charts-terminal.html lines 1085-1090 + modals section.
 */

export function Overlays() {
  return (
    <>
      <div id="fs-backdrop" />
      <div id="draw-hint" />
      <div id="toast" />

      {/* Generic Modal */}
      <div id="modal-overlay" />
      <div id="modal-box">
        <div id="modal-title" />
        <div id="modal-body" />
        <div id="modal-actions" />
      </div>

      {/* Scan Add Modal */}
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
            <textarea id="scan-code-input" style={{ width: '100%', height: 120, background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontFamily: 'monospace', fontSize: 11, padding: 8, borderRadius: 4, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} placeholder="// Your scan code here&#10;// Must export: function scan(bars, params) { ... }&#10;// Return: [{ ticker, date, signal: 'long'|'short' }]"></textarea>
          </div>
          <div className="scan-modal-btns">
            <button className="btn-cancel" id="scan-modal-cancel">Cancel</button>
            <button className="btn-validate" id="scan-validate-btn">🤖 Validate</button>
            <button className="btn-save" id="scan-save-btn" disabled>💾 Save</button>
          </div>
          <div id="scan-validate-result" style={{ display: 'none', padding: '8px 16px' }} />
        </div>
      </div>

      {/* Pct Popup */}
      <div id="pct-popup" />

      {/* Text Popup */}
      <div id="text-popup" />

      {/* Ind Settings Popup */}
      <div id="ind-settings-popup">
        <div id="ind-settings-header">
          <h3 id="ind-settings-title">INDICATOR SETTINGS</h3>
          <button id="ind-settings-close">✕</button>
        </div>
        <div id="ind-settings-body" />
      </div>

      {/* Ind Button Popup */}
      <div id="ind-btn-popup">
        <label>Select Indicator</label>
        <select id="ibp-ind-select" />
        <div className="ibp-params" id="ibp-params" />
        <button id="ibp-add-btn" style={{ marginTop: 8, padding: '4px 12px', background: '#D4AF37', border: 'none', borderRadius: 3, color: '#000', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Add Button</button>
      </div>

      {/* Column Settings */}
      <div id="col-settings-popup" style={{ display: 'none', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 360, maxHeight: '70vh', background: '#10131a', border: '1px solid #4ade80', borderRadius: 10, zIndex: 850, flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,.6)' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2535', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 13, color: '#4ade80', letterSpacing: 1 }}>COLUMN SETTINGS</h3>
          <button id="col-settings-close" style={{ background: 'none', border: 'none', color: '#5a6a88', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div id="col-settings-body" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} />
      </div>
    </>
  )
}
