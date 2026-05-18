'use client'

import { useState, useEffect } from 'react'
import { useUIStore } from '@/stores/charts/uiStore'
import { C, F } from '@/lib/charts/theme'

/**
 * TabSettings — Input settings: zoom sensitivity, pan speed, right padding, display options.
 * All settings write to uiStore for React render loop consumption.
 */

export function TabSettings() {
  const zoomSens = useUIStore(s => s.zoomSens)
  const trackPanSens = useUIStore(s => s.trackPanSens)
  const mousePanSens = useUIStore(s => s.mousePanSens)
  const rightPad = useUIStore(s => s.rightPad)

  const onSliderInput = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement
    const vEl = document.getElementById(id + '-v')
    const val = parseFloat(el?.value || '0')
    if (el && vEl) vEl.textContent = val.toFixed(id === 'is-zoom' ? 2 : 1)

    // Write to uiStore
    const store = useUIStore.getState()
    if (id === 'is-zoom') store.setZoomSens(val)
    else if (id === 'is-tpan') store.setTrackPanSens(val)
    else if (id === 'is-mpan') store.setMousePanSens(val)
    else if (id === 'is-rpad') store.setRightPad(val)

    // Also save to localStorage for persistence
    const iz = document.getElementById('is-zoom') as HTMLInputElement
    const it = document.getElementById('is-tpan') as HTMLInputElement
    const im = document.getElementById('is-mpan') as HTMLInputElement
    const rp = document.getElementById('is-rpad') as HTMLInputElement
    if (iz && it && im && rp) {
      localStorage.setItem('traderra-trackpad', JSON.stringify({
        zoomSens: +iz.value, trackPanSens: +it.value, mousePanSens: +im.value, rightPad: +rp.value
      }))
    }
  }

  // Display section: update C and F directly
  const onDisplaySlider = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement
    const vEl = document.getElementById(id + '-v')
    if (!el) return
    if (vEl) vEl.textContent = id === 'sc-cro2' ? el.value + '%' : el.value

    if (id === 'sc-cro2') {
      const col = (document.getElementById('sc-cr2') as HTMLInputElement)?.value || '#8ca0c8'
      C.cross = `rgba(${hexRgb(col).r},${hexRgb(col).g},${hexRgb(col).b},${(+el.value / 100).toFixed(2)})`
    } else if (id === 'sf-p2') F.p = +el.value
    else if (id === 'sf-t2') F.t = +el.value
  }

  // Load saved settings on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('traderra-trackpad') || '{}')
      if (saved.zoomSens != null) {
        const store = useUIStore.getState()
        store.setZoomSens(saved.zoomSens)
        store.setTrackPanSens(saved.trackPanSens)
        store.setMousePanSens(saved.mousePanSens)
        store.setRightPad(saved.rightPad)
        // Update DOM inputs
        const setVal = (id: string, v: number) => {
          const el = document.getElementById(id) as HTMLInputElement
          if (el) el.value = String(v)
        }
        setVal('is-zoom', saved.zoomSens)
        setVal('is-tpan', saved.trackPanSens)
        setVal('is-mpan', saved.mousePanSens)
        setVal('is-rpad', saved.rightPad)
        // Update value displays
        const setText = (id: string, v: number) => {
          const el = document.getElementById(id)
          if (el) el.textContent = v.toFixed(id === 'is-zoom-v' ? 2 : 1)
        }
        setText('is-zoom-v', saved.zoomSens)
        setText('is-tpan-v', saved.trackPanSens)
        setText('is-mpan-v', saved.mousePanSens)
        setText('is-rpad-v', saved.rightPad)
      }
    } catch {}
  }, [])

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
            <input id="is-zoom" type="range" min={0.05} max={0.4} step={0.01} defaultValue={zoomSens} style={{ flex: 1, accentColor: '#D4AF37' }} onInput={() => onSliderInput('is-zoom')} />
            <span id="is-zoom-v" className="vrv">{zoomSens.toFixed(2)}</span>
          </div>
          <div className="vr">
            <label>Trackpad Pan</label>
            <input id="is-tpan" type="range" min={0.1} max={2.0} step={0.05} defaultValue={trackPanSens} style={{ flex: 1, accentColor: '#22d3ee' }} onInput={() => onSliderInput('is-tpan')} />
            <span id="is-tpan-v" className="vrv">{trackPanSens.toFixed(1)}</span>
          </div>
          <div className="vr">
            <label>Mouse Scroll</label>
            <input id="is-mpan" type="range" min={0.2} max={3.0} step={0.1} defaultValue={mousePanSens} style={{ flex: 1, accentColor: '#a78bfa' }} onInput={() => onSliderInput('is-mpan')} />
            <span id="is-mpan-v" className="vrv">{mousePanSens.toFixed(1)}</span>
          </div>
          <div className="vr">
            <label>Right Padding</label>
            <input id="is-rpad" type="range" min={0} max={40} step={1} defaultValue={rightPad} style={{ flex: 1, accentColor: '#22c55e' }} onInput={() => onSliderInput('is-rpad')} />
            <span id="is-rpad-v" className="vrv">{rightPad}</span>
          </div>
        </div>

        {/* Display */}
        <div className="vs">
          <div className="vst">DISPLAY</div>
          <div className="vr">
            <label>Crosshair</label>
            <input type="color" id="sc-cr2" defaultValue="#8ca0c8" onInput={() => onDisplaySlider('sc-cro2')} />
            <input id="sc-cro2" type="range" min={10} max={100} defaultValue={50} style={{ flex: 1, accentColor: '#D4AF37' }} onInput={() => onDisplaySlider('sc-cro2')} />
            <span id="sc-cro2-v" className="vrv">50%</span>
          </div>
          <div className="vr">
            <label>Price Labels</label>
            <input id="sf-p2" type="range" min={7} max={16} defaultValue={F.p} style={{ flex: 1, accentColor: '#22d3ee' }} onInput={() => onDisplaySlider('sf-p2')} />
            <span id="sf-p2-v" className="vrv">{F.p}</span>
          </div>
          <div className="vr">
            <label>Time Labels</label>
            <input id="sf-t2" type="range" min={7} max={16} defaultValue={F.t} style={{ flex: 1, accentColor: '#a78bfa' }} onInput={() => onDisplaySlider('sf-t2')} />
            <span id="sf-t2-v" className="vrv">{F.t}</span>
          </div>
        </div>

        {/* Lines & Markers */}
        <div className="vs">
          <div className="vst">LINES & MARKERS</div>
          <ToggleRow label="PDC Line" id="set-pdc" defaultChecked={true} onChange={(v) => useUIStore.getState().setShowPDC(v)} />
          <ToggleRow label="Target Line" id="set-target" defaultChecked={false} onChange={(v) => useUIStore.getState().setShowTarget(v)} />
          <div className="vr">
            <label>Target Date</label>
            <input
              type="date"
              id="set-target-date"
              style={{ flex: 1, background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }}
              onChange={(e) => useUIStore.getState().setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button id="is-save" style={{ flex: 2, padding: 4, border: '1px solid #D4AF37', color: '#000', background: '#D4AF37', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => {
            localStorage.setItem('traderra-trackpad', JSON.stringify({ zoomSens: useUIStore.getState().zoomSens, trackPanSens: useUIStore.getState().trackPanSens, mousePanSens: useUIStore.getState().mousePanSens, rightPad: useUIStore.getState().rightPad }))
            const btn = document.getElementById('is-save')
            if (btn) { btn.textContent = '✓ SAVED'; setTimeout(() => { btn.textContent = '💾 SAVE' }, 1500) }
          }}>💾 SAVE</button>
          <button id="is-reset" style={{ flex: 1, padding: 4, border: '1px solid #ef5350', color: '#ef5350', background: 'transparent', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => {
            const store = useUIStore.getState()
            store.setZoomSens(0.15); store.setTrackPanSens(0.5); store.setMousePanSens(1.0); store.setRightPad(6)
            localStorage.removeItem('traderra-trackpad')
            // Reset DOM
            const setVal = (id: string, v: string) => { const el = document.getElementById(id) as HTMLInputElement; if (el) el.value = v }
            setVal('is-zoom', '0.15'); setVal('is-tpan', '0.5'); setVal('is-mpan', '1.0'); setVal('is-rpad', '6')
          }}>↺ RESET</button>
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

function hexRgb(col: string) {
  const hex = col.replace('#', '')
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
}
