'use client'

/**
 * TabVault — Indicator vault showing active indicators with toggle/color controls.
 * The vault list (#vault-list) is populated by charts-engine.js vaultRender().
 */

export function TabVault() {
  return (
    <div id="tab-vault">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>📦 INDICATOR VAULT</span>
      </div>
      <div id="vault-list" style={{ flex: 1, overflowY: 'auto', padding: 6 }} />
    </div>
  )
}
