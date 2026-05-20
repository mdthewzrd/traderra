'use client'

import { useEffect } from 'react'

/**
 * TabLook — Theme customization: candle colors, background, sessions, crosshair, font sizes.
 * Color changes mutate the shared theme C object directly — ReactChartPanel reads it each frame.
 * Save/Load uses localStorage key 'traderra-cfg' (same format as charts-engine.js).
 */

import { C, F } from '@/lib/charts/theme'
import { useUIStore } from '@/stores/charts/uiStore'

const CFG_KEY = 'traderra-cfg'

// Presets — same as charts-engine.js PR object
const PRESETS: Record<string, ThemeCfg> = {
  default: { bg:'#0c0e14', ax:'#0d0f18', gr:'#141926', up:'#26a69a', dn:'#ef5350', pre:'#787878', po:8, aft:'#3c3c3c', ao:10, cr:'#8ca0c8', co:50, bd:'#1e2535', p:10, t:9, o:12 },
  gold:    { bg:'#0a0a08', ax:'#0d0c0a', gr:'#1a1810', up:'#D4AF37', dn:'#ef5350', pre:'#787878', po:8, aft:'#3c3c3c', ao:10, cr:'#D4AF37', co:40, bd:'#2a2510', p:10, t:9, o:12 },
  light:   { bg:'#f4f3f0', ax:'#f0efec', gr:'#dddcd8', up:'#26a69a', dn:'#ef5350', pre:'#ff9800', po:6, aft:'#2196f3', ao:5, cr:'#333333', co:60, bd:'#ccc8c0', p:10, t:9, o:12 },
  nord:    { bg:'#2e3440', ax:'#3b4252', gr:'#434c5e', up:'#a3be8c', dn:'#bf616a', pre:'#d08770', po:10, aft:'#81a1c1', ao:8, cr:'#d8dee9', co:40, bd:'#4c566a', p:10, t:9, o:12 },
}

interface ThemeCfg {
  bg?: string; ax?: string; gr?: string; up?: string; dn?: string; vu?: string; vd?: string
  pre?: string; po?: number; aft?: string; ao?: number
  cr?: string; co?: number; bd?: string
  p?: number; t?: number; o?: number; ui?: number
}

// Hex → rgba helper
function hexRgb(hex: string) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }
}
function rga(hex: string, opacity: number) {
  const {r,g,b} = hexRgb(hex)
  return `rgba(${r},${g},${b},${(opacity||50)/100})`
}

/** Read current input values into a cfg snapshot */
function readInputs(): ThemeCfg {
  const g = (id: string) => (document.getElementById(id) as HTMLInputElement)?.value
  return {
    bg: g('sc-bg'), ax: g('sc-ax'), gr: g('sc-gr'),
    up: g('sc-up'), dn: g('sc-dn'),
    vu: g('sc-vu'), vd: g('sc-vd'),
    pre: g('sc-pre'), po: +(g('sc-preo')||7),
    aft: g('sc-aft'), ao: +(g('sc-afto')||9),
    cr: g('sc-cr'), co: +(g('sc-cro')||50),
    bd: g('sc-bd'),
    p: +(g('sf-p')||10), t: +(g('sf-t')||9), o: +(g('sf-o')||12),
  }
}

/** Apply a cfg snapshot to the theme C object */
function applyCfg(s: ThemeCfg) {
  if (s.up) { C.up = s.up; C.vol_up = `rgba(${hexRgb(s.up).r},${hexRgb(s.up).g},${hexRgb(s.up).b},.5)` }
  if (s.dn) { C.dn = s.dn; C.vol_dn = `rgba(${hexRgb(s.dn).r},${hexRgb(s.dn).g},${hexRgb(s.dn).b},.5)` }
  if (s.vu) C.vol_up = `rgba(${hexRgb(s.vu).r},${hexRgb(s.vu).g},${hexRgb(s.vu).b},.5)`
  if (s.vd) C.vol_dn = `rgba(${hexRgb(s.vd).r},${hexRgb(s.vd).g},${hexRgb(s.vd).b},.5)`
  if (s.bg) C.bg = s.bg
  if (s.ax) C.axisbg = s.ax
  if (s.gr) C.grid = s.gr
  if (s.pre) C.pre = rga(s.pre, s.po || 7)
  if (s.aft) C.after = rga(s.aft, s.ao || 9)
  if (s.cr) C.cross = rga(s.cr, s.co || 50)
  if (s.p) F.p = s.p
  if (s.t) F.t = s.t
  if (s.o) F.o = s.o
}

/** Push current C/F values back into the DOM inputs */
function syncInputsFromTheme() {
  const s = (id: string, v: string) => { const e = document.getElementById(id) as HTMLInputElement; if (e) e.value = v }
  const sv = (id: string, v: number, vid: string, suffix?: string) => {
    const e = document.getElementById(id) as HTMLInputElement; const ve = document.getElementById(vid)
    if (e) e.value = v; if (ve) ve.textContent = v + (suffix || '')
  }
  s('sc-up', C.up); s('sc-dn', C.dn)
  s('sc-vu', C.up); s('sc-vd', C.dn)
  s('sc-bg', C.bg); s('sc-ax', C.axisbg); s('sc-gr', C.grid)
  sv('sf-p', F.p, 'sf-p-v'); sv('sf-t', F.t, 'sf-t-v'); sv('sf-o', F.o, 'sf-o-v')
}

export function TabLook() {
  // Load saved theme on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CFG_KEY)
      if (raw) {
        const cfg = JSON.parse(raw)
        applyCfg(cfg)
        syncInputsFromTheme()
      }
    } catch {}
  }, [])

  const handleSave = async () => {
    const cfg = readInputs()
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
    // Try cloud save
    let cloudOk = false
    try {
      const r = await fetch('/api/chart-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      const j = await r.json(); cloudOk = j.ok
    } catch {}
    const btn = document.getElementById('s-save')!
    btn.textContent = cloudOk ? '✓ Saved to profile!' : '✓ Saved locally'
    ;(btn as HTMLElement).style.background = cloudOk ? '#22c55e' : '#f59e0b'
    setTimeout(() => { btn.textContent = '💾 Save as Default'; (btn as HTMLElement).style.background = '#D4AF37' }, 1500)
  }

  const handleReset = () => {
    localStorage.removeItem(CFG_KEY)
    applyCfg(PRESETS.default)
    syncInputsFromTheme()
  }

  const handlePreset = (name: string) => {
    const pr = PRESETS[name]
    if (!pr) return
    applyCfg(pr)
    syncInputsFromTheme()
  }

  return (
    <div id="tab-look">
      <div id="settings-panel-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ LOOK & FEEL</span>
        <span id="theme-editing-label" style={{ fontSize: 11, fontWeight: 700, color: '#6878a8', letterSpacing: 0.5, background: '#1a1e2e', padding: '2px 8px', borderRadius: 3 }}>EDITING: {useUIStore(s => s.theme).toUpperCase()}</span>
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
            <button id="sc-clean" style={{ background: useUIStore.getState().cleanPrints ? '#e879f918' : '#1a1e2a', border: '1px solid #e879f9', color: '#e879f9', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 3, cursor: 'pointer' }} onClick={() => { const v = !useUIStore.getState().cleanPrints; useUIStore.getState().setCleanPrints(v); const btn = document.getElementById('sc-clean'); if (btn) { btn.textContent = v ? 'ON' : 'OFF'; btn.style.background = v ? '#e879f918' : '#1a1e2a' } }}>{useUIStore.getState().cleanPrints ? 'ON' : 'OFF'}</button>
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
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {[
              { label: 'S', p: 8, t: 7, o: 10 },
              { label: 'M', p: 10, t: 9, o: 12 },
              { label: 'L', p: 13, t: 11, o: 15 },
            ].map(({ label, p, t, o }) => (
              <button key={label} className="spb" onClick={() => { F.p = p; F.t = t; F.o = o; syncInputsFromTheme() }}>{label}</button>
            ))}
          </div>
          <SettingRow label="Price Axis"><SliderInput id="sf-p" min={7} max={16} defaultValue={10} /><span className="srv" id="sf-p-v">10</span></SettingRow>
          <SettingRow label="Time Axis"><SliderInput id="sf-t" min={7} max={16} defaultValue={9} /><span className="srv" id="sf-t-v">9</span></SettingRow>
          <SettingRow label="OHLCV Tip"><SliderInput id="sf-o" min={9} max={18} defaultValue={12} /><span className="srv" id="sf-o-v">12</span></SettingRow>
        </div>

        {/* Presets */}
        <div className="ss">
          <div className="sst">PRESETS</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['default', 'gold', 'light', 'nord'].map(p => (
              <button key={p} className="spb" data-pr={p} onClick={() => handlePreset(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
          <button id="s-save" className="sab" style={{ background: '#D4AF37', color: '#000' }} onClick={handleSave}>💾 Save as Default</button>
          <button id="s-reset" className="sab" style={{ borderColor: '#ef5350', color: '#ef5350' }} onClick={handleReset}>↺ Factory Reset</button>
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
  applyCfg(readInputs())
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
