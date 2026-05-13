'use client'

import { useUIStore, useWatchlistStore } from '@/stores/charts'

/**
 * Sidebar — the right-side panel with watchlist, tabs, and settings.
 * Extracted from charts-terminal.html lines 1091-1280.
 * Phase 3: Tab switching uses Zustand. Watchlist actions still use global functions.
 */

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarTab = useUIStore((s) => s.sidebarTab)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const setSidebarTab = useUIStore((s) => s.setSidebarTab)

  // Watchlist state
  const wlLists = useWatchlistStore((s) => s.lists)
  const wlActiveIdx = useWatchlistStore((s) => s.activeIdx)
  const wlAddSymbol = useWatchlistStore((s) => s.addSymbol)
  const wlSwitchList = useWatchlistStore((s) => s.switchList)
  const wlDeleteList = useWatchlistStore((s) => s.deleteList)
  const wlRenameList = useWatchlistStore((s) => s.renameList)
  const wlCreateList = useWatchlistStore((s) => s.createList)
  const wlRemoveSymbol = useWatchlistStore((s) => s.removeSymbol)
  return (
    <div id="sidebar" className={sidebarOpen ? 'open' : ''}>
      {/* Watchlist */}
      <div id="wl-section">
        <div id="wl-head" onClick={() => document.getElementById('wl-section')?.classList.toggle('collapsed')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span id="wl-chevron" style={{ color: '#4a5580', fontSize: 11 }}>▼</span>
            <select
              id="wl-picker"
              value={wlActiveIdx}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => wlSwitchList(parseInt(e.target.value))}
            >
              {wlLists.map((l, i) => (
                <option key={i} value={i}>{l.name}</option>
              ))}
            </select>
            <button onClick={(e) => { e.stopPropagation(); const name = prompt('Watchlist name:'); if (name) wlCreateList(name) }} title="New Watchlist" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>+</button>
            <button onClick={(e) => { e.stopPropagation(); wlDeleteList() }} title="Delete Watchlist" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>🗑</button>
            <button onClick={(e) => { e.stopPropagation(); const name = prompt('New name:', wlLists[wlActiveIdx]?.name); if (name) wlRenameList(name) }} title="Rename" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>✏</button>
            <button onClick={(e) => { e.stopPropagation(); (window as any).wlColSettings?.() }} title="Columns" style={{ background: 'none', border: '1px solid #2a3050', color: '#4a6080', fontSize: 11, padding: '1px 4px', borderRadius: 2, cursor: 'pointer' }}>⚙</button>
          </div>
          <span id="wl-count" style={{ color: '#4a5580', fontSize: 11 }}>{wlLists[wlActiveIdx]?.syms?.length || 0}</span>
        </div>
        <div id="wl-body">
          <div id="wl-col-header" />
          <div id="wl-list">
            {wlLists[wlActiveIdx]?.syms?.map((sym) => (
              <div
                key={sym}
                className={`wl-row${(window as any).symbol === sym ? ' active' : ''}`}
                onClick={() => { (window as any).symbol = sym; (window as any).renderAll?.() }}
              >
                <span className="wl-sym">{sym}</span>
                <span className="wl-del" onClick={(e) => { e.stopPropagation(); wlRemoveSymbol(sym) }}>✕</span>
              </div>
            ))}
          </div>
          <div id="wl-add">
            <input
              id="wl-add-input"
              type="text"
              placeholder="+ symbol"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value
                  if (val.trim()) {
                    wlAddSymbol(val)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }
              }}
            />
            <button onClick={() => {
              const inp = document.getElementById('wl-add-input') as HTMLInputElement
              if (inp?.value.trim()) { wlAddSymbol(inp.value); inp.value = '' }
            }}>+</button>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div id="sidebar-tabs">
        {['look', 'tools', 'settings', 'vault', 'scan', 'bt', 'lab'].map(tab => (
          <div
            key={tab}
            className={`sb-tab${sidebarTab === tab ? ' active' : ''}`}
            data-tab={tab}
            onClick={() => { setSidebarTab(tab); (window as any).sbTab?.(tab) }}
          >
            {tab.toUpperCase()}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="sb-tab" onClick={() => setSidebarOpen(false)} style={{ color: '#4a5580', paddingRight: 10 }}>✕</div>
      </div>

      {/* Tab Content */}
      <div id="sidebar-content">
        <TabLook />
        <TabTools />
        <TabSettings />
        <TabVault />
        <TabScan />
        <TabBt />
        <TabLab />
      </div>
    </div>
  )
}

function TabLook() {
  return (
    <div id="tab-look">
      <div id="settings-panel-header" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>⚙ LOOK & FEEL</span>
        <span id="theme-editing-label" style={{ fontSize: 11, fontWeight: 700, color: '#6878a8', letterSpacing: 0.5, background: '#1a1e2e', padding: '2px 8px', borderRadius: 3 }}>EDITING: DARK</span>
      </div>
      <div id="settings-panel-body">
        {/* Populated by JS at runtime via settingsSync() */}
      </div>
    </div>
  )
}

function TabTools() {
  return (
    <div id="tab-tools">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 1 }}>🔧 TOOL SETTINGS</span>
      </div>
      <div id="tool-settings-body" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Populated by JS at runtime via openSingleIndSettings() */}
      </div>
    </div>
  )
}

function TabSettings() {
  return (
    <div id="tab-settings">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#22d3ee', letterSpacing: 1 }}>⚙ CHART SETTINGS</span>
      </div>
      <div id="chart-settings-body" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Populated by JS at runtime via settingsSync() */}
      </div>
    </div>
  )
}

function TabVault() {
  return (
    <div id="tab-vault">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>📦 INDICATOR VAULT</span>
      </div>
      <div id="vault-list" style={{ flex: 1, overflowY: 'auto', padding: 6 }} />
    </div>
  )
}

function TabScan() {
  return (
    <div id="tab-scan">
      <div id="scan-panel-header" style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #111620' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', letterSpacing: 1 }}>📡 SCANS</span>
        <span id="scan-count" style={{ marginLeft: 'auto', fontSize: 11, color: '#8aa0c0', fontWeight: 700 }} />
        <button id="scan-col-cog" title="Column settings" style={{ marginLeft: 6, background: 'none', border: '1px solid #3a4a68', color: '#5a7090', fontSize: 13, width: 22, height: 22, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all .15s' }}>⚙</button>
        <button id="scan-add-btn" title="Add scan" style={{ marginLeft: 4, background: 'none', border: '1px solid #4ade80', color: '#4ade80', fontSize: 14, width: 22, height: 22, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
      </div>
      <div id="scan-panel-body" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <div id="scan-list" style={{ marginBottom: 8 }} />
        <div id="scan-run-controls" style={{ display: 'none' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            <div id="scan-active-label" style={{ flex: 1, background: '#1a1e2e', border: '1px solid #4ade80', color: '#4ade80', fontSize: 11, fontWeight: 700, padding: '4px 6px', borderRadius: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
            <button id="scan-run-btn" style={{ background: '#4ade80', color: '#000', border: 'none', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ SCAN</button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button className="scan-tab active" data-scantab="live" style={{ padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #2a3050', background: 'none', color: '#4a6080' }}>LIVE</button>
            <button className="scan-tab" data-scantab="historical" style={{ padding: '4px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #2a3050', background: 'none', color: '#4a6080' }}>HIST</button>
          </div>
          <div id="scan-date-range" style={{ display: 'none', marginBottom: 6 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input id="scan-from" type="date" style={{ flex: 1, background: '#1a1e2e', border: '1px solid #a855f7', color: '#a855f7', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }} />
              <span style={{ color: '#4a6080', fontSize: 11 }}>→</span>
              <input id="scan-to" type="date" style={{ flex: 1, background: '#1a1e2e', border: '1px solid #a855f7', color: '#a855f7', fontSize: 11, padding: '3px 5px', borderRadius: 3, outline: 'none' }} />
            </div>
          </div>
          <div id="scan-filters" style={{ marginBottom: 6 }} />
        </div>
        <div id="scan-status" style={{ fontSize: 11, color: '#8aa0c0', marginBottom: 6, minHeight: 14 }} />
        <div id="scan-watchlist" />
        <div id="scan-historical" style={{ display: 'none' }} />
      </div>
    </div>
  )
}

function TabBt() {
  return (
    <div id="tab-bt">
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: 1 }}>⏱ SCAN BACKTEST</span>
      </div>
      <div style={{ padding: 8 }}>
        <div id="scan-bt-active" style={{ padding: '8px 10px', background: '#0d1220', border: '1px solid #1e2840', borderRadius: 4, fontSize: 11, color: '#8aa0c0', lineHeight: 1.5 }}>
          Select a saved scan in <span style={{ color: '#4ade80', fontWeight: 700 }}>SCAN</span> to backtest it here.
        </div>
        <div id="scan-bt-controls" style={{ display: 'none', marginTop: 8 }}>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, display: 'block', marginBottom: 2 }}>Side</label>
            <select id="scan-bt-side" style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, display: 'block', marginBottom: 2 }}>Entry</label>
            <select id="scan-bt-entry" style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }}>
              <option value="open">Next Open</option>
              <option value="close">Same Close</option>
            </select>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, display: 'block', marginBottom: 2 }}>Stop</label>
            <select id="scan-bt-stop" style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }}>
              <option value="pct">% from Entry</option>
              <option value="atr">ATR Multiple</option>
              <option value="none">No Stop</option>
            </select>
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, display: 'block', marginBottom: 2 }}>Stop %</label>
            <input id="scan-bt-stop-pct" type="number" min={0.1} step={0.5} defaultValue={5} style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, display: 'block', marginBottom: 2 }}>Target R</label>
            <input id="scan-bt-target-r" type="number" min={0} step={0.25} defaultValue={2} style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 11, color: '#4a6080', fontWeight: 700, display: 'block', marginBottom: 2 }}>Max Hold (days)</label>
            <input id="scan-bt-hold-days" type="number" min={1} step={1} defaultValue={5} style={{ width: '100%', background: '#141926', border: '1px solid #2a3050', color: '#dde3f0', fontSize: 11, padding: '6px 8px', borderRadius: 4, outline: 'none' }} />
          </div>
          <button id="scan-bt-run-btn" style={{ width: '100%', background: '#f59e0b', color: '#000', border: 'none', padding: '8px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>▶ RUN BACKTEST</button>
        </div>
        <div id="scan-bt-results" style={{ marginTop: 8, display: 'none' }} />
      </div>
    </div>
  )
}

function TabLab() {
  return (
    <div id="tab-lab">
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', letterSpacing: 1 }}>🧪 STRATEGY LAB</span>
      </div>
      <div id="lab-body" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {/* Populated by JS via StrategyLab.render() */}
      </div>
    </div>
  )
}
