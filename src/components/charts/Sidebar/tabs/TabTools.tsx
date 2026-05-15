'use client'

/**
 * TabTools — Tool settings panel with add-tool button.
 * The tools body (#tools-body) is populated by charts-engine.js.
 */

export function TabTools() {
  return (
    <div id="tab-tools">
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1e2a', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ TOOL SETTINGS</span>
        <span id="tools-ind-label" style={{ fontSize: 11, fontWeight: 700, color: '#6878a8', letterSpacing: 0.5, background: '#1a1e2e', padding: '2px 8px', borderRadius: 3, marginLeft: 8 }}>SELECT TOOL</span>
        <button
          id="add-tool-btn"
          onClick={() => (window as any).openAddToolPopup?.()}
          style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', border: '1px solid #D4AF37', color: '#D4AF37', background: 'transparent', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontWeight: 700 }}
        >＋</button>
      </div>
      <div id="add-tool-popup" style={{ display: 'none' }} />
      <div id="tools-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }} />
    </div>
  )
}
