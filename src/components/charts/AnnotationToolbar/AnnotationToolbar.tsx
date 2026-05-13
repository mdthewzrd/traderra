'use client'

/**
 * AnnotationToolbar — floating toolbar for annotation editing.
 * Extracted from charts-terminal.html lines 853-982.
 * Complex color picker with canvas elements, line weight, style, opacity, etc.
 */

export function AnnotationToolbar() {
  return (
    <div
      id="ann-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'none', position: 'fixed', zIndex: 900, background: '#1e222d', border: '1px solid #2a3050', borderRadius: 4, padding: '2px 2px 2px 6px', gap: 1, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}
    >
      {/* Drag Handle */}
      <div id="ann-toolbar-handle" style={{ cursor: 'grab', padding: '4px 4px 4px 0', display: 'flex', flexDirection: 'column', gap: 1 }} title="Drag to move">
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
        <div style={{ width: 10, height: 2, background: '#4a6080', borderRadius: 1 }} />
      </div>
      <div style={{ width: 1, height: 20, background: '#2a3050', margin: '0 1px' }} />

      {/* Line Color */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-color-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleDropdown?.('color')} title="Line Color">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="14" x2="16" y2="14" strokeWidth="3" id="ann-color-line" stroke="#7b61ff" /><rect x="2" y="16" width="14" height="2" rx="1" id="ann-color-bar" fill="#7b61ff" /></svg>
        </button>
        <div id="ann-dd-color" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div className="ann-color-picker">
            <canvas id="ann-sv-canvas" width={180} height={150} style={{ borderRadius: 3, cursor: 'crosshair', display: 'block' }} />
            <canvas id="ann-hue-canvas" width={180} height={16} style={{ borderRadius: 3, cursor: 'crosshair', display: 'block', marginTop: 4 }} />
            <canvas id="ann-alpha-canvas" width={180} height={12} style={{ borderRadius: 2, cursor: 'crosshair', display: 'block', marginTop: 4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <input type="text" id="ann-hex-input" defaultValue="#7b61ff" style={{ width: 72, background: '#10131a', border: '1px solid #2a3050', borderRadius: 3, color: '#dde3f0', fontSize: 11, padding: '2px 4px', fontFamily: 'monospace', textTransform: 'uppercase' }} />
              <span style={{ color: '#4a6080', fontSize: 11 }}>α</span>
              <input type="number" id="ann-alpha-input" min={0} max={100} defaultValue={100} style={{ width: 38, background: '#10131a', border: '1px solid #2a3050', borderRadius: 3, color: '#dde3f0', fontSize: 11, padding: '2px 4px' }} />%
            </div>
            <div className="ann-swatches">
              {['#ff9800', '#26a69a', '#e879f9', '#7b61ff', '#4ade80', '#ff3d57', '#facc15', '#38bdf8', '#f472b6', '#ffffff', '#94a3b8', '#000000'].map(c => (
                <span
                  key={c}
                  onClick={() => (window as any).annPickSwatch?.(c)}
                  data-c={c}
                  style={{ background: c, ...(c === '#000000' ? { border: '1px solid #444' } : {}) }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Text Color */}
      <div className="ann-tb-group" id="ann-tcolor-group" style={{ position: 'relative', display: 'none' }}>
        <button id="ann-tcolor-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleDropdown?.('tcolor')} title="Text Color">
          <svg width="18" height="18" viewBox="0 0 18 18"><text x="3" y="14" fontSize="14" fontWeight="bold" fontFamily="monospace" id="ann-tcolor-text" fill="#ff9800">A</text></svg>
        </button>
      </div>

      {/* Line Weight */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-weight-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleDropdown?.('weight')} title="Line Width">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" strokeWidth="2" stroke="#dde3f0" /></svg>
        </button>
        <div id="ann-dd-weight" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(w => (
              <div key={w} className="ann-opt-btn" data-w={w} onMouseDown={() => (window as any).annSetWeight?.(w)} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-block', width: 30, height: w, background: '#dde3f0', verticalAlign: 'middle' }} /> {w}px
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Line Type */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-linetype-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleDropdown?.('linetype')} title="Line Style">
          <svg width="18" height="18" viewBox="0 0 18 18"><line x1="2" y1="9" x2="16" y2="9" strokeWidth="2" stroke="#dde3f0" strokeDasharray="4,3" /></svg>
        </button>
        <div id="ann-dd-linetype" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div className="ann-opt-btn" onMouseDown={() => (window as any).annSetLineStyle?.('solid')} style={{ cursor: 'pointer' }}><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" /></svg> Solid</div>
            <div className="ann-opt-btn" onMouseDown={() => (window as any).annSetLineStyle?.('dashed')} style={{ cursor: 'pointer' }}><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" strokeDasharray="6,3" /></svg> Dashed</div>
            <div className="ann-opt-btn" onMouseDown={() => (window as any).annSetLineStyle?.('dotted')} style={{ cursor: 'pointer' }}><svg width="36" height="8" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#dde3f0" strokeWidth="2" strokeDasharray="2,3" /></svg> Dotted</div>
          </div>
        </div>
      </div>

      <div className="ann-tb-sep" />

      {/* Settings */}
      <button className="ann-tb-btn" onMouseDown={() => (window as any).annShowSettings?.()} title="Settings">
        <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.5" fill="none" stroke="#8aa0c0" strokeWidth="1.5" /><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15M3.05 3.05l1.77 1.77M11.18 11.18l1.77 1.77M3.05 12.95l1.77-1.77M11.18 4.82l1.77-1.77" stroke="#8aa0c0" strokeWidth="1.2" /></svg>
      </button>

      {/* Lock */}
      <button id="ann-lock-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleLock?.()} title="Lock">
        <svg width="16" height="16" viewBox="0 0 16 16" id="ann-lock-icon"><path d="M4 7V5a4 4 0 018 0v2" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /></svg>
      </button>

      {/* Visibility */}
      <button id="ann-vis-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleVisibility?.()} title="Show/Hide">
        <svg width="16" height="16" viewBox="0 0 16 16" id="ann-vis-icon"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /><circle cx="8" cy="8" r="2.5" fill="none" stroke="#8aa0c0" strokeWidth="1.3" /></svg>
      </button>

      {/* Opacity */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button id="ann-opacity-btn" className="ann-tb-btn" onMouseDown={() => (window as any).annToggleDropdown?.('opacity')} title="Opacity">
          <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="#8aa0c0" strokeWidth="1.2" /><circle cx="9" cy="9" r="3" fill="#8aa0c0" opacity="0.5" /></svg>
        </button>
        <div id="ann-dd-opacity" className="ann-dropdown" style={{ display: 'none', minWidth: 170 }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: '6px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#8aa0c0', fontWeight: 700, letterSpacing: 0.5 }}>OPACITY</span>
              <span id="ann-opacity-val" style={{ fontSize: 11, color: '#dde3f0', fontWeight: 700, fontFamily: 'monospace' }}>100%</span>
            </div>
            <input type="range" id="ann-opacity-slider" min={5} max={100} defaultValue={100} style={{ width: '100%', accentColor: '#D4AF37', cursor: 'pointer', height: 16 }} />
          </div>
        </div>
      </div>

      <div className="ann-tb-sep" />

      {/* Delete */}
      <button className="ann-tb-btn ann-tb-btn-danger" onMouseDown={() => (window as any).annDelete?.()} title="Delete (Del)">
        <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#ff3d57" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>

      {/* More */}
      <div className="ann-tb-group" style={{ position: 'relative' }}>
        <button className="ann-tb-btn" onMouseDown={() => (window as any).annToggleDropdown?.('more')} title="More">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.5" fill="#8aa0c0" /><circle cx="8" cy="8" r="1.5" fill="#8aa0c0" /><circle cx="13" cy="8" r="1.5" fill="#8aa0c0" /></svg>
        </button>
        <div id="ann-dd-more" className="ann-dropdown" style={{ display: 'none' }} onMouseDown={(e) => e.stopPropagation()}>
          <div style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div className="ann-opt-btn" onMouseDown={() => { (window as any).annDuplicate?.(); (window as any).annCloseDropdowns?.() }} style={{ cursor: 'pointer' }}>⧉ Duplicate</div>
            <div className="ann-opt-btn" onMouseDown={() => { (window as any).annBringToFront?.(); (window as any).annCloseDropdowns?.() }} style={{ cursor: 'pointer' }}>▲ Bring to Front</div>
            <div className="ann-opt-btn" onMouseDown={() => { (window as any).annSendToBack?.(); (window as any).annCloseDropdowns?.() }} style={{ cursor: 'pointer' }}>▼ Send to Back</div>
            <div className="ann-opt-btn" id="ann-more-text" style={{ display: 'none', cursor: 'pointer' }} onMouseDown={() => { (window as any).annEditText?.(); (window as any).annCloseDropdowns?.() }}>T✎ Edit Text</div>
            <div style={{ height: 1, background: '#2a3050', margin: '2px 0' }} />
            <div className="ann-opt-btn" style={{ color: '#ff3d57', cursor: 'pointer' }} onMouseDown={() => { (window as any).annDeleteAllOfType?.(); (window as any).annCloseDropdowns?.() }}>✕ Delete All of This Type</div>
          </div>
        </div>
      </div>
    </div>
  )
}
