'use client'

/**
 * TabSettings — Input settings: zoom sensitivity, pan speed, right padding, display options.
 * Element IDs preserved for charts-engine.js settingsSync() interop.
 */

export function TabSettings() {
  return (
    <div id="tab-settings">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', letterSpacing: 1 }}>⚙ SETTINGS</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Input */}
        <div className="vs">
          <div className="vst">INPUT</div>
          <div className="vr">
            <label>Zoom Sensitivity</label>
            <input id="is-zoom" type="range" min={0.05} max={0.4} step={0.01} defaultValue={0.15} style={{ flex: 1, accentColor: '#D4AF37' }} />
            <span id="is-zoom-v" className="vrv">0.15</span>
          </div>
          <div className="vr">
            <label>Trackpad Pan</label>
            <input id="is-tpan" type="range" min={0.1} max={2.0} step={0.05} defaultValue={0.5} style={{ flex: 1, accentColor: '#22d3ee' }} />
            <span id="is-tpan-v" className="vrv">0.50</span>
          </div>
          <div className="vr">
            <label>Mouse Scroll</label>
            <input id="is-mpan" type="range" min={0.2} max={3.0} step={0.1} defaultValue={1.0} style={{ flex: 1, accentColor: '#a78bfa' }} />
            <span id="is-mpan-v" className="vrv">1.0</span>
          </div>
          <div className="vr">
            <label>Right Padding</label>
            <input id="is-rpad" type="range" min={0} max={40} step={1} defaultValue={6} style={{ flex: 1, accentColor: '#22c55e' }} />
            <span id="is-rpad-v" className="vrv">6</span>
          </div>
        </div>

        {/* Display */}
        <div className="vs">
          <div className="vst">DISPLAY</div>
          <div className="vr">
            <label>Crosshair</label>
            <input type="color" id="sc-cr2" defaultValue="#8ca0c8" />
            <input id="sc-cro2" type="range" min={10} max={100} defaultValue={50} style={{ flex: 1, accentColor: '#D4AF37' }} />
            <span id="sc-cro2-v" className="vrv">50%</span>
          </div>
          <div className="vr">
            <label>Price Labels</label>
            <input id="sf-p2" type="range" min={7} max={16} defaultValue={10} style={{ flex: 1, accentColor: '#22d3ee' }} />
            <span id="sf-p2-v" className="vrv">10</span>
          </div>
          <div className="vr">
            <label>Time Labels</label>
            <input id="sf-t2" type="range" min={7} max={16} defaultValue={9} style={{ flex: 1, accentColor: '#a78bfa' }} />
            <span id="sf-t2-v" className="vrv">9</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button id="is-save" style={{ flex: 2, padding: 4, border: '1px solid #D4AF37', color: '#000', background: '#D4AF37', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>💾 SAVE</button>
          <button id="is-reset" style={{ flex: 1, padding: 4, border: '1px solid #ef5350', color: '#ef5350', background: 'transparent', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↺ RESET</button>
        </div>
      </div>
    </div>
  )
}
