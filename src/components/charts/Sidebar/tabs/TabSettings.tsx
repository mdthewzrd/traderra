'use client'

import { useState } from 'react'

/**
 * TabSettings — Input settings: zoom sensitivity, pan speed, right padding, display options.
 * Element IDs preserved for charts-engine.js settingsSync() interop.
 */

export function TabSettings() {
  // Bridge: sync settings sliders to charts-engine.js behavior
  const onSliderInput = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement
    const vEl = document.getElementById(id + '-v')
    if (el && vEl) vEl.textContent = parseFloat(el.value).toFixed(id === 'is-zoom' ? 2 : 1)
    // Save to localStorage like charts-engine.js does
    const iz = document.getElementById('is-zoom') as HTMLInputElement
    const it = document.getElementById('is-tpan') as HTMLInputElement
    const im = document.getElementById('is-mpan') as HTMLInputElement
    const rp = document.getElementById('is-rpad') as HTMLInputElement
    if (iz && it && im && rp) {
      localStorage.setItem('traderra-trackpad', JSON.stringify({
        zoomSens: +iz.value, trackPanSens: +it.value, mousePanSens: +im.value, rightPad: +rp.value
      }))
    }
    ;(window as any).RIGHT_PAD = rp ? +rp.value : 6
  }

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
            <input id="is-zoom" type="range" min={0.05} max={0.4} step={0.01} defaultValue={0.15} style={{ flex: 1, accentColor: '#D4AF37' }} onInput={() => onSliderInput('is-zoom')} />
            <span id="is-zoom-v" className="vrv">0.15</span>
          </div>
          <div className="vr">
            <label>Trackpad Pan</label>
            <input id="is-tpan" type="range" min={0.1} max={2.0} step={0.05} defaultValue={0.5} style={{ flex: 1, accentColor: '#22d3ee' }} onInput={() => onSliderInput('is-tpan')} />
            <span id="is-tpan-v" className="vrv">0.50</span>
          </div>
          <div className="vr">
            <label>Mouse Scroll</label>
            <input id="is-mpan" type="range" min={0.2} max={3.0} step={0.1} defaultValue={1.0} style={{ flex: 1, accentColor: '#a78bfa' }} onInput={() => onSliderInput('is-mpan')} />
            <span id="is-mpan-v" className="vrv">1.0</span>
          </div>
          <div className="vr">
            <label>Right Padding</label>
            <input id="is-rpad" type="range" min={0} max={40} step={1} defaultValue={6} style={{ flex: 1, accentColor: '#22c55e' }} onInput={() => onSliderInput('is-rpad')} />
            <span id="is-rpad-v" className="vrv">6</span>
          </div>
        </div>

        {/* Display */}
        <div className="vs">
          <div className="vst">DISPLAY</div>
          <div className="vr">
            <label>Crosshair</label>
            <input type="color" id="sc-cr2" defaultValue="#8ca0c8" onInput={() => (window as any).liveS?.()} />
            <input id="sc-cro2" type="range" min={10} max={100} defaultValue={50} style={{ flex: 1, accentColor: '#D4AF37' }} onInput={() => { const el = document.getElementById('sc-cro2') as HTMLInputElement; const v = document.getElementById('sc-cro2-v'); if (el && v) v.textContent = el.value + '%'; (window as any).liveS?.() }} />
            <span id="sc-cro2-v" className="vrv">50%</span>
          </div>
          <div className="vr">
            <label>Price Labels</label>
            <input id="sf-p2" type="range" min={7} max={16} defaultValue={10} style={{ flex: 1, accentColor: '#22d3ee' }} onInput={() => { const el = document.getElementById('sf-p2') as HTMLInputElement; const v = document.getElementById('sf-p2-v'); if (el && v) v.textContent = el.value; (window as any).liveS?.() }} />
            <span id="sf-p2-v" className="vrv">10</span>
          </div>
          <div className="vr">
            <label>Time Labels</label>
            <input id="sf-t2" type="range" min={7} max={16} defaultValue={9} style={{ flex: 1, accentColor: '#a78bfa' }} onInput={() => { const el = document.getElementById('sf-t2') as HTMLInputElement; const v = document.getElementById('sf-t2-v'); if (el && v) v.textContent = el.value; (window as any).liveS?.() }} />
            <span id="sf-t2-v" className="vrv">9</span>
          </div>
        </div>

        {/* Lines & Markers */}
        <div className="vs">
          <div className="vst">LINES & MARKERS</div>
          <ToggleRow label="PDC Line" id="set-pdc" defaultChecked={true} onChange={(v) => require('@/stores/charts/uiStore').useUIStore.getState().setShowPDC(v)} />
          <ToggleRow label="Target Line" id="set-target" defaultChecked={false} onChange={(v) => require('@/stores/charts/uiStore').useUIStore.getState().setShowTarget(v)} />
          <div className="vr">
            <label>Target Date</label>
            <input
              type="date"
              id="set-target-date"
              style={{ flex: 1, background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }}
              onChange={(e) => require('@/stores/charts/uiStore').useUIStore.getState().setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button id="is-save" style={{ flex: 2, padding: 4, border: '1px solid #D4AF37', color: '#000', background: '#D4AF37', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => (window as any).liveS?.()}>💾 SAVE</button>
          <button id="is-reset" style={{ flex: 1, padding: 4, border: '1px solid #ef5350', color: '#ef5350', background: 'transparent', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↺ RESET</button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({ label, id, defaultChecked, onChange }: { label: string; id: string; defaultChecked: boolean; onChange: (v: boolean) => void }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <div className="vr">
      <label>{label}</label>
      <button
        id={id}
        style={{
          background: checked ? '#26a69a18' : '#1a1e2a',
          border: `1px solid ${checked ? '#26a69a' : '#2a3050'}`,
          color: checked ? '#26a69a' : '#4a6080',
          fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 3, cursor: 'pointer',
          marginLeft: 'auto',
        }}
        onClick={() => { const v = !checked; setChecked(v); onChange(v) }}
      >{checked ? 'ON' : 'OFF'}</button>
    </div>
  )
}
