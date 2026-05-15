'use client'

/**
 * TabLab — Strategy Lab: projects list, project detail with phases, notes, screenshots.
 */

export function TabLab() {
  return (
    <div id="tab-lab">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: 1 }}>🔬 STRATEGY LAB</span>
        <span style={{ flex: 1 }} />
        <button id="lab-add-project" style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>+ NEW</button>
      </div>
      <div id="lab-projects-list" style={{ padding: '6px 0', maxHeight: 120, overflowY: 'auto' }}>
        <div style={{ padding: '10px 14px', fontSize: 11, color: '#4a6080' }}>No strategy projects yet.</div>
      </div>
      <div id="lab-project-detail" style={{ display: 'none', padding: 0 }}>
        <div id="lab-project-header" style={{ padding: '8px 12px', borderBottom: '1px solid #1e2840', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button id="lab-back-btn" style={{ background: 'none', border: 'none', color: '#4a6080', fontSize: 14, cursor: 'pointer' }}>←</button>
          <span id="lab-project-title" style={{ fontSize: 12, fontWeight: 800, color: '#c084fc', flex: 1 }} />
          <span id="lab-project-status" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 700 }} />
          <button id="lab-capture-btn" title="Capture chart screenshot" style={{ background: '#c084fc', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>📷</button>
          <button id="lab-add-note-btn" style={{ background: 'none', border: '1px solid #3a4a68', color: '#8aa0c0', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, cursor: 'pointer' }}>+ Note</button>
        </div>
        <div id="lab-phase-tabs" style={{ display: 'flex', borderBottom: '1px solid #1e2840', overflowX: 'auto' }} />
        <div id="lab-entries" style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }} />
      </div>
    </div>
  )
}
