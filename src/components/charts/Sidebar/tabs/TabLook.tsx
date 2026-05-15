'use client'

/**
 * TabLook — Theme customization: candle colors, background, sessions, crosshair, font sizes.
 * All element IDs preserved for charts-engine.js initS() interop.
 */

export function TabLook() {
  return (
    <div id="tab-look">
      <div id="settings-panel-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ LOOK & FEEL</span>
        <span id="theme-editing-label" style={{ fontSize: 11, fontWeight: 700, color: '#6878a8', letterSpacing: 0.5, background: '#1a1e2e', padding: '2px 8px', borderRadius: 3 }}>EDITING: DARK</span>
      </div>
      <div id="settings-panel-body">
        {/* Candles */}
        <div className="ss">
          <div className="sst">CANDLES</div>
          <SettingRow label="Up"><ColorInput id="sc-up" defaultValue="#26a69a" /></SettingRow>
          <SettingRow label="Down"><ColorInput id="sc-dn" defaultValue="#ef5350" /></SettingRow>
          <SettingRow label="Vol Up"><ColorInput id="sc-vu" defaultValue="#26a69a" /></SettingRow>
          <SettingRow label="Vol Down"><ColorInput id="sc-vd" defaultValue="#ef5350" /></SettingRow>
          <div className="sr" style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid #1a1e2a' }}>
            <label>Filter Prints</label>
            <button id="sc-clean" style={{ background: '#e879f918', border: '1px solid #e879f9', color: '#e879f9', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 3, cursor: 'pointer' }}>ON</button>
            <span style={{ fontSize: 11, color: '#4a6080', marginLeft: 4 }}>Drop fake bars</span>
          </div>
        </div>

        {/* Background */}
        <div className="ss">
          <div className="sst">BACKGROUND</div>
          <SettingRow label="Chart"><ColorInput id="sc-bg" defaultValue="#0c0e14" /></SettingRow>
          <SettingRow label="Axis"><ColorInput id="sc-ax" defaultValue="#0d0f18" /></SettingRow>
          <SettingRow label="Grid"><ColorInput id="sc-gr" defaultValue="#141926" /></SettingRow>
          <SettingRow label="Border"><ColorInput id="sc-bd" defaultValue="#1e2535" /></SettingRow>
        </div>

        {/* Sessions */}
        <div className="ss">
          <div className="sst">SESSIONS</div>
          <SettingRow label="Pre-Mkt">
            <ColorInput id="sc-pre" defaultValue="#787878" />
            <SliderInput id="sc-preo" min={1} max={40} defaultValue={7} />
            <span className="srv" id="sc-preo-v">7%</span>
          </SettingRow>
          <SettingRow label="After-Hrs">
            <ColorInput id="sc-aft" defaultValue="#3c3c3c" />
            <SliderInput id="sc-afto" min={1} max={40} defaultValue={9} />
            <span className="srv" id="sc-afto-v">9%</span>
          </SettingRow>
        </div>

        {/* Crosshair */}
        <div className="ss">
          <div className="sst">CROSSHAIR</div>
          <SettingRow label="Color">
            <ColorInput id="sc-cr" defaultValue="#8ca0c8" />
            <SliderInput id="sc-cro" min={10} max={100} defaultValue={50} />
            <span className="srv" id="sc-cro-v">50%</span>
          </SettingRow>
        </div>

        {/* Font Size */}
        <div className="ss">
          <div className="sst">FONT SIZE</div>
          <div className="sr" style={{ marginBottom: 6 }}>
            <label>Quick Scale</label>
            <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
              {(['small', 'medium', 'large'] as const).map(s => (
                <button
                  key={s}
                  className="tbtn"
                  id={`fs-${s}`}
                  onClick={() => (window as any).setFontScale?.(s)}
                  style={{
                    fontSize: 11, padding: '3px 8px', minWidth: 0,
                    ...(s === 'medium' ? { borderColor: '#D4AF37!important', color: '#D4AF37!important' } : {}),
                  }}
                >{s[0].toUpperCase()}</button>
              ))}
            </div>
          </div>
          <SettingRow label="Price Axis"><SliderInput id="sf-p" min={7} max={16} defaultValue={10} /><span className="srv" id="sf-p-v">10</span></SettingRow>
          <SettingRow label="Time Axis"><SliderInput id="sf-t" min={7} max={16} defaultValue={9} /><span className="srv" id="sf-t-v">9</span></SettingRow>
          <SettingRow label="OHLCV Tip"><SliderInput id="sf-o" min={9} max={18} defaultValue={12} /><span className="srv" id="sf-o-v">12</span></SettingRow>
          <SettingRow label="UI Scale"><SliderInput id="sf-ui" min={9} max={18} defaultValue={13} /><span className="srv" id="sf-ui-v">13</span></SettingRow>
        </div>

        {/* Presets */}
        <div className="ss">
          <div className="sst">PRESETS</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['default', 'gold', 'light', 'nord'].map(p => (
              <button key={p} className="spb" data-pr={p}>{p[0].toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <button id="s-save" className="sab" style={{ background: '#D4AF37', color: '#000' }}>💾 Save as Default</button>
          <span id="save-hint" style={{ fontSize: 8, color: '#4a6080', marginTop: 2, textAlign: 'center', display: 'block' }}>...</span>
          <button id="s-reset" className="sab" style={{ borderColor: '#ef5350', color: '#ef5350' }}>↺ Factory Reset</button>
        </div>
      </div>
    </div>
  )
}

/** Reusable setting row */
function SettingRow({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="sr"><label>{label}</label>{children}</div>
}

/** Color picker input preserving legacy ID */
function ColorInput({ id, defaultValue }: { id: string; defaultValue: string }) {
  return <input type="color" id={id} defaultValue={defaultValue} />
}

/** Range slider preserving legacy ID */
function SliderInput({ id, min, max, defaultValue, step }: { id: string; min: number; max: number; defaultValue: number; step?: number }) {
  return <input type="range" id={id} min={min} max={max} step={step || 1} defaultValue={defaultValue} style={{ flex: 1 }} />
}
