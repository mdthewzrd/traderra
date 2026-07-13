'use client'

import { useEffect, useRef, useState, Component } from 'react'
import { useUIStore } from '@/stores/charts'
import { useToolStore } from '@/stores/charts/toolStore'
import { TabLook } from './tabs/TabLook'
import { TabTools } from './tabs/TabTools'
import { TabSettings } from './tabs/TabSettings'
import { TabVault } from './tabs/TabVault'
import { TabScan } from './tabs/TabScan'
import { TabBt } from './tabs/TabBt'
import { TabLab } from './tabs/TabLab'
import { TabAgent } from './tabs/TabAgent'
import { WatchlistPanel } from './WatchlistPanel'

class SidebarErrorBoundary extends Component<{
  children: React.ReactNode
}, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: any) { return { error: String(e?.message || e) } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 12, fontSize: 11, color: '#ff6b6b', fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ Sidebar Error</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10 }}>{this.state.error}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 8, background: '#1a2030', border: '1px solid #2a3050', color: '#dde3f0', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Sidebar — right-side panel with watchlist, tab navigation, and tab content.
 *
 * Architecture:
 * - Watchlist: fully React/Zustand
 * - Tab bar: React/Zustand controls active tab
 * - Tab content: Real React components (TabLook, TabTools, etc.)
 *   Element IDs preserved for charts-engine.js interop (initS, settingsSync, vaultRender, etc.)
 * - Overlay modals: still HTML via dangerouslySetInnerHTML (managed by charts-engine.js)
 */

const MODALS_HTML = `
<div id="modal-overlay" onclick="modalClose()"></div>
<div id="modal-box">
  <div id="modal-title"></div>
  <div id="modal-body"></div>
  <div id="modal-actions"></div>
</div>

<div id="scan-add-modal">
  <div id="scan-add-box">
    <h3>＋ ADD SCAN</h3>
    <div style="padding:0 16px;overflow-y:auto;flex:1;">
      <div style="display:flex;gap:4px;margin:10px 0 8px;">
        <button class="scan-add-tab active" data-addtab="upload" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:#1a2030;color:#4ade80;">📤 UPLOAD</button>
        <button class="scan-add-tab" data-addtab="builtin" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">📡 BUILT-IN</button>
        <button class="scan-add-tab" data-addtab="code" style="flex:1;padding:6px;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">💻 CODE</button>
      </div>
      <input type="text" id="scan-add-name" placeholder="Scan name (e.g. Inside Day — Q1 2025)" />
      <div id="scan-add-upload" class="scan-add-panel">
        <div class="scan-upload-zone" id="scan-drop-zone">
          <div class="icon">📂</div>
          <p style="color:#dde3f0;font-weight:700;font-size:12px;">Drop file or click to upload</p>
          <p>CSV, JSON, or JS scan files</p>
          <input type="file" id="scan-file-input" accept=".csv,.json,.js,.py" style="display:none;" />
        </div>
        <div id="scan-file-info" style="display:none;padding:8px;background:#0d1220;border:1px solid #1e2840;border-radius:4px;margin-top:8px;font-size:11px;color:#8aa0c0;"></div>
      </div>
      <div id="scan-add-builtin" class="scan-add-panel" style="display:none;">
        <select id="scan-add-strategy" style="width:100%;background:#141926;border:1px solid #2a3050;color:#dde3f0;font-size:12px;padding:6px 10px;border-radius:4px;margin:4px 0;">
          <option value="inside_day_long">Inside Day Long</option>
        </select>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <div style="flex:1;">
            <label style="font-size:11px;color:#4a6080;">FROM</label>
            <input type="date" id="scan-add-from" style="width:100%;background:#141926;border:1px solid #2a3050;color:#a855f7;font-size:11px;padding:4px 6px;border-radius:3px;outline:none;" />
          </div>
          <div style="flex:1;">
            <label style="font-size:11px;color:#4a6080;">TO</label>
            <input type="date" id="scan-add-to" style="width:100%;background:#141926;border:1px solid #2a3050;color:#a855f7;font-size:11px;padding:4px 6px;border-radius:3px;outline:none;" />
          </div>
        </div>
        <p style="font-size:11px;color:#4a6080;margin-top:6px;">Creates a saved scan and runs it. Results are stored.</p>
      </div>
      <div id="scan-add-code" class="scan-add-panel" style="display:none;">
        <textarea id="scan-add-codearea" placeholder="// Paste scan code here...\\n// Must export: function scan(dayMaps, dates, filterMode) → results[]" style="width:100%;height:140px;background:#0a0c12;border:1px solid #2a3050;color:#dde3f0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:11px;padding:8px;border-radius:4px;resize:vertical;outline:none;"></textarea>
        <p style="font-size:11px;color:#4a6080;margin-top:4px;">JS code receives (dayMaps, dates, filterMode) and returns results[].</p>
      </div>
    </div>
    <div class="scan-modal-btns">
      <button class="btn-cancel" onclick="scanAddClose()">Cancel</button>
      <button class="btn-validate" id="scan-validate-btn" onclick="scanAddValidate()" style="background:#a855f7;color:#fff;">🤖 Validate & Fix</button>
      <button class="btn-save" id="scan-add-save" onclick="scanAddSave()">Save Scan</button>
    </div>
    <div id="scan-validate-result" style="display:none;padding:10px 16px;border-top:1px solid #1e2840;max-height:200px;overflow-y:auto;"></div>
  </div>
</div>

<div id="pct-popup">
  <div id="pct-popup-title" style="font-size:11px;letter-spacing:1px;font-weight:700;color:#ff9800;cursor:move;user-select:none;">LONG</div>
  <div style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5px 8px;">
    <label id="pct-price-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;display:none;">PRICE</label>
    <input id="pct-price-input" type="number" step="0.01" placeholder="price" style="background:#1e2436;border:1px solid #fbbf24;color:#fbbf24;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;display:none;"/>
    <label style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;">% RISK</label>
    <div style="display:flex;gap:4px;">
      <input id="pct-input" type="number" min="0" max="9999" step="1" placeholder="100" style="background:#1e2436;border:1px solid #2a3050;color:#dde3f0;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;flex:1;min-width:0;"/>
      <button id="pct-rebuy" title="Re-add last sold qty" style="background:none;border:1px solid #ff9800;color:#ff9800;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;padding:2px 5px;border-radius:3px;cursor:pointer;white-space:nowrap;">↺ REBUY</button>
    </div>
    <label id="pct-stop-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;">STOP</label>
    <input id="pct-stop-input" type="number" step="0.0001" placeholder="price" style="background:#1e2436;border:1px solid #2a3050;color:#facc15;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;"/>
    <label id="pct-pnlrisk-label" style="font-size:11px;color:#4a6080;font-family:'Inter',system-ui,-apple-system,sans-serif;display:none;">+BASE%</label>
    <input id="pct-pnlrisk-input" type="number" min="0" max="9999" step="1" placeholder="0" title="Use locked PnL + this% of Risk$ as risk budget" style="background:#1e2436;border:1px solid #2a3050;color:#a78bfa;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:14px;padding:4px 7px;border-radius:3px;outline:none;width:100%;display:none;"/>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="pct-mode-normal" style="flex:1;padding:2px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;cursor:pointer;border:1px solid #ff9800;background:#ff980018;color:#ff9800;">% RISK</button>
    <button id="pct-mode-pnl" style="flex:1;padding:2px;border-radius:3px;font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:8px;cursor:pointer;border:1px solid #2a3050;background:none;color:#4a6080;">PNL + %</button>
  </div>
  <div id="pct-popup-hint" style="font-size:11px;color:#2a4060;margin-top:3px;line-height:1.4;min-height:12px;"></div>
  <div class="popup-btns">
    <button id="pct-ok">PLACE</button>
    <button class="cancel" id="pct-cancel">CANCEL</button>
  </div>
</div>

<div id="text-popup">
  <div style="font-size:11px;color:#a855f7;letter-spacing:1px;font-weight:700;">ANNOTATION TEXT</div>
  <input id="text-input" type="text" placeholder="Enter label…" maxlength="80"/>
  <div class="popup-btns">
    <button id="text-ok">PLACE</button>
    <button class="cancel" id="text-cancel">CANCEL</button>
  </div>
</div>
`

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const sidebarTab = useUIStore((s) => s.sidebarTab)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const setSidebarTab = useUIStore((s) => s.setSidebarTab)
  const agentChatOpen = useUIStore((s) => s.agentChatOpen)
  const setAgentChatOpen = useUIStore((s) => s.setAgentChatOpen)

  const sbRef = useRef<HTMLDivElement>(null)

  // Sync open/close + bridge sbOpen/sbClose
  useEffect(() => {
    const el = sbRef.current
    if (!el) return
    if (sidebarOpen) el.classList.add('open')
    else el.classList.remove('open')
    ;(window as any).sbOpen = (tab?: string) => {
      setSidebarOpen(true)
      if (tab) setSidebarTab(tab)
    }
    ;(window as any).sbClose = () => setSidebarOpen(false)
  }, [sidebarOpen, setSidebarOpen, setSidebarTab])

  const tabs = ['look', 'tools', 'settings', 'vault', 'scan', 'bt', 'lab'] as const
  const tabLabels: Record<string, string> = { look: 'LOOK', tools: 'TOOLS', settings: 'SET', vault: 'VAULT', scan: 'SCAN', bt: 'BT', lab: 'LAB' }

  return (
    <div id="sidebar" ref={sbRef} className={sidebarOpen ? 'open' : ''}>
      {/* WL / RENATA toggle tabs at top */}
      <div style={{ display: 'flex', background: '#0a0c12', borderBottom: '1px solid #222840', flexShrink: 0 }}>
        <div
          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderBottom: !agentChatOpen ? '2px solid #6878a8' : '2px solid transparent', color: !agentChatOpen ? '#dde3f0' : '#4a6080', background: !agentChatOpen ? '#141926' : 'transparent' }}
          onClick={() => setAgentChatOpen(false)}
        >📋 WL</div>
        <div
          style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderBottom: agentChatOpen ? '2px solid #a855f7' : '2px solid transparent', color: agentChatOpen ? '#a855f7' : '#4a6080', background: agentChatOpen ? '#1a1030' : 'transparent' }}
          onClick={() => setAgentChatOpen(true)}
        >🤖 RENATA</div>
        <div style={{ flex: 1 }} />
      </div>

      {/* Watchlist or Renata Chat */}
      {!agentChatOpen ? (
      <WatchlistPanel />
      ) : (
      <div id="wl-section" style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
        <TabAgent embedded />
      </div>
      )}

      {/* Tab Bar */}
      <div id="sidebar-tabs">
        {tabs.map(tab => (
          <div
            key={tab}
            className={`sb-tab${sidebarTab === tab ? ' active' : ''}`}
            data-tab={tab}
            onClick={() => { setSidebarTab(tab); (window as any).sbTab?.(tab); if (tab === 'tools') useToolStore.getState().selectTool(null) }}
          >
            {tabLabels[tab] || tab.toUpperCase()}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div className="sb-tab" onClick={() => setSidebarOpen(false)} style={{ color: '#4a5580', paddingRight: 10 }}>✕</div>
      </div>

      {/* Tab Content — Real React components */}
      <div id="sidebar-content">
        <div id="tab-look" className={sidebarTab === 'look' ? 'tab-active' : ''}><TabLook /></div>
        <div id="tab-tools" className={sidebarTab === 'tools' ? 'tab-active' : ''}><TabTools /></div>
        <div id="tab-settings" className={sidebarTab === 'settings' ? 'tab-active' : ''}><TabSettings /></div>
        <div id="tab-vault" className={sidebarTab === 'vault' ? 'tab-active' : ''}><TabVault /></div>
        <div id="tab-scan" className={sidebarTab === 'scan' ? 'tab-active' : ''}><TabScan /></div>
        <div id="tab-bt" className={sidebarTab === 'bt' ? 'tab-active' : ''}><TabBt /></div>
        <div id="tab-lab" className={sidebarTab === 'lab' ? 'tab-active' : ''}><TabLab /></div>
      </div>

      {/* Overlay modals — still HTML for charts-engine.js interop */}
      <div dangerouslySetInnerHTML={{ __html: MODALS_HTML }} />
    </div>
  )
}
