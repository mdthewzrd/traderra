'use client'

/**
 * TabLook — Theme customization: candle colors, background, sessions, crosshair, font sizes.
 * Color changes mutate the shared theme C object directly — ReactChartPanel reads it each frame.
 */

import { C, F } from '@/lib/charts/theme'

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
            <SliderInput id="sc-preo" min={1} max={40} defaultValue={7} showPercent />
            <span className="srv" id="sc-preo-v">7%</span>
          </SettingRow>
          <SettingRow label="After-Hrs">
            <ColorInput id="sc-aft" defaultValue="#3c3c3c" />
            <SliderInput id="sc-afto" min={1} max={40} defaultValue={9} showPercent />
            <span className="srv" id="sc-afto-v">9%</span>
          </SettingRow>
        </div>

        {/* Crosshair */}
        <div className="ss">
          <div className="sst">CROSSHAIR</div>
          <SettingRow label="Color">
            <ColorInput id="sc-cr" defaultValue="#8ca0c8" />
            <SliderInput id="sc-cro" min={10} max={100} defaultValue={50} showPercent />
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

/** Read color/slider inputs → update theme C object so ReactChartPanel picks it up */
function syncThemeFromInputs() {
  const g = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value
  const c_up = g('sc-up'), c_dn = g('sc-dn')
  const c_bg = g('sc-bg'), c_ax = g('sc-ax'), c_gr = g('sc-gr')
  const c_vu = g('sc-vu'), c_vd = g('sc-vd')
  const c_cr = g('sc-cr')
  const c_pre = g('sc-pre'), c_aft = g('sc-aft')
  const c_preo = g('sc-preo'), c_afto = g('sc-afto'), c_cro = g('sc-cro')
  const sf_p = g('sf-p'), sf_t = g('sf-t')

  if (c_up)  { C.up = c_up; C.vol_up = `rgba(${parseInt(c_up.slice(1,3),16)},${parseInt(c_up.slice(3,5),16)},${parseInt(c_up.slice(5,7),16)},.5)` }
  if (c_dn)  { C.dn = c_dn; C.vol_dn = `rgba(${parseInt(c_dn.slice(1,3),16)},${parseInt(c_dn.slice(3,5),16)},${parseInt(c_dn.slice(5,7),16)},.5)` }
  if (c_bg)  C.bg = c_bg
  if (c_ax)  C.axisbg = c_ax
  if (c_gr)  C.grid = c_gr
  if (c_vu)  C.vol_up = `rgba(${parseInt(c_vu.slice(1,3),16)},${parseInt(c_vu.slice(3,5),16)},${parseInt(c_vu.slice(5,7),16)},.5)`
  if (c_vd)  C.vol_dn = `rgba(${parseInt(c_vd.slice(1,3),16)},${parseInt(c_vd.slice(3,5),16)},${parseInt(c_vd.slice(5,7),16)},.5)`
  if (c_cr)  C.cross = `rgba(${parseInt(c_cr.slice(1,3),16)},${parseInt(c_cr.slice(3,5),16)},${parseInt(c_cr.slice(5,7),16)},${(+(c_cro || 50)) / 100})`
  if (c_pre)  C.pre = `rgba(${parseInt(c_pre.slice(1,3),16)},${parseInt(c_pre.slice(3,5),16)},${parseInt(c_pre.slice(5,7),16)},.${(+(c_preo || 7)).toString().padStart(2,'0')})`
  if (c_aft)  C.after = `rgba(${parseInt(c_aft.slice(1,3),16)},${parseInt(c_aft.slice(3,5),16)},${parseInt(c_aft.slice(5,7),16)},.${(+(c_afto || 9)).toString().padStart(2,'0')})`
  if (sf_p) F.p = +sf_p
  if (sf_t) F.t = +sf_t
}

/** Color picker — syncs to theme on change */
function ColorInput({ id, defaultValue }: { id: string; defaultValue: string }) {
  return <input type="color" id={id} defaultValue={defaultValue} onInput={syncThemeFromInputs} />
}

/** Range slider — syncs to theme + updates value display */
function SliderInput({ id, min, max, defaultValue, step, showPercent }: { id: string; min: number; max: number; defaultValue: number; step?: number; showPercent?: boolean }) {
  return <input 
    type="range" 
    id={id} 
    min={min} 
    max={max} 
    step={step || 1} 
    defaultValue={defaultValue} 
    style={{ flex: 1 }} 
    onInput={() => {
      const el = document.getElementById(id) as HTMLInputElement
      const vEl = document.getElementById(id + '-v')
      if (el && vEl) vEl.textContent = showPercent ? el.value + '%' : el.value
      syncThemeFromInputs()
    }} 
  />
}
