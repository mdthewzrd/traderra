'use client'

import { useIndicatorStore, IND_REGISTRY, type IndDef } from '@/stores/charts/indicatorStore'
import { C } from '@/lib/charts/theme'

/**
 * TabVault — Indicator vault showing active indicators with toggle/color controls.
 * Pure React — no charts-engine.js dependency.
 */

// Keys to exclude from vault display
const VAULT_EXCLUDE = new Set(['tl','ann','otherann','exec','btexec'])

export function TabVault() {
  const inds = useIndicatorStore((s) => s.inds)
  const toggle = useIndicatorStore((s) => s.toggle)

  // Group active indicators by group
  const groups: Record<string, { key: string; def: IndDef }[]> = {}
  for (const [key, on] of Object.entries(inds)) {
    if (!on || VAULT_EXCLUDE.has(key)) continue
    const reg = IND_REGISTRY[key]
    if (!reg) continue
    const g = reg.group || 'Other'
    if (!groups[g]) groups[g] = []
    groups[g].push({ key, def: reg })
  }

  const hasAny = Object.keys(groups).length > 0

  return (
    <div id="tab-vault">
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #111620', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: 1 }}>📦 INDICATOR VAULT</span>
      </div>
      <div id="vault-list" style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {!hasAny && (
          <div style={{ padding: 20, textAlign: 'center', color: '#3a4a60', fontSize: 11, fontStyle: 'italic' }}>
            No indicators active.<br />Use TOOLS tab to add indicators.
          </div>
        )}
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="vg">
            <div className="vg-title">{group.toUpperCase()}</div>
            {items.map(({ key, def }) => (
              <VaultRow key={key} indKey={key} def={def} onToggle={() => toggle(key)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function VaultRow({ indKey, def, onToggle }: { indKey: string; def: IndDef; onToggle: () => void }) {
  const mainColor = def.colors?.[0] ? C[def.colors[0]] : '#a78bfa'

  return (
    <div className="vi on" onClick={onToggle} style={{ cursor: 'pointer' }}>
      <span className="vi-dot" style={{ background: mainColor, color: mainColor }} />
      <span className="vi-name">{def.label}</span>
      {def.colors && def.colors.length > 0 && (
        <span className="vi-colors">
          {def.colors.map((ck, i) => (
            <span key={i} className="vi-cdot" style={{ background: C[ck] || '#444' }} />
          ))}
        </span>
      )}
    </div>
  )
}
